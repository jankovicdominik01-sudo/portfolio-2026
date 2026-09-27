import { requireUser } from "@/lib/auth";
import { CallerCall } from "@/components/caller-call";

export const dynamic = "force-dynamic";
export const metadata = { title: "Hovor" };

/** Karta hovoru (volajúci ju má priamo na detaile, Dominik tu vidí náhľad toho, čo vidí volajúci). */
export default async function CallPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = (await params).id;
  return <CallerCall user={user} leadId={id} backHref={user.role === "admin" ? `/leady/leads/${id}` : "/leady"} />;
}
