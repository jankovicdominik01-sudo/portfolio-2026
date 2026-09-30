/**
 * Opportunity Engine, operátori, routing kanála, ROI, Call Card v2 a Demo payload.
 * Firmy sú vymyslené.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { configuredOperators, canTakeCall, DEFAULT_OPERATORS, type Operator } from "../lib/operators";
import { buildOpportunity, whyThisLead, type Opportunity } from "../lib/opportunity";
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
  const ops = configuredOperators([], undefined);
  const r = ops.find((o) => o.operator_id === "roman")!;
  assert.equal(r.status, "ACTIVE");
  assert.deepEqual(r.channels, ["CALL"]);
  assert.equal(r.phone_number, null);
});

test("Soňa a Jozo sú vždy INACTIVE, aj keď ich env alebo účet zapne", () => {
  const env = JSON.stringify([{ operator_id: "sona", name: "Soňa", status: "ACTIVE" }, { operator_id: "roman", name: "Roman", status: "ACTIVE" }]);
  const ops = configuredOperators([{ username: "jozo", name: "Jozo", role: "caller", active: true }], env);
  assert.equal(ops.find((o) => o.operator_id === "sona")!.status, "INACTIVE");
  assert.equal(ops.find((o) => o.operator_id === "jozo")!.status, "INACTIVE");
  assert.ok(!canTakeCall(ops.find((o) => o.operator_id === "sona")!, "autoservis"));
});

test("neplatný LE_OPERATORS sa ignoruje, kapacita a segmenty sa rešpektujú", () => {
  assert.equal(configuredOperators([], "{nie json")[0].operator_id, "roman");
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
  assert.match(o.why_this_lead, /telefonicky/);
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
  assert.ok(o.money_leak.some((l) => l.label === "Spend" && l.level === "UNKNOWN"));
  assert.ok(o.money_leak.some((l) => /riziko/i.test(l.label)));
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
  assert.equal(whyThisLead({ ...weak.dimensions, VISUAL_GAP: { level: "LOW", reasons: [] } }, null), "Silný dôvod sme nenašli.");
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

test("stačí jedna nesplnená podmienka → ASYNC s dôvodom", () => {
  const d = chooseChannel({ ...base(), score_band: "medium" });
  assert.equal(d.channel, "ASYNC");
  assert.equal(d.message_via, "EMAIL");
  assert.ok(d.reasons.some((r) => /nesplnené: Vysoká hodnota/.test(r)));
});

test("bez aktívneho operátora ide lead async; legacy operátor sa nepoužije", () => {
  const legacy: Operator = { ...ROMAN, operator_id: "sona", name: "Soňa" };
  assert.equal(chooseChannel({ ...base(), operators: [] }).channel, "ASYNC");
  assert.equal(chooseChannel({ ...base(), operators: [legacy] }).channel, "ASYNC");
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

test("Call Card v2: konkrétny kontext, žiadne „robíme webstránky“, žiadne zakázané tvrdenia", () => {
  const o = buildOpportunity(lead, "autoservis", profile());
  const c = opportunityCallCard({ company: { name: "Autoservis Novák", city: "Skalica" }, profile: profile(), opportunity: o, operatorName: "Roman", demoReady: true });
  assert.match(c.context_pain, /telefonicky/);
  assert.equal(c.demo, "READY");
  assert.ok(c.questions.length >= 2 && c.questions.length <= 3);
  assert.ok(c.verified.some((v) => /IČO 12345678/.test(v.text)));
  const all = [c.opening, c.context_pain, c.idea, c.next_step, ...c.questions].join(" ");
  assert.ok(!/robíme webstránky/i.test(all));
  assert.deepEqual(forbiddenClaims([all]), []);
  assert.ok(!/nemáte/i.test(all));
});

/* ─────────── Demo payload ─────────── */

test("Demo payload berie iba údaje s evidence a má 3 šablóny", () => {
  const o = buildOpportunity(lead, "autoservis", profile());
  const d = buildDemoPayload({ company: { name: "Novák", city: null }, profile: profile(), opportunity: o, nowIso: NOW, code: "abc23456" });
  assert.equal(d.template, "service_booking");
  assert.equal(d.business.name, "Autoservis Novák");
  assert.deepEqual(d.evidence.map((e) => e.field).sort(), ["city", "name", "services"]);
  assert.equal(d.expires_at, "2026-10-30T10:00:00.000Z");
  assert.ok(hasDemoTemplate("appointment") && hasDemoTemplate("project_pipeline") && !hasDemoTemplate("inquiry"));
});

test("Demo bez služieb nevymýšľa služby; segment bez šablóny = chyba", () => {
  const o = buildOpportunity(lead, "autoservis", profile({ services: [] }));
  const d = buildDemoPayload({ company: { name: "Novák", city: "Skalica" }, profile: profile({ services: [] }), opportunity: o, nowIso: NOW });
  assert.deepEqual(d.business.services, []);
  assert.ok(!d.evidence.some((e) => e.field === "services"));
  assert.equal(d.code.length, 8);
  const none: Opportunity = { ...o, recommended_system: null };
  assert.throws(() => buildDemoPayload({ company: { name: "X", city: null }, profile: null, opportunity: none, nowIso: NOW }), DemoError);
});
