// Bowmark MCP stdio bridge (Node) — the npm twin of packages/bowmark-mcp/python (PyPI).
//
// A thin stdio MCP server that proxies every request to the hosted Bowmark
// MCP (streamable HTTP, https://api.bowmark.ai/mcp). Exists for stdio-only
// MCP hosts in Node-flavored environments: they run `npx @bowmark/mcp` and get
// the exact hosted tools — schemas, descriptions, and envelopes pass through
// verbatim, so the hosted server stays the single source of truth and this
// package never needs a re-publish when the api's tools change.
//
// Env:
//   BOWMARK_MCP_URL  Target MCP URL. Default https://api.bowmark.ai/mcp/npm
//                    (the `/npm` destination attributes the install to this
//                    bridge; point at http://localhost:3001/mcp for a local API).
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
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

export const DEFAULT_URL = "https://api.bowmark.ai/mcp/npm";

export function targetUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.BOWMARK_MCP_URL?.trim() || DEFAULT_URL;
}

/** Optional API key -> X-Bowmark-Key header (the hosted MCP also accepts
 * Authorization: Bearer; one header is enough). */
export function authHeaders(
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> | undefined {
  const key = env.BOWMARK_API_KEY?.trim();
  return key ? { "X-Bowmark-Key": key } : undefined;
}

/** Relay WHICH HOST is really on the other end.
 *
 * The hosted MCP tailors its instructions per host (ChatGPT vs a chat app vs a
 * coding agent), and it detects the host from the `clientInfo` on the
 * handshake. Through this bridge that signal is destroyed: we open our OWN
 * session upstream, so the name the api would see is `bowmark-mcp-bridge` and
 * every install through npm resolves to the platform-neutral text.
 *
 * The real host named itself on OUR stdio handshake, so relay that name on
 * every proxied request. Best-effort: `undefined` before the host has
 * initialized, and the api treats an unrecognized name the same as none. */
export function clientHeaders(hostName: string | undefined): Record<string, string> | undefined {
  const name = hostName?.trim();
  return name ? { "X-Bowmark-Client": name } : undefined;
}

async function withRemote<T>(fn: (client: Client) => Promise<T>, hostName?: string): Promise<T> {
  const client = new Client({ name: "bowmark-mcp-bridge", version: "2.1.0" });
  const headers = { ...authHeaders(), ...clientHeaders(hostName) };
  const transport = new StreamableHTTPClientTransport(new URL(targetUrl()), {
    requestInit: Object.keys(headers).length > 0 ? { headers } : undefined,
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
  hostName?: string,
): Promise<T> {
  try {
    return await connect(fn, hostName);
  } catch (first) {
    console.error(`bowmark-mcp: retrying after: ${String(first)}`);
    return await connect(fn, hostName);
  }
}

/** The hosted server's `instructions` string, fetched with one initialize.
 *
 * Instructions are handed to the host at OUR initialize, which happens before we
 * have talked to the remote — so unlike tools they cannot be lazily proxied per
 * request. Fetching once at startup keeps the hosted server the single source of
 * truth (the alternative, a hardcoded copy here, would drift the moment the api
 * changed it and could only be corrected by an npm re-publish).
 *
 * KNOWN LIMITATION, and it is the reason this is not a bug report: the api tailors
 * its instructions PER HOST, but this fetch happens before any host has connected
 * to us, so we cannot relay a host name yet and the api answers with its
 * platform-neutral text. Tool descriptions, fetched per request once the host HAS
 * identified itself, are correctly per-host. Pinning a destination in
 * BOWMARK_MCP_URL (e.g. .../mcp/cursor) is the way to get tailored instructions
 * through a bridge.
 *
 * Returns undefined on any failure: instructions are a ranking hint, and a
 * bridge that refused to start because a hint was unavailable would be strictly
 * worse than one that starts without it. */
export async function fetchInstructions(
  remote: typeof callRemote = callRemote,
): Promise<string | undefined> {
  try {
    return await remote(async (c) => c.getInstructions());
  } catch (err) {
    console.error(`bowmark-mcp: could not read server instructions: ${String(err)}`);
    return undefined;
  }
}

export function buildServer(remote: typeof callRemote = callRemote, instructions?: string): Server {
  const server = new Server(
    { name: "bowmark", version: "2.1.0" },
    { capabilities: { tools: {} }, instructions },
  );
  // Whoever ran us said who they are on the stdio handshake. Read it per
  // request rather than once: `tools/list` can arrive before the SDK has
  // recorded it, and a fresh read costs nothing.
  const hostName = () => server.getClientVersion()?.name;
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return await remote((c) => c.listTools(), undefined, hostName());
  });
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    // Returned verbatim — content, structuredContent, and isError all ride
    // through, so upstream errors reach the host exactly as the api sent them.
    return await remote(
      (c) => c.callTool({ name: req.params.name, arguments: req.params.arguments ?? {} }),
      undefined,
      hostName(),
    );
  });
  return server;
}
