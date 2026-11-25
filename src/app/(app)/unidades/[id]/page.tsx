import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { ChecklistEditor } from "@/components/ChecklistEditor";
import { SubmitButton } from "@/components/SubmitButton";
import { loadProperties } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";
import type { ChecklistItem, MaintenanceIssue, Unit } from "@/lib/types";
import { sortIssues } from "@/lib/domain/maintenance";
import { formatDate } from "@/lib/dates";
import { PriorityBadge, StatusBadge } from "@/components/MaintenanceBadges";
import { updateUnit } from "../actions";

export const dynamic = "force-dynamic";

export default async function UnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const [{ data }, { properties }] = await Promise.all([
    supabase.from("units").select("*").eq("id", id).maybeSingle(),
    loadProperties(supabase),
  ]);
  if (!data) notFound();
  const u = data as Unit;
  const { data: issueRows } = await supabase.from("maintenance_issues").select("*").eq("unit_id", u.id);
  const issues = sortIssues((issueRows ?? []) as MaintenanceIssue[]);
  const { data: checklistRows } = await supabase
    .from("checklist_items")
    .select("*")
    .or(`unit_id.eq.${u.id},property_id.eq.${u.property_id}`)
    .order("sort_order");
  const checklist = (checklistRows ?? []) as ChecklistItem[];
  const inherited = checklist.filter((i) => i.property_id === u.property_id);
  const property = properties.find((p) => p.id === u.property_id);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/unidades" className="text-sm text-slate-500 hover:underline">← Quartos</Link>
        <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold">
          <span className="h-4 w-4 rounded-full" style={{ background: u.color }} /> {u.name}
        </h1>
      </div>

      <section className="card">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-semibold">Manutenção ({issues.length})</h2>
          <Link href={`/manutencao/nova?quarto=${u.id}`} className="btn-secondary">+ Registrar</Link>
        </div>
        {issues.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum problema registrado.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {issues.map((i) => (
              <li key={i.id}>
                <Link href={`/manutencao/${i.id}`} className="flex flex-wrap items-center gap-2 py-2 text-sm hover:bg-slate-50">
                  <PriorityBadge p={i.priority} />
                  <StatusBadge s={i.status} />
                  <span className="min-w-0 flex-1 truncate">{i.title}</span>
                  <span className="text-xs text-slate-500">{formatDate(i.opened_on)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2 className="mb-1 font-semibold">Checklist de limpeza</h2>
        <p className="mb-2 text-xs text-slate-500">
          Herdado de{" "}
          <Link href={`/unidades/propriedades/${u.property_id}`} className="underline">{property?.name ?? "propriedade"}</Link>
          {inherited.length ? ":" : " (modelo vazio)."}
        </p>
        {inherited.length > 0 && (
          <ol className="mb-3 list-decimal space-y-0.5 pl-6 text-sm text-slate-500">
            {inherited.sort((a, b) => a.sort_order - b.sort_order).map((i) => <li key={i.id}>{i.label}</li>)}
          </ol>
        )}
        <h3 className="mb-2 text-sm font-semibold">Itens extras deste quarto</h3>
        <ChecklistEditor
          items={checklist.filter((i) => i.unit_id === u.id)}
          owner={{ unit_id: u.id }}
          placeholder="Extra (ex.: conferir controle do ar)"
        />
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">Dados do quarto</h2>
        <ActionForm action={updateUnit} className="space-y-3">
          <input type="hidden" name="id" value={u.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Nome</label>
              <input name="name" defaultValue={u.name} required className="input" />
            </div>
            <div>
              <label className="label">Propriedade</label>
              <select name="property_id" defaultValue={u.property_id} className="input">
                {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Cor</label>
              <input type="color" name="color" defaultValue={u.color} className="h-10 w-16 rounded border border-slate-300" />
            </div>
            <div>
              <label className="label">Ordem</label>
              <input type="number" name="sort_order" defaultValue={u.sort_order} className="input w-24!" />
            </div>
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea name="notes" rows={3} defaultValue={u.notes ?? ""} className="input" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={u.active} /> Ativo (inativos somem do início e do calendário)
          </label>
          <SubmitButton>Salvar</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
