# -*- coding: utf-8 -*-
"""Procesné signály a tagy (Opportunity Engine). Firmy sú vymyslené."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))
from radar import signals as SIG  # noqa: E402
from radar.website import parse_page  # noqa: E402


def fp_from(html, url="https://autoservis-novak.sk/"):
    p = parse_page(url, html, "SK")
    return {"reachable": True, "requested": url, "final_url": url, "text": p["text"], "forms": p["forms"], "raw_pages": p["head"]}


def codes(fp):
    return {s["code"]: s for s in SIG.process_signals(fp, observed_at="2026-10-02T08:00:00Z")}


class ProcessSignals(unittest.TestCase):
    def test_phone_booking_with_excerpt_and_contract(self):
        fp = fp_from("<html><body><p>Objednávky na servis prijímame telefonicky, volajte 0905 123 456.</p></body></html>")
        k = codes(fp)
        self.assertIn("PHONE_BOOKING", k)
        s = k["PHONE_BOOKING"]
        for f in ("code", "level", "evidence", "source", "observed_at", "confidence"):
            self.assertIn(f, s)
        self.assertEqual(s["level"], "OBSERVED")
        self.assertIn("telefonicky", s["evidence"])  # doslovný úryvok s diakritikou z webu
        self.assertEqual(s["observed_at"], "2026-10-02T08:00:00Z")

    def test_call_for_appointment_sk_and_cz(self):
        self.assertIn("CALL_FOR_APPOINTMENT", codes(fp_from("<p>Pre objednanie termínu nám zavolajte.</p>")))
        self.assertIn("CALL_FOR_APPOINTMENT", codes(fp_from("<p>Na termín se objednejte, zavolejte nám.</p>")))

    def test_generic_form_is_verified_with_field_count(self):
        html = ('<form><input name="meno" type="text"><input name="email" type="email">'
                '<textarea name="sprava"></textarea><input type="submit"></form>')
        k = codes(fp_from(html))
        self.assertEqual(k["GENERIC_CONTACT_FORM"]["level"], "VERIFIED")
        self.assertIn("3 polia", k["GENERIC_CONTACT_FORM"]["evidence"])
        self.assertIn("PHOTO_UPLOAD_MISSING", k)
        self.assertNotIn("NO_FORM_FOUND", k)

    def test_specific_form_is_not_generic(self):
        html = '<form><input name="meno"><input name="plocha_m2"><select name="typ_podlahy"></select><input type="file" name="foto"></form>'
        k = codes(fp_from(html))
        self.assertNotIn("GENERIC_CONTACT_FORM", k)
        self.assertNotIn("PHOTO_UPLOAD_MISSING", k)
        self.assertIn("FILE_UPLOAD_PRESENT", k)

    def test_search_form_is_ignored(self):
        k = codes(fp_from('<form><input type="search" name="s"></form>'))
        self.assertNotIn("GENERIC_CONTACT_FORM", k)

    def test_whatsapp_and_messenger(self):
        k = codes(fp_from('<a href="https://wa.me/421905123456">WhatsApp</a><a href="https://m.me/novak">Messenger</a>'))
        self.assertEqual(k["WHATSAPP_PRIMARY"]["confidence"], "high")  # bez formulára je to hlavná cesta
        self.assertIn("MESSENGER_PRIMARY", k)
        k2 = codes(fp_from('<form><input name="email"></form><a href="https://wa.me/421905123456">WA</a>'))
        self.assertEqual(k2["WHATSAPP_PRIMARY"]["confidence"], "medium")

    def test_pdf_price_list_verified(self):
        k = codes(fp_from('<a href="/files/cennik-2024.pdf">Stiahnuť</a>'))
        self.assertEqual(k["PDF_PRICE_LIST"]["level"], "VERIFIED")
        self.assertNotIn("PDF_PRICE_LIST", codes(fp_from('<a href="/files/gdpr.pdf">GDPR</a>')))

    def test_quote_measurement_photos_price(self):
        html = ("<p>Ponúkame bezplatné zameranie a nezáväznú cenovú ponuku.</p>"
                "<p>Pošlite nám fotky podlahy na WhatsApp.</p><p>Cenu vám povieme telefonicky.</p>"
                "<p>Objednávky posielajte e-mailom.</p><p>Naše realizácie nájdete na Facebooku.</p>")
        k = codes(fp_from(html))
        for c in ("MEASUREMENT_REQUIRED", "MANUAL_QUOTE_SIGNAL", "PHOTOS_REQUESTED_SEPARATELY", "CALL_FOR_PRICE", "EMAIL_FOR_ORDER", "SOCIAL_REALIZATIONS"):
            self.assertIn(c, k, c)

    def test_absence_is_not_found_never_claim(self):
        k = codes(fp_from("<html><body><p>Vitajte</p></body></html>"))
        for c in ("NO_FORM_FOUND", "NO_BOOKING_FOUND", "PHOTO_UPLOAD_MISSING", "NO_CUSTOMER_STATUS_FOUND"):
            self.assertIn(c, k)
            self.assertEqual(k[c]["level"], "OBSERVED")
            self.assertIn("nenašli", k[c]["text"])
        for s in k.values():
            self.assertNotIn("nemajú", s["text"])
        self.assertNotIn("PHONE_BOOKING", k)

    def test_booking_tool_and_customer_zone(self):
        k = codes(fp_from('<a href="https://reservio.com/x">Rezervovať</a><a href="/login">Klientska zóna</a>'))
        self.assertIn("BOOKING_TOOL_PRESENT", k)
        self.assertNotIn("NO_BOOKING_FOUND", k)
        self.assertNotIn("NO_CUSTOMER_STATUS_FOUND", k)

    def test_source_is_the_page_where_found(self):
        fp = fp_from("<p>Vitajte</p>")
        fp["page_raw"] = [{"url": "https://x.sk/", "html": "<p>Vitajte</p>", "text": "Vitajte"},
                          {"url": "https://x.sk/kontakt", "html": "", "text": "Termíny len telefonicky."}]
        self.assertEqual(codes(fp)["PHONE_BOOKING"]["source"], "https://x.sk/kontakt")

    def test_unreachable_gives_nothing(self):
        self.assertEqual(SIG.process_signals({"reachable": False}), [])


class Tags(unittest.TestCase):
    def test_ads_tag_is_tag_present_not_active(self):
        fp = fp_from("<script>gtag('config','AW-123456789');gtag('config','G-ABC1234XYZ')</script>")
        t = SIG.tags(fp)
        self.assertEqual(t["ads_status"], "TAG_PRESENT")
        self.assertEqual(t["spend"], "UNKNOWN")
        self.assertTrue(t["ga4"])

    def test_no_tag_is_not_found(self):
        t = SIG.tags(fp_from("<p>nič</p>"))
        self.assertEqual(t["ads_status"], "NOT_FOUND")
        self.assertIsNone(t["meta_pixel"])

    def test_unreachable_is_unknown(self):
        self.assertEqual(SIG.tags({"reachable": False})["ads_status"], "UNKNOWN")


class QualityFirst(unittest.TestCase):
    """Operátor dostane radšej 20 dobrých leadov než 200 čísel."""

    def ent(self, id, dq="gold", phone="high", cat="high", pain=False, points=40, status="active"):
        return {"id": id, "stopped": None, "recommended_caller": "roman", "data_quality": dq, "country": "SK", "city": f"Mesto{id}",
                "category": {"id": f"k{id}", "confidence": cat}, "primary_phone": {"confidence": phone},
                "business_status": {"value": status}, "exploration": False, "score": {"points": points},
                "process_signals": [{"key": "CALL_FOR_APPOINTMENT", "code": "CALL_FOR_APPOINTMENT"}] if pain else []}

    def test_call_ready_gates(self):
        import radar_run as R
        self.assertTrue(R.call_ready(self.ent("a")))
        self.assertFalse(R.call_ready(self.ent("b", phone="medium")))
        self.assertFalse(R.call_ready(self.ent("c", cat="low")))
        self.assertFalse(R.call_ready(self.ent("d", dq="research")))
        self.assertFalse(R.call_ready(self.ent("e", status="inactive")))

    def test_select_prefers_gold_with_process_pain(self):
        import radar_run as R
        ents = [self.ent("silver", dq="silver", points=90), self.ent("gold", points=30), self.ent("pain", points=10, pain=True),
                self.ent("weakphone", phone="low", points=99)]
        out = R.select(ents, [{"caller": "roman", "need": 3}], ("SK",))["roman"]
        self.assertEqual([e["id"] for e in out], ["pain", "gold", "silver"])

    def test_plan_respects_segments(self):
        import radar_run as R
        jobs = R.plan([{"caller": "roman", "need": 20}], {}, set(), "2026-10-02", ("SK",), segments={"autoservis", "strechy"})
        self.assertTrue(jobs)
        self.assertTrue(all(j["category"] in ("autoservis", "strechy") for j in jobs))
        self.assertTrue(all(c in R.CATS for c in R.CALL_SEGMENTS))


if __name__ == "__main__":
    unittest.main()
