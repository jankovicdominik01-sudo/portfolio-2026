import { normalizeState, type DbState, type Repository } from "./types";

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

export function documentRepository(raw: DocumentBackend): Repository {
  const b: DocumentBackend = {
    kind: raw.kind,
    read: async () => normalizeState(await raw.read()),
    mutate: (fn) => raw.mutate((s) => fn(normalizeState(s))),
  };
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
    async listAllCalls() {
      return [...(await b.read()).calls].sort(byDateDesc);
    },
    insertCall: (c) => b.mutate((s) => void s.calls.push(c)),
    updateCall: (id, patch) =>
      b.mutate((s) => {
        const c = s.calls.find((x) => x.id === id);
        if (c) Object.assign(c, patch);
      }),

    async listCommissions() {
      return [...(await b.read()).commissions].sort(byDateDesc);
    },
    upsertCommission: (c) =>
      b.mutate((s) => {
        const i = s.commissions.findIndex((x) => x.id === c.id);
        if (i >= 0) s.commissions[i] = c;
        else s.commissions.push(c);
      }),

    async getSettings() {
      return (await b.read()).settings;
    },
    saveSettings: (next) =>
      b.mutate((s) => {
        s.settings = next;
      }),

    async listEvents(leadId) {
      return (await b.read()).events
        .filter((e) => e.lead_id === leadId)
        .sort((a, z) => a.at.localeCompare(z.at));
    },
    insertEvent: (e) => b.mutate((s) => void s.events.push(e)),
    async listAllEvents() {
      return [...(await b.read()).events];
    },
    updateEvent: (id, patch) =>
      b.mutate((s) => {
        const e = s.events.find((x) => x.id === id);
        if (e) Object.assign(e, patch);
      }),

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
    updateNotification: (id, patch) =>
      b.mutate((s) => {
        const n = s.notifications.find((x) => x.id === id);
        if (n) Object.assign(n, patch);
      }),
  };
}
