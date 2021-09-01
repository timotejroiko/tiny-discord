declare module "tiny-discord" {
	import EventEmitter from "events"

	export type DiscordEvent = "APPLICATION_COMMAND_CREATE | APPLICATION_COMMAND_DELETE | APPLICATION_COMMAND_UPDATE | CHANNEL_CREATE | CHANNEL_DELETE | CHANNEL_PINS_UPDATE | CHANNEL_UPDATE | GUILD_BAN_ADD | GUILD_BAN_REMOVE | GUILD_CREATE | GUILD_DELETE | GUILD_EMOJIS_UPDATE | GUILD_INTEGRATIONS_UPDATE | GUILD_MEMBER_ADD | GUILD_MEMBER_REMOVE | GUILD_MEMBERS_CHUNK | GUILD_MEMBER_UPDATE | GUILD_ROLE_CREATE | GUILD_ROLE_DELETE | GUILD_ROLE_UPDATE | GUILD_STICKERS_UPDATE | GUILD_UPDATE | INTEGRATION_CREATE | INTEGRATION_DELETE | INTEGRATION_UPDATE | INTERACTION_CREATE | INVITE_CREATE | INVITE_DELETE | MESSAGE_CREATE | MESSAGE_DELETE | MESSAGE_DELETE_BULK | MESSAGE_REACTION_ADD | MESSAGE_REACTION_REMOVE | MESSAGE_REACTION_REMOVE_ALL | MESSAGE_REACTION_REMOVE_EMOJI | MESSAGE_UPDATE | PRESENCE_UPDATE | STAGE_INSTANCE_CREATE | STAGE_INSTANCE_DELETE | STAGE_INSTANCE_UPDATE | READY | RESUMED | THREAD_CREATE | THREAD_DELETE | THREAD_LIST_SYNC | THREAD_MEMBERS_UPDATE | THREAD_MEMBER_UPDATE | THREAD_UPDATE | TYPING_START | USER_UPDATE | VOICE_SERVER_UPDATE | VOICE_STATE_UPDATE | WEBHOOKS_UPDATE"

	export interface Interaction {
		id: string
		type: number
		data?: object
		guild_id?: string
		channel_id?: string
		member?: object
		user?: object
		token: string
		version: number
		message?: object
	}
	export interface InteractionResponse {
		type: number
		data?: object
	}
	export interface InteractionServerOptions {
		key: string
		path?: string
		server?: import("net").Server | import("http2").SecureServerOptions | import("http").ServerOptions
	}
	export class InteractionServer extends EventEmitter {
		constructor(options: InteractionServerOptions)
		on(event: "interaction", callback: (data: Interaction) => InteractionResponse): this
		on(event: "error", callback: (error: Error) => void): this
		listen(port: number): Promise<void>
		close(): Promise<void>
	}

	export interface ShardOptions {
		token: string
		intents: number
		id?: number
		total?: number
		large_threshold?: number
		presence?: {
			since: number | null
			afk: boolean
			status: "online" | "dnd" | "idle" | "invisible" | "offline"
			activities: object[]
		}
		properties?: {
			$os: string
			$browser: string
			$device: string
		}
		version?: number
		encoding?: "json" | "etf"
		compression?: 0 | 1 | 2
		url?: string
		session?: string
		sequence?: number
	}
	export interface ShardEvent {
		op: number
		d: object
		s: number
		t: string
	}
	export interface ShardReady {
		v: string
		user: object
		guilds: object[]
		session_id: string
		shard?: [number, number]
		application: object
	}
	export interface ShardResumed {
		replayed: number
	}
	export interface PresenceUpdateOptions {
		since?: number
		afk?: boolean
		status?: "online" | "dnd" | "idle" | "invisible" | "offline"
		activities?: object[]
	}
	export interface RequestGuildMembersOptions {
		guild_id: string
		query?: string
		limit?: number
		presences?: boolean
		user_ids?: string[]
		timeout?: number
	}
	export interface GuildMembersResult {
		guild_id: string
		members: object[]
		presences: object[]
		not_found: string[]
	}
	export interface UpdateVoiceStateOptions {
		guild_id: string
		channel_id?: string
		self_mute?: boolean
		self_deaf?: boolean
		wait_for_server?: boolean
		timeout?: number
	}
	export interface VoiceStateResult {
		guild_id: string
		channel_id?: string
		user_id: string
		member?: object
		session_id:	string
		deaf: boolean
		mute: boolean
		self_deaf: boolean
		self_mute: boolean
		self_stream?: boolean
		self_video:	boolean
		suppress: boolean
		request_to_speak_timestamp?: string
		token?: string,
		endpoint?: string
	}
	export class WebsocketShard extends EventEmitter {
		constructor(options: ShardOptions)
		on(event: "event", callback: (data: ShardEvent) => void): this
		on(event: "debug", callback: (data: string) => void): this
		on(event: "close", callback: (data?: Error) => void): this
		on(event: "ready", callback: (data: ShardReady) => void): this
		on(event: "resumed", callback: (data: ShardResumed) => void): this
		connect(): Promise<void>
		send(data: { op: number, d: object }): Promise<void>
		updatePresence(presence: PresenceUpdateOptions): Promise<void>
		requestGuildMembers(options: RequestGuildMembersOptions): Promise<GuildMembersResult>
		updateVoiceState(state: UpdateVoiceStateOptions): Promise<VoiceStateResult>
		ping(data: any): Promise<number>
		close(): Promise<void>
		lastPing: number
		status: number
	}

	export interface InternalSharderOptions {
		options: Omit<ShardOptions, "session" | "sequence">
		total: number
		ids?: number[]
		shardOptions?: { [id: string]: Omit<ShardOptions, "token" | "intents"> }
		concurrency?: number
		identifyHook?: (id) => { time?: number, ask?: boolean }
	}
	export class InternalSharder extends EventEmitter {
		constructor(options: InternalSharderOptions)
		on(event: DiscordEvent, callback: (data: object, id: number) => void): this
		on(event: "event", callback: (data: ShardEvent, id: number) => void): this
		on(event: "debug", callback: (data: string) => void): this
		on(event: "connect", callback: (id: number) => void): this
		on(event: "ready", callback: (data: ShardReady, id: number) => void): this
		on(event: "resumed", callback: (data: ShardResumed, id: number) => void): this
		on(event: "error", callback: (error: Error, id: number) => void): this
		connect(): void
		close(): Promise<void>
		getAveragePing(): number
		getSessions(): { [id: string]: { session: string, sequence: number } }
	}

	export interface RestClientOptions {
		token: string
		version?: number
		type?: "bearer" | "bot"
		retries?: number
		timeout?: number
	}
	export interface RestRequestOptions {
		path: string
		method: string
		body?: object
		headers?: object
		options?: import("https").RequestOptions
		retries?: number
		timeout?: number
	}
	export interface RestResponse {
		status: number
		headers: object
		body: object | string
	}
	interface AbortablePromise<T> extends Promise<T> {
		abort(reason?: string): void
	}
	export class RestClient {
		constructor(options: RestClientOptions)
		request(options: RestRequestOptions): AbortablePromise<RestResponse>
	}
}
