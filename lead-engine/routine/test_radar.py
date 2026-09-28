# -*- coding: utf-8 -*-
"""Regresné testy Lead Radaru (offline — sieť aj vyhľadávanie sú nahradené fixtures).

    python3 -m unittest discover -s lead-engine/routine -p "test_*.py"

Firmy v testoch sú vymyslené (Novák, Studio Bella…) — žiadne osobné údaje reálnych ľudí.
"""
import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(__file__))
from radar import normalize as N  # noqa: E402
from radar import pipeline as P  # noqa: E402
from radar.entity import from_record, resolve  # noqa: E402
from radar.net import Blocked  # noqa: E402
from radar.search import AgentProvider, Search  # noqa: E402
from radar import classify as C  # noqa: E402
from radar import quality as Q  # noqa: E402


class FakeNet:
    def __init__(self, pages):
        self.pages = pages
        self.stats = {}

    def get(self, url, limit=0, **kw):
        u = url.rstrip("/")
        for k, v in self.pages.items():
            if k.rstrip("/") == u:
                if v == "BLOCKED":
                    raise Blocked("test")
                body = v if isinstance(v, str) else v["body"]
                final = url if isinstance(v, str) else v.get("final", url)
                return {"status": 200, "url": final, "body": body, "chain": [url, final] if final != url else [url], "ssl_error": None, "elapsed": 0.3}
        return {"status": 0, "url": url, "body": "", "chain": [url], "ssl_error": None, "error": "offline"}


class FakeAgent(AgentProvider):
    def __init__(self, results):
        self.results = {k.lower(): v for k, v in results.items()}


def site(title, phone="", ico="", email="", city="", extra="", socials=(), viewport=True, portfolio=False):
    soc = "".join(f'<a href="https://www.instagram.com/{s}/">IG</a>' for s in socials)
    return (f"<html><head><title>{title}</title>" + ('<meta name="viewport" content="width=device-width">' if viewport else "")
            + f"</head><body><h1>{title}</h1><p>{extra}</p>" + (f'<a href="tel:{phone}">{phone}</a>' if phone else "")
            + (f"<p>IČO: {ico}</p>" if ico else "") + (f'<a href="mailto:{email}">{email}</a>' if email else "")
            + (f"<p>Adresa: Hlavná 1, 905 01 {city}</p>" if city else "") + soc
            + ('<a href="/realizacie">Realizácie</a>' if portfolio else "") + "<footer>© 2026</footer>"
            + "x " * 200 + "</body></html>")


def radar(pages, results, **kw):
    s = Search([FakeAgent(results)])
    return P.Radar(FakeNet(pages), s, log=lambda *a: None, **kw)


def run(records, pages=None, results=None, **kw):
    r = radar(pages or {}, results or {}, **kw)
    with mock.patch.object(P, "resolves", side_effect=lambda h: False if "dead" in h else True), \
            mock.patch.object(P, "register_for", return_value=None):
        return r.run(records)


def rec(**kw):
    base = dict(name="Firma", source="azet", country="SK", city="Senica", phone="0905 111 222", websites=[], profile="https://www.azet.sk/firma/1/")
    base.update(kw)
    return base


class Normalize(unittest.TestCase):
    def test_sk_phone_formats(self):
        for raw in ("0905 123 456", "0905123456", "+421905123456", "00421905123456", "+421 (0)905 123 456"):
            self.assertEqual(N.phone_e164(raw, "SK"), "+421905123456", raw)

    def test_cz_phone(self):
        self.assertEqual(N.phone_e164("606 122 925", "CZ"), "+420606122925")
        self.assertEqual(N.phone_e164("+420 606 122 925"), "+420606122925")

    def test_free_email_is_not_website(self):
        self.assertIsNone(N.email_domain("novak@gmail.com"))
        self.assertIsNone(N.email_domain("x@seznam.cz"))
        self.assertEqual(N.email_domain("info@novakinterier.sk"), "novakinterier.sk")

    def test_cz_ico_checksum(self):
        self.assertTrue(N.cz_ico_valid("00006947"))
        self.assertFalse(N.cz_ico_valid("00006948"))


class WebsiteResolution(unittest.TestCase):
    """Spec 40 A–E, 66, 68, 73."""

    def test_A_hidden_website_found_by_phone_search(self):
        pages = {"https://different-domain.sk": site("Stolárstvo Novák", phone="0905 111 222", extra="výroba nábytku na mieru, kuchyne na mieru")}
        results = {'"0905 111 222"': [{"title": "Stolárstvo Novák – nábytok na mieru", "url": "https://different-domain.sk/", "snippet": "tel. 0905 111 222"}]}
        e = run([rec(name="Stolárstvo Novák")], pages, results)[0]
        self.assertEqual(e["website_resolution"], "confirmed")
        self.assertEqual(e["website"]["domain"], "different-domain.sk")
        self.assertNotIn(e["website_resolution"], ("no_website_found",))

    def test_B_instagram_bio_domain_with_same_phone(self):
        pages = {"https://novakinterier.sk": site("Novák Interiér", phone="+421 905 111 222", extra="nábytok na mieru")}
        results = {'site:instagram.com "Novák Interiér"': [{"title": "Novák Interiér (@novak_interiery) • Instagram photos and videos",
                                                              "url": "https://www.instagram.com/novak_interiery/",
                                                              "snippet": "Nábytok na mieru · Senica · novakinterier.sk · 0905 111 222"}]}
        e = run([rec(name="Novák Interiér")], pages, results)[0]
        self.assertEqual(e["website_resolution"], "confirmed")
        self.assertEqual(e["website"]["domain"], "novakinterier.sk")
        ig = [s for s in e["socials"] if s["platform"] == "instagram"][0]
        self.assertEqual(ig["match"], "confirmed")

    def test_C_similar_name_other_phone_and_city_is_not_assigned(self):
        pages = {"https://novakstavby.sk": site("Novák stavby", phone="0911 999 888", ico="99999999", city="Košice")}
        results = {'"Novák" Senica': [{"title": "Novák stavby Košice", "url": "https://novakstavby.sk/", "snippet": "Novák"}]}
        e = run([rec(name="Novák", ico="12345678")], pages, results)[0]
        self.assertNotEqual(e["website_resolution"], "confirmed")
        self.assertIn("novakstavby.sk", [r["domain"] for r in e["rejected_websites"]])

    def test_D_social_first_no_website_found(self):
        results = {
            '"0905 111 222"': [], '"Drevo Novák" Senica': [],
            'site:instagram.com "Drevo Novák"': [{"title": "Drevo Novák (@drevo.novak) · Senica", "url": "https://www.instagram.com/drevo.novak/",
                                                  "snippet": "Stolár · nábytok na mieru · 0905 111 222"}],
            'site:facebook.com "Drevo Novák" Senica': [{"title": "Drevo Novák | Senica | Facebook", "url": "https://www.facebook.com/drevonovak/",
                                                        "snippet": "Stolárstvo, kuchyne na mieru. Tel 0905 111 222"}],
        }
        e = run([rec(name="Drevo Novák", description="stolárstvo, nábytok na mieru")], {}, results)[0]
        self.assertEqual(e["website_resolution"], "no_website_found")
        self.assertIn("SOCIAL_FIRST_BUSINESS", [p["code"] for p in e["commercial_problems"]])
        self.assertTrue(e["social_first"])

    def test_E_old_dead_domain_new_from_instagram(self):
        pages = {"https://newbrand.sk": site("New Brand kuchyne", phone="0905 111 222", extra="kuchyne na mieru")}
        results = {'site:instagram.com "Kuchyne Novák"': [{"title": "Kuchyne Novák (@newbrand) • Instagram", "url": "https://www.instagram.com/newbrand/",
                                                           "snippet": "kuchyne na mieru newbrand.sk"}]}
        e = run([rec(name="Kuchyne Novák", websites=["http://olddead-firma.sk"])], pages, results)[0]
        self.assertEqual(e["website"]["domain"], "newbrand.sk")
        self.assertIn("olddead-firma.sk", [h["domain"] for h in e["historical_websites"]])

    def test_68_false_domain_rejected(self):
        pages = {"https://novakstavby.sk": site("Novák stavby", phone="0911 999 888", ico="99999999")}
        results = {'"Novák Design" Senica': [{"title": "Novák stavby", "url": "https://novakstavby.sk/", "snippet": "Novák Design stavby"}]}
        e = run([rec(name="Novák Design", ico="12345678")], pages, results)[0]
        self.assertIn("novakstavby.sk", [r["domain"] for r in e["rejected_websites"]])
        self.assertIsNone(e["website"]["domain"])

    def test_rejected_domain_is_never_reassigned(self):
        e = from_record(rec(name="X"))
        e["rejected_websites"].append({"domain": "zla.sk", "why": "iné IČO"})
        e["website_candidates"].append({"url": "https://zla.sk", "domain": "zla.sk", "source": "search"})
        from radar.website import candidate_urls
        self.assertEqual(candidate_urls(e), [])

    def test_confirmed_website_caller_never_gets_no_web(self):
        pages = {"https://novak.sk": site("Novák", phone="0905 111 222", viewport=False)}
        e = run([rec(name="Novák", websites=["https://novak.sk"])], pages, {})[0]
        self.assertEqual(e["website_resolution"], "confirmed")
        self.assertNotIn("NO_WEBSITE_FOUND", [p["code"] for p in e["commercial_problems"]])
        self.assertNotIn("SOCIAL_FIRST_BUSINESS", [p["code"] for p in e["commercial_problems"]])

    def test_not_searched_is_uncertain_not_no_website(self):
        e = run([rec(name="Novák")], {}, {})[0]  # agent ešte nevyhľadal nič
        self.assertEqual(e["website_resolution"], "uncertain")


class Identity(unittest.TestCase):
    """Spec 41, 67, 72."""

    def test_four_sources_one_business(self):
        rows = [rec(source="azet", name="Studio Bella", phone="0905 111 222", ico="12345678"),
                rec(source="google_business", name="Bella štúdio", phone="+421905111222", websites=["https://bella.sk"]),
                rec(source="search:instagram", name="bella.studio", phone="", socials=[{"platform": "instagram", "handle": "bella.studio", "website": "https://bella.sk"}]),
                rec(source="search:facebook", name="Studio Bella Senica", phone="0905111222")]
        self.assertEqual(len(resolve([from_record(r) for r in rows])), 1)

    def test_same_name_different_ico_two_leads(self):
        rows = [rec(name="Studio Bella", ico="12345678", phone="0905 111 222"), rec(name="Studio Bella", ico="87654321", phone="0905 999 888")]
        self.assertEqual(len(resolve([from_record(r) for r in rows])), 2)

    def test_same_name_sk_and_cz_two_leads(self):
        rows = [rec(name="Studio Bella", country="SK", city="Bratislava", phone="0905 111 222"),
                rec(name="Studio Bella", country="CZ", city="Brno", phone="606 122 925")]
        self.assertEqual(len(resolve([from_record(r) for r in rows])), 2)

    def test_same_name_other_city_never_merges(self):
        rows = [rec(name="Studio Bella", city="Bratislava", phone="0905 111 222"), rec(name="Studio Bella", city="Brno", phone="0905 999 888")]
        out = resolve([from_record(r) for r in rows])
        self.assertEqual(len(out), 2)
        self.assertEqual(out[0]["possible_duplicates"], [])

    def test_same_name_same_city_is_only_possible_duplicate(self):
        rows = [rec(name="Studio Bella", phone="0905 111 222"), rec(name="Studio Bella", phone="0905 999 888")]
        out = resolve([from_record(r) for r in rows])
        self.assertEqual(len(out), 2)
        self.assertTrue(out[0]["possible_duplicates"])

    def test_different_ico_blocks_even_same_phone(self):
        rows = [rec(name="A", ico="12345678"), rec(name="B", ico="87654321")]  # rovnaký telefón z rec()
        self.assertEqual(len(resolve([from_record(r) for r in rows])), 2)

    def test_67_brand_alias(self):
        pages = {"https://kuchynenovak.sk": site("Kuchyne Novák", phone="0905 111 222", extra="kuchyne na mieru", socials=["interierynovak"])}
        rows = [rec(source="register", name="NOVAK DESIGN s.r.o.", ico="12345678", phone=""),
                rec(source="search:instagram", name="Interiéry Novák", phone="0905 111 222",
                    socials=[{"platform": "instagram", "handle": "interierynovak", "url": "https://www.instagram.com/interierynovak/"}]),
                rec(source="google_business", name="Kuchyne Novák", phone="0905111222", websites=["https://kuchynenovak.sk"], ico="12345678")]
        out = run(rows, pages, {})
        self.assertEqual(len(out), 1)
        e = out[0]
        self.assertEqual(e["website"]["domain"], "kuchynenovak.sk")
        self.assertEqual(e["legal_name"], "NOVAK DESIGN s.r.o.")
        self.assertIn("Interiéry Novák", e["brand_names"])


class Classification(unittest.TestCase):
    """Spec 42, 43, 44."""

    def ent(self, name, text, source="azet"):
        e = from_record(rec(name=name, description=text, source=source))
        return e

    def check(self, name, text, cat, caller):
        e = self.ent(name, text)
        c = C.classify(e)
        self.assertEqual(c["id"], cat, name)
        self.assertIn(c["confidence"], ("medium", "high"))
        e["category"] = c
        rec_, _, _ = Q.caller_fit(e)
        self.assertEqual(rec_, caller, name)

    def test_fixtures(self):
        self.check("Salón Anna", "dámske a pánske kaderníctvo, farbenie vlasov, balayage", "kadernictvo", "sona")
        self.check("Lucia", "svadobné líčenie, vizážistka, make-up artist", "makeup", "sona")
        self.check("Byty Senica", "realitná kancelária, predaj a prenájom nehnuteľností", "reality", "sona")
        self.check("Drevo Mráz", "stolárstvo, nábytok na mieru, vstavané skrine", "stolarstvo", "jozo")
        self.check("Zeleň", "realizácia záhrad, závlahy, trávniky", "zahradnictvo", "jozo")
        self.check("Volt", "elektrikár, elektroinštalácie a revízie", "elektrikar", "jozo")
        self.check("Garáž Peter", "autoservis, oprava áut, diagnostika", "autoservis", "jozo")
        self.check("Krása", "kozmetický salón, ošetrenie pleti", "kozmetika", "sona")
        self.check("Stav", "rekonštrukcie bytov a domov, stavebná firma", "stavebnictvo", "jozo")

    def test_name_only_is_not_evidence(self):
        e = from_record(rec(name="Stolárstvo Mráz", description=""))
        c = C.classify(e)
        self.assertIn(c["confidence"], ("low", "unknown"))

    def test_43_description_from_evidence_not_name(self):
        e = self.ent("MRÁZ STAVBY s.r.o.", "výroba nábytku na mieru, kuchyne na mieru")
        e["category"] = C.classify(e)
        d = C.describe(e, e["category"])
        self.assertIn("nábytok na mieru", d["text"].lower())
        self.assertNotIn("staveb", d["text"].lower())

    def test_43_no_evidence_unknown(self):
        e = from_record(rec(name="ABC s.r.o.", description=""))
        e["category"] = C.classify(e)
        d = C.describe(e, e["category"])
        self.assertEqual(d["confidence"], "unknown")
        self.assertEqual(d["text"], C.UNKNOWN_DESC)

    def test_routing_is_configurable(self):
        e = self.ent("Salón Anna", "kaderníctvo")
        e["category"] = C.classify(e)
        self.assertEqual(Q.caller_fit(e, routing={"kadernictvo": "jozo"})[0], "jozo")

    def test_inactive_caller_falls_back(self):
        e = self.ent("Salón Anna", "kaderníctvo")
        e["category"] = C.classify(e)
        self.assertEqual(Q.caller_fit(e, active=("jozo",))[0], "jozo")


class SocialAndOpportunity(unittest.TestCase):
    """Spec 69, 70, 71."""

    def test_69_craftsman_social_only_goes_to_jozo(self):
        results = {'site:facebook.com "Mráz stolár" Senica': [{"title": "Mráz stolár | Senica | Facebook", "url": "https://www.facebook.com/mrazstolar/",
                                                               "snippet": "Stolárstvo – kuchyne a skrine na mieru. 0905 111 222"}],
                   '"0905 111 222"': [], '"Mráz stolár" Senica': []}
        e = run([rec(source="google_business", name="Mráz stolár", description="stolárstvo, nábytok na mieru")], {}, results)[0]
        self.assertEqual(e["website_resolution"], "no_website_found")
        self.assertTrue(e["social_first"])
        self.assertEqual(e["recommended_caller"], "jozo")
        self.assertIn(e["data_quality"], ("gold", "silver"))

    def test_70_beauty_social_first_goes_to_sona(self):
        results = {'site:instagram.com "Beauty Lucia"': [{"title": "Beauty Lucia (@beauty.lucia.senica) · Senica",
                                                          "url": "https://www.instagram.com/beauty.lucia.senica/",
                                                          "snippet": "Kozmetický salón Senica · ošetrenie pleti · 0905 111 222"}],
                   '"0905 111 222"': [], '"Beauty Lucia" Senica': []}
        e = run([rec(source="google_business", name="Beauty Lucia", description="kozmetický salón, ošetrenie pleti")], {}, results)[0]
        self.assertTrue(e["social_first"])
        self.assertEqual(e["recommended_caller"], "sona")

    def test_71_social_web_gap(self):
        pages = {"https://drevomraz.sk": site("Drevo Mráz", phone="0905 111 222", extra="nábytok na mieru", socials=["drevomraz"], portfolio=False)}
        e = run([rec(name="Drevo Mráz", websites=["https://drevomraz.sk"], description="stolárstvo, nábytok na mieru")], pages, {})[0]
        codes = [p["code"] for p in e["commercial_problems"]]
        self.assertIn("SOCIAL_WEB_GAP", codes)

    def test_personal_profile_without_business_signal_is_dropped(self):
        from radar.social import parse_result
        p = parse_result({"title": "Jana (@jana123)", "url": "https://www.instagram.com/jana123/", "snippet": "dovolenka 🌴"})
        self.assertFalse(p["business_signal"])

    def test_snippet_phone_alone_is_research(self):
        # telefón iba zo snippetu IG → nepotvrdený → RESEARCH (nejde callerovi)
        results = {'site:instagram.com "Nechty Eva"': [{"title": "Nechty Eva (@nechty.eva) · Senica", "url": "https://www.instagram.com/nechty.eva/",
                                                        "snippet": "nechtové štúdio gél lak 0907 000 111"}]}
        e = run([rec(source="search:instagram", name="Nechty Eva", phone="", socials=[{"platform": "instagram", "handle": "nechty.eva", "url": "https://www.instagram.com/nechty.eva/", "match": "confirmed"}])], {}, results)[0]
        self.assertEqual(e["data_quality"], "research")


class Recheck(unittest.TestCase):
    """Spec 74: pred hovorom nový web → karta sa zmení z NO_WEBSITE_FOUND na CONFIRMED."""

    def test_74_new_website_appears(self):
        base = [rec(name="Drevo Novák", description="stolárstvo")]
        e1 = run(base, {}, {'"0905 111 222"': [], '"Drevo Novák" Senica': [], 'site:instagram.com "Drevo Novák"': [], 'site:facebook.com "Drevo Novák" Senica': []})[0]
        self.assertEqual(e1["website_resolution"], "no_website_found")
        pages = {"https://drevonovak.sk": site("Drevo Novák", phone="0905 111 222", extra="stolárstvo")}
        e2 = run(base, pages, {'"0905 111 222"': [{"title": "Drevo Novák", "url": "https://drevonovak.sk/", "snippet": "0905 111 222"}]})[0]
        self.assertEqual(e2["website_resolution"], "confirmed")


class Blocking(unittest.TestCase):
    def test_instagram_never_fetched_directly(self):
        from radar.net import Net
        self.assertFalse(Net(respect_robots=False).allowed("https://www.instagram.com/novak/"))
        self.assertFalse(Net(respect_robots=False).allowed("https://www.facebook.com/novak"))

    def test_blocked_source_does_not_crash(self):
        pages = {"https://blocked.sk": "BLOCKED"}
        e = run([rec(name="Novák", websites=["https://blocked.sk"])], pages, {})[0]
        self.assertIn(e["website_resolution"], ("uncertain", "confirmed"))


if __name__ == "__main__":
    unittest.main()


class FalseCategoryRegression(unittest.TestCase):
    """Reálne omyly z QA 28. 9. 2026 (spec 55): podreťazce a vedľajšie zmienky nesmú určiť kategóriu."""

    def fp_entity(self, title, text):
        e = from_record(rec(name="Firma X", description=""))
        e["websites"].append({"domain": "x.sk", "verdict": "confirmed", "fp": {"title": title, "meta": "", "h": [title], "text": text}})
        return e

    def test_pobociek_is_not_obocie(self):
        e = self.fp_entity("Stavebná spoločnosť", "realizácia pobočiek a expozitúr, stavebné práce, rekonštrukcie objektov, rekonštrukcie")
        self.assertNotEqual(C.classify(e)["id"], "mihalnice")

    def test_side_mention_of_real_estate_is_not_reality(self):
        e = self.fp_entity("Stavby rodinných domov", "stavby rodinných domov na kľúč, zhodnocujeme vaše nehnuteľnosti, rekonštrukcie, rekonštrukcie bytov")
        self.assertEqual(C.classify(e)["id"], "stavebnictvo")


class QARegressions(unittest.TestCase):
    """Ďalšie reálne omyly z QA 28. 9. 2026."""

    def test_association_is_not_a_business(self):
        e = run([rec(name="Asociace českých kameramanů", country="CZ", phone="777 119 845")])[0]
        self.assertTrue(e.get("stopped"))

    def test_https_bad_cert_but_http_works_is_not_broken(self):
        class N(FakeNet):
            def get(self, url, limit=0, **kw):
                if url.startswith("https://"):
                    return {"status": 0, "url": url, "body": "", "chain": [url], "ssl_error": "hostname mismatch", "elapsed": 0.2}
                return super().get(url)
        pages = {"http://www.svitko.sk/": site("Záhradníctvo Švitko", phone="0902 372 187", extra="záhradníctvo, okrasné dreviny")}
        r = P.Radar(N(pages), Search([FakeAgent({})]), log=lambda *a: None)
        with mock.patch.object(P, "resolves", return_value=True), mock.patch.object(P, "register_for", return_value=None):
            e = r.run([rec(name="Záhradníctvo Švitko", phone="0902 372 187", websites=["https://www.svitko.sk"])])[0]
        self.assertEqual(e["website_resolution"], "confirmed")
        self.assertNotEqual(e["website"]["health"]["state"], "broken")
        self.assertIn("bad_cert", [i["key"] for i in e["website"]["health"]["issues"]])

    def test_unrelated_social_link_on_website_is_not_confirmed(self):
        pages = {"https://royas.cz": site("ROYAS výroba plotů", phone="602 657 304", socials=["royasploty", "nadrazkakajov"])}
        e = run([rec(name="ROYAS", country="CZ", phone="602 657 304", websites=["https://royas.cz"])], pages, {})[0]
        m = {s["handle"]: s["match"] for s in e["socials"]}
        self.assertEqual(m.get("royasploty"), "confirmed")
        self.assertEqual(m.get("nadrazkakajov"), "uncertain")

    def test_primary_phone_prefers_more_sources(self):
        e = from_record(rec(phone="0415 624 189"))
        from radar.entity import add_fact
        add_fact(e["phones"], "+421415624189", "website", "high")
        add_fact(e["phones"], "+421202044827", "website", "high")
        self.assertEqual(Q.phone_confidence(e)[0], "+421415624189")


class QARegressions2(unittest.TestCase):
    def test_bea_is_not_beauty_other_salon(self):
        pages = {"https://vandabeauty.sk": site("Kozmetický salón BEAUTY VANDA", phone="0911 000 111", city="Banská Bystrica", extra="kozmetický salón Banská Bystrica")}
        results = {'"KOZMETICKÝ SALÓN BEA" Banská Bystrica': [{"title": "Kozmetika Banská Bystrica | Kozmetický salón BEAUTY VANDA", "url": "https://www.vandabeauty.sk/", "snippet": ""}]}
        e = run([rec(name="Beáta Buranská - KOZMETICKÝ SALÓN BEA", city="Banská Bystrica", description="kozmetický salón")], pages, results)[0]
        self.assertNotIn(e["website_resolution"], ("confirmed", "probable"))

    def test_named_but_rejected_web_is_uncertain_not_no_web(self):
        pages = {"https://marikabeauty.sk": site("Marika Bajcurová - kozmetika", phone="0905 424 894", city="Vranov nad Topľou", extra="Bajcurová vizáž")}
        results = {'"0917 928 161"': [], '"Mária Bajcurová" Vranov nad Topľou': [{"title": "Marika Bajcurová - kozmetika", "url": "http://www.marikabeauty.sk/kontakt.html", "snippet": ""}]}
        e = run([rec(name="Mária Bajcurová", city="Vranov nad Topľou", phone="0917 928 161", description="kozmetika a vizáž")], pages, results)[0]
        self.assertNotEqual(e["website_resolution"], "no_website_found")

    def test_catalog_section_alone_is_not_enough(self):
        e = from_record(rec(name="Exima", description="", vertical="interier"))
        e["seed_category"] = "interier"
        self.assertEqual(C.classify(e)["confidence"], "low")


class QARegressions3(unittest.TestCase):
    def test_same_query_twice_is_one_search(self):
        # jediný vyhľadaný dopyt (ostatné čakajú) nesmie stačiť na „web sme nenašli“
        e = run([rec(name="Drevo Mráz")], {}, {'"Drevo Mráz" Senica': []})[0]
        self.assertEqual(e["website_resolution"], "uncertain")

    def test_instagram_matches_brand_variant(self):
        from radar.social import matches_entity, parse_instagram
        e = from_record(rec(name="Katarína Freund - Beauty by Katy", city="Malacky"))
        p = parse_instagram("https://www.instagram.com/beautykaty_malacky/", "Beauty by Katy - kozmetika, permanentný makeup", "")
        self.assertEqual(matches_entity(p, e)[0], "probable")
