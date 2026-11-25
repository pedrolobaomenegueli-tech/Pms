import Link from "next/link";
import { Alerts } from "@/components/Alerts";
import { StageButtons } from "@/components/StageButtons";
import { addDays, formatDayMonth, formatShort, todaySP, weekday } from "@/lib/dates";
import { findConflicts, roomStatus, ROOM_STATE_LABEL, type RoomState } from "@/lib/domain/rules";
import { loadActiveStays, loadProperties, unitLabel } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";
import type { MaintenanceIssue, Reservation } from "@/lib/types";
import { checkinRisks } from "@/lib/domain/maintenance";
import { cx, STAGE_SOFT, stayLabel } from "@/lib/ui";

export const dynamic = "force-dynamic";

const STATE_STYLE: Record<RoomState, string> = {
  hospedado: STAGE_SOFT.hospedado,
  em_limpeza: STAGE_SOFT.em_limpeza,
  aguardando_checkin: STAGE_SOFT.aguardando_checkin,
  bloqueado: "bloqueio-card text-slate-600 ring-slate-300",
  livre: "bg-white text-slate-700 ring-slate-200",
};

function Guest({ r, prefix }: { r?: Reservation; prefix: string }) {
  if (!r) return null;
  return (
    <Link href={`/reservas/${r.id}`} className="block truncate text-xs hover:underline">
      {prefix}: {stayLabel(r)} · {formatShort(r.check_in)}→{formatShort(r.check_out)}
    </Link>
  );
}

export default async function HomePage() {
  const { supabase } = await requireUser();
  const today = todaySP();
  const [{ properties, units }, stays, { data: issueRows }] = await Promise.all([
    loadProperties(supabase, { onlyActive: true }),
    loadActiveStays(supabase, addDays(today, -8), addDays(today, 366)),
    supabase.from("maintenance_issues").select("*").neq("status", "resolvido"),
  ]);
  const activeUnitIds = new Set(units.map((u) => u.id));
  const conflicts = findConflicts(stays.filter((r) => r.check_out >= today && activeUnitIds.has(r.unit_id)));
  const label = (id: string) => unitLabel(units, properties, id);
  const openIssues = ((issueRows ?? []) as MaintenanceIssue[]).filter((i) => activeUnitIds.has(i.unit_id));
  const urgentIssues = openIssues.filter((i) => i.priority === "urgente");
  const risks = checkinRisks(openIssues, stays.filter((r) => activeUnitIds.has(r.unit_id)), today);

  const statuses = new Map(units.map((u) => [u.id, roomStatus(stays.filter((r) => r.unit_id === u.id), today)]));
  const counts = new Map<RoomState, number>();
  for (const s of statuses.values()) counts.set(s.state, (counts.get(s.state) ?? 0) + 1);

  return (
    <div>
      <Alerts
        conflicts={conflicts}
        label={label}
        urgentIssues={urgentIssues}
        checkinRisks={risks}
      />

      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-semibold">
          Hoje, {weekday(today)} {formatDayMonth(today)}
        </h1>
        <div className="flex flex-wrap gap-1.5 text-xs">
          {(Object.keys(ROOM_STATE_LABEL) as RoomState[])
            .filter((s) => counts.get(s))
            .map((s) => (
              <span key={s} className={cx("rounded-full px-2 py-0.5 ring-1", STATE_STYLE[s])}>
                {ROOM_STATE_LABEL[s]}: {counts.get(s)}
              </span>
            ))}
        </div>
      </div>

      {units.length === 0 && (
        <div className="card text-sm">
          Nenhum quarto cadastrado ainda. <Link href="/unidades" className="underline">Cadastre propriedades e quartos</Link>.
        </div>
      )}

      <div className="space-y-5">
        {properties.map((p) => {
          const pu = units.filter((u) => u.property_id === p.id);
          if (!pu.length) return null;
          return (
            <section key={p.id}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{p.name}</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {pu.map((u) => {
                  const s = statuses.get(u.id)!;
                  return (
                    <div key={u.id} className={cx("rounded-xl p-3 ring-1", STATE_STYLE[s.state])}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: u.color }} />
                          <span className="truncate font-semibold">{u.name}</span>
                        </div>
                        <span className="shrink-0 text-xs font-semibold uppercase">{ROOM_STATE_LABEL[s.state]}</span>
                      </div>
                      {s.notes.map((n) => (
                        <p key={n} className="mt-1 text-xs font-bold text-orange-700">{n}</p>
                      ))}
                      {s.urgent && s.arrival && (
                        <p className="mt-1 text-xs font-bold text-red-700">
                          ⚡ Chega hoje: {stayLabel(s.arrival)}. Liberar o quarto antes da chegada.
                        </p>
                      )}
                      <div className="mt-1.5 space-y-0.5">
                        {s.stay && <Guest r={s.stay} prefix={s.state === "em_limpeza" ? "Saiu" : "Hóspede"} />}
                        {s.state === "bloqueado" && s.block && (
                          <p className="text-xs">Bloqueado até {formatShort(s.block.check_out)}</p>
                        )}
                        {s.state !== "hospedado" && s.state !== "aguardando_checkin" && !s.arrival && s.next && (
                          <Guest r={s.next} prefix="Próxima" />
                        )}
                      </div>
                      {s.stay && (
                        <div className="mt-2">
                          <StageButtons r={s.stay} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
