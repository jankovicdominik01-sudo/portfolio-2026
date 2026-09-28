# -*- coding: utf-8 -*-
"""
Lead Radar — ranná rutina (SK + CZ, Soňa + Jozo).

  python3 lead-engine/routine/radar_run.py --engine https://lead-engine-seven-murex.vercel.app --key "$KEY" \
      --exclude /tmp/vylucene.json --work /tmp/radar

Beh v kolách (vyhľadávanie robí agent nástrojom WebSearch — legitímne API; HTML vyhľadávačov nescrapujeme):
  1. skript zbiera z katalógov / registrov a zapíše dopyty do  WORK/search_requests.json   → exit 10
  2. agent pre každý dopyt spustí WebSearch a výsledky ZAPÍŠE do WORK/search_results.json
     {"results": {"<dopyt>": [{"title","url","snippet"}...]}}
  3. skript sa spustí znova s rovnakými parametrami (cache) → ďalšie kolo alebo exit 0 s WORK/upload.json
Max. 3 kolá. Exit 0 = hotovo (upload.json pripravený), 10 = čaká na vyhľadávanie, 2 = chyba.

--recheck: ľahké preverenie leadov vo fronte pred hovorom (web stále funguje? nový web? zmena kontaktu?)
"""
import argparse
import datetime
import functools
import json
import os
import random
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
print = functools.partial(print, flush=True)  # noqa: A001 — priebeh viditeľný aj pri presmerovaní do súboru
import leady  # noqa: E402  (katalógy azet / zoznam / bazoš + vylúčenia)
from radar import sources as S  # noqa: E402
from radar.entity import dedupe_keys, display_name, from_record  # noqa: E402
from radar.net import Net  # noqa: E402
from radar.normalize import bez, host, phone_e164  # noqa: E402
from radar.pipeline import Radar  # noqa: E402
from radar.search import AgentProvider, BraveProvider, GoogleCSEProvider, Search, yield_report  # noqa: E402
from radar.social import parse_result  # noqa: E402
from radar.taxonomy import CATS, CITIES, JOZO_DEFAULT, SONA_DEFAULT, neighbors, terms  # noqa: E402

MAX_ROUNDS = 3
PER_CITY, PER_CATEGORY, EXPLORATION = 2, 4, 2


def api(engine, key, path, body=None, method=None):
    req = urllib.request.Request(engine.rstrip("/") + path, data=json.dumps(body).encode() if body is not None else None,
                                 method=method or ("POST" if body is not None else "GET"),
                                 headers={"Authorization": "Bearer " + key, "Content-Type": "application/json", "User-Agent": "lead-radar"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode())


# ─────────────── plán discovery (query generator + locality engine) ───────────────

def plan(callers, routing, recent, day, countries=("SK", "CZ"), cities_per=1, search_strategies=1):
    """Pre každého volajúceho s potrebou: jeho kategórie × krajina × mesto × stratégia. Rotuje lokality aj segmenty,
    nerobí dopyty spustené za posledné 3 týždne, pridá 1 exploration segment. Katalógy sú zadarmo; vyhľadávanie
    (drahé) iba `search_strategies` stratégií na kategóriu × krajinu × mesto."""
    rnd = random.Random(day)
    jobs = []
    for c in callers:
        if c.get("need", 0) <= 0:
            continue
        mine = [k for k, v in CATS.items() if k != "ine" and (routing.get(k) or v["caller"]) == c["caller"]]
        rnd.shuffle(mine)
        others = [k for k in CATS if k != "ine" and k not in mine and CATS[k]["caller"] == c["caller"]]
        n_cat = min(len(mine), 2 + c["need"] // 4)
        explore = [x for x in mine[n_cat:n_cat + 1]] or rnd.sample(others, min(1, len(others)))
        for cat in mine[:n_cat] + explore:
            for country in countries:
                jobs.append({"caller": c["caller"], "category": cat, "country": country, "city": None, "strategy": "catalog",
                             "query": None, "exploration": cat in explore})
                cities = CITIES[country][:]
                rnd.shuffle(cities)
                strategies = (["instagram", "google"] if CATS[cat]["ig"] else ["google", "facebook"])[:search_strategies]
                picked = 0
                for city in cities:
                    qs = [(st, query_for(st, cat, country, city)) for st in strategies]
                    qs = [(st, q) for st, q in qs if q and q.lower() not in recent]
                    if not qs:
                        continue
                    for st, q in qs:
                        jobs.append({"caller": c["caller"], "category": cat, "country": country, "city": city, "strategy": st,
                                     "query": q, "exploration": cat in explore})
                    picked += 1
                    if picked >= cities_per:
                        break
    return jobs


def query_for(strategy, cat, country, city):
    t = terms(cat, country)
    if not t:
        return None
    term = t[0]
    if strategy == "google":
        return f"{term} {city}"
    if strategy == "instagram":
        return f"site:instagram.com {term} {city}"
    if strategy == "facebook":
        return f"site:facebook.com {term} {city}"
    return None  # catalog = katalógové adaptéry (bez vyhľadávača)


def discover(jobs, net, search, day, places_key=None, log=print):
    rnd = random.Random("cat" + day)
    records, health = [], {"azet": "ok", "zlatestranky_sk": "ok", "zlatestranky_cz": "ok", "search": "ok", "instagram_direct": "unavailable",
                           "facebook_direct": "unavailable", "places": "ok" if places_key else "not_configured"}
    done_cat = set()
    for j in jobs:
        cat, country, city = j["category"], j["country"], j["city"]
        meta = {"purpose": "discovery", "strategy": j["strategy"], "category": cat, "country": country, "city": city, "caller": j["caller"]}
        if j["strategy"] == "catalog" and (cat, country) not in done_cat:
            done_cat.add((cat, country))
            if country == "SK":
                for slug in CATS[cat].get("azet", [])[:1]:
                    pages = S.azet_pages(net, slug)
                    if not pages:
                        health["azet"] = "degraded"
                        continue
                    rows = S.azet_list(net, slug, rnd.randint(1, pages)) or []
                    for r in rows[:10]:
                        r["vertical"] = cat
                        records.append(S.azet_profile(net, r))
                for zc in CATS[cat].get("zs", [])[:1]:
                    rows = S.zs_sk_list(net, zc, rnd.randint(1, 5))
                    if rows is None:
                        health["zlatestranky_sk"] = "degraded"
                    for r in (rows or [])[:10]:
                        r["vertical"] = cat
                        records.append(r)
                if cat in leady.VERTICALS and CATS[cat].get("bazos"):
                    try:
                        for r in leady.bazos(cat, limit=5):
                            r.update(country="SK", vertical=cat)
                            records.append(r)
                    except Exception:
                        pass
            else:
                for term in terms(cat, "CZ")[:1]:
                    rows = S.zs_cz_search(net, term)
                    if rows is None:
                        health["zlatestranky_cz"] = "degraded"
                    for r in (rows or [])[:10]:
                        r["vertical"] = cat
                        records.append(S.zs_cz_profile(net, r))
            if places_key:
                try:
                    pc = city or random.Random(day + cat).choice(CITIES[country])
                    for r in S.places(f"{terms(cat, country)[0]} {pc}", places_key, country):
                        r["vertical"] = cat
                        records.append(r)
                except Exception:
                    health["places"] = "degraded"
            continue
        if not j["query"]:
            continue
        res = search.run(j["query"], kind="social" if j["strategy"] in ("instagram", "facebook") else "web", meta=meta)
        if res is None:
            continue
        before = len(records)
        for r in res[:10]:
            prof = parse_result(r)
            if prof:
                if not prof["business_signal"]:
                    continue
                records.append({"name": prof["display_name"] or prof["handle"], "source": f"search:{prof['platform']}", "country": country,
                                "city": prof["city"], "profile": prof["url"], "vertical": cat,  # mesto IBA z profilu, nie z dopytu
                                "socials": [dict(prof, match="confirmed", evidence=prof["evidence"] + ["profil je zdrojom záznamu"])],
                                "phones": [], "description": prof.get("bio") or ""})
                continue
            if "azet.sk/firma/" in (r.get("url") or ""):
                records.append(S.azet_profile(net, {"name": r.get("title", "").split(" - ")[0], "profile": r["url"], "source": "azet",
                                                    "country": "SK", "vertical": cat, "city": city}))
                continue
            seed = S.result_to_seed(r, country, cat)
            if seed:
                records.append(seed)  # mesto doplní až fingerprint webu (adresa), nie dopyt
        search.record_yield(j["query"], new_businesses=len(records) - before)
    health["search"] = "ok" if any(p.name == "agent" for p in search.providers) else "degraded"
    return records, health


# ─────────────── výber a výstup ───────────────

def profile_out(e):
    """Kompaktný profil pre Lead Engine (bez HTML tiel a veľkých fingerprintov)."""
    webs = []
    for w in e["websites"]:
        webs.append({k: w.get(k) for k in ("url", "domain", "verdict", "confidence", "evidence", "negative", "sources", "social_links",
                                           "redirect_chain", "checked_at")} | {"health": w.get("health")})
    return {
        "version": 1, "entity_id": e["id"], "country": e["country"], "legal_name": e["legal_name"], "brand_names": e["brand_names"][:5],
        "historical_names": e.get("historical_names", []), "city": e["city"],
        "addresses": e["addresses"][:3], "company_ids": e["company_ids"], "phones": e["phones"][:4], "emails": e["emails"][:4],
        "primary_phone": e.get("primary_phone"), "website": e.get("website"), "website_resolution": e.get("website_resolution"),
        "websites": webs[:5], "historical_websites": e["historical_websites"][:5], "rejected_websites": e["rejected_websites"][:8],
        "socials": [{k: s.get(k) for k in ("platform", "url", "handle", "display_name", "city", "bio", "website", "match", "evidence",
                                             "activity", "source", "verified_at")} for s in e["socials"] if s.get("match") in ("confirmed", "probable", "catalog", "uncertain")][:6],
        "category": e.get("category"), "services": e.get("services", []), "description": e.get("description"),
        "business_status": e.get("business_status"), "commercial_problems": e.get("commercial_problems", []),
        "social_first": e.get("social_first", False), "identity": e["identity"], "data_quality": e.get("data_quality"),
        "data_quality_why": e.get("data_quality_why", []), "recommended_caller": e.get("recommended_caller"),
        "caller_fit": e.get("caller_fit"), "score": e.get("score"), "sources": e["sources"][:8],
        "possible_duplicates": e.get("possible_duplicates", [])[:3], "source_unavailable": e.get("source_unavailable", []),
        "register": {k: (e.get("register") or {}).get(k) for k in ("registry", "found", "ico", "name", "municipality", "established", "dead", "matched_by")} if e.get("register") else None,
        "last_verified": e.get("last_verified", {}), "trace": e["trace"][-60:], "exploration": e.get("exploration", False),
        "web_search_queries": e.get("web_search_queries", [])[:6],
    }


def company_out(e):
    web = (e.get("website") or {}).get("url")
    ph = (e.get("primary_phone") or {}).get("value")
    mail = next((f["value"] for f in e["emails"] if f["confidence"] != "low"), None)
    addr = next((f["value"] for f in e["addresses"]), None)
    return {"name": display_name(e)[:200], "category": (e.get("category") or {}).get("id") or "ine", "city": e["city"], "country": e["country"],
            "phone": ph, "email": mail, "website": web if (e.get("website_resolution") in ("confirmed", "probable")) else None,
            "address": addr, "ico": next((f["value"] for f in e["company_ids"]), None),
            "contact_person": None, "social_profiles": [s["url"] for s in e["socials"] if s.get("match") == "confirmed"][:4],
            "source_url": next((s["url"] for s in e["sources"] if s.get("url")), None),
            "sources": [{"source": s["source"], "url": s.get("url")} for s in e["sources"]][:8]}


def select(ents, callers, countries=("SK", "CZ")):
    """Per volajúci: GOLD pred SILVER, podľa skóre; max 2 z mesta, 4 z kategórie, 2 exploration, krajiny vyvážene
    (každá krajina najviac polovicu, zvyšok doplní druhá). Radšej menej ako odpad."""
    out = {}
    for c in callers:
        need = c.get("need", 0)
        pool = [e for e in ents if not e.get("stopped") and e.get("recommended_caller") == c["caller"] and e.get("data_quality") in ("gold", "silver")]
        pool.sort(key=lambda e: (e["data_quality"] != "gold", -e["score"]["points"]))
        cap = {k: -(-need // len(countries)) for k in countries}
        picked, city_n, cat_n, expl, cn = [], {}, {}, 0, {}
        for rnd in (0, 1):  # 1. kolo s kvótou krajín, 2. kolo doplní zvyšok
            for e in pool:
                if len(picked) >= need:
                    break
                if e in picked or (rnd == 0 and cn.get(e["country"], 0) >= cap.get(e["country"], need)):
                    continue
                ck, kk = bez(e["city"] or ""), e["category"]["id"]
                if city_n.get(ck, 0) >= PER_CITY or cat_n.get(kk, 0) >= PER_CATEGORY:
                    continue
                if e.get("exploration"):
                    if expl >= EXPLORATION:
                        continue
                    expl += 1
                city_n[ck] = city_n.get(ck, 0) + 1
                cat_n[kk] = cat_n.get(kk, 0) + 1
                cn[e["country"]] = cn.get(e["country"], 0) + 1
                picked.append(e)
        out[c["caller"]] = picked
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--engine", required=True)
    ap.add_argument("--key", default=os.environ.get("LEAD_ENGINE_KEY"), help="predvolene env LEAD_ENGINE_KEY (kľúč nie je v zozname procesov)")
    ap.add_argument("--exclude")
    ap.add_argument("--work", default="/tmp/radar")
    ap.add_argument("--countries", default="SK,CZ")
    ap.add_argument("--deep", type=int, default=60, help="koľko firiem hĺbkovo analyzovať")
    ap.add_argument("--max-queries", type=int, default=70, help="max. nových dopytov na vyhľadávanie v jednom kole")
    ap.add_argument("--recheck", action="store_true")
    ap.add_argument("--callers", help="prepíše potrebu z Lead Engine, napr. sona:5,jozo:5 (QA / ručný beh)")
    ap.add_argument("--search-limit", type=int, default=25, help="koľko firiem smie ísť do vyhľadávania")
    ap.add_argument("--no-upload-plan", action="store_true", help="nepýtať sa Lead Engine (offline QA)")
    a = ap.parse_args()
    if not a.key and not a.no_upload_plan:
        sys.exit("Chýba kľúč: nastav LEAD_ENGINE_KEY")
    os.makedirs(a.work, exist_ok=True)
    day = datetime.date.today().isoformat()
    net = Net(cache_dir=os.path.join(a.work, "cache"))
    providers = [AgentProvider(os.path.join(a.work, "search_results.json")), BraveProvider(), GoogleCSEProvider()]
    search = Search(providers, cache_path=os.path.join(a.work, "search_cache.json"), memory_path=os.path.join(a.work, "query_memory.json"))
    state_p = os.path.join(a.work, "state.json")
    state = json.load(open(state_p)) if os.path.exists(state_p) else {"day": day, "round": 0}
    if state.get("day") != day:
        state = {"day": day, "round": 0}
    state["round"] += 1

    morning = {} if a.no_upload_plan else api(a.engine, a.key, "/leady/api/v1/routines/morning")
    callers = morning.get("callers") or [{"caller": morning.get("caller"), "need": morning.get("need", 0)}]
    if a.callers:
        callers = [{"caller": c.split(":")[0], "need": int(c.split(":")[1])} for c in a.callers.split(",")]
    routing = morning.get("routing") or {}
    active = tuple(c["caller"] for c in callers if c.get("caller"))
    recent = {q.lower() for q in morning.get("recent_queries", [])} | {m["query"].lower() for m in search.memory
                                                                          if m.get("purpose") == "discovery" and m.get("executed_at", "")[:10] < day}
    print(f"VOLAJÚCI: " + ", ".join(f"{c['caller']} potrebuje {c.get('need', 0)}" for c in callers))

    if a.recheck:
        return recheck(a, net, search, routing, active)

    ex = leady.load_exclusions(a.exclude, a.engine, a.key)
    keys = {f"email:{m}" for m in ex["emails"]} | {f"domain:{d}" for d in ex["domains"]} | {f"phone:{p[-9:]}" for p in ex["phones"] if p}
    api_search = any(p.configured() and p.name != "agent" for p in providers)
    jobs = plan(callers, routing, recent, day, tuple(a.countries.split(",")), cities_per=3 if api_search else 1,
                search_strategies=2 if api_search else 1)
    print(f"PLÁN: {len(jobs)} discovery úloh ({len({(j['category'], j['country']) for j in jobs})} segmentov × krajín)")
    records, health = discover(jobs, net, search, day, os.environ.get("GOOGLE_PLACES_KEY"))
    print(f"  discovery: {len(records)} záznamov")
    rad = Radar(net, search, routing=routing, active=active, exclusions={"keys": keys, "names": ex["names"]})
    ents = rad.run(records, deep_limit=a.deep, search_limit=a.search_limit if not api_search else a.deep,
                   budget_scale=1.0 if api_search else 0.25)
    for e in ents:
        e["exploration"] = any(j["exploration"] and j["category"] == (e.get("category") or {}).get("id") for j in jobs)

    pending = search.pending[: a.max_queries]
    json.dump({"day": day, "round": state["round"], "queries": pending}, open(os.path.join(a.work, "search_requests.json"), "w"),
              ensure_ascii=False, indent=1)
    search.save()
    json.dump(state, open(state_p, "w"))
    if pending and state["round"] < MAX_ROUNDS:
        print(f"ČAKÁ NA VYHĽADÁVANIE: {len(pending)} dopytov → {a.work}/search_requests.json (kolo {state['round']}/{MAX_ROUNDS})")
        sys.exit(10)

    chosen = select(ents, callers, tuple(a.countries.split(",")))
    items, rejected = [], []
    for caller, lst in chosen.items():
        for e in lst:
            items.append({"company": company_out(e), "radar": profile_out(e)})
    chosen_ids = {e["id"] for lst in chosen.values() for e in lst}
    for e in ents:
        if e["id"] in chosen_ids:
            continue
        if e.get("stopped") and e["stopped"].startswith(("už je v Lead Engine", "meno na zozname", "mimo dnešného")):
            continue  # nič nové — neukladáme
        if e.get("stopped") or e.get("data_quality") == "research":
            web_ok = (e.get("website") or {}).get("health", {}) and (e.get("website") or {}).get("health", {}).get("state") == "working"
            reason = "quality_web" if web_ok and not e.get("commercial_problems") else \
                "inactive" if "zanikla" in (e.get("stopped") or "") else "irrelevant_segment" if "segment" in (e.get("stopped") or "") \
                else "bad_contact" if "kontakt" in (e.get("stopped") or "") else "unverifiable"
            if e["phones"] or e["company_ids"]:
                rejected.append({"company": company_out(e), "reject": {"reason": reason, "why": (e.get("stopped") or "; ".join(e.get("data_quality_why", [])))[:280]},
                                 "radar": profile_out(e)})
    report = {
        "day": day, "rounds": state["round"], "stats": rad.stats, "provider_health": health | {k: v for k, v in search.health.items()},
        "net": net.stats, "queries": len(search.memory), "yield": yield_report(search.memory)[:40],
        "selected": {k: len(v) for k, v in chosen.items()}, "need": {c["caller"]: c.get("need", 0) for c in callers},
        "query_log": [m for m in search.memory if m.get("executed_at", "")[:10] == day][-400:],
    }
    json.dump({"researched": items + rejected[:60], "radar_report": report}, open(os.path.join(a.work, "upload.json"), "w"), ensure_ascii=False, indent=1)
    print(f"VÝSLEDOK: " + ", ".join(f"{k}: {len(v)}/{report['need'].get(k)}" for k, v in chosen.items())
          + f" · tiers {rad.stats['tiers']} · web {rad.stats['resolution']} → {a.work}/upload.json")
    for caller, lst in chosen.items():
        for e in lst:
            w = e.get("website") or {}
            print(f"  [{caller:5} {e['data_quality']:6} {e['score']['points']:>4}] {e['country']} {e['category']['id'][:14]:14} {display_name(e)[:34]:34} "
                  f"| {(e['city'] or '')[:16]:16} | web {e['website_resolution']:16} {w.get('domain') or ''} | "
                  + ", ".join(p["code"] for p in e["commercial_problems"]))
    sys.exit(0)


def recheck(a, net, search, routing, active):
    """Ľahké preverenie pred hovorom: web (stále funguje / nový), zdravie, kontakt. Výstup: WORK/recheck.json → PATCH."""
    leads = api(a.engine, a.key, "/leady/api/v1/leads").get("leads", [])
    todo = [l for l in leads if l.get("status") == "ready_to_call" and (l.get("call_attempts") or 0) == 0]
    patches = []
    rad = Radar(net, search, routing=routing, active=active)
    for l in todo[:40]:
        c = l.get("company") or {}
        prof = c.get("profile") or {}
        rec = {"name": c.get("name"), "source": "lead_engine", "country": c.get("country") or "SK", "city": c.get("city"),
               "phone": c.get("phone"), "email": c.get("email"), "ico": c.get("ico"), "websites": [c["website"]] if c.get("website") else [],
               "description": (prof.get("description") or {}).get("text") if prof.get("description", {}).get("confidence") not in (None, "unknown") else "",
               "socials": [dict(s) for s in prof.get("socials", []) if s.get("match") == "confirmed"]}
        e = from_record(rec)
        e["id"] = l["id"]
        e["rejected_websites"] = prof.get("rejected_websites", [])
        rad.pass3(e, 4)
        rad.pass4(e)
        rad.pass5(e)
        rad.pass6(e)
        before = l.get("website_resolution") or prof.get("website_resolution")
        after = e["website_resolution"]
        patches.append({"id": l["id"], "name": c.get("name"), "before": before, "after": after,
                        "profile": profile_out(e), "changed": before != after})
    search.save()
    json.dump({"patches": patches, "pending_queries": search.pending}, open(os.path.join(a.work, "recheck.json"), "w"), ensure_ascii=False, indent=1)
    ch = [p for p in patches if p["changed"]]
    print(f"RECHECK: {len(patches)} leadov, zmena stavu webu pri {len(ch)}: " + ", ".join(f"{p['name']} {p['before']}→{p['after']}" for p in ch))
    sys.exit(10 if search.pending else 0)


if __name__ == "__main__":
    main()
