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
- [ ] Internal Sharder (wip)
- [ ] External Sharder?
- [ ] Ratelimit Manager?
- [x] Docs
- [ ] Benchmarks

Not everyting in this list is guaranteed to be done. items in questionmarks are ideas and possibilities but not a priority and not necessarily something that will be part of this project.

## Docs

- Base components (standalone classes with zero dependencies)
  - [RestClient](https://github.com/timotejroiko/tiny-discord/blob/master/docs/RestClient.md)
  - [WebsocketShard](https://github.com/timotejroiko/tiny-discord/blob/master/docs/WebsocketShard.md)
  - [InteractionServer](https://github.com/timotejroiko/tiny-discord/blob/master/docs/InteractionServer.md)
  - Cache (wip)
- Intermediate components (higher level classes built on top of one or more base components)
  - [InternalSharder](https://github.com/timotejroiko/tiny-discord/blob/master/docs/InternalSharder.md)

## LICENSE

TDB
