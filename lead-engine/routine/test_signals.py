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


class ProcessSignals(unittest.TestCase):
    def test_phone_ordering_with_excerpt(self):
        fp = fp_from("<html><body><p>Objednávky na servis prijímame telefonicky, volajte 0905 123 456.</p></body></html>")
        keys = {s["key"]: s for s in SIG.process_signals(fp)}
        self.assertIn("phone_ordering", keys)
        self.assertEqual(keys["phone_ordering"]["level"], "OBSERVED")
        self.assertIn("telefonick", keys["phone_ordering"]["excerpt"])

    def test_absence_is_not_found_never_claim(self):
        fp = fp_from("<html><body><p>Vitajte</p></body></html>")
        keys = {s["key"]: s for s in SIG.process_signals(fp)}
        self.assertIn("no_form_found", keys)
        self.assertIn("no_booking_found", keys)
        for s in keys.values():
            self.assertNotIn("nemajú", s["text"])
            self.assertIn("nenašli", s["text"]) if s["key"].endswith("_found") else None

    def test_form_and_booking_detected(self):
        fp = fp_from('<form action="/send"></form><a href="https://reservio.com/x">Rezervovať</a><a href="https://m.me/novak">Napíšte</a>')
        keys = {s["key"] for s in SIG.process_signals(fp)}
        self.assertNotIn("no_form_found", keys)
        self.assertIn("booking_tool", keys)
        self.assertIn("messenger_cta", keys)

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


if __name__ == "__main__":
    unittest.main()
