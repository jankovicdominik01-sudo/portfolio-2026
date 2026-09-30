import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCallCard, dominikOpening2, forbiddenClaims, unverifiedWebClaim, webClaimAllowed } from "../lib/script";
import { countLeads, rates, breakdown, leadSource } from "../lib/analytics";
import type { CallLog } from "../lib/types";
import { lead, company, NOW, OFFER, USERS } from "./fixtures";

test("neistý web: scenár sa iba pýta, nikdy netvrdí, že web nefunguje", () => {
  const card = buildCallCard({
    lead: lead({ website_status: "uncertain", website_checked_at: NOW }),
    company: company(),
    callerName: "Roman",
    speech: "f",
    offers: [OFFER],
    nowIso: NOW,
  });
  assert.equal(card.web_verified, false);
  assert.match(card.transition, /máte nejakú\?/);
  assert.doesNotMatch(card.transition, /nefunguje/);
  assert.ok(card.cautions[0].includes("NEHOVOR"));
});

test("overený nefunkčný web: prechod povie problém; starý údaj (>14 dní) sa netvrdí", () => {
  const fresh = lead({ website_status: "broken", website_issue: "db_error", website_checked_at: NOW });
  const card = buildCallCard({ lead: fresh, company: company(), callerName: "Roman", speech: "m", offers: [OFFER], nowIso: NOW });
  assert.match(card.transition, /všimol som si, že vám stránka momentálne nefunguje/);
  assert.match(card.dominik, /pôvodný klient ho nakoniec neprevzal/);
  assert.equal(card.verified, "Kontrolované dnes");
  assert.equal(webClaimAllowed({ website_status: "broken", website_checked_at: "2026-09-01T00:00:00Z" }, NOW), false);
});

test("hotový web sa nespomína, ak nesedí segment", () => {
  const card = buildCallCard({
    lead: lead({ website_status: "broken", website_issue: "parked", website_checked_at: NOW }),
    company: company({ category: "strechy" }),
    callerName: "Roman",
    speech: "f",
    offers: [OFFER],
    nowIso: NOW,
  });
  assert.doesNotMatch(card.dominik, /hotový/);
  assert.ok(card.cautions.some((c) => /Nespomínaj hotový web/.test(c)));
});

test("zakázané tvrdenia: prieskum, straty zákazníkov, urgentnosť, „máte záujem“", () => {
  assert.deepEqual(forbiddenClaims(["Robím školský prieskum"]), ["vymyslený prieskum"]);
  assert.ok(forbiddenClaims(["Prichádzate o zákazníkov, ponuka platí len dnes"]).length === 2);
  assert.equal(unverifiedWebClaim(["Nemáte web."], false), true);
  assert.equal(unverifiedWebClaim(["Nemáte web."], true), false);
});

test("Dominikov opening nepovyšuje súhlas na záujem", () => {
  const l = lead({
    consent: {
      at: NOW,
      by_user: "roman",
      by_name: "Roman",
      kind: "consent",
      contact_person: null,
      company_said: null,
      caught_attention: null,
      heard_price: true,
      call_on: null,
      call_note: null,
      email: null,
      note: null,
    },
  });
  const lines = dominikOpening2({ adminName: "Dominik Jankovič", lead: l, callerSpeech: "m" }).join(" ");
  assert.match(lines, /Roman mi na vás posunul kontakt/);
  assert.match(lines, /súhlasili ste, že sa vám môžem ozvať/);
  assert.doesNotMatch(lines, /záujem/);
});

/* ─────────── Analytika ─────────── */

const call = (p: Partial<CallLog>): CallLog => ({
  id: Math.random().toString(36),
  lead_id: "ld_1",
  created_at: NOW,
  by: "Roman",
  by_user: "roman",
  role: "caller",
  outcome: "no_answer",
  note: null,
  company_said: null,
  dominik_may_call: false,
  preferred_time: null,
  email: null,
  ...p,
});

test("metriky rátajú unikátne leady, nie počet hovorov", () => {
  const leads = [
    { ...lead({ id: "a" }), company: company() },
    { ...lead({ id: "b" }), company: company() },
    { ...lead({ id: "c" }), company: company() },
  ];
  const calls = [
    call({ lead_id: "a" }),
    call({ lead_id: "a" }),
    call({ lead_id: "a", outcome: "not_interested" }),
    call({ lead_id: "b", outcome: "wrong_number" }),
  ];
  const k = countLeads(leads, calls, USERS);
  assert.equal(k.assigned, 3);
  assert.equal(k.attempted, 2);
  assert.equal(k.calls, 4);
  assert.equal(k.contact, 2);
  assert.equal(k.conversation, 1);
  const r = rates(k).find((x) => x.key === "contact_rate")!;
  assert.deepEqual([r.num, r.den], [2, 2]);
});

test("história: starší handoff (bez by_user) sa pripíše podľa mena, nie inému operátorovi", () => {
  const leads = [{ ...lead({ id: "j", assigned_to: "peter", status: "dominik_call" }), company: company() }];
  const calls = [call({ lead_id: "j", by: "Peter", by_user: undefined, outcome: "dominik_may_call", dominik_may_call: true })];
  assert.equal(countLeads(leads, calls, USERS, "peter").consent, 1);
  assert.equal(countLeads(leads, calls, USERS, "roman").consent, 0);
});

test("rozpad podľa zdroja z metadát firmy aj zo starej URL", () => {
  const a = { ...lead({ id: "a" }), company: company({ sources: [{ source: "azet", url: null, seen_at: NOW }] }) };
  const b = { ...lead({ id: "b", source_url: "https://sluzby.bazos.sk/inzerat/1" }), company: company() };
  assert.equal(leadSource(a), "azet");
  assert.equal(leadSource(b), "bazos");
  assert.deepEqual(breakdown([a, b], [], USERS, leadSource).map((g) => g.key).sort(), ["azet", "bazos"]);
});
