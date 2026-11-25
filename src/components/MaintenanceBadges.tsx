import { MAINT_PRIORITY_LABEL, MAINT_STATUS_LABEL, type MaintenancePriority, type MaintenanceStatus } from "@/lib/types";
import { cx } from "@/lib/ui";

export const MAINT_PRIORITY_STYLE: Record<MaintenancePriority, string> = {
  urgente: "bg-red-600 text-white",
  alta: "bg-orange-500 text-white",
  media: "bg-amber-200 text-amber-950",
  baixa: "bg-slate-200 text-slate-700",
};

const STATUS_STYLE: Record<MaintenanceStatus, string> = {
  aberto: "bg-white text-slate-800 ring-1 ring-slate-300",
  em_andamento: "bg-sky-100 text-sky-900",
  resolvido: "bg-emerald-100 text-emerald-900",
};

export function PriorityBadge({ p }: { p: MaintenancePriority }) {
  return <span className={cx("rounded-full px-2 py-0.5 text-xs font-semibold", MAINT_PRIORITY_STYLE[p])}>{MAINT_PRIORITY_LABEL[p]}</span>;
}

export function StatusBadge({ s }: { s: MaintenanceStatus }) {
  return <span className={cx("rounded-full px-2 py-0.5 text-xs font-medium", STATUS_STYLE[s])}>{MAINT_STATUS_LABEL[s]}</span>;
}
