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
 * - Follows same pattern as EscoOccupationPicker (ADR-034)
 * - Reuses SearchableCombobox (ADR-ACC-013)
 * - Integrated via custom renderer in UnifiedContactTabbedSection
 *
 * @module components/shared/KadCodePicker
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchableCombobox } from '@/components/ui/searchable-combobox';
import type { ComboboxOption } from '@/components/ui/searchable-combobox';

// ============================================================================
// TYPES
// ============================================================================

export interface KadCodePickerProps {
  /** Current KAD code value */
  value: string;
  /** Current activity description (for display when value is set but options not loaded yet) */
  description?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Callback when a KAD code is selected or typed */
  onChange: (val: { code: string; description: string }) => void;
}

// ============================================================================
// HOOK: Lazy-load ΚΑΔ data
// ============================================================================

function useKadOptions() {
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadKadCodes() {
      try {
        const { GREEK_KAD_CODES } = await import(
          '@/subapps/accounting/data/greek-kad-codes'
        );
        if (!cancelled) {
          setOptions(
            GREEK_KAD_CODES.map((kad) => ({
              value: kad.code,
              label: `${kad.code} — ${kad.description}`,
              secondaryLabel: kad.description,
            }))
          );
        }
      } catch (error) {
        console.error('Failed to load ΚΑΔ codes:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadKadCodes();
    return () => { cancelled = true; };
  }, []);

  return { options, isLoading };
}

// ============================================================================
// COMPONENT
// ============================================================================

export function KadCodePicker({
  value,
  disabled = false,
  onChange,
}: KadCodePickerProps) {
  const { t } = useTranslation('forms');
  const { options, isLoading } = useKadOptions();

  return (
    <SearchableCombobox
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
      placeholder={t('kad.searchPlaceholder', 'Αναζήτηση ΚΑΔ (κωδικός ή περιγραφή)...')}
      emptyMessage={t('kad.noResults', 'Δεν βρέθηκε ΚΑΔ')}
      isLoading={isLoading}
      allowFreeText
      maxDisplayed={30}
      disabled={disabled}
    />
  );
}

export default KadCodePicker;
