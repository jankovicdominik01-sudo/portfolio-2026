"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import { STATUS_LABEL, categoryOf, type LeadStatus } from "@/lib/types";
import { Kbd, cn } from "./ui";

type Item = {
  id: string;
  name: string;
  city: string | null;
  phone: string | null;
  email: string | null;
  category: string;
  status: LeadStatus;
};

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Globálne vyhľadávanie (⌘K) — firma, telefón, e-mail, mesto, kategória. Výsledky okamžite. */
export function SearchPalette({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [active, setActive] = useState(0);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);

  const show = useCallback(() => {
    setOpen(true);
    setQ("");
    setActive(0);
    fetch("/leady/api/v1/search", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setItems(d.items))
      .catch(() => setItems([]));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        show();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show]);

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 30);
  }, [open]);

  const results = useMemo(() => {
    if (!items) return [];
    const t = fold(q.trim());
    const digits = q.replace(/\D/g, "");
    if (!t) return items.slice(0, 8);
    return items
      .filter((i) => {
        const hay = fold([i.name, i.city, i.email, categoryOf(i.category).label].filter(Boolean).join(" "));
        const phone = (i.phone ?? "").replace(/\D/g, "");
        return hay.includes(t) || (digits.length >= 3 && phone.includes(digits));
      })
      .slice(0, 12);
  }, [items, q]);

  const go = (id: string) => {
    setOpen(false);
    router.push(`/leady/leads/${id}`);
  };

  return (
    <>
      {compact ? (
        <button
          onClick={show}
          className="grid size-9 place-items-center rounded-xl text-white/50 hover:bg-white/[0.05] hover:text-white"
          aria-label="Hľadať"
        >
          <Search className="size-[18px]" />
        </button>
      ) : (
        <button
          onClick={show}
          className="flex w-full items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2.5 text-sm text-white/35 ring-1 ring-inset ring-line transition hover:bg-white/[0.05] hover:text-white/60"
        >
          <Search className="size-4" />
          Hľadať
          <span className="ml-auto">
            <Kbd>⌘K</Kbd>
          </span>
        </button>
      )}

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-label="Vyhľadávanie"
              className="w-full max-w-xl overflow-hidden rounded-3xl bg-raised/95 shadow-2xl ring-1 ring-line-strong"
              initial={{ y: -12, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: -8, scale: 0.98, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 border-b border-line px-5">
                <Search className="size-4 text-white/40" />
                <input
                  ref={input}
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setActive(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setOpen(false);
                    if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, results.length - 1));
                    if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
                    if (e.key === "Enter" && results[active]) go(results[active].id);
                  }}
                  placeholder="Firma, telefón, e-mail, mesto…"
                  className="h-14 flex-1 bg-transparent text-[16px] outline-none placeholder:text-white/25"
                />
                <Kbd>esc</Kbd>
              </div>
              <ul className="max-h-[50vh] overflow-y-auto p-2">
                {items === null ? (
                  <li className="px-4 py-6 text-center text-sm text-white/35">Načítavam…</li>
                ) : results.length === 0 ? (
                  <li className="px-4 py-6 text-center text-sm text-white/35">
                    {items.length ? "Nič sme nenašli." : "Zatiaľ tu nemáš žiadne firmy."}
                  </li>
                ) : (
                  results.map((r, i) => (
                    <li key={r.id}>
                      <button
                        onMouseEnter={() => setActive(i)}
                        onClick={() => go(r.id)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors",
                          i === active ? "bg-white/[0.06]" : "",
                        )}
                      >
                        <span className="text-lg">{categoryOf(r.category).emoji}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px]">{r.name}</span>
                          <span className="block truncate text-xs text-white/40">
                            {[r.city, r.phone, r.email].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-white/35">{STATUS_LABEL[r.status]}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
