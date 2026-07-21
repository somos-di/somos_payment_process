from fastmcp.server.dependencies import get_http_headers


def get_user_jwt() -> str:
    """Extrai o JWT do usuário logado do header Authorization da requisição MCP.

    O agente (server-side) repassa o access token do usuário como `Bearer <jwt>`;
    o modelo NUNCA vê o token (não é argumento de tool). Com o JWT, o gateway age
    como o usuário e a RLS do Supabase limita o que ele enxerga/cria.
    """
    headers = get_http_headers(include={"authorization"})
    auth = headers.get("authorization") or headers.get("Authorization") or ""
    if not auth.lower().startswith("bearer "):
        raise ValueError("Requisição sem Authorization Bearer (JWT do usuário).")
    return auth.split(" ", 1)[1].strip()
