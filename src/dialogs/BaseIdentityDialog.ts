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
import * as storage from "../storage";
import * as utils from "../utils";
import { IOAuth2Provider, UserToken } from "../providers";

const magicNumberRegExp = /\b\d{6}\b/;

// Base identity dialog
export abstract class BaseIdentityDialog extends builder.IntentDialog
{
    protected authProvider: IOAuth2Provider;
    private authState: storage.IAuthenticationStateStore;

    constructor(
        protected providerName: string,
        protected providerDisplayName: string,
        private dialogId: string) {
        super();
    }

    // Register the dialog with the bot
    public register(bot: builder.UniversalBot, rootDialog: builder.IntentDialog): void {
        bot.dialog(this.dialogId, this);

        this.authProvider = bot.get(this.providerName) as IOAuth2Provider;
        this.authState = bot.get("authState") as storage.IAuthenticationStateStore;

        this.onBegin((session, args, next) => { this.onDialogBegin(session, args, next); });
        this.onDefault((session) => { this.onMessageReceived(session); });
        this.matches(/SignIn/, (session) => { this.handleLogin(session); });
        this.matches(/ShowProfile/, (session) => { this.showUserProfile(session); });
        this.matches(/SignOut/, (session) => { this.handleLogout(session); });
        this.matches(/Back/, (session) => { session.endDialog(); });
    }

    // Show user profile
    protected abstract async showUserProfile(session: builder.Session): Promise<void>;

    // Get the validated user token, if we have one
    protected getUserToken(session: builder.Session): UserToken {
        return utils.getUserToken(session, this.providerName);
    }

    // Show prompt of options
    protected async promptForAction(session: builder.Session): Promise<void> {
        let msg = new builder.Message(session)
            .addAttachment(new builder.ThumbnailCard(session)
                .title(this.providerDisplayName)
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
                    builder.CardAction.messageBack(session, null, "Back")
                        .text("Back")
                        .displayText("Back"),
                ]));
        session.send(msg);
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
            // See if we are waiting for a magic number and got one
            if (utils.isUserTokenPendingVerification(session, this.providerName)) {
                let match = magicNumberRegExp.exec(session.message.text);
                utils.validateMagicNumber(session, this.providerName, match && match[0]);

                // End of auth flow: if the token is marked as validated, then the user is logged in

                if (utils.getUserToken(session, this.providerName)) {
                    await this.showUserProfile(session);
                } else {
                    session.send(`Sorry, there was an error signing in to ${this.providerDisplayName}. Please try again.`);
                }
            } else {
                // Unrecognized input
                session.send("I didn't understand. Please select an option below.");
                this.promptForAction(session);
            }
        }
    }

    // Handle user login callback
    private async handleLoginCallback(session: builder.Session): Promise<void> {
        let messageAsAny = session.message as any;
        let magicNumber = messageAsAny.originalInvoke.value.state;

        utils.validateMagicNumber(session, this.providerName, magicNumber);

        // End of auth flow: if the token is marked as validated, then the user is logged in

        if (utils.getUserToken(session, this.providerName)) {
            await this.showUserProfile(session);
        } else {
            session.send(`Sorry, there was an error signing in to ${this.providerDisplayName}. Please try again.`);
        }
    }

    // Handle user logout request
    private async handleLogout(session: builder.Session): Promise<void> {
        if (!utils.getUserToken(session, this.providerName)) {
            session.send(`You're already signed out of ${this.providerDisplayName}.`);
        } else {
            utils.setUserToken(session, this.providerName, null);
            session.send(`You're now signed out of ${this.providerDisplayName}.`);
        }

        await this.promptForAction(session);
    }

    // Handle user login request
    private async handleLogin(session: builder.Session): Promise<void> {
        if (utils.getUserToken(session, this.providerName)) {
            session.send(`You're already signed in to ${this.providerDisplayName}.`);
            await this.promptForAction(session);
        } else {
            // Build an authorization url for the identity provider
            let authInfo = this.authProvider.getAuthorizationUrl();

            // Using the randomly-generated OAuth state as a key, store the address of the chat user.
            // This prevents someone with the signin url from tampering with the chat user's address.
            await this.authState.setAsync(authInfo.state, JSON.stringify(session.message.address));
            utils.setOAuthStateKey(session, this.providerName, authInfo.state);

            // Build the sign-in url
            let signinUrl = config.get("app.baseUri") + `/html/auth-start.html?authorizationUrl=${encodeURIComponent(authInfo.url)}`;

            // Send card with signin action
            let msg = new builder.Message(session)
                .addAttachment(new builder.HeroCard(session)
                    .text(`Click below to sign in to ${this.providerDisplayName}`)
                    .buttons([
                        new builder.CardAction(session)
                            .type("signin")
                            .value(signinUrl)
                            .title("Sign in"),
                    ]));
            session.send(msg);

            // The auth flow resumes when we handle the identity provider's OAuth callback in AuthBot.handleOAuthCallback()
        }
    }
}
