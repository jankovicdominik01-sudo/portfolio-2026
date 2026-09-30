/**
 * Operátori: ľudia, ktorí za DJWeby robia jeden kanál (dnes iba CALL).
 *
 * Systém nie je naprogramovaný na konkrétne mená. Operátor je záznam, ktorý sa dá
 * pridať, pozastaviť alebo vypnúť bez zmeny kódu (env LE_OPERATORS).
 *
 * Soňa a Jozo sú LEGACY: nové leady nedostávajú, ich hovory, eventy a výsledky
 * ostávajú kvôli analytike. Do záznamu operátora nepatria osobné ani zdravotné údaje,
 * iba pracovné (kanály, kapacita, segmenty, dostupnosť).
 */
import { z } from "zod";
import { CATEGORY_IDS, type CategoryId, type UserInfo } from "./types";

export const OPERATOR_STATUSES = ["ACTIVE", "PAUSED", "INACTIVE"] as const;
export type OperatorStatus = (typeof OPERATOR_STATUSES)[number];

export const OPERATOR_CHANNELS = ["CALL", "SMS", "EMAIL"] as const;
export type OperatorChannel = (typeof OPERATOR_CHANNELS)[number];

/** Pôvodní volajúci. Nikdy nedostanú nový lead, aj keby ich env omylom zapol. */
export const LEGACY_OPERATORS: readonly string[] = ["sona", "jozo"];

export const OperatorSchema = z.object({
  operator_id: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(OPERATOR_STATUSES),
  channels: z.array(z.enum(OPERATOR_CHANNELS)).default(["CALL"]),
  /** Iba pracovné číslo určené pre Lead Engine, nikdy osobné. null = zatiaľ UNKNOWN. */
  phone_number: z.string().nullable().default(null),
  /** Max. nových leadov za deň. null = bez limitu. */
  daily_capacity: z.number().int().positive().nullable().default(null),
  /** Prázdne = všetky segmenty. */
  assigned_segments: z.array(z.enum(CATEGORY_IDS)).default([]),
  /** Voľný text, napr. „po–pi 9–16“. */
  availability: z.string().nullable().default(null),
  /** Iba pracovné poznámky. */
  notes: z.string().nullable().default(null),
});
export type Operator = z.infer<typeof OperatorSchema>;

/** Prvý aktívny operátor. Pracovné číslo je UNKNOWN, kým nebude samostatná SIM. */
export const DEFAULT_OPERATORS: Operator[] = [
  {
    operator_id: "roman",
    name: "Roman",
    status: "ACTIVE",
    channels: ["CALL"],
    phone_number: null,
    daily_capacity: null,
    assigned_segments: [],
    availability: null,
    notes: null,
  },
];

export function isLegacy(id: string | null | undefined): boolean {
  return !!id && LEGACY_OPERATORS.includes(id);
}

/**
 * Operátori = LE_OPERATORS (JSON pole) alebo DEFAULT_OPERATORS, doplnení o ostatných
 * volajúcich z účtov (kvôli histórii a filtrom). Legacy sú vždy INACTIVE.
 * Neplatný JSON sa ignoruje a použije sa predvolený zoznam.
 */
export function configuredOperators(users: Pick<UserInfo, "username" | "name" | "role" | "active">[] = [], raw = process.env.LE_OPERATORS): Operator[] {
  let base = DEFAULT_OPERATORS;
  if (raw) {
    const parsed = z.array(OperatorSchema).safeParse(safeJson(raw));
    if (parsed.success) base = parsed.data;
  }
  const byId = new Map(base.map((o) => [o.operator_id, o]));
  for (const u of users) {
    if (u.role !== "caller" || byId.has(u.username)) continue;
    byId.set(u.username, {
      ...DEFAULT_OPERATORS[0],
      operator_id: u.username,
      name: u.name,
      status: u.active ? "ACTIVE" : "INACTIVE",
    });
  }
  return [...byId.values()].map((o) => (isLegacy(o.operator_id) ? { ...o, status: "INACTIVE" as const } : o));
}

/** Operátor, ktorý môže dnes dostať hovor v danom segmente. */
export function canTakeCall(op: Operator, category: CategoryId | string, assignedToday = 0): boolean {
  if (op.status !== "ACTIVE" || isLegacy(op.operator_id)) return false;
  if (!op.channels.includes("CALL")) return false;
  if (op.assigned_segments.length && !op.assigned_segments.includes(category as CategoryId)) return false;
  if (op.daily_capacity !== null && assignedToday >= op.daily_capacity) return false;
  return true;
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
