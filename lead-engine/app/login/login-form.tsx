"use client";

import { useActionState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { loginAction } from "@/app/actions";
import { Button, inputClass } from "@/components/ui";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, null);
  return (
    <form action={action} className="space-y-3">
      <input
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        placeholder="Meno"
        required
        className={inputClass}
        aria-label="Meno"
      />
      <input
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="Heslo"
        required
        className={inputClass}
        aria-label="Heslo"
      />
      {state && !state.ok ? (
        <p role="alert" className="px-1 text-sm text-red-300">
          {state.message}
        </p>
      ) : null}
      <Button variant="primary" size="lg" className="mt-2 w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Prihlásiť sa
        {!pending ? <ArrowRight className="size-4" /> : null}
      </Button>
    </form>
  );
}
