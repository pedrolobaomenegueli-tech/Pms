import { syncNow } from "@/app/(app)/unidades/actions";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";

export function SyncNowButton({ unitId, label = "Sincronizar agora" }: { unitId?: string; label?: string }) {
  return (
    <ActionForm action={syncNow}>
      {unitId && <input type="hidden" name="unit_id" value={unitId} />}
      <SubmitButton className="btn-primary" pendingText="Sincronizando…">🔄 {label}</SubmitButton>
    </ActionForm>
  );
}
