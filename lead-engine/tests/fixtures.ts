import type { Company, Lead, Offer, SessionUser, Settings } from "../lib/types";
import { defaultSettings } from "../lib/types";

export const NOW = "2026-09-27T09:00:00.000Z";
export const SONA: SessionUser = { username: "sona", name: "Soňa", role: "caller" };
export const JOZO: SessionUser = { username: "jozo", name: "Jozo", role: "caller" };
export const ADMIN: SessionUser = { username: "dominik", name: "Dominik Jankovič", role: "admin" };
export const USERS = [SONA, JOZO, ADMIN];

export function company(p: Partial<Company> = {}): Company {
  return {
    id: "co_1",
    name: "Záhradníctvo Test",
    category: "zahradnictvo",
    city: "Nitra",
    region: null,
    contact_person: null,
    phone: "0905123456",
    email: null,
    address: null,
    website: null,
    social_profiles: [],
    dedupe_keys: ["phone:+421905123456", "name:zahradnictvo-test|nitra"],
    created_at: NOW,
    updated_at: NOW,
    ...p,
  };
}

export function lead(p: Partial<Lead> = {}): Lead {
  return {
    id: "ld_1",
    company_id: "co_1",
    status: "ready_to_call",
    priority: "ready",
    priority_reasons: [],
    source: "routine",
    source_url: null,
    assigned_to: "sona",
    analysis: null,
    call_brief: null,
    trust: { web: "verified", phone: "partial", company: "verified", hook: "verified" },
    qualification: null,
    next_action: "caller_call",
    next_action_at: null,
    last_contact: null,
    call_attempts: 0,
    archive_reason: null,
    notes: "",
    created_at: NOW,
    updated_at: NOW,
    ...p,
  };
}

export const OFFER: Offer = {
  id: "offer_zahradnictvo",
  category: "zahradnictvo",
  available: true,
  estimated_price: 200,
  note: "Hotový web",
  preview_url: null,
  created_at: NOW,
};

export function settings(c: Partial<Settings["compensation"]> = {}): Settings {
  const s = defaultSettings();
  return { ...s, compensation: { ...s.compensation, ...c } };
}
