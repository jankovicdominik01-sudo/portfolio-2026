import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { categoryOf, type LeadWithCompany, type SessionUser } from "@/lib/types";
import { fmtRelative, isDue } from "@/lib/format";
import { Card, EmptyState, Eyebrow, buttonClass } from "./ui";
import { FadeIn, Stagger, StaggerItem } from "./motion";

/** Kamarát vidí iba to, komu má dnes volať. Nič viac. */
export function CallerToday({ user, leads }: { user: SessionUser; leads: LeadWithCompany[] }) {
  const order = { hot: 0, ready: 1, check: 2, low: 3 } as const;
  const today = leads
    .filter((l) => isDue(l.next_action_at))
    .sort((a, b) => order[a.priority] - order[b.priority] || a.created_at.localeCompare(b.created_at));
  const later = leads.filter((l) => !isDue(l.next_action_at));

  return (
    <div>
      <FadeIn>
        <Eyebrow>Dnes voláš</Eyebrow>
        <h1 className="mt-2 text-[34px] font-semibold tracking-[-0.035em]">
          {today.length ? `${today.length} ${today.length === 1 ? "firma" : today.length < 5 ? "firmy" : "firiem"} na volanie` : `Ahoj, ${user.name}.`}
        </h1>
        <p className="mt-1.5 text-[15px] text-white/45">
          {today.length
            ? "Cieľ nie je predať web. Iba zistiť, či môže Dominik zavolať."
            : "Na dnes nemáš nikoho na volanie. Dominik ti čoskoro pripraví ďalšie firmy."}
        </p>
      </FadeIn>

      {today.length === 0 && later.length === 0 ? (
        <FadeIn delay={0.1} className="mt-10">
          <EmptyState icon="☕" title="Zatiaľ tu nemáš žiadne firmy." body="Keď Dominik pripraví nové leady, objavia sa tu." />
        </FadeIn>
      ) : null}

      <Stagger className="mt-8 space-y-3">
        {today.map((l) => (
          <StaggerItem key={l.id}>
            <CallerCard lead={l} />
          </StaggerItem>
        ))}
      </Stagger>

      {later.length ? (
        <FadeIn delay={0.2} className="mt-10">
          <Eyebrow className="mb-3">Neskôr</Eyebrow>
          <ul className="space-y-1">
            {later.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/leads/${l.id}`}
                  className="flex items-center justify-between rounded-2xl px-4 py-3 text-[15px] text-white/60 hover:bg-white/[0.03]"
                >
                  <span>
                    {categoryOf(l.company.category).emoji} {l.company.name}
                  </span>
                  <span className="text-sm text-white/35">{fmtRelative(l.next_action_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </FadeIn>
      ) : null}
    </div>
  );
}

function CallerCard({ lead }: { lead: LeadWithCompany }) {
  const c = lead.company;
  const cat = categoryOf(c.category);
  const b = lead.call_brief;
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[20px] font-semibold tracking-[-0.02em]">{c.name}</div>
          <div className="mt-1 text-[14px] text-white/45">
            {c.city ? `${c.city} · ` : ""}
            {cat.emoji} {cat.label}
          </div>
        </div>
        {lead.call_attempts > 0 ? (
          <span className="shrink-0 rounded-full bg-white/[0.05] px-2.5 py-1 text-xs text-white/45">
            {lead.call_attempts}. pokus
          </span>
        ) : null}
      </div>
      {b ? (
        <div className="mt-5 space-y-4">
          <div>
            <div className="text-[12px] font-medium text-white/35">Prečo voláme</div>
            <p className="mt-1 text-[15px] leading-relaxed text-white/85">{b.main_idea}</p>
          </div>
          <div>
            <div className="text-[12px] font-medium text-white/35">Čo povedať</div>
            <p className="mt-1 text-[15px] leading-relaxed text-white/60 italic">„{b.call_opening}“</p>
          </div>
        </div>
      ) : null}
      <Link href={`/leads/${lead.id}`} className={buttonClass("primary", "lg", "mt-6 w-full")}>
        Otvoriť call brief <ArrowRight className="size-4" />
      </Link>
    </Card>
  );
}
