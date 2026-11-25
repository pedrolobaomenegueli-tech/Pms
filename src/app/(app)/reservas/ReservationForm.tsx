import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { UnitSelect } from "@/components/UnitSelect";
import type { Property, Reservation, Unit } from "@/lib/types";
import { saveReservation } from "./actions";

export function ReservationForm({
  properties,
  units,
  reservation,
  defaults,
}: {
  properties: Property[];
  units: Unit[];
  reservation?: Reservation;
  defaults?: { unit_id?: string; check_in?: string; check_out?: string };
}) {
  const imported = reservation && reservation.source !== "manual";
  const r = reservation;
  return (
    <ActionForm action={saveReservation} className="space-y-3">
      {r && <input type="hidden" name="id" value={r.id} />}
      {imported && (
        <p className="rounded-lg bg-slate-100 p-2 text-sm text-slate-600">
          Reserva importada: quarto, datas e tipo vêm do iCal. Você pode editar nome, hóspedes e observações; a sincronização não sobrescreve esses campos.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Quarto</label>
          <UnitSelect
            properties={properties}
            units={units}
            defaultValue={r?.unit_id ?? defaults?.unit_id}
            emptyLabel="Escolha…"
            required
            disabled={imported}
          />
        </div>
        <div>
          <label className="label">Check-in</label>
          <input type="date" name="check_in" required className="input" defaultValue={r?.check_in ?? defaults?.check_in} disabled={imported} />
        </div>
        <div>
          <label className="label">Check-out</label>
          <input type="date" name="check_out" required className="input" defaultValue={r?.check_out ?? defaults?.check_out} disabled={imported} />
        </div>
        <div>
          <label className="label">Tipo</label>
          <select name="kind" className="input" defaultValue={r?.kind ?? "reserva"} disabled={imported}>
            <option value="reserva">Reserva</option>
            <option value="bloqueio">Bloqueio</option>
          </select>
        </div>
        <div>
          <label className="label">Nº de hóspedes</label>
          <input type="number" name="guests" min={1} max={99} inputMode="numeric" className="input" defaultValue={r?.guests ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Nome do hóspede</label>
          <input name="guest_name" className="input" defaultValue={r?.guest_name ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Observações</label>
          <textarea name="notes" rows={3} className="input" defaultValue={r?.notes ?? ""} />
        </div>
      </div>
      <SubmitButton>{r ? "Salvar" : "Criar reserva"}</SubmitButton>
    </ActionForm>
  );
}
