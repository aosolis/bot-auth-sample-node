let appInsights = require("applicationinsights");
let express = require("express");
let exphbs  = require("express-handlebars");
import { Request, Response } from "express";
let bodyParser = require("body-parser");
let favicon = require("serve-favicon");
let http = require("http");
let path = require("path");
let logger = require("morgan");
import * as config from "config";
import * as builder from "botbuilder";
import * as msteams from "botbuilder-teams";
import * as winston from "winston";
import * as storage from "./storage";
import * as utils from "./utils";
import { AuthBot } from "./AuthBot";
import { LinkedInApi } from "./providers/LinkedInProvider";

// Configure instrumentation
let instrumentationKey = config.get("app.instrumentationKey");
if (instrumentationKey) {
    appInsights.setup(instrumentationKey)
        .setAutoDependencyCorrelation(true)
        .start();
    winston.add(utils.ApplicationInsightsTransport as any);
    appInsights.client.addTelemetryProcessor(utils.stripQueryFromTelemetryUrls);
}

let app = express();

app.set("port", process.env.PORT || 3978);
app.use(logger("dev"));
app.use(express.static(path.join(__dirname, "../../public")));
app.use(favicon(path.join(__dirname, "../../public/assets", "favicon.ico")));
app.use(bodyParser.json());

let handlebars = exphbs.create({
    extname: ".hbs",
});
app.engine("hbs", handlebars.engine);
app.set("view engine", "hbs");

// Configure storage
let botStorageProvider = config.get("storage");
let botStorage = null;
switch (botStorageProvider) {
    case "mongoDb":
        botStorage = new storage.MongoDbBotStorage(config.get("mongoDb.botStateCollection"), config.get("mongoDb.connectionString"));
        break;
    case "memory":
        botStorage = new builder.MemoryBotStorage();
        break;
    case "null":
        botStorage = new storage.NullBotStorage();
        break;
}

// Create chat bot
let connector = new msteams.TeamsChatConnector({
    appId: config.get("bot.appId"),
    appPassword: config.get("bot.appPassword"),
});
let botSettings = {
    storage: botStorage,
    authState: new storage.MemoryAuthenticationStateStore(),
    linkedIn: new LinkedInApi(config.get("linkedIn.clientId"), config.get("linkedIn.clientSecret")),
};
let bot = new AuthBot(connector, botSettings, app);

// Log bot errors
bot.on("error", (error: Error) => {
    winston.error(error.message, error);
});

// Configure bot routes
app.post("/api/messages", connector.listen());

// Configure auth routes
app.get("/auth/:provider/callback", (req, res) => {
    res.render("oauth-callback", {
        provider: req.params.provider,
        originalUrl: encodeURI(req.originalUrl),
    });
});

// Configure ping route
app.get("/ping", (req, res) => {
    res.status(200).send("OK");
});

// error handlers

// development error handler
// will print stacktrace
if (app.get("env") === "development") {
    app.use(function(err: any, req: Request, res: Response, next: Function): void {
        winston.error("Failed request", err);
        res.send(err.status || 500, err);
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err: any, req: Request, res: Response, next: Function): void {
    winston.error("Failed request", err);
    res.sendStatus(err.status || 500);
});

http.createServer(app).listen(app.get("port"), function (): void {
    winston.verbose("Express server listening on port " + app.get("port"));
});
