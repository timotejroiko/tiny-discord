# RestClient

A barebones client for interacting with the discord rest API.

Supports all JSON endpoints including file uploading with multipart/form-data for both bot and bearer tokens. It also supports CDN endpoints but does not support oauth2 nor other urlencoded endpoints.

Rate limits are not accounted for, the response headers are returned to the user for them to create their own rate limit handling.

Non-200 status codes are returned normally along with headers and body when available, only internal/network errors are thrown, so always check for status codes.

&nbsp;

## Class RestClient

&nbsp;

### constructor

Create a new rest client.

|parameter|type|required|default|description|
|-|-|-|-|-|
|options|[RestClientOptions](#RestClientOptions)|yes|-|RestClient options|

```js
const client = new RestClient({ token: "abc" })
```

&nbsp;

## Properties

&nbsp;

### token

The token used to make the requests.

**type:** string

&nbsp;

### version

The rest api version to make the requests.

**type:** number

&nbsp;

### type

The current token type.

**type:** "Bot" | "Bearer"

&nbsp;

### retries

Default number of retries before giving up a request.

**type:** number

&nbsp;

### timeout

Default amount of time to wait for a response before giving up the request.

**type:** number

&nbsp;

## Methods

&nbsp;

### .get(path, options)

Make a GET request to the Discord API.

|parameter|type|required|default|description|
|-|-|-|-|-|
|path|string|yes|-|The url for this request|
|options|[RequestOptions](#RequestOptions)|no|-|Additional options for this request, excluding path and method|

**Returns:** [AbortablePromise](#AbortablePromise)\<[ApiResponse](#ApiResponse)\>

```js
await client.get("/channels/9999/messages/77777").then(x => x.body.json)
```

&nbsp;

### .delete(path, options)

Make a DELETE request to the Discord API.

|parameter|type|required|default|description|
|-|-|-|-|-|
|path|string|yes|-|The url for this request|
|options|[RequestOptions](#RequestOptions)|no|-|Additional options for this request, excluding path and method|

**Returns:** [AbortablePromise](#AbortablePromise)\<[ApiResponse](#ApiResponse)\>

```js
await client.delete("/channels/9999/messages/77777")
```

&nbsp;

### .post(path, body, options)

Make a POST request to the Discord API.

|parameter|type|required|default|description|
|-|-|-|-|-|
|path|string|yes|-|The endpoint url for this request|
|body|object|yes|-|The request body for this request|
|options|[RequestOptions](#RequestOptions)|no|-|Additional options for this request, excluding path, method and body|

**Returns:** [AbortablePromise](#AbortablePromise)\<[ApiResponse](#ApiResponse)\>

```js
await client.post("/channels/9999/messages", {
  content: "hi"
})
```

&nbsp;

### .patch(path, body, options)

Make a PATCH request to the Discord API.

|parameter|type|required|default|description|
|-|-|-|-|-|
|path|string|yes|-|The endpoint url for this request|
|body|object|yes|-|The request body for this request|
|options|[RequestOptions](#RequestOptions)|no|-|Additional options for this request, excluding path, method and body|

**Returns:** [AbortablePromise](#AbortablePromise)\<[ApiResponse](#ApiResponse)\>

```js
await client.patch("/channels/9999/messages/5555", {
  content: "hi again"
})
```

&nbsp;

### .put(path, body, options)

Make a PUT request to the Discord API.

|parameter|type|required|default|description|
|-|-|-|-|-|
|path|string|yes|-|The endpoint url for this request|
|body|object|no|-|The request body for this request if applicable|
|options|[RequestOptions](#RequestOptions)|no|-|Additional options for this request, excluding path, method and body|

**Returns:** [AbortablePromise](#AbortablePromise)\<[ApiResponse](#ApiResponse)\>

```js
await client.put("/channels/9999/pins/5555")
```

&nbsp;

### .cdn(path, options)

Make a GET request to the Discord CDN.

|parameter|type|required|default|description|
|-|-|-|-|-|
|path|string|yes|-|The endpoint url for this request|
|options|[RequestOptions](#RequestOptions)|no|-|Additional options for this request, excluding path and method|

**Returns:** [AbortablePromise](#AbortablePromise)\<[ApiResponse](#ApiResponse)\>

```js
await client.cdn("/attachments/55555/777777/a.png").then(x => x.body.buffer)
```

&nbsp;

### .request(data)

Make a raw request to the Discord API.

|parameter|type|required|default|description|
|-|-|-|-|-|
|data|[RequestOptions](#RequestOptions)|yes|-|Options for this request|

**Returns:** [AbortablePromise](#AbortablePromise)\<[ApiResponse](#ApiResponse)\>

```js
await client.request({
  path: "/channels/9999/messages",
  method: "POST",
  body: { content: "hi" }
}).then(x => x.headers["content-type"] === "application/json" ? x.body.json : x.body.text)
```

&nbsp;

## Types

&nbsp;

### RestClientOptions

|parameter|type|required|default|description|
|-|-|-|-|-|
|token|string|yes|-|Your bot or bearer token|
|version|number|no|10|Api version|
|type|string|no|"bot"|Token type, "bearer" or "bot"|
|retries|number|no|3|Max retries on network errors|
|timeout|number|no|10000|Time to wait before aborting|

&nbsp;

### RequestOptions

|parameter|type|required|default|description|
|-|-|-|-|-|
|path|string|yes|-|Api endpoint|
|method|string|yes|-|Api method|
|body|object\|buffer|no|-|Data to send, if any \*|
|headers|object|no|-|Additional headers to send, if any|
|options|object|no|-|Additional `https.request` options, if any|
|retries|number|no|RestClientOptions.retries|override default max retries for this request|
|timeout|number|no|RestClientOptions.timeout|override default timeout for this request|
|cdn|boolean|no|false|whether to send a request to the cdn instead of the rest api|

\* If `body` is a buffer, it will be sent as is. If its an object, it will be stringified and sent as `application/json`. If it contains a `files` field, it will be sent as `multipart/formdata` instead. The `files` should be an array of `file` objects defined as follows:

|parameter|type|required|description|
|-|-|-|-|
|name|string|yes|The file name including extension|
|data|buffer \| stream|yes|The file data as a Buffer or ReadableStream|
|type|string|no|The file's MIME type, for example "image/png". If not provided, Discord will attempt to auto-detect it from the file extension|

&nbsp;

### ApiResponse

|field|type|description|
|-|-|-|
|status|number|Response status code|
|headers|object|Response headers|
|body|object|Response body as a body mixin \*|

\* The response body is automatically downloaded into a body mixin. Accessing the raw data stream directly is currently not supported. The body mixin is defined as follows:

|parameter|type|description|
|-|-|-|
|buffer|Buffer|The body content as a Buffer|
|text|string|The body content converted to string|
|json|object|The body content json parsed to an object|

&nbsp;

### AbortablePromise

AbortablePromise is a regular Promise with an additional `.abort()` method, if one wishes to interrupt an ongoing request. The abort method is defined as follows:

#### promise.abort(reason)

Abort the request. The ongoing request will be rejected with the given reason.

|parameter|type|required|default|description|
|-|-|-|-|-|
|reason|string|no|-|Reason for aborting|

**returns:** void

&nbsp;

## Examples

&nbsp;

Sending a simple message:

```js
const { RestClient } = require("tiny-discord");

const rest = new RestClient({
  token: "uvuvwevwevwe.onyetenyevwe.ugwemubwem.ossas",
});

rest.post(`/channels/999999999999999999/messages`, {
  content: "hello world"
}).then(result => {
    console.log(result.status, result.headers, result.body.json);
}).catch(console.error);
```

&nbsp;

Sending a message with multiple embeds and attachments:

```js
const { RestClient } = require("tiny-discord");
const { readFileSync, createReadStream } = require("fs");

const rest = new RestClient({
  token: "uvuvwevwevwe.onyetenyevwe.ugwemubwem.ossas",
});

rest.post(`/channels/999999999999999999/messages`, {
  payload_json: {
    content: "hello",
    attachments: [
      {
        "id": 0,
        "description": "file named a",
        "filename": "a.png"
      },
      {
        "id": 1,
        "description": "file named b",
        "filename": "b.png"
      }
    ]
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
      type: "image/png"
      data: readFileSync("./file1.png") // as a buffer
    },
    {
      name: "b.png",
      type: "image/png",
      data: createReadStream("./file2.png") // as a stream
    }
  ]
}).then(result => {
    console.log(result.status, result.headers, result.body.json);
}).catch(console.error);
```
