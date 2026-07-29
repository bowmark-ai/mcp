# bowmark-mcp — the Bowmark MCP over stdio

[Bowmark](https://bowmark.ai) turns the interaction-gated web into a **callable
function library**. An agent reads the library (`get_library`), writes a short
JavaScript script against it, and sends it to `run` — Bowmark executes it on the
live sites in a sandbox and hands back the result. The canonical server is
hosted, streamable HTTP, no auth required: `https://api.bowmark.ai/mcp`.

Some MCP hosts only speak **stdio** — browser-use, and many self-built agent
stacks. This repo holds two thin stdio bridges to the same hosted server, one
per ecosystem, both published as `bowmark-mcp`:

| Runtime | Install | Source |
|---|---|---|
| Python | `uvx bowmark-mcp` (PyPI) | [`python/`](python/) |
| Node | `npx bowmark-mcp` (npm) | [`node/`](node/) |

Both are verbatim pass-throughs: tool schemas, descriptions, and results come
from the hosted server at runtime, so the bridges never lag the api and there
is no logic here to audit beyond "forward the request." Pick whichever runtime
your environment already has; they are interchangeable.

```json
{ "mcpServers": { "bowmark": { "command": "uvx", "args": ["bowmark-mcp"] } } }
```

```json
{ "mcpServers": { "bowmark": { "command": "npx", "args": ["bowmark-mcp"] } } }
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
