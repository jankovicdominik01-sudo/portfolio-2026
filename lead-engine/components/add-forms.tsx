"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { FileUp, Loader2, Plus } from "lucide-react";
import { createLeadAction, importAction, type ImportResult } from "@/app/actions";
import { CATEGORIES } from "@/lib/types";
import { Button, Field, inputClass, cn } from "./ui";

export function NewLeadForm() {
  const [state, action, pending] = useActionState(createLeadAction, null);
  return (
    <form action={action} className="mt-5 grid gap-3.5 sm:grid-cols-2">
      <Field label="Názov firmy" className="sm:col-span-2">
        <input name="name" required minLength={2} placeholder="Záhradníctvo Novák" className={inputClass} />
      </Field>
      <Field label="Kategória">
        <select name="category" defaultValue="zahradnictvo" className={inputClass}>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Mesto">
        <input name="city" placeholder="Skalica" className={inputClass} />
      </Field>
      <Field label="Telefón">
        <input name="phone" inputMode="tel" placeholder="+421 9xx xxx xxx" className={inputClass} />
      </Field>
      <Field label="E-mail">
        <input name="email" inputMode="email" placeholder="info@firma.sk" className={inputClass} />
      </Field>
      <Field label="Web" className="sm:col-span-2" hint="Ak firma web nemá, nechaj prázdne.">
        <input name="website" inputMode="url" placeholder="firma.sk" className={inputClass} />
      </Field>
      <Field label="Poznámka" className="sm:col-span-2">
        <textarea name="note" rows={2} placeholder="Odkiaľ o nich vieš, čo si si všimol…" className={cn(inputClass, "resize-none")} />
      </Field>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-red-300 sm:col-span-2">
          {state.message}
        </p>
      ) : null}
      <div className="sm:col-span-2">
        <Button variant="primary" size="lg" className="w-full sm:w-auto" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Uložiť firmu
        </Button>
      </div>
    </form>
  );
}

const SAMPLE = `Názov;Mesto;Telefón;E-mail;Web;Kategória
Záhradníctvo Novák;Skalica;0901 234 567;;zahradnictvonovak.sk;záhradníctvo`;

export function ImportBox() {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [analyze, setAnalyze] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const readFile = async (f: File) => {
    if (f.size > 2_000_000) return setResult({ ok: false, message: "Súbor je príliš veľký (max 2 MB)." });
    setFileName(f.name);
    setText(await f.text());
    setResult(null);
  };

  const rows = text.trim() ? text.trim().split(/\r?\n/).length - (text.trim().startsWith("[") ? 0 : 1) : 0;

  return (
    <div className="mt-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files[0];
          if (f) readFile(f);
        }}
        onClick={() => fileRef.current?.click()}
        className={cn(
          "grid cursor-pointer place-items-center rounded-3xl border border-dashed px-6 py-10 text-center transition",
          drag ? "border-brand/60 bg-brand/[0.05]" : "border-line-strong hover:bg-white/[0.02]",
        )}
      >
        <FileUp className="size-6 text-white/40" />
        <div className="mt-3 text-[15px]">{fileName ?? "Pretiahni sem CSV alebo JSON"}</div>
        <div className="mt-1 text-[13px] text-white/35">alebo klikni a vyber súbor</div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.json,.txt,text/csv,application/json"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])}
        />
      </div>

      <Field label="…alebo vlož obsah" className="mt-4">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setFileName(null);
            setResult(null);
          }}
          rows={5}
          placeholder={SAMPLE}
          className={cn(inputClass, "resize-y font-mono text-[12px]")}
        />
      </Field>

      <label className="mt-4 flex items-center gap-2.5 text-[14px] text-white/65">
        <input type="checkbox" checked={analyze} onChange={(e) => setAnalyze(e.target.checked)} className="size-4 accent-[#f97316]" />
        Hneď analyzovať a pripraviť call brief
      </label>

      <Button
        variant="primary"
        className="mt-5 w-full"
        disabled={!text.trim() || pending}
        onClick={() =>
          start(async () => {
            const r = await importAction(text, analyze);
            setResult(r);
            if (r.ok) {
              setText("");
              setFileName(null);
            }
          })
        }
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {pending ? "Importujem…" : rows > 0 ? `Importovať ${rows} ${rows === 1 ? "firmu" : rows < 5 ? "firmy" : "firiem"}` : "Importovať"}
      </Button>

      {result ? (
        <div
          className={cn(
            "mt-4 rounded-2xl p-4 text-[14px] ring-1",
            result.ok ? "bg-ok/[0.06] text-green-100 ring-ok/20" : "bg-bad/10 text-red-200 ring-bad/20",
          )}
        >
          {result.message}
          {result.invalid?.length ? (
            <ul className="mt-2 space-y-0.5 text-[12px] text-white/50">
              {result.invalid.slice(0, 8).map((i) => (
                <li key={i.row}>
                  Riadok {i.row}: {i.error}
                </li>
              ))}
            </ul>
          ) : null}
          {result.ok ? (
            <Link href="/leads?f=new" className="mt-2 block text-[13px] text-white/60 underline underline-offset-2">
              Zobraziť nové leady
            </Link>
          ) : null}
        </div>
      ) : null}

      <p className="mt-5 text-[12px] leading-relaxed text-white/30">
        Stĺpce: Názov, Mesto, Telefón, E-mail, Web, Kategória, Poznámka. Oddeľovač „;“ alebo „,“. Duplicitné firmy
        (e-mail → telefón → doména → názov+mesto) sa zlúčia, história sa nestratí.
      </p>
    </div>
  );
}
