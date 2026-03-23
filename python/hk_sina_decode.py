from __future__ import annotations

import json
import sys

from akshare.stock.cons import hk_js_decode
from py_mini_racer import MiniRacer


def main() -> int:
    payload = sys.stdin.read().strip()
    if not payload:
        sys.stdout.write("[]")
        return 0

    ctx = MiniRacer()
    ctx.eval(hk_js_decode)
    rows = ctx.call("d", payload)
    sys.stdout.write(json.dumps(rows, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
