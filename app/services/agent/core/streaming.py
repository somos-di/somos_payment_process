class ToolCallAccumulator:
    def __init__(self) -> None:
        self._calls: dict[int, dict] = {}

    def add(self, delta_tool_calls) -> None:
        for tc in delta_tool_calls:
            slot = self._calls.setdefault(tc.index, {"id": "", "name": "", "args": ""})
            if tc.id:
                slot["id"] = tc.id
            if tc.function and tc.function.name:
                slot["name"] = tc.function.name
            if tc.function and tc.function.arguments:
                slot["args"] += tc.function.arguments

    def __bool__(self) -> bool:
        return bool(self._calls)

    def ordered(self) -> list[dict]:
        return [self._calls[i] for i in sorted(self._calls)]
