"use client";

import { useTransition } from "react";
import { markReadAction } from "@/app/leady/actions";
import { Button } from "./ui";

export function MarkAllRead() {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(() => markReadAction("all").then(() => {}))}>
      Označiť ako prečítané
    </Button>
  );
}
