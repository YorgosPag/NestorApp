'use client';

/**
 * @fileoverview Εγχέει στο πεδίο `floor` ενός πίνακα φίλτρων τις επιλογές **που προκύπτουν από τα
 * δεδομένα** (ADR-903 §6) — `[όλα] + οι όροφοι που υπάρχουν`, με την **μία** ετικέτα ορόφου.
 *
 * Ίδιο σχήμα με το `usePropertyFiltersConfig` (βαθύ αντίγραφο — η σταθερά του πίνακα μοιράζεται σε
 * όλες τις οθόνες και δεν μεταλλάσσεται). Η πρώτη επιλογή («Όλα τα επίπεδα») κρατιέται από τον πίνακα.
 * @module components/core/AdvancedFilters/hooks/useFloorFilterConfig
 */

import { useMemo } from 'react';
import { useFloorLabel } from '@/hooks/useFloorLabel';
import { floorFilterOptions } from '@/lib/floor/floor-filter';
import type { FilterPanelConfig } from '../types';

const FLOOR_FIELD = 'floor';

export function useFloorFilterConfig(
  baseConfig: FilterPanelConfig,
  items: ReadonlyArray<{ readonly floor?: unknown; readonly floorKind?: unknown }>,
): FilterPanelConfig {
  const floorLabel = useFloorLabel();
  return useMemo(() => {
    const config = JSON.parse(JSON.stringify(baseConfig)) as FilterPanelConfig;
    const options = floorFilterOptions(items, floorLabel);
    for (const row of config.rows) {
      for (const field of row.fields) {
        if (field.id !== FLOOR_FIELD) continue;
        field.options = [...(field.options ?? []).slice(0, 1), ...options];
      }
    }
    return config;
  }, [baseConfig, items, floorLabel]);
}
