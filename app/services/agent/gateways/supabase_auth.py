import base64
import json
import time

import httpx

from settings import AppSettings


class SupabaseAuthGateway:
    _LEEWAY_SECONDS = 60

    def __init__(self, settings: AppSettings):
        self.settings = settings
        self._http = httpx.AsyncClient(timeout=10)

    @staticmethod
    def _jwt_exp(token: str) -> int | None:
        try:
            payload = token.split(".")[1]
            payload += "=" * (-len(payload) % 4)
            return json.loads(base64.urlsafe_b64decode(payload)).get("exp")
        except Exception:
            return None

    async def get_fresh_jwt(self, access_token: str | None, refresh_token: str | None) -> str:
        expires_at = self._jwt_exp(access_token) if access_token else None
        if access_token and expires_at and (expires_at - time.time()) > self._LEEWAY_SECONDS:
            return access_token

        if not refresh_token:
            raise PermissionError("Sessão ausente ou expirada. Faça login novamente.")

        anonymous_client = self.settings.supabase_anon_key.get_secret_value()
        response = await self._http.post(
            f"{self.settings.supabase_url}/auth/v1/token",
            params={"grant_type": "refresh_token"},
            headers={"apikey": anonymous_client, "Content-Type": "application/json"},
            json={"refresh_token": refresh_token},
        )
        if response.status_code != 200:
            raise PermissionError("Falha ao renovar a sessão. Faça login novamente.")
        return response.json()["access_token"]

    async def close(self) -> None:
        await self._http.aclose()
