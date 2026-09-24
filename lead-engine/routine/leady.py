# -*- coding: utf-8 -*-
"""
Ranná rutina Lead Engine — zber firiem na telefonát (všetky segmenty).

  python3 leady.py --exclude vylucene.json --out kandidati.json \
      --engine https://lead-engine-seven-murex.vercel.app --key "$KEY"

Ktoré segmenty sa dnes zbierajú, určuje segmenty.json (active + per_day, rotácia podľa dátumu).
Zdroje: Google Maps (Places API, ak je GOOGLE_PLACES_KEY), Zlaté stránky (pomaly, náhodné strany), Bazoš.
Potom: vylúčenia (Gmail zoznam + všetko v Lead Engine), kontrola webu, register RPO.
Výstup: kandidáti zoradení od najslabšieho webu, s faktmi a zdrojmi pre call brief;
firmy s dobrým webom v `rejected` (pošlú sa ako vyradené, aby sa neopakovali).
"""
import argparse, datetime, gzip, html, json, os, random, re, socket, time, unicodedata, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

socket.setdefaulttimeout(12)
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36",
      "Accept-Language": "sk,cs;q=0.8", "Accept-Encoding": "gzip"}
HERE = os.path.dirname(os.path.abspath(__file__))

# id = kategória v Lead Engine. zs = kategórie Zlatých stránok, bazos = hľadané výrazy,
# match = čo musí byť v názve inzerátu, google = výrazy pre Google Maps.
VERTICALS = {
    "zahradnictvo": dict(zs=["zahradnictvo", "zahradne-centra", "kosenie", "zahradne-sluzby", "sadovnicke-upravy",
                             "okrasne-rastliny", "starostlivost-o-zelen", "ovocne-stromy"],
                         bazos=["záhradníctvo", "údržba záhrad", "záhradník", "kosenie záhrad", "realizácia záhrad"],
                         match=r"z[aá]hrad|kosen|tr[aá]vn|[zž]iv[yý]\w* plot|strom|tuj|z[aá]vlah|sadov",
                         google=["záhradníctvo", "záhradné centrum", "údržba záhrad"]),
    "stolarstvo": dict(zs=["stolarstvo"], bazos=["stolárstvo", "stolár", "kuchynské linky na mieru"],
                       match=r"stol[aá]r|n[aá]bytok|kuchyn|skrin", google=["stolárstvo", "nábytok na mieru"]),
    "kovovyroba": dict(zs=["kovovyroba", "zamocnictvo"], bazos=["zámočníctvo", "zváranie", "kovovýroba"],
                       match=r"z[aá]mo[cč]n|zv[aá]r|kovo|z[aá]bradl|nerez", google=["zámočníctvo", "kovovýroba"]),
    "brany-ploty": dict(zs=["brany-a-ploty"], bazos=["brány ploty", "oplotenie"],
                        match=r"br[aá]n|plot|oplot", google=["brány a ploty", "oplotenie"]),
    "murari": dict(zs=["murarske-prace"], bazos=["murárske práce", "murár"], match=r"mur[aá]r|omietk|rekon[sš]tr",
                   google=["murárske práce"]),
    "tesari": dict(zs=["tesarske-prace", "tesarstvo"], bazos=["tesárske práce", "tesár", "krovy"],
                   match=r"tes[aá]r|krov|pergol|drevostav", google=["tesárstvo", "krovy"]),
    "strechy": dict(zs=["strechy", "pokryvacske-prace", "pokryvacstvo", "klampiarstvo"],
                    bazos=["pokrývač", "strechy", "klampiar"], match=r"strech|pokr[yý]va|klampiar|odkvap",
                    google=["pokrývač", "strechy", "klampiarstvo"]),
    "vodoinstalater": dict(zs=["vodoinstalater"], bazos=["vodoinštalatér", "inštalatér", "kúrenie"],
                           match=r"in[sš]tal|vodo|k[uú]ren|kanaliz", google=["vodoinštalatér", "inštalatér"]),
    "elektrikar": dict(zs=["elektrikar", "elektroinstalacie"], bazos=["elektrikár", "elektroinštalácie"],
                       match=r"elektr", google=["elektrikár"]),
    "podlahy": dict(zs=["podlahy"], bazos=["podlahy", "podlahár", "plávajúce podlahy"],
                    match=r"podlah|parket|laminat|vinyl", google=["podlahy", "podlahárstvo"]),
    "obklady": dict(zs=["obklady", "dlazby"], bazos=["obkladač", "obklady dlažby"],
                    match=r"obklad|dla[zž]b", google=["obkladač", "obklady a dlažby"]),
    "kominarstvo": dict(zs=["kominarstvo"], bazos=["kominár", "kominárstvo"], match=r"komin",
                        google=["kominár"]),
}

# Mestá pre Google Maps (rotujú sa podľa dátumu, aby sa pokrylo celé Slovensko).
CITIES = ["Bratislava", "Trnava", "Nitra", "Trenčín", "Žilina", "Banská Bystrica", "Prešov", "Košice", "Senica",
          "Skalica", "Myjava", "Piešťany", "Hlohovec", "Galanta", "Dunajská Streda", "Senec", "Pezinok", "Malacky",
          "Topoľčany", "Nové Zámky", "Komárno", "Levice", "Šaľa", "Zlaté Moravce", "Prievidza", "Považská Bystrica",
          "Púchov", "Ilava", "Nové Mesto nad Váhom", "Martin", "Ružomberok", "Liptovský Mikuláš", "Dolný Kubín",
          "Čadca", "Námestovo", "Zvolen", "Žiar nad Hronom", "Lučenec", "Rimavská Sobota", "Brezno", "Poprad",
          "Kežmarok", "Spišská Nová Ves", "Bardejov", "Humenné", "Michalovce", "Vranov nad Topľou", "Trebišov",
          "Rožňava", "Stará Ľubovňa", "Svidník", "Levoča", "Detva", "Banská Štiavnica", "Partizánske", "Bánovce nad Bebravou"]


def active_verticals(override=None):
    if override:
        return [v for v in override.split(",") if v in VERTICALS]
    cfg = json.load(open(os.path.join(HERE, "segmenty.json"), encoding="utf-8"))
    act = [v for v in (list(VERTICALS) if cfg.get("active") == "all" else cfg.get("active", [])) if v in VERTICALS]
    n = max(1, int(cfg.get("per_day", len(act))))
    day = datetime.date.today().toordinal()
    return [act[(day * n + i) % len(act)] for i in range(min(n, len(act)))] if act else ["zahradnictvo"]
FREE = {"gmail.com", "seznam.cz", "email.cz", "centrum.cz", "centrum.sk", "volny.cz", "azet.sk", "post.sk",
        "zoznam.sk", "atlas.cz", "atlas.sk", "outlook.com", "hotmail.com", "hotmail.sk", "yahoo.com", "icloud.com",
        "googlemail.com", "orangemail.sk", "pobox.sk", "inmail.sk", "szm.sk", "post.cz", "stonline.sk", "chello.sk"}
NOT_OWN_WEB = re.compile(r"(zlatestranky|indexpodnikatela|facebook|instagram|google|youtube|wenetonline|finstat|"
                         r"orsr|firmy\.sk|azet\.sk|bazos|twitter|linkedin|tiktok|pinterest|waze|mapy\.cz)", re.I)
BUILDERS = ["webnode", "estranky", "wix.com", "wixsite", "mypage", "blogspot", "weebly", "jimdo", "szm.sk",
            "sweb.cz", "webgarden", "unas.", "websnadno", "webovastranka"]


def get(url, limit=1_500_000):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=15) as r:
        raw = r.read(limit)
        if r.headers.get("Content-Encoding") == "gzip":
            try:
                raw = gzip.decompress(raw)
            except Exception:
                pass
        return r.status, r.geturl(), decode(raw, r.headers.get("Content-Type", "")), dict(r.headers)


def decode(raw, ctype):
    """Staré slovenské weby bývajú vo windows-1250 / iso-8859-2."""
    m = re.search(r"charset=([\w-]+)", ctype, re.I) or re.search(rb'charset=["\']?([\w-]+)', raw[:4000], re.I)
    cs = (m.group(1).decode() if isinstance(m.group(1), bytes) else m.group(1)).lower() if m else None
    for enc in [cs, "utf-8", "cp1250"]:
        if not enc:
            continue
        try:
            return raw.decode({"windows-1250": "cp1250"}.get(enc, enc))
        except (LookupError, UnicodeDecodeError):
            continue
    return raw.decode("utf-8", "ignore")


def text(s):
    s = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", s or "", flags=re.S | re.I)
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s))).strip()


def bez(s):
    return "".join(c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn").lower()


def phone_key(p):
    d = re.sub(r"\D", "", p or "")
    if d.startswith("00421"):
        d = d[5:]
    elif d.startswith("421"):
        d = d[3:]
    return d.lstrip("0")[-9:]


def host(u):
    try:
        h = urllib.parse.urlparse(u if "://" in u else "https://" + u).hostname or ""
        return h.lower().removeprefix("www.")
    except Exception:
        return ""


# ─────────────── 1. Zlaté stránky ───────────────

def zs_page(arg):
    cat, p, vert = arg
    url = f"https://www.zlatestranky.sk/firmy/{cat}/" + ("" if p == 1 else f"q_/{p}/")
    try:
        _, _, d, _ = get(url)
    except Exception:
        return []
    out = []
    for b in d.split('<li class="results-list__item">')[1:]:
        nm = re.search(r'itemprop="name">\s*<a href="([^"]+)"[^>]*>\s*(?:<span[^>]*></span>)?([^<]{2,120})', b, re.S)
        if not nm:
            continue
        tel = re.search(r'<span class="phone-value">([^<]+)</span>', b) or re.search(r'href="tel:([^"]+)"', b)
        mail = re.search(r'mailto:([^"?]+)', b)
        loc = re.search(r'content="([^"]*)" itemprop="addressLocality"', b)
        street = re.search(r'itemprop="streetAddress"[^>]*>([^<]+)<', b) or re.search(r'content="([^"]*)" itemprop="streetAddress"', b)
        links = re.findall(r'<li class="link"><a href="(https?://[^"]+)"', b)
        ico = re.search(r"indexpodnikatela\.sk/(\d{6,8})", b)
        webs = []
        for w in links:
            if not NOT_OWN_WEB.search(w) and host(w) and host(w) not in [host(x) for x in webs]:
                webs.append(w)
        out.append(dict(
            name=text(nm.group(2)), profile="https://www.zlatestranky.sk" + nm.group(1), catalog_category=cat,
            vertical=vert, source="zlatestranky",
            city=html.unescape(loc.group(1)).strip() if loc else "",
            address=text(street.group(1)) if street else "",
            phone=(tel.group(1).strip() if tel else ""), email=(mail.group(1).strip().lower() if mail else ""),
            websites=webs[:2], ico=ico.group(1) if ico else ""))
    return out


def zs_pages(cat):
    try:
        _, _, d, _ = get(f"https://www.zlatestranky.sk/firmy/{cat}/")
        m = re.search(r"(\d[\d\s]*)\s+firiem", d)
        return max(1, min(60, (int(re.sub(r"\D", "", m.group(1))) + 19) // 20)) if m else 1
    except Exception:
        return 1


def collect(verts, pages_per_day):
    """Katalóg blokuje hromadné sťahovanie → každý deň iné náhodné strany, pomaly, po jednej."""
    rnd = random.Random("zs" + datetime.date.today().isoformat())
    jobs = []
    for v in verts:
        for c in VERTICALS[v]["zs"]:
            jobs += [(c, p, v) for p in range(1, zs_pages(c) + 1)]
            time.sleep(2)
    rnd.shuffle(jobs)
    rows = []
    for job in jobs[:pages_per_day]:
        for attempt in range(3):
            got = zs_page(job)
            if got:
                rows.extend(got)
                break
            time.sleep(5 * (attempt + 1))
        time.sleep(2)
    seen, uniq = set(), []
    for r in rows:
        k = phone_key(r["phone"]) or r["email"] or r["name"].lower()
        if k in seen:
            continue
        seen.add(k)
        uniq.append(r)
    return uniq


# ─────────────── 1b. Bazoš (živnostníci, často bez webu) ───────────────

JOB = re.compile(r"h[lľ]ad[aá]m|prijm|k[uú]pim|brig[aá]d|zamestn|pr[aá]cu", re.I)


def bazos(vert, limit=30):
    V = VERTICALS[vert]
    match = re.compile(V["match"], re.I)
    rows, seen = [], set()
    for q in V["bazos"]:
        for off in (0, 20):
            url = "https://sluzby.bazos.sk/" + (f"{off}/" if off else "") + "?hledat=" + urllib.parse.quote(q) + "&rubriky=sluzby"
            try:
                _, _, d, _ = get(url)
            except Exception:
                continue
            for m in re.finditer(r'<h2 class=nadpis><a href="([^"]+)">([^<]+)</a>', d):
                href, title = m.group(1), html.unescape(m.group(2)).strip()
                u = href if href.startswith("http") else "https://sluzby.bazos.sk" + href
                if u in seen or not match.search(title) or JOB.search(title):
                    continue
                seen.add(u)
                rows.append({"url": u, "title": title})
            time.sleep(1.5)
    out = []
    for r in rows[:limit]:
        try:
            _, _, d, _ = get(r["url"])
        except Exception:
            continue
        body = re.search(r"<div class=popisdetail>(.*?)</div>", d, re.S)
        t = text(body.group(1)) if body else ""
        tel = re.search(r"(?:\+421\s?|0)9\d{2}[\s/]?\d{3}[\s/]?\d{3}", t)
        mail = re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", t)
        loc = re.search(r"Lokalita: ([^.\"]{2,40})\.", d)
        name = re.search(r"(?:Meno|Jm.no):.{0,300}?class=\"paction\"[^>]*>([^<]{1,45})<", d, re.S)
        date = re.search(r"\[(\d{1,2}\.\d{1,2}\.\s?\d{4})\]", d)
        doms = [w for w in re.findall(r"\b(?:www\.)?[a-z0-9-]{4,}\.(?:sk|eu|com)\b", t.lower()) if "bazos" not in w]
        if not tel:
            continue
        out.append(dict(
            name=r["title"][:120], profile=r["url"], catalog_category="bazos", vertical=vert, source="bazos", city=(loc.group(1).strip() if loc else ""),
            address="", phone=tel.group(0), email=(mail.group(0).lower() if mail else ""),
            websites=["https://" + doms[0].removeprefix("www.")] if doms else [], ico="",
            contact=html.unescape(name.group(1)).strip() if name else "", ad_text=t[:700],
            ad_date=date.group(1).replace(" ", "") if date else ""))
        time.sleep(1)
    return out


# ─────────────── 1c. Google Maps (Places API) ───────────────

G_FIELDS = ("places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,"
            "places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,"
            "places.businessStatus,places.googleMapsUri,places.addressComponents")


def google_search(query, key):
    body = json.dumps({"textQuery": query, "languageCode": "sk", "regionCode": "SK", "pageSize": 20}).encode()
    req = urllib.request.Request("https://places.googleapis.com/v1/places:searchText", data=body, method="POST",
                                 headers={"Content-Type": "application/json", "X-Goog-Api-Key": key,
                                          "X-Goog-FieldMask": G_FIELDS})
    return json.loads(urllib.request.urlopen(req, timeout=20).read()).get("places", [])


def google(verts, key, queries_per_day):
    """Google Maps: telefón, web, hodnotenie a počet recenzií (výborná pochvala do hovoru)."""
    rnd = random.Random("g" + datetime.date.today().isoformat())
    jobs = [(v, q, c) for v in verts for q in VERTICALS[v]["google"] for c in CITIES]
    rnd.shuffle(jobs)
    out = []
    for v, q, c in jobs[:queries_per_day]:
        try:
            places = google_search(f"{q} {c}", key)
        except Exception as e:
            print(f"  Google chyba ({q} {c}): {e}")
            continue
        for p in places:
            if p.get("businessStatus") not in (None, "OPERATIONAL"):
                continue
            city = next((x.get("longText") for x in p.get("addressComponents", []) if "locality" in x.get("types", [])), c)
            out.append(dict(
                name=p.get("displayName", {}).get("text", ""), profile=p.get("googleMapsUri", ""), catalog_category="google",
                vertical=v, source="google", city=city, address=p.get("formattedAddress", ""),
                phone=p.get("internationalPhoneNumber") or p.get("nationalPhoneNumber") or "", email="",
                websites=[w for w in [p.get("websiteUri")] if w and not NOT_OWN_WEB.search(w)], ico="",
                google={"rating": p.get("rating"), "reviews": p.get("userRatingCount"), "maps_url": p.get("googleMapsUri"),
                        "website_on_google": p.get("websiteUri")}))
    return out


# ─────────────── 2. Vylúčenia ───────────────

def load_exclusions(path, engine, key):
    ex = {"emails": set(), "domains": set(), "phones": set(), "names": set()}
    if path:
        data = json.load(open(path, encoding="utf-8"))
        for m in data.get("emails", []):
            ex["emails"].add(m.lower().strip())
            dom = m.split("@")[-1].lower()
            if dom not in FREE:
                ex["domains"].add(dom)
        ex["domains"].update(d.lower().removeprefix("www.") for d in data.get("domains", []))
        ex["phones"].update(phone_key(p) for p in data.get("phones", []) if phone_key(p))
        ex["names"].update(bez(n) for n in data.get("names", []) if len(n) > 3)
    if engine and key:
        req = urllib.request.Request(engine.rstrip("/") + "/leady/api/v1/leads",
                                     headers={"Authorization": "Bearer " + key, "User-Agent": "lead-engine-routine"})
        with urllib.request.urlopen(req, timeout=30) as r:
            leads = json.loads(r.read().decode()).get("leads", [])
        for l in leads:
            c = l.get("company") or {}
            if c.get("email"):
                ex["emails"].add(c["email"].lower())
            if c.get("website"):
                ex["domains"].add(host(c["website"]))
            if c.get("phone"):
                ex["phones"].add(phone_key(c["phone"]))
            if c.get("name"):
                ex["names"].add(bez(c["name"]))
        print(f"  Lead Engine: {len(leads)} firiem už v systéme")
    return ex


def excluded(r, ex):
    if r["email"] and r["email"] in ex["emails"]:
        return "e-mail už oslovený / v systéme"
    if r["email"] and r["email"].split("@")[-1] in ex["domains"]:
        return "doména už oslovená / v systéme"
    for w in r["websites"]:
        if host(w) in ex["domains"]:
            return "web už oslovený / v systéme"
    if r["phone"] and phone_key(r["phone"]) in ex["phones"]:
        return "telefón už v systéme"
    n = bez(r["name"])
    for bad in ex["names"]:
        if bad and (bad == n or (len(bad) > 8 and bad in n)):
            return "meno na zozname vylúčených"
    return None


# ─────────────── 3. Web ───────────────

LEGAL = re.compile(r"\b(s\.?\s?r\.?\s?o\.?|spol|a\.?s\.?|ing|mgr|bc|z[aá]hradn[ií]ctvo|z[aá]hradn[eé]|centrum|slu[zž]by)\b", re.I)


def guess_domains(r):
    toks = [t for t in re.sub(r"[^a-z0-9 ]", " ", LEGAL.sub(" ", bez(r["name"]))).split() if len(t) > 2]
    base = set()
    if toks:
        base |= {toks[0], "".join(toks[:2]), "zahradnictvo" + toks[0], "zahradnictvo-" + toks[0]}
    if r["email"] and r["email"].split("@")[-1] in FREE:
        loc = re.sub(r"\d+$", "", r["email"].split("@")[0])
        base |= {re.sub(r"[^a-z0-9]", "", loc), re.sub(r"[^a-z0-9-]", "", loc.replace(".", "-"))}
    return sorted({b + ".sk" for b in base if 4 < len(b) < 30})


def site_matches(r, body):
    """Patrí nájdená stránka tejto firme? (meno alebo telefón na stránke)"""
    b = bez(text(body))
    toks = [t for t in re.sub(r"[^a-z0-9 ]", " ", LEGAL.sub(" ", bez(r["name"]))).split() if len(t) > 3]
    pk = phone_key(r["phone"])
    return (pk and pk[-6:] in re.sub(r"\D", "", b)) or (toks and all(t in b for t in toks[:2]))


def product_from(home_url, body):
    """Reálny produkt z e-shopu: názov + URL + cena (ak je)."""
    links = re.findall(r'href="([^"#]+)"', body)
    cand = [l for l in links if re.search(r"/(produkt|product|p|eshop|obchod|ponuka|rastlin|sortiment)[/-][^\"]{3,}", l, re.I)]
    for l in cand[:6]:
        u = urllib.parse.urljoin(home_url, l)
        if host(u) != host(home_url):
            continue
        try:
            _, fu, d, _ = get(u, 800_000)
        except Exception:
            continue
        h1 = re.search(r"<h1[^>]*>(.*?)</h1>", d, re.S | re.I)
        name = text(h1.group(1))[:120] if h1 else ""
        price = re.search(r"(\d{1,4}(?:[.,]\d{2})?)\s?(?:€|EUR|&euro;)", d)
        if name and 3 < len(name) < 120:
            return {"name": name, "url": fu, "price": (price.group(1) + " €") if price else None}
    return None


def resolves(h):
    """DNS cez HTTPS (v kontajneri nemusí fungovať bežné DNS). True / False (NXDOMAIN) / None (nevieme)."""
    for u in (f"https://dns.google/resolve?name={h}&type=A", f"https://cloudflare-dns.com/dns-query?name={h}&type=A"):
        try:
            req = urllib.request.Request(u, headers={"Accept": "application/dns-json", "User-Agent": "lead-engine"})
            d = json.loads(urllib.request.urlopen(req, timeout=10).read())
            if d.get("Status") == 3:
                return False
            if d.get("Status") == 0:
                return bool(d.get("Answer"))
        except Exception:
            continue
    return None


def fetch_site(url):
    body, fu, status = "", url, 0
    for u in (url, url.replace("https://", "http://"), url.replace("://", "://www.", 1) if "://www." not in url else url):
        try:
            status, fu, body, _ = get(u)
            return status, fu, body
        except urllib.error.HTTPError as e:
            status, fu = e.code, u
        except Exception:
            pass
        time.sleep(2)
    return status, fu, body


def assess(r):
    """Vráti fakty o webe. Každé zistenie má zdroj (URL + doslovný úryvok)."""
    webs = list(r["websites"])
    found_by_guess = False
    mail_dom = r["email"].split("@")[-1] if r["email"] else ""
    if mail_dom and mail_dom not in FREE and mail_dom not in [host(w) for w in webs] and resolves(mail_dom):
        _, fu, body = fetch_site("https://" + mail_dom)
        if len(body) > 900 and site_matches(r, body):
            webs.append(fu)
    if not webs:
        for d in guess_domains(r):
            if not resolves(d):
                continue
            _, fu, body = fetch_site("https://" + d)
            if len(body) > 900 and site_matches(r, body):
                webs.append(fu)
                found_by_guess = True
                break
    if not webs:
        return {"web": "none", "checked_domains": guess_domains(r), "issues": [], "score": 5,
                "note": "Skontrolované varianty domén (DNS + obsah) — žiadny vlastný web nenájdený."}

    url = webs[0] if "://" in webs[0] else "https://" + webs[0]
    status, fu, body = fetch_site(url)
    if not body:
        dns = resolves(host(url))
        if dns is False:
            return {"web": "broken", "url": url, "status": 0, "dns": False, "score": 7,
                    "issues": [{"key": "domain_dead", "text": f"Web {host(url)} uvedený v katalógu neexistuje (doména nemá DNS záznam)",
                                "excerpt": f"DNS {host(url)} → NXDOMAIN"}]}
        if status >= 400:
            return {"web": "broken", "url": url, "status": status, "dns": dns, "score": 6,
                    "issues": [{"key": "http_error", "text": f"Web {host(url)} vracia chybu {status}",
                                "excerpt": f"GET {url} → HTTP {status}"}]}
        return {"web": "unknown", "url": url, "status": status, "dns": dns, "score": 0, "issues": [],
                "note": "Web sa nepodarilo načítať (možno výpadok spojenia) — NIČ o ňom netvrď, over ručne."}
    headers = {}
    low = body.lower()
    issues = []

    def add(key, txt, excerpt, pts):
        issues.append({"key": key, "text": txt, "excerpt": excerpt[:200], "points": pts})

    if 'name="viewport"' not in low and "name='viewport'" not in low:
        add("no_viewport", "Stránka nie je prispôsobená mobilu (chýba viewport)", "<head> bez <meta name=\"viewport\">", 3)
    if fu.startswith("http://"):
        add("no_https", "Web beží bez https (prehliadač píše „Nezabezpečené“)", fu, 2)
    years = [int(y) for y in re.findall(r"(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(20\d\d)", low)]
    if years and max(years) <= datetime.date.today().year - 4:
        add("old_copyright", f"Pätička webu končí rokom {max(years)}", f"© {max(years)}", 2)
    b = next((x for x in BUILDERS if x in low or x in host(fu)), None)
    if b:
        add("builder", f"Web je na bezplatnom stavebnici ({b})", b, 2)
    if "tel:" not in low:
        add("no_tel_link", "Telefón sa na mobile nedá ťuknúť (chýba tel: odkaz)", "žiadny href=\"tel:\"", 1)
    pk = phone_key(r["phone"])
    if pk and pk[-6:] not in re.sub(r"\D", "", text(body)):
        add("phone_missing", "Na úvodnej stránke nie je ich telefón z katalógu", r["phone"], 1)
    jq = re.search(r"jquery[.-]?(1\.[0-8])\.", low)
    if jq:
        add("old_jquery", f"Web beží na starom jQuery {jq.group(1)}", jq.group(0), 1)
    if low.count("<table") > 3 and "<div" not in low[:5000]:
        add("tables", "Stránka je poskladaná z tabuliek (spred roka 2010)", "<table> layout", 1)
    if re.search(r"(stránka je vo výstavbe|pripravujeme|under construction|coming soon)", low):
        add("construction", "Na webe svieti „vo výstavbe / pripravujeme“", "vo výstavbe", 3)
    title = re.search(r"<title[^>]*>(.*?)</title>", body, re.S | re.I)
    eshop = bool(re.search(r"(do košíka|do kosika|pridať do košíka|woocommerce|shoptet|add-to-cart|/kosik|/cart)", low))
    product = product_from(fu, body) if eshop else None
    score = sum(i["points"] for i in issues)
    return {"web": "weak" if score >= 3 else "ok", "url": fu, "status": status, "title": text(title.group(1))[:120] if title else "",
            "eshop": eshop, "product": product, "found_by_guess": found_by_guess, "issues": issues, "score": score,
            "bytes": len(body)}


# ─────────────── 4. Register ───────────────

def rpo(ico):
    if not ico:
        return None
    try:
        _, _, d, _ = get(f"https://api.statistics.sk/rpo/v1/search?identifier={ico}")
        res = json.loads(d).get("results", [])
    except Exception:
        return None
    if not res:
        return {"found": False}
    x = res[0]
    names = [n.get("value", "") for n in x.get("fullNames", [])]
    muni = [a.get("municipality", {}).get("value", "") for a in x.get("addresses", [])]
    dead = bool(x.get("termination")) or any(re.search(r"likvid|konkurz", n, re.I) for n in names)
    return {"found": True, "ico": ico, "name": names[-1] if names else "", "all_names": names,
            "municipality": muni[-1] if muni else "", "established": x.get("establishment"),
            "terminated": x.get("termination"), "dead": dead,
            "url": f"https://www.registeruz.sk/cruz-public/domain/accountingentity/simplesearch?ico={ico}"}


# ─────────────── main ───────────────

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--exclude")
    ap.add_argument("--engine")
    ap.add_argument("--key")
    ap.add_argument("--out", default="kandidati.json")
    ap.add_argument("--check", type=int, default=70, help="koľko firiem dnes vyhodnotiť")
    ap.add_argument("--pages", type=int, default=8, help="koľko strán Zlatých stránok dnes (20 firiem/strana)")
    ap.add_argument("--google", type=int, default=12, help="koľko Google Maps vyhľadávaní dnes (20 firiem/vyhľadávanie)")
    ap.add_argument("--vertical", help="prepíše segmenty.json, napr. stolarstvo,strechy")
    a = ap.parse_args()

    verts = active_verticals(a.vertical)
    print(f"SEGMENTY DNES: {', '.join(verts)}")
    rows = []
    gkey = os.environ.get("GOOGLE_PLACES_KEY")
    if gkey:
        g = google(verts, gkey, a.google)
        print(f"  Google Maps: {len(g)} firiem")
        rows += g
    else:
        print("  Google Maps: vypnuté (chýba GOOGLE_PLACES_KEY)")
    z = collect(verts, a.pages)
    print(f"  Zlaté stránky: {len(z)} firiem" + ("  ← katalóg neodpovedá (blok?)" if len(z) < 20 else ""))
    rows += z
    for v in verts:
        bz = bazos(v, limit=max(15, 45 // len(verts)))
        print(f"  Bazoš ({v}): {len(bz)} inzerátov s telefónom")
        rows += bz
    seen, merged = set(), []
    for r in rows:
        k = phone_key(r["phone"]) or r["email"] or r["name"].lower()
        if k not in seen:
            seen.add(k)
            merged.append(r)
    rows = merged
    rows = [r for r in rows if phone_key(r["phone"]) and not re.sub(r"\D", "", r["phone"]).startswith(("420", "00420"))]
    print(f"  s telefónom: {len(rows)}")
    ex = load_exclusions(a.exclude, a.engine, a.key)
    fresh, skipped = [], {}
    for r in rows:
        why = excluded(r, ex)
        if why:
            skipped[why] = skipped.get(why, 0) + 1
        else:
            fresh.append(r)
    print(f"  po vylúčení: {len(fresh)}  ({', '.join(f'{k}: {v}' for k, v in skipped.items())})")

    random.Random(datetime.date.today().isoformat()).shuffle(fresh)
    batch = fresh[: a.check]
    with ThreadPoolExecutor(max_workers=12) as pool:
        webs = list(pool.map(assess, batch))
        regs = list(pool.map(lambda r: rpo(r["ico"]), batch))

    cands, rejected = [], []
    for r, w, g in zip(batch, webs, regs):
        r["web_check"], r["register"] = w, g
        if g and g.get("dead"):
            rejected.append({**r, "reason": "inactive", "why": "Register: zaniknutá / likvidácia"})
        elif g and g.get("found") is False:
            rejected.append({**r, "reason": "unverifiable", "why": "IČO sa v registri nenašlo"})
        elif w["web"] in ("ok", "unknown"):
            if w["web"] == "ok":
                rejected.append({**r, "reason": "quality_web", "why": f"Web {w.get('url')} je v poriadku (skóre {w['score']})"})
        else:
            cands.append(r)
    order = {"weak": 0, "broken": 1, "none": 2}
    cands.sort(key=lambda r: (order[r["web_check"]["web"]], -r["web_check"]["score"], not r["web_check"].get("product"),
                              -((r.get("google") or {}).get("reviews") or 0)))
    json.dump({"date": datetime.date.today().isoformat(), "candidates": cands, "rejected": rejected},
              open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    by = {k: sum(1 for r in cands if r["web_check"]["web"] == k) for k in order}
    print(f"VÝSLEDOK: {len(cands)} kandidátov (slabý web {by['weak']}, nefunkčný {by['broken']}, bez webu {by['none']}), "
          f"vyradených {len(rejected)} → {a.out}")
    for r in cands[:25]:
        w = r["web_check"]
        p = w.get("product")
        print(f"  [{w['web']:6} {w['score']:>2}] {r['vertical'][:11]:11} {r['name'][:36]:36} | {r['city'][:18]:18} | {r['phone']:14} | "
              + "; ".join(i["key"] for i in w.get("issues", [])) + (f" | produkt: {p['name'][:40]}" if p else ""))


if __name__ == "__main__":
    main()
