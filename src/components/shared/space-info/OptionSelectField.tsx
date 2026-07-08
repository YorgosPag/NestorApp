/**
 * OptionSelectField — labeled Radix Select over a `{ value, labelKey }[]` list
 *
 * SSoT for the "labelled dropdown bound to a typed option list" pattern that
 * was copy-pasted as the type/status selects across the Parking and Storage
 * general tabs (and is reusable by any entity form). Presentational only —
 * the owner keeps the form state and the change handler.
 *
 * @module components/shared/space-info/OptionSelectField
 * @see ADR-001 — canonical Select component (`@/components/ui/select`)
 * @see ADR-588 — Space tab de-duplication sweep
 */

'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

/** A single selectable option: the stored value + its i18n label key. */
export interface SelectOption<T extends string = string> {
  value: T;
  labelKey: string;
}

interface OptionSelectFieldProps<T extends string> {
  /** Field label (already-resolved string). */
  label: string;
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onValueChange: (value: T) => void;
  /** Translate an option's `labelKey`. */
  t: (key: string) => string;
  disabled?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function OptionSelectField<T extends string>({
  label,
  value,
  options,
  onValueChange,
  t,
  disabled,
}: OptionSelectFieldProps<T>) {
  const colors = useSemanticColors();

  return (
    <fieldset className="space-y-1.5">
      <Label className={cn('text-xs', colors.text.muted)}>{label}</Label>
      <Select
        value={value}
        onValueChange={(v) => onValueChange(v as T)}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {t(option.labelKey)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </fieldset>
  );
}

export default OptionSelectField;
