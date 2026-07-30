from fastmcp.tools import Tool
from mcp.types import ToolAnnotations
from fastmcp.dependencies import Depends
from pydantic import BaseModel, Field

from gateways import get_supabase_gateway, SupabaseGateway
from tools.dependencies import get_user_jwt


class InstallmentInput(BaseModel):
    due_date: str = Field(description="Vencimento da parcela no formato YYYY-MM-DD")
    value: float = Field(description="Valor da parcela (número, ex.: 1500.00)")


async def create_process(
    company: str,
    building: str,
    kind_id: int,
    value: float,
    installments: list[InstallmentInput],
    composition: str | None = None,
    supply: str | None = None,
    person_id: int | None = None,
    doc_kind_id: int | None = None,
    fiscal_doc: str | None = None,
    issue_date: str | None = None,
    is_urgent: bool = False,
    description: str | None = None,
    supabase_gateway: SupabaseGateway = Depends(get_supabase_gateway),
    user_jwt: str = Depends(get_user_jwt),
) -> dict:

    process = {
        "description_prc": description,
        "company_prc": company,
        "building_prc": building,
        "composition_prc": composition,
        "supply_prc": supply,
        "person_prc": person_id,
        "kind_prc": kind_id,
        "doc_kind_prc": doc_kind_id,
        "is_urgent_prc": is_urgent,
        "issue_date_prc": issue_date,
        "due_date_prc": installments[0].due_date if installments else None,
        "value_prc": value,
        "fiscal_doc_prc": fiscal_doc,
    }
    installments_payload = [
        {"due_date_ins": index.due_date, "value_ins": index.value} for index in installments
    ]
    return await supabase_gateway.create_process(user_jwt, process, installments_payload)


tools = (
    Tool.from_function(
        create_process,
        name="create_process",
        description=(
            "Cria um processo de pagamento (com parcelas) para o usuário logado. "
            "ANTES de chamar, confirme com o usuário: empresa, obra, apropriação, fornecedor, "
            "tipo, valor total e parcelas. A soma das parcelas deve ser igual ao valor total."
        ),
        tags={"Supabase", "Processos", "Pagamentos"},
        annotations=ToolAnnotations(
            readOnlyHint=False,
            destructiveHint=False,
            idempotentHint=False,
            openWorldHint=True,
        ),
    ),
)
