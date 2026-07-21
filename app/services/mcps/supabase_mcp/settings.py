from pydantic_settings import BaseSettings
from pydantic import SecretStr
from functools import lru_cache


class AppSettings(BaseSettings):
    supabase_url: str
    supabase_key: SecretStr
    payment_process_schema: SecretStr

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


@lru_cache(maxsize=1)
def get_app_settings() -> AppSettings:
    return AppSettings()
