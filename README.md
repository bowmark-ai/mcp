# bowmark-mcp — the Bowmark MCP over stdio

[Bowmark](https://bowmark.ai) turns the interaction-gated web into a **callable
function library**. An agent reads the library (`get_library`), writes a short
JavaScript script against it, and sends it to `run` — Bowmark executes it on the
live sites in a sandbox and hands back the result. The canonical server is
hosted, streamable HTTP, no auth required: `https://api.bowmark.ai/mcp`.

Some MCP hosts only speak **stdio** — browser-use, and many self-built agent
stacks. This repo holds two thin stdio bridges to the same hosted server, one
per ecosystem:

| Runtime | Install | Source |
|---|---|---|
| Python | `uvx bowmark-mcp` (PyPI) | [`python/`](python/) |
| Node | `npx @bowmark/mcp` (npm) | [`node/`](node/) |
| Node, old name | `npx bowmark-mcp` — a forwarder, still works | [`node-compat/`](node-compat/) |

There is a fourth way in that installs no package at all: [`mcpb/`](mcpb/) packs the Node
bridge into a **`.mcpb` desktop extension**, a zip Claude desktop installs in one click.
It is the same bridge with `BOWMARK_MCP_URL` preset, not a separate implementation.

**The npm package is scoped and the PyPI one is not, deliberately.** npm moved to
`@bowmark/mcp` on 2026-08-05; PyPI cannot be scoped at all (PEP 752 standardises
hyphen-prefixed namespaces, and PyPI has no rename, alias or redirect), so
`bowmark-mcp` there is already the blessed form and is unchanged. The unscoped
npm name is not retired — `node-compat/` publishes it as a package whose `bin`
re-execs the scoped one, because npm cannot be unpublished and `npm deprecate`
only warns. Every config in the wild keeps working; new ones should say
`@bowmark/mcp`.

Both bridges are verbatim pass-throughs: tool schemas, descriptions, and results come
from the hosted server at runtime, so the bridges never lag the api and there
is no logic here to audit beyond "forward the request." Pick whichever runtime
your environment already has; they are interchangeable.

**The one thing that cannot be lazy: `instructions`.** Server-level instructions
ride on the bridge's OWN initialize, which happens before it has talked to the
api, so unlike tools they cannot be fetched per request. Each bridge does one
extra initialize at startup purely to read them and pass them on. That keeps the
hosted server the single source of truth; a hardcoded copy here would drift the
moment the api changed it and could only be fixed by a re-publish. If the fetch
fails the bridge starts without them, because a ranking hint is never worth
refusing to serve over.

```json
{ "mcpServers": { "bowmark": { "command": "uvx", "args": ["bowmark-mcp"] } } }
```

```json
{ "mcpServers": { "bowmark": { "command": "npx", "args": ["@bowmark/mcp"] } } }
```

If your host speaks streamable HTTP, skip the bridge entirely and connect to
`https://api.bowmark.ai/mcp`.

Env (both bridges): `BOWMARK_MCP_URL` (target override), `BOWMARK_API_KEY`
(optional — lifts the anonymous per-IP daily cap; free key at
[bowmark.ai](https://bowmark.ai)).

## 2.0.0 — the tools changed

Bowmark used to return **navigation recipes** for an agent to execute, through
`ask` and `report_outcome`. It now returns a **callable function library** and
runs the script itself. The tools are:

| Before | Now |
|---|---|
| `ask({ site, task })` | `get_library({ query })` — what's callable for this task |
| `report_outcome({ … })` | *(gone — nothing to report; a run returns its own result)* |
| — | `run({ script })` — execute a script against the library |

**The bridges themselves are pass-throughs, so upgrading is not what moves you
across** — they list tools from the hosted server at call time, and 1.x already
sees the new ones. The major bump marks the contract change honestly rather than
letting it arrive silently. If a host cached the old schema and still calls a
retired name, the server answers with a message saying what replaced it; it is
never a silent failure against a dead endpoint.

---

This repo is a one-way mirror of `packages/bowmark-mcp/` in Bowmark's private
monorepo — issues and PRs are welcome here and get carried upstream by the
maintainers.
