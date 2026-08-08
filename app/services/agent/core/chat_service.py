import json
from typing import AsyncIterator

from constants.system_prompt import SYSTEM_PROMPT
from gateways import get_azure_gateway, get_conversation_gateway, get_mcp_gateway
from models.chat import ActionsChunk, DeltaChunk, ProcessAction, StreamChunk

from .actions import collect_actions
from .streaming import ToolCallAccumulator
from .tool_mapper import to_openai_tool, tool_result_to_text


def _system_prompt(mcp_instructions: str | None) -> str:
    if mcp_instructions:
        return f"{SYSTEM_PROMPT}\n\n{mcp_instructions}"
    return SYSTEM_PROMPT


async def stream_turn(conversation_id: str, user_message: str, user_jwt: str) -> AsyncIterator[StreamChunk]:
    azure = get_azure_gateway()
    mcp_gateway = get_mcp_gateway()
    conversations = get_conversation_gateway()

    async with mcp_gateway.session(user_jwt) as (session, init):
        tools = [to_openai_tool(tool_definitions) for tool_definitions in (await session.list_tools()).tools]

        messages = await conversations.load(conversation_id)
        if messages is None:
            messages = [{"role": "system", "content": _system_prompt(getattr(init, "instructions", None))}]
        messages.append({"role": "user", "content": user_message})

        actions: dict[str, ProcessAction] = {}
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
                    yield DeltaChunk(delta=delta.content)
                if delta and delta.tool_calls:
                    calls.add(delta.tool_calls)
                if choice.finish_reason:
                    finish_reason = choice.finish_reason

            if finish_reason != "tool_calls" or not calls:
                if assistant_text:
                    messages.append({"role": "assistant", "content": assistant_text})
                break

            await _resolve_tool_round(session, messages, assistant_text, calls.ordered(), actions)

        if actions:
            yield ActionsChunk(actions=list(actions.values()))

        await conversations.save(conversation_id, messages)


async def _resolve_tool_round(
    session,
    messages: list[dict],
    assistant_text: str,
    ordered_calls: list[dict],
    actions: dict[str, ProcessAction],
) -> None:
    messages.append(
        {
            "role": "assistant",
            "content": assistant_text or None,
            "tool_calls": [
                {
                    "id": chat_completion["id"],
                    "type": "function",
                    "function": {"name": chat_completion["name"], "arguments": chat_completion["args"] or "{}"},
                }
                for chat_completion in ordered_calls
            ],
        }
    )

    for call in ordered_calls:
        try:
            args = json.loads(call["args"] or "{}")
            result = await session.call_tool(call["name"], args)
            output = tool_result_to_text(result)
            collect_actions(call["name"], output, actions)
        except Exception as error:
            output = json.dumps({"error": str(error)}, ensure_ascii=False)
        messages.append({"role": "tool", "tool_call_id": call["id"], "content": output})
