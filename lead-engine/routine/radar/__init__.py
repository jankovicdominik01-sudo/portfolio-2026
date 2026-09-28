# -*- coding: utf-8 -*-
"""
Lead Radar — z malého množstva údajov o firme poskladá overenú business entitu.

DISCOVERY → ENTITY RESOLUTION → EVIDENCE GRAPH → SOCIAL DISCOVERY → WEBSITE HUNTING
→ WEBSITE VERIFICATION → CLASSIFICATION → COMMERCIAL SIGNALS → DATA QUALITY GATE → ROUTING.

Zásady:
  * „web sme nenašli“ ≠ „firma nemá web“ (NO_WEBSITE_FOUND, nikdy NO_WEBSITE),
  * každé tvrdenie má zdroj (Fact.sources / evidence),
  * zlučuje sa iba podľa silných signálov, nikdy podľa podobného názvu,
  * iba verejné firemné údaje; žiadne obchádzanie loginu, CAPTCHA ani anti-bot ochrán.
"""
