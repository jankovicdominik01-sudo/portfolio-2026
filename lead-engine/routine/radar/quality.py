# -*- coding: utf-8 -*-
"""
Commercial opportunity, data quality gate (GOLD / SILVER / RESEARCH), vysvetliteľné skóre, routing Soňa / Jozo.

GOLD / SILVER / RESEARCH hodnotí KVALITU DÁT, nie firmu:
  GOLD      identita + telefón + kategória + stav webu + obchodný dôvod — všetko overené
  SILVER    dobrá firma, práve jedna relevantná vec je neistá (povie to caller card)
  RESEARCH  treba ďalšie overenie → do fronty volajúceho NEJDE
"""
from .taxonomy import CATS, default_caller

RANK = {"high": 3, "medium": 2, "low": 1, "unknown": 0}

PROBLEM_LABEL = {
    "SOCIAL_FIRST_BUSINESS": "Firma funguje hlavne cez Instagram/Facebook, samostatný web sme nenašli",
    "NO_WEBSITE_FOUND": "Vlastný web sme nenašli (katalóg, vyhľadávanie, e-mail, profily)",
    "BROKEN_WEBSITE": "Ich web nefunguje",
    "WEAK_WEBSITE": "Ich web má objektívne problémy",
    "SOCIAL_WEB_GAP": "Na Instagrame/Facebooku ukazujú prácu, web ju neukazuje",
    "BRAND_WEBSITE_MISMATCH": "Silná prezentácia na sociálnych sieťach, web za ňou zaostáva",
}


def website_resolution(e):
    """CONFIRMED / PROBABLE / NO_WEBSITE_FOUND / UNCERTAIN. „Nemá web“ neexistuje."""
    conf = [w for w in e["websites"] if w.get("verdict") == "confirmed"]
    prob = [w for w in e["websites"] if w.get("verdict") == "probable"]
    unc = [w for w in e["websites"] if w.get("verdict") == "uncertain"]
    if conf:
        return "confirmed", conf[0]
    if prob:
        return "probable", prob[0]
    searched = e.get("web_search_done", 0)
    unreachable = [c for c in e["website_candidates"] if c.get("verdict") == "unreachable"]
    # web s názvom firmy, ktorý sme odmietli (iný telefón…) = možno ich web → NIKDY „nenašli sme“, iba neistota
    named_rejected = [r for r in e["rejected_websites"] if r.get("name_hit")]
    if unc or unreachable or named_rejected or searched < 2:
        return "uncertain", (unc or [None])[0]
    return "no_website_found", None


def opportunity(e, res, web):
    """Obchodné problémy s evidenciou. Subjektívne dojmy sú označené heuristic=True a nesmú ísť do skriptu ako fakt."""
    probs = []
    cat = CATS.get((e.get("category") or {}).get("id") or "ine", CATS["ine"])
    socials = [s for s in e["socials"] if s.get("match") in ("confirmed", "probable")]
    if res == "no_website_found":
        if socials:
            probs.append({"code": "SOCIAL_FIRST_BUSINESS", "label": PROBLEM_LABEL["SOCIAL_FIRST_BUSINESS"],
                          "evidence": [f"{s['platform']}: {s['url']}" for s in socials[:2]] + ["web: hľadali sme — nenašli"]})
        else:
            probs.append({"code": "NO_WEBSITE_FOUND", "label": PROBLEM_LABEL["NO_WEBSITE_FOUND"],
                          "evidence": [f"hľadané: {q}" for q in e.get("web_search_queries", [])[:3]]})
    if web and res in ("confirmed", "probable"):
        h = web.get("health") or {}
        issues = h.get("issues", [])
        if h.get("state") == "broken":
            probs.append({"code": "BROKEN_WEBSITE", "label": PROBLEM_LABEL["BROKEN_WEBSITE"],
                          "evidence": [f"{i['text']} ({i['excerpt']})" for i in issues[:2]]})
        elif h.get("state") == "weak":
            probs.append({"code": "WEAK_WEBSITE", "label": PROBLEM_LABEL["WEAK_WEBSITE"],
                          "evidence": [i["text"] for i in sorted(issues, key=lambda i: -i["points"])[:3]]})
        portfolio_social = [s for s in socials if s["platform"] == "instagram"]
        if cat.get("portfolio") and portfolio_social and any(i["key"] == "no_portfolio" for i in issues):
            probs.append({"code": "SOCIAL_WEB_GAP", "label": PROBLEM_LABEL["SOCIAL_WEB_GAP"],
                          "evidence": [f"Instagram {portfolio_social[0]['url']}", "web: žiadna sekcia realizácie / galéria / portfólio"]})
        objective_old = [i for i in issues if i["key"] in ("no_viewport", "frames", "old_copyright", "builder", "tables", "old_jquery")]
        if socials and objective_old and cat.get("ig"):
            probs.append({"code": "BRAND_WEBSITE_MISMATCH", "label": PROBLEM_LABEL["BRAND_WEBSITE_MISMATCH"],
                          "evidence": [f"{socials[0]['platform']}: {socials[0]['url']}"] + [i["text"] for i in objective_old[:2]],
                          "heuristic": True})
    return probs


def phone_confidence(e):
    """Telefón na volanie: potvrdený primárnym zdrojom (katalóg, register, vlastný web, Google) alebo ≥2 zdrojmi."""
    best = None
    for f in e["phones"]:
        prim = [s for s in f["sources"] if not s.startswith("search:")]
        c = "high" if (len(set(f["sources"])) >= 2 and prim) or "website" in f["sources"] or "google_business" in f["sources"] \
            else "medium" if prim else "low"
        key = (RANK[c], len(set(f["sources"])), f["value"].startswith(("+4219", "+4206", "+4207")))
        if not best or key > best[3]:
            best = (f["value"], c, f["sources"], key)
    return best[:3] if best else None  # (e164, conf, sources) | None — najviac nezávislých zdrojov vyhráva


def gate(e, res):
    """→ (tier, reasons[]) ; RESEARCH neide callerovi."""
    why, soft = [], []
    ph = phone_confidence(e)
    idc = e["identity"]["confidence"]
    cat = e.get("category") or {}
    status = (e.get("business_status") or {}).get("value")
    if not ph:
        why.append("chýba firemný telefón")
    elif ph[1] == "low":
        why.append("telefón iba z výsledku vyhľadávania — nepotvrdený")
    elif ph[1] == "medium":
        soft.append("telefón iba z jedného zdroja")
    if idc == "low":
        why.append("identita firmy nie je overená")
    elif idc == "medium":
        soft.append("identita overená iba čiastočne")
    if RANK.get(cat.get("confidence") or "unknown", 0) < 2:
        why.append("odbor nie je overený evidenciou")
    if status == "inactive":
        why.append("firma zanikla")
    elif status == "uncertain" and idc == "high":
        soft.append("aktivita firmy nie je istá")
    elif status == "uncertain" and idc == "medium":
        soft[-1] = "identita a aktivita firmy overené iba čiastočne (bez registra)"
    if res == "uncertain":
        soft.append("stav webu nie je istý")
    if not e.get("commercial_problems"):
        why.append("chýba obchodný dôvod na hovor")
    if e.get("possible_duplicates"):
        soft.append("možná duplicita: " + e["possible_duplicates"][0]["name"])
    if why:
        return "research", why + soft
    if len(soft) <= 0:
        return "gold", []
    if len(soft) == 1:
        return "silver", soft
    return "research", soft


def caller_fit(e, routing=None, active=("sona", "jozo")):
    cat = e.get("category") or {}
    cid = cat.get("id") or "ine"
    rec = default_caller(cid, routing)
    reasons = []
    if rec:
        src = "nastavenie routingu" if routing and routing.get(cid) else "predvolený segment"
        reasons.append(f"{CATS.get(cid, CATS['ine'])['label']} → {rec} ({src})")
    if rec not in active:
        alt = next((a for a in active if a != rec), None)
        if alt:
            reasons.append(f"{rec or 'nikto'} nie je aktívny → {alt}")
            rec = alt
    score = 50
    if cat.get("confidence") == "high":
        score += 20
        reasons.append("odbor overený z viacerých zdrojov")
    elif cat.get("confidence") == "medium":
        score += 10
    if CATS.get(cid, {}).get("ig") and any(s.get("match") == "confirmed" for s in e["socials"]):
        score += 10
        reasons.append("social profil potvrdený — vizuálny segment")
    return rec, min(100, score), reasons


def score(e, res, web, tier):
    """Vysvetliteľné body. Každá položka má dôvod (scoreReasons)."""
    items = []

    def add(key, pts, why):
        items.append({"key": key, "points": pts, "label": why})

    idc = e["identity"]["confidence"]
    add("identity", {"high": 20, "medium": 10, "low": -20}[idc], f"identita: {idc}")
    ph = phone_confidence(e)
    if ph:
        add("contactability", {"high": 15, "medium": 8, "low": -10}[ph[1]] + (5 if ph[0].startswith(("+4219", "+4206", "+4207")) else 0),
            f"telefón {ph[1]}" + (" (mobil)" if ph[0].startswith(("+4219", "+4206", "+4207")) else ""))
    cat = e.get("category") or {}
    add("category", {"high": 10, "medium": 5, "low": -10, "unknown": -15}[cat.get("confidence") or "unknown"], f"odbor: {cat.get('confidence')}")
    for p in e.get("commercial_problems", []):
        pts = {"BROKEN_WEBSITE": 30, "SOCIAL_FIRST_BUSINESS": 22, "NO_WEBSITE_FOUND": 12, "SOCIAL_WEB_GAP": 18,
               "WEAK_WEBSITE": 12, "BRAND_WEBSITE_MISMATCH": 6}[p["code"]]
        add("problem:" + p["code"], pts, p["label"])
    if web and (web.get("health") or {}).get("state") == "working" and not e.get("commercial_problems"):
        add("web_ok", -30, "web funguje bez objektívnych problémov")
    if res == "uncertain":
        add("uncertainty", -10, "stav webu neistý")
    if any(s.get("match") == "confirmed" for s in e["socials"]):
        add("social", 8, "aktívna prezentácia na sociálnej sieti")
    reg = e.get("register") or {}
    if reg.get("found"):
        add("legitimacy", 10, "firma v registri")
    g = e.get("google") or {}
    if (g.get("reviews") or 0) >= 10:
        add("brand_signal", 5, f"{g['reviews']} recenzií na Google")
    if e.get("possible_duplicates"):
        add("duplicate_risk", -15, "možná duplicita")
    if tier == "research":
        add("quality_gate", -40, "dáta treba doplniť (RESEARCH)")
    pts = sum(i["points"] for i in items)
    return {"points": pts, "reasons": items}
