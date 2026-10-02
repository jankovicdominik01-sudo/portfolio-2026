# -*- coding: utf-8 -*-
"""
Staged enrichment waterfall (max. užitočných dát na request, nie max. requestov):

  PASS 1  normalizácia + dedupe + základná existencia (nesegment, bez kontaktu, vylúčené)   → STOP EARLY
  PASS 2  identita: register (RPO / ARES), telefón → reverse vyhľadávanie
  PASS 3  search / social discovery (fan-out dopyty v poradí priority, early-stop, rozpočet na firmu)
  PASS 4  website candidates → fingerprint → ownership (confirmed / probable / uncertain / rejected)
  PASS 5  zdravie webu + klasifikácia + popis + commercial opportunity   (iba perspektívne firmy)
  PASS 6  data quality gate + routing + skóre

Každý krok zapisuje trace (TRACE LEAD v admine).
"""
import datetime
import re

from . import classify as C
from . import quality as Q
from . import signals as SIG
from .entity import (HIGH, MEDIUM, LOW, add_fact, dedupe_keys, display_name, from_record, identity_confidence, now,
                     own_domains, resolve, trace)
from .net import Blocked, resolves
from .normalize import bez, host, name_tokens, phone_e164, phone_variants
from .social import matches_entity, parse_result
from .sources import register_for, result_to_seed
from .taxonomy import CATS
from .website import candidate_urls, fingerprint, health, ownership

BUDGET = {"ordinary": 5, "promising": 10, "high_value": 15}


class Radar:
    def __init__(self, net, search, routing=None, active=(), exclusions=None, today=None, log=print):
        self.net, self.search = net, search
        self.routing = routing or {}
        self.active = active
        self.ex = exclusions or {}
        self.today = today or datetime.date.today()
        self.log = log
        self.stats = {"seeds": 0, "entities": 0, "stopped": {}, "tiers": {}, "resolution": {}}

    # ─────────── PASS 1 ───────────
    def pass1(self, records):
        ents = [from_record(r) for r in records]
        self.stats["seeds"] = len(ents)
        ents = resolve(ents)
        self.stats["entities"] = len(ents)
        keep = []
        for e in ents:
            why = self.stop_reason(e)
            if why:
                self._stop(e, why)
            else:
                keep.append(e)
        return ents, keep

    ORG = re.compile(r"\b(z\.\s?s\.|o\.\s?z\.|asociac|asociace|spolek|svaz|zvaz|zdruzenie|sdruzeni|nadacia|nadace|komora|cech|"
                     r"skola|univerzit|obec |mesto |mestsky|obecni|statni|stat\w* podnik|cirkev|farnost)", re.I)

    def stop_reason(self, e):
        nm = bez(" ".join(e["brand_names"] + ([e["legal_name"]] if e["legal_name"] else [])))
        if self.ORG.search(nm):
            return "nie je firma (združenie / úrad / škola)"
        seg = C.never_segment(e)
        if seg:
            return f"mimo segment ({seg})"
        if not (e["phones"] or e["website_candidates"] or e["socials"] or e["emails"]):
            return "bez kontaktu"
        ex = self.ex
        keys = set(dedupe_keys(e))
        if keys & ex.get("keys", set()):
            return "už je v Lead Engine / oslovená"
        if any(bez(n) in ex.get("names", set()) for n in e["brand_names"] + ([e["legal_name"]] if e["legal_name"] else [])):
            return "meno na zozname vylúčených"
        return None

    def _stop(self, e, why):
        e["stopped"] = why
        trace(e, "stop", why)
        self.stats["stopped"][why.split(" (")[0]] = self.stats["stopped"].get(why.split(" (")[0], 0) + 1

    # ─────────── PASS 2 ───────────
    def pass2(self, e):
        reg = register_for(self.net, e)
        if reg is not None:
            e["register"] = reg
            if reg.get("found"):
                add_fact(e["company_ids"], reg["ico"], "register", MEDIUM if reg.get("matched_by") else HIGH,
                         [f"{reg['registry']}: {reg['name']}" + (f" (zhoda: {reg['matched_by']})" if reg.get("matched_by") else "")])
                e["legal_name"] = reg.get("name") or e["legal_name"]
                if reg.get("all_names") and len(reg["all_names"]) > 1:
                    e["historical_names"] = [n for n in reg["all_names"][:-1] if n != reg["name"]][:5]
                trace(e, "register", f"{reg['registry']}: {reg['name']} · {reg.get('municipality') or ''}"
                      + (" · ZANIKNUTÁ" if reg.get("dead") else ""))
            else:
                trace(e, "register", "IČO sa v registri nenašlo")
        e["last_verified"]["business_status"] = now()
        if reg and reg.get("dead"):
            self._stop(e, "firma zanikla (register)")
            return False
        return True

    # ─────────── PASS 3 ───────────
    @staticmethod
    def brand(name):
        """Značka na vyhľadávanie: „Lýdia Vančová - KOZMETIKA LÝDIA“ → „KOZMETIKA LÝDIA“; bez právnej formy."""
        n = name.split(" - ", 1)[1] if " - " in name else name
        n = re.sub(r",?\s*(spol\.?\s*)?s\.?\s?r\.?\s?o\.?|,?\s*a\.\s?s\.|,?\s*k\.\s?s\.", "", n, flags=re.I).strip(" ,-")
        return n or name

    def queries(self, e):
        """Fan-out dopyty v poradí užitočnosti (telefón je najlepší identifikátor malého podnikateľa).
        Hľadá sa značka, nie meno osoby ani právna forma. IČO až nakoniec (nízky výnos)."""
        name = self.brand(display_name(e))
        city = e["city"] or ""
        qs = []
        ph = next((f["value"] for f in e["phones"]), None)
        ig_first = CATS.get(e.get("seed_category") or "ine", CATS["ine"]).get("ig")
        ig = ("instagram", f"site:instagram.com \"{name}\"")
        fb = ("facebook", f"site:facebook.com \"{name}\" {city}".strip())
        if name:
            qs.append(("name_city", f"\"{name}\" {city}".strip()))
            qs.append(ig if ig_first else fb)
        if ph:
            qs.append(("phone", f"\"{phone_variants(ph)[1]}\""))
        if name:
            qs.append(fb if ig_first else ig)
        if e.get("legal_name") and bez(self.brand(e["legal_name"])) != bez(name):
            qs.append(("legal_name", f"\"{self.brand(e['legal_name'])}\" {city}".strip()))
        ico = next((f["value"] for f in e["company_ids"]), None)
        if ico:
            qs.append(("ico", f"\"{ico}\""))
        return qs

    def enough(self, e):
        """Early-stop: potvrdený web aj social, alebo prehľadané a telefón potvrdený."""
        web = any(w.get("verdict") == "confirmed" for w in e["websites"])
        soc = any(s.get("match") == "confirmed" for s in e["socials"])
        ph = Q.phone_confidence(e)
        return web and soc and ph and ph[1] == "high"

    def pass3(self, e, budget):
        e.setdefault("web_search_queries", [])
        for purpose, q in self.queries(e):
            if self.enough(e):
                trace(e, "search", "early-stop: web + social + telefón potvrdené")
                break
            res = self.search.run(q, kind="social" if purpose in ("instagram", "facebook") else "web", entity_id=e["id"],
                                  budget=budget, meta={"purpose": "enrich:" + purpose, "country": e["country"]})
            if res is None:
                continue
            if purpose in ("phone", "name_city", "name", "ico", "legal_name") and q not in e["web_search_queries"]:
                e["web_search_queries"].append(q)
                e["web_search_done"] = len(e["web_search_queries"])  # rôzne dopyty, nie opakovania
            self.absorb(e, res, q)
        return e

    def absorb(self, e, results, q):
        """Výsledky vyhľadávania → social profily + kandidáti na web (s dôvodom)."""
        toks = set()
        for n in e["brand_names"] + ([e["legal_name"]] if e["legal_name"] else []):
            toks |= set(name_tokens(n))
        ph9 = {f["value"][-9:] for f in e["phones"]}
        for r in results:
            prof = parse_result(r)
            if prof:
                if not prof["business_signal"]:
                    continue  # osobný profil bez firemných signálov neukladáme
                verdict, why = matches_entity(prof, e)
                if verdict == "no":
                    continue
                prof.update(match=verdict, evidence=prof["evidence"] + why, query=q, verified_at=now())
                if not any(s["url"] == prof["url"] for s in e["socials"]):
                    e["socials"].append(prof)
                    trace(e, "social", f"{prof['platform']} {prof['handle']}: {verdict} ({'; '.join(why) or 'iba názov'})")
                if verdict == "confirmed":
                    for p in prof["phones_snippet"]:
                        add_fact(e["phones"], p, f"search:{prof['platform']}", LOW, [f"snippet profilu {prof['url']}"])
                continue
            u = r.get("url") or ""
            blob = bez((r.get("title") or "") + " " + (r.get("snippet") or "") + " " + host(u))
            hit_phone = any(p in re.sub(r"\D", "", blob) for p in ph9)
            # kandidát smie byť voľnejší (overuje ho až fingerprint): stačí najvýraznejšie slovo názvu (≥5 znakov)
            from .normalize import has_word
            variants = [name_tokens(n) for n in e["brand_names"] + ([e["legal_name"]] if e["legal_name"] else [])]
            hit_name = any(v and (all(has_word(t, blob) for t in v[:3]) or (len(max(v, key=len)) >= 5 and has_word(max(v, key=len), blob)))
                           for v in variants)
            if seed := result_to_seed(r, e["country"]):
                if hit_phone or hit_name:
                    d = host(u)
                    if d not in [c["domain"] for c in e["website_candidates"]] and d not in {x["domain"] for x in e["rejected_websites"]}:
                        e["website_candidates"].append({"url": f"https://{d}", "domain": d, "source": "search",
                                                        "evidence": [f"vyhľadávanie „{q}“: {r.get('title', '')[:80]}"]})

    # ─────────── PASS 4 ───────────
    def pass4(self, e):
        cands = candidate_urls(e)
        e.setdefault("websites", [])
        checked = {w["domain"] for w in e["websites"]}
        for c in cands[:6]:
            if c["domain"] in checked:
                continue
            checked.add(c["domain"])
            dns = resolves(c["domain"])
            if dns is False:
                c.update(verdict="dead", dns=False)
                e["historical_websites"].append({"domain": c["domain"], "why": "doména neexistuje (DNS)", "source": c["sources"]})
                trace(e, "website", f"{c['domain']}: doména neexistuje → historický web")
                continue
            fp = fingerprint(c["url"], self.net, e["country"])
            fp["dns"] = dns
            own = ownership(e, fp, c["sources"][0]) if fp.get("reachable") else {"verdict": "unreachable", "confidence": "low",
                                                                                 "evidence": [], "negative": [fp.get("error") or f"HTTP {fp.get('status')}"]}
            origin = {s["source"] for s in e["sources"]} == {"search:web"} and not e["phones"] and not e["company_ids"]
            if origin and fp.get("reachable") and own["verdict"] != "rejected":
                # firmu sme objavili cez jej web: web JE zdroj identity, ak na ňom je firemný kontakt (telefón / IČO)
                if fp.get("phones") or fp.get("icos"):
                    own = {"verdict": "confirmed", "confidence": "medium",
                           "evidence": ["firma objavená cez vlastný web s firemným kontaktom"], "negative": []}
                    ttl = re.split(r"\s[|–\-•]\s", fp.get("title") or "")[0].strip()
                    if ttl and ttl not in e["brand_names"]:
                        e["brand_names"].insert(0, ttl[:120])
                    city = next((a.split(" ", 2)[-1] for a in fp.get("addresses", []) if a), None)
                    e["city"] = e["city"] or (re.sub(r"^\d{3}\s?\d{2}\s+", "", city) if city else None)
                else:
                    own = {"verdict": "rejected", "confidence": "medium", "evidence": [],
                           "negative": ["stránka nemá firemný kontakt (telefón / IČO) — nejde o web firmy"]}
            w = {"url": fp.get("final_url") or c["url"], "domain": host(fp.get("final_url") or c["url"]), "requested": c["domain"],
                 "sources": c["sources"], "verdict": own["verdict"], "confidence": own["confidence"],
                 "evidence": c["evidence"] + own["evidence"], "negative": own["negative"], "social_links": fp.get("socials", []),
                 "redirect_chain": fp.get("chain"), "checked_at": now(), "fp": fp}
            trace(e, "website", f"{c['domain']}: {own['verdict']} — {'; '.join(own['evidence'] + own['negative'])[:200]}")
            if own["verdict"] == "rejected":
                e["rejected_websites"].append({"domain": c["domain"], "why": "; ".join(own["negative"])[:200], "source": c["sources"],
                                               "name_hit": bool(own.get("name_hit"))})
                continue
            if own["verdict"] == "unreachable":
                # web nevieme načítať: neznamená „nemá web“ → ostáva kandidát, zdravie rozhodne (broken / unknown)
                w["health"] = health(fp, e, CATS.get(e.get("seed_category") or "ine", CATS["ine"]).get("portfolio"), self.today)
                if w["health"]["state"] == "broken":
                    w["verdict"] = "confirmed_source" if any(s in ("azet", "zoznam", "zlatestranky", "google_business", "email_domain")
                                                             for s in c["sources"]) else "uncertain"
                    w["evidence"].append("web uvádza zdroj firmy, ale nefunguje")
                e["websites"].append(w)
                continue
            e["websites"].append(w)
            if own["verdict"] == "confirmed":
                for p in fp.get("phones", [])[:3]:
                    add_fact(e["phones"], p, "website", HIGH, [f"web {w['domain']}"])
                for m in fp.get("emails", [])[:3]:
                    add_fact(e["emails"], m, "website", HIGH, [f"web {w['domain']}"])
                for i in fp.get("icos", [])[:1]:
                    add_fact(e["company_ids"], i, "website", MEDIUM, [f"web {w['domain']}"])
                for key in fp.get("socials", [])[:4]:
                    plat, handle = key.split(":", 1)
                    # web môže odkazovať aj na cudzie profily (krčma v obci, partner) → potvrdíme iba súvisiaci handle
                    related = self.related_handle(e, handle, w["domain"]) or len(fp.get("socials", [])) == 1
                    if not any(s["platform"] == plat and (s.get("handle") or "").lower() == handle for s in e["socials"]):
                        e["socials"].append({"platform": plat, "handle": handle, "url": f"https://www.{plat}.com/{handle}/",
                                             "match": "confirmed" if related else "uncertain", "source": "website",
                                             "evidence": [f"web {w['domain']} odkazuje na profil" + ("" if related else " (handle nesúvisí s názvom — neisté)")],
                                             "activity": "unknown", "confidence": "high" if related else "low", "verified_at": now()})
                    else:
                        for s in e["socials"]:
                            if s["platform"] == plat and (s.get("handle") or "").lower() == handle:
                                s["match"] = "confirmed"
                                s["evidence"] = s.get("evidence", []) + [f"web {w['domain']} odkazuje na profil"]
        # old vs new: potvrdený funkčný web → ostatné (mŕtve / broken zo starého katalógu) sú historické
        good = [w for w in e["websites"] if w["verdict"] == "confirmed" and w.get("fp", {}).get("reachable")]
        if good:
            for w in e["websites"]:
                if w is not good[0] and w["verdict"] in ("confirmed_source", "uncertain") and not w.get("fp", {}).get("reachable"):
                    w["verdict"] = "historical"
                    e["historical_websites"].append({"domain": w["domain"], "why": "nefunkčný starý web, firma má nový " + good[0]["domain"]})
        for w in e["websites"]:
            if w["verdict"] == "confirmed_source":
                w["verdict"] = "confirmed"  # starý web z katalógu, ktorý nefunguje a nový sme nenašli = ich (nefunkčný) web
        e["last_verified"]["website"] = now()
        return e

    @staticmethod
    def related_handle(e, handle, domain):
        from .normalize import handle_tokens
        h = re.sub(r"[^a-z0-9]", "", bez(handle))
        d = re.sub(r"[^a-z0-9]", "", bez(domain.split(".")[0]))
        toks = set()
        for n in e["brand_names"] + ([e["legal_name"]] if e["legal_name"] else []):
            toks |= set(name_tokens(n))
        return (len(d) >= 4 and (d in h or h in d)) or any(len(t) >= 4 and t in h for t in toks) or \
            any(len(t) >= 4 and t in d for t in handle_tokens(handle))

    # ─────────── PASS 5 ───────────
    def pass5(self, e):
        e["category"] = C.classify(e)
        cat = CATS.get(e["category"]["id"], CATS["ine"])
        res, web = Q.website_resolution(e)
        if web and web.get("fp", {}).get("reachable") and not web.get("health"):
            web["health"] = health(web["fp"], e, cat.get("portfolio"), self.today)
        e["website_resolution"] = res
        e["website"] = ({"url": web["url"], "domain": web["domain"], "status": res, "confidence": web["confidence"],
                         "evidence": web["evidence"][:5], "health": web.get("health")} if web else
                        {"url": None, "domain": None, "status": res, "confidence": None, "evidence": [], "health": None})
        e["services"] = [s["label"] for s in C.services(e)][:6]
        e["description"] = C.describe(e, e["category"])
        e["business_status"] = C.business_status(e)
        e["commercial_problems"] = Q.opportunity(e, res, web)
        fp = (web or {}).get("fp") or {}
        e["process_signals"] = SIG.process_signals(fp)
        e["tags"] = SIG.tags(fp)
        fp.pop("raw_pages", None)  # HTML nepotrebujeme ďalej držať v pamäti
        fp.pop("page_raw", None)
        e["social_first"] = any(p["code"] == "SOCIAL_FIRST_BUSINESS" for p in e["commercial_problems"])
        e["last_verified"].update(category=now(), social=now())
        trace(e, "classify", f"{e['category']['id']} ({e['category']['confidence']}) · popis: {e['description']['text']}")
        trace(e, "opportunity", ", ".join(p["code"] for p in e["commercial_problems"]) or "žiadny obchodný dôvod")
        return e

    # ─────────── PASS 6 ───────────
    def pass6(self, e):
        identity_confidence(e)
        res = e["website_resolution"]
        web = next((w for w in e["websites"] if w["verdict"] in ("confirmed", "probable")), None)
        reg_name = bez((e.get("register") or {}).get("name") or "")
        if self.ORG.search(reg_name):
            self._stop(e, "nie je firma (združenie / úrad / škola)")
        tier, why = Q.gate(e, res)
        e["data_quality"], e["data_quality_why"] = tier, why
        rec, fit, reasons = Q.caller_fit(e, self.routing, self.active)
        e["recommended_caller"], e["caller_fit"] = rec, {"score": fit, "reasons": reasons}
        e["score"] = Q.score(e, res, web, tier)
        ph = Q.phone_confidence(e)
        e["primary_phone"] = {"value": ph[0], "confidence": ph[1], "sources": ph[2]} if ph else None
        trace(e, "gate", f"{tier.upper()} · {', '.join(why) or 'všetko overené'} · {rec} · skóre {e['score']['points']}")
        self.stats["tiers"][tier] = self.stats["tiers"].get(tier, 0) + 1
        self.stats["resolution"][res] = self.stats["resolution"].get(res, 0) + 1
        return e

    # ─────────── celé ───────────
    def prescore(self, e):
        """Lacné poradie pred vyhľadávaním: kontakt, register, evidencia odboru."""
        from .classify import classify
        c = classify(e)
        return (bool(e["phones"]) * 3 + bool(e["company_ids"]) * 2 + bool((e.get("register") or {}).get("found")) * 2
                + {"high": 3, "medium": 2, "low": 0, "unknown": 0}[c["confidence"]] + bool(e["socials"]))

    def run(self, records, deep_limit=60, search_limit=25, budget_scale=1.0):
        """search_limit = koľko firiem smie ísť do vyhľadávania (agent WebSearch je drahý);
        budget_scale < 1 pri agentovi (menej dopytov na firmu), 1 pri API providerovi."""
        all_ents, keep = self.pass1(records)
        self.log(f"  PASS 1: {self.stats['seeds']} záznamov → {self.stats['entities']} firiem, ďalej {len(keep)}")
        # register iba pre perspektívne firmy (lacné poradie najprv) — neplytvať requestami na zvyšok
        keep.sort(key=lambda e: -self.prescore(e))
        cand = keep[: int(deep_limit * 1.3)]
        deep = [e for e in cand if self.pass2(e)][:deep_limit]
        rest = [e for e in keep if e not in deep and not e.get("stopped")]
        self.log(f"  PASS 2: register pre {len(cand)} → hĺbkovo {len(deep)}")
        # PASS 4 najprv: weby z katalógu / e-mailu / IG bio (bez vyhľadávača)
        for e in deep:
            self.pass4(e)
        # PASS 3 iba tam, kde web nie je potvrdený (skrytý web, social) — najperspektívnejšie firmy prvé
        need = [e for e in deep if not any(w.get("verdict") == "confirmed" for w in e["websites"])]
        for e in need[:search_limit]:
            tier = "high_value" if e["phones"] and e["company_ids"] else "promising" if e["phones"] else "ordinary"
            b = max(3, round(BUDGET[tier] * budget_scale))
            self.pass3(e, b)
            self.pass4(e)
            self.pass3(e, b)  # po nájdení webu / brandu môžu pribudnúť silnejšie dopyty
            self.pass4(e)
        for e in need[search_limit:]:
            trace(e, "search", "mimo dnešného rozpočtu vyhľadávania → stav webu ostáva neistý")
        for e in deep:
            self.pass5(e)
            self.pass6(e)
        for e in rest:
            self._stop(e, "mimo dnešného limitu hĺbkovej analýzy")
        return all_ents
