# Bowmark

Do things on live websites: prices, availability, quotes, bookings, anything behind a
form or login.

Bowmark AI reorganizes web functionality into a typed capability library that AI agents
call by writing code, instead of driving a browser page by page. An agent reads the
library over HTTP or through the Bowmark MCP server, writes a short async JavaScript
script against it, and Bowmark executes that script against the live websites and returns
structured data. It covers the parts of the web that have no public API: search boxes,
filters, quote forms, product configurators, availability lookups, checkout and booking
flows, and pages behind a login.

## Install

Double-click `bowmark.mcpb` with Claude installed. There is nothing to configure — no
account, no API key, no runtime beyond the Node that Claude already ships with.

## What it does

| Tool | What it does |
|---|---|
| `get_library` | Check what can be done on a live website for this task. Read-only: it touches no site and changes nothing. |
| `run` | Do the task on the live websites and return the result. This is the tool that acts. |
| `register` | Create a free Bowmark account and return an API key, when the anonymous allowance runs out. |

## Pricing

Free to start — about 1,000 calls a month, no signup and no card. Beyond that it is
usage-based at $5 per 1,000 calls, on one monthly invoice. No plans or tiers; a call is
one Bowmark function your script runs.

## How this bundle works

The bundle is a thin stdio bridge. It runs `@bowmark/mcp` locally and proxies every
request to the hosted Bowmark MCP server at `https://api.bowmark.ai/mcp`. The tools,
their schemas and their results pass through verbatim, so the hosted server stays the
single source of truth. The source of the bridge is
[bowmark-ai/mcp](https://github.com/bowmark-ai/mcp), MIT licensed.

## Privacy Policy

Bowmark's privacy policy is at **<https://bowmark.ai/privacy>**.

What that means for this bundle specifically:

- **This bundle connects to an external first-party service.** Every tool call is
  forwarded to Bowmark's hosted server at `https://api.bowmark.ai`. Nothing is computed
  locally; the local process is a relay.
- **What is sent.** The arguments you pass to a tool — for `run`, the JavaScript script
  itself, and for `get_library`, your query string. Bowmark logs calls to operate and
  bill the service.
- **Third-party websites.** A `run` script reaches the live websites it names. Those are
  third parties Bowmark does not own or control, and their own privacy policies govern
  what they see and record. Bowmark proxies the request; it does not speak for them.
- **Sign-in.** Where a site needs a user signed in, the run pauses and returns a
  single-use link for the person to authenticate themselves on that site. Bowmark never
  asks for, receives or stores that password.
- **No account is required** to use this bundle, and none is created unless you call
  `register`.

Questions, or a deletion request: **<https://bowmark.ai/support>**.

## License

MIT. See [bowmark-ai/mcp](https://github.com/bowmark-ai/mcp).

© 2026 Bowmark AI
