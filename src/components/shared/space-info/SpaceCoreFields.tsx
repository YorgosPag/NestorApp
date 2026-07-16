/**
 * SpaceCoreFields — the three attributes every space entity has
 *
 * "What kind is it, what state is it in, how big is it" — type + status + area,
 * rendered as consecutive grid cells in the identity card of every space general
 * tab. SSoT for those three fields' label keys and input semantics (numeric step,
 * m² unit), which drifted between the Parking and Storage twins before.
 *
 * A field group, not a form shell: the caller still owns its form state and
 * renders its own entity-specific fields around this one (ADR-588 keeps the two
 * schemas separate — only the primitives are shared).
 *
 * @module components/shared/space-info/SpaceCoreFields
 * @see ADR-588 §General tab — space tab de-duplication (Phase 2)
 */

'use client';

import {
  OptionSelectField,
  type SelectOption,
} from '@/components/shared/space-info/OptionSelectField';
import { LabeledInputField } from '@/components/shared/space-info/LabeledInputField';

// ============================================================================
// TYPES
// ============================================================================

/** A select bound to a typed option list. */
interface SpaceSelectBinding<T extends string> {
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onChange: (value: T) => void;
}

interface SpaceCoreFieldsProps<TType extends string, TStatus extends string> {
  /** Namespaced translator (ADR-280) — the label keys are the same everywhere. */
  t: (key: string) => string;
  disabled?: boolean;
  type: SpaceSelectBinding<TType>;
  status: SpaceSelectBinding<TStatus>;
  /** Raw numeric input, in m². */
  area: { value: string; onChange: (value: string) => void };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SpaceCoreFields<TType extends string, TStatus extends string>({
  t,
  disabled,
  type,
  status,
  area,
}: SpaceCoreFieldsProps<TType, TStatus>) {
  return (
    <>
      <OptionSelectField
        label={t('general.fields.type')}
        value={type.value}
        options={type.options}
        onValueChange={type.onChange}
        t={t}
        disabled={disabled}
      />
      <OptionSelectField
        label={t('general.fields.status')}
        value={status.value}
        options={status.options}
        onValueChange={status.onChange}
        t={t}
        disabled={disabled}
      />
      <LabeledInputField
        label={t('general.fields.area')}
        value={area.value}
        onChange={area.onChange}
        type="number"
        step="0.01"
        placeholder="m²"
        disabled={disabled}
      />
    </>
  );
}

export default SpaceCoreFields;
