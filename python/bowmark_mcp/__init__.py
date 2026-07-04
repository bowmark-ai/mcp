"""Bowmark MCP stdio bridge.

A thin stdio MCP server that proxies every request to the hosted Bowmark MCP
(streamable HTTP, https://api.bowmark.ai/mcp). Exists for MCP hosts whose
client only speaks stdio (e.g. browser-use's ``MCPClient``): they run
``uvx bowmark-mcp`` and get the exact hosted tools — schemas, descriptions,
and envelopes pass through verbatim, so the hosted server stays the single
source of truth.

Env:
  BOWMARK_MCP_URL   Target MCP URL. Default ``https://api.bowmark.ai/mcp?s=p``
                    (the ``?s=p`` tags the install source as the PyPI bridge;
                    point at ``http://localhost:3001/mcp`` for a local API).
  BOWMARK_API_KEY   Optional Bowmark API key, forwarded as ``X-Bowmark-Key``.
                    Omit for the anonymous tier.

Design note — one remote session PER REQUEST, not one held for the process
lifetime. The MCP Python SDK's ``streamablehttp_client`` is an anyio-scoped
context manager: entering it in one handler task and closing it from another
raises "attempted to exit cancel scope in a different task". Since the hosted
Bowmark MCP is stateless and auth-free, a fresh session per request is
semantically identical, and its cost (one initialize round-trip) is noise next
to an ``ask`` synthesis. Each request still retries once on a transport
failure before surfacing the error.
"""

from __future__ import annotations

import asyncio
import os
import sys
from collections.abc import Awaitable, Callable
from typing import Any, TypeVar

import mcp.types as types
from mcp.client.session import ClientSession
from mcp.client.streamable_http import streamablehttp_client
from mcp.server.lowlevel import Server
from mcp.server.stdio import stdio_server

DEFAULT_URL = "https://api.bowmark.ai/mcp?s=p"

T = TypeVar("T")


def target_url() -> str:
    return os.environ.get("BOWMARK_MCP_URL", "").strip() or DEFAULT_URL


def auth_headers() -> dict[str, str] | None:
    """Optional API key -> X-Bowmark-Key header (the hosted MCP also accepts
    Authorization: Bearer; one header is enough)."""
    key = os.environ.get("BOWMARK_API_KEY", "").strip()
    return {"X-Bowmark-Key": key} if key else None


async def _with_remote(fn: Callable[[ClientSession], Awaitable[T]]) -> T:
    async with streamablehttp_client(target_url(), headers=auth_headers()) as (
        read,
        write,
        _,
    ):
        async with ClientSession(read, write) as session:
            await session.initialize()
            return await fn(session)


async def call_remote(fn: Callable[[ClientSession], Awaitable[T]]) -> T:
    """One retry on any failure: the remote is stateless, so a fresh session is
    equivalent, and a transient network blip shouldn't fail the host's call."""
    try:
        return await _with_remote(fn)
    except Exception as first:
        print(f"bowmark-mcp: retrying after: {first}", file=sys.stderr)
        return await _with_remote(fn)


def error_text(result: types.CallToolResult, name: str) -> str:
    """Flatten an isError result's text content for re-raising locally."""
    texts = [c.text for c in result.content if isinstance(c, types.TextContent)]
    return "; ".join(t for t in texts if t) or f"{name} failed upstream"


async def list_tools_impl() -> list[types.Tool]:
    res = await call_remote(lambda s: s.list_tools())
    return res.tools


async def call_tool_impl(name: str, arguments: dict[str, Any] | None) -> list[Any]:
    result = await call_remote(lambda s: s.call_tool(name, arguments or {}))
    # The lowlevel server wraps a raised exception as an isError result with
    # the exception text, so upstream errors round-trip with their message.
    if result.isError:
        raise RuntimeError(error_text(result, name))
    return list(result.content)


def build_server() -> Server:
    server = Server("bowmark")
    server.list_tools()(list_tools_impl)
    server.call_tool()(call_tool_impl)
    return server


async def _serve() -> None:
    server = build_server()
    async with stdio_server() as (read, write):
        await server.run(read, write, server.create_initialization_options())


def main() -> None:
    # stdout belongs to the protocol; anything human goes to stderr.
    asyncio.run(_serve())


if __name__ == "__main__":
    main()
