"use strict";

const { EventEmitter } = require("events");
const { Server } = require("net");
const { createServer } = require("http");
const { createSecureServer } = require("http2");
const { createPublicKey, verify } = require("crypto");

class InteractionServer extends EventEmitter {
	constructor(options) {
		super();
		if(typeof options.key !== "string") { throw new Error("Invalid public key"); }
		this.key = options.key;
		try {
			this._key = createPublicKey({
				key: Buffer.concat([Buffer.from("MCowBQYDK2VwAyEA", "base64"), Buffer.from(this.key, "hex")]),
				format: "der",
				type: "spki"
			});
		} catch(e) {
			throw new Error("Invalid public key - " + e.message);
		}
		this.customServer = options.server instanceof Server;
		this.serverOptions = this.customServer ? null : options.server || {};
		if(this.customServer) {
			this._server = options.server;
		} else if(this.serverOptions.cert && this.serverOptions.key) {
			this._server = createSecureServer(this.serverOptions);
		} else {
			this._server = createServer(this.serverOptions);
		}
		this._attached = false;
	}
	listen(port) {
		const server = this._server;
		if(this._attached && server.listening) {
			return Promise.resolve();
		}
		if(!this._attached) {
			server.on("request", this._onRequest.bind(this));
			server.on("error", this._onError.bind(this));
			this._attached = true;
		}
		if(server.listening) {
			this.emit("debug", `Attached to port ${server.address().port}`);
			return Promise.resolve();
		}
		return new Promise(resolve => {
			server.listen(port || 0, () => {
				this.emit("debug", `Started listening on port ${server.address().port}`);
				resolve();
			});
		});
	}
	close() {
		const server = this._server;
		if(!this._attached && !server.listening) {
			return Promise.resolve();
		}
		if(this._attached) {
			server.removeListener("request", this._onRequest);
			server.removeListener("error", this._onError);
			this._attached = false;
			if(this.customServer) {
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
	_onError(e) {
		this.emit("error", e);
	}
	_onRequest(req, res) {
		const signature = req.headers["x-signature-ed25519"];
		const timestamp = req.headers["x-signature-timestamp"];
		if(!signature || !timestamp) {
			this.emit("debug", "Received invalid headers, returning 401");
			res.writeHead(401);
			res.end();
			return;
		}
		let body = "";
		req.on("data", d => body += d.toString());
		req.on("end", () => {
			if(!req.complete) {
				this.emit("debug", "Received incomplete request, returning 400");
				res.writeHead(400);
				res.end();
				return;
			}
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
			const listeners = this._events.interaction;
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
						res.writeHead(200, { "Content-Type": "application/json" });
						res.end(JSON.stringify(val));
					} else {
						this.emit("debug", "No response provided, returning 500");
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
				const responses = [];
				for(const listener of listeners) {
					try {
						const result = listener(data);
						const index = responses.length;
						const promise = Promise.resolve(result).then(val => [index, val]).catch(e => {
							this.emit("error", e);
							return [index];
						});
						responses.push(promise);
					} catch(e) {
						this.emit("error", e);
						continue;
					}
				}
				(async () => {
					let filtered = [...responses];
					while(filtered.length) {
						const [index, val] = await Promise.race(filtered);
						if(isValidResponse(val)) {
							this.emit("debug", "Responding to interaction");
							res.writeHead(200, { "Content-Type": "application/json" });
							res.end(JSON.stringify(val));
							return;
						}
						responses[index] = null;
						filtered = responses.filter(Boolean);
					}
					this.emit("debug", "No response provided, returning 500");
					res.writeHead(500);
					res.end();
				})();
			}
		});
	}
}

function isValidSignature(key, body, timestamp, signature) {
	const data = Buffer.from(timestamp + body);
	const sig = Buffer.from(signature, "hex");
	return verify(null, data, key, sig);
}

function isValidResponse(value) {
	return value && typeof value === "object" && Number.isInteger(value.type);
}

module.exports = InteractionServer;
