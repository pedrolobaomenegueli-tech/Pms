import type { Stage } from "./domain/rules";
import type { Source } from "./types";

export const SOURCE_BG: Record<Source, string> = {
  airbnb: "bg-airbnb",
  booking: "bg-booking",
  manual: "bg-manual",
  outro: "bg-outro",
};

/** Borda das barras do calendário: identifica o canal. */
export const SOURCE_BORDER: Record<Source, string> = {
  airbnb: "border-airbnb",
  booking: "border-booking",
  manual: "border-manual",
  outro: "border-outro",
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
  aguardando_checkin: "bg-sky-200 text-sky-950",
  hospedado: "bg-red-200 text-red-950",
  em_limpeza: "bg-slate-300 text-slate-800",
  finalizado: "bg-emerald-300 text-emerald-950",
};

/** Versão clara para cartões e etiquetas. */
export const STAGE_SOFT: Record<Stage, string> = {
  aguardando_checkin: "bg-sky-100 text-sky-900 ring-sky-300",
  hospedado: "bg-red-100 text-red-900 ring-red-300",
  em_limpeza: "bg-slate-200 text-slate-800 ring-slate-400",
  finalizado: "bg-emerald-100 text-emerald-900 ring-emerald-300",
};
