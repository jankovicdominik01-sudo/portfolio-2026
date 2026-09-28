"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { resolveFeedbackAction } from "@/app/leady/actions";

export function ResolveFeedbackButton({ leadId, feedbackId }: { leadId: string; feedbackId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(async () => void (await resolveFeedbackAction(leadId, feedbackId)))}
      disabled={pending}
      className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-[12px] ring-1 ring-inset ring-line"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : "Vybavené"}
    </button>
  );
}
