import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { UnitSelect } from "@/components/UnitSelect";
import { addDays, todaySP } from "@/lib/dates";
import { MAINT_PRIORITY_LABEL, type MaintenanceIssue, type Property, type Unit } from "@/lib/types";
import { saveIssue } from "./actions";

export function IssueForm({
  properties,
  units,
  issue,
  defaults,
}: {
  properties: Property[];
  units: Unit[];
  issue?: MaintenanceIssue;
  defaults?: { unit_id?: string; cleaning_id?: string };
}) {
  const today = todaySP();
  return (
    <ActionForm action={saveIssue} className="space-y-3">
      {issue && <input type="hidden" name="id" value={issue.id} />}
      {defaults?.cleaning_id && <input type="hidden" name="cleaning_id" value={defaults.cleaning_id} />}
      <div>
        <label className="label">Quarto</label>
        <UnitSelect properties={properties} units={units} defaultValue={issue?.unit_id ?? defaults?.unit_id} emptyLabel="Escolha…" required />
      </div>
      <div>
        <label className="label">Título</label>
        <input name="title" required className="input" defaultValue={issue?.title} placeholder="Ex.: chuveiro queimado" />
      </div>
      <div>
        <label className="label">Descrição</label>
        <textarea name="description" rows={3} className="input" defaultValue={issue?.description ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Prioridade</label>
          <select name="priority" className="input" defaultValue={issue?.priority ?? "media"}>
            {Object.entries(MAINT_PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Aberto em</label>
          <input type="date" name="opened_on" className="input" defaultValue={issue?.opened_on ?? today} />
        </div>
        <div>
          <label className="label">Custo (R$, opcional)</label>
          <input name="cost" inputMode="decimal" className="input" placeholder="0,00"
            defaultValue={issue?.cost != null ? String(issue.cost).replace(".", ",") : ""} />
        </div>
      </div>
      <div>
        <label className="label">Observações</label>
        <textarea name="notes" rows={2} className="input" defaultValue={issue?.notes ?? ""} />
      </div>

      {!issue && (
        <fieldset className="rounded-lg border border-slate-200 p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="bloquear" /> Bloquear quarto
          </label>
          <p className="mb-2 mt-1 text-xs text-slate-500">
            Cria um bloqueio manual que vai para o Airbnb e o Booking pela exportação iCal.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">De</label>
              <input type="date" name="block_from" className="input" defaultValue={today} />
            </div>
            <div>
              <label className="label">Até (saída)</label>
              <input type="date" name="block_to" className="input" defaultValue={addDays(today, 1)} />
            </div>
          </div>
        </fieldset>
      )}
      <SubmitButton>{issue ? "Salvar" : "Registrar problema"}</SubmitButton>
    </ActionForm>
  );
}
