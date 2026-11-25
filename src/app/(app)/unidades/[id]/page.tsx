import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { CopyButton } from "@/components/CopyButton";
import { FeedStatus } from "@/components/FeedStatus";
import { SubmitButton } from "@/components/SubmitButton";
import { SyncNowButton } from "@/components/SyncNowButton";
import { env } from "@/lib/env";
import { loadProperties } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";
import { CHANNEL_LABEL, type Feed, type Unit } from "@/lib/types";
import { deleteFeed, regenerateToken, saveFeed, updateUnit } from "../actions";

export const dynamic = "force-dynamic";

export default async function UnitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireUser();
  const [{ data }, { data: feedRows }, { properties }] = await Promise.all([
    supabase.from("units").select("*").eq("id", id).maybeSingle(),
    supabase.from("feeds").select("*").eq("unit_id", id).order("created_at"),
    loadProperties(supabase),
  ]);
  if (!data) notFound();
  const u = data as Unit;
  const feeds = (feedRows ?? []) as Feed[];
  const base = `${env.appUrl}/api/ical/${u.export_token}`;
  const missing = (["airbnb", "booking"] as const).filter((c) => !feeds.some((f) => f.channel === c));

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <Link href="/unidades" className="text-sm text-slate-500 hover:underline">← Quartos</Link>
        <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold">
          <span className="h-4 w-4 rounded-full" style={{ background: u.color }} /> {u.name}
        </h1>
      </div>

      <section className="card">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Importar (feeds iCal das plataformas)</h2>
          {feeds.length > 0 && <SyncNowButton unitId={u.id} />}
        </div>
        <div className="space-y-3">
          {feeds.map((f) => (
            <div key={f.id} className="rounded-lg border border-slate-200 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <strong className="text-sm">{CHANNEL_LABEL[f.channel]}</strong>
                <FeedStatus feed={f} detailed />
              </div>
              {f.error_message && <p className="mb-2 rounded bg-red-50 p-2 text-xs text-red-800">{f.error_message}</p>}
              <ActionForm action={saveFeed} className="space-y-2">
                <input type="hidden" name="id" value={f.id} />
                <input type="hidden" name="channel" value={f.channel} />
                <input name="url" defaultValue={f.url} required className="input font-mono text-xs" />
                <SubmitButton className="btn-secondary" pendingText="Salvando e sincronizando…">Salvar URL</SubmitButton>
              </ActionForm>
              <form action={deleteFeed} className="mt-2">
                <input type="hidden" name="id" value={f.id} />
                <SubmitButton
                  className="btn px-0 text-xs text-red-600 hover:underline"
                  confirm="Remover este feed? As reservas futuras importadas dele serão marcadas como canceladas."
                  pendingText="Removendo…"
                >
                  Remover feed
                </SubmitButton>
              </form>
            </div>
          ))}
          <ActionForm action={saveFeed} resetOnSuccess className="rounded-lg border border-dashed border-slate-300 p-3">
            <input type="hidden" name="unit_id" value={u.id} />
            <p className="mb-2 text-sm font-medium">Adicionar feed</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <select name="channel" defaultValue={missing[0] ?? "outro"} className="input sm:w-40">
                {Object.entries(CHANNEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input name="url" placeholder="Cole aqui a URL .ics da plataforma" required className="input font-mono text-xs" />
              <SubmitButton pendingText="Sincronizando…">Adicionar</SubmitButton>
            </div>
          </ActionForm>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-1 font-semibold">Exportar (cole nas plataformas)</h2>
        <p className="mb-3 text-xs text-slate-500">
          Cada link leva reservas e bloqueios ativos deste quarto, exceto os que vieram da própria plataforma. Não compartilhe: quem tiver o link vê as datas ocupadas.
        </p>
        {(["airbnb", "booking"] as const).map((c) => {
          const url = `${base}/${c}.ics`;
          return (
            <div key={c} className="mb-3">
              <label className="label">Para o {CHANNEL_LABEL[c]}</label>
              <div className="flex gap-2">
                <input readOnly value={url} className="input font-mono text-xs" />
                <CopyButton text={url} />
              </div>
            </div>
          );
        })}
        <form action={regenerateToken}>
          <input type="hidden" name="id" value={u.id} />
          <SubmitButton
            className="btn px-0 text-xs text-slate-500 hover:underline"
            confirm="Gerar novos links? Os links antigos param de funcionar e você terá que colar os novos no Airbnb e no Booking."
            pendingText="Gerando…"
          >
            Gerar novos links (invalida os atuais)
          </SubmitButton>
        </form>
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
              <input type="number" name="sort_order" defaultValue={u.sort_order} className="input w-24" />
            </div>
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea name="notes" rows={3} defaultValue={u.notes ?? ""} className="input" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={u.active} /> Ativo (inativos não sincronizam e somem do início/calendário)
          </label>
          <SubmitButton>Salvar</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
