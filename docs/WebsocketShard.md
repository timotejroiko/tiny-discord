# WebsocketShard

A bare-bones gateway shard to receive real-time events from discord.

Supports all gateway features including etf encoding and zlib compression and also provides an identify-hook for controlling login queues (i.e.: sharding / clustering / etc.).

Shard-specific gateway command rate limits are accounted for and requests will be rejected before they are sent if the limit is reached.

Automatic reconnection is done for resumes, network issues and all resumable close codes. Non-resumable close codes like "invalid intents" must be handled by the user (see the `close` event). If your network goes completely offline, the shard will enter offline mode and automatically attempt to reconnect every 10 seconds forever. Manually calling the `close` or `connect` methods while in offline mode will disable it and stop the loop.

&nbsp;

## Class WebsocketShard

&nbsp;

### constructor

|parameter|type|required|default|description|
|-|-|-|-|-|
|options|[ShardOptions](#shardoptions)|yes|-|Shard options|

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

Emitted when the shard becomes ready, either after identifying or after resuming. A type field is given to determine the event type.

|parameter|type|description|
|-|-|-|
|data|[ReadyEvent](#readyevent)|READY event payload|

```js
shard.on("ready", data => {
  if(data.type === "identify") {
    console.log(`Shard ${shard.id} ready - ${data.data.guilds.length} guilds`);
  } else {
    console.log(`Shard ${shard.id} resumed`);
  }
})
```

&nbsp;

### close

Emitted when the shard disconnects with a non-resumable close code and will not reconnect. The error message will contain the close code and reason if available. Non-resumable close codes are caused by issues that require fixing, therefore they should be checked and fixed before reconnecting to prevent spamming the api.

To log other types of disconnections and reconnections use the debug event.

|parameter|type|description|
|-|-|-|
|reason|Error|Reason for the disconnection|

```js
shard.on("close", async error => {
  console.log(error)
})
```

&nbsp;

### event

Emitted when dispatch events are received. This is a raw discord event.

|parameter|type|description|
|-|-|-|
|data|[ShardEvent](#shardevent)|The raw event|

```js
shard.on("event", data => {
  console.log(`received ${data.t} event`)
})
```

&nbsp;

### debug

Internal debugging information including disconnections and reconnections.

|parameter|type|description|
|-|-|-|
|data|string|Debug information|

```js
shard.on("debug", data => {
  console.log(data);
})
```

&nbsp;

## Properties

&nbsp;

### status

Getter for the shard's current connection status.

**type:** [ShardStatus](#shardstatus)

&nbsp;

### lastPing

Getter for the shard's latency as per last measurement. Measurements are made automatically on every heartbeat or manually with the `.ping()` method.

**type:** number

&nbsp;

### connectedAt

Getter for the timestamp when the shard's current websocket connection was established.

**type:** number

&nbsp;

### readyAt

Getter for the timestamp when the shard's current connection became ready.

**type:** number

&nbsp;

### identifiedAt

Getter for the timestamp when the shard's current session was identified.

**type:** number

&nbsp;

### token

The shard's token.

**type:** string

&nbsp;

### intents

The shard's intents bitfield.

**type:** number

&nbsp;

### id

The shard's id.

**type:** number

&nbsp;

### total

The total number of shards in the group the shard's id belongs to.

**type:** number

&nbsp;

### large_threshold

The shard's large_threshold value.

**type:** number

&nbsp;

### presence

The shard's presence options.

**type:** [ShardPresence](#shardpresence)

&nbsp;

### properties

The shard's properties value.

**type:** [ShardProperties](#shardproperties)

&nbsp;

### version

The shard's preferred gateway version.

**type:** number

&nbsp;

### encoding

The encoding value used by this shard.

**type:** string

&nbsp;

### compression

The compression option used by this shard.

**type:** number

&nbsp;

### url

The gateway url used by this shard.

**type:** string

&nbsp;

### session

Getter for the shard's current session data.

**type:** [SessionData](#sessiondata)

&nbsp;

### identifyHook

The identifyHook function if availble.

**type:** function | null

&nbsp;

### etfUseBigint

Whether the shard should return BigInt snowflakes when using Etf encoding.

**type:** boolean

&nbsp;

### disabledEvents

Array of events that are being ignored.

**type:** array\<string\>

&nbsp;

## Methods

&nbsp;

### .connect()

Connect to the gateway. If session id and sequence are defined in the shard options, a resume will be attempted, otherwise a new identify will be made. Resolves once the shard establishes a websocket connection.

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

Gracefully disconnect the shard and optionally invalidate the session. If the session is invalidated, resuming will no longer work and a new identify will be required. The close event will not be fired on manual closure.

|parameter|type|required|default|description|
|-|-|-|-|-|
|invalidate|boolean|no|false|Whether or not to invalidate the session|

**returns:** Promise\<void\>

```js
await shard.close()
```

&nbsp;

### .requestGuildMembers()

Request guild members for a given guild. `GUILD_MEMBERS_CHUNK` events will be automatically collected, combined and returned once finished. The events themselves are still emitted individually through the `event` event. This method follows the same rate limiting behavior as the [send](#send) method.

|parameter|type|required|default|description|
|-|-|-|-|-|
|options|[RequestGuildMembersOptions](#requestguildmembersoptions)|yes|-|Request guild members payload with an additional timeout field|

**returns:** Promise\<[GuildMembersResult](#guildmembersresult)\>

```js
await shard.requestGuildMembers({
  guild_id: "41771983444115456",
  query: "",
  limit: 0
})
```

&nbsp;

### .updatePresence()

Update the bot's status and/or presence for this shard. This method follows the same rate limiting behavior as the [send](#send) method but has a separate limit of 5 presence updates per 20 seconds.

|parameter|type|required|default|description|
|-|-|-|-|-|
|presence|[UpdatePresenceOptions](#updatepresenceoptions)|yes|-|The presence payload|

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

### .updateVoiceState()

Update a voice connection or connect/disconnect from a voice channel. When connecting to a new voice channel, the return value will optionally include `token` and `endpoint` fields for connecting to the voice websocket (see UpdateVoiceStateOptions). This method follows the same rate limiting behavior as the [send](#send) method.

|parameter|type|required|default|description|
|-|-|-|-|-|
|state|[UpdateVoiceStateOptions](#updatevoicestateoptions)|yes|-|The voice state payload with additional timeout and wait_for_server fields|

**returns:** Promise\<[VoiceStateResult](#voicestateresult)\>

```js
await shard.updateVoiceState({
  guild_id: "41771983444115456",
  channel_id: "41534534634634656",
  wait_for_server: true
})
```

&nbsp;

### .send()

Send a raw gateway command. Each shard is allowed 115 gateway commands every 60 seconds (5 are reserved for priority commands such as heartbeating and resuming). If the shard rate limit is reached, this method will reject with an `Error` object containing a `retry_after` property.

|parameter|type|required|default|description|
|-|-|-|-|-|
|data|[GatewayCommand](#gatewaycommand)|yes|-|Gateway command payload|

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
|presence|[ShardPresence](#shardpresence)|no|-|Initial presence for this shard|
|properties|[ShardProperties](#shardproperties)|no|[ShardProperties](#shardproperties)|Tell discord about ourselves|
|version|number|no|9|Gateway version|
|encoding|string|no|"json"|Gateway encoding, "json" or "etf" \*|
|compression|number|no|0|Gateway compression level: 0, 1 or 2 \*\*|
|url|string|no|"gateway.discord.gg"|Gateway url as given by /gateway/bot (without protocol)|
|session|[SessionData](#sessiondata)|no|-|Existing session data to resume \*\*\*|
|identifyHook|(id) => { time, ask? }|no|-|A function that is called before every identify \*\*\*\*|
|etfUseBigint|boolean|no|false|Whether to keep snowflakes as BigInt when using Etf encoding \*\*\*\*\*|
|disabledEvents|array\<string\>|no|-|List of gateway events to disable \*\*\*\*\*\*|

\* Etf can be slightly smaller than json at times but its about 25% slower to unpack.  
When using Etf, discord sends snowflakes as 64bit integers instead of strings, you can toggle receiving them as BigInt using the `etfUseBigint` option.  
Generally json encoding is recommended unless you're using BigInt snowflakes.

\*\* 0 = no compression, 1 = packet compression, 2 = transport compression.  
Packet compression only compresses large data, small data remains uncompressed. Large data becomes about 80% smaller and about 30% slower to unpack.  
Transport compression compresses all data, making it about 85% smaller but about 25% slower to unpack.  
Generally compression is recommended as the bandwidth savings are very significant, with transport compression being preferable as it's the most efficient of the two.

\*\*\* If set, the shard will attempt to resume. If it fails to resume, the session data is cleaned and the shard automatically attempts a new identify.

\*\*\*\* If set, the identifyHook function will be called every time the shard needs to identify. The function can be asynchronous and must return an object containing a `time` field and optionally an `ask` field. If `time` is set to 0 or not an integer, the shard will identify immediately. If `time` is set to a positive integer, the shard will wait `time` milliseconds before identifying. If `ask` is set to true, the shard will wait `time` milliseconds and then call the identifyHook function again.

\*\*\*\*\* When using Etf encoding, discord sends snowflakes and 64bit integers instead of strings, which in js are deserialized to BigInt. By default they are converted back to string after parsing, but keeping them as BigInt may provide a small performance boost and decrease memory usage.

\*\*\*\*\*\* When this option is used, the shard will attempt to early-detect events by byte-matching so that disabled events are found and discarded before being parsed, increasing discard performance by up to 1000%. Non-discarded events have a slight performance impact from this extra check, usually less than 5%. Use cases include using the presences intent but not actually needing `PRESENCE_UPDATE` events (for fetching members with presences). Event names should use `SCREAMING_SNAKE_CASE` according to the Discord API.

&nbsp;

### SessionData

|parameter|type|description|
|-|-|-|
|session_id|string|Existing session id to resume|
|sequence|number|Existing sequence to resume|
|resume_url|string|url to use when resuming|

Since September 2022 there is a separate gateway url for resuming, if not provided the normal url will be used instead, but Discord has warned that not using the proper url may lead to increased disconnections.

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

### ReadyEvent

|parameter|type|description|
|-|-|-|
|type|string|Event type, either identify or resume|
|data|[ShardReady](#shardready) \| [ShardResumed](#shardresumed)|Event data, either ready data or resume data|

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
|0|Ready|
|1|Connecting|
|2|Connected|
|3|Closing|
|4|Offline|
|5|Closed|

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
|os|string|yes|process.platform|Platform|
|browser|string|yes|"tiny-discord"|Library name|
|device|string|yes|"tiny-discord"|Library name|

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

### UpdateVoiceStateOptions

|parameter|type|required|default|description|
|-|-|-|-|-|
|guild_id|string|yes|-|The guild the voice channel belongs to|
|channel_id|string|no|null|The voice channel to update or null to disconnect|
|self_mute|boolean|no|false|Whether the client should mute itself|
|self_deaf|boolean|no|false|Whether the client should deafen itself|
|wait_for_server|boolean|no|false|Whether the function should wait for `token` and `endpoint` data to arrive \*|
|timeout|number|no|10000|How long to wait before giving up|

\* These two values are received separately in a `VOICE_SERVER_UPDATE` event and they are required to connect to the voice websocket. If `wait_for_server` is set to true, the function will wait for this event to arrive before resolving, however, this event is only sent when connecting or moving to a new voice channel, it will never fire if the client is already connected. The shard does do not know whether the client is connected or not, so to prevent unnecessary timeout errors, the enduser should keep track of existing voice connections by caching voiceStates received in `GUILD_CREATE` events.

&nbsp;

### VoiceStateResult

|parameter|type|description|
|-|-|-|
|guild_id|string|The guild the voice channel belongs to|
|channel_id?|string|The voice channel if connected or null if disconnected|
|user_id|string|The client's user id|
|member?|object|The client's GuildMember object|
|session_id|string|The voice connection's session id|
|deaf|boolean|Whether the client is deafened|
|mute|boolean|Whether the client is muted|
|self_deaf|boolean|Whether the client is self deafened|
|self_mute|boolean|Whether the client is self muted|
|self_stream?|boolean|Whether the client is live (always undefined)|
|self_video|boolean|Whether the client is streaming video (always false)|
|supress|boolean|Whether the client is suppressed|
|request_to_speak_timestamp?|string|ISO timestamp of the last time the client requested to speak|
|token?|string|Token for establishing a new voice websocket (only if wait_for_server is true)|
|endpoint?|string|Endpoint for establishing a new voice websocket (only if wait_for_server is true)|

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
