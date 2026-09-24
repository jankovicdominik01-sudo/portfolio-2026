import Link from "next/link";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  STATUS_LABEL,
  categoryOf,
  type LeadStatus,
  type Priority,
  type Trust,
  type TrustLevel,
} from "@/lib/types";

export const cn = (...a: Parameters<typeof clsx>) => twMerge(clsx(...a));

/* ─────────────── Button ─────────────── */

const BTN = {
  base: "inline-flex items-center justify-center gap-2 font-medium tracking-tight transition-all duration-300 ease-[var(--ease-out-expo)] disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] select-none",
  primary: "bg-white text-black hover:bg-white/90 shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_8px_30px_-12px_rgba(255,255,255,0.4)]",
  brand: "bg-brand text-black hover:brightness-110 shadow-[0_10px_40px_-12px_rgba(249,115,22,0.7)]",
  ok: "bg-ok text-black hover:brightness-110 shadow-[0_10px_40px_-12px_rgba(34,197,94,0.6)]",
  secondary: "bg-white/[0.06] text-white hover:bg-white/[0.1] ring-1 ring-inset ring-line",
  ghost: "text-white/60 hover:text-white hover:bg-white/[0.05]",
  danger: "bg-bad/10 text-red-300 ring-1 ring-inset ring-bad/20 hover:bg-bad/20",
  sm: "h-9 rounded-xl px-3.5 text-sm",
  md: "h-11 rounded-2xl px-5 text-[15px]",
  lg: "h-14 rounded-2xl px-7 text-base",
  xl: "h-16 rounded-[22px] px-8 text-lg font-semibold",
};
export type ButtonVariant = "primary" | "brand" | "ok" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", className?: string) {
  return cn(BTN.base, BTN[variant], BTN[size], className);
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  className,
  children,
  ...rest
}: { href: string; variant?: ButtonVariant; size?: ButtonSize; className?: string; children: React.ReactNode } & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
>) {
  const external = href.startsWith("tel:") || href.startsWith("mailto:") || href.startsWith("http");
  if (external)
    return (
      <a href={href} className={buttonClass(variant, size, className)} {...rest}>
        {children}
      </a>
    );
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

/* ─────────────── Surfaces ─────────────── */

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-card)] bg-white/[0.025] ring-1 ring-inset ring-line backdrop-blur-sm",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40", className)}>{children}</div>
  );
}

export function Section({
  icon,
  title,
  children,
  className,
  aside,
}: {
  icon?: string;
  title: string;
  children: React.ReactNode;
  className?: string;
  aside?: React.ReactNode;
}) {
  return (
    <Card className={cn("p-5 sm:p-6", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <Eyebrow>
          {icon ? <span className="mr-1.5 not-italic">{icon}</span> : null}
          {title}
        </Eyebrow>
        {aside}
      </div>
      {children}
    </Card>
  );
}

/* ─────────────── Status, priority, trust ─────────────── */

const STATUS_TONE: Record<LeadStatus, string> = {
  new: "bg-white/[0.06] text-white/70",
  analyzed: "bg-warn/10 text-yellow-200",
  ready_to_call: "bg-info/10 text-blue-200",
  called: "bg-white/[0.06] text-white/70",
  dominik_call: "bg-ok/12 text-green-300",
  offer_sent: "bg-brand-soft text-orange-200",
  negotiation: "bg-brand-soft text-orange-200",
  won: "bg-ok/15 text-green-200",
  lost: "bg-white/[0.04] text-white/40",
  archived: "bg-white/[0.04] text-white/40",
};
const STATUS_DOT: Record<LeadStatus, string> = {
  new: "bg-white/50",
  analyzed: "bg-warn",
  ready_to_call: "bg-info",
  called: "bg-white/50",
  dominik_call: "bg-ok",
  offer_sent: "bg-brand",
  negotiation: "bg-brand",
  won: "bg-ok",
  lost: "bg-white/30",
  archived: "bg-white/30",
};

export function StatusPill({ status, className }: { status: LeadStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        STATUS_TONE[status],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} />
      {STATUS_LABEL[status]}
    </span>
  );
}

const PRIORITY: Record<Priority, { label: string; icon: string; cls: string }> = {
  hot: { label: "HOT", icon: "🔥", cls: "text-orange-300 bg-brand-soft" },
  ready: { label: "READY", icon: "🟢", cls: "text-green-300 bg-ok/10" },
  check: { label: "CHECK", icon: "🟡", cls: "text-yellow-200 bg-warn/10" },
  low: { label: "LOW", icon: "⚪", cls: "text-white/50 bg-white/[0.05]" },
};

export function PriorityTag({ priority, className }: { priority: Priority; className?: string }) {
  const p = PRIORITY[priority];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[0.12em]",
        p.cls,
        className,
      )}
    >
      <span className="text-[10px]">{p.icon}</span>
      {p.label}
    </span>
  );
}

const TRUST_DOT: Record<TrustLevel, { dot: string; label: string }> = {
  verified: { dot: "🟢", label: "Overené" },
  partial: { dot: "🟡", label: "Čiastočne overené" },
  unverified: { dot: "🔴", label: "Nedostatočne overené" },
};

export function TrustRow({ trust, className }: { trust: Trust; className?: string }) {
  const items: [string, TrustLevel][] = [
    ["Web", trust.web],
    ["Telefón", trust.phone],
    ["Firma", trust.company],
    ["Hook", trust.hook],
  ];
  return (
    <div className={cn("flex flex-wrap gap-x-4 gap-y-1.5", className)}>
      {items.map(([k, v]) => (
        <span key={k} className="inline-flex items-center gap-1.5 text-xs text-white/60" title={TRUST_DOT[v].label}>
          <span className="text-[9px]">{TRUST_DOT[v].dot}</span>
          <span className="uppercase tracking-wider">{k}</span>
        </span>
      ))}
    </div>
  );
}

export function CategoryLabel({ category, className }: { category: string; className?: string }) {
  const c = categoryOf(category);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm text-white/55", className)}>
      <span aria-hidden>{c.emoji}</span>
      {c.label}
    </span>
  );
}

/* ─────────────── States ─────────────── */

export function EmptyState({
  title,
  body,
  action,
  icon = "✦",
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
  icon?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-line px-6 py-14 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-white/[0.04] text-xl ring-1 ring-line">{icon}</div>
      <div className="text-[17px] font-medium tracking-tight">{title}</div>
      {body ? <p className="mt-1.5 max-w-sm text-sm text-white/45">{body}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

/* ─────────────── Forms ─────────────── */

export const inputClass =
  "w-full rounded-2xl bg-white/[0.04] px-4 py-3 text-[15px] text-white ring-1 ring-inset ring-line placeholder:text-white/25 transition focus:bg-white/[0.06] focus:outline-none focus:ring-white/25";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-white/60">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-white/35">{hint}</span> : null}
    </label>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[11px] text-white/50 ring-1 ring-inset ring-line">
      {children}
    </kbd>
  );
}
