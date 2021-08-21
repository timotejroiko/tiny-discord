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
	export interface InteractionServerOptions {
		key: string,
		server?: import("net").Server | import("http2").SecureServerOptions | import("http").ServerOptions
	}
	export class InteractionServer extends EventEmitter {
		constructor(options: InteractionServerOptions)
		on(event: "interaction", callback: (data: Interaction) => void): this
		on(event: "error", callback: (error: Error) => void): this
		listen(port: number): Promise<void>
		close(): Promise<void>
	}

	export interface GatewayEvent {
		op: number,
		d: object,
		s: number,
		t: string
	}
	export class WebsocketShard extends EventEmitter {
		constructor()
		on(event: "event", data: (data: GatewayEvent) => void): this
	}

	export interface RestClientOptions {
		token: string,
		version?: number,
		type?: "bearer" | "bot",
		retries?: number,
		timeout?: number
	}
	export interface RestRequestOptions {
		path: string
		method: string
		body?: object
		maxRetries?: number
		timeout?: number
	}
	export interface RestResponse {
		status: number
		headers: object
		body: object
	}
	export class RestClient {
		constructor(options: RestClientOptions)
		request(options: RestRequestOptions): Promise<RestResponse>
	}
}
