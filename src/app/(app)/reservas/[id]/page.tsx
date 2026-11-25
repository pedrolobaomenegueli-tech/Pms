import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { StageBadge, StageButtons, StageTimeline } from "@/components/StageButtons";
import { SubmitButton } from "@/components/SubmitButton";
import { diffDays, formatDate, formatDateTimeSP } from "@/lib/dates";
import { loadProperties, unitLabel } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";
import { SOURCE_LABEL, type Reservation } from "@/lib/types";
import { cancelReservation, reactivateReservation } from "../actions";
import { ReservationForm } from "../ReservationForm";

export const dynamic = "force-dynamic";

export default async function ReservationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ criada?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await requireUser();
  const { data } = await supabase.from("reservations").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const r = data as Reservation;
  const { properties, units } = await loadProperties(supabase);
  const nights = diffDays(r.check_in, r.check_out);

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div>
        <Link href="/reservas" className="text-sm text-slate-500 hover:underline">← Reservas</Link>
        <h1 className="mt-1 text-xl font-semibold">
          {r.kind === "bloqueio" ? "Bloqueio" : r.guest_name || "Reserva"} · {SOURCE_LABEL[r.source]}
        </h1>
        <p className="text-sm text-slate-600">
          {unitLabel(units, properties, r.unit_id)} · {formatDate(r.check_in)} → {formatDate(r.check_out)} ({nights}{" "}
          {nights === 1 ? "noite" : "noites"})
        </p>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {r.status === "cancelada" && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-800">Cancelada em {formatDateTimeSP(r.cancelled_at)}</span>
          )}
          {r.kind === "reserva" && r.status === "ativa" && <StageBadge r={r} />}
        </div>
        {sp.criada && <p className="mt-2 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">Reserva criada.</p>}
      </div>

      {r.kind === "reserva" && r.status === "ativa" && (
        <div className="card space-y-3">
          <h2 className="font-semibold">Andamento da estadia</h2>
          <StageTimeline r={r} />
          <StageButtons r={r} />
        </div>
      )}

      <div className="card">
        <ReservationForm properties={properties} units={units} reservation={r} />
      </div>


      {r.source === "manual" && r.status === "ativa" && (
        <form action={cancelReservation} className="card">
          <input type="hidden" name="id" value={r.id} />
          <SubmitButton className="btn-danger" confirm="Cancelar esta reserva?" pendingText="Cancelando…">
            Cancelar reserva
          </SubmitButton>
        </form>
      )}
      {r.source === "manual" && r.status === "cancelada" && (
        <div className="card">
          <ActionForm action={reactivateReservation}>
            <input type="hidden" name="id" value={r.id} />
            <SubmitButton className="btn-secondary">Reativar</SubmitButton>
          </ActionForm>
        </div>
      )}

    </div>
  );
}
