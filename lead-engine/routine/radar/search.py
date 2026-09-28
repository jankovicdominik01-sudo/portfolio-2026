# -*- coding: utf-8 -*-
"""
Search provider abstrakcia: search_web(query), search_business(query), search_social(query, platform).

Provideri (pipeline nie je viazaný na jeden):
  agent        výsledky WebSearch nástroja rannej rutiny (legitímne API vyhľadávanie). Pipeline zapíše
               požiadavky do search_requests.json, agent ich vyhľadá a uloží do search_results.json.
  brave        Brave Search API (env BRAVE_SEARCH_KEY)
  google_cse   Google Programmable Search (env GOOGLE_CSE_KEY + GOOGLE_CSE_CX)
  places       Google Places API (env GOOGLE_PLACES_KEY) — firmy s telefónom a webom
Scraping HTML vyhľadávačov (Google, Bing, Seznam, DDG…) NEPOUŽÍVAME: robots.txt ho zakazuje a/alebo vracajú CAPTCHA.
"""
import datetime
import json
import os
import urllib.parse
import urllib.request

OK, DEGRADED, UNAVAILABLE, NOT_CONFIGURED = "ok", "degraded", "unavailable", "not_configured"


class Provider:
    name = "base"
    kinds = ("web",)

    def configured(self):
        return False

    def search(self, query, kind="web"):
        raise NotImplementedError


class AgentProvider(Provider):
    """Výsledky, ktoré rutina získala nástrojom WebSearch. Chýbajúci dopyt = čaká na agenta (pending)."""
    name = "agent"
    kinds = ("web", "social", "business")

    def __init__(self, results_path=None):
        self.results = {}
        if results_path and os.path.exists(results_path):
            raw = json.load(open(results_path, encoding="utf-8"))
            self.results = {k.strip().lower(): v for k, v in (raw.get("results", raw)).items()}

    def configured(self):
        return True

    def search(self, query, kind="web"):
        r = self.results.get(query.strip().lower())
        if r is None:
            return None  # pending
        return [{"title": x.get("title", ""), "url": x.get("url", ""), "snippet": x.get("snippet", ""), "provider": "agent"} for x in r]


class BraveProvider(Provider):
    name = "brave"

    def __init__(self):
        self.key = os.environ.get("BRAVE_SEARCH_KEY")

    def configured(self):
        return bool(self.key)

    def search(self, query, kind="web"):
        q = urllib.parse.urlencode({"q": query, "count": 10, "country": "SK", "search_lang": "sk"})
        req = urllib.request.Request(f"https://api.search.brave.com/res/v1/web/search?{q}",
                                     headers={"Accept": "application/json", "X-Subscription-Token": self.key})
        d = json.loads(urllib.request.urlopen(req, timeout=20).read())
        return [{"title": x.get("title", ""), "url": x.get("url", ""), "snippet": x.get("description", ""), "provider": "brave"}
                for x in d.get("web", {}).get("results", [])]


class GoogleCSEProvider(Provider):
    name = "google_cse"

    def __init__(self):
        self.key, self.cx = os.environ.get("GOOGLE_CSE_KEY"), os.environ.get("GOOGLE_CSE_CX")

    def configured(self):
        return bool(self.key and self.cx)

    def search(self, query, kind="web"):
        q = urllib.parse.urlencode({"key": self.key, "cx": self.cx, "q": query, "num": 10})
        d = json.loads(urllib.request.urlopen(f"https://www.googleapis.com/customsearch/v1?{q}", timeout=20).read())
        return [{"title": x.get("title", ""), "url": x.get("link", ""), "snippet": x.get("snippet", ""), "provider": "google_cse"}
                for x in d.get("items", [])]


class Search:
    """Fasáda: cache (nerobí rovnaký dopyt 2×), rozpočet na firmu, pamäť dopytov (yield), zdravie providerov."""

    def __init__(self, providers, cache_path=None, memory_path=None):
        self.providers = [p for p in providers if p.configured()]
        self.all = providers
        self.cache_path = cache_path
        self.cache = json.load(open(cache_path, encoding="utf-8")) if cache_path and os.path.exists(cache_path) else {}
        self.memory_path = memory_path
        self.memory = json.load(open(memory_path, encoding="utf-8")) if memory_path and os.path.exists(memory_path) else []
        self.pending = []  # dopyty pre agenta
        self.health = {p.name: (OK if p.configured() else NOT_CONFIGURED) for p in providers}
        self.spent = {}

    def run(self, query, kind="web", entity_id=None, budget=None, meta=None):
        """Výsledky alebo None (čaká na agenta / mimo rozpočtu)."""
        key = query.strip().lower()
        if key in self.cache:
            return self.cache[key]["results"]
        if entity_id and budget is not None and self.spent.get(entity_id, 0) >= budget:
            return None
        for p in self.providers:
            if kind not in p.kinds and p.name != "agent":
                continue
            try:
                res = p.search(query, kind)
            except Exception as e:
                self.health[p.name] = DEGRADED
                continue
            if res is None:
                continue
            self.cache[key] = {"results": res, "provider": p.name, "at": datetime.datetime.now().isoformat(timespec="seconds")}
            if entity_id:
                self.spent[entity_id] = self.spent.get(entity_id, 0) + 1
            self.memory.append({"query": query, "kind": kind, "provider": p.name, "executed_at": self.cache[key]["at"],
                                "results_found": len(res), **(meta or {})})
            return res
        if not any(x["query"] == query for x in self.pending):
            self.pending.append({"query": query, "kind": kind, "entity_id": entity_id, **(meta or {})})
            if entity_id:
                self.spent[entity_id] = self.spent.get(entity_id, 0) + 1
        return None

    def record_yield(self, query, new_businesses=0, verified=0):
        for m in reversed(self.memory):
            if m["query"] == query:
                m["new_businesses_found"] = m.get("new_businesses_found", 0) + new_businesses
                m["verified_leads_found"] = m.get("verified_leads_found", 0) + verified
                return

    def save(self):
        if self.cache_path:
            json.dump(self.cache, open(self.cache_path, "w", encoding="utf-8"), ensure_ascii=False)
        if self.memory_path:
            json.dump(self.memory[-5000:], open(self.memory_path, "w", encoding="utf-8"), ensure_ascii=False, indent=0)

    def already_ran(self, query, days=21):
        """Locality engine: tento discovery dopyt sme nedávno robili → neopakovať každý deň."""
        cut = (datetime.datetime.now() - datetime.timedelta(days=days)).isoformat()
        return any(m["query"].lower() == query.lower() and m.get("executed_at", "") >= cut for m in self.memory)


def yield_report(memory):
    """Ktoré discovery stratégie (zdroj × kategória × lokalita) dávajú overené leady."""
    agg = {}
    for m in memory:
        if m.get("purpose") != "discovery":
            continue
        k = (m.get("strategy") or m.get("provider"), m.get("category"), m.get("country"))
        a = agg.setdefault(k, {"strategy": k[0], "category": k[1], "country": k[2], "queries": 0, "results": 0,
                               "new_businesses": 0, "verified": 0})
        a["queries"] += 1
        a["results"] += m.get("results_found", 0)
        a["new_businesses"] += m.get("new_businesses_found", 0)
        a["verified"] += m.get("verified_leads_found", 0)
    return sorted(agg.values(), key=lambda a: -a["verified"])
