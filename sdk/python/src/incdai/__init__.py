"""incdai public Python SDK: use incdai Public or any authorized incdai Node from Python.

    from incdai import Client
    bot = Client(site="your-site")
    for piece in bot.stream("Mnafungua saa ngapi?"):
        print(piece, end="", flush=True)

Real-time voice: incdai.LiveSession, or `incdai talk --site your-site` in a terminal.
This package contains only the client side of the public incdai protocol; it does not include the incdai engine.
"""
from .client import DEFAULT_API, AsyncClient, Client, IncdaiError, Reply
from .live import LiveSession

__version__ = "0.6.1"
__all__ = ["Client", "AsyncClient", "Reply", "IncdaiError", "LiveSession", "DEFAULT_API", "__version__"]
