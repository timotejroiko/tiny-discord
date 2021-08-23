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

A simple client for interacting with the discord rest API built on `https`.

Supports all JSON endpoints, file uploading with multipart/form-data, bot and bearer tokens, however, it does not support the full oauth2 flow nor urlencoded endpoints.

Rate limits are not accounted for, instead they are returned to the user through the headers field.

Non-200 status codes are returned normally along with headers and body if available, only network errors are thrown.

#### Examples

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
});
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
});
```

#### constructor(options)

- **options**: object - client options
  - token: string - your bot or bearer token
  - version?: number - api version number. default = 9
  - type?: "bearer" | "bot" - token type. default = "bot"
  - retries?: number - max number of retries on network errors. default = 3
  - timeout?: number - time to wait for response before aborting, in ms. default = 10000

#### request(options) => AbortablePromise\<response\> \*

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

\** If a `file` or `files` field exists on the `body` object, the request will be converted to multipart/form-data. Unlike most other fields, these fields are not fully defined in the Discord API documentation as they are implementation-specific. RestClient implements them as follows:

- **file**: object - a single file to upload
  - name: string - the file name, including the file extension
  - data: buffer | stream - the file data in a buffer or as readable stream
- **files**: array\<file\> - array of file objects as above

### WebsocketShard

### InteractionServer

## Intermediate Components

These components depend on one or more base components

## LICENSE

TDB
