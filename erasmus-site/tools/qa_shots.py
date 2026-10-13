#!/usr/bin/env python3
"""QA: screenshot the final state of every step of every scene (reduced motion,
so timelines jump to their end), and collect console errors.

Usage: python3 tools/qa_shots.py <base-url> <out-dir> [--motion] [--scenes 1,2,3] [--engine chromium|webkit]
"""
import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

args = sys.argv[1:]
base = args[0]
out = Path(args[1]); out.mkdir(parents=True, exist_ok=True)
motion = "--motion" in args
only = None
if "--scenes" in args:
    only = {int(x) for x in args[args.index("--scenes") + 1].split(",")}
engine = args[args.index("--engine") + 1] if "--engine" in args else "chromium"

errors = []
with sync_playwright() as p:
    br = getattr(p, engine).launch()
    ctx = br.new_context(viewport={"width": 1920, "height": 1080}, reduced_motion="no-preference" if motion else "reduce")
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(f"console.{m.type}: {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
    page.goto(base + "/agriculture/index.html#s1")
    page.wait_for_function("window.__deck && window.__deck.scenes && window.__deck.state().current === 0", timeout=15000)
    time.sleep(1.2)
    meta = page.evaluate("window.__deck.scenes.map(s => ({id: s.id, steps: s.steps || 1, backup: !!s.backup}))")
    for i, sc in enumerate(meta):
        n = i + 1
        if only and n not in only:
            continue
        for k in range(sc["steps"]):
            page.evaluate(f"location.hash = '#s{n}.{k}'")
            time.sleep(0.35 if not motion else 7.5)
            # let lazy images decode
            page.wait_for_function("[...document.querySelectorAll('.scene.active img[src]')].every(i => i.complete)", timeout=8000)
            time.sleep(0.25)
            f = out / f"s{n:02d}_{k}_{sc['id']}.png"
            page.screenshot(path=str(f))
    br.close()
(out / "errors.json").write_text(json.dumps(errors, indent=2))
print(f"{len(errors)} console messages")
for e in errors[:40]:
    print(" ", e)
