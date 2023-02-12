/* eslint-disable no-extra-parens */
"use strict";

const { EventEmitter, once } = require("node:events");
const { Server } = require("node:net");
const { Readable } = require("node:stream");
const { createServer } = require("node:http");
const { createSecureServer } = require("node:http2");
const { createPublicKey, verify } = require("node:crypto");

class InteractionServer extends EventEmitter {
	/**
	 * 
	 * @param {InteractionServerOptions} options 
	 */
	constructor(options) {
		super();
		if(typeof options.key !== "string") { throw new Error("Invalid public key"); }
		this.key = options.key;
		this.rest = options.rest || null;
		try {
			/** @private */ this._key = createPublicKey({
				key: Buffer.concat([Buffer.from("MCowBQYDK2VwAyEA", "base64"), Buffer.from(this.key, "hex")]),
				format: "der",
				type: "spki"
			});
		} catch(e) {
			const error = /** @type {Error} */ (e);
			throw new Error(`Invalid public key - ${error.message}`);
		}
		this.path = typeof options.path === "string" ? options.path : "/";
		if(options.server instanceof Server) {
			this.serverOptions = null;
			this.isCustomServer = true;
			this.server = options.server;
		} else {
			this.isCustomServer = false;
			this.serverOptions = options.server || {};
			if(isSecureOptions(this.serverOptions)) {
				this.server = createSecureServer(this.serverOptions);
			} else {
				this.server = createServer(this.serverOptions);
			}
		}
		/** @private */ this._attached = false;

		/**
		 * @type {(
		 * 		((event: "interaction", callback: (event: InteractionEvent) => void) => this) &
		 * 		((event: "debug", callback: (data: string) => void) => this) &
		 * 		((event: "error", callback: (data?: Error) => void) => this)
		 * )}
		 */
		this.on;
	}

	/**
	 * 
	 * @param {number} port 
	 * @returns {Promise<void>}
	 */
	listen(port) {
		const server = this.server;
		if(this._attached && server.listening) {
			return Promise.resolve();
		}
		if(!this._attached) {
			server.on("request", this._onRequest.bind(this));
			server.on("error", this._onError.bind(this));
			this._attached = true;
		}
		if(server.listening) {
			const address = server.address();
			const p = address && typeof address === "object" ? address.port : "???";
			this.emit("debug", `Attached to port ${p}`);
			return Promise.resolve();
		}
		return new Promise(resolve => {
			server.listen(port || 0, () => {
				const address = server.address();
				const p = address && typeof address === "object" ? address.port : "???";
				this.emit("debug", `Started listening on port ${p}`);
				resolve();
			});
		});
	}

	/**
	 * 
	 * @returns {Promise<void>}
	 */
	close() {
		const server = this.server;
		if(!this._attached && !server.listening) {
			return Promise.resolve();
		}
		if(this._attached) {
			server.removeListener("request", this._onRequest);
			server.removeListener("error", this._onError);
			this._attached = false;
			if(this.isCustomServer) {
				this.emit("debug", "Detached from server");
				return Promise.resolve();
			}
		}
		if(server.listening) {
			return new Promise(resolve => {
				server.close(() => {
					this.emit("debug", "Closed server");
					resolve();
				});
			});
		}
		return Promise.resolve();
	}

	/**
	 * 
	 * @param {Error} e 
	 * @private
	 */
	_onError(e) {
		this.emit("error", e);
	}

	/**
	 * 
	 * @param {import("http").IncomingMessage | import("http2").Http2ServerRequest} req 
	 * @param {(import("http").ServerResponse | import("http2").Http2ServerResponse) & { write: import("stream").Writable["write"] }} res 
	 * @private
	 */
	_onRequest(req, res) {
		if(!req.url?.startsWith(this.path)) { return; }
		const signature = /** @type {string | undefined} */ (req.headers["x-signature-ed25519"]);
		const timestamp = /** @type {string | undefined} */ (req.headers["x-signature-timestamp"]);
		if(!signature || !timestamp) {
			this.emit("debug", "Received invalid headers, returning 401");
			res.writeHead(401);
			res.end();
			return;
		}
		/** @type {Buffer[]} */ const buffer = [];
		req.on("data", d => buffer.push(d));
		req.once("end", () => {
			if(!req.complete) {
				this.emit("debug", "Received incomplete request, returning 400");
				res.writeHead(400);
				res.end();
				return;
			}
			const body = Buffer.concat(buffer);
			const string = body.toString();
			const valid = isValidSignature(this._key, string, timestamp, signature);
			if(!valid) {
				this.emit("debug", "Received invalid signature, returning 401");
				res.writeHead(401);
				res.end();
				return;
			}
			/** @type {InteractionData} */ let data;
			try {
				data = JSON.parse(string);
			} catch(e) {
				this.emit("debug", "Received invalid data, returning 400");
				res.writeHead(400);
				res.end();
				return;
			}
			if(data.type === 1) {
				this.emit("debug", "Received ping request, responding with pong");
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end("{\"type\":1}");
				return;
			}
			this.emit("debug", "Received interaction request");
			// @ts-expect-error _events is private
			if(!this._events.interaction) {
				this.emit("debug", "No interaction listeners, returning 500");
				res.writeHead(400);
				res.end();
				return;
			}
			const event = new InteractionEvent({ data, req, res, server: this });
			this.emit("interaction", event);
		});
	}
}

class InteractionEvent {

	/**
	 * 
	 * @param {{
	 * 		req: import("http").IncomingMessage | import("http2").Http2ServerRequest,
	 * 		res: (import("http").ServerResponse | import("http2").Http2ServerResponse) & { write: import("stream").Writable["write"] },
	 * 		server: InteractionServer,
	 * 		data: InteractionData
	 * }} obj 
	 */
	constructor(obj) {
		this.request = obj.req;
		this.response = obj.res;
		this.server = obj.server;
		this.interaction = obj.data;
		this.replied = false;
	}

	/**
	 * 
	 * @param {InteractionReply} val 
	 * @param {boolean} [useRestCallback] 
	 * @returns 
	 */


	/**
     * @overload
     * @param {InteractionReply} val
     * @param {true} useRestCallback
	 * @returns {import("./RestClient").RequestResult}
     *//**
     * @overload
     * @param {InteractionReply} val
     * @param {false} useRestCallback
	 * @returns {Promise<void>}
     *//**
     * @overload
     * @param {InteractionReply} val
	 * @returns {Promise<void>}
     *//**
     * @param {InteractionReply} val
     * @param {boolean} [useRestCallback]
     */
	reply(val, useRestCallback = false) {
		if(this.replied) { return Promise.reject("This interaction was already replied to"); }
		this.replied = true;
		if(!this.isValidResponse(val)) {
			this.server.emit("debug", "Invalid response provided, returning 500");
			this.response.writeHead(500);
			this.response.end();
			return Promise.reject(`Invalid response: ${val}`);
		}
		this.server.emit("debug", "Responding to interaction");
		return useRestCallback ? this._respondWithRest(val) : this._respond(val);
	}

	/**
	 * 
	 * @param {InteractionReply} value 
	 * @returns {value is InteractionReply}
	 */
	isValidResponse(value) {
		if(!value || typeof value !== "object") { return false; }
		if("files" in value) {
			if(!Array.isArray(value.files)) { return false; }
			for(const file of value.files) {
				if(!file || typeof file !== "object" || !file.name || !file.data) {
					return false;
				}
			}
			return value.payload_json && typeof value.payload_json === "object" && Number.isInteger(value.payload_json.type);
		}
		return Number.isInteger(value.type);
	}

	/**
	 * 
	 * @param {InteractionReply} val 
	 * @private
	 */
	async _respondWithRest(val) {
		const client = this.server.rest;
		if(!client || !client.post) {
			throw new Error("Using the REST callback requires defining a RestClient in the server options");
		}
		const result = await client.post(`/interactions/${this.interaction.id}/${this.interaction.token}/callback`, val);
		if(result.status === 204) {
			this.response.writeHead(204);
			this.response.end();
			return result;
		} else {
			this.response.writeHead(500);
			this.response.end();
			throw new Error(`status: ${result.status}\nbody: ${result.body.text}`);
		}
	}

	/**
	 * 
	 * @param {InteractionReply} val 
	 * @private
	 */
	async _respond(val) {
		if("files" in val) {
			const files = val.files;
			const boundary = (Date.now() + Math.random().toString(36).slice(2)).padStart(32, "-");
			this.response.writeHead(200, { "Content-Type": `multipart/form-data; boundary=${boundary}` });
			const json = JSON.stringify(val.payload_json);
			this.response.write(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\nContent-Type: application/json\r\n\r\n${json}`);
			for(let i = 0; i < files.length; i++) {
				const file = files[i];
				const type = typeof file.type === "string" ? `\r\nContent-Type: ${file.type}` : "";
				this.response.write(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="files[${i}]"; filename="${file.name}"${type}\r\n\r\n`);
				if(file.data instanceof Readable) {
					if(!file.data.readable) {
						throw new Error(`Stream for ${file.name} is not readable`);
					}
					for await(const chunk of file.data) {
						this.response.write(chunk);
					}
				} else {
					this.response.write(file.data);
				}
			}
			this.response.end(`\r\n--${boundary}--`);
		} else {
			const json = JSON.stringify(val);
			this.response.writeHead(200, { "Content-Type": "application/json" });
			this.response.end(json);
		}
		return once(this.response, "close").then(() => void 0);
	}
}

/**
 * 
 * @param {import("http2").SecureServerOptions | import("http").ServerOptions} opts 
 * @returns {opts is import("http2").SecureServerOptions}
 * @private
 */
function isSecureOptions(opts) {
	return "cert" in opts && "key" in opts;
}

/**
 * 
 * @param {import("crypto").KeyLike} key 
 * @param {string} body 
 * @param {string} timestamp 
 * @param {string} signature 
 * @private
 */
function isValidSignature(key, body, timestamp, signature) {
	const data = Buffer.from(timestamp + body);
	const sig = Buffer.from(signature, "hex");
	return verify(null, data, key, sig);
}

module.exports = InteractionServer;

/**
 * @typedef {{
 * 		key: string,
 *		path?: string,
 *		server?: import("net").Server | import("http2").SecureServerOptions | import("http").ServerOptions,
 *		rest?: import("./RestClient")
 * }} InteractionServerOptions
 */

/**
 * @typedef {{
 * 		id: string,
 * 		application_id: string,
 * 		type: number,
 * 		data?: Record<string, any>,
 * 		guild_id?: string,
 * 		channel_id?: string,
 * 		member?: Record<string, any>,
 * 		user?: Record<string, any>,
 * 		token: string,
 * 		version: number,
 * 		message?: Record<string, any>,
 * 		app_permissions?: string,
 * 		locale?: string,
 * 		guild_locale?: string
 * }} InteractionData
 */

/**
 * @typedef {{
 * 		type: number,
 * 		data?: Record<string, any>
 * } | {
 * 		files: FileObject[],
 * 		payload_json: {
 * 			type: number,
 * 			data?: Record<string, any>
 * 		}
 * }} InteractionReply
 */

/**
 * @typedef {{
 * 		name: string,
 * 		data: Buffer | Readable,
 * 		type?: string 
 * }} FileObject
 */
