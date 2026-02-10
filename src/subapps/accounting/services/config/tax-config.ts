/**
 * @fileoverview Tax Configuration — Greek Income Tax Scales
 * @description SSoT for tax brackets, prepayment rates, professional tax
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-009 Tax Engine
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { TaxScaleConfig, TaxBracket } from '../../types/tax';
import type { EntityType } from '../../types/entity';

// ============================================================================
// GREEK TAX BRACKETS (Ν.4172/2013, αρ.15 — Κλίμακα Φόρου Εισοδήματος)
// ============================================================================

/**
 * Φορολογική κλίμακα 2024+ (ισχύει από 01/01/2024)
 *
 * Κλιμακωτός υπολογισμός:
 * - 0 – 10.000€: 9%
 * - 10.001 – 20.000€: 22%
 * - 20.001 – 30.000€: 28%
 * - 30.001 – 40.000€: 36%
 * - 40.001€+: 44%
 */
const BRACKETS_2024_ONWARDS: readonly TaxBracket[] = [
  { from: 0, to: 10_000, rate: 9 },
  { from: 10_001, to: 20_000, rate: 22 },
  { from: 20_001, to: 30_000, rate: 28 },
  { from: 30_001, to: 40_000, rate: 36 },
  { from: 40_001, to: null, rate: 44 },
] as const;

// ============================================================================
// TAX SCALE CONFIGS PER YEAR
// ============================================================================

/**
 * Ρυθμίσεις φορολογικής κλίμακας ανά έτος
 *
 * Περιλαμβάνει: brackets, προκαταβολή, τέλος επιτηδεύματος, αλληλεγγύη
 */
export const GREEK_TAX_SCALES: ReadonlyMap<number, TaxScaleConfig> = new Map<number, TaxScaleConfig>([
  [
    2024,
    {
      year: 2024,
      brackets: [...BRACKETS_2024_ONWARDS],
      prepaymentRate: 55,
      professionalTax: 650,
      solidarityRate: 0,
    },
  ],
  [
    2025,
    {
      year: 2025,
      brackets: [...BRACKETS_2024_ONWARDS],
      prepaymentRate: 55,
      professionalTax: 650,
      solidarityRate: 0,
    },
  ],
  [
    2026,
    {
      year: 2026,
      brackets: [...BRACKETS_2024_ONWARDS],
      prepaymentRate: 55,
      professionalTax: 650,
      solidarityRate: 0,
    },
  ],
]);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Λήψη φορολογικής κλίμακας για ένα έτος
 *
 * @param year - Φορολογικό έτος
 * @returns TaxScaleConfig ή throw αν δεν βρεθεί
 */
export function getTaxScaleForYear(year: number): TaxScaleConfig {
  const scale = GREEK_TAX_SCALES.get(year);
  if (!scale) {
    // Fallback: χρήση τελευταίας διαθέσιμης κλίμακας
    const years = Array.from(GREEK_TAX_SCALES.keys()).sort((a, b) => b - a);
    const latestYear = years[0];
    if (latestYear === undefined) {
      throw new Error(`[TaxConfig] No tax scale found for year ${year} and no fallback available`);
    }
    const latestScale = GREEK_TAX_SCALES.get(latestYear);
    if (!latestScale) {
      throw new Error(`[TaxConfig] Failed to load fallback tax scale for year ${latestYear}`);
    }
    console.warn(`[TaxConfig] No scale for ${year}, falling back to ${latestYear}`);
    return { ...latestScale, year };
  }
  return scale;
}

/**
 * Λίστα διαθέσιμων ετών
 */
export function getAvailableTaxYears(): number[] {
  return Array.from(GREEK_TAX_SCALES.keys()).sort((a, b) => a - b);
}
