declare module "tiny-discord" {
	import EventEmitter from "events"
	type ServerOptions = import("net").Server | import("http2").SecureServerOptions | import("http").ServerOptions
	export interface GatewayEvent {
		op: number,
		d: object,
		s: number,
		t: string
	}
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
	export class InteractionServer extends EventEmitter {
		constructor(options: {
			key: string,
			server?: ServerOptions
		})
		on(event: "interaction", callback: (data: Interaction) => void): this
		on(event: "error", callback: (error: Error) => void): this
		listen(port: number): Promise<void>
		close(): Promise<void>
	}
	export class WebsocketShard extends EventEmitter {
		constructor()
		on(event: "event", data: (data: GatewayEvent) => void): this
	}
	export class RestClient {
		constructor(options: {
			token: string,
			version?: number,
			type?: "bearer" | "bot",
			retries?: number,
			timeout?: number
		})
		request(options: { path: string, method: string, body?: object, maxRetries?: number, timeout?: number }): Promise<{ status: number, headers: object, body: object	}>
	}
}
