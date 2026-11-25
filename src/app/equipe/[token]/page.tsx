import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadCleaningDay } from "@/lib/cleaning-db";
import { addDays, formatDate, formatDayMonth, isIsoDate, todaySP, weekday } from "@/lib/dates";
import { buildTeamView, type TeamView } from "@/lib/domain/cleaning";
import { createAdminClient } from "@/lib/supabase/admin";
import { cx, PRIORITY_STYLE } from "@/lib/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Limpeza do dia",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Página pública da equipe (sem login). Só renderiza o TeamView, que contém
 * apenas propriedade, quarto, prioridade, horário do próximo check-in e checklist.
 */
export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ dia?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  if (!/^[a-f0-9]{16,128}$/.test(token)) notFound();

  const db = createAdminClient();
  const { data: property } = await db
    .from("properties")
    .select("id, name, checkin_time")
    .eq("team_token", token)
    .eq("active", true)
    .maybeSingle();
  if (!property) notFound();

  const day = isIsoDate(sp.dia) ? sp.dia : todaySP();
  const data = await loadCleaningDay(db, day, { propertyId: property.id });
  const view: TeamView = buildTeamView({
    day,
    property,
    units: data.units,
    entries: data.entries,
    cleaningItems: data.cleaningItems,
    checklist: data.checklist,
  });
  const link = (d: string) => `/equipe/${token}?dia=${d}`;

  return (
    <main className="mx-auto max-w-lg p-3 pb-10">
      <header className="mb-3">
        <h1 className="text-xl font-bold">🧹 {view.property}</h1>
        <p className="text-base text-slate-700">
          Limpeza de {weekday(day)} {formatDayMonth(day)}
        </p>
        <nav className="mt-2 flex gap-2 text-sm">
          <a href={link(addDays(day, -1))} className="btn-secondary">← Dia anterior</a>
          <a href={link(todaySP())} className="btn-secondary">Hoje</a>
          <a href={link(addDays(day, 1))} className="btn-secondary">Próximo →</a>
        </nav>
      </header>

      {view.rooms.length === 0 && <p className="card">Nenhuma limpeza prevista para este dia.</p>}

      <ol className="space-y-3">
        {view.rooms.map((room, i) => (
          <li key={i} className={cx("card p-3", room.status === "Concluída" && "opacity-60")}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-bold">{room.room}</span>
              <span className={cx("rounded-full px-2 py-0.5 text-xs font-semibold", PRIORITY_STYLE[room.priority])}>
                {room.priorityLabel}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-slate-600">
              {room.status}
              {room.priority === "pendente" ? ` · saída em ${formatDate(room.checkOut)}` : ""}
            </p>
            {room.nextCheckIn && (
              <p className={cx("mt-1 text-base", room.nextCheckIn.date === day ? "font-bold text-red-700" : "text-slate-800")}>
                Próximo check-in: {room.nextCheckIn.date === day ? "hoje" : formatDate(room.nextCheckIn.date)} às {room.nextCheckIn.time}
              </p>
            )}
            {room.items.length > 0 && (
              <ul className="mt-2 space-y-1">
                {room.items.map((it, k) => (
                  <li key={k} className={cx("flex gap-2 text-base", it.done && "text-slate-400 line-through")}>
                    <span aria-hidden>{it.done ? "☑" : "☐"}</span>
                    {it.label}
                  </li>
                ))}
              </ul>
            )}
            {room.preview && room.items.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                {room.status === "Aguardando check-out"
                  ? "Checklist previsto (o hóspede ainda não saiu)."
                  : "Checklist atual do quarto."}
              </p>
            )}
          </li>
        ))}
      </ol>
    </main>
  );
}
