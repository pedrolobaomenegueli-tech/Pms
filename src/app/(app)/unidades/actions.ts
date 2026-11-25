"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { todaySP } from "@/lib/dates";
import { requireUser } from "@/lib/supabase/server";
import { syncAll } from "@/lib/sync/run";
import { str, strOrNull, type ActionState } from "@/lib/ui";

function refresh() {
  revalidatePath("/", "layout");
}

function intOr(fd: FormData, key: string, fallback: number) {
  const n = Number(str(fd, key));
  return Number.isInteger(n) ? n : fallback;
}

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export async function createProperty(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const name = str(fd, "name");
  if (!name) return { error: "Informe o nome da propriedade." };
  const { error } = await supabase.from("properties").insert({ name, notes: strOrNull(fd, "notes"), sort_order: intOr(fd, "sort_order", 0) });
  if (error) return { error: error.message };
  refresh();
  return { ok: "Propriedade criada." };
}

export async function updateProperty(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const name = str(fd, "name");
  if (!name) return { error: "Informe o nome." };
  const checkinTime = str(fd, "checkin_time") || "15:00";
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(checkinTime)) return { error: "Horário de check-in inválido." };
  const { error } = await supabase
    .from("properties")
    .update({
      name,
      notes: strOrNull(fd, "notes"),
      active: fd.get("active") === "on",
      sort_order: intOr(fd, "sort_order", 0),
      checkin_time: checkinTime,
    })
    .eq("id", str(fd, "id"));
  if (error) return { error: error.message };
  refresh();
  return { ok: "Salvo." };
}

export async function createUnit(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const name = str(fd, "name");
  const color = str(fd, "color") || "#64748b";
  if (!name) return { error: "Informe o nome do quarto." };
  if (!COLOR_RE.test(color)) return { error: "Cor inválida." };
  const { error } = await supabase
    .from("units")
    .insert({ property_id: str(fd, "property_id"), name, color, sort_order: intOr(fd, "sort_order", 0) });
  if (error) return { error: error.message };
  refresh();
  return { ok: `Quarto "${name}" criado.` };
}

export async function updateUnit(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const name = str(fd, "name");
  const color = str(fd, "color");
  if (!name) return { error: "Informe o nome." };
  if (!COLOR_RE.test(color)) return { error: "Cor inválida." };
  const { error } = await supabase
    .from("units")
    .update({
      name,
      color,
      property_id: str(fd, "property_id"),
      notes: strOrNull(fd, "notes"),
      active: fd.get("active") === "on",
      sort_order: intOr(fd, "sort_order", 0),
    })
    .eq("id", str(fd, "id"));
  if (error) return { error: error.message };
  refresh();
  return { ok: "Salvo." };
}

export async function regenerateToken(fd: FormData) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("units")
    .update({ export_token: randomBytes(24).toString("hex") })
    .eq("id", str(fd, "id"));
  if (error) throw new Error(error.message);
  refresh();
}

export async function saveFeed(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const id = strOrNull(fd, "id");
  const url = str(fd, "url");
  const channel = str(fd, "channel");
  if (!/^(https?|webcal):\/\/\S+$/i.test(url)) return { error: "URL inválida (deve começar com https:// ou webcal://)." };
  if (!["airbnb", "booking", "outro"].includes(channel)) return { error: "Canal inválido." };

  let feedId = id;
  if (id) {
    const { error } = await supabase.from("feeds").update({ url, channel }).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase
      .from("feeds")
      .insert({ unit_id: str(fd, "unit_id"), url, channel })
      .select("id")
      .single();
    if (error) return { error: error.message };
    feedId = data.id;
  }
  // Sincroniza na hora para validar a URL
  const res = await syncAll(supabase, { feedIds: [feedId!] });
  refresh();
  const r = res.results[0];
  if (r?.status === "erro") return { error: `Feed salvo, mas a sincronização falhou: ${r.message}` };
  return { ok: `Feed salvo e sincronizado (${r?.events ?? 0} eventos).` };
}

export async function deleteFeed(fd: FormData) {
  const { supabase } = await requireUser();
  const id = str(fd, "id");
  // Reservas futuras desse feed deixam de existir para o sistema
  await supabase
    .from("reservations")
    .update({ status: "cancelada", cancelled_at: new Date().toISOString() })
    .eq("feed_id", id)
    .eq("status", "ativa")
    .gte("check_out", todaySP());
  const { error } = await supabase.from("feeds").delete().eq("id", id);
  if (error) throw new Error(error.message);
  refresh();
}

export async function syncNow(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const unitId = strOrNull(fd, "unit_id");
  let feedIds: string[] | undefined;
  if (unitId) {
    const { data } = await supabase.from("feeds").select("id").eq("unit_id", unitId);
    feedIds = (data ?? []).map((f) => f.id);
    if (!feedIds.length) return { error: "Este quarto não tem feeds." };
  }
  try {
    const r = await syncAll(supabase, { feedIds });
    refresh();
    const parts = [`${r.ok} ok`];
    if (r.alerta) parts.push(`${r.alerta} com alerta`);
    if (r.erro) parts.push(`${r.erro} com erro`);
    const msg = `${r.total} feed(s) sincronizado(s): ${parts.join(", ")}.`;
    return r.erro || r.alerta ? { error: msg + " Veja os detalhes abaixo." } : { ok: msg };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}


// ---------------------------------------------------------------------------
// Checklist (modelo da propriedade e extras do quarto)
// ---------------------------------------------------------------------------

type Owner = { col: "property_id" | "unit_id"; id: string };

function ownerFrom(fd: FormData): Owner | null {
  const p = str(fd, "property_id");
  const u = str(fd, "unit_id");
  if (p && !u) return { col: "property_id", id: p };
  if (u && !p) return { col: "unit_id", id: u };
  return null;
}

export async function addChecklistItem(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireUser();
  const owner = ownerFrom(fd);
  const label = str(fd, "label");
  if (!owner) return { error: "Dono do item inválido." };
  if (!label) return { error: "Escreva o item." };
  const { data: last } = await supabase
    .from("checklist_items")
    .select("sort_order")
    .eq(owner.col, owner.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase
    .from("checklist_items")
    .insert({ [owner.col]: owner.id, label, sort_order: (last?.sort_order ?? 0) + 1 });
  if (error) return { error: error.message };
  refresh();
  return { ok: "Item adicionado." };
}

export async function removeChecklistItem(fd: FormData) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("checklist_items").delete().eq("id", str(fd, "id"));
  if (error) throw new Error(error.message);
  refresh();
}

/** Sobe ou desce um item e renumera a lista do mesmo dono. */
export async function moveChecklistItem(fd: FormData) {
  const { supabase } = await requireUser();
  const id = str(fd, "id");
  const dir = str(fd, "dir") === "up" ? -1 : 1;
  const { data: item } = await supabase.from("checklist_items").select("property_id, unit_id").eq("id", id).single();
  if (!item) return;
  const col = item.property_id ? "property_id" : "unit_id";
  const { data: list } = await supabase
    .from("checklist_items")
    .select("id")
    .eq(col, item.property_id ?? item.unit_id)
    .order("sort_order")
    .order("created_at");
  const ids = (list ?? []).map((x) => x.id as string);
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  await Promise.all(ids.map((x, k) => supabase.from("checklist_items").update({ sort_order: k + 1 }).eq("id", x)));
  refresh();
}

export async function regenerateTeamToken(fd: FormData) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("properties")
    .update({ team_token: randomBytes(24).toString("hex") })
    .eq("id", str(fd, "id"));
  if (error) throw new Error(error.message);
  refresh();
}
