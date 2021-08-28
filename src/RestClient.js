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
	request({ path, method, body, headers = {}, options = {}, retries = this.retries, timeout = this.timeout, _retries = 0 }) {
		let abort;
		const promise = new Promise((resolve, reject) => {
			const req = request({
				...options,
				hostname: "discord.com",
				port: 443,
				path: `/api/v${this.version}/${path.split("/").filter(Boolean).join("/")}`,
				method: method.toUpperCase(),
				agent: this._agent,
				headers: {
					"User-Agent": `DiscordBot (https://github.com/timotejroiko/tiny-discord, ${require("./package.json").version}) Node.js/${process.version}`,
					...headers,
					"Content-Type": "application/json",
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
				let data = "";
				res.setEncoding("utf8");
				res.on("data", d => { data += d; });
				res.once("end", () => {
					if(res.aborted || !res.complete) {
						if(aborted) { return; }
						return abort(new Error("Received incomplete message"));
					}
					if(res.headers["content-type"] === "application/json") {
						try {
							const json = JSON.parse(data);
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
							body: data
						});
					}
				});
			});
			if(body) {
				let files = body.file || body.files;
				if(files) {
					delete body.file;
					delete body.files;
					if(!Array.isArray(files)) { files = [files]; }
					const boundary = randomBytes(16).toString("base64");
					const writer = async () => {
						req.setHeader("Content-Type", `multipart/form-data; boundary=${boundary}`);
						for(const file of files) {
							if(!file || typeof file !== "object" || !file.name || !file.data) { throw new Error("Invalid file object"); }
							req.write(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.name}"\r\n\r\n`);
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
							req.write(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\n\r\n${json}`);
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
