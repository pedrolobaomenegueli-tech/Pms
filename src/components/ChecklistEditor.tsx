import { addChecklistItem, moveChecklistItem, removeChecklistItem } from "@/app/(app)/unidades/actions";
import type { ChecklistItem } from "@/lib/types";
import { ActionForm } from "./ActionForm";
import { SubmitButton } from "./SubmitButton";

/** Lista editável de itens de checklist (modelo da propriedade ou extras do quarto). */
export function ChecklistEditor({
  items,
  owner,
  placeholder = "Novo item (ex.: repor amenities)",
}: {
  items: ChecklistItem[];
  owner: { property_id: string } | { unit_id: string };
  placeholder?: string;
}) {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const [ownerKey, ownerId] = Object.entries(owner)[0];
  return (
    <div>
      {sorted.length === 0 && <p className="mb-2 text-sm text-slate-500">Nenhum item.</p>}
      <ol className="mb-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
        {sorted.map((it, idx) => (
          <li key={it.id} className="flex items-center gap-2 px-2 py-1.5 text-sm">
            <span className="w-5 text-right text-xs text-slate-400">{idx + 1}.</span>
            <span className="min-w-0 flex-1">{it.label}</span>
            <form action={moveChecklistItem} className="flex">
              <input type="hidden" name="id" value={it.id} />
              <SubmitButton name="dir" value="up" className="btn px-2 py-1 text-slate-500 disabled:opacity-30" pendingText="…">
                ↑
              </SubmitButton>
              <SubmitButton name="dir" value="down" className="btn px-2 py-1 text-slate-500" pendingText="…">
                ↓
              </SubmitButton>
            </form>
            <form action={removeChecklistItem}>
              <input type="hidden" name="id" value={it.id} />
              <SubmitButton className="btn px-2 py-1 text-xs text-red-600" confirm={`Remover "${it.label}"?`} pendingText="…">
                Remover
              </SubmitButton>
            </form>
          </li>
        ))}
      </ol>
      <ActionForm action={addChecklistItem} resetOnSuccess className="flex gap-2">
        <input type="hidden" name={ownerKey} value={ownerId} />
        <input name="label" placeholder={placeholder} required className="input min-w-0 flex-1" />
        <SubmitButton className="btn-secondary">Adicionar</SubmitButton>
      </ActionForm>
    </div>
  );
}
