# WebsocketShard

A barebones gateway shard to receive real-time events from discord.

Supports all gateway features including etf encoding and zlib compression.

Automatic reconnection is done only for resuming, other disconnections must be handled by the user.

Shard-specific rate limits are accounted for and requests will be rejected before they are sent if hit.

&nbsp;

## Class WebsocketShard extends EventEmitter

&nbsp;

### constructor

|parameter|type|required|default|description|
|-|-|-|-|-|
|options|[ShardOptions](#ShardOptions)|yes|-|Shard options|

```js
const shard = new WebsocketShard({
  token: "xyz",
  intents: 1
})
```

&nbsp;

## Events

&nbsp;

### ready

Emitted when the READY event is received.

|parameter|type|description|
|-|-|-|
|data|[ShardReady](#ShardReady)|READY event payload|

&nbsp;

### resumed

Emitted when the RESUMED event is received.

|parameter|type|description|
|-|-|-|
|data|[ShardResumed](#ShardResumed)|RESUMED event payload with an addittional `replayed` field|

&nbsp;

### event

Emitted when dispatch events are received.

|parameter|type|description|
|-|-|-|
|data|[ShardEvent](#ShardEvent)|The raw event|

&nbsp;

### close

Emitted when the shard disconnects. If the disconnection happens at the websocket level, the close code will be available in the reason parameter.

|parameter|type|description|
|-|-|-|
|reason|Error|Reason for the disconnection. Depending on the reason you may call `.connect()` again|

&nbsp;

### debug

Internal debugging information.

|parameter|type|description|
|-|-|-|
|data|string|Debug information|

&nbsp;

## Properties

&nbsp;

### status

The shard's current connection status.

**type:** [ShardStatus](#ShardStatus)

&nbsp;

### lastPing

The shard's latency from the last time it was measured. Measurements are made automatically on every heartbeat or manually with the `.ping()` method.

**type:** number

&nbsp;

## Methods

&nbsp;

### .connect()

Connect to the gateway. If session id and sequence are defined in the shard options, a resume will be attempted, otherwise a new identify will be made.

**returns:** Promise\<void\>

```js
await shard.connect()
```

&nbsp;

### .ping()

Make a new latency measurement.

|parameter|type|required|default|description|
|-|-|-|-|-|
|data|any|no|-|Optional data to test the latency of specific payloads|

**returns:** Promise\<number\>

```js
await shard.ping("some data")
```

&nbsp;

### .close()

Disconnect the shard. The close event will not be fired on manual closure.

**returns:** Promise\<void\>

```js
await shard.close()
```

&nbsp;

### .requestGuildMembers()

Request guild members in a given guild. GUILD_MEMBERS_CHUNK events will be automatically collected, combined and returned once finished. The events themselves are still emitted individually through the `event` event.

|parameter|type|required|default|description|
|-|-|-|-|-|
|options|[RequestGuildMembersOptions](#RequestGuildMembersOptions)|yes|-|Request guild members payload with an additional timeout field|

**returns:** Promise\<[GuildMembersResult](#GuildMembersResult)\>

```js
await shard.requestGuildMembers({
  guild_id: "41771983444115456",
  query: "",
  limit: 0
})
```

&nbsp;

### .updatePresence()

Update the bot's status and/or presence in this shard.

|parameter|type|required|default|description|
|-|-|-|-|-|
|presence|[UpdatePresenceOptions](#UpdatePresenceOptions)|yes|-|The presence payload|

**returns:** Promise\<void\>

```js
await shard.updatePresence({
  status: "online",
  activities: [{
    name: "hi",
    type: 0
  }]
})
```

&nbsp;

### .send()

Send a gateway command.

|parameter|type|required|default|description|
|-|-|-|-|-|
|data|[GatewayCommand](#GatewayCommand)|yes|-|Gateway command payload|

**returns:** Promise\<void\>

```js
await shard.send({
  op: 8,
  d: {
    guild_id: "41771983444115456",
    query: "",
    limit: 0
  }
})
```

&nbsp;

## Types

&nbsp;

### ShardOptions

|parameter|type|required|default|description|
|-|-|-|-|-|
|token|string|yes|-|Your bot token|
|intents|number|yes|-|Gateway intents bitfield number|
|id|number|no|0|Shard id|
|total|number|no|id+1|Total shards|
|large_threshold|number|no|-|Number of members for a guild to be considered "large"|
|presence|[ShardPresence](#ShardPresence)|no|-|Initial presence for this shard|
|properties|[ShardProperties](#ShardProperties)|no|[ShardProperties](#ShardProperties)|Tell discord about ourselves|
|version|number|no|9|Gateway version|
|encoding|string|no|"json"|Gateway encoding, "json" or "etf" \*|
|compression|number|no|0|Gateway compression level: 0, 1 or 2 \*\*|
|url|string|no|"gateway.discord.gg"|Gateway url as given by /gateway/bot (without protocol)|
|session|string|no|-|Existing session id to resume \*\*\*|
|sequence|number|no|0|Existing sequence to resume \*\*\*|

\* Etf is up to 10% smaller than json but 60% slower to unpack.  
Generally json encoding is recommended unless saving bandwidth is a priority.

\*\* 0 = no compression, 1 = packet compression, 2 = transport compression.  
Packet compression is about 80% smaller but 25% slower to unpack.  
Transport compression is about 85% smaller and up to 10% slower to unpack.  
Generally transport compression is highly recommended, the bandwidth savings are huge and the performance impact is very small.

\*\*\* If both session and sequence are defined, the shard will attempt to resume.  
If resuming is successful, the `resumed` event will be fired instead of `ready`.  
If resuming is unsuccessful, the shard is closed with an Invalid Session error and the session data is cleared.

&nbsp;

### ShardReady

|parameter|type|description|
|-|-|-|
|v|string|Gateway version|
|user|object|The bot's User object|
|guilds|array\<object\>|Array of unavailable Guild objects|
|session_id|string|This session id|
|shard?|array\<number\>|Array containing shard id and shard total|
|application|object|Partial Application object|

&nbsp;

### ShardResumed

|parameter|type|description|
|-|-|-|
|replayed|number|Number of events that were re-sent after resuming|

&nbsp;

### ShardEvent

|parameter|type|description|
|-|-|-|
|t|string|Event name|
|op|number|Event type (always 0)|
|d|object|Event payload|
|s|number|Event sequence number|

&nbsp;

### ShardStatus

|value|description|
|-|-|
|1|Connected|
|2|Reconnecting|
|3|Closing|
|4|Closed|

&nbsp;

### GatewayCommand

|parameter|type|required|default|description|
|-|-|-|-|-|
|op|number|yes|-|Command op code|
|d|object|yes|-|Command payload|

&nbsp;

### ShardPresence

|parameter|type|required|default|description|
|-|-|-|-|-|
|since|number \| null|yes|-|Timestamp of when the user went afk|
|afk|boolean|yes|-|Whether the user is afk|
|status|"string"|yes|-|The user's status|
|activities|array<\activity\>|yes|-|Array of activities if any|

&nbsp;

### ShardProperties

|parameter|type|required|default|description|
|-|-|-|-|-|
|$os|string|yes|process.platform|Platform|
|$browser|string|yes|"tiny-discord"|Library name|
|$device|string|yes|"tiny-discord"|Library name|

&nbsp;

### RequestGuildMembersOptions

|parameter|type|required|default|description|
|-|-|-|-|-|
|guild_id|string|yes|-|The guild ID to request members from|
|user_ids|array\<string\>|no|-|Array of member IDs to fetch|
|query|string|no|""|Search members by username instead|
|limit|number|no|50|Max number of members to return|
|presences|boolean|no|false|Whether to include presence data|
|timeout|number|no|10000|How long to wait before canceling the request|

&nbsp;

### GuildMembersResult

|parameter|type|description|
|-|-|-|
|guild_id|string|The guild ID of the returned members|
|members|array\<object\>|Array of guild member objects|
|presences|array\<object\>|Array of presence objects|
|not_found|array\<string\>|Array of not found IDs|

&nbsp;

### UpdatePresenceOptions

|parameter|type|required|default|description|
|-|-|-|-|-|
|since|number|no|Date.now() \| null|Since when is the client afk. Defaults to current timestamp if status equals "afk", otherwise defaults to null|
|afk|boolean|no|false|Whether the client is afk|
|status|string|no|"online"|The client's new status|
|activities|array\<object\>|no|[]|Array of activity objects if any|

&nbsp;

## Examples

&nbsp;

Basic usage:

```js
const { WebsocketShard } = require("tiny-discord");

const shard = new WebsocketShard({
  token: "uheuehuehueheuheuehuehueheu.paokspoakspaokspaokspoak",
  shard: 0,
  total: 1,
  intents: (1 << 15) - 1, // all intents
});

shard.on("ready", data => {
  console.log("received ready event");
  console.log(data); // payload from the READY event including initial array of guilds
});

shard.on("event", data => {
  console.log(data); // raw events, excluding READY and RESUMED
});

shard.on("close", e => {
  console.log(`closed with reason ${e.message}`);
  // depending on the error message, the user can call shard.connect() again to try reconnecting
});

shard.connect().then(() => console.log("connected")).catch(console.error);
```
