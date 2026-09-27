import { test } from "node:test";
import assert from "node:assert/strict";
import { applyCallerOutcome, applySalesStep, callerCanSee, reassignUnworked, WorkflowError, MAX_ATTEMPTS } from "../lib/workflow";
import { lead, company, SONA, JOZO, ADMIN, NOW } from "./fixtures";

const consent = {
  contact_person: "p. Novák",
  company_said: "Nech sa ozve",
  caught_attention: "hotový web",
  heard_price: false,
  call_on: "2026-09-29",
  call_note: "poobede",
  email: null,
};

test("nedvihol: 1. a 2. pokus → retry s pauzou, 3. → nedovolaný (neukončí sa skôr)", () => {
  let l = lead();
  const r1 = applyCallerOutcome(l, SONA, { outcome: "no_answer", note: null, callback_on: null, consent: null }, NOW);
  assert.equal(r1.leadPatch.status, "called");
  assert.equal(r1.leadPatch.next_action, "caller_call");
  assert.equal(r1.leadPatch.call_attempts, 1);
  assert.equal(r1.leadPatch.next_action_at!.slice(0, 10), "2026-09-28"); // +1 deň
  l = { ...l, ...r1.leadPatch };
  const r2 = applyCallerOutcome(l, SONA, { outcome: "no_answer", note: null, callback_on: null, consent: null }, NOW);
  assert.equal(r2.leadPatch.next_action_at!.slice(0, 10), "2026-09-29"); // +2 dni
  l = { ...l, ...r2.leadPatch };
  const r3 = applyCallerOutcome(l, SONA, { outcome: "no_answer", note: null, callback_on: null, consent: null }, NOW);
  assert.equal(r3.leadPatch.call_attempts, MAX_ATTEMPTS);
  assert.equal(r3.leadPatch.status, "archived");
  assert.equal(r3.leadPatch.archive_reason, "unreachable");
  assert.equal(r3.call.attempt, 3);
});

test("zavolať neskôr: vyžaduje dátum a vráti sa ako callback v ten deň", () => {
  assert.throws(() => applyCallerOutcome(lead(), SONA, { outcome: "call_later", note: null, callback_on: null, consent: null }, NOW), WorkflowError);
  assert.throws(
    () => applyCallerOutcome(lead(), SONA, { outcome: "call_later", note: null, callback_on: "2026-01-01", consent: null }, NOW),
    WorkflowError,
  );
  const r = applyCallerOutcome(lead(), SONA, { outcome: "call_later", note: null, callback_on: "2026-10-04", consent: null }, NOW);
  assert.equal(r.leadPatch.status, "called");
  assert.equal(r.leadPatch.next_action, "callback");
  assert.equal(r.leadPatch.next_action_at!.slice(0, 10), "2026-10-04");
});

test("nevolať znova: firma sa označí a lead sa uzavrie", () => {
  const r = applyCallerOutcome(lead(), SONA, { outcome: "do_not_call", note: null, callback_on: null, consent: null }, NOW);
  assert.equal(r.leadPatch.status, "do_not_call");
  assert.equal(r.companyPatch?.do_not_call, true);
  assert.equal(r.leadPatch.next_action, null);
});

test("súhlas: handoff Dominikovi, súhlas NIE JE záujem", () => {
  assert.throws(() => applyCallerOutcome(lead(), SONA, { outcome: "consent", note: null, callback_on: null, consent: null }, NOW), WorkflowError);
  const r = applyCallerOutcome(lead(), SONA, { outcome: "consent", note: "ok", callback_on: null, consent }, NOW);
  assert.equal(r.handoff, true);
  assert.equal(r.leadPatch.status, "dominik_call");
  assert.equal(r.leadPatch.consent?.kind, "consent");
  assert.equal(r.leadPatch.consent?.by_user, "sona");
  assert.notEqual(r.leadPatch.status, "interested");
  assert.equal(r.leadPatch.stage_at, undefined, "súhlas nesmie nastaviť žiadnu fázu záujmu");
  assert.equal(r.leadPatch.next_action_at!.slice(0, 10), "2026-09-29");
  assert.equal(r.companyPatch?.contact_person, "p. Novák");
});

test("chce informácie = handoff typu info", () => {
  const r = applyCallerOutcome(lead(), SONA, { outcome: "wants_info", note: null, callback_on: null, consent: { ...consent, email: "a@b.sk" } }, NOW);
  assert.equal(r.leadPatch.consent?.kind, "info");
  assert.equal(r.call.email, "a@b.sk");
});

test("má nový web / nemá záujem / zlé číslo", () => {
  assert.equal(applyCallerOutcome(lead(), SONA, { outcome: "has_web", note: null, callback_on: null, consent: null }, NOW).leadPatch.lost_reason, "has_web");
  assert.equal(applyCallerOutcome(lead(), SONA, { outcome: "not_interested", note: null, callback_on: null, consent: null }, NOW).leadPatch.status, "lost");
  const w = applyCallerOutcome(lead(), SONA, { outcome: "wrong_number", note: null, callback_on: null, consent: null }, NOW);
  assert.equal(w.leadPatch.next_action, "verify_phone");
  assert.equal(w.leadPatch.status, "analyzed");
});

test("prístup: Soňa vidí iba svoje leady vo fáze volania, nikdy Jozove ani „nevolať“", () => {
  assert.equal(callerCanSee(SONA, lead({ assigned_to: "sona" })), true);
  assert.equal(callerCanSee(SONA, lead({ assigned_to: "jozo" })), false);
  assert.equal(callerCanSee(SONA, lead({ assigned_to: "sona", status: "dominik_call" })), false);
  assert.equal(callerCanSee(SONA, lead({ assigned_to: "sona" }), company({ do_not_call: true })), false);
  assert.equal(callerCanSee(JOZO, lead({ assigned_to: "sona" })), false);
  assert.equal(callerCanSee(ADMIN, lead({ assigned_to: "jozo" })), true);
});

test("sales pipeline: fázy sa zapisujú, predaj a platba nesú cenu 200", () => {
  let l = lead({ status: "dominik_call" });
  l = { ...l, ...applySalesStep(l, "contacted", { note: null, date: null, price: null }, NOW, 200) };
  assert.equal(l.status, "contacted");
  assert.ok(l.stage_at?.contacted);
  assert.equal(l.stage_at?.interested, undefined, "kontakt ≠ záujem");
  l = { ...l, ...applySalesStep(l, "deal", { note: null, date: null, price: null }, NOW, 200) };
  assert.equal(l.status, "won");
  assert.equal(l.sale?.price, 200);
  assert.ok(l.stage_at?.interested, "dohoda implikuje prechod záujmom");
  l = { ...l, ...applySalesStep(l, "paid", { note: null, date: null, price: 200 }, NOW, 200) };
  assert.equal(l.status, "paid");
  assert.equal(l.sale?.paid_amount, 200);
  assert.ok(l.sale?.paid_at);
});

test("sales: nemá záujem po rozhovore = kontakt nastal; follow-up vyžaduje dátum", () => {
  const l = lead({ status: "dominik_call" });
  const p = applySalesStep(l, "not_interested", { note: null, date: null, price: null }, NOW, 200);
  assert.equal(p.status, "lost");
  assert.ok(p.stage_at?.contacted);
  assert.throws(() => applySalesStep(l, "follow_up", { note: null, date: null, price: null }, NOW, 200), WorkflowError);
});

test("Jozo → Soňa: presunú sa iba nevolané leady, história Jozových hovorov ostáva", () => {
  const leads = [
    lead({ id: "a", assigned_to: "jozo" }),
    lead({ id: "b", assigned_to: "jozo", call_attempts: 1, status: "called" }),
    lead({ id: "c", assigned_to: "jozo", status: "dominik_call" }),
  ];
  const moves = reassignUnworked(leads, "jozo", "sona", NOW, "Dominik");
  assert.deepEqual(moves.map((m) => m.id), ["a"]);
  assert.equal(moves[0].patch.assigned_to, "sona");
  assert.equal(moves[0].patch.assigned_history?.at(-1)?.user, "sona");
});
