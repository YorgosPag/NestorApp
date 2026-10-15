'use client';

/**
 * @fileoverview useAccountingFilterPanel — κατάσταση φίλτρων + δέσιμο του πάνελ μιας λίστας λογιστικής
 * @description Κάθε σελίδα λίστας (τιμολόγια / τράπεζα / πάγια) κρατούσε τα ίδια τέσσερα κομμάτια για το πάνελ
 *   φίλτρων (ρύθμιση · τιμές · αλλαγή · προεπιλογές). Εδώ γίνονται ΕΝΑ αντικείμενο, που το `AccountingListBody`
 *   δίνει αυτούσιο στο `AdvancedFiltersPanel` (ADR-ACC-010 §2.1.1 Φάση 3β).
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import { useMemo, useState } from 'react';

import type { FilterPanelConfig, GenericFilterState } from '@/components/core/AdvancedFilters/types';

/** Ό,τι χρειάζεται το `AdvancedFiltersPanel` — ένα αντικείμενο αντί για τέσσερα props. */
export interface AccountingFilterPanelBinding<T extends GenericFilterState> {
  readonly config: FilterPanelConfig;
  readonly filters: T;
  readonly onFiltersChange: (filters: T) => void;
  readonly defaultFilters: T;
}

export function useAccountingFilterPanel<T extends GenericFilterState>(
  defaultFilters: T,
  config: FilterPanelConfig,
): { filters: T; filterPanel: AccountingFilterPanelBinding<T> } {
  const [filters, setFilters] = useState<T>(() => ({ ...defaultFilters }));
  const filterPanel = useMemo(
    () => ({ config, filters, onFiltersChange: setFilters, defaultFilters }),
    [config, filters, defaultFilters],
  );
  return { filters, filterPanel };
}
