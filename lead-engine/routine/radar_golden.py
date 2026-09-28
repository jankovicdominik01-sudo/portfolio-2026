# -*- coding: utf-8 -*-
"""
Golden set test Lead Radaru — meria presnosť resolvera na RUČNE OVERENÝCH reálnych firmách.

  python3 lead-engine/routine/radar_golden.py --golden /cesta/golden.json --work /tmp/golden
  python3 lead-engine/routine/radar_golden.py --engine URL --key KEY --work /tmp/golden     (golden set z Lead Engine)

Golden set obsahuje firemné kontakty → NIE JE v repozitári (je v súkromnom úložisku Lead Engine,
GET/PUT /leady/api/v1/golden). Vyhľadávanie ide cez rovnaké kolá ako ranná rutina (exit 10 → agent WebSearch).

Metriky (nie iba „testy prešli“):
  IDENTITY PRECISION   pri tvrdenom IČO: sedí s overeným?
  WEBSITE PRECISION    pri tvrdenom (confirmed/probable) webe: je to overená doména?
  WEBSITE RECALL       z firiem s overeným webom: koľko sme našli?
  FALSE „NO WEB“       firma MÁ web, my tvrdíme „web sme nenašli“ (musí byť 0)
  CATEGORY PRECISION   pri istej kategórii (medium/high): sedí?
  PHONE PRECISION      primárny telefón = overený telefón?
  DUPLICATE RATE       dve rôzne golden firmy zlúčené do jednej
  UNKNOWN RATE         kategória unknown / web uncertain
"""
import argparse
import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from radar.net import Net  # noqa: E402
from radar.normalize import phone_e164  # noqa: E402
from radar.pipeline import Radar  # noqa: E402
from radar.search import AgentProvider, BraveProvider, GoogleCSEProvider, Search  # noqa: E402


def load(a):
    if a.golden:
        d = json.load(open(a.golden, encoding="utf-8"))
        return d.get("entries", d)
    req = urllib.request.Request(a.engine.rstrip("/") + "/leady/api/v1/golden", headers={"Authorization": "Bearer " + a.key})
    return json.loads(urllib.request.urlopen(req, timeout=60).read())["entries"]


def evaluate(entries, ents_by_seed):
    m = {k: [0, 0] for k in ("identity", "website_precision", "website_recall", "category", "phone")}
    false_no_web, unknown_cat, uncertain_web, rows = 0, 0, 0, []
    for g in entries:
        e = ents_by_seed.get(g["id"])
        x = g["expect"]
        if not e:
            rows.append((g["id"], "STOP", "firma vyradená skoro: " + "?"))
            continue
        ico = next((f["value"] for f in e["company_ids"] if f["confidence"] != "low"), None)
        if ico and x.get("ico"):
            m["identity"][1] += 1
            m["identity"][0] += ico == x["ico"]
        res = e.get("website_resolution")
        dom = (e.get("website") or {}).get("domain")
        if res in ("confirmed", "probable"):
            m["website_precision"][1] += 1
            m["website_precision"][0] += bool(x.get("website_domain")) and dom == x["website_domain"]
        if x.get("website_domain"):
            m["website_recall"][1] += 1
            m["website_recall"][0] += dom == x["website_domain"] and res in ("confirmed", "probable")
            if res == "no_website_found":
                false_no_web += 1
        if res == "uncertain":
            uncertain_web += 1
        cat = e.get("category") or {}
        if cat.get("confidence") in ("medium", "high"):
            m["category"][1] += 1
            m["category"][0] += cat.get("id") == x["category"]
        else:
            unknown_cat += 1
        ph = (e.get("primary_phone") or {}).get("value")
        if ph and x.get("phone"):
            m["phone"][1] += 1
            m["phone"][0] += ph == phone_e164(x["phone"], g["country"])
        rows.append((g["id"], f"{res}:{dom or '-'}", f"{cat.get('id')}({cat.get('confidence')}) {e.get('data_quality')} → {e.get('recommended_caller')}"))
    ids = [e["id"] for e in ents_by_seed.values()]
    dup = len(ids) - len(set(ids))
    pct = lambda n, d: f"{n}/{d} = {round(100 * n / d)} %" if d else "—"
    return {
        "IDENTITY PRECISION": pct(*m["identity"]), "WEBSITE PRECISION": pct(*m["website_precision"]),
        "WEBSITE RECALL": pct(*m["website_recall"]), "FALSE NO-WEB": false_no_web, "CATEGORY PRECISION": pct(*m["category"]),
        "PHONE PRECISION": pct(*m["phone"]), "DUPLICATE RATE": pct(dup, len(entries)),
        "UNKNOWN RATE": f"kategória {unknown_cat}, web neistý {uncertain_web} z {len(entries)}",
    }, rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--golden")
    ap.add_argument("--engine")
    ap.add_argument("--key")
    ap.add_argument("--work", default="/tmp/golden")
    a = ap.parse_args()
    os.makedirs(a.work, exist_ok=True)
    entries = load(a)
    net = Net(cache_dir=os.path.join(a.work, "cache"))
    search = Search([AgentProvider(os.path.join(a.work, "search_results.json")), BraveProvider(), GoogleCSEProvider()],
                    cache_path=os.path.join(a.work, "search_cache.json"))
    rad = Radar(net, search, log=lambda *x: None)
    records = []
    for g in entries:
        r = dict(g["seed"], country=g["country"], golden_id=g["id"])
        records.append(r)
    ents = rad.run(records, deep_limit=len(records), search_limit=len(records), budget_scale=0.4)
    by_seed = {}
    for e in ents:
        for s in e["sources"]:
            for g in entries:
                if s.get("url") and s["url"] == g["seed"].get("profile"):
                    by_seed[g["id"]] = e
    search.save()
    if search.pending:
        json.dump({"queries": search.pending}, open(os.path.join(a.work, "search_requests.json"), "w"), ensure_ascii=False, indent=1)
        print(f"ČAKÁ NA VYHĽADÁVANIE: {len(search.pending)} dopytov → {a.work}/search_requests.json")
        sys.exit(10)
    metrics, rows = evaluate(entries, by_seed)
    for k, v in metrics.items():
        print(f"{k:20} {v}")
    for r in rows:
        print("  ", *r)
    json.dump({"metrics": metrics, "rows": rows}, open(os.path.join(a.work, "golden_report.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
