from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str
    conversation_id: str = Field(default="default")
