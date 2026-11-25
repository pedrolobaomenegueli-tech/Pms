"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formatDate, isIsoDate } from "@/lib/dates";
import { findOverlapsFor } from "@/lib/domain/rules";
import { loadActiveStays } from "@/lib/data";
import { requireUser } from "@/lib/supabase/server";
import { SOURCE_LABEL, type Reservation } from "@/lib/types";
import { str, strOrNull, type ActionState } from "@/lib/ui";

function parseGuests(fd: FormData): number | null | "invalid" {
  const v = str(fd, "guests");
  if (!v) return null;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n < 100 ? n : "invalid";
}

export async function saveReservation(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const id = strOrNull(fd, "id");
  const guests = parseGuests(fd);
  if (guests === "invalid") return { error: "Nº de hóspedes inválido." };
  const checkInTime = strOrNull(fd, "check_in_time");
  if (checkInTime && !/^\d{2}:\d{2}(:\d{2})?$/.test(checkInTime)) return { error: "Horário de check-in inválido." };
  const personal = {
    guest_name: strOrNull(fd, "guest_name"),
    guests,
    notes: strOrNull(fd, "notes"),
    check_in_time: checkInTime,
  };

  let existing: Reservation | null = null;
  if (id) {
    const { data } = await supabase.from("reservations").select("*").eq("id", id).maybeSingle();
    if (!data) return { error: "Reserva não encontrada." };
    existing = data as Reservation;
  }

  // Importada: só campos pessoais (a sincronização cuida de datas e status)
  if (existing && existing.source !== "manual") {
    const { error } = await supabase.from("reservations").update(personal).eq("id", existing.id);
    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    return { ok: "Salvo." };
  }

  const unit_id = str(fd, "unit_id");
  const kind = str(fd, "kind");
  const check_in = str(fd, "check_in");
  const check_out = str(fd, "check_out");
  if (!unit_id) return { error: "Escolha o quarto." };
  if (kind !== "reserva" && kind !== "bloqueio") return { error: "Tipo inválido." };
  if (!isIsoDate(check_in) || !isIsoDate(check_out)) return { error: "Datas inválidas." };
  if (check_out <= check_in) return { error: "O check-out deve ser depois do check-in." };

  if (!existing || existing.status === "ativa") {
    const stays = await loadActiveStays(supabase, check_in, check_out, unit_id);
    const clash = findOverlapsFor({ id: existing?.id, unit_id, check_in, check_out }, stays);
    if (clash.length) {
      return {
        error:
          "Sobreposição com:\n" +
          clash
            .map(
              (r) =>
                `• ${SOURCE_LABEL[r.source]} ${r.kind === "bloqueio" ? "(bloqueio) " : ""}${formatDate(r.check_in)} → ${formatDate(r.check_out)}${r.guest_name ? ` (${r.guest_name})` : ""}`,
            )
            .join("\n"),
      };
    }
  }

  const row = { unit_id, kind, check_in, check_out, ...personal };
  if (existing) {
    const { error } = await supabase.from("reservations").update(row).eq("id", existing.id);
    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    return { ok: "Salvo." };
  }
  const { data, error } = await supabase
    .from("reservations")
    .insert({ ...row, source: "manual", status: "ativa" })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  redirect(`/reservas/${data.id}?criada=1`);
}

export async function cancelReservation(fd: FormData) {
  const { supabase } = await requireUser();
  const id = str(fd, "id");
  const { error } = await supabase
    .from("reservations")
    .update({ status: "cancelada", cancelled_at: new Date().toISOString() })
    .eq("id", id)
    .eq("source", "manual");
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

export async function reactivateReservation(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("reservations").select("*").eq("id", str(fd, "id")).eq("source", "manual").maybeSingle();
  if (!data) return { error: "Reserva não encontrada." };
  const r = data as Reservation;
  const clash = findOverlapsFor(r, await loadActiveStays(supabase, r.check_in, r.check_out, r.unit_id));
  if (clash.length) return { error: "Não dá para reativar: há sobreposição com outra reserva ou bloqueio." };
  const { error } = await supabase.from("reservations").update({ status: "ativa", cancelled_at: null }).eq("id", r.id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: "Reativada." };
}
