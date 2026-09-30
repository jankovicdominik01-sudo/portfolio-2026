import { test } from "node:test";
import assert from "node:assert/strict";
import { commissionEffects, earnings, recompute, compensationConfigured } from "../lib/money";
import { buildToday, freshCount, inCooldown, selectDaily } from "../lib/queue";
import { computeScore, priorityFromScore } from "../lib/score";
import { identityMatch, mergeSources } from "../lib/identity";
import { dedupeKeys } from "../lib/scoring";
import type { Commission, Lead } from "../lib/types";
import { lead, company, NOW, OFFER, settings } from "./fixtures";

const consented = (p: Partial<Lead> = {}) =>
  lead({
    status: "dominik_call",
    consent: {
      at: NOW,
      by_user: "roman",
      by_name: "Roman",
      kind: "consent",
      contact_person: null,
      company_said: null,
      caught_attention: null,
      heard_price: false,
      call_on: null,
      call_note: null,
      email: null,
      note: null,
    },
    ...p,
  });

/* ─────────── Peniaze ─────────── */

test("bez nastavenia: provízia vznikne bez sumy (NEEDS CONFIGURATION), nič sa nevymyslí", () => {
  const s = settings();
  assert.equal(compensationConfigured(s.compensation), false);
  const out = commissionEffects(consented(), "consent", [], s, NOW);
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, "handoff");
  assert.equal(out[0].amount, null);
  assert.equal(out[0].state, "pending");
});

test("handoff on_contacted: pending → confirmed až keď sa Dominik dovolá", () => {
  const s = settings({ model: "handoff", handoff_amount: 10, handoff_condition: "on_contacted" });
  const [c1] = commissionEffects(consented(), "consent", [], s, NOW);
  assert.equal(c1.state, "pending");
  assert.equal(c1.amount, 10);
  const [c2] = commissionEffects(consented(), "contacted", [c1], s, NOW);
  assert.equal(c2.state, "confirmed");
  assert.equal(c2.id, c1.id);
});

test("handoff on_consent: potvrdené hneď", () => {
  const s = settings({ model: "handoff", handoff_amount: 5, handoff_condition: "on_consent" });
  const [c] = commissionEffects(consented(), "consent", [], s, NOW);
  assert.equal(c.state, "confirmed");
});

test("predaj: dohoda = pending, platba = confirmed, strata = void", () => {
  const s = settings({ model: "sale", sale_percent: 10 });
  const l = consented({ sale: { price: 200, agreed_at: NOW, paid_at: null, paid_amount: null } });
  const [sale] = commissionEffects(l, "deal", [], s, NOW);
  assert.equal(sale.kind, "sale");
  assert.equal(sale.state, "pending");
  assert.equal(sale.amount, 20);
  const [paid] = commissionEffects({ ...l, sale: { ...l.sale!, paid_amount: 200 } }, "paid", [sale], s, NOW);
  assert.equal(paid.state, "confirmed");
  const [voided] = commissionEffects(l, "lost", [sale], s, NOW);
  assert.equal(voided.state, "void");
});

test("recompute: po nastavení pravidla dopočíta sumu a podmienku spätne", () => {
  const [c] = commissionEffects(consented(), "consent", [], settings(), NOW);
  const s = settings({ model: "both", handoff_amount: 10, handoff_condition: "on_contacted", sale_amount: 30 });
  const l = consented({ id: c.lead_id, stage_at: { contacted: NOW } });
  const [r] = recompute([c], s, [l]);
  assert.equal(r.amount, 10);
  assert.equal(r.state, "confirmed");
});

test("zárobok: potvrdené a vyplatené sa rátajú, pending zvlášť, potenciál nikdy", () => {
  const base: Commission = {
    id: "x",
    user: "roman",
    lead_id: "l",
    kind: "handoff",
    amount: 10,
    state: "confirmed",
    reason: "",
    sale_price: null,
    created_at: NOW,
    confirmed_at: NOW,
    paid_at: null,
  };
  const e = earnings(
    [base, { ...base, id: "y", state: "pending", confirmed_at: null }, { ...base, id: "z", state: "paid", paid_at: NOW }, { ...base, id: "w", user: "peter" }],
    "roman",
    NOW,
  );
  assert.equal(e.today, 20);
  assert.equal(e.pending, 10);
  assert.equal(e.paid, 10);
  assert.equal(e.items.length, 3);
});

/* ─────────── Fronta ─────────── */

test("dnes: callbacky → ďalšie pokusy → nové; budúci callback sa objaví až v deň D", () => {
  const leads = [
    lead({ id: "new1", score: { version: 1, points: 50, band: "medium", factors: [], risks: [], offer_fit: "fits" } }),
    lead({ id: "new2", score: { version: 1, points: 80, band: "high", factors: [], risks: [], offer_fit: "fits" } }),
    lead({ id: "cb", status: "called", call_attempts: 1, next_action: "callback", next_action_at: "2026-09-27T08:00:00.000Z" }),
    lead({ id: "cbLater", status: "called", call_attempts: 1, next_action: "callback", next_action_at: "2026-10-04T08:00:00.000Z" }),
    lead({ id: "retry", status: "called", call_attempts: 1, next_action: "caller_call", next_action_at: "2026-09-27T08:00:00.000Z" }),
    lead({ id: "peter", assigned_to: "peter" }),
    lead({ id: "dnc", status: "do_not_call" }),
  ];
  const t = buildToday(leads, "roman", NOW);
  assert.deepEqual(t.callbacks.map((l) => l.id), ["cb"]);
  assert.deepEqual(t.retries.map((l) => l.id), ["retry"]);
  assert.deepEqual(t.fresh.map((l) => l.id), ["new2", "new1"]);
  assert.deepEqual(t.later.map((l) => l.id), ["cbLater"]);
  const t2 = buildToday(leads, "roman", "2026-10-04T07:00:00.000Z");
  assert.ok(t2.callbacks.some((l) => l.id === "cbLater"));
  assert.equal(freshCount(leads, "roman"), 2);
});

test("firma „nevolať“ sa nevráti do fronty ani ako nový lead", () => {
  const co = company({ do_not_call: true });
  const t = buildToday([{ ...lead(), company: co }], "roman", NOW);
  assert.equal(t.fresh.length, 0);
  assert.ok(inCooldown(co, [], NOW));
});

test("cooldown: firma volaná včera sa zajtra nevráti ako nová", () => {
  const co = company();
  const old = lead({ status: "lost", last_contact: "2026-09-26T10:00:00.000Z" });
  assert.match(inCooldown(co, [old], NOW) ?? "", /menej ako/);
  assert.equal(inCooldown(co, [{ ...old, last_contact: "2026-01-01T10:00:00.000Z" }], NOW), null);
});

test("denný výber: najlepšie skóre, max 2 z mesta, bez blokovaných", () => {
  const c = (id: string, points: number, city: string, blocked: string | null = null) => ({ id, score: { points }, city, blocked });
  const pick = selectDaily([c("a", 90, "Nitra"), c("b", 80, "Nitra"), c("c", 70, "Nitra"), c("d", 60, "Žilina"), c("e", 99, "Trnava", "dnc")], 10);
  assert.deepEqual(pick.map((x) => x.id), ["a", "b", "d"]);
});

/* ─────────── Skóre ─────────── */

test("skóre: nefunkčný web + aktívna firma + overený telefón + sedí ponuka = vysoko, s dôvodmi", () => {
  const s = computeScore({
    company: company(),
    website_status: "broken",
    website_issue: "db_error",
    business_check: "confirmed",
    register_ok: true,
    phone_on_web: true,
    offers: [OFFER],
  });
  assert.equal(s.band, "high");
  assert.equal(priorityFromScore(s), "hot");
  assert.ok(s.factors.some((f) => f.key === "web_down" && /chyba databázy/.test(f.label)));
  assert.equal(s.points, s.factors.reduce((a, f) => a + f.points, 0) + s.risks.reduce((a, f) => a + f.points, 0));
});

test("skóre: neistý web a zmenený odbor znižujú prioritu a sú v rizikách", () => {
  const s = computeScore({
    company: company({ category: "stolarstvo", phone: "037 123 456" }),
    website_status: "uncertain",
    website_issue: null,
    business_check: "changed",
    register_ok: true,
    phone_on_web: false,
    offers: [OFFER],
  });
  assert.equal(s.band, "low");
  assert.ok(s.risks.some((r) => r.key === "business_changed"));
  assert.ok(s.risks.some((r) => r.key === "web_uncertain"));
  assert.equal(s.offer_fit, "no_fit");
});

/* ─────────── Identita ─────────── */

test("identita: IČO rozhoduje, zhoda iba v názve = neisté", () => {
  const ex = company({ ico: "35455241", dedupe_keys: dedupeKeys({ ...company(), ico: "35455241" }) });
  assert.equal(identityMatch(ex, { name: "Iný názov", city: null, phone: null, email: null, website: null, ico: "35455241" }).same, true);
  assert.equal(identityMatch(ex, { ...company(), ico: "11111111" }).same, false);
  assert.equal(identityMatch(ex, { ...company(), phone: "0905 123 456", ico: null }).same, true);
  const nameOnly = identityMatch(ex, { name: "Záhradníctvo Test", city: "Nitra", phone: "0911999999", email: null, website: null });
  assert.equal(nameOnly.same, null);
  assert.equal(nameOnly.confidence, "low");
});

test("azet + zoznam = jedna firma, zdroje ako metadáta", () => {
  const s1 = mergeSources([], [{ source: "azet", url: "https://www.azet.sk/firma/1", seen_at: NOW }]);
  const s2 = mergeSources(s1, [
    { source: "zoznam", url: "https://www.zoznam.sk/firma/2", seen_at: NOW },
    { source: "azet", url: "https://www.azet.sk/firma/1", seen_at: NOW },
  ]);
  assert.deepEqual(s2.map((x) => x.source), ["azet", "zoznam"]);
  assert.ok(dedupeKeys({ ...company(), ico: "36349747" })[0] === "ico:36349747");
});
