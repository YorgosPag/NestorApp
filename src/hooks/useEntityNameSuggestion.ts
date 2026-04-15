'use client';

/**
 * ADR-233: Centralized entity name suggestion hook.
 *
 * Builds a suggested display name as "{typeLabel} {area} τ.μ." when area > 0,
 * or just "{typeLabel}" when area is empty/zero.
 *
 * SSoT for ALL entity name suggestions across create dialogs:
 *   AddPropertyDialog, AddStorageDialog, AddParkingDialog, PropertyInlineCreateForm
 *
 * @module hooks/useEntityNameSuggestion
 */

import { useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';

/**
 * Returns a stable `buildName(typeLabel, area)` function that appends the
 * i18n-resolved "τ.μ." / "sq.m." unit label when area > 0.
 */
export function useEntityNameSuggestion(): (typeLabel: string, area: number | '' | string) => string {
  const { t } = useTranslation('properties-enums');
  const sqmLabel = t('units.sqm');

  return useCallback(
    (typeLabel: string, area: number | '' | string): string => {
      const n = typeof area === 'number' ? area : parseFloat(String(area)) || 0;
      return n > 0 ? `${typeLabel} ${n} ${sqmLabel}` : typeLabel;
    },
    [sqmLabel],
  );
}
