# -*- coding: utf-8 -*-
"""Normalizácia identifikátorov SK + CZ: telefón (E.164), IČO, doména, e-mail, text."""
import re
import unicodedata
import urllib.parse

COUNTRIES = ("SK", "CZ")
PREFIX = {"SK": "421", "CZ": "420"}

# Poskytovatelia e-mailu — doména e-mailu NIE JE web firmy.
FREE_EMAIL = {
    "gmail.com", "googlemail.com", "seznam.cz", "email.cz", "post.cz", "centrum.cz", "centrum.sk", "volny.cz",
    "atlas.cz", "atlas.sk", "azet.sk", "post.sk", "zoznam.sk", "pobox.sk", "inmail.sk", "orangemail.sk",
    "stonline.sk", "chello.sk", "szm.sk", "outlook.com", "outlook.sk", "outlook.cz", "hotmail.com", "hotmail.sk",
    "hotmail.cz", "live.com", "yahoo.com", "icloud.com", "me.com", "protonmail.com", "proton.me", "tiscali.cz",
    "quick.cz", "gmx.com", "gmx.net", "mail.t-com.sk", "t-com.sk", "slovanet.sk", "upcmail.cz", "iol.cz",
}

# Hostitelia, ktorí nie sú vlastným webom firmy (sociálne siete, katalógy, mapy, registre).
NOT_OWN_WEB = re.compile(
    r"(^|\.)(facebook|fb|instagram|google|goo|youtube|youtu|tiktok|twitter|x|linkedin|pinterest|waze|mapy|"
    r"zlatestranky|azet|zoznam|bazos|firmy|finstat|orsr|indexpodnikatela|foaf|edb|zivefirmy|najisto|seznam|"
    r"wenetonline|registeruz|rpo|statistics|ares|justice|podnikatel|kurzy|hbi|wikipedia|booking|tripadvisor|"
    r"linktr|linktree|beacons|bio|notino|daibau|bizref|zahradnecentra|nehnutelnosti|reality|topreality|sreality|"
    r"bezrealitky|mojandrej|salony|reservio|bookio|noona|treatwell|fresha|myfitness|poptavej|nabytek-info|"
    r"virtualne|kompass|slovenskobcan|dnb|cylex|maxinfo|vsetkyfirmy|123dopyt|hladammajstra|trade|orlykozmetiky|"
    r"orlygastronomie|zlatafirma|studiakrasy|vizaze|kozmetickesalony|kozmetickechirurgie|slovakiayp|yoys|zlavomat|"
    r"crz|modrastrecha|voda-portal|starofservice|jooble|daibau|square|squareup|wikipedia|evendo|beremese|"
    r"kozmetickesaloncz|firmo|ekatalog|najdifirmu|sluzby|mapy)\."
)
# Link-in-bio služby: nie sú web, ale môžu obsahovať odkaz na web.
LINK_IN_BIO = re.compile(r"(^|\.)(linktr\.ee|linktree\.com|beacons\.ai|bio\.link|lnk\.bio|campsite\.bio|taplink\.cc)$")
# Bezplatné stavebnice: subdoména je samostatný web (nie „rovnaká doména“ pre identitu).
FREE_HOSTS = re.compile(
    r"\.(webnode\.(sk|cz|com)|estranky\.(sk|cz)|wixsite\.com|wix\.com|blogspot\.com|weebly\.com|jimdo(site)?\.com|"
    r"szm\.(sk|com)|ozm\.sk|sweb\.cz|webgarden\.(cz|sk)|mypage\.(sk|cz)|websnadno\.cz|webovastranka\.sk|"
    r"g\.page|business\.site|carrd\.co|squarespace\.com|wordpress\.com|webflow\.io|vercel\.app|netlify\.app)$"
)


def bez(s):
    """Bez diakritiky, malými písmenami."""
    return "".join(c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn").lower()


def digits(s):
    return re.sub(r"\D", "", s or "")


def phone_e164(raw, country=None):
    """'0905 123 456' → '+421905123456'; '606 122 925' (CZ) → '+420606122925'. Neplatné → None.

    SK národné číslo: 0 + 9 číslic (mobil 09xx…, pevná 02… / 0xx…). CZ: 9 číslic bez nuly.
    Bez predvoľby rozhoduje `country`; 10 číslic s nulou na začiatku je vždy SK.
    """
    d = digits(raw)
    if not d:
        return None
    if d.startswith("00"):
        d = d[2:]
    for cc, pre in (("SK", "421"), ("CZ", "420")):
        if d.startswith(pre) and len(d) == len(pre) + 9:
            return "+" + d
        if d.startswith(pre + "0") and len(d) == len(pre) + 10:  # +421 0905… (chybne zapísané)
            return "+" + pre + d[len(pre) + 1:]
    if len(d) == 10 and d.startswith("0"):
        return "+421" + d[1:]
    if len(d) == 9 and not d.startswith("0"):
        if country == "SK":
            return "+421" + d
        if country == "CZ" or d[0] in "34567":
            # 9 číslic bez nuly je štandard CZ; pri SK by chýbala úvodná nula
            return "+420" + d
    return None


def phone_country(e164):
    if not e164:
        return None
    return "SK" if e164.startswith("+421") else "CZ" if e164.startswith("+420") else None


def is_mobile(e164):
    if not e164:
        return False
    if e164.startswith("+4219"):
        return True
    return e164.startswith(("+4206", "+4207"))


def phone_variants(e164):
    """Zápisy telefónu, ako sa bežne objavujú na webe / v katalógoch (pre presné vyhľadávanie)."""
    if not e164:
        return []
    cc, n = e164[1:4], e164[4:]
    out = [f"+{cc} {n[:3]} {n[3:6]} {n[6:]}"]
    if cc == "421":
        out += [f"0{n[:3]} {n[3:6]} {n[6:]}", f"0{n}"]
    else:
        out += [f"{n[:3]} {n[3:6]} {n[6:]}", n]
    return out


def phone_in_text(e164, text_digits):
    """Je telefón na stránke? Porovnáva posledných 9 číslic (bez ohľadu na zápis a predvoľbu)."""
    return bool(e164) and e164[-9:] in text_digits


PHONE_RE = re.compile(r"(?:\+|00)?(?:421|420)?[\s./-]?\(?0?\)?[\s./-]?\d{2,3}(?:[\s./-]?\d{2,3}){2,3}")


def phones_in(text, country=None):
    """Všetky telefóny v texte ako E.164 (zoradené podľa výskytu, bez duplicít)."""
    seen, out = set(), []
    for m in PHONE_RE.finditer(text or ""):
        e = phone_e164(m.group(0), country)
        if e and e not in seen:
            seen.add(e)
            out.append(e)
    return out


def cz_ico_valid(ico):
    """Kontrolný súčet českého IČO (mod 11)."""
    if not re.fullmatch(r"\d{8}", ico or ""):
        return False
    s = sum(int(ico[i]) * (8 - i) for i in range(7))
    c = (11 - s % 11) % 10
    return c == int(ico[7])


def ico_norm(raw, country=None):
    d = digits(raw)
    if not 6 <= len(d) <= 8:
        return None
    d = d.zfill(8)
    if country == "CZ" and not cz_ico_valid(d):
        return None
    return d


def host(url):
    try:
        u = url if "://" in (url or "") else "https://" + (url or "")
        h = (urllib.parse.urlparse(u).hostname or "").lower()
        return h.removeprefix("www.")
    except Exception:
        return ""


def site_key(url):
    """Kľúč webu pre identitu: celá doména bez www (subdoména stavebnice je samostatný web)."""
    return host(url)


# Adresárové podstránky (…/firma/123/…, /profile/…) nie sú web firmy.
DIRECTORY_PATH = re.compile(r"/(firma|firmy|company|companies|profile|profil|detail|adresar|katalog|subjekty|dodavatelia)/", re.I)


def is_own_web_candidate(url):
    h = host(url)
    if not h or "." not in h or NOT_OWN_WEB.search(h + ".") or LINK_IN_BIO.search(h):
        return False
    path = urllib.parse.urlparse(url if "://" in url else "https://" + url).path
    return not DIRECTORY_PATH.search(path)


def email_domain(email):
    if not email or "@" not in email:
        return None
    d = email.rsplit("@", 1)[1].lower().strip().rstrip(".")
    return None if d in FREE_EMAIL else d


EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")


def emails_in(text):
    seen, out = set(), []
    for m in EMAIL_RE.finditer(text or ""):
        e = m.group(0).lower().strip(".")
        if re.search(r"\.(png|jpe?g|gif|webp|svg)$", e) or e.endswith(("@sentry.io", "@example.com", "@domain.com")):
            continue
        if e not in seen:
            seen.add(e)
            out.append(e)
    return out


LEGAL = re.compile(
    r"\b(s\.?\s?r\.?\s?o\.?|spol(\.|ocnost)?|a\.?\s?s\.?|k\.?\s?s\.?|v\.?\s?o\.?\s?s\.?|z\.?\s?s\.?|ing|mgr|bc|"
    r"phdr|mudr|judr|ltd|gmbh|s\.?\s?p\.?|o\.?\s?z\.?|druzstvo|obchodna|obchodni|firma|spolecnost)\b\.?",
    re.I,
)
GENERIC = {"studio", "salon", "salón", "centrum", "servis", "service", "sluzby", "sluzba", "group", "team", "shop",
           "design", "slovakia", "slovensko", "cz", "sk", "eu", "the", "and", "pre", "pro", "plus", "art"}


def name_tokens(name, drop=()):
    """Rozlišujúce slová názvu (bez právnej formy a generických slov) — pre identitu, nie pre kategóriu."""
    t = re.sub(r"[^a-z0-9 ]", " ", LEGAL.sub(" ", bez(name)))
    return [w for w in t.split() if len(w) > 2 and w not in GENERIC and w not in drop]


def handle_tokens(handle):
    """@novak_interiery → ['novak', 'interiery']"""
    return [w for w in re.split(r"[^a-z0-9]+", bez(handle)) if len(w) > 2]
