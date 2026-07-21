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


async def get_process_kinds(
    supabase_gateway: SupabaseGateway = Depends(get_supabase_gateway),
    user_jwt: str = Depends(get_user_jwt),
) -> list[dict] | str:
    kinds = await supabase_gateway.get_launchable_kinds(user_jwt)
    return kinds or "Nenhum tipo de processo disponível para este usuário."


async def get_document_kinds(
    supabase_gateway: SupabaseGateway = Depends(get_supabase_gateway),
    user_jwt: str = Depends(get_user_jwt),
) -> list[dict] | str:
    kinds = await supabase_gateway.get_document_kinds(user_jwt)
    return kinds or "Nenhum tipo de documento encontrado."


async def get_companies(
    search: str | None = None,
    supabase_gateway: SupabaseGateway = Depends(get_supabase_gateway),
    user_jwt: str = Depends(get_user_jwt),
) -> list[dict] | str:
    companies = await supabase_gateway.get_companies(user_jwt, search)
    return companies or "Nenhuma empresa encontrada."


async def get_buildings(
    company: str,
    supabase_gateway: SupabaseGateway = Depends(get_supabase_gateway),
    user_jwt: str = Depends(get_user_jwt),
) -> list[dict] | str:
    buildings = await supabase_gateway.get_buildings(user_jwt, company)
    return buildings or f"Nenhuma obra encontrada para a empresa {company}."


async def get_appropriations(
    company: str,
    building: str,
    search: str | None = None,
    supabase_gateway: SupabaseGateway = Depends(get_supabase_gateway),
    user_jwt: str = Depends(get_user_jwt),
) -> list[dict] | str:
    rows = await supabase_gateway.get_appropriations(user_jwt, company, building, search)
    return rows or "Nenhuma composição/insumo encontrada."


async def search_suppliers(
    term: str | None = None,
    supabase_gateway: SupabaseGateway = Depends(get_supabase_gateway),
    user_jwt: str = Depends(get_user_jwt),
) -> list[dict] | str:
    suppliers = await supabase_gateway.search_suppliers(user_jwt, term)
    return suppliers or "Nenhum fornecedor encontrado."


async def get_eligible_approvers(
    process_uuid: str,
    supabase_gateway: SupabaseGateway = Depends(get_supabase_gateway),
    user_jwt: str = Depends(get_user_jwt),
) -> list[dict] | str:
    rows = await supabase_gateway.get_eligible_approvers(user_jwt, process_uuid)
    return rows or "Ninguém elegível para aprovar (ou processo fora do seu acesso)."


tools = (
    Tool.from_function(
        get_process_kinds,
        name="get_process_kinds",
        description="Lista os tipos de processo que o usuário pode lançar. Use id_pkn (o CÓDIGO) como kind_id; mostre name_pkn ao usuário, mas NUNCA passe o nome adiante.",
        tags=_TAGS,
        annotations=_READ_ONLY,
    ),
    Tool.from_function(
        get_document_kinds,
        name="get_document_kinds",
        description="Lista os tipos de documento. Use id_dck (o CÓDIGO) como doc_kind_id; mostre name_dck ao usuário, nunca passe o nome.",
        tags=_TAGS,
        annotations=_READ_ONLY,
    ),
    Tool.from_function(
        get_companies,
        name="get_companies",
        description="Lista até 10 empresas (as 10 primeiras, ou filtradas por `search`). Se o usuário já disse o nome, SEMPRE passe `search` com esse termo para achar a exata. Cada item tem `codigo` (o ID que vai no processo) e `nome` (a descrição que você mostra ao usuário). Use o `codigo` como company_prc; NUNCA o nome.",
        tags=_TAGS,
        annotations=_READ_ONLY,
    ),
    Tool.from_function(
        get_buildings,
        name="get_buildings",
        description="Lista TODAS as obras de uma empresa (são poucas). `company` DEVE ser o `codigo` da empresa (o ID, de get_companies), NUNCA o nome. Cada item tem `codigo` (o ID, ex.: RERV3, que vai como building_prc) e `nome` (a descrição, ex.: URBANITY KASA RESORT, que você mostra ao usuário). Use o `codigo`.",
        tags=_TAGS,
        annotations=_READ_ONLY,
    ),
    Tool.from_function(
        get_appropriations,
        name="get_appropriations",
        description=(
            "Lista as 10 primeiras apropriações da empresa/obra. `company` e `building` DEVEM ser os "
            "CÓDIGOS (de get_companies/get_buildings), NÃO os nomes. Cada item vem como "
            "{composition, supply, label}: `composition` e `supply` são os CÓDIGOS que você passa "
            "para create_process; `label` é só para mostrar ao usuário. Se a apropriação desejada não "
            "estiver nas 10, chame de novo passando `search` com o termo descrito pelo usuário."
        ),
        tags=_TAGS,
        annotations=_READ_ONLY,
    ),
    Tool.from_function(
        search_suppliers,
        name="search_suppliers",
        description="Busca fornecedores por nome/CPF/CNPJ. Retorna (id, nome, cpf_cnpj); use o `id` (CÓDIGO) como person_id, nunca o nome.",
        tags=_TAGS,
        annotations=_READ_ONLY,
    ),
    Tool.from_function(
        get_eligible_approvers,
        name="get_eligible_approvers",
        description="Lista quem pode/falta aprovar um processo. Passe o process_uuid (o uuid_prc devolvido por create_process).",
        tags=_TAGS,
        annotations=_READ_ONLY,
    ),
)
