import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { IcalParseError, parseIcal, parseIcalDate, unfold } from "@/lib/ical/parse";

const fixture = (name: string) => readFileSync(path.join(__dirname, "fixtures", name), "utf8");

describe("unfold", () => {
  it("junta linhas dobradas com espaço ou tab", () => {
    expect(unfold("A:abc\r\n def\r\n\tghi\r\nB:x")).toEqual(["A:abcdefghi", "B:x"]);
  });
});

describe("parseIcal: Airbnb", () => {
  const { events, skipped } = parseIcal(fixture("airbnb.ics"));

  it("lê todos os eventos", () => {
    expect(events).toHaveLength(3);
    expect(skipped).toHaveLength(0);
  });

  it("lê UID, datas de dia inteiro e SUMMARY", () => {
    expect(events[0]).toMatchObject({
      uid: "1418fb94e984-8c1d2a3b4c5d6e7f8a9b0c1d2e3f4a5b@airbnb.com",
      start: "2026-12-01",
      end: "2026-12-05",
      summary: "Reserved",
    });
    expect(events[1].summary).toBe("Airbnb (Not available)");
    expect(events[2].summary).toBe("Not available");
  });

  it("desdobra e desescapa DESCRIPTION", () => {
    expect(events[0].description).toBe(
      "Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMABCD1234\nPhone Number (Last 4 Digits): 4821",
    );
  });
});

describe("parseIcal: Booking.com", () => {
  it("lê eventos CLOSED - Not available", () => {
    const { events } = parseIcal(fixture("booking.ics"));
    expect(events).toEqual([
      {
        uid: "5e1d8a6f1b2c3d4e5f60718293a4b5c6@booking.com",
        start: "2026-12-05",
        end: "2026-12-08",
        summary: "CLOSED - Not available",
        description: "",
      },
      {
        uid: "9a8b7c6d5e4f30211203f4e5d6c7b8a9@booking.com",
        start: "2026-12-24",
        end: "2026-12-27",
        summary: "CLOSED - Not available",
        description: "",
      },
    ]);
  });
});

describe("parseIcalDate", () => {
  it("data sem horário", () => {
    expect(parseIcalDate("20261201", { VALUE: "DATE" })).toBe("2026-12-01");
    expect(parseIcalDate("20261201")).toBe("2026-12-01");
  });

  it("UTC (Z) é convertido para São Paulo", () => {
    // 02:00 UTC = 23:00 do dia anterior em SP (UTC-3)
    expect(parseIcalDate("20261202T020000Z")).toBe("2026-12-01");
    expect(parseIcalDate("20261202T030000Z")).toBe("2026-12-02");
  });

  it("TZID de outro fuso é convertido para São Paulo", () => {
    // 22:00 em Lisboa (UTC+0 em dezembro) = 19:00 em SP, mesmo dia
    expect(parseIcalDate("20261201T220000", { TZID: "Europe/Lisbon" })).toBe("2026-12-01");
    // 01:00 em Lisboa = 22:00 do dia anterior em SP
    expect(parseIcalDate("20261202T010000", { TZID: "Europe/Lisbon" })).toBe("2026-12-01");
  });

  it("horário flutuante ou TZID de SP usa a data como está", () => {
    expect(parseIcalDate("20261201T235900")).toBe("2026-12-01");
    expect(parseIcalDate("20261201T000000", { TZID: "America/Sao_Paulo" })).toBe("2026-12-01");
  });

  it("TZID inválido não quebra", () => {
    expect(parseIcalDate("20261201T100000", { TZID: "E. South America Standard Time" })).toBe("2026-12-01");
  });

  it("rejeita data malformada", () => {
    expect(() => parseIcalDate("2026-12-01")).toThrow(IcalParseError);
  });
});

describe("parseIcal: casos de borda", () => {
  it("rejeita resposta que não é calendário (ex.: página HTML de erro)", () => {
    expect(() => parseIcal("<html><body>Erro</body></html>")).toThrow(IcalParseError);
  });

  it("calendário válido sem eventos", () => {
    expect(parseIcal("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n").events).toEqual([]);
  });

  it("eventos com horário, sem DTEND, com VALARM e sem UID", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "BEGIN:VEVENT",
      "UID:com-horario",
      "DTSTART:20261210T170000Z",
      "DTEND:20261213T140000Z",
      "SUMMARY:Hóspede\\, João",
      "BEGIN:VALARM",
      "SUMMARY:alarme",
      "END:VALARM",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:sem-fim",
      "DTSTART;VALUE=DATE:20261220",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "DTSTART;VALUE=DATE:20261220",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:cancelado",
      "STATUS:CANCELLED",
      "DTSTART;VALUE=DATE:20261220",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const { events, skipped } = parseIcal(ics);
    expect(events).toEqual([
      { uid: "com-horario", start: "2026-12-10", end: "2026-12-13", summary: "Hóspede, João", description: "" },
      { uid: "sem-fim", start: "2026-12-20", end: "2026-12-21", summary: "", description: "" },
    ]);
    expect(skipped.map((s) => s.reason)).toEqual(["Evento sem UID", "STATUS:CANCELLED"]);
  });

  it("evento com horário no mesmo dia vira 1 noite", () => {
    const ics = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:x\nDTSTART:20261210T130000Z\nDTEND:20261210T150000Z\nEND:VEVENT\nEND:VCALENDAR";
    expect(parseIcal(ics).events[0]).toMatchObject({ start: "2026-12-10", end: "2026-12-11" });
  });
});
