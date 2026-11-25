// Geração do iCal de exportação (eventos de dia inteiro).

export interface ExportEvent {
  id: string;
  check_in: string;
  check_out: string;
}

function icalDate(date: string): string {
  return date.replaceAll("-", "");
}

function icalStamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Dobra linhas com mais de 75 octetos (RFC 5545 §3.1). */
export function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let curLen = 0;
  for (const ch of line) {
    const len = new TextEncoder().encode(ch).length;
    const limit = out.length === 0 ? 75 : 74; // continuação começa com espaço
    if (curLen + len > limit) {
      out.push(cur);
      cur = "";
      curLen = 0;
    }
    cur += ch;
    curLen += len;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function buildIcal(
  events: ExportEvent[],
  opts: { calendarName: string; now?: Date; summary?: string },
): string {
  const now = opts.now ?? new Date();
  const stamp = icalStamp(now);
  const summary = opts.summary ?? "Reservado";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PMS Temporada//Exportacao iCal//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${opts.calendarName.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, " ")}`,
  ];
  const sorted = [...events].sort((a, b) => a.check_in.localeCompare(b.check_in) || a.id.localeCompare(b.id));
  for (const e of sorted) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@pms-temporada`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icalDate(e.check_in)}`,
      `DTEND;VALUE=DATE:${icalDate(e.check_out)}`,
      `SUMMARY:${summary}`,
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
