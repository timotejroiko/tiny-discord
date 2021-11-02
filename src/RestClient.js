"use strict";

const { request, Agent } = require("https");
const { randomBytes } = require("crypto");
const { Readable } = require("stream");

class RestClient {
	constructor(options) {
		if(typeof options.token !== "string") { throw new Error("Invalid token"); }
		this.token = options.token;
		this.version = Number(options.version) || 9;
		this.type = typeof options.type === "string" && options.type.toLowerCase() === "bearer" ? "Bearer" : "Bot";
		this.retries = Number(options.retries) || 3;
		this.timeout = Number(options.timeout) || 10000;
		this._agent = new Agent({ keepAlive: true });
	}
	get(path, options = {}) {
		return this.request({
			...options,
			path,
			method: "GET"
		});
	}
	delete(path, options = {}) {
		return this.request({
			...options,
			path,
			method: "DELETE"
		});
	}
	post(path, body, options = {}) {
		return this.request({
			...options,
			path,
			body,
			method: "POST"
		});
	}
	patch(path, body, options = {}) {
		return this.request({
			...options,
			path,
			body,
			method: "PATCH"
		});
	}
	put(path, body, options = {}) {
		return this.request({
			...options,
			path,
			body,
			method: "PUT"
		});
	}
	cdn(path, options = {}) {
		return this.request({
			...options,
			path,
			method: "GET",
			cdn: true
		});
	}
	request({ path, method, body, headers = {}, options = {}, retries = this.retries, timeout = this.timeout, _retries = 0, cdn = false }) {
		let abort;
		const promise = new Promise((resolve, reject) => {
			const req = request({
				...options,
				hostname: cdn ? "cdn.discordapp.com" : "discord.com",
				port: 443,
				path: `/${cdn ? "" : `api/v${this.version}/`}${path.split("/").filter(Boolean).join("/")}`,
				method: method.toUpperCase(),
				agent: this._agent,
				headers: {
					"User-Agent": `DiscordBot (https://github.com/timotejroiko/tiny-discord, ${require("../package.json").version}) Node.js/${process.version}`,
					...headers,
					...body && { "Content-Type": "application/json" },
					"Authorization": `${this.type} ${this.token}`
				}
			});
			let aborted = false;
			let response;
			let timer;
			abort = reason => {
				if(aborted) { return; }
				aborted = true;
				if(response) { response.destroy(); }
				req.destroy();
				clearTimeout(timer);
				reject(reason);
			};
			const done = data => {
				if(aborted) { return; }
				clearTimeout(timer);
				resolve(data);
			};
			timer = setTimeout(() => abort(new Error("Request timed out")), timeout);
			req.once("error", err => {
				if(aborted) { return; }
				if(req.reusedSocket && err.code === "ECONNRESET" && _retries < retries) {
					done(this._request({ path, method, body, retries, timeout, _retries: _retries + 1 }));
				} else {
					abort(err);
				}
			});
			req.once("response", res => {
				response = res;
				res.once("aborted", () => {
					if(aborted) { return; }
					abort(new Error("Received abort event"));
				});
				res.on("error", err => {
					if(aborted) { return; }
					abort(err);
				});
				const data = [];
				res.on("data", d => data.push(d));
				res.once("end", () => {
					if(res.aborted || !res.complete) {
						if(aborted) { return; }
						return abort(new Error("Received incomplete message"));
					}
					const type = res.headers["content-type"];
					const body = Buffer.concat(data);
					if(type === "application/json") {
						try {
							const json = JSON.parse(body.toString());
							done({
								status: res.statusCode,
								headers: res.headers,
								body: json
							});
						} catch(e) {
							abort(new Error("Received malformed json response"));
						}
					} else {
						done({
							status: res.statusCode,
							headers: res.headers,
							body: type.startsWith("text") ? body.toString() : body
						});
					}
				});
			});
			if(body) {
				const files = body.files;
				if(Array.isArray(files)) {
					const boundary = randomBytes(16).toString("base64");
					const writer = async () => {
						req.setHeader("Content-Type", `multipart/form-data; boundary=${boundary}`);
						for(let i = 0; i < files.length; i++) {
							const file = files[i];
							if(!file || typeof file !== "object" || !file.name || !file.data) { throw new Error("Invalid file object"); }
							const type = typeof file.type === "string" ? `\r\nContent-Type: ${file.type}` : "";
							req.write(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="files[${i}]"; filename="${file.name}"${type}\r\n\r\n`);
							if(file.data instanceof Readable) {
								for await(const chunk of file.data) {
									req.write(chunk);
								}
							} else {
								req.write(file.data);
							}
						}
						if(body.payload_json) {
							const json = JSON.stringify(body.payload_json);
							req.write(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\nContent-Type: application/json\r\n\r\n${json}`);
						} else {
							for(const entry of Object.entries(body)) {
								req.write(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="${entry[0]}"\r\n\r\n${entry[1].toString()}`);
							}
						}
						req.write(`\r\n--${boundary}--`);
						req.end();
					};
					writer().catch(e => abort(e));
				} else {
					const data = JSON.stringify(body);
					req.write(data);
					req.end();
				}
			} else {
				req.end();
			}
		});
		promise.abort = reason => abort(new Error(`Aborted by user: ${reason || "no reason provided"}`));
		return promise;
	}
}

module.exports = RestClient;
