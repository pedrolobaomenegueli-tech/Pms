import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "./dates";
import { buildCleaningFromCheckout, buildCleaningList, checklistFor } from "./domain/cleaning";
import { loadActiveStays } from "./data";
import type { ChecklistItem, Cleaning, CleaningItem, Property, Reservation, Unit } from "./types";

/** Saídas de até tantos dias atrás, sem limpeza finalizada, aparecem como pendentes. */
export const PENDING_DAYS = 14;

/**
 * Garante a limpeza de uma reserva com check-out realizado, copiando o
 * checklist atual do quarto. Se já existir, devolve a existente (sem recopiar).
 */
export async function ensureCleaning(db: SupabaseClient, reservationId: string): Promise<Cleaning | null> {
  const { data: existing } = await db.from("cleanings").select("*").eq("reservation_id", reservationId).maybeSingle();
  if (existing) return existing as Cleaning;

  const { data: r } = await db.from("reservations").select("*").eq("id", reservationId).single();
  if (!r) return null;
  const { data: unit } = await db.from("units").select("id, property_id").eq("id", r.unit_id).single();
  if (!unit) return null;
  const { data: items } = await db
    .from("checklist_items")
    .select("*")
    .or(`unit_id.eq.${unit.id},property_id.eq.${unit.property_id}`);

  const built = buildCleaningFromCheckout(r as Reservation, checklistFor(unit, (items ?? []) as ChecklistItem[]));
  if (!built) return null;

  const { data: created, error } = await db.from("cleanings").insert(built.cleaning).select("*").single();
  if (error) {
    // Duas criações simultâneas: a outra venceu, usa a dela
    if (error.code === "23505") {
      const { data } = await db.from("cleanings").select("*").eq("reservation_id", reservationId).single();
      return data as Cleaning;
    }
    throw new Error(error.message);
  }
  if (built.items.length) {
    const { error: itemsErr } = await db
      .from("cleaning_items")
      .insert(built.items.map((i) => ({ ...i, cleaning_id: created.id })));
    if (itemsErr) throw new Error(itemsErr.message);
  }
  return created as Cleaning;
}

/** Dados da lista de limpeza de um dia (opcionalmente de uma propriedade). */
export async function loadCleaningDay(
  db: SupabaseClient,
  day: string,
  opts: { propertyId?: string } = {},
) {
  let pq = db.from("properties").select("*").eq("active", true).order("sort_order").order("name");
  let uq = db.from("units").select("*").eq("active", true).order("sort_order").order("name");
  if (opts.propertyId) {
    pq = pq.eq("id", opts.propertyId);
    uq = uq.eq("property_id", opts.propertyId);
  }
  const [{ data: pRows }, { data: uRows }] = await Promise.all([pq, uq]);
  const properties = (pRows ?? []) as Property[];
  const propIds = new Set(properties.map((p) => p.id));
  const units = ((uRows ?? []) as Unit[]).filter((u) => propIds.has(u.property_id));
  const unitIds = new Set(units.map((u) => u.id));
  const unitOrder = properties.flatMap((p) => units.filter((u) => u.property_id === p.id).map((u) => u.id));

  const [stays, { data: pendRows }, { data: checklistRows }] = await Promise.all([
    loadActiveStays(db, addDays(day, -1), addDays(day, 15)),
    db
      .from("reservations")
      .select("*")
      .eq("status", "ativa")
      .eq("kind", "reserva")
      .not("checked_out_at", "is", null)
      .is("cleaning_done_at", null)
      .lt("check_out", day)
      .gte("check_out", addDays(day, -PENDING_DAYS)),
    db.from("checklist_items").select("*"),
  ]);
  const mine = <T extends { unit_id: string }>(l: T[]) => l.filter((x) => unitIds.has(x.unit_id));
  const pending = mine((pendRows ?? []) as Reservation[]);
  const ownStays = mine(stays);

  const resIds = [...new Set([...ownStays.filter((r) => r.check_out === day).map((r) => r.id), ...pending.map((r) => r.id)])];
  const { data: cRows } = resIds.length
    ? await db.from("cleanings").select("*").in("reservation_id", resIds)
    : { data: [] as Cleaning[] };
  const cleanings = (cRows ?? []) as Cleaning[];
  const { data: iRows } = cleanings.length
    ? await db.from("cleaning_items").select("*").in("cleaning_id", cleanings.map((c) => c.id))
    : { data: [] as CleaningItem[] };

  const entries = buildCleaningList({ day, stays: ownStays, pending, cleanings, unitOrder });
  return {
    properties,
    units,
    stays: ownStays,
    entries,
    cleanings,
    cleaningItems: (iRows ?? []) as CleaningItem[],
    checklist: (checklistRows ?? []) as ChecklistItem[],
  };
}
