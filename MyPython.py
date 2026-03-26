from __future__ import annotations

import sys


if hasattr(sys.stdin, 'reconfigure'):
    sys.stdin.reconfigure(encoding='utf-8')

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')


def run(text: str) -> str:
    return f"Python模块已收到: {text}"


if __name__ == "__main__":
    input_text = sys.stdin.read()
    sys.stdout.write(run(input_text))
