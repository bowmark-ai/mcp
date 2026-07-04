# bowmark-mcp — Bowmark MCP over stdio (Node)

Bowmark gives agents pre-computed navigation recipes for public websites (skip
explore-and-discover). The canonical server is hosted, streamable HTTP, no auth
required: `https://api.bowmark.ai/mcp`.

This package is a **thin stdio bridge** to that hosted server, for MCP hosts
whose client only speaks stdio, in Node-flavored environments. Tool schemas,
descriptions, and results pass through verbatim — the hosted server stays the
single source of truth; nothing is reimplemented here. (Python-flavored
environments: the same bridge exists on PyPI as `bowmark-mcp` — `uvx
bowmark-mcp`.)

`mcp-name: ai.bowmark/bowmark`

## Use

```sh
npx bowmark-mcp
```

Any MCP host config:

```json
{ "mcpServers": { "bowmark": { "command": "npx", "args": ["bowmark-mcp"] } } }
```

If your host speaks streamable HTTP, skip this bridge and connect directly to
`https://api.bowmark.ai/mcp`.

## Environment

| Var | Meaning |
|---|---|
| `BOWMARK_MCP_URL` | Target MCP URL. Default `https://api.bowmark.ai/mcp?s=n` (`?s=n` attributes the install to the npm bridge). Point at `http://localhost:3001/mcp` for a local Bowmark API. |
| `BOWMARK_API_KEY` | Optional. Forwarded as `X-Bowmark-Key`; a free key (bowmark.ai dashboard) raises the anonymous per-IP daily synthesis cap to your plan budget. |

## Design notes (repo-internal)

- **One remote session per request, retried once.** The hosted MCP is
  stateless, so a fresh connection is semantically identical and its cost (one
  initialize round-trip) is noise next to an `ask` synthesis — and it
  sidesteps long-lived-connection failure modes without reconnect bookkeeping.
  Mirrors `packages/bowmark-mcp/python` (the PyPI bridge) exactly.
- **Pass-through only.** No tool logic lives here; the agent-surfaces sync
  rule in the root CLAUDE.md is unaffected because descriptions/schemas ride
  through from `apps/api/src/routes/mcp.ts`. `callTool` results are returned
  verbatim (content, structuredContent, isError).
- **`?s=n` source code** is registered in `apps/api/src/mcp-sources.ts` +
  `mcp-registry/sources.json` (npm stdio bridge channel; the PyPI bridge is
  `?s=p`).
- **The `mcp-name: ai.bowmark/bowmark` line above is load-bearing**: the
  official MCP Registry validates npm package ownership by finding that
  marker in the package README. Don't remove it.
- **Versioning is manual** (thin bridge, not the api): bump `package.json`
  when it changes. Not wired into release-please; `private` is deliberately
  absent so npm publish works — release-please doesn't manage this package.

## Tests

Network-free unit tests live in the monorepo suite:
`tests/unit/mcp-stdio-node.test.ts` (`pnpm test:unit`). The remote hop is
injected at the `callRemote`/`buildServer` seams.

## Publishing to npm

**Live since 2026-07-04** (published by CI + cold-verified via
`npx -y bowmark-mcp` against prod). To ship a version: **bump `version` in
`package.json` (and the two `version` literals in `src/bridge.ts`)
and merge** — `.github/workflows/publish-bowmark-mcp.yml` compares the
manifest against live npm on every merge touching this folder and publishes
only when the version is new. Auth is npm **Trusted Publishing** (OIDC) —
no token, configured on npmjs.com (package Settings → Trusted Publisher →
GitHub Actions, repo `Metroxe/bowmark`, workflow `publish-bowmark-mcp.yml`).
The job must run on a GitHub-hosted runner (npm's OIDC rejects self-hosted)
with npm ≥ 11.5.1. Not release-please; the bump IS the release action.

`mcp-registry/server.json` carries the matching npm `packages` entry (landed
after the first publish per the mcp-name ordering rule), and the website
stdio tab's Node step points at `npx bowmark-mcp`.
