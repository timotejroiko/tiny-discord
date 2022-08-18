/* eslint-disable no-extra-parens */
"use strict";

const { EventEmitter } = require("events");
const { Server } = require("net");
const { Readable } = require("stream");
const { createServer } = require("http");
const { createSecureServer } = require("http2");
const { createPublicKey, verify, randomBytes } = require("crypto");

class InteractionServer extends EventEmitter {
	/**
	 * 
	 * @param {InteractionServerOptions} options 
	 */
	constructor(options) {
		super();
		if(typeof options.key !== "string") { throw new Error("Invalid public key"); }
		this.key = options.key;
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
			if("cert" in this.serverOptions && "key" in this.serverOptions) {
				this.server = createSecureServer(this.serverOptions);
			} else {
				this.server = createServer(/** @type {import("http").ServerOptions} */ (this.serverOptions));
			}
		}
		/** @private */ this._attached = false;

		/**
		 * @type {(
		 * 		((event: "interaction", callback: (data: InteractionData) => InteractionResponse | Promise<InteractionResponse>) => this) &
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
	 * @param {import("http").ServerResponse & import("http2").Http2ServerResponse} res 
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
		req.on("end", () => {
			if(!req.complete) {
				this.emit("debug", "Received incomplete request, returning 400");
				res.writeHead(400);
				res.end();
				return;
			}
			const body = Buffer.concat(buffer).toString();
			const valid = isValidSignature(this._key, body, timestamp, signature);
			if(!valid) {
				this.emit("debug", "Received invalid signature, returning 401");
				res.writeHead(401);
				res.end();
				return;
			}
			let data;
			try {
				data = JSON.parse(body);
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
			// @ts-expect-error _events is private / not typed
			const listeners = /** @type {function | function[]} */ (this._events.interaction);
			if(!listeners) {
				this.emit("debug", "No interaction listeners, returning 500");
				res.writeHead(500);
				res.end();
				return;
			}
			if(typeof listeners === "function") {
				let response;
				try {
					response = listeners(data);
				} catch(e) {
					this.emit("debug", "Response produced an error, returning 500");
					this.emit("error", e);
					res.writeHead(500);
					res.end();
					return;
				}
				Promise.resolve(response).then(val => {
					if(isValidResponse(val)) {
						this.emit("debug", "Responding to interaction");
						this._respond(val, res);
					} else {
						this.emit("debug", "No valid response provided, returning 500");
						res.writeHead(500);
						res.end();
					}
				}).catch(e => {
					this.emit("debug", "Response produced an error, returning 500");
					this.emit("error", e);
					res.writeHead(500);
					res.end();
				});
			} else {
				/** @type {Promise<{index: number, val?: any}>[]} */ const responses = [];
				for(const listener of listeners) {
					try {
						const result = listener(data);
						const index = responses.length;
						const promise = Promise.resolve(result).then(val => ({index, val})).catch(e => {
							this.emit("error", e);
							return {index};
						});
						responses.push(promise);
					} catch(e) {
						this.emit("error", e);
						continue;
					}
				}
				(async () => {
					while(responses.length) {
						const { index, val } = await Promise.race(responses);
						if(isValidResponse(val)) {
							this.emit("debug", "Responding to interaction");
							this._respond(val, res);
							return;
						}
						responses.splice(index, 1);
					}
					this.emit("debug", "No response provided, returning 500");
					res.writeHead(500);
					res.end();
				})();
			}
		});
	}

	/**
	 * 
	 * @param {InteractionResponse} val 
	 * @param {import("http").ServerResponse & import("http2").Http2ServerResponse} res 
	 * @private
	 */
	_respond(val, res) {
		if("files" in val && Array.isArray(val.files)) {
			const boundary = randomBytes(16).toString("base64");
			const files = val.files;
			try {
				const json = JSON.stringify(val.payload_json);
				res.writeHead(200, { "Content-Type": `multipart/form-data; boundary=${boundary}` });
				res.write(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\nContent-Type: application/json\r\n\r\n${json}`);
			} catch(e) {
				this.emit("debug", "JSON payload produced an error, returning 500");
				this.emit("error", e);
				res.writeHead(500);
				res.end();
				return;
			}
			(async () => {
				for(let i = 0; i < files.length; i++) {
					const file = files[i];
					const type = typeof file.type === "string" ? `\r\nContent-Type: ${file.type}` : "";
					res.write(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="files[${i}]"; filename="${file.name}"${type}\r\n\r\n`);
					if(file.data instanceof Readable && file.data.readable) {
						for await(const chunk of file.data) {
							res.write(chunk);
						}
					} else {
						res.write(file.data);
					}
				}
				res.end(`\r\n--${boundary}--`);
			})();
		} else {
			try {
				const json = JSON.stringify(val);
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(json);
			} catch(e) {
				this.emit("debug", "Response produced an error, returning 500");
				this.emit("error", e);
				res.writeHead(500);
				res.end();
			}
		}
	}
}

/**
 * 
 * @param {import("crypto").KeyLike} key 
 * @param {string} body 
 * @param {string} timestamp 
 * @param {string} signature 
 * @returns 
 */
function isValidSignature(key, body, timestamp, signature) {
	const data = Buffer.from(timestamp + body);
	const sig = Buffer.from(signature, "hex");
	return verify(null, data, key, sig);
}

/**
 * 
 * @param {InteractionResponse} value 
 * @returns {boolean}
 */
function isValidResponse(value) {
	if(!value || typeof value !== "object") { return false; }
	if("files" in value) {
		for(const file of value.files) {
			if(!file || typeof file !== "object" || !file.name || !file.data) {
				return false;
			}
		}
		return value.payload_json && typeof value.payload_json === "object" && Number.isInteger(value.payload_json.type);
	}
	return Number.isInteger(value.type);
}

module.exports = InteractionServer;

/**
 * @typedef {{
 * 		key: string,
 *		path?: string,
 *		server?: import("net").Server | import("http2").SecureServerOptions | import("http").ServerOptions
 * }} InteractionServerOptions
 */

/**
 * @typedef {{
 * 		id: string,
 * 		application_id: string,
 * 		type: number,
 * 		data?: Record<string, any>,
 * 		guild_id?: string,
 * 		chanel_id?: string,
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
 * }} InteractionResponse
 */

/**
 * @typedef {{
 * 		name: string,
 * 		data: Buffer | Readable,
 * 		type?: string 
 * }} FileObject
 */
