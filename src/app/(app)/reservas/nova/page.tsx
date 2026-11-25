import Link from "next/link";
import { isIsoDate } from "@/lib/dates";
import { loadProperties } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";
import { ReservationForm } from "../ReservationForm";

export const dynamic = "force-dynamic";

export default async function NewReservationPage({
  searchParams,
}: {
  searchParams: Promise<{ quarto?: string; inicio?: string; fim?: string }>;
}) {
  const { supabase } = await requireUser();
  const sp = await searchParams;
  const { properties, units } = await loadProperties(supabase, { onlyActive: true });
  return (
    <div className="mx-auto max-w-xl">
      <Link href="/reservas" className="text-sm text-slate-500 hover:underline">← Reservas</Link>
      <h1 className="mb-3 mt-1 text-xl font-semibold">Nova reserva manual</h1>
      <div className="card">
        <ReservationForm
          properties={properties}
          units={units}
          defaults={{
            unit_id: sp.quarto,
            check_in: isIsoDate(sp.inicio) ? sp.inicio : undefined,
            check_out: isIsoDate(sp.fim) ? sp.fim : undefined,
          }}
        />
      </div>
    </div>
  );
}
