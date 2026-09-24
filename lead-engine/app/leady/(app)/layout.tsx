import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { AdminShell, CallerShell } from "@/components/shell";

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
