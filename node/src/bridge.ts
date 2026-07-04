// Bowmark MCP stdio bridge (Node) — the npm twin of packages/bowmark-mcp/python (PyPI).
//
// A thin stdio MCP server that proxies every request to the hosted Bowmark
// MCP (streamable HTTP, https://api.bowmark.ai/mcp). Exists for stdio-only
// MCP hosts in Node-flavored environments: they run `npx bowmark-mcp` and get
// the exact hosted tools — schemas, descriptions, and envelopes pass through
// verbatim, so the hosted server stays the single source of truth and this
// package never needs a re-publish when the api's tools change.
//
// Env:
//   BOWMARK_MCP_URL  Target MCP URL. Default https://api.bowmark.ai/mcp?s=n
//                    (`?s=n` tags the install source as the npm bridge;
//                    point at http://localhost:3001/mcp for a local API).
//   BOWMARK_API_KEY  Optional key, forwarded as X-Bowmark-Key. Omit for the
//                    anonymous tier.
//
// Design note — one remote session PER REQUEST, retried once. The hosted MCP
// is stateless and auth-free, so a fresh connection is semantically identical
// to a held one, costs one initialize round-trip (noise next to an `ask`
// synthesis), and sidesteps every long-lived-connection failure mode (idle
// HTTP timeouts, half-open sockets) without reconnect bookkeeping. Mirrors
// the Python bridge's contract exactly.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

export const DEFAULT_URL = "https://api.bowmark.ai/mcp?s=n";

export function targetUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.BOWMARK_MCP_URL?.trim() || DEFAULT_URL;
}

/** Optional API key -> X-Bowmark-Key header (the hosted MCP also accepts
 * Authorization: Bearer; one header is enough). */
export function authHeaders(env: NodeJS.ProcessEnv = process.env): Record<string, string> | undefined {
  const key = env.BOWMARK_API_KEY?.trim();
  return key ? { "X-Bowmark-Key": key } : undefined;
}

async function withRemote<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ name: "bowmark-mcp-bridge", version: "1.0.1" });
  const headers = authHeaders();
  const transport = new StreamableHTTPClientTransport(new URL(targetUrl()), {
    requestInit: headers ? { headers } : undefined,
  });
  await client.connect(transport);
  try {
    return await fn(client);
  } finally {
    await client.close().catch(() => {});
  }
}

/** One retry on any failure: the remote is stateless, so a fresh session is
 * equivalent, and a transient network blip shouldn't fail the host's call. */
export async function callRemote<T>(
  fn: (client: Client) => Promise<T>,
  connect: typeof withRemote = withRemote,
): Promise<T> {
  try {
    return await connect(fn);
  } catch (first) {
    console.error(`bowmark-mcp: retrying after: ${String(first)}`);
    return await connect(fn);
  }
}

export function buildServer(remote: typeof callRemote = callRemote): Server {
  const server = new Server(
    { name: "bowmark", version: "1.0.1" },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return await remote((c) => c.listTools());
  });
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    // Returned verbatim — content, structuredContent, and isError all ride
    // through, so upstream errors reach the host exactly as the api sent them.
    return await remote((c) =>
      c.callTool({ name: req.params.name, arguments: req.params.arguments ?? {} }),
    );
  });
  return server;
}
