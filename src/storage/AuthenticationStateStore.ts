// Copyright (c) Microsoft. All rights reserved.

/** Storage system for temporary authentication state. */
export interface IAuthenticationStateStore {

    /** Writes data to storage. */
    setAsync(key: string, value: string, ttlInSeconds?: number): Promise<void>;

    /** Reads in data from storage. */
    getAsync(key: string): Promise<string>;

    /** Deletes data from storage. */
    deleteAsync(key: string): Promise<void>;
}
