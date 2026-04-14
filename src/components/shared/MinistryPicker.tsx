'use client';

/**
 * ============================================================================
 * MinistryPicker — Searchable dropdown for Greek Ministries
 * ============================================================================
 *
 * Searchable combobox for the supervisionMinistry field on service contacts.
 * 21 entries (20 ministries + Presidency of Government).
 *
 * Pattern: Same as KadCodePicker (ADR-ACC-013).
 * Reuses: SearchableCombobox (accent-insensitive Greek search).
 *
 * @module components/shared/MinistryPicker
 */

import { useTranslation } from 'react-i18next';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import type { ComboboxOption } from '@/components/ui/searchable-combobox';
import { GREEK_MINISTRIES } from '@/data/greek-ministries';

// ============================================================================
// TYPES
// ============================================================================

export interface MinistryPickerProps {
  /** Current ministry name value */
  value: string;
  /** Disabled state */
  disabled?: boolean;
  /** Callback when a ministry is selected or typed */
  onChange: (name: string) => void;
}

// ============================================================================
// OPTIONS (static — only 21 entries, no lazy loading needed)
// ============================================================================

const MINISTRY_OPTIONS: ComboboxOption[] = GREEK_MINISTRIES.map((m) => ({
  value: m.name,
  label: m.name,
}));

// ============================================================================
// COMPONENT
// ============================================================================

export function MinistryPicker({
  value,
  disabled = false,
  onChange,
}: MinistryPickerProps) {
  const { t } = useTranslation(['contacts', 'contacts-banking', 'contacts-core', 'contacts-form', 'contacts-lifecycle', 'contacts-relationships']);

  return (
    <SearchableCombobox
      value={value}
      onValueChange={(selectedValue) => {
        onChange(selectedValue);
      }}
      options={MINISTRY_OPTIONS}
      placeholder={t('service.fields.supervisionMinistry.searchPlaceholder')}
      emptyMessage={t('service.fields.supervisionMinistry.noResults')}
      allowFreeText
      maxDisplayed={21}
      disabled={disabled}
    />
  );
}

export default MinistryPicker;
