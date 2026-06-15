'use client';

/**
 * ADR-363 Phase 4 / Properties-palette split — μία γραμμή ιδιότητας κολώνας στο
 * docked Properties panel: ετικέτα + Radix `<Select>` (editable) ή read-only τιμή
 * (readout). Canonical select = `@/components/ui/select` (ADR-001 — ΟΧΙ
 * EnterpriseComboBox). Tokens/semantic classes· μηδέν inline styles (N.3).
 *
 * Mirror της label-resolution του `RibbonCombobox` (isLiteralLabel ? labelKey : t).
 */

import React from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import type { ColumnPropertyField, ColumnPropertyOption } from './column-property-fields';

const MIXED_PLACEHOLDER = '—';

function resolveLabel(option: ColumnPropertyOption, t: (key: string) => string): string {
  return option.isLiteralLabel ? option.labelKey : t(option.labelKey);
}

export interface ColumnPropertyRowProps {
  readonly field: ColumnPropertyField;
  /** Τρέχουσα τιμή (από τον κοινό resolver)· `null` = mixed/άγνωστο. */
  readonly value: string | null;
  readonly onChange: (commandKey: string, value: string) => void;
}

export function ColumnPropertyRow({
  field,
  value,
  onChange,
}: ColumnPropertyRowProps): React.ReactElement {
  const { t } = useTranslation('dxf-viewer-shell');
  const label = t(field.labelKey);

  // Read-only readout (βάρη/όγκοι/ρ%): απλή ένδειξη, χωρίς control.
  if (field.readOnly) {
    return (
      <div className="flex items-center justify-between gap-2 py-0.5">
        <span className="truncate text-xs text-muted-foreground">{label}</span>
        <span className="shrink-0 text-xs font-medium text-foreground">
          {value ?? MIXED_PLACEHOLDER}
        </span>
      </div>
    );
  }

  // Empty-string value → no selection (Radix forbids value=""). Inject current
  // free-form value as first option ώστε να μη χάνεται (mirror RibbonCombobox).
  const resolved = value === '' ? null : value;
  const inOptions = resolved === null || field.options.some((o) => o.value === resolved);
  const options: readonly ColumnPropertyOption[] = inOptions
    ? field.options
    : [{ value: resolved, labelKey: resolved, isLiteralLabel: true }, ...field.options];

  return (
    <div className="flex items-center justify-between gap-2 py-0.5">
      <span className="truncate text-xs text-muted-foreground">{label}</span>
      <Select
        value={resolved ?? undefined}
        onValueChange={(next) => onChange(field.commandKey, next)}
      >
        <SelectTrigger size="sm" aria-label={label} className="w-36 shrink-0">
          <SelectValue placeholder={MIXED_PLACEHOLDER} />
        </SelectTrigger>
        <SelectContent className="w-auto min-w-[var(--radix-select-trigger-width)] max-w-[24rem]">
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="whitespace-nowrap">
              {resolveLabel(opt, t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
