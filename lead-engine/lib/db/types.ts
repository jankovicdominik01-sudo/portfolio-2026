import { defaultSettings, type CallLog, type Commission, type Company, type Lead, type LeadEvent, type Notification, type Offer, type Settings } from "../types";

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
  /** Všetky hovory (analytika, zárobky). */
  listAllCalls(): Promise<CallLog[]>;
  insertCall(c: CallLog): Promise<void>;

  listCommissions(): Promise<Commission[]>;
  upsertCommission(c: Commission): Promise<void>;

  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<void>;

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
  version: 1 | 2;
  companies: Company[];
  leads: Lead[];
  calls: CallLog[];
  events: LeadEvent[];
  offers: Offer[];
  notifications: Notification[];
  commissions: Commission[];
  settings: Settings;
};

export function emptyState(): DbState {
  return {
    version: 2,
    companies: [],
    leads: [],
    calls: [],
    events: [],
    offers: [],
    notifications: [],
    commissions: [],
    settings: defaultSettings(),
  };
}

/**
 * Staršie dokumenty (verzia 1) doplní o nové kolekcie. Nič nemaže.
 * Jednorazovo: seed ponuka z roku 1.0 (300 €, „rozpracovaný“) → aktuálna ponuka 200 € (hotový web).
 */
export function normalizeState(s: DbState): DbState {
  s.commissions ??= [];
  s.settings ??= defaultSettings();
  s.settings.compensation ??= defaultSettings().compensation;
  s.settings.package ??= defaultSettings().package;
  if (s.version !== 2) {
    for (const o of s.offers ?? []) {
      if (o.id === "offer_zahradnictvo" && o.estimated_price === 300 && /Rozpracovaný koncept/.test(o.note)) {
        o.estimated_price = 200;
        o.note = "Hotový web, ktorý pôvodný klient neprevzal — prispôsobí sa pre záhradníctvo / záhradné služby";
      }
    }
    s.version = 2;
  }
  return s;
}
