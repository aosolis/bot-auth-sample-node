// Copyright (c) Microsoft. All rights reserved.

import { IAuthenticationStateStore } from "./AuthenticationStateStore";

/** Storage system for temporary authentication state. */
export class MemoryAuthenticationStateStore implements IAuthenticationStateStore {

    // tslint:disable-next-line:typedef
    private data = new Map<string, string>();

    /** Writes data to storage. */
    public async setAsync(key: string, value: string, ttlInSeconds?: number): Promise<void> {
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
