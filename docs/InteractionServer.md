# InteractionServer

A basic webhook server for Discord interactions.

Running a Webhook server has many advantages over the traditional websocket gateway, there is no sharding, no disconnections and reconnections, no heartbeating to maintain, can run on serverless hosts such as cloudflare, replit and glitch and is extremely light in resource usage.

Discord only sends webhooks via https, so you need a domain name with a valid ssl certificate, or you can proxy it through something that has it, like nginx with certbot or cloudflare with flexible ssl. InteractionServer handles all other security requirements for you, including validating Ed25519 signatures and responding to Discord's tests and pings.

IMPORTANT: Once you setup a webhook server in your application, Discord will no longer send you interaction events via websocket.

&nbsp;

## Class InteractionServer

&nbsp;

### constructor

Create a new Interaction Server using your Discord application's public key.

|parameter|type|required|default|description|
|-|-|-|-|-|
|options|[InteractionServerOptions](#interactionserveroptions)|yes|-|InteractionServer options|

```js
const server = new InteractionServer({ key: "huehuehue" })
```

&nbsp;

## Events

&nbsp;

### interaction

Emitted when a Discord Interaction is received. You must respond to the interaction by returning an [InteractionResponse](#interactionresponse) object or an [InteractionFileResponse](#interactionfileresponse) object from inside the callback function (see examples at the end of the page). If multiple interaction listeners are created, the fastest valid response will be used and all others will be discarded.

IMPORTANT: this event has to be responded to as fast as possible. Discord requires a response to be returned in under 3 seconds including any delays caused by the network, therefore the user should be careful with async callbacks and defer when needed.

|parameter|type|description|
|-|-|-|
|interaction|[InteractionData](#interactiondata)|The interaction payload|

&nbsp;

### error

Emitted when an error happens. The server will automatically respond with a code 500 and continue running normally.

|parameter|type|description|
|-|-|-|
|error|Error|The error instance describing the issue|

&nbsp;

### debug

Internal debugging event.

|parameter|type|description|
|-|-|-|
|info|string|Internal debugging information|

&nbsp;

## Properties

&nbsp;

### key

The given Discord Application public key.

**type:** string

&nbsp;

### path

The path/url the server is listening to.

**type:** string

&nbsp;

### server

The Server instance that is listening to interaction requests. If an existing server instance was given in the constructor options, this property will be a reference to that server, otherwise it will contain a newly created http/http2 server.

**type:** http.Server | http2.Http2SecureServer | another custom net/tls based server

&nbsp;

### isCustomServer

Whether `this.server` references an existing server managed by the user.

**type:** boolean

&nbsp;

### serverOptions

The options object used to create a new http/http2 server. null if an existing custom server was used.

**type:** object | null

&nbsp;

## Methods

&nbsp;

### .listen(port)

Bind the server to a port and start listening if its not already.

|parameter|type|required|default|description|
|-|-|-|-|-|
|port|number|no|auto-assigned port|specific port to bind to if any|

**Returns:** Promise\<void\>

```js
await server.listen(3000)
```

&nbsp;

### .close()

Stop listening and shutdown. If attached to an existing custom server, InteractionServer will detach itself before shutting down and the existing server will not be interrupted.

**Returns:** Promise\<void\>

```js
await server.close()
```

&nbsp;

## Types

&nbsp;

### InteractionServerOptions

|parameter|type|required|default|description|
|-|-|-|-|-|
|key|string|yes|-|Your application's public key|
|path|string|no|"/"|Path on which to accept interaction webhooks|
|server|server \| object|no|-|Server options or a custom server \*|

\* If `server` is an instance of a http/https/http2/net/tls based Server, InteractionServer will attach itself to it like a middleware. Otherwise if `server` is an object, it will be used as the options to create a new internal server instance. If the object includes `cert` and `key` properties, it will be used with `http2.createSecureServer`, otherwise it will be used with `http.createServer`.

&nbsp;

### InteractionData

|parameter|type|description|
|-|-|-|
|id|string|Interaction id|
|type|number|Interaction type|
|data?|object|Interaction data|
|guild_id?|string|Guild id if run in a guild|
|channel_id?|string|Channel id if applicable|
|member?|object|Author's Member object|
|user?|object|Author's User object|
|token|string|Interaction token for follow ups|
|version|number|Interaction version|
|message?|object|Interaction Message object if applicable|

&nbsp;

### InteractionResponse

|parameter|type|required|default|description|
|-|-|-|-|-|
|type|number|yes|-|The interaction response type|
|data?|object|no|-|The interaction response data|

&nbsp;

### InteractionFileResponse

|parameter|type|required|default|description|
|-|-|-|-|-|
|files|object|yes|-|Array of File objects to send \*|
|payload_json|[InteractionResponse](#interactionresponse)|yes|-|The interaction response|

\* When sending files, the response will be automatically converted into `multipart-formdata`. The `files` field should be array of File objects as follows:

|parameter|type|required|description|
|-|-|-|-|
|name|string|yes|The file name including extension|
|data|buffer \| stream|yes|The file data as a Buffer or ReadableStream|
|type|string|no|The file's MIME type, for example "image/png". If not provided, Discord will attempt to auto-detect it from the file extension|

&nbsp;

## Examples

&nbsp;

Simple http server and a message response (with an ssl proxy elsewhere):

```js
const { InteractionServer } = require("tiny-discord");

const server = new InteractionServer({
  key: "fuuuuuuuuuuuu",
});

server.on("interaction", interaction => {
  console.log(interaction);
  return {
    type: 4,
    data: {
      content: "test"
    }
  };
});

server.on("error", console.error);

server.listen(3000);
```

&nbsp;

An https server with an async callback:

```js
const { InteractionServer } = require("tiny-discord");
const fs = require("fs");

const server = new InteractionServer({
  key: "deuuuuuuuuuuu",
  server: {
      key: fs.readFileSync("./key.pem"),
      cert: fs.readFileSync("./cert.pem")
  }
});

server.on("interaction", async interaction => {
  const result = await somePromise(interaction);
  return { type: 4, data: { content: result } };
});

server.listen(3000);
```

&nbsp;

Attaching to an express server and responding with a deferred message:

```js
const { InteractionServer } = require("tiny-discord");
const express = require("express");

const app = express();
const listener = app.listen(3000);

const server = new InteractionServer({
  key: "huehuehuehuehuehue",
  path: "/interactions",
  server: listener
});

server.on("interaction", interaction => {

  // begin executing an async function
  someLongAsyncFunction(interaction).then(async something => {
    // once the job is done, use the rest api to send a followup message using interaction.token

    // example using tiny-discord's RestClient:
    await rest.patch(`/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`, {
      content: "hello world"
    });

  }).catch(console.error);

  // respond with a deferred type immediately while we wait for the function to complete
  return { type: 5 };

});
```

Responding with files and attachments:

```js
server.on("interaction", interaction => {
  return {
    files: [{
      name: "image.jpg",
      data: fs.readFileSync("./myimagefile.jpg")
    }],
    payload_json: {
      type: 4,
      data: {
       content: "hi",
       embeds: [{
        description: "this is my image",
        image: "attachment://image.jpg"
       }],
       attachments: [{
        id: 0,
        description: "my image",
        filename: "image.jpg"
       }]
      }
    }
  }
})
```
