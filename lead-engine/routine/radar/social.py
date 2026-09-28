# -*- coding: utf-8 -*-
"""
Instagram / Facebook / Google cez VÝSLEDKY VYHĽADÁVANIA (title, url, snippet).

Priamy prístup na instagram.com / facebook.com NEPOUŽÍVAME: Instagram vracia 429 a login wall, Facebook
presmeruje na prihlásenie a oba v robots.txt / podmienkach zakazujú automatizovaný zber. Preto:
  * handle, zobrazované meno, mesto a text bio berieme iba z verejne indexovaného výsledku vyhľadávania,
  * telefón / web zo snippetu je iba NÍZKA dôvera (musí ho potvrdiť iný zdroj — katalóg, vlastný web),
  * súkromné profily neanalyzujeme; osobný profil bez firemných signálov zahodíme.
"""
import re
import urllib.parse

from .normalize import bez, emails_in, host, phones_in

IG_SKIP = {"p", "reel", "reels", "explore", "popular", "stories", "tv", "accounts", "direct", "about", "legal", "developer"}
FB_SKIP = {"groups", "events", "posts", "photos", "videos", "watch", "marketplace", "hashtag", "story.php", "permalink.php",
           "sharer", "share", "login", "help", "policies", "pages", "public", "search", "reel", "media"}
BUSINESS_HINT = re.compile(r"s\.?r\.?o|studio|salon|salón|kaderni|barber|beauty|makeup|make-up|vizaz|nechty|nehty|lash|brow|"
                           r"kozmet|kosmet|foto|photo|video|reality|real|makl|interi|design|dizajn|architekt|svad|svat|wedding|"
                           r"stolar|truhl|nabyt|kuchyn|zahrad|garden|stav|rekon|podlah|strech|strech|elektr|instal|vodo|"
                           r"kuren|topen|auto|servis|detailing|pneu|bran|plot|pergol|mal[ií]ar|malir|fasad|obklad|kovo|tesar|"
                           r"tel\.?|kontakt|objednav|rezerv|booking|ič|ičo|shop|services?|firma", re.I)


def parse_instagram(url, title="", snippet=""):
    u = urllib.parse.urlparse(url)
    if "instagram.com" not in (u.hostname or ""):
        return None
    parts = [p for p in u.path.split("/") if p]
    if not parts or parts[0].lower() in IG_SKIP:
        # /handle/p/xyz → handle je prvý segment; /p/xyz bez handle nevieme
        return None
    handle = parts[0].lower()
    if not re.fullmatch(r"[a-z0-9_.]{2,30}", handle):
        return None
    disp = None
    m = re.search(r"^(.*?)\s*\(@([A-Za-z0-9_.]+)\)", title or "")
    if m and m.group(2).lower() == handle:
        disp = m.group(1).strip() or None
    city = None
    mc = re.search(r"\)\s*[·•]\s*([^•·|]{2,40})$", title or "")
    if mc and not re.search(r"instagram|photos|videos|fotky", mc.group(1), re.I):
        city = mc.group(1).strip()
    return _profile("instagram", f"https://www.instagram.com/{handle}/", handle, disp, city, title, snippet)


def parse_facebook(url, title="", snippet=""):
    u = urllib.parse.urlparse(url)
    if not re.search(r"(^|\.)(facebook|fb)\.com$", u.hostname or ""):
        return None
    parts = [p for p in u.path.split("/") if p]
    if not parts:
        return None
    if parts[0] == "people" and len(parts) >= 3:
        handle = f"people/{parts[1]}/{parts[2]}"
        canon = f"https://www.facebook.com/people/{parts[1]}/{parts[2]}/"
    elif parts[0] == "profile.php":
        q = urllib.parse.parse_qs(u.query).get("id", [""])[0]
        if not q:
            return None
        handle, canon = f"id/{q}", f"https://www.facebook.com/profile.php?id={q}"
    elif parts[0].lower() in FB_SKIP:
        return None
    else:
        handle = parts[0].lower()
        canon = f"https://www.facebook.com/{parts[0]}/"
    disp, city = None, None
    bits = [b.strip() for b in re.split(r"\s+\|\s+|\s+-\s+Facebook$", title or "") if b.strip()]
    bits = [b for b in bits if b.lower() not in ("facebook",)]
    if bits:
        disp = bits[0]
        if len(bits) >= 2 and len(bits[1]) < 40:
            city = bits[1]
    return _profile("facebook", canon, handle, disp, city, title, snippet)


def _profile(platform, url, handle, disp, city, title, snippet):
    blob = " ".join(x for x in (title, snippet) if x)
    phones = phones_in(snippet or "")
    webs = [w for w in re.findall(r"\b(?:https?://)?(?:www\.)?([a-z0-9-]{2,}\.(?:sk|cz|eu|com|net|org))\b", (snippet or "").lower())
            if not re.search(r"instagram|facebook|linktr|google|youtube|tiktok", w)]
    business = bool(BUSINESS_HINT.search(bez(blob))) or bool(phones)
    return {
        "platform": platform, "url": url, "handle": handle, "display_name": disp, "city": city,
        "bio": (snippet or "")[:300] or None, "phones_snippet": phones[:2], "emails_snippet": emails_in(snippet or "")[:2],
        "website": ("https://" + webs[0]) if webs else None, "business_signal": business,
        "activity": "unknown", "confidence": "low", "evidence": [f"výsledok vyhľadávania: „{(title or '')[:90]}“"],
        "source": f"search:{platform}",
    }


def parse_result(r):
    """Jeden výsledok vyhľadávania → social profil (alebo None)."""
    url = r.get("url") or ""
    h = host(url)
    if "instagram.com" in h:
        return parse_instagram(url, r.get("title", ""), r.get("snippet", ""))
    if h.endswith("facebook.com") or h.endswith("fb.com"):
        return parse_facebook(url, r.get("title", ""), r.get("snippet", ""))
    return None


def matches_entity(profile, entity):
    """Patrí profil tejto firme? Silné: telefón v bio, web v bio = web firmy, handle = e-mailová doména.
    Stredné: rozlišujúce slová názvu v handle/mene + mesto. Iba názov = neistota."""
    from .entity import own_domains
    from .normalize import name_tokens, handle_tokens
    strong, mid = [], []
    ph = {f["value"][-9:] for f in entity["phones"]}
    if ph & {p[-9:] for p in profile.get("phones_snippet", [])}:
        strong.append("telefón v profile = telefón firmy")
    if profile.get("website") and host(profile["website"]) in own_domains(entity):
        strong.append(f"profil odkazuje na web firmy {host(profile['website'])}")
    for w in entity["websites"]:
        if f"{profile['platform']}:{(profile.get('handle') or '').lower()}" in w.get("social_links", []):
            strong.append(f"web {w['domain']} odkazuje na tento profil")
    ptoks = set(handle_tokens(profile.get("handle") or "")) | set(name_tokens(profile.get("display_name") or ""))
    hjoined = re.sub(r"[^a-z0-9]", "", bez(profile.get("handle") or ""))
    # každý variant názvu zvlášť („Katarína Freund - Beauty by Katy“ aj „Beauty by Katy“)
    variants = [set(name_tokens(n)) for n in entity["brand_names"] + ([entity["legal_name"]] if entity["legal_name"] else [])]
    name_hit = any(v and (v <= ptoks or all(t in hjoined for t in v)) for v in variants)
    city_hit = bool(entity["city"]) and (bez(entity["city"]) in bez(" ".join(x for x in (profile.get("city"), profile.get("bio"), profile.get("display_name")) if x))
                                         or re.sub(r"[^a-z]", "", bez(entity["city"])) in hjoined)
    if name_hit:
        mid.append("názov firmy v mene / handle profilu")
    if city_hit:
        mid.append(f"mesto {entity['city']} v profile")
    if strong:
        return "confirmed", strong + mid
    if name_hit and city_hit:
        return "probable", mid
    if name_hit:
        return "uncertain", mid
    return "no", []
