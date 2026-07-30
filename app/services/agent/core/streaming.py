class ToolCallAccumulator:
    def __init__(self) -> None:
        self._calls: dict[int, dict] = {}

    def add(self, delta_tool_calls) -> None:
        for tool_call in delta_tool_calls:
            slot = self._calls.setdefault(tool_call.index, {"id": "", "name": "", "args": ""})
            if tool_call.id:
                slot["id"] = tool_call.id
            if tool_call.function and tool_call.function.name:
                slot["name"] = tool_call.function.name
            if tool_call.function and tool_call.function.arguments:
                slot["args"] += tool_call.function.arguments

    def __bool__(self) -> bool:
        return bool(self._calls)

    def ordered(self) -> list[dict]:
        return [self._calls[index] for index in sorted(self._calls)]
