// Regras de negócio puras: eco, conflitos, exclusão por canal e estado do quarto.

import { addDays } from "../dates";
import type { Channel, Kind, Reservation, Source } from "../types";

export type Stay = Pick<
  Reservation,
  "id" | "unit_id" | "source" | "kind" | "check_in" | "check_out" | "status"
>;

export function overlaps(a: { check_in: string; check_out: string }, b: { check_in: string; check_out: string }) {
  // check_out é exclusivo: sair dia 10 e outro entrar dia 10 não sobrepõe
  return a.check_in < b.check_out && b.check_in < a.check_out;
}

/**
 * "Força" de um evento para decidir quem é eco de quem quando as datas
 * são idênticas. Bloqueio importado < evento do Booking (que não
 * diferencia reserva de bloqueio) < reserva do Airbnb / manual / outro.
 */
function strength(s: { source: Source; kind: Kind }): number {
  if (s.kind === "bloqueio") return 1;
  if (s.source === "booking") return 2;
  return 3;
}

/**
 * Eco = evento importado que só repete as datas (check-in e check-out
 * idênticos) de outro evento ativo, mais forte, de outra origem, no mesmo quarto.
 * Ex.: reserva do Booking exportada para o Airbnb volta como "Not available".
 * Eventos manuais nunca são eco.
 */
export function findEchoIds(items: Stay[]): Set<string> {
  const active = items.filter((r) => r.status === "ativa");
  const byKey = new Map<string, Stay[]>();
  for (const r of active) {
    const key = `${r.unit_id}|${r.check_in}|${r.check_out}`;
    const list = byKey.get(key);
    if (list) list.push(r);
    else byKey.set(key, [r]);
  }
  const echoes = new Set<string>();
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    for (const r of group) {
      if (r.source === "manual") continue;
      const st = strength(r);
      if (group.some((o) => o.id !== r.id && o.source !== r.source && strength(o) > st)) echoes.add(r.id);
    }
  }
  return echoes;
}

/** Ativos e não-eco: o que aparece no calendário e conta para conflitos. */
export function visibleStays<T extends Stay>(items: T[]): T[] {
  const echoes = findEchoIds(items);
  return items.filter((r) => r.status === "ativa" && !echoes.has(r.id));
}

export interface Conflict<T extends Stay = Stay> {
  unit_id: string;
  a: T;
  b: T;
}

/**
 * Overbooking: duas RESERVAS ativas, não-eco, que se sobrepõem no mesmo quarto.
 * Bloqueios não geram conflito (bloqueio só indica indisponibilidade).
 */
export function findConflicts<T extends Stay>(items: T[]): Conflict<T>[] {
  const res = visibleStays(items).filter((r) => r.kind === "reserva");
  const byUnit = new Map<string, T[]>();
  for (const r of res) {
    const l = byUnit.get(r.unit_id);
    if (l) l.push(r);
    else byUnit.set(r.unit_id, [r]);
  }
  const out: Conflict<T>[] = [];
  for (const [unit_id, list] of byUnit) {
    list.sort((x, y) => x.check_in.localeCompare(y.check_in));
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length && list[j].check_in < list[i].check_out; j++) {
        if (overlaps(list[i], list[j])) out.push({ unit_id, a: list[i], b: list[j] });
      }
    }
  }
  return out;
}

/** Sobreposições que impedem salvar uma reserva/bloqueio manual. */
export function findOverlapsFor<T extends Stay>(
  candidate: { id?: string; unit_id: string; check_in: string; check_out: string },
  items: T[],
): T[] {
  return visibleStays(items).filter(
    (r) => r.id !== candidate.id && r.unit_id === candidate.unit_id && overlaps(r, candidate),
  );
}

/**
 * Eventos exportados para um canal: ativos, não-eco, que terminam a partir
 * de (hoje - 30 dias), EXCETO os originados no próprio canal de destino.
 */
export function eventsForExport<T extends Stay>(items: T[], target: Exclude<Channel, "outro">, today: string): T[] {
  const from = addDays(today, -30);
  return visibleStays(items).filter((r) => r.source !== target && r.check_out > from);
}

// ---------------------------------------------------------------------------
// Estado do quarto (tela inicial)
// ---------------------------------------------------------------------------

export type RoomState =
  | "ocupado"
  | "checkout"
  | "em_limpeza"
  | "limpeza_pendente"
  | "checkin"
  | "bloqueado"
  | "livre";

export const ROOM_STATE_LABEL: Record<RoomState, string> = {
  ocupado: "Ocupado",
  checkout: "Check-out hoje",
  em_limpeza: "Em limpeza",
  limpeza_pendente: "Limpeza pendente",
  checkin: "Check-in hoje",
  bloqueado: "Bloqueado",
  livre: "Livre",
};

export type CleaningStay = Stay & Pick<Reservation, "cleaning_started_at" | "cleaning_done_at">;

export interface RoomStatus<T extends CleaningStay> {
  state: RoomState;
  /** Hóspede atual (ocupado) */
  current?: T;
  /** Reserva que sai hoje, ou saída anterior ainda sem limpeza */
  departure?: T;
  /** Reserva que entra hoje */
  arrival?: T;
  /** Próxima chegada depois de hoje */
  next?: T;
  block?: T;
  /** Há check-in hoje e o quarto ainda não está limpo */
  urgent: boolean;
}

/** Saídas mais antigas que isso, sem limpeza marcada, são ignoradas. */
export const PENDING_CLEANING_DAYS = 7;

export function roomStatus<T extends CleaningStay>(items: T[], today: string): RoomStatus<T> {
  const vis = visibleStays(items);
  const res = vis.filter((r) => r.kind === "reserva");
  const current = res.find((r) => r.check_in < today && today < r.check_out);
  const arrival = res.find((r) => r.check_in === today);
  const departureToday = res.find((r) => r.check_out === today);
  const block = vis.find((r) => r.kind === "bloqueio" && r.check_in <= today && today < r.check_out);
  const next = res
    .filter((r) => r.check_in > today)
    .sort((a, b) => a.check_in.localeCompare(b.check_in))[0];

  const limit = addDays(today, -PENDING_CLEANING_DAYS);
  const lastPast = res
    .filter((r) => r.check_out < today && r.check_out >= limit)
    .sort((a, b) => b.check_out.localeCompare(a.check_out))[0];

  const base = { current, arrival, next, block, urgent: false };

  if (current) return { ...base, state: "ocupado" };

  // Se alguém saiu hoje, só essa saída importa; senão, a última saída recente
  const candidate = departureToday ?? lastPast;
  const dirty = candidate && !candidate.cleaning_done_at ? candidate : undefined;
  if (dirty) {
    const state: RoomState = dirty.cleaning_started_at
      ? "em_limpeza"
      : dirty === departureToday
        ? "checkout"
        : "limpeza_pendente";
    return { ...base, state, departure: dirty, urgent: Boolean(arrival) };
  }
  if (arrival) return { ...base, state: "checkin", departure: departureToday };
  if (block) return { ...base, state: "bloqueado" };
  return { ...base, state: "livre" };
}
