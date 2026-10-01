import { normalizeState, type DbState } from "../db/types";

export const SUPABASE_TABLE_ORDER = [
  "companies",
  "leads",
  "calls",
  "lead_events",
  "offers",
  "commissions",
  "settings",
  "notifications",
] as const;

export type MigrationTable = (typeof SUPABASE_TABLE_ORDER)[number];

export type SupabaseMigrationRows = {
  companies: Record<string, unknown>[];
  leads: Record<string, unknown>[];
  calls: Record<string, unknown>[];
  lead_events: Record<string, unknown>[];
  offers: Record<string, unknown>[];
  commissions: Record<string, unknown>[];
  settings: Record<string, unknown>[];
  notifications: Record<string, unknown>[];
};

function jsonRow(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

/**
 * Prevedie dokumentový Blob stav 1:1 na riadky Supabase tabuliek.
 * Nepoužíva Repository API, aby sa pri migrácii nestratili staršie notifikácie
 * (bežné listNotifications zámerne vracia iba posledných 50).
 */
export function stateToSupabaseRows(input: DbState): SupabaseMigrationRows {
  const state = normalizeState(JSON.parse(JSON.stringify(input)) as DbState);
  return {
    companies: state.companies.map(jsonRow),
    leads: state.leads.map(jsonRow),
    calls: state.calls.map(jsonRow),
    lead_events: state.events.map(jsonRow),
    offers: state.offers.map(jsonRow),
    commissions: state.commissions.map(jsonRow),
    settings: [{ id: "main", value: jsonRow(state.settings) }],
    notifications: state.notifications.map(jsonRow),
  };
}

export function migrationCounts(rows: SupabaseMigrationRows): Record<MigrationTable, number> {
  return Object.fromEntries(SUPABASE_TABLE_ORDER.map((table) => [table, rows[table].length])) as Record<MigrationTable, number>;
}

export function sourceIds(rows: SupabaseMigrationRows, table: MigrationTable): string[] {
  return rows[table]
    .map((row) => row.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

export function panenkaPreview(input: DbState) {
  const state = normalizeState(JSON.parse(JSON.stringify(input)) as DbState);
  const companies = state.companies.filter((c) => /panenka/i.test(c.name));
  const companyIds = new Set(companies.map((c) => c.id));
  const leads = state.leads.filter((l) => companyIds.has(l.company_id));
  const leadIds = new Set(leads.map((l) => l.id));
  const calls = state.calls.filter((c) => leadIds.has(c.lead_id));
  const events = state.events.filter((e) => leadIds.has(e.lead_id));

  return {
    companies: companies.map((c) => ({ id: c.id, name: c.name })),
    leads: leads.map((l) => ({
      id: l.id,
      status: l.status,
      assigned_to: l.assigned_to,
      next_action: l.next_action,
      consent_by: l.consent?.by_user ?? null,
      heard_price: l.consent?.heard_price ?? null,
    })),
    calls: calls.map((c) => ({ id: c.id, by_user: c.by_user ?? null, by: c.by, outcome: c.outcome })),
    events: events.map((e) => ({ id: e.id, actor : e.actor, kind: e.kind, label: e.label })),
  };
}
