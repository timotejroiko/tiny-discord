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
    on: ((event: "event", callback: (data: WebsocketShard.ShardEvent, shard: number) => void) => this) & ((event: "debug", callback: (data: string, shard: number) => void) => this) & ((event: "close", callback: (data: Error | undefined, shard: number) => void) => this) & ((event: "ready", callback: (data: WebsocketShard.ShardReady, shard: number) => void) => this) & ((event: "resumed", callback: (data: WebsocketShard.ShardResumed, shard: number) => void) => this) & ((event: ShardEvents, callback: (data: Record<string, any>, shard: number) => void) => this);
    getAveragePing(): number;
    getCurrentSessions(): Record<string, {
        session: string | null;
        sequence: number;
    }>;
    connect(): Promise<undefined>;
    close(): Promise<undefined>;
}
declare namespace InternalSharder {
    export { InternalSharderOptions, ShardEvents };
}
import { EventEmitter } from "events";
import WebsocketShard = require("./WebsocketShard");
import IdentifyController = require("./IdentifyController");
type ShardEvents = "APPLICATION_COMMAND_PERMISSIONS_UPDATE" | "AUTO_MODERATION_RULE_CREATE" | "AUTO_MODERATION_RULE_UPDATE" | "AUTO_MODERATION_RULE_DELETE" | "AUTO_MODERATION_ACTION_EXECUTION" | "CHANNEL_CREATE" | "CHANNEL_UPDATE" | "CHANNEL_DELETE" | "CHANNEL_PINS_UPDATE" | "THREAD_CREATE" | "THREAD_UPDATE" | "THREAD_DELETE" | "THREAD_LIST_SYNC" | "THREAD_MEMBER_UPDATE" | "THREAD_MEMBERS_UPDATE" | "GUILD_CREATE" | "GUILD_UPDATE" | "GUILD_DELETE" | "GUILD_BAN_ADD" | "GUILD_BAN_REMOVE" | "GUILD_EMOJIS_UPDATE" | "GUILD_STICKERS_UPDATE" | "GUILD_INTEGRATIONS_UPDATE" | "GUILD_MEMBER_ADD" | "GUILD_MEMBER_REMOVE" | "GUILD_MEMBER_UPDATE" | "GUILD_MEMBERS_CHUNK" | "GUILD_ROLE_CREATE" | "GUILD_ROLE_UPDATE" | "GUILD_ROLE_DELETE" | "GUILD_SCHEDULED_EVENT_CREATE" | "GUILD_SCHEDULED_EVENT_UPDATE" | "GUILD_SCHEDULED_EVENT_DELETE" | "GUILD_SCHEDULED_EVENT_USER_ADD" | "GUILD_SCHEDULED_EVENT_USER_REMOVE" | "INTEGRATION_CREATE" | "INTEGRATION_UPDATE" | "INTEGRATION_DELETE" | "INTERACTION_CREATE" | "INVITE_CREATE" | "INVITE_DELETE" | "MESSAGE_CREATE" | "MESSAGE_UPDATE" | "MESSAGE_DELETE" | "MESSAGE_DELETE_BULK" | "MESSAGE_REACTION_ADD" | "MESSAGE_REACTION_REMOVE" | "MESSAGE_REACTION_REMOVE_ALL" | "MESSAGE_REACTION_REMOVE_EMOJI" | "PRESENCE_UPDATE" | "STAGE_INSTANCE_CREATE" | "STAGE_INSTANCE_DELETE" | "STAGE_INSTANCE_UPDATE" | "TYPING_START" | "USER_UPDATE" | "VOICE_STATE_UPDATE" | "VOICE_SERVER_UPDATE" | "WEBHOOKS_UPDATE";
type InternalSharderOptions = {
    total?: number;
    ids?: number[];
    token: string;
    intents: number;
    options?: Omit<WebsocketShard.WebsocketShardOptions, "token" | "intents" | "session" | "sequence" | "id" | "total" | "identifyHook">;
    overrides?: Record<number, Omit<WebsocketShard.WebsocketShardOptions, "token" | "intents" | "id" | "total" | "identifyHook">>;
    controller?: WebsocketShard.WebsocketShardOptions["identifyHook"] | IdentifyController | Omit<IdentifyController.IdentifyControllerOptions, "token" | "shards">;
};
