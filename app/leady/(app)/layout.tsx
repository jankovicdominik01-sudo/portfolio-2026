import { requireUser } from "@/lead-engine/lib/auth";
import { db } from "@/lead-engine/lib/db";
import { AdminShell, CallerShell } from "@/lead-engine/components/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.role === "caller") return <CallerShell user={user}>{children}</CallerShell>;
  const unread = (await (await db()).listNotifications()).filter((n) => !n.read).length;
  return (
    <AdminShell user={user} unread={unread}>
      {children}
    </AdminShell>
  );
}
