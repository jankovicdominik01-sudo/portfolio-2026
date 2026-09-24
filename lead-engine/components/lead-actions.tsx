"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Pencil, Phone, Sparkles, X } from "lucide-react";
import {
  analyzeAction,
  archiveAction,
  assignAction,
  dominikCallAction,
  notesAction,
  setStatusAction,
  updateCompanyAction,
} from "@/app/leady/actions";
import {
  ARCHIVE_LABEL,
  ARCHIVE_REASONS,
  CATEGORIES,
  DOMINIK_OUTCOMES,
  DOMINIK_OUTCOME_LABEL,
  type Company,
  type DominikOutcome,
  type LeadStatus,
  type SessionUser,
} from "@/lib/types";
import { telHref } from "@/lib/format";
import { Button, ButtonLink, Field, inputClass, cn, type ButtonSize, type ButtonVariant } from "./ui";

function Feedback({ msg }: { msg: { ok: boolean; message: string } | null }) {
  return (
    <AnimatePresence>
      {msg?.message ? (
        <motion.p
          role="status"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={cn("text-[13px]", msg.ok ? "text-green-300" : "text-red-300")}
        >
          {msg.message}
        </motion.p>
      ) : null}
    </AnimatePresence>
  );
}

/* ─────────────── Analýza ─────────────── */

export function AnalyzeButton({
  leadId,
  label,
  variant = "primary",
  size = "md",
}: {
  leadId: string;
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const router = useRouter();
  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant={variant}
        size={size}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const r = await analyzeAction(leadId);
            setMsg(r);
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {pending ? "Analyzujem firmu…" : label}
      </Button>
      {pending ? (
        <div className="h-1 w-48 overflow-hidden rounded-full bg-white/[0.05]">
          <div className="shimmer h-full w-full" />
        </div>
      ) : null}
      <Feedback msg={msg} />
    </div>
  );
}

/* ─────────────── Dominikov hovor ─────────────── */

export function DominikCallPanel({ leadId, phone }: { leadId: string; phone: string | null }) {
  const [outcome, setOutcome] = useState<DominikOutcome | null>(null);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const router = useRouter();

  return (
    <div className="rounded-3xl bg-black/30 p-5 ring-1 ring-inset ring-line">
      {phone ? (
        <ButtonLink href={telHref(phone)!} variant="ok" size="lg" className="w-full">
          <Phone className="size-4" /> Zavolať {phone}
        </ButtonLink>
      ) : null}
      <div className="mt-5 text-[12px] font-medium text-white/40">Po hovore</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {DOMINIK_OUTCOMES.map((o) => (
          <button
            key={o}
            onClick={() => setOutcome(o)}
            className={cn(
              "rounded-full px-3 py-1.5 text-[13px] ring-1 ring-inset transition",
              outcome === o ? "bg-white text-black ring-white" : "text-white/70 ring-line hover:bg-white/[0.05]",
            )}
          >
            {DOMINIK_OUTCOME_LABEL[o]}
          </button>
        ))}
      </div>
      <AnimatePresence>
        {outcome ? (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="overflow-hidden">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Krátka poznámka — čo potrebujú, rozsah…"
              className={cn(inputClass, "mt-3 resize-none")}
            />
            <Button
              variant="primary"
              className="mt-3 w-full"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await dominikCallAction(leadId, outcome, note);
                  setMsg(r);
                  if (r.ok) router.refresh();
                })
              }
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Uložiť
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <div className="mt-2">
        <Feedback msg={msg} />
      </div>
    </div>
  );
}

/* ─────────────── Pipeline ─────────────── */

const STAGE_ACTIONS: Partial<Record<LeadStatus, { to: LeadStatus; label: string; variant: ButtonVariant }[]>> = {
  analyzed: [{ to: "ready_to_call", label: "Poslať kamarátovi na volanie", variant: "primary" }],
  dominik_call: [
    { to: "offer_sent", label: "Ponuka odoslaná", variant: "primary" },
    { to: "won", label: "Vyhraté", variant: "ok" },
    { to: "lost", label: "Stratené", variant: "ghost" },
  ],
  offer_sent: [
    { to: "negotiation", label: "Rokujeme", variant: "primary" },
    { to: "won", label: "Vyhraté", variant: "ok" },
    { to: "lost", label: "Stratené", variant: "ghost" },
  ],
  negotiation: [
    { to: "won", label: "Vyhraté", variant: "ok" },
    { to: "lost", label: "Stratené", variant: "ghost" },
  ],
  won: [{ to: "negotiation", label: "Vrátiť do rokovania", variant: "ghost" }],
  lost: [{ to: "ready_to_call", label: "Skúsiť znova", variant: "secondary" }],
  archived: [{ to: "analyzed", label: "Obnoviť lead", variant: "secondary" }],
};

export function StageButtons({ leadId, status }: { leadId: string; status: LeadStatus }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const router = useRouter();
  const actions = STAGE_ACTIONS[status] ?? [];
  if (!actions.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button
            key={a.to}
            variant={a.variant}
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await setStatusAction(leadId, a.to);
                setMsg(r.ok ? null : r);
                router.refresh();
              })
            }
          >
            {a.label}
          </Button>
        ))}
      </div>
      <Feedback msg={msg} />
    </div>
  );
}

export function ArchiveControl({ leadId }: { leadId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="text-[13px] text-white/30 hover:text-red-300">
        Vyradiť lead…
      </button>
    );
  return (
    <div className="rounded-2xl bg-white/[0.025] p-4 ring-1 ring-inset ring-line">
      <div className="text-[13px] font-medium text-white/60">Prečo vyradiť?</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {ARCHIVE_REASONS.map((r) => (
          <button
            key={r}
            onClick={() => setReason(r)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[12px] ring-1 ring-inset transition",
              reason === r ? "bg-white text-black ring-white" : "text-white/60 ring-line hover:bg-white/[0.05]",
            )}
          >
            {ARCHIVE_LABEL[r]}
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          variant="danger"
          size="sm"
          disabled={!reason || pending}
          onClick={() =>
            start(async () => {
              await archiveAction(leadId, reason);
              router.refresh();
              setOpen(false);
            })
          }
        >
          Vyradiť
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Zrušiť
        </Button>
      </div>
    </div>
  );
}

/* ─────────────── Poznámky, priradenie, firma ─────────────── */

export function NotesEditor({ leadId, initial }: { leadId: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  const dirty = value !== saved;
  return (
    <div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={4}
        placeholder="Čokoľvek, čo treba vedieť…"
        className={cn(inputClass, "resize-y text-[14px]")}
      />
      <AnimatePresence>
        {dirty ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-2 flex justify-end">
            <Button
              size="sm"
              variant="primary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await notesAction(leadId, value);
                  if (r.ok) setSaved(value);
                })
              }
            >
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : null} Uložiť
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export function AssignSelect({
  leadId,
  value,
  callers,
}: {
  leadId: string;
  value: string | null;
  callers: SessionUser[];
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <label className="inline-flex items-center gap-2 text-[13px] text-white/45">
      Volá:
      <select
        defaultValue={value ?? ""}
        disabled={pending}
        onChange={(e) =>
          start(async () => {
            await assignAction(leadId, e.target.value);
            router.refresh();
          })
        }
        className="rounded-lg bg-white/[0.05] px-2 py-1 text-[14px] text-white ring-1 ring-line focus:outline-none"
      >
        <option value="">— nikto —</option>
        {callers.map((c) => (
          <option key={c.username} value={c.username}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CompanyEditor({ leadId, company }: { leadId: string; company: Company }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const router = useRouter();
  return (
    <>
      <button onClick={() => setOpen(true)} className="text-white/30 hover:text-white" aria-label="Upraviť firmu">
        <Pencil className="size-3.5" />
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.form
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-raised p-6 ring-1 ring-line-strong sm:rounded-3xl"
              action={(fd) =>
                start(async () => {
                  const r = await updateCompanyAction(leadId, {
                    name: String(fd.get("name")),
                    category: String(fd.get("category")) as Company["category"],
                    city: String(fd.get("city")),
                    phone: String(fd.get("phone")),
                    email: String(fd.get("email")),
                    website: String(fd.get("website")),
                    address: String(fd.get("address")),
                    contact_person: String(fd.get("contact_person")),
                  });
                  setMsg(r);
                  if (r.ok) {
                    router.refresh();
                    setOpen(false);
                  }
                })
              }
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="text-[17px] font-semibold">Upraviť firmu</div>
                <button type="button" onClick={() => setOpen(false)} className="text-white/40 hover:text-white">
                  <X className="size-5" />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Názov" className="sm:col-span-2">
                  <input name="name" defaultValue={company.name} className={inputClass} required />
                </Field>
                <Field label="Kategória">
                  <select name="category" defaultValue={company.category} className={inputClass}>
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {c.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Mesto">
                  <input name="city" defaultValue={company.city ?? ""} className={inputClass} />
                </Field>
                <Field label="Telefón">
                  <input name="phone" defaultValue={company.phone ?? ""} className={inputClass} inputMode="tel" />
                </Field>
                <Field label="E-mail">
                  <input name="email" defaultValue={company.email ?? ""} className={inputClass} inputMode="email" />
                </Field>
                <Field label="Web" className="sm:col-span-2">
                  <input name="website" defaultValue={company.website ?? ""} className={inputClass} inputMode="url" />
                </Field>
                <Field label="Adresa" className="sm:col-span-2">
                  <input name="address" defaultValue={company.address ?? ""} className={inputClass} />
                </Field>
                <Field label="Kontaktná osoba" className="sm:col-span-2">
                  <input name="contact_person" defaultValue={company.contact_person ?? ""} className={inputClass} />
                </Field>
              </div>
              <div className="mt-5 flex items-center justify-between gap-3">
                <Feedback msg={msg && !msg.ok ? msg : null} />
                <Button variant="primary" disabled={pending} className="ml-auto">
                  {pending ? <Loader2 className="size-4 animate-spin" /> : null} Uložiť
                </Button>
              </div>
              <p className="mt-3 text-[12px] text-white/35">Po zmene webu alebo telefónu spusti analýzu znova.</p>
            </motion.form>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
