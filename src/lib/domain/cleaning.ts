// Regras puras da limpeza: checklist, criação a partir do check-out,
// prioridade do dia, visão pública da equipe e mensagem de WhatsApp.

import { addDays, formatShort, weekday } from "../dates";
import type { ChecklistItem, Cleaning, CleaningItem, Property, Reservation, Unit } from "../types";
import { visibleStays } from "./rules";

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

/** Checklist do quarto = modelo da propriedade + extras do quarto, em ordem. */
export function checklistFor(unit: Pick<Unit, "id" | "property_id">, items: ChecklistItem[]): string[] {
  const byOrder = (a: ChecklistItem, b: ChecklistItem) => a.sort_order - b.sort_order || a.label.localeCompare(b.label);
  const base = items.filter((i) => i.property_id === unit.property_id).sort(byOrder);
  const extra = items.filter((i) => i.unit_id === unit.id).sort(byOrder);
  return [...base, ...extra].map((i) => i.label);
}

/**
 * Limpeza criada a partir de um check-out realizado. Retorna null se o
 * check-out ainda não foi feito. Os itens são uma CÓPIA dos rótulos atuais.
 */
export function buildCleaningFromCheckout(
  r: Pick<Reservation, "id" | "unit_id" | "check_out" | "checked_out_at" | "kind">,
  checklist: string[],
): { cleaning: Pick<Cleaning, "reservation_id" | "unit_id" | "date">; items: Pick<CleaningItem, "label" | "sort_order">[] } | null {
  if (r.kind !== "reserva" || !r.checked_out_at) return null;
  return {
    cleaning: { reservation_id: r.id, unit_id: r.unit_id, date: r.check_out },
    items: checklist.map((label, i) => ({ label, sort_order: i + 1 })),
  };
}

// ---------------------------------------------------------------------------
// Prioridade do dia
// ---------------------------------------------------------------------------

export type CleaningPriority = "urgente" | "checkin_amanha" | "saida_hoje" | "pendente";

export const PRIORITY_ORDER: CleaningPriority[] = ["urgente", "checkin_amanha", "saida_hoje", "pendente"];

export const PRIORITY_LABEL: Record<CleaningPriority, string> = {
  urgente: "Urgente · virada",
  checkin_amanha: "Check-in amanhã",
  saida_hoje: "Saída do dia",
  pendente: "Pendente de dias anteriores",
};

type ListStay = Pick<
  Reservation,
  | "id" | "unit_id" | "source" | "kind" | "status" | "check_in" | "check_out"
  | "checked_in_at" | "checked_out_at" | "cleaning_done_at" | "check_in_time"
>;

export interface CleaningEntry<R extends ListStay = ListStay> {
  reservation: R;
  unit_id: string;
  priority: CleaningPriority;
  /** Limpeza já criada (após o check-out), se houver */
  cleaning?: Cleaning;
  /** Próxima reserva que entra no quarto a partir do dia */
  nextArrival?: R;
  done: boolean;
}

/**
 * Lista de limpeza do dia, ordenada por prioridade:
 * 1. urgente (sai e entra no mesmo dia), 2. check-in amanhã,
 * 3. demais saídas do dia, 4. pendentes de dias anteriores.
 * Concluídas vão para o fim. Empate: ordem dos quartos.
 *
 * `stays`: reservas/bloqueios ativos ao redor do dia (para saídas e chegadas).
 * `pending`: reservas com saída antes do dia e limpeza não finalizada.
 */
export function buildCleaningList<R extends ListStay>(args: {
  day: string;
  stays: R[];
  pending: R[];
  cleanings: Cleaning[];
  unitOrder: string[];
}): CleaningEntry<R>[] {
  const { day, stays, pending, cleanings, unitOrder } = args;
  const res = visibleStays(stays).filter((r) => r.kind === "reserva");
  const tomorrow = addDays(day, 1);
  const cleaningByRes = new Map(cleanings.map((c) => [c.reservation_id, c]));
  const nextArrival = (unitId: string) =>
    res
      .filter((r) => r.unit_id === unitId && r.check_in >= day)
      .sort((a, b) => a.check_in.localeCompare(b.check_in))[0];

  const entries: CleaningEntry<R>[] = [];
  const seen = new Set<string>();
  for (const r of res.filter((x) => x.check_out === day)) {
    const next = nextArrival(r.unit_id);
    const priority: CleaningPriority =
      next?.check_in === day ? "urgente" : next?.check_in === tomorrow ? "checkin_amanha" : "saida_hoje";
    entries.push({ reservation: r, unit_id: r.unit_id, priority, cleaning: cleaningByRes.get(r.id), nextArrival: next, done: Boolean(r.cleaning_done_at) });
    seen.add(r.id);
  }
  for (const r of pending) {
    if (seen.has(r.id) || r.check_out >= day || r.cleaning_done_at || r.status !== "ativa") continue;
    entries.push({ reservation: r, unit_id: r.unit_id, priority: "pendente", cleaning: cleaningByRes.get(r.id), nextArrival: nextArrival(r.unit_id), done: false });
    seen.add(r.id);
  }

  const pos = new Map(unitOrder.map((id, i) => [id, i]));
  return entries.sort(
    (a, b) =>
      Number(a.done) - Number(b.done) ||
      PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority) ||
      (pos.get(a.unit_id) ?? 999) - (pos.get(b.unit_id) ?? 999) ||
      a.reservation.check_out.localeCompare(b.reservation.check_out),
  );
}

/** "15:00:00" -> "15:00" */
export function hhmm(t: string | null | undefined): string | null {
  return t ? t.slice(0, 5) : null;
}

export function effectiveCheckinTime(r: { check_in_time: string | null }, property: { checkin_time: string }): string {
  return hhmm(r.check_in_time) ?? hhmm(property.checkin_time) ?? "15:00";
}

// ---------------------------------------------------------------------------
// Visão pública da equipe (LGPD: só campos permitidos)
// ---------------------------------------------------------------------------

export interface TeamRoom {
  room: string;
  priority: CleaningPriority;
  priorityLabel: string;
  status: "Aguardando check-out" | "Em limpeza" | "Concluída";
  /** Data da saída (útil para pendentes) */
  checkOut: string;
  nextCheckIn: { date: string; time: string } | null;
  items: { label: string; done: boolean }[];
  /** true = checklist ainda é prévia (check-out não realizado) */
  preview: boolean;
}

export interface TeamView {
  date: string;
  property: string;
  rooms: TeamRoom[];
}

/**
 * Monta a visão pública. Copia SOMENTE: nome da propriedade e do quarto,
 * prioridade, situação, datas, horário do próximo check-in e itens do checklist.
 * Nunca inclui nome, telefone, nº de hóspedes, observações ou dados da reserva.
 */
export function buildTeamView(args: {
  day: string;
  property: Pick<Property, "id" | "name" | "checkin_time">;
  units: Pick<Unit, "id" | "property_id" | "name">[];
  entries: CleaningEntry[];
  cleaningItems: CleaningItem[];
  checklist: ChecklistItem[];
}): TeamView {
  const { day, property, units, entries, cleaningItems, checklist } = args;
  const unitById = new Map(units.filter((u) => u.property_id === property.id).map((u) => [u.id, u]));
  const rooms: TeamRoom[] = [];
  for (const e of entries) {
    const unit = unitById.get(e.unit_id);
    if (!unit) continue;
    const snapshot = e.cleaning
      ? cleaningItems
          .filter((i) => i.cleaning_id === e.cleaning!.id)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((i) => ({ label: i.label, done: Boolean(i.done_at) }))
      : null;
    rooms.push({
      room: unit.name,
      priority: e.priority,
      priorityLabel: PRIORITY_LABEL[e.priority],
      status: e.done ? "Concluída" : e.reservation.checked_out_at ? "Em limpeza" : "Aguardando check-out",
      checkOut: e.reservation.check_out,
      nextCheckIn: e.nextArrival ? { date: e.nextArrival.check_in, time: effectiveCheckinTime(e.nextArrival, property) } : null,
      items: snapshot ?? checklistFor(unit, checklist).map((label) => ({ label, done: false })),
      preview: !snapshot,
    });
  }
  return { date: day, property: property.name, rooms };
}

/** Texto pronto para colar no WhatsApp. */
export function whatsappMessage(view: TeamView, url: string): string {
  const head = `🧹 *Limpeza ${view.property}* · ${weekday(view.date)} ${formatShort(view.date)}`;
  if (!view.rooms.length) return `${head}\nNenhuma limpeza prevista.\n\nDetalhes: ${url}`;
  const lines = view.rooms.map((r, i) => {
    const next = r.nextCheckIn
      ? r.nextCheckIn.date === view.date
        ? ` · check-in hoje ${r.nextCheckIn.time}`
        : ` · próximo check-in ${formatShort(r.nextCheckIn.date)} ${r.nextCheckIn.time}`
      : "";
    const flag = r.priority === "urgente" ? "🔴 " : r.priority === "checkin_amanha" ? "🟠 " : "";
    const done = r.status === "Concluída" ? " ✅" : "";
    return `${i + 1}. ${flag}${r.room} · ${r.priorityLabel}${next}${done}`;
  });
  return `${head}\n\n${lines.join("\n")}\n\nChecklist completo: ${url}`;
}
