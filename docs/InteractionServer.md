# InteractionServer

A basic webhook server for Discord interactions.

Running a Webhook server has many advantages over the traditional WebSocket gateway, there is no sharding, no disconnections and reconnections, no heartbeats to maintain, can run on serverless hosts such as Cloudflare, Replit and glitch and is extremely light in resource usage.

Discord only sends webhooks via HTTPS, so you need a domain name with a valid SSL certificate, or you can proxy it through something that has it, like nginx with Certbot or Cloudflare with flexible SSL. InteractionServer handles all other security requirements for you, including validating Ed25519 signatures and responding to Discord's tests and pings.

IMPORTANT: Once you set up a webhook server in your application, Discord will no longer send you interaction events via WebSocket.

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

Emitted when a Discord Interaction webhook is received. This event provides an instance of [InteractionEvent](#class-interactionevent) which helps you reply to the interaction.

IMPORTANT: this event has to be replied to as fast as possible. Discord requires a reply to be returned in under 3 seconds starting from the moment the webhook left their servers, therefore the user should be careful with async callbacks and defer when needed.

|parameter|type|description|
|-|-|-|
|interaction|[InteractionEvent](#class-interactionevent)|The interaction payload|

&nbsp;

### error

Emitted when the HTTP server encounters an error.

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

The Server instance that is listening to interaction requests. If an existing server instance was given in the constructor options, this property will be a reference to that server, otherwise it will contain a newly created HTTP/HTTP2 server.

**type:** http.Server | http2.Http2SecureServer | other custom NET/TLS based server

&nbsp;

### isCustomServer

Whether `this.server` references an existing server managed by the user.

**type:** boolean

&nbsp;

### serverOptions

The options object used to create a new HTTP/HTTP2 server or null if an existing custom server was used.

**type:** object | null

&nbsp;

### rest

A reference to an optional RestClient instance attached to the server.

**type:** [RestClient](RestClient.md) | null

&nbsp;

## Methods

&nbsp;

### .listen(port)

Bind the server to a port and start listening if it isn't already.

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

## Class InteractionEvent

&nbsp;

## InteractionEvent Properties

&nbsp;

### .request

A reference to the raw HTTP request object (data stream already consumed/closed). This can be used to view the headers sent by discord for example.

**type:** http.IncomingMessage | http2.Http2ServerRequest

&nbsp;

### .response

A reference to the raw HTTP response object (data stream still open). This can be used to manually pipe/write a reply.

**type:** http.ServerResponse | http2.Http2ServerResponse

&nbsp;

### .server

A reference to the parent [InteractionServer](#class-interactionserver) instance.

**type:** [InteractionServer](#class-interactionserver)

&nbsp;

### .interaction

The actual interaction object sent by Discord.

**type:** [InteractionObject🔗](https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-object)

&nbsp;

### .replied

Whether this interaction was already replied to. Each InteractionEvent instance can only reply once.

**type:** Boolean

&nbsp;

## InteractionEvent Methods

&nbsp;

### .reply(data, useRestCallback)

Reply to this interaction. Each interaction can only be replied to once (followup's should be done via the REST API), subsequent calls to this method will reject the promise. If `useRestCallback` is set to true, the reply will be sent via the REST API's interaction callback endpoint instead of responding directly to the webhook, and will return an [ApiResponse](RestClient.md#apiresponse) instead of void (requires defining a RestClient instance in the [InteractionServer](#class-interactionserver) options).

Differences between responding via the REST callback endpoint and responding directly to the webhook include:

- REST callback returns a response from Discord while replying directly to the webhook doesn't return any feedback. This can impact deferring and followups, for example when you defer by responding directly to the webhook you won't know if the deferring actually worked or not, so you must be prepared to get a possible unknown interaction error when you send the reply/followup. Deferring via REST callback returns a response, which lets you know whether the deferring worked before you reply.
- REST callback lets you upload larger attachments while uploading files directly to the webhook is currently limited to ~150kb ([for unknown reasons](https://github.com/discord/discord-api-docs/issues/5250)).
- REST is slower and wastes more resources due to opening new connections instead of reusing the existing ones.

|parameter|type|required|default|description|
|-|-|-|-|-|
|data|[InteractionReply](#interactionreply)|yes|-|The interaction reply to be sent to Discord|
|useRestCallback|boolean|no|false|Whether to send the reply via REST callback|

**Returns:** Promise\<void | [ApiResponse](RestClient.md#apiresponse)\>

```js
await event.reply({ type: 4, data: { content: "hi" } })
```

&nbsp;

### .isValidResponse(data)

Small utility method that does basic validation for the reply. This method is called internally when using [reply()](#replydata-userestcallback).

|parameter|type|required|default|description|
|-|-|-|-|-|
|data|[InteractionReply](#interactionreply)|yes|-|The interaction reply to be sent to Discord|

**Returns:** boolean

```js
event.isValidResponse({ type: 4, data: { content: "hi" } })
```

## Types

&nbsp;

### InteractionServerOptions

|parameter|type|required|default|description|
|-|-|-|-|-|
|key|string|yes|-|Your application's public key|
|path|string|no|"/"|Path on which to accept interaction webhooks|
|server|server \| object|no|-|Server options or a custom server \*|
|rest|[RestClient](RestClient.md)|no|-|Optional instance of [RestClient](RestClient.md) to enable replying via REST API|

\* If `server` is an instance of an HTTP/HTTPS/HTTP2/NET/TLS based Server, InteractionServer will attach itself to it like a middleware. Otherwise, if `server` is an object, it will be used as the options to create a new internal server instance. If the object includes `cert` and `key` properties, it will be used with `http2.createSecureServer`, otherwise it will be used with `http.createServer`.

&nbsp;

### InteractionReply

Normal reply:

|parameter|type|required|default|description|
|-|-|-|-|-|
|type|number|yes|-|The interaction reply type|
|data?|object|no|-|The interaction reply data|

File uploads:

|parameter|type|required|default|description|
|-|-|-|-|-|
|payload_json|[InteractionReply](#interactionreply)|yes|-|The normal reply as above|
|files|Array<[FileObject](#fileobject)>|yes|-|Array of files to send \*|

\* When sending files, the reply will be sent using `multipart-formdata`.

&nbsp;

### FileObject

|parameter|type|required|description|
|-|-|-|-|
|name|string|yes|The file name including extension|
|data|Buffer \| Readable|yes|The file contents as a buffer or a readable stream|
|type|string|no|The file's MIME type, for example "image/png". If not provided, Discord will attempt to auto-detect it from the file extension|

&nbsp;

## Examples

&nbsp;

Simple HTTP server and a message response (with an SSL proxy elsewhere):

```js
const { InteractionServer } = require("tiny-discord");

const server = new InteractionServer({
  key: "fuuuuuuuuuuuu",
});

server.on("interaction", event => {
  console.log(event.interaction);
  event.reply({
    type: 4,
    data: {
      content: "test"
    }
  }).catch(console.log);
});

server.on("error", console.error);

server.listen(3000);
```

&nbsp;

An HTTPS server with an async callback:

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

server.on("interaction", async event => {
  const result = await somePromise(event.interaction);
  await event.reply({ type: 4, data: { content: result } });
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

const rest = new RestClient({
  token: "mytoken" // a valid token is not actually required here, interaction webhooks use the interaction token, not the bot token
})

server.on("interaction", event => {
  // defer
  await event.reply({ type: 5 });

  // do something
  await someLongAsyncFunction(event.interaction);

  // followup/update example using tiny-discord's RestClient:
  await rest.patch(`/webhooks/${event.interaction.application_id}/${event.interaction.token}/messages/@original`, {
    content: "hello world"
  });
});
```

Responding with files and attachments:

```js
server.on("interaction", async event => {
  await event.reply({
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
  })
})
```

Responding using the REST callback:

```js
const { InteractionServer, RestClient } = require("tiny-discord")

const rest = new RestClient({
  token: "mytoken" // a valid token is not actually required here, interaction webhooks use the interaction token, not the bot token
})

const server = new InteractionServer({
  key: "huehuehuehuehuehue",
  rest
})

server.on("interaction", event => {
  const response = await event.reply({ type: 5 }, true);
  if(response.status === 204) {
    await rest.patch(`/webhooks/${event.interaction.application_id}/${event.interaction.token}/messages/@original`, {
      content: "hello world"
    });
  }
})

server.listen(3000)
```
