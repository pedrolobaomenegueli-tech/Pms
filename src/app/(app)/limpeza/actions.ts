"use server";

import { revalidatePath } from "next/cache";
import { isIsoDate } from "@/lib/dates";
import { requireUser } from "@/lib/supabase/server";
import { str, strOrNull, type ActionState } from "@/lib/ui";

function done() {
  revalidatePath("/", "layout");
}

export async function setCleaning(fd: FormData) {
  const { supabase } = await requireUser();
  const id = str(fd, "id");
  const step = str(fd, "step");
  const now = new Date().toISOString();
  const patch =
    step === "iniciar"
      ? { cleaning_started_at: now, cleaning_done_at: null }
      : step === "concluir"
        ? { cleaning_done_at: now }
        : { cleaning_started_at: null, cleaning_done_at: null };
  const { error } = await supabase.from("reservations").update(patch).eq("id", id);
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
