"use server";

import { revalidatePath } from "next/cache";
import { isIsoDate } from "@/lib/dates";
import { applyStep, type StageStep } from "@/lib/domain/rules";
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
  const { error } = await supabase.from("reservations").update(applyStep(data, step, new Date().toISOString())).eq("id", id);
  if (error) throw new Error(error.message);
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
