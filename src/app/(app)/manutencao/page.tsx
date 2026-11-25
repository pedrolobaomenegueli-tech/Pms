import Link from "next/link";
import { PriorityBadge, StatusBadge } from "@/components/MaintenanceBadges";
import { UnitSelect } from "@/components/UnitSelect";
import { formatDate } from "@/lib/dates";
import { sortIssues } from "@/lib/domain/maintenance";
import { loadProperties, unitLabel } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";
import { MAINT_PRIORITY_LABEL, MAINT_STATUS_LABEL, type MaintenanceIssue } from "@/lib/types";
import { cx } from "@/lib/ui";

export const dynamic = "force-dynamic";

type SP = { propriedade?: string; quarto?: string; status?: string; prioridade?: string };

export default async function MaintenancePage({ searchParams }: { searchParams: Promise<SP> }) {
  const { supabase } = await requireUser();
  const sp = await searchParams;
  const status = sp.status ?? "abertos";
  const { properties, units } = await loadProperties(supabase);

  let q = supabase.from("maintenance_issues").select("*").limit(500);
  if (sp.quarto) q = q.eq("unit_id", sp.quarto);
  else if (sp.propriedade) {
    const ids = units.filter((u) => u.property_id === sp.propriedade).map((u) => u.id);
    q = q.in("unit_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }
  if (status === "abertos") q = q.neq("status", "resolvido");
  else if (["aberto", "em_andamento", "resolvido"].includes(status)) q = q.eq("status", status);
  if (sp.prioridade && sp.prioridade in MAINT_PRIORITY_LABEL) q = q.eq("priority", sp.prioridade);

  const { data, error } = await q;
  const issues = sortIssues((data ?? []) as MaintenanceIssue[]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Manutenção</h1>
        <Link href="/manutencao/nova" className="btn-primary">+ Registrar problema</Link>
      </div>

      <form className="card mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div>
          <label className="label">Propriedade</label>
          <select name="propriedade" defaultValue={sp.propriedade ?? ""} className="input">
            <option value="">Todas</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Quarto</label>
          <UnitSelect properties={properties} units={units} name="quarto" defaultValue={sp.quarto} emptyLabel="Todos" />
        </div>
        <div>
          <label className="label">Status</label>
          <select name="status" defaultValue={status} className="input">
            <option value="abertos">Não resolvidos</option>
            {Object.entries(MAINT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            <option value="todos">Todos</option>
          </select>
        </div>
        <div>
          <label className="label">Prioridade</label>
          <select name="prioridade" defaultValue={sp.prioridade ?? ""} className="input">
            <option value="">Todas</option>
            {Object.entries(MAINT_PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="col-span-2 flex items-end gap-2 sm:col-span-1">
          <button className="btn-primary">Filtrar</button>
          <Link href="/manutencao" className="btn-secondary">Limpar</Link>
        </div>
      </form>

      {error && <p className="text-sm text-red-700">{error.message}</p>}
      {issues.length === 0 && <p className="card text-sm text-slate-500">Nenhum problema encontrado.</p>}
      <ul className="space-y-2">
        {issues.map((i) => (
          <li key={i.id}>
            <Link href={`/manutencao/${i.id}`} className={cx("card block p-3 hover:ring-slate-400", i.status === "resolvido" && "opacity-70")}>
              <div className="flex flex-wrap items-center gap-2">
                <PriorityBadge p={i.priority} />
                <StatusBadge s={i.status} />
                {i.block_reservation_id && <span className="text-xs text-slate-500">🔒 com bloqueio</span>}
              </div>
              <div className="mt-1 font-medium">{i.title}</div>
              <div className="text-sm text-slate-600">
                {unitLabel(units, properties, i.unit_id)} · aberto em {formatDate(i.opened_on)}
                {i.cost != null ? ` · R$ ${Number(i.cost).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : ""}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
