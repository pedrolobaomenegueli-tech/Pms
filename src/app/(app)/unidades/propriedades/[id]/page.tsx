import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { ChecklistEditor } from "@/components/ChecklistEditor";
import { CopyButton } from "@/components/CopyButton";
import { SubmitButton } from "@/components/SubmitButton";
import { hhmm } from "@/lib/domain/cleaning";
import { env } from "@/lib/env";
import { requireUser } from "@/lib/supabase/server";
import type { ChecklistItem, Property } from "@/lib/types";
import { regenerateTeamToken, updateProperty } from "../../actions";

export const dynamic = "force-dynamic";

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const [{ data }, { data: itemRows }] = await Promise.all([
    supabase.from("properties").select("*").eq("id", id).maybeSingle(),
    supabase.from("checklist_items").select("*").eq("property_id", id).order("sort_order"),
  ]);
  if (!data) notFound();
  const p = data as Property;
  const teamUrl = `${env.appUrl}/equipe/${p.team_token}`;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <Link href="/unidades" className="text-sm text-slate-500 hover:underline">← Quartos</Link>
        <h1 className="mt-1 text-xl font-semibold">{p.name}</h1>
      </div>

      <section className="card">
        <h2 className="mb-1 font-semibold">Checklist de limpeza (modelo)</h2>
        <p className="mb-3 text-xs text-slate-500">
          Todos os quartos desta propriedade herdam estes itens. Itens extras de um quarto ficam na tela do quarto.
          Mudanças valem para as próximas limpezas; as já criadas não mudam.
        </p>
        <ChecklistEditor items={(itemRows ?? []) as ChecklistItem[]} owner={{ property_id: p.id }} />
      </section>

      <section className="card">
        <h2 className="mb-1 font-semibold">Link da equipe de limpeza</h2>
        <p className="mb-3 text-xs text-slate-500">
          Página só de leitura, sem login e sem dados de hóspedes. Quem tiver o link vê as limpezas desta propriedade.
        </p>
        <div className="flex gap-2">
          <input readOnly value={teamUrl} className="input font-mono text-xs" />
          <CopyButton text={teamUrl} />
        </div>
        <form action={regenerateTeamToken} className="mt-2">
          <input type="hidden" name="id" value={p.id} />
          <SubmitButton
            className="btn px-0 text-xs text-slate-500 hover:underline"
            confirm="Gerar novo link? O link atual para de funcionar na hora."
            pendingText="Gerando…"
          >
            Gerar novo link (invalida o atual)
          </SubmitButton>
        </form>
      </section>

      <ActionForm action={updateProperty} className="card space-y-3">
        <h2 className="font-semibold">Dados da propriedade</h2>
        <input type="hidden" name="id" value={p.id} />
        <div>
          <label className="label">Nome</label>
          <input name="name" defaultValue={p.name} required className="input" />
        </div>
        <div className="flex gap-3">
          <div>
            <label className="label">Check-in padrão</label>
            <input type="time" name="checkin_time" defaultValue={hhmm(p.checkin_time) ?? "15:00"} className="input w-32!" />
          </div>
          <div>
            <label className="label">Ordem</label>
            <input type="number" name="sort_order" defaultValue={p.sort_order} className="input w-24!" />
          </div>
        </div>
        <div>
          <label className="label">Observações</label>
          <textarea name="notes" rows={3} defaultValue={p.notes ?? ""} className="input" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={p.active} /> Ativa (aparece no início e no calendário)
        </label>
        <SubmitButton>Salvar</SubmitButton>
      </ActionForm>
    </div>
  );
}
