from fastmcp.tools import Tool
from mcp.types import ToolAnnotations
from fastmcp.dependencies import Depends

from gateways import get_supabase_gateway, SupabaseGateway
from tools.dependencies import get_user_jwt

_READ_ONLY = ToolAnnotations(
    readOnlyHint=True,
    destructiveHint=False,
    idempotentHint=True,
    openWorldHint=True,
)
_TAGS = {"Supabase", "Processos", "Pagamentos"}


async def list_processes(
    supplier: str | None = None,
    company: str | None = None,
    status: str | None = None,
    urgent: bool | None = None,
    due_before: str | None = None,
    due_after: str | None = None,
    overdue: bool = False,
    limit: int = 30,
    supabase_gateway: SupabaseGateway = Depends(get_supabase_gateway),
    user_jwt: str = Depends(get_user_jwt),
) -> list[dict] | str:
    rows = await supabase_gateway.list_processes(
        user_jwt,
        supplier=supplier,
        company=company,
        status=status,
        urgent=urgent,
        due_before=due_before,
        due_after=due_after,
        overdue=overdue,
        limit=limit,
    )
    return rows or "Nenhum processo encontrado com esses critérios (dentro do seu acesso)."


async def my_pending_approvals(
    supabase_gateway: SupabaseGateway = Depends(get_supabase_gateway),
    user_jwt: str = Depends(get_user_jwt),
) -> list[dict] | str:
    rows = await supabase_gateway.my_pending_approvals(user_jwt)
    return rows or "Você não tem nenhum processo aguardando a sua aprovação."


async def process_details(
    id_prc: int,
    supabase_gateway: SupabaseGateway = Depends(get_supabase_gateway),
    user_jwt: str = Depends(get_user_jwt),
) -> dict | str:
    process = await supabase_gateway.get_process_by_id(user_jwt, id_prc)
    if not process:
        return f"Processo {id_prc} não encontrado (ou fora do seu acesso)."
    uuid = process.get("uuid_prc")
    return {
        "processo": process,
        "ja_aprovaram": await supabase_gateway.get_completed_approvals(user_jwt, uuid),
        "podem_aprovar": await supabase_gateway.get_eligible_approvers(user_jwt, uuid),
        "historico": await supabase_gateway.get_process_history(user_jwt, uuid),
    }


async def processes_overview(
    supabase_gateway: SupabaseGateway = Depends(get_supabase_gateway),
    user_jwt: str = Depends(get_user_jwt),
) -> dict:
    return await supabase_gateway.processes_overview(user_jwt)


async def search_suppliers(
    term: str | None = None,
    supabase_gateway: SupabaseGateway = Depends(get_supabase_gateway),
    user_jwt: str = Depends(get_user_jwt),
) -> list[dict] | str:
    suppliers = await supabase_gateway.search_suppliers(user_jwt, term)
    return suppliers or "Nenhum fornecedor encontrado."


tools = (
    Tool.from_function(
        list_processes,
        name="list_processes",
        description=(
            "Consulta os processos de pagamento que o usuário PODE VER (o RLS já limita ao acesso dele). "
            "Filtros opcionais, combináveis: `supplier` (nome do fornecedor), `company` (nome da empresa), "
            "`status` (texto do status, ex.: 'financeiro', 'aprovação', 'correção'), `urgent` (true/false), "
            "`due_before`/`due_after` (vencimento, YYYY-MM-DD), `overdue` (true = já vencidos até hoje), "
            "`limit` (padrão 30). Datas relativas (hoje/ontem/esta semana) você converte para YYYY-MM-DD antes. "
            "Retorna id_prc, fornecedor, empresa, obra, tipo, valor, status, urgente, vencimento e descrição. "
            "Use para: processos de um fornecedor, urgentes, a vencer, vencidos, por empresa/status."
        ),
        tags=_TAGS,
        annotations=_READ_ONLY,
    ),
    Tool.from_function(
        my_pending_approvals,
        name="my_pending_approvals",
        description=(
            "Lista os processos que estão aguardando a aprovação DO PRÓPRIO usuário logado agora. "
            "Use quando ele perguntar 'o que tenho para aprovar', 'minhas aprovações pendentes' etc."
        ),
        tags=_TAGS,
        annotations=_READ_ONLY,
    ),
    Tool.from_function(
        process_details,
        name="process_details",
        description=(
            "Detalha UM processo pelo número visível `id_prc` (ex.: 285): dados do processo, "
            "quem JÁ APROVOU (ja_aprovaram), quem AINDA PODE aprovar (podem_aprovar) e o histórico recente. "
            "Use para 'como está o processo X', 'quem já aprovou o X', 'em que etapa está'."
        ),
        tags=_TAGS,
        annotations=_READ_ONLY,
    ),
    Tool.from_function(
        processes_overview,
        name="processes_overview",
        description=(
            "Resumo com contagens do que o usuário vê: aguardando a minha aprovação, urgentes, "
            "vencendo em 7 dias e vencidos. Use para visão geral: 'como está o geral', 'quantos venceram', "
            "'tenho muita coisa pendente?'."
        ),
        tags=_TAGS,
        annotations=_READ_ONLY,
    ),
    Tool.from_function(
        search_suppliers,
        name="search_suppliers",
        description=(
            "Busca fornecedores por nome/CPF/CNPJ. Use quando o nome do fornecedor for ambíguo, antes de "
            "filtrar processos por ele. Para listar os processos do fornecedor, prefira list_processes(supplier=<nome>)."
        ),
        tags=_TAGS,
        annotations=_READ_ONLY,
    ),
)
