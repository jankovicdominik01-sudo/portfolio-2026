"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Bell, Columns3, Home, List, Plus, Settings } from "lucide-react";
import { cn } from "./ui";

const ITEMS = [
  { href: "/leady", label: "Dnes", icon: Home },
  { href: "/leady/leads", label: "Leady", icon: List },
  { href: "/leady/pipeline", label: "Pipeline", icon: Columns3 },
  { href: "/leady/inbox", label: "Inbox", icon: Bell, badge: true },
  { href: "/leady/add", label: "Pridať firmu", icon: Plus },
  { href: "/leady/settings", label: "Nastavenia", icon: Settings },
];

const isActive = (path: string, href: string) => (href === "/leady" ? path === "/leady" : path.startsWith(href));

export function NavLinks({ unread }: { unread: number }) {
  const path = usePathname();
  return (
    <ul className="space-y-0.5">
      {ITEMS.map(({ href, label, icon: Icon, badge }) => {
        const active = isActive(path, href);
        return (
          <li key={href}>
            <Link
              href={href}
              className={cn(
                "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] transition-colors",
                active ? "text-white" : "text-white/45 hover:text-white/80",
              )}
            >
              {active ? (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-xl bg-white/[0.06] ring-1 ring-inset ring-line"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              ) : null}
              <Icon className="relative size-[17px]" strokeWidth={1.8} />
              <span className="relative">{label}</span>
              {badge && unread > 0 ? (
                <span className="relative ml-auto grid min-w-5 place-items-center rounded-full bg-ok px-1.5 text-[11px] font-semibold text-black">
                  {unread}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function MobileTabs({ unread }: { unread: number }) {
  const path = usePathname();
  const items = ITEMS.filter((i) => i.href !== "/leady/settings");
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      aria-label="Hlavná navigácia"
    >
      <ul className="mx-auto flex max-w-md justify-around px-2 py-1.5">
        {items.map(({ href, label, icon: Icon, badge }) => {
          const active = isActive(path, href);
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10px]",
                  active ? "text-white" : "text-white/40",
                )}
              >
                <Icon className="size-5" strokeWidth={1.8} />
                {label.split(" ")[0]}
                {badge && unread > 0 ? (
                  <span className="absolute top-0.5 right-2 size-2 rounded-full bg-ok ring-2 ring-bg" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
