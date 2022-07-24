# InternalSharder

A basic implementation of an internal shard manager. This class creates and manages instances of the [WebsocketShard](WebsocketShard.md) component from this library.

Supports concurrent logins (large bot sharding / max_concurrency) and shards provide hooks for externally controlled login queues (ie: process sharding / clustering / etc).

Once spawned, shards will automatically attempt to resume or reconnect on network failures, invalid sessions and resumable close codes. Shards that close due to unresumable close codes will emit a `close` event and will not reconnect. If your network goes completely offline, the shards will attempt to reconnect every 10 seconds forever unless manually closed. Other types of disconnections and reconnections can be monitored via the `debug` event.

The InternalSharder does not connect to the rest api by itself if user supplies a valid identify queueing mechanism, otherwise the [IdentifyController](IdentifyController.md) component from this library will be used to obtain the gateway information from the rest api and to queue identifies.

&nbsp;

## Class InternalSharder

&nbsp;

### constructor

Create a new internal sharder.

|parameter|type|required|default|description|
|-|-|-|-|-|
|options|[InternalSharderOptions](#InternalSharderOptions)|yes|-|Sharder options|

```js
const sharder = new InternalSharder({
  total: 5,
  token: "xyz",
  intents: 1
})
```

&nbsp;

## Events

&nbsp;

### connect

Emitted when a shard connects to the gateway.

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

Emitted when a shard successfully identified and received a READY event.

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

Emitted when a shard successfully resumed and received a RESUMED event.

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

### close

Emitted when a shard disconnects due to an unresumable close code and will not reconnect. The error will contain the close code and reason if available. This event will not be emitted if the shard is manually closed with the `close()` method.

|parameter|type|description|
|-|-|-|
|reason|Error|Reason for the disconnection|
|id|number|The shard id|

```js
sharder.on("close", (error, id) => {
  console.log(`shard ${id} closed due to ${error.message}`)
})
```

&nbsp;

### debug

Internal debugging information for a given shard.

|parameter|type|description|
|-|-|-|
|data|string|Debug information|
|id|number|The shard id|

&nbsp;

### event

Emitted when a shard receives a dispatch event. Dispatch events are also emitted via their own event names, see below.

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

Emitted when a shard receives a specific event. Events are named with `SCREAMING_SNAKE_CASE` according to the Discord API.

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

## Properties

&nbsp;

### ids

An array of shard ids managed by this sharder.

**type:** Array\<number\>

&nbsp;

### total

The total number of shards everywhere.

**type:** number

&nbsp;

### shards

A Map of [WebsocketShard](WebsocketShard.md) instances.

**type:** Map\<id, [WebsocketShard](WebsocketShard.md)\>

&nbsp;

### shardOptions

The current options object passed to all shards.

**type:** [ShardOptions](WebsocketShard.md#shardoptions)

&nbsp;

### shardOverrides

Shard option overrides for specific shard ids, if any.

**type:** { [id], [ShardOptions](WebsocketShard.md#shardoptions) }

&nbsp;

### controller

The current identify queueing mechanism, either an instance of [IdentifyController](IdentifyController.md) or a function that is called every time a shard needs to identify. If an existing controller is given in the sharder options, this property will be a reference to it, otherwise a new controller will be created if neither a function nor a controller is given.

**type:** [IdentifyController](IdentifyController.md) | Function

&nbsp;

## Methods

&nbsp;

### .connect()

Spawn all shards and begin connecting. If `session_id` and `sequence` are defined in [InternalSharderOptions](#InternalSharderOptions).overrides, a resume will be attempted for those shard ids, otherwise a new identify will be requested. Resolves once all shards establish a websocket connection.

**returns:** Promise\<void\>

```js
await sharder.connect()
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

Get the average latency for all shards based on their last measurement.

**returns:** number

```js
sharder.getAveragePing()
```

&nbsp;

### .getCurrentSessions()

Get the current session ids and sequences from all shards. You can use this data to resume after a restart. It is recommended to close first to prevent the sequence number from changing.

**returns:** { [id], { session: string, sequence: number } }

```js
await sharder.close()
sharder.getCurrentSessions()
```

&nbsp;

## Types

&nbsp;

### InternalSharderOptions

|parameter|type|required|default|description|
|-|-|-|-|-|
|token|string|yes|-|Your bot token|
|intents|number|yes|-|Your bot's intents|
|total|number|yes if no ids|ids.length|Total number of shards|
|ids|array\<number\>|yes if no total|[0...total&#x2011;1]|Array of shard ids managed by this sharder|
|options|[ShardOptions](WebsocketShard.md#ShardOptions)|no|-|Additional options to be applied to all shards except token, intents and sessions|
|overrides|{&#160;[id]:&#160;[ShardOptions](WebsocketShard.md#ShardOptions)&#160;}|no|-|Shard-specific option overrides. Use this to set sessions for each shard|
|controller|[IdentifyController](IdentifyController.md) | [identifyHook](WebsocketShard.md#ShardOptions)|no|-|The identify queueing mechanism \*|

\* If neither an existing controller nor an identifyHook function is given, a new IdentifyController will be created to manage this sharder.

&nbsp;

## Examples

&nbsp;

Simple barebones event listener setup with a specific shard count:

```js
const { InternalSharder } = require("tiny-discord")
const token = "uvuvwevwevwe.onyetenyevwe.ugwemubwem.ossas";

const sharder = new InternalSharder({
  token,
  intents: 2,
  total: 32, // 32 shards
  options: { url }
})

sharder.on("MESSAGE_CREATE", async (message, shard_id) => {
  console.log(shad_id, message)
})

sharder.connect()
```

Typical client-like usage with recommended shard count:

```js
const { InternalSharder, RestClient, IdentifyController } = require("tiny-discord")
const token = "uvuvwevwevwe.onyetenyevwe.ugwemubwem.ossas";

const rest = new RestClient({ token });
const controller = new IdentifyController({ token });

controller.fetchGateway().then(result => {

  const total = result.shards // recommended shard count
  const url = result.url // gateway url, default url will be used if omitted

  const sharder = new InternalSharder({
    total,
    token,
    intents: 2,
    options: { url },
    controller
  })

  sharder.on("error", console.log)

  sharder.on("MESSAGE_CREATE", async (message, shard_id) => {
    if(message.content.startsWith("?!hi")) {
      await rest.post(`/channels/${message.channel_id}/messages`, {
        content: "hello!"
      })
    }
  })

  sharder.connect().catch(console.error)

}).catch(console.error)
```
