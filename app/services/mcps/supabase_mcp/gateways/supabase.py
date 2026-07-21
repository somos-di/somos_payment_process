from postgrest import APIError
from supabase import create_async_client, AsyncClient
from supabase.lib.client_options import AsyncClientOptions

from settings import AppSettings


class SupabaseGateway:
    def __init__(self, settings: AppSettings):
        self.settings = settings
        self._supabase_client: AsyncClient = create_async_client(
            self.settings.supabase_url,
            self.settings.supabase_key.get_secret_value(),
            options=AsyncClientOptions(
                schema=self.settings.payment_process_schema.get_secret_value()
            ),
        )

    async def get_process(self, process_id: str, user_jwt: str):
        self._supabase_client.postgrest.auth(user_jwt)

        try:
            response = await self._supabase_client.table("processes").select("*").eq("uuid_prc", process_id).maybe_single().execute()
        except APIError as e:
            raise Exception(f"Failed to fetch process: {e.message}") from e

        return response.data
