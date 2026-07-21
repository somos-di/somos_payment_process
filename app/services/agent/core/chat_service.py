import json
from typing import AsyncIterator

from constants.system_prompt import SYSTEM_PROMPT
from gateways import get_azure_gateway, get_mcp_gateway

from .streaming import ToolCallAccumulator
from .tool_mapper import to_openai_tool, tool_result_to_text


def _system_prompt(mcp_instructions: str | None) -> str:
    if mcp_instructions:
        return f"{SYSTEM_PROMPT}\n\n{mcp_instructions}"
    return SYSTEM_PROMPT


async def stream_turn(history: list[dict], user_message: str, user_jwt: str) -> AsyncIterator[str]:
    azure = get_azure_gateway()
    mcp = get_mcp_gateway()

    async with mcp.session(user_jwt) as (session, init):
        tools = [to_openai_tool(t) for t in (await session.list_tools()).tools]
        messages: list[dict] = [
            {"role": "system", "content": _system_prompt(getattr(init, "instructions", None))},
            *history,
            {"role": "user", "content": user_message},
        ]

        while True:
            calls = ToolCallAccumulator()
            assistant_text = ""
            finish_reason = None

            stream = await azure.stream_chat(messages, tools)
            async for chunk in stream:
                if not chunk.choices:
                    continue
                choice = chunk.choices[0]
                delta = choice.delta
                if delta and delta.content:
                    assistant_text += delta.content
                    yield delta.content
                if delta and delta.tool_calls:
                    calls.add(delta.tool_calls)
                if choice.finish_reason:
                    finish_reason = choice.finish_reason

            if finish_reason != "tool_calls" or not calls:
                break

            await _resolve_tool_round(session, messages, assistant_text, calls.ordered())


async def _resolve_tool_round(session, messages: list[dict], assistant_text: str, ordered_calls: list[dict]) -> None:
    messages.append(
        {
            "role": "assistant",
            "content": assistant_text or None,
            "tool_calls": [
                {
                    "id": c["id"],
                    "type": "function",
                    "function": {"name": c["name"], "arguments": c["args"] or "{}"},
                }
                for c in ordered_calls
            ],
        }
    )

    for call in ordered_calls:
        try:
            args = json.loads(call["args"] or "{}")
            result = await session.call_tool(call["name"], args)
            output = tool_result_to_text(result)
        except Exception as exc:
            output = json.dumps({"error": str(exc)}, ensure_ascii=False)
        messages.append({"role": "tool", "tool_call_id": call["id"], "content": output})
