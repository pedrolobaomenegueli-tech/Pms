"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/ui";

/** Formulário que chama uma server action e mostra erro/sucesso. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: (state: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state?.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className={className}>
      {children}
      {state?.error && (
        <p role="alert" className="mt-2 whitespace-pre-line rounded-lg bg-red-50 p-2 text-sm text-red-700 ring-1 ring-red-200">
          {state.error}
        </p>
      )}
      {state?.ok && <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{state.ok}</p>}
    </form>
  );
}
