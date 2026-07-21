import base64
import json

from postgrest import APIError
from supabase import create_async_client, AsyncClient
from supabase.lib.client_options import AsyncClientOptions

from settings import AppSettings


def _jwt_sub(user_jwt: str) -> str | None:
    """Extrai o `sub` (id do usuário) do JWT. Não valida assinatura — quem valida é
    o Supabase quando a query roda com o token."""
    try:
        payload = user_jwt.split(".")[1]
        payload += "=" * (-len(payload) % 4)  # padding base64
        return json.loads(base64.urlsafe_b64decode(payload)).get("sub")
    except Exception:
        return None


class SupabaseGateway:
    """Acessa o schema payment_process SEMPRE como o usuário logado (JWT), então a
    RLS do banco continua valendo — o MCP nunca vira um "vê-tudo".

    Cria um client POR REQUEST (bind do JWT em cada chamada). Isso é de propósito:
    mutar `postgrest.auth()` num client compartilhado vazaria o token de um usuário
    para requisições concorrentes de outro.
    """

    def __init__(self, settings: AppSettings):
        self.settings = settings

    async def _client(self, user_jwt: str) -> AsyncClient:
        client = await create_async_client(
            self.settings.supabase_url,
            self.settings.supabase_key.get_secret_value(),  # anon/publishable key
            options=AsyncClientOptions(
                schema=self.settings.payment_process_schema.get_secret_value(),
            ),
        )
        client.postgrest.auth(user_jwt)  # age como o usuário -> RLS aplica
        return client

    # ---------------------------------------------------------------- LOOKUPS
    # Tudo que o agente precisa para montar um processo, filtrado como no app.

    async def get_launchable_kinds(self, user_jwt: str) -> list[dict]:
        """Tipos de processo que ESTE usuário pode lançar (respeita grupos lançadores)."""
        client = await self._client(user_jwt)
        try:
            resp = await client.rpc("my_launchable_kinds", {}).execute()
        except APIError as e:
            raise RuntimeError(f"Falha ao buscar tipos de processo: {e.message}") from e
        return resp.data or []

    async def get_document_kinds(self, user_jwt: str) -> list[dict]:
        client = await self._client(user_jwt)
        try:
            resp = await (
                client.table("document_kinds")
                .select("id_dck,name_dck")
                .order("name_dck")
                .execute()
            )
        except APIError as e:
            raise RuntimeError(f"Falha ao buscar tipos de documento: {e.message}") from e
        return resp.data or []

    async def get_companies(self, user_jwt: str) -> list[dict]:
        client = await self._client(user_jwt)
        try:
            resp = await (
                client.table("v_empresas").select("codigo,nome").order("nome").execute()
            )
        except APIError as e:
            raise RuntimeError(f"Falha ao buscar empresas: {e.message}") from e
        return resp.data or []

    async def get_buildings(self, user_jwt: str, company: str) -> list[dict]:
        client = await self._client(user_jwt)
        try:
            resp = await (
                client.table("v_obras")
                .select("codigo,nome,empresa")
                .eq("empresa", company)
                .order("nome")
                .execute()
            )
        except APIError as e:
            raise RuntimeError(f"Falha ao buscar obras: {e.message}") from e
        return resp.data or []

    async def get_appropriations(self, user_jwt: str, company: str, building: str) -> list[dict]:
        """Apropriação = par composição + insumo disponível para a empresa/obra.
        `codigo_composicao` vira composition_prc; `codigo_insumo` vira supply_prc."""
        client = await self._client(user_jwt)
        try:
            resp = await (
                client.table("compositions")
                .select("codigo_composicao,descricao_composicao,codigo_insumo,descricao_insumo")
                .eq("empresa_cins", int(company))
                .ilike("obra_cins", building)
                .limit(2000)
                .execute()
            )
        except APIError as e:
            raise RuntimeError(f"Falha ao buscar composições: {e.message}") from e
        except ValueError as e:
            raise RuntimeError(f"Empresa inválida (esperado código numérico): {company}") from e

        seen: set[tuple] = set()
        out: list[dict] = []
        for r in resp.data or []:
            comp, ins = r.get("codigo_composicao"), r.get("codigo_insumo")
            if not comp or not ins or (comp, ins) in seen:
                continue
            seen.add((comp, ins))
            out.append(r)
        return out

    async def search_suppliers(self, user_jwt: str, term: str | None = None) -> list[dict]:
        client = await self._client(user_jwt)
        try:
            query = client.table("v_fornecedores").select("id,nome,cpf_cnpj")
            if term:
                query = query.or_(f"nome.ilike.%{term}%,cpf_cnpj.ilike.%{term}%")
            resp = await query.order("nome").limit(100).execute()
        except APIError as e:
            raise RuntimeError(f"Falha ao buscar fornecedores: {e.message}") from e
        return resp.data or []

    async def _user_department(self, client: AsyncClient, user_jwt: str) -> int | None:
        """Departamento do usuário logado (o processo herda dele, igual ao app)."""
        sub = _jwt_sub(user_jwt)
        if not sub:
            return None
        try:
            resp = await (
                client.table("users")
                .select("department_usr")
                .eq("id_usr", sub)
                .maybe_single()
                .execute()
            )
        except APIError:
            return None
        return (resp.data or {}).get("department_usr")

    # ---------------------------------------------------------------- CRIAÇÃO

    async def create_process(self, user_jwt: str, process: dict, installments: list[dict]) -> dict:
        """Cria processo + parcelas via RPC (author = auth.uid(); valida tipo permitido)."""
        client = await self._client(user_jwt)
        if not process.get("department_prc"):
            process["department_prc"] = await self._user_department(client, user_jwt)
        try:
            resp = await client.rpc(
                "create_process_with_installments",
                {"p_process": process, "p_installments": installments},
            ).execute()
        except APIError as e:
            raise RuntimeError(f"Falha ao criar o processo: {e.message}") from e
        return resp.data or {}

    def close(self) -> None:
        # clients são por-request (efêmeros); nada persistente para fechar.
        return None
