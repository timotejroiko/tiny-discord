# IdentifyController

An identify queue manager with lazy gateway fetching and full support for large bot sharding.

Correct queueing of gateway idenfities is essential to ensure fast logins and to avoid disconnections, invalid sessions and other issues, expecially for very large bots.

A proper identify queue has to manage everything from a centralized location, therefore a standalone manager offers some extra flexibilty by allowing this task to be offloaded both locally and remotely.

This class requires the [RestClient](RestClient.md) component from this library to communicate with the Discord API when needed.

&nbsp;

## Class IdentifyController

&nbsp;

### constructor

Create a new IdentifyController.

|parameter|type|required|default|description|
|-|-|-|-|-|
|options|[IdentifyControllerOptions](#IdentifyControllerOptions)|yes|-|IdentifyController options|

```js
const controller = new IdentifyController({ token: "owhef2y3n81830x1" })
```

&nbsp;

## Properties

&nbsp;

### rest

The instance of [RestClient](RestClient.md) used by the controller.

**type:** [RestClient](RestClient.md)

&nbsp;

### url

The gateway url obtained from Discord.

**type:** string

&nbsp;

### shards

The total number of shards managed by the controller.

**type:** number

&nbsp;

### shardDelay

The minimum amount of time between each identify bucket.

**type:** number

&nbsp;

### refreshDelay

The minimum amount of time between each gateway refresh.

**type:** number

&nbsp;

### lastRefresh

Timestamp for the last gateway refresh.

**type:** number

&nbsp;

### sessions

The session login limit data from the gateway.

**type:** [SessionLimitsData](#sessionlimitsdata)

&nbsp;

### nextReset

Getter for the next time the gateway login limits will be reset according to the `reset_after` returned by the gateway.

**type:** number

&nbsp;

### nextRefresh

Getter for the next time the gateway session data will be re-fetched according to the `refreshDelay` set by the user.

**type:** number

&nbsp;

## Methods

&nbsp;

### .getGateway()

Obtain the gateway data to create websocket connections. This method automatically refreshes the gateway session data whenever the refresh or reset timers are hit.

**Returns:** Promise\<this\>

```js
const { url, shards, sessions } = await controller.getGateway()
```

&nbsp;

### .requestIdentify(id, wait)

Request permission to identify a specific shard id. If permission is granted, the shard can identify immediately, otherwise it means another shard in the same concurrency bucket already identified within the last `shardDelay` seconds. Due to possible network latency and delays between a permission grant and a successful identify, it is recommended to keep `shardDelay` a little above 5 seconds. This method automatically refreshes the gateway session data whenever the refresh or reset timers are hit. This method is also compatible with the `identifyHook` signature from this library's `WebsocketShard` class.

|parameter|type|required|default|description|
|-|-|-|-|-|
|id|number|yes|-|Shard id to identify|
|wait|boolean|no|false|Whether to wait until permission is granted before returning|

**Returns:** Promise\<[RequestIdentifyResult](#requestidentifyresult)>

```js
const { canIdentify, retryAfter } = await controller.requestIdentify(4);
```

&nbsp;

### .refreshSessionLimits(session?)

Manually refresh the gateway session data if needed. An existing manually fetched session object will be used if given, otherwise a new session object will be fetched from the gateway. Other methods implicitly call this method internally whenever the refresh or reset timers are hit.

|parameter|type|required|default|description|
|-|-|-|-|-|
|session|[SessionLimitsData](#sessionlimitsdata)|no|-|Session limits object|

**Returns:** Promise\<void\>

```js
await controller.refreshSessionLimits();
```

&nbsp;

### .fetchGateway()

Manually fetch the gateway endpoint. Other methods implicitly call this method internally whenever the refresh or reset timers are hit.

**Returns:** Promise\<[GatewayData](#gatewaydata)\>

```js
const data = await controller.fetchGateway()
```

&nbsp;

## Types

&nbsp;

### IdentifyControllerOptions

|parameter|type|required|default|description|
|-|-|-|-|-|
|token|string|yes|-|Your bot's token|
|shards|number|no|0|Total number of shards. If 0 or omitted, the recommended shard number given by Discord will be used|
|shardDelay|number|no|5500|Minimum amount of time between each identify bucket in milliseconds (should never be lower than 5000)|
|refreshDelay|number|no|600000|Minimum amount of time between each gateway refresh in milliseconds \*|
|rest|[RestClient](RestClient.md) \| [RestClientOptions](RestClient.md#RestClientOptions)|no|-|An instance of `RestClient` or an options object to create a new one \*\*|

\* For most use cases fetching the gateway too often is a waste of resources as the session parameters are unlikely to change. But depending on your situation you might want to fetch it more often to keep it up-to-date. For example setting the refreshDelay to match the shardDelay will ensure the gateway will be always be re-fetched on every identify like most other libraries do.

\*\* The IdentifyController uses this library's `RestClient` to fetch the gateway endpoint when needed. An existing instance of `RestClient` will be used if given, otherwise a new one will be created with the given `RestClientOptions` object (token and type will be ignored as they are inherited from the controller options).

&nbsp;

### SessionLimitsData

|parameter|type|description|
|-|-|-|
|total|number|Total number of daily logins|
|remaining|number|Number of daily logins remaining|
|reset_after|number|Time until the next reset (counted from the last refresh)|
|max_concurency|number|Number of concurrent identifies allowed|

&nbsp;

### RequestIdentifyResult

|parameter|type|description|
|-|-|-|
|canIdentify|boolean|Whether the shard has permission to identify immediately|
|retryAfter?|number \| undefined|If permission was denied, how long to wait before retrying|

&nbsp;

### GatewayData

|parameter|type|description|
|-|-|-|
|shards|number|Total number of shards as recommended by Discord|
|url|string|Gateway url as given by Discord|
|session_start_limit|[SessionLimitsData](#sessionlimitsdata)|Session limits and daily login information|

&nbsp;

## Examples

&nbsp;

Managing multiple independent websocket shards:

```js
const { IdentifyController, WebsocketShard } = require("tiny-discord");
const token = "yourbottokenhaha";

const controller = new IdentifyController({ token });

controller.getGateway().then(data => {
    const { url, shards } = data;
    for(let i = 0; i < shards; i++) {
        const shard = new WebsocketShard({
            token,
            shard: i,
            total: shards,
            intents: (1 << 15) - 1, // all intents
            url,
            identifyHook: controller.requestIdentify.bind(controller) // requestIdentify and identifyHook have compatible signatures
        });
        shard.on("ready", () => console.log(`shard ${i} is ready`));
        shard.connect().catch(console.error); // all shards will connect concurrently but their identifies will be queued by the controller
    }
});

```

Managing an InternalSharder with an existing RestClient and a custom number of shards:

```js
const { IdentifyController, InternalSharder, RestClient } = require("tiny-discord");
const token = "yourbottokenhaha";

const rest = new RestClient({ token });
const controller = new IdentifyController({ token, rest, shards: 16 });

controller.getGateway().then(data => {
    const { url, shards } = data;
    const manager = new InternalSharder({
        token,
        intents: (1 << 15) - 1, // all intents
        total: shards,
        options: { url },
        controller
    });
    manager.on("MESSAGE_CREATE", console.log);
    manager.connect();
});
```

Clustering with a centralized login queue via ipc/websocket/rest:

```js
// server
const { IdentifyController, RestClient } = require("tiny-discord");
const token = "yourbottokenhaha";

const rest = new RestClient({ token });
const controller = new IdentifyController({ token, rest });

someServer.on("message", async (req, res) => {
    const data = req.data;
    if(data.type === "identify") {
        const identify = await controller.requestIdentify(data.id, true);
        res(identify);
    }
});

// spawn clients/clusters somehow
```

```js
// clients
const { InternalSharder } = require("tiny-discord");
const token = "yourbottokenhaha";

// get client/cluster identification somehow
const totalShards = process.env.TOTAL
const clusterCount = process.env.CLUSTERS;
const processID = process.env.ID; // example with 0-indexed cluster ids

// build list of shard ids for this client/cluster
const shardsPerCluster = Math.ceil(totalShards / clusterCount);
const list = Array(totalShards).fill(0).map((_, i) => i);
const shardIds = list.slice(shardsPerCluster * processID, shardsPerCluster * processID + shardsPerCluster);

const manager = new InternalSharder({
    token,
    intents: (1 << 15) - 1, // all intents
    total: totalShards,
    ids: shardIds,
    controller: id => someClient.request({ type: "identify", id }); // some promise-based client to request identify from server
});
manager.on("MESSAGE_CREATE", console.log);
manager.connect();
```
