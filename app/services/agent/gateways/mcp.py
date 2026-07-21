from contextlib import asynccontextmanager

import httpx
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client

from settings import AppSettings


class McpGateway:
    def __init__(self, settings: AppSettings):
        self.settings = settings

    @asynccontextmanager
    async def session(self, user_jwt: str):
        http_client = httpx.AsyncClient(
            headers={"Authorization": f"Bearer {user_jwt}"},
            timeout=httpx.Timeout(30.0, read=None),
        )
        async with http_client:
            async with streamable_http_client(
                self.settings.supabase_mcp_url,
                http_client=http_client,
            ) as (read, write, _):
                async with ClientSession(read, write) as session:
                    init = await session.initialize()
                    yield session, init
