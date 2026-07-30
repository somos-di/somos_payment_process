import base64
import json

from postgrest import APIError
from supabase import create_async_client, AsyncClient
from supabase.lib.client_options import AsyncClientOptions

from settings import AppSettings


def _jwt_sub(user_jwt: str) -> str | None:
    try:
        payload = user_jwt.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        return json.loads(base64.urlsafe_b64decode(payload)).get("sub")
    except Exception:
        return None


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

    async def get_launchable_kinds(self, user_jwt: str) -> list[dict]:
        client = await self._client(user_jwt)
        try:
            response = await client.rpc("my_launchable_kinds", {}).execute()
        except APIError as error:
            raise RuntimeError(f"Falha ao buscar tipos de processo: {error.message}") from error
        return response.data or []

    async def get_document_kinds(self, user_jwt: str) -> list[dict]:
        client = await self._client(user_jwt)
        try:
            response = await (
                client.table("document_kinds")
                .select("id_dck,name_dck")
                .order("name_dck")
                .execute()
            )
        except APIError as error:
            raise RuntimeError(f"Falha ao buscar tipos de documento: {error.message}") from error
        return response.data or []

    async def get_companies(self, user_jwt: str, search: str | None = None, limit: int = 10) -> list[dict]:
        client = await self._client(user_jwt)
        try:
            query = client.table("v_empresas").select("codigo,nome")
            if search:
                query = query.ilike("nome", f"%{search}%")
            response = await query.order("nome").limit(limit).execute()
        except APIError as error:
            raise RuntimeError(f"Falha ao buscar empresas: {error.message}") from error
        return response.data or []

    async def get_buildings(self, user_jwt: str, company: str) -> list[dict]:
        client = await self._client(user_jwt)
        try:
            response = await (
                client.table("v_obras")
                .select("codigo,nome")
                .eq("empresa", company)
                .order("nome")
                .execute()
            )
        except APIError as error:
            raise RuntimeError(f"Falha ao buscar obras: {error.message}") from error
        return response.data or []

    async def get_appropriations(
        self,
        user_jwt: str,
        company: str,
        building: str,
        search: str | None = None,
        limit: int = 10,
    ) -> list[dict]:
        client = await self._client(user_jwt)
        try:
            query = (
                client.table("compositions")
                .select("codigo_composicao,descricao_composicao,codigo_insumo,descricao_insumo")
                .eq("empresa_cins", int(company))
                .eq("obra_cins", building)
            )
            if search:
                query = query.or_(
                    f"descricao_composicao.ilike.%{search}%,descricao_insumo.ilike.%{search}%,"
                    f"codigo_composicao.ilike.%{search}%,codigo_insumo.ilike.%{search}%"
                )
            response = await query.limit(2000).execute()
        except APIError as error:
            raise RuntimeError(f"Falha ao buscar composições: {error.message}") from error
        except ValueError as error:
            raise RuntimeError(f"Empresa inválida (esperado código numérico): {company}") from error

        seen: set[tuple] = set()
        results: list[dict] = []
        for rule in response.data or []:
            composition, supply = rule.get("codigo_composicao"), rule.get("codigo_insumo")
            if not composition or not supply or (composition, supply) in seen:
                continue
            seen.add((composition, supply))
            label = f"{rule.get('descricao_composicao') or composition} / {rule.get('descricao_insumo') or supply}"
            results.append({"composition": composition, "supply": supply, "label": label})
        return results[:limit]

    async def search_suppliers(self, user_jwt: str, term: str | None = None) -> list[dict]:
        client = await self._client(user_jwt)
        try:
            query = client.table("v_fornecedores").select("id,nome,cpf_cnpj")
            if term:
                query = query.or_(f"nome.ilike.%{term}%,cpf_cnpj.ilike.%{term}%")
            response = await query.order("nome").limit(100).execute()
        except APIError as error:
            raise RuntimeError(f"Falha ao buscar fornecedores: {error.message}") from error
        return response.data or []

    async def _user_department(self, client: AsyncClient, user_jwt: str) -> int | None:
        user_id = _jwt_sub(user_jwt)
        if not user_id:
            return None
        try:
            response = await (
                client.table("users")
                .select("department_usr")
                .eq("id_usr", user_id)
                .maybe_single()
                .execute()
            )
        except APIError:
            return None
        return (response.data or {}).get("department_usr")


    async def create_process(self, user_jwt: str, process: dict, installments: list[dict]) -> dict:
        client = await self._client(user_jwt)
        if not process.get("department_prc"):
            process["department_prc"] = await self._user_department(client, user_jwt)
        try:
            response = await client.rpc(
                "create_process_with_installments",
                {"p_process": process, "p_installments": installments},
            ).execute()
        except APIError as error:
            raise RuntimeError(f"Falha ao criar o processo: {error.message}") from error
        return response.data or {}

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

    async def get_process_uuid(self, user_jwt: str, id_prc: int) -> str | None:
        client = await self._client(user_jwt)
        try:
            response = await (
                client.table("processes")
                .select("uuid_prc")
                .eq("id_prc", id_prc)
                .maybe_single()
                .execute()
            )
        except APIError as error:
            raise RuntimeError(f"Falha ao buscar o processo: {error.message}") from error
        return (response.data or {}).get("uuid_prc")

    def close(self) -> None:
        return None
