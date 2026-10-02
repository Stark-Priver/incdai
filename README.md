<p align="center"><strong>incdai</strong></p>

<h1 align="center">Your AI. Your data. Your node.</h1>

<p align="center">Public interfaces for INCPRITECH's sovereign, decentralized AI runtime.<br>Voice, grounded knowledge, and agents in English and Swahili.</p>

<p align="center"><a href="https://incdai.incpritech.com">Website</a> · <a href="https://incdai.incpritech.com/docs/">Documentation</a> · <a href="https://incdai.incpritech.com/try/">Live demo</a> · <a href="https://incpritech.com">INCPRITECH</a></p>

## One system, three products

| Product | What it is | Status |
| --- | --- | --- |
| **incdai Public** | The managed service operated by INCPRITECH. Add chat and voice to a website without running infrastructure. | Production |
| **incdai Node** | A user-controlled runtime for a device, private server, or independent compute provider. Your knowledge and configuration stay under your control. | Private preview |
| **incdai Network** | The open protocol through which independent nodes describe capabilities and expose compatible APIs. | Protocol preview |

The managed service is one convenient node, not the definition of the network. Applications use the same public API whether they connect to incdai Public or an authorized incdai Node.

## What is public here

This repository deliberately contains only the interoperability surface:

- the browser and server JavaScript SDK;
- the embeddable website widget;
- the incdai HTTP and live-voice protocol;
- the incdai Node manifest schema;
- integration examples and public documentation.

INCPRITECH's inference engine, retrieval implementation, cloud orchestration, voice orchestration, agent runtime, security controls, and production deployment logic are not published here.

## Add incdai Public to a website

```html
<script
  src="https://api.incdai.incpritech.com/widget.js"
  data-api="https://api.incdai.incpritech.com"
  data-site="your-site"
  async
></script>
```

## Use the public SDK

```js
import { Incdai } from "https://api.incdai.incpritech.com/sdk.js";

const assistant = new Incdai({
  api: "https://api.incdai.incpritech.com",
  site: "your-site",
});

for await (const text of assistant.stream("What services do you offer?")) {
  process.stdout.write(text);
}
```

To use an authorized independent node, replace `api` with that node's HTTPS origin. See the [protocol overview](protocol/README.md).

## Decentralization principles

- **User choice:** applications can choose managed, private, local, or independent compute.
- **Data control:** knowledge is not replicated to community nodes by default.
- **Portable interfaces:** one API and widget work across compatible deployments.
- **Provider independence:** a node may use local models or an operator-selected provider.
- **Honest identity:** every node declares its operator, capabilities, region, privacy mode, and protocol version.
- **No compulsory token:** decentralization starts with independent operation and interoperability, not financial speculation.

## Licence

The contents of this repository are source-available under the [PolyForm Perimeter License 1.0.1](LICENSE). Permitted use is free, including internal business use and integration into non-competing products. Selling, rebranding, hosting, or providing a competing incdai product requires a separate [commercial licence](COMMERCIAL-LICENSE.md).

This is not an OSI-approved open-source licence because it protects the product against competitive resale. Versions previously published by INCPRITECH under MIT remain available under the terms attached to those versions; the new licence does not retroactively change earlier grants.

Copyright © 2026 INCPRITECH. Made in Tanzania.
