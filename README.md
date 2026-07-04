# bowmark-mcp — the Bowmark MCP over stdio

[Bowmark](https://bowmark.ai) gives agents pre-computed navigation recipes for
public websites (skip explore-and-discover). The canonical server is hosted,
streamable HTTP, no auth required: `https://api.bowmark.ai/mcp`.

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
(optional — raises the anonymous per-IP daily synthesis cap; free key at
[bowmark.ai](https://bowmark.ai)).

---

This repo is a one-way mirror of `packages/bowmark-mcp/` in Bowmark's private
monorepo — issues and PRs are welcome here and get carried upstream by the
maintainers.
