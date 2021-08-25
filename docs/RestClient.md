# RestClient

A barebones client for interacting with the discord rest API.

Supports all JSON endpoints including file uploading with multipart/form-data for both bot and bearer tokens. It does not support oauth2 nor other urlencoded endpoints.

Rate limits are not accounted for, the response headers are returned to the user for them to create their own rate limit handling.

Non-200 status codes are returned normally along with headers and body when available, only internal/network errors are thrown.

&nbsp;

## Class

RestClient.

### constructor

```js
const client = new RestClient(options)
```

|parameter|type|required|default|description|
|-|-|-|-|-|
|options|[RestClientOptions](#RestClientOptions)|yes|-|RestClient options|

&nbsp;

## Methods

### .request()

```js
await client.request(options)
```

|parameter|type|required|default|description|
|-|-|-|-|-|
|options|[RequestOptions](#RequestOptions)|yes|-|Options for this request|

**Returns:** [AbortablePromise](#AbortablePromise)\<[ApiResponse](#ApiResponse)\>

&nbsp;

## Types

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
|headers|object|no|-|Extra headers to send, if any|
|retries|number|no|RestClientOptions.retries|override default max retries for this request|
|timeout|number|no|RestClientOptions.timeout|override default timeout for this request|

\* If a `file` or `files` field exists on the `body` object, the request will be converted to multipart/form-data. Unlike most other fields, these fields are not fully defined in the Discord API documentation, its up to the library to implement them. RestClient implements them as follows:

|parameter|type|required|default|description|
|-|-|-|-|-|
|file|object|no|-|A file to send|
|file.name|string|yes|-|The file name including extension|
|file.data|buffer \| stream|yes|-|The file data|
|files|array\<file\>|no|-|Array of files to send|

&nbsp;

### ApiResponse

|field|type|description|
|-|-|-|
|status|number|Response status code|
|headers|object|Response headers|
|body|object \| string|Response body according to content-type header|

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
