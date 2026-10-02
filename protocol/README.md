# incdai Network protocol preview

The incdai Network protocol lets an application discover what an independent incdai Node can do and then use the same API contract as incdai Public.

## Roles

- **Client:** a website, application, CLI, or agent connecting to an assistant.
- **Node:** an independently operated incdai-compatible runtime.
- **Directory:** an optional index of node manifests. A directory is a convenience, not a trust authority.
- **incdai Public:** the managed production service operated by INCPRITECH.

## Discovery

A node publishes a manifest at:

```text
GET /.well-known/incdai-node.json
```

The response follows [`node-manifest.schema.json`](node-manifest.schema.json). It declares identity and capabilities but must never contain provider credentials, private knowledge, customer site identifiers, or internal network addresses.

## Compatible API surface

Version 1 clients use these public endpoints:

```text
GET  /healthz
GET  /.well-known/incdai-node.json
GET  /widget.js
GET  /sdk.js
GET  /v1/sites/{site}/config
POST /v1/sites/{site}/ask
POST /v1/sites/{site}/leads
POST /v1/sites/{site}/transcribe
POST /v1/sites/{site}/speak
GET  /v1/sites/{site}/live    WebSocket
```

The detailed request and event contract is in [`http-api.md`](http-api.md).

## Privacy boundary

Joining the network does not make an assistant's knowledge public. A site owner deliberately places knowledge on a chosen node. Nodes do not synchronize profiles, questions, leads, conversations, credentials, or model prompts through the discovery protocol.

## Trust model

The preview protocol is declarative: operators are responsible for the claims in their manifest. Signed manifests, portable encrypted assistant bundles, client-side node selection, reputation, and multi-directory discovery are planned before the network is described as generally available.
