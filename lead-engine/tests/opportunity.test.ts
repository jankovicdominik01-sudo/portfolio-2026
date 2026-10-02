/**
 * Opportunity Engine, operátori, routing kanála, ROI, Call Card v2 a Demo payload.
 * Firmy sú vymyslené.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { configuredOperators, canTakeCall, DEFAULT_OPERATORS, type Operator } from "../lib/operators";
import { buildOpportunity, type Opportunity } from "../lib/opportunity";
import { chooseChannel } from "../lib/channel";
import { roi } from "../lib/roi";
import { opportunityCallCard } from "../lib/call-card";
import { buildDemoPayload, DemoError, hasDemoTemplate } from "../lib/demo-templates";
import { forbiddenClaims } from "../lib/script";
import type { RadarProfile } from "../lib/types";

const NOW = "2026-09-30T10:00:00.000Z";

function profile(p: Partial<RadarProfile> = {}): RadarProfile {
  return {
    version: 1,
    country: "SK",
    brand_names: ["Autoservis Novák"],
    city: "Skalica",
    services: ["Servis bŕzd", "Výmena oleja"],
    business_status: { value: "active", evidence: ["register: aktívna (Novák s.r.o.)", "vlastný web funguje"] },
    data_quality: "gold",
    website_resolution: "confirmed",
    website: { url: "https://autoservis-novak.sk", status: "confirmed", evidence: [] },
    register: { found: true, ico: "12345678" },
    primary_phone: { value: "+421905123456", confidence: "high", sources: ["web"] },
    process_signals: [
      { key: "phone_ordering", level: "OBSERVED", text: "Objednávky / termíny riešia telefonicky (píšu to na webe)", excerpt: "objednavky na servis prijimame telefonicky", source: "https://autoservis-novak.sk" },
      { key: "no_booking_found", level: "OBSERVED", text: "Online rezerváciu sme na webe nenašli", excerpt: "homepage + podstránky", source: "https://autoservis-novak.sk" },
      { key: "no_form_found", level: "OBSERVED", text: "Formulár sme na webe nenašli", excerpt: "homepage + podstránky bez <form>", source: "https://autoservis-novak.sk" },
    ],
    tags: { ads_status: "TAG_PRESENT", spend: "UNKNOWN", google_ads: "AW-123456789", ga4: null, gtm: null, meta_pixel: null },
    ...p,
  } as RadarProfile;
}

const lead = { website_status: "working" as const, data_quality: "gold" as const, ads_check: null };
const ROMAN: Operator = DEFAULT_OPERATORS[0];

/* ─────────── Operátori ─────────── */

test("Roman je predvolený ACTIVE operátor s kanálom CALL a neznámym číslom", () => {
  const ops = configuredOperators(undefined);
  const r = ops.find((o) => o.operator_id === "roman")!;
  assert.equal(r.status, "ACTIVE");
  assert.deepEqual(r.channels, ["CALL"]);
  assert.equal(r.phone_number, null);
});

test("operátori sú iba z konfigurácie; účet bez záznamu operátora neexistuje ako operátor", () => {
  const env = JSON.stringify([{ operator_id: "roman", name: "Roman", status: "ACTIVE" }, { operator_id: "peter", name: "Peter", status: "INACTIVE" }]);
  const ops = configuredOperators(env);
  assert.deepEqual(ops.map((o) => o.operator_id), ["roman", "peter"]);
  assert.ok(!canTakeCall(ops[1], "autoservis"));
  assert.deepEqual(configuredOperators(undefined).map((o) => o.operator_id), ["roman"]);
});

test("neplatný LE_OPERATORS sa ignoruje, kapacita a segmenty sa rešpektujú", () => {
  assert.equal(configuredOperators("{nie json")[0].operator_id, "roman");
  const op: Operator = { ...ROMAN, daily_capacity: 2, assigned_segments: ["autoservis"] };
  assert.ok(canTakeCall(op, "autoservis", 1));
  assert.ok(!canTakeCall(op, "autoservis", 2));
  assert.ok(!canTakeCall(op, "barber", 0));
  assert.ok(!canTakeCall({ ...ROMAN, status: "PAUSED" }, "autoservis"));
});

/* ─────────── Opportunity ─────────── */

test("autoservis s telefonickým objednávaním bez formulára = TOP a service_booking", () => {
  const o = buildOpportunity(lead, "autoservis", profile());
  assert.equal(o.dimensions.PROCESS_PAIN.level, "HIGH");
  assert.equal(o.dimensions.AUTOMATION_FIT.level, "HIGH");
  assert.equal(o.priority, "TOP");
  assert.equal(o.recommended_system?.id, "service_booking");
  assert.equal(o.recommended_system?.basis, "evidence");
  assert.ok(o.recommended_system?.primary_modules.includes("booking"));
  assert.match(o.why_this_lead, /telefonát/);
  assert.ok(!/\.\./.test(o.why_this_lead));
});

test("reklama: tag = TAG PRESENT, nikdy ACTIVE; spend vždy UNKNOWN; ACTIVE iba z ručnej kontroly", () => {
  const o = buildOpportunity(lead, "autoservis", profile());
  assert.equal(o.ads.status, "TAG_PRESENT");
  assert.equal(o.ads.spend, "UNKNOWN");
  assert.equal(o.dimensions.AD_SPEND_SIGNAL.level, "MEDIUM");
  const checked = buildOpportunity({ ...lead, ads_check: { status: "ACTIVE", url: "https://adstransparency.google.com/x", checked_at: NOW, by: "dominik" } }, "autoservis", profile());
  assert.equal(checked.ads.status, "ACTIVE");
  const none = buildOpportunity(lead, "autoservis", profile({ tags: { ads_status: "NOT_FOUND", spend: "UNKNOWN", google_ads: null, ga4: null, gtm: null, meta_pixel: null } }));
  assert.match(none.ads.note, /Neznamená, že neinzerujú/);
});

test("Money Leak nikdy nepočíta eurá", () => {
  const o = buildOpportunity(lead, "autoservis", profile());
  const text = JSON.stringify(o.money_leak);
  assert.ok(!/€|eur/i.test(text));
  assert.ok(o.money_leak.lines.some((l) => l.label === "Spend" && l.level === "UNKNOWN"));
  assert.ok(o.money_leak.lines.some((l) => /riziko/i.test(l.label)));
});

test("bez signálov (web nečitateľný) je PROCESS_PAIN UNKNOWN, nie vymyslený", () => {
  const o = buildOpportunity(lead, "autoservis", profile({ process_signals: [] }));
  assert.equal(o.dimensions.PROCESS_PAIN.level, "UNKNOWN");
  assert.notEqual(o.priority, "TOP");
});

test("online rezervácia už existuje = PROCESS_PAIN LOW", () => {
  const o = buildOpportunity(lead, "barber", profile({ process_signals: [{ key: "booking_tool", level: "OBSERVED", text: "Na webe je online rezervácia", excerpt: "reservio", source: "x" }] }));
  assert.equal(o.dimensions.PROCESS_PAIN.level, "LOW");
});

test("WHY THIS LEAD bez silných dimenzií povie, že dôvod nemáme", () => {
  const weak = buildOpportunity({ ...lead, data_quality: "research" }, "ine", profile({ process_signals: [], business_status: null, tags: null }));
  assert.equal(weak.why_this_lead, "Silný dôvod sme nenašli.");
  assert.deepEqual(weak.why_lines, []);
});

/* ─────────── Routing kanála ─────────── */

const base = () => ({
  category: "autoservis",
  score_band: "high" as const,
  opportunity: buildOpportunity(lead, "autoservis", profile()),
  has_phone: true,
  has_email: true,
  do_not_contact: false,
  operators: [ROMAN],
});

test("všetky podmienky splnené → CALL na Romana, každé pravidlo je vysvetlené", () => {
  const d = chooseChannel(base());
  assert.equal(d.channel, "CALL");
  assert.equal(d.operator_id, "roman");
  assert.ok(d.rules.every((r) => r.passed && r.label.length > 5));
});

test("stačí jedna nesplnená kvalitná brána → ASYNC s dôvodom", () => {
  const d = chooseChannel({ ...base(), phone_verified: false });
  assert.equal(d.channel, "ASYNC");
  assert.equal(d.message_via, "EMAIL");
  assert.ok(d.reasons.some((r) => /nesplnené: Telefón overený/.test(r)));
  const weak = chooseChannel({ ...base(), score_band: "medium", opportunity: { ...base().opportunity, priority: "NORMAL" } });
  assert.equal(weak.channel, "ASYNC");
  assert.ok(weak.reasons.some((r) => /nesplnené: Silný lead/.test(r)));
  assert.equal(chooseChannel({ ...base(), category_verified: false }).channel, "ASYNC");
});

test("dobrý lead bez voľného operátora čaká (HOLD), nikdy nejde inému človeku", () => {
  const inactive: Operator = { ...ROMAN, operator_id: "peter", name: "Peter", status: "INACTIVE" };
  assert.equal(chooseChannel({ ...base(), operators: [] }).channel, "HOLD");
  const d = chooseChannel({ ...base(), operators: [inactive] });
  assert.equal(d.channel, "HOLD");
  assert.equal(d.operator_id, null);
});

test("Nekontaktovať alebo žiadny kontakt → HOLD", () => {
  assert.equal(chooseChannel({ ...base(), do_not_contact: true }).channel, "HOLD");
  assert.equal(chooseChannel({ ...base(), has_phone: false, has_email: false }).channel, "HOLD");
});

test("rovnaký vstup = rovnaký výsledok (žiadna náhoda)", () => {
  assert.deepEqual(chooseChannel(base()), chooseChannel(base()));
});

/* ─────────── ROI ─────────── */

test("ROI: 20 dopytov × 7 min = 140 min/týždeň ≈ 112 až 121 h/rok, vždy ESTIMATE", () => {
  const r = roi({ perWeek: 20, minutesEach: 7 });
  assert.deepEqual(r.minutesPerWeek, [140, 140]);
  assert.deepEqual(r.hoursPerYear, [112, 121]);
  assert.equal(r.level, "ESTIMATE");
  assert.ok(r.assumptions.every((a) => /ASSUMPTION|zdroj/.test(a)));
});

test("ROI: rozsahy a zdroje sa prepíšu do predpokladov, záporné vstupy sú chyba", () => {
  const r = roi({ perWeek: [15, 25], minutesEach: [5, 8], source: { perWeek: "majiteľ v hovore 30. 9." } });
  assert.deepEqual(r.minutesPerWeek, [75, 200]);
  assert.match(r.assumptions[0], /zdroj: majiteľ/);
  assert.throws(() => roi({ perWeek: -1, minutesEach: 5 }), RangeError);
});

/* ─────────── Call Card v2 ─────────── */

test("Call Card v3: konkrétny kontext, žiadne „robíme webstránky“, žiadne zakázané tvrdenia", () => {
  const o = buildOpportunity(lead, "autoservis", profile());
  const c = opportunityCallCard({ company: { name: "Autoservis Novák", city: "Skalica", category: "autoservis", phone: "+421905123456", website: "https://autoservis-novak.sk" }, profile: profile(), opportunity: o, operatorName: "Roman", demoReady: true });
  assert.match(c.opening, /telefonicky/);
  assert.equal(c.demo, "READY");
  assert.ok(c.questions.length >= 2 && c.questions.length <= 3);
  assert.ok(c.facts.length >= 1 && c.facts.length <= 3);
  assert.ok(c.why.length >= 1 && c.why.length <= 3);
  const all = [c.opening, c.next_step.ask, ...c.questions, ...c.why].join(" ");
  assert.ok(!/robíme webstránky/i.test(all));
  assert.deepEqual(forbiddenClaims([all]), []);
  assert.ok(!/nemáte/i.test(all));
});

/* ─────────── Demo payload ─────────── */

test("Demo payload berie iba údaje s evidence a má 3 šablóny", () => {
  const o = buildOpportunity(lead, "autoservis", profile());
  const d = buildDemoPayload({ company: { name: "Novák", city: null, category: "autoservis" }, profile: profile(), opportunity: o, nowIso: NOW, code: "abc23456" });
  assert.equal(d.version, 2);
  assert.equal(d.template, "service_booking");
  assert.equal(d.segment, "AUTO_SERVICE");
  assert.equal(d.business.name, "Autoservis Novák");
  assert.deepEqual(d.evidence.map((e) => e.field).sort(), ["city", "name", "services"]);
  assert.equal(d.expires_at, "2026-10-30T10:00:00.000Z");
  assert.ok(hasDemoTemplate("appointment") && hasDemoTemplate("project_pipeline") && !hasDemoTemplate("inquiry"));
});

test("Demo bez služieb nevymýšľa služby; segment bez šablóny = chyba", () => {
  const o = buildOpportunity(lead, "autoservis", profile({ services: [] }));
  const d = buildDemoPayload({ company: { name: "Novák", city: "Skalica", category: "autoservis" }, profile: profile({ services: [] }), opportunity: o, nowIso: NOW });
  assert.deepEqual(d.business.services, []);
  assert.ok(!d.evidence.some((e) => e.field === "services"));
  assert.equal(d.code.length, 12);
  const none: Opportunity = { ...o, recommended_system: null };
  assert.throws(() => buildDemoPayload({ company: { name: "X", city: null }, profile: null, opportunity: none, nowIso: NOW }), DemoError);
});

/* ─────────── Dominik Style Engine ─────────── */

import { draftFirstMessage, smsSegments, styleGuard } from "../lib/style";

test("e-mail draft: konkrétny problém, bez diakritiky, bez .sk, podpis Jankovič, guard čistý", () => {
  const o = buildOpportunity(lead, "autoservis", profile());
  const d = draftFirstMessage({ opportunity: o, channel: "EMAIL", demoUrl: "https://djweby.sk/d/abc23456" });
  assert.match(d.text, /terminy riesite hlavne telefonicky/);
  const body = d.text.split("Jankovič")[0];
  assert.ok(!/[áäčďéíľĺňóôŕšťúýž]/i.test(body));
  assert.ok(!/djweby\.sk/.test(body));
  assert.match(d.text, /\n\nJankovič\n\n--\n/);
  assert.deepEqual(d.issues, []);
  assert.equal(d.pain_code, "PHONE_BOOKING");
});

test("SMS draft má STOP a počíta segmenty v UCS-2", () => {
  const o = buildOpportunity(lead, "autoservis", profile());
  const d = draftFirstMessage({ opportunity: o, channel: "SMS", demoUrl: "djweby.sk/d/abc23456" });
  assert.match(d.text, /STOP/);
  assert.equal(d.sms_segments, smsSegments(d.text));
  assert.equal(smsSegments("a".repeat(160)), 1);
  assert.equal(smsSegments("č".repeat(70)), 1);
  assert.equal(smsSegments("č".repeat(71)), 2);
});

test("guard chytí agentúrny tón, pomlčky, pochvalu bez evidence aj „nemáte“", () => {
  const bad = "Dobrý deň — robím moderné weby, máte skvelý servis a nemáte web! Posunieme vás na ďalšiu úroveň!";
  const issues = styleGuard(bad, { channel: "EMAIL", hasObservation: false, praiseEvidence: false });
  for (const re of [/pomlčka/, /moderné weby/, /pochvala/, /nemáte/, /výkričník/, /konkrétnom probléme/, /ďalšiu úroveň/]) {
    assert.ok(issues.some((i) => re.test(i)), String(re));
  }
});

test("remeselník so slabým webom bez ručného procesu na webe ide na hovor; reality nie", () => {
  const p = profile({ process_signals: [{ key: "booking_tool", level: "OBSERVED", text: "Na webe je online rezervácia", excerpt: "x", source: "x" }] });
  const weak = { website_status: "weak" as const, data_quality: "gold" as const, ads_check: null };
  const o = buildOpportunity(weak, "stolarstvo", p);
  const d = chooseChannel({ ...base(), category: "stolarstvo", opportunity: o });
  assert.equal(d.channel, "CALL");
  const r = chooseChannel({ ...base(), category: "reality", opportunity: buildOpportunity(weak, "reality", p) });
  assert.notEqual(r.channel, "CALL");
  assert.ok(r.rules.some((x) => x.key === "phone_natural" && !x.passed));
});
