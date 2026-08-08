from datetime import date, timedelta

from postgrest import APIError
from supabase import create_async_client, AsyncClient
from supabase.lib.client_options import AsyncClientOptions

from settings import AppSettings

_PROCESS_FIELDS = (
    "id_prc,uuid_prc,empresa_nome,obra_nome,fornecedor_nome,tipo_nome,"
    "value_prc,status_nome,status_step_prc,is_urgent_prc,due_date_prc,description_prc"
)


class SupabaseGateway:
    def __init__(self, settings: AppSettings):
        self.settings = settings

    async def _client(self, user_jwt: str) -> AsyncClient:
        client = await create_async_client(
            self.settings.supabase_url,
            self.settings.supabase_key.get_secret_value(),
            options=AsyncClientOptions(
                schema=self.settings.payment_process_schema.get_secret_value(),
            ),
        )
        client.postgrest.auth(user_jwt)
        return client

    async def search_suppliers(self, user_jwt: str, term: str | None = None) -> list[dict]:
        client = await self._client(user_jwt)
        try:
            query = client.table("v_fornecedores").select("id,nome,cpf_cnpj")
            if term:
                query = query.or_(f"nome.ilike.%{term}%,cpf_cnpj.ilike.%{term}%")
            response = await query.order("nome").limit(50).execute()
        except APIError as error:
            raise RuntimeError(f"Falha ao buscar fornecedores: {error.message}") from error
        return response.data or []

    async def list_processes(
        self,
        user_jwt: str,
        supplier: str | None = None,
        company: str | None = None,
        status: str | None = None,
        urgent: bool | None = None,
        due_before: str | None = None,
        due_after: str | None = None,
        overdue: bool = False,
        limit: int = 30,
    ) -> list[dict]:
        client = await self._client(user_jwt)
        try:
            query = client.table("v_processes").select(_PROCESS_FIELDS)
            if supplier:
                query = query.ilike("fornecedor_nome", f"%{supplier}%")
            if company:
                query = query.ilike("empresa_nome", f"%{company}%")
            if status:
                query = query.ilike("status_nome", f"%{status}%")
            if urgent is not None:
                query = query.eq("is_urgent_prc", "true" if urgent else "false")
            if overdue:
                query = query.lt("due_date_prc", date.today().isoformat())
            if due_before:
                query = query.lte("due_date_prc", due_before)
            if due_after:
                query = query.gte("due_date_prc", due_after)
            response = await query.order("due_date_prc").limit(limit).execute()
        except APIError as error:
            raise RuntimeError(f"Falha ao consultar processos: {error.message}") from error
        return response.data or []

    async def get_process_by_id(self, user_jwt: str, id_prc: int) -> dict | None:
        client = await self._client(user_jwt)
        try:
            response = await (
                client.table("v_processes")
                .select(_PROCESS_FIELDS)
                .eq("id_prc", id_prc)
                .limit(1)
                .execute()
            )
        except APIError as error:
            raise RuntimeError(f"Falha ao buscar o processo: {error.message}") from error
        rows = response.data or []
        return rows[0] if rows else None

    async def my_pending_approvals(
        self,
        user_jwt: str,
        supplier: str | None = None,
        company: str | None = None,
        urgent: bool | None = None,
        due_before: str | None = None,
        due_after: str | None = None,
        overdue: bool = False,
        limit: int = 50,
    ) -> list[dict]:
        client = await self._client(user_jwt)
        try:
            pending = await client.rpc("my_pending_approvals", {}).execute()
            ids = [row["id_prc"] for row in (pending.data or []) if row.get("id_prc")][:limit]
            if not ids:
                return []
            query = client.table("v_processes").select(_PROCESS_FIELDS).in_("id_prc", ids)
            if supplier:
                query = query.ilike("fornecedor_nome", f"%{supplier}%")
            if company:
                query = query.ilike("empresa_nome", f"%{company}%")
            if urgent is not None:
                query = query.eq("is_urgent_prc", "true" if urgent else "false")
            if overdue:
                query = query.lt("due_date_prc", date.today().isoformat())
            if due_before:
                query = query.lte("due_date_prc", due_before)
            if due_after:
                query = query.gte("due_date_prc", due_after)
            response = await query.order("due_date_prc").execute()
        except APIError as error:
            raise RuntimeError(f"Falha ao buscar aprovações pendentes: {error.message}") from error
        return response.data or []

    async def get_completed_approvals(self, user_jwt: str, process_uuid: str) -> list[dict]:
        client = await self._client(user_jwt)
        try:
            response = await client.rpc("completed_approvals", {"p_uuid": process_uuid}).execute()
        except APIError as error:
            raise RuntimeError(f"Falha ao buscar aprovações concluídas: {error.message}") from error
        return [
            {
                "name": rule.get("name"),
                "email": rule.get("email"),
                "group": rule.get("group_name"),
                "level": rule.get("level"),
                "approved_at": rule.get("approved_at"),
            }
            for rule in (response.data or [])
        ]

    async def get_eligible_approvers(self, user_jwt: str, process_uuid: str) -> list[dict]:
        client = await self._client(user_jwt)
        try:
            response = await client.rpc("eligible_approvers", {"p_uuid": process_uuid}).execute()
        except APIError as error:
            raise RuntimeError(f"Falha ao buscar aprovadores elegíveis: {error.message}") from error
        return [
            {"name": rule.get("name"), "email": rule.get("email"), "group": rule.get("group_name")}
            for rule in (response.data or [])
        ]

    async def get_process_history(self, user_jwt: str, process_uuid: str, limit: int = 20) -> list[dict]:
        client = await self._client(user_jwt)
        try:
            response = await (
                client.table("v_process_history")
                .select("action_hst,kind_nome,user_nome,created_at_hst")
                .eq("process_hst", process_uuid)
                .order("created_at_hst", desc=True)
                .order("id_hst", desc=True)
                .limit(limit)
                .execute()
            )
        except APIError as error:
            raise RuntimeError(f"Falha ao buscar histórico: {error.message}") from error
        return response.data or []

    async def processes_overview(self, user_jwt: str) -> dict:
        client = await self._client(user_jwt)
        today = date.today().isoformat()
        soon = (date.today() + timedelta(days=7)).isoformat()
        try:
            pending = await client.rpc("my_pending_approvals", {}).execute()
            processes = await (
                client.table("v_processes")
                .select("status_step_prc,is_urgent_prc,due_date_prc")
                .execute()
            )
        except APIError as error:
            raise RuntimeError(f"Falha ao montar o resumo: {error.message}") from error
        rows = processes.data or []
        overdue = sum(1 for row in rows if row.get("due_date_prc") and row["due_date_prc"] < today)
        due_soon = sum(
            1 for row in rows if row.get("due_date_prc") and today <= row["due_date_prc"] <= soon
        )
        urgent = sum(1 for row in rows if row.get("is_urgent_prc"))
        return {
            "aguardando_minha_aprovacao": len(pending.data or []),
            "visiveis_no_total": len(rows),
            "urgentes": urgent,
            "vencendo_em_7_dias": due_soon,
            "vencidos": overdue,
        }

    def close(self) -> None:
        return None
