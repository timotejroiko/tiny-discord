"use strict";

const features = [
	"ANIMATED_ICON",
	"BANNER",
	"COMMERCE",
	"COMMUNITY",
	"DISCOVERABLE",
	"FEATURABLE",
	"INVITE_SPLASH",
	"MEMBER_VERIFICATION_GATE_ENABLED",
	"NEWS",
	"PARTNERED",
	"PREVIEW_ENABLED",
	"VANITY_URL",
	"VERIFIED",
	"VIP_REGIONS",
	"WELCOME_SCREEN_ENABLED",
	"TICKETED_EVENTS_ENABLED",
	"MONETIZATION_ENABLED",
	"MORE_STICKERS",
	"THREE_DAY_THREAD_ARCHIVE",
	"SEVEN_DAY_THREAD_ARCHIVE",
	"PRIVATE_THREADS"
];

class DoubleMap extends Map {
	get(id1, id2) {
		return super.get((id1 << 64n) + id2);
	}
	set(id1, id2, val) {
		return super.set((id1 << 64n) + id2, val);
	}
	has(id1, id2) {
		return super.has((id1 << 64n) + id2);
	}
	delete(id1, id2) {
		return super.delete((id1 << 64n) + id2);
	}
	keys() {
		const iterator = super.keys();
		return {
			[Symbol.iterator]: function() {
				return {
					next: function() {
						const val = iterator.next();
						if(!val.done) { val.value = [val.value >> 64n, val.value & ((1n << 64n) - 1n)]; }
						return val;
					}
				};
			}
		};
	}
	entries() {
		const iterator = super.entries();
		return {
			[Symbol.iterator]: function() {
				return {
					next: function() {
						const val = iterator.next();
						if(!val.done) { val.value = [[val.value[0] >> 64n, val.value[0] & ((1n << 64n) - 1n)], val.value[1]]; }
						return val;
					}
				};
			}
		};
	}
	_get(id) {
		return super.get(id);
	}
	_set(id, val) {
		return super.set(id, val);
	}
	_has(id) {
		return super.has(id);
	}
	_delete(id) {
		return super.delete(id);
	}
	_keys() {
		return super.keys();
	}
	_entries() {
		return super.entries();
	}
}

class Cache {
	constructor(structure = {}) {
		if(!structure || typeof structure !== "object") { throw new Error("Invalid structure"); }
		if(structure.guilds) { this.guilds = new Map(); }
		if(structure.channels) { this.channels = new Map(); }
		if(structure.users) { this.users = new Map(); }
		if(structure.members) { this.members = new DoubleMap(); }
		if(structure.roles) { this.roles = new Map(); }
		if(structure.overwrites) { this.overwrites = new DoubleMap(); }
		if(structure.emojis) { this.emojis = new Map(); }
		if(structure.stickers) { this.stickers = new Map(); }
		if(structure.commands) { this.commands = new Map(); }
		if(structure.integations) { this.integations = new Map(); }
		if(structure.invites) { this.invites = new Map(); }
		if(structure.messages) { this.messages = new Map(); }
		if(structure.stages) { this.stages = new Map(); }
		this._structure = structure;
		this.FEATURES = features;
	}
	processData(event, data) {
		const changes = [];
		switch(event) {
			case "APPLICATION_COMMAND_CREATE": case "APPLICATION_COMMAND_UPDATE": {
				if(this.commands) {
					this._processCache("commands", BigInt(data.id), data, changes);
				}
				break;
			}
			case "APPLICATION_COMMAND_DELETE": {
				if(this.commands) {
					const id = BigInt(data.id);
					const existing = this.commands.get(id);
					if(existing) {
						changes.push({
							cache: "commands",
							data: existing
						});
						this.commands.delete(id);
					}
				}
				break;
			}
			case "CHANNEL_CREATE": case "CHANNEL_UPDATE": case "THREAD_CREATE": case "THREAD_UPDATE": {
				const overwrites = data.permission_overwrites;
				const recipients = data.recipients;
				if(this.channels) {
					if(overwrites) {
						data.permission_overwrites = overwrites.map(x => BigInt(x.id));
					}
					if(recipients) {
						data.recipients = recipients.map(x => BigInt(x.id));
					}
					this._processCache("channels", BigInt(data.id), data, changes);
				}
				if(overwrites && this.overwrites) {
					const upper = BigInt(data.id) << 64n;
					for(const overwrite of overwrites) {
						this._processCache("overwrites", upper + BigInt(overwrite.id), overwrite, changes);
					}
				}
				if(recipients && this.users) {
					for(const user of recipients) {
						this._processCache("users", BigInt(user.id), user, changes);
					}
				}
				break;
			}
			case "CHANNEL_DELETE": case "THREAD_DELETE": {
				if(this.channels) {
					const id = BigInt(data.id);
					const existing = this.channels.get(id);
					if(existing) {
						changes.push({
							cache: "channels",
							data: existing
						});
						this.channels.delete(id);
					}
				}
				const overwrites = data.permission_overwrites;
				if(overwrites && this.overwrites) {
					const upper = BigInt(data.id) << 64n;
					for(const overwrite of overwrites) {
						const xid = upper + BigInt(overwrite.id);
						const existing = this.overwrites.get(xid);
						if(existing) {
							changes.push({
								cache: "overwrites",
								data: existing
							});
							this.overwrites.delete(xid);
						}
					}
				}
				break;
			}
			case "CHANNEL_PINS_UPDATE": {
				if(this.channels) {
					this._processCache("channels", BigInt(data.id), { last_pin_timestamp: data.last_pin_timestamp }, changes);
				}
				break;
			}
		}
		return changes;
	}
	_processCache(store, id, data, changes) {
		const cache = this[store];
		const structure = this._structure[store];
		let existing = cache.get(id);
		if(!existing) {
			existing = {};
			cache.set(id, existing);
			if(structure._limit && cache.size > structure._limit) {
				const first = cache.entries().next();
				cache.delete(first[0]);
			}
		}
		const loop = (obj, target, struct) => {
			let changelog = null;
			for(const key of Object.keys(obj)) {
				if(struct && (struct === true || struct[key])) {
					let value = obj[key];
					if(typeof value === "string") {
						if(key.includes("id") && !isNaN(value)) { value = BigInt(value); }
						else if(["permissions", "allow", "deny"].includes(key) && !isNaN(value)) { value = Number(value); }
						else if(["icon", "splash", "avatar"].some(x => key.includes(x)) && !isNaN(`0x${value}`)) { value = BigInt(`0x${value}`); }
						else if(["timestamp", "_at"].some(x => key.includes(x)) && Date.parse(value)) { value = Date.parse(value); }
					} else if(Array.isArray(value) && value.length) {
						if(typeof value[0] === "string") {
							if(value[0].length > 15 && !isNaN(value[0])) {
								value = value.map(v => BigInt(v));
								const prev = target[key];
								if(typeof prev !== "undefined" && value.join("") !== prev.join("")) {
									if(!changelog) { changelog = {}; }
									changelog[key] = prev;
								}
								target[key] = value;
								continue;
							}
							else if(key === "features") {
								value = value.reduce((a, t) => a + (1 << this.FEATURES.indexOf(t)), 0);
							}
						} else if(value[0] && typeof value[0] === "object") {
							const prop = [];
							for(let i = 0; i < value.length; i++) {
								const item = {};
								const substruct = struct && typeof struct === "object" ? struct[key] : struct;
								prop[i] = item;
								loop(value[i], item, substruct);
							}
							const prev = target[key];
							if(typeof prev !== "undefined" && JSON.stringify(prev) !== JSON.stringify(prop)) {
								if(!changelog) { changelog = {}; }
								changelog[key] = prev;
							}
							target[key] = prop;
							continue;
						}
					} else if(value && typeof value === "object") {
						let prev = target[key];
						if(!prev || typeof prev !== "object") { prev = target[key] = {}; }
						const substruct = struct && typeof struct === "object" ? struct[key] : struct;
						const log = loop(value, prev, substruct);
						if(log) {
							if(!changelog) { changelog = {}; }
							changelog[key] = log;
						}
						continue;
					}
					const prev = target[key];
					if(typeof prev !== "undefined" && prev !== value) {
						if(!changelog) { changelog = {}; }
						changelog[key] = prev;
					}
					target[key] = value;
				}
			}
			return changelog;
		};
		const log = loop(data, existing, structure);
		if(log) {
			changes.push({
				cache: store,
				data: log
			});
		}
	}
}

module.exports = Cache;
