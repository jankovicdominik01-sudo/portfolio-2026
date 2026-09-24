"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { deleteOfferAction, saveOfferAction } from "@/app/leady/actions";
import { CATEGORIES, categoryOf, type CategoryId, type Offer } from "@/lib/types";
import { Button, Field, inputClass, cn } from "./ui";

export function OffersEditor({ offers }: { offers: Offer[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <div className="space-y-2">
      {offers.map((o) => (
        <OfferRow key={o.id} offer={o} />
      ))}
      {adding ? (
        <OfferForm onDone={() => setAdding(false)} />
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Pridať rozpracovaný web
        </Button>
      )}
    </div>
  );
}

function OfferRow({ offer }: { offer: Offer }) {
  const [pending, start] = useTransition();
  const [edit, setEdit] = useState(false);
  const router = useRouter();
  const cat = categoryOf(offer.category);
  if (edit) return <OfferForm offer={offer} onDone={() => setEdit(false)} />;
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-white/[0.025] px-4 py-3 ring-1 ring-inset ring-line">
      <span className="text-lg">{cat.emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px]">
          {cat.label}
          {offer.estimated_price ? <span className="text-white/40"> · do ~{offer.estimated_price} €</span> : null}
        </div>
        <div className="truncate text-[13px] text-white/40">{offer.note}</div>
      </div>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            await saveOfferAction({ ...offer, available: !offer.available });
            router.refresh();
          })
        }
        className={cn(
          "rounded-full px-3 py-1 text-[12px] font-medium ring-1 ring-inset transition",
          offer.available ? "bg-ok/10 text-green-300 ring-ok/25" : "text-white/40 ring-line",
        )}
        aria-pressed={offer.available}
      >
        {offer.available ? "Dostupný" : "Nedostupný"}
      </button>
      <button onClick={() => setEdit(true)} className="text-[13px] text-white/40 hover:text-white">
        Upraviť
      </button>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            await deleteOfferAction(offer.id);
            router.refresh();
          })
        }
        className="text-white/25 hover:text-red-300"
        aria-label="Zmazať"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

function OfferForm({ offer, onDone }: { offer?: Offer; onDone: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <form
      className="grid gap-3 rounded-2xl bg-white/[0.025] p-4 ring-1 ring-inset ring-line sm:grid-cols-[1fr_140px]"
      action={(fd) =>
        start(async () => {
          const price = String(fd.get("price") ?? "").trim();
          const r = await saveOfferAction({
            id: offer?.id,
            category: String(fd.get("category")) as CategoryId,
            available: fd.get("available") === "on",
            estimated_price: price ? Number(price) : null,
            note: String(fd.get("note") ?? ""),
            preview_url: String(fd.get("preview_url") ?? "") || null,
          });
          if (!r.ok) return setError(r.message);
          router.refresh();
          onDone();
        })
      }
    >
      <Field label="Segment">
        <select name="category" defaultValue={offer?.category ?? "stolarstvo"} className={inputClass}>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Cena do (€)">
        <input name="price" type="number" min={0} defaultValue={offer?.estimated_price ?? 300} className={inputClass} />
      </Field>
      <Field label="Čo to je" className="sm:col-span-2">
        <input name="note" defaultValue={offer?.note ?? ""} placeholder="Rozpracovaný koncept webu pre stolárstvo" className={inputClass} />
      </Field>
      <Field label="Ukážka (voliteľné)" className="sm:col-span-2">
        <input name="preview_url" defaultValue={offer?.preview_url ?? ""} placeholder="https://…" className={inputClass} />
      </Field>
      <label className="flex items-center gap-2 text-[14px] text-white/65 sm:col-span-2">
        <input type="checkbox" name="available" defaultChecked={offer?.available ?? true} className="size-4 accent-[#f97316]" />
        Reálne existuje a je dostupný
      </label>
      {error ? <p className="text-sm text-red-300 sm:col-span-2">{error}</p> : null}
      <div className="flex gap-2 sm:col-span-2">
        <Button variant="primary" size="sm" disabled={pending}>
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : null} Uložiť
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Zrušiť
        </Button>
      </div>
    </form>
  );
}
