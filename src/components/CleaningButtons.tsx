import { setCleaning } from "@/app/(app)/limpeza/actions";
import { SubmitButton } from "./SubmitButton";
import type { Reservation } from "@/lib/types";

/** Botões de iniciar / concluir / desfazer limpeza de uma saída. */
export function CleaningButtons({ r }: { r: Pick<Reservation, "id" | "cleaning_started_at" | "cleaning_done_at"> }) {
  return (
    <form action={setCleaning} className="flex flex-wrap gap-2">
      <input type="hidden" name="id" value={r.id} />
      {!r.cleaning_done_at && !r.cleaning_started_at && (
        <SubmitButton name="step" value="iniciar" className="btn-secondary" pendingText="…">Iniciar limpeza</SubmitButton>
      )}
      {!r.cleaning_done_at && (
        <SubmitButton name="step" value="concluir" className="btn-primary" pendingText="…">Limpeza feita</SubmitButton>
      )}
      {(r.cleaning_done_at || r.cleaning_started_at) && (
        <SubmitButton name="step" value="desfazer" className="btn-secondary" pendingText="…">Desfazer</SubmitButton>
      )}
    </form>
  );
}
