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
    supabase_gateway: SupabaseGateway = Depends(get_supabase_gateway),
    user_jwt: str = Depends(get_user_jwt),
) -> list[dict] | str:
    companies = await supabase_gateway.get_companies(user_jwt)
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
    supabase_gateway: SupabaseGateway = Depends(get_supabase_gateway),
    user_jwt: str = Depends(get_user_jwt),
) -> list[dict] | str:
    rows = await supabase_gateway.get_appropriations(user_jwt, company, building)
    return rows or "Nenhuma composição/insumo encontrada para esta empresa/obra."


async def search_suppliers(
    term: str | None = None,
    supabase_gateway: SupabaseGateway = Depends(get_supabase_gateway),
    user_jwt: str = Depends(get_user_jwt),
) -> list[dict] | str:
    suppliers = await supabase_gateway.search_suppliers(user_jwt, term)
    return suppliers or "Nenhum fornecedor encontrado."


tools = (
    Tool.from_function(
        get_process_kinds,
        name="get_process_kinds",
        description="Lista os tipos de processo que o usuário logado pode lançar (id_pkn, name_pkn).",
        tags=_TAGS,
        annotations=_READ_ONLY,
    ),
    Tool.from_function(
        get_document_kinds,
        name="get_document_kinds",
        description="Lista os tipos de documento fiscal disponíveis (id_dck, name_dck).",
        tags=_TAGS,
        annotations=_READ_ONLY,
    ),
    Tool.from_function(
        get_companies,
        name="get_companies",
        description="Lista as empresas disponíveis (codigo, nome). O `codigo` é usado como company_prc.",
        tags=_TAGS,
        annotations=_READ_ONLY,
    ),
    Tool.from_function(
        get_buildings,
        name="get_buildings",
        description="Lista as obras de uma empresa (codigo, nome). Passe o `codigo` da empresa. O `codigo` da obra é usado como building_prc.",
        tags=_TAGS,
        annotations=_READ_ONLY,
    ),
    Tool.from_function(
        get_appropriations,
        name="get_appropriations",
        description=(
            "Lista as apropriações (composição + insumo) disponíveis para uma empresa e obra. "
            "Passe o `codigo` da empresa e o `codigo` da obra. Use codigo_composicao como composition_prc "
            "e codigo_insumo como supply_prc."
        ),
        tags=_TAGS,
        annotations=_READ_ONLY,
    ),
    Tool.from_function(
        search_suppliers,
        name="search_suppliers",
        description="Busca fornecedores por nome ou CPF/CNPJ (id, nome, cpf_cnpj). O `id` é usado como person_prc.",
        tags=_TAGS,
        annotations=_READ_ONLY,
    ),
)
