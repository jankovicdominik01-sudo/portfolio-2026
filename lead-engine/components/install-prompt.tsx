"use client";

import { useEffect, useState } from "react";
import { Share, SquarePlus, X } from "lucide-react";
import { Button } from "./ui";

/**
 * Po otvorení ponúkne pridanie Lead Engine na plochu ako aplikáciu.
 *  - Android / Chrome: systémová inštalácia (beforeinstallprompt)
 *  - iPhone / Safari: krátky návod (Zdieľať → Pridať na plochu), iOS iné nedovolí
 * Nezobrazí sa, keď už beží ako aplikácia, ani 14 dní po „Teraz nie“.
 */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const KEY = "le_install_dismissed_at";
const SNOOZE_MS = 14 * 86_400_000;

function snoozed(): boolean {
  try {
    const at = Number(localStorage.getItem(KEY) ?? 0);
    return Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const [mode, setMode] = useState<"android" | "ios" | null>(null);
  const [evt, setEvt] = useState<InstallEvent | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone || snoozed()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
      setMode("android");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const t = ios ? window.setTimeout(() => setMode("ios"), 1200) : undefined;
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (t) window.clearTimeout(t);
    };
  }, []);

  const close = () => {
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {
      /* súkromné okno: iba zavrieť */
    }
    setMode(null);
  };

  const install = async () => {
    if (!evt) return;
    await evt.prompt();
    await evt.userChoice.catch(() => null);
    setEvt(null);
    setMode(null);
  };

  if (!mode) return null;
  return (
    <div role="dialog" aria-label="Pridať na plochu" className="fixed inset-x-0 bottom-0 z-50 px-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-[560px] rounded-[26px] bg-[#111] p-5 shadow-2xl ring-1 ring-line">
        <div className="flex items-start gap-4">
          <img src="/leady-192.png" alt="" className="size-12 shrink-0 rounded-[14px]" />
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-semibold">Pridať Lead Engine na plochu</div>
            {mode === "android" ? (
              <p className="mt-1 text-[14px] text-white/60">Otvoríš ho jedným ťuknutím ako aplikáciu, bez hľadania v prehliadači.</p>
            ) : (
              <p className="mt-1 text-[14px] leading-relaxed text-white/60">
                Ťukni dole na <Share className="inline size-4 -translate-y-0.5 text-white" /> <b className="text-white">Zdieľať</b> a potom na{" "}
                <SquarePlus className="inline size-4 -translate-y-0.5 text-white" /> <b className="text-white">Pridať na plochu</b>.
              </p>
            )}
          </div>
          <button onClick={close} aria-label="Zavrieť" className="grid size-8 shrink-0 place-items-center rounded-full text-white/45 hover:text-white">
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          {mode === "android" ? (
            <Button variant="primary" className="flex-1" onClick={install}>
              Pridať na plochu
            </Button>
          ) : null}
          <Button variant="ghost" className={mode === "android" ? "" : "flex-1"} onClick={close}>
            Teraz nie
          </Button>
        </div>
      </div>
    </div>
  );
}
