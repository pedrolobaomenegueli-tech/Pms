// Regras puras de manutenção: ordenação, bloqueio e alertas.

import { addDays } from "../dates";
import type { MaintenanceIssue, MaintenancePriority, MaintenanceStatus, Reservation } from "../types";
import { visibleStays, type Stay } from "./rules";

export const MAINT_PRIORITY_ORDER: MaintenancePriority[] = ["urgente", "alta", "media", "baixa"];
const STATUS_ORDER: MaintenanceStatus[] = ["aberto", "em_andamento", "resolvido"];

export function isOpen(i: Pick<MaintenanceIssue, "status">): boolean {
  return i.status !== "resolvido";
}

/** Abertas primeiro (por prioridade), depois resolvidas (mais recentes primeiro). */
export function sortIssues<T extends Pick<MaintenanceIssue, "status" | "priority" | "opened_on" | "resolved_at">>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    const oa = isOpen(a) ? 0 : 1;
    const ob = isOpen(b) ? 0 : 1;
    if (oa !== ob) return oa - ob;
    if (oa === 0) {
      return (
        MAINT_PRIORITY_ORDER.indexOf(a.priority) - MAINT_PRIORITY_ORDER.indexOf(b.priority) ||
        STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
        a.opened_on.localeCompare(b.opened_on)
      );
    }
    return (b.resolved_at ?? "").localeCompare(a.resolved_at ?? "");
  });
}

/** Bloqueio manual criado a partir de um problema de manutenção. */
export function buildMaintenanceBlock(
  issue: Pick<MaintenanceIssue, "unit_id" | "title">,
  period: { check_in: string; check_out: string },
): Pick<Reservation, "unit_id" | "source" | "kind" | "status" | "check_in" | "check_out" | "notes"> {
  return {
    unit_id: issue.unit_id,
    source: "manual",
    kind: "bloqueio",
    status: "ativa",
    check_in: period.check_in,
    check_out: period.check_out,
    notes: `Manutenção: ${issue.title}`,
  };
}

/** Janela do alerta de check-in: hoje até hoje + 3 dias. */
export const CHECKIN_ALERT_DAYS = 3;

export interface CheckinRisk<I, R> {
  issue: I;
  reservation: R;
}

/**
 * Check-ins entre hoje e hoje+3 em quartos com manutenção ALTA ou URGENTE aberta.
 */
export function checkinRisks<
  I extends Pick<MaintenanceIssue, "unit_id" | "status" | "priority">,
  R extends Stay,
>(issues: I[], stays: R[], today: string): CheckinRisk<I, R>[] {
  const until = addDays(today, CHECKIN_ALERT_DAYS);
  const serious = issues.filter((i) => isOpen(i) && (i.priority === "alta" || i.priority === "urgente"));
  const arrivals = visibleStays(stays).filter((r) => r.kind === "reserva" && r.check_in >= today && r.check_in <= until);
  const out: CheckinRisk<I, R>[] = [];
  for (const r of arrivals) {
    const issue = serious
      .filter((i) => i.unit_id === r.unit_id)
      .sort((a, b) => MAINT_PRIORITY_ORDER.indexOf(a.priority) - MAINT_PRIORITY_ORDER.indexOf(b.priority))[0];
    if (issue) out.push({ issue, reservation: r });
  }
  return out.sort((a, b) => a.reservation.check_in.localeCompare(b.reservation.check_in));
}
