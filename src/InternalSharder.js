"use strict";

const { EventEmitter } = require("events");
const WebsocketShard = require("./WebsocketShard");

class InternalSharder extends EventEmitter {
	constructor(options) {
		if(!options || typeof options !== "object") { throw new Error("Invalid options"); }
		if(!options.options) { options.options = {}; }
		if(typeof options.options.token !== "string") { throw new Error("Invalid token"); }
		if(!Number.isInteger(options.options.intents)) { throw new Error("Invalid intents"); }
		super();
		this.options = {
			token: options.options.token,
			intents: options.options.intents,
			large_threshold: options.options.large_threshold,
			presence: options.options.presence,
			properties: options.options.properties,
			version: options.options.version,
			encoding: options.options.encoding,
			compression: options.options.compression,
			url: options.options.url
		};
		this.shardOptions = options.shardOptions && typeof options.shardOptions === "object" ? options.shardOptions : {};
		if(Array.isArray(options.ids)) {
			this.total = Number.isInteger(options.total) ? options.total : options.ids.length;
			this.ids = options.ids;
		} else {
			if(!Number.isInteger(options.total)) { throw new Error("Invalid shard ids and/or total shards"); }
			this.total = options.total;
			this.ids = Array(options.total).fill().map((_, i) => i);
		}
		this.shards = new Map();
		this.controller = null;
		if(typeof options.options.identifyHook !== "function") {
			if(!options.session_start_limit || typeof options.session_start_limit !== "object") {
				throw new Error("Missing session_start_limit");
			}
			this.controller = {
				concurrency: options.session_start_limit.max_concurrency,
				total: options.session_start_limit.total,
				remaining: options.session_start_limit.remaining,
				resetTimestamp: Date.now() + (options.session_start_limit.reset_after || 86400000),
				timeout: Number.isInteger(options.timeout) ? options.timeout : 5500,
				_bucket: Array(options.session_start_limit.max_concurrency).fill(0),
				_timer: null,
				_resetTimer: () => {
					this.controller._timer = setTimeout(() => {
						this.controller.remaining = this.controller.total;
						this.controller.resetTimestamp += 86400000;
						this.controller._resetTimer();
						this.emit("debug", `[InternalSharder] Daily session limit has been reset. Sessions remaining: ${this.controller.remaining}`);
					}, this.controller.resetTimestamp - Date.now());
				}
			};
			this.options.identifyHook = id => {
				if(!this.controller._timer) {
					this.controller._resetTimer();
				}
				const now = Date.now();
				if(this.controller.remaining <= 0) {
					this.emit("debug", `[InternalSharder] Daily session limit reached on shard ${id}. Waiting ${this.controller.resetTimestamp - now} ms for reset`);
					return { time: this.controller.resetTimestamp - now, ask: true };
				}
				const bucketID = id % this.controller.concurrency;
				const current = this.controller._bucket[bucketID];
				if (current > now) {
					return { time: current - now, ask: true };
				}
				this.controller._bucket[bucketID] = now + this.controller.timeout;
				this.controller.remaining--;
				this.emit("debug", `[InternalSharder] Identify permission granted for shard ${id}. Sessions remaining: ${this.controller.remaining}`);
				return { time: 0, ask: true };
			};
		}
	}
	getAveragePing() {
		let ping = 0;
		for(const shard of this.shards.values()) {
			ping += shard.lastPing;
		}
		return ping / this.shards.size;
	}
	getCurrentSessions() {
		const sessions = {};
		for(const shard of this.shards.values()) {
			sessions[shard.id] = {
				session: shard.session,
				sequence: shard.sequence
			};
		}
		return sessions;
	}
	connect() {
		const promises = [];
		for(const id of this.ids) {
			let shard = this.shards.get(id);
			if(!shard) {
				const options = Object.assign({}, this.options, this.shardOptions[id] || {});
				shard = new WebsocketShard(Object.assign({
					id: id,
					total: this.total
				}, options));
				shard.on("ready", data => this.emit("ready", data, id));
				shard.on("resumed", data => this.emit("resumed", data, id));
				shard.on("debug", msg => this.emit("debug", `[Shard ${id}] ${msg}`));
				shard.on("close", error => {
					this.emit("error", error);
					if(shard.session && shard.sequence) {
						shard.connect().then(() => this.emit("connect", id)).catch(e => {
							this.emit("error", e);
							this._identify(id);
						});
					} else {
						this._identify(id);
					}
				});
				shard.on("event", data => {
					this.emit("event", data, id);
					this.emit(data.t, data.d, id);
				});
				this.shards.set(id, shard);
			}
			promises.push(shard.connect());
		}
		return Promise.all(promises).then(() => void 0);
	}
	close() {
		clearTimeout(this.controller._timer);
		const promises = [];
		for(const id of this.ids) {
			const shard = this.shards.get(id);
			shard.removeAllListeners();
			promises.push(shard.close());
		}
		return Promise.all(promises).then(() => void 0);
	}
}

module.exports = InternalSharder;
