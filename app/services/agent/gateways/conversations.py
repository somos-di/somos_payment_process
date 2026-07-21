import json

import redis.asyncio as redis

from settings import AppSettings


class ConversationGateway:
    def __init__(self, settings: AppSettings):
        self.settings = settings
        self._redis = redis.from_url(settings.redis_url, decode_responses=True)
        self._ttl = settings.conversation_ttl_seconds

    def _key(self, conversation_id: str) -> str:
        return f"agent:conv:{conversation_id}"

    async def load(self, conversation_id: str) -> list[dict] | None:
        raw = await self._redis.get(self._key(conversation_id))
        return json.loads(raw) if raw else None

    async def save(self, conversation_id: str, messages: list[dict]) -> None:
        await self._redis.set(
            self._key(conversation_id),
            json.dumps(messages, ensure_ascii=False),
            ex=self._ttl,
        )

    async def reset(self, conversation_id: str) -> None:
        await self._redis.delete(self._key(conversation_id))

    async def close(self) -> None:
        await self._redis.aclose()
