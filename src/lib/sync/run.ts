import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { todaySP } from "../dates";
import { parseIcal } from "../ical/parse";
import type { Feed } from "../types";
import { planFeedSync, type ExistingRow } from "./plan";

const FETCH_TIMEOUT_MS = 20_000;
const CONCURRENCY = 6;

export interface FeedSyncResult {
  feed_id: string;
  status: "ok" | "erro" | "alerta";
  events?: number;
  cancelled?: number;
  message?: string;
}

async function fetchIcal(url: string): Promise<string> {
  const httpUrl = url.replace(/^webcal:\/\//i, "https://");
  const res = await fetch(httpUrl, {
    headers: { "User-Agent": "PMS-iCal-Sync/1.0", Accept: "text/calendar, */*" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ao baixar o feed`);
  return res.text();
}

export async function syncFeed(db: SupabaseClient, feed: Pick<Feed, "id" | "unit_id" | "channel" | "url">): Promise<FeedSyncResult> {
  const now = new Date();
  const nowIso = now.toISOString();
  const today = todaySP(now);

  try {
    const text = await fetchIcal(feed.url);
    const { events } = parseIcal(text);

    // Só interessam linhas que podem ser canceladas (ativas e não terminadas)
    const { data: existing, error: exErr } = await db
      .from("reservations")
      .select("id, external_uid, check_in, check_out, status, kind")
      .eq("feed_id", feed.id)
      .eq("status", "ativa")
      .gte("check_out", today);
    if (exErr) throw new Error(`Erro ao ler reservas: ${exErr.message}`);

    const plan = planFeedSync({ feed, events, existing: (existing ?? []) as ExistingRow[], today, nowIso });

    // Upsert só com campos de sincronização: nome, hóspedes, observações e
    // limpeza nunca são enviados, então nunca são sobrescritos.
    for (let i = 0; i < plan.upserts.length; i += 500) {
      const { error } = await db
        .from("reservations")
        .upsert(plan.upserts.slice(i, i + 500), { onConflict: "feed_id,external_uid" });
      if (error) throw new Error(`Erro ao gravar reservas: ${error.message}`);
    }

    if (plan.cancelIds.length) {
      const { error } = await db
        .from("reservations")
        .update({ status: "cancelada", cancelled_at: nowIso })
        .in("id", plan.cancelIds);
      if (error) throw new Error(`Erro ao cancelar reservas: ${error.message}`);
    }

    const status = plan.warning ? "alerta" : "ok";
    await db
      .from("feeds")
      .update({
        status,
        error_message: plan.warning,
        last_synced_at: nowIso,
        last_success_at: nowIso,
        last_event_count: events.length,
      })
      .eq("id", feed.id);

    return { feed_id: feed.id, status, events: events.length, cancelled: plan.cancelIds.length, message: plan.warning ?? undefined };
  } catch (e) {
    const message =
      e instanceof Error ? (e.name === "TimeoutError" ? "Tempo esgotado ao baixar o feed" : e.message) : String(e);
    await db
      .from("feeds")
      .update({ status: "erro", error_message: message.slice(0, 500), last_synced_at: nowIso })
      .eq("id", feed.id);
    return { feed_id: feed.id, status: "erro", message };
  }
}

/** Sincroniza todos os feeds de quartos ativos (ou só os informados). */
export async function syncAll(db: SupabaseClient, opts: { feedIds?: string[] } = {}) {
  let q = db.from("feeds").select("id, unit_id, channel, url, units!inner(active)").eq("units.active", true);
  if (opts.feedIds) q = q.in("id", opts.feedIds);
  const { data, error } = await q;
  if (error) throw new Error(`Erro ao listar feeds: ${error.message}`);

  const feeds = (data ?? []) as unknown as Pick<Feed, "id" | "unit_id" | "channel" | "url">[];
  const results: FeedSyncResult[] = [];
  let next = 0;
  async function worker() {
    while (next < feeds.length) {
      const feed = feeds[next++];
      results.push(await syncFeed(db, feed));
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, feeds.length) }, worker));

  return {
    total: feeds.length,
    ok: results.filter((r) => r.status === "ok").length,
    alerta: results.filter((r) => r.status === "alerta").length,
    erro: results.filter((r) => r.status === "erro").length,
    results,
  };
}
