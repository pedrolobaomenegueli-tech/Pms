import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUser } from "@/lib/supabase/server";
import type { Property } from "@/lib/types";
import { updateProperty } from "../../actions";

export const dynamic = "force-dynamic";

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const { data } = await supabase.from("properties").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const p = data as Property;
  return (
    <div className="mx-auto max-w-xl">
      <Link href="/unidades" className="text-sm text-slate-500 hover:underline">← Quartos</Link>
      <h1 className="mb-3 mt-1 text-xl font-semibold">{p.name}</h1>
      <ActionForm action={updateProperty} className="card space-y-3">
        <input type="hidden" name="id" value={p.id} />
        <div>
          <label className="label">Nome</label>
          <input name="name" defaultValue={p.name} required className="input" />
        </div>
        <div>
          <label className="label">Ordem</label>
          <input type="number" name="sort_order" defaultValue={p.sort_order} className="input w-24" />
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
