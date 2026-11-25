import { describe, expect, it } from "vitest";
import {
  findConflicts,
  findOverlapsFor,
  applyStep,
  roomStatus,
  stageOf,
  type FlowStay,
} from "@/lib/domain/rules";
import type { Kind, Source } from "@/lib/types";

let n = 0;
function stay(
  source: Source,
  check_in: string,
  check_out: string,
  extra: Partial<FlowStay> & { kind?: Kind } = {},
): FlowStay {
  return {
    id: extra.id ?? `r${++n}`,
    unit_id: "u1",
    source,
    kind: "reserva",
    check_in,
    check_out,
    status: "ativa",
    checked_in_at: null,
    checked_out_at: null,
    cleaning_done_at: null,
    ...extra,
  };
}

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


  it("reservas com datas idênticas de canais diferentes são conflito", () => {
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

describe("fluxo da estadia", () => {
  const empty = { checked_in_at: null, checked_out_at: null, cleaning_done_at: null };
  const now = "2026-12-10T15:00:00.000Z";

  it("avança aguardando -> hospedado -> em limpeza -> finalizado", () => {
    expect(stageOf(empty)).toBe("aguardando_checkin");
    const a = applyStep(empty, "checkin", now);
    expect(stageOf(a)).toBe("hospedado");
    const b = applyStep(a, "checkout", now);
    expect(stageOf(b)).toBe("em_limpeza");
    const c = applyStep(b, "finalizar", now);
    expect(stageOf(c)).toBe("finalizado");
  });

  it("desfazer volta uma etapa de cada vez", () => {
    const done = { checked_in_at: "a", checked_out_at: "b", cleaning_done_at: "c" };
    const s1 = applyStep(done, "desfazer", now);
    expect(stageOf(s1)).toBe("em_limpeza");
    const s2 = applyStep(s1, "desfazer", now);
    expect(stageOf(s2)).toBe("hospedado");
    expect(s2.checked_in_at).toBe("a");
    expect(stageOf(applyStep(s2, "desfazer", now))).toBe("aguardando_checkin");
  });

  it("check-out sem check-in registrado preenche os dois; não sobrescreve horários já gravados", () => {
    expect(applyStep(empty, "checkout", now)).toEqual({ checked_in_at: now, checked_out_at: now, cleaning_done_at: null });
    expect(applyStep({ ...empty, checked_in_at: "antes" }, "checkin", now).checked_in_at).toBe("antes");
  });
});

describe("estado do quarto", () => {
  const today = "2026-12-10";
  const T = "2026-12-10T12:00:00Z";
  it("livre", () => expect(roomStatus([], today).state).toBe("livre"));

  it("chegada hoje ou em andamento sem check-in: aguardando", () => {
    expect(roomStatus([stay("airbnb", "2026-12-10", "2026-12-12")], today).state).toBe("aguardando_checkin");
    const late = roomStatus([stay("airbnb", "2026-12-08", "2026-12-12")], today);
    expect(late.state).toBe("aguardando_checkin");
    expect(late.notes).toEqual(["Check-in atrasado"]);
  });

  it("hospedado, com aviso de saída hoje ou atrasada", () => {
    expect(roomStatus([stay("airbnb", "2026-12-08", "2026-12-12", { checked_in_at: T })], today)).toMatchObject({ state: "hospedado", notes: [] });
    expect(roomStatus([stay("airbnb", "2026-12-08", "2026-12-10", { checked_in_at: T })], today).notes).toEqual(["Sai hoje"]);
    expect(roomStatus([stay("airbnb", "2026-12-05", "2026-12-09", { checked_in_at: T })], today).notes).toEqual(["Saída atrasada"]);
  });

  it("em limpeza depois do check-out; livre depois de finalizar", () => {
    expect(roomStatus([stay("airbnb", "2026-12-08", "2026-12-10", { checked_in_at: T, checked_out_at: T })], today).state).toBe("em_limpeza");
    expect(roomStatus([stay("airbnb", "2026-12-08", "2026-12-10", { checked_in_at: T, checked_out_at: T, cleaning_done_at: T })], today).state).toBe("livre");
  });

  it("virada: hóspede ainda no quarto ou limpeza aberta com chegada hoje é urgente", () => {
    const hosted = roomStatus(
      [stay("airbnb", "2026-12-08", "2026-12-10", { checked_in_at: T }), stay("booking", "2026-12-10", "2026-12-12", { id: "chega" })],
      today,
    );
    expect(hosted).toMatchObject({ state: "hospedado", urgent: true });
    expect(hosted.arrival?.id).toBe("chega");
    const cleaning = roomStatus(
      [stay("airbnb", "2026-12-08", "2026-12-10", { checked_in_at: T, checked_out_at: T }), stay("booking", "2026-12-10", "2026-12-12")],
      today,
    );
    expect(cleaning).toMatchObject({ state: "em_limpeza", urgent: true });
  });

  it("depois da limpeza finalizada, a chegada do dia aparece como aguardando", () => {
    const s = roomStatus(
      [stay("airbnb", "2026-12-08", "2026-12-10", { checked_in_at: T, checked_out_at: T, cleaning_done_at: T }), stay("booking", "2026-12-10", "2026-12-12", { id: "chega" })],
      today,
    );
    expect(s.state).toBe("aguardando_checkin");
    expect(s.stay?.id).toBe("chega");
  });

  it("reservas antigas esquecidas (mais de 7 dias) e passadas sem check-in são ignoradas", () => {
    expect(roomStatus([stay("airbnb", "2026-11-20", "2026-11-25", { checked_in_at: T })], today).state).toBe("livre");
    expect(roomStatus([stay("airbnb", "2026-12-05", "2026-12-08")], today).state).toBe("livre");
  });

  it("bloqueado e próxima chegada", () => {
    const s = roomStatus([stay("airbnb", "2026-12-09", "2026-12-15", { kind: "bloqueio" }), stay("manual", "2026-12-20", "2026-12-22", { id: "prox" })], today);
    expect(s.state).toBe("bloqueado");
    expect(s.next?.id).toBe("prox");
  });
});
