/* eslint-disable no-extra-parens */
"use strict";

const { request, Agent } = require("node:https");
const { randomBytes } = require("node:crypto");
const { Readable } = require("node:stream");

class RestClient {
	/**
	 * 
	 * @param {RestClientOptions} options 
	 */
	constructor(options) {
		if(typeof options.token !== "string") { throw new Error("Invalid token"); }
		this.token = options.token;
		this.version = Number(options.version) || 10;
		this.type = typeof options.type === "string" && options.type.toLowerCase() === "bearer" ? "Bearer" : "Bot";
		this.retries = Number(options.retries) || 3;
		this.timeout = Number(options.timeout) || 10000;
		/** @private */ this._agent = new Agent({ keepAlive: true });
	}

	/**
	 * 
	 * @param {RequestOptions["path"]} path 
	 * @param {RequestOptions["options"]} options 
	 */
	get(path, options = {}) {
		return this.request({
			...options,
			path,
			method: "GET"
		});
	}

	/**
	 * 
	 * @param {RequestOptions["path"]} path 
	 * @param {RequestOptions["options"]} options 
	 */
	delete(path, options = {}) {
		return this.request({
			...options,
			path,
			method: "DELETE"
		});
	}

	/**
	 * 
	 * @param {RequestOptions["path"]} path 
	 * @param {RequestOptions["body"]} body 
	 * @param {RequestOptions["options"]} options 
	 */
	post(path, body, options = {}) {
		return this.request({
			...options,
			path,
			body,
			method: "POST"
		});
	}

	/**
	 * 
	 * @param {RequestOptions["path"]} path 
	 * @param {RequestOptions["body"]} body 
	 * @param {RequestOptions["options"]} options 
	 */
	patch(path, body, options = {}) {
		return this.request({
			...options,
			path,
			body,
			method: "PATCH"
		});
	}

	/**
	 * 
	 * @param {RequestOptions["path"]} path 
	 * @param {RequestOptions["body"]} body 
	 * @param {RequestOptions["options"]} options 
	 */
	put(path, body, options = {}) {
		return this.request({
			...options,
			path,
			body,
			method: "PUT"
		});
	}

	/**
	 * 
	 * @param {RequestOptions["path"]} path 
	 * @param {RequestOptions["options"]} options 
	 */
	cdn(path, options = {}) {
		return this.request({
			...options,
			path,
			method: "GET",
			cdn: true
		});
	}

	/**
	 * 
	 * @param {RequestOptions} options
	 */
	request({ path, method, body, headers = {}, options = {}, retries = this.retries, timeout = this.timeout, cdn = false}, _retryCount = 0) {
		let _aborted = false;
		/** @type {import("http").ClientRequest} */ let _request;
		/** @type {import("http").IncomingMessage} */ let _response;
		/** @type {(value: any) => void} */ let _resolve;
		/** @type {(reason: any) => void} */ let _reject;
		/** @type {NodeJS.Timeout} */ let _timer;
		const abort = (/** @type {Error} */ reason) => {
			if(_aborted) { return; }
			_aborted = true;
			if(_response) { _response.destroy(); }
			_request.destroy();
			clearTimeout(_timer);
			_reject(reason);
		};
		const done = (/** @type {*} */ data) => {
			if(_aborted) { return; }
			clearTimeout(_timer);
			_resolve(data);
		};
		_timer = setTimeout(() => abort(new Error("Request timed out")), timeout);
		const promise = new Promise((resolve, reject) => {
			_resolve = resolve;
			_reject = reject;
			_request = request({
				...options,
				hostname: cdn ? "cdn.discordapp.com" : "discord.com",
				port: 443,
				path: `/${cdn ? "" : `api/v${this.version}/`}${path.split("/").filter(Boolean).join("/")}`,
				method: method.toUpperCase(),
				agent: this._agent,
				headers: {
					"User-Agent": `DiscordBot (https://github.com/timotejroiko/tiny-discord, ${require("../package.json").version}) Node.js/${process.version}`,
					...headers,
					...body && typeof body === "object" && !Buffer.isBuffer(body) && { "Content-Type": "application/json" },
					"Authorization": `${this.type} ${this.token}`
				}
			});
			_request.once("error", (/** @type {Error & { code: string }} */ err) => {
				if(_request.reusedSocket && err.code === "ECONNRESET" && _retryCount < retries) {
					if(_aborted) { return; }
					done(this.request({ path, method, body, retries, timeout }, _retryCount + 1));
				} else {
					abort(err);
				}
			});
			_request.once("response", res => {
				_response = res;
				res.once("aborted", () => {
					abort(new Error("Received abort event"));
				});
				res.on("error", err => {
					abort(err);
				});
				const data = /** @type {Buffer[]} */ ([]);
				res.on("data", (/** @type {Buffer} */ d) => data.push(d));
				res.once("end", () => {
					if(!res.complete) {
						return abort(new Error("Received incomplete message"));
					}
					const body = Buffer.concat(data);
					done({
						status: res.statusCode,
						headers: res.headers,
						body: {
							buffer: body,
							get json() { return JSON.parse(this.text); },
							get text() { return this.buffer.toString(); }
						}
					});
				});
			});
			if(body) {
				if(Buffer.isBuffer(body)) {
					_request.write(body);
					_request.end();
				} else if(Array.isArray(body.files)) {
					const files = body.files;
					const boundary = randomBytes(16).toString("base64");
					const writer = async () => {
						_request.setHeader("Content-Type", `multipart/form-data; boundary=${boundary}`);
						for(let i = 0; i < files.length; i++) {
							const file = files[i];
							if(!file || typeof file !== "object" || !file.name || !file.data) { throw new Error("Invalid file object"); }
							const type = typeof file.type === "string" ? `\r\nContent-Type: ${file.type}` : "";
							_request.write(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="files[${i}]"; filename="${file.name}"${type}\r\n\r\n`);
							if(file.data instanceof Readable && file.data.readable) {
								for await(const chunk of file.data) {
									_request.write(chunk);
								}
							} else {
								_request.write(file.data);
							}
						}
						if(body.payload_json) {
							const json = JSON.stringify(body.payload_json);
							_request.write(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\nContent-Type: application/json\r\n\r\n${json}`);
						} else {
							delete body.files;
							for(const entry of Object.entries(body)) {
								_request.write(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="${entry[0]}"\r\n\r\n${entry[1].toString()}`);
							}
						}
						_request.write(`\r\n--${boundary}--`);
						_request.end();
					};
					writer().catch(e => abort(e));
				} else {
					const data = JSON.stringify(body);
					_request.write(data);
					_request.end();
				}
			} else {
				_request.end();
			}
		});
		const p = /** @type {AbortablePromise<RequestResult>} */ (promise);
		p.abort = reason => abort(new Error(`Aborted by user: ${reason || "no reason provided"}`));
		return p;
	}
}

module.exports = RestClient;

/**
 * @typedef {{
 * 		token: string,
 * 		version?: number,
 * 		type?: "bot" | "bearer",
 * 		retries?: number,
 * 		timeout?: number
 * }} RestClientOptions
 */

/**
 * @typedef {{
 * 		path: string,
 * 		method: string,
 * 		body?: { [key: string]: any, files?: FileObject[] } | Buffer,
 * 		headers?: import("http").OutgoingHttpHeaders,
 * 		options?: import("https").RequestOptions,
 * 		retries?: number,
 * 		timeout?: number,
 * 		cdn?: boolean
 * }} RequestOptions
 */

/**
 * @typedef {{
 * 		name: string,
 * 		data: Buffer | Readable,
 * 		type?: string 
 * }} FileObject
 */

/**
 * @typedef {{
 * 		status: import("http").IncomingMessage["statusCode"],
 * 		headers: import("http").IncomingHttpHeaders,
 * 		body: {
 * 			buffer: Buffer,
 * 			readonly text: string,
 * 			readonly json: any
 * 		}
 * }} RequestResult
 */

/**
 * @template T
 * @typedef {Promise<T> & { abort: (reason: string) => void }} AbortablePromise
 */
