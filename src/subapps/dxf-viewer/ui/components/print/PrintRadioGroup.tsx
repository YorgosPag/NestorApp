'use client';

/**
 * ADR-453 — Print dialog · semantic segmented radio group.
 *
 * Accessible <fieldset>/<legend> + radio inputs styled as a segmented control
 * with Tailwind utilities. Shared by the source / orientation / fit-mode /
 * target choices so the dialog stays free of div-soup (N.4) and inline
 * styles (N.3).
 *
 * @module subapps/dxf-viewer/ui/components/print/PrintRadioGroup
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PrintRadioOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface PrintRadioGroupProps<T extends string> {
  legend: string;
  name: string;
  value: T;
  options: ReadonlyArray<PrintRadioOption<T>>;
  onChange: (value: T) => void;
}

export function PrintRadioGroup<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
}: PrintRadioGroupProps<T>): React.JSX.Element {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-medium text-muted-foreground">{legend}</legend>
      <div
        role="radiogroup"
        aria-label={legend}
        className="inline-flex overflow-hidden rounded-md border border-border"
      >
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <label
              key={opt.value}
              className={cn(
                'cursor-pointer select-none px-3 py-1.5 text-sm transition-colors',
                'border-r border-border last:border-r-0',
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-foreground hover:bg-accent hover:text-accent-foreground',
                opt.disabled && 'cursor-not-allowed opacity-40 hover:bg-background hover:text-foreground',
              )}
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                checked={active}
                disabled={opt.disabled}
                onChange={() => onChange(opt.value)}
                className="sr-only"
              />
              {opt.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
