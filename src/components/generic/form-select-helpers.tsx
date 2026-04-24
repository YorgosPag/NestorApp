/**
 * Clearable <Select> helper — SSoT (ADR-324).
 *
 * Radix Select forbids `<SelectItem value="" />`. To offer a "clear selection"
 * option we render the sentinel `SELECT_CLEAR_VALUE` (`__clear__`, from
 * `config/domain-constants.ts`) and intercept it in the change handler,
 * translating it back to an empty string before it reaches the form state.
 *
 * With L1/L2 of the contact-sanitize pipeline (ADR-323) an empty string at
 * save time is recognised as an EXPLICIT CLEAR and written to Firestore as
 * `deleteField()` — so the user can fully remove the value, not just reset
 * the local display.
 *
 * This module exists to keep the logic in ONE place — every form renderer
 * (IndividualFormRenderer, GenericFormRenderer, ServiceFormRenderer, …) must
 * import from here instead of re-implementing clearable-select logic locally.
 *
 * @module components/generic/form-select-helpers
 * @see adrs/ADR-324-clearable-select-ssot.md
 * @see config/domain-constants.ts (SELECT_CLEAR_VALUE, isSelectClearValue)
 */

import * as React from 'react';
import { SelectItem, SelectSeparator } from '@/components/ui/select';
import {
  SELECT_CLEAR_VALUE,
  isSelectClearValue,
} from '@/config/domain-constants';
import { useTranslation } from '@/i18n/hooks/useTranslation';

/**
 * When `shouldAllowClear` is true, render the "Καθαρισμός επιλογής" sentinel
 * item plus a visual separator. When false, render nothing — the select
 * behaves as a plain, non-clearable dropdown (correct for required fields).
 *
 * The component loads the `common` namespace itself so callers don't have to
 * remember to include it in their own `useTranslation(...)` list.
 */
export interface ClearableSelectSectionProps {
  shouldAllowClear: boolean;
}

export function ClearableSelectSection({
  shouldAllowClear,
}: ClearableSelectSectionProps): React.ReactNode {
  const { t } = useTranslation('common');
  if (!shouldAllowClear) return null;
  return (
    <>
      <SelectItem value={SELECT_CLEAR_VALUE}>
        {t('dropdown.clearSelection')}
      </SelectItem>
      <SelectSeparator />
    </>
  );
}

/**
 * Wrap a Radix `onValueChange` handler so the clear sentinel is translated
 * to an empty string before reaching the form state. Plain values pass
 * through unchanged.
 */
export function wrapClearableSelectHandler(
  rawHandler: (value: string) => void,
): (value: string) => void {
  return (value: string) => {
    rawHandler(isSelectClearValue(value) ? '' : value);
  };
}

/**
 * A field is clearable when it is *not* required. Required fields must keep
 * a concrete value — clearing them would produce an invalid contact. Keep
 * this predicate in one place so every renderer applies the same rule.
 */
export function shouldAllowClearForField(field: { required?: boolean }): boolean {
  return field.required !== true;
}
