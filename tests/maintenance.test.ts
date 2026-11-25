import { describe, expect, it } from "vitest";
import { buildMaintenanceBlock, checkinRisks, sortIssues } from "@/lib/domain/maintenance";
import { findConflicts, visibleStays, type Stay } from "@/lib/domain/rules";
import type { MaintenanceIssue } from "@/lib/types";

function issue(p: Partial<MaintenanceIssue>): MaintenanceIssue {
  return {
    id: p.id ?? Math.random().toString(36),
    unit_id: "u1",
    title: "x",
    description: null,
    priority: "media",
    status: "aberto",
    opened_on: "2026-12-01",
    resolved_at: null,
    cost: null,
    notes: null,
    block_reservation_id: null,
    cleaning_id: null,
    created_at: "",
    ...p,
  };
}

describe("bloqueio de manutenção", () => {
  const block: Stay = {
    id: "blk",
    ...buildMaintenanceBlock({ unit_id: "u1", title: "Chuveiro queimado" }, { check_in: "2026-12-10", check_out: "2026-12-12" }),
  };

  it("vira bloqueio manual com a descrição do problema", () => {
    expect(buildMaintenanceBlock({ unit_id: "u1", title: "Chuveiro" }, { check_in: "2026-12-10", check_out: "2026-12-12" })).toEqual({
      unit_id: "u1",
      source: "manual",
      kind: "bloqueio",
      status: "ativa",
      check_in: "2026-12-10",
      check_out: "2026-12-12",
      notes: "Manutenção: Chuveiro",
    });
  });

  it("aparece como bloqueio ativo do quarto", () => {
    expect(visibleStays([block]).map((r) => r.id)).toEqual(["blk"]);
  });

  it("some quando removido (cancelado)", () => {
    expect(visibleStays([{ ...block, status: "cancelada" }])).toEqual([]);
  });

  it("sobre uma reserva existente é permitido e não vira conflito de overbooking", () => {
    const booking: Stay = { id: "r", unit_id: "u1", source: "booking", kind: "reserva", status: "ativa", check_in: "2026-12-11", check_out: "2026-12-13" };
    expect(findConflicts([block, booking])).toEqual([]);
  });
});

describe("ordenação das manutenções", () => {
  it("abertas primeiro por prioridade; resolvidas no fim", () => {
    const list = sortIssues([
      issue({ id: "baixa", priority: "baixa" }),
      issue({ id: "resolvida", priority: "urgente", status: "resolvido", resolved_at: "2026-12-02" }),
      issue({ id: "urgente", priority: "urgente" }),
      issue({ id: "alta-andamento", priority: "alta", status: "em_andamento" }),
      issue({ id: "alta-aberta", priority: "alta" }),
    ]);
    expect(list.map((i) => i.id)).toEqual(["urgente", "alta-aberta", "alta-andamento", "baixa", "resolvida"]);
  });
});

describe("alerta de check-in em quarto com manutenção", () => {
  const today = "2026-12-10";
  const stay = (id: string, unit_id: string, check_in: string): Stay => ({
    id, unit_id, source: "airbnb", kind: "reserva", status: "ativa", check_in, check_out: "2026-12-30",
  });
  it("considera hoje até hoje+3, só alta/urgente abertas", () => {
    const issues = [
      issue({ unit_id: "u1", priority: "alta" }),
      issue({ unit_id: "u2", priority: "media" }),
      issue({ unit_id: "u3", priority: "urgente", status: "resolvido" }),
      issue({ unit_id: "u4", priority: "urgente" }),
    ];
    const stays = [
      stay("hoje", "u1", "2026-12-10"),
      stay("dia3", "u4", "2026-12-13"),
      stay("dia4", "u1", "2026-12-14"),
      stay("media", "u2", "2026-12-11"),
      stay("resolvida", "u3", "2026-12-11"),
    ];
    expect(checkinRisks(issues, stays, today).map((r) => r.reservation.id)).toEqual(["hoje", "dia3"]);
  });
});
