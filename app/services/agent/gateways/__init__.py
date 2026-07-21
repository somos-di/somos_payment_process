from contextlib import asynccontextmanager

from settings import get_app_settings

from .azure_openai import AzureOpenAIGateway
from .conversations import ConversationGateway
from .mcp import McpGateway
from .supabase_auth import SupabaseAuthGateway


class GatewayContainer:
    azure: AzureOpenAIGateway | None = None
    mcp: McpGateway | None = None
    auth: SupabaseAuthGateway | None = None
    conversations: ConversationGateway | None = None


gateways = GatewayContainer()


@asynccontextmanager
async def lifespan(_: object):
    settings = get_app_settings()
    gateways.azure = AzureOpenAIGateway(settings)
    gateways.mcp = McpGateway(settings)
    gateways.auth = SupabaseAuthGateway(settings)
    gateways.conversations = ConversationGateway(settings)

    try:
        yield
    finally:
        if gateways.azure is not None:
            await gateways.azure.close()
        if gateways.auth is not None:
            await gateways.auth.close()
        if gateways.conversations is not None:
            await gateways.conversations.close()


def get_azure_gateway() -> AzureOpenAIGateway:
    if gateways.azure is None:
        raise RuntimeError("Azure gateway não inicializado.")
    return gateways.azure


def get_mcp_gateway() -> McpGateway:
    if gateways.mcp is None:
        raise RuntimeError("MCP gateway não inicializado.")
    return gateways.mcp


def get_auth_gateway() -> SupabaseAuthGateway:
    if gateways.auth is None:
        raise RuntimeError("Auth gateway não inicializado.")
    return gateways.auth


def get_conversation_gateway() -> ConversationGateway:
    if gateways.conversations is None:
        raise RuntimeError("Conversation gateway não inicializado.")
    return gateways.conversations
