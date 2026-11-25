import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { CopyButton } from "@/components/CopyButton";
import { StageBadge, StageButtons } from "@/components/StageButtons";
import { SubmitButton } from "@/components/SubmitButton";
import { UnitSelect } from "@/components/UnitSelect";
import { loadCleaningDay } from "@/lib/cleaning-db";
import { addDays, formatDate, formatDayMonth, formatShort, isIsoDate, todaySP, weekday } from "@/lib/dates";
import {
  buildTeamView,
  effectiveCheckinTime,
  PRIORITY_LABEL,
  whatsappMessage,
} from "@/lib/domain/cleaning";
import { visibleStays } from "@/lib/domain/rules";
import { loadTasks, unitLabel } from "@/lib/data";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/supabase/server";
import { TASK_KIND_LABEL, type Task } from "@/lib/types";
import { cx, PRIORITY_STYLE, stayLabel } from "@/lib/ui";
import { regenerateTeamToken } from "../unidades/actions";
import { createTask, deleteTask, toggleTask } from "./actions";

export const dynamic = "force-dynamic";

export default async function CleaningPage({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const { supabase } = await requireUser();
  const sp = await searchParams;
  const today = todaySP();
  const day = isIsoDate(sp.dia) ? sp.dia : today;

  const [data, tasks] = await Promise.all([loadCleaningDay(supabase, day), loadTasks(supabase, day)]);
  const { properties, units, entries, cleaningItems, stays } = data;
  const label = (id: string) => unitLabel(units, properties, id);
  const propOf = (unitId: string) => properties.find((p) => p.id === units.find((u) => u.id === unitId)?.property_id);
  const nav = (d: string) => `/limpeza?dia=${d}`;
  const pending = entries.filter((e) => !e.done).length;

  // Chegadas do dia em quartos sem saída no mesmo dia
  const departUnits = new Set(entries.filter((e) => e.reservation.check_out === day).map((e) => e.unit_id));
  const onlyCheckins = visibleStays(stays).filter((r) => r.kind === "reserva" && r.check_in === day && !departUnits.has(r.unit_id));

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

      <details className="card">
        <summary className="cursor-pointer font-semibold">📲 Enviar para a equipe (WhatsApp)</summary>
        <p className="mt-2 text-xs text-slate-500">
          Um link por propriedade, só de leitura e sem dados de hóspedes. A mensagem leva a data, a lista resumida e o link.
        </p>
        <ul className="mt-3 space-y-3">
          {properties.map((p) => {
            const url = `${env.appUrl}/equipe/${p.team_token}?dia=${day}`;
            const view = buildTeamView({ day, property: p, units, entries, cleaningItems, checklist: data.checklist });
            return (
              <li key={p.id} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <strong className="text-sm">{p.name}</strong>
                  <span className="text-xs text-slate-500">{view.rooms.length} limpeza(s)</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <CopyButton text={whatsappMessage(view, url)} label="Copiar mensagem para WhatsApp" className="btn-primary" />
                  <a href={url} target="_blank" rel="noreferrer" className="btn-secondary">Abrir página</a>
                  <form action={regenerateTeamToken}>
                    <input type="hidden" name="id" value={p.id} />
                    <SubmitButton
                      className="btn-secondary"
                      confirm={`Gerar novo link para ${p.name}? O link enviado antes para de funcionar.`}
                      pendingText="Gerando…"
                    >
                      Gerar novo link
                    </SubmitButton>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      </details>

      <section>
        <h2 className="mb-2 font-semibold">
          Limpezas ({entries.length})
          {pending > 0 && <span className="ml-2 text-sm font-normal text-orange-700">{pending} a fazer</span>}
        </h2>
        {entries.length === 0 && <p className="card text-sm text-slate-500">Nenhuma limpeza neste dia.</p>}
        <ul className="space-y-2">
          {entries.map((e) => {
            const r = e.reservation;
            const property = propOf(e.unit_id);
            const total = e.cleaning ? cleaningItems.filter((i) => i.cleaning_id === e.cleaning!.id) : [];
            const doneCount = total.filter((i) => i.done_at).length;
            const next = e.nextArrival;
            return (
              <li key={r.id} className={cx("card p-3", e.priority === "urgente" && !e.done && "ring-2 ring-red-500", e.done && "opacity-70")}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cx("rounded-full px-2 py-0.5 text-xs font-semibold", PRIORITY_STYLE[e.priority])}>
                    {PRIORITY_LABEL[e.priority]}
                  </span>
                  <StageBadge r={r} />
                  {e.cleaning && (
                    <span className="text-xs text-slate-600">
                      Checklist {doneCount}/{total.length}
                    </span>
                  )}
                </div>
                <div className="mt-1 font-semibold">{label(e.unit_id)}</div>
                <Link href={`/reservas/${r.id}`} className="text-sm text-slate-600 hover:underline">
                  Sai: {stayLabel(r)} ({formatShort(r.check_in)}→{formatShort(r.check_out)})
                </Link>
                {next && property && (
                  <p className={cx("text-sm", next.check_in === day && !e.done ? "font-semibold text-red-700" : "text-slate-600")}>
                    Próximo check-in: {next.check_in === day ? "hoje" : formatDate(next.check_in)} às{" "}
                    {effectiveCheckinTime(next, property)} ({stayLabel(next)})
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.checked_out_at ? (
                    <Link href={`/limpeza/${r.id}`} className="btn-primary">
                      {e.done ? "Ver limpeza" : "Abrir limpeza"}
                    </Link>
                  ) : (
                    <StageButtons r={r} showUndo={false} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {onlyCheckins.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">Chegadas sem saída no mesmo quarto ({onlyCheckins.length})</h2>
          <ul className="card divide-y divide-slate-100 p-0">
            {onlyCheckins.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <Link href={`/reservas/${r.id}`} className="hover:underline">
                  <strong>{label(r.unit_id)}</strong>: {stayLabel(r)}
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
