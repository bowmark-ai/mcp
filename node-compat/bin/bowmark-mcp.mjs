#!/usr/bin/env node
// The `bowmark-mcp` npm name, kept alive forever.
//
// The bridge itself moved to `@bowmark/mcp` on 2026-08-05. This package is the
// old name continuing to work: npm cannot be unpublished past 72h, `npm
// deprecate` only WARNS and never blocks an install, and there is no "moved"
// mechanism on npm at all — so a forwarder is the only thing that actually
// preserves compatibility for the configs already in the wild.
// `.claude/rules/agent-surfaces.md` § Published packages cannot be unpublished.
//
// Two properties this file exists to hold:
//
//   - **stdout belongs to the protocol.** The notice goes to stderr. A single
//     stray byte on stdout desynchronises the JSON-RPC framing and the host
//     drops the server with no useful error.
//   - **The real CLI is imported IN-PROCESS, never spawned.** A child process
//     would need stdio, signal and exit-code plumbing to be transparent, and
//     every one of those is a way for a stdio transport to break. An import
//     shares this process's own stdio by construction.
//
// `@bowmark/mcp` declares `./cli` in its `exports` map precisely so this line
// is a supported entry point rather than a deep import into someone's dist/.
// No em dash in this string: it is outbound copy, read by everyone who installs
// the old name. Root CLAUDE.md, "no em dashes in outbound-to-others content".
console.error(
  "bowmark-mcp: this package now forwards to @bowmark/mcp. Point your config at `npx @bowmark/mcp` (same bridge, same behaviour).",
);

await import("@bowmark/mcp/cli");
