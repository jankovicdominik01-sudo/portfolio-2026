import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Repository } from "./types";
import type { CallLog, Company, Lead, LeadEvent, Notification, Offer } from "../types";

/** Produkčné úložisko. Schéma: supabase/migrations/0001_lead_engine.sql */
export function supabaseRepository(url: string, serviceKey: string): Repository {
  const sb: SupabaseClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const must = <T>(r: { data: T | null; error: { message: string } | null }): T => {
    if (r.error) throw new Error(`Supabase: ${r.error.message}`);
    return r.data as T;
  };

  return {
    kind: "supabase",

    async listCompanies() {
      return must(await sb.from("companies").select("*")) as Company[];
    },
    async getCompany(id) {
      return must(await sb.from("companies").select("*").eq("id", id).maybeSingle()) as Company | null;
    },
    async findCompanyByKeys(keys) {
      if (!keys.length) return null;
      const rows = must(await sb.from("companies").select("*").overlaps("dedupe_keys", keys)) as Company[];
      for (const k of keys) {
        const hit = rows.find((c) => c.dedupe_keys.includes(k));
        if (hit) return hit;
      }
      return null;
    },
    async insertCompany(c) {
      must(await sb.from("companies").insert(c));
    },
    async updateCompany(id, patch) {
      must(await sb.from("companies").update(patch).eq("id", id));
    },

    async listLeads() {
      return must(await sb.from("leads").select("*").order("created_at", { ascending: false })) as Lead[];
    },
    async getLead(id) {
      return must(await sb.from("leads").select("*").eq("id", id).maybeSingle()) as Lead | null;
    },
    async insertLead(l) {
      must(await sb.from("leads").insert(l));
    },
    async updateLead(id, patch) {
      must(await sb.from("leads").update(patch).eq("id", id));
    },

    async listCalls(leadId) {
      return must(
        await sb.from("calls").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }),
      ) as CallLog[];
    },
    async insertCall(c) {
      must(await sb.from("calls").insert(c));
    },

    async listEvents(leadId) {
      return must(
        await sb.from("lead_events").select("*").eq("lead_id", leadId).order("at", { ascending: true }),
      ) as LeadEvent[];
    },
    async insertEvent(e) {
      must(await sb.from("lead_events").insert(e));
    },

    async listOffers() {
      return must(await sb.from("offers").select("*").order("created_at")) as Offer[];
    },
    async upsertOffer(o) {
      must(await sb.from("offers").upsert(o));
    },
    async deleteOffer(id) {
      must(await sb.from("offers").delete().eq("id", id));
    },

    async listNotifications() {
      return must(
        await sb.from("notifications").select("*").order("at", { ascending: false }).limit(50),
      ) as Notification[];
    },
    async insertNotification(n) {
      must(await sb.from("notifications").insert(n));
    },
    async markNotificationsRead(ids) {
      const q = sb.from("notifications").update({ read: true });
      must(ids === "all" ? await q.eq("read", false) : await q.in("id", ids));
    },
  };
}
