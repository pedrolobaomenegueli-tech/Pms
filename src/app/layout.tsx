import type { Metadata, Viewport } from "next";
import "./globals.css";
import { isStaging } from "@/lib/app-env";

export const metadata: Metadata = {
  title: "PMS Temporada",
  description: "Gestão de reservas, limpeza e calendários iCal",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full bg-slate-100 text-slate-900">
        {isStaging() && (
          <div className="bg-amber-400 px-3 py-1 text-center text-xs font-bold tracking-wide text-amber-950">
            AMBIENTE DE TESTES · dados fictícios · exportação iCal desligada
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
