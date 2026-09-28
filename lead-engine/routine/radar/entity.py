# -*- coding: utf-8 -*-
"""
Business entita + evidence graph + identity resolution.

Jedna firma = JEDNA entita, aj keď ju nájdeme v katalógu, vo vyhľadávaní, na Instagrame aj na Facebooku.
Každý údaj je Fact: {value, confidence, sources[], evidence[], verified_at}.

Sila signálov (medzi dvoma záznamami):
  VERY_STRONG  rovnaké IČO · rovnaký telefón · explicitný odkaz web ↔ social
  STRONG       rovnaký firemný e-mail · rovnaká vlastná doména
  MEDIUM       rovnaké rozlišujúce slová názvu + mesto · rovnaká adresa     → NEZLÚČI sa, iba „možná duplicita“
  WEAK         podobný názov                                                → nič
  NEGATIVE     rôzne IČO · iná krajina                                      → NIKDY sa nezlúči
"""
import datetime
import hashlib
import re

from .normalize import (bez, email_domain, host, ico_norm, is_own_web_candidate, name_tokens, phone_e164,
                        FREE_HOSTS)

HIGH, MEDIUM, LOW = "high", "medium", "low"
RANK = {HIGH: 3, MEDIUM: 2, LOW: 1}
# Zdroje, ktoré firma sama spravuje / úradné — vyššia dôvera než agregátor.
OFFICIAL = {"website", "register", "google_business", "instagram_bio", "facebook_page"}


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")


def fact(value, source, confidence=MEDIUM, evidence=None, at=None):
    return {"value": value, "confidence": confidence, "sources": [source], "evidence": list(evidence or []),
            "verified_at": at or now()}


def add_fact(lst, value, source, confidence=MEDIUM, evidence=None, at=None):
    """Pridá fakt; ak hodnota už je, zlúči zdroje a zvýši dôveru (nezávislé zdroje sa potvrdzujú)."""
    if value in (None, ""):
        return None
    for f in lst:
        if f["value"] == value:
            if source not in f["sources"]:
                f["sources"].append(source)
            for e in evidence or []:
                if e not in f["evidence"]:
                    f["evidence"].append(e)
            if RANK[confidence] > RANK[f["confidence"]]:
                f["confidence"] = confidence
            if len(set(f["sources"])) >= 2 and f["confidence"] == MEDIUM:
                f["confidence"] = HIGH
            f["verified_at"] = max(f.get("verified_at") or "", at or now())
            return f
    f = fact(value, source, confidence, evidence, at)
    lst.append(f)
    return f


def values(lst, min_conf=LOW):
    return [f["value"] for f in lst if RANK[f["confidence"]] >= RANK[min_conf]]


def new_entity(country):
    return {
        "id": None, "country": country, "legal_name": None, "brand_names": [], "historical_names": [],
        "city": None, "region": None, "addresses": [], "company_ids": [], "phones": [], "emails": [],
        "website_candidates": [], "websites": [], "historical_websites": [], "rejected_websites": [],
        "socials": [], "categories": [], "services": [], "description": None, "business_status": None,
        "commercial_problems": [], "identity": {"confidence": LOW, "evidence": []}, "sources": [],
        "evidence": [], "trace": [], "source_unavailable": [], "possible_duplicates": [], "register": None,
        "catalog_text": [], "last_verified": {},
    }


def trace(e, step, detail):
    e["trace"].append({"step": step, "detail": detail[:300], "at": now()})


def from_record(rec):
    """Záznam z katalógu / vyhľadávania / registra → entita s faktami a zdrojom."""
    country = rec.get("country") or "SK"
    e = new_entity(country)
    src = rec.get("source") or "unknown"
    url = rec.get("profile") or rec.get("url")
    e["sources"].append({"source": src, "url": url, "seen_at": now()})
    name = (rec.get("name") or "").strip()
    if name:
        if src in ("register",):
            e["legal_name"] = name
        else:
            e["brand_names"].append(name)
    if rec.get("legal_name"):
        e["legal_name"] = rec["legal_name"]
    e["city"] = rec.get("city") or None
    if rec.get("address"):
        add_fact(e["addresses"], rec["address"], src, MEDIUM, [f"{src}: {rec['address']}"])
    ico = ico_norm(rec.get("ico"), country)
    if ico:
        add_fact(e["company_ids"], ico, src, HIGH if src == "register" else MEDIUM, [f"{src}: IČO {ico}"])
    for p in [rec.get("phone")] + list(rec.get("phones") or []):
        ph = phone_e164(p, country)
        if ph:
            add_fact(e["phones"], ph, src, MEDIUM, [f"{src}: {p}"])
    for m in [rec.get("email")] + list(rec.get("emails") or []):
        if m:
            add_fact(e["emails"], m.lower().strip(), src, MEDIUM, [f"{src}: {m}"])
    for w in rec.get("websites") or []:
        if w and is_own_web_candidate(w):
            e["website_candidates"].append({"url": w, "domain": host(w), "source": src, "evidence": [f"{src} uvádza {w}"]})
    for s in rec.get("socials") or []:
        e["socials"].append(dict(s))
    txt = " ".join(x for x in (rec.get("description"), rec.get("catalog_category_label"), rec.get("ad_text")) if x)
    if txt:
        e["catalog_text"].append({"source": src, "url": url, "text": txt[:600]})
    if rec.get("vertical"):
        e["seed_category"] = rec["vertical"]
    if rec.get("google"):
        e["google"] = rec["google"]
    for k in ("register",):
        if rec.get(k):
            e[k] = rec[k]
    trace(e, "discovery", f"{src}: {name} ({e['city'] or '?'})")
    return e


# ─────────────── signály medzi entitami ───────────────

def _icos(e):
    return set(values(e["company_ids"]))


def _phones(e):
    return set(values(e["phones"]))


def _emails(e):
    return set(values(e["emails"]))


def own_domains(e):
    d = {c["domain"] for c in e["website_candidates"] if c.get("verdict") != "rejected"}
    d |= {w["domain"] for w in e["websites"]}
    d |= {x for x in (email_domain(m) for m in _emails(e)) if x}
    return {x for x in d if x}


def social_keys(e):
    return {(s["platform"], (s.get("handle") or s.get("url") or "").lower().strip("/@ ")) for s in e["socials"]
            if s.get("platform") in ("instagram", "facebook") and (s.get("handle") or s.get("url"))}


def _links(e):
    """Explicitné odkazy, ktoré entita deklaruje (web → social, social → web)."""
    out = set()
    for s in e["socials"]:
        if s.get("website"):
            out.add(("web", host(s["website"])))
    for w in e["websites"] + e["website_candidates"]:
        for sl in w.get("social_links", []):
            out.add(("social", sl))
    return out


def distinct_tokens(e):
    toks = set()
    for n in e["brand_names"] + ([e["legal_name"]] if e["legal_name"] else []):
        toks |= set(name_tokens(n))
    return toks


def signals(a, b):
    """Zoznam (sila, popis) medzi dvoma entitami. NEGATIVE má prednosť pred všetkým."""
    out = []
    if a["country"] != b["country"]:
        out.append(("NEGATIVE", f"iná krajina ({a['country']} vs {b['country']})"))
    ia, ib = _icos(a), _icos(b)
    if ia and ib:
        out.append(("VERY_STRONG", f"rovnaké IČO {sorted(ia & ib)[0]}") if ia & ib else ("NEGATIVE", "rôzne IČO"))
    common = _phones(a) & _phones(b)
    if common:
        out.append(("VERY_STRONG", f"rovnaký telefón {sorted(common)[0]}"))
    la, lb = _links(a), _links(b)
    sk_a, sk_b = {k[1] for k in social_keys(a)}, {k[1] for k in social_keys(b)}
    if any(("web", d) in la for d in own_domains(b)) or any(("web", d) in lb for d in own_domains(a)):
        out.append(("VERY_STRONG", "social profil odkazuje na web druhého záznamu"))
    if any(("social", k) in la for k in sk_b) or any(("social", k) in lb for k in sk_a):
        out.append(("VERY_STRONG", "web odkazuje na social profil druhého záznamu"))
    ea, eb = _emails(a), _emails(b)
    if ea & eb:
        out.append(("STRONG", f"rovnaký e-mail {sorted(ea & eb)[0]}"))
    da, db = own_domains(a), own_domains(b)
    shared = {d for d in da & db if not FREE_HOSTS.search("." + d) or d.count(".") >= 2}
    if shared:
        out.append(("STRONG", f"rovnaká doména {sorted(shared)[0]}"))
    if sk_a & sk_b:
        out.append(("STRONG", f"rovnaký social profil {sorted(sk_a & sk_b)[0]}"))
    ta, tb = distinct_tokens(a), distinct_tokens(b)
    same_city = a["city"] and b["city"] and bez(a["city"]) == bez(b["city"])
    if ta and tb and (ta <= tb or tb <= ta) and len(ta & tb) >= 1:
        out.append(("MEDIUM" if same_city else "WEAK", "rovnaké rozlišujúce slová názvu" + (" + mesto" if same_city else "")))
    return out


def decide(sigs):
    """merge / possible / no."""
    kinds = {s[0] for s in sigs}
    if "NEGATIVE" in kinds:
        return "no"
    if kinds & {"VERY_STRONG", "STRONG"}:
        return "merge"
    if "MEDIUM" in kinds:
        return "possible"
    return "no"


def merge_into(a, b, why):
    """b sa zlúči do a. Nič sa nestratí: zdroje, fakty, kandidáti, social, trace."""
    for s in b["sources"]:
        if s not in a["sources"]:
            a["sources"].append(s)
    for key in ("addresses", "company_ids", "phones", "emails"):
        for f in b[key]:
            for src in f["sources"]:
                add_fact(a[key], f["value"], src, f["confidence"], f["evidence"], f.get("verified_at"))
    for n in b["brand_names"]:
        if n not in a["brand_names"]:
            a["brand_names"].append(n)
    a["legal_name"] = a["legal_name"] or b["legal_name"]
    a["city"] = a["city"] or b["city"]
    for key in ("website_candidates", "socials", "catalog_text", "rejected_websites", "historical_websites"):
        for x in b[key]:
            if x not in a[key]:
                a[key].append(x)
    for key in ("seed_category", "google", "register"):
        if not a.get(key) and b.get(key):
            a[key] = b[key]
    a["identity"]["evidence"].append(why)
    a["trace"] += b["trace"]
    trace(a, "merge", why)
    return a


def resolve(entities):
    """Identity resolution s negatívnymi obmedzeniami. Vracia zoznam zlúčených entít."""
    groups = [[e] for e in entities]
    changed = True
    while changed:
        changed = False
        for i in range(len(groups)):
            if not groups[i]:
                continue
            for j in range(i + 1, len(groups)):
                if not groups[j]:
                    continue
                pair = [(x, y, signals(x, y)) for x in groups[i] for y in groups[j]]
                if any(decide(s) == "no" and any(k == "NEGATIVE" for k, _ in s) for _, _, s in pair):
                    continue
                hit = next(((x, y, s) for x, y, s in pair if decide(s) == "merge"), None)
                if hit:
                    why = "; ".join(d for k, d in hit[2] if k in ("VERY_STRONG", "STRONG"))
                    groups[i] += groups[j]
                    groups[j] = []
                    groups[i][0]["_why"] = groups[i][0].get("_why", []) + [why]
                    changed = True
    out = []
    for g in groups:
        if not g:
            continue
        base = g[0]
        whys = base.pop("_why", [])
        for k, other in enumerate(g[1:]):
            merge_into(base, other, whys[k] if k < len(whys) else "zhoda silného identifikátora")
        out.append(base)
    # možné duplicity (iba MEDIUM) — nezlučujeme, iba označíme
    for i, a in enumerate(out):
        for b in out[i + 1:]:
            s = signals(a, b)
            if decide(s) == "possible":
                a["possible_duplicates"].append({"name": (b["brand_names"] or [b["legal_name"]])[0], "why": "; ".join(d for _, d in s)})
                b["possible_duplicates"].append({"name": (a["brand_names"] or [a["legal_name"]])[0], "why": "; ".join(d for _, d in s)})
    for e in out:
        e["id"] = entity_id(e)
    return out


def entity_id(e):
    keys = sorted(_icos(e)) or sorted(_phones(e)) or sorted(own_domains(e)) or sorted(social_keys(e)) or \
        [bez((e["brand_names"] or [e["legal_name"] or "?"])[0]) + "|" + bez(e["city"] or "")]
    return "ent_" + hashlib.sha1((e["country"] + "|" + str(keys[0])).encode()).hexdigest()[:14]


def display_name(e):
    return (e["brand_names"] or [e["legal_name"] or "?"])[0]


def dedupe_keys(e):
    """Kľúče pre Lead Engine (ico:, phone:, email:, domain:, social:)."""
    k = [f"ico:{x}" for x in _icos(e)]
    k += [f"phone:{x[-9:]}" for x in _phones(e)]
    k += [f"email:{x}" for x in _emails(e)]
    k += [f"domain:{x}" for x in own_domains(e)]
    k += [f"social:{p}:{h}" for p, h in social_keys(e)]
    return sorted(set(k))


def identity_confidence(e):
    """HIGH = register potvrdil IČO alebo telefón sedí na vlastnom webe / v ≥2 nezávislých zdrojoch."""
    ev = []
    reg = e.get("register") or {}
    if reg.get("found") and not reg.get("dead"):
        ev.append(f"register: {reg.get('name')} (IČO {reg.get('ico')})")
    ph_hi = [f for f in e["phones"] if f["confidence"] == HIGH]
    for f in ph_hi:
        ev.append(f"telefón {f['value']} potvrdený: {', '.join(sorted(set(f['sources'])))}")
    web = next((w for w in e["websites"] if w.get("verdict") == "confirmed"), None)
    if web:
        ev.append(f"web {web['domain']} patrí firme: {'; '.join(web['evidence'][:2])}")
    srcs = {s["source"] for s in e["sources"]}
    if len(srcs) >= 2:
        ev.append(f"nájdená v {len(srcs)} zdrojoch: {', '.join(sorted(srcs))}")
    conf = HIGH if (reg.get("found") and (ph_hi or web)) or (ph_hi and web) or (reg.get("found") and len(srcs) >= 2) \
        else MEDIUM if (reg.get("found") or ph_hi or web or len(srcs) >= 2) \
        else LOW
    e["identity"] = {"confidence": conf, "evidence": ev + [x for x in e["identity"]["evidence"] if x not in ev]}
    return conf
