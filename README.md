# Tiny Discord

Basic components for interacting with the Discord API with zero dependencies.

The goal of this project is to offer a basic platform for building high-efficiency bots and libraries in NodeJS. Its base components are plug and play standalone files fully written with core NodeJS modules without a single third-party dependency.

Tests and contributions are welcome.

## To Do

- [x] Rest Client
- [x] Interaction Server
- [x] Shard Websocket
- [ ] Voice Websocket?
- [ ] Basic Caching (wip)
- [x] Basic types
- [ ] Internal Sharder
- [ ] External Sharder?
- [ ] Ratelimit Manager?
- [ ] Docs
- [ ] Benchmarks

Not everyting in this list is guaranteed to be done. items in questionmarks are ideas and possibilities but not a priority and not necessarily something that will be part of this project.

## Base Components

These components are fully stand alone files with no external dependencies

### Class RestClient

A simple client for interacting with the discord rest API.

Supports all JSON endpoints, file uploading with multipart/form-data, bot and bearer tokens, however, it does not support the full oauth2 flow nor urlencoded endpoints.

Rate limits are not accounted for, instead they are returned to the user through the headers field.

Non-200 status codes are returned normally along with headers and body if available, only network errors are thrown.

#### RestClient Examples

Sending a simple message:

```js
const { RestClient } = require("tiny-discord");

const rest = new RestClient({
  token: "uvuvwevwevwe.onyetenyevwe.ugwemubwem.ossas",
});

rest.request({
  path: `/channels/999999999999999999/messages`,
  method: "POST",
  body: {
    content: "hello world"
  }
}).then(result => {
    console.log(result.status, result.headers, result.body);
}).catch(console.error);
```

Sending a message with multiple embeds and images:

```js
const { RestClient } = require("tiny-discord");
const { readFileSync, createReadStream } = require("fs");

const rest = new RestClient({
  token: "uvuvwevwevwe.onyetenyevwe.ugwemubwem.ossas",
});

rest.request({
  path: `/channels/999999999999999999/messages`,
  method: "POST",
  body: {
    payload_json: {
      content: "hello",
      embeds: [
        {
          title: "embed1",
          image: { url: "attachment://a.png" }
        },
        {
          title: "embed2",
          image: { url: "attachment://b.png" }
        }
      ]
    },
    files: [
      {
        name: "a.png",
        data: readFileSync("./file1.png")
      },
      {
        name: "b.png",
        data: createReadStream("./file2.png")
      }
    ]
  }
}).then(result => {
    console.log(result.status, result.headers, result.body);
}).catch(console.error);
```

#### new RestClient(options)

- **options**: object - client options
  - token: string - your bot or bearer token
  - version?: number - api version number. default = 9
  - type?: "bearer" | "bot" - token type. default = "bot"
  - retries?: number - max number of retries on network errors. default = 3
  - timeout?: number - time to wait for response before aborting, in ms. default = 10000

#### client.request(options) => AbortablePromise\<response\> \*

- **options**: object - request options
  - path: string - api endpoint
  - method: string - api method
  - body?: object - data to send, if any \*\*
  - headers?: object - extra headers to send, if any
  - retries?: number - override default max retries for this request
  - timeout?: number - override default timeout for this request
- **response**: object - returned response object
  - status: number - response status code
  - headers: object - response headers
  - body: object | string - response body, accoding to received content-type header

\* AbortablePromise is a regular Promise with an additional `.abort()` method, if one wishes to interrupt an ongoing request. The abort method is defined as follows:

- **promise.abort(reason)**
  - **reason**: string - the reason for aborting. The ongoing request will be rejected with this reason

\** If a `file` or `files` field exists on the `body` object, the request will be converted to multipart/form-data. Unlike most other fields, these fields are not fully defined in the Discord API documentation, its up to the library to implement them. RestClient implements them as follows:

- **file**: object - a single file to upload
  - name: string - the file name, including the file extension
  - data: buffer | stream - the file data as a buffer or as readable stream
- **files**: array\<file\> - array of file objects as above

### Class WebsocketShard

A barebones gateway shard to receive real-time events from discord.

Supports all gateway features including etf encoding and zlib compression.

Automatic reconnection is done only for resuming, other disconnections must be handled by the user.

Shard-specific rate limits are accounted for and requests will be rejected before they are sent if hit.

#### WebsocketShard Examples

Basic usage:

```js
const { WebsocketShard } = require("tiny-discord");

const shard = new WebsocketShard({
  token: "uheuehuehueheuheuehuehueheu",
  shard: 0,
  total: 1,
  intents: (1 << 15) - 1, // all intents
});

shard.on("ready", data => {
  console.log("received ready event");
  console.log(data); // payload from the READY event including initial array of guilds
});

shard.on("event", data => {
  console.log(data); // raw events, excluding READY and RESUMED
});

shard.on("close", e => {
  console.log(`closed with reason ${e.message}`);
  // depending on the error message, the user can call shard.connect() again to try reconnecting
});

shard.connect().then(() => console.log("connected")).catch(console.error);
```

#### new WebsocketShard(options)

- **options**: object - shard options
  - token: string - your bot token
  - intents: number - gateway intents bitfield
  - id?: number - shard id. default = 0
  - total?: number - total shards. default = id+1
  - large_threshold?: number - large_threshold value
  - presence?: object - initial presence object
  - properties?: object - client properties object. default = tiny-discord properties
  - version?: number - gateway api version. default = 9
  - encoding?: "json" | "etf" - encoding. default = "json" \*
  - compression?: 0 | 1 | 2 - compression. 0 = none, 1 = packet, 2 = transport. defult = 0 \*\*
  - url?: string - gateway url as given by /gateway/bot. default = "gateway.discord.gg"
  - session?: string - existing session id to resume \*\*\*
  - sequence?: number - existing session sequence to resume \*\*\*

\* Etf payloads are up to 10% smaller than json but 60% slower to unpack. Generally json encoding is recommended unless saving bandwidth is a priority.

\*\* Packet compression only affects large payloads and makes them about 80% smaller but 25% slower to unpack. Transport compression affects all payloads and makes them about 85% smaller and up to 10% slower to unpack. Generally transport compression is highly recommended, the bandwidth savings are huge and the performance impact is very small.

\*\*\* If both session and sequence are defined, the shard will attempt to resume. If resuming is successful, the `resumed` event will be fired instead of `ready`. If resuming is unsuccessful, the shard is closed with an Invalid Session error and the session data is cleared.

### Class InteractionServer

## Intermediate Components

These components depend on one or more base components

## LICENSE

TDB
