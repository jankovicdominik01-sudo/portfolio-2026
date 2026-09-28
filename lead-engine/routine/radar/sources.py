# -*- coding: utf-8 -*-
"""
Discovery a registre (iba zdroje, ktoré automatický prístup dovoľujú):
  SK  azet.sk katalóg (telefón, IČO, web), Zlaté stránky SK, RPO (register právnických osôb / živností)
  CZ  ARES (oficiálne REST API: IČO, názov, sídlo, NACE, zánik), Zlaté stránky CZ (názov, adresa, web, IČO)
  obe Google Places API (ak je kľúč), výsledky vyhľadávania (agent / API) — IG, FB, weby, katalógové profily
Katalógy sú KANDIDÁTSKE zdroje, nie source of truth.
"""
import html as H
import json
import re
import urllib.parse
import urllib.request

from .net import Blocked
from .normalize import host, ico_norm, is_own_web_candidate, phone_e164
from .website import text

AZET_CHAIN = re.compile(r"\b(obi|hornbach|bauhaus|kaufland|tesco|lidl|dm drogerie|notino|douglas|intersport|"
                        r"univerzita|fakulta|mesto |obec |technick[eé] slu[zž]by)", re.I)


def azet_list(net, slug, page=1):
    url = f"https://www.azet.sk/katalog/{slug}/" + (f"{page}/" if page > 1 else "")
    try:
        d = net.get(url)["body"]
    except Blocked:
        return None
    rows = []
    for b in d.split('<div class="record">')[1:]:
        nm = re.search(r'<h2 class="name">\s*<a[^>]+href="(https://www\.azet\.sk/firma/\d+/[^"]+)"[^>]*>([^<]+)</a>', b)
        if not nm or AZET_CHAIN.search(nm.group(2)):
            continue
        desc = re.search(r'<div class="description">(.*?)</div>', b, re.S)
        adr = re.search(r'class="address no_mobile" href="[^"]+">([^<]+)</a>', b)
        a_ = text(adr.group(1)) if adr else ""
        rows.append({"name": text(nm.group(2)), "profile": nm.group(1), "source": "azet", "country": "SK",
                     "catalog_category": slug, "address": a_, "city": re.sub(r"^.*\d{3}\s?\d{2}\s+", "", a_),
                     "description": text(desc.group(1))[:400] if desc else ""})
    return rows


def azet_pages(net, slug):
    try:
        d = net.get(f"https://www.azet.sk/katalog/{slug}/")["body"]
    except Blocked:
        return 0
    m = re.search(r"\(([\d\s\xa0]+) záznamov\)", d)
    n = int(re.sub(r"\D", "", m.group(1))) if m else 20
    return min(100, (n + 19) // 20)


def azet_profile(net, row):
    try:
        d = net.get(row["profile"])["body"]
    except Blocked:
        return row
    t = text(d)
    phones = re.findall(r'class="span12 mainContact">\s*((?:\+421|0)[\d\s/]{8,16})\s*<', d)
    web = re.search(r'class="mainLink"[^>]*href="(https?://[^"?]+)', d)
    ico = re.search(r"I[ČC]O:\s*(\d{6,8})", t)
    addr = re.search(r"Sídlo:\s*([^<]{5,120}?)\s+I[ČC]O", t)
    mail = re.search(r"mailto:([^\"?]+@[^\"?]+)", d)
    socials = [{"platform": "instagram" if "instagram" in u else "facebook", "url": u, "handle": _handle(u), "source": "azet",
                "evidence": ["azet profil odkazuje na profil"], "match": "catalog"}
               for u in dict.fromkeys(re.findall(r'href="(https?://(?:www\.)?(?:instagram|facebook)\.com/[^"?]+)', d))]
    row.update(phones=phones, ico=ico.group(1) if ico else "", address=(addr.group(1).strip() if addr else row.get("address")),
               email=(mail.group(1).lower() if mail else ""),
               websites=[web.group(1)] if web and is_own_web_candidate(web.group(1)) else [], socials=socials)
    return row


def _handle(u):
    p = [x for x in urllib.parse.urlparse(u).path.split("/") if x]
    return p[0].lower() if p else None


def zs_sk_list(net, cat, page=1):
    url = f"https://www.zlatestranky.sk/firmy/{cat}/" + ("" if page == 1 else f"q_/{page}/")
    try:
        d = net.get(url)["body"]
    except Blocked:
        return None
    out = []
    for b in d.split('<li class="results-list__item">')[1:]:
        nm = re.search(r'itemprop="name">\s*<a href="([^"]+)"[^>]*>\s*(?:<span[^>]*></span>)?([^<]{2,120})', b, re.S)
        if not nm:
            continue
        tel = re.search(r'<span class="phone-value">([^<]+)</span>', b) or re.search(r'href="tel:([^"]+)"', b)
        mail = re.search(r'mailto:([^"?]+)', b)
        loc = re.search(r'content="([^"]*)" itemprop="addressLocality"', b)
        links = [w for w in re.findall(r'<li class="link"><a href="(https?://[^"]+)"', b) if is_own_web_candidate(w)]
        ico = re.search(r"indexpodnikatela\.sk/(\d{6,8})", b)
        out.append({"name": text(nm.group(2)), "profile": "https://www.zlatestranky.sk" + nm.group(1), "source": "zlatestranky",
                    "country": "SK", "catalog_category": cat, "city": H.unescape(loc.group(1)).strip() if loc else "",
                    "phone": tel.group(1).strip() if tel else "", "email": mail.group(1).lower() if mail else "",
                    "websites": links[:2], "ico": ico.group(1) if ico else ""})
    return out


def zs_cz_search(net, term):
    """Zlaté stránky CZ: názov, adresa, rubrika, web, IČO (telefón staticky nie je — doplní ho web)."""
    url = "https://www.zlatestranky.cz/firmy/hledani/" + urllib.parse.quote(term)
    try:
        d = net.get(url)["body"]
    except Blocked:
        return None
    out = []
    for m in re.finditer(r'<h3><a href="(/profil/H\d+)">([^<]+)</a></h3>(.*?)(?=<h3><a href="/profil/|$)', d, re.S):
        blk = m.group(3)[:4000]
        adr = re.search(r'fa-map-marker"></i>\s*([^<]+)', blk)
        rub = re.search(r'/firmy/rubrika/[^"]+">([^<]+)</a>', blk)
        a_ = H.unescape(adr.group(1)).strip() if adr else ""
        city = re.sub(r"^.*\d{3}\s?\d{2},?\s+", "", a_).split(" - ")[0].strip()
        out.append({"name": H.unescape(m.group(2)).strip(), "profile": "https://www.zlatestranky.cz" + m.group(1),
                    "source": "zlatestranky_cz", "country": "CZ", "catalog_category": H.unescape(rub.group(1)) if rub else term,
                    "address": a_, "city": city, "description": text(blk)[:300]})
    return out


def zs_cz_profile(net, row):
    try:
        d = net.get(row["profile"])["body"]
    except Blocked:
        return row
    webs = [w for w in re.findall(r'href="(https?://[^"]+)"[^>]*itemprop="url"', d) if is_own_web_candidate(w)]
    ico = re.search(r"ares/darv_res\.cgi\?ico=(\d{8})", d)
    mail = re.search(r'mailto:([^"?]+@[^"?]+)', d)
    row.update(websites=webs[:1], ico=ico.group(1) if ico else "", email=mail.group(1).lower() if mail else "")
    return row


# ─────────────── registre ───────────────

def rpo(net, ico=None, name=None):
    """SK register (RPO, api.statistics.sk). Podľa IČO, alebo podľa fragmentu názvu."""
    q = f"identifier={ico}" if ico else "fullName=" + urllib.parse.quote(name or "")
    try:
        d = json.loads(net.get(f"https://api.statistics.sk/rpo/v1/search?{q}")["body"] or "{}")
    except Exception:
        return None
    res = d.get("results", [])
    if not res:
        return {"found": False}
    x = res[0]
    names = [n.get("value", "") for n in x.get("fullNames", [])]
    muni = [a.get("municipality", {}).get("value", "") for a in x.get("addresses", [])]
    ids = [i.get("value") for i in x.get("identifiers", [])]
    dead = bool(x.get("termination")) or any(re.search(r"likvid|konkurz", n, re.I) for n in names)
    return {"found": True, "registry": "RPO", "ico": ico or (ids[-1] if ids else None), "name": names[-1] if names else "",
            "all_names": names, "municipality": muni[-1] if muni else "", "established": x.get("establishment"),
            "terminated": x.get("termination"), "dead": dead, "why": "zaniknutá / likvidácia" if dead else None}


ARES = "https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty"
NACE_LABEL = {"9602": "kadeřnické a kosmetické služby", "7420": "fotografické činnosti", "6831": "realitní činnost",
              "7111": "architektonické činnosti", "7410": "specializované návrhářské činnosti (design interiérů)",
              "3109": "výroba ostatního nábytku", "3102": "výroba kuchyňského nábytku", "1623": "truhlářské výrobky",
              "4120": "výstavba budov", "4334": "malířské a sklenářské práce", "4333": "obkládání stěn a podlah",
              "4391": "pokrývačské práce", "4321": "elektroinstalace", "4322": "instalatérství, topenářství",
              "4520": "opravy motorových vozidel", "8130": "činnosti související s úpravou krajiny"}


def ares_ico(net, ico):
    """CZ register (ARES). IČO → názov, sídlo, NACE, zánik."""
    try:
        d = json.loads(net.get(f"{ARES}/{ico}")["body"] or "{}")
    except Exception:
        return None
    if not d.get("ico"):
        return {"found": False}
    return _ares_row(d)


def _ares_row(d):
    s = d.get("sidlo") or {}
    nace = [str(x) for x in d.get("czNace") or d.get("czNace2008") or []]
    dead = bool(d.get("datumZaniku"))
    return {"found": True, "registry": "ARES", "ico": d.get("ico"), "name": d.get("obchodniJmeno", ""),
            "municipality": s.get("nazevObce", ""), "address": s.get("textovaAdresa", ""), "established": d.get("datumVzniku"),
            "terminated": d.get("datumZaniku"), "dead": dead, "why": "zaniknutá" if dead else None,
            "nace": nace[:12], "nace_text": ", ".join(NACE_LABEL[n] for n in nace if n in NACE_LABEL)}


def ares_search(net, name, city=None, count=10):
    """ARES vyhľadanie podľa názvu (voliteľne obce). POST — Net cache ho neukladá, preto priamo a opatrne."""
    body = {"obchodniJmeno": name, "pocet": count}
    try:
        req = urllib.request.Request(f"{ARES}/vyhledat", data=json.dumps(body).encode(), method="POST",
                                     headers={"Content-Type": "application/json", "User-Agent": "lead-radar"})
        d = json.loads(urllib.request.urlopen(req, timeout=20).read())
    except Exception:
        return []
    out = [_ares_row(x) for x in d.get("ekonomickeSubjekty", [])]
    if city:
        from .normalize import bez
        out = [x for x in out if bez(city) in bez(x["municipality"] + " " + x["address"])]
    return out


def rpo_by_name(net, name, city):
    """SK register podľa názvu + obce: iba JEDNA jednoznačná zhoda (všetky rozlišujúce slová + rovnaká obec)."""
    from .normalize import bez, name_tokens
    toks = name_tokens(name)
    if not toks or not city:
        return None
    frag = max(toks, key=len)
    try:
        d = json.loads(net.get("https://api.statistics.sk/rpo/v1/search?fullName=" + urllib.parse.quote(frag), timeout=25)["body"] or "{}")
    except Exception:
        return None
    hits = []
    for x in d.get("results", []):
        names = [n.get("value", "") for n in x.get("fullNames", [])]
        muni = [a.get("municipality", {}).get("value", "") for a in x.get("addresses", [])]
        if names and muni and bez(muni[-1]) == bez(city) and all(t in bez(names[-1]) for t in toks):
            hits.append(x)
    if len(hits) != 1:
        return None
    ids = [i.get("value") for i in hits[0].get("identifiers", [])]
    return rpo(net, ico=ids[-1]) if ids else None


def register_for(net, entity):
    """Register podľa IČO; bez IČO skúsi jednoznačnú zhodu názov + obec (inak nič netvrdí)."""
    ico = next((f["value"] for f in entity["company_ids"]), None)
    if entity["country"] == "CZ":
        if ico:
            return ares_ico(net, ico)
        names = entity["brand_names"] + ([entity["legal_name"]] if entity["legal_name"] else [])
        for n in names[:2]:
            hits = ares_search(net, n, entity["city"], count=5) if entity["city"] else []
            if len(hits) == 1:
                hits[0]["matched_by"] = "názov + obec"
                return hits[0]
        return None
    if ico:
        return rpo(net, ico=ico)
    for n in (entity["brand_names"] + ([entity["legal_name"]] if entity["legal_name"] else []))[:2]:
        r = rpo_by_name(net, n, entity["city"])
        if r and r.get("found"):
            r["matched_by"] = "názov + obec"
            return r
    return None


def places(query, key, country="SK"):
    """Google Places API (Text Search) — iba s kľúčom GOOGLE_PLACES_KEY."""
    fields = ("places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,"
              "places.websiteUri,places.rating,places.userRatingCount,places.businessStatus,places.googleMapsUri,places.addressComponents,"
              "places.primaryTypeDisplayName")
    body = json.dumps({"textQuery": query, "languageCode": "sk" if country == "SK" else "cs", "regionCode": country, "pageSize": 20}).encode()
    req = urllib.request.Request("https://places.googleapis.com/v1/places:searchText", data=body, method="POST",
                                 headers={"Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": fields})
    out = []
    for p in json.loads(urllib.request.urlopen(req, timeout=20).read()).get("places", []):
        city = next((x.get("longText") for x in p.get("addressComponents", []) if "locality" in x.get("types", [])), "")
        out.append({"name": p.get("displayName", {}).get("text", ""), "profile": p.get("googleMapsUri"), "source": "google_business",
                    "country": country, "city": city, "address": p.get("formattedAddress", ""),
                    "phone": p.get("internationalPhoneNumber") or p.get("nationalPhoneNumber") or "",
                    "websites": [w for w in [p.get("websiteUri")] if w and is_own_web_candidate(w)],
                    "description": (p.get("primaryTypeDisplayName") or {}).get("text", ""),
                    "google": {"rating": p.get("rating"), "reviews": p.get("userRatingCount"), "maps_url": p.get("googleMapsUri"),
                               "website_on_google": p.get("websiteUri"), "business_status": p.get("businessStatus")}})
    return out


def result_to_seed(r, country, category=None):
    """Výsledok vyhľadávania (nie social) → kandidát: vlastný web firmy alebo katalógový profil."""
    u = r.get("url") or ""
    h = host(u)
    if not h or not is_own_web_candidate(u):
        return None
    title = re.split(r"\s[|–\-•]\s", r.get("title") or "")[0].strip()
    return {"name": title[:120] or h, "profile": u, "source": "search:web", "country": country, "websites": [u],
            "description": (r.get("snippet") or "")[:300], "vertical": category, "city": ""}
