import Link from "next/link";
import { ArrowRight, Phone, Plus } from "lucide-react";
import { requireUser, adminName, setupStatus } from "@/lib/auth";
import { listLeads } from "@/lib/leads";
import { db } from "@/lib/db";
import { fmtDateTime, greeting, isDue } from "@/lib/format";
import { categoryOf, type LeadWithCompany } from "@/lib/types";
import { ButtonLink, Card, EmptyState, Eyebrow, PriorityTag } from "@/components/ui";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { LeadRow } from "@/components/lead-row";
import { CallerToday } from "@/components/caller-today";

export const dynamic = "force-dynamic";

const PRIORITY_ORDER = { hot: 0, ready: 1, check: 2, low: 3 } as const;
const byPriority = (a: LeadWithCompany, b: LeadWithCompany) =>
  PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
  (a.next_action_at ?? "").localeCompare(b.next_action_at ?? "");

export default async function TodayPage() {
  const user = await requireUser();
  const leads = await listLeads(user);
  if (user.role === "caller") return <CallerToday user={user} leads={leads} />;

  const notifications = await (await db()).listNotifications();
  const qualified = leads.filter((l) => l.status === "dominik_call" && l.next_action === "dominik_call").sort(byPriority);
  const toProcess = leads.filter(
    (l) =>
      l.status === "new" ||
      l.status === "analyzed" ||
      (l.status === "called" && l.next_action === "review") ||
      l.next_action === "verify_phone",
  );
  const waiting = leads.filter((l) => l.status === "called" && l.next_action === "caller_call");
  const deals = leads
    .filter(
      (l) =>
        (l.status === "dominik_call" && l.next_action !== "dominik_call") ||
        l.status === "offer_sent" ||
        l.status === "negotiation",
    )
    .sort((a, b) => (a.next_action_at ?? "").localeCompare(b.next_action_at ?? ""));
  const atCaller = leads.filter((l) => l.status === "ready_to_call");
  const today = new Date().toISOString().slice(0, 10);
  const newToday = leads.filter((l) => l.created_at.slice(0, 10) === today).length;
  const unread = notifications.filter((n) => !n.read && n.kind === "qualified");

  const hero = qualified[0] ?? deals.find((d) => isDue(d.next_action_at)) ?? null;

  return (
    <div>
      <FadeIn>
        <h1 className="text-[32px] font-semibold tracking-[-0.035em] sm:text-[40px]">
          {greeting()}, {adminName().split(" ")[0]}.
        </h1>
        <p className="mt-2 text-[15px] text-white/45">
          {newToday > 0
            ? `Dnes pribudlo ${newToday} ${newToday === 1 ? "nový lead" : newToday < 5 ? "nové leady" : "nových leadov"}.`
            : leads.length
              ? "Tu je, čo treba dnes urobiť."
              : "Začni tým, že pridáš prvú firmu."}
        </p>
      </FadeIn>

      {!setupStatus().persistent ? (
        <FadeIn delay={0.04} className="mt-6">
          <div className="rounded-2xl bg-warn/[0.07] px-4 py-3 text-[13px] text-yellow-100/80 ring-1 ring-warn/20">
            Testovací režim — dáta sa môžu pri reštarte servera stratiť. Pre trvalé ukladanie pripoj vo Verceli
            Storage → Blob (Private) a daj Redeploy.
          </div>
        </FadeIn>
      ) : null}

      {leads.length === 0 ? (
        <FadeIn delay={0.1} className="mt-10">
          <EmptyState
            icon="🌱"
            title="Zatiaľ tu nemáš žiadne nové leady."
            body="Pridaj firmu ručne alebo nahraj CSV. Systém ju overí, nájde hook a pripraví call brief pre kamaráta."
            action={
              <ButtonLink href="/leady/add" variant="primary">
                <Plus className="size-4" /> Pridať firmu
              </ButtonLink>
            }
          />
        </FadeIn>
      ) : null}

      {hero ? (
        <FadeIn delay={0.06} className="mt-8">
          <NextActionHero lead={hero} fresh={unread.some((n) => n.lead_id === hero.id)} />
        </FadeIn>
      ) : null}

      {leads.length > 0 ? (
        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          <Group
            icon="🔥"
            title="Kvalifikované"
            summary={
              qualified.length
                ? `${qualified.length} ${plural(qualified.length, "firma čaká", "firmy čakajú", "firiem čaká")} na tvoj hovor`
                : "Žiadna firma nečaká na tvoj hovor"
            }
            leads={qualified}
            delay={0.1}
          />
          <Group
            icon="☎️"
            title="Na spracovanie"
            summary={
              toProcess.length
                ? `${toProcess.length} ${plural(toProcess.length, "lead treba", "leady treba", "leadov treba")} skontrolovať`
                : "Všetko je spracované"
            }
            leads={toProcess}
            delay={0.14}
          />
          <Group
            icon="⏳"
            title="Čaká sa"
            summary={
              `${atCaller.length} u kamaráta na volanie` +
              (waiting.length ? ` · ${waiting.length} ${plural(waiting.length, "sa má ozvať", "sa majú ozvať", "sa má ozvať")} neskôr` : "")
            }
            leads={[...waiting].sort(byPriority)}
            delay={0.18}
          />
          <Group
            icon="✅"
            title="Rozpracované"
            summary={
              deals.length
                ? `${deals.length} ${plural(deals.length, "obchodný prípad", "obchodné prípady", "obchodných prípadov")}`
                : "Zatiaľ žiadne rozpracované obchody"
            }
            leads={deals}
            delay={0.22}
          />
        </div>
      ) : null}
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string) {
  return n === 1 ? one : n >= 2 && n <= 4 ? few : many;
}

function Group({
  icon,
  title,
  summary,
  leads,
  delay,
}: {
  icon: string;
  title: string;
  summary: string;
  leads: LeadWithCompany[];
  delay: number;
}) {
  return (
    <FadeIn delay={delay}>
      <Card className="p-2">
        <div className="px-4 pt-4 pb-2">
          <Eyebrow>
            <span className="mr-1.5">{icon}</span>
            {title}
          </Eyebrow>
          <div className="mt-1.5 text-[15px] text-white/80">{summary}</div>
        </div>
        {leads.length ? (
          <Stagger className="pb-1">
            {leads.slice(0, 5).map((l) => (
              <StaggerItem key={l.id}>
                <LeadRow lead={l} />
              </StaggerItem>
            ))}
          </Stagger>
        ) : (
          <div className="px-4 pb-4 text-sm text-white/30">—</div>
        )}
        {leads.length > 5 ? (
          <Link href="/leady/leads" className="block px-4 pb-3 text-sm text-white/40 hover:text-white">
            + ďalších {leads.length - 5}
          </Link>
        ) : null}
      </Card>
    </FadeIn>
  );
}

/** Najdôležitejšia vec dňa — veľká, jasná, s jedným CTA. */
function NextActionHero({ lead, fresh }: { lead: LeadWithCompany; fresh: boolean }) {
  const q = lead.qualification;
  const cat = categoryOf(lead.company.category);
  const isCall = lead.next_action === "dominik_call";
  return (
    <Card className="relative overflow-hidden p-6 sm:p-8">
      <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-ok/10 blur-3xl" />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold tracking-[0.16em] text-green-300 uppercase">
              {isCall ? "🟢 Kvalifikovaný lead" : "🗓️ Ďalší krok"}
            </span>
            {fresh ? (
              <span className="rounded-full bg-ok/15 px-2 py-0.5 text-[10px] font-semibold text-green-300">NOVÉ</span>
            ) : null}
            {lead.priority === "hot" ? <PriorityTag priority="hot" /> : null}
          </div>
          <div className="mt-3 text-[26px] font-semibold tracking-[-0.03em] sm:text-[30px]">{lead.company.name}</div>
          <div className="mt-1 text-[15px] text-white/45">
            {cat.emoji} {cat.label}
            {lead.company.city ? ` · ${lead.company.city}` : ""}
          </div>
          {q ? (
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/70">
              {q.caller} volal {fmtDateTime(q.called_at)}
              {q.company_said ? (
                <>
                  {" "}
                  — <span className="text-white">„{q.company_said}“</span>
                </>
              ) : (
                " — firma súhlasila, aby si zavolal."
              )}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          {isCall && lead.company.phone ? (
            <ButtonLink href={`/leady/leads/${lead.id}`} variant="ok" size="lg">
              <Phone className="size-4" /> Pripraviť hovor
            </ButtonLink>
          ) : (
            <ButtonLink href={`/leady/leads/${lead.id}`} variant="primary" size="lg">
              Otvoriť <ArrowRight className="size-4" />
            </ButtonLink>
          )}
        </div>
      </div>
    </Card>
  );
}
