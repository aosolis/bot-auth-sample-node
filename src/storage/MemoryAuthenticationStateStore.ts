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

import { IAuthenticationStateStore } from "./AuthenticationStateStore";

// In-memory storage system for temporary authentication state.
// NOTE: This is for demonstration purposes only. Do not use in production!
export class MemoryAuthenticationStateStore implements IAuthenticationStateStore {

    // tslint:disable-next-line:typedef
    private data = new Map<string, string>();

    /** Writes data to storage. */
    public async setAsync(key: string, value: string, ttlInSeconds?: number): Promise<void> {
        // This implementation ignores the TTL for simplicity
        this.data.set(key, value);
    }

    /** Reads in data from storage. */
    public async getAsync(key: string): Promise<string> {
        return this.data.get(key);
    }

    /** Deletes data from storage. */
    public async deleteAsync(key: string): Promise<void> {
        this.data.delete(key);
    }
}
