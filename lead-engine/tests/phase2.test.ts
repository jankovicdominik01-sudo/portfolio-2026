/**
 * Phase 2: procesné signály, Opportunity v2, segment templates, Money Leak, demo,
 * kapacita fronty a Panenka ako regresný prípad. Firmy okrem Panenky sú vymyslené.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildOpportunity, opportunityState, readyOpportunity, analyzeOpportunity, type Opportunity } from "../lib/opportunity";
import { collectEvidence, derivePains, deriveWebGaps, normalizeSignals, PAIN_CODES, PROCESS_SIGNAL_CODES, reconstructProcess } from "../lib/process";
import { assertWritable, readOnlyRepository, ReadOnlyEnvironmentError, writesAllowed } from "../lib/db/guard";
import type { Repository } from "../lib/db/types";
import { MODULES, PIPELINE_STATES, relevantServices, SEGMENT_TEMPLATES, segmentFor } from "../lib/segments";
import { leakWithVolume } from "../lib/money-leak";
import { buildDemoPayload, DEMO_NOINDEX_HEADER, DEMO_ROBOTS, DemoError, publicDemoView } from "../lib/demo-templates";
import { opportunityCallCard } from "../lib/call-card";
import { chooseChannel } from "../lib/channel";
import { activeCount, capacityNeed, DEFAULT_QUEUE_TARGET } from "../lib/queue";
import { configuredOperators, DEFAULT_OPERATORS } from "../lib/operators";
import { forbiddenClaims } from "../lib/script";
import { CATEGORY_IDS, OpportunityFeedbackSchema, type Company, type Lead, type RadarProfile } from "../lib/types";

const NOW = "2026-10-02T08:00:00.000Z";
type Sig = { code: string; level?: string; text?: string; excerpt?: string; confidence?: "high" | "medium" | "low" };
const sig = (s: Sig) => ({ key: s.code, code: s.code, level: s.level ?? "OBSERVED", text: s.text ?? s.code, excerpt: s.excerpt ?? `úryvok ${s.code}`, source: "https://firma.example/kontakt", observed_at: NOW, confidence: s.confidence ?? "high" });

function profile(p: Partial<RadarProfile> & { signals?: Sig[] } = {}): RadarProfile {
  const { signals, ...rest } = p;
  return {
    version: 1,
    country: "SK",
    brand_names: ["Firma Test"],
    city: "Trnava",
    services: [],
    business_status: { value: "active", evidence: ["register: aktívna"] },
    data_quality: "gold",
    website_resolution: "confirmed",
    website: { url: "https://firma.example", status: "confirmed", evidence: [] },
    register: { found: true, registry: "ORSR", dead: false },
    primary_phone: { value: "+421905000000", confidence: "high", sources: ["web"] },
    category: { id: "ine", code: "X", confidence: "high", evidence: [] },
    process_signals: (signals ?? []).map(sig),
    tags: { ads_status: "NOT_FOUND", spend: "UNKNOWN", google_ads: null, ga4: null, gtm: null, meta_pixel: null },
    ...rest,
  } as RadarProfile;
}
type L = Pick<Lead, "website_status" | "data_quality" | "ads_check">;
const lead = (p: Partial<L> = {}): L => ({ website_status: "working", data_quality: "gold", ads_check: null, ...p });
const opp = (category: string, p: RadarProfile, l: L = lead()) => buildOpportunity(l, category, p, { nowIso: NOW, companyName: "Firma Test" });
const route = (category: string, o: Opportunity, band: "high" | "medium" | "low" = "high") =>
  chooseChannel({ category, score_band: band, opportunity: o, has_phone: true, phone_verified: true, category_verified: true, has_email: false, do_not_contact: false, operators: configuredOperators(undefined) });

/** Každé evidence id, na ktoré sa niečo odvoláva, musí existovať (žiadne vymyslené dôkazy). */
function assertEvidenceLinked(o: Opportunity) {
  const ids = new Set(o.evidence.map((e) => e.id));
  const refs = [
    ...o.pains.flatMap((p) => p.evidence_ids),
    ...o.why_lines.flatMap((w) => w.evidence_ids),
    ...Object.values(o.dimensions).flatMap((d) => d.evidence_ids),
    ...(o.recommended_system?.evidence_ids ?? []),
    ...o.process_model.steps.flatMap((s) => s.evidence_ids),
    ...(o.money_leak.estimate?.evidence_ids ?? []),
  ];
  for (const r of refs) assert.ok(ids.has(r), `neexistujúce evidence ${r}`);
  for (const p of o.pains) assert.ok(p.evidence_ids.length > 0, `pain ${p.code} bez evidence`);
  for (const s of o.process_model.steps) assert.ok(s.evidence_ids.length > 0, `krok ${s.text} bez evidence`);
}

/* ─────────── Procesné signály ─────────── */

test("signály: telefonické objednávanie z webu je OBSERVED s úryvkom a zdrojom", () => {
  const ev = normalizeSignals(profile({ signals: [{ code: "PHONE_BOOKING", excerpt: "Objednávky prijímame telefonicky" }] }));
  assert.equal(ev[0].code, "PHONE_BOOKING");
  assert.equal(ev[0].level, "OBSERVED");
  assert.equal(ev[0].excerpt, "Objednávky prijímame telefonicky");
  assert.equal(ev[0].source, "https://firma.example/kontakt");
  assert.equal(ev[0].observed_at, NOW);
});

test("signály: všeobecný formulár ostáva VERIFIED, WhatsApp a PDF cenník sa rozpoznajú", () => {
  const ev = normalizeSignals(profile({ signals: [{ code: "GENERIC_CONTACT_FORM", level: "VERIFIED" }, { code: "WHATSAPP_PRIMARY" }, { code: "PDF_PRICE_LIST", level: "VERIFIED" }] }));
  assert.deepEqual(ev.map((e) => [e.code, e.level]), [["GENERIC_CONTACT_FORM", "VERIFIED"], ["WHATSAPP_PRIMARY", "OBSERVED"], ["PDF_PRICE_LIST", "VERIFIED"]]);
});

test("signály: staré kľúče (pred Phase 2) sa preložia, neznáme sa zahodia", () => {
  const p = profile();
  p.process_signals = [
    { key: "phone_ordering", level: "OBSERVED", text: "t", excerpt: "objednavky telefonicky", source: "x" },
    { key: "messenger_cta", level: "OBSERVED", text: "t", excerpt: "https://wa.me/421900", source: "x" },
    { key: "booking_tool", level: "OBSERVED", text: "t", excerpt: "reservio", source: "x" },
    { key: "vymyslene", level: "OBSERVED", text: "t", excerpt: "x", source: "x" },
  ];
  assert.deepEqual(normalizeSignals(p).map((e) => e.code), ["PHONE_BOOKING", "WHATSAPP_PRIMARY", "BOOKING_TOOL_PRESENT"]);
});

test("signály: chýbajúce nahrávanie fotiek je OBSERVED „nenašli sme“, nie tvrdenie", () => {
  const ev = normalizeSignals(profile({ signals: [{ code: "PHOTO_UPLOAD_MISSING", text: "Možnosť priložiť fotky sme na webe nenašli", confidence: "medium" }] }));
  assert.equal(ev[0].level, "OBSERVED");
  assert.match(ev[0].text, /nenašli/);
  assert.doesNotMatch(ev[0].text, /nemajú|nemáte/);
  assert.equal(ev[0].confidence, "medium");
});

test("signály: bez prečítaného webu nie je nič a proces je UNKNOWN", () => {
  const o = opp("autoservis", profile({ process_signals: [] }));
  assert.equal(o.dimensions.PROCESS_PAIN.level, "UNKNOWN");
  assert.equal(o.process_model.level, "UNKNOWN");
  assert.deepEqual(o.process_model.steps, []);
  assert.ok(!o.pains.some((p) => p.code === "MANUAL_BOOKING"));
});

/* ─────────── Opportunity ─────────── */

test("opportunity: rovnaký vstup = rovnaký výstup (deterministické pravidlá)", () => {
  const p = profile({ signals: [{ code: "CALL_FOR_APPOINTMENT" }, { code: "NO_BOOKING_FOUND" }] });
  assert.deepEqual(opp("barber", p), opp("barber", p));
});

test("opportunity: WHY THIS LEAD má 1 až 3 vety a každá odkazuje na existujúcu evidence", () => {
  const o = opp("podlahy", profile({ signals: [{ code: "GENERIC_CONTACT_FORM", level: "VERIFIED" }, { code: "PHOTO_UPLOAD_MISSING" }, { code: "MEASUREMENT_REQUIRED" }] }));
  assert.ok(o.why_lines.length >= 1 && o.why_lines.length <= 3);
  assert.ok(o.why_lines.slice(1).every((w) => w.evidence_ids.length > 0));
  assertEvidenceLinked(o);
  assert.doesNotMatch(o.why_this_lead, /určite|tisíc|€|eur/i);
});

test("odporúčanie: fotky cez správy + všeobecný formulár → Smart Inquiry + Fotky", () => {
  const o = opp("stolarstvo", profile({ signals: [{ code: "PHOTOS_REQUESTED_SEPARATELY" }, { code: "GENERIC_CONTACT_FORM", level: "VERIFIED" }] }));
  const s = o.recommended_system!;
  assert.equal(s.basis, "evidence");
  assert.ok(s.primary_modules.includes("smart_inquiry") && s.primary_modules.includes("files_photos"));
  assert.ok(s.reasoning.some((r) => /Fotky a súbory/.test(r)));
  assert.ok(s.evidence_ids.length > 0);
});

test("odporúčanie: zameranie → pipeline; barber nikdy nedostane pipeline zákaziek", () => {
  assert.ok(opp("podlahy", profile({ signals: [{ code: "MEASUREMENT_REQUIRED" }] })).recommended_system!.primary_modules.includes("pipeline"));
  const b = opp("barber", profile({ signals: [{ code: "CALL_FOR_APPOINTMENT" }, { code: "MEASUREMENT_REQUIRED" }] })).recommended_system!;
  assert.ok(!b.primary_modules.includes("pipeline") && !b.optional_modules.includes("pipeline"));
  assert.ok(b.primary_modules.includes("booking"));
});

test("odporúčanie: bez painu iba hypotéza segmentu, označená na potvrdenie", () => {
  const o = opp("strechy", profile({ signals: [{ code: "BOOKING_TOOL_PRESENT" }] }), lead({ website_status: "weak" }));
  assert.equal(o.recommended_system?.basis, "segment");
  assert.match(o.recommended_system!.reasoning.join(" "), /potvrdiť v hovore/);
  assert.notEqual(o.dimensions.AUTOMATION_FIT.level, "HIGH");
});

test("reklama: tag ani ACTIVE nikdy sám nespraví TOP", () => {
  const p = profile({ tags: { ads_status: "TAG_PRESENT", spend: "UNKNOWN", google_ads: "AW-1", ga4: null, gtm: null, meta_pixel: null } });
  const o = opp("autoservis", p, lead({ ads_check: { status: "ACTIVE", url: "https://adstransparency.google.com/x", checked_at: NOW, by: "dominik" } }));
  assert.equal(o.dimensions.AD_SPEND_SIGNAL.level, "HIGH");
  assert.notEqual(o.priority, "TOP");
});

test("quality gate: telefón + starý web nestačia bez identity, aktivity alebo systému", () => {
  const weak = lead({ website_status: "weak", data_quality: "research" });
  assert.notEqual(route("autoservis", opp("autoservis", profile(), weak)).channel, "CALL");
  const inactive = profile({ business_status: { value: "inactive", evidence: ["register: zanikla"] } });
  assert.notEqual(route("autoservis", opp("autoservis", inactive, lead({ website_status: "weak" }))).channel, "CALL");
  const noTemplate = route("fotograf", opp("fotograf", profile(), lead({ website_status: "weak" })));
  assert.notEqual(noTemplate.channel, "CALL");
  assert.ok(noTemplate.rules.some((r) => r.key === "system" && !r.passed));
  const nothing = route("autoservis", opp("autoservis", profile({ signals: [{ code: "BOOKING_TOOL_PRESENT" }] })));
  assert.ok(nothing.rules.some((r) => r.key === "fit" && !r.passed));
});

test("stav analýzy: NOT_ANALYZED / ANALYZING / READY / FAILED, starý v1 = NOT_ANALYZED", () => {
  assert.equal(opportunityState(null), "NOT_ANALYZED");
  assert.equal(opportunityState({ version: 1, priority: "TOP" }), "NOT_ANALYZED");
  assert.equal(opportunityState({ version: 2, status: "ANALYZING" }), "ANALYZING");
  assert.equal(opportunityState({ version: 2, status: "FAILED", error: "x" }), "FAILED");
  const o = opp("autoservis", profile());
  assert.equal(opportunityState(o), "READY");
  assert.equal(readyOpportunity({ version: 2, status: "FAILED" }), null);
  const bad = analyzeOpportunity({ id: "l1", website_status: "weak", data_quality: "gold", ads_check: null }, { name: "X", category: "autoservis", profile: { process_signals: 5 } as unknown as RadarProfile });
  assert.equal(bad.status, "FAILED");
});

test("verzie pravidiel a run log sú pri každom výsledku", () => {
  const o = buildOpportunity(lead(), "autoservis", profile({ signals: [{ code: "PHONE_BOOKING" }] }), { nowIso: NOW, leadId: "ld_1" });
  assert.deepEqual(o.versions, { opportunity_engine: "2.0", segment_template: "1.0", money_leak: "1.0", process_signals: "1.0" });
  assert.equal(o.run.lead_id, "ld_1");
  assert.equal(o.run.signals_found, 1);
  assert.equal(o.run.demo_generated, false);
  assert.deepEqual(o.run.errors, []);
});

/* ─────────── Money Leak ─────────── */

test("Money Leak: žiadne eurá, odhad iba s predpokladmi, neznáme ostáva UNKNOWN", () => {
  const o = opp("podlahy", profile({ signals: [{ code: "GENERIC_CONTACT_FORM", level: "VERIFIED" }, { code: "PHOTOS_REQUESTED_SEPARATELY" }] }));
  const m = o.money_leak;
  assert.doesNotMatch(JSON.stringify(m), /€|eur/i);
  assert.equal(m.estimate?.level, "ESTIMATE");
  assert.deepEqual(m.estimate?.value, [4, 8]);
  assert.ok(m.estimate!.assumptions.length >= 2);
  assert.equal(m.weekly_inquiries, "UNKNOWN");
  assert.equal(m.annual_saving, "UNKNOWN");
  const v = leakWithVolume(m, 10)!;
  assert.deepEqual(v.minutes_per_week, [40, 80]);
  assert.equal(v.value_per_year, "UNKNOWN");
  assert.deepEqual(leakWithVolume(m, 10, 20)!.value_per_year, [Math.round(v.hours_per_year[0] * 20), Math.round(v.hours_per_year[1] * 20)]);
});

test("Money Leak: bez videného ručného kroku žiadny odhad", () => {
  const o = opp("podlahy", profile({ signals: [{ code: "NO_CUSTOMER_STATUS_FOUND", confidence: "low" }] }));
  assert.equal(o.money_leak.estimate, null);
  assert.equal(leakWithVolume(o.money_leak, 10), null);
  assert.match(o.money_leak.estimate_note, /neodhadujeme/);
});

/* ─────────── Segment templates ─────────── */

test("segment templates: platná schéma, známe moduly a stavy, kategórie bez prekryvu", () => {
  const seen = new Set<string>();
  for (const t of Object.values(SEGMENT_TEMPLATES)) {
    for (const m of [...t.recommended_modules, ...t.default_modules]) assert.ok(m in MODULES, `${t.segment}: modul ${m}`);
    assert.ok(t.default_modules.every((m) => t.recommended_modules.includes(m)));
    for (const s of t.pipeline_states) assert.ok(s in PIPELINE_STATES, `${t.segment}: stav ${s}`);
    assert.ok(t.demo_example.transition.every((s) => t.pipeline_states.includes(s)));
    const fields = t.intake_schema.map((f) => f.id);
    assert.ok(t.dashboard_fields.every((f) => fields.includes(f)), `${t.segment}: dashboard`);
    assert.ok(t.intake_schema.some((f) => f.type === "contact"));
    for (const c of t.likely_process_signals) assert.ok((PROCESS_SIGNAL_CODES as readonly string[]).includes(c));
    for (const p of [...t.relevant_pains, ...t.call_questions.flatMap((q) => q.confirms)]) assert.ok((PAIN_CODES as readonly string[]).includes(p));
    assert.ok(t.call_questions.length >= 2 && t.call_questions.length <= 3);
    assert.ok(t.minutes_per_inquiry.assumptions.length >= 2);
    for (const c of t.categories) {
      assert.ok((CATEGORY_IDS as readonly string[]).includes(c));
      assert.ok(!seen.has(c), `kategória ${c} je v dvoch segmentoch`);
      seen.add(c);
    }
  }
  assert.equal(segmentFor("podlahy")?.segment, "FLOORING_TRADES");
  assert.deepEqual(SEGMENT_TEMPLATES.FLOORING_TRADES.pipeline_states, ["NEW", "CONTACTED", "MEASUREMENT", "OFFER", "REALIZATION", "DONE"]);
  assert.equal(segmentFor("reality"), null);
});

test("služby do dema: iba tie, ktoré sedia k segmentu", () => {
  assert.deepEqual(relevantServices("podlahy", ["podlahy", "predaj rastlín a drevín", "Vinylové podlahy"]), ["podlahy", "Vinylové podlahy"]);
  assert.deepEqual(relevantServices("barber", ["Strih", "Úprava brady", "Predaj áut"]), ["Strih", "Úprava brady"]);
});

/* ─────────── Demo ─────────── */

test("demo: personalizácia iba z evidence, verejná projekcia bez interných polí, expirácia a vypnutie", () => {
  const p = profile({ brand_names: ["Barber Test"], services: ["Strih", "Úprava brady"], signals: [{ code: "CALL_FOR_APPOINTMENT" }, { code: "NO_BOOKING_FOUND" }] });
  const o = opp("barber", p);
  const d = buildDemoPayload({ company: { name: "Barber Test", city: "Trnava", category: "barber" }, profile: p, opportunity: o, nowIso: NOW, code: "abcdefgh2345" });
  assert.equal(d.segment, "BARBER_BEAUTY");
  assert.deepEqual(d.customer.fields.find((f) => f.id === "service")?.options, ["Strih", "Úprava brady", "Iné"]);
  const json = JSON.stringify(d);
  assert.doesNotMatch(json, /recenz|hodnoten|zákazníkov|rokov|tržb/i);
  const pub = publicDemoView({ ...d, score: 99, notes: "tajné", phone: "+421" }, Date.parse(NOW))!;
  assert.deepEqual(Object.keys(pub).sort(), ["business", "code", "customer", "dashboard", "expires_at", "notification", "personalized", "segment", "template", "version"]);
  assert.doesNotMatch(JSON.stringify(pub), /tajné|Lead Radar|score|\+421905/);
  assert.equal(publicDemoView(d, Date.parse("2026-12-01T00:00:00Z")), null);
  assert.equal(publicDemoView({ ...d, disabled: true }, Date.parse(NOW)), null);
  assert.equal(publicDemoView({ version: 1, code: "x" }, Date.parse(NOW)), null);
});

test("demo: noindex, DEMO POTENTIAL LOW sa negeneruje bez vedomého force", () => {
  assert.equal(DEMO_ROBOTS.index, false);
  assert.match(DEMO_NOINDEX_HEADER, /noindex/);
  const o = opp("autoservis", profile({ brand_names: [] }), lead({ data_quality: "research" }));
  assert.equal(o.dimensions.DEMO_POTENTIAL.level, "LOW");
  assert.throws(() => buildDemoPayload({ company: { name: "X", city: null, category: "autoservis" }, profile: profile(), opportunity: o, nowIso: NOW }), DemoError);
  assert.doesNotThrow(() => buildDemoPayload({ company: { name: "X", city: null, category: "autoservis" }, profile: profile(), opportunity: o, nowIso: NOW, force: true }));
});

test("DEMO POTENTIAL HIGH iba s menom, službami, jasným painom, šablónou a identitou", () => {
  const full = opp("barber", profile({ services: ["Strih"], signals: [{ code: "CALL_FOR_APPOINTMENT" }] }));
  assert.equal(full.dimensions.DEMO_POTENTIAL.level, "HIGH");
  const noServices = opp("barber", profile({ services: [], signals: [{ code: "CALL_FOR_APPOINTMENT" }] }));
  assert.equal(noServices.dimensions.DEMO_POTENTIAL.level, "MEDIUM");
});

/* ─────────── Call Card v3 a spätná väzba ─────────── */

test("Call Card v3: max. 3 fakty, 2 až 3 otázky z predpokladov, predpoklady na potvrdenie", () => {
  const p = profile({ signals: [{ code: "GENERIC_CONTACT_FORM", level: "VERIFIED" }, { code: "PHOTOS_REQUESTED_SEPARATELY" }, { code: "MEASUREMENT_REQUIRED" }, { code: "PHOTO_UPLOAD_MISSING" }] });
  const o = opp("podlahy", p);
  const c = opportunityCallCard({ company: { name: "Podlahy Test", city: "Trnava", category: "podlahy", phone: "+421905000000", website: "https://firma.example" }, profile: p, opportunity: o, operatorName: "Roman", demoReady: true });
  assert.equal(c.facts.length, 3);
  assert.equal(c.facts[0].level, "VERIFIED");
  assert.ok(c.questions.length >= 2 && c.questions.length <= 3);
  assert.match(c.questions[0], /čo od neho potrebujete vedieť/);
  assert.ok(c.hypotheses.some((h) => h.code === "PHOTOS_VIA_MESSENGER"));
  assert.equal(c.opening.split(/[.?!]\s/).length, 1, "opening je jedna veta");
  assert.deepEqual(forbiddenClaims([c.opening, ...c.questions, ...c.why]), []);
});

test("opportunity_feedback: dátový kontrakt CONFIRM / REJECT / UNKNOWN", () => {
  const ok = OpportunityFeedbackSchema.parse({ signal_code: "MANUAL_BOOKING", predicted: "Zákazník musí volať", result: "confirmed", note: null, operator_id: "roman", at: NOW });
  assert.equal(ok.result, "confirmed");
  assert.throws(() => OpportunityFeedbackSchema.parse({ ...ok, result: "maybe" }));
  assert.throws(() => OpportunityFeedbackSchema.parse({ ...ok, signal_code: "drop table" }));
});

/* ─────────── Kapacita Romanovej fronty ─────────── */

test("kapacita: cieľ 20, 13 aktívnych → doplniť 7; 20 → 0; 25 → 0", () => {
  assert.equal(DEFAULT_QUEUE_TARGET, 20);
  assert.equal(capacityNeed(13), 7);
  assert.equal(capacityNeed(20), 0);
  assert.equal(capacityNeed(25), 0);
  assert.equal(capacityNeed(0, 12), 12);
  assert.equal(DEFAULT_OPERATORS[0].queue_target, null);
  assert.equal(configuredOperators(JSON.stringify([{ operator_id: "roman", name: "Roman", status: "ACTIVE", queue_target: 15 }]))[0].queue_target, 15);
});

test("kapacita: rátajú sa iba nevybavené (na volanie, opakovaný pokus, callback)", () => {
  const co = (dnc = false) => ({ id: "c", do_not_call: dnc }) as unknown as Company;
  const l = (status: Lead["status"], next_action: string | null, extra: Partial<Lead & { company: Company }> = {}) =>
    ({ id: Math.random().toString(), assigned_to: "roman", status, next_action, company: co(), ...extra }) as unknown as Lead & { company: Company };
  const leads = [
    l("ready_to_call", "caller_call"),
    l("called", "caller_call"),
    l("called", "callback"),
    l("dominik_call", "dominik_call"),
    l("lost", null),
    l("do_not_call", null),
    l("archived", null),
    l("analyzed", "async_message"),
    l("ready_to_call", "caller_call", { company: co(true) }),
    l("ready_to_call", "caller_call", { assigned_to: "iny" }),
  ];
  assert.equal(activeCount(leads, "roman"), 3);
});

/* ─────────── Panenka: regresný prípad z reálnych uložených dát ─────────── */

const PANENKA = JSON.parse(readFileSync(new URL("./fixtures/panenka.json", import.meta.url), "utf8")) as {
  company: { name: string; category: string; city: string; website: string; phone: string };
  lead: L;
  profile: RadarProfile;
};

test("PANENKA: medzery webu sú VERIFIED, ručný proces UNKNOWN, žiadny vymyslený pain", () => {
  const o = opp(PANENKA.company.category, PANENKA.profile, PANENKA.lead);
  assert.equal(o.segment, "FLOORING_TRADES");
  // Uložené sú iba overené problémy webu (bez https, bez tel: odkazu). Procesné signály nie sú.
  assert.deepEqual(o.pains, []);
  assert.deepEqual(o.web_gaps.map((g) => [g.code, g.level]), [["MOBILE_CONTACT_FRICTION", "VERIFIED"], ["TRUST_SECURITY_GAP", "VERIFIED"]]);
  assert.equal(o.call_reason.type, "WEB_SYSTEM");
  assert.ok(o.call_reason.unknown.some((u) => /Ručný proces: UNKNOWN/.test(u)));
  assert.equal(o.dimensions.PROCESS_PAIN.level, "UNKNOWN");
  assert.equal(o.dimensions.VISUAL_GAP.level, "MEDIUM");
  assert.equal(o.dimensions.BUSINESS_ACTIVITY.level, "HIGH");
  assert.equal(o.process_model.level, "UNKNOWN");
  assert.equal(o.money_leak.estimate, null);
  assert.match(o.why_this_lead, /Ručný proces zatiaľ nepoznáme/);
  assert.doesNotMatch(o.why_this_lead, /príjem dopyt|intake|zákazník ťažšie ozve|ručne vybavuje/i);
  assertEvidenceLinked(o);
});

test("PANENKA: systém je iba hypotéza segmentu (Smart Inquiry + Fotky), fit MEDIUM", () => {
  const o = opp(PANENKA.company.category, PANENKA.profile, PANENKA.lead);
  const s = o.recommended_system!;
  assert.equal(s.basis, "segment");
  assert.deepEqual(s.primary_modules, ["smart_inquiry", "files_photos"]);
  assert.deepEqual(s.evidence_ids, []);
  assert.match(s.reasoning.join(" "), /potvrdiť v hovore/);
  assert.equal(o.dimensions.AUTOMATION_FIT.level, "MEDIUM");
  assert.ok(s.optional_modules.every((m) => SEGMENT_TEMPLATES.FLOORING_TRADES.recommended_modules.includes(m)));
});

test("PANENKA: Call Card hovorí, čo vieme a čo treba zistiť; routing na Romana; demo bez cudzích služieb", () => {
  const o = opp(PANENKA.company.category, PANENKA.profile, PANENKA.lead);
  const c = opportunityCallCard({ company: { ...PANENKA.company, category: "podlahy" }, categoryLabel: "Podlahy", profile: PANENKA.profile, opportunity: o, operatorName: "Roman", demoReady: true });
  assert.equal(c.call_reason.type, "WEB_SYSTEM");
  assert.ok(c.known.some((k) => /^VERIFIED: Telefón sa na mobile nedá ťuknúť/.test(k)));
  assert.ok(c.unknown.some((u) => /Ručný proces: UNKNOWN/.test(u)));
  assert.match(c.opening, /telefón sa na mobile nedá rovno ťuknúť/);
  assert.deepEqual(c.facts.map((f) => f.level), ["VERIFIED", "VERIFIED"]);
  assert.ok(c.questions.length >= 2);
  assert.ok(c.hypotheses.length > 0 && c.hypotheses.every((h) => /hypotéza segmentu/.test(h.text)), "proces sa iba zisťuje");
  const r = route("podlahy", o);
  assert.equal(r.channel, "CALL");
  assert.equal(r.operator_id, "roman");
  assert.ok(r.rules.some((x) => x.key === "fit" && x.passed && /WEB \/ SYSTEM/.test(x.label)));
  const d = buildDemoPayload({ company: { name: PANENKA.company.name, city: PANENKA.company.city, category: "podlahy" }, profile: PANENKA.profile, opportunity: o, nowIso: NOW });
  assert.deepEqual(d.business.services, ["podlahy"]);
  assert.equal(d.customer.fields.find((f) => f.id === "location")?.example, "Praha 10-Vršovice");
  assert.deepEqual([d.dashboard.from, d.dashboard.to], ["NEW", "MEASUREMENT"]);
});

test("dôvod hovoru: A (proces) je v poradí nad B (web / systém) pri inak podobných dátach", () => {
  const a = opp("podlahy", profile({ signals: [{ code: "MEASUREMENT_REQUIRED" }] }), lead({ website_status: "weak" }));
  const b = opp("podlahy", { ...PANENKA.profile, process_signals: [] }, lead({ website_status: "weak" }));
  assert.equal(a.call_reason.type, "PROCESS");
  assert.equal(b.call_reason.type, "WEB_SYSTEM");
  assert.ok(a.rank > b.rank, `${a.rank} > ${b.rank}`);
});

test("WEAK_MOBILE_INTAKE iba keď je formulár a web nie je pre mobil; no_https ani tel: odkaz nie sú pain", () => {
  const issue = (key: string, text: string) => ({ key, text, excerpt: key });
  const web = (issues: { key: string; text: string; excerpt: string }[]) =>
    ({ url: "https://firma.example", domain: "firma.example", status: "confirmed", evidence: [], health: { state: "weak", issues } }) as RadarProfile["website"];
  const onlyHttps = opp("podlahy", profile({ website: web([issue("no_https", "bez https"), issue("no_tel_link", "chýba tel:")]) }), lead({ website_status: "weak" }));
  assert.deepEqual(onlyHttps.pains, []);
  const noForm = opp("podlahy", profile({ website: web([issue("no_viewport", "bez viewport")]) }), lead({ website_status: "weak" }));
  assert.ok(!noForm.pains.some((p) => p.code === "WEAK_MOBILE_INTAKE"));
  const withForm = opp("podlahy", profile({ website: web([issue("no_viewport", "bez viewport")]), signals: [{ code: "GENERIC_CONTACT_FORM", level: "VERIFIED" }] }), lead({ website_status: "weak" }));
  assert.ok(withForm.pains.some((p) => p.code === "WEAK_MOBILE_INTAKE"));
});

/* ─────────── evidence vrstva ─────────── */

test("evidence: register a problémy webu sú VERIFIED, aktivita OBSERVED; z problémov webu nie je pain", () => {
  const ev = collectEvidence(PANENKA.lead, PANENKA.profile);
  assert.ok(ev.some((e) => e.code === "register:active" && e.level === "VERIFIED"));
  assert.ok(ev.some((e) => e.code === "web:no_tel_link" && e.level === "VERIFIED"));
  assert.ok(ev.some((e) => e.code === "activity:active" && e.level === "OBSERVED"));
  assert.doesNotMatch(JSON.stringify(ev), /Roman PANENKA|16185749/);
  assert.equal(derivePains(ev, segmentFor("podlahy")).length, 0);
  assert.equal(deriveWebGaps(ev).length, 2);
  assert.equal(reconstructProcess(ev).level, "UNKNOWN");
});

/* ─────────── Preview je iba na čítanie ─────────── */

test("preview guard: zápis iba v produkcii a lokálne, preview a chýbajúci VERCEL_ENV na Verceli = zákaz", () => {
  assert.equal(writesAllowed({ VERCEL: "1", VERCEL_ENV: "production" }), true);
  assert.equal(writesAllowed({}), true); // lokálne
  assert.equal(writesAllowed({ VERCEL: "1", VERCEL_ENV: "preview" }), false);
  assert.equal(writesAllowed({ VERCEL: "1", VERCEL_ENV: "development" }), false);
  assert.equal(writesAllowed({ VERCEL: "1" }), false);
  assert.throws(() => assertWritable("x", { VERCEL: "1", VERCEL_ENV: "preview" }), ReadOnlyEnvironmentError);
});

test("preview guard: read-only repository čítanie pustí, každý zápis odmietne bez volania úložiska", async () => {
  let writes = 0;
  const repo = new Proxy({} as Repository, {
    get: (_t, prop) => (typeof prop === "string" ? async () => (/^(insert|update|upsert|delete|save|mark)/.test(prop) ? writes++ : []) : undefined),
  });
  const ro = readOnlyRepository(repo);
  assert.deepEqual(await ro.listLeads(), []);
  for (const m of ["insertLead", "updateLead", "insertCall", "upsertCommission", "saveSettings", "insertEvent", "updateCompany", "markNotificationsRead", "deleteOffer"] as const) {
    await assert.rejects((ro[m] as (...a: unknown[]) => Promise<unknown>)("x", {}), ReadOnlyEnvironmentError, m);
  }
  assert.equal(writes, 0);
});
