# Tiny Discord

Basic components for interacting with the Discord API with zero dependencies.

The goal of this project is to offer a basic platform for building high-efficiency bots and libraries in NodeJS. Its base components are plug and play standalone files fully written with core NodeJS modules without a single third-party dependency.

Tests and contributions are welcome.

## To Do

- [x] Rest Client
- [x] Interaction Server
- [x] Shard Websocket
- [ ] Voice Websocket?
- [ ] Basic Caching (wip)
- [x] Basic types
- [x] Internal Sharder
- [ ] External Sharder?
- [ ] Ratelimit Manager?
- [x] Docs
- [x] Benchmarks

Not everyting in this list is guaranteed to be done. items in questionmarks are ideas and possibilities but not a priority and not necessarily something that will be part of this project.

## Docs

- Base components (standalone classes with zero dependencies)
  - [RestClient](https://github.com/timotejroiko/tiny-discord/blob/master/docs/RestClient.md)
  - [WebsocketShard](https://github.com/timotejroiko/tiny-discord/blob/master/docs/WebsocketShard.md)
  - [InteractionServer](https://github.com/timotejroiko/tiny-discord/blob/master/docs/InteractionServer.md)
  - Cache (wip)
- Intermediate components (higher level classes built on top of one or more base components)
  - [InternalSharder](https://github.com/timotejroiko/tiny-discord/blob/master/docs/InternalSharder.md)

## Benchmarks

Events per second each library can process.

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

## LICENSE

MIT
