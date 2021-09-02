"use strict";

const { EventEmitter } = require("events");
const WebsocketShard = require("./WebsocketShard");

class InternalSharder extends EventEmitter {
	constructor(options) {
		if(!options || typeof options !== "object") { throw new Error("Invalid options"); }
		if(typeof options.token !== "string") { throw new Error("Invalid token"); }
		if(!Number.isInteger(options.intents)) { throw new Error("Invalid intents"); }
		if(!options.options) { options.options = {}; }
		super();
		this.options = {
			token: options.token,
			intents: options.intents,
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
		if(typeof options.identifyHook === "function") {
			this._identify = id => {
				Promise.resolve(options.identifyHook(id)).then(response => {
					if(!response) { return Promise.reject(new Error("Invalid response from identifyHook")); }
					if(response.time > 0) {
						setTimeout(() => {
							if(response.ask) {
								this._identify(id);
							} else {
								this.shards.get(id).connect().then(() => this.emit("connect", id)).catch(e => {
									this.emit("error", e);
									this._identify(id);
								});
							}
						}, response.time);
					} else {
						this.shards.get(id).connect().then(() => this.emit("connect", id)).catch(e => {
							this.emit("error", e);
							this._identify(id);
						});
					}
				}).catch(e => {
					this.emit("error", e);
					setTimeout(() => this._identify(id), 5000);
				});
			};
		} else {
			const concurrency = Number(options.concurrency) || 1;
			const time = Number(options.identifyTimeout) || 5500;
			let count = 0;
			let lastIdentify = 0;
			this._identify = id => {
				const now = Date.now();
				if(lastIdentify > now - time && ++count % concurrency === 0) {
					setTimeout(() => this._identify(id), lastIdentify + time - now);
					return;
				}
				lastIdentify = now;
				this.shards.get(id).connect().then(() => this.emit("connect", id)).catch(e => {
					this.emit("error", e);
					this._identify(id);
				});
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
		for(const id of this.ids) {
			let shard = this.shards.get(id);
			if(!shard) {
				const options = Object.assign(this.options, this.shardOptions[id] || {});
				shard = new WebsocketShard(Object.assign({
					id: id,
					total: this.total
				}, options));
				this.shards.set(id, shard);
			}
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
			if(shard.session && shard.sequence) {
				shard.connect().then(() => this.emit("connect", id)).catch(e => {
					this.emit("error", e);
					this._identify(id);
				});
			} else {
				this._identify(id);
			}
		}
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
