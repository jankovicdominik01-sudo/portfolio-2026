import type { DbState, Repository } from "./types";

/**
 * Repository nad jedným JSON dokumentom. Dostačuje pre desiatky až nízke
 * tisícky leadov — pre viac treba Supabase adaptér.
 */
export interface DocumentBackend {
  kind: "blob" | "file";
  read(): Promise<DbState>;
  /** Atomicky načíta → zmení → zapíše (s retry pri súbežnom zápise). */
  mutate(fn: (s: DbState) => void): Promise<void>;
}

const byDateDesc = <T extends { created_at?: string; at?: string }>(a: T, b: T) =>
  (b.created_at ?? b.at ?? "").localeCompare(a.created_at ?? a.at ?? "");

export function documentRepository(b: DocumentBackend): Repository {
  return {
    kind: b.kind,

    async listCompanies() {
      return (await b.read()).companies;
    },
    async getCompany(id) {
      return (await b.read()).companies.find((c) => c.id === id) ?? null;
    },
    async findCompanyByKeys(keys) {
      if (!keys.length) return null;
      const s = await b.read();
      // Poradie kľúčov = poradie priority (email > telefón > doména > názov+mesto)
      for (const k of keys) {
        const hit = s.companies.find((c) => c.dedupe_keys.includes(k));
        if (hit) return hit;
      }
      return null;
    },
    insertCompany: (c) => b.mutate((s) => void s.companies.push(c)),
    updateCompany: (id, patch) =>
      b.mutate((s) => {
        const i = s.companies.findIndex((c) => c.id === id);
        if (i >= 0) s.companies[i] = { ...s.companies[i], ...patch };
      }),

    async listLeads() {
      return [...(await b.read()).leads].sort(byDateDesc);
    },
    async getLead(id) {
      return (await b.read()).leads.find((l) => l.id === id) ?? null;
    },
    insertLead: (l) => b.mutate((s) => void s.leads.push(l)),
    updateLead: (id, patch) =>
      b.mutate((s) => {
        const i = s.leads.findIndex((l) => l.id === id);
        if (i >= 0) s.leads[i] = { ...s.leads[i], ...patch };
      }),

    async listCalls(leadId) {
      return (await b.read()).calls.filter((c) => c.lead_id === leadId).sort(byDateDesc);
    },
    insertCall: (c) => b.mutate((s) => void s.calls.push(c)),

    async listEvents(leadId) {
      return (await b.read()).events
        .filter((e) => e.lead_id === leadId)
        .sort((a, z) => a.at.localeCompare(z.at));
    },
    insertEvent: (e) => b.mutate((s) => void s.events.push(e)),

    async listOffers() {
      return (await b.read()).offers;
    },
    upsertOffer: (o) =>
      b.mutate((s) => {
        const i = s.offers.findIndex((x) => x.id === o.id);
        if (i >= 0) s.offers[i] = o;
        else s.offers.push(o);
      }),
    deleteOffer: (id) =>
      b.mutate((s) => {
        s.offers = s.offers.filter((o) => o.id !== id);
      }),

    async listNotifications() {
      return [...(await b.read()).notifications].sort(byDateDesc).slice(0, 50);
    },
    insertNotification: (n) => b.mutate((s) => void s.notifications.push(n)),
    markNotificationsRead: (ids) =>
      b.mutate((s) => {
        for (const n of s.notifications) if (ids === "all" || ids.includes(n.id)) n.read = true;
      }),
  };
}
