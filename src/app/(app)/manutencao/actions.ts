"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isIsoDate, todaySP } from "@/lib/dates";
import { buildMaintenanceBlock } from "@/lib/domain/maintenance";
import { requireUser } from "@/lib/supabase/server";
import { str, strOrNull, type ActionState } from "@/lib/ui";

const PRIORITIES = ["baixa", "media", "alta", "urgente"];
const STATUSES = ["aberto", "em_andamento", "resolvido"];

function refresh() {
  revalidatePath("/", "layout");
}

/** Aceita "1.234,56", "1234,56" ou "1234.56". */
function parseCost(v: string): number | null | "invalid" {
  if (!v) return null;
  const norm = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v;
  const n = Number(norm.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n >= 0 && /\d/.test(v) ? Math.round(n * 100) / 100 : "invalid";
}

function readBlock(fd: FormData): { check_in: string; check_out: string } | null | "invalid" {
  if (fd.get("bloquear") !== "on") return null;
  const check_in = str(fd, "block_from");
  const check_out = str(fd, "block_to");
  if (!isIsoDate(check_in) || !isIsoDate(check_out) || check_out <= check_in) return "invalid";
  return { check_in, check_out };
}

export async function saveIssue(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const id = strOrNull(fd, "id");
  const title = str(fd, "title");
  const unit_id = str(fd, "unit_id");
  const priority = str(fd, "priority");
  const cost = parseCost(str(fd, "cost"));
  const opened_on = str(fd, "opened_on") || todaySP();
  if (!title) return { error: "Informe o título." };
  if (!unit_id) return { error: "Escolha o quarto." };
  if (!PRIORITIES.includes(priority)) return { error: "Prioridade inválida." };
  if (cost === "invalid") return { error: "Custo inválido." };
  if (!isIsoDate(opened_on)) return { error: "Data de abertura inválida." };
  const block = readBlock(fd);
  if (block === "invalid") return { error: "Período do bloqueio inválido (o fim deve ser depois do início)." };

  const row = {
    unit_id,
    title,
    priority,
    cost,
    opened_on,
    description: strOrNull(fd, "description"),
    notes: strOrNull(fd, "notes"),
  };

  let issueId = id;
  if (id) {
    const { error } = await supabase.from("maintenance_issues").update(row).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase
      .from("maintenance_issues")
      .insert({ ...row, status: "aberto", cleaning_id: strOrNull(fd, "cleaning_id") })
      .select("id")
      .single();
    if (error) return { error: error.message };
    issueId = data.id;
  }

  if (block) {
    const err = await createBlock(supabase, issueId!, { unit_id, title }, block);
    if (err) return { error: err };
  }
  refresh();
  if (!id) redirect(`/manutencao/${issueId}?criado=1`);
  return { ok: "Salvo." };
}

type Db = Awaited<ReturnType<typeof requireUser>>["supabase"];

async function createBlock(
  supabase: Db,
  issueId: string,
  issue: { unit_id: string; title: string },
  period: { check_in: string; check_out: string },
): Promise<string | null> {
  const { data: current } = await supabase
    .from("maintenance_issues")
    .select("block_reservation_id")
    .eq("id", issueId)
    .single();
  if (current?.block_reservation_id) {
    const { data: blk } = await supabase.from("reservations").select("status").eq("id", current.block_reservation_id).maybeSingle();
    if (blk?.status === "ativa") return "Este problema já tem um bloqueio ativo. Remova-o antes de criar outro.";
  }
  const { data: res, error } = await supabase
    .from("reservations")
    .insert(buildMaintenanceBlock(issue, period))
    .select("id")
    .single();
  if (error) return error.message;
  const { error: linkErr } = await supabase.from("maintenance_issues").update({ block_reservation_id: res.id }).eq("id", issueId);
  return linkErr?.message ?? null;
}

export async function addBlock(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  fd.set("bloquear", "on");
  const block = readBlock(fd);
  if (!block || block === "invalid") return { error: "Período do bloqueio inválido (o fim deve ser depois do início)." };
  const { data: issue } = await supabase.from("maintenance_issues").select("id, unit_id, title").eq("id", str(fd, "id")).single();
  if (!issue) return { error: "Problema não encontrado." };
  const err = await createBlock(supabase, issue.id, issue, block);
  if (err) return { error: err };
  refresh();
  return { ok: "Quarto bloqueado no PMS. Enquanto não houver integração, bloqueie também no channel manager." };
}

/** Cancela o bloqueio vinculado ao problema. */
async function cancelBlock(supabase: Db, issueId: string) {
  const { data } = await supabase.from("maintenance_issues").select("block_reservation_id").eq("id", issueId).single();
  if (!data?.block_reservation_id) return;
  await supabase
    .from("reservations")
    .update({ status: "cancelada", cancelled_at: new Date().toISOString() })
    .eq("id", data.block_reservation_id)
    .eq("source", "manual")
    .eq("kind", "bloqueio");
}

export async function removeBlock(fd: FormData) {
  const { supabase } = await requireUser();
  await cancelBlock(supabase, str(fd, "id"));
  refresh();
}

/** Muda o status. Ao resolver, `bloqueio=remover` cancela o bloqueio vinculado. */
export async function setIssueStatus(fd: FormData) {
  const { supabase } = await requireUser();
  const id = str(fd, "id");
  const status = str(fd, "status");
  if (!STATUSES.includes(status)) throw new Error("Status inválido");
  const { error } = await supabase
    .from("maintenance_issues")
    .update({ status, resolved_at: status === "resolvido" ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  if (status === "resolvido" && str(fd, "bloqueio") === "remover") await cancelBlock(supabase, id);
  refresh();
}
