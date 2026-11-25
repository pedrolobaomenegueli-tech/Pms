"use server";

import { revalidatePath } from "next/cache";
import { isIsoDate } from "@/lib/dates";
import { applyStep, type StageStep } from "@/lib/domain/rules";
import { ensureCleaning } from "@/lib/cleaning-db";
import { requireUser } from "@/lib/supabase/server";
import { str, strOrNull, type ActionState } from "@/lib/ui";

function done() {
  revalidatePath("/", "layout");
}

/** Avança ou desfaz uma etapa do fluxo da estadia. */
export async function setStage(fd: FormData) {
  const { supabase } = await requireUser();
  const id = str(fd, "id");
  const step = str(fd, "step") as StageStep;
  if (!["checkin", "checkout", "finalizar", "desfazer"].includes(step)) throw new Error("Etapa inválida");
  const { data, error: readErr } = await supabase
    .from("reservations")
    .select("checked_in_at, checked_out_at, cleaning_done_at")
    .eq("id", id)
    .single();
  if (readErr) throw new Error(readErr.message);
  const nowIso = new Date().toISOString();
  const next = applyStep(data, step, nowIso);
  const { error } = await supabase.from("reservations").update(next).eq("id", id);
  if (error) throw new Error(error.message);
  // A limpeza nasce quando o check-out é realizado
  if (next.checked_out_at) {
    const cleaning = await ensureCleaning(supabase, id);
    if (cleaning) {
      await supabase.from("cleanings").update({ completed_at: next.cleaning_done_at ?? null }).eq("id", cleaning.id);
    }
  }
  done();
}

export async function toggleCleaningItem(fd: FormData) {
  const { supabase } = await requireUser();
  const doneNow = str(fd, "done") === "1";
  const { error } = await supabase
    .from("cleaning_items")
    .update({ done_at: doneNow ? new Date().toISOString() : null })
    .eq("id", str(fd, "id"));
  if (error) throw new Error(error.message);
  done();
}

/** Conclui a limpeza (pode ter itens pendentes) e finaliza a estadia. */
export async function completeCleaning(fd: FormData) {
  const { supabase } = await requireUser();
  const { data: c } = await supabase.from("cleanings").select("id, reservation_id").eq("id", str(fd, "id")).single();
  if (!c) throw new Error("Limpeza não encontrada");
  const reopen = str(fd, "reabrir") === "1";
  const nowIso = new Date().toISOString();
  const { data: r } = await supabase
    .from("reservations")
    .select("checked_in_at, checked_out_at, cleaning_done_at")
    .eq("id", c.reservation_id)
    .single();
  if (!r) throw new Error("Reserva não encontrada");
  const patch = reopen ? { ...r, cleaning_done_at: null } : applyStep(r, "finalizar", nowIso);
  const [a, b] = await Promise.all([
    supabase.from("reservations").update(patch).eq("id", c.reservation_id),
    supabase.from("cleanings").update({ completed_at: reopen ? null : (patch.cleaning_done_at ?? nowIso) }).eq("id", c.id),
  ]);
  if (a.error || b.error) throw new Error((a.error ?? b.error)!.message);
  done();
}


export async function createTask(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const date = str(fd, "date");
  const title = str(fd, "title");
  const unit_id = str(fd, "unit_id");
  const kind = str(fd, "kind") || "outro";
  if (!isIsoDate(date)) return { error: "Data inválida." };
  if (!title) return { error: "Informe o título." };
  if (!unit_id) return { error: "Escolha o quarto." };
  if (!["limpeza", "manutencao", "outro"].includes(kind)) return { error: "Tipo inválido." };
  const { error } = await supabase.from("tasks").insert({ date, title, unit_id, kind, notes: strOrNull(fd, "notes") });
  if (error) return { error: error.message };
  done();
  return { ok: "Tarefa criada." };
}

export async function toggleTask(fd: FormData) {
  const { supabase } = await requireUser();
  const doneNow = str(fd, "done") === "1";
  const { error } = await supabase
    .from("tasks")
    .update({ done: doneNow, done_at: doneNow ? new Date().toISOString() : null })
    .eq("id", str(fd, "id"));
  if (error) throw new Error(error.message);
  done();
}

export async function deleteTask(fd: FormData) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("tasks").delete().eq("id", str(fd, "id"));
  if (error) throw new Error(error.message);
  done();
}
