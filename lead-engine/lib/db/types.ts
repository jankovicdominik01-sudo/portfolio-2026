import type { CallLog, Company, Lead, LeadEvent, Notification, Offer } from "../types";

/**
 * Úložisko je vymeniteľné. UI ani obchodná logika nevedia, či beží
 * Supabase (produkcia), Vercel Blob (testovací deploy) alebo lokálny súbor.
 */
export interface Repository {
  readonly kind: "supabase" | "blob" | "file";

  listCompanies(): Promise<Company[]>;
  getCompany(id: string): Promise<Company | null>;
  findCompanyByKeys(keys: string[]): Promise<Company | null>;
  insertCompany(c: Company): Promise<void>;
  updateCompany(id: string, patch: Partial<Company>): Promise<void>;

  listLeads(): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | null>;
  insertLead(l: Lead): Promise<void>;
  updateLead(id: string, patch: Partial<Lead>): Promise<void>;

  listCalls(leadId: string): Promise<CallLog[]>;
  insertCall(c: CallLog): Promise<void>;

  listEvents(leadId: string): Promise<LeadEvent[]>;
  insertEvent(e: LeadEvent): Promise<void>;

  listOffers(): Promise<Offer[]>;
  upsertOffer(o: Offer): Promise<void>;
  deleteOffer(id: string): Promise<void>;

  listNotifications(): Promise<Notification[]>;
  insertNotification(n: Notification): Promise<void>;
  markNotificationsRead(ids: string[] | "all"): Promise<void>;
}

/** Celý stav v jednom dokumente — pre file/blob adaptér. */
export type DbState = {
  version: 1;
  companies: Company[];
  leads: Lead[];
  calls: CallLog[];
  events: LeadEvent[];
  offers: Offer[];
  notifications: Notification[];
};

export function emptyState(): DbState {
  return { version: 1, companies: [], leads: [], calls: [], events: [], offers: [], notifications: [] };
}
