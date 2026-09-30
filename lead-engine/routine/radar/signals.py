# -*- coding: utf-8 -*-
"""
Procesné signály a meracie / reklamné tagy z webu (Opportunity Engine, krok 5).

Otázka nie je „má zlý web?“, ale „čo firma robí ručne, čo jej web vie zobrať z rúk?“.

Pravidlá úrovne:
  OBSERVED  vidno na webe, ukladá sa doslovný úryvok (excerpt)
  UNKNOWN   nevieme; nikdy z toho nerobíme tvrdenie

Neprítomnosť („formulár sme nenašli“) je vždy OBSERVED s textom „nenašli sme“,
nikdy „nemajú“. Prehľadávame iba homepage + max. 2 podstránky.

Reklama: tag na webe = TAG_PRESENT (je nainštalovaný), NIE „inzerujú“.
Bez tagu = NOT_FOUND (nenašli sme), NIE „neinzerujú“. ACTIVE smie nastaviť iba
ručná kontrola s odkazom (Transparency Center / Ad Library). Spend je vždy UNKNOWN.
"""
import re

from .normalize import bez

# text je už bez diakritiky a malými písmenami (bez())
PHONE_ORDER = re.compile(
    r"(objednavky|objednat sa|objednajte sa|objednanie|terminy?|rezervacie?)[^.]{0,40}(telefonick|na (tel|cisle|telefon)|volajte)"
    r"|(volajte|zavolajte)[^.]{0,30}(objedna|termin|rezerv)"
    r"|(objednavky|terminy) (iba|len) (telefonicky|na telefon)")
PHOTO_BY_MESSAGE = re.compile(r"(poslite|posli|zaslite)[^.]{0,30}(fotk|foto)[^.]{0,40}(messenger|whatsapp|viber|sms|mail|email)?")
BOOKING_TOOL = re.compile(r"(reservio|bookio|calendly|simplybook|setmore|booksy|noona|fresha|timely|youcanbook|"
                          r"rezervacny system|online rezervaci|rezervovat online|objednat online)", re.I)
MESSENGER = re.compile(r"https?://(?:www\.)?(m\.me|wa\.me|api\.whatsapp\.com|viber\.me|invite\.viber\.com)/[^\s\"'<>]*", re.I)
FORM = re.compile(r"<form\b", re.I)

ADS_TAG = re.compile(r"\bAW-\d{6,}|googleadservices\.com/pagead/conversion|google_conversion_id", re.I)
GA4_TAG = re.compile(r"\bG-[A-Z0-9]{6,}\b")
GTM_TAG = re.compile(r"\bGTM-[A-Z0-9]{4,}\b")
META_PIXEL = re.compile(r"connect\.facebook\.net/[^\"']*/fbevents\.js|fbq\(\s*['\"]init", re.I)


def _excerpt(text, m, pad=40):
    a, b = max(0, m.start() - pad), min(len(text), m.end() + pad)
    return text[a:b].strip()[:200]


def process_signals(fp):
    """fp = fingerprint webu. → [{key, level, text, excerpt, source}]"""
    if not fp or not fp.get("reachable"):
        return []
    url = fp.get("final_url") or fp.get("requested") or ""
    raw = fp.get("raw_pages") or fp.get("body_head") or ""
    t = bez(fp.get("text", ""))
    out = []

    def add(key, txt, excerpt):
        out.append({"key": key, "level": "OBSERVED", "text": txt, "excerpt": str(excerpt)[:200], "source": url})

    m = PHONE_ORDER.search(t)
    if m:
        add("phone_ordering", "Objednávky / termíny riešia telefonicky (píšu to na webe)", _excerpt(t, m))
    m = MESSENGER.search(raw)
    if m:
        add("messenger_cta", "Na webe je odkaz na Messenger / WhatsApp / Viber", m.group(0))
    m = PHOTO_BY_MESSAGE.search(t)
    if m:
        add("photos_by_message", "Fotky od zákazníka chcú poslať správou alebo mailom", _excerpt(t, m))
    booking = BOOKING_TOOL.search(raw) or BOOKING_TOOL.search(t)
    if booking:
        add("booking_tool", "Na webe je online rezervácia", booking.group(0))
    else:
        add("no_booking_found", "Online rezerváciu sme na webe nenašli", "homepage + podstránky bez rezervačného nástroja")
    if not (fp.get("forms") or FORM.search(raw)):
        add("no_form_found", "Formulár sme na webe nenašli", "homepage + podstránky bez <form>")
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
