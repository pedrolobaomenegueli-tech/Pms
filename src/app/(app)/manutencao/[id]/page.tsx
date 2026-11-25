import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { PriorityBadge, StatusBadge } from "@/components/MaintenanceBadges";
import { SubmitButton } from "@/components/SubmitButton";
import { addDays, formatDate, formatDateTimeSP, todaySP } from "@/lib/dates";
import { findOverlapsFor } from "@/lib/domain/rules";
import { loadActiveStays, loadProperties, unitLabel } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";
import type { MaintenanceIssue, Reservation } from "@/lib/types";
import { stayLabel } from "@/lib/ui";
import { addBlock, removeBlock, setIssueStatus } from "../actions";
import { IssueForm } from "../IssueForm";

export const dynamic = "force-dynamic";

export default async function IssuePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ criado?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const { data } = await supabase.from("maintenance_issues").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const issue = data as MaintenanceIssue;
  const { properties, units } = await loadProperties(supabase);

  let block: Reservation | null = null;
  if (issue.block_reservation_id) {
    const { data: b } = await supabase.from("reservations").select("*").eq("id", issue.block_reservation_id).maybeSingle();
    block = b as Reservation | null;
  }
  const blockActive = block?.status === "ativa";
  // Bloqueio permitido sobre reservas existentes, mas avisamos
  const overlaps =
    block && blockActive
      ? findOverlapsFor(block, await loadActiveStays(supabase, block.check_in, block.check_out, block.unit_id)).filter(
          (r) => r.kind === "reserva",
        )
      : [];
  const today = todaySP();

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <Link href="/manutencao" className="text-sm text-slate-500 hover:underline">← Manutenção</Link>
        <h1 className="mt-1 text-xl font-semibold">{issue.title}</h1>
        <p className="text-sm text-slate-600">
          <Link href={`/unidades/${issue.unit_id}`} className="hover:underline">{unitLabel(units, properties, issue.unit_id)}</Link> · aberto em{" "}
          {formatDate(issue.opened_on)}
          {issue.resolved_at && ` · resolvido ${formatDateTimeSP(issue.resolved_at)}`}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <PriorityBadge p={issue.priority} />
          <StatusBadge s={issue.status} />
        </div>
        {sp.criado && <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">Problema registrado.</p>}
        {issue.cleaning_id && <p className="mt-1 text-xs text-slate-500">Encontrado durante uma limpeza.</p>}
      </div>

      {overlaps.length > 0 && (
        <div className="rounded-xl bg-amber-100 p-3 text-sm text-amber-900 ring-1 ring-amber-300">
          <strong>Atenção:</strong> o bloqueio cai sobre reserva(s) existente(s):
          <ul className="mt-1 list-disc pl-5">
            {overlaps.map((r) => (
              <li key={r.id}>
                <Link href={`/reservas/${r.id}`} className="underline">
                  {stayLabel(r)} · {formatDate(r.check_in)} → {formatDate(r.check_out)}
                </Link>
              </li>
            ))}
          </ul>
          Avise o hóspede ou mude de quarto, se for o caso.
        </div>
      )}

      <section className="card space-y-3">
        <h2 className="font-semibold">Status</h2>
        {issue.status !== "resolvido" ? (
          <div className="flex flex-wrap gap-2">
            {issue.status === "aberto" && (
              <form action={setIssueStatus}>
                <input type="hidden" name="id" value={issue.id} />
                <SubmitButton name="status" value="em_andamento" className="btn-secondary" pendingText="…">
                  Em andamento
                </SubmitButton>
              </form>
            )}
            {blockActive ? (
              <form action={setIssueStatus} className="flex flex-wrap gap-2">
                <input type="hidden" name="id" value={issue.id} />
                <input type="hidden" name="status" value="resolvido" />
                <SubmitButton name="bloqueio" value="remover" className="btn-primary" pendingText="…">
                  Resolver e remover bloqueio
                </SubmitButton>
                <SubmitButton name="bloqueio" value="manter" className="btn-secondary" pendingText="…">
                  Resolver e manter bloqueio
                </SubmitButton>
              </form>
            ) : (
              <form action={setIssueStatus}>
                <input type="hidden" name="id" value={issue.id} />
                <SubmitButton name="status" value="resolvido" className="btn-primary" pendingText="…">
                  Marcar como resolvido
                </SubmitButton>
              </form>
            )}
          </div>
        ) : (
          <form action={setIssueStatus}>
            <input type="hidden" name="id" value={issue.id} />
            <SubmitButton name="status" value="aberto" className="btn-secondary" pendingText="…">
              Reabrir
            </SubmitButton>
          </form>
        )}
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Bloqueio do quarto</h2>
        {block && blockActive ? (
          <>
            <p className="text-sm">
              🔒 Bloqueado de {formatDate(block.check_in)} até {formatDate(block.check_out)} (saída). Enquanto a integração com o channel manager não existir, este bloqueio fica só no PMS: bloqueie também na HotelLink.
            </p>
            <form action={removeBlock}>
              <input type="hidden" name="id" value={issue.id} />
              <SubmitButton className="btn-secondary" confirm="Remover o bloqueio do PMS?" pendingText="…">
                Remover bloqueio
              </SubmitButton>
            </form>
          </>
        ) : (
          <ActionForm action={addBlock} className="space-y-2">
            {block && <p className="text-sm text-slate-500">Bloqueio anterior removido.</p>}
            <input type="hidden" name="id" value={issue.id} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">De</label>
                <input type="date" name="block_from" className="input" defaultValue={today} required />
              </div>
              <div>
                <label className="label">Até (saída)</label>
                <input type="date" name="block_to" className="input" defaultValue={addDays(today, 1)} required />
              </div>
            </div>
            <SubmitButton className="btn-secondary">Bloquear quarto</SubmitButton>
          </ActionForm>
        )}
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">Dados do problema</h2>
        <IssueForm properties={properties} units={units} issue={issue} />
      </section>
    </div>
  );
}
