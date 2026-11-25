import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseIcal } from "@/lib/ical/parse";
import { classifyEvent, planFeedSync, type ExistingRow } from "@/lib/sync/plan";

const airbnb = parseIcal(readFileSync(path.join(__dirname, "fixtures", "airbnb.ics"), "utf8")).events;
const booking = parseIcal(readFileSync(path.join(__dirname, "fixtures", "booking.ics"), "utf8")).events;
const feedA = { id: "f1", unit_id: "u1", channel: "airbnb" as const };
const feedB = { id: "f2", unit_id: "u1", channel: "booking" as const };
const base = { today: "2026-11-25", nowIso: "2026-11-25T12:00:00.000Z" };

function row(id: string, uid: string, check_in: string, check_out: string, status: "ativa" | "cancelada" = "ativa"): ExistingRow {
  return { id, external_uid: uid, check_in, check_out, status, kind: "reserva" };
}

describe("classifyEvent", () => {
  it("Airbnb: Reserved = reserva; Not available = bloqueio", () => {
    expect(classifyEvent("airbnb", "Reserved")).toBe("reserva");
    expect(classifyEvent("airbnb", "Not available")).toBe("bloqueio");
    expect(classifyEvent("airbnb", "Airbnb (Not available)")).toBe("bloqueio");
  });
  it("Booking: sempre reserva", () => {
    expect(classifyEvent("booking", "CLOSED - Not available")).toBe("reserva");
  });
});

describe("planFeedSync", () => {
  it("mapeia eventos do Airbnb sem tocar nome/observações do hóspede", () => {
    const plan = planFeedSync({ ...base, feed: feedA, events: airbnb, existing: [] });
    expect(plan.upserts.map((u) => u.kind)).toEqual(["reserva", "bloqueio", "bloqueio"]);
    expect(plan.upserts[0]).toMatchObject({ unit_id: "u1", feed_id: "f1", source: "airbnb", check_in: "2026-12-01", check_out: "2026-12-05", status: "ativa" });
    for (const u of plan.upserts) {
      expect(u).not.toHaveProperty("guest_name");
      expect(u).not.toHaveProperty("notes");
      expect(u).not.toHaveProperty("guests");
    }
  });

  it("Booking entra como reserva", () => {
    const plan = planFeedSync({ ...base, feed: feedB, events: booking, existing: [] });
    expect(plan.upserts.every((u) => u.kind === "reserva" && u.source === "booking")).toBe(true);
  });

  it("evento que sumiu do feed é cancelado; passado não", () => {
    const existing = [
      row("keep", airbnb[0].uid, "2026-12-01", "2026-12-05"),
      row("gone-future", "sumiu@airbnb.com", "2026-12-20", "2026-12-23"),
      row("gone-today", "sumiu2@airbnb.com", "2026-11-22", "2026-11-25"),
      row("gone-past", "antigo@airbnb.com", "2026-10-01", "2026-10-04"),
      row("already", "cancelado@airbnb.com", "2026-12-20", "2026-12-23", "cancelada"),
    ];
    const plan = planFeedSync({ ...base, feed: feedA, events: airbnb, existing });
    expect(plan.cancelIds.sort()).toEqual(["gone-future", "gone-today"]);
    expect(plan.warning).toBeNull();
  });

  it("evento que reaparece volta a ficar ativo", () => {
    const existing = [row("x", airbnb[0].uid, "2026-12-01", "2026-12-05", "cancelada")];
    const plan = planFeedSync({ ...base, feed: feedA, events: airbnb, existing });
    expect(plan.upserts[0]).toMatchObject({ external_uid: airbnb[0].uid, status: "ativa", cancelled_at: null });
  });

  it("feed vazio com reservas futuras: alerta e não cancela", () => {
    const existing = [row("a", "x@airbnb.com", "2026-12-20", "2026-12-23")];
    const plan = planFeedSync({ ...base, feed: feedA, events: [], existing });
    expect(plan.cancelIds).toEqual([]);
    expect(plan.warning).toMatch(/sem eventos/);
  });

  it("feed vazio sem nada futuro é normal", () => {
    const plan = planFeedSync({ ...base, feed: feedA, events: [], existing: [row("a", "x", "2026-10-01", "2026-10-03")] });
    expect(plan.warning).toBeNull();
    expect(plan.cancelIds).toEqual([]);
  });

  it("UID repetido no feed fica só uma vez", () => {
    const plan = planFeedSync({ ...base, feed: feedA, events: [airbnb[0], { ...airbnb[0], start: "2026-12-02" }], existing: [] });
    expect(plan.upserts).toHaveLength(1);
    expect(plan.upserts[0].check_in).toBe("2026-12-01");
  });
});
