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
// Fluxo da estadia (por reserva)
// ---------------------------------------------------------------------------

export type Stage = "aguardando_checkin" | "hospedado" | "em_limpeza" | "finalizado";

export const STAGE_LABEL: Record<Stage, string> = {
  aguardando_checkin: "Aguardando check-in",
  hospedado: "Hospedado",
  em_limpeza: "Em limpeza",
  finalizado: "Finalizado",
};

/** Próxima ação do fluxo para cada etapa. */
export const NEXT_ACTION: Record<Stage, { step: StageStep; label: string } | null> = {
  aguardando_checkin: { step: "checkin", label: "Realizar check-in" },
  hospedado: { step: "checkout", label: "Realizar check-out" },
  em_limpeza: { step: "finalizar", label: "Finalizar limpeza" },
  finalizado: null,
};

export type StageStep = "checkin" | "checkout" | "finalizar" | "desfazer";

export type StageFields = Pick<Reservation, "checked_in_at" | "checked_out_at" | "cleaning_done_at">;

export function stageOf(r: StageFields): Stage {
  if (r.cleaning_done_at) return "finalizado";
  if (r.checked_out_at) return "em_limpeza";
  if (r.checked_in_at) return "hospedado";
  return "aguardando_checkin";
}

/**
 * Campos a gravar para avançar/voltar uma etapa. Pular etapas preenche as
 * anteriores (ex.: check-out sem check-in registrado marca os dois).
 */
export function applyStep(r: StageFields, step: StageStep, nowIso: string): StageFields {
  const cur = { checked_in_at: r.checked_in_at, checked_out_at: r.checked_out_at, cleaning_done_at: r.cleaning_done_at };
  switch (step) {
    case "checkin":
      return { ...cur, checked_in_at: cur.checked_in_at ?? nowIso };
    case "checkout":
      return { ...cur, checked_in_at: cur.checked_in_at ?? nowIso, checked_out_at: cur.checked_out_at ?? nowIso };
    case "finalizar":
      return {
        checked_in_at: cur.checked_in_at ?? nowIso,
        checked_out_at: cur.checked_out_at ?? nowIso,
        cleaning_done_at: cur.cleaning_done_at ?? nowIso,
      };
    case "desfazer": {
      const stage = stageOf(cur);
      if (stage === "finalizado") return { ...cur, cleaning_done_at: null };
      if (stage === "em_limpeza") return { ...cur, checked_out_at: null };
      return { ...cur, checked_in_at: null };
    }
  }
}

// ---------------------------------------------------------------------------
// Estado do quarto (tela inicial)
// ---------------------------------------------------------------------------

export type RoomState = "hospedado" | "em_limpeza" | "aguardando_checkin" | "bloqueado" | "livre";

export const ROOM_STATE_LABEL: Record<RoomState, string> = {
  hospedado: "Hospedado",
  em_limpeza: "Em limpeza",
  aguardando_checkin: "Aguardando check-in",
  bloqueado: "Bloqueado",
  livre: "Livre",
};

export type FlowStay = Stay & StageFields;

export interface RoomStatus<T extends FlowStay> {
  state: RoomState;
  /** Reserva que define o estado (hospedado, em limpeza ou aguardando) */
  stay?: T;
  /** Chegada de hoje ainda sem check-in (quando não é a própria "stay") */
  arrival?: T;
  /** Próxima chegada depois de hoje */
  next?: T;
  block?: T;
  /** Avisos: "Sai hoje", "Saída atrasada", "Check-in atrasado" */
  notes: string[];
  /** Há chegada hoje e o quarto ainda não está liberado */
  urgent: boolean;
}

/**
 * Reservas que terminaram há mais que isso e ficaram com o fluxo aberto
 * (esquecidas) são ignoradas na tela inicial.
 */
export const OPEN_FLOW_DAYS = 7;

export function roomStatus<T extends FlowStay>(items: T[], today: string): RoomStatus<T> {
  const vis = visibleStays(items);
  const limit = addDays(today, -OPEN_FLOW_DAYS);
  const res = vis
    .filter((r) => r.kind === "reserva" && r.check_out >= limit && r.check_in <= today)
    .sort((a, b) => a.check_in.localeCompare(b.check_in));
  const block = vis.find((r) => r.kind === "bloqueio" && r.check_in <= today && today < r.check_out);
  const next = vis
    .filter((r) => r.kind === "reserva" && r.check_in > today)
    .sort((a, b) => a.check_in.localeCompare(b.check_in))[0];
  const arrivalToday = res.find((r) => r.check_in === today && stageOf(r) === "aguardando_checkin");

  const hosted = res.find((r) => stageOf(r) === "hospedado");
  const cleaning = res.find((r) => stageOf(r) === "em_limpeza");
  const waiting = res.find((r) => stageOf(r) === "aguardando_checkin" && today < r.check_out);

  const base = { next, block };
  if (hosted) {
    const notes = hosted.check_out === today ? ["Sai hoje"] : hosted.check_out < today ? ["Saída atrasada"] : [];
    const arrival = arrivalToday && arrivalToday.id !== hosted.id ? arrivalToday : undefined;
    return { ...base, state: "hospedado", stay: hosted, arrival, notes, urgent: Boolean(arrival) };
  }
  if (cleaning) {
    return { ...base, state: "em_limpeza", stay: cleaning, arrival: arrivalToday, notes: [], urgent: Boolean(arrivalToday) };
  }
  if (waiting) {
    return { ...base, state: "aguardando_checkin", stay: waiting, notes: waiting.check_in < today ? ["Check-in atrasado"] : [], urgent: false };
  }
  if (block) return { ...base, state: "bloqueado", notes: [], urgent: false };
  return { ...base, state: "livre", notes: [], urgent: false };
}
