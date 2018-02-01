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

import * as request from "request";
import * as config from "config";
import * as querystring from "querystring";
let uuidv4 = require("uuid/v4");
import { AuthorizationUrl, UserToken, IOAuth2Provider } from "./OAuth2Provider";

// =========================================================
// AzureAD v1 API
// =========================================================

const authorizationUrl = "https://login.microsoftonline.com/common/oauth2/authorize";
const accessTokenUrl = "https://login.microsoftonline.com/common/oauth2/token";
const callbackPath = "/auth/azureADv1/callback";
const graphProfileUrl = "https://graph.microsoft.com/v1.0/me";

export class AzureADv1Provider implements IOAuth2Provider {

    constructor(
        private clientId: string,
        private clientSecret: string,
    )
    {
    }

    get displayName(): string {
        return "Azure AD";
    }

    // Return the url the user should navigate to to authenticate the app
    public getAuthorizationUrl(extraParams?: any): AuthorizationUrl {
        let params = {
            response_type: "code",
            response_mode: "query",
            client_id: this.clientId,
            redirect_uri: config.get("app.baseUri") + callbackPath,
            resource: "https://graph.microsoft.com",
            state: uuidv4(),
        } as any;
        if (extraParams) {
            params = { ...extraParams, ...params };
        }
        return {
            url: authorizationUrl + "?" + querystring.stringify(params),
            state: params.state,
        };
    }

    // Redeem the authorization code for an access token
    public async getAccessTokenAsync(code: string): Promise<UserToken> {
        let params = {
            grant_type: "authorization_code",
            code: code,
            client_id: this.clientId,
            client_secret: this.clientSecret,
            redirect_uri: config.get("app.baseUri") + callbackPath,
            resource: "https://graph.microsoft.com",
        } as any;

        return new Promise<UserToken>((resolve, reject) => {
            request.post({ url: accessTokenUrl, form: params, json: true }, (err, response, body) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({
                        token: body.access_token,
                        expirationTime: body.expires_on * 1000,
                    });
                }
            });
        });
    }

    public async getProfileAsync(accessToken: string): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            let options = {
                url: graphProfileUrl,
                json: true,
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                },
            };
            request.get(options, (err, response, body) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(body);
                }
            });
        });
    }
}
