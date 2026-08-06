# @bowmark/mcp — Bowmark MCP over stdio (Node)

Bowmark turns the interaction-gated web into a **callable function library**.
An agent reads the library (`get_library`), writes a short JavaScript script
against it, and sends it to `run` — Bowmark executes it on the live sites in a
sandbox and hands back the result. The canonical server is hosted, streamable
HTTP, no auth required: `https://api.bowmark.ai/mcp`.

This package is a **thin stdio bridge** to that hosted server, for MCP hosts
whose client only speaks stdio, in Node-flavored environments. Tool schemas,
descriptions, and results pass through verbatim — the hosted server stays the
single source of truth; nothing is reimplemented here. (Python-flavored
environments: the same bridge exists on PyPI as `bowmark-mcp` — `uvx
bowmark-mcp`. The npm name is scoped and the PyPI one is not, deliberately —
PyPI cannot be scoped and has no rename mechanism.)

**Renamed from `bowmark-mcp` on 2026-08-05.** That name still works: it is
published from [`../node-compat/`](../node-compat/) as a package whose `bin`
re-execs this one. Nothing breaks, and nothing is unpublished.

`mcp-name: ai.bowmark/bowmark`

## Use

```sh
npx @bowmark/mcp
```

Any MCP host config:

```json
{ "mcpServers": { "bowmark": { "command": "npx", "args": ["@bowmark/mcp"] } } }
```

Installed globally, the command is **`bowmark`**, not `bowmark-mcp`:

```sh
npm i -g @bowmark/mcp && bowmark
```

`npx @bowmark/mcp` works despite the mismatch because npm falls back to a
package's only bin when no bin matches the requested name. **Do not add a second
bin here** — that fallback is what makes the documented install line resolve, and
a second entry silently breaks it. `bowmark-mcp` is the FORWARDER's bin and may
not also be this package's: when both declared it, installing the forwarder
linked `node_modules/.bin/bowmark-mcp` at THIS cli (npm hoists a transitive
dependency's bin over the direct one, and says nothing), so the forwarder's
notice silently never printed. Measured 2026-08-05.
`tests/unit/mcp-stdio-node.test.ts` holds both halves.

If your host speaks streamable HTTP, skip this bridge and connect directly to
`https://api.bowmark.ai/mcp`.

## Environment

| Var | Meaning |
|---|---|
| `BOWMARK_MCP_URL` | Target MCP URL. Default `https://api.bowmark.ai/mcp/npm` (the `/npm` destination attributes the install to this bridge). Point at `http://localhost:3001/mcp` for a local Bowmark API. |
| `BOWMARK_API_KEY` | Optional. Forwarded as `X-Bowmark-Key`; a free key (bowmark.ai dashboard) lifts the anonymous per-IP daily cap to your plan budget. |

## Design notes (repo-internal)

- **One remote session per request, retried once.** The hosted MCP is
  stateless, so a fresh connection is semantically identical and its cost (one
  initialize round-trip) is noise next to a `run` that drives real browsers — and it
  sidesteps long-lived-connection failure modes without reconnect bookkeeping.
  Mirrors `packages/bowmark-mcp/python` (the PyPI bridge) exactly.
- **The real host's name is relayed upstream.** The api tailors its operating
  guidance per host and detects the host from `clientInfo` on the handshake —
  but through a bridge that names the BRIDGE, so every install here would read
  the platform-neutral text. So the host's own `clientInfo.name` (from OUR stdio
  handshake) is forwarded as `X-Bowmark-Client` on every proxied request, and the
  api ranks that above its own handshake. Best-effort: an unknown or missing name
  simply falls back to the neutral text, never an error.
- **Pass-through only.** No tool logic lives here; the agent-surfaces sync
  rule in the root CLAUDE.md is unaffected because descriptions/schemas ride
  through from `apps/api/src/routes/mcp.ts`. `callTool` results are returned
  verbatim (content, structuredContent, isError).
- **The `/npm` destination** is registered in
  `apps/api/src/mcp-destinations.ts` + `mcp-registry/sources.json` (npm stdio
  bridge channel; the PyPI bridge is `/pypi`). It carries the channel and
  deliberately pins NO platform, because the relayed `X-Bowmark-Client` above is
  a better answer than any pin. The old `?s=n` query form still resolves for
  installs already in the wild. Adding a destination:
  `.claude/rules/mcp-destinations.md`.
- **npm ownership verification needs BOTH markers — the registry checks the
  published package.json, not just the README.** The `mcp-name:
  ai.bowmark/bowmark` line above and the `"mcpName": "ai.bowmark/bowmark"`
  field in `package.json` are both load-bearing; don't remove either. Learned
  the hard way 2026-07-04: `release-mcp.yml`'s registry republish failed for
  five straight api releases (`server returned status 400: ... "NPM package
  'bowmark-mcp' is missing required 'mcpName' field"`) because only the
  README marker was present — the package.json field is what `mcp-publisher
  publish` actually validates against the live npm package.
- **Versioning is manual** (thin bridge, not the api): bump `package.json`
  when it changes. Not wired into release-please; `private` is deliberately
  absent so npm publish works — release-please doesn't manage this package.
  Three manifests move together and `gate:facts-agree` refuses a skew: this
  one, `../python/pyproject.toml` (the bridges are interchangeable by
  contract), and `../node-compat/package.json` plus its `@bowmark/mcp`
  dependency pin (a forwarder on an old version silently serves an old bridge
  to everyone who never migrated).
- **`exports` is load-bearing and narrow on purpose.** `./cli` exists so
  `node-compat/bin/bowmark-mcp.mjs` can `import("@bowmark/mcp/cli")` as a
  declared entry point rather than deep-importing someone's `dist/`. Adding
  `exports` at all closed off every other subpath — which is the intent, but it
  means a new consumer needs a new entry here, not just a new file.

## Tests

Network-free unit tests live in the monorepo suite:
`tests/unit/mcp-stdio-node.test.ts` (`pnpm test:unit`). The remote hop is
injected at the `callRemote`/`buildServer` seams.

## Publishing to npm

**Live since 2026-07-04** (published by CI + cold-verified via
`npx -y bowmark-mcp` against prod, back when that was this package's own
name). To ship a version: **bump `version` in `package.json` (and the two
`version` literals in `src/bridge.ts`, and `../node-compat/package.json`'s
version AND its `@bowmark/mcp` pin, and `../python/pyproject.toml`) and
merge.** The actual publish does NOT run in this monorepo's CI — this repo
is private, and npm Trusted Publishing (OIDC) validates against
`package.json`'s `repository.url`, which (correctly) points at the public
mirror `github.com/bowmark-ai/mcp`, not `Metroxe/bowmark`. So merging here
only lands the version bump; `release-bowmark-mcp.yml` mirror-syncs it to
`bowmark-ai/mcp`, and THAT repo's own `.github/workflows/publish.yml`
(source-controlled at
[`packages/bowmark-mcp/.github/workflows/publish.yml`](../.github/workflows/publish.yml)
in this monorepo, mirrored in like any other file) does the real `npm
publish`. Auth is npm **Trusted Publishing** (OIDC) — no token, configured
on npmjs.com (package Settings → Trusted Publisher → GitHub Actions, repo
`bowmark-ai/mcp`, workflow `publish.yml`). Publishing from the public
mirror also auto-generates provenance attestations, which npm only produces
for public-repo publishes — impossible from this private monorepo
regardless of `repository.url`. Not release-please; the bump IS the release
action.

`mcp-registry/server.json` carries the matching npm `packages` entry (landed
after the first publish per the mcp-name ordering rule), and the website
stdio tab's Node step points at `npx @bowmark/mcp`.

**The scoped name needs its own trusted-publisher configuration.** OIDC trust
is per PACKAGE, not per org, and npm cannot configure a trusted publisher for
a package that does not exist — so `@bowmark/mcp` has to be reserved by a
manual first publish and then configured, exactly the way Phase 8 of
`docs/plans/public-types-package.md` did for `@bowmark/web`. Until that
happens the `npm` job here fails on auth, and it is a registry-configuration
problem rather than a workflow one. The forwarder in `../node-compat/`
publishes under the EXISTING `bowmark-mcp` name and keeps its existing trust
configuration, so it is unaffected.
