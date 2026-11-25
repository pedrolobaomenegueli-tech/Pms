import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Property, Reservation, Task, Unit } from "./types";

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function loadProperties(db: SupabaseClient, opts: { onlyActive?: boolean } = {}) {
  let pq = db.from("properties").select("*").order("sort_order").order("name");
  let uq = db.from("units").select("*").order("sort_order").order("name");
  if (opts.onlyActive) {
    pq = pq.eq("active", true);
    uq = uq.eq("active", true);
  }
  const [p, u] = await Promise.all([pq, uq]);
  const properties = check<Property[]>(p);
  const units = check<Unit[]>(u);
  const ids = new Set(properties.map((x) => x.id));
  return { properties, units: units.filter((x) => ids.has(x.property_id)) };
}

/** Reservas/bloqueios ativos que tocam o intervalo [from, to). */
export async function loadActiveStays(db: SupabaseClient, from: string, to: string, unitId?: string) {
  let q = db
    .from("reservations")
    .select("*")
    .eq("status", "ativa")
    .lt("check_in", to)
    .gt("check_out", from)
    .order("check_in")
    .limit(5000);
  if (unitId) q = q.eq("unit_id", unitId);
  return check<Reservation[]>(await q);
}

export async function loadTasks(db: SupabaseClient, date: string) {
  // Tarefas do dia + pendentes de dias anteriores
  const [day, late] = await Promise.all([
    db.from("tasks").select("*").eq("date", date).order("done").order("created_at"),
    db.from("tasks").select("*").lt("date", date).eq("done", false).order("date"),
  ]);
  return { day: check<Task[]>(day), late: check<Task[]>(late) };
}

export function unitLabel(units: Unit[], properties: Property[], unitId: string): string {
  const u = units.find((x) => x.id === unitId);
  if (!u) return "?";
  const p = properties.find((x) => x.id === u.property_id);
  return p ? `${p.name} · ${u.name}` : u.name;
}
