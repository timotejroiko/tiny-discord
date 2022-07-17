/* eslint-disable no-extra-parens */
"use strict";

const RestClient = require("./RestClient");

class IdentifyController {
	/**
	 * @param {IdentifyControllerOptions} options
	 */
	constructor(options) {
		if(!options || typeof options !== "object") { throw new Error("Invalid options"); }
		const { token, shards = 0, rest, shardDelay = 5500, refreshDelay = 600000 } = options;
		if(rest instanceof RestClient) {
			this.rest = rest;
		} else {
			this.rest = new RestClient({ ...typeof rest === "object" && rest, token });
		}
		this.url = "";
		this.shards = shards;
		this.shardDelay = shardDelay;
		this.refreshDelay = refreshDelay;
		this.lastRefresh = 0;
		/** @type {SessionLimitsData} */ this.sessions;
		/** @private */ this._resetPromise = null;
		/** @private */ this._fetchPromise = null;
		/** @private */ this._bucket = [0];
	}

	get nextReset() {
		return this.lastRefresh + (this.sessions?.reset_after || 0);
	}

	get nextRefresh() {
		const delay = this.refreshDelay;
		const next = this.lastRefresh + delay;
		const reset = this.nextReset;
		if(reset < next) {
			return reset;
		}
		if(reset < next + delay / 2) {
			return reset;
		}
		return next;
	}

	async getGateway() {
		if(!this.sessions) {
			const session = await this.fetchGateway();
			if(!this.sessions) {
				if(!Number.isInteger(this.shards) || this.shards === 0) {
					this.shards = session.shards;
				}
				this.url = session.url;
				this.sessions = session.session_start_limit;
				this._bucket = Array(session.session_start_limit.max_concurrency).fill(0);
			}
		}
		const now = Date.now();
		if(now > this.nextRefresh) {
			await this.refreshSessionLimits();
		}
		return this;
	}

	/**
	 * 
	 * @param {number} id 
	 * @param {boolean} wait 
	 * @returns {Promise<RequestIdentifyResult>}
	 */
	async requestIdentify(id, wait = false) {
		if(!Number.isInteger(id) || id < 0 || id > this.shards) { throw new Error(`invalid shard id: ${id}`); }
		const gateway = await this.getGateway();
		const sessions = gateway.sessions;
		if(sessions.remaining <= 0) {
			const retry = this.nextReset - Date.now();
			if(!this._resetPromise) {
				this._resetPromise = new Promise(resolve => {
					setTimeout(resolve, retry);
				});
			}
			if(wait) {
				await this._resetPromise;
				return this.requestIdentify(id, true);
			} else {
				return {
					canIdentify: false,
					retryAfter: retry
				};
			}
		}
		const bucketID = id % sessions.max_concurrency;
		const current = this._bucket[bucketID];
		const n = Date.now();
		if(current > n) {
			if(wait) {
				await new Promise(resolve => {
					setTimeout(resolve, current - n);
				});
				return this.requestIdentify(id, true);
			} else {
				return {
					canIdentify: false,
					retryAfter: current - n
				};
			}
		}
		sessions.remaining--;
		this._bucket[bucketID] = n + this.shardDelay;
		return { canIdentify: true };
	}

	/**
	 * 
	 * @param {SessionLimitsData=} session
	 */
	async refreshSessionLimits(session) {
		if(session) {
			if(typeof session !== "object" || !Object.values(session).every(Number.isInteger)) { throw new Error("invalid session object"); }
			this.sessions = session;
			this.lastRefresh = Date.now();
		} else {
			const prev = this.lastRefresh;
			const gateway = await this.fetchGateway();
			if(this.lastRefresh === prev) {
				if(this.sessions.max_concurrency !== gateway.session_start_limit.max_concurrency) {
					this._bucket = Array(gateway.session_start_limit.max_concurrency).fill(0);
				}
				this.sessions = gateway.session_start_limit;
				this.lastRefresh = Date.now();
			}
		}
	}

	/**
	 * 
	 * @returns {Promise<GatewayData>}
	 */
	fetchGateway() {
		if(this._fetchPromise) {
			return this._fetchPromise;
		}
		this._fetchPromise = this.rest.get("/gateway/bot").then(result => {
			this._fetchPromise = null;
			if(result.status === 200 && result.body.json.session_start_limit) {
				return result.body.json;
			}
			throw new Error(`status: ${result.status}, body: ${result.body.text}`);
		});
		return this._fetchPromise;
	}
}

module.exports = IdentifyController;

/**
 * @typedef {{
 * 		token: string,
 * 		shards?: number,
 * 		rest?: RestClient | Omit<RestClient.RestClientOptions, "token" | "type">,
 * 		shardDelay?: number,
 * 		refreshDelay?: number
 * }} IdentifyControllerOptions
 */

/**
 * @typedef {{ 
 * 		total: number,
 * 		remaining: number,
 * 		reset_after: number,
 * 		max_concurrency: number
 * }} SessionLimitsData
 */

/**
 * @typedef {{ 
 * 		shards: number,
 * 		url: string,
 * 		session_start_limit: SessionLimitsData
 * }} GatewayData
 */

/**
 * @typedef {{
 * 		canIdentify: boolean,
 * 		retryAfter?: number
 * }} RequestIdentifyResult
 */
