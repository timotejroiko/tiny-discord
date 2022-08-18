/// <reference types="node" />
export = InteractionServer;
declare class InteractionServer extends EventEmitter {
    constructor(options: InteractionServerOptions);
    key: string;
    private _key;
    path: string;
    serverOptions: import("http2").SecureServerOptions | import("http").ServerOptions | null;
    isCustomServer: boolean;
    server: Server | import("http2").Http2SecureServer;
    private _attached;
    on: ((event: "interaction", callback: (data: InteractionData) => InteractionResponse | Promise<InteractionResponse>) => this) & ((event: "debug", callback: (data: string) => void) => this) & ((event: "error", callback: (data?: Error | undefined) => void) => this);
    listen(port: number): Promise<void>;
    close(): Promise<void>;
    private _onError;
    private _onRequest;
    private _respond;
}
declare namespace InteractionServer {
    export { InteractionServerOptions, InteractionData, InteractionResponse, FileObject };
}
import { EventEmitter } from "events";
import { Server } from "net";
type InteractionData = {
    id: string;
    application_id: string;
    type: number;
    data?: Record<string, any>;
    guild_id?: string;
    channel_id?: string;
    member?: Record<string, any>;
    user?: Record<string, any>;
    token: string;
    version: number;
    message?: Record<string, any>;
    app_permissions?: string;
    locale?: string;
    guild_locale?: string;
};
type InteractionResponse = {
    type: number;
    data?: Record<string, any>;
} | {
    files: FileObject[];
    payload_json: {
        type: number;
        data?: Record<string, any>;
    };
};
type InteractionServerOptions = {
    key: string;
    path?: string;
    server?: import("net").Server | import("http2").SecureServerOptions | import("http").ServerOptions;
};
type FileObject = {
    name: string;
    data: Buffer | Readable;
    type?: string;
};
import { Readable } from "stream";
