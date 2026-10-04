#!/usr/bin/env python3
"""QA: navigation reliability with real animations.

1. Hammer → 150× at 25 ms: no input lost or doubled (position == expected).
2. Hammer ← back to the start.
3. Held key (repeat events) does not move.
4. Wheel/touchpad: an inertia burst = exactly one step.
5. Back navigation: for chosen (scene, step) pairs, step forward then back and
   compare with the forward reference screenshot (mean pixel difference).
6. Refresh mid-presentation resumes the same scene + step.
Usage: python3 tools/qa_nav.py <base-url> <ref-shots-dir> <out-dir>
"""
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops, ImageStat

base, ref, out = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3]); out.mkdir(parents=True, exist_ok=True)
res = {"errors": []}
def state(pg): return pg.evaluate("window.__deck.state()")
def total_steps(pg): return pg.evaluate("window.__deck.scenes.filter(s=>!s.backup).reduce((a,s)=>a+(s.steps||1),0)")
def flat_index(pg):
    return pg.evaluate("(() => { const st = window.__deck.state(); let n = 0; for (let i = 0; i < st.current; i++) n += window.__deck.scenes[i].steps || 1; return n + st.step; })()")

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={"width": 1920, "height": 1080})
    pg = ctx.new_page()
    pg.on("pageerror", lambda e: res["errors"].append(str(e)))
    pg.on("console", lambda m: res["errors"].append(m.text) if m.type == "error" else None)
    pg.goto(base + "/agriculture/index.html#s1")
    pg.wait_for_function("window.__deck && window.__deck.state().current === 0", timeout=15000)
    time.sleep(1)
    N = total_steps(pg)
    # 1. hammer forward
    for _ in range(150):
        pg.keyboard.press("ArrowRight"); time.sleep(0.025)
    time.sleep(0.8)
    res["hammer_forward"] = {"expected": min(150, N - 1), "got": flat_index(pg)}
    # 2. hammer back
    for _ in range(200):
        pg.keyboard.press("ArrowLeft"); time.sleep(0.025)
    time.sleep(0.8)
    res["hammer_back"] = {"expected": 0, "got": flat_index(pg)}
    # 3. held key: keydown repeat events must not move
    pg.evaluate("location.hash = '#s5'"); time.sleep(0.8)
    before = flat_index(pg)
    pg.evaluate("for (let i = 0; i < 20; i++) dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', repeat: i > 0 }))")
    time.sleep(0.5)
    res["held_key"] = {"expected": before + 1, "got": flat_index(pg)}
    # 4. wheel inertia bursts
    pg.evaluate("location.hash = '#s3'"); time.sleep(0.8)
    pg.mouse.move(960, 540)
    before = flat_index(pg)
    for burst in range(3):
        for d in [6, 18, 40, 90, 120, 110, 90, 70, 50, 35, 24, 16, 10, 6, 4, 2, 1]:
            pg.mouse.wheel(0, d); time.sleep(0.03)
        time.sleep(0.45)
    res["wheel_bursts"] = {"expected": before + 3, "got": flat_index(pg)}
    # 5. back navigation vs forward reference
    diffs = {}
    pairs = [(1, 1), (1, 2), (2, 1), (4, 1), (4, 2), (6, 4), (7, 1), (11, 0), (11, 2), (13, 1), (14, 1), (14, 2), (15, 1), (15, 2), (16, 0), (17, 2), (20, 2), (21, 2), (22, 2)]
    for (n, k) in pairs:
        pg.evaluate(f"location.hash = '#s{n}.{k + 1}'"); time.sleep(1.2)
        pg.keyboard.press("ArrowLeft"); time.sleep(6.5)
        st = state(pg)
        f = out / f"back_s{n:02d}_{k}.png"; pg.screenshot(path=str(f))
        refs = sorted(ref.glob(f"s{n:02d}_{k}_*.png"))
        if refs:
            a = Image.open(refs[0]).convert("L").resize((480, 270)); b = Image.open(f).convert("L").resize((480, 270))
            diffs[f"s{n}.{k}"] = {"pos": [st["current"] + 1, st["step"]], "meanDiff": round(ImageStat.Stat(ImageChops.difference(a, b)).mean[0], 2)}
    res["back_vs_forward"] = diffs
    # 6. refresh resumes
    pg.evaluate("location.hash = '#s15.3'"); time.sleep(1.5)
    pg.reload(); pg.wait_for_function("window.__deck && window.__deck.state().current >= 0", timeout=15000); time.sleep(1)
    st = state(pg); res["refresh"] = {"expected": [15, 3], "got": [st["current"] + 1, st["step"]]}
    br.close()
(out / "nav.json").write_text(json.dumps(res, indent=2))
print(json.dumps(res, indent=2))
