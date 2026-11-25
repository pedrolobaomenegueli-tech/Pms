import Link from "next/link";
import { addDays, diffDays, isIsoDate, todaySP, weekday } from "@/lib/dates";
import { findConflicts, stageOf, STAGE_LABEL, visibleStays, type Stage } from "@/lib/domain/rules";
import type { Source } from "@/lib/types";
import { loadActiveStays, loadProperties } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";
import { SOURCE_LABEL, type Reservation } from "@/lib/types";
import { cx, SOURCE_BORDER, STAGE_FILL } from "@/lib/ui";

export const dynamic = "force-dynamic";

const DAYS = 30;
const W = 44; // largura de um dia (px)
const LANE = 30; // altura de uma faixa (px)


/** Distribui barras em faixas para não se sobreporem visualmente. */
function lanes(stays: Reservation[]): { r: Reservation; lane: number }[] {
  const ends: string[] = [];
  return [...stays]
    .sort((a, b) => a.check_in.localeCompare(b.check_in))
    .map((r) => {
      let lane = ends.findIndex((e) => e <= r.check_in);
      if (lane < 0) lane = ends.length;
      ends[lane] = r.check_out;
      return { r, lane };
    });
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ inicio?: string }> }) {
  const { supabase } = await requireUser();
  const sp = await searchParams;
  const today = todaySP();
  const from = isIsoDate(sp.inicio) ? sp.inicio : addDays(today, -1);
  const to = addDays(from, DAYS);
  const days = Array.from({ length: DAYS }, (_, i) => addDays(from, i));

  const [{ properties, units }, stays] = await Promise.all([
    loadProperties(supabase, { onlyActive: true }),
    loadActiveStays(supabase, from, to),
  ]);
  const visible = visibleStays(stays);
  const conflictIds = new Set(findConflicts(stays).flatMap((c) => [c.a.id, c.b.id]));
  const nav = (d: string) => `/calendario?inicio=${d}`;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Calendário</h1>
        <Link href={nav(addDays(from, -7))} className="btn-secondary">← 7d</Link>
        <Link href={nav(addDays(today, -1))} className="btn-secondary">Hoje</Link>
        <Link href={nav(addDays(from, 7))} className="btn-secondary">7d →</Link>
        <form className="flex gap-1">
          <input type="date" name="inicio" defaultValue={from} className="input w-auto! py-1.5" />
          <button className="btn-secondary">Ir</button>
        </form>
        <Link href="/reservas/nova" className="btn-primary">+ Nova reserva</Link>
      </div>

      <div className="mb-2 space-y-1 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-20 font-semibold text-slate-700">Cor = estado</span>
          {(Object.keys(STAGE_LABEL) as Stage[]).map((st) => (
            <span key={st} className="flex items-center gap-1">
              <span className={cx("h-3.5 w-6 rounded", STAGE_FILL[st])} /> {STAGE_LABEL[st]}
            </span>
          ))}
          <span className="flex items-center gap-1"><span className="bar-bloqueio h-3 w-5 rounded" /> Bloqueio</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-20 font-semibold text-slate-700">Borda = canal</span>
          {(["airbnb", "booking", "manual", "outro"] as Source[]).map((src) => (
            <span key={src} className="flex items-center gap-1">
              <span className={cx("h-3.5 w-6 rounded border-[3px] bg-white", SOURCE_BORDER[src])} /> {SOURCE_LABEL[src]}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="h-3 w-5 rounded bg-white outline-2 outline-offset-2 outline-dashed outline-orange-500" /> ⚠️ Conflito
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
        <div style={{ width: 112 + DAYS * W }}>
          {/* Cabeçalho de dias */}
          <div className="sticky top-0 z-10 flex border-b border-slate-200 bg-white">
            <div className="sticky left-0 z-10 w-28 shrink-0 border-r border-slate-200 bg-white" />
            {days.map((d) => {
              const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
              return (
                <div
                  key={d}
                  style={{ width: W }}
                  className={cx(
                    "shrink-0 py-1 text-center text-[11px] leading-tight",
                    (wd === 0 || wd === 6) && "bg-slate-50",
                    d === today && "bg-amber-100 font-bold",
                  )}
                >
                  <div className="text-slate-500">{weekday(d)}</div>
                  <div>{Number(d.slice(8))}</div>
                  {(d.slice(8) === "01" || d === from) && <div className="text-[10px] text-slate-400">{d.slice(5, 7)}</div>}
                </div>
              );
            })}
          </div>

          {properties.map((p) => {
            const pu = units.filter((u) => u.property_id === p.id);
            if (!pu.length) return null;
            return (
              <div key={p.id}>
                <div className="sticky left-0 w-max bg-slate-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {p.name}
                </div>
                {pu.map((u) => {
                  const placed = lanes(visible.filter((r) => r.unit_id === u.id));
                  const nLanes = Math.max(1, ...placed.map((x) => x.lane + 1));
                  return (
                    <div key={u.id} className="flex border-b border-slate-100">
                      <div className="sticky left-0 z-[5] flex w-28 shrink-0 items-center gap-1.5 border-r border-slate-200 bg-white px-2 text-sm">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: u.color }} />
                        <Link href={`/unidades/${u.id}`} className="truncate hover:underline">{u.name}</Link>
                      </div>
                      <div className="relative" style={{ width: DAYS * W, height: nLanes * LANE + 8 }}>
                        {/* Grade de fundo */}
                        <div className="absolute inset-0 flex">
                          {days.map((d) => (
                            <div key={d} style={{ width: W }} className={cx("shrink-0 border-r border-slate-100", d === today && "bg-amber-50")} />
                          ))}
                        </div>
                        {placed.map(({ r, lane }) => {
                          const left = r.check_in >= from ? (diffDays(from, r.check_in) + 0.5) * W : 0;
                          const right = r.check_out <= to ? (diffDays(from, r.check_out) + 0.5) * W : DAYS * W;
                          const isBlock = r.kind === "bloqueio";
                          const stage = stageOf(r);
                          return (
                            <Link
                              key={r.id}
                              href={`/reservas/${r.id}`}
                              title={`${SOURCE_LABEL[r.source]} ${isBlock ? "bloqueio" : `reserva, ${STAGE_LABEL[stage]}`} ${r.check_in} → ${r.check_out}`}
                              className={cx(
                                "absolute flex items-center overflow-hidden rounded-md px-1 text-xs font-medium whitespace-nowrap",
                                "border-[3px] shadow-[inset_0_0_0_2px_#fff]",
                                SOURCE_BORDER[r.source],
                                isBlock ? "bar-bloqueio text-slate-800" : STAGE_FILL[stage],
                                conflictIds.has(r.id) && "outline-2 outline-offset-2 outline-dashed outline-orange-500",
                              )}
                              style={{ left: left + 1, width: Math.max(right - left - 2, 8), top: 4 + lane * LANE, height: LANE - 4 }}
                            >
                              {conflictIds.has(r.id) ? "⚠️ " : ""}
                              {isBlock ? "Bloqueio" : r.guest_name || SOURCE_LABEL[r.source]}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      {units.length === 0 && <p className="mt-3 text-sm text-slate-600">Nenhum quarto ativo.</p>}
    </div>
  );
}
