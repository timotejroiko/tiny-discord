"use strict";

const { EventEmitter } = require("events");
const WebsocketShard = require("./WebsocketShard");
const IdentifyController = require("./IdentifyController");

class InternalSharder extends EventEmitter {
	constructor(options) {
		if(!options || typeof options !== "object") { throw new Error("Invalid options"); }
		if(typeof options.token !== "string") { throw new Error("Invalid token"); }
		if(!Number.isInteger(options.intents)) { throw new Error("Invalid intents"); }
		super();
		if("ids" in options) {
			if(!Array.isArray(options.ids)) { throw new Error("Invalid shard ids"); }
			this.total = "total" in options && Number.isInteger(options.total) ? options.total : options.ids.length;
			this.ids = options.ids;
		} else {
			if(!Number.isInteger(options.total)) { throw new Error("Invalid total shards"); }
			this.total = options.total;
			this.ids = Array(options.total).fill(void 0).map((_, i) => i);
		}
		/** @type {Omit<WebsocketShard.WebsocketShardOptions, "session" | "sequence" | "id" | "total">} */ this.shardOptions = {
			token: options.token,
			intents: options.intents,
			...typeof options.options === "object" && options.options,
		};
		this.shardOverrides = typeof options.overrides === "object" && options.overrides || {};
		/** @type {Map<number, WebsocketShard>} */ this.shards = new Map();
		if(typeof options.controller === "function") {
			this.shardOptions.identifyHook = options.controller;
			this.controller = null;
		} else if(options.controller instanceof IdentifyController) {
			this.controller = options.controller;
			this.shardOptions.identifyHook = this.controller.requestIdentify.bind(this.controller);
		} else {
			this.controller = new IdentifyController({
				token: this.shardOptions.token,
				shards: this.total,
				...typeof options.controller === "object" && options.controller
			});
			this.shardOptions.identifyHook = this.controller.requestIdentify.bind(this.controller);
			/** @private */ this._ownController = true;
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
				const options = {
					id,
					total: this.total,
					...this.shardOptions,
					...this.shardOverrides[id]
				};
				shard = new WebsocketShard(options);
				shard.on("ready", data => this.emit("ready", data, id));
				shard.on("resumed", data => this.emit("resumed", data, id));
				shard.on("debug", msg => this.emit("debug", msg, id));
				shard.on("close", e => this.emit("close", e, id));
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
	/** @type {Promise<void>[]} */ 	const promises = [];
		for(const id of this.ids) {
			const shard = this.shards.get(id);
			if(shard) {
				shard.removeAllListeners();
				promises.push(shard.close());
			}
		}
		return Promise.all(promises).then(() => void 0);
	}
}

module.exports = InternalSharder;
