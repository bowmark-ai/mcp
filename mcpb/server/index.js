#!/usr/bin/env node
// The bundle's entry point. It is a one-line re-export on purpose: the server
// itself is `@bowmark/mcp`, published to npm from the public bowmark-ai/mcp
// mirror and vendored into ../node_modules by the build. Nothing here is
// bundle-specific except the file's existence, so there is no second copy of
// the bridge to drift from the published one.
//
// The destination lives in manifest.json's `mcp_config.env.BOWMARK_MCP_URL`,
// not here, because the manifest is what Claude actually reads when it spawns
// this process.
import "@bowmark/mcp/cli";
