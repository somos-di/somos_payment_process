from openai import AsyncAzureOpenAI

from settings import AppSettings


class AzureOpenAIGateway:
    def __init__(self, settings: AppSettings):
        self.settings = settings
        self._client = AsyncAzureOpenAI(
            api_key=settings.azure_openai_api_key.get_secret_value(),
            azure_endpoint=settings.azure_openai_endpoint,
            api_version=settings.azure_openai_api_version,
        )

    async def stream_chat(self, messages: list[dict], tools: list[dict]):
        return await self._client.chat.completions.create(
            model=self.settings.azure_openai_deployment,
            messages=messages,
            tools=tools,
            stream=True,
        )

    async def close(self) -> None:
        await self._client.close()
