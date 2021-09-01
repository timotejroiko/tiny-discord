# InternalSharder

A basic implementation of an internal shard manager. This class creates and manages instances of the [WebsocketShard](WebsocketShard.md) component from this library.

Supports concurrent logins (large bot sharding) and provides a hook for externally controlled login queues (ie: process sharding / clustering / etc).

Once spawned, shards will always attempt to reconnect regardless of reason, therefore the user should listen to the error event to make sure shards do not crash in a loop. All close codes are forwarded to the error event so that the user can see when and why a shard disconnects.

The InternalSharder does not connect to the rest api by itself, the user must use the [RestClient](RestClient.md) or any other http client to call `/gateway/bot` and obtain the relevant gateway information before spawning shards.

&nbsp;

## Class InternalSharder extends EventEmitter

&nbsp;

### constructor

|parameter|type|required|default|description|
|-|-|-|-|-|
|options|[InternalSharderOptions](#InternalSharderOptions)|yes|-|Sharder options|

```js
const sharder = new InternalSharder({
  total: 5,
  options: {
    token: "xyz",
    intents: 1,
  }
})
```

&nbsp;

## Events

&nbsp;

### connect

Emitted when a shard connected to the gateway.

|parameter|type|description|
|-|-|-|
|id|number|The shard id|

```js
sharder.on("connect", id => {
  console.log(`Shard ${id} connected`);
})
```

&nbsp;

### ready

Emitted when a shard received a READY event.

|parameter|type|description|
|-|-|-|
|data|[ShardReady](WebsocketShard.md#ShardReady)|READY event payload|
|id|number|The shard id|

```js
sharder.on("ready", (data, id) => {
  console.log(`Shard ${id} ready - ${data.guilds.length} guilds`);
})
```

&nbsp;

### resumed

Emitted when a shard received a RESUMED event.

|parameter|type|description|
|-|-|-|
|data|[ShardResumed](WebsocketShard.md#ShardResumed)|RESUMED event payload with an addittional `replayed` field|
|id|number|The shard id|

```js
sharder.on("resumed", (data, id) => {
  console.log(`shard ${id} resumed - replayed ${data.replayed} events`);
})
```

&nbsp;

### event

Emitted when a shard receives a dispatch event.

|parameter|type|description|
|-|-|-|
|data|[ShardEvent](WebsocketShard.md#ShardEvent)|The raw event|
|id|number|The shard id|

```js
sharder.on("event", (data, id) => {
  console.log(`received ${data.t} event from shard ${id}`)
})
```

&nbsp;

### EVENT_NAME

Emitted when a shard receives a specific event. Event names are according to the Discord API.

|parameter|type|description|
|-|-|-|
|data|object|The event payload|
|id|number|The shard id|

```js
sharder.on("MESSAGE_CREATE", (message, id) => {
  console.log(`received message event from shard ${id}`)
  console.log(message.content)
})
```

&nbsp;

### error

Emitted when a shard disconnects or encounters any other issue. The error will contain the close code and reason if available. The shard will automatically attempt to reconnect shortly after.

|parameter|type|description|
|-|-|-|
|reason|Error|Reason for the disconnection|
|id|number|The shard id|

```js
sharder.on("close", (error, id) => {
  console.log(`shard ${id} disconnected due to ${error.message}`)
})
```

&nbsp;

### debug

Internal debugging information.

|parameter|type|description|
|-|-|-|
|data|string|Debug information|

&nbsp;

## Properties

&nbsp;

### shards

A Map of [WebsocketShard](WebsocketShard.md) instances.

**type:** Map\<id, WebsocketShard\>

&nbsp;

## Methods

&nbsp;

### .connect()

Spawn all shards and begin connecting. If `session_id` and `sequence` are defined in [InternalSharderOptions](#InternalSharderOptions).shardOptions, a resume will be attempted, otherwise a new identify will be queued. This method does not wait for the shards to connect.

**returns:** void

```js
sharder.connect()
```

&nbsp;

### .close()

Disconnect all shards. Resolves once all shards are closed.

**returns:** Promise\<void\>

```js
await sharder.close()
```

&nbsp;

### .getAveragePing()

Get the average latency for all shards.

**returns:** number

```js
sharder.getAveragePing()
```

&nbsp;

### .getSessions()

Get the current sessions and sequences from all shards.

**returns:** object{[id], { session: string, sequence: number }}

```js
sharder.getSessions()
```

&nbsp;

## Types

&nbsp;

### InternalSharderOptions

|parameter|type|required|default|description|
|-|-|-|-|-|
|options|[ShardOptions](WebsocketShard.md#ShardOptions)|yes|-|Options to be applied to all shards|
|shardOptions|object{[id]:&#160;[ShardOptions](WebsocketShard.md#ShardOptions)}|no|-|Shard-specific option overrides. Use this to set sessions for each shard|
|total|number|yes|-|Total number of shards|
|ids|array\<number\>|no|[0...total&#x2011;1]|Array of shard ids|
|identifyHook|(id) => { time, ask? }|no|-|A function to intercept and control shard logins. Use this to manage a global identify queue \*|
|max_concurrency|number|no|1|How many shards can login at the same time. Ignored if identifyHook is set|
|identifyTimeout|number|no|5500|How long to wait between each identify. Ignored if identifyHook is set|

\* If set, the identifyHook function will be called every time a shard needs to identify. The function can be asynchronous and must return an object containing a `time` field and optionally an `ask` field. If `time` is set to true or 0, the shard will identify immediately. If `time` is set to a number, the shard will wait `time` milliseconds before identifying. If `ask` is set to true, the shard will wait `time` milliseconds and then call the identifyHook function again.

&nbsp;

## Examples

&nbsp;

Typical client-like usage:

```js
const { InternalSharder, RestClient } = require("tiny-discord")
const token = "uvuvwevwevwe.onyetenyevwe.ugwemubwem.ossas";

const rest = new RestClient({ token });

rest.request({
  path: `/gateway/bot`,
  method: "GET"
}).then(result => {
  const sharder = new Sharder({
    total: result.body.shards,
    max_concurrency: result.body.session_start_limit.max_concurrency
    options: {
      token,
      intents: 2,
      url: result.body.url.slice(6) // remove "wss://"
    }
  })
  sharder.on("error", console.log)
  sharder.on("MESSAGE_CREATE", async (message, id) => {
    if(message.content.startsWith("?!hi")) {
      await rest.request({
        path: `/channels/${message.channel_id}/messages`,
        method: "POST",
        body: { content: "hello!" }
      })
    }
  })
  sharder.connect()
}).catch(console.error)
```
