'use client';

/**
 * ============================================================================
 * KAD Code Picker (Company GEMI — Δραστηριότητες & ΚΑΔ)
 * ============================================================================
 *
 * Searchable dropdown for selecting Greek ΚΑΔ (Κωδικός Αριθμός Δραστηριότητας)
 * codes from the official AADE/forin.gr list (10.521 entries).
 *
 * Features:
 * - Lazy-loads KAD data via dynamic import (code-splitting)
 * - Accent-insensitive Greek search (via SearchableCombobox)
 * - Auto-fills both code + description on selection
 * - Free text allowed (new KAD codes may exist)
 *
 * Architecture:
 * - Follows same pattern as EscoOccupationPicker (ADR-132)
 * - Reuses SearchableCombobox (ADR-ACC-013)
 * - Integrated via custom renderer in UnifiedContactTabbedSection
 *
 * @module components/shared/KadCodePicker
 */

import { useTranslation } from 'react-i18next';
import { SearchableCombobox, type FieldAccessibleName } from '@/components/ui/searchable-combobox';
// ΚΑΔ ως επιλογές — ΕΝΑ SSoT με μία cache, κοινό με το accounting `KadSection`.
import { useKadOptions } from '@/hooks/useKadOptions';

// ============================================================================
// TYPES
// ============================================================================

interface KadCodePickerOwnProps {
  /** Current KAD code value */
  value: string;
  /** Disabled state */
  disabled?: boolean;
  /** Callback when a KAD code is selected or typed */
  onChange: (val: { code: string; description: string }) => void;
}

/** Own props + the combobox NAME, forwarded untouched (ADR-598 G11 · `FieldAccessibleName`). */
export type KadCodePickerProps = KadCodePickerOwnProps & FieldAccessibleName;

// ============================================================================
// COMPONENT
// ============================================================================

export function KadCodePicker({
  value,
  disabled = false,
  onChange,
  ...accessibleName
}: KadCodePickerProps) {
  const { t } = useTranslation('forms');
  const { options, isLoading } = useKadOptions();

  return (
    <SearchableCombobox
      {...accessibleName}
      value={value}
      onValueChange={(selectedValue, option) => {
        if (option) {
          // Selected from dropdown → fill code + description
          onChange({
            code: selectedValue,
            description: option.secondaryLabel ?? '',
          });
        } else {
          // Free text → treat as code only
          onChange({
            code: selectedValue,
            description: '',
          });
        }
      }}
      options={options}
      placeholder={t('kad.searchPlaceholder')}
      emptyMessage={t('kad.noResults')}
      isLoading={isLoading}
      allowFreeText
      maxDisplayed={30}
      disabled={disabled}
    />
  );
}

export default KadCodePicker;
