"""Elastic Agent Builder MCP — McpToolset for ADK agent."""
from __future__ import annotations

import os


def resolve_elastic_mcp_url() -> str | None:
    explicit = (os.environ.get("ELASTIC_MCP_URL") or "").strip()
    if explicit:
        return explicit.rstrip("/")

    kibana = (os.environ.get("ELASTIC_KIBANA_URL") or "").strip().rstrip("/")
    if kibana:
        return f"{kibana}/api/agent_builder/mcp"

    return None


def resolve_elastic_api_key() -> str | None:
    return (
        os.environ.get("ELASTIC_MCP_API_KEY")
        or os.environ.get("ELASTIC_API_KEY")
        or ""
    ).strip() or None


def is_elastic_mcp_configured() -> bool:
    return bool(resolve_elastic_mcp_url() and resolve_elastic_api_key())


def get_elastic_mcp_toolset():
    """Returns McpToolset or None if Elastic MCP is not configured."""
    if not is_elastic_mcp_configured():
        return None

    from google.adk.tools.mcp_tool import McpToolset, StreamableHTTPConnectionParams

    url = resolve_elastic_mcp_url()
    api_key = resolve_elastic_api_key()
    return McpToolset(
        connection_params=StreamableHTTPConnectionParams(
            url=url,
            headers={"Authorization": f"ApiKey {api_key}"},
        )
    )


async def probe_elastic_mcp() -> dict:
    """Runtime probe via httpx (no ADK required)."""
    import httpx

    url = resolve_elastic_mcp_url()
    api_key = resolve_elastic_api_key()
    if not url or not api_key:
        return {"configured": False, "reachable": False, "tools": []}

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"ApiKey {api_key}",
    }
    payload = {"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(url, json=payload, headers=headers)
            if res.status_code != 200:
                return {"configured": True, "reachable": False, "status": res.status_code}
            data = res.json()
            tools = data.get("result", {}).get("tools", [])
            names = [t.get("name") for t in tools if isinstance(t, dict)]
            return {"configured": True, "reachable": True, "tools": names}
    except Exception as exc:
        return {"configured": True, "reachable": False, "error": str(exc)}
