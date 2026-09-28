import { test } from "node:test";
import assert from "node:assert/strict";
import { routeLead, effectiveRouting, defaultRouting, categoriesFor } from "../lib/routing";
import { applyFeedback } from "../lib/feedback";
import { buildCallCard, truthCard, webClaimAllowed } from "../lib/script";
import { identityMatch } from "../lib/identity";
import { dataQuality } from "../lib/quality";
import { normalizeCategory, type RadarProfile } from "../lib/types";
import { NOW, OFFER, company, lead } from "./fixtures";

const ACTIVE = ["sona", "jozo"];

function profile(p: Partial<RadarProfile> = {}): RadarProfile {
  return {
    version: 1,
    country: "SK",
    brand_names: ["Drevo Novák"],
    historical_names: [],
    addresses: [],
    company_ids: [],
    phones: [{ value: "+421905111222", confidence: "high", sources: ["azet", "website"], evidence: [] }],
    emails: [],
    primary_phone: { value: "+421905111222", confidence: "high", sources: ["azet", "website"] },
    website: { url: null, domain: null, status: "no_website_found", confidence: null, evidence: [], health: null },
    websites: [],
    historical_websites: [],
    rejected_websites: [],
    socials: [],
    category: { id: "stolarstvo", code: "CUSTOM_FURNITURE", subcategory: "nábytok na mieru", confidence: "high", evidence: [] },
    services: [],
    description: { text: "Nábytok na mieru.", confidence: "high", sources: ["web", "instagram"] },
    business_status: { value: "active", evidence: [] },
    commercial_problems: [],
    social_first: false,
    identity: { confidence: "high", evidence: ["register: X"] },
    data_quality: "gold",
    data_quality_why: [],
    recommended_caller: "jozo",
    caller_fit: null,
    score: { points: 60, reasons: [] },
    sources: [],
    possible_duplicates: [],
    source_unavailable: [],
    register: null,
    last_verified: {},
    trace: [],
    exploration: false,
    web_search_queries: [],
    ...p,
  } as RadarProfile;
}

/* ─────────── Routing (spec 44) ─────────── */

test("default routing: beauty/makeup/reality → Soňa; stavba/elektrikár/záhrady → Jozo", () => {
  const r = effectiveRouting(null);
  for (const c of ["kadernictvo", "makeup", "reality", "kozmetika", "nechty", "fotograf", "interier"]) assert.equal(r[c], "sona", c);
  for (const c of ["stavebnictvo", "elektrikar", "zahradnictvo", "stolarstvo", "autoservis", "detailing"]) assert.equal(r[c], "jozo", c);
});

test("routing je konfigurovateľný a neaktívny volajúci má fallback", () => {
  const r = effectiveRouting({ routing: { kadernictvo: "jozo" } });
  assert.equal(routeLead("kadernictvo", "sona", r, ACTIVE).caller, "jozo");
  assert.equal(routeLead("elektrikar", null, effectiveRouting(null), ["sona"]).caller, "sona");
  assert.equal(routeLead("elektrikar", "jozo", effectiveRouting(null), ACTIVE).caller, "jozo");
});

test("každý má vlastné segmenty — nie všetci dostanú záhradníctvo", () => {
  const r = defaultRouting();
  const sona = categoriesFor("sona", r);
  const jozo = categoriesFor("jozo", r);
  assert.ok(!sona.includes("zahradnictvo"));
  assert.ok(sona.length >= 8 && jozo.length >= 12);
  assert.equal(sona.filter((c) => jozo.includes(c)).length, 0);
});

test("nové kategórie sa rozpoznajú z textu", () => {
  assert.equal(normalizeCategory("Kaderníctvo"), "kadernictvo");
  assert.equal(normalizeCategory("barbershop"), "barber");
  assert.equal(normalizeCategory("Realitná kancelária"), "reality");
  assert.equal(normalizeCategory("kuchyne na mieru"), "kuchyne");
});

/* ─────────── Pravdivá karta (spec 24, 25) ─────────── */

test("CASE A: social-first — nikdy „nemáte web“, iba otázka cez Instagram/Facebook", () => {
  const p = profile({
    socials: [{ platform: "instagram", url: "https://www.instagram.com/drevo.novak/", handle: "drevo.novak", match: "confirmed", evidence: [] }],
    commercial_problems: [{ code: "SOCIAL_FIRST_BUSINESS", label: "Firma funguje hlavne cez Instagram/Facebook, samostatný web sme nenašli", evidence: [] }],
    social_first: true,
  });
  const t = truthCard(p, lead(), "m", NOW);
  assert.match(t.angle, /našiel som vás hlavne cez Instagram\. Máte aj vlastnú stránku\?/);
  assert.doesNotMatch(t.angle, /nemáte/);
  assert.ok(t.dont_say.some((d) => /Nehovor „nemáte web“/.test(d)));
  assert.equal(t.web.label, "Web sme nenašli");
});

test("CASE B: potvrdený nefunkčný web → smie povedať, že nefunguje", () => {
  const p = profile({
    website: { url: "https://novak.sk", domain: "novak.sk", status: "confirmed", confidence: "high", evidence: [], health: { state: "broken", issues: [{ key: "parked", text: "prázdna stránka hostingu", points: 8 }] } },
  });
  const t = truthCard(p, lead({ website_checked_at: NOW }), "f", NOW);
  assert.match(t.angle, /novak\.sk a všimla som si, že momentálne nefunguje/);
  assert.ok(t.dont_say.some((d) => /Nehovor, že nemajú web — majú potvrdený web novak\.sk/.test(d)));
});

test("CASE C: SOCIAL_WEB_GAP — Instagram ukazuje prácu, web nie", () => {
  const p = profile({
    website: { url: "https://novak.sk", domain: "novak.sk", status: "confirmed", confidence: "high", evidence: [], health: { state: "weak", issues: [{ key: "no_portfolio", text: "Web neukazuje realizácie", points: 3 }] } },
    commercial_problems: [{ code: "SOCIAL_WEB_GAP", label: "x", evidence: [] }],
  });
  const t = truthCard(p, lead({ website_checked_at: NOW }), "f", NOW);
  assert.match(t.angle, /Instagrame vyzerajú fakt dobre — na stránke som ich ale nenašla/);
});

test("neistý web → karta iba pýta; bez overeného popisu to karta prizná", () => {
  const p = profile({ website: { url: null, domain: null, status: "uncertain", confidence: null, evidence: [], health: null }, description: { text: "x", confidence: "unknown", sources: [] } });
  const t = truthCard(p, lead(), "f", NOW);
  assert.match(t.angle, /nie som si istá, či máte aktuálnu stránku/);
  assert.equal(t.does.verified, false);
  assert.match(t.does.text, /nepodarilo spoľahlivo overiť/);
});

test("buildCallCard s profilom: uhol hovoru z reality + zákaz sľubov mimo balíka", () => {
  const c = company({ profile: profile({ website: { url: "https://novak.sk", domain: "novak.sk", status: "confirmed", confidence: "high", evidence: [], health: { state: "working", issues: [] } } }) });
  const card = buildCallCard({ lead: lead({ website_resolution: "confirmed" }), company: c, callerName: "Jozo", speech: "m", offers: [OFFER], nowIso: NOW });
  assert.ok(card.truth);
  assert.ok(card.cautions.some((x) => /Nehovor, že nemajú web/.test(x)));
  assert.ok(card.cautions.some((x) => /SEO, hosting, e-shop/.test(x)));
});

test("tvrdenie o webe iba pri POTVRDENOM webe", () => {
  assert.equal(webClaimAllowed({ website_status: "broken", website_checked_at: NOW, website_resolution: "probable" }, NOW), false);
  assert.equal(webClaimAllowed({ website_status: "broken", website_checked_at: NOW, website_resolution: "confirmed" }, NOW), true);
});

/* ─────────── Feedback (spec 26, 54) ─────────── */

test("„Má web, systém ho nenašiel“ → URL sa uloží, web NEISTÝ, lead na preverenie", () => {
  const c = company({ profile: profile() });
  const r = applyFeedback(lead(), c, { kind: "has_other_web", url: "https://novy-web.sk", note: null }, "sona", NOW, "fb_1");
  assert.equal(r.lead.website_resolution, "uncertain");
  assert.equal(r.lead.needs_reverify, true);
  assert.ok((r.company.profile?.websites ?? []).some((w) => w.domain === "novy-web.sk"));
});

test("„Zlý web“ → doména sa odmietne a už sa nepriradí", () => {
  const c = company({ website: "https://cudzi.sk", profile: profile({ website: { url: "https://cudzi.sk", domain: "cudzi.sk", status: "confirmed", confidence: "high", evidence: [], health: null } }) });
  const r = applyFeedback(lead(), c, { kind: "wrong_web", url: null, note: null }, "jozo", NOW, "fb_2");
  assert.ok((r.company.profile?.rejected_websites ?? []).some((w) => w.domain === "cudzi.sk"));
  assert.equal(r.company.website, null);
});

test("„Firma už neexistuje“ → z fronty volajúceho na kontrolu", () => {
  const r = applyFeedback(lead(), company(), { kind: "business_gone", url: null, note: null }, "sona", NOW, "fb_3");
  assert.equal(r.lead.status, "analyzed");
  assert.equal(r.lead.next_action, "review");
});

/* ─────────── Identita SK/CZ + kvalita dát ─────────── */

test("rovnaký názov v SK a CZ nie je jedna firma", () => {
  const existing = company({ country: "SK", dedupe_keys: ["name:studio-bella|bratislava"] });
  assert.equal(identityMatch(existing, { name: "Studio Bella", city: "Brno", phone: null, email: null, website: null, country: "CZ" }).same, false);
});

test("caller trust rate = volané leady bez opravy dát / volané leady", () => {
  const base = { company: company({ profile: profile() }) };
  const a = { ...lead({ id: "a" }), ...base };
  const b = { ...lead({ id: "b", feedback: [{ id: "f", kind: "wrong_web", note: null, url: null, by: "sona", at: NOW, resolved_at: null }] }), ...base };
  const calls = ["a", "b"].map((id) => ({ id: `c_${id}`, lead_id: id, role: "caller" as const, by: "Soňa", by_user: "sona", outcome: "not_interested", note: null, created_at: NOW }));
  const q = dataQuality([a, b], calls as never);
  assert.equal(q.callerTrust.den, 2);
  assert.equal(q.callerTrust.num, 1);
  assert.equal(q.feedback.wrong_web, 1);
});
