/// <reference types="node" />
export = InteractionServer;
declare class InteractionServer extends EventEmitter {
    constructor(options: InteractionServerOptions);
    key: string;
    rest: import("./RestClient") | null;
    private _key;
    path: string;
    serverOptions: import("http2").SecureServerOptions | import("http").ServerOptions | null;
    isCustomServer: boolean;
    server: Server | import("http2").Http2SecureServer;
    private _attached;
    on: ((event: "interaction", callback: (event: InteractionEvent) => void) => this) & ((event: "debug", callback: (data: string) => void) => this) & ((event: "error", callback: (data?: Error) => void) => this);
    listen(port: number): Promise<void>;
    close(): Promise<void>;
    private _onError;
    private _onRequest;
}
declare namespace InteractionServer {
    export { InteractionServerOptions, InteractionData, InteractionReply, FileObject };
}
import { EventEmitter } from "events";
import { Server } from "net";
declare class InteractionEvent {
    constructor(obj: {
        req: import("http").IncomingMessage | import("http2").Http2ServerRequest;
        res: (import("http").ServerResponse | import("http2").Http2ServerResponse) & {
            write: import("stream").Writable["write"];
        };
        server: InteractionServer;
        data: InteractionData;
    });
    request: import("http").IncomingMessage | import("http2").Http2ServerRequest;
    response: (import("http").ServerResponse | import("http2").Http2ServerResponse) & {
        write: import("stream").Writable["write"];
    };
    server: import("./InteractionServer");
    interaction: InteractionData;
    replied: boolean;
    reply(val: InteractionReply, useRestCallback: true): import("./RestClient").RequestResult;
    reply(val: InteractionReply, useRestCallback: false): Promise<void>;
    reply(val: InteractionReply): Promise<void>;
    isValidResponse(value: InteractionReply): value is InteractionReply;
    private _respondWithRest;
    private _respond;
}
type InteractionServerOptions = {
    key: string;
    path?: string;
    server?: import("net").Server | import("http2").SecureServerOptions | import("http").ServerOptions;
    rest?: import("./RestClient");
};
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
type InteractionReply = {
    type: number;
    data?: Record<string, any>;
} | {
    files: FileObject[];
    payload_json: {
        type: number;
        data?: Record<string, any>;
    };
};
type FileObject = {
    name: string;
    data: Buffer | Readable;
    type?: string;
};
import { Readable } from "stream";
