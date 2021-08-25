# WebsocketShard

A barebones gateway shard to receive real-time events from discord.

Supports all gateway features including etf encoding and zlib compression.

Automatic reconnection is done only for resuming, other disconnections must be handled by the user.

Shard-specific rate limits are accounted for and requests will be rejected before they are sent if hit.

&nbsp;

## Api

### constructor

```js
const shard = new WebsocketShard(options)
```

|parameter|type|required|default|description|
|-|-|-|-|-|
|options|[ShardOptions](#ShardOptions)|yes|-|Shard options|

&nbsp;

## Types

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

\* Etf is up to 10% smaller than json but 60% slower to unpack. Generally json encoding is recommended unless saving bandwidth is a priority.

\*\* 0 = no compression, 1 = packet compression, 2 = transport compression. Packet compression is about 80% smaller but 25% slower to unpack. Transport compression is about 85% smaller and up to 10% slower to unpack. Generally transport compression is highly recommended, the bandwidth savings are huge and the performance impact is very small.

\*\*\* If both session and sequence are defined, the shard will attempt to resume. If resuming is successful, the `resumed` event will be fired instead of `ready`. If resuming is unsuccessful, the shard is closed with an Invalid Session error and the session data is cleared.

## Examples

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
