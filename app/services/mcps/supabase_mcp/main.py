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
