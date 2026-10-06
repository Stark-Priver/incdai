"""`incdai` command: ask an assistant a question, or talk to it by voice.

    incdai ask "What are your opening hours?" --site your-site
    incdai talk --site your-site [--wake "hey incdai"] [--voice female]
    incdai config --site your-site
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys

from . import __version__
from .client import DEFAULT_API, Client, IncdaiError


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="incdai", description="Talk to an incdai assistant (incdai Public or an incdai Node).")
    p.add_argument("--version", action="version", version=f"incdai {__version__}")
    sub = p.add_subparsers(dest="cmd", required=True)

    def common(sp):
        sp.add_argument("--site", default=os.environ.get("INCDAI_SITE", ""), help="assistant id (or INCDAI_SITE)")
        sp.add_argument("--api", default=os.environ.get("INCDAI_API", DEFAULT_API), help=f"server (default {DEFAULT_API})")

    a = sub.add_parser("ask", help="ask one question and stream the answer")
    a.add_argument("question", nargs="+")
    a.add_argument("--language", choices=["en", "sw"])
    common(a)
    t = sub.add_parser("talk", help="hands-free voice conversation in the terminal")
    t.add_argument("--wake", help='wake word, e.g. "hey incdai"')
    t.add_argument("--voice", help="female, male or a voice name")
    t.add_argument("--language", choices=["en", "sw"])
    t.add_argument("--barge-in", action="store_true", help="interrupt by talking (use headphones)")
    t.add_argument("--speak", choices=["server", "client", "none"], default="server")
    common(t)
    c = sub.add_parser("config", help="show the assistant's public settings")
    common(c)
    args = p.parse_args(argv)
    if not args.site:
        p.error("--site is required (or set INCDAI_SITE)")
    try:
        if args.cmd == "ask":
            for piece in Client(args.api, args.site).stream(" ".join(args.question), language=args.language):
                print(piece, end="", flush=True)
            print()
        elif args.cmd == "config":
            print(json.dumps(Client(args.api, args.site).config(), indent=2, ensure_ascii=False))
        else:
            from .live import talk
            asyncio.run(talk(args.api, args.site, wake=args.wake, voice=args.voice, speak=args.speak,
                             barge_in=args.barge_in, language=args.language))
    except KeyboardInterrupt:
        return 130
    except IncdaiError as e:
        print(f"incdai: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
