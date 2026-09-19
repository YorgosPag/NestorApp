/**
 * SpaceCoreFields — the three attributes every space entity has
 *
 * "What kind is it, is it usable, how big is it" — type + operational status + area,
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
import {
  OPERATIONAL_STATUS_SELECT_OPTIONS,
  type OperationalStatusDraft,
} from '@/lib/spaces/space-operational-draft';

// ============================================================================
// TYPES
// ============================================================================

/** A select bound to a typed option list. */
interface SpaceSelectBinding<T extends string> {
  value: T;
  options: ReadonlyArray<SelectOption<T>>;
  onChange: (value: T) => void;
}

interface SpaceCoreFieldsProps<TType extends string> {
  /**
   * Namespaced translator (ADR-280) — the label keys are the same everywhere. Must have
   * `properties-enums` loaded: the operational options share the property form's labels.
   */
  t: (key: string) => string;
  disabled?: boolean;
  type: SpaceSelectBinding<TType>;
  /**
   * ADR-777 §8.60.20 — ΜΟΝΟ η λειτουργική κατάσταση (ίδιο λεξιλόγιο με τα ακίνητα). Η διάθεση
   * ζει στην κάρτα «Διάθεση & τιμή» και η κράτηση/πώληση στη συναλλαγή.
   */
  operationalStatus: { value: OperationalStatusDraft; onChange: (value: OperationalStatusDraft) => void };
  /** Raw numeric input, in m². */
  area: { value: string; onChange: (value: string) => void };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SpaceCoreFields<TType extends string>({
  t,
  disabled,
  type,
  operationalStatus,
  area,
}: SpaceCoreFieldsProps<TType>) {
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
      <OptionSelectField<OperationalStatusDraft>
        label={t('properties-enums:unitStatus.operational')}
        value={operationalStatus.value}
        options={OPERATIONAL_STATUS_SELECT_OPTIONS}
        onValueChange={operationalStatus.onChange}
        t={t}
        disabled={disabled}
        placeholder={t('properties-enums:unitStatus.undeclared')}
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
