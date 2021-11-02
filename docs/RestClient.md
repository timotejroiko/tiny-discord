# RestClient

A barebones client for interacting with the discord rest API.

Supports all JSON endpoints including file uploading with multipart/form-data for both bot and bearer tokens. It also supports CDN endpoints but does not support oauth2 nor other urlencoded endpoints.

Rate limits are not accounted for, the response headers are returned to the user for them to create their own rate limit handling.

Non-200 status codes are returned normally along with headers and body when available, only internal/network errors are thrown, so always check for status codes.

&nbsp;

## Class RestClient

&nbsp;

### constructor

|parameter|type|required|default|description|
|-|-|-|-|-|
|options|[RestClientOptions](#RestClientOptions)|yes|-|RestClient options|

```js
const client = new RestClient({ token: "abc" })
```

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
await client.get("/channels/9999/messages/77777")
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
await client.cdn("/attachments/55555/777777/a.png")
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
})
```

&nbsp;

## Types

&nbsp;

### RestClientOptions

|parameter|type|required|default|description|
|-|-|-|-|-|
|token|string|yes|-|Your bot or bearer token|
|version|number|no|9|Api version|
|type|string|no|"bot"|Token type, "bearer" or "bot"|
|retries|number|no|3|Max retries on network errors|
|timeout|number|no|10000|Time to wait before aborting|

&nbsp;

### RequestOptions

|parameter|type|required|default|description|
|-|-|-|-|-|
|path|string|yes|-|Api endpoint|
|method|string|yes|-|Api method|
|body|object|no|-|Data to send, if any \*|
|headers|object|no|-|Additional headers to send, if any|
|options|object|no|-|Additional `https.request` options, if any|
|retries|number|no|RestClientOptions.retries|override default max retries for this request|
|timeout|number|no|RestClientOptions.timeout|override default timeout for this request|
|cdn|boolean|no|false|whether to send a request to the cdn instead of the rest api|

\* If a `files` field exists on the `body` object, the request will be converted to multipart/form-data as per the Discord API specifications. RestClient implements `files` as an array of `file` objects defined as follows:

|parameter|type|required|default|description|
|-|-|-|-|-|
|name|string|yes|-|The file name including extension|
|data|buffer \| stream|yes|-|The file data as a Buffer or ReadableStream|

&nbsp;

### ApiResponse

|field|type|description|
|-|-|-|
|status|number|Response status code|
|headers|object|Response headers|
|body|object \| string \| buffer|Response body according to content-type header|

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
    console.log(result.status, result.headers, result.body);
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
      data: readFileSync("./file1.png")
    },
    {
      name: "b.png",
      data: createReadStream("./file2.png")
    }
  ]
}).then(result => {
    console.log(result.status, result.headers, result.body);
}).catch(console.error);
```
