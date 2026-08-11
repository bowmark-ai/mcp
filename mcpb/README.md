# `mcpb` — the Bowmark desktop extension

> **This directory is PUBLIC.** `.github/workflows/release-bowmark-mcp.yml` mirrors the
> whole of `packages/bowmark-mcp/` to [bowmark-ai/mcp](https://github.com/bowmark-ai/mcp),
> and that repo is the link the MCPB submission form asks for. Write nothing here you
> would not publish. Internal notes — the submission's answers, the org check, the
> verification log — live in the channel dossier, which is not mirrored:
> [`marketing/distribution/channels/mcpb-desktop-extension.md`](../../../marketing/distribution/channels/mcpb-desktop-extension.md).

An [MCPB](https://github.com/modelcontextprotocol/mcpb) bundle is a zip that Claude
desktop installs in one click. This one wraps the published `@bowmark/mcp` stdio bridge
and points it at the hosted Bowmark MCP, so a desktop user gets the same three tools
without pasting a URL into settings.

```bash
bash packages/bowmark-mcp/mcpb/build.sh     # → dist/bowmark.mcpb
```

Then double-click it with Claude installed.

## The one failure mode, and it is silent

`mcp_config.env.BOWMARK_MCP_URL` is the whole trick. The bridge reads it
([`../node/src/bridge.ts`](../node/src/bridge.ts)) and **falls back to
`https://api.bowmark.ai/mcp/npm` when unset**, so dropping that one env var would file
every desktop install under the npm bridge and nothing would look broken.

The same shape one level up: the api must already know the `mcpb` path segment when the
first install lands. An unrecognized segment does **not** 404 — the route falls through
to plain detection, which is correct behaviour for a typo'd URL and useless as a smoke
test. A bogus segment answers exactly like a real one:

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -X POST https://api.bowmark.ai/mcp/zzz-nonsense
# 406 — same as /mcp/mcpb, same as /mcp. Proves nothing.
```

## Why the URL is unpinned

The bundle only installs into the Claude desktop apps, so pinning the destination to that
host looks obviously right and is wrong: the bridge relays the real host as
`X-Bowmark-Client` on every proxied request, and the api ranks that above its own
handshake. A pin would override a signal that is already correct.

## What is in the zip

| File | Note |
|---|---|
| `manifest.json` | `version` is `0.0.0` in git and stamped from the vendored bridge at build time. There is no bundle version to invent — the bundle *is* that bridge. |
| `server/index.js` | One line: `import "@bowmark/mcp/cli"`. No second copy of the bridge to drift. |
| `node_modules/` | The **published** `@bowmark/mcp` from npm. ~3.2 MB packed. |
| `icon.png` | Committed here so this directory builds standalone; refreshed from `packages/brand` on every build that can see it. |
| `README.md` | `BUNDLE-README.md`, renamed at build. Its **Privacy Policy** section is mandatory — missing or incomplete policies are an immediate rejection. |

No `user_config`. Bowmark needs no key to start, so there is nothing to prompt for and
the install stays one click. An optional `BOWMARK_API_KEY` field could be added later.

## Two things the MANIFEST spec is strict about

Both fail `mcpb validate`, and both were wrong in the first draft:

- The field is **`manifest_version`**, currently `"0.3"` — not `mcpb_version`, and not
  `"0.1"`. [MANIFEST.md](https://github.com/modelcontextprotocol/mcpb/blob/main/MANIFEST.md).
- **`runtimes.node` is `>=20.0.0`**, matching [`../node/package.json`](../node/package.json)'s
  own `engines`. Claiming `>=22` would narrow compatibility the bridge does not require.

Claude Desktop 1.26832.0 accepts `manifest_version` 0.1 through 0.4.
