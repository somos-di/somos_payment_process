from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    message: str
    conversation_id: str = Field(default="default")


class ProcessAction(BaseModel):
    id: int
    uuid: str
    empresa: str | None = None
    obra: str | None = None
    valor: float | None = None
    vencimento: str | None = None
    descricao: str | None = None


class DeltaChunk(BaseModel):
    delta: str


class ActionsChunk(BaseModel):
    actions: list[ProcessAction]


StreamChunk = DeltaChunk | ActionsChunk
