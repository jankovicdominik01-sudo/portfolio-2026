/**
 * Demo Engine v1 (Phase 2), strana Lead Engine: krátke personalizované demo.
 *
 * Demo nie je vygenerovaný web. Sú to dve obrazovky zo segment templatu:
 *   CUSTOMER   reálny názov firmy, jej verejné služby a jednoduchý dopyt pre segment
 *   DASHBOARD  ten istý dopyt u firmy, zmena stavu (napr. NEW → MEASUREMENT) a notifikácia
 * Cieľ: „Aha. Takto by to vyzeralo u nás.“
 *
 * Personalizácia iba z evidence (Lead Radar). Čo nemáme, nevymýšľame: ostane neutrálny
 * text šablóny. Žiadne recenzie, zákazníci, tržby, počty zákaziek, roky na trhu ani fotky.
 * Ukážkový dopyt je vzor vstupu (čo by zákazník vyplnil), nie skutočný zákazník.
 *
 * Verejne sa vydáva iba publicDemo() projekcia, nikdy interné dáta leadu.
 * `template` (service_booking | project_pipeline | appointment) je kontrakt s djweby.sk
 * (web/lib/dj-core/contracts.ts); polia v2 sú navyše a djweby.sk ich zatiaľ ignoruje.
 */
import { randomBytes } from "node:crypto";
import { atLeast, type Opportunity } from "./opportunity";
import { PIPELINE_STATES, relevantServices, SEGMENT_TEMPLATES, type IntakeField, type PipelineState, type SegmentId } from "./segments";
import type { Company, RadarProfile } from "./types";

export const DEMO_TEMPLATES = ["service_booking", "project_pipeline", "appointment"] as const;
export type DemoTemplateId = (typeof DEMO_TEMPLATES)[number];

export function hasDemoTemplate(id: string | null | undefined): id is DemoTemplateId {
  return !!id && (DEMO_TEMPLATES as readonly string[]).includes(id);
}

/** Platnosť odkazu (ASSUMPTION z návrhu, nastaviteľné). */
export const DEMO_TTL_DAYS = 30;

type Field = "name" | "city" | "services";

export type DemoPayload = {
  version: 2;
  code: string;
  template: DemoTemplateId;
  segment: SegmentId;
  business: { name: string; city: string | null; services: string[] };
  /** Odkiaľ je každý personalizovaný údaj (interné, verejne sa nevydáva). */
  evidence: { field: Field; source: string }[];
  customer: { title: string; fields: (IntakeField & { example: string | null })[] };
  dashboard: { inquiry: { label: string; value: string }[]; from: PipelineState; to: PipelineState; states: { id: PipelineState; label: string }[] };
  notification: string;
  created_at: string;
  expires_at: string;
  /** Dominik môže demo vypnúť; vypnuté sa správa ako neexistujúce. */
  disabled?: boolean;
};

/** Verejná projekcia (DTO). Žiadne skóre, poznámky, hovory, evidence ani interné id. */
export type PublicDemo = Omit<DemoPayload, "evidence" | "disabled" | "created_at"> & { personalized: Field[] };

export class DemoError extends Error {}

export function buildDemoPayload(opts: {
  company: Pick<Company, "name" | "city"> & { category?: string };
  profile: RadarProfile | null | undefined;
  opportunity: Opportunity;
  nowIso: string;
  code?: string;
  /** Aj pri DEMO POTENTIAL LOW (iba Dominik vedome). */
  force?: boolean;
}): DemoPayload {
  const o = opts.opportunity;
  const t = o.recommended_system?.id;
  if (!hasDemoTemplate(t) || !o.recommended_system) throw new DemoError("Pre tento segment zatiaľ nemáme šablónu dema.");
  const dp = o.dimensions?.DEMO_POTENTIAL;
  if (!opts.force && dp && !atLeast(dp.level, "MEDIUM")) throw new DemoError(`Potenciál dema je ${dp.level}: ${dp.reason}`);
  const seg = SEGMENT_TEMPLATES[o.recommended_system.segment];
  const p = opts.profile;
  const evidence: DemoPayload["evidence"] = [];

  // Meno: brand z radaru (má zdroje) alebo meno firmy v Lead Engine (zadané človekom / z katalógu).
  const name = p?.brand_names?.[0] ?? opts.company.name;
  evidence.push({ field: "name", source: p?.brand_names?.[0] ? "Lead Radar: brand_names" : "Lead Engine: company.name" });

  const city = p?.city ?? opts.company.city ?? null;
  if (city) evidence.push({ field: "city", source: p?.city ? "Lead Radar: city" : "Lead Engine: company.city" });

  // Služby iba z webu / katalógu a iba tie, ktoré k segmentu sedia. Bez nich ostanú služby šablóny.
  const services = relevantServices(opts.company.category ?? seg.categories[0], p?.services);
  if (services.length) evidence.push({ field: "services", source: "Lead Radar: services" });

  const ex = { ...seg.demo_example.values } as Record<string, string>;
  if ("location" in ex) ex.location = city ?? "";
  if ("description" in ex && !ex.description) ex.description = services[0] ?? "";
  const fields = seg.intake_schema.map((f) => {
    const options = f.type === "select" && services.length && seg.segment !== "FLOORING_TRADES" ? [...services, "Iné"] : f.options;
    let example = ex[f.id] ?? null;
    if (f.type === "select" && options && example && !options.includes(example)) example = options[0];
    return { ...f, ...(options ? { options } : {}), example: example || null };
  });
  const shown = fields.filter((f) => seg.dashboard_fields.includes(f.id) && f.example);
  const fmt = (f: (typeof fields)[number]) => (f.type === "files" ? `${f.example} fotky` : f.type === "boolean" ? (f.example === "Áno" ? f.label.toLowerCase() : "") : `${f.example}${f.unit ? ` ${f.unit}` : ""}`);
  const [from, to] = seg.demo_example.transition;

  const created = new Date(opts.nowIso);
  const expires = new Date(created.getTime() + DEMO_TTL_DAYS * 86_400_000);
  return {
    version: 2,
    code: opts.code ?? demoCode(),
    template: t,
    segment: seg.segment,
    business: { name, city, services },
    evidence,
    customer: { title: name, fields },
    dashboard: {
      inquiry: shown.map((f) => ({ label: f.label, value: fmt(f) })).filter((x) => x.value),
      from,
      to,
      states: seg.pipeline_states.map((s) => ({ id: s, label: PIPELINE_STATES[s] })),
    },
    notification: seg.demo_example.notification,
    created_at: created.toISOString(),
    expires_at: expires.toISOString(),
  };
}

/** Bezpečná verejná projekcia. Neplatné, vypnuté alebo expirované demo = null. */
export function publicDemoView(d: unknown, nowMs: number): PublicDemo | null {
  const x = d as Partial<DemoPayload> | null | undefined;
  if (!x || x.version !== 2 || x.disabled || !x.expires_at || !x.code || !x.template || !x.segment || !x.business || !x.customer || !x.dashboard) return null;
  if (new Date(x.expires_at).getTime() < nowMs) return null;
  return {
    version: 2,
    code: x.code,
    template: x.template,
    segment: x.segment,
    business: { name: x.business.name, city: x.business.city, services: [...x.business.services] },
    personalized: (x.evidence ?? []).map((e) => e.field),
    customer: x.customer,
    dashboard: x.dashboard,
    notification: x.notification ?? "",
    expires_at: x.expires_at,
  };
}

/** Nehádateľný kód do URL (12 znakov, bez zameniteľných znakov, ~59 bitov). */
export function demoCode(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

export const DEMO_CODE_RE = /^[a-z2-9]{8,12}$/;
