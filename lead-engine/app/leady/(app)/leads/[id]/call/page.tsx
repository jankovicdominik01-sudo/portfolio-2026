import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getLead } from "@/lib/leads";
import { CallMode } from "@/components/call-mode";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hovor" };

export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const lead = await getLead(user, (await params).id, { ownCall: true });
  if (!lead || !lead.call_brief) {
    if (user.role === "caller") redirect("/leady");
    notFound();
  }
  const b = lead.call_brief;
  return (
    <CallMode
      leadId={lead.id}
      name={lead.company.name}
      city={lead.company.city}
      phone={lead.company.phone}
      opening={b.call_opening}
      remember={b.remember}
      hook={lead.analysis?.primary_hook ?? b.main_idea}
      dominik={b.dominik_intro}
      offer={b.offer}
      question={b.key_question}
      backHref={user.role === "admin" ? `/leady/leads/${lead.id}` : "/leady"}
    />
  );
}
