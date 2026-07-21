from .lookups import tools as lookup_tools
from .create_process import tools as process_tools

# lista PLANA de Tool (FastMCP espera um iterável de Tool, não uma lista de tuplas)
all_tools = [*lookup_tools, *process_tools]
