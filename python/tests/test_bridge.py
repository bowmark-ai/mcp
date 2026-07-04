# Network-free unit tests for the stdio bridge. The remote hop is
# monkeypatched at the call_remote seam; nothing here opens a socket.
#
# Run: cd packages/bowmark-mcp/python && uv run --with pytest --with-editable . pytest -q

import asyncio

import mcp.types as types
import pytest

import bowmark_mcp


def test_target_url_default(monkeypatch):
    monkeypatch.delenv("BOWMARK_MCP_URL", raising=False)
    assert bowmark_mcp.target_url() == bowmark_mcp.DEFAULT_URL


def test_target_url_override_and_blank(monkeypatch):
    monkeypatch.setenv("BOWMARK_MCP_URL", "http://localhost:3001/mcp")
    assert bowmark_mcp.target_url() == "http://localhost:3001/mcp"
    # Blank/whitespace env must not blank the target.
    monkeypatch.setenv("BOWMARK_MCP_URL", "   ")
    assert bowmark_mcp.target_url() == bowmark_mcp.DEFAULT_URL


def test_auth_headers(monkeypatch):
    monkeypatch.delenv("BOWMARK_API_KEY", raising=False)
    assert bowmark_mcp.auth_headers() is None
    monkeypatch.setenv("BOWMARK_API_KEY", "bmk_test123")
    assert bowmark_mcp.auth_headers() == {"X-Bowmark-Key": "bmk_test123"}


def _tool_result(text: str, is_error: bool) -> types.CallToolResult:
    return types.CallToolResult(
        content=[types.TextContent(type="text", text=text)], isError=is_error
    )


def test_call_tool_passes_content_through(monkeypatch):
    async def fake_call_remote(fn):
        return _tool_result('{"status":"ok"}', is_error=False)

    monkeypatch.setattr(bowmark_mcp, "call_remote", fake_call_remote)
    content = asyncio.run(bowmark_mcp.call_tool_impl("ask", {"site": "x.com", "task": "y"}))
    assert len(content) == 1
    assert content[0].text == '{"status":"ok"}'


def test_call_tool_raises_on_upstream_error(monkeypatch):
    async def fake_call_remote(fn):
        return _tool_result("upstream exploded", is_error=True)

    monkeypatch.setattr(bowmark_mcp, "call_remote", fake_call_remote)
    with pytest.raises(RuntimeError, match="upstream exploded"):
        asyncio.run(bowmark_mcp.call_tool_impl("ask", {}))


def test_call_remote_retries_once_then_raises(monkeypatch):
    calls = {"n": 0}

    async def flaky(_fn):
        calls["n"] += 1
        raise ConnectionError("boom")

    monkeypatch.setattr(bowmark_mcp, "_with_remote", flaky)
    with pytest.raises(ConnectionError):
        asyncio.run(bowmark_mcp.call_remote(lambda s: s))
    assert calls["n"] == 2  # exactly one retry


def test_call_remote_retry_succeeds(monkeypatch):
    calls = {"n": 0}

    async def flaky_then_ok(_fn):
        calls["n"] += 1
        if calls["n"] == 1:
            raise ConnectionError("boom")
        return "ok"

    monkeypatch.setattr(bowmark_mcp, "_with_remote", flaky_then_ok)
    assert asyncio.run(bowmark_mcp.call_remote(lambda s: s)) == "ok"
    assert calls["n"] == 2


def test_error_text_flattens_and_falls_back():
    r = _tool_result("", is_error=True)
    assert bowmark_mcp.error_text(r, "ask") == "ask failed upstream"
    r2 = types.CallToolResult(
        content=[
            types.TextContent(type="text", text="a"),
            types.TextContent(type="text", text="b"),
        ],
        isError=True,
    )
    assert bowmark_mcp.error_text(r2, "ask") == "a; b"
