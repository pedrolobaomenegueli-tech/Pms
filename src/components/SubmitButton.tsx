"use client";

import { useFormStatus } from "react-dom";
import { cx } from "@/lib/ui";

export function SubmitButton({
  children,
  className = "btn-primary",
  pendingText = "Salvando…",
  confirm,
  name,
  value,
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
  confirm?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={cx(className)}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? pendingText : children}
    </button>
  );
}
