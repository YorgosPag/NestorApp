'use client';

/**
 * OpeningHardwareQtyCell — a single labeled quantity row for ONE hardware
 * component (lever / lockset / hinge / …), used by `OpeningHardwareSetEditor`
 * (ADR-674 Φ B — editable hardware-set UI).
 *
 * Mirrors `OpeningMaterialSelectCell`'s row layout (`w-28 shrink-0` label span,
 * `text-xs`) but edits a NUMBER instead of a material id. Emits `undefined`
 * when the field is cleared OR set back to the catalog default — the resolver
 * (`resolveOpeningHardwareSet`) treats an absent override as "use the default",
 * so this is a true clear, not a redundant explicit override (zero regression).
 *
 * @see ../../../bim/family-types/opening-hardware-set.ts — the catalog + resolver this edits
 * @see ./OpeningHardwareSetEditor.tsx — sole consumer (one cell per catalog component)
 */

import React, { useCallback } from 'react';

export interface OpeningHardwareQtyCellProps {
  /** Already-translated component label (e.g. "Χειρολαβή" / "Lever"). */
  readonly label: string;
  /** Current override, if any — `undefined` means "use `defaultQuantity`". */
  readonly quantity: number | undefined;
  /** The catalog default quantity for this component + opening kind. */
  readonly defaultQuantity: number;
  readonly onChange: (quantity: number | undefined) => void;
}

export function OpeningHardwareQtyCell({
  label,
  quantity,
  defaultQuantity,
  onChange,
}: OpeningHardwareQtyCellProps): React.ReactElement {
  const displayValue = quantity ?? defaultQuantity;

  const onInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      if (raw.trim() === '') return onChange(undefined);
      const parsed = Math.max(0, Math.trunc(Number(raw)));
      if (!Number.isFinite(parsed)) return onChange(undefined);
      onChange(parsed === defaultQuantity ? undefined : parsed);
    },
    [defaultQuantity, onChange],
  );

  return (
    <label className="flex items-center gap-2 text-xs text-foreground">
      <span className="w-28 shrink-0">{label}</span>
      <input
        type="number"
        min={0}
        step={1}
        value={displayValue}
        placeholder={String(defaultQuantity)}
        onChange={onInputChange}
        aria-label={label}
        className="w-20 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground"
      />
    </label>
  );
}
