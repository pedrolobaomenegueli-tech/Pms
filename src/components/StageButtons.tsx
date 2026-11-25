import { setStage } from "@/app/(app)/limpeza/actions";
import { formatDateTimeSP } from "@/lib/dates";
import { NEXT_ACTION, STAGE_LABEL, stageOf, type StageFields } from "@/lib/domain/rules";
import type { Reservation } from "@/lib/types";
import { cx, STAGE_SOFT } from "@/lib/ui";
import { SubmitButton } from "./SubmitButton";


export function StageBadge({ r }: { r: StageFields }) {
  const s = stageOf(r);
  return <span className={cx("rounded-full px-2 py-0.5 text-xs font-semibold", STAGE_SOFT[s])}>{STAGE_LABEL[s]}</span>;
}

/** Botão da próxima etapa (check-in, check-out, finalizar limpeza) + desfazer. */
export function StageButtons({
  r,
  showUndo = true,
}: {
  r: Pick<Reservation, "id"> & StageFields;
  showUndo?: boolean;
}) {
  const next = NEXT_ACTION[stageOf(r)];
  const started = Boolean(r.checked_in_at || r.checked_out_at || r.cleaning_done_at);
  if (!next && !(showUndo && started)) return null;
  return (
    <form action={setStage} className="flex flex-wrap gap-2">
      <input type="hidden" name="id" value={r.id} />
      {next && (
        <SubmitButton name="step" value={next.step} className="btn-primary" pendingText="…">
          {next.label}
        </SubmitButton>
      )}
      {showUndo && started && (
        <SubmitButton name="step" value="desfazer" className="btn-secondary" pendingText="…">
          Desfazer
        </SubmitButton>
      )}
    </form>
  );
}

/** Linha do tempo com os horários registrados. */
export function StageTimeline({ r }: { r: StageFields }) {
  const items = [
    ["Check-in", r.checked_in_at],
    ["Check-out", r.checked_out_at],
    ["Limpeza finalizada", r.cleaning_done_at],
  ] as const;
  return (
    <ul className="space-y-0.5 text-sm">
      {items.map(([label, at]) => (
        <li key={label} className={at ? "text-slate-800" : "text-slate-400"}>
          {at ? "✓" : "○"} {label}
          {at ? `: ${formatDateTimeSP(at)}` : ""}
        </li>
      ))}
    </ul>
  );
}
