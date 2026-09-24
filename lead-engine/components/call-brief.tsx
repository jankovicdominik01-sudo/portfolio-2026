import Link from "next/link";
import { Phone } from "lucide-react";
import { categoryOf, type LeadDetail } from "@/lib/types";
import { telHref } from "@/lib/format";
import { Card, Eyebrow, Section, buttonClass, cn } from "./ui";
import { FadeIn } from "./motion";
import { SourceTag } from "./evidence";

/**
 * Call brief. V režime „caller“ je to celá obrazovka pre kamaráta
 * (mobile-first: firma → telefón → hook → čo povedať → CTA).
 * V režime „admin“ sú to sekcie 🗣️ Čo povedať + 💰 Ponuka v detaile leadu.
 */
export function CallBrief({ lead, mode }: { lead: LeadDetail; mode: "caller" | "admin" }) {
  const b = lead.call_brief;
  const a = lead.analysis;
  if (!b || !a) return null;

  if (mode === "admin") {
    return (
      <>
        <Section icon="🗣️" title="Čo povedať" aside={<span className="text-[11px] text-white/30">Call brief pre kamaráta</span>}>
          <Script b={b} />
          <Objections b={b} />
        </Section>
        <OfferCard b={b} />
      </>
    );
  }

  const c = lead.company;
  const cat = categoryOf(c.category);
  const observation = a.observations[0];
  return (
    <div className="pb-24">
      <FadeIn>
        <div className="text-[14px] text-white/45">
          {cat.emoji} {cat.label}
          {c.city ? ` · ${c.city}` : ""}
        </div>
        <h1 className="mt-1.5 text-[30px] leading-tight font-semibold tracking-[-0.035em]">{c.name}</h1>
        {c.phone ? (
          <a href={telHref(c.phone)} className="mt-2 inline-block text-[22px] font-medium tracking-tight text-white/90 tabular-nums">
            {c.phone}
          </a>
        ) : null}
      </FadeIn>

      <FadeIn delay={0.05} className="mt-6">
        <Card className="p-5">
          <Eyebrow>🎯 Hlavná myšlienka</Eyebrow>
          <p className="mt-2 text-[18px] leading-snug font-medium tracking-[-0.01em]">{b.main_idea}</p>
        </Card>
      </FadeIn>

      <FadeIn delay={0.1} className="mt-3">
        <Card className="p-5">
          <Eyebrow>🗣️ Ako začať hovor</Eyebrow>
          <p className="mt-2 text-[17px] leading-relaxed text-white/90">„{b.call_opening}“</p>
          <div className="mt-5">
            <Eyebrow>Čo povedať ďalej</Eyebrow>
            <p className="mt-2 text-[16px] leading-relaxed text-white/75">„{b.natural_pitch}“</p>
          </div>
        </Card>
      </FadeIn>

      <div className="mt-3 grid gap-3">
        <Card className="p-5">
          <Eyebrow>❤️ Čo je na firme dobré</Eyebrow>
          <ul className="mt-2 space-y-2">
            {a.positive_points.length ? (
              a.positive_points.slice(0, 3).map((p) => (
                <li key={p.text} className="text-[15px] leading-relaxed text-white/80">
                  · {p.text} <SourceTag ids={p.evidence_ids} evidence={a.evidence} />
                </li>
              ))
            ) : (
              <li className="text-[15px] text-white/45">Neoverené — pozri si ich web a nájdi jednu vec.</li>
            )}
          </ul>
        </Card>

        <Card className="p-5">
          <Eyebrow>👀 Čo sme si všimli</Eyebrow>
          <p className="mt-2 text-[15px] leading-relaxed text-white/80">
            {observation ? (
              <>
                {observation.text} <SourceTag ids={observation.evidence_ids} evidence={a.evidence} />
              </>
            ) : (
              "Nenájdený výrazný problém."
            )}
          </p>
          <div className="mt-4">
            <Eyebrow>Prečo je to relevantné</Eyebrow>
            <p className="mt-2 text-[15px] leading-relaxed text-white/65">{b.reason}</p>
          </div>
        </Card>

        <Card className="p-5">
          <Eyebrow>🤝 Ako spomenúť Dominika</Eyebrow>
          <p className="mt-2 text-[15px] leading-relaxed text-white/80">„{b.dominik_intro}“</p>
          <p className="mt-3 text-[13px] text-white/40">Až keď sa rozhovor rozbehne — nie v prvých sekundách.</p>
        </Card>

        <OfferCard b={b} compact />

        <Card className="p-5 ring-ok/20">
          <Eyebrow className="text-green-300/80">🏁 Cieľ hovoru</Eyebrow>
          <p className="mt-2 text-[16px] font-medium">{b.goal}</p>
          <p className="mt-2 text-[15px] text-white/70">„{b.key_question}“</p>
        </Card>

        <Card className="p-5">
          <Eyebrow>🚫 Čo nespomínať</Eyebrow>
          <ul className="mt-2 space-y-1.5 text-[14px] text-white/60">
            {b.what_not_to_say.map((w) => (
              <li key={w}>· {w}</li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <Objections b={b} />
        </Card>
      </div>

      {/* Obrovské CTA — vždy po ruke na mobile */}
      <div className="fixed inset-x-0 bottom-0 z-20 bg-gradient-to-t from-bg via-bg/95 to-transparent px-4 pt-8 pb-[max(16px,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-[640px]">
          <Link href={`/leady/leads/${lead.id}/call`} className={buttonClass("brand", "xl", "w-full")}>
            <Phone className="size-5" /> VOLÁM
          </Link>
        </div>
      </div>
    </div>
  );
}

function Script({ b }: { b: NonNullable<LeadDetail["call_brief"]> }) {
  const steps = [
    { k: "Prvá veta", v: b.call_opening },
    { k: "Pochvala + pozorovanie", v: b.natural_pitch },
    { k: "Dominik", v: b.dominik_intro },
    { k: "Otázka", v: b.key_question },
  ];
  return (
    <div>
      <p className="mb-5 text-[15px] leading-relaxed text-white/60">
        <span className="text-white/35">Hlavná myšlienka:</span> {b.main_idea}
      </p>
      <ol className="space-y-4">
        {steps.map((s, i) => (
          <li key={s.k} className="grid grid-cols-[22px_1fr] gap-3">
            <span className="mt-0.5 font-mono text-[12px] text-white/25">{i + 1}</span>
            <div>
              <div className="text-[12px] text-white/35">{s.k}</div>
              <p className="mt-0.5 text-[15px] leading-relaxed text-white/85">„{s.v}“</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-5 rounded-2xl bg-white/[0.03] p-4 text-[13px] text-white/50 ring-1 ring-inset ring-line">
        <span className="text-white/70">Cieľ:</span> {b.goal}
      </div>
    </div>
  );
}

function Objections({ b }: { b: NonNullable<LeadDetail["call_brief"]> }) {
  return (
    <details className="group mt-0 [&:not(:first-child)]:mt-6">
      <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-semibold tracking-[0.16em] text-white/40 uppercase hover:text-white/70">
        💬 Keď povedia…
        <span className="text-white/25 transition group-open:rotate-45">+</span>
      </summary>
      <ul className="mt-4 space-y-4">
        {b.objections.map((o) => (
          <li key={o.objection}>
            <div className="text-[15px] font-medium">„{o.objection}“</div>
            <div className="mt-1 text-[15px] leading-relaxed text-white/60">→ {o.answer}</div>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Ponuka je vizuálne oddelená od faktov o firme. */
function OfferCard({ b, compact }: { b: NonNullable<LeadDetail["call_brief"]>; compact?: boolean }) {
  if (!b.offer) {
    if (compact) return null;
    return (
      <Section icon="💰" title="Ponuka">
        <p className="text-[14px] text-white/45">
          Pre tento segment nemáme rozpracovaný web. Kamarát cenu ani hotový web nespomína — rieši to až Dominik.
        </p>
      </Section>
    );
  }
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[var(--radius-card)] bg-brand/[0.05] p-5 ring-1 ring-inset ring-brand/20 sm:p-6",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <Eyebrow className="text-orange-200/80">💰 Ponuka · nie fakt o firme</Eyebrow>
        {b.estimated_price ? (
          <span className="rounded-full bg-brand/15 px-2.5 py-1 text-[12px] font-medium text-orange-200">
            do ~{b.estimated_price} €
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-white/85">„{b.offer}“</p>
      <p className="mt-3 text-[12px] text-white/40">
        Spomeň až keď je záujem. Cenu nehovor v prvej vete.
      </p>
    </div>
  );
}
