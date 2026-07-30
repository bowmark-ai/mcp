#!/usr/bin/env node
// stdout belongs to the protocol; anything human goes to stderr.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer, callRemote, fetchInstructions } from "./bridge.js";

// One initialize before we serve, purely to carry the hosted server's
// `instructions` through to the host — they ride on OUR initialize, so they
// cannot be proxied per request the way tools are. Never fatal; see
// fetchInstructions.
const server = buildServer(callRemote, await fetchInstructions());
await server.connect(new StdioServerTransport());
