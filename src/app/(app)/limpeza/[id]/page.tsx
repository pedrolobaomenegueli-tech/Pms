import Link from "next/link";
import { notFound } from "next/navigation";
import { StageBadge, StageButtons } from "@/components/StageButtons";
import { SubmitButton } from "@/components/SubmitButton";
import { ensureCleaning } from "@/lib/cleaning-db";
import { addDays, formatDate, formatDateTimeSP, todaySP } from "@/lib/dates";
import { effectiveCheckinTime } from "@/lib/domain/cleaning";
import { visibleStays } from "@/lib/domain/rules";
import { loadActiveStays, loadProperties, unitLabel } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";
import type { CleaningItem, MaintenanceIssue, Reservation } from "@/lib/types";
import { MAINT_PRIORITY_LABEL, MAINT_STATUS_LABEL } from "@/lib/types";
import { cx, stayLabel } from "@/lib/ui";
import { completeCleaning, toggleCleaningItem } from "../actions";

export const dynamic = "force-dynamic";

/** Detalhe da limpeza de uma reserva (id = reserva). */
export default async function CleaningDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data } = await supabase.from("reservations").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const r = data as Reservation;
  const { properties, units } = await loadProperties(supabase);
  const property = properties.find((p) => p.id === units.find((u) => u.id === r.unit_id)?.property_id);

  // Limpeza só existe depois do check-out realizado
  const cleaning = r.checked_out_at ? await ensureCleaning(supabase, r.id) : null;
  const [{ data: itemRows }, { data: issueRows }, stays] = await Promise.all([
    cleaning
      ? supabase.from("cleaning_items").select("*").eq("cleaning_id", cleaning.id).order("sort_order")
      : Promise.resolve({ data: [] }),
    cleaning
      ? supabase.from("maintenance_issues").select("*").eq("cleaning_id", cleaning.id).order("created_at")
      : Promise.resolve({ data: [] }),
    loadActiveStays(supabase, r.check_out, addDays(r.check_out > todaySP() ? r.check_out : todaySP(), 30), r.unit_id),
  ]);
  const items = (itemRows ?? []) as CleaningItem[];
  const issues = (issueRows ?? []) as MaintenanceIssue[];
  const left = items.filter((i) => !i.done_at).length;
  const next = visibleStays(stays)
    .filter((s) => s.kind === "reserva" && s.id !== r.id && s.check_in >= r.check_out)
    .sort((a, b) => a.check_in.localeCompare(b.check_in))[0];

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <Link href={`/limpeza?dia=${r.check_out}`} className="text-sm text-slate-500 hover:underline">← Limpeza</Link>
        <h1 className="mt-1 text-xl font-semibold">Limpeza · {unitLabel(units, properties, r.unit_id)}</h1>
        <p className="text-sm text-slate-600">
          Saída {formatDate(r.check_out)} · {stayLabel(r)}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StageBadge r={r} />
          {next && property && (
            <span className="text-sm text-slate-700">
              Próximo check-in: {next.check_in === todaySP() ? "hoje" : formatDate(next.check_in)} às{" "}
              {effectiveCheckinTime(next, property)}
            </span>
          )}
        </div>
      </div>

      {!cleaning && (
        <div className="card space-y-2 text-sm">
          <p>A limpeza é criada quando o check-out é realizado.</p>
          <StageButtons r={r} showUndo={false} />
        </div>
      )}

      {cleaning && (
        <section className="card">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Checklist</h2>
            <span className="text-sm text-slate-500">
              {items.length - left}/{items.length}
            </span>
          </div>
          {items.length === 0 && (
            <p className="text-sm text-slate-500">
              Sem itens: o checklist do quarto estava vazio no check-out. Configure em Quartos.
            </p>
          )}
          <ul className="divide-y divide-slate-100">
            {items.map((it) => (
              <li key={it.id}>
                <form action={toggleCleaningItem}>
                  <input type="hidden" name="id" value={it.id} />
                  <input type="hidden" name="done" value={it.done_at ? "0" : "1"} />
                  <button className="flex w-full items-center gap-3 py-3 text-left">
                    <span
                      className={cx(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1",
                        it.done_at ? "bg-emerald-600 text-white ring-emerald-600" : "bg-white ring-slate-300",
                      )}
                    >
                      {it.done_at ? "✓" : ""}
                    </span>
                    <span className={cx("text-base", it.done_at && "text-slate-400 line-through")}>{it.label}</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>

          <form action={completeCleaning} className="mt-4 border-t border-slate-100 pt-4">
            <input type="hidden" name="id" value={cleaning.id} />
            {cleaning.completed_at ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold text-emerald-700">
                  ✓ Concluída {formatDateTimeSP(cleaning.completed_at)}
                  {left > 0 && <span className="text-orange-700"> · {left} item(ns) ficaram de fora</span>}
                </span>
                <input type="hidden" name="reabrir" value="1" />
                <SubmitButton className="btn-secondary" pendingText="…">Reabrir</SubmitButton>
              </div>
            ) : (
              <>
                {left > 0 && items.length > 0 && (
                  <p className="mb-2 text-sm text-orange-700">{left} item(ns) ainda não marcado(s).</p>
                )}
                <SubmitButton
                  className="btn-primary w-full py-3 text-base"
                  confirm={left > 0 && items.length > 0 ? `Concluir com ${left} item(ns) pendente(s)?` : undefined}
                  pendingText="Concluindo…"
                >
                  Concluída
                </SubmitButton>
              </>
            )}
          </form>
        </section>
      )}

      {cleaning && (
        <section className="card">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="font-semibold">Manutenção</h2>
            <Link href={`/manutencao/nova?quarto=${r.unit_id}&limpeza=${cleaning.id}`} className="btn-secondary">
              + Registrar problema
            </Link>
          </div>
          {issues.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum problema registrado nesta limpeza.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {issues.map((i) => (
                <li key={i.id}>
                  <Link href={`/manutencao/${i.id}`} className="hover:underline">
                    {i.title} · {MAINT_PRIORITY_LABEL[i.priority]} · {MAINT_STATUS_LABEL[i.status]}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
