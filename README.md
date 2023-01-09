# Tiny Discord

A high performance zero dependency raw library for interacting with the Discord API.

This project aims to provide a basic platform for building high-efficiency bots and libraries in NodeJS. Its base components are plug and play standalone files fully written with core node.js modules, without a single third-party dependency, and consistently outperform other more established solutions.

Tests and contributions are welcome.

## To Do

- [x] Rest Client
- [x] Interaction Server
- [x] Shard Websocket
- [x] Identify Controller
- [ ] Voice Websocket?
- [ ] Basic Caching?
- [x] Basic types
- [x] Internal Sharder
- [ ] External Sharder
- [ ] Ratelimit Manager?
- [x] Docs
- [x] Benchmarks

Not everyting in this list is guaranteed to be done. items in questionmarks are ideas and possibilities but not a priority and not necessarily something that will be part of this project.

## Docs

- Base components (standalone classes with zero dependencies)
  - [RestClient](https://github.com/timotejroiko/tiny-discord/blob/master/docs/RestClient.md) - An http client for interacting with the discord rest API.
  - [WebsocketShard](https://github.com/timotejroiko/tiny-discord/blob/master/docs/WebsocketShard.md) - A websocket client to receive real-time events from discord.
  - [InteractionServer](https://github.com/timotejroiko/tiny-discord/blob/master/docs/InteractionServer.md) - A webhook server for receiving Discord interactions.
- Utility components (higher level classes built on top of one or more base components)
  - [InternalSharder](https://github.com/timotejroiko/tiny-discord/blob/master/docs/InternalSharder.md) - A utility class to manage multiple websocket shards
  - [IdentifyController](https://github.com/timotejroiko/tiny-discord/blob/master/docs/IdentifyController.md) - A utility class to manage gateway identifies

## Benchmarks

The following benchmark shows how many events per second can each library process with a single shard. It demonstrates the performance advantages of using the raw discord data directly as opposed to transforming it into complex classes and structures.

|test/lib|discord.js|eris|detritus|tiny-discord|
|-|-|-|-|-|
|guilds json|976|1346|803|2479|
|guilds json+zlib|949|1403|716|2601|
|guilds etf|681|705|500|2147|
|guilds etf+zlib|602|808|514|1943|
|messages json|29482|31759|8081|56917|
|messages json zlib|25986|22898|5271|39353|
|messages etf|17684|18003|7505|30621|
|messages etf zlib|15562|14559|4005|26631|

Full benchmark can be found here: [https://github.com/timotejroiko/discord-websocket-benchmark](https://github.com/timotejroiko/discord-websocket-benchmark)

## Sponsors

<p align="center">Special thanks to our sponsors!</p>

## LICENSE

This project is licensed under MIT, which basically means you can do anything you want with it, i only ask that you include a small copyright notice and a link to this repo in a comment in your source code.
