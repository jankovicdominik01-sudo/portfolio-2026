# -*- coding: utf-8 -*-
"""
Website hunting + fingerprint + ownership resolver + objektívne zdravie webu.

Web sa firme priradí iba s dôkazom. Výsledok kandidáta:
  confirmed  silný dôkaz (telefón / IČO / e-mail / explicitný odkaz social ↔ web) a žiadny konflikt
  probable   viac stredných signálov (názov + mesto, adresa) bez konfliktu
  uncertain  iba podobný názov
  rejected   konflikt (iné IČO, iný telefón a iné mesto, cudzia firma) — uloží sa, aby sa znova nepriradil
"""
import datetime
import html as H
import json
import re
import urllib.parse

from .normalize import (bez, has_word, digits, emails_in, email_domain, host, ico_norm, name_tokens, phone_e164, phones_in,
                        is_own_web_candidate, FREE_HOSTS)

SUBPAGE = re.compile(r"kontakt|contact|o-nas|o_nas|onas|about|impressum|o-mne|o-firme|firma|kde-nas", re.I)
PORTFOLIO = re.compile(r"realiz[aá]ci|galeri|portf[oó]li|projekt|referenc|na[sš]e pr[aá]ce|uk[aá]žky|fotogaleri|"
                       r"before|pred a po|pr[aá]ce|works|gallery", re.I)
CTA = re.compile(r"<form|href=\"tel:|href='tel:|mailto:|objedna|rezerv|nez[aá]v[aä]zn|dopyt|popt[aá]vk|cenov[aá] ponuk", re.I)
SOCIAL_LINK = re.compile(r"https?://(?:www\.|m\.)?(instagram\.com|facebook\.com|fb\.com)/([A-Za-z0-9_.\-%]+)(?:/([0-9]+))?", re.I)
SOCIAL_SKIP = {"sharer", "sharer.php", "share", "plugins", "tr", "dialog", "p", "reel", "explore", "watch", "groups",
               "events", "hashtag", "profile.php", "pages", "people", "business", "policies", "help", "login"}
ICO_RE = re.compile(r"I[ČC]O?\s*[:.]?\s*(\d[\d ]{5,10}\d)", re.I)
PSC_RE = re.compile(r"\b(\d{3}\s?\d{2})\s+([A-ZÁČĎÉÍĽĹŇÓÔŔŠŤÚÝŽ][\wáäčďéíľĺňóôŕšťúýžěřů .-]{2,40})")


def text(s):
    s = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", s or "", flags=re.S | re.I)
    return H.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s))).strip()


def social_links(body):
    out = []
    for m in SOCIAL_LINK.finditer(body or ""):
        plat = "instagram" if "instagram" in m.group(1).lower() else "facebook"
        h = urllib.parse.unquote(m.group(2)).strip(".").lower()
        if h in SOCIAL_SKIP or len(h) < 2:
            continue
        key = f"{plat}:{h}"
        if key not in out:
            out.append(key)
    return out


def jsonld(body):
    """schema.org Organization / LocalBusiness: name, telephone, email, address, url, sameAs."""
    out = []
    for m in re.finditer(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', body or "", re.S | re.I):
        try:
            d = json.loads(m.group(1).strip())
        except Exception:
            continue
        stack = d if isinstance(d, list) else [d]
        while stack:
            x = stack.pop()
            if isinstance(x, dict):
                if "@graph" in x:
                    stack += x["@graph"] if isinstance(x["@graph"], list) else [x["@graph"]]
                t = x.get("@type")
                t = " ".join(t) if isinstance(t, list) else str(t or "")
                if re.search(r"Organization|LocalBusiness|Store|Service|Professional|Contractor|Salon|Agent|Studio", t):
                    addr = x.get("address")
                    if isinstance(addr, dict):
                        addr = " ".join(str(addr.get(k, "")) for k in ("streetAddress", "postalCode", "addressLocality"))
                    same = x.get("sameAs") or []
                    out.append({"type": t, "name": x.get("name"), "telephone": x.get("telephone"), "email": x.get("email"),
                                "address": addr if isinstance(addr, str) else None, "url": x.get("url"),
                                "sameAs": same if isinstance(same, list) else [same],
                                "vatID": x.get("vatID"), "taxID": x.get("taxID")})
    return out


def parse_page(url, body, country=None):
    t = text(body)
    title = re.search(r"<title[^>]*>(.*?)</title>", body or "", re.S | re.I)
    meta = re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']{0,400})', body or "", re.I)
    h1 = re.findall(r"<h[12][^>]*>(.*?)</h[12]>", body or "", re.S | re.I)[:6]
    tel_links = [phone_e164(urllib.parse.unquote(x), country) for x in re.findall(r'href=["\']tel:([^"\']+)', body or "", re.I)]
    phones = [p for p in tel_links if p] + phones_in(t, country)
    mails = [urllib.parse.unquote(x).split("?")[0].lower() for x in re.findall(r'href=["\']mailto:([^"\']+)', body or "", re.I)]
    mails += emails_in(t)
    icos = []
    for m in ICO_RE.finditer(t):
        i = ico_norm(m.group(1), country)
        if i and i not in icos:
            icos.append(i)
    ld = jsonld(body)
    for x in ld:
        for p in [x.get("telephone")] if isinstance(x.get("telephone"), str) else (x.get("telephone") or []):
            e = phone_e164(p, country)
            if e:
                phones.append(e)
        if isinstance(x.get("email"), str):
            mails.append(x["email"].replace("mailto:", "").lower())
    socials = social_links(body)
    for x in ld:
        socials += [k for k in social_links(" ".join(str(s) for s in x.get("sameAs") or [])) if k not in socials]
    links = re.findall(r'href=["\']([^"\'#]+)["\'][^>]*>(.*?)</a>', body or "", re.S | re.I)
    return {
        "url": url, "title": text(title.group(1))[:160] if title else "", "meta": H.unescape(meta.group(1))[:300] if meta else "",
        "h": [text(x)[:120] for x in h1 if text(x)], "phones": list(dict.fromkeys(phones)), "emails": list(dict.fromkeys(mails)),
        "icos": icos, "addresses": [f"{a} {b}".strip() for a, b in PSC_RE.findall(t)][:4], "socials": socials,
        "schema": ld, "text": t[:6000], "digits": digits(t + " " + " ".join(tel_links and [p or "" for p in tel_links])),
        "portfolio": bool(PORTFOLIO.search(" ".join(u + " " + text(a) for u, a in links[:400]))),
        "cta": bool(CTA.search(body or "")), "links": [urllib.parse.urljoin(url, u) for u, _ in links[:400]],
        "forms": bool(re.search(r"<form\b", body or "", re.I)), "head": (body or "")[:60000],
    }


def fingerprint(url, net, country=None, max_subpages=2):
    """Homepage + max. 2 relevantné podstránky (kontakt / o nás). Necrawlujeme celý web."""
    from .net import Blocked
    try:
        r = net.get(url)
    except Blocked as b:
        return {"url": url, "error": f"blocked: {b}", "reachable": False}
    first_ssl = r.get("ssl_error")
    if not r.get("body"):
        # pred tvrdením „nefunguje“ skús varianty: http / https, s www aj bez (Švitko: https zlý certifikát, http funguje)
        u0 = urllib.parse.urlparse(url)
        h0 = u0.hostname or ""
        alt_hosts = [h0[4:]] if h0.startswith("www.") else ["www." + h0]
        for sch in ("https", "http"):
            for hh in [h0] + alt_hosts:
                v = f"{sch}://{hh}{u0.path or '/'}"
                if v.rstrip("/") == url.rstrip("/"):
                    continue
                try:
                    rv = net.get(v, retries=0)
                except Blocked:
                    continue
                if rv.get("body"):
                    r = dict(rv, ssl_error=first_ssl or rv.get("ssl_error"))
                    break
            if r.get("body"):
                break
    fp = {"requested": url, "final_url": r["url"], "status": r["status"], "chain": r.get("chain", [url]),
          "ssl_error": r.get("ssl_error"), "elapsed": r.get("elapsed"), "reachable": bool(r["body"]), "raw_len": len(r["body"])}
    if not r["body"]:
        return fp
    home = parse_page(r["url"], r["body"], country)
    fp["body_head"] = r["body"][:20000]
    pages = [home]
    base_host = host(r["url"])
    subs = []
    for link in home["links"]:
        if host(link) == base_host and SUBPAGE.search(urllib.parse.urlparse(link).path or "") and link not in subs:
            subs.append(link)
    for s in subs[:max_subpages]:
        try:
            rs = net.get(s, limit=800_000)
            if rs["body"]:
                pages.append(parse_page(rs["url"], rs["body"], country))
        except Exception:
            continue
    merged = {k: [] for k in ("phones", "emails", "icos", "addresses", "socials", "schema")}
    for p in pages:
        for k in merged:
            for v in p[k]:
                if v not in merged[k]:
                    merged[k].append(v)
    fp.update(merged)
    fp.update(title=home["title"], meta=home["meta"], h=home["h"], portfolio=any(p["portfolio"] for p in pages),
              cta=any(p["cta"] for p in pages), text=" ".join(p["text"] for p in pages)[:12000],
              digits="".join(p["digits"] for p in pages), pages=[p["url"] for p in pages],
              forms=any(p["forms"] for p in pages), raw_pages="\n".join(p.pop("head") for p in pages))
    return fp


# ─────────────── ownership ───────────────

def ownership(entity, fp, source):
    """Porovná fingerprint webu s entitou. → {verdict, confidence, evidence[], negative[]}"""
    ev, neg = [], []
    dom = host(fp.get("final_url") or fp.get("requested") or "")
    if not fp.get("reachable"):
        return {"verdict": "unreachable", "confidence": "low", "evidence": [], "negative": [fp.get("error") or "web sa nenačítal"]}
    ephones = [f["value"] for f in entity["phones"]]
    hit_phone = [p for p in ephones if p[-9:] in fp.get("digits", "") or p in fp.get("phones", [])]
    if hit_phone:
        ev.append(f"na webe je rovnaký telefón {hit_phone[0]}")
    eicos = [f["value"] for f in entity["company_ids"]]
    if eicos and fp.get("icos"):
        if set(eicos) & set(fp["icos"]):
            ev.append(f"na webe je rovnaké IČO {sorted(set(eicos) & set(fp['icos']))[0]}")
        else:
            neg.append(f"na webe je iné IČO ({', '.join(fp['icos'][:2])})")
    emails = [f["value"] for f in entity["emails"]]
    if any(m in fp.get("emails", []) for m in emails):
        ev.append("na webe je rovnaký e-mail")
    elif any(email_domain(m) == dom for m in emails):
        ev.append(f"e-mail firmy je na doméne {dom}")
    # explicitný odkaz social ↔ web
    ent_social = {(s["platform"] + ":" + (s.get("handle") or "").lower()) for s in entity["socials"] if s.get("handle")}
    if ent_social & set(fp.get("socials", [])):
        ev.append(f"web odkazuje na ich profil {sorted(ent_social & set(fp['socials']))[0]}")
    if any(host(s.get("website") or "") == dom for s in entity["socials"] if s.get("website")):
        ev.append(f"ich {next(s['platform'] for s in entity['socials'] if host(s.get('website') or '') == dom)} odkazuje na {dom}")
    if source in ("google_business",):
        ev.append("Google Business profil uvádza tento web")
    # stredné signály
    body = bez(fp.get("title", "") + " " + fp.get("meta", "") + " " + " ".join(fp.get("h", [])) + " " + fp.get("text", "")[:6000])
    names = entity["brand_names"] + ([entity["legal_name"]] if entity["legal_name"] else [])
    city_hit = bool(entity["city"]) and bez(entity["city"]) in body
    # značka celá, alebo výrazné slovo (≥6 znakov, napr. priezvisko) spolu s mestom
    name_hit = any((toks := name_tokens(n)) and (all(has_word(t, body) for t in toks[:3]) or
                                                 (city_hit and len(max(toks, key=len)) >= 6 and has_word(max(toks, key=len), body)))
                   for n in names)
    mids = []
    if name_hit:
        mids.append("názov firmy je na webe")
    if city_hit:
        mids.append(f"mesto {entity['city']} je na webe")
    addr_hit = any(bez(a["value"])[:18] in body for a in entity["addresses"] if len(a["value"]) > 10)
    if addr_hit:
        mids.append("rovnaká adresa")
    if ephones and fp.get("phones") and not hit_phone:
        neg.append(f"na webe je iný telefón ({fp['phones'][0]})")
    if entity["city"] and not city_hit and fp.get("addresses"):
        neg.append(f"web uvádza inú lokalitu ({fp['addresses'][0]})")
    strong = bool(ev) and not any("iné IČO" in n for n in neg)
    if any("iné IČO" in n for n in neg):
        verdict, conf = "rejected", "high"
    elif strong:
        verdict, conf = "confirmed", "high" if len(ev) >= 2 else "medium"
    elif len(mids) >= 2 and not any("inú lokalitu" in n for n in neg):
        # názov + mesto/adresa sedia; iný telefón na webe = konfliktný kontakt (uchováme oba), nie cudzia firma
        verdict, conf = "probable", "medium" if not neg else "low"
    elif neg and not ev:
        verdict, conf = "rejected", "medium"
    elif name_hit:
        verdict, conf = "uncertain", "low"
    else:
        verdict, conf = "rejected", "low"
        neg.append("na webe nie je názov, telefón, IČO ani e-mail firmy")
    return {"verdict": verdict, "confidence": conf, "evidence": ev + mids, "negative": neg, "name_hit": name_hit}


# ─────────────── zdravie webu (objektívne signály) ───────────────

DOWN_KEYS = {"parked", "db_error", "bad_cert", "foreign_redirect", "domain_dead", "http_error", "server_error", "unrelated_redirect"}


def health(fp, entity=None, category_portfolio=False, today=None):
    """Objektívne problémy webu. Subjektívne dojmy sa sem nepíšu (tie sú v `heuristics`)."""
    today = today or datetime.date.today()
    issues = []

    def add(key, txt, excerpt, pts):
        issues.append({"key": key, "text": txt, "excerpt": str(excerpt)[:200], "points": pts})

    dom = host(fp.get("requested") or "")
    if fp.get("dns") is False:
        add("domain_dead", f"Doména {dom} neexistuje (nemá DNS záznam)", f"DNS {dom} → NXDOMAIN", 8)
        return {"state": "broken", "issues": issues}
    if fp.get("ssl_error") and not fp.get("reachable"):
        add("bad_cert", f"Web {dom} má chybný certifikát — prehliadač ukáže varovanie", fp["ssl_error"], 7)
        return {"state": "broken", "issues": issues}
    st = fp.get("status") or 0
    if not fp.get("reachable"):
        if st in (404, 410):
            add("http_error", f"Web {dom} vracia chybu {st}", f"GET → HTTP {st}", 6)
            return {"state": "broken", "issues": issues}
        # 5xx môže byť dočasný výpadok → nič netvrdíme (overí recheck pred hovorom)
        return {"state": "unknown", "issues": [], "note": "Web sa nepodarilo načítať — nič o ňom netvrdíme."}
    low = (fp.get("body_head") or "").lower()
    t = bez(fp.get("text", ""))
    park = re.search(r"(na tejto domene zatial nic nie je|domena je na predaj|this domain is (for sale|parked)|domain (is )?parked|"
                     r"default web page|it works!|index of /|webhosting.*priprav|account suspended|hosting (expired|vyprsal)|"
                     r"tato domena je registrovana|domena je zaparkovana|stranka nebyla nalezena na serveru)", t)
    if park:
        add("parked", f"Na adrese {dom} nie je ich web — len predvolená stránka hostingu", park.group(0), 8)
        return {"state": "broken", "issues": issues}
    if re.search(r"(could not connect to (the )?database|error establishing a database connection|mysql_connect\(\)|too many connections)", low) \
            and len(t) < 2500:
        add("db_error", "Web namiesto obsahu ukazuje chybu databázy", t[:160], 8)
        return {"state": "broken", "issues": issues}
    chain = fp.get("chain") or []
    h0, h1 = host(fp.get("requested") or ""), host(fp.get("final_url") or "")
    if h0 and h1 and h0 != h1 and not h1.endswith("." + h0) and not h0.endswith("." + h1):
        if re.search(r"casino|kasino|bet|slot|viagra|loan|porn", h1 + " " + t[:500]) or (entity and ownership(entity, fp, "redirect")["verdict"] == "rejected"):
            add("unrelated_redirect", f"Adresa {h0} presmeruje na cudzí web {h1}", " → ".join(chain[-3:]), 7)
            return {"state": "broken", "issues": issues, "redirect": chain}
    if 'name="viewport"' not in low and "name='viewport'" not in low and "name=viewport" not in low:
        add("no_viewport", "Stránka nie je prispôsobená mobilu (chýba viewport)", "<head> bez <meta name=\"viewport\">", 3)
    if (fp.get("final_url") or "").startswith("http://"):
        add("no_https", "Web beží bez https (prehliadač píše „Nezabezpečené“)", fp.get("final_url"), 2)
    if fp.get("ssl_error"):
        add("bad_cert", "Zabezpečená verzia (https) má chybný certifikát", fp["ssl_error"], 3)
    years = [int(y) for y in re.findall(r"(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(20\d\d)", low)]
    if years and max(years) <= today.year - 4:
        add("old_copyright", f"Pätička webu končí rokom {max(years)}", f"© {max(years)}", 2)
    if "<frameset" in low:
        add("frames", "Web je poskladaný z rámov (frameset) — na mobile sa nedá používať", "<frameset>", 4)
    php = re.search(r"\b(warning|fatal error|deprecated|parse error)\s*:.{0,300}? on line \d+", t, re.S)
    if php:
        add("php_error", "Na stránke svieti chybová hláška z PHP", php.group(0), 4)
    if re.search(r"((stranka|web|stranky)\s+(je\s+)?vo vystavbe|stranku pripravujeme|novy web pripravujeme|under construction|"
                 r"coming soon|web se pripravuje|stranky jsou ve vystavbe)", t):
        add("construction", "Na webe svieti „vo výstavbe / pripravujeme“", "vo výstavbe", 3)
    if len(t) < 250:
        add("empty", "Úvodná stránka nemá takmer žiadny text", f"{len(t)} znakov textu", 2)
    if "href=\"tel:" not in low and "href='tel:" not in low:
        add("no_tel_link", "Telefón sa na mobile nedá ťuknúť (chýba tel: odkaz)", "žiadny href=\"tel:\"", 1)
    if not fp.get("cta"):
        add("no_cta", "Na webe nie je formulár ani jasná výzva na kontakt / objednávku", "bez <form>, tel:, mailto:", 2)
    if entity and entity["phones"] and not any(p["value"][-9:] in fp.get("digits", "") for p in entity["phones"]):
        add("phone_missing", "Na webe nie je ich aktuálny telefón", entity["phones"][0]["value"], 1)
    if category_portfolio and not fp.get("portfolio"):
        add("no_portfolio", "Web neukazuje realizácie / galériu prác", "žiadna sekcia realizácie / galéria / portfólio", 3)
    if (fp.get("elapsed") or 0) > 6:
        add("slow", f"Úvodná stránka sa načítala za {fp['elapsed']} s", f"{fp['elapsed']} s", 2)
    b = re.search(r"(webnode|estranky|wix\.com|wixsite|mypage|blogspot|weebly|jimdo|websnadno|webgarden)", low + " " + h1)
    if b:
        add("builder", f"Web je na bezplatnom stavebnici ({b.group(1)})", b.group(1), 2)
    jq = re.search(r"jquery[.-]?(1\.[0-8])\.", low)
    if jq:
        add("old_jquery", f"Web beží na starom jQuery {jq.group(1)}", jq.group(0), 1)
    score = sum(i["points"] for i in issues)
    visible = {"php_error", "frames", "construction", "empty"}
    state = "weak" if score >= 3 or any(i["key"] in visible for i in issues) else "working"
    return {"state": state, "issues": issues, "score": score}


def candidate_urls(entity):
    """Kandidáti na web zo všetkých zdrojov (katalóg, e-mail, IG/FB bio, schema, vyhľadávanie)."""
    out = []

    def add(url, src, why):
        if not url or not is_own_web_candidate(url):
            return
        u = url if "://" in url else "https://" + url
        d = host(u)
        if d in {r["domain"] for r in entity["rejected_websites"]}:
            return  # už odmietnutá doména sa znova nepriradí
        c = next((x for x in out if x["domain"] == d), None)
        if c:
            if src not in c["sources"]:
                c["sources"].append(src)
                c["evidence"].append(why)
        else:
            out.append({"url": u, "domain": d, "sources": [src], "evidence": [why]})

    for c in entity["website_candidates"]:
        add(c["url"], c["source"], "; ".join(c.get("evidence", [])) or c["source"])
    for f in entity["emails"]:
        d = email_domain(f["value"])
        if d:
            add("https://" + d, "email_domain", f"e-mail {f['value']}")
    for s in entity["socials"]:
        if s.get("website"):
            add(s["website"], f"{s['platform']}_bio", f"{s['platform']} profil {s.get('handle') or ''} odkazuje na web")
    g = entity.get("google") or {}
    if g.get("website_on_google"):
        add(g["website_on_google"], "google_business", "Google Business profil")
    return out
