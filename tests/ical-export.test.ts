import { describe, expect, it } from "vitest";
import { buildIcal, foldLine } from "@/lib/ical/export";
import { parseIcal } from "@/lib/ical/parse";

const now = new Date("2026-11-25T12:00:00Z");

describe("buildIcal", () => {
  const ics = buildIcal(
    [
      { id: "r2", check_in: "2026-12-10", check_out: "2026-12-12" },
      { id: "r1", check_in: "2026-12-01", check_out: "2026-12-05" },
    ],
    { calendarName: "Casa 1 - Quarto 2", now },
  );

  it("gera eventos de dia inteiro com DTEND exclusivo e SUMMARY genérico", () => {
    expect(ics).toContain("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n");
    expect(ics).toContain(
      [
        "BEGIN:VEVENT",
        "UID:r1@pms-temporada",
        "DTSTAMP:20261125T120000Z",
        "DTSTART;VALUE=DATE:20261201",
        "DTEND;VALUE=DATE:20261205",
        "SUMMARY:Reservado",
        "TRANSP:OPAQUE",
        "END:VEVENT",
      ].join("\r\n"),
    );
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("ordena por check-in", () => {
    expect(ics.indexOf("UID:r1")).toBeLessThan(ics.indexOf("UID:r2"));
  });

  it("usa CRLF em todas as linhas", () => {
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });

  it("é lido de volta pelo próprio parser", () => {
    expect(parseIcal(ics).events).toEqual([
      { uid: "r1@pms-temporada", start: "2026-12-01", end: "2026-12-05", summary: "Reservado", description: "" },
      { uid: "r2@pms-temporada", start: "2026-12-10", end: "2026-12-12", summary: "Reservado", description: "" },
    ]);
  });

  it("calendário vazio continua válido", () => {
    const empty = buildIcal([], { calendarName: "X", now });
    expect(empty).toContain("BEGIN:VCALENDAR");
    expect(empty).not.toContain("BEGIN:VEVENT");
  });
});

describe("foldLine", () => {
  it("dobra linhas longas em até 75 octetos", () => {
    const line = "X-WR-CALNAME:" + "á".repeat(80);
    const folded = foldLine(line);
    for (const part of folded.split("\r\n")) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });
});
