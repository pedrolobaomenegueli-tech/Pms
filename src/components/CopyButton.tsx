"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copiar", className = "btn-secondary shrink-0" }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          window.prompt("Copie a URL:", text);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "Copiado ✓" : label}
    </button>
  );
}
