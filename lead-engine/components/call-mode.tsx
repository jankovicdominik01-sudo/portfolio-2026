"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Loader2, Phone } from "lucide-react";
import { callerCallAction } from "@/app/leady/actions";
import { OUTCOME_LABEL, type CallOutcome, type CallWhen } from "@/lib/types";
import { telHref } from "@/lib/format";
import { Button, ButtonLink, Eyebrow, inputClass, cn } from "./ui";
import { SuccessMark } from "./motion";

const MAIN: { o: CallOutcome; icon: string; tone?: "ok" }[] = [
  { o: "dominik_may_call", icon: "✅", tone: "ok" },
  { o: "call_later", icon: "🟡" },
  { o: "not_interested", icon: "❌" },
  { o: "wants_email", icon: "📩" },
  { o: "no_answer", icon: "☎️" },
];
const MORE: CallOutcome[] = ["wants_demo", "wants_price", "has_web", "wrong_number", "not_exists", "other"];

const EASE = [0.16, 1, 0.3, 1] as const;
const screen = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
};

type Step = "call" | "outcome" | "form" | "done";

/** Režim hovoru: minimum rušivých vecí, jedna veta, jeden cieľ. */
export function CallMode(props: {
  leadId: string;
  name: string;
  city: string | null;
  phone: string | null;
  opening: string;
  remember: string;
  hook: string;
  dominik: string;
  offer: string | null;
  question: string;
  backHref: string;
}) {
  const [step, setStep] = useState<Step>("call");
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [note, setNote] = useState("");
  const [when, setWhen] = useState<CallWhen | null>(null);
  const [email, setEmail] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handoff, setHandoff] = useState(false);
  const [pending, start] = useTransition();

  const needsWhen = outcome === "dominik_may_call" || outcome === "call_later" || outcome === "wants_demo" || outcome === "wants_price";
  const needsEmail = outcome === "wants_email";

  const pick = (o: CallOutcome) => {
    setOutcome(o);
    setError(null);
    if (o === "no_answer") return save(o);
    setStep("form");
  };

  const save = (o: CallOutcome | null = outcome) => {
    if (!o) return;
    start(async () => {
      const r = await callerCallAction(props.leadId, {
        outcome: o,
        note: note || null,
        company_said: o === "dominik_may_call" || o === "wants_demo" || o === "wants_price" ? note || null : null,
        preferred_time: when,
        email: email || null,
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setHandoff(!!r.handoff);
      setStep("done");
    });
  };

  return (
    <div className="mx-auto min-h-[70dvh] max-w-[560px]">
      <AnimatePresence mode="wait">
        {step === "call" ? (
          <motion.div key="call" {...screen}>
            <Link href={props.backHref} className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white">
              <ArrowLeft className="size-4" /> Späť na brief
            </Link>
            <div className="mt-8 text-center">
              <div className="text-[14px] text-white/40">{props.city}</div>
              <h1 className="mt-1 text-[30px] leading-tight font-semibold tracking-[-0.035em]">{props.name}</h1>
              {props.phone ? (
                <a
                  href={telHref(props.phone)}
                  className="mt-5 inline-flex items-center gap-3 rounded-full bg-ok/10 px-6 py-3.5 text-[24px] font-medium tracking-tight text-green-200 tabular-nums ring-1 ring-ok/25 transition hover:bg-ok/15"
                >
                  <Phone className="size-5" /> {props.phone}
                </a>
              ) : (
                <p className="mt-4 text-red-300">Telefón chýba.</p>
              )}
            </div>

            <div className="mt-10 space-y-6">
              <Block label="Začni týmto">
                <p className="text-[22px] leading-snug font-medium tracking-[-0.015em]">„{props.opening}“</p>
              </Block>
              <Block label="Potom">
                <p className="text-[17px] leading-relaxed text-white/80">„{props.hook}“</p>
              </Block>
              <Block label="Nezabudni spomenúť">
                <p className="text-[16px] leading-relaxed text-white/70">{props.remember}</p>
                <p className="mt-2 text-[16px] leading-relaxed text-white/70">„{props.dominik}“</p>
                {props.offer ? (
                  <p className="mt-2 rounded-2xl bg-brand/[0.06] p-3 text-[14px] leading-relaxed text-orange-100/80 ring-1 ring-brand/15">
                    💰 Ak je záujem: „{props.offer}“
                  </p>
                ) : null}
              </Block>
              <div className="rounded-3xl bg-ok/[0.06] p-5 ring-1 ring-ok/20">
                <Eyebrow className="text-green-300/80">Cieľ</Eyebrow>
                <p className="mt-1.5 text-[17px] font-medium">Zisti, či môže Dominik zavolať.</p>
                <p className="mt-1 text-[15px] text-white/60">„{props.question}“</p>
              </div>
            </div>

            <Button variant="primary" size="xl" className="mt-10 w-full" onClick={() => setStep("outcome")}>
              Hovor skončil
            </Button>
          </motion.div>
        ) : null}

        {step === "outcome" ? (
          <motion.div key="outcome" {...screen}>
            <button onClick={() => setStep("call")} className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white">
              <ArrowLeft className="size-4" /> {props.name}
            </button>
            <h2 className="mt-8 text-[28px] font-semibold tracking-[-0.03em]">Čo sa stalo?</h2>
            <div className="mt-6 space-y-2.5">
              {MAIN.map(({ o, icon, tone }) => (
                <button
                  key={o}
                  disabled={pending}
                  onClick={() => pick(o)}
                  className={cn(
                    "flex w-full items-center gap-4 rounded-[22px] px-5 text-left text-[17px] font-medium tracking-tight transition active:scale-[0.99]",
                    tone === "ok"
                      ? "h-[72px] bg-ok text-black shadow-[0_12px_40px_-14px_rgba(34,197,94,0.7)] hover:brightness-110"
                      : "h-16 bg-white/[0.04] ring-1 ring-inset ring-line hover:bg-white/[0.07]",
                  )}
                >
                  <span className="text-xl">{icon}</span>
                  {OUTCOME_LABEL[o]}
                  {pending && outcome === o ? <Loader2 className="ml-auto size-4 animate-spin" /> : null}
                </button>
              ))}
            </div>
            <button onClick={() => setShowMore((v) => !v)} className="mt-5 text-[14px] text-white/40 hover:text-white">
              {showMore ? "Menej možností" : "Iné výsledky…"}
            </button>
            <AnimatePresence>
              {showMore ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 flex flex-wrap gap-2 overflow-hidden"
                >
                  {MORE.map((o) => (
                    <button
                      key={o}
                      onClick={() => pick(o)}
                      className="rounded-full px-4 py-2 text-[14px] text-white/70 ring-1 ring-inset ring-line hover:bg-white/[0.05]"
                    >
                      {OUTCOME_LABEL[o]}
                    </button>
                  ))}
                </motion.div>
              ) : null}
            </AnimatePresence>
            {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
          </motion.div>
        ) : null}

        {step === "form" && outcome ? (
          <motion.div key="form" {...screen}>
            <button onClick={() => setStep("outcome")} className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white">
              <ArrowLeft className="size-4" /> Zmeniť výsledok
            </button>
            <h2 className="mt-8 text-[26px] font-semibold tracking-[-0.03em]">{OUTCOME_LABEL[outcome]}</h2>

            <div className="mt-6 space-y-5">
              <label className="block">
                <span className="mb-2 block text-[14px] text-white/55">
                  {outcome === "dominik_may_call" || outcome === "wants_demo" || outcome === "wants_price"
                    ? "Čo firma povedala? (jedna veta)"
                    : "Krátka poznámka"}
                </span>
                <textarea
                  autoFocus
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder={
                    outcome === "dominik_may_call"
                      ? "Napr. Web by ich zaujímal, ale chcú vidieť, čo by tam reálne bolo."
                      : "Voliteľné"
                  }
                  className={cn(inputClass, "resize-none text-[16px]")}
                />
              </label>

              {needsWhen ? (
                <div>
                  <span className="mb-2 block text-[14px] text-white/55">
                    {outcome === "call_later" ? "Kedy sa ozvať?" : "Kedy má Dominik zavolať?"}
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {(["today", "tomorrow", "later"] as CallWhen[]).map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setWhen(w)}
                        className={cn(
                          "h-12 rounded-2xl text-[15px] ring-1 ring-inset transition",
                          when === w ? "bg-white text-black ring-white" : "text-white/70 ring-line hover:bg-white/[0.05]",
                        )}
                      >
                        {{ today: "Dnes", tomorrow: "Zajtra", later: "Neskôr" }[w]}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {needsEmail ? (
                <label className="block">
                  <span className="mb-2 block text-[14px] text-white/55">E-mail</span>
                  <input
                    type="email"
                    inputMode="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="meno@firma.sk"
                    className={inputClass}
                  />
                </label>
              ) : null}
            </div>

            {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
            <Button
              variant={outcome === "dominik_may_call" ? "ok" : "primary"}
              size="xl"
              className="mt-8 w-full"
              disabled={pending}
              onClick={() => save()}
            >
              {pending ? <Loader2 className="size-5 animate-spin" /> : null}
              {outcome === "dominik_may_call" ? "Odovzdať Dominikovi" : "Uložiť"}
            </Button>
          </motion.div>
        ) : null}

        {step === "done" ? (
          <motion.div key="done" {...screen} className="flex flex-col items-center pt-16 text-center">
            <SuccessMark tone={handoff ? "ok" : "neutral"} />
            <h2 className="mt-8 text-[26px] font-semibold tracking-[-0.03em]">
              {handoff ? "Kontakt odovzdaný Dominikovi" : "Uložené"}
            </h2>
            <p className="mt-2 text-[15px] text-white/45">
              {handoff ? "Dominik to má v inboxe aj s tým, čo firma povedala." : "Pokračuj ďalšou firmou."}
            </p>
            <ButtonLink href={props.backHref === "/leady" ? "/leady" : props.backHref} variant="primary" size="lg" className="mt-10">
              {props.backHref === "/leady" ? "Ďalšia firma" : "Späť na lead"}
            </ButtonLink>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Eyebrow>{label}</Eyebrow>
      <div className="mt-2">{children}</div>
    </div>
  );
}
