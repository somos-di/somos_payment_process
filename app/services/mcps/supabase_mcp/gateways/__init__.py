from .supabase import SupabaseGateway
from settings import get_app_settings

from contextlib import asynccontextmanager


class GatewayContainer:
    supabase: SupabaseGateway | None = None


gateways = GatewayContainer()


@asynccontextmanager
async def lifespan(_: object):
    settings = get_app_settings()
    gateways.supabase = SupabaseGateway(settings)

    try:
        yield

    finally:
        gateways.supabase.close()


def get_supabase_gateway() -> SupabaseGateway:

    if gateways.supabase is None:
        raise RuntimeError("Supabase gateway is not initialized...")

    return gateways.supabase
