import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { StageBadge, StageButtons } from "@/components/StageButtons";
import { SubmitButton } from "@/components/SubmitButton";
import { UnitSelect } from "@/components/UnitSelect";
import { addDays, formatDate, formatDayMonth, formatShort, isIsoDate, todaySP, weekday } from "@/lib/dates";
import { visibleStays } from "@/lib/domain/rules";
import { loadActiveStays, loadProperties, loadTasks, unitLabel } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";
import { SOURCE_LABEL, TASK_KIND_LABEL, type Reservation, type Task } from "@/lib/types";
import { cx } from "@/lib/ui";
import { createTask, deleteTask, toggleTask } from "./actions";

export const dynamic = "force-dynamic";

export default async function CleaningPage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const { supabase } = await requireUser();
  const sp = await searchParams;
  const today = todaySP();
  const day = isIsoDate(sp.dia) ? sp.dia : today;

  const [{ properties, units }, stays, tasks, { data: openRows }] = await Promise.all([
    loadProperties(supabase, { onlyActive: true }),
    loadActiveStays(supabase, addDays(day, -1), addDays(day, 1)),
    loadTasks(supabase, day),
    // Quartos em limpeza de dias anteriores que ninguém finalizou
    supabase
      .from("reservations")
      .select("*")
      .eq("status", "ativa")
      .not("checked_out_at", "is", null)
      .is("cleaning_done_at", null)
      .lt("check_out", day)
      .gte("check_out", addDays(day, -14))
      .order("check_out"),
  ]);
  const activeIds = new Set(units.map((u) => u.id));
  const vis = visibleStays(stays).filter((r) => r.kind === "reserva" && activeIds.has(r.unit_id));
  const order = new Map(units.map((u, i) => [u.id, i]));
  const checkouts = vis
    .filter((r) => r.check_out === day)
    .sort((a, b) => (order.get(a.unit_id)! - order.get(b.unit_id)!));
  const checkins = vis.filter((r) => r.check_in === day);
  const checkinByUnit = new Map(checkins.map((r) => [r.unit_id, r]));
  const onlyCheckins = checkins.filter((r) => !checkouts.some((c) => c.unit_id === r.unit_id));
  const label = (id: string) => unitLabel(units, properties, id);
  const nav = (d: string) => `/limpeza?dia=${d}`;
  const pending = checkouts.filter((r) => !r.cleaning_done_at).length;
  const openCleaning = ((openRows ?? []) as Reservation[]).filter((r) => activeIds.has(r.unit_id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">
          Limpeza · {weekday(day)} {formatDayMonth(day)}
        </h1>
        <Link href={nav(addDays(day, -1))} className="btn-secondary">←</Link>
        <Link href={nav(today)} className="btn-secondary">Hoje</Link>
        <Link href={nav(addDays(day, 1))} className="btn-secondary">→</Link>
        <form className="flex gap-1">
          <input type="date" name="dia" defaultValue={day} className="input w-auto! py-1.5" />
          <button className="btn-secondary">Ir</button>
        </form>
      </div>

      <section>
        <h2 className="mb-2 font-semibold">
          Check-outs ({checkouts.length}){pending > 0 && <span className="ml-2 text-sm font-normal text-orange-700">{pending} a limpar</span>}
        </h2>
        {checkouts.length === 0 && <p className="card text-sm text-slate-500">Nenhum check-out neste dia.</p>}
        <ul className="space-y-2">
          {checkouts.map((r) => {
            const arrival = checkinByUnit.get(r.unit_id);
            return (
              <li
                key={r.id}
                className={cx(
                  "card p-3",
                  arrival && !r.cleaning_done_at && "ring-2 ring-red-500",
                  r.cleaning_done_at && "bg-emerald-50",
                )}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-semibold">{label(r.unit_id)}</span>
                  <span className="text-xs text-slate-500">
                    <StageBadge r={r} />
                  </span>
                </div>
                <Link href={`/reservas/${r.id}`} className="text-sm text-slate-600 hover:underline">
                  Sai: {r.guest_name || SOURCE_LABEL[r.source]} ({formatShort(r.check_in)}→{formatShort(r.check_out)})
                </Link>
                {arrival && (
                  <p className={cx("mt-1 text-sm", r.cleaning_done_at ? "text-slate-600" : "font-semibold text-red-700")}>
                    {r.cleaning_done_at ? "Chega hoje" : "⚡ Check-in no mesmo dia"}: {arrival.guest_name || SOURCE_LABEL[arrival.source]}
                    {arrival.guests ? `, ${arrival.guests} hósp.` : ""}
                  </p>
                )}
                {r.notes && <p className="mt-1 text-xs text-slate-500">{r.notes}</p>}
                <div className="mt-2">
                  <StageButtons r={r} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {openCleaning.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold text-orange-700">Limpezas de dias anteriores não finalizadas ({openCleaning.length})</h2>
          <ul className="space-y-2">
            {openCleaning.map((r) => (
              <li key={r.id} className="card p-3">
                <div className="font-semibold">{label(r.unit_id)}</div>
                <p className="text-sm text-slate-600">Saída em {formatShort(r.check_out)}</p>
                <div className="mt-2"><StageButtons r={r} /></div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {onlyCheckins.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Chegadas sem saída no mesmo quarto ({onlyCheckins.length})</h2>
          <ul className="card divide-y divide-slate-100 p-0">
            {onlyCheckins.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <Link href={`/reservas/${r.id}`} className="hover:underline">
                  <strong>{label(r.unit_id)}</strong>: {r.guest_name || SOURCE_LABEL[r.source]}
                  {r.guests ? `, ${r.guests} hósp.` : ""}
                </Link>
                <div className="flex items-center gap-2"><StageBadge r={r} /><StageButtons r={r} showUndo={false} /></div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-semibold">Tarefas</h2>
        <TaskList tasks={[...tasks.late, ...tasks.day]} label={label} day={day} />
        <div className="card mt-3">
          <h3 className="mb-2 text-sm font-semibold">Nova tarefa</h3>
          <ActionForm action={createTask} resetOnSuccess className="grid gap-2 sm:grid-cols-6">
            <input name="title" placeholder="Ex.: trocar lâmpada" required className="input sm:col-span-2" />
            <div className="sm:col-span-2">
              <UnitSelect properties={properties} units={units} emptyLabel="Quarto…" required />
            </div>
            <select name="kind" className="input" defaultValue="outro">
              {Object.entries(TASK_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input type="date" name="date" defaultValue={day} required className="input" />
            <input name="notes" placeholder="Observações (opcional)" className="input sm:col-span-5" />
            <SubmitButton>Adicionar</SubmitButton>
          </ActionForm>
        </div>
      </section>
    </div>
  );
}

function TaskList({ tasks, label, day }: { tasks: Task[]; label: (id: string) => string; day: string }) {
  if (!tasks.length) return <p className="card text-sm text-slate-500">Nenhuma tarefa para este dia.</p>;
  return (
    <ul className="card divide-y divide-slate-100 p-0">
      {tasks.map((t) => (
        <li key={t.id} className="flex items-start gap-3 p-3">
          <form action={toggleTask}>
            <input type="hidden" name="id" value={t.id} />
            <input type="hidden" name="done" value={t.done ? "0" : "1"} />
            <SubmitButton
              className={cx("btn h-7 w-7 p-0 ring-1", t.done ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white ring-slate-300")}
              pendingText="…"
            >
              {t.done ? "✓" : ""}
            </SubmitButton>
          </form>
          <div className={cx("min-w-0 flex-1 text-sm", t.done && "text-slate-400 line-through")}>
            <div className="font-medium">{t.title}</div>
            <div className="text-xs text-slate-500">
              {label(t.unit_id)} · {TASK_KIND_LABEL[t.kind]}
              {t.date < day && <span className="font-semibold text-red-700"> · atrasada ({formatDate(t.date)})</span>}
            </div>
            {t.notes && <div className="text-xs text-slate-500">{t.notes}</div>}
          </div>
          <form action={deleteTask}>
            <input type="hidden" name="id" value={t.id} />
            <SubmitButton className="btn px-2 py-1 text-xs text-slate-400 hover:text-red-600" confirm="Excluir tarefa?" pendingText="…">
              Excluir
            </SubmitButton>
          </form>
        </li>
      ))}
    </ul>
  );
}
