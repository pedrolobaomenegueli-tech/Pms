import type { Stage } from "./domain/rules";
import { SOURCE_LABEL, type Source } from "./types";

export const SOURCE_BG: Record<Source, string> = {
  airbnb: "bg-airbnb",
  booking: "bg-booking",
  manual: "bg-manual",
  outro: "bg-outro",
};

export const SOURCE_TEXT: Record<Source, string> = {
  airbnb: "text-airbnb",
  booking: "text-booking",
  manual: "text-manual",
  outro: "text-outro",
};

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export type ActionState = { error?: string; ok?: string } | undefined;

export function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

export function strOrNull(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}

/** Preenchimento por etapa (mesmas cores no calendário, início e etiquetas). */
export const STAGE_FILL: Record<Stage, string> = {
  aguardando_checkin: "bg-sky-400 text-sky-950",
  hospedado: "bg-red-500 text-white",
  em_limpeza: "bg-slate-500 text-white",
  finalizado: "bg-emerald-500 text-white",
};

/** Versão clara para cartões e etiquetas. */
export const STAGE_SOFT: Record<Stage, string> = {
  aguardando_checkin: "bg-sky-200 text-sky-950 ring-sky-400",
  hospedado: "bg-red-200 text-red-950 ring-red-500",
  em_limpeza: "bg-slate-300 text-slate-900 ring-slate-500",
  finalizado: "bg-emerald-200 text-emerald-950 ring-emerald-500",
};

/** "Airbnb · Maria" ou só "Airbnb" (o iCal não traz o nome do hóspede). */
export function stayLabel(r: { source: Source; guest_name: string | null }): string {
  return r.guest_name ? `${SOURCE_LABEL[r.source]} · ${r.guest_name}` : SOURCE_LABEL[r.source];
}
