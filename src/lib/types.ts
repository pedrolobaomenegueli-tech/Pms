export type Channel = "airbnb" | "booking" | "outro";
export type Source = "manual" | Channel;
export type Kind = "reserva" | "bloqueio";
export type ReservationStatus = "ativa" | "cancelada";
export type FeedStatus = "pendente" | "ok" | "erro" | "alerta";
export type TaskKind = "limpeza" | "manutencao" | "outro";

export interface Property {
  id: string;
  name: string;
  notes: string | null;
  active: boolean;
  sort_order: number;
}

export interface Unit {
  id: string;
  property_id: string;
  name: string;
  color: string;
  active: boolean;
  notes: string | null;
  sort_order: number;
  export_token: string;
}

export interface Feed {
  id: string;
  unit_id: string;
  channel: Channel;
  url: string;
  last_synced_at: string | null;
  last_success_at: string | null;
  status: FeedStatus;
  error_message: string | null;
  last_event_count: number | null;
}

export interface Reservation {
  id: string;
  unit_id: string;
  source: Source;
  kind: Kind;
  feed_id: string | null;
  external_uid: string | null;
  check_in: string;
  check_out: string;
  guest_name: string | null;
  guests: number | null;
  notes: string | null;
  status: ReservationStatus;
  cancelled_at: string | null;
  checked_in_at: string | null;
  checked_out_at: string | null;
  cleaning_done_at: string | null;
  ical_summary: string | null;
  ical_description: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  unit_id: string;
  date: string;
  title: string;
  kind: TaskKind;
  done: boolean;
  done_at: string | null;
  notes: string | null;
}

export const SOURCE_LABEL: Record<Source, string> = {
  manual: "Manual",
  airbnb: "Airbnb",
  booking: "Booking",
  outro: "Outro",
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  airbnb: "Airbnb",
  booking: "Booking.com",
  outro: "Outro",
};

export const TASK_KIND_LABEL: Record<TaskKind, string> = {
  limpeza: "Limpeza",
  manutencao: "Manutenção",
  outro: "Outro",
};
