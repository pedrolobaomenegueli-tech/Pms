import Link from "next/link";
import { UnitSelect } from "@/components/UnitSelect";
import { addDays, diffDays, formatDate, isIsoDate, todaySP } from "@/lib/dates";
import { loadProperties, unitLabel } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";
import { SOURCE_LABEL, type Reservation } from "@/lib/types";
import { cx, SOURCE_BG } from "@/lib/ui";

export const dynamic = "force-dynamic";

type SP = { quarto?: string; origem?: string; de?: string; ate?: string; status?: string; tipo?: string };

export default async function ReservationsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { supabase } = await requireUser();
  const sp = await searchParams;
  const today = todaySP();
  const de = isIsoDate(sp.de) ? sp.de : sp.de === "" ? "" : addDays(today, -7);
  const ate = isIsoDate(sp.ate) ? sp.ate : "";
  const status = sp.status ?? "ativa";
  const tipo = sp.tipo ?? "";

  let q = supabase.from("reservations").select("*").order("check_in").limit(500);
  if (sp.quarto) q = q.eq("unit_id", sp.quarto);
  if (sp.origem && ["manual", "airbnb", "booking", "outro"].includes(sp.origem)) q = q.eq("source", sp.origem);
  if (status === "ativa" || status === "cancelada") q = q.eq("status", status);
  if (tipo === "reserva" || tipo === "bloqueio") q = q.eq("kind", tipo);
  if (de) q = q.gt("check_out", de);
  if (ate) q = q.lte("check_in", ate);

  const [{ properties, units }, { data, error }] = await Promise.all([loadProperties(supabase), q]);
  const rows = (data ?? []) as Reservation[];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Reservas</h1>
        <Link href="/reservas/nova" className="btn-primary">+ Nova reserva</Link>
      </div>

      <form className="card mb-4 grid grid-cols-2 gap-2 sm:grid-cols-6">
        <div className="col-span-2">
          <label className="label">Quarto</label>
          <UnitSelect properties={properties} units={units} name="quarto" defaultValue={sp.quarto} emptyLabel="Todos" />
        </div>
        <div>
          <label className="label">Origem</label>
          <select name="origem" defaultValue={sp.origem ?? ""} className="input">
            <option value="">Todas</option>
            {Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tipo</label>
          <select name="tipo" defaultValue={tipo} className="input">
            <option value="">Todos</option>
            <option value="reserva">Reserva</option>
            <option value="bloqueio">Bloqueio</option>
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select name="status" defaultValue={status} className="input">
            <option value="ativa">Ativas</option>
            <option value="cancelada">Canceladas</option>
            <option value="todas">Todas</option>
          </select>
        </div>
        <div className="hidden sm:block" />
        <div>
          <label className="label">De</label>
          <input type="date" name="de" defaultValue={de} className="input" />
        </div>
        <div>
          <label className="label">Até</label>
          <input type="date" name="ate" defaultValue={ate} className="input" />
        </div>
        <div className="col-span-2 flex items-end gap-2 sm:col-span-4">
          <button className="btn-primary">Filtrar</button>
          <Link href="/reservas" className="btn-secondary">Limpar</Link>
        </div>
      </form>

      {error && <p className="text-sm text-red-700">{error.message}</p>}
      <p className="mb-2 text-sm text-slate-500">{rows.length} resultado(s){rows.length === 500 ? " (limite de 500, refine o filtro)" : ""}</p>

      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/reservas/${r.id}`} className={cx("card flex items-center gap-3 p-3 hover:ring-slate-400", r.status === "cancelada" && "opacity-60")}>
              <span className={cx("h-10 w-1.5 shrink-0 rounded-full", r.kind === "bloqueio" ? "bar-bloqueio" : SOURCE_BG[r.source])} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{r.kind === "bloqueio" ? "Bloqueio" : r.guest_name || "(sem nome)"}</span>
                  <span className="text-xs text-slate-500">{SOURCE_LABEL[r.source]}</span>
                  {r.status === "cancelada" && <span className="text-xs font-semibold text-red-700">CANCELADA</span>}
                </div>
                <div className="truncate text-sm text-slate-600">
                  {unitLabel(units, properties, r.unit_id)} · {formatDate(r.check_in)} → {formatDate(r.check_out)} ·{" "}
                  {diffDays(r.check_in, r.check_out)}n{r.guests ? ` · ${r.guests} hósp.` : ""}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
