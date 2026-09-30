/**
 * Demo Engine, strana Lead Engine: zostaví údaje pre krátke personalizované demo.
 *
 * Demo nie je vygenerovaný web. Je to jedna scéna zo simulátora na djweby.sk
 * (strana zákazníka + dashboard firmy) naplnená iba údajmi s evidence z Lead Radaru.
 * Čo nemáme overené, sa do dema nedostane: namiesto toho ostane neutrálny text šablóny.
 *
 * Tvar DemoPayload je dátový kontrakt s djweby.sk (web/lib/dj-core/contracts.ts).
 * Pri zmene treba upraviť obe strany.
 *
 * V1 má iba 3 šablóny: autoservis, stavebná firma, salón / barber.
 */
import { randomBytes } from "node:crypto";
import type { Opportunity } from "./opportunity";
import type { Company, RadarProfile } from "./types";

export const DEMO_TEMPLATES = ["service_booking", "project_pipeline", "appointment"] as const;
export type DemoTemplateId = (typeof DEMO_TEMPLATES)[number];

export function hasDemoTemplate(id: string | null | undefined): id is DemoTemplateId {
  return !!id && (DEMO_TEMPLATES as readonly string[]).includes(id);
}

/** Platnosť odkazu (ASSUMPTION z návrhu, nastaviteľné). */
export const DEMO_TTL_DAYS = 30;

export type DemoPayload = {
  version: 1;
  code: string;
  template: DemoTemplateId;
  business: { name: string; city: string | null; services: string[] };
  /** Odkiaľ je každý personalizovaný údaj. Pole, ktoré tu nie je, sa v deme neukáže ako ich. */
  evidence: { field: "name" | "city" | "services"; source: string }[];
  created_at: string;
  expires_at: string;
};

export class DemoError extends Error {}

export function buildDemoPayload(opts: {
  company: Pick<Company, "name" | "city">;
  profile: RadarProfile | null | undefined;
  opportunity: Opportunity;
  nowIso: string;
  code?: string;
}): DemoPayload {
  const t = opts.opportunity.recommended_system?.id;
  if (!hasDemoTemplate(t)) throw new DemoError("Pre tento segment zatiaľ nemáme šablónu dema.");
  const p = opts.profile;
  const evidence: DemoPayload["evidence"] = [];

  // Meno: brand z radaru (má zdroje) alebo meno firmy v Lead Engine (zadané človekom / z katalógu).
  const name = p?.brand_names?.[0] ?? opts.company.name;
  evidence.push({ field: "name", source: p?.brand_names?.[0] ? "Lead Radar: brand_names" : "Lead Engine: company.name" });

  const city = p?.city ?? opts.company.city ?? null;
  if (city) evidence.push({ field: "city", source: p?.city ? "Lead Radar: city" : "Lead Engine: company.city" });

  // Služby iba z webu / katalógu (radar ich klasifikuje zo zdrojov). Bez nich ostanú služby šablóny.
  const services = (p?.services ?? []).filter((s) => s && s.length <= 60).slice(0, 5);
  if (services.length) evidence.push({ field: "services", source: "Lead Radar: services" });

  const created = new Date(opts.nowIso);
  const expires = new Date(created.getTime() + DEMO_TTL_DAYS * 86_400_000);
  return {
    version: 1,
    code: opts.code ?? demoCode(),
    template: t,
    business: { name, city, services },
    evidence,
    created_at: created.toISOString(),
    expires_at: expires.toISOString(),
  };
}

/** Nehádateľný kód do URL (8 znakov, bez zameniteľných znakov). */
export function demoCode(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(8);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}
