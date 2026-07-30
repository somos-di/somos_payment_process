import calendar
import math
from datetime import date

from fastmcp.tools import Tool
from mcp.types import ToolAnnotations


def _add_months(base: date, months: int) -> date:
    total = base.month - 1 + months
    year = base.year + total // 12
    month = total % 12 + 1
    day = min(base.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


async def split_installments(total: float, count: int, first_due_date: str) -> list[dict]:
    if count < 1:
        raise ValueError("count deve ser >= 1")
    first = date.fromisoformat(first_due_date)
    base_value = math.floor(total / count * 100) / 100
    accumulated = 0.0
    result: list[dict] = []
    for index in range(count):
        value = round(total - accumulated, 2) if index == count - 1 else base_value
        accumulated = round(accumulated + value, 2)
        result.append({"due_date": _add_months(first, index).isoformat(), "value": value})
    return result


tools = (
    Tool.from_function(
        split_installments,
        name="split_installments",
        description=(
            "Divide um valor total em N parcelas mensais a partir da 1ª data de vencimento "
            "(first_due_date no formato YYYY-MM-DD). Retorna [{due_date, value}] com a última "
            "parcela ajustada para somar exatamente o total. Use antes de create_process."
        ),
        tags={"Pagamentos", "Parcelas"},
        annotations=ToolAnnotations(
            readOnlyHint=True,
            destructiveHint=False,
            idempotentHint=True,
            openWorldHint=False,
        ),
    ),
)
