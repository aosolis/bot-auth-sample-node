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
import * as msteams from "botbuilder-teams";
import * as winston from "winston";
import * as storage from "./storage";
import * as utils from "./utils";
import { Request, Response } from "express";
import { RootDialog } from "./dialogs/RootDialog";
import { IOAuth2Provider } from "./providers";
const randomNumber = require("random-number-csprng");

// How long the magic number is valid
const magicNumberValidityInMilliseconds = 10 * 60 * 1000;       // 10 minutes

// =========================================================
// Auth Bot
// =========================================================

export class AuthBot extends builder.UniversalBot {

    private loadSessionAsync: {(address: builder.IAddress): Promise<builder.Session>};
    private authState: storage.IAuthenticationStateStore;

    constructor(
        public _connector: builder.IConnector,
        private botSettings: any,
        app: any,
    )
    {
        super(_connector, botSettings);
        this.set("persistConversationData", true);

        this.authState = this.get("authState") as storage.IAuthenticationStateStore;

        this.loadSessionAsync = (address) => {
            return new Promise((resolve, reject) => {
                this.loadSession(address, (err: any, session: builder.Session) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(session);
                    }
                });
            });
        };

        // Handle generic invokes
        let teamsConnector = this._connector as msteams.TeamsChatConnector;
        teamsConnector.onInvoke(async (event, cb) => {
            try {
                await this.onInvoke(event, cb);
            } catch (e) {
                winston.error("Invoke handler failed", e);
                cb(e, null, 500);
            }
        });

        // Register dialogs
        new RootDialog().register(this);
    }

    // Handle OAuth callbacks
    public async handleOAuthCallback(req: Request, res: Response, providerName: string): Promise<void> {
        const provider = this.botSettings[providerName] as IOAuth2Provider;
        const state = req.query.state;
        const authCode = req.query.code;
        let magicNumber = "";

        let session: builder.Session;
        let address: builder.IAddress;
        try {
            let addressString = await this.authState.getAsync(state);
            if (addressString) {
                address = JSON.parse(addressString) as builder.IAddress;
                session = await utils.loadSessionAsync(this, {
                    type: "invoke",
                    agent: "botbuilder",
                    source: address.channelId,
                    sourceEvent: {},
                    address: address,
                    user: address.user,
                });
            }
        } catch (e) {
            winston.warn("Failed to get address from OAuth state", e);
        }

        if (session &&
            (utils.getOAuthStateKey(session, providerName) === state) &&        // OAuth state matches what we expect
            authCode) {                                                         // User granted authorization
            try {
                let userToken = await provider.getAccessTokenAsync(authCode);
                userToken.magicNumberVerified = false;
                userToken.magicNumber = await this.generateMagicNumber();
                userToken.magicNumberExpirationTime = Date.now() + magicNumberValidityInMilliseconds;
                utils.setUserToken(session, providerName, userToken);

                magicNumber = userToken.magicNumber;
            } catch (e) {
                winston.error("Failed to redeem code for an access token", e);
            }
        } else {
            winston.warn("State does not match expected state parameter, or user denied authorization");
        }

        if (magicNumber) {
            res.render("oauth-callback-magicnumber", {
                magicNumber: magicNumber,
            });
        } else {
            res.render("oauth-callback-error");
        }
    }

    // Handle incoming invoke
    private async onInvoke(event: builder.IEvent, cb: (err: Error, body: any, status?: number) => void): Promise<void> {
        let session = await this.loadSessionAsync(event.address);
        if (session) {
            // Invokes don't participate in middleware

            // Simulate a normal message and route it, but remember the original invoke message
            let payload = (event as any).value;
            let fakeMessage: any = {
                ...event,
                text: payload.command + " " + JSON.stringify(payload),
                originalInvoke: event,
            };

            session.message = fakeMessage;
            session.dispatch(session.sessionState, session.message, () => {
                session.routeToActiveDialog();
            });
        }
        cb(null, "");
    }

    // Generate a magic number that the user has to enter to verify that the person that
    // went through the authorization flow is the same one as the user in the chat.
    private async generateMagicNumber(): Promise<string> {
        const magicNumberLength = 6;
        let magicNumber = await randomNumber(0, Math.pow(10, magicNumberLength) - 1);
        return ("0".repeat(magicNumberLength) + magicNumber).substr(-magicNumberLength);
    }
}
