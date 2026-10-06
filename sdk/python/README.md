# incdai: public Python SDK

Chat and real-time voice with an [incdai](https://incdai.incpritech.com) assistant from Python: **incdai Public** (managed by INCPRITECH) or any authorized **incdai Node**. English and Swahili.

This package is the client side of the public incdai protocol only. The incdai engine (retrieval, inference, voice orchestration) is not included.

```sh
pip install incdai            # or: uv tool install incdai
pip install "incdai[all]"     # + microphone/speaker and MP3 voice support for `incdai talk`
```

## Ask a question

```python
from incdai import Client

bot = Client(site="your-site")                 # api defaults to https://api.incdai.incpritech.com
for piece in bot.stream("Mnafungua saa ngapi?"):
    print(piece, end="", flush=True)

reply = bot.answer("Do you deliver?")          # Reply(text=..., answered=True, language="en", ...)
```

`AsyncClient` has the same methods for async code. To use an incdai Node, pass its HTTPS origin: `Client("https://node.example", "your-site")`.

## Real-time voice

```python
import asyncio
from incdai import LiveSession

async def main():
    async with LiveSession("https://api.incdai.incpritech.com", "your-site") as live:
        # send 16-bit PCM, mono, 16 kHz frames with: await live.send_audio(frame)
        async for event in live.events():
            if event["type"] == "transcript": print("you:", event["text"])
            elif event["type"] == "token": print(event["text"], end="", flush=True)
            elif event["type"] == "audio": ...   # 16-bit PCM, mono, 24 kHz

asyncio.run(main())
```

## Command line

```sh
incdai ask "What are your prices?" --site your-site
incdai talk --site your-site --wake "hey incdai"     # hands-free voice in the terminal
incdai config --site your-site
```

`INCDAI_SITE` and `INCDAI_API` can be set instead of `--site` and `--api`.

Protocol: [github.com/Stark-Priver/incdai/protocol](https://github.com/Stark-Priver/incdai/tree/main/protocol) · Docs: [incdai.incpritech.com/docs](https://incdai.incpritech.com/docs)

## Licence

[PolyForm Perimeter 1.0.1](LICENSE) © 2026 INCPRITECH. Selling, rebranding or hosting a competing incdai product requires a written commercial licence: [info@incpritech.com](mailto:info@incpritech.com).
