import { formatDateTimeSP } from "@/lib/dates";
import type { Feed } from "@/lib/types";
import { cx } from "@/lib/ui";

const STYLE: Record<Feed["status"], string> = {
  ok: "bg-emerald-100 text-emerald-800",
  pendente: "bg-slate-100 text-slate-600",
  erro: "bg-red-100 text-red-800",
  alerta: "bg-amber-100 text-amber-800",
};
const LABEL: Record<Feed["status"], string> = { ok: "OK", pendente: "Pendente", erro: "Erro", alerta: "Alerta" };

export function FeedStatus({ feed, detailed }: { feed: Feed; detailed?: boolean }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-xs">
      <span className={cx("rounded-full px-2 py-0.5 font-medium", STYLE[feed.status])}>{LABEL[feed.status]}</span>
      {detailed && (
        <span className="text-slate-500">
          última tentativa {formatDateTimeSP(feed.last_synced_at)}
          {feed.last_success_at && feed.status !== "ok" ? `, último sucesso ${formatDateTimeSP(feed.last_success_at)}` : ""}
          {feed.last_event_count !== null ? `, ${feed.last_event_count} eventos` : ""}
        </span>
      )}
    </span>
  );
}
