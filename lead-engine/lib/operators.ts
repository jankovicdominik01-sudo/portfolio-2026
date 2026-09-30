/**
 * Operátori: ľudia, ktorí za DJWeby robia jeden kanál (dnes iba CALL).
 *
 * Systém nie je naprogramovaný na konkrétne mená. Operátor je záznam, ktorý sa dá
 * pridať, pozastaviť alebo vypnúť bez zmeny kódu (env LE_OPERATORS). Nový lead dostane
 * iba operátor s týmto záznamom; samotný účet s rolou caller nestačí.
 *
 * Do záznamu operátora nepatria osobné ani zdravotné údaje, iba pracovné
 * (kanály, kapacita, segmenty, dostupnosť).
 */
import { z } from "zod";
import { CATEGORY_IDS, type CategoryId } from "./types";

export const OPERATOR_STATUSES = ["ACTIVE", "PAUSED", "INACTIVE"] as const;
export type OperatorStatus = (typeof OPERATOR_STATUSES)[number];

export const OPERATOR_CHANNELS = ["CALL", "SMS", "EMAIL"] as const;
export type OperatorChannel = (typeof OPERATOR_CHANNELS)[number];

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
  /** Voľný text, napr. „po až pi, 9 až 16“. */
  availability: z.string().nullable().default(null),
  /** Iba pracovné poznámky. */
  notes: z.string().nullable().default(null),
});
export type Operator = z.infer<typeof OperatorSchema>;

/** Predvolení operátori, kým nie je LE_OPERATORS. Pracovné číslo je UNKNOWN, kým nebude samostatná SIM. */
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

/**
 * Operátori = LE_OPERATORS (JSON pole) alebo DEFAULT_OPERATORS.
 * Neplatný JSON sa ignoruje a použije sa predvolený zoznam.
 */
export function configuredOperators(raw = process.env.LE_OPERATORS): Operator[] {
  if (!raw) return DEFAULT_OPERATORS;
  const parsed = z.array(OperatorSchema).safeParse(safeJson(raw));
  return parsed.success ? parsed.data : DEFAULT_OPERATORS;
}

/** Operátor, ktorý môže dnes dostať hovor v danom segmente. */
export function canTakeCall(op: Operator, category: CategoryId | string, assignedToday = 0): boolean {
  if (op.status !== "ACTIVE") return false;
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
