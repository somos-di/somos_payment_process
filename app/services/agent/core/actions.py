import json

from models.chat import ProcessAction

_ACTIONABLE_TOOLS = {"my_pending_approvals"}


def collect_actions(tool_name: str, output: str, sink: dict[str, ProcessAction]) -> None:
    if tool_name not in _ACTIONABLE_TOOLS:
        return
    for row in _parse_rows(output):
        action = _to_action(row)
        if action is not None:
            sink[action.uuid] = action


def _parse_rows(output: str) -> list[object]:
    try:
        parsed = json.loads(output)
    except (ValueError, TypeError):
        return []
    return parsed if isinstance(parsed, list) else []


def _to_action(row: object) -> ProcessAction | None:
    if not isinstance(row, dict):
        return None
    uuid = row.get("uuid_prc")
    identifier = row.get("id_prc")
    if not uuid or identifier is None:
        return None
    return ProcessAction(
        id=identifier,
        uuid=uuid,
        empresa=row.get("empresa_nome"),
        obra=row.get("obra_nome"),
        valor=row.get("value_prc"),
        vencimento=row.get("due_date_prc"),
        descricao=row.get("description_prc"),
    )
