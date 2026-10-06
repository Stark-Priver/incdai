"""Use a incdai assistant from Python software: incdai cloud or any self-hosted incdai server.

    from incdai.client import Client

    bot = Client("https://api.incdai.incpritech.com", "your-site")
    for piece in bot.stream("Mnafungua saa ngapi?"):
        print(piece, end="", flush=True)
    reply = bot.answer("Do you deliver?")          # Reply(text=..., answered=True, language="en", ...)

Async code uses AsyncClient with the same methods (`async for piece in bot.stream(...)`).
Real-time voice conversations: see incdai.live.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import AsyncIterator, Iterator

import httpx

DEFAULT_API = "https://api.incdai.incpritech.com"


class IncdaiError(RuntimeError):
    def __init__(self, message: str, status: int = 0):
        super().__init__(message)
        self.status = status


@dataclass
class Reply:
    text: str
    answered: bool = True
    language: str = ""
    sources: list[dict] = field(default_factory=list)
    handoff: str = ""  # WhatsApp link to a person, when the business has one


def _error(r: httpx.Response) -> IncdaiError:
    try:
        message = r.json().get("error") or r.text
    except ValueError:
        message = r.text
    return IncdaiError(message or f"Request failed ({r.status_code})", r.status_code)


def _events(lines) -> Iterator[dict]:
    for line in lines:
        if line.startswith("data:"):
            try:
                yield json.loads(line[5:])
            except ValueError:
                continue


class _Base:
    def __init__(self, api: str = DEFAULT_API, site: str = "", timeout: float = 60.0):
        if not site:
            raise ValueError("site is required")
        self.api = api.rstrip("/")
        self.site = site
        self.timeout = timeout
        self.history: list[dict] = []

    def url(self, path: str) -> str:
        return f"{self.api}/v1/sites/{site_path(self.site)}/{path}"

    def _ask_body(self, question: str, history, language, spoken) -> dict:
        body = {"question": question, "history": self.history if history is None else history}
        if language:
            body["language"] = language
        if spoken:
            body["mode"] = "voice"
        return body

    def remember(self, question: str, answer: str) -> None:
        self.history = (self.history + [{"role": "user", "content": question}, {"role": "assistant", "content": answer}])[-8:]

    def reset(self) -> None:
        """Forget the conversation so far."""
        self.history = []


def site_path(site: str) -> str:
    from urllib.parse import quote
    return quote(site, safe="")


class Client(_Base):
    """Synchronous client."""

    def config(self) -> dict:
        r = httpx.get(self.url("config"), timeout=self.timeout)
        if r.status_code != 200:
            raise _error(r)
        return r.json()

    def events(self, question: str, history: list[dict] | None = None, language: str | None = None, spoken: bool = False) -> Iterator[dict]:
        """Stream events: {"type": "token", "text"} ... then {"type": "done", "answered", "language", "sources", "handoff"}."""
        text = []
        with httpx.stream("POST", self.url("ask"), json=self._ask_body(question, history, language, spoken), timeout=self.timeout) as r:
            if r.status_code != 200:
                r.read()
                raise _error(r)
            for ev in _events(r.iter_lines()):
                if ev.get("type") == "token":
                    text.append(ev["text"])
                elif ev.get("type") == "done" and history is None:
                    self.remember(question, "".join(text))
                yield ev

    def stream(self, question: str, **kw) -> Iterator[str]:
        """Stream only the answer text."""
        for ev in self.events(question, **kw):
            if ev.get("type") == "token":
                yield ev["text"]

    def answer(self, question: str, **kw) -> Reply:
        parts, done = [], {}
        for ev in self.events(question, **kw):
            if ev.get("type") == "token":
                parts.append(ev["text"])
            else:
                done = ev
        return Reply("".join(parts), done.get("answered", True), done.get("language", ""), done.get("sources", []), done.get("handoff", ""))

    def transcribe(self, audio: bytes, content_type: str = "audio/wav") -> dict:
        """Speech to text for one recording: {"text", "language"}."""
        r = httpx.post(self.url("transcribe"), content=audio, headers={"Content-Type": content_type}, timeout=self.timeout)
        if r.status_code != 200:
            raise _error(r)
        return r.json()

    def speak(self, text: str, voice: str | None = None) -> bytes:
        """Text to speech (English voices): MP3 bytes."""
        r = httpx.post(self.url("speak"), json={"text": text, "voice": voice}, timeout=self.timeout)
        if r.status_code != 200:
            raise _error(r)
        return r.content

    def lead(self, name: str, contact: str, message: str = "") -> None:
        r = httpx.post(self.url("leads"), json={"name": name, "contact": contact, "message": message}, timeout=self.timeout)
        if r.status_code != 200:
            raise _error(r)


class AsyncClient(_Base):
    """asyncio client with the same methods as Client."""

    async def config(self) -> dict:
        async with httpx.AsyncClient(timeout=self.timeout) as c:
            r = await c.get(self.url("config"))
        if r.status_code != 200:
            raise _error(r)
        return r.json()

    async def events(self, question: str, history: list[dict] | None = None, language: str | None = None, spoken: bool = False) -> AsyncIterator[dict]:
        text = []
        async with httpx.AsyncClient(timeout=self.timeout) as c:
            async with c.stream("POST", self.url("ask"), json=self._ask_body(question, history, language, spoken)) as r:
                if r.status_code != 200:
                    await r.aread()
                    raise _error(r)
                async for line in r.aiter_lines():
                    for ev in _events([line]):
                        if ev.get("type") == "token":
                            text.append(ev["text"])
                        elif ev.get("type") == "done" and history is None:
                            self.remember(question, "".join(text))
                        yield ev

    async def stream(self, question: str, **kw) -> AsyncIterator[str]:
        async for ev in self.events(question, **kw):
            if ev.get("type") == "token":
                yield ev["text"]

    async def answer(self, question: str, **kw) -> Reply:
        parts, done = [], {}
        async for ev in self.events(question, **kw):
            if ev.get("type") == "token":
                parts.append(ev["text"])
            else:
                done = ev
        return Reply("".join(parts), done.get("answered", True), done.get("language", ""), done.get("sources", []), done.get("handoff", ""))

    async def transcribe(self, audio: bytes, content_type: str = "audio/wav") -> dict:
        async with httpx.AsyncClient(timeout=self.timeout) as c:
            r = await c.post(self.url("transcribe"), content=audio, headers={"Content-Type": content_type})
        if r.status_code != 200:
            raise _error(r)
        return r.json()

    async def speak(self, text: str, voice: str | None = None) -> bytes:
        async with httpx.AsyncClient(timeout=self.timeout) as c:
            r = await c.post(self.url("speak"), json={"text": text, "voice": voice})
        if r.status_code != 200:
            raise _error(r)
        return r.content

    def live(self, **options) -> "LiveSession":
        """A real-time voice conversation (see incdai.live.LiveSession)."""
        from .live import LiveSession
        return LiveSession(self.api, self.site, history=self.history, **options)
