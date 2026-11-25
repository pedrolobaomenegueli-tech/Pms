// Plano de sincronização de um feed: puro e testável.
// Decide o que inserir/atualizar (upsert) e o que cancelar.

import type { IcalEvent } from "../ical/parse";
import type { Channel, Kind, Reservation } from "../types";

export type ExistingRow = Pick<
  Reservation,
  "id" | "external_uid" | "check_in" | "check_out" | "status" | "kind"
>;

export interface UpsertRow {
  unit_id: string;
  feed_id: string;
  source: Channel;
  kind: Kind;
  external_uid: string;
  check_in: string;
  check_out: string;
  ical_summary: string;
  ical_description: string;
  status: "ativa";
  cancelled_at: null;
  last_seen_at: string;
}

export interface SyncPlan {
  upserts: UpsertRow[];
  cancelIds: string[];
  /** Quando preenchido, o feed é marcado como "alerta" e nada é cancelado */
  warning: string | null;
}

/** Airbnb: "Reserved" = reserva; "Not available" / "Airbnb (Not available)" = bloqueio. */
export function classifyEvent(channel: Channel, summary: string): Kind {
  if (channel === "airbnb") {
    return /not available/i.test(summary) ? "bloqueio" : "reserva";
  }
  // Booking não diferencia; "outro" também entra como reserva
  return "reserva";
}

export function planFeedSync(args: {
  feed: { id: string; unit_id: string; channel: Channel };
  events: IcalEvent[];
  existing: ExistingRow[];
  today: string;
  nowIso: string;
}): SyncPlan {
  const { feed, events, existing, today, nowIso } = args;

  // UIDs duplicados no feed: fica o primeiro
  const seen = new Set<string>();
  const unique = events.filter((e) => (seen.has(e.uid) ? false : (seen.add(e.uid), true)));

  const upserts: UpsertRow[] = unique.map((e) => ({
    unit_id: feed.unit_id,
    feed_id: feed.id,
    source: feed.channel,
    kind: classifyEvent(feed.channel, e.summary),
    external_uid: e.uid,
    check_in: e.start,
    check_out: e.end,
    ical_summary: e.summary,
    ical_description: e.description,
    status: "ativa",
    cancelled_at: null,
    last_seen_at: nowIso,
  }));

  // Só cancela o que ainda não terminou: feeds removem reservas antigas
  // com o tempo e isso não é cancelamento.
  const missing = existing.filter(
    (r) => r.status === "ativa" && r.external_uid !== null && !seen.has(r.external_uid) && r.check_out >= today,
  );

  if (unique.length === 0 && missing.length > 0) {
    return {
      upserts,
      cancelIds: [],
      warning: `Feed veio sem eventos, mas havia ${missing.length} reserva(s)/bloqueio(s) futuros. Nada foi cancelado; confira o feed.`,
    };
  }

  return { upserts, cancelIds: missing.map((r) => r.id), warning: null };
}
