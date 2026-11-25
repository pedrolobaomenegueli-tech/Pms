import { describe, expect, it } from "vitest";
import {
  eventsForExport,
  findConflicts,
  findEchoIds,
  findOverlapsFor,
  roomStatus,
  type CleaningStay,
} from "@/lib/domain/rules";
import type { Kind, Source } from "@/lib/types";

let n = 0;
function stay(
  source: Source,
  check_in: string,
  check_out: string,
  extra: Partial<CleaningStay> & { kind?: Kind } = {},
): CleaningStay {
  return {
    id: extra.id ?? `r${++n}`,
    unit_id: "u1",
    source,
    kind: "reserva",
    check_in,
    check_out,
    status: "ativa",
    cleaning_started_at: null,
    cleaning_done_at: null,
    ...extra,
  };
}

describe("exclusão por canal na exportação", () => {
  const today = "2026-11-25";
  const items = [
    stay("manual", "2026-12-01", "2026-12-03", { id: "manual" }),
    stay("airbnb", "2026-12-05", "2026-12-08", { id: "airbnb" }),
    stay("booking", "2026-12-10", "2026-12-12", { id: "booking" }),
    stay("airbnb", "2026-12-15", "2026-12-20", { id: "airbnb-bloq", kind: "bloqueio" }),
    stay("outro", "2026-12-21", "2026-12-23", { id: "outro" }),
    stay("manual", "2026-12-24", "2026-12-26", { id: "cancelada", status: "cancelada" }),
    stay("manual", "2026-10-01", "2026-10-05", { id: "antiga" }), // terminou há mais de 30 dias
    stay("manual", "2026-10-20", "2026-10-27", { id: "recente" }), // terminou há 29 dias
  ];
  const ids = (ch: "airbnb" | "booking") => eventsForExport(items, ch, today).map((r) => r.id).sort();

  it("airbnb.ics não leva nada que veio do Airbnb", () => {
    expect(ids("airbnb")).toEqual(["booking", "manual", "outro", "recente"]);
  });

  it("booking.ics não leva nada que veio do Booking, mas leva bloqueios do Airbnb", () => {
    expect(ids("booking")).toEqual(["airbnb", "airbnb-bloq", "manual", "outro", "recente"]);
  });

  it("não exporta ecos (evita loop entre plataformas)", () => {
    const loop = [
      stay("booking", "2027-01-05", "2027-01-08", { id: "bk" }),
      stay("airbnb", "2027-01-05", "2027-01-08", { id: "eco", kind: "bloqueio" }),
    ];
    expect(eventsForExport(loop, "booking", today).map((r) => r.id)).toEqual([]);
    expect(eventsForExport(loop, "airbnb", today).map((r) => r.id)).toEqual(["bk"]);
  });
});

describe("eco", () => {
  it("bloqueio do Airbnb com as mesmas datas de uma reserva do Booking é eco", () => {
    const items = [stay("booking", "2026-12-05", "2026-12-08", { id: "bk" }), stay("airbnb", "2026-12-05", "2026-12-08", { id: "ab", kind: "bloqueio" })];
    expect([...findEchoIds(items)]).toEqual(["ab"]);
  });

  it("evento do Booking com as mesmas datas de uma reserva do Airbnb é eco", () => {
    const items = [stay("airbnb", "2026-12-05", "2026-12-08", { id: "ab" }), stay("booking", "2026-12-05", "2026-12-08", { id: "bk" })];
    expect([...findEchoIds(items)]).toEqual(["bk"]);
  });

  it("datas diferentes não são eco", () => {
    const items = [stay("booking", "2026-12-05", "2026-12-08"), stay("airbnb", "2026-12-05", "2026-12-09", { kind: "bloqueio" })];
    expect(findEchoIds(items).size).toBe(0);
  });

  it("manual nunca é eco; ecos de reserva cancelada voltam a aparecer", () => {
    const items = [
      stay("airbnb", "2026-12-05", "2026-12-08", { id: "ab" }),
      stay("manual", "2026-12-05", "2026-12-08", { id: "m", kind: "bloqueio" }),
      stay("booking", "2026-12-10", "2026-12-12", { id: "bk", status: "cancelada" }),
      stay("airbnb", "2026-12-10", "2026-12-12", { id: "ab2", kind: "bloqueio" }),
    ];
    expect(findEchoIds(items).size).toBe(0);
  });

  it("outro quarto não conta", () => {
    const items = [stay("booking", "2026-12-05", "2026-12-08"), stay("airbnb", "2026-12-05", "2026-12-08", { kind: "bloqueio", unit_id: "u2" })];
    expect(findEchoIds(items).size).toBe(0);
  });
});

describe("conflitos (overbooking)", () => {
  it("detecta reservas que se sobrepõem no mesmo quarto", () => {
    const items = [stay("airbnb", "2026-12-01", "2026-12-05", { id: "a" }), stay("booking", "2026-12-04", "2026-12-07", { id: "b" })];
    const c = findConflicts(items);
    expect(c).toHaveLength(1);
    expect([c[0].a.id, c[0].b.id]).toEqual(["a", "b"]);
  });

  it("check-out e check-in no mesmo dia não é conflito", () => {
    expect(findConflicts([stay("airbnb", "2026-12-01", "2026-12-05"), stay("booking", "2026-12-05", "2026-12-07")])).toEqual([]);
  });

  it("eco não é conflito", () => {
    expect(findConflicts([stay("booking", "2026-12-01", "2026-12-05"), stay("airbnb", "2026-12-01", "2026-12-05", { kind: "bloqueio" })])).toEqual([]);
  });

  it("reservas idênticas de mesma força (Airbnb x manual) são conflito", () => {
    expect(findConflicts([stay("airbnb", "2026-12-01", "2026-12-05"), stay("manual", "2026-12-01", "2026-12-05")])).toHaveLength(1);
  });

  it("bloqueio sobreposto e reservas canceladas não são conflito", () => {
    const items = [
      stay("airbnb", "2026-12-01", "2026-12-05"),
      stay("airbnb", "2026-12-03", "2026-12-10", { kind: "bloqueio" }),
      stay("manual", "2026-12-02", "2026-12-04", { status: "cancelada" }),
    ];
    expect(findConflicts(items)).toEqual([]);
  });

  it("quartos diferentes não conflitam; três sobrepostas geram três pares", () => {
    expect(findConflicts([stay("airbnb", "2026-12-01", "2026-12-05"), stay("booking", "2026-12-01", "2026-12-05", { unit_id: "u2" })])).toEqual([]);
    const three = [stay("manual", "2026-12-01", "2026-12-10"), stay("airbnb", "2026-12-02", "2026-12-04"), stay("booking", "2026-12-03", "2026-12-06")];
    expect(findConflicts(three)).toHaveLength(3);
  });
});

describe("validação ao salvar", () => {
  const items = [stay("airbnb", "2026-12-01", "2026-12-05", { id: "a" })];
  it("acusa sobreposição e ignora a própria reserva", () => {
    expect(findOverlapsFor({ unit_id: "u1", check_in: "2026-12-04", check_out: "2026-12-06" }, items)).toHaveLength(1);
    expect(findOverlapsFor({ id: "a", unit_id: "u1", check_in: "2026-12-02", check_out: "2026-12-06" }, items)).toHaveLength(0);
    expect(findOverlapsFor({ unit_id: "u1", check_in: "2026-12-05", check_out: "2026-12-06" }, items)).toHaveLength(0);
  });
});

describe("estado do quarto", () => {
  const today = "2026-12-10";
  it("livre", () => expect(roomStatus([], today).state).toBe("livre"));
  it("ocupado", () => expect(roomStatus([stay("airbnb", "2026-12-08", "2026-12-12")], today).state).toBe("ocupado"));
  it("check-out hoje, em limpeza e limpo com chegada", () => {
    expect(roomStatus([stay("airbnb", "2026-12-08", "2026-12-10")], today).state).toBe("checkout");
    expect(roomStatus([stay("airbnb", "2026-12-08", "2026-12-10", { cleaning_started_at: "x" })], today).state).toBe("em_limpeza");
    const s = roomStatus(
      [stay("airbnb", "2026-12-08", "2026-12-10", { cleaning_done_at: "x" }), stay("booking", "2026-12-10", "2026-12-12")],
      today,
    );
    expect(s.state).toBe("checkin");
  });
  it("virada (sai e entra hoje, sujo) é urgente", () => {
    const s = roomStatus([stay("airbnb", "2026-12-08", "2026-12-10"), stay("booking", "2026-12-10", "2026-12-12")], today);
    expect(s.state).toBe("checkout");
    expect(s.urgent).toBe(true);
  });
  it("limpeza pendente de saída recente; antiga é ignorada", () => {
    expect(roomStatus([stay("airbnb", "2026-12-05", "2026-12-08")], today).state).toBe("limpeza_pendente");
    expect(roomStatus([stay("airbnb", "2026-11-20", "2026-11-25")], today).state).toBe("livre");
  });
  it("bloqueado e próxima chegada", () => {
    const s = roomStatus([stay("airbnb", "2026-12-09", "2026-12-15", { kind: "bloqueio" }), stay("manual", "2026-12-20", "2026-12-22", { id: "prox" })], today);
    expect(s.state).toBe("bloqueado");
    expect(s.next?.id).toBe("prox");
  });
});
