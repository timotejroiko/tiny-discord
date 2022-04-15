"use strict";

const { EventEmitter } = require("events");
const { request } = require("https");
const { randomBytes, createHash } = require("crypto");
const { createInflate, inflateSync, constants: { Z_SYNC_FLUSH } } = require("zlib");

class WebsocketShard extends EventEmitter {
	constructor(options) {
		if(!options || typeof options !== "object") { throw new Error("Invalid options"); }
		if(typeof options.token !== "string") { throw new Error("Invalid token"); }
		if(!Number.isInteger(options.intents)) { throw new Error("Invalid intents"); }
		super();
		this.token = options.token;
		this.intents = options.intents;
		this.id = Number(options.id) || 0;
		this.total = Number(options.total) || this.id + 1;
		this.large_threshold = Number(options.large_threshold) || void 0;
		this.presence = isValidPresence(options.presence) ? options.presence : void 0;
		this.properties = isValidProperties(options.properties) ? options.properties : { $os: process.platform, $browser: "tiny-discord", $device: "tiny-discord" };
		this.version = Number(options.version) || 9;
		this.encoding = typeof options.encoding === "string" && options.encoding.toLowerCase() === "etf" ? "etf" : "json";
		this.compression = [0, 1, 2].includes(options.compression = Number(options.compression)) ? options.compression : 0;
		this.url = typeof options.url === "string" ? options.url.includes("://") ? options.url.split("://")[1] : options.url : "gateway.discord.gg";
		this.session = typeof options.session === "string" ? options.session : null;
		this.sequence = Number(options.sequence) || 0;
		this.identifyHook = typeof options.identifyHook === "function" ? options.identifyHook : null;
		this._socket = null;
		this._internal = {
			replayCount: 0,
			ratelimitCount: 0,
			ratelimitTimer: null,
			presenceCount: 0,
			presenceTimer: null,
			heartbeatInterval: null,
			lastPacket: 0,
			lastAck: 0,
			lastHeartbeat: 0,
			lastPing: 999,
			lastReceived: null,
			lastSent: null,
			lastError: null,
			closePromise: null,
			pingPromise: null,
			reconnectPromise: null,
			zlib: null,
			memberChunks: {},
			voiceChunks: {}
		};
	}
	get lastPing() {
		return this._internal.lastPing;
	}
	get status() {
		const internal = this._internal;
		if(internal.reconnectPromise) { return 2; } // reconnecting
		if(internal.closePromise) { return 3; } // closing
		if(!this._socket) { return 4; } // closed
		return 1; // connected
	}
	connect() {
		if(this._socket) { return Promise.resolve(); }
		const key = randomBytes(16).toString("base64");
		const compression = this.compression === 2 ? "&compress=zlib-stream" : "";
		const path = `/?v=${this.version}&encoding=${this.encoding}${compression}`;
		this.emit("debug", "Creating connection");
		const req = request({
			hostname: this.url,
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
						const error = new Error("Invalid Sec-Websocket-Accept");
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
				if(this.compression === 2) {
					const z = createInflate();
					z._c = z.close;
					z._h = z._handle;
					z._hc = z._handle.close;
					z._v = () => void 0;
					this._internal.zlib = z;
				}
				this.emit("debug", "Connected");
				resolve();
			});
			req.on("error", e => {
				this.emit("debug", "Failed to connect");
				this.emit("debug", e);
				if(this._internal.reconnectPromise) {
					this._internal.reconnectPromise.offline = true;
					this.emit("debug", "Retrying in 10 seconds");
					const timer = setTimeout(() => {
						this.connect().then(() => {
							this._internal.reconnectPromise.offline = false;
						}).catch(e => {
							this._internal.lastError = e;
							this.close();
						});
					}, 10000);
					this._internal.reconnectPromise.then(() => {
						clearTimeout(timer);
					});
					return;
				}
				reject(e);
			});
			req.end();
		});
	}
	ping(data) {
		const internal = this._internal;
		if(internal.reconnectPromise) { return internal.reconnectPromise.then(() => this.ping(data)); }
		if(!this._socket) { return Promise.reject(new Error("Not connected")); }
		if(internal.pingPromise) { return internal.pingPromise; }
		const time = Date.now();
		let resolver;
		const promise = new Promise(resolve => {
			resolver = resolve;
			this._write(data ? Buffer.from(JSON.stringify(data)) : Buffer.allocUnsafe(0), 9);
		}).then(() => {
			internal.pingPromise = null;
			return internal.lastPing = Date.now() - time;
		});
		promise.resolve = resolver;
		return internal.pingPromise = promise;
	}
	close() {
		const internal = this._internal;
		if(internal.reconnectPromise) {
			if(!internal.reconnectPromise.offline) {
				return internal.reconnectPromise.then(() => this.close());
			}
			internal.reconnectPromise.resolve();
		}
		if(!this._socket) { return Promise.resolve(); }
		let resolver;
		const promise = new Promise(resolve => {
			resolver = resolve;
			this._write(Buffer.from([16, 3]), 8);
		}).then(() => {
			internal.closePromise = null;
		});
		promise.resolve = resolver;
		return internal.closePromise = promise;
	}
	send(data) {
		const internal = this._internal;
		if(internal.reconnectPromise) { return internal.reconnectPromise.then(() => this.send(data)); }
		if(!this._socket) { return Promise.reject(new Error("Not connected")); }
		if(!isValidRequest(data)) { return Promise.reject(new Error("Invalid request")); }
		let timer = internal.ratelimitTimer;
		if(!timer) {
			timer = internal.ratelimitTimer = setTimeout(() => {
				internal.ratelimitTimer = null;
			}, 60000);
			timer.count = 0;
		}
		if(++timer.count > 115 && ![1, 2, 6].includes(data.op)) {
			const remaining = timer._idleStart + timer._idleTimeout - (process.uptime() * 1000);
			const error = new Error("Socket rate limit exceeded");
			error.retry_after = remaining;
			return Promise.reject(error);
		}
		internal.lastSent = data;
		if(this.encoding === "json") {
			this._write(Buffer.from(JSON.stringify(data)), 1);
		} else {
			const etf = writeETF(data);
			this._write(etf, 2);
		}
		return Promise.resolve();
	}
	requestGuildMembers(options) {
		if(!options || typeof options !== "object") { return Promise.reject(new Error("Invalid options")); }
		if(typeof options.guild_id !== "string") { return Promise.reject(new Error("Invalid guild_id")); }
		const chunks = this._internal.memberChunks;
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
		const internal = this._internal;
		if(!internal.presenceTimer) {
			internal.presenceTimer = setTimeout(() => {
				internal.presenceCount = 0;
				internal.presenceTimer = null;
			}, 20000);
		}
		if(++internal.presenceCount > 5) {
			const timer = internal.presenceTimer;
			const remaining = timer._idleStart + timer._repeat - (process.uptime() * 1000);
			const error = new Error("Presence update rate limit exceeded");
			error.retry_after = remaining;
			return Promise.reject(error);
		}
		return this.send({
			op: 3,
			d: data
		});
	}
	updateVoiceState(state) {
		if(!state || typeof state !== "object") { return Promise.reject(new Error("Invalid voice state object")); }
		if(typeof state.guild_id !== "string") { return Promise.reject(new Error("Invalid guild_id")); }
		const id = state.guild_id;
		const channel = typeof state.channel_id === "string" ? state.channel_id : null;
		const chunks = this._internal.voiceChunks;
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
				resolve(Object.assign(data.state, data.server));
			};
			chunks[id] = {
				resolve: resolver,
				state: null,
				server: state.wait_for_server ? null : {}
			};
		}));
	}
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
	async _identify() {
		if(typeof this.identifyHook === "function") {
			const response = await this.identifyHook(this.id);
			if(Number.isInteger(response.time) && response.time > 0) {
				await new Promise(r => setTimeout(r, response.time));
				if(response.ask) {
					return this._identify();
				}
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
	_resume() {
		this._internal.replayCount = 0;
		this.emit("debug", "Resuming");
		this.send({
			op: 6,
			d: {
				token: this.token,
				session_id: this.session,
				seq: this.sequence
			}
		});
	}
	_initReconnect() {
		if(!this._internal.reconnectPromise) {
			let resolver;
			const promise = new Promise(resolve => { resolver = resolve; }).then(() => { this._internal.reconnectPromise = null; });
			promise.resolve = resolver;
			promise.offline = false;
			this._internal.reconnectPromise = promise;
		}
	}
	_onError(error) {
		this.emit("debug", error);
		this._initReconnect();
	}
	_onClose() {
		const socket = this._socket;
		if(!socket) { return; }
		this.emit("debug", "Connection closed");
		socket.removeListener("readable", this._onReadable);
		socket.removeListener("error", this._onError);
		socket.removeListener("close", this._onClose);
		this._socket = null;
		const internal = this._internal;
		clearInterval(internal.heartbeatInterval);
		clearInterval(internal.ratelimitTimer);
		clearInterval(internal.presenceTimer);
		if(internal.pingPromise) {
			internal.pingPromise.resolve();
		}
		if(internal.zlib) {
			internal.zlib.close();
			internal.zlib = null;
		}
		if(internal.reconnectPromise) {
			this.emit("debug", "Reconnecting");
			this.connect();
			return;
		}
		if(internal.closePromise) {
			internal.closePromise.resolve();
			return;
		}
		if(!internal.lastError) {
			this.emit("debug", "Received close event for unknown reasons");
			this.emit("debug", "Reconnecting");
			this._initReconnect();
			this.connect();
			return;
		}
		this.emit("debug", `Shard closed due to an unrecoverable close code ${internal.lastError.code}`);
		if(internal.lastReceived) {
			this.emit("debug", "Last packet received before closing:");
			this.emit("debug", internal.lastReceived);
			internal.lastReceived = null;
		}
		if(internal.lastSent) {
			this.emit("debug", "Last packet sent before closing:");
			this.emit("debug", internal.lastSent);
			internal.lastSent = null;
		}
		this.emit("close", internal.lastError);
		internal.lastError = null;
	}
	_onReadable() {
		const socket = this._socket;
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
	_processFrame(opcode, message) {
		const internal = this._internal;
		switch(opcode) {
			case 1: {
				const packet = JSON.parse(message.toString());
				this._processMessage(packet);
				break;
			}
			case 2: {
				let packet;
				if(this.compression === 2) {
					const z = internal.zlib;
					let error = null;
					let data = null;
					z.close = z._handle.close = z._v;
					try {
						data = z._processChunk(message, Z_SYNC_FLUSH);
					} catch(e) {
						error = e;
					}
					const l = message.length;
					if(message[l - 4] !== 0 || message[l - 3] !== 0 || message[l - 2] !== 255 || message[l - 1] !== 255) {
						console.log(message, message.toString(), data, data.toString());
						throw new Error("discord actually does send fragmented zlib messages. if you see this error let me know");
					}
					z.close = z._c;
					z._handle = z._h;
					z._handle.close = z._hc;
					z._events.error = void 0;
					z._eventCount--;
					z.removeAllListeners("error");
					if(error) {
						this.emit("debug", "Zlib error");
						this.emit("debug", error);
						this._initReconnect();
						this._write(Buffer.from([16, 3]), 8);
						return;
					}
					packet = this.encoding === "json" ? JSON.parse(data.toString()) : readETF(data, 1);
				} else if(this.encoding === "json") {
					const data = inflateSync(message);
					packet = JSON.parse(data.toString());
				} else if(this.compression === 1 && message[1] === 80) {
					const data = inflateSync(message.slice(6));
					packet = readETF(data, 0);
				} else {
					packet = readETF(message, 1);
				}
				this._processMessage(packet);
				break;
			}
			case 8: {
				const code = message.length > 1 ? (message[0] << 8) + message[1] : 0;
				const reason = message.length > 2 ? message.slice(2).toString() : "";
				this.emit("debug", `Received close frame with code: ${code} ${reason}`);
				if(!internal.closePromise) {
					if([4004, 4010, 4011, 4012, 4013, 4014].includes(code)) {
						const error = new Error(`Websocket closed with code ${code}`);
						error.code = code;
						error.reason = reason;
						internal.lastError = error;
					} else {
						if([4001, 4007, 4009].includes(code)) {
							this.session = null;
							this.sequence = 0;
						}
						this._initReconnect();
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
				if(internal.pingPromise) { internal.pingPromise.resolve(); }
				break;
			}
		}
	}
	_processMessage(data) {
		const internal = this._internal;
		internal.lastReceived = data;
		internal.lastPacket = Date.now();
		if(data.s > this.sequence) {
			this.sequence = data.s;
			if(internal.replayCount !== null) { internal.replayCount++; }
		}
		switch(data.op) {
			case 0: {
				const t = data.t;
				const d = data.d;
				switch(t) {
					case "READY": {
						this.session = d.session_id;
						this.emit("debug", `Ready! Session = ${d.session_id}`);
						this.emit("ready", d);
						return;
					}
					case "RESUMED": {
						d.replayed = internal.replayCount;
						internal.replayCount = null;
						this.emit("debug", `Resumed! Session = ${this.session}, replayed = ${d.replayed}`);
						this.emit("resumed", d);
						return;
					}
					case "GUILD_MEMBERS_CHUNK": {
						const chunk = this._internal.memberChunks[d.nonce];
						if(chunk) {
							chunk.members.push(...d.members);
							if(d.presences) { chunk.presences.push(...d.presences); }
							if(d.not_found) { chunk.not_found.push(...d.not_found); }
							if(++chunk.received === d.chunk_count) { chunk.resolve(); }
						}
						break;
					}
					case "VOICE_STATE_UPDATE": {
						const chunk = this._internal.voiceChunks[d.guild_id];
						if(chunk) {
							chunk.state = d;
							if(chunk.state && chunk.server) { chunk.resolve(); }
						}
						break;
					}
					case "VOICE_SERVER_UPDATE": {
						const chunk = this._internal.voiceChunks[d.guild_id];
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
				this.send({ op: 1, d: this.sequence });
				break;
			}
			case 7: {
				this.emit("debug", "Discord asked us to reconnect");
				this._initReconnect();
				this._write(Buffer.from([16, 3]), 8);
				break;
			}
			case 9: {
				this.emit("debug", "Received invalid session. Waiting 1-5s before identify");
				if(data.d) {
					this._resume();
				} else {
					this.session = null;
					this.sequence = 0;
					setTimeout(() => this._identify(), Math.floor(Math.random() * 4000) + 1000);
				}
				break;
			}
			case 10: {
				const interval = data.d.heartbeat_interval;
				const timeout = Math.floor(interval * Math.random());
				this.emit("debug", `Received hello. Heartbeat interval = ${interval}ms. First heartbeat in ${timeout}ms`);
				internal.heartbeatInterval = setTimeout(() => {
					internal.lastHeartbeat = Date.now();
					this.emit("debug", "Sending heartbeat");
					this.send({ op: 1, d: this.sequence });
					internal.heartbeatInterval = setInterval(() => {
						internal.lastHeartbeat = Date.now();
						this.emit("debug", "Sending heartbeat");
						this.send({ op: 1, d: this.sequence });
					}, interval);
				}, timeout);
				if(internal.reconnectPromise) { internal.reconnectPromise.resolve(); }
				if(this.session && this.sequence) {
					this._resume();
				} else {
					this._identify();
				}
				break;
			}
			case 11: {
				this.emit("debug", "Received ACK");
				internal.lastAck = Date.now();
				internal.lastPing = internal.lastAck - internal.lastHeartbeat;
				break;
			}
		}
	}
}

function isValidProperties(obj) {
	return obj && typeof obj === "object" && ["$os", "$browser", "$device"].every(x => typeof obj[x] === "string");
}

function isValidPresence(obj) {
	if(!obj || typeof obj !== "object" || typeof obj.since === "undefined" || typeof obj.afk !== "boolean" || typeof obj.status !== "string") { return false; }
	if(!["online", "dnd", "idle", "invisible", "offline"].includes(obj.status = obj.status.toLowerCase())) { return false; }
	if(!Array.isArray(obj.activities)) { return false; }
	if(obj.activities.length && !obj.activities.every(x => typeof x.name === "string" && [0, 1, 2, 3, 4, 5].includes(x.type))) { return false; }
	return true;
}

function isValidRequest(value) {
	return value && typeof value === "object" && Number.isInteger(value.op) && typeof value.d !== "undefined";
}

function readRange(socket, index, bytes) {
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

function readETF(data, start) {
	let view;
	let x = start;
	const loop = () => {
		const type = data[x++];
		switch(type) {
			case 97: {
				return data[x++];
			}
			case 98: {
				const int = data.readInt32BE(x);
				x += 4;
				return int;
			}
			case 100: {
				const length = data.readUInt16BE(x);
				let atom = "";
				if(length > 30) {
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
			case 108: case 106: {
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
			case 107: {
				const array = [];
				const length = data.readUInt16BE(x);
				x += 2;
				for(let i = 0; i < length; i++) {
					array.push(data[x++]);
				}
				return array;
			}
			case 109: {
				const length = data.readUInt32BE(x);
				let str = "";
				if(length > 30) {
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
			case 110: {
				if(!view) { view = new DataView(data.buffer, data.offset, data.byteLength); }
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
						num += BigInt(view.getUint32(x + (left -= 4)), true);
					} else if(left >= 2) {
						num <<= 16n;
						num += BigInt(view.getUint16(x + (left -= 2)), true);
					} else {
						num <<= 8n;
						num += BigInt(data[x]);
						left--;
					}
				}
				x += length;
				return sign ? -num : num;
			}
			case 116: {
				const obj = {};
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

function writeETF(data) {
	const b = Buffer.allocUnsafe(1 << 12);
	b[0] = 131;
	let i = 1;
	const loop = (obj) => {
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

module.exports = WebsocketShard;

// in case discord ever sends fin=0 messages
/*
_onFrame(frame, bytes) {
	const socket = this._socket;
	const fin = frame[0] >> 7;
	if(fin !== 1) {
		if(!socket._frameBuffer) {
			socket._frameBuffer = [frame];
		} else {
			socket._frameBuffer.push(frame);
		}
		return;
	}
	let opcode = frame[0] & 15;
	if(opcode === 0) {
		const buffers = socket._frameBuffer;
		const payloads = [];
		socket._frameBuffer = null;
		opcode = buffers[0][0] & 15;
		for(let i = 0; i < buffers.length; i++) {
			const buffer = buffers[i];
			payloads.push(buffer.slice(bytes));
		}
		const payload = Buffer.concat(payloads);
		this._onMessage(opcode, payload);
	} else {
		const payload = frame.slice(bytes);
		this._onMessage(opcode, payload);
	}
}
*/
