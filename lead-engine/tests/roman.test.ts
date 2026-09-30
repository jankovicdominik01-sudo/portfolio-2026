/**
 * Roman ako prvý operátor: účet, oprávnenia, výsledky hovoru, Dominik follow-up,
 * lievik, migrácia histórie (Panenka) a regresia „nový lead nikdy nedostane pôvodných volajúcich“.
 *
 * Pôvodné identity sa tu vyskytujú iba ako historický fixture pre migráciu.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { accountAllowed, DEV_USERS, hashPassword, parseUsers, passwordMatches, usersFor } from "../lib/users";
import { configuredOperators, DEFAULT_OPERATORS } from "../lib/operators";
import { applyCallerOutcome, slotAt, WorkflowError } from "../lib/workflow";
import { routeLead, effectiveRouting } from "../lib/routing";
import { chooseChannel } from "../lib/channel";
import { buildOpportunity } from "../lib/opportunity";
import { opportunityCallCard } from "../lib/call-card";
import { operatorFunnel, channelComparison } from "../lib/funnel";
import { planMigration, LEGACY_OPERATOR_ID, type Snapshot } from "../lib/migrations/retire-legacy-callers";
import { defaultSettings, type CallLog, type Company, type Lead, type LeadEvent, type RadarProfile } from "../lib/types";
import { company, lead, NOW, ROMAN } from "./fixtures";

/* ─────────── účet a oprávnenia ─────────── */

test("Roman má vlastný účet z LE_USERS s rolou caller, nie admin", () => {
  const users = parseUsers("dominik|Dominik Jankovič|admin|scrypt$a$b;roman|Roman|caller|scrypt$c$d|m");
  const r = users.find((u) => u.username === "roman")!;
  assert.equal(r.role, "caller");
  assert.equal(r.speech, "m");
  assert.ok(r.active);
});

test("volajúci sa prihlási iba so záznamom operátora ACTIVE alebo PAUSED", () => {
  const ops = configuredOperators(undefined);
  assert.ok(accountAllowed({ username: "roman", role: "caller", active: true }, ops));
  assert.ok(accountAllowed({ username: "dominik", role: "admin", active: true }, ops));
  // účet s rolou caller bez operátora (napr. zabudnutý riadok v env) sa neprihlási
  assert.equal(accountAllowed({ username: "niekto", role: "caller", active: true }, ops), false);
  assert.equal(accountAllowed({ username: "roman", role: "caller", active: false }, ops), false);
  const paused = [{ ...DEFAULT_OPERATORS[0], status: "PAUSED" as const }];
  const off = [{ ...DEFAULT_OPERATORS[0], status: "INACTIVE" as const }];
  assert.ok(accountAllowed({ username: "roman", role: "caller", active: true }, paused));
  assert.equal(accountAllowed({ username: "roman", role: "caller", active: true }, off), false);
});

test("heslo: scrypt hash sa overí, zlé heslo nie", async () => {
  const h = await hashPassword("dlhe-heslo-romana");
  assert.match(h, /^scrypt\$/);
  assert.ok(await passwordMatches(h, "dlhe-heslo-romana"));
  assert.equal(await passwordMatches(h, "ine-heslo"), false);
  assert.equal(await passwordMatches("scrypt$zly", "x"), false);
});

test("PRODUKCIA fail-safe: bez LE_USERS sa nikto neprihlási, žiadny účet z kódu", () => {
  for (const raw of [undefined, "", "   "]) {
    const c = usersFor(raw, "production");
    assert.deepEqual(c.users, []);
    assert.equal(c.demo, false);
    assert.ok(c.error);
  }
});

test("PRODUKCIA fail-safe: heslo v čistom texte alebo chýbajúci admin = nikto sa neprihlási", async () => {
  const h = await hashPassword("dlhe-heslo-admina");
  assert.deepEqual(usersFor(`admin|Admin|admin|${h};roman|Roman|caller|heslo123|m`, "production").users, []);
  assert.deepEqual(usersFor(`roman|Roman|caller|${h}|m`, "production").users, []);
  const ok = usersFor(`admin|Admin|admin|${h};roman|Roman|caller|${h}|m`, "production");
  assert.equal(ok.error, null);
  assert.deepEqual(ok.users.map((u) => u.username), ["admin", "roman"]);
});

test("DEV účty sú iba lokálne, jasne označené a nemajú produkčné mená ani hashe", () => {
  const dev = usersFor(undefined, "development");
  assert.equal(dev.demo, true);
  assert.deepEqual(dev.users.map((u) => u.username), ["dev-admin", "roman"]);
  assert.ok(DEV_USERS.every((u) => !u.password.startsWith("scrypt$")));
  assert.ok(DEV_USERS.every((u) => /dev/i.test(u.name) || /dev/i.test(u.password)));
});

test("repozitár neobsahuje žiadny produkčný scrypt hash", () => {
  const root = join(__dirname, "..");
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (["node_modules", ".next", ".data", "tests"].includes(f)) continue;
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx|md|example|json|py)$/.test(f) && /scrypt\$[A-Za-z0-9_-]{8,}\$[A-Za-z0-9_-]{20,}/.test(readFileSync(p, "utf8"))) hits.push(p);
    }
  };
  walk(root);
  assert.deepEqual(hits, []);
});

/* ─────────── regresia: nikto iný než aktívny operátor ─────────── */

test("REGRESIA: nový lead nedostane nikto mimo aktívnych operátorov z konfigurácie", () => {
  const ops = configuredOperators(undefined);
  const active = ops.filter((o) => o.status === "ACTIVE").map((o) => o.operator_id);
  assert.deepEqual(active, ["roman"]);
  // aj keby routing alebo radar ukazovali na starý účet, lead ide Romanovi
  const r = effectiveRouting({ routing: { kadernictvo: "sona", autoservis: "jozo" } });
  for (const [cat, rec] of [["kadernictvo", "sona"], ["autoservis", "jozo"], ["elektrikar", "jozo"]] as const) {
    assert.equal(routeLead(cat, rec, r, active).caller, "roman", cat);
  }
  // a účty so starými menami sa nevedia prihlásiť
  for (const u of ["sona", "jozo"]) assert.equal(accountAllowed({ username: u, role: "caller", active: true }, ops), false);
});

test("REGRESIA: runtime kód, UI ani radar nepoznajú pôvodných volajúcich", () => {
  const root = join(__dirname, "..");
  const rx = /(?<![\p{L}])(so[nň]a|so[nň]in\p{L}*|jo[zž]o|jo[zž]a|jo[zž]ov\p{L}*)(?![\p{L}])/iu;
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (["node_modules", ".next", ".data", "tests", "migrations"].includes(f)) continue;
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx|py|md|sql|example|json)$/.test(f) && !/package-lock/.test(f) && !f.startsWith("test_")) {
        readFileSync(p, "utf8")
          .split("\n")
          .forEach((line, i) => rx.test(line) && hits.push(`${p.slice(root.length)}:${i + 1}`));
      }
    }
  };
  for (const d of ["lib", "app", "components", "routine", "scripts", "supabase"]) walk(join(root, d));
  for (const f of ["README.md", ".env.example"]) {
    readFileSync(join(root, f), "utf8")
      .split("\n")
      .forEach((line, i) => rx.test(line) && hits.push(`${f}:${i + 1}`));
  }
  assert.deepEqual(hits, []);
});

/* ─────────── výsledky hovoru ─────────── */

const talk = { contact_person: "p. Panenka", company_said: "Nech sa ozve.", caught_attention: "fotky z realizácií", heard_price: false, call_on: "2026-10-01", call_note: "po 15:00", email: null };

test("slotAt: čas je slovenský (letný aj zimný)", () => {
  assert.equal(slotAt("2026-10-01", "15:30"), "2026-10-01T13:30:00.000Z");
  assert.equal(slotAt("2026-11-04", "15:30"), "2026-11-04T14:30:00.000Z");
  assert.equal(slotAt("2026-11-04", null), "2026-11-04T08:00:00.000Z");
});

test("CALL BACK: dátum aj čas, ostáva operátorovi", () => {
  const r = applyCallerOutcome(lead(), ROMAN, { outcome: "call_later", note: null, callback_on: "2026-09-30", callback_time: "10:15", consent: null }, NOW);
  assert.equal(r.leadPatch.status, "called");
  assert.equal(r.leadPatch.next_action, "callback");
  assert.equal(r.leadPatch.next_action_at, "2026-09-30T08:15:00.000Z");
  assert.throws(() => applyCallerOutcome(lead(), ROMAN, { outcome: "call_later", note: null, callback_on: "2026-09-30", callback_time: "25:00", consent: null }, NOW), WorkflowError);
});

test("INTERESTED: zapíše záujem, NIE je handoff, lead ostáva Romanovi", () => {
  assert.throws(() => applyCallerOutcome(lead(), ROMAN, { outcome: "interested", note: null, callback_on: null, consent: null }, NOW), WorkflowError);
  const r = applyCallerOutcome(lead(), ROMAN, { outcome: "interested", note: "volať po sezóne", callback_on: "2026-10-05", callback_time: "09:00", consent: talk }, NOW);
  assert.equal(r.handoff, false);
  assert.equal(r.leadPatch.status, "called");
  assert.equal(r.leadPatch.interest?.caught_attention, "fotky z realizácií");
  assert.equal(r.leadPatch.interest?.by_user, "roman");
  assert.equal(r.leadPatch.next_action_at, "2026-10-05T07:00:00.000Z");
  assert.equal(r.leadPatch.consent, undefined);
});

test("DOMINIK FOLLOW-UP: jasný stav pre Dominika so všetkým, čo zaznelo", () => {
  const r = applyCallerOutcome(lead(), ROMAN, { outcome: "consent", note: "milý pán", callback_on: null, callback_time: "15:30", consent: talk }, NOW);
  assert.equal(r.handoff, true);
  assert.equal(r.leadPatch.status, "dominik_call");
  assert.equal(r.leadPatch.next_action, "dominik_call");
  assert.equal(r.leadPatch.next_action_at, "2026-10-01T13:30:00.000Z");
  const c = r.leadPatch.consent!;
  assert.deepEqual([c.by_user, c.by_name, c.company_said, c.caught_attention, c.heard_price, c.call_note], ["roman", "Roman", "Nech sa ozve.", "fotky z realizácií", false, "po 15:00"]);
  const noDate = applyCallerOutcome(lead(), ROMAN, { outcome: "consent", note: null, callback_on: null, callback_time: "15:30", consent: { ...talk, call_on: null, call_note: null } }, NOW);
  assert.equal(noDate.leadPatch.consent?.call_note, "o 15:30");
});

test("ostatné výsledky: nezdvihol, nemá záujem, zlý kontakt, nekontaktovať", () => {
  const na = applyCallerOutcome(lead(), ROMAN, { outcome: "no_answer", note: null, callback_on: null, consent: null }, NOW);
  assert.equal(na.leadPatch.status, "called");
  assert.equal(applyCallerOutcome(lead(), ROMAN, { outcome: "not_interested", note: null, callback_on: null, consent: null }, NOW).leadPatch.status, "lost");
  assert.equal(applyCallerOutcome(lead(), ROMAN, { outcome: "wrong_number", note: null, callback_on: null, consent: null }, NOW).leadPatch.next_action, "verify_phone");
  const dnc = applyCallerOutcome(lead(), ROMAN, { outcome: "do_not_call", note: null, callback_on: null, consent: null }, NOW);
  assert.equal(dnc.leadPatch.status, "do_not_call");
  assert.equal(dnc.companyPatch?.do_not_call, true);
});

/* ─────────── Call Card v2 ─────────── */

function profile(p: Partial<RadarProfile> = {}): RadarProfile {
  return {
    version: 1,
    country: "CZ",
    brand_names: ["R&L PANENKA koberce"],
    city: "Hodonín",
    services: ["Pokládka koberců", "PVC a vinyl"],
    business_status: { value: "active", evidence: ["register: aktívna"] },
    data_quality: "gold",
    website_resolution: "confirmed",
    website: { url: "https://panenka-koberce.example", status: "confirmed", evidence: [] },
    register: { found: true, ico: "12345678" },
    primary_phone: { value: "+420600000000", confidence: "high", sources: ["web"] },
    category: { id: "podlahy", code: "FLOORING", confidence: "high", evidence: [] },
    process_signals: [
      { key: "phone_ordering", level: "OBSERVED", text: "Objednávky / termíny riešia telefonicky (píšu to na webe)", excerpt: "zamereni objednavejte telefonicky", source: "https://panenka-koberce.example" },
      { key: "no_form_found", level: "OBSERVED", text: "Formulár sme na webe nenašli", excerpt: "homepage + podstránky bez <form>", source: "https://panenka-koberce.example" },
    ],
    tags: { ads_status: "NOT_FOUND", spend: "UNKNOWN", google_ads: null, ga4: null, gtm: null, meta_pixel: null },
    ...p,
  } as RadarProfile;
}

test("Call Card v2: opening podľa evidence, všetky bloky, žiadny robotický scenár", () => {
  const o = buildOpportunity({ website_status: "working", data_quality: "gold", ads_check: null }, "podlahy", profile());
  const c = opportunityCallCard({
    company: { name: "R&L PANENKA koberce - podlahářství", city: "Hodonín", category: "podlahy", phone: "+420600000000", website: "https://panenka-koberce.example" },
    categoryLabel: "Podlahy",
    profile: profile(),
    opportunity: o,
    operatorName: "Roman",
    demoReady: true,
  });
  assert.equal(c.opening, "Dobrý deň, volám sa Roman a ozývam sa za Dominika ohľadom vašej stránky.");
  assert.equal(c.context_pain, "Pozerali sme vašu stránku a všimli sme si, že termíny a objednávky riešite hlavne telefonicky.");
  assert.equal(c.category, "Podlahy");
  assert.equal(c.website, "https://panenka-koberce.example");
  assert.ok(c.main_pain);
  assert.ok(c.questions.length >= 2 && c.questions.length <= 3);
  assert.ok(c.next_step.length > 10);
  assert.ok(!/máte záujem/i.test([c.opening, c.context_pain, c.idea, c.next_step].join(" ")));
});

test("Call Card v2: pri nepotvrdenom webe žiadne tvrdenie o stránke", () => {
  const p = profile({ website_resolution: "probable" });
  const o = buildOpportunity({ website_status: "working", data_quality: "silver", ads_check: null }, "podlahy", p);
  const c = opportunityCallCard({ company: { name: "X", city: null, category: "podlahy", phone: null, website: null }, profile: p, opportunity: o, operatorName: "Roman", demoReady: false });
  assert.doesNotMatch(c.opening + c.context_pain, /vašu stránku|vašej stránky/);
  assert.equal(c.website, null);
});

test("WHY CALL: každé pravidlo je vidieť, CALL ide Romanovi", () => {
  const o = buildOpportunity({ website_status: "working", data_quality: "gold", ads_check: null }, "podlahy", profile());
  const d = chooseChannel({ category: "podlahy", score_band: "high", opportunity: o, has_phone: true, phone_verified: true, category_verified: true, has_email: false, do_not_contact: false, operators: configuredOperators(undefined) });
  assert.equal(d.channel, "CALL");
  assert.equal(d.operator_id, "roman");
  assert.ok(d.rules.length >= 8 && d.rules.every((r) => r.passed));
});

/* ─────────── lievik ─────────── */

test("lievik operátora: assigned → attempted → answered → callback → interested → dominik → offer → won", () => {
  const leads = [
    lead({ id: "a", assigned_to: "roman" }),
    lead({ id: "b", assigned_to: "roman", status: "called", next_action: "callback" }),
    lead({ id: "c", assigned_to: "roman", status: "won", stage_at: { offer_sent: NOW, won: NOW }, consent: { at: NOW, by_user: "roman", by_name: "Roman", kind: "consent", contact_person: null, company_said: null, caught_attention: null, heard_price: false, call_on: null, call_note: null, email: null, note: null } }),
  ];
  const call = (lead_id: string, outcome: string): CallLog => ({ id: `c_${lead_id}_${outcome}`, lead_id, created_at: NOW, by: "Roman", by_user: "roman", role: "caller", outcome, note: null, company_said: null, dominik_may_call: outcome === "consent", preferred_time: null, email: null });
  const calls = [call("a", "no_answer"), call("b", "call_later"), call("c", "consent")];
  const f = operatorFunnel(leads, calls, "roman");
  assert.deepEqual(f, { assigned: 3, attempted: 3, answered: 2, callback: 1, interested: 1, dominik: 1, offer: 1, won: 1 });
  const cc = channelComparison([...leads, lead({ id: "d", status: "analyzed", next_action: "async_message" })], calls);
  assert.equal(cc.CALL.leads, 3);
  assert.equal(cc.ASYNC.leads, 1);
});

/* ─────────── Panenka: migrácia histórie ─────────── */

function snapshot(): Snapshot {
  const panenkaCo: Company = company({ id: "co_p", name: "R&L PANENKA koberce - podlahářství", category: "podlahy" });
  const otherCo: Company = company({ id: "co_o", name: "Salón Anna" });
  const consent = { at: NOW, by_user: "jozo", by_name: "Jozo", kind: "consent" as const, contact_person: "p. Panenka", company_said: "Nech sa ozve", caught_attention: null, heard_price: false, call_on: null, call_note: null, email: null, note: null };
  const leads: Lead[] = [
    lead({ id: "l_p", company_id: "co_p", status: "dominik_call", assigned_to: "jozo", consent, assigned_history: [{ user: "jozo", at: NOW, by: "Lead Radar" }] }),
    lead({ id: "l_o", company_id: "co_o", status: "called", assigned_to: "sona", call_attempts: 1, notes: "Soňa: volať poobede" }),
    lead({ id: "l_u", company_id: "co_o", status: "ready_to_call", assigned_to: "sona", call_attempts: 0 }),
  ];
  const calls: CallLog[] = [
    { id: "c1", lead_id: "l_p", created_at: NOW, by: "Jozo", by_user: "jozo", role: "caller", outcome: "consent", note: null, company_said: "Nech sa ozve", dominik_may_call: true, preferred_time: null, email: null },
    { id: "c2", lead_id: "l_o", created_at: NOW, by: "Soňa", by_user: "sona", role: "caller", outcome: "no_answer", note: null, company_said: null, dominik_may_call: false, preferred_time: null, email: null },
  ];
  const events: LeadEvent[] = [
    { id: "e1", lead_id: "l_p", at: NOW, actor: "Jozo", kind: "call", label: "Jozo: súhlas s kontaktom" },
    { id: "e2", lead_id: "l_o", at: NOW, actor: "Dominik Jankovič", kind: "assign", label: "Priradené: sona" },
    { id: "e3", lead_id: "l_o", at: NOW, actor: "Dominik Jankovič", kind: "note", label: "Bez zmeny" },
  ];
  return {
    companies: [panenkaCo, otherCo],
    leads,
    calls,
    events,
    commissions: [{ id: "m1", user: "jozo", lead_id: "l_p", kind: "handoff", amount: 10, state: "pending", reason: "súhlas", sale_price: null, created_at: NOW, confirmed_at: null, paid_at: null }],
    notifications: [{ id: "n1", at: NOW, lead_id: "l_p", kind: "qualified", title: "Jozo získal súhlas", body: "R&L PANENKA", read: false }],
    settings: { ...defaultSettings(), routing: { kadernictvo: "sona", podlahy: "roman" } },
  };
}

test("PANENKA: hovor, súhlas, event aj provízia sa opravia na Romana", () => {
  const plan = planMigration(snapshot(), { reassignUnworkedTo: "roman" });
  assert.deepEqual(plan.roman_cases, ["l_p"]);
  const lead = plan.changes.find((c) => c.kind === "lead" && c.id === "l_p");
  assert.ok(lead && lead.kind === "lead");
  assert.equal(lead.patch.consent?.by_user, "roman");
  assert.equal(lead.patch.consent?.by_name, "Roman");
  assert.equal(lead.patch.assigned_to, "roman");
  const call = plan.changes.find((c) => c.kind === "call" && c.id === "c1");
  assert.ok(call && call.kind === "call");
  assert.deepEqual([call.patch.by, call.patch.by_user], ["Roman", "roman"]);
  const ev = plan.changes.find((c) => c.kind === "event" && c.id === "e1");
  assert.ok(ev && ev.kind === "event");
  assert.deepEqual([ev.patch.actor, ev.patch.label], ["Roman", "Roman: súhlas s kontaktom"]);
  const com = plan.changes.find((c) => c.kind === "commission");
  assert.ok(com && com.kind === "commission");
  assert.deepEqual([com.row.user, com.row.amount, com.row.state], ["roman", 10, "pending"]);
});

test("migrácia: ostatná história sa anonymizuje, nič sa nemaže, nevolané leady dostane Roman", () => {
  const s = snapshot();
  const plan = planMigration(s, { reassignUnworkedTo: "roman" });
  const byId = (id: string) => plan.changes.find((c) => (c.kind === "lead" || c.kind === "call" || c.kind === "event") && c.id === id);
  const lo = byId("l_o");
  assert.ok(lo && lo.kind === "lead");
  assert.equal(lo.patch.assigned_to, null);
  assert.equal(lo.patch.notes, "pôvodný operátor: volať poobede");
  const lu = byId("l_u");
  assert.ok(lu && lu.kind === "lead");
  assert.equal(lu.patch.assigned_to, "roman");
  const c2 = byId("c2");
  assert.ok(c2 && c2.kind === "call");
  assert.equal(c2.patch.by_user, LEGACY_OPERATOR_ID);
  assert.equal(c2.patch.by, "Pôvodný operátor");
  const e2 = byId("e2");
  assert.ok(e2 && e2.kind === "event");
  assert.equal(e2.patch.label, "Priradené: pôvodný operátor");
  assert.equal(byId("e3"), undefined);
  const st = plan.changes.find((c) => c.kind === "settings");
  assert.ok(st && st.kind === "settings");
  assert.deepEqual(st.settings.routing, { podlahy: "roman" });
  // žiadna zmena nemaže záznam: iba patch / upsert
  assert.ok(plan.changes.every((c) => ["lead", "company", "call", "event", "commission", "notification", "settings"].includes(c.kind)));
});

test("migrácia je idempotentná: po aplikovaní druhý beh nič nenájde", () => {
  const s = snapshot();
  const plan = planMigration(s, { reassignUnworkedTo: "roman" });
  const apply = <T extends { id: string }>(rows: T[], kind: string) =>
    rows.map((r) => {
      const ch = plan.changes.find((c) => c.kind === kind && "id" in c && c.id === r.id) as { patch: Partial<T> } | undefined;
      return ch ? { ...r, ...ch.patch } : r;
    });
  const after: Snapshot = {
    ...s,
    leads: apply(s.leads, "lead"),
    calls: apply(s.calls, "call"),
    events: apply(s.events, "event"),
    notifications: apply(s.notifications, "notification"),
    commissions: s.commissions.map((m) => (plan.changes.find((c) => c.kind === "commission" && c.row.id === m.id) as { row: typeof m } | undefined)?.row ?? m),
    settings: (plan.changes.find((c) => c.kind === "settings") as { settings: typeof s.settings } | undefined)?.settings ?? s.settings,
  };
  assert.equal(planMigration(after, { reassignUnworkedTo: "roman" }).changes.length, 0);
  assert.equal(after.leads.length, s.leads.length);
  assert.equal(after.calls.length, s.calls.length);
  assert.equal(after.events.length, s.events.length);
});

/* ─────────── aplikácia na ploche ─────────── */

import manifest from "../app/manifest";

test("manifest: Lead Engine sa dá pridať na plochu ako aplikácia", () => {
  const m = manifest();
  assert.equal(m.display, "standalone");
  assert.equal(m.start_url, "/leady");
  assert.ok(m.icons?.some((i) => i.sizes === "192x192") && m.icons?.some((i) => i.sizes === "512x512"));
  assert.ok(m.icons?.some((i) => i.purpose === "maskable"));
});

test("migrácia 2: trace radaru, call brief a história behov radaru bez pôvodných mien, skutočné mená firiem ostávajú", () => {
  const s = snapshot();
  const heuchera = company({ id: "co_h", name: "Heuchera.sk – Soňa Dobiašová", contact_person: "Soňa Dobiašová" });
  s.companies.push(heuchera);
  s.companies[0] = { ...s.companies[0], profile: { version: 1, country: "CZ", trace: [{ step: "gate", detail: "GOLD · všetko overené · jozo · skóre 72" }] } as RadarProfile };
  s.leads.push(lead({ id: "l_h", company_id: "co_h", status: "archived", call_brief: { call_opening: "Dobrý deň, volám sa Jozo. Hovorím so Soňa Dobiašová?" } as unknown as Lead["call_brief"] }));
  s.settings = { ...s.settings, routing: {}, radar: { runs: [{ selected: { sona: 4, jozo: 8 }, need: { sona: 10 }, note: "Soňa mala málo" }], query_log: [{ caller: "jozo", query: "stolár Senica" }] } };
  const plan = planMigration(s, { reassignUnworkedTo: "roman" });
  const co = plan.changes.find((c) => c.kind === "company" && c.id === "co_p");
  assert.ok(co && co.kind === "company");
  assert.equal(co.patch.profile?.trace?.[0].detail, "GOLD · všetko overené · roman · skóre 72");
  const lh = plan.changes.find((c) => c.kind === "lead" && c.id === "l_h");
  assert.ok(lh && lh.kind === "lead");
  assert.equal((lh.patch.call_brief as unknown as { call_opening: string }).call_opening, "Dobrý deň, volám sa Roman. Hovorím so Soňa Dobiašová?");
  const st = plan.changes.find((c) => c.kind === "settings");
  assert.ok(st && st.kind === "settings");
  const run = st.settings.radar.runs[0] as Record<string, unknown>;
  assert.deepEqual(run.selected, { "pôvodný operátor": 12 });
  assert.equal(run.note, "pôvodný operátor mala málo");
  assert.equal((st.settings.radar.query_log[0] as Record<string, unknown>).caller, "pôvodný operátor");
  assert.ok(!plan.changes.some((c) => c.kind === "company" && c.id === "co_h"));
});
