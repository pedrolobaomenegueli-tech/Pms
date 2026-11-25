import { describe, expect, it } from "vitest";
import {
  buildCleaningFromCheckout,
  buildCleaningList,
  buildTeamView,
  checklistFor,
  whatsappMessage,
} from "@/lib/domain/cleaning";
import type { ChecklistItem, Cleaning, CleaningItem, Reservation } from "@/lib/types";

const DAY = "2026-12-10";
let n = 0;
function res(unit_id: string, check_in: string, check_out: string, extra: Partial<Reservation> = {}): Reservation {
  return {
    id: extra.id ?? `r${++n}`,
    unit_id,
    source: "airbnb",
    kind: "reserva",
    feed_id: null,
    external_uid: null,
    check_in,
    check_out,
    guest_name: null,
    guests: null,
    notes: null,
    status: "ativa",
    cancelled_at: null,
    checked_in_at: null,
    checked_out_at: null,
    check_in_time: null,
    cleaning_done_at: null,
    ical_summary: null,
    ical_description: null,
    last_seen_at: null,
    created_at: "",
    updated_at: "",
    ...extra,
  };
}

const items: ChecklistItem[] = [
  { id: "a", property_id: "p1", unit_id: null, label: "Trocar roupa de cama", sort_order: 1 },
  { id: "b", property_id: "p1", unit_id: null, label: "Limpar banheiro", sort_order: 2 },
  { id: "c", property_id: "p2", unit_id: null, label: "Item de outra propriedade", sort_order: 1 },
  { id: "d", property_id: null, unit_id: "u1", label: "Conferir controle do ar", sort_order: 1 },
  { id: "e", property_id: null, unit_id: "u2", label: "Extra de outro quarto", sort_order: 1 },
];

describe("checklist do quarto", () => {
  it("herda o modelo da propriedade e soma os extras do quarto, em ordem", () => {
    expect(checklistFor({ id: "u1", property_id: "p1" }, items)).toEqual([
      "Trocar roupa de cama",
      "Limpar banheiro",
      "Conferir controle do ar",
    ]);
    expect(checklistFor({ id: "u3", property_id: "p1" }, items)).toEqual(["Trocar roupa de cama", "Limpar banheiro"]);
  });
});

describe("limpeza gerada a partir do check-out", () => {
  it("só é criada depois do check-out realizado", () => {
    const r = res("u1", "2026-12-07", DAY);
    expect(buildCleaningFromCheckout(r, ["x"])).toBeNull();
    expect(buildCleaningFromCheckout({ ...r, kind: "bloqueio", checked_out_at: "t" }, ["x"])).toBeNull();
    const out = buildCleaningFromCheckout({ ...r, checked_out_at: "2026-12-10T14:00:00Z" }, ["A", "B"]);
    expect(out).toEqual({
      cleaning: { reservation_id: r.id, unit_id: "u1", date: DAY },
      items: [
        { label: "A", sort_order: 1 },
        { label: "B", sort_order: 2 },
      ],
    });
  });

  it("os itens são uma cópia: mudar o modelo depois não altera a limpeza", () => {
    const model = [...items];
    const r = res("u1", "2026-12-07", DAY, { checked_out_at: "t" });
    const out = buildCleaningFromCheckout(r, checklistFor({ id: "u1", property_id: "p1" }, model))!;
    model[0] = { ...model[0], label: "RENOMEADO" };
    model.push({ id: "z", property_id: "p1", unit_id: null, label: "Novo item", sort_order: 9 });
    expect(out.items.map((i) => i.label)).toEqual(["Trocar roupa de cama", "Limpar banheiro", "Conferir controle do ar"]);
  });
});

describe("prioridade da lista do dia", () => {
  const out1 = res("u1", "2026-12-07", DAY, { id: "saida-virada" });
  const in1 = res("u1", DAY, "2026-12-12", { id: "chega-hoje" });
  const out2 = res("u2", "2026-12-08", DAY, { id: "saida-amanha" });
  const in2 = res("u2", "2026-12-11", "2026-12-13", { id: "chega-amanha" });
  const out3 = res("u3", "2026-12-08", DAY, { id: "saida-simples" });
  const out4 = res("u4", "2026-12-05", DAY, { id: "saida-feita", cleaning_done_at: "t" });
  const old = res("u5", "2026-12-04", "2026-12-08", { id: "pendente", checked_out_at: "t" });
  const order = ["u1", "u2", "u3", "u4", "u5"];

  const list = buildCleaningList({
    day: DAY,
    stays: [out3, out2, in2, out1, in1, out4],
    pending: [old],
    cleanings: [],
    unitOrder: order,
  });

  it("virada > check-in amanhã > saídas do dia > pendentes; concluídas no fim", () => {
    expect(list.map((e) => [e.reservation.id, e.priority])).toEqual([
      ["saida-virada", "urgente"],
      ["saida-amanha", "checkin_amanha"],
      ["saida-simples", "saida_hoje"],
      ["pendente", "pendente"],
      ["saida-feita", "saida_hoje"],
    ]);
    expect(list.at(-1)!.done).toBe(true);
  });

  it("aponta a próxima chegada do quarto", () => {
    expect(list[0].nextArrival?.id).toBe("chega-hoje");
    expect(list[1].nextArrival?.id).toBe("chega-amanha");
    expect(list[2].nextArrival).toBeUndefined();
  });

  it("empate na prioridade segue a ordem dos quartos", () => {
    const l = buildCleaningList({
      day: DAY,
      stays: [res("u3", "2026-12-08", DAY, { id: "c" }), res("u1", "2026-12-08", DAY, { id: "a" })],
      pending: [],
      cleanings: [],
      unitOrder: ["u1", "u3"],
    });
    expect(l.map((e) => e.reservation.id)).toEqual(["a", "c"]);
  });

  it("ignora bloqueios, canceladas e eco", () => {
    const l = buildCleaningList({
      day: DAY,
      stays: [
        res("u1", "2026-12-08", DAY, { kind: "bloqueio" }),
        res("u2", "2026-12-08", DAY, { status: "cancelada" }),
        res("u3", "2026-12-08", DAY, { id: "real", source: "airbnb" }),
        res("u3", "2026-12-08", DAY, { id: "eco", source: "booking" }),
      ],
      pending: [],
      cleanings: [],
      unitOrder: [],
    });
    expect(l.map((e) => e.reservation.id)).toEqual(["real"]);
  });
});

describe("link público da equipe", () => {
  const guest = res("u1", "2026-12-07", DAY, {
    id: "res-123",
    guest_name: "Maria Secreta",
    guests: 4,
    notes: "telefone 35 99999-1234",
    external_uid: "HMSECRETO@airbnb.com",
    ical_description: "Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMSECRETO\nPhone Number (Last 4 Digits): 4821",
    ical_summary: "Reserved",
    checked_out_at: "t",
  });
  const next = res("u1", DAY, "2026-12-12", { id: "res-456", guest_name: "João Secreto", check_in_time: "13:30:00", notes: "chega cedo" });
  const cleaning: Cleaning = { id: "cl1", reservation_id: "res-123", unit_id: "u1", date: DAY, completed_at: null, created_at: "" };
  const citems: CleaningItem[] = [
    { id: "i2", cleaning_id: "cl1", label: "Limpar banheiro", sort_order: 2, done_at: null },
    { id: "i1", cleaning_id: "cl1", label: "Trocar roupa de cama", sort_order: 1, done_at: "t" },
  ];
  const entries = buildCleaningList({ day: DAY, stays: [guest, next], pending: [], cleanings: [cleaning], unitOrder: ["u1"] });
  const view = buildTeamView({
    day: DAY,
    property: { id: "p1", name: "Casa Centro", checkin_time: "15:00:00" },
    units: [{ id: "u1", property_id: "p1", name: "Quarto 1" }, { id: "u9", property_id: "p2", name: "Outro" }],
    entries,
    cleaningItems: citems,
    checklist: items,
  });

  it("mostra propriedade, quarto, prioridade, horário do próximo check-in e checklist", () => {
    expect(view).toEqual({
      date: DAY,
      property: "Casa Centro",
      rooms: [
        {
          room: "Quarto 1",
          priority: "urgente",
          priorityLabel: "Urgente · virada",
          status: "Em limpeza",
          checkOut: DAY,
          nextCheckIn: { date: DAY, time: "13:30" },
          items: [
            { label: "Trocar roupa de cama", done: true },
            { label: "Limpar banheiro", done: false },
          ],
          preview: false,
        },
      ],
    });
  });

  it("não expõe dados do hóspede nem da reserva", () => {
    const json = JSON.stringify(view) + whatsappMessage(view, "https://x/equipe/tok");
    for (const secret of [
      "Maria Secreta", "João Secreto", "99999", "4821", "HMSECRETO", "airbnb.com", "res-123", "res-456",
      "chega cedo", "Reserved", "guest", "phone", "Phone", "notes", "external_uid", "ical",
    ]) {
      expect(json).not.toContain(secret);
    }
  });

  it("antes do check-out mostra o checklist atual como prévia", () => {
    const e = buildCleaningList({ day: DAY, stays: [res("u1", "2026-12-07", DAY)], pending: [], cleanings: [], unitOrder: [] });
    const v = buildTeamView({
      day: DAY,
      property: { id: "p1", name: "Casa", checkin_time: "15:00:00" },
      units: [{ id: "u1", property_id: "p1", name: "Q1" }],
      entries: e,
      cleaningItems: [],
      checklist: items,
    });
    expect(v.rooms[0]).toMatchObject({ status: "Aguardando check-out", preview: true, nextCheckIn: null });
    expect(v.rooms[0].items.map((i) => i.label)).toEqual(["Trocar roupa de cama", "Limpar banheiro", "Conferir controle do ar"]);
  });

  it("mensagem de WhatsApp traz data, lista resumida e link", () => {
    const msg = whatsappMessage(view, "https://app/equipe/tok?dia=2026-12-10");
    expect(msg).toContain("Limpeza Casa Centro");
    expect(msg).toContain("10/12");
    expect(msg).toContain("1. 🔴 Quarto 1 · Urgente · virada · check-in hoje 13:30");
    expect(msg).toContain("https://app/equipe/tok?dia=2026-12-10");
  });
});
