/* eslint-disable no-extra-parens */
"use strict";

const { EventEmitter } = require("node:events");
const { request } = require("node:https");
const { randomBytes, createHash } = require("node:crypto");
const { createInflate } = require("node:zlib");
const { setTimeout, setInterval } = require("node:timers");

class WebsocketShard extends EventEmitter {
	/**
	 * 
	 * @param {WebsocketShardOptions} options 
	 */
	constructor(options) {
		if(!options || typeof options !== "object") { throw new Error("Invalid options"); }
		if(!options.token || typeof options.token !== "string") { throw new Error("Invalid token"); }
		if(!Number.isInteger(options.intents) || options.intents < 0) { throw new Error("Invalid intents"); }
		super();
		this.token = options.token;
		this.intents = options.intents;
		this.id = Number(options.id) || 0;
		this.total = Number(options.total) || this.id + 1;
		this.large_threshold = Number(options.large_threshold) || void 0;
		this.presence = isValidPresence(options.presence) ? options.presence : void 0;
		this.properties = isValidProperties(options.properties) ? options.properties : { os: process.platform, browser: "tiny-discord", device: "tiny-discord" };
		this.version = Number(options.version) || 10;
		this.encoding = typeof options.encoding === "string" && options.encoding.toLowerCase() === "etf" ? "etf" : "json";
		this.compression = [0, 1, 2].includes(options.compression = /** @type {0 | 1 | 2} */ (Number(options.compression))) ? options.compression : 0;
		this.url = typeof options.url === "string" ? options.url.includes("://") ? options.url.split("://")[1] : options.url : "gateway.discord.gg";
		this.disabledEvents = Array.isArray(options.disabledEvents) ? options.disabledEvents : null;
		this.etfUseBigint = Boolean(options.etfUseBigint);
		this.identifyHook = typeof options.identifyHook === "function" ? options.identifyHook : null;

		/** @private @type {{ id: string?, seq: number, url: string? }} */ this._session = {
			id: null,
			seq: 0,
			url: null
		};

		if(options.session) {
			const { session_id, sequence, resume_url } = options.session;
			this._session.id = typeof session_id === "string" ? session_id : null;
			this._session.seq = Number(sequence) || 0;
			this._session.url = typeof resume_url === "string" ? resume_url.includes("://") ? resume_url.split("://")[1] : resume_url : null;
		}

		/** @private */ this._timestamps = {
			lastPacket: 0,
			lastAck: 0,
			lastHeartbeat: 0,
			connectedAt: 0,
			readyAt: 0,
			identifiedAt: 0
		};

		/** @private */ this._timers = {
			/** @type {(NodeJS.Timeout & { count: number, until: number })?} */ ratelimit: null,
			/** @type {(NodeJS.Timeout & { count: number, until: number })?} */ presencelimit: null,
			/** @type {(NodeJS.Timeout | NodeJS.Timer)?} */ heartbeat: null,
			/** @type {NodeJS.Timeout?} */ close: null,
			/** @type {NodeJS.Timeout?} */ offline: null
		};

		/** @private */ this._promises = {
			/** @type {(Promise<number> & { resolve: () => void })?} */ ping: null,
			/** @type {(Promise<void> & { resolve: () => void })?} */ close: null,
			/** @type {(Promise<void> & { resolve: () => void })?} */ ready: null,
			/** @type {(Promise<void> & { busy: boolean, resolve: () => void })?} */ connect: null
		};

		/** @private */ this._last = {
			/** @type {number?} */ ping: null,
			/** @type {number?} */ replayed: null,
			/** @type {(Error & { code: number, reason?: string })?} */ error: null
		};

		/** @private @type {Record<string, { resolve: () => void, received: number, members: any[], presences: any[], not_found: any[] }>} */ this._memberChunks = {};
		/** @private @type {Record<string, { resolve: () => void, state: Record<string, any>?, server: Record<string, any>? }>} */ this._voiceChunks = {};
		/** @private @type {zlib?} */ this._zlib = null;
		/** @private @type {import("net").Socket?} */ this._socket = null;

		/**
		 * @type {(
		 * 		((event: "event", callback: (data: ShardEvent) => void) => this) &
		 * 		((event: "debug", callback: (data: string) => void) => this) &
		 * 		((event: "close", callback: (data?: Error) => void) => this) &
		 * 		((event: "ready", callback: (data: ReadyEvent) => void) => this)
		 * )}
		 */
		this.on;
	}
	get connectedAt() {
		return this._timestamps.connectedAt;
	}
	get identifiedAt() {
		return this._timestamps.identifiedAt;
	}
	get readyAt() {
		return this._timestamps.readyAt;
	}
	get lastPing() {
		return this._last.ping || 999;
	}

	/**
	 * 
	 * @returns {keyof StatusCodes}
	 */
	get status() {
		if(this._promises.connect) { return 1; } // connecting
		if(this._promises.ready) { return 2; } // connected
		if(this._promises.close) { return 3; } // closing
		if(this._timers.offline) { return 4; } // offline
		if(!this._socket) { return 5; } // closed
		return 0; // ready
	}

	get session() {
		return {
			session_id: this._session.id,
			sequence: this._session.seq,
			resume_url: this._session.url
		};
	}

	/**
	 * 
	 * @returns {Promise<void>}
	 */
	connect() {
		if(this._socket) { return Promise.resolve(); }
		if(this._promises.connect) { return this._promises.connect; }
		if(this._timers.offline) {
			clearTimeout(this._timers.offline);
		}
		this._initConnect();
		return this._connect();
	}

	/**
	 * 
	 * @param {*} data 
	 * @returns {Promise<number>}
	 */
	ping(data) {
		const promises = this._promises;
		if(promises.connect) { return promises.connect.then(() => this.ping(data)); }
		if(!this._socket) { return Promise.reject(new Error("Not connected")); }
		if(promises.ping) { return promises.ping; }
		const time = Date.now();
		/** @type {*} */ let resolver;
		const promise = /** @type {NonNullable<typeof this._promises.ping>} */ (new Promise(resolve => {
			resolver = resolve;
			this._write(data ? Buffer.from(JSON.stringify(data)) : Buffer.allocUnsafe(0), 9);
		}).then(() => {
			promises.ping = null;
			return this._last.ping = Date.now() - time;
		}));
		promise.resolve = resolver;
		return promises.ping = promise;
	}

	/**
	 * 
	 * @param {boolean} invalidate 
	 * @returns {Promise<void>}
	 */
	close(invalidate = false) {
		const promises = this._promises;
		if(promises.connect) {
			return promises.connect.then(() => this.close());
		}
		if(this._timers.offline) {
			clearTimeout(this._timers.offline);
		}
		if(!this._socket) { return Promise.resolve(); }
		/** @type {*} */ let resolver;
		const promise = /** @type {NonNullable<typeof this._promises.close>} */ (new Promise(resolve => {
			resolver = resolve;
			this._initClose(invalidate ? 1000 : 4099);
		}).then(() => {
			promises.close = null;
		}));
		promise.resolve = resolver;
		return promises.close = promise;
	}

	/**
	 * 
	 * @param {GatewayCommand} data 
	 * @returns {Promise<void>}
	 */
	send(data) {
		const important = [1, 2, 6].includes(data.op);
		if(this._promises.connect && important) { return this._promises.connect.then(() => this.send(data)); }
		if(this._promises.ready && !important) { return this._promises.ready.then(() => this.send(data)); }
		if(!this._socket) { return Promise.reject(new Error("Not connected")); }
		if(!isValidRequest(data)) { return Promise.reject(new Error("Invalid request")); }
		let timer = this._timers.ratelimit;
		if(!timer) {
			const timeout = /** @type {NonNullable<typeof this._timers.ratelimit>} */ (setTimeout(() => {
				this._timers.ratelimit = null;
			}, 60000));
			timeout.count = 0;
			timeout.until = Date.now() + 60000;
			timer = this._timers.ratelimit = timeout;
		}
		if(++timer.count > 115 && !important) {
			const error = /** @type {Error & { retry_after: number }} */ (new Error("Socket rate limit exceeded"));
			error.retry_after = timer.until - Date.now();
			return Promise.reject(error);
		}
		if(this.encoding === "json") {
			const buff = Buffer.from(JSON.stringify(data));
			this._write(buff, 1);
		} else {
			const etf = writeETF(data);
			this._write(etf, 2);
		}
		return Promise.resolve();
	}

	/**
	 *
	 * @param {requestGuildMembersOptions} options 
	 * @returns {Promise<{
	 * 		guild_id: string,
	 * 		members: Record<string, any>[],
	 * 		presences: Record<string, any>[],
	 * 		not_found: string[]
	 * }>}
	 */
	requestGuildMembers(options) {
		if(!options || typeof options !== "object") { return Promise.reject(new Error("Invalid options")); }
		if(typeof options.guild_id !== "string") { return Promise.reject(new Error("Invalid guild_id")); }
		const chunks = this._memberChunks;
		const hasUsers = Array.isArray(options.user_ids);
		const n = ((Date.now() % 86400000 + Math.random()) * 100000000).toString(36);
		const timeout = Number.isInteger(options.timeout) ? options.timeout : 10000;
		return this.send({
			op: 8,
			d: {
				guild_id: options.guild_id,
				query: hasUsers ? void 0 : options.query || "",
				limit: Number.isInteger(options.limit) ? options.limit : 50,
				presences: Boolean(options.presences),
				user_ids: hasUsers ? options.user_ids : void 0,
				nonce: n
			}
		}).then(() => new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				delete chunks[n];
				reject(new Error("Request timed out"));
			}, timeout);
			const resolver = () => {
				clearTimeout(timer);
				const data = chunks[n];
				delete chunks[n];
				resolve({
					guild_id: options.guild_id,
					members: data.members,
					presences: data.presences,
					not_found: data.not_found
				});
			};
			chunks[n] = {
				resolve: resolver,
				received: 0,
				members: [],
				presences: [],
				not_found: []
			};
		}));
	}

	/**
	 * 
	 * @param {updatePresenceOptions} presence 
	 * @returns {Promise<void>}
	 */
	updatePresence(presence) {
		if(!presence || typeof presence !== "object") { return Promise.reject(new Error("Invalid presence object")); }
		const data = {
			since: presence.afk ? Number(presence.since) || Date.now() : null,
			activities: Array.isArray(presence.activities) ? presence.activities : [],
			status: typeof presence.status === "string" ? presence.status.toLowerCase() : "online",
			afk: Boolean(presence.afk)
		};
		if(data.activities.length && !data.activities.every(x => typeof x.name === "string" && [0, 1, 2, 3, 4, 5].includes(x.type))) {
			return Promise.reject(new Error("Invalid presence name or type"));
		}
		if(!["online", "dnd", "idle", "invisible", "offline"].includes(data.status)) {
			return Promise.reject(new Error("Invalid status"));
		}
		let timer = this._timers.presencelimit;
		if(!timer) {
			const timeout = /** @type {NonNullable<typeof this._timers.presencelimit>} */ (setTimeout(() => {
				this._timers.presencelimit = null;
			}, 20000));
			timeout.count = 0;
			timeout.until = Date.now() + 20000;
			timer = this._timers.presencelimit = timeout;
		}
		if(++timer.count > 5) {
			const error = /** @type {Error & { retry_after: number }} */ (new Error("Presence update rate limit exceeded"));
			error.retry_after = timer.until - Date.now();
			return Promise.reject(error);
		}
		return this.send({
			op: 3,
			d: data
		});
	}

	/**
	 * 
	 * @param {UpdateVoiceStateOptions} state 
	 * @returns {Promise<UpdateVoiceStateResponse>}
	 */
	updateVoiceState(state, wait_for_server = false) {
		if(!state || typeof state !== "object") { return Promise.reject(new Error("Invalid voice state object")); }
		if(typeof state.guild_id !== "string") { return Promise.reject(new Error("Invalid guild_id")); }
		const id = state.guild_id;
		const channel = typeof state.channel_id === "string" ? state.channel_id : null;
		const chunks = this._voiceChunks;
		const timeout = Number.isInteger(state.timeout) ? state.timeout : 10000;
		return this.send({
			op: 4,
			d: {
				guild_id: id,
				channel_id: channel,
				self_mute: Boolean(state.self_mute),
				self_deaf: Boolean(state.self_deaf)
			}
		}).then(() => new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				delete chunks[id];
				reject(new Error("Request timed out"));
			}, timeout);
			const resolver = () => {
				clearTimeout(timer);
				const data = chunks[id];
				delete chunks[id];
				const result = /** @type {ReturnType<typeof this.updateVoiceState>} */ (Object.assign({}, data.state, data.server));
				resolve(result);
			};
			chunks[id] = {
				resolve: resolver,
				state: null,
				server: wait_for_server ? null : {}
			};
		}));
	}

	/**
	 * @private
	 * @returns {Promise<void>}
	 */
	_connect(retries = 0) {
		this.emit("debug", "Creating connection");
		const key = randomBytes(16).toString("base64");
		const compression = this.compression === 2 ? "&compress=zlib-stream" : "";
		const path = `/?v=${this.version}&encoding=${this.encoding}${compression}`;
		const req = request({
			hostname: (this._session.id && this._session.url) || this.url,
			path: path,
			headers: {
				"Connection": "Upgrade",
				"Upgrade": "websocket",
				"Sec-WebSocket-Key": key,
				"Sec-WebSocket-Version": "13",
			}
		});
		return new Promise((resolve, reject) => {
			req.on("upgrade", (res, socket) => {
				const hash = createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
				const accept = res.headers["sec-websocket-accept"];
				if(hash !== accept) {
					socket.end(() => {
						this.emit("debug", "Failed websocket-key validation");
						const error = /** @type {Error & { expected?: string, received?: string }} */ (new Error("Invalid Sec-Websocket-Accept"));
						error.expected = hash;
						error.received = accept;
						reject(error);
					});
					return;
				}
				socket.on("error", this._onError.bind(this));
				socket.on("close", this._onClose.bind(this));
				socket.on("readable", this._onReadable.bind(this));
				this._socket = socket;
				if(this.compression > 0) {
					this._zlib = new zlib();
				}
				this.emit("debug", "Connected");
				this._promises.connect?.resolve();
				resolve();
			});
			req.on("error", e => {
				this.emit("debug", "Failed to connect");
				this.emit("debug", e);
				if(retries < 3) {
					this.emit("debug", "Retrying...");
					setTimeout(() => resolve(this._connect(retries + 1)), 500);
				} else {
					reject(e);
				}
			});
			req.end();
		});
	}

	/**
	 * 
	 * @param {Buffer} packet 
	 * @param {number} opcode 
	 * @returns {void}
	 * @private
	 */
	_write(packet, opcode) {
		const socket = this._socket;
		if(!socket || !socket.writable) { return; }
		const length = packet.length;
		let frame;
		if(length < 126) {
			frame = Buffer.allocUnsafe(6 + length);
			frame[1] = 128 + length;
		} else if(length < (1 << 16)) {
			frame = Buffer.allocUnsafe(8 + length);
			frame[1] = 254;
			frame[2] = length >> 8;
			frame[3] = length & 255;
		} else {
			frame = Buffer.allocUnsafe(14 + length);
			frame[1] = 255;
			frame.writeBigUInt64BE(BigInt(length), 2);
		}
		frame[0] = 128 + opcode;
		frame.writeUInt32BE(0, frame.length - length - 4);
		frame.set(packet, frame.length - length);
		socket.write(frame);
	}

	/**
	 * 
	 * @returns {Promise<void>}
	 * @private
	 */
	async _identify() {
		if(typeof this.identifyHook === "function") {
			const response = await this.identifyHook(this.id);
			if(!response.canIdentify) {
				await new Promise(r => setTimeout(r, response.retryAfter));
				return this._identify();
			}
		}
		this.emit("debug", "Identifying");
		this.send({
			op: 2,
			d: {
				token: this.token,
				intents: this.intents,
				properties: this.properties,
				compress: this.compression === 1,
				large_threshold: this.large_threshold,
				presence: this.presence,
				shard: [this.id, this.total]
			}
		});
	}

	/**
	 * 
	 * @private
	 */
	_resume() {
		this._last.replayed = 0;
		this.emit("debug", "Resuming");
		this.send({
			op: 6,
			d: {
				token: this.token,
				session_id: this._session.id,
				seq: this._session.seq
			}
		});
	}

	/**
	 * 
	 * @private
	 */
	_initConnect(busy = false) {
		const promises = this._promises;
		if(!promises.connect) {
			/** @type {*} */ let resolver;
			const promise = /** @type {NonNullable<typeof this._promises.connect>} */ (new Promise(resolve => {
				resolver = resolve;
			}).then(() => {
				promises.connect = null;
				this._timestamps.connectedAt = Date.now();
			}));
			promise.resolve = resolver;
			promise.busy = busy;
			promises.connect = promise;
		}
		if(!promises.ready) {
			/** @type {*} */ let resolver;
			const promise = /** @type {NonNullable<typeof this._promises.ready>} */ (new Promise(resolve => {
				resolver = resolve;
			}).then(() => {
				promises.ready = null;
				this._timestamps.readyAt = Date.now();
			}));
			promise.resolve = resolver;
			promises.ready = promise;
		}
	}

	/**
	 * 
	 * @private
	 */
	_initOffline() {
		this.emit("debug", "Network appears to be offline, retrying in 10 seconds");
		this._timers.offline = setTimeout(() => {
			this._timers.offline = null;
			this._connect(3).catch(() => this._initOffline());
		}, 10000);
		this._promises.connect?.resolve();
	}

	/**
	 * 
	 * @private
	 */
	_initClose(code = 4099, reconnect = false) {
		if(reconnect) {
			this._initConnect();
		}
		const timers = this._timers;
		if(!timers.close) {
			timers.close = setTimeout(() => {
				this.emit("debug", "Did not receive a close confirmation after 5 seconds, destroying...");
				this._socket?.destroy();
			}, 5000);
		}
		this._write(Buffer.from([code >> 8, code & 255]), 8);
	}

	/**
	 * 
	 * @param {Error} error 
	 * @private
	 */
	_onError(error) {
		this.emit("debug", "Received an error event");
		this.emit("debug", error);
		this._initConnect();
	}

	/**
	 * 
	 * @private
	 */
	_onClose() {
		const socket = this._socket;
		if(!socket) { return; }
		this.emit("debug", "Connection closed");
		socket.removeListener("readable", this._onReadable);
		socket.removeListener("error", this._onError);
		socket.removeListener("close", this._onClose);
		this._socket = null;
		this._timestamps.connectedAt = 0;
		this._timestamps.readyAt = 0;
		if(this._zlib) {
			this._zlib.close();
			this._zlib = null;
		}
		const timers = this._timers;
		if(timers.heartbeat) {
			clearInterval(timers.heartbeat);
			timers.heartbeat = null;
		}
		if(timers.ratelimit) {
			clearTimeout(timers.ratelimit);
			timers.ratelimit = null;
		}
		if(timers.presencelimit) {
			clearTimeout(timers.presencelimit);
			timers.presencelimit = null;
		}
		if(timers.close) {
			clearTimeout(timers.close);
			timers.close = null;
		}
		const promises = this._promises;
		if(promises.ping) {
			promises.ping.resolve();
		}
		if(promises.close) {
			promises.close.resolve();
			return;
		}
		if(promises.connect || !this._last.error) {
			if(!promises.connect) {
				this.emit("debug", "Received close event for unknown reasons");
				this._initConnect();
			}
			this.emit("debug", "Reconnecting");
			this._connect().catch(() => this._initOffline());
			return;
		}
		this.emit("debug", `Shard closed due to an unrecoverable close code ${this._last.error.code}`);
		this.emit("close", this._last.error);
		this._last.error = null;
	}

	/**
	 * 
	 * @private
	 */
	_onReadable() {
		const socket = /** @type {NonNullable<typeof this._socket>} */ (this._socket);
		while(socket.readableLength > 1) {
			let length = readRange(socket, 1, 1) & 127;
			let bytes = 0;
			if(length > 125) {
				bytes = length === 126 ? 2 : 8;
				if(socket.readableLength < 2 + bytes) { return; }
				length = readRange(socket, 2, bytes);
			}
			const frame = socket.read(2 + bytes + length);
			if(!frame) { return; }
			const fin = frame[0] >> 7;
			const opcode = frame[0] & 15;
			if(fin !== 1 || opcode === 0) {	throw new Error("discord actually does send messages with fin=0. if you see this error let me know"); }
			const payload = frame.slice(2 + bytes);
			this._processFrame(opcode, payload);
		}
	}

	/**
	 * 
	 * @param {number} opcode 
	 * @param {Buffer} message 
	 * @private
	 */
	_processFrame(opcode, message) {
		if(opcode > 2) {
			switch(opcode) {
				case 8: {
					const code = message.length > 1 ? (message[0] << 8) + message[1] : 0;
					const reason = message.length > 2 ? message.slice(2).toString() : "";
					this.emit("debug", `Received close frame with code: ${code} ${reason}`);
					if(!this._promises.close) {
						if([4004, 4010, 4011, 4012, 4013, 4014].includes(code)) {
							const error = /** @type {Error & { code: number, reason: string }} */ (new Error(`Websocket closed with code ${code}`));
							error.code = code;
							error.reason = reason;
							this._last.error = error;
						} else {
							if([1000, 4001, 4007, 4009].includes(code)) {
								this._session.id = null;
								this._session.seq = 0;
								this._session.url = null;
							}
							this._initConnect();
						}
						if(code !== 4099) {
							this._write(message.slice(0, 2), 8); // echo close code
						}
					}
					break;
				}
				case 9: {
					this.emit("debug", "Received ping frame, responding with pong");
					this._write(message, 10);
					break;
				}
				case 10: {
					this.emit("debug", "Received pong frame");
					if(this._promises.ping) { this._promises.ping.resolve(); }
					break;
				}
			}
		} else {
			let data = message;
			if(opcode === 2) {
				const z = /** @type {NonNullable<typeof this._zlib>} */ (this._zlib);
				try {
					if(this.compression === 2) {
						data = z.run(message);
					} else if(this.encoding === "json") {
						data = z.run(message);
						z.reset();
					} else if(this.compression === 1 && message[1] === 80) {
						data = z.run(message.slice(6));
						z.reset();
					}
				} catch(e) {
					this.emit("debug", "Zlib error");
					this.emit("debug", e);
					this._initClose(4099, true);
					return;
				}
				
			}
			if(this.disabledEvents !== null) {
				const ev = this.encoding === "json" ? peekJSON(data) : peekETF(data);
				if(ev && this.disabledEvents.includes(ev)) { return; }
			}
			const json = this.encoding === "json" ? JSON.parse(data.toString()) : readETF(data, this.etfUseBigint);
			this._processMessage(json);
		}
	}

	/**
	 * 
	 * @param {Record<string, any>} data 
	 * @private
	 */
	_processMessage(data) {
		this._timestamps.lastPacket = Date.now();
		if(data.s > this._session.seq) {
			this._session.seq = data.s;
			if(this._last.replayed !== null) { this._last.replayed++; }
		}
		switch(data.op) {
			case 0: {
				const t = data.t;
				const d = data.d;
				switch(t) {
					case "READY": {
						this._session.id = d.session_id;
						this._session.url = typeof d.resume_gateway_url === "string" ? d.resume_gateway_url.includes("://") ? d.resume_gateway_url.split("://")[1] : d.resume_gateway_url : null;
						this._timestamps.readyAt = this._timestamps.identifiedAt = Date.now();
						this._promises.ready?.resolve();
						this.emit("debug", `Received READY event! Session = ${d.session_id}`);
						this.emit("ready", {
							type: "identify",
							data: d
						});
						return;
					}
					case "RESUMED": {
						d.replayed = this._last.replayed;
						this._last.replayed = null;
						this._timestamps.readyAt = Date.now();
						this._promises.ready?.resolve();
						this.emit("debug", `Resumed! Session = ${this._session.id}, replayed = ${d.replayed}`);
						this.emit("ready", {
							type: "resume",
							data: d
						});
						return;
					}
					case "GUILD_MEMBERS_CHUNK": {
						const chunk = this._memberChunks[d.nonce];
						if(chunk) {
							chunk.members.push(...d.members);
							if(d.presences) { chunk.presences.push(...d.presences); }
							if(d.not_found) { chunk.not_found.push(...d.not_found); }
							if(++chunk.received === d.chunk_count) { chunk.resolve(); }
						}
						break;
					}
					case "VOICE_STATE_UPDATE": {
						const chunk = this._voiceChunks[d.guild_id];
						if(chunk) {
							chunk.state = d;
							if(chunk.state && chunk.server) { chunk.resolve(); }
						}
						break;
					}
					case "VOICE_SERVER_UPDATE": {
						const chunk = this._voiceChunks[d.guild_id];
						if(chunk) {
							chunk.server = d;
							if(chunk.state && chunk.server) { chunk.resolve(); }
						}
						break;
					}
				}
				this.emit("event", data);
				break;
			}
			case 1: {
				this.emit("debug", "Received heartbeat request, responding with heartbeat");
				this.send({ op: 1, d: this._session.seq });
				break;
			}
			case 7: {
				this.emit("debug", "Discord asked us to reconnect");
				this._initClose(4099, true);
				break;
			}
			case 9: {
				this.emit("debug", "Received invalid session. Waiting 1-5s before reconnect");
				if(data.d) {
					this._resume();
				} else {
					this._session.id = null;
					this._session.seq = 0;
					this._session.url = null;
					setTimeout(() => this._initClose(4099, true), Math.floor(Math.random() * 4000) + 1000);
				}
				break;
			}
			case 10: {
				const interval = data.d.heartbeat_interval;
				const timeout = Math.floor(interval * Math.random());
				this.emit("debug", `Received hello. Heartbeat interval = ${interval}ms. First heartbeat in ${timeout}ms`);
				this._timers.heartbeat = setTimeout(() => {
					this._timestamps.lastHeartbeat = Date.now();
					this.emit("debug", "Sending heartbeat");
					this.send({ op: 1, d: this._session.seq });
					this._timers.heartbeat = setInterval(() => {
						if(this._timestamps.lastHeartbeat > this._timestamps.lastAck) {
							this.emit("debug", "Did not receive an Ack, attempting to reconnect");
							this._initClose(4099, true);
						} else {
							this._timestamps.lastHeartbeat = Date.now();
							this.emit("debug", "Sending heartbeat");
							this.send({ op: 1, d: this._session.seq });
						}
					}, interval);
				}, timeout);
				if(this._session.id && this._session.seq) {
					this._resume();
				} else {
					this._identify();
				}
				break;
			}
			case 11: {
				this.emit("debug", "Received ACK");
				this._timestamps.lastAck = Date.now();
				this._last.ping = this._timestamps.lastAck - this._timestamps.lastHeartbeat;
				break;
			}
		}
	}
}

/**
 * 
 * @param {*} obj 
 * @returns {obj is Properties}
 */
function isValidProperties(obj) {
	return obj && typeof obj === "object" && ["os", "browser", "device"].every(x => typeof obj[x] === "string");
}

/**
 * 
 * @param {*} obj 
 * @returns {obj is Presence}
 */
function isValidPresence(obj) {
	if(!obj || typeof obj !== "object" || typeof obj.since === "undefined" || typeof obj.afk !== "boolean" || typeof obj.status !== "string") { return false; }
	if(!["online", "dnd", "idle", "invisible", "offline"].includes(obj.status = obj.status.toLowerCase())) { return false; }
	if(!Array.isArray(obj.activities)) { return false; }
	if(obj.activities.length && !obj.activities.every((/** @type {*} */ x) => x && typeof x === "object" && typeof x.name === "string" && [0, 1, 2, 3, 4, 5].includes(x.type))) { return false; }
	return true;
}

/**
 * 
 * @param {*} value 
 * @returns {boolean}
 */
function isValidRequest(value) {
	return value && typeof value === "object" && Number.isInteger(value.op) && typeof value.d !== "undefined";
}

/**
 * 
 * @param {import("net").Socket} socket 
 * @param {number} index 
 * @param {number} bytes 
 */
function readRange(socket, index, bytes) {
	// @ts-expect-error _readableState is private / not typed
	let head = socket._readableState.buffer.head;
	let cursor = 0;
	let read = 0;
	let num = 0;
	do {
		for(let i = 0; i < head.data.length; i++) {
			if(++cursor > index) {
				num *= 256;
				num += head.data[i];
				if(++read === bytes) {
					return num;
				}
			}
		}
	} while((head = head.next));
	throw new Error("readRange failed?");
}

/**
 * 
 * @param {Buffer} data 
 */
function readETF(data, useBigint = false) {
	let x = data[0] === 131 ? 1 : 0;
	/** @type {DataView} */ let view;
	/** @type {() => any} */ const loop = () => {
		const type = data[x++];
		switch(type) {
			case 97: { // small int
				return data[x++];
			}
			case 98: { // int
				const int = data.readInt32BE(x);
				x += 4;
				return int;
			}
			case 100: { // atom
				const length = data.readUInt16BE(x);
				let atom = "";
				if(length > 30) {
					// @ts-expect-error latin1Slice is not documented for some reason
					atom = data.latin1Slice(x += 2, x + length);
				} else {
					for(let i = x += 2; i < x + length; i++) {
						atom += String.fromCharCode(data[i]);
					}
				}
				x += length;
				if(!atom) { return undefined; }
				if(atom === "nil" || atom === "null") { return null; }
				if(atom === "true") { return true; }
				if(atom === "false") { return false; }
				return atom;
			}
			case 108: case 106: { // list
				const array = [];
				if(type === 108) {
					const length = data.readUInt32BE(x);
					x += 4;
					for(let i = 0; i < length; i++) {
						array.push(loop());
					}
					x++;
				}
				return array;
			}
			case 107: { // string
				const array = [];
				const length = data.readUInt16BE(x);
				x += 2;
				for(let i = 0; i < length; i++) {
					array.push(data[x++]);
				}
				return array;
			}
			case 109: { // binary
				const length = data.readUInt32BE(x);
				let str = "";
				if(length > 30) {
					// @ts-expect-error utf8Slice not documented for some reason
					str = data.utf8Slice(x += 4, x + length);
				} else {
					let i = x += 4;
					const l = x + length;
					while(i < l) {
						let byte = data[i++];
						if(byte < 128) { str += String.fromCharCode(byte); }
						else if(byte < 224) { str += String.fromCharCode(((byte & 31) << 6) + (data[i++] & 63)); }
						else if(byte < 240) { str += String.fromCharCode(((byte & 15) << 12) + ((data[i++] & 63) << 6) + (data[i++] & 63)); }
						else {
							const point = ((byte & 7) << 18) + ((data[i++] & 63) << 12) + ((data[i++] & 63) << 6) + (data[i++] & 63);
							const c1 = 55296 + ((point - 65536) >> 10);
							const c2 = 55296 + ((point - 65536) & 1023);
							str += String.fromCharCode(c1, c2);
						}
					}
				}
				x += length;
				return str;
			}
			case 110: { // bigint
				if(!view) { view = new DataView(data.buffer, data.byteOffset, data.byteLength); }
				const length = data[x++];
				const sign = data[x++];
				let left = length;
				let num = 0n;
				while(left > 0) {
					if(left >= 8) {
						num <<= 64n;
						num += view.getBigUint64(x + (left -= 8), true);
					} else if(left >= 4) {
						num <<= 32n;
						num += BigInt(view.getUint32(x + (left -= 4), true));
					} else if(left >= 2) {
						num <<= 16n;
						num += BigInt(view.getUint16(x + (left -= 2), true));
					} else {
						num <<= 8n;
						num += BigInt(data[x]);
						left--;
					}
				}
				x += length;
				if(sign) { num = -num; }
				return useBigint ? num : num.toString();
			}
			case 116: { // object
				/** @type {Record<string, any>} */ const obj = {};
				const length = data.readUInt32BE(x);
				x += 4;
				for(let i = 0; i < length; i++) {
					const key = loop();
					obj[key] = loop();
				}
				return obj;
			}
		}
		throw new Error(`Missing etf type: ${type}`);
	};
	return loop();
}

/**
 * 
 * @param {*} data 
 */
function writeETF(data) {
	const b = /** @type {Buffer & { latin1Write: Buffer["write"], utf8Write: Buffer["write"] }} */ (Buffer.allocUnsafe(1 << 12));
	b[0] = 131;
	let i = 1;
	/** @type {(obj: any) => any} */ const loop = (obj) => {
		const type = typeof obj;
		switch(type) {
			case "boolean": {
				b[i++] = 100;
				if(obj) {
					b.writeUInt16BE(4, i);
					b.latin1Write("true", i += 2);
					i += 4;
				} else {
					b.writeUInt16BE(5, i);
					b.latin1Write("false", i += 2);
					i += 5;
				}
				break;
			}
			case "string": {
				const length = Buffer.byteLength(obj);
				b[i++] = 109;
				b.writeUInt32BE(length, i);
				b.utf8Write(obj, i += 4);
				i += length;
				break;
			}
			case "number": {
				if(Number.isInteger(obj)) {
					const abs = Math.abs(obj);
					if(abs < 2147483648) {
						b[i++] = 98;
						b.writeInt32BE(obj, i);
						i += 4;
					} else if(abs < Number.MAX_SAFE_INTEGER) {
						b[i++] = 110;
						b[i++] = 8;
						b[i++] = Number(obj < 0);
						b.writeBigUInt64LE(BigInt(abs), i);
						i += 8;
						break;
					} else {
						b[i++] = 70;
						b.writeDoubleBE(obj, i);
						i += 8;
					}
				} else {
					b[i++] = 70;
					b.writeDoubleBE(obj, i);
					i += 8;
				}
				break;
			}
			case "bigint": {
				b[i++] = 110;
				b[i++] = 8;
				b[i++] = Number(obj < 0);
				b.writeBigUInt64LE(obj, i);
				i += 8;
				break;
			}
			case "object": {
				if(obj === null) {
					b[i++] = 100;
					b.writeUInt16BE(3, i);
					b.latin1Write("nil", i += 2);
					i += 3;
				} else if(Array.isArray(obj)) {
					if(obj.length) {
						b[i++] = 108;
						b.writeUInt32BE(obj.length, i);
						i += 4;
						for(const item of obj) {
							loop(item);
						}
					}
					b[i++] = 106;
				} else {
					const entries = Object.entries(obj).filter(x => typeof x[1] !== "undefined");
					b[i++] = 116;
					b.writeUInt32BE(entries.length, i);
					i += 4;
					for(const [key, value] of entries) {
						loop(key);
						loop(value);
					}
				}
				break;
			}
		}
	};
	loop(data);
	return Buffer.from(b.slice(0, i));
}

/**
 * 
 * @param {Buffer} a 
 * @param {number} i 
 * @returns 
 */
function peekJSON(a, i = 0) {
	if(a[i+0] === 123 && a[i+1] === 34 && a[i+2] === 116 && a[i+3] === 34 && a[i+4] === 58 && a[i+5] === 34) {
		const end = a.indexOf(34, i+6);
		// @ts-expect-error latin1Slice is private
		const ev = a.latin1Slice(i+6, end);
		if(["READY", "RESUMED", "GUILD_MEMBERS_CHUNK", "VOICE_STATE_UPDATE", "VOICE_SERVER_UPDATE"].includes(ev)) {
			return false;
		}
		return ev;
	}
	return false;
}

/**
 * 
 * @param {Buffer} a 
 * @returns 
 */
function peekETF(a) {
	const l = a.length;
	for(let i = l - 1; i > l - 50; i--) {
		if(a[i] === 116 && a[i-1] === 1 && a[i-2] === 0 && a[i-3] === 100 && a[i+1] === 100 && a[i+2] === 0) {
			const size = a[i+3];
			// @ts-expect-error latin1Slice is private
			const ev = a.latin1Slice(i+4, i+4+size);
			if(["nil", "READY", "RESUMED", "GUILD_MEMBERS_CHUNK", "VOICE_STATE_UPDATE", "VOICE_SERVER_UPDATE"].includes(ev)) {
				return false;
			}
			return ev;
		}
	}
	return false;
}

class zlib {
	constructor() {
		this.z = /** @type {import("zlib").Inflate & { _processChunk: (message: Buffer, flag: number) => Buffer; _handle: Record<String, any>; _events: Record<String, any>; _eventsCount: number }} */ (createInflate());
		this.c = this.z.close;
		this.h = this.z._handle;
		this.hc = this.h.close;
		this.e = this.z._events;
		this.v = () => void 0;
	}
	/**
	 * 
	 * @param {Buffer} message 
	 */
	run(message) {
		const { z, c, h, hc, v, e } = this;
		z.close = h.close = v;
		try {
			return z._processChunk(message, 2);
		} finally {
			z.close = c;
			z._handle = h;
			h.close = hc;
			e.error = void 0;
			z._eventsCount = 1;
		}
	}
	reset() {
		this.h.reset();
	}
	close() {
		this.z.close();
	}
}

module.exports = WebsocketShard;

/**
 * @typedef {{
 * 		token: string,
 * 		intents: number,
 * 		id?: number,
 * 		total?: number,
 * 		large_threshold?: number
 * 		presence?: Presence,
 * 		properties?: Properties,
 * 		version?: number,
 * 		encoding?: "etf" | "json",
 * 		compression?: 0 | 1 | 2,
 * 		url?: string,
 * 		session?: {
 * 			session_id: string,
 * 			sequence: number,
 * 			resume_url: string
 * 		}
 * 		disabledEvents?: string[],
 * 		etfUseBigint?: boolean,
 * 		identifyHook?: (id: number) => { canIdentify: boolean, retryAfter?: number } | Promise<{ canIdentify: boolean, retryAfter?: number }>
 * }} WebsocketShardOptions
 */

/**
 * @typedef {{
 * 		op: number,
 * 		d: any
 * }} GatewayCommand
 */

/**
 * @typedef {{
 * 		guild_id: string,
 * 		query?: string,
 * 		limit?: number,
 * 		presences?: boolean,
 * 		user_ids?: string[],
 * 		timeout?: number
 * }} requestGuildMembersOptions
 */

/**
 * @typedef {{
 * 		since?: number,
 * 		afk?: boolean,
 * 		status?: "online" | "dnd" | "idle" | "invisible" | "offline",
 * 		activities?: Presence["activities"]
 * }} updatePresenceOptions
 */

/**
 * @typedef {{
 * 		guild_id: string,
 * 		channel_id?: string,
 * 		self_mute?: boolean,
 * 		self_deaf?: boolean,
 * 		timeout?: number
 * }} UpdateVoiceStateOptions
 */

/**
 * @typedef {{
 * 		guild_id: string,
 * 		channel_id?: string,
 * 		user_id: string,
 * 		member?: Record<string, any>,
 * 		session_id: string,
 * 		deaf: boolean,
 * 		mute: boolean,
 * 		self_deaf: boolean,
 * 		self_mute: boolean,
 * 		self_stream?: boolean,
 * 		self_video: boolean,
 * 		suppress: boolean,
 * 		request_to_speak_timestamp?: string,
 * 		token?: string,
 * 		endpoint?: string
 * }} UpdateVoiceStateResponse
 */

/**
 * @typedef {{
 * 		os: string,
 * 		browser: string,
 * 		device: string
 * }} Properties
 */

/**
 * @typedef {{
 * 		since: number?,
 * 		afk: boolean,
 * 		status: "online" | "dnd" | "idle" | "invisible" | "offline",
 * 		activities: {
 * 			name: string,
 * 			type: 0 | 1 | 2 | 3 | 4 | 5,
 * 			url?: string
 * 		}[]
 * }} Presence
 */

/**
 * @typedef {{
 * 		op: number,
 * 		d: Record<string, any>,
 * 		s: number,
 * 		t: string
 * }} ShardEvent
 */

/**
 * @typedef {{
 * 		v: string,
 * 		user: Record<string, any>,
 * 		guilds: Record<string, any>[],
 * 		session_id: string,
 * 		shard?: [number, number],
 * 		application: Record<string, any>
 * }} ShardReady
 */

/**
 * @typedef {{
 * 		replayed: number
 * }} ShardResumed
 */

/**
 * @typedef {{
 * 		type: "identify" | "resume",
 *		data: ShardReady | ShardResumed
 * }} ReadyEvent
 */

/**
 * @typedef {{
 * 		0: "ready",
 * 		1: "connecting",
 * 		2: "connected",
 * 		3: "closing",
 * 		4: "offline",
 * 		5: "closed"
 * }} StatusCodes
 */

/**
 * @typedef { "APPLICATION_COMMAND_PERMISSIONS_UPDATE"
 *  | "AUTO_MODERATION_RULE_CREATE"
 *  | "AUTO_MODERATION_RULE_UPDATE"
 *  | "AUTO_MODERATION_RULE_DELETE"
 *  | "AUTO_MODERATION_ACTION_EXECUTION"
 *  | "CHANNEL_CREATE"
 *  | "CHANNEL_UPDATE"
 *  | "CHANNEL_DELETE"
 *  | "CHANNEL_PINS_UPDATE"
 *  | "THREAD_CREATE"
 *  | "THREAD_UPDATE"
 *  | "THREAD_DELETE"
 *  | "THREAD_LIST_SYNC"
 *  | "THREAD_MEMBER_UPDATE"
 *  | "THREAD_MEMBERS_UPDATE"
 *  | "GUILD_CREATE"
 *  | "GUILD_UPDATE"
 *  | "GUILD_DELETE"
 *  | "GUILD_AUDIT_LOG_ENTRY_CREATE"
 *  | "GUILD_BAN_ADD"
 *  | "GUILD_BAN_REMOVE"
 *  | "GUILD_EMOJIS_UPDATE"
 *  | "GUILD_STICKERS_UPDATE"
 *  | "GUILD_INTEGRATIONS_UPDATE"
 *  | "GUILD_MEMBER_ADD"
 *  | "GUILD_MEMBER_REMOVE"
 *  | "GUILD_MEMBER_UPDATE"
 *  | "GUILD_MEMBERS_CHUNK"
 *  | "GUILD_ROLE_CREATE"
 *  | "GUILD_ROLE_UPDATE"
 *  | "GUILD_ROLE_DELETE"
 *  | "GUILD_SCHEDULED_EVENT_CREATE"
 *  | "GUILD_SCHEDULED_EVENT_UPDATE"
 *  | "GUILD_SCHEDULED_EVENT_DELETE"
 *  | "GUILD_SCHEDULED_EVENT_USER_ADD"
 *  | "GUILD_SCHEDULED_EVENT_USER_REMOVE"
 *  | "INTEGRATION_CREATE"
 *  | "INTEGRATION_UPDATE"
 *  | "INTEGRATION_DELETE"
 *  | "INTERACTION_CREATE"
 *  | "INVITE_CREATE"
 *  | "INVITE_DELETE"
 *  | "MESSAGE_CREATE"
 *  | "MESSAGE_UPDATE"
 *  | "MESSAGE_DELETE"
 *  | "MESSAGE_DELETE_BULK"
 *  | "MESSAGE_REACTION_ADD"
 *  | "MESSAGE_REACTION_REMOVE"
 *  | "MESSAGE_REACTION_REMOVE_ALL"
 *  | "MESSAGE_REACTION_REMOVE_EMOJI"
 *  | "PRESENCE_UPDATE"
 *  | "STAGE_INSTANCE_CREATE"
 *  | "STAGE_INSTANCE_DELETE"
 *  | "STAGE_INSTANCE_UPDATE"
 *  | "TYPING_START"
 *  | "USER_UPDATE"
 *  | "VOICE_STATE_UPDATE"
 *  | "VOICE_SERVER_UPDATE"
 *  | "WEBHOOKS_UPDATE" } ShardEvents
 */
