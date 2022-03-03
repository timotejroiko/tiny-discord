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
		if(typeof options.options.identifyHook !== "function") {
			const concurrency = Number.isInteger(options.concurrency) ? options.concurrency : 1;
			const timeout = Number.isInteger(options.timeout) ? options.timeout : 5500;
			const bucket = Array(concurrency).fill(0);
			this.options.identifyHook = function(id) {
				const now = Date.now();
				const bucketID = id % concurrency;
				const current = bucket[bucketID];
				if (current > now) {
					return { time: current - now, ask: true };
				}
				bucket[bucketID] = now + timeout;
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
				const options = Object.assign(this.options, this.shardOptions[id] || {});
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
