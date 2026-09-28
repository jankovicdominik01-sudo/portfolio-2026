# -*- coding: utf-8 -*-
"""
Klasifikácia a popis firmy IBA z evidencie (web, bio, katalóg, register). Nikdy len z názvu.

Evidencia má váhu podľa zdroja:
  vlastný web (title / meta / nadpisy / text), IG/FB bio, Google Business kategória  → silná
  popis a kategória v katalógu                                                     → stredná
  názov firmy                                                                      → slabá (sama nestačí)
  CZ NACE z ARES                                                                    → stredná (iba odbor)
"""
import re

from .normalize import bez
from .taxonomy import CATS, NEVER, compiled

# Kanonické služby (pre pravdivý krátky popis). (regex na text bez diakritiky, názov služby, kategória)
SERVICES = [
    (r"nabytok na mier|nabytek na mir|nabytku na mier|nabytku na mir|vyrob\w* nabyt", "nábytok na mieru", "stolarstvo"),
    (r"kuchyn\w* (link\w* )?na mier|kuchyne na mir|kuchynsk\w* link", "kuchyne na mieru", "stolarstvo"),
    (r"vstavan\w* skrin|vestaven\w* skrin|satnik|satnikov", "vstavané skrine", "stolarstvo"),
    (r"schodisk|schodist|schody", "schodiská", "stolarstvo"),
    (r"interierov\w* dver|dvere na mier|dvere a zarubne", "dvere", "stolarstvo"),
    (r"realizac\w* zahrad|zakladani\w* zahrad|zakladanie zahrad", "realizácia záhrad", "zahradnictvo"),
    (r"udrzb\w* zahrad|udrzb\w* zelene|kosenie|koseni", "údržba záhrad a kosenie", "zahradnictvo"),
    (r"zavlah|zavlaz", "závlahy", "zahradnictvo"),
    (r"travnik|trávnik|koberc\w* travnik", "trávniky", "zahradnictvo"),
    (r"okrasn\w* (rastlin|dreviny)|trvalk|sadenic|skolk", "predaj rastlín a drevín", "zahradnictvo"),
    (r"pergol", "pergoly", "brany-ploty"),
    (r"automatick\w* bran|posuvn\w* bran|bran(y|a) na mier", "brány", "brany-ploty"),
    (r"oploteni|oplotenie|plot(y|ov)", "ploty a oplotenie", "brany-ploty"),
    (r"zabradl", "zábradlia", "kovovyroba"),
    (r"rekonstrukc\w* (bytov|bytu|kupeln|koupeln|domov|domu)", "rekonštrukcie bytov a domov", "stavebnictvo"),
    (r"rodinn\w* dom|novostavb|hrub\w* stavb|stavby na kl", "stavby rodinných domov", "stavebnictvo"),
    (r"zateplen|zateplov|fasad", "fasády a zatepľovanie", "fasady"),
    (r"obklad|dlazb", "obklady a dlažby", "obklady"),
    (r"maliar|malovan|stierk|natery|natier", "maliarske a natieračské práce", "maliar"),
    (r"podlah|parket|vinyl|laminat", "podlahy", "podlahy"),
    (r"strech|pokryv|klampiar|klempir", "strechy a klampiarske práce", "strechy"),
    (r"elektroinstal|elektrikar|revizi|revize", "elektroinštalácie", "elektrikar"),
    (r"vodoinstal|instalater|kanaliz", "vodoinštalácie", "vodoinstalater"),
    (r"tepeln\w* cerpadl|kotl|kuren|topeni|podlahov\w* (kuren|topen)", "kúrenie a tepelné čerpadlá", "kurenie"),
    (r"autoservis|oprava aut|servis vozid|diagnostik", "autoservis", "autoservis"),
    (r"pneuservis|prezut|pneumatik", "pneuservis", "pneuservis"),
    (r"detailing|keramick\w* ochran|lestenie|tepovanie", "auto detailing", "detailing"),
    (r"damsk\w* (strih|kadern)|farbeni\w* vlas|balayage|melir|kadernic|kadern", "kaderníctvo", "kadernictvo"),
    (r"barber|pansk\w* strih|uprava brady|holen", "barber / pánske strihy", "barber"),
    (r"svadobn\w* licen|svatebni licen|make ?-?up|vizaz|licenie", "make-up / líčenie", "makeup"),
    (r"gel lak|gelov\w* necht|manikur|pedikur|necht|nehty", "nechty / manikúra", "nechty"),
    (r"mihaln|rasy|lash|obocie|oboci|brow|laminaci", "mihalnice a obočie", "mihalnice"),
    (r"osetreni\w* plet|kozmetick\w* osetr|kosmeticke osetr|pletov|hydrafacial|chemick\w* peeling|depilac", "kozmetické ošetrenia", "kozmetika"),
    (r"svadobn\w* fot|svatebni fot|rodinn\w* fot|portret|fotenie|foceni|fotograf", "fotografovanie", "fotograf"),
    (r"svadobn\w* video|svatebni video|kameraman|videoprodukc", "video", "video"),
    (r"svadobn\w* agent|koordinac\w* svad|vyzdob\w* svad|svatebni agentur", "svadobné služby", "svadby"),
    (r"predaj (bytov|domov|nehnutel)|prenajom|makler|realitn|nehnutelnost|nemovitost", "reality (predaj a prenájom)", "reality"),
    (r"interierov\w* (dizajn|design)|navrh\w* interier|design interier|3d vizualiz", "návrh interiérov", "interier"),
    (r"architekton|projekt\w* rodinn\w* dom|architekt", "architektúra a projekty", "architekt"),
]
SERVICES = [(re.compile(a), b, c) for a, b, c in SERVICES]

STRONG_SRC = {"website", "instagram_bio", "facebook_page", "google_business"}
MEDIUM_SRC = {"catalog", "register_nace"}


def evidence_texts(e):
    """(zdroj, typ, text) — odkiaľ vieme, čo firma robí. Názov je samostatne a slabý."""
    out = []
    for w in e["websites"]:
        if w.get("verdict") in ("confirmed", "probable"):
            fp = w.get("fp") or {}
            out.append((f"web {w['domain']}", "website", " ".join([fp.get("title", ""), fp.get("meta", ""), " ".join(fp.get("h", [])), fp.get("text", "")[:3000]])))
    for s in e["socials"]:
        if s.get("match") in ("confirmed", "probable") and (s.get("bio") or s.get("display_name")):
            out.append((f"{s['platform']} {s.get('handle') or ''}".strip(), f"{s['platform']}_bio" if s["platform"] == "instagram" else "facebook_page",
                        " ".join(x for x in (s.get("display_name"), s.get("bio")) if x)))
    for c in e["catalog_text"]:
        out.append((c["source"], "catalog", c["text"]))
    reg = e.get("register") or {}
    if reg.get("nace_text"):
        out.append(("register", "register_nace", reg["nace_text"]))
    return out


def classify(e):
    """→ {id, code, subcategory, confidence, evidence[]} ; bez evidencie confidence 'unknown'."""
    texts = evidence_texts(e)
    names = " ".join(e["brand_names"] + ([e["legal_name"]] if e["legal_name"] else []))
    scores = {}
    for cid in CATS:
        if cid == "ine":
            continue
        core, avoid = compiled(cid)
        hits = []
        for src, kind, t in texts:
            bt = bez(t)
            if core.search(bt) and not (avoid and avoid.search(bt)):
                hits.append((src, kind))
        if avoid and any(avoid.search(bez(t)) for _, _, t in texts if t) and not hits:
            continue
        name_hit = bool(core.search(bez(names)))
        if hits or name_hit:
            w = sum(3 if k in STRONG_SRC else 2 if k in MEDIUM_SRC else 1 for _, k in hits) + (1 if name_hit else 0)
            scores[cid] = (w, hits, name_hit)
    if not scores:
        return {"id": "ine", "code": "OTHER_LOCAL_SERVICE", "subcategory": None, "confidence": "unknown",
                "evidence": ["Z dostupných zdrojov sa nepodarilo spoľahlivo určiť odbor."]}
    # špecifickejšia kategória vyhráva pri remíze (kuchyne > stolárstvo, barber > kaderníctvo)
    prefer = {"kuchyne": 0.5, "barber": 0.5, "developer": 0.2, "detailing": 0.3}
    best = max(scores, key=lambda c: (scores[c][0] + prefer.get(c, 0)))
    w, hits, name_hit = scores[best]
    strong = [h for h in hits if h[1] in STRONG_SRC]
    kinds = {h[1] for h in hits}
    conf = "high" if (strong and len(hits) >= 2) or len(kinds) >= 2 else "medium" if hits else "low"
    ev = [f"„{CATS[best]['label']}“ potvrdzuje: {src}" for src, _ in hits[:4]]
    if name_hit and not hits:
        ev.append("iba názov firmy — odbor NEOVERENÝ")
    sub = None
    svc = services(e, texts)
    if svc:
        sub = svc[0]["label"]
    return {"id": best, "code": CATS[best]["code"], "subcategory": sub, "confidence": conf, "evidence": ev,
            "alternatives": sorted((c for c in scores if c != best), key=lambda c: -scores[c][0])[:2]}


def services(e, texts=None):
    texts = texts if texts is not None else evidence_texts(e)
    found = {}
    for src, kind, t in texts:
        bt = bez(t)
        for rx, label, _ in SERVICES:
            if rx.search(bt):
                found.setdefault(label, set()).add(src)
    return sorted(({"label": k, "sources": sorted(v)} for k, v in found.items()), key=lambda x: -len(x["sources"]))


UNKNOWN_DESC = "Presné zameranie sa nepodarilo spoľahlivo overiť."


def describe(e, cat):
    """Krátky pravdivý popis zo služieb, ktoré potvrdzujú zdroje. Bez evidencie → UNKNOWN_DESC."""
    svc = services(e)
    if cat["id"] != "ine":
        rel = [s for s in svc if any(c == cat["id"] or CATS.get(c, {}).get("code") == cat["code"]
                                     for _, lb, c in SERVICES if lb == s["label"])] or svc
    else:
        rel = svc
    if not rel:
        return {"text": UNKNOWN_DESC, "confidence": "unknown", "sources": []}
    top = rel[:3]
    srcs = sorted({x for s in top for x in s["sources"]})
    txt = ", ".join(s["label"] for s in top)
    txt = txt[0].upper() + txt[1:] + "."
    conf = "high" if len(srcs) >= 2 else "medium"
    return {"text": txt, "confidence": conf, "sources": srcs}


def business_status(e):
    """ACTIVE / LIKELY_ACTIVE / UNCERTAIN / INACTIVE zo signálov: register, web, social, Google, kontakt."""
    reg = e.get("register") or {}
    ev = []
    if reg.get("dead"):
        return {"value": "inactive", "evidence": [f"register: {reg.get('why') or 'zaniknutá / likvidácia'}"]}
    if reg.get("found"):
        ev.append(f"register: aktívna ({reg.get('name')})")
    if any(w.get("verdict") == "confirmed" and w.get("health", {}).get("state") in ("working", "weak") for w in e["websites"]):
        ev.append("vlastný web funguje")
    if any(s.get("match") == "confirmed" and s.get("activity") == "active" for s in e["socials"]):
        ev.append("aktívny social profil")
    g = e.get("google") or {}
    if g.get("business_status") == "OPERATIONAL" or (g.get("reviews") or 0) > 0:
        ev.append("Google Business profil")
    if len({s["source"] for s in e["sources"]}) >= 2:
        ev.append("viac nezávislých zdrojov")
    if reg.get("found") and len(ev) >= 2:
        v = "active"
    elif reg.get("found") or len(ev) >= 2:
        v = "likely_active"
    elif ev:
        v = "uncertain"
    else:
        v = "uncertain"
    return {"value": v, "evidence": ev}


def never_segment(e):
    t = bez(" ".join(e["brand_names"] + [c["text"] for c in e["catalog_text"]]))
    m = NEVER.search(t)
    return m.group(0) if m else None
