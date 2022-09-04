export = WebsocketShard;
declare class WebsocketShard extends EventEmitter {
    constructor(options: WebsocketShardOptions);
    token: string;
    intents: number;
    id: number;
    total: number;
    large_threshold: number | undefined;
    presence: Presence | undefined;
    properties: Properties;
    version: number;
    encoding: string;
    compression: 0 | 2 | 1;
    url: string;
    session: string | null;
    sequence: number;
    resumeUrl: string | null;
    identifyHook: ((id: number) => {
        canIdentify: boolean;
        retryAfter?: number | undefined;
    } | Promise<{
        canIdentify: boolean;
        retryAfter?: number | undefined;
    }>) | null;
    private _timestamps;
    private _timers;
    private _promises;
    private _last;
    private _memberChunks;
    private _voiceChunks;
    private _zlib;
    private _socket;
    on: ((event: "event", callback: (data: ShardEvent) => void) => this) & ((event: "debug", callback: (data: string) => void) => this) & ((event: "close", callback: (data?: Error | undefined) => void) => this) & ((event: "ready", callback: (data: ShardReady) => void) => this) & ((event: "resumed", callback: (data: ShardResumed) => void) => this);
    get connectedAt(): number;
    get identifiedAt(): number;
    get readyAt(): number;
    get lastPing(): number;
    get status(): keyof StatusCodes;
    connect(): Promise<void>;
    ping(data: any): Promise<number>;
    close(invalidate?: boolean): Promise<void>;
    send(data: GatewayCommand): Promise<void>;
    requestGuildMembers(options: requestGuildMembersOptions): Promise<{
        guild_id: string;
        members: Record<string, any>[];
        presences: Record<string, any>[];
        not_found: string[];
    }>;
    updatePresence(presence: updatePresenceOptions): Promise<void>;
    updateVoiceState(state: UpdateVoiceStateOptions): Promise<{
        guild_id: string;
        channel_id?: string;
        user_id: string;
        member?: Record<string, any>;
        session_id: string;
        deaf: boolean;
        mute: boolean;
        self_deaf: boolean;
        self_mute: boolean;
        self_stream?: boolean;
        self_video: boolean;
        suppress: boolean;
        request_to_speak_timestamp?: string;
        token?: string;
        endpoint?: string;
    }>;
    private _connect;
    private _write;
    private _identify;
    private _resume;
    private _initConnect;
    private _initOffline;
    private _initClose;
    private _onError;
    private _onClose;
    private _onReadable;
    private _processFrame;
    private _processMessage;
}
declare namespace WebsocketShard {
    export { WebsocketShardOptions, GatewayCommand, requestGuildMembersOptions, updatePresenceOptions, UpdateVoiceStateOptions, Properties, Presence, ShardEvent, ShardReady, ShardResumed, StatusCodes };
}
import { EventEmitter } from "events";
type Presence = {
    since: number | null;
    afk: boolean;
    status: "online" | "dnd" | "idle" | "invisible" | "offline";
    activities: {
        name: string;
        type: 0 | 1 | 2 | 3 | 4 | 5;
        url?: string;
    }[];
};
type Properties = {
    os: string;
    browser: string;
    device: string;
};
type ShardEvent = {
    op: number;
    d: Record<string, any>;
    s: number;
    t: string;
};
type ShardReady = {
    v: string;
    user: Record<string, any>;
    guilds: Record<string, any>[];
    session_id: string;
    shard?: [number, number];
    application: Record<string, any>;
};
type ShardResumed = {
    replayed: number;
};
type StatusCodes = {
    0: "ready";
    1: "connecting";
    2: "connected";
    3: "closing";
    4: "offline";
    5: "closed";
};
type GatewayCommand = {
    op: number;
    d: any;
};
type requestGuildMembersOptions = {
    guild_id: string;
    query?: string;
    limit?: number;
    presences?: boolean;
    user_ids?: string[];
    timeout?: number;
};
type updatePresenceOptions = {
    since?: number;
    afk?: boolean;
    status?: "online" | "dnd" | "idle" | "invisible" | "offline";
    activities?: Presence["activities"];
};
type UpdateVoiceStateOptions = {
    guild_id: string;
    channel_id?: string;
    self_mute?: boolean;
    self_deaf?: boolean;
    wait_for_server?: boolean;
    timeout?: number;
};
type WebsocketShardOptions = {
    token: string;
    intents: number;
    id?: number | undefined;
    total?: number | undefined;
    large_threshold?: number | undefined;
    presence?: Presence | undefined;
    properties?: Properties | undefined;
    version?: number | undefined;
    encoding?: "etf" | "json" | undefined;
    compression?: 0 | 2 | 1 | undefined;
    url?: string | undefined;
    session?: string | undefined;
    sequence?: number | undefined;
    resumeUrl?: string | undefined;
    identifyHook?: ((id: number) => {
        canIdentify: boolean;
        retryAfter?: number;
    } | Promise<{
        canIdentify: boolean;
        retryAfter?: number;
    }>) | undefined;
};
