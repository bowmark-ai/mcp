# bowmark-mcp — compatibility forwarder

**The bridge moved to [`@bowmark/mcp`](https://www.npmjs.com/package/@bowmark/mcp).**
This package is the old name, kept working.

```jsonc
// what you have: still works, prints one notice on stderr
{ "mcpServers": { "bowmark": { "command": "npx", "args": ["bowmark-mcp"] } } }

// what to move to
{ "mcpServers": { "bowmark": { "command": "npx", "args": ["@bowmark/mcp"] } } }
```

Nothing else changes: same bridge, same tools, same endpoint, same version
number. `bin/bowmark-mcp.mjs` imports `@bowmark/mcp/cli` in-process and that is
the whole package. In-process rather than spawned, because a child would need
stdio, signal and exit-code plumbing to be transparent, and every one of those
is a way for a stdio transport to break.

**PyPI did not move.** `uvx bowmark-mcp` is unchanged, and it is now the
*blessed* name there: PEP 752 standardises hyphen-prefixed namespaces rather
than `@scope`, and PyPI has no rename, alias or redirect mechanism at all. Only
npm is scoped.

## Why a forwarder rather than `npm deprecate`

`npm deprecate` provides a warning to anyone who installs the package. It warns,
it never blocks, and npm has no "moved" mechanism at all. The name has real
traffic (3,032 npm installs in the month to 2026-07-28) and every published
config, registry listing and benchmark harness names it, so the old name has to
keep *working*, not merely warn. `npm deprecate bowmark-mcp` is run as well: it
is the notice, this package is the compatibility.

It is never deleted and never unpublished.

## Versioning

The forwarder's `version` and its `@bowmark/mcp` dependency are pinned to the
canonical package's version, exactly. A forwarder on an older version would
silently serve an older bridge to everyone who never migrated, which is the one
thing it exists to prevent. Both pins are checked in CI upstream.
