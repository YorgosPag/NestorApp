/* eslint-disable design-system/prefer-design-system-imports */
/**
 * LabeledInputField — labelled `<Input>` bound to a string form value
 *
 * SSoT for the "labelled text/number input" pattern that was copy-pasted as the
 * name / area / price fields across the Parking and Storage general tabs. The
 * labelled-select sibling is {@link OptionSelectField}; both keep the same
 * fieldset + muted-label + `h-8 text-sm` shape so the two field kinds line up.
 *
 * Presentational only — the owner keeps the form state and the change handler.
 *
 * @module components/shared/space-info/LabeledInputField
 * @see ADR-588 §General tab — space tab de-duplication (Phase 2)
 */

'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

interface LabeledInputFieldProps {
  /** Field label (already-resolved string). */
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Native input type — `'number'` for numeric fields. */
  type?: 'text' | 'number';
  /** Native step, e.g. `'0.01'` for decimal amounts. */
  step?: string;
  /** Unit hint shown when empty, e.g. `'m²'` / `'€'`. */
  placeholder?: string;
  disabled?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function LabeledInputField({
  label,
  value,
  onChange,
  type = 'text',
  step,
  placeholder,
  disabled,
}: LabeledInputFieldProps) {
  const colors = useSemanticColors();

  return (
    <fieldset className="space-y-1.5">
      <Label className={cn('text-xs', colors.text.muted)}>{label}</Label>
      <Input
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 text-sm"
        disabled={disabled}
      />
    </fieldset>
  );
}

export default LabeledInputField;
