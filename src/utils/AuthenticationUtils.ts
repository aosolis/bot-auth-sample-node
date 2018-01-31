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
import { UserToken } from "../providers";

// Ensure that data bag for the given provider exists
export function ensureProviderData(session: builder.Session, providerName: string): void {
    if (!session.userData[providerName]) {
        session.userData[providerName] = {};
    }
}

// Gets the validated user token for the given provider
export function getUserToken(session: builder.Session, providerName: string): UserToken {
    let token = getUserTokenUnsafe(session, providerName);
    return (token && token.magicNumberVerified) ? token : null;
}

// Gets the user token for the given provider, even if it has not yet been validated
export function getUserTokenUnsafe(session: builder.Session, providerName: string): UserToken {
    ensureProviderData(session, providerName);
    return (session.userData[providerName].userToken);
}

// Sets the user token for the given provider
export function setUserToken(session: builder.Session, providerName: string, token: UserToken): void {
    ensureProviderData(session, providerName);
    let data = session.userData[providerName];
    data.userToken = token;
    session.save().sendBatch();
}

// Gets the OAuth state for the given provider
export function getOAuthStateKey(session: builder.Session, providerName: string): string {
    ensureProviderData(session, providerName);
    return (session.userData[providerName].oauthState);
}

// Sets the OAuth state for the given provider
export function setOAuthStateKey(session: builder.Session, providerName: string, state: string): void {
    ensureProviderData(session, providerName);
    let data = session.userData[providerName];
    data.oauthState = state;
    session.save().sendBatch();
}
