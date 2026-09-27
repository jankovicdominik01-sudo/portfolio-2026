"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Phone } from "lucide-react";
import { salesStepAction } from "@/app/leady/actions";
import type { SalesStep } from "@/lib/workflow";
import type { LeadStatus } from "@/lib/types";
import { telHref } from "@/lib/format";
import { Button, ButtonLink, Eyebrow, inputClass, cn } from "./ui";

const FORWARD: { step: SalesStep; label: string; from: LeadStatus[] }[] = [
  { step: "contacted", label: "Dovolal som sa", from: ["dominik_call"] },
  { step: "interested", label: "Skutočný záujem", from: ["dominik_call", "contacted"] },
  { step: "demo", label: "Ukážka", from: ["contacted", "interested"] },
  { step: "offer", label: "Ponuka poslaná", from: ["contacted", "interested", "demo"] },
  { step: "deal", label: "Dohoda (predané)", from: ["interested", "demo", "offer_sent", "negotiation"] },
  { step: "paid", label: "Zaplatené", from: ["won"] },
];
const SIDE: { step: SalesStep; label: string }[] = [
  { step: "unreachable", label: "Nedovolal som sa" },
  { step: "follow_up", label: "Follow-up" },
  { step: "bad_fit", label: "Nevyhovuje" },
  { step: "not_interested", label: "Nemá záujem" },
];

/**
 * Dominikove kroky po handoffe. Súhlas sa nikdy nepovýši na záujem sám —
 * „Skutočný záujem“ klikne iba Dominik po vlastnom rozhovore.
 */
export function SalesPanel({
  leadId,
  status,
  phone,
  defaultPrice,
}: {
  leadId: string;
  status: LeadStatus;
  phone: string | null;
  defaultPrice: number | null;
}) {
  const [step, setStep] = useState<SalesStep | null>(null);
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [price, setPrice] = useState(defaultPrice ? String(defaultPrice) : "");
  const [msg, setMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const forward = FORWARD.filter((f) => f.from.includes(status));
  const needsDate = step === "follow_up";
  const needsPrice = step === "deal" || step === "paid";

  const submit = () =>
    start(async () => {
      if (!step) return;
      const r = await salesStepAction(leadId, {
        step,
        note: note || null,
        date: date || null,
        price: needsPrice && price ? Number(price) : null,
      });
      setMsg(r);
      if (r.ok) {
        setStep(null);
        setNote("");
        setDate("");
        router.refresh();
      }
    });

  return (
    <div className="rounded-3xl bg-white/[0.03] p-5 ring-1 ring-inset ring-line">
      {phone ? (
        <ButtonLink href={telHref(phone)!} variant="ok" size="lg" className="w-full">
          <Phone className="size-4" /> Zavolať {phone}
        </ButtonLink>
      ) : null}
      <Eyebrow className="mt-5">Výsledok / ďalší krok</Eyebrow>
      <div className="mt-2 flex flex-wrap gap-2">
        {forward.map((f) => (
          <Chip key={f.step} on={step === f.step} onClick={() => setStep(f.step)} tone="ok">
            {f.label}
          </Chip>
        ))}
        {SIDE.map((f) => (
          <Chip key={f.step} on={step === f.step} onClick={() => setStep(f.step)}>
            {f.label}
          </Chip>
        ))}
      </div>
      {step ? (
        <div className="mt-4 space-y-3">
          {needsDate || step === "unreachable" ? (
            <label className="block text-[13px] text-white/55">
              {needsDate ? "Dátum follow-upu" : "Kedy skúsiť znova (voliteľné)"}
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cn(inputClass, "mt-1")} />
            </label>
          ) : null}
          {needsPrice ? (
            <label className="block text-[13px] text-white/55">
              {step === "paid" ? "Zaplatená suma (€)" : "Dohodnutá cena (€)"}
              <input
                type="number"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={cn(inputClass, "mt-1")}
              />
            </label>
          ) : null}
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Krátka poznámka (voliteľné)"
            className={cn(inputClass, "resize-none")}
          />
          <Button variant="primary" className="w-full" disabled={pending} onClick={submit}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null} Uložiť
          </Button>
        </div>
      ) : null}
      {msg ? <p className={cn("mt-3 text-[13px]", msg.ok ? "text-green-300" : "text-red-300")}>{msg.message}</p> : null}
    </div>
  );
}

function Chip({ on, onClick, tone, children }: { on: boolean; onClick: () => void; tone?: "ok"; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3.5 py-2 text-[13px] ring-1 ring-inset transition",
        on ? "bg-white text-black ring-white" : tone === "ok" ? "text-green-200 ring-ok/30" : "text-white/70 ring-line",
      )}
    >
      {children}
    </button>
  );
}
