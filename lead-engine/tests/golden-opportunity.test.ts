/**
 * Golden set Opportunity Engine v2: 10 typov firiem. Testuje hlavne falošnú príležitosť,
 * vymyslenú evidence, zlý routing a zlé odporúčanie. Firmy sú vymyslené.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOpportunity, type Opportunity } from "../lib/opportunity";
import { chooseChannel, type Channel } from "../lib/channel";
import { opportunityCallCard } from "../lib/call-card";
import { configuredOperators } from "../lib/operators";
import { forbiddenClaims } from "../lib/script";
import type { ModuleId } from "../lib/segments";
import type { PainCode } from "../lib/process";
import type { Company, Lead, RadarProfile } from "../lib/types";

const NOW = "2026-10-02T08:00:00.000Z";
type S = [code: string, level?: "OBSERVED" | "VERIFIED", confidence?: "high" | "medium" | "low"];

type Case = {
  name: string;
  category: string;
  web: NonNullable<Lead["website_status"]>;
  quality?: "gold" | "silver" | "research";
  activity?: "active" | "likely_active" | "inactive" | null;
  band?: "high" | "medium" | "low";
  signals: S[];
  health?: string[];
  confirmedWeb?: boolean;
  expect: {
    process: string;
    priority?: Opportunity["priority"];
    channel: Channel | "NOT_CALL";
    pains?: PainCode[];
    noPains?: PainCode[];
    primary?: ModuleId[];
    system?: null;
  };
};

const CASES: Case[] = [
  {
    name: "autoservis: termíny telefonicky, rezerváciu sme nenašli",
    category: "autoservis",
    web: "working",
    signals: [["PHONE_BOOKING"], ["NO_BOOKING_FOUND", "OBSERVED", "medium"], ["GENERIC_CONTACT_FORM", "VERIFIED"]],
    expect: { process: "HIGH", priority: "TOP", channel: "CALL", pains: ["MANUAL_BOOKING", "GENERIC_INQUIRY"], primary: ["smart_inquiry", "booking"] },
  },
  {
    name: "podlahár / remeselník: všeobecný formulár, fotky zvlášť, zameranie",
    category: "podlahy",
    web: "weak",
    signals: [["GENERIC_CONTACT_FORM", "VERIFIED"], ["PHOTO_UPLOAD_MISSING", "OBSERVED", "medium"], ["PHOTOS_REQUESTED_SEPARATELY"], ["MEASUREMENT_REQUIRED"]],
    health: ["no_tel_link"],
    expect: { process: "HIGH", priority: "TOP", channel: "CALL", pains: ["GENERIC_INQUIRY", "PHOTOS_VIA_MESSENGER", "MANUAL_MEASUREMENT_COORDINATION"], primary: ["smart_inquiry", "files_photos", "pipeline"] },
  },
  {
    name: "barber: na termín treba zavolať",
    category: "barber",
    web: "working",
    signals: [["CALL_FOR_APPOINTMENT"], ["NO_BOOKING_FOUND", "OBSERVED", "medium"]],
    expect: { process: "HIGH", priority: "TOP", channel: "CALL", pains: ["MANUAL_BOOKING", "NO_AUTOMATED_REMINDERS"], primary: ["booking"] },
  },
  {
    name: "beauty s online rezerváciou a dobrým webom: žiadna falošná príležitosť",
    category: "kozmetika",
    web: "working",
    signals: [["BOOKING_TOOL_PRESENT"]],
    expect: { process: "LOW", channel: "NOT_CALL", noPains: ["MANUAL_BOOKING", "NO_AUTOMATED_REMINDERS"] },
  },
  {
    name: "pneuservis: WhatsApp bez formulára a bez nahrávania fotiek",
    category: "pneuservis",
    web: "working",
    band: "medium",
    signals: [["WHATSAPP_PRIMARY"], ["PHOTO_UPLOAD_MISSING", "OBSERVED", "medium"], ["NO_FORM_FOUND", "OBSERVED", "medium"], ["NO_BOOKING_FOUND", "OBSERVED", "medium"]],
    expect: { process: "MEDIUM", priority: "NORMAL", channel: "NOT_CALL", pains: ["PHOTOS_VIA_MESSENGER", "MANUAL_FIRST_INTAKE"] },
  },
  {
    name: "firma bez webu: nič o webe netvrdíme, proces UNKNOWN",
    category: "elektrikar",
    web: "no_website",
    confirmedWeb: false,
    signals: [],
    expect: { process: "UNKNOWN", channel: "CALL", noPains: ["GENERIC_INQUIRY", "MANUAL_BOOKING"] },
  },
  {
    name: "dobrý web, slabý proces: cena až po telefóne, všeobecný formulár",
    category: "strechy",
    web: "working",
    signals: [["CALL_FOR_PRICE"], ["GENERIC_CONTACT_FORM", "VERIFIED"]],
    expect: { process: "HIGH", priority: "TOP", channel: "CALL", pains: ["MANUAL_QUOTE_PREP", "GENERIC_INQUIRY"], primary: ["smart_inquiry", "offers"] },
  },
  {
    name: "slabý web, ale segment bez systému (nulový automation fit)",
    category: "fotograf",
    web: "weak",
    signals: [["NO_FORM_FOUND", "OBSERVED", "medium"]],
    expect: { process: "MEDIUM", channel: "NOT_CALL", system: null },
  },
  {
    name: "neaktívna firma: nikdy na hovor",
    category: "autoservis",
    web: "weak",
    activity: "inactive",
    signals: [["PHONE_BOOKING"], ["NO_BOOKING_FOUND", "OBSERVED", "medium"]],
    expect: { process: "HIGH", priority: "LOW", channel: "NOT_CALL" },
  },
  {
    name: "nejasná identita (RESEARCH): nikdy na hovor",
    category: "podlahy",
    web: "weak",
    quality: "research",
    signals: [["GENERIC_CONTACT_FORM", "VERIFIED"]],
    expect: { process: "MEDIUM", priority: "LOW", channel: "NOT_CALL" },
  },
];

const HEALTH_TEXT: Record<string, string> = { no_tel_link: "Telefón sa na mobile nedá ťuknúť (chýba tel: odkaz)", no_https: "Web beží bez https" };

function build(c: Case) {
  const confirmed = c.confirmedWeb ?? true;
  const profile = {
    version: 1,
    country: "SK",
    brand_names: [`Firma ${c.category}`],
    city: "Nitra",
    services: [],
    business_status: c.activity === null ? null : { value: c.activity ?? "active", evidence: ["register"] },
    data_quality: c.quality ?? "gold",
    website_resolution: confirmed ? "confirmed" : "no_website_found",
    website: confirmed
      ? { url: "https://firma.example", status: "confirmed", evidence: [], health: { state: c.web, issues: (c.health ?? []).map((k) => ({ key: k, text: HEALTH_TEXT[k], excerpt: k })) } }
      : { url: null, status: "no_website_found", evidence: [] },
    register: { found: true, registry: "ORSR", dead: c.activity === "inactive" },
    primary_phone: { value: "+421905000000", confidence: "high", sources: ["katalog"] },
    category: { id: c.category, code: "X", confidence: "high", evidence: [] },
    process_signals: c.signals.map(([code, level, confidence]) => ({ key: code, code, level: level ?? "OBSERVED", text: code, excerpt: `úryvok ${code}`, source: "https://firma.example", observed_at: NOW, confidence: confidence ?? "high" })),
    tags: { ads_status: "NOT_FOUND", spend: "UNKNOWN", google_ads: null, ga4: null, gtm: null, meta_pixel: null },
  } as unknown as RadarProfile;
  const lead = { website_status: c.web, data_quality: c.quality ?? "gold", ads_check: null } as const;
  const o = buildOpportunity(lead, c.category, profile, { nowIso: NOW, companyName: `Firma ${c.category}` });
  const ch = chooseChannel({ category: c.category, score_band: c.band ?? "high", opportunity: o, has_phone: true, phone_verified: true, category_verified: true, has_email: false, do_not_contact: false, operators: configuredOperators(undefined) });
  return { o, ch, profile };
}

for (const c of CASES) {
  test(`golden: ${c.name}`, () => {
    const { o, ch, profile } = build(c);
    assert.equal(o.dimensions.PROCESS_PAIN.level, c.expect.process, "PROCESS_PAIN");
    if (c.expect.priority) assert.equal(o.priority, c.expect.priority, "priority");
    if (c.expect.channel === "NOT_CALL") assert.notEqual(ch.channel, "CALL", `routing: ${ch.reasons.join("; ")}`);
    else assert.equal(ch.channel, c.expect.channel, `routing: ${ch.reasons.join("; ")}`);
    for (const p of c.expect.pains ?? []) assert.ok(o.pains.some((x) => x.code === p), `chýba pain ${p}`);
    for (const p of c.expect.noPains ?? []) assert.ok(!o.pains.some((x) => x.code === p), `falošný pain ${p}`);
    if (c.expect.primary) assert.deepEqual(o.recommended_system?.primary_modules, c.expect.primary, "primary modules");
    if (c.expect.system === null) assert.equal(o.recommended_system, null);

    // fake evidence: všetko odkazuje na existujúcu evidence, každý pain má evidence
    const ids = new Set(o.evidence.map((e) => e.id));
    for (const p of o.pains) assert.ok(p.evidence_ids.length && p.evidence_ids.every((i) => ids.has(i)), `pain ${p.code}`);
    for (const w of o.why_lines) assert.ok(w.evidence_ids.every((i) => ids.has(i)));
    // CALL lead musí mať WHY a systém
    if (ch.channel === "CALL") {
      assert.ok(o.why_lines.length > 0 && o.recommended_system?.primary_modules.length);
      const card = opportunityCallCard({ company: { name: "F", city: "Nitra", category: c.category as Company["category"], phone: "+421905000000", website: null }, profile, opportunity: o, operatorName: "Roman", demoReady: false });
      assert.deepEqual(forbiddenClaims([card.opening, ...card.questions, ...card.why]), []);
      assert.doesNotMatch([card.opening, ...card.why].join(" "), /nemáte|určite|€/);
    }
    // nikdy eurá
    assert.doesNotMatch(JSON.stringify(o.money_leak), /€|eur/i);
  });
}
