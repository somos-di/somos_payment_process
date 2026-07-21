from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings


class AppSettings(BaseSettings):
    azure_openai_api_key: SecretStr
    azure_openai_endpoint: str
    azure_openai_deployment: str
    azure_openai_api_version: str = "2024-10-21"

    supabase_mcp_url: str = "http://localhost:8000/mcp"

    supabase_url: str
    supabase_anon_key: SecretStr

    session_cookie: str = "pp_session"
    refresh_cookie: str = "pp_session_r"

    cors_origin: str = "https://pagamentos.ngrok.dev"
    host: str = "0.0.0.0"
    port: int = 8100

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache(maxsize=1)
def get_app_settings() -> AppSettings:
    return AppSettings()
