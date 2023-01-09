export = InternalSharder;
declare class InternalSharder extends EventEmitter {
    constructor(options: InternalSharderOptions);
    total: number | undefined;
    ids: number[];
    shardOptions: Omit<WebsocketShard.WebsocketShardOptions, "session" | "sequence" | "id" | "total">;
    shardOverrides: Record<number, Omit<WebsocketShard.WebsocketShardOptions, "token" | "total" | "id" | "intents" | "identifyHook">>;
    shards: Map<number, WebsocketShard>;
    controller: IdentifyController | null;
    private _ownController;
    on: ((event: "event", callback: (data: WebsocketShard.ShardEvent, shard: number) => void) => this) & ((event: "debug", callback: (data: string, shard: number) => void) => this) & ((event: "close", callback: (data: Error | undefined, shard: number) => void) => this) & ((event: "ready", callback: (data: WebsocketShard.ReadyEvent, shard: number) => void) => this) & ((event: WebsocketShard.ShardEvents, callback: (data: Record<string, any>, shard: number) => void) => this);
    getAveragePing(): number;
    getCurrentSessions(): Record<string, {
        session_id: string | null;
        sequence: number;
        resume_url: string | null;
    }>;
    connect(): Promise<undefined>;
    close(): Promise<undefined>;
}
declare namespace InternalSharder {
    export { InternalSharderOptions };
}
import { EventEmitter } from "events";
import WebsocketShard = require("./WebsocketShard");
import IdentifyController = require("./IdentifyController");
type InternalSharderOptions = {
    total?: number;
    ids?: number[];
    token: string;
    intents: number;
    options?: Omit<WebsocketShard.WebsocketShardOptions, "token" | "intents" | "session" | "sequence" | "id" | "total" | "identifyHook">;
    overrides?: Record<number, Omit<WebsocketShard.WebsocketShardOptions, "token" | "intents" | "id" | "total" | "identifyHook">>;
    controller?: WebsocketShard.WebsocketShardOptions["identifyHook"] | IdentifyController | Omit<IdentifyController.IdentifyControllerOptions, "token" | "shards">;
};
