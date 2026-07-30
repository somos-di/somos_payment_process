from fastmcp.server.dependencies import get_http_headers


def get_user_jwt() -> str:
    headers = get_http_headers(include={"authorization"})
    auth = headers.get("authorization") or headers.get("Authorization") or ""
    if not auth.lower().startswith("bearer "):
        raise ValueError("Requisição sem Authorization Bearer (JWT do usuário).")
    return auth.split(" ", 1)[1].strip()
