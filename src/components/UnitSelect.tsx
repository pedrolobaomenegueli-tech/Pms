import type { Property, Unit } from "@/lib/types";

export function UnitSelect({
  properties,
  units,
  name = "unit_id",
  defaultValue,
  emptyLabel,
  required,
  disabled,
}: {
  properties: Property[];
  units: Unit[];
  name?: string;
  defaultValue?: string;
  emptyLabel?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <select name={name} defaultValue={defaultValue ?? ""} className="input" required={required} disabled={disabled}>
      {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
      {properties.map((p) => (
        <optgroup key={p.id} label={p.name}>
          {units
            .filter((u) => u.property_id === p.id)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.active ? "" : " (inativo)"}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}
