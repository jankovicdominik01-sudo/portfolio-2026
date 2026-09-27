"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { reassignInactiveAction } from "@/app/leady/actions";
import { Button } from "./ui";

/** Nevolané leady neaktívnych volajúcich → aktívny volajúci. História ostáva. */
export function ReassignButton() {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await reassignInactiveAction();
            setMsg(r.message);
            router.refresh();
          })
        }
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : null} Presunúť nevolané leady na aktívneho volajúceho
      </Button>
      {msg ? <span className="text-[13px] text-white/60">{msg}</span> : null}
    </div>
  );
}
