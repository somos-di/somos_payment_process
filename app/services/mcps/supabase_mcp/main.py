from fastmcp import FastMCP
from gateways import lifespan
from tools import all_tools
from constants.instructions import INSTRUCTIONS

app = FastMCP(
    name="Supabase Gateway",
    lifespan=lifespan,
    instructions=INSTRUCTIONS,
    tools=all_tools,
)


if __name__ == "__main__":
    app.run(transport="http", host="0.0.0.0", port=8000)
