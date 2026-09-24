import Link from "next/link";
import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/leady/actions";
import type { SessionUser } from "@/lead-engine/lib/types";
import { NavLinks, MobileTabs } from "./nav";
import { SearchPalette } from "./search";

function Logo() {
  return (
    <Link href="/leady" className="flex items-center gap-2.5" aria-label="Lead Engine — domov">
      <span className="grid size-8 place-items-center rounded-[10px] bg-white/[0.05] text-[13px] font-semibold ring-1 ring-line">
        DJ<span className="text-brand">.</span>
      </span>
      <span className="text-[15px] font-semibold tracking-tight">
        Lead Engine
      </span>
    </Link>
  );
}

function Logout({ compact }: { compact?: boolean }) {
  return (
    <form action={logoutAction}>
      <button
        className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/40 transition hover:bg-white/[0.04] hover:text-white"
        aria-label="Odhlásiť"
      >
        <LogOut className="size-4" />
        {compact ? null : "Odhlásiť"}
      </button>
    </form>
  );
}

export function AdminShell({ user, unread, children }: { user: SessionUser; unread: number; children: React.ReactNode }) {
  return (
    <div className="glow min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col border-r border-line bg-bg/80 px-4 py-5 backdrop-blur-xl lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <div className="mt-6">
          <SearchPalette />
        </div>
        <nav className="mt-4 flex-1">
          <NavLinks unread={unread} />
        </nav>
        <div className="flex items-center justify-between border-t border-line pt-4">
          <div className="px-2 text-sm">
            <div className="font-medium">{user.name}</div>
            <div className="text-xs text-white/35">Admin</div>
          </div>
          <Logout compact />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-bg/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <SearchPalette compact />
          <Logout compact />
        </div>
      </header>

      <main className="px-4 pt-6 pb-28 sm:px-6 lg:ml-[248px] lg:px-10 lg:pt-10 lg:pb-16">
        <div className="mx-auto max-w-[1080px]">{children}</div>
      </main>

      <MobileTabs unread={unread} />
    </div>
  );
}

/** Kamarát nevidí Dominikov obchodný svet — iba svoje hovory. */
export function CallerShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return (
    <div className="glow min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[640px] items-center justify-between px-4 py-3">
          <Logo />
          <div className="flex items-center gap-2">
            <span className="text-sm text-white/45">{user.name}</span>
            <Logout compact />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[640px] px-4 pt-6 pb-24">{children}</main>
    </div>
  );
}
