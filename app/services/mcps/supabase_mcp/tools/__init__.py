from .lookups import tools as lookup_tools
from .create_process import tools as process_tools
from .installments import tools as installments_tools

all_tools = [*lookup_tools, *process_tools, *installments_tools]
