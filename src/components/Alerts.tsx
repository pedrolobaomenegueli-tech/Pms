import Link from "next/link";
import { formatShort } from "@/lib/dates";
import type { Conflict } from "@/lib/domain/rules";
import { MAINT_PRIORITY_LABEL, SOURCE_LABEL, type MaintenanceIssue, type Reservation } from "@/lib/types";
import type { CheckinRisk } from "@/lib/domain/maintenance";

export function Alerts({
  conflicts,
  label,
  urgentIssues = [],
  checkinRisks = [],
}: {
  conflicts: Conflict<Reservation>[];
  label: (unitId: string) => string;
  urgentIssues?: MaintenanceIssue[];
  checkinRisks?: CheckinRisk<MaintenanceIssue, Reservation>[];
}) {
  if (!conflicts.length && !urgentIssues.length && !checkinRisks.length) return null;
  return (
    <div className="mb-4 space-y-3">
      {urgentIssues.length > 0 && (
        <section className="rounded-xl bg-red-600 p-4 text-white shadow">
          <h2 className="text-base font-bold">🔧 {urgentIssues.length} manutenção(ões) urgente(s) aberta(s)</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {urgentIssues.map((i) => (
              <li key={i.id}>
                <Link href={`/manutencao/${i.id}`} className="underline">
                  {label(i.unit_id)}: {i.title}
                </Link>
                {i.status === "em_andamento" && " (em andamento)"}
              </li>
            ))}
          </ul>
        </section>
      )}
      {checkinRisks.length > 0 && (
        <section className="rounded-xl bg-orange-100 p-4 text-orange-950 ring-1 ring-orange-300">
          <h2 className="font-semibold">Check-in próximo em quarto com manutenção pendente</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {checkinRisks.map(({ issue, reservation }) => (
              <li key={reservation.id}>
                <strong>{label(reservation.unit_id)}</strong>: check-in {formatShort(reservation.check_in)} ·{" "}
                <Link href={`/manutencao/${issue.id}`} className="underline">
                  {issue.title} ({MAINT_PRIORITY_LABEL[issue.priority].toLowerCase()})
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {conflicts.length > 0 && (
        <section className="rounded-xl bg-red-600 p-4 text-white shadow">
          <h2 className="text-base font-bold">⚠️ {conflicts.length} possível(is) overbooking</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {conflicts.map((c) => (
              <li key={`${c.a.id}-${c.b.id}`} className="rounded-lg bg-white/10 p-2">
                <strong>{label(c.unit_id)}</strong>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {[c.a, c.b].map((r) => (
                    <Link key={r.id} href={`/reservas/${r.id}`} className="underline">
                      {SOURCE_LABEL[r.source]} {formatShort(r.check_in)}→{formatShort(r.check_out)}
                      {r.guest_name ? ` (${r.guest_name})` : ""}
                    </Link>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
