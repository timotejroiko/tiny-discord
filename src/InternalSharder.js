"use strict";

const { EventEmitter } = require("events");
const WebsocketShard = require("./WebsocketShard");
const IdentifyController = require("./IdentifyController");

class InternalSharder extends EventEmitter {
	/**
	 *
	 * @param {InternalSharderOptions} options 
	 */
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

		/**
		 * @type {(
		 * 		((event: "event", callback: (data: WebsocketShard.ShardEvent, shard: number) => void) => this) &
		 * 		((event: "debug", callback: (data: string, shard: number) => void) => this) &
		 * 		((event: "close", callback: (data: Error | undefined, shard: number) => void) => this) &
		 * 		((event: "ready", callback: (data: WebsocketShard.ShardReady, shard: number) => void) => this) &
		 * 		((event: "resumed", callback: (data: WebsocketShard.ShardResumed, shard: number) => void) => this) &
		 * 		((event: ShardEvents, callback: (data: Record<string, any>, shard: number) => void) => this)
		 * )}
		 */
		this.on;
	}
	getAveragePing() {
		let ping = 0;
		for(const shard of this.shards.values()) {
			ping += shard.lastPing;
		}
		return ping / this.shards.size;
	}
	getCurrentSessions() {
		/** @type {Record<string, { session: string?, sequence: number }>} */ const sessions = {};
		for(const shard of this.shards.values()) {
			sessions[shard.id] = {
				session: shard.session,
				sequence: shard.sequence
			};
		}
		return sessions;
	}
	connect() {
		/** @type {Promise<void>[]} */ const promises = [];
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

/**
 * @typedef {{
 * 		total?: number,
 * 		ids?: number[],
 * 		token: string,
 * 		intents: number,
 * 		options?: Omit<WebsocketShard.WebsocketShardOptions, "token" | "intents" | "session" | "sequence" | "id" | "total" | "identifyHook">,
 * 		overrides?: Record<number, Omit<WebsocketShard.WebsocketShardOptions, "token" | "intents" | "id" | "total" | "identifyHook">>
 * 		controller?: WebsocketShard.WebsocketShardOptions["identifyHook"] | IdentifyController | Omit<IdentifyController.IdentifyControllerOptions, "token" | "shards">
 * }} InternalSharderOptions
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
