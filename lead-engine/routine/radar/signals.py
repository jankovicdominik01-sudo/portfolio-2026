# -*- coding: utf-8 -*-
"""
Procesné signály a meracie / reklamné tagy z webu (Opportunity Engine, Phase 2).

Otázka nie je „má zlý web?“, ale „ako firma vybavuje zákazníka a čo z toho robí ručne?“.

Každý signál: {code, key (= code), level, text, evidence, excerpt, source, observed_at, confidence}

Pravidlá úrovne:
  VERIFIED  objektívny fakt zo stránky (formulár má 3 polia, PDF cenník je odkaz, pole na súbor existuje)
  OBSERVED  viditeľný signál (úryvok textu), nie dôkaz interného procesu
  UNKNOWN   nevieme; nikdy z toho nerobíme tvrdenie

Neprítomnosť („formulár sme nenašli“) je vždy OBSERVED s textom „nenašli sme“,
nikdy „nemajú“. Prehľadávame iba homepage + max. 2 podstránky.

Reklama: tag na webe = TAG_PRESENT (je nainštalovaný), NIE „inzerujú“.
Bez tagu = NOT_FOUND (nenašli sme), NIE „neinzerujú“. ACTIVE smie nastaviť iba
ručná kontrola s odkazom (Transparency Center / Ad Library). Spend je vždy UNKNOWN.
"""
import re
from datetime import datetime, timezone

from .normalize import bez

SIGNALS_VERSION = "1.0"

# Texty sú bez diakritiky a malými písmenami (bez()). SK aj CZ tvary.
CALL = r"(volajte|zavolajte|volejte|zavolejte|telefonujte|zatelefonujte)"
CALL_FOR_APPOINTMENT = re.compile(
    rf"(pre|na) (objednanie|objednani|objednavku|rezervaciu|rezervaci|termin|terminy)[^.]{{0,40}}{CALL}"
    rf"|{CALL}[^.]{{0,30}}(objedna|termin|rezerv)")
PHONE_BOOKING = re.compile(
    r"(objednavky|objednat sa|objednajte sa|objednejte se|objednat se|objednanie|objednani|terminy?|rezervacie?|rezervace)"
    r"[^.]{0,40}(telefonick|na (tel|cisle|cisla|telefon))"
    r"|(objednavky|terminy|rezervace) (iba|len|pouze|jen) (telefonicky|na telefon)")
PHONE_FIRST_CONTACT = re.compile(
    rf"{CALL}( nam)?[^.]{{0,15}}(poradime|domluvime|dohodneme|domluvime se|dohodnem|vsetko preberieme|vse probereme)"
    r"|(nevahajte|nevahejte)[^.]{0,20}(zavolat|telefonicky)"
    rf"|(pre|pro) (viac|vice) informaci[ie][^.]{{0,20}}{CALL}")
CALL_FOR_PRICE = re.compile(
    rf"(cena|ceny|cenu|cenovu ponuku|cenovou nabidku|nacenenie|naceneni)[^.]{{0,30}}(telefonicky|na telefon|po telefone|{CALL})"
    rf"|{CALL}[^.]{{0,30}}(cen|nacen)")
MANUAL_QUOTE = re.compile(
    r"(cenovu ponuku|cenova ponuka|cenovou nabidku|cenova nabidka|nacenenie|naceneni|kalkulac|cena (na|po) (dotaz|dohode|dohodu)"
    r"|cena dohodou|individualn[aie] cen|nezavazn[auo] (cenovu )?(ponuku|nabidku)|ponuku vam (pripravime|vypracujeme|zasleme|posleme))")
MEASUREMENT = re.compile(
    r"(zameranie|zamerani|zamerame|zamerat|obhliadk|obhlidk|vymerani|vymeranie|prideme (sa )?pozriet|prijedeme (se )?podivat)")
PHOTO_BY_MESSAGE = re.compile(
    r"(poslite|posli|zaslite|poslete|zaslete|poslat|zaslat)[^.]{0,30}(fotk|foto)[^.]{0,40}(messenger|whatsapp|viber|sms|mail|email)?")
EMAIL_FOR_ORDER = re.compile(
    r"(objednavky|objednavku|dopyty|dopyt|poptavky|poptavku)[^.]{0,40}(na e-?mail|e-?mailom|e-?mailem|mailom|mailem)"
    r"|(poslite|zaslite|poslete|zaslete)[^.]{0,30}(objednavku|dopyt|poptavku)[^.]{0,30}(e-?mail|mail)")
SOCIAL_REALIZATIONS = re.compile(
    r"(realizacie|realizace|nase prace|naseho prace|fotogaleri|galeri|ukazky|fotky)[^.]{0,60}(facebook|instagram)"
    r"|(facebook|instagram)[^.]{0,40}(realizac|nase prace|fotk|ukazk)")
CUSTOMER_STATUS = re.compile(
    r"(stav (zakazky|opravy|objednavky|vozidla)|sledovanie (zakazky|objednavky)|sledovani (zakazky|objednavky)|klientska zona"
    r"|zakaznicky ucet|zakaznicka zona|prihlasenie|prihlaseni|login)")
BOOKING_TOOL = re.compile(r"(reservio|bookio|calendly|simplybook|setmore|booksy|noona|fresha|timely|youcanbook|"
                          r"rezervacny system|rezervacni system|online rezervaci|rezervovat online|objednat online|objednat se online)", re.I)
WHATSAPP = re.compile(r"https?://(?:www\.)?(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)/[^\s\"'<>]*", re.I)
MESSENGER = re.compile(r"https?://(?:www\.)?(m\.me|viber\.me|invite\.viber\.com)/[^\s\"'<>]*", re.I)
FORM_BLOCK = re.compile(r"<form\b[^>]*>(.*?)</form>", re.S | re.I)
FIELD = re.compile(r"<(input|textarea|select)\b([^>]*)>", re.I)
PDF_LINK = re.compile(r"<a\b[^>]*href=[\"']([^\"']+\.pdf)(?:\?[^\"']*)?[\"'][^>]*>(.*?)</a>", re.S | re.I)
PRICE_WORD = re.compile(r"cenn?ik|cenik|ceny|price|sazebnik", re.I)

# Polia „všeobecného“ formulára (nič o zákazke, iba kontakt a správa).
GENERIC_FIELD = re.compile(r"(name|meno|jmeno|priezvisko|prijmeni|e-?mail|phone|tel|telefon|mobil|message|sprava|zprava|"
                           r"predmet|subject|text|comment|koment|poznamk|dotaz|otazk|gdpr|souhlas|suhlas|consent|captcha|"
                           r"recaptcha|honeypot|agree)", re.I)
SKIP_TYPES = {"hidden", "submit", "button", "reset", "image"}
FIELD_LABEL = [
    (re.compile(r"e-?mail", re.I), "e-mail"),
    (re.compile(r"phone|tel|mobil", re.I), "telefón"),
    (re.compile(r"message|sprava|zprava|text|comment|koment|poznamk|dotaz|otazk", re.I), "správa"),
    (re.compile(r"predmet|subject", re.I), "predmet"),
    (re.compile(r"name|meno|jmeno|priezvisko|prijmeni", re.I), "meno"),
]


def _now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _pages(fp):
    """[(url, html, text)] — po stránkach, ak ich fingerprint má, inak celý web ako jedna stránka."""
    url = fp.get("final_url") or fp.get("requested") or ""
    pr = fp.get("page_raw")
    if pr:
        return [(p.get("url") or url, p.get("html") or "", p.get("text") or "") for p in pr]
    return [(url, fp.get("raw_pages") or fp.get("body_head") or "", fp.get("text") or "")]


def _excerpt(orig, norm, m, pad=40):
    """Krátky doslovný úryvok. Z pôvodného textu (s diakritikou), ak sa dĺžky zhodujú."""
    a, b = max(0, m.start() - pad), min(len(norm), m.end() + pad)
    src = orig if len(orig) == len(norm) else norm
    return re.sub(r"\s+", " ", src[a:b]).strip()[:200]


def _forms(html):
    """Formuláre bez vyhľadávania: [{fields: [str], file: bool}]"""
    out = []
    for body in FORM_BLOCK.findall(html or ""):
        fields, file_ = [], False
        for tag, attrs in FIELD.findall(body):
            t = (re.search(r"type=[\"']?([a-z]+)", attrs, re.I) or [None, "text"])[1].lower() if tag.lower() == "input" else tag.lower()
            if t in SKIP_TYPES:
                continue
            if t == "file":
                file_ = True
            ident = " ".join(re.findall(r"(?:name|id|placeholder|aria-label)=[\"']([^\"']*)[\"']", attrs, re.I))
            fields.append({"type": t, "ident": ident})
        if not fields or any(f["type"] == "search" or re.fullmatch(r"\s*(s|q|search|hledat|hladat)\s*", f["ident"], re.I) for f in fields):
            continue
        out.append({"fields": fields, "file": file_})
    return out


def _field_label(f):
    for rx, lab in FIELD_LABEL:
        if rx.search(f["ident"]):
            return lab
    return "súhlas" if f["type"] == "checkbox" else f["type"]


def process_signals(fp, observed_at=None):
    """fp = fingerprint webu. → [{code, key, level, text, evidence, excerpt, source, observed_at, confidence}]"""
    if not fp or not fp.get("reachable"):
        return []
    at = observed_at or _now()
    pages = _pages(fp)
    home = pages[0][0]
    out = []

    def add(code, level, txt, excerpt, source, confidence):
        if any(s["code"] == code for s in out):
            return
        ex = str(excerpt)[:200]
        out.append({"code": code, "key": code, "level": level, "text": txt, "evidence": ex, "excerpt": ex,
                    "source": source or home, "observed_at": at, "confidence": confidence})

    def text_rule(code, rx, txt, confidence="high"):
        for url, _, orig in pages:
            norm = bez(orig)
            m = rx.search(norm)
            if m:
                add(code, "OBSERVED", txt, _excerpt(orig, norm, m), url, confidence)
                return True
        return False

    text_rule("CALL_FOR_APPOINTMENT", CALL_FOR_APPOINTMENT, "Na termín alebo objednanie posielajú zákazníka zavolať")
    text_rule("PHONE_BOOKING", PHONE_BOOKING, "Objednávky / termíny riešia telefonicky (píšu to na webe)")
    text_rule("PHONE_FIRST_CONTACT", PHONE_FIRST_CONTACT, "Prvý kontakt vedú cez telefonát", "medium")
    text_rule("CALL_FOR_PRICE", CALL_FOR_PRICE, "Cenu povedia až po telefonáte")
    text_rule("MANUAL_QUOTE_SIGNAL", MANUAL_QUOTE, "Cenovú ponuku pripravujú ručne pre každý dopyt", "medium")
    text_rule("MEASUREMENT_REQUIRED", MEASUREMENT, "Pred ponukou robia zameranie alebo obhliadku")
    text_rule("PHOTOS_REQUESTED_SEPARATELY", PHOTO_BY_MESSAGE, "Fotky od zákazníka chcú poslať zvlášť (správou alebo mailom)")
    text_rule("EMAIL_FOR_ORDER", EMAIL_FOR_ORDER, "Objednávky alebo dopyty chcú poslať e-mailom")
    text_rule("SOCIAL_REALIZATIONS", SOCIAL_REALIZATIONS, "Realizácie / fotky ukazujú hlavne na sociálnych sieťach", "medium")

    raw_all = "\n".join(h for _, h, _ in pages)
    forms = [(url, f) for url, h, _ in pages for f in _forms(h)]
    any_form_tag = bool(fp.get("forms")) or bool(re.search(r"<form\b", raw_all, re.I))

    m = WHATSAPP.search(raw_all)
    if m:
        add("WHATSAPP_PRIMARY", "OBSERVED", "Na webe vedú zákazníka písať na WhatsApp", m.group(0), home, "medium" if any_form_tag else "high")
    m = MESSENGER.search(raw_all)
    if m:
        add("MESSENGER_PRIMARY", "OBSERVED", "Na webe vedú zákazníka písať cez Messenger / Viber", m.group(0), home, "medium" if any_form_tag else "high")

    for url, f in forms:
        idents = [x for x in f["fields"] if x["type"] not in ("checkbox", "radio")]
        if 1 <= len(idents) <= 5 and all(GENERIC_FIELD.search(x["ident"] or x["type"]) for x in idents) and not f["file"]:
            labels = ", ".join(dict.fromkeys(_field_label(x) for x in idents))
            add("GENERIC_CONTACT_FORM", "VERIFIED", f"Formulár má iba všeobecné polia ({len(idents)}): {labels}",
                f"{len(idents)} polia: {labels}", url, "high")
            break

    if any(f["file"] for _, f in forms) or re.search(r"type=[\"']?file", raw_all, re.I):
        add("FILE_UPLOAD_PRESENT", "VERIFIED", "Formulár má pole na prílohu (fotky / súbory)", "input type=file", home, "high")
    else:
        add("PHOTO_UPLOAD_MISSING", "OBSERVED", "Možnosť priložiť fotky sme na webe nenašli", "homepage + podstránky bez input type=file", home, "medium")

    for url, h, _ in pages:
        for href, label in PDF_LINK.findall(h):
            if PRICE_WORD.search(href) or PRICE_WORD.search(re.sub(r"<[^>]+>", " ", label)):
                add("PDF_PRICE_LIST", "VERIFIED", "Cenník je PDF súbor", href[:200], url, "high")
                break

    booking = BOOKING_TOOL.search(raw_all) or BOOKING_TOOL.search(bez(" ".join(t for _, _, t in pages)))
    if booking:
        add("BOOKING_TOOL_PRESENT", "OBSERVED", "Na webe je online rezervácia", booking.group(0), home, "high")
    else:
        add("NO_BOOKING_FOUND", "OBSERVED", "Online rezerváciu sme na webe nenašli", "homepage + podstránky bez rezervačného nástroja", home, "medium")
    if not (any_form_tag or forms):
        add("NO_FORM_FOUND", "OBSERVED", "Formulár sme na webe nenašli", "homepage + podstránky bez <form>", home, "medium")
    if not CUSTOMER_STATUS.search(bez(" ".join(t for _, _, t in pages))):
        add("NO_CUSTOMER_STATUS_FOUND", "OBSERVED", "Stav zákazky pre zákazníka sme na webe nenašli", "homepage + podstránky bez klientskej zóny", home, "low")
    return out


def tags(fp):
    """Meracie a reklamné tagy. → {google_ads, ga4, gtm, meta_pixel, ads_status, spend}"""
    if not fp or not fp.get("reachable"):
        return {"ads_status": "UNKNOWN", "spend": "UNKNOWN", "google_ads": None, "ga4": None, "gtm": None, "meta_pixel": None}
    raw = fp.get("raw_pages") or fp.get("body_head") or ""
    found = {}
    for key, rx in (("google_ads", ADS_TAG), ("ga4", GA4_TAG), ("gtm", GTM_TAG), ("meta_pixel", META_PIXEL)):
        m = rx.search(raw)
        found[key] = m.group(0)[:80] if m else None
    # GTM môže reklamný tag skrývať → bez GTM je NOT_FOUND silnejšie, ale stále nie „neinzerujú“
    found["ads_status"] = "TAG_PRESENT" if found["google_ads"] else "NOT_FOUND"
    found["spend"] = "UNKNOWN"
    return found


ADS_TAG = re.compile(r"\bAW-\d{6,}|googleadservices\.com/pagead/conversion|google_conversion_id", re.I)
GA4_TAG = re.compile(r"\bG-[A-Z0-9]{6,}\b")
GTM_TAG = re.compile(r"\bGTM-[A-Z0-9]{4,}\b")
META_PIXEL = re.compile(r"connect\.facebook\.net/[^\"']*/fbevents\.js|fbq\(\s*['\"]init", re.I)
