import test from "node:test";
import assert from "node:assert/strict";
import { defaultSettings, type Company, type Lead, type Notification } from "../lib/types";
import { emptyState } from "../lib/db/types";
import { migrationCounts, panenkaPreview, stateToSupabaseRows } from "../lib/migrations/blob-to-supabase";

test("Blob → Supabase mapping zachová všetky kolekcie aj nové Lead polia", () => {
  const s = emptyState();
  const company: Company = {
    id: "co_p",
    name: "R&L PANENKA koberce - podlahářství",
    category: "podlahy",
    city: "Praha",
    region: null,
    contact_person: null,
    phone: "+420602659340",
    email: null,
    address: null,
    website: "http://kobercepanenka.cz",
    social_profiles: [],
    dedupe_keys: ["phone:+420602659340"],
    created_at: "2026-09-28T00:00:00.000Z",
    updated_at: "2026-09-30T00:00:00.000Z",
  };
  const lead: Lead = {
    id: "l_p",
    company_id: company.id,
    status: "dominik_call",
    priority: "hot",
    priority_reasons: [],
    source: "routine",
    source_url: null,
    assigned_to: "roman",
    analysis: null,
    call_brief: null,
    trust: { web: "verified", phone: "verified", company: "verified", hook: "verified" },
    qualification: null,
    next_action: "dominik_call",
    next_action_at: null,
    last_contact: null,
    call_attempts: 1,
    archive_reason: null,
    notes: "",
    created_at: "2026-09-28T00:00:00.000Z",
    updated_at: "2026-09-30T00:00:00.000Z",
    opportunity: { overall: "TOP" },
    channel_decision: { channel: "CALL" },
    demo: { code: "abc" },
    ads_check: { status: "NOT_FOUND", url: null, checked_at: "2026-09-30T00:00:00.000Z", by: "dominik" },
    interest: null,
    consent: {
      at: "2026-09-30T18:50:00.000Z",
      by_user: "roman",
      by_name: "Roman",
      kind: "consent",
      contact_person: null,
      company_said: "Nech sa ozve.",
      caught_attention: null,
      heard_price: false,
      call_on: "2026-10-01",
      call_note: null,
      email: null,
      note: null,
    },
  };
  const n1: Notification = { id: "n1", at: lead.created_at, lead_id: lead.id, kind: "info", title: "A", body: "", read: false };
  const n2: Notification = { id: "n2", at: lead.created_at, lead_id: lead.id, kind: "info", title: "B", body: "", read: false };
  s.companies.push(company);
  s.leads.push(lead);
  s.notifications.push(n1, n2);
  s.settings = defaultSettings();

  const rows = stateToSupabaseRows(s);
  assert.equal(rows.leads.length, 1);
  assert.deepEqual(rows.leads[0].opportunity, { overall: "TOP" });
  assert.deepEqual(rows.leads[0].channel_decision, { channel: "CALL" });
  assert.equal(rows.notifications.length, 2);
  assert.deepEqual(rows.settings[0], { id: "main", value: defaultSettings() });
  assert.deepEqual(migrationCounts(rows), {
    companies: 1,
    leads: 1,
    calls: 0,
    lead_events: 0,
    offers: 0,
    commissions: 0,
    settings: 1,
    notifications: 2,
  });

  const panenka = panenkaPreview(s);
  assert.equal(panenka.leads[0].assigned_to, "roman");
  assert.equal(panenka.leads[0].consent_by, "roman");
  assert.equal(panenka.leads[0].heard_price, false);
});
