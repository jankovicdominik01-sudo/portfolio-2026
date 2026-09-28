# -*- coding: utf-8 -*-
"""
Sieťová vrstva: cache, robots.txt, limit na host, exponenciálny backoff. Žiadne obchádzanie ochrán:
403/429/CAPTCHA/login = zdroj je nedostupný (source_unavailable), nie výzva skúsiť to inak.
"""
import gzip
import hashlib
import json
import os
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import urllib.robotparser

UA = "Mozilla/5.0 (compatible; DJWebyLeadRadar/1.0; +https://djweby.sk)"
HEADERS = {"User-Agent": UA, "Accept-Language": "sk,cs;q=0.8,en;q=0.5", "Accept-Encoding": "gzip"}
BLOCK_MARKERS = re.compile(r"captcha|are you a robot|unusual traffic|just a moment\.\.\.|cf-chl|enable javascript and cookies|"
                           r"access denied|bot detection", re.I)
# Tieto služby automatizovaný zber zakazujú (robots.txt / podmienky) — nikdy ich priamo nesťahujeme.
NEVER_FETCH = re.compile(r"(^|\.)(instagram\.com|facebook\.com|fb\.com|threads\.net|tiktok\.com|linkedin\.com|"
                         r"search\.seznam\.cz|firmy\.cz|google\.[a-z.]+|bing\.com|duckduckgo\.com)$")


class Blocked(Exception):
    """Zdroj odmietol automatický prístup (robots, 403, 429, CAPTCHA). Neobchádzame."""


class Net:
    def __init__(self, cache_dir=None, ttl_days=14, per_host_delay=1.0, respect_robots=True):
        self.cache_dir = cache_dir
        self.ttl = ttl_days * 86400
        self.delay = per_host_delay
        self.respect_robots = respect_robots
        self._last = {}
        self._robots = {}
        self._lock = threading.Lock()
        self.stats = {"requests": 0, "cache_hits": 0, "blocked": 0, "errors": 0}
        if cache_dir:
            os.makedirs(cache_dir, exist_ok=True)

    # ── cache ──
    def _ck(self, url):
        return os.path.join(self.cache_dir, hashlib.sha1(url.encode()).hexdigest() + ".json") if self.cache_dir else None

    def _cached(self, url):
        p = self._ck(url)
        if p and os.path.exists(p) and time.time() - os.path.getmtime(p) < self.ttl:
            try:
                return json.load(open(p, encoding="utf-8"))
            except Exception:
                return None
        return None

    def _store(self, url, res):
        p = self._ck(url)
        if p:
            json.dump(res, open(p, "w", encoding="utf-8"), ensure_ascii=False)

    # ── robots ──
    def allowed(self, url):
        h = urllib.parse.urlparse(url).hostname or ""
        if NEVER_FETCH.search(h):
            return False
        if not self.respect_robots:
            return True
        base = f"{urllib.parse.urlparse(url).scheme}://{h}"
        with self._lock:
            rp = self._robots.get(base)
        if rp is None:
            rp = urllib.robotparser.RobotFileParser()
            try:
                req = urllib.request.Request(base + "/robots.txt", headers=HEADERS)
                with urllib.request.urlopen(req, timeout=8) as r:
                    raw = r.read(300_000)
                    if r.headers.get("Content-Encoding") == "gzip":
                        raw = gzip.decompress(raw)
                    rp.parse(raw.decode("utf-8", "ignore").splitlines())
            except Exception:
                rp.parse([])  # robots.txt chýba / nedostupný → povolené
            with self._lock:
                self._robots[base] = rp
        return rp.can_fetch(UA, url)

    def _pace(self, h):
        with self._lock:
            wait = self._last.get(h, 0) + self.delay - time.time()
            self._last[h] = max(time.time(), self._last.get(h, 0) + self.delay)
        if wait > 0:
            time.sleep(wait)

    def get(self, url, limit=1_500_000, retries=2, timeout=15):
        """{status, url (finálna), body, chain[], ssl_error, elapsed} alebo Blocked."""
        c = self._cached(url)
        if c is not None:
            self.stats["cache_hits"] += 1
            if c.get("blocked"):
                raise Blocked(c["blocked"])
            return c
        if not self.allowed(url):
            self.stats["blocked"] += 1
            raise Blocked("robots.txt / podmienky zakazujú automatický prístup")
        h = urllib.parse.urlparse(url).hostname or ""
        res = {"status": 0, "url": url, "body": "", "chain": [url], "ssl_error": None, "elapsed": None}
        for attempt in range(retries + 1):
            self._pace(h)
            self.stats["requests"] += 1
            t0 = time.time()
            try:
                opener = urllib.request.build_opener(_Chain(res["chain"]))
                with opener.open(urllib.request.Request(url, headers=HEADERS), timeout=timeout) as r:
                    raw = r.read(limit)
                    if r.headers.get("Content-Encoding") == "gzip":
                        try:
                            raw = gzip.decompress(raw)
                        except Exception:
                            pass
                    res.update(status=r.status, url=r.geturl(), body=decode(raw, r.headers.get("Content-Type", "")),
                               elapsed=round(time.time() - t0, 2))
                    if BLOCK_MARKERS.search(res["body"][:5000]) and len(res["body"]) < 30000:
                        res["blocked"] = "bot ochrana (CAPTCHA / JS challenge)"
                    break
            except urllib.error.HTTPError as e:
                res.update(status=e.code, url=e.geturl() or url, elapsed=round(time.time() - t0, 2))
                if e.code in (403, 429):
                    res["blocked"] = f"HTTP {e.code}"
                    break
                if e.code < 500:
                    break
            except urllib.error.URLError as e:
                reason = str(e.reason)
                if "CERTIFICATE_VERIFY_FAILED" in reason or "certificate" in reason.lower():
                    res["ssl_error"] = reason[:160]
                    break
                res["error"] = reason[:160]
            except Exception as e:  # timeout, reset
                res["error"] = str(e)[:160]
            time.sleep(2 ** (attempt + 1))  # exponenciálny backoff
        if res.get("blocked"):
            self.stats["blocked"] += 1
        if res.get("error") and not res["body"]:
            self.stats["errors"] += 1
        self._store(url, res)
        if res.get("blocked"):
            raise Blocked(res["blocked"])
        return res


class _Chain(urllib.request.HTTPRedirectHandler):
    def __init__(self, chain):
        self.chain = chain

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        self.chain.append(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def decode(raw, ctype):
    m = re.search(r"charset=([\w-]+)", ctype or "", re.I) or re.search(rb'charset=["\']?([\w-]+)', raw[:4000], re.I)
    cs = (m.group(1).decode() if isinstance(m.group(1), bytes) else m.group(1)).lower() if m else None
    for enc in [cs, "utf-8", "cp1250"]:
        if not enc:
            continue
        try:
            return raw.decode({"windows-1250": "cp1250"}.get(enc, enc))
        except (LookupError, UnicodeDecodeError):
            continue
    return raw.decode("utf-8", "ignore")


def resolves(h):
    """DNS cez HTTPS. True / False (NXDOMAIN) / None (nevieme)."""
    for u in (f"https://dns.google/resolve?name={h}&type=A", f"https://cloudflare-dns.com/dns-query?name={h}&type=A"):
        try:
            req = urllib.request.Request(u, headers={"Accept": "application/dns-json", "User-Agent": "lead-radar"})
            d = json.loads(urllib.request.urlopen(req, timeout=10).read())
            if d.get("Status") == 3:
                return False
            if d.get("Status") == 0:
                return bool(d.get("Answer"))
        except Exception:
            continue
    return None
