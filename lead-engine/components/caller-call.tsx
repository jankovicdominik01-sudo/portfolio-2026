import { notFound, redirect } from "next/navigation";
import { callerLeadView } from "@/lib/leads";
import { categoryOf, WEBSITE_STATUS_LABEL, type SessionUser } from "@/lib/types";
import { ISSUE_LABEL } from "@/lib/score";
import { fmtDate } from "@/lib/format";
import { CallScreen } from "./call-screen";

/** Karta hovoru pre volajúceho — všetka analýza je hotová, volajúci iba číta a volá. */
export async function CallerCall({ user, leadId, backHref }: { user: SessionUser; leadId: string; backHref: string }) {
  const v = await callerLeadView(user, leadId);
  if (!v) {
    if (user.role === "caller") redirect("/leady");
    notFound();
  }
  const { lead, card, opportunityCard, next } = v;
  const c = lead.company;
  const cat = categoryOf(c.category);
  const ws = lead.website_status;
  return (
    <CallScreen
      leadId={lead.id}
      name={c.name}
      city={c.city}
      segment={`${cat.emoji} ${cat.label}`}
      phone={c.phone}
      about={lead.analysis?.company_summary ?? null}
      attempts={lead.call_attempts ?? 0}
      callbackNote={lead.next_action === "callback" ? `Dohodnutý callback na ${fmtDate(lead.next_action_at, false)}` : null}
      card={card}
      opportunityCard={opportunityCard}
      details={lead.score?.factors ?? []}
      risks={lead.score?.risks ?? []}
      websiteLabel={
        ws ? `${WEBSITE_STATUS_LABEL[ws]}${lead.website_issue ? ` — ${ISSUE_LABEL[lead.website_issue] ?? lead.website_issue}` : ""}` : null
      }
      evidence={(lead.analysis?.evidence ?? []).slice(0, 4).map((e) => ({ excerpt: e.excerpt, url: e.url }))}
      price={v.price}
      nextHref={next ? `/leady/leads/${next}` : null}
      backHref={backHref}
    />
  );
}
