"""Microphone and speaker for terminal voice conversations, with no required dependencies.

Uses the `sounddevice` package when it is installed (Windows, macOS, Linux). Otherwise it drives the system's
own audio tools: PulseAudio/PipeWire (`pacat`), ALSA (`arecord`/`aplay`) or ffmpeg (macOS).
Audio is 16-bit little-endian mono PCM: 16 kHz from the microphone, 24 kHz to the speaker.
"""
from __future__ import annotations

import asyncio
import shutil
import sys
import time

FRAME_MS = 40


def _commands(kind: str, rate: int) -> list[list[str]]:
    if kind == "record":
        return [
            ["pacat", "--record", "--raw", f"--rate={rate}", "--channels=1", "--format=s16le", "--latency-msec=40"],
            ["arecord", "-q", "-f", "S16_LE", "-r", str(rate), "-c", "1", "-t", "raw"],
            ["ffmpeg", "-loglevel", "quiet", "-f", "avfoundation" if sys.platform == "darwin" else "pulse",
             "-i", ":0" if sys.platform == "darwin" else "default", "-ac", "1", "-ar", str(rate), "-f", "s16le", "-"],
        ]
    return [
        ["pacat", "--playback", "--raw", f"--rate={rate}", "--channels=1", "--format=s16le", "--latency-msec=60"],
        ["aplay", "-q", "-f", "S16_LE", "-r", str(rate), "-c", "1", "-t", "raw"],
        ["ffplay", "-loglevel", "quiet", "-nodisp", "-f", "s16le", "-ar", str(rate), "-ch_layout", "mono", "-i", "-"],
    ]


def _find(kind: str, rate: int) -> list[str] | None:
    return next((c for c in _commands(kind, rate) if shutil.which(c[0])), None)


def _sounddevice():
    try:
        import sounddevice  # type: ignore
        return sounddevice
    except Exception:  # not installed, or no PortAudio library
        return None


class Microphone:
    """Async iterator of PCM frames (40 ms each). `async for frame in Microphone(): ...`"""

    def __init__(self, rate: int = 16000):
        self.rate = rate
        self.frame_bytes = rate * 2 * FRAME_MS // 1000
        self._proc = None
        self._stream = None
        self._queue: asyncio.Queue[bytes] | None = None

    async def start(self) -> "Microphone":
        sd = _sounddevice()
        if sd:
            loop = asyncio.get_running_loop()
            self._queue = asyncio.Queue()
            def callback(data, frames, t, status):
                loop.call_soon_threadsafe(self._queue.put_nowait, bytes(data))
            self._stream = sd.RawInputStream(samplerate=self.rate, channels=1, dtype="int16", blocksize=self.frame_bytes // 2, callback=callback)
            self._stream.start()
            return self
        cmd = _find("record", self.rate)
        if not cmd:
            raise RuntimeError("No microphone tool found. Install the audio extra (pip install 'incdai[audio]') or PulseAudio/ALSA tools.")
        self._proc = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL)
        return self

    def __aiter__(self):
        return self

    async def __anext__(self) -> bytes:
        if self._queue is not None:
            return await self._queue.get()
        if self._proc is None or self._proc.stdout is None:
            raise StopAsyncIteration
        try:
            return await self._proc.stdout.readexactly(self.frame_bytes)
        except asyncio.IncompleteReadError:
            raise StopAsyncIteration

    def stop(self) -> None:
        if self._stream is not None:
            self._stream.stop(); self._stream.close(); self._stream = None
        if self._proc is not None and self._proc.returncode is None:
            self._proc.kill()
        self._proc = None


class Speaker:
    """Plays PCM as it arrives. `clear()` drops everything queued (when the person interrupts)."""

    def __init__(self, rate: int = 24000):
        self.rate = rate
        self._proc = None
        self._stream = None
        self._buffer = bytearray()
        self._until = 0.0  # when queued audio should finish playing (monotonic clock)

    @property
    def busy(self) -> bool:
        return time.monotonic() < self._until

    async def start(self) -> "Speaker":
        sd = _sounddevice()
        if sd:
            def callback(out, frames, t, status):
                n = len(out)
                chunk = bytes(self._buffer[:n]); del self._buffer[:n]
                out[:len(chunk)] = chunk
                out[len(chunk):] = b"\0" * (n - len(chunk))
            self._stream = sd.RawOutputStream(samplerate=self.rate, channels=1, dtype="int16", callback=callback)
            self._stream.start()
            return self
        await self._spawn()
        return self

    async def _spawn(self) -> None:
        cmd = _find("play", self.rate)
        if not cmd:
            raise RuntimeError("No speaker tool found. Install the audio extra (pip install 'incdai[audio]') or PulseAudio/ALSA tools.")
        self._proc = await asyncio.create_subprocess_exec(*cmd, stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL)

    async def play(self, pcm: bytes) -> None:
        self._until = max(self._until, time.monotonic()) + len(pcm) / (2 * self.rate)
        if self._stream is not None:
            self._buffer += pcm
            return
        if self._proc is None or self._proc.returncode is not None:
            await self._spawn()
        try:
            self._proc.stdin.write(pcm)
            await self._proc.stdin.drain()
        except (BrokenPipeError, ConnectionResetError):
            self._proc = None

    async def clear(self) -> None:
        self._until = 0.0
        if self._stream is not None:
            self._buffer.clear()
            return
        if self._proc is not None and self._proc.returncode is None:   # drop what the player has buffered
            self._proc.kill()
            await self._proc.wait()
        self._proc = None

    def stop(self) -> None:
        if self._stream is not None:
            self._stream.stop(); self._stream.close(); self._stream = None
        if self._proc is not None and self._proc.returncode is None:
            self._proc.kill()
        self._proc = None


async def decode_to_pcm(data: bytes, rate: int = 24000) -> bytes:
    """MP3/Opus/WAV bytes -> 16-bit PCM, mono. Uses ffmpeg, or the `miniaudio` package for MP3."""
    if not data:
        return b""
    if shutil.which("ffmpeg"):
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-loglevel", "quiet", "-i", "pipe:0", "-f", "s16le", "-ac", "1", "-ar", str(rate), "pipe:1",
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL)
        out, _ = await proc.communicate(data)
        return out
    try:
        import miniaudio  # type: ignore
    except ImportError as e:
        raise RuntimeError("This voice sends MP3: install ffmpeg, or pip install 'incdai[voice]'.") from e
    decoded = miniaudio.decode(data, output_format=miniaudio.SampleFormat.SIGNED16, nchannels=1, sample_rate=rate)
    return decoded.samples.tobytes()
