'use client';

/**
 * StatusBarNumericField — shared live-apply numeric input for the CAD status bar.
 *
 * SSoT for the repeated "number box with a local text buffer that commits live on
 * every valid keystroke" pattern. Before this, the snap-step field and the LTSCALE
 * field each re-implemented it inline (local buffer + parse + range guard + optional
 * unit suffix). One control now owns that behaviour; callers supply only the value,
 * the commit callback, and the range/format props.
 *
 * The local text buffer lets partial/empty drafts (`""`, `"0."`) survive while
 * typing without snapping back; a value that passes the range guard commits live.
 *
 * NOT used by the polar "add angle" field — that is a button/Enter-commit input
 * (draft + Add button), a different interaction, intentionally left inline.
 */

import React, { useEffect, useState } from 'react';

interface StatusBarNumericFieldProps {
  /** DOM id — pair with a caller-rendered <label htmlFor>. */
  readonly id: string;
  /** Current committed value (drives the field; external changes re-sync the buffer). */
  readonly value: number;
  /** Called with the parsed number whenever a typed draft passes the range guard. */
  readonly onCommit: (value: number) => void;
  readonly ariaLabel: string;
  /** Lower bound (default 0). */
  readonly min?: number;
  /** True → value must be strictly greater than `min` (e.g. LTSCALE > 0). Default false (>=). */
  readonly minExclusive?: boolean;
  /** Native spinner increment (default 1). */
  readonly step?: number;
  /** Optional trailing unit label (e.g. "mm"); reserves right padding when set. */
  readonly unitSuffix?: string;
  /** Tailwind width class (default "w-24"). */
  readonly widthClass?: string;
}

export function StatusBarNumericField({
  id,
  value,
  onCommit,
  ariaLabel,
  min = 0,
  minExclusive = false,
  step = 1,
  unitSuffix,
  widthClass = 'w-24',
}: StatusBarNumericFieldProps) {
  const [text, setText] = useState(String(value));
  useEffect(() => { setText(String(value)); }, [value]);

  const padding = unitSuffix ? 'pl-2 pr-7' : 'px-2';

  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = parseFloat(e.target.value);
          if (Number.isFinite(n) && (minExclusive ? n > min : n >= min)) onCommit(n);
        }}
        aria-label={ariaLabel}
        className={`h-6 ${widthClass} text-xs ${padding} rounded border border-border bg-background`}
        min={min}
        step={step}
      />
      {unitSuffix && (
        <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
          {unitSuffix}
        </span>
      )}
    </div>
  );
}
