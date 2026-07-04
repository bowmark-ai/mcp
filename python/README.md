# bowmark-mcp — Bowmark MCP over stdio

Bowmark gives agents pre-computed navigation recipes for public websites (skip
explore-and-discover). The canonical server is hosted, streamable HTTP, no auth
required: `https://api.bowmark.ai/mcp`.

This package is a **thin stdio bridge** to that hosted server, for MCP hosts
whose client only speaks stdio (for example browser-use's `MCPClient`). Tool
schemas, descriptions, and results pass through verbatim — the hosted server
stays the single source of truth; nothing is reimplemented here.
(Node-flavored environments: the same bridge exists on npm as `bowmark-mcp` —
`npx bowmark-mcp`, `packages/bowmark-mcp/node/` in the monorepo.)

`mcp-name: ai.bowmark/bowmark`

## Use

```sh
uvx bowmark-mcp        # or: pipx run bowmark-mcp / python -m bowmark_mcp
```

Example — browser-use:

```python
from browser_use.mcp.client import MCPClient

bowmark = MCPClient(server_name="bowmark", command="uvx", args=["bowmark-mcp"])
```

Example — any MCP host config:

```json
{ "mcpServers": { "bowmark": { "command": "uvx", "args": ["bowmark-mcp"] } } }
```

If your host speaks streamable HTTP, skip this bridge and connect directly to
`https://api.bowmark.ai/mcp`.

## Environment

| Var | Meaning |
|---|---|
| `BOWMARK_MCP_URL` | Target MCP URL. Default `https://api.bowmark.ai/mcp?s=p` (`?s=p` attributes the install to the PyPI bridge). Point at `http://localhost:3001/mcp` for a local Bowmark API. |
| `BOWMARK_API_KEY` | Optional. Forwarded as `X-Bowmark-Key`; a free key (bowmark.ai dashboard) raises the anonymous per-IP daily synthesis cap to your plan budget. |

## Design notes (repo-internal)

- **One remote session per request, retried once.** `streamablehttp_client` is
  an anyio-scoped context manager; holding one session across handler tasks
  trips "exit cancel scope in a different task". The hosted MCP is stateless,
  so a fresh session per request is semantically identical and costs one
  initialize round-trip — noise next to an `ask` synthesis.
- **Pass-through only.** No tool logic lives here; the agent-surfaces sync rule
  in the root CLAUDE.md is unaffected because descriptions/schemas ride through
  from `apps/api/src/routes/mcp.ts`.
- **`?s=p` source code** is registered in `apps/api/src/mcp-sources.ts` +
  `mcp-registry/sources.json` (PyPI stdio bridge channel).
- **The `mcp-name: ai.bowmark/bowmark` line above is load-bearing**: the
  official MCP Registry validates PyPI package ownership by finding that
  marker in the package README. Don't remove it.
- **Versioning is manual** (this is a thin bridge, not the api): bump
  `pyproject.toml` when it changes. Not wired into release-please.

## Tests

```sh
cd packages/bowmark-mcp/python
uv run --with pytest --with-editable . pytest -q
```

Network-free (the remote hop is monkeypatched). A live smoke against prod:

```sh
uv run --with-editable . python - <<'EOF'
import asyncio, bowmark_mcp
async def main():
    tools = await bowmark_mcp.list_tools_impl()
    print([t.name for t in tools])
asyncio.run(main())
EOF
```

## Publishing to PyPI

**Live since 2026-07-03** (v0.1.0, published + cold-verified via
`uvx bowmark-mcp` against prod). To ship a new version: **bump `version` in
`pyproject.toml` and merge** — `.github/workflows/publish-bowmark-mcp.yml`
compares the manifest against live PyPI on every merge touching this folder
and publishes only when the version is new. Auth is PyPI **Trusted
Publishing** (OIDC) — no token, configured on pypi.org (project → Publishing
→ GitHub publisher for `Metroxe/bowmark` / `publish-bowmark-mcp.yml`); `uv
publish` picks it up automatically. Not release-please; the bump IS the
release action. If the registry surface changed, also bump
`packages[0].version` in `mcp-registry/server.json` (rides the next
api-release republish — the registry validates ownership via the `mcp-name`
marker above).

Manual fallback (creds: 1Password item **"PyPI"**, vault
`Christopher-Macbook-CLI`, token in the `Christopher_Bowmark_API_Key` field;
service-account `op read` requires the vault in the path):
`cd packages/bowmark-mcp/python && rm -rf dist && uv build &&
UV_PUBLISH_TOKEN="$(op read 'op://Christopher-Macbook-CLI/PyPI/Christopher_Bowmark_API_Key')" uv publish`
