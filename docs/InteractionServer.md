# RestClient

A basic webhook server for Discord interactions.

Running a Webhook server has many advantages over the traditional websocket gateway, there is no sharding, no disconnections and reconnections, no heartbeating to maintain, can run on serverless hosts such as cloudflare, replit and glitch and is extremely light in resource usage.

Discord only sends webhooks via https, so you need a domain name with a valid certificate, or you can proxy it through something that has it.

Once you setup a webhook server in your application, Discord will no longer send you interaction events via websocket.

&nbsp;

## Class InteractionServer

&nbsp;

### constructor

|parameter|type|required|default|description|
|-|-|-|-|-|
|options|[InteractionServerOptions](#InteractionServerOptions)|yes|-|InteractionServer options|

```js
const server = new InteractionServer({ key: "huehuehue" })
```

&nbsp;

## Events

&nbsp;

### interaction

Emitted when a Discord Interaction is received. You must respond to the interaction by returning an [InteractionResponse](#InteractionResponse) object from inside the callback function (see examples at the end of the page). If multiple interaction listeners are created, the one that returns first will be used as the response.

|parameter|type|description|
|-|-|-|
|interaction|[InteractionData](#InteractionData)|The interaction payload|

&nbsp;

### error

Emitted when an error happens.

|parameter|type|description|
|-|-|-|
|error|Error|Error|

&nbsp;

### debug

Internal debugging event.

|parameter|type|description|
|-|-|-|
|info|string|Internal debugging information|

&nbsp;

## Methods

&nbsp;

### .listen(port)

Bind the server to a port and start listening.

|parameter|type|required|default|description|
|-|-|-|-|-|
|port|number|no|auto-assigned port|specific port to bind to if any|

**Returns:** Promise\<void\>

```js
await server.listen(3000)
```

&nbsp;

### .close()

Stop listening and shutdown. If attached to a custom server, InteractionServer will detach itself before shutting down so the custom server will not be interrupted.

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
|server|server \| object|no|-|Server options or a custom server \* \*\*|

\* If `server` is an instance of (http/https/http2/net/tls).Server, InteractionServer will attach itself to it like a middleware. Otherwise `server` can be an options object given to one of the built-in servers. If the object includes `cert` and `key` properties, it is passed to `http2.createSecureServer`, otherwise it is passed to `http.createServer`.

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
|data|object|no|-|The interaction response data|

&nbsp;

## Examples

&nbsp;

Simple http server and a message response:

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
  key: "veiiiiiiiiiii",
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
  key: "deuuuuuuuuuuuuu",
  path: "/interactions",
  server: listener
});

server.on("interaction", interaction => {
  someLongAsyncFunction(interaction).then(something => {
      // once the job is done, use the rest api to send a followup message using interaction.token
  });
  return { type: 5 }; // respond with a deferred type immediately
});

client.on("error", console.error);
```
