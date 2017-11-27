let appInsights = require("applicationinsights");
let express = require("express");
import { Request, Response } from "express";
let bodyParser = require("body-parser");
let favicon = require("serve-favicon");
let http = require("http");
let path = require("path");
let logger = require("morgan");
import * as config from "config";
import * as msteams from "botbuilder-teams";
import * as winston from "winston";
import * as storage from "./storage";
import * as utils from "./utils";
import { YatBot } from "./YatBot";

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

// Configure storage
let botStorageProvider = config.get("storage");
let botStorage = null;
switch (botStorageProvider) {
    case "mongoDb":
        botStorage = new storage.MongoDbBotStorage(config.get("mongoDb.botStateCollection"), config.get("mongoDb.connectionString"));
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
};
let bot = new YatBot(connector, botSettings);

// Log bot errors
bot.on("error", (error: Error) => {
    winston.error(error.message, error);
});

// Configure bot routes
app.post("/api/messages", connector.listen());

// Configure ping route
app.get("/ping", (req, res) => {
    res.status(200).send("OK");
});

// catch 404 and forward to error handler
app.use((req: Request, res: Response, next: Function) => {
    let err: any = new Error("Not Found");
    err.status = 404;
    next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get("env") === "development") {
    app.use(function(err: any, req: Request, res: Response, next: Function): void {
        winston.error("Failed request", err);
        res.status(err.status || 500);
        res.render("error", {
            message: err.message,
            error: err,
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err: any, req: Request, res: Response, next: Function): void {
    winston.error("Failed request", err);
    res.status(err.status || 500);
    res.render("error", {
        message: err.message,
        error: {},
    });
});

http.createServer(app).listen(app.get("port"), function (): void {
    winston.verbose("Express server listening on port " + app.get("port"));
});
