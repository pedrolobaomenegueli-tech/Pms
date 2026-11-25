"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/ui";

const ITEMS = [
  { href: "/", label: "Início", icon: "🏠" },
  { href: "/calendario", label: "Calendário", icon: "📅" },
  { href: "/reservas", label: "Reservas", icon: "📋" },
  { href: "/limpeza", label: "Limpeza", icon: "🧹" },
  { href: "/unidades", label: "Quartos", icon: "🔑" },
];

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

export function Nav() {
  const path = usePathname();
  return (
    <>
      {/* Topo (telas maiores) */}
      <nav className="hidden gap-1 sm:flex">
        {ITEMS.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={cx(
              "rounded-lg px-3 py-1.5 text-sm",
              isActive(path, i.href) ? "bg-white/15 text-white" : "text-slate-300 hover:text-white",
            )}
          >
            {i.label}
          </Link>
        ))}
      </nav>
      {/* Barra inferior (celular) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden">
        {ITEMS.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className={cx(
              "flex flex-col items-center gap-0.5 py-2 text-[11px]",
              isActive(path, i.href) ? "font-semibold text-slate-900" : "text-slate-500",
            )}
          >
            <span className="text-lg leading-none" aria-hidden>
              {i.icon}
            </span>
            {i.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
