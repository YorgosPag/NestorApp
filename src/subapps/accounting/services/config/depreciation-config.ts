/**
 * @fileoverview Depreciation Configuration — Greek Fixed Asset Depreciation Rates
 * @description SSoT for depreciation rates per asset category (N.4172/2013, art.24)
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-007 Fixed Assets & Depreciation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { AssetCategory, DepreciationRateConfig } from '../../types/assets';

// ============================================================================
// DEPRECIATION RATES (Ν.4172/2013, αρ.24)
// ============================================================================

/**
 * Συντελεστές απόσβεσης ανά κατηγορία παγίου
 *
 * Μέθοδος: Σταθερή (straight line) — μοναδική αποδεκτή από ΚΦΕ
 *
 * | Κατηγορία           | Συντελεστής | Ωφέλιμη Ζωή |
 * |---------------------|------------|-------------|
 * | Κτίρια              | 4%         | 25 χρόνια   |
 * | Μηχανήματα          | 10%        | 10 χρόνια   |
 * | Οχήματα             | 16%        | ~6 χρόνια   |
 * | Έπιπλα & εξοπλισμός | 10%        | 10 χρόνια   |
 * | Η/Υ & λογισμικό     | 20%        | 5 χρόνια    |
 * | Όργανα μέτρησης     | 10%        | 10 χρόνια   |
 * | Λοιπά πάγια         | 10%        | 10 χρόνια   |
 */
export const DEPRECIATION_RATES: ReadonlyMap<AssetCategory, DepreciationRateConfig> = new Map<
  AssetCategory,
  DepreciationRateConfig
>([
  [
    'buildings',
    {
      category: 'buildings',
      annualRate: 4,
      method: 'straight_line',
      legalBasis: 'Ν.4172/2013 αρ.24 §1α',
      label: 'Κτίρια & κατασκευές',
    },
  ],
  [
    'machinery',
    {
      category: 'machinery',
      annualRate: 10,
      method: 'straight_line',
      legalBasis: 'Ν.4172/2013 αρ.24 §1β',
      label: 'Μηχανήματα & εγκαταστάσεις',
    },
  ],
  [
    'vehicles',
    {
      category: 'vehicles',
      annualRate: 16,
      method: 'straight_line',
      legalBasis: 'Ν.4172/2013 αρ.24 §1γ',
      label: 'Μέσα μεταφοράς',
    },
  ],
  [
    'furniture',
    {
      category: 'furniture',
      annualRate: 10,
      method: 'straight_line',
      legalBasis: 'Ν.4172/2013 αρ.24 §1δ',
      label: 'Έπιπλα & εξοπλισμός γραφείου',
    },
  ],
  [
    'computers',
    {
      category: 'computers',
      annualRate: 20,
      method: 'straight_line',
      legalBasis: 'Ν.4172/2013 αρ.24 §1ε',
      label: 'Η/Υ, λογισμικό & ηλεκτρονικά',
    },
  ],
  [
    'measurement_instruments',
    {
      category: 'measurement_instruments',
      annualRate: 10,
      method: 'straight_line',
      legalBasis: 'Ν.4172/2013 αρ.24 §1δ',
      label: 'Όργανα μέτρησης & ακριβείας',
    },
  ],
  [
    'other',
    {
      category: 'other',
      annualRate: 10,
      method: 'straight_line',
      legalBasis: 'Ν.4172/2013 αρ.24 §1δ',
      label: 'Λοιπά πάγια στοιχεία',
    },
  ],
]);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Λήψη συντελεστή απόσβεσης ανά κατηγορία
 *
 * @param category - Κατηγορία παγίου
 * @returns DepreciationRateConfig ή throw
 */
export function getDepreciationRate(category: AssetCategory): DepreciationRateConfig {
  const rate = DEPRECIATION_RATES.get(category);
  if (!rate) {
    throw new Error(`[DepreciationConfig] Unknown asset category: ${category}`);
  }
  return rate;
}

/**
 * Υπολογισμός ωφέλιμης ζωής σε χρόνια
 *
 * @param annualRate - Ετήσιος συντελεστής (%)
 * @returns Ωφέλιμη ζωή σε χρόνια
 */
export function calculateUsefulLife(annualRate: number): number {
  if (annualRate <= 0) {
    throw new Error(`[DepreciationConfig] Invalid depreciation rate: ${annualRate}`);
  }
  return Math.ceil(100 / annualRate);
}
