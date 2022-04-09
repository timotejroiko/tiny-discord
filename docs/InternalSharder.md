# InternalSharder

A basic implementation of an internal shard manager. This class creates and manages instances of the [WebsocketShard](WebsocketShard.md) component from this library.

Supports concurrent logins (large bot sharding / max_concurrency) and shards provide hooks for externally controlled login queues (ie: process sharding / clustering / etc).

Once spawned, shards will automatically attempt to resume or reconnect on network failures, invalid sessions and resumable close codes. Unresumable close codes will emit an `error` event and will not reconnect, therefore the user should listen it and fix any issues that may appear. Other types of disconnections and reconnections can be monitored via the `debug` event.

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

Internal debugging information for this shard.

|parameter|type|description|
|-|-|-|
|data|string|Debug information|
|id|number|The shard id|

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

### options

The current options object passed to all shards.

**type:** [ShardOptions](WebsocketShard.md#shardoptions)

&nbsp;

### shardOptions

The current individual shard options that are passed to each shard.

**type:** { [id], [ShardOptions](WebsocketShard.md#shardoptions) }

&nbsp;

### controller

Object containing the current session limit data and other information managed by this sharder. Only available if identify hooks were not used and this sharder is the sole manager for all shards.

**type:** [ControllerObject](#controllerobject) | null

&nbsp;

## Methods

&nbsp;

### .connect()

Spawn all shards and begin connecting. If `session_id` and `sequence` are defined in [InternalSharderOptions](#InternalSharderOptions).shardOptions, a resume will be attempted, otherwise a new identify will be queued. Resolves once all shards establish a websocket connection.

**returns:** Promise\<void\>

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

Get the average latency for all shards based on their last measurement.

**returns:** number

```js
sharder.getAveragePing()
```

&nbsp;

### .getCurrentSessions()

Get the current session ids and sequences from all shards. Use this data to resume after a process restart.

**returns:** { [id], { session: string, sequence: number } }

```js
sharder.getCurrentSessions()
```

&nbsp;

## Types

&nbsp;

### InternalSharderOptions

|parameter|type|required|default|description|
|-|-|-|-|-|
|total|number|yes if no ids|ids.length|Total number of shards|
|ids|array\<number\>|yes if no total|[0...total&#x2011;1]|Array of shard ids managed by this sharder|
|options|[ShardOptions](WebsocketShard.md#ShardOptions)|yes|-|Options to be applied to all shards|
|shardOptions|{&#160;[id]:&#160;[ShardOptions](WebsocketShard.md#ShardOptions)&#160;}|no|-|Shard-specific option overrides. Use this to set sessions for each shard|
|session_start_limit|object|yes if no options.identifyHook|-|Session limit information from /gateway/bot. Ignored if options.identifyHook is set \*|
|timeout|number|no|5500|How long to wait between each identify group. Ignored if options.identifyHook is set \*|

\* A single instance of InternalSharder is able to maintain control over concurrency, login limits and identify sequence with data from the `session_start_limit` object. However if multiprocessing and clustering is used, control has to be handed over to a master process via identify hooks.

&nbsp;

### ControllerObject

|key|type|description|
|-|-|-|
|total|number|Total number of daily logins available|
|remaining|number|Remaining number of daily logins available|
|resetTimestamp|number|Timestamp at which the daily login limit will be reset|
|concurrency|number|The current max_concurrency value being used for the login queue|
|timeout|number|The delay between each identify attempt|

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

  const total = result.body.shards // recommended shard count
  const url = result.body.url // gateway url, default url will be used if omitted
  const session_start_limit = result.body.session_start_limit; // session info including max_concurrency and remaining daily logins

  const sharder = new InternalSharder({
    total,
    session_start_limit,
    options: {
      token,
      intents: 2,
      url
    }
  })

  sharder.on("error", console.log)

  sharder.on("MESSAGE_CREATE", async (message, id) => {
    if(message.content.startsWith("?!hi")) {
      await rest.post(`/channels/${message.channel_id}/messages`, {
        content: "hello!"
      })
    }
  })

  sharder.connect()

}).catch(console.error)
```
