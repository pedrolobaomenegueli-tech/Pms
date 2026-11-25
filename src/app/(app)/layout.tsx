import Link from "next/link";
import { Nav } from "@/components/Nav";
import { isStaging } from "@/lib/app-env";
import { logout } from "../login/actions";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-20 sm:pb-6">
      <header className={`sticky top-0 z-20 text-white ${isStaging() ? "bg-amber-800" : "bg-slate-900"}`}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5">
          <Link href="/" className="font-semibold">PMS Temporada{isStaging() ? " · TESTES" : ""}</Link>
          <Nav />
          <form action={logout}>
            <button className="text-sm text-slate-300 hover:text-white">Sair</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4">{children}</main>
    </div>
  );
}
