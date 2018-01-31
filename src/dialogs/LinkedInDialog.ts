// Copyright (c) Microsoft Corporation
// All rights reserved.
//
// MIT License:
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED ""AS IS"", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

import * as builder from "botbuilder";
import * as config from "config";
import * as constants from "../constants";
import * as storage from "../storage";
import * as linkedin from "../providers/LinkedInProvider";

// Dialog that handles dialogs for LinkedIn provider
export class LinkedInDialog extends builder.IntentDialog
{
    private linkedInApi: linkedin.LinkedInApi;
    private authState: storage.IAuthenticationStateStore;

    constructor() {
        super();
    }

    // Register the dialog with the bot
    public register(bot: builder.UniversalBot, rootDialog: builder.IntentDialog): void {
        bot.dialog(constants.DialogId.LinkedIn, this);
        this.linkedInApi = bot.get("linkedIn") as linkedin.LinkedInApi;
        this.authState = bot.get("authState") as storage.IAuthenticationStateStore;

        this.onBegin((session, args, next) => { this.onDialogBegin(session, args, next); });
        this.onDefault((session) => { this.onMessageReceived(session); });
        this.matches(/SignIn/, (session) => { this.handleLogin(session); });
        this.matches(/ShowProfile/, (session) => { this.showUserProfile(session); });
        this.matches(/SignOut/, (session) => { this.handleLogout(session); });
    }

    // Handle start of dialog
    private async onDialogBegin(session: builder.Session, args: any, next: () => void): Promise<void> {
        session.dialogData.isFirstTurn = true;
        this.showUserProfile(session);
        next();
    }

    // Handle message
    private async onMessageReceived(session: builder.Session): Promise<void> {
        let messageAsAny = session.message as any;
        if (messageAsAny.originalInvoke) {
            // This was originally an invoke message
            let event = messageAsAny.originalInvoke;
            if (event.name === "signin/verifyState") {
                await this.handleLoginCallback(session);
            } else {
                let payload = event.value;
                switch (payload.command) {
                    case "profile":
                        await this.showUserProfile(session);
                        break;

                    case "logout":
                        await this.handleLogout(session);
                        break;

                    case "login":
                        await this.handleLogin(session);
                        break;
                }
            }
        } else {
            // Unrecognized input
            session.send("I didn't understand. Please select an option below.");
            this.promptForAction(session);
        }
    }

    // Show prompt of options
    private async promptForAction(session: builder.Session): Promise<void> {
        let msg = new builder.Message(session)
            .addAttachment(new builder.ThumbnailCard(session)
                .title("LinkedIn")
                .buttons([
                    builder.CardAction.messageBack(session, null, "Sign in")
                        .text("SignIn")
                        .displayText("Sign in"),
                    builder.CardAction.messageBack(session, null, "Show profile")
                        .text("ShowProfile")
                        .displayText("Show profile"),
                    builder.CardAction.messageBack(session, null, "Sign out")
                        .text("SignOut")
                        .displayText("Sign out"),
                ]));
        session.send(msg);
    }

    // Handle user login callback
    private async handleLoginCallback(session: builder.Session): Promise<void> {
        let messageAsAny = session.message as any;
        let magicNumber = messageAsAny.originalInvoke.value.state;

        let tokenUnsafe = this.getUserTokenUnsafe(session);
        if (!tokenUnsafe.magicNumberVerified &&
            (tokenUnsafe.magicNumber === magicNumber)) {
            tokenUnsafe.magicNumberVerified = true;
            this.setUserToken(session, tokenUnsafe);
        } else {
            console.warn("Magic number does not match.");
        }

        if (this.getUserToken(session)) {
            await this.showUserProfile(session);
        } else {
            session.send("Sorry, there was an error signing in to LinkedIn. Please try again.");
        }
    }

    // Show user profile
    private async showUserProfile(session: builder.Session): Promise<void> {
        let accessToken = this.getUserToken(session);
        if (accessToken) {
            let profile = await this.linkedInApi.getProfileAsync(accessToken.token, [ "formatted-name", "headline", "picture-url", "public-profile-url", "location", "num-connections", "num-connections-capped" ]);
            let profileCard = new builder.ThumbnailCard()
                .title(profile.formattedName)
                .subtitle(profile.headline)
                .text(`${profile.location.name} • ${profile.numConnections}${profile.numConnectionsCapped ? "+" : ""} connections`)
                .buttons([
                    builder.CardAction.openUrl(session, profile.publicProfileUrl, "View on LinkedIn"),
                ])
                .images([
                    new builder.CardImage()
                        .url(profile.pictureUrl)
                        .alt(profile.formattedName),
                ]);
            session.send(new builder.Message().addAttachment(profileCard));
        } else {
            session.send("Please sign in to LinkedIn so I can access your profile.");
        }

        await this.promptForAction(session);
    }

    // Handle user logout request
    private async handleLogout(session: builder.Session): Promise<void> {
        if (!this.getUserToken(session)) {
            session.send("You're already signed out of LinkedIn.");
        } else {
            this.setUserToken(session, null);
            session.send("You're now signed out of LinkedIn.");
        }

        await this.promptForAction(session);
    }

    // Handle user login request
    private async handleLogin(session: builder.Session): Promise<void> {
        if (this.getUserToken(session)) {
            session.send("You're already signed in to LinkedIn.");
            await this.promptForAction(session);
        } else {
            // Get auth url and set up auth state
            let linkedInUrl = this.linkedInApi.getAuthorizationUrl();
            session.userData.oauthState = linkedInUrl.state;
            await this.authState.setAsync(linkedInUrl.state, JSON.stringify(session.message.address));
            session.save().sendBatch();

            // Send card with signin action
            let authUrl = config.get("app.baseUri") + `/html/auth-start.html?authorizationUrl=${encodeURIComponent(linkedInUrl.url)}`;
            let msg = new builder.Message(session)
                .addAttachment(new builder.HeroCard(session)
                    .text("Click below to sign in to LinkedIn")
                    .buttons([
                        new builder.CardAction(session)
                            .type("signin")
                            .value(authUrl)
                            .title("Sign in"),
                    ]));
            session.send(msg);
        }
    }

    private getUserToken(session: builder.Session): linkedin.UserToken {
        let token = this.getUserTokenUnsafe(session);
        return (token && token.magicNumberVerified) ? token : null;
    }

    private getUserTokenUnsafe(session: builder.Session): linkedin.UserToken {
        return (session.userData.linkedIn && session.userData.linkedIn.userToken);
    }

    private setUserToken(session: builder.Session, token: linkedin.UserToken): void {
        let data = session.userData.linkedIn || {};
        data.userToken = token;
        session.userData.linkedIn = data;
        session.save().sendBatch();
    }
}
