import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { FeedStatus } from "@/components/FeedStatus";
import { SubmitButton } from "@/components/SubmitButton";
import { SyncNowButton } from "@/components/SyncNowButton";
import { loadFeeds, loadProperties } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";
import { CHANNEL_LABEL } from "@/lib/types";
import { cx } from "@/lib/ui";
import { createProperty, createUnit } from "./actions";

export const dynamic = "force-dynamic";

export default async function UnitsPage() {
  const { supabase } = await requireUser();
  const [{ properties, units }, feeds] = await Promise.all([loadProperties(supabase), loadFeeds(supabase)]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h1 className="text-xl font-semibold">Propriedades e quartos</h1>
        <SyncNowButton label="Sincronizar todos agora" />
      </div>

      {properties.map((p) => {
        const pu = units.filter((u) => u.property_id === p.id);
        return (
          <section key={p.id} className={cx("card", !p.active && "opacity-60")}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="font-semibold">
                {p.name} <span className="text-sm font-normal text-slate-500">({pu.length} quarto{pu.length === 1 ? "" : "s"})</span>
                {!p.active && <span className="ml-2 text-xs text-slate-500">inativa</span>}
              </h2>
              <Link href={`/unidades/propriedades/${p.id}`} className="text-sm text-slate-500 hover:underline">Editar</Link>
            </div>
            <ul className="divide-y divide-slate-100">
              {pu.map((u) => {
                const uf = feeds.filter((f) => f.unit_id === u.id);
                return (
                  <li key={u.id}>
                    <Link href={`/unidades/${u.id}`} className="flex flex-wrap items-center gap-2 py-2 hover:bg-slate-50">
                      <span className="h-3 w-3 rounded-full" style={{ background: u.color }} />
                      <span className={cx("font-medium", !u.active && "text-slate-400 line-through")}>{u.name}</span>
                      <span className="ml-auto flex flex-wrap gap-2">
                        {uf.length === 0 && <span className="text-xs text-slate-400">sem feeds</span>}
                        {uf.map((f) => (
                          <span key={f.id} className="flex items-center gap-1 text-xs text-slate-600">
                            {CHANNEL_LABEL[f.channel]} <FeedStatus feed={f} />
                          </span>
                        ))}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <ActionForm action={createUnit} resetOnSuccess className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
              <input type="hidden" name="property_id" value={p.id} />
              <input name="name" placeholder="Novo quarto (ex.: Quarto 3)" required className="input min-w-0 flex-1" />
              <input type="color" name="color" defaultValue="#64748b" className="h-10 w-12 rounded border border-slate-300" aria-label="Cor" />
              <input type="number" name="sort_order" defaultValue={pu.length + 1} className="input w-20" aria-label="Ordem" title="Ordem" />
              <SubmitButton className="btn-secondary">+ Quarto</SubmitButton>
            </ActionForm>
          </section>
        );
      })}

      <section className="card">
        <h2 className="mb-2 font-semibold">Nova propriedade</h2>
        <ActionForm action={createProperty} resetOnSuccess className="flex flex-wrap gap-2">
          <input name="name" placeholder="Nome da propriedade" required className="input min-w-0 flex-1" />
          <input type="number" name="sort_order" defaultValue={properties.length + 1} className="input w-20" aria-label="Ordem" title="Ordem" />
          <SubmitButton>Criar</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
