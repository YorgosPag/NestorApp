/**
 * @fileoverview Κοινά πεδία φίλτρων των λιστών λογιστικής (ADR-ACC-010 §2.1.1 Φάση 3β)
 * @description Το πεδίο «χρήση» (τρέχουσα + δύο προηγούμενες) ήταν αντιγραμμένο σε ημερολόγιο και τιμολόγια·
 *   εδώ ζει μία φορά, μαζί με την τιμή-προεπιλογή του.
 * @compliance CLAUDE.md Enterprise Standards — zero `any`, i18n (N.11)
 */

import type { FilterFieldConfig } from '@/components/core/AdvancedFilters/types';

/** Πόσες χρήσεις προσφέρει το φίλτρο: η τρέχουσα και οι δύο προηγούμενες. */
const FISCAL_YEAR_SPAN = 3;

/** Η χρήση που επιλέγεται εξ ορισμού — η τρέχουσα. */
export function currentFiscalYearValue(): string {
  return String(new Date().getFullYear());
}

/** Το πεδίο «χρήση» των πάνελ φίλτρων. */
export function buildFiscalYearFilterField(): FilterFieldConfig {
  const year = new Date().getFullYear();
  return {
    id: 'fiscalYear',
    type: 'select',
    label: 'filterLabels.fiscalYear',
    ariaLabel: 'Fiscal year',
    width: 1,
    options: Array.from({ length: FISCAL_YEAR_SPAN }, (_, i) => {
      const value = String(year - i);
      return { value, label: value };
    }),
  };
}
