declare module "tiny-discord" {
	import EventEmitter from "events"

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
	export class WebsocketShard extends EventEmitter {
		constructor(options: ShardOptions)
		on(event: "event", callback: (data: ShardEvent) => void): this
		on(event: "debug", callback: (data: string) => void): this
		on(event: "close", callback: (data?: Error) => void): this
		on(event: "ready", callback: (data: ShardReady) => void): this
		on(event: "resumed", callback: (data: ShardResumed) => void): this
		connect(): Promise<void>
		send(data: { op: number, d: object }): Promise<void>
		ping(data: any): Promise<number>
		close(): Promise<void>
		lastPing: number
		status: number
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
