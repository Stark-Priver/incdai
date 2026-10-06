"""Real-time voice conversations with a incdai assistant, from Python.

    import asyncio
    from incdai.live import LiveSession

    async def main():
        async with LiveSession("https://api.incdai.incpritech.com", "your-site", wake="hey incdai") as live:
            asyncio.create_task(feed_microphone(live))        # await live.send_audio(pcm16_16khz_frame)
            async for event in live.events():
                if event["type"] == "transcript": print("you:", event["text"])
                elif event["type"] == "token": print(event["text"], end="", flush=True)
                elif event["type"] == "audio": play(event["pcm"])   # 16-bit PCM, mono, 24 kHz

Or let incdai handle the microphone and speaker: `incdai talk --site your-site` (see talk() below).
The protocol is documented at https://incdai.incpritech.com/docs/live/
"""
from __future__ import annotations

import asyncio
import json
import shutil
import sys
from typing import AsyncIterator

from .client import DEFAULT_API, IncdaiError, site_path

IN_RATE = 16000
OUT_RATE = 24000
DEFAULT_LIVE_API = "https://incdai-cloud.depriver-tech.workers.dev"


class LiveSession:
    """One live conversation over a WebSocket. Send 16 kHz PCM in; get events (and 24 kHz speech) out."""

    def __init__(self, api: str = DEFAULT_API, site: str = "", *, live_api: str | None = None,
                 speak: str = "server", voice: str | None = None,
                 wake: str | None = None, language: str | None = None, history: list[dict] | None = None,
                 voice_sw: str | None = None, formats: list[str] | None = None):
        if not site:
            raise ValueError("site is required")
        api = api.rstrip("/")
        base = (live_api or (DEFAULT_LIVE_API if api == DEFAULT_API else api)).rstrip("/")
        self.url = base.replace("https://", "wss://", 1).replace("http://", "ws://", 1) + f"/v1/sites/{site_path(site)}/live"
        # Swahili speech may come as MP3; ask for it only when it can be decoded here (ffmpeg or miniaudio)
        self.formats = formats or (["pcm", "mp3"] if _can_decode_mp3() else ["pcm"])
        self.hello = {"type": "hello", "speak": speak, "voice": voice, "voice_sw": voice_sw, "wake": wake, "language": language,
                      "history": history or [], "formats": self.formats}
        self.ws = None
        self.ready: dict = {}

    async def connect(self) -> dict:
        """Open the conversation. Returns the server's "ready" event (audio formats, assistant name)."""
        try:
            import websockets
        except ImportError as e:  # pragma: no cover
            raise IncdaiError("Live voice needs the websockets package: pip install websockets") from e
        try:
            self.ws = await websockets.connect(self.url, max_size=None, ping_interval=20)
        except Exception as e:
            raise IncdaiError(f"Could not start a live session: {e}") from e
        await self.ws.send(json.dumps(self.hello))
        while True:
            msg = await self.ws.recv()
            if isinstance(msg, str):
                ev = json.loads(msg)
                if ev.get("type") == "ready":
                    self.ready = ev
                    return ev
                if ev.get("type") == "error":
                    raise IncdaiError(ev.get("message", "Live session failed"))

    async def __aenter__(self) -> "LiveSession":
        await self.connect()
        return self

    async def __aexit__(self, *exc) -> None:
        await self.close()

    async def send_audio(self, pcm: bytes) -> None:
        """Microphone audio: 16-bit little-endian PCM, mono, 16 kHz. 20-100 ms per call is ideal."""
        await self.ws.send(pcm)

    async def send_text(self, text: str) -> None:
        """A typed turn in the same conversation."""
        await self.ws.send(json.dumps({"type": "text", "text": text}))

    async def end_turn(self) -> None:
        """Push-to-talk: answer what was said so far."""
        await self.ws.send(json.dumps({"type": "end_turn"}))

    async def interrupt(self) -> None:
        """Stop the current answer."""
        await self.ws.send(json.dumps({"type": "interrupt"}))

    async def close(self) -> None:
        if self.ws is not None:
            try:
                await self.ws.send(json.dumps({"type": "bye"}))
                await self.ws.close()
            except Exception:
                pass
            self.ws = None

    async def events(self) -> AsyncIterator[dict]:
        """Every server event, in order. Speech arrives as {"type": "audio", "pcm": bytes} (24 kHz, also for MP3 sentences)."""
        import websockets
        fmt = "pcm"
        try:
            async for msg in self.ws:
                if isinstance(msg, bytes):
                    if fmt == "mp3":
                        from .audio import decode_to_pcm
                        msg = await decode_to_pcm(msg)
                    yield {"type": "audio", "pcm": msg}
                    continue
                try:
                    ev = json.loads(msg)
                except ValueError:
                    continue
                if ev.get("type") == "speak" and ev.get("audio"):
                    fmt = ev.get("format") or "pcm"
                yield ev
                if ev.get("type") == "bye":
                    return
        except websockets.ConnectionClosed:
            return


def _can_decode_mp3() -> bool:
    if shutil.which("ffmpeg"):
        return True
    try:
        import miniaudio  # type: ignore  # noqa: F401
        return True
    except ImportError:
        return False


# ── terminal assistant: `incdai talk` ─────────────────────────────────────────
class _Term:
    def __init__(self):
        tty = sys.stdout.isatty()
        self.dim = (lambda s: f"\033[2m{s}\033[0m") if tty else (lambda s: s)
        self.bold = (lambda s: f"\033[1m{s}\033[0m") if tty else (lambda s: s)
        self.teal = (lambda s: f"\033[38;2;23;184;168m{s}\033[0m") if tty else (lambda s: s)
        self.tty = tty
        self.status_shown = False

    def status(self, text: str) -> None:
        if self.tty:
            print(f"\r\033[K{self.dim(text)}", end="", flush=True)
            self.status_shown = True

    def line(self, text: str = "", end: str = "\n") -> None:
        if self.status_shown:
            print("\r\033[K", end="")
            self.status_shown = False
        print(text, end=end, flush=True)


async def talk(api: str, site: str, *, wake: str | None = None, voice: str | None = None, speak: str = "server",
               barge_in: bool = False, language: str | None = None) -> None:
    """A hands-free assistant in the terminal: microphone in, incdai's voice out. Ctrl+C to stop."""
    from .audio import Microphone, Speaker

    t = _Term()
    live = LiveSession(api, site, speak=speak, voice=voice, wake=wake, language=language)
    ready = await live.connect()
    mic = await Microphone(IN_RATE).start()
    speaker = await Speaker(OUT_RATE).start() if speak != "none" else None
    name = ready.get("assistant", "incdai")
    t.line(f"{t.teal('●')} {t.bold(name)} is listening. " + (f"Say \"{wake}\" to start. " if wake else "Just talk. ") + t.dim("Ctrl+C to stop."))
    if not barge_in and speaker:
        t.line(t.dim("  The microphone pauses while incdai speaks. With headphones, use --barge-in to interrupt by talking."))
    silence = b"\0" * (IN_RATE * 2 * 40 // 1000)
    local_voice = shutil.which("espeak-ng") or shutil.which("say")

    async def microphone():
        async for frame in mic:
            # without echo cancellation, incdai would hear itself: send silence while it speaks
            await live.send_audio(silence if (speaker and speaker.busy and not barge_in) else frame)

    async def say_locally(text: str, lang: str):
        if not local_voice or speak == "none":
            return
        args = [local_voice, "-v", "sw" if lang == "sw" else "en", text] if local_voice.endswith("espeak-ng") else [local_voice, text]
        proc = await asyncio.create_subprocess_exec(*args, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL)
        await proc.wait()

    writing = False
    mic_task = asyncio.create_task(microphone())
    try:
        t.status("listening…")
        async for ev in live.events():
            kind = ev["type"]
            if kind == "audio":
                if speaker:
                    await speaker.play(ev["pcm"])
            elif kind == "speech_started":
                if speaker and barge_in:
                    await speaker.clear()
                if not writing:
                    t.status("hearing you…")
            elif kind == "speech_ended" and not writing:
                t.status("thinking…")
            elif kind == "transcript":
                if ev.get("ignored"):
                    t.status(f"(heard \"{ev['text'][:50]}\", waiting for \"{wake}\")")
                elif ev.get("text"):
                    if writing:
                        t.line()
                    t.line(f"  {t.dim('you')}   {ev['text']}")
                    t.line(f"  {t.teal(name)} ", end="")
                    writing = True
                else:
                    t.status("listening…")
            elif kind == "wake":
                t.line(f"  {t.teal(name)} {t.dim('(yes?)')}")
            elif kind == "token":
                t.line(ev["text"], end="")
            elif kind == "speak" and not ev.get("audio"):
                asyncio.create_task(say_locally(ev["text"], ev.get("language", "en")))
            elif kind in ("audio_clear",):
                if speaker:
                    await speaker.clear()
            elif kind == "interrupted":
                if writing:
                    t.line(t.dim(" …"))
                    writing = False
            elif kind == "done":
                t.line()
                writing = False
                if ev.get("answered") is False and ev.get("handoff"):
                    t.line(t.dim(f"        talk to a person: {ev['handoff']}"))
                t.status("listening…")
            elif kind == "error":
                t.line(f"  {t.dim('!')} {ev.get('message', 'Something went wrong.')}")
            elif kind == "bye":
                t.line(t.dim(f"  session ended ({ev.get('reason', '')})"))
                break
    finally:
        mic_task.cancel()
        mic.stop()
        if speaker:
            speaker.stop()
        await live.close()
