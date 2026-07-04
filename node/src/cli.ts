#!/usr/bin/env node
// stdout belongs to the protocol; anything human goes to stderr.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "./bridge.js";

const server = buildServer();
await server.connect(new StdioServerTransport());
