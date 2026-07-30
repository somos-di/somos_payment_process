import json

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

from settings import get_app_settings
from gateways import lifespan, get_auth_gateway
from core.chat_service import stream_turn
from models.chat import ChatRequest

settings = get_app_settings()

app = FastAPI(title="Somos Agent", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict:
    return {"ok": True}


@app.post("/chat")
async def chat(body: ChatRequest, request: Request):
    access = request.cookies.get(settings.session_cookie)
    refresh = request.cookies.get(settings.refresh_cookie)
    try:
        user_jwt = await get_auth_gateway().get_fresh_jwt(access, refresh)
    except PermissionError as error:
        return JSONResponse(status_code=401, content={"error": str(error)})

    async def sse():
        try:
            async for token in stream_turn(body.conversation_id, body.message, user_jwt):
                yield f"data: {json.dumps({'delta': token}, ensure_ascii=False)}\n\n"
            yield "event: done\ndata: {}\n\n"
        except Exception as error:
            logger.exception("Falha no /chat")
            yield f"data: {json.dumps({'error': str(error)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        sse(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=False)
