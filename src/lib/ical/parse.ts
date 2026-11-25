// Parser iCal mínimo: unfold de linhas, VEVENT, UID, DTSTART, DTEND,
// SUMMARY, DESCRIPTION. Aceita datas com e sem horário e converte
// horários para a data em America/Sao_Paulo.

import { TZ, addDays, dateInZone, isValidTimeZone, zonedTimeToUtc } from "../dates";

export interface IcalEvent {
  uid: string;
  /** Data de início (YYYY-MM-DD) em America/Sao_Paulo */
  start: string;
  /** Data de fim exclusiva (YYYY-MM-DD), sempre > start */
  end: string;
  summary: string;
  description: string;
}

export interface IcalLine {
  name: string;
  params: Record<string, string>;
  value: string;
}

export class IcalParseError extends Error {}

/** Junta linhas dobradas (RFC 5545 §3.1): CRLF seguido de espaço ou tab. */
export function unfold(text: string): string[] {
  return text
    .replace(/^﻿/, "")
    .replace(/\r\n|\r/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n")
    .filter((l) => l.trim() !== "");
}

/** Separa "NOME;PARAM=V:valor". O ":" dentro de aspas não conta. */
export function parseLine(line: string): IcalLine | null {
  let inQuotes = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === ":" && !inQuotes) {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [rawName, ...rawParams] = head.split(";");
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf("=");
    if (eq < 0) continue;
    params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: rawName.toUpperCase(), params, value };
}

export function unescapeText(v: string): string {
  return v.replace(/\\([\;,nN])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c));
}

/**
 * Converte DTSTART/DTEND em data (YYYY-MM-DD) no fuso de São Paulo.
 * - 20261201 ou VALUE=DATE  -> a própria data
 * - 20261201T150000Z        -> instante UTC convertido para SP
 * - TZID=...:20261201T150000 -> horário no fuso informado, convertido para SP
 * - 20261201T150000 (flutuante) -> assume horário de SP
 */
export function parseIcalDate(value: string, params: Record<string, string> = {}): string {
  const v = value.trim();
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/i.exec(v);
  if (!m) throw new IcalParseError(`Data inválida: "${value}"`);
  const [, y, mo, d, h, mi, s, z] = m;
  const date = `${y}-${mo}-${d}`;
  if (h === undefined || params.VALUE?.toUpperCase() === "DATE") return date;

  const nums = [Number(y), Number(mo), Number(d), Number(h), Number(mi), Number(s ?? 0)] as const;
  if (z) return dateInZone(new Date(Date.UTC(nums[0], nums[1] - 1, nums[2], nums[3], nums[4], nums[5])), TZ);

  const tzid = params.TZID;
  if (tzid && tzid !== TZ && isValidTimeZone(tzid)) {
    return dateInZone(zonedTimeToUtc(...nums, tzid), TZ);
  }
  // Flutuante, TZID = São Paulo ou TZID desconhecido: usa a data como está
  return date;
}

export interface ParseResult {
  events: IcalEvent[];
  /** Eventos ignorados (sem UID ou com data inválida) */
  skipped: { uid: string | null; reason: string }[];
}

export function parseIcal(text: string): ParseResult {
  const lines = unfold(text);
  if (!lines.some((l) => l.trim().toUpperCase() === "BEGIN:VCALENDAR")) {
    throw new IcalParseError("Resposta não é um calendário iCal (sem BEGIN:VCALENDAR)");
  }

  const events: IcalEvent[] = [];
  const skipped: ParseResult["skipped"] = [];
  let current: Map<string, IcalLine> | null = null;
  let depth = 0; // componentes aninhados dentro do VEVENT (ex.: VALARM)

  for (const raw of lines) {
    const line = parseLine(raw.trim());
    if (!line) continue;
    const val = line.value.trim().toUpperCase();

    if (line.name === "BEGIN") {
      if (val === "VEVENT" && !current) {
        current = new Map();
        depth = 0;
      } else if (current) depth++;
      continue;
    }
    if (line.name === "END") {
      if (current && depth > 0) depth--;
      else if (current && val === "VEVENT") {
        finishEvent(current, events, skipped);
        current = null;
      }
      continue;
    }
    if (current && depth === 0 && !current.has(line.name)) current.set(line.name, line);
  }

  return { events, skipped };
}

function finishEvent(props: Map<string, IcalLine>, events: IcalEvent[], skipped: ParseResult["skipped"]) {
  const uid = props.get("UID")?.value.trim() || null;
  const status = props.get("STATUS")?.value.trim().toUpperCase();
  if (!uid) {
    skipped.push({ uid: null, reason: "Evento sem UID" });
    return;
  }
  if (status === "CANCELLED") {
    // Evento cancelado no próprio feed: tratamos como ausente.
    skipped.push({ uid, reason: "STATUS:CANCELLED" });
    return;
  }
  const dtstart = props.get("DTSTART");
  if (!dtstart) {
    skipped.push({ uid, reason: "Evento sem DTSTART" });
    return;
  }
  try {
    const start = parseIcalDate(dtstart.value, dtstart.params);
    const dtend = props.get("DTEND");
    let end = dtend ? parseIcalDate(dtend.value, dtend.params) : addDays(start, 1);
    if (end <= start) end = addDays(start, 1);
    events.push({
      uid,
      start,
      end,
      summary: unescapeText(props.get("SUMMARY")?.value ?? "").trim(),
      description: unescapeText(props.get("DESCRIPTION")?.value ?? "").trim(),
    });
  } catch (e) {
    skipped.push({ uid, reason: e instanceof Error ? e.message : String(e) });
  }
}
