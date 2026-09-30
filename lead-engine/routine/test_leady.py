# -*- coding: utf-8 -*-
"""Regresné testy zberného skriptu (bez siete — fetch/DNS sú nahradené).

    python3 -m unittest discover -s lead-engine/routine -p "test_*.py"
"""
import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(__file__))
import leady  # noqa: E402

REALIZACIA = (
    "<html><head><title>Realizácia záhrad</title></head><body>"
    + "Realizácia záhrad " * 80
    + " Kontakt: +421 903 735 048 mlady.m.mmgs@gmail.com Banka pri Piešťanoch</body></html>"
)


def row(**kw):
    base = dict(name="Firma", profile="p", catalog_category="x", vertical="zahradnictvo", source="azet", city="Nitra",
                address="", phone="0905 111 222", email="", websites=[], ico="")
    base.update(kw)
    return base


class BazosForeignWebsite(unittest.TestCase):
    """Chyba z 24. 9. 2026: inzerátu z Bazoša sa priradil cudzí web podľa názvu inzerátu."""

    def test_bazos_never_guesses_domain_from_ad_title(self):
        r = row(name="Realizácia záhrad, závlah, kobercových trávnikov", source="bazos", city="Prešov", phone="0903636753")
        self.assertEqual(leady.guess_domains(r), [])

    def test_bazos_site_needs_strong_match(self):
        r = row(name="Realizácia záhrad", source="bazos", city="Prešov", phone="0903636753")
        self.assertFalse(leady.site_matches(r, REALIZACIA))

    def test_assess_bazos_ad_does_not_get_foreign_web(self):
        r = row(name="Realizácia záhrad, závlah, kobercových trávnikov", source="bazos", city="Prešov",
                phone="0903636753", email="")
        with mock.patch.object(leady, "resolves", return_value=True), \
                mock.patch.object(leady, "fetch_site", return_value=(200, "http://realizaciazahrad.sk/", REALIZACIA, None)):
            w = leady.assess(r)
        self.assertEqual(w["web"], "none")
        self.assertNotIn("url", w)


class WebsiteMatching(unittest.TestCase):
    def test_name_only_is_uncertain_not_attached(self):
        r = row(name="Realizácia záhrad", city="Trnava", phone="0911 000 000")
        with mock.patch.object(leady, "resolves", return_value=True), \
                mock.patch.object(leady, "fetch_site", return_value=(200, "http://realizaciazahrad.sk/", REALIZACIA, None)):
            w = leady.assess(r)
        self.assertEqual(w["web"], "uncertain")
        self.assertEqual(w["possible_url"], "http://realizaciazahrad.sk/")

    def test_phone_match_is_strong(self):
        r = row(name="Úplne iný názov", phone="0903 735 048")
        self.assertEqual(leady.match_level(leady.match_signals(r, REALIZACIA)), "strong")

    def test_name_and_city_is_medium(self):
        r = row(name="Realizácia záhrad", city="Banka", phone="0911 000 000")
        self.assertEqual(leady.match_level(leady.match_signals(r, REALIZACIA)), "medium")


class Identity(unittest.TestCase):
    def test_azet_and_zoznam_same_ico_is_one_company(self):
        a = row(source="azet", profile="https://www.azet.sk/firma/1/", ico="36349747", phone="042 4466 331")
        z = row(source="zoznam", profile="https://www.zoznam.sk/firma/2/", ico="36349747", phone="042 4465 041",
                email="ekonom@hortus.sk", websites=["http://www.hortus.sk"])
        out = leady.merge_rows([a, z])
        self.assertEqual(len(out), 1)
        self.assertEqual([s["source"] for s in out[0]["sources"]], ["zoznam", "azet"])
        self.assertEqual(out[0]["email"], "ekonom@hortus.sk")

    def test_same_phone_merges_bazos_ad(self):
        a = row(source="azet", phone="0905 111 222", ico="12345678")
        b = row(source="bazos", phone="+421905111222", name="Kosenie záhrad")
        self.assertEqual(len(leady.merge_rows([a, b])), 1)

    def test_same_name_different_phone_is_not_merged(self):
        a = row(name="Záhradníctvo Novák", phone="0905 111 222")
        b = row(name="Záhradníctvo Novák", phone="0905 999 888")
        self.assertEqual(len(leady.merge_rows([a, b])), 2)

    def test_free_hosting_domain_does_not_merge(self):
        a = row(phone="0905 111 222", websites=["http://abc.szm.com"])
        b = row(phone="0905 999 888", websites=["http://xyz.szm.com"])
        self.assertEqual(len(leady.merge_rows([a, b])), 2)


class BusinessCheck(unittest.TestCase):
    def test_trade_changed_in_register(self):
        st, why = leady.business_check(row(name="Záhradníctvo LURUS"), {"name": "Ľubomír Rusko - MASÉR ĽUBO"})
        self.assertEqual(st, "changed")
        self.assertIn("MASÉR", why)

    def test_confirmed_by_register(self):
        st, _ = leady.business_check(row(), {"name": "Vladimír Zajac Záhradníctvo"})
        self.assertEqual(st, "confirmed")

    def test_person_name_only_is_uncertain(self):
        st, _ = leady.business_check(row(name="Mária Kováčiková", source="bazos"), {"name": "Mária Kováčiková"})
        self.assertEqual(st, "uncertain")


class Filters(unittest.TestCase):
    def test_relevance(self):
        self.assertFalse(leady.relevant("zahradnictvo", "MGBIZ Predaj záhradnej techniky Wolf Garten"))
        self.assertTrue(leady.relevant("zahradnictvo", "SEDUM Návrh a realizácia záhrad"))

    def test_bazos_sale_and_handyman_ads_are_skipped(self):
        self.assertTrue(leady.SALE.search("Záhradný domček TOOL SHED 3×3 m – RAL9002"))
        self.assertTrue(leady.MIXED.search("Ponúkam práce pre váš byt,dom,záhradu a firmu."))


class WebHealth(unittest.TestCase):
    def assess_body(self, body, url="https://example.sk", final=None, ssl=None):
        r = row(name="Test", websites=[url])
        with mock.patch.object(leady, "fetch_site", return_value=(200, final or url, body, ssl)), \
                mock.patch.object(leady, "resolves", return_value=True), \
                mock.patch.object(leady, "product_from", return_value=None):
            return leady.assess(r)

    def test_parked(self):
        w = self.assess_body("<html><body>Na tejto doméne zatiaľ nič nie je " + "x" * 1000 + "</body></html>")
        self.assertEqual((w["web"], w["issues"][0]["key"]), ("broken", "parked"))

    def test_db_error(self):
        w = self.assess_body("Fatal error! Could not connect to database")
        self.assertEqual(w["issues"][0]["key"], "db_error")

    def test_foreign_redirect(self):
        w = self.assess_body("<title>MarkeThink reklamná agentúra</title>" + "x" * 1000, final="http://markethink.ozm.sk/")
        self.assertEqual(w["issues"][0]["key"], "foreign_redirect")

    def test_status_mapping(self):
        self.assertEqual(leady.website_status({"web": "none"}), "none_unverified")
        self.assertEqual(leady.website_status({"web": "unknown"}), "uncertain")


if __name__ == "__main__":
    unittest.main()
