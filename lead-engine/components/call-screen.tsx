"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, ChevronDown, Copy, Loader2, Phone } from "lucide-react";
import { callerCallAction, opportunityFeedbackAction } from "@/app/leady/actions";
import type { CallCard } from "@/lib/script";
import type { OpportunityCallCard } from "@/lib/call-card";
import { OUTCOME_LABEL, type CallerOutcome } from "@/lib/types";
import { telHref } from "@/lib/format";
import { Button, ButtonLink, Eyebrow, inputClass, cn } from "./ui";
import { SuccessMark } from "./motion";
import { FeedbackBox, TruthPanel } from "./truth-card";

const EASE = [0.16, 1, 0.3, 1] as const;
const screen = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

const OUTCOMES: { o: CallerOutcome; icon: string; hint?: string; tone?: "ok" | "bad" }[] = [
  { o: "consent", icon: "🔥", hint: "Dominik sa im môže ozvať", tone: "ok" },
  { o: "no_answer", icon: "📵" },
  { o: "call_later", icon: "📅" },
  { o: "interested", icon: "👍", hint: "zavoláš znova ty" },
  { o: "not_interested", icon: "✋" },
  { o: "wrong_number", icon: "❓" },
  { o: "do_not_call", icon: "⛔", tone: "bad" },
];

export type CallScreenProps = {
  leadId: string;
  name: string;
  city: string | null;
  segment: string;
  phone: string | null;
  about: string | null;
  attempts: number;
  callbackNote: string | null;
  card: CallCard;
  /** Call Card v3 (Opportunity Engine). Keď je, nahrádza pôvodný scenár. */
  opportunityCard?: OpportunityCallCard | null;
  /** Doterajšie odpovede operátora na predpoklady (CONFIRM / REJECT / UNKNOWN). */
  feedback?: { signal_code: string; result: "confirmed" | "rejected" | "unknown" }[];
  details: { label: string; points: number }[];
  risks: { label: string; points: number }[];
  websiteLabel: string | null;
  evidence: { excerpt: string; url: string | null }[];
  price: number | null;
  nextHref: string | null;
  backHref: string;
};

type Step = "card" | "outcome" | "form" | "done";

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const plusDays = (n: number) => ymd(new Date(Date.now() + n * 86_400_000));

export function CallScreen(p: CallScreenProps) {
  const [step, setStep] = useState<Step>("card");
  const [outcome, setOutcome] = useState<CallerOutcome | null>(null);
  const [note, setNote] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState("");
  const [person, setPerson] = useState("");
  const [said, setSaid] = useState("");
  const [caught, setCaught] = useState("");
  const [heardPrice, setHeardPrice] = useState<boolean | null>(null);
  const [callNote, setCallNote] = useState("");
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ handoff: boolean } | null>(null);
  const [pending, start] = useTransition();

  const isHandoff = outcome === "consent" || outcome === "wants_info";
  const needsTalk = isHandoff || outcome === "interested";

  const pick = (o: CallerOutcome) => {
    setOutcome(o);
    setError(null);
    setDate(null);
    setTime("");
    if (o === "no_answer") return save(o);
    setStep("form");
  };

  const save = (o: CallerOutcome | null = outcome) => {
    if (!o) return;
    if (o === "call_later" && !date) return setError("Vyber deň, kedy zavolať.");
    if ((o === "consent" || o === "wants_info" || o === "interested") && heardPrice === null) return setError("Označ, či zaznela cena.");
    if (o === "interested" && !caught && !said) return setError("Napíš, čo ich zaujalo alebo čo povedali.");
    start(async () => {
      const r = await callerCallAction(p.leadId, {
        outcome: o,
        note: note || null,
        callback_on: o === "call_later" || o === "interested" ? date : null,
        callback_time: time || null,
        consent:
          o === "consent" || o === "wants_info" || o === "interested"
            ? {
                contact_person: person || null,
                company_said: said || null,
                caught_attention: caught || null,
                heard_price: !!heardPrice,
                call_on: date,
                call_note: callNote || null,
                email: email || null,
              }
            : null,
      });
      if (!r.ok) return setError(r.message);
      setResult({ handoff: !!r.handoff });
      setStep("done");
    });
  };

  const copy = async () => {
    if (!p.phone) return;
    await navigator.clipboard?.writeText(p.phone).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mx-auto max-w-[560px] pb-28">
      <AnimatePresence mode="wait">
        {step === "card" ? (
          <motion.div key="card" {...screen}>
            <Link href={p.backHref} className="inline-flex items-center gap-1.5 text-sm text-white/45">
              <ArrowLeft className="size-4" /> Dnes
            </Link>

            {/* FIRMA */}
            <div className="mt-5">
              <div className="text-[13px] text-white/45">
                {p.segment}
                {p.city ? ` · ${p.city}` : ""}
                {p.attempts ? ` · ${p.attempts + 1}. pokus` : ""}
              </div>
              <h1 className="mt-1 text-[28px] leading-tight font-semibold tracking-[-0.03em]">{p.name}</h1>
              {p.about ? <p className="mt-1.5 text-[15px] leading-relaxed text-white/60">{p.about}</p> : null}
              {p.callbackNote ? (
                <p className="mt-3 rounded-2xl bg-warn/10 px-4 py-2.5 text-[14px] text-yellow-100 ring-1 ring-warn/20">📅 {p.callbackNote}</p>
              ) : null}
            </div>

            {p.opportunityCard ? <OpportunityPanel c={p.opportunityCard} /> : null}

            {p.phone ? (
              <div className="mt-5 flex gap-2">
                <a
                  href={telHref(p.phone)}
                  className="flex h-16 flex-1 items-center justify-center gap-3 rounded-[22px] bg-ok text-[20px] font-semibold text-black tabular-nums shadow-[0_12px_40px_-14px_rgba(34,197,94,0.7)] active:scale-[0.99]"
                >
                  <Phone className="size-5" /> Zavolať {p.phone}
                </a>
                <button
                  onClick={copy}
                  aria-label="Kopírovať číslo"
                  className="grid size-16 place-items-center rounded-[22px] bg-white/[0.05] ring-1 ring-inset ring-line"
                >
                  {copied ? <Check className="size-5 text-green-300" /> : <Copy className="size-5 text-white/60" />}
                </button>
              </div>
            ) : (
              <p className="mt-4 text-red-300">Telefón chýba — napíš Dominikovi.</p>
            )}

            {p.opportunityCard ? null : (
              <>
            {p.card.truth ? (
              <TruthPanel t={p.card.truth} />
            ) : (
              /* PREČO VOLÁME (staršie leady bez profilu radaru) */
              <Box label="Prečo voláme" className="mt-6">
                <p className="text-[17px] leading-snug font-medium">{p.card.why}</p>
                <p className={cn("mt-1.5 text-[13px]", p.card.web_verified ? "text-green-300/80" : "text-yellow-200/80")}>
                  {p.card.web_verified ? `✓ ${p.card.verified ?? "Overené"}` : "⚠ Stav webu nie je 100 % overený — iba sa pýtaj"}
                </p>
              </Box>
            )}

            {/* SCENÁR */}
            <div className="mt-6 space-y-5">
              <Line n={1} label="Začni">
                „{p.card.opener}“
              </Line>
              <Line n={2} label="Môžeš sa opýtať">
                {p.card.questions.map((q) => (
                  <span key={q} className="block">
                    „{q}“
                  </span>
                ))}
              </Line>
              <Line n={3} label={p.card.truth ? "Uhol hovoru" : "Prechod k webu"}>
                „{p.card.transition}“
              </Line>
              <Line n={4} label="Dominik">
                „{p.card.dominik}“
              </Line>
              <div className="rounded-3xl bg-ok/[0.07] p-5 ring-1 ring-ok/25">
                <Eyebrow className="text-green-300/80">Hlavný cieľ</Eyebrow>
                <p className="mt-1.5 text-[19px] font-semibold">„{p.card.consent_question}“</p>
              </div>
            </div>

              </>
            )}

            <Box label="Ak sa spýtajú „odkiaľ máte moje číslo?“" className="mt-6">
              <p className="text-[15px] text-white/80">„{p.card.source_answer}“</p>
            </Box>

            {p.opportunityCard ? null : (
            <Box label="Na čo si dať pozor" className="mt-4">
                <ul className="space-y-1.5 text-[14px] leading-relaxed text-white/65">
                  {p.card.cautions.map((c) => (
                    <li key={c}>• {c}</li>
                  ))}
                </ul>
              </Box>
            )}

            <details className="group mt-4 rounded-2xl bg-white/[0.02] ring-1 ring-inset ring-line">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3.5 text-[14px] text-white/55">
                Prečo sme tento lead vybrali?
                <ChevronDown className="size-4 transition group-open:rotate-180" />
              </summary>
              <div className="space-y-3 px-4 pb-4 text-[13px] text-white/60">
                {p.websiteLabel ? <p>Web: {p.websiteLabel}</p> : null}
                {p.details.length ? (
                  <ul className="space-y-1">
                    {p.details.map((d) => (
                      <li key={d.label}>
                        <span className="text-green-300">+{d.points}</span> {d.label}
                      </li>
                    ))}
                    {p.risks.map((d) => (
                      <li key={d.label}>
                        <span className="text-yellow-200">{d.points}</span> {d.label}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {p.evidence.map((e, i) => (
                  <p key={i} className="border-l border-line pl-3 italic">
                    {e.url ? (
                      <a href={e.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
                        {e.excerpt}
                      </a>
                    ) : (
                      e.excerpt
                    )}
                  </p>
                ))}
              </div>
            </details>

            <FeedbackBox leadId={p.leadId} />

            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur-xl">
              <div className="mx-auto max-w-[560px]">
                <Button variant="primary" size="xl" className="w-full" onClick={() => setStep("outcome")}>
                  Hovor skončil, zapísať výsledok
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}

        {step === "outcome" ? (
          <motion.div key="outcome" {...screen}>
            <button onClick={() => setStep("card")} className="inline-flex items-center gap-1.5 text-sm text-white/45">
              <ArrowLeft className="size-4" /> {p.name}
            </button>
            <h2 className="mt-6 text-[26px] font-semibold tracking-[-0.03em]">Ako to dopadlo?</h2>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              {OUTCOMES.map(({ o, icon, tone }) => (
                <button
                  key={o}
                  disabled={pending}
                  onClick={() => pick(o)}
                  className={cn(
                    "flex min-h-[76px] flex-col items-start justify-center gap-1 rounded-[20px] px-4 py-3 text-left text-[15px] leading-tight font-medium transition active:scale-[0.98]",
                    tone === "ok"
                      ? "col-span-2 min-h-[84px] bg-ok text-black"
                      : tone === "bad"
                        ? "bg-red-500/10 text-red-200 ring-1 ring-inset ring-red-400/20"
                        : "bg-white/[0.05] ring-1 ring-inset ring-line",
                  )}
                >
                  <span className="text-xl">{icon}</span>
                  <span>
                    {OUTCOME_LABEL[o]}
                    {OUTCOMES.find((x) => x.o === o)?.hint ? (
                      <span className="block text-[12px] font-normal opacity-70">{OUTCOMES.find((x) => x.o === o)?.hint}</span>
                    ) : null}
                    {pending && outcome === o ? <Loader2 className="ml-2 inline size-4 animate-spin" /> : null}
                  </span>
                </button>
              ))}
            </div>
            {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
          </motion.div>
        ) : null}

        {step === "form" && outcome ? (
          <motion.div key="form" {...screen}>
            <button onClick={() => setStep("outcome")} className="inline-flex items-center gap-1.5 text-sm text-white/45">
              <ArrowLeft className="size-4" /> Zmeniť výsledok
            </button>
            <h2 className="mt-6 text-[24px] font-semibold tracking-[-0.03em]">{OUTCOME_LABEL[outcome]}</h2>
            {outcome === "consent" ? (
              <p className="mt-1 text-[14px] text-white/50">Firma súhlasí, aby sa jej Dominik ozval. Zapíš iba to, čo naozaj zaznelo.</p>
            ) : outcome === "interested" ? (
              <p className="mt-1 text-[14px] text-white/50">Zaujalo ich to, ale ešte nechcú, aby volal Dominik. Lead ostáva tebe.</p>
            ) : null}

            <div className="mt-6 space-y-5">
              {needsTalk ? (
                <>
                  <Input label="S kým si hovoril? (meno / funkcia)" value={person} onChange={setPerson} placeholder="napr. p. Novák, majiteľ" />
                  <Area label="Čo povedal? (jedna veta)" value={said} onChange={setSaid} placeholder="napr. Nech sa ozve, pozrieme sa na to." />
                  <Area label="Čo ho zaujalo? (ak niečo)" value={caught} onChange={setCaught} placeholder="voliteľné" />
                  <div>
                    <span className="mb-2 block text-[14px] text-white/55">Zaznela cena{p.price ? ` ${p.price} €` : ""}?</span>
                    <div className="grid grid-cols-2 gap-2">
                      {[true, false].map((v) => (
                        <Chip key={String(v)} on={heardPrice === v} onClick={() => setHeardPrice(v)}>
                          {v ? "Áno" : "Nie"}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  {isHandoff ? (
                    <>
                      <DatePick label="Kedy môže Dominik zavolať?" value={date} onChange={setDate} optional />
                      <Input label="Čas (HH:MM)" value={time} onChange={setTime} placeholder="napr. 15:30" />
                      <Input label="Poznámka k volaniu" value={callNote} onChange={setCallNote} placeholder="napr. volať až po 15:00" />
                    </>
                  ) : (
                    <>
                      <DatePick label="Kedy im zavoláš znova? (voliteľné)" value={date} onChange={setDate} optional />
                      <Input label="Čas (HH:MM)" value={time} onChange={setTime} placeholder="napr. 10:00" />
                    </>
                  )}
                  {outcome === "wants_info" ? (
                    <Input label="E-mail (ak chce info mailom)" value={email} onChange={setEmail} placeholder="meno@firma.sk" type="email" />
                  ) : null}
                </>
              ) : null}
              {outcome === "call_later" ? (
                <>
                  <DatePick label="Kedy zavolať znova?" value={date} onChange={setDate} />
                  <Input label="Čas (HH:MM, voliteľné)" value={time} onChange={setTime} placeholder="napr. 14:00" />
                </>
              ) : null}
              {outcome === "do_not_call" ? (
                <p className="rounded-2xl bg-red-500/10 p-4 text-[14px] text-red-100 ring-1 ring-red-400/20">
                  Firma sa už nikdy automaticky nevráti do tvojej fronty.
                </p>
              ) : null}
              <Area label="Krátka poznámka" value={note} onChange={setNote} placeholder="voliteľné" />
              {p.opportunityCard?.hypotheses.length && !["wrong_number", "do_not_call"].includes(outcome) ? (
                <HypothesisFeedback leadId={p.leadId} items={p.opportunityCard.hypotheses} initial={p.feedback ?? []} />
              ) : null}
            </div>

            {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
            <Button
              variant={isHandoff ? "ok" : "primary"}
              size="xl"
              className="mt-8 w-full"
              disabled={pending}
              onClick={() => save()}
            >
              {pending ? <Loader2 className="size-5 animate-spin" /> : null}
              {isHandoff ? "Odovzdať Dominikovi" : "Uložiť"}
            </Button>
          </motion.div>
        ) : null}

        {step === "done" ? (
          <motion.div key="done" {...screen} className="flex flex-col items-center pt-14 text-center">
            <SuccessMark tone={result?.handoff ? "ok" : "neutral"} />
            <h2 className="mt-7 text-[26px] font-semibold tracking-[-0.03em]">
              {result?.handoff ? "Odovzdané Dominikovi" : "Uložené"}
            </h2>
            <p className="mt-2 text-[15px] text-white/50">
              {result?.handoff ? "Dominik uvidí, čo firma povedala a kedy volať." : "Pokračuj ďalšou firmou."}
            </p>
            {p.nextHref ? (
              <ButtonLink href={p.nextHref} variant="ok" size="xl" className="mt-10 w-full">
                Ďalšia firma
              </ButtonLink>
            ) : (
              <ButtonLink href={p.backHref} variant="primary" size="lg" className="mt-10">
                Späť na Dnes
              </ButtonLink>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Box({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-3xl bg-white/[0.03] p-5 ring-1 ring-inset ring-line", className)}>
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Line({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-white/[0.07] text-[12px] text-white/60">{n}</span>
      <div>
        <div className="text-[12px] font-medium tracking-wide text-white/40 uppercase">{label}</div>
        <div className="mt-1 text-[17px] leading-relaxed text-white/90">{children}</div>
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-12 rounded-2xl text-[15px] ring-1 ring-inset transition",
        on ? "bg-white text-black ring-white" : "text-white/75 ring-line",
      )}
    >
      {children}
    </button>
  );
}

function DatePick({
  label,
  value,
  onChange,
  optional,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  optional?: boolean;
}) {
  const quick: [string, string][] = [
    ["Zajtra", plusDays(1)],
    ["O 3 dni", plusDays(3)],
    ["O týždeň", plusDays(7)],
  ];
  return (
    <div>
      <span className="mb-2 block text-[14px] text-white/55">
        {label}
        {optional ? " (voliteľné)" : ""}
      </span>
      <div className="grid grid-cols-3 gap-2">
        {quick.map(([l, d]) => (
          <Chip key={l} on={value === d} onClick={() => onChange(value === d ? null : d)}>
            {l}
          </Chip>
        ))}
      </div>
      <input
        type="date"
        value={value ?? ""}
        min={plusDays(0)}
        onChange={(e) => onChange(e.target.value || null)}
        className={cn(inputClass, "mt-2")}
        aria-label="Iný dátum"
      />
    </div>
  );
}

function Input(props: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[14px] text-white/55">{props.label}</span>
      <input
        type={props.type ?? "text"}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className={cn(inputClass, "text-[16px]")}
      />
    </label>
  );
}

function Area(props: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[14px] text-white/55">{props.label}</span>
      <textarea
        rows={2}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className={cn(inputClass, "resize-none text-[16px]")}
      />
    </label>
  );
}

const LEVEL_TONE: Record<string, string> = {
  VERIFIED: "bg-green-400/15 text-green-200 ring-green-400/30",
  OBSERVED: "bg-sky-400/15 text-sky-100 ring-sky-400/30",
  ESTIMATE: "bg-yellow-400/15 text-yellow-100 ring-yellow-400/30",
  UNKNOWN: "bg-white/[0.06] text-white/50 ring-line",
};

export function LevelBadge({ level }: { level: string }) {
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[10px] font-semibold tracking-[0.06em] ring-1 ring-inset", LEVEL_TONE[level] ?? LEVEL_TONE.UNKNOWN)}>
      {level}
    </span>
  );
}

/**
 * Call Card v3: firma → prečo → max. 3 fakty s úrovňou dôkazu → nápad na systém
 * → jedna veta na začiatok → 2 až 3 otázky → ďalší krok. Rozhovor vedie operátor sám.
 */
function OpportunityPanel({ c }: { c: OpportunityCallCard }) {
  return (
    <div className="mt-5 space-y-4">
      <Box label="Prečo voláme">
        {c.why.map((w) => (
          <p key={w} className="text-[17px] leading-snug font-medium">{w}</p>
        ))}
        {c.company.website ? (
          <a href={c.company.website} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[14px] text-white/60 underline underline-offset-2">
            Otvoriť ich web
          </a>
        ) : null}
      </Box>

      <Box label={c.call_reason.type === "PROCESS" ? "Dôvod A: videný ručný proces" : c.call_reason.type === "WEB_SYSTEM" ? "Dôvod B: web / systém, proces nepoznáme" : "Dôvod hovoru"}>
        {c.known.length ? (
          <ul className="space-y-1 text-[14px] text-white/80">
            {c.known.map((k) => (
              <li key={k}>✓ {k}</li>
            ))}
          </ul>
        ) : null}
        {c.unknown.length ? (
          <ul className="mt-2 space-y-1 text-[14px] text-yellow-100/85">
            {c.unknown.map((k) => (
              <li key={k}>? {k}</li>
            ))}
          </ul>
        ) : null}
      </Box>

      {c.facts.length ? (
        <Box label="Čo sme našli">
          <ul className="space-y-3">
            {c.facts.map((f) => (
              <li key={f.evidence_id} className="flex items-start gap-2.5">
                <LevelBadge level={f.level} />
                <div className="min-w-0">
                  <p className="text-[15px] leading-snug text-white/90">{f.text}</p>
                  {f.excerpt ? <p className="mt-0.5 text-[13px] break-words text-white/45">„{f.excerpt}“</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </Box>
      ) : null}

      {c.system_idea ? (
        <Box label="Nápad na systém">
          <p className="text-[17px] font-medium">{c.system_idea}</p>
          {c.benefit ? <p className="mt-1 text-[14px] text-white/60">{c.benefit}</p> : null}
          {c.system_is_hypothesis ? <p className="mt-1 text-[13px] text-yellow-200/80">Hypotéza pre segment, over otázkami.</p> : null}
        </Box>
      ) : null}

      <Line n={1} label="Začni">„{c.opening}“</Line>
      <Line n={2} label="Opýtaj sa">
        {c.questions.map((q) => (
          <span key={q} className="block">„{q}“</span>
        ))}
      </Line>
      <div className="rounded-3xl bg-ok/[0.07] p-5 ring-1 ring-ok/25">
        <Eyebrow className="text-green-300/80">Ďalší krok</Eyebrow>
        <p className="mt-1.5 text-[19px] font-semibold">„{c.next_step.ask}“</p>
        <p className="mt-1.5 text-[13px] text-white/55">{c.next_step.rule}</p>
      </div>
      <details className="rounded-2xl bg-white/[0.02] text-[14px] text-white/60 ring-1 ring-inset ring-line">
        <summary className="cursor-pointer list-none px-4 py-3">Na čo si dať pozor</summary>
        <div className="space-y-1 px-4 pb-3">
          {c.cautions.map((x) => (
            <p key={x}>{x}</p>
          ))}
        </div>
      </details>
    </div>
  );
}

const RESULTS = [
  { r: "confirmed", label: "Sedí" },
  { r: "rejected", label: "Nesedí" },
  { r: "unknown", label: "Neviem" },
] as const;

/** Po hovore: sedeli predpoklady? Ukladá sa hneď, voliteľné. Hypotéza ≠ potvrdenie. */
function HypothesisFeedback({ leadId, items, initial }: { leadId: string; items: OpportunityCallCard["hypotheses"]; initial: NonNullable<CallScreenProps["feedback"]> }) {
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(initial.map((f) => [f.signal_code, f.result])));
  const [pending, start] = useTransition();
  const set = (code: string, text: string, r: (typeof RESULTS)[number]["r"]) => {
    setVals((v) => ({ ...v, [code]: r }));
    start(async () => {
      await opportunityFeedbackAction(leadId, { signal_code: code, predicted: text, result: r, note: null });
    });
  };
  return (
    <div className="rounded-3xl bg-white/[0.03] p-4 ring-1 ring-inset ring-line">
      <Eyebrow>Sedeli predpoklady? (voliteľné)</Eyebrow>
      <ul className="mt-3 space-y-3">
        {items.map((h) => (
          <li key={h.code}>
            <p className="text-[14px] text-white/80">{h.text}</p>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {RESULTS.map((x) => (
                <button
                  key={x.r}
                  disabled={pending}
                  onClick={() => set(h.code, h.text, x.r)}
                  className={cn(
                    "h-9 rounded-xl text-[13px] ring-1 ring-inset",
                    vals[h.code] === x.r ? "bg-white text-black ring-white" : "bg-white/[0.04] text-white/70 ring-line",
                  )}
                >
                  {x.label}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
