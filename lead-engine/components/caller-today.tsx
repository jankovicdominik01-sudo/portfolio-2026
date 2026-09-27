import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { categoryOf, type LeadWithCompany, type SessionUser } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import type { Today } from "@/lib/queue";
import { EmptyState, Eyebrow, cn } from "./ui";
import { FadeIn } from "./motion";

/**
 * Volajúci otvorí appku a vidí presne, komu dnes volať a v akom poradí:
 * 1. dohodnuté callbacky, 2. ďalšie pokusy, 3. nové firmy.
 */
export function CallerToday({
  user,
  today,
  stats,
}: {
  user: SessionUser;
  today: Today<LeadWithCompany>;
  stats: { calls: number; conversations: number; consents: number };
}) {
  const total = today.callbacks.length + today.retries.length + today.fresh.length;
  const first = today.callbacks[0] ?? today.retries[0] ?? today.fresh[0];

  return (
    <div>
      <FadeIn>
        <Eyebrow>Dnes</Eyebrow>
        <h1 className="mt-2 text-[30px] leading-tight font-semibold tracking-[-0.03em]">
          {total ? `${total} ${total === 1 ? "hovor" : total < 5 ? "hovory" : "hovorov"} na dnes` : `Ahoj, ${user.name}.`}
        </h1>
        <p className="mt-1.5 text-[15px] text-white/50">
          Cieľ: dobrovoľný súhlas, aby sa firme ozval Dominik. Nič nepredávaš.
        </p>
      </FadeIn>

      <FadeIn delay={0.05} className="mt-5 grid grid-cols-4 gap-2 text-center">
        <Count label="Callbacky" n={today.callbacks.length} tone="warn" />
        <Count label="Follow-upy" n={today.retries.length} />
        <Count label="Nové" n={today.fresh.length} tone="info" />
        <Count label="Celkom" n={total} tone="strong" />
      </FadeIn>

      <FadeIn delay={0.08} className="mt-3 flex justify-between rounded-2xl bg-white/[0.03] px-4 py-3 text-[13px] text-white/55 ring-1 ring-inset ring-line">
        <span>Dnes: {stats.calls} hovorov</span>
        <span>{stats.conversations} rozhovorov</span>
        <span className="text-green-300">{stats.consents} súhlasov</span>
      </FadeIn>

      {first ? (
        <FadeIn delay={0.1} className="mt-6">
          <Link
            href={`/leady/leads/${first.id}`}
            className="flex h-16 w-full items-center justify-center gap-2 rounded-[22px] bg-ok text-lg font-semibold text-black shadow-[0_12px_40px_-14px_rgba(34,197,94,0.7)] active:scale-[0.99]"
          >
            Začať: {first.company.name} <ChevronRight className="size-5" />
          </Link>
        </FadeIn>
      ) : (
        <FadeIn delay={0.1} className="mt-10">
          <EmptyState icon="☕" title="Na dnes máš hotovo." body="Nové firmy pribudnú ráno. Callbacky sa objavia v dohodnutý deň." />
        </FadeIn>
      )}

      <Group title="📅 Dohodnuté callbacky" leads={today.callbacks} note={(l) => `Dohodnuté na ${fmtDate(l.next_action_at, false)}`} />
      <Group title="🔁 Ďalší pokus" leads={today.retries} note={(l) => `${(l.call_attempts ?? 0) + 1}. pokus`} />
      <Group title="🆕 Nové firmy" leads={today.fresh} note={() => null} />

      {today.later.length ? (
        <FadeIn delay={0.2} className="mt-10">
          <Eyebrow className="mb-2">Neskôr</Eyebrow>
          <ul className="space-y-1">
            {today.later.map((l) => (
              <li key={l.id} className="flex justify-between px-1 py-2 text-[14px] text-white/45">
                <span className="truncate">{l.company.name}</span>
                <span className="shrink-0 pl-3">{fmtDate(l.next_action_at, false)}</span>
              </li>
            ))}
          </ul>
        </FadeIn>
      ) : null}
    </div>
  );
}

function Count({ label, n, tone }: { label: string; n: number; tone?: "warn" | "info" | "strong" }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] px-1 py-3 ring-1 ring-inset ring-line">
      <div
        className={cn(
          "text-[22px] font-semibold tabular-nums",
          tone === "warn" && n ? "text-yellow-200" : tone === "info" ? "text-blue-200" : tone === "strong" ? "text-white" : "text-white/80",
        )}
      >
        {n}
      </div>
      <div className="text-[11px] text-white/45">{label}</div>
    </div>
  );
}

function Group({
  title,
  leads,
  note,
}: {
  title: string;
  leads: LeadWithCompany[];
  note: (l: LeadWithCompany) => string | null;
}) {
  if (!leads.length) return null;
  return (
    <FadeIn delay={0.14} className="mt-8">
      <Eyebrow className="mb-2">{title}</Eyebrow>
      <ul className="space-y-2">
        {leads.map((l) => {
          const cat = categoryOf(l.company.category);
          const n = note(l);
          return (
            <li key={l.id}>
              <Link
                href={`/leady/leads/${l.id}`}
                className="flex items-center gap-3 rounded-2xl bg-white/[0.03] px-4 py-3.5 ring-1 ring-inset ring-line active:bg-white/[0.06]"
              >
                <span className="text-xl">{cat.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-medium">{l.company.name}</span>
                  <span className="block truncate text-[13px] text-white/45">
                    {l.company.city ?? cat.label}
                    {n ? ` · ${n}` : ""}
                  </span>
                </span>
                <ChevronRight className="size-5 text-white/30" />
              </Link>
            </li>
          );
        })}
      </ul>
    </FadeIn>
  );
}
