"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { authenticate, loginRateLimited, loginSucceeded, requireUser, setupStatus } from "@/lib/auth";
import { SESSION_COOKIE, SESSION_TTL_S, signSession } from "@/lib/session";
import {
  AccessError,
  addCallerFeedback,
  analyzeLead,
  resolveFeedback,
  saveRouting,
  archiveLead,
  assignLead,
  createOrMergeLead,
  logCallerCall,
  logDominikCall,
  logSalesStep,
  markCommissionPaid,
  reassignFromInactive,
  saveSettings,
  saveNotes,
  setStatus,
  updateCompany,
} from "@/lib/leads";
import { importRows, parseImport } from "@/lib/import";
import { SALES_STEPS } from "@/lib/workflow";
import { db } from "@/lib/db";
import {
  ARCHIVE_REASONS,
  CALLER_OUTCOMES,
  CATEGORY_IDS,
  DOMINIK_OUTCOMES,
  FEEDBACK_KINDS,
  LEAD_STATUSES,
  LeadInputSchema,
  normalizeUrl,
} from "@/lib/types";

export type ActionResult = { ok: boolean; message: string };

const fail = (e: unknown): ActionResult => ({
  ok: false,
  message: e instanceof AccessError || e instanceof Error ? e.message : "Niečo sa pokazilo. Skús to znova.",
});

const refreshAll = () => revalidatePath("/leady", "layout");

/* ─────────────── Auth ─────────────── */

export async function loginAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!setupStatus().ready) return { ok: false, message: "Lead Engine ešte nemá pripojené úložisko." };
  if (loginRateLimited(ip)) return { ok: false, message: "Príliš veľa pokusov. Skús to o chvíľu." };

  const user = await authenticate(String(fd.get("username") ?? ""), String(fd.get("password") ?? ""));
  if (!user) return { ok: false, message: "Nesprávne meno alebo heslo." };
  loginSucceeded(ip);

  (await cookies()).set(SESSION_COOKIE, await signSession(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/leady",
    maxAge: SESSION_TTL_S,
  });
  redirect("/leady");
}

export async function logoutAction() {
  (await cookies()).delete({ name: SESSION_COOKIE, path: "/leady" });
  redirect("/leady/login");
}

/* ─────────────── Leady ─────────────── */

export async function createLeadAction(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const user = await requireUser("admin");
  const parsed = LeadInputSchema.safeParse({
    name: fd.get("name"),
    category: fd.get("category"),
    city: fd.get("city"),
    phone: fd.get("phone"),
    email: fd.get("email"),
    website: fd.get("website"),
    contact_person: fd.get("contact_person"),
    note: fd.get("note"),
    source: "manual",
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Skontroluj údaje." };
  let leadId: string;
  try {
    ({ leadId } = await createOrMergeLead(user, parsed.data));
  } catch (e) {
    return fail(e);
  }
  refreshAll();
  redirect(`/leady/leads/${leadId}?new=1`);
}

export async function analyzeAction(leadId: string): Promise<ActionResult & { ready?: boolean }> {
  const user = await requireUser("admin");
  try {
    const r = await analyzeLead(user, leadId);
    refreshAll();
    if (r.nothingFound) return { ok: true, ready: false, message: "Nenašli sme nič zaujímavé. Lead zváž vyradiť." };
    return r.ready
      ? { ok: true, ready: true, message: "Lead je pripravený na telefonát." }
      : { ok: true, ready: false, message: "Analýza hotová — niečo treba ešte overiť." };
  } catch {
    return { ok: false, message: "Firmu sa nepodarilo overiť. Skús to znova." };
  }
}

const ymdOpt = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional()
  .transform((v) => v ?? null);
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => v || null);

const CallerCall = z.object({
  outcome: z.enum(CALLER_OUTCOMES),
  note: text(1000),
  callback_on: ymdOpt,
  consent: z
    .object({
      contact_person: text(120),
      company_said: text(1000),
      caught_attention: text(500),
      heard_price: z.boolean(),
      call_on: ymdOpt,
      call_note: text(200),
      email: text(200).refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "E-mail vyzerá neplatne"),
    })
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});

export async function callerCallAction(
  leadId: string,
  input: z.input<typeof CallerCall>,
): Promise<ActionResult & { handoff?: boolean }> {
  const user = await requireUser();
  const parsed = CallerCall.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Skontroluj údaje." };
  try {
    const r = await logCallerCall(user, leadId, parsed.data);
    // Zámerne nie celý layout — obrazovka hovoru má ostať na „hotovo“ aj keď lead odišiel Dominikovi.
    revalidatePath("/leady");
    revalidatePath("/leady/leads");
    revalidatePath("/leady/inbox");
    revalidatePath("/leady/earnings");
    return {
      ok: true,
      handoff: r.handoff,
      message: r.handoff ? "Kontakt odovzdaný Dominikovi." : "Uložené.",
    };
  } catch (e) {
    return fail(e);
  }
}

const SalesStepInput = z.object({
  step: z.enum(SALES_STEPS),
  note: text(1000),
  date: ymdOpt,
  price: z.number().min(0).max(100000).nullable().optional().transform((v) => v ?? null),
});

export async function salesStepAction(leadId: string, input: z.input<typeof SalesStepInput>): Promise<ActionResult> {
  const user = await requireUser("admin");
  const p = SalesStepInput.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Skontroluj údaje." };
  try {
    await logSalesStep(user, leadId, p.data.step, { note: p.data.note, date: p.data.date, price: p.data.price });
    refreshAll();
    return { ok: true, message: "Uložené." };
  } catch (e) {
    return fail(e);
  }
}

export async function dominikCallAction(leadId: string, outcome: string, note: string): Promise<ActionResult> {
  const user = await requireUser("admin");
  const o = z.enum(DOMINIK_OUTCOMES).safeParse(outcome);
  if (!o.success) return { ok: false, message: "Neplatný výsledok." };
  try {
    await logDominikCall(user, leadId, o.data, note.trim().slice(0, 1000) || null);
    refreshAll();
    return { ok: true, message: "Hovor uložený." };
  } catch (e) {
    return fail(e);
  }
}

/* ─────────────── Peniaze a nastavenia ─────────────── */

const num = z.number().min(0).max(100000).nullable();
const SettingsInput = z.object({
  compensation: z.object({
    model: z.enum(["handoff", "sale", "both"]).nullable(),
    handoff_amount: num,
    handoff_condition: z.enum(["on_consent", "on_contacted", "on_interest"]).nullable(),
    sale_amount: num,
    sale_percent: z.number().min(0).max(100).nullable(),
  }),
  package: z.object({
    price: num,
    pages: text(300),
    texts: text(300),
    images: text(300),
    form: text(300),
    domain: text(300),
    hosting: text(300),
    edits: text(300),
    maintenance: text(300),
    delivery: text(300),
  }),
});

export async function saveSettingsAction(input: z.input<typeof SettingsInput>): Promise<ActionResult> {
  const user = await requireUser("admin");
  const p = SettingsInput.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Skontroluj údaje." };
  try {
    await saveSettings(user, p.data);
    refreshAll();
    return { ok: true, message: "Nastavenia uložené. Nevyplatené odmeny sa prepočítali." };
  } catch (e) {
    return fail(e);
  }
}

export async function markPaidAction(commissionId: string): Promise<ActionResult> {
  const user = await requireUser("admin");
  try {
    await markCommissionPaid(user, commissionId);
    refreshAll();
    return { ok: true, message: "Označené ako vyplatené." };
  } catch (e) {
    return fail(e);
  }
}

export async function reassignInactiveAction(): Promise<ActionResult> {
  const user = await requireUser("admin");
  try {
    const r = await reassignFromInactive(user);
    refreshAll();
    return { ok: true, message: r.moved ? `Presunuté: ${r.moved} nevolaných leadov → ${r.to}.` : "Nie je čo presúvať." };
  } catch (e) {
    return fail(e);
  }
}

export async function setStatusAction(leadId: string, status: string): Promise<ActionResult> {
  const user = await requireUser("admin");
  const s = z.enum(LEAD_STATUSES).safeParse(status);
  if (!s.success) return { ok: false, message: "Neplatný stav." };
  try {
    await setStatus(user, leadId, s.data);
    refreshAll();
    return { ok: true, message: "Stav zmenený." };
  } catch (e) {
    return fail(e);
  }
}

export async function archiveAction(leadId: string, reason: string): Promise<ActionResult> {
  const user = await requireUser("admin");
  const r = z.enum(ARCHIVE_REASONS).safeParse(reason);
  if (!r.success) return { ok: false, message: "Vyber dôvod." };
  try {
    await archiveLead(user, leadId, r.data);
    refreshAll();
    return { ok: true, message: "Lead vyradený." };
  } catch (e) {
    return fail(e);
  }
}

export async function notesAction(leadId: string, notes: string): Promise<ActionResult> {
  const user = await requireUser("admin");
  try {
    await saveNotes(user, leadId, notes);
    refreshAll();
    return { ok: true, message: "Poznámky uložené." };
  } catch (e) {
    return fail(e);
  }
}

export async function assignAction(leadId: string, username: string): Promise<ActionResult> {
  const user = await requireUser("admin");
  try {
    await assignLead(user, leadId, username || null);
    refreshAll();
    return { ok: true, message: "Priradené." };
  } catch (e) {
    return fail(e);
  }
}

const CompanyPatch = z.object({
  name: z.string().trim().min(2).max(200),
  category: z.enum(CATEGORY_IDS),
  city: z.string().trim().max(120).transform((v) => v || null),
  phone: z.string().trim().max(40).transform((v) => v || null),
  email: z.string().trim().max(200).transform((v) => v || null),
  website: z.string().trim().max(300).transform((v) => normalizeUrl(v || null)),
  address: z.string().trim().max(300).transform((v) => v || null),
  contact_person: z.string().trim().max(120).transform((v) => v || null),
});

export async function updateCompanyAction(leadId: string, input: z.input<typeof CompanyPatch>): Promise<ActionResult> {
  const user = await requireUser("admin");
  const p = CompanyPatch.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Skontroluj údaje." };
  try {
    await updateCompany(user, leadId, p.data);
    refreshAll();
    return { ok: true, message: "Firma upravená." };
  } catch (e) {
    return fail(e);
  }
}

/* ─────────────── Import ─────────────── */

export type ImportResult = ActionResult & {
  created?: number;
  merged?: number;
  invalid?: { row: number; error: string }[];
};

export async function importAction(text: string, analyze: boolean): Promise<ImportResult> {
  const user = await requireUser("admin");
  if (text.length > 2_000_000) return { ok: false, message: "Súbor je príliš veľký (max 2 MB)." };
  const rows = parseImport(text);
  if (!rows.ok) return { ok: false, message: rows.error };
  const res = await importRows(user, rows.rows, "import");
  if (analyze && res.leadIds.length) {
    // Analýza beží po odpovedi — Dominik nemusí čakať.
    after(async () => {
      for (const id of res.leadIds.slice(0, 10)) {
        try {
          await analyzeLead(user, id);
        } catch {
          /* ďalší lead */
        }
      }
    });
  }
  refreshAll();
  return {
    ok: true,
    created: res.created,
    merged: res.merged,
    invalid: res.invalid,
    message:
      `${res.created} nových, ${res.merged} zlúčených` +
      (res.invalid.length ? `, ${res.invalid.length} riadkov s chybou` : "") +
      (analyze && res.leadIds.length ? `. Analyzujem ${Math.min(res.leadIds.length, 10)} firiem…` : "."),
  };
}

/* ─────────────── Ponuky (existing_offer) ─────────────── */

const OfferInput = z.object({
  id: z.string().optional(),
  category: z.enum(CATEGORY_IDS),
  available: z.boolean(),
  estimated_price: z.number().int().min(0).max(100000).nullable(),
  note: z.string().trim().min(3, "Doplň krátky popis").max(300),
  preview_url: z.string().trim().max(300).nullable().transform((v) => normalizeUrl(v || null)),
});

export async function saveOfferAction(input: z.input<typeof OfferInput>): Promise<ActionResult> {
  await requireUser("admin");
  const p = OfferInput.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Skontroluj údaje." };
  const r = await db();
  const existing = p.data.id ? (await r.listOffers()).find((o) => o.id === p.data.id) : null;
  await r.upsertOffer({
    id: existing?.id ?? `offer_${crypto.randomUUID().slice(0, 8)}`,
    category: p.data.category,
    available: p.data.available,
    estimated_price: p.data.estimated_price,
    note: p.data.note,
    preview_url: p.data.preview_url,
    created_at: existing?.created_at ?? new Date().toISOString(),
  });
  refreshAll();
  return { ok: true, message: "Ponuka uložená. Prejaví sa pri ďalšej analýze leadu." };
}

export async function deleteOfferAction(id: string): Promise<ActionResult> {
  await requireUser("admin");
  await (await db()).deleteOffer(id);
  refreshAll();
  return { ok: true, message: "Ponuka zmazaná." };
}

/* ─────────────── Notifikácie ─────────────── */

export async function markReadAction(ids: string[] | "all"): Promise<ActionResult> {
  await requireUser("admin");
  await (await db()).markNotificationsRead(ids);
  refreshAll();
  return { ok: true, message: "" };
}

/* ─────────────── Lead Radar ─────────────── */

const FeedbackInput = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  note: z.string().trim().max(300).nullable().optional().transform((v) => v || null),
  url: z
    .string()
    .trim()
    .max(300)
    .nullable()
    .optional()
    .transform((v) => (v ? normalizeUrl(v) : null)),
});

/** Volajúci: „Má web, systém ho nenašiel“, „Zlý web“, „Zlá kategória“… → lead ide na preverenie. */
export async function feedbackAction(leadId: string, input: z.input<typeof FeedbackInput>): Promise<ActionResult> {
  const user = await requireUser();
  const p = FeedbackInput.safeParse(input);
  if (!p.success) return { ok: false, message: p.error.issues[0]?.message ?? "Skontroluj údaje." };
  try {
    await addCallerFeedback(user, leadId, p.data);
    revalidatePath("/leady");
    revalidatePath("/leady/quality");
    return { ok: true, message: "Ďakujem — dáta sa preveria." };
  } catch (e) {
    return fail(e);
  }
}

export async function resolveFeedbackAction(leadId: string, feedbackId: string): Promise<ActionResult> {
  const user = await requireUser("admin");
  try {
    await resolveFeedback(user, leadId, feedbackId);
    refreshAll();
    return { ok: true, message: "Vybavené." };
  } catch (e) {
    return fail(e);
  }
}

const RoutingInput = z.record(z.enum(CATEGORY_IDS), z.string().trim().max(40).nullable());

export async function saveRoutingAction(input: z.input<typeof RoutingInput>): Promise<ActionResult> {
  const user = await requireUser("admin");
  const p = RoutingInput.safeParse(input);
  if (!p.success) return { ok: false, message: "Neplatný routing." };
  try {
    await saveRouting(user, p.data);
    refreshAll();
    return { ok: true, message: "Routing uložený — platí pre nové leady." };
  } catch (e) {
    return fail(e);
  }
}
