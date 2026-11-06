/**
 * @fileoverview EFKA Configuration — Greek Social Security Contribution Rates
 * @description SSoT for EFKA contribution categories and amounts per year
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-09
 * @version 1.1.0 — Fixed TDZ: data constants moved before EFKA_YEAR_CONFIGS
 * @see ADR-ACC-006 EFKA Contributions
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { EFKACategoryRate, EFKAYearConfig, EFKAMonthlyBreakdown } from '../../types/efka';
import { roundToTwo } from '../../utils/math';

// ============================================================================
// DATA CONSTANTS — Must be defined BEFORE EFKA_YEAR_CONFIGS (TDZ prevention)
// ============================================================================

/*
 * 2026: Δ.15/Δ'/1865/23-01-2026 (ΦΕΚ Β' 318/29-01-2026) — αύξηση 2,5%· επικουρική/εφάπαξ: εγκύκλιος e-ΕΦΚΑ 5/2026.
 * 2025: τιμές ως είχαν — ⚠️ ΔΕΝ έχουν επαληθευτεί έναντι ΦΕΚ (ADR-ACC-022 §8.2).
 */

/** Ποσά κύριας σύνταξης ανά κατηγορία */
const MAIN_PENSION_AMOUNTS: Record<number, readonly number[]> = {
  2025: [210, 274, 342, 410, 479, 548],
  2026: [185.09, 222.12, 281.82, 354.66, 440.64, 597.06],
};

/** Εισφορά υγείας (σε χρήμα + σε είδος) ανά κατηγορία κύριας σύνταξης */
const HEALTH_AMOUNTS: Record<number, readonly number[]> = {
  2025: [55, 55, 55, 55, 55, 55],
  // 1η: 5,97 + 59,71 · 2η-6η: 7,16 + 71,65
  2026: [65.68, 78.81, 78.81, 78.81, 78.81, 78.81],
};

/** Ποσά επικουρικής ανά κατηγορία */
const SUPPLEMENTARY_AMOUNTS: Record<number, readonly number[]> = {
  2025: [42, 51, 62],
  2026: [46.57, 56.13, 66.88],
};

/** Ποσά εφάπαξ ανά κατηγορία */
const LUMP_SUM_AMOUNTS: Record<number, readonly number[]> = {
  2025: [26, 31, 37],
  2026: [31.05, 37.02, 44.18],
};

// ============================================================================
// CATEGORY BUILDERS — Κατηγορίες εισφορών
// ============================================================================

function buildMainPensionCategories(year: number): EFKACategoryRate[] {
  const amounts = MAIN_PENSION_AMOUNTS[year] ?? MAIN_PENSION_AMOUNTS[2025];
  if (!amounts) {
    throw new Error(`[EFKAConfig] No main pension amounts for year ${year}`);
  }
  return amounts.map((monthlyAmount, idx) => ({
    code: `main_${idx + 1}`,
    label: `${idx + 1}η Κατηγορία - ${monthlyAmount}€`,
    monthlyAmount,
    annualAmount: monthlyAmount * 12,
    branch: 'main_pension' as const,
  }));
}

function buildSupplementaryCategories(year: number): EFKACategoryRate[] {
  const amounts = SUPPLEMENTARY_AMOUNTS[year] ?? SUPPLEMENTARY_AMOUNTS[2025];
  if (!amounts) {
    throw new Error(`[EFKAConfig] No supplementary amounts for year ${year}`);
  }
  return amounts.map((monthlyAmount, idx) => ({
    code: `supplementary_${idx + 1}`,
    label: `${idx + 1}η Κατηγορία Επικουρικής - ${monthlyAmount}€`,
    monthlyAmount,
    annualAmount: monthlyAmount * 12,
    branch: 'supplementary' as const,
  }));
}

function buildLumpSumCategories(year: number): EFKACategoryRate[] {
  const amounts = LUMP_SUM_AMOUNTS[year] ?? LUMP_SUM_AMOUNTS[2025];
  if (!amounts) {
    throw new Error(`[EFKAConfig] No lump sum amounts for year ${year}`);
  }
  return amounts.map((monthlyAmount, idx) => ({
    code: `lump_sum_${idx + 1}`,
    label: `${idx + 1}η Κατηγορία Εφάπαξ - ${monthlyAmount}€`,
    monthlyAmount,
    annualAmount: monthlyAmount * 12,
    branch: 'lump_sum' as const,
  }));
}

// ============================================================================
// EFKA YEAR CONFIGS (ΦΕΚ ποσά 2025, 2026)
// ============================================================================

/**
 * Ρυθμίσεις εισφορών ΕΦΚΑ ανά έτος
 *
 * Πηγή: ΦΕΚ / e-ΕΦΚΑ
 * 6 κύριες + 3 επικουρικές + 3 εφάπαξ κατηγορίες
 *
 * IMPORTANT: Data constants and builder functions MUST be defined above
 * this declaration. `const` is not hoisted in production builds (Webpack
 * preserves `const` semantics → TDZ if accessed before initialization).
 */
export const EFKA_YEAR_CONFIGS: ReadonlyMap<number, EFKAYearConfig> = new Map<number, EFKAYearConfig>([
  [
    2025,
    {
      year: 2025,
      mainPensionCategories: buildMainPensionCategories(2025),
      supplementaryCategories: buildSupplementaryCategories(2025),
      lumpSumCategories: buildLumpSumCategories(2025),
      healthContributionByMainCategory: HEALTH_AMOUNTS[2025] ?? [],
      legalReference: 'ΦΕΚ Β\' 2025 — Εισφορές ελ. επαγγελματιών',
    },
  ],
  [
    2026,
    {
      year: 2026,
      mainPensionCategories: buildMainPensionCategories(2026),
      supplementaryCategories: buildSupplementaryCategories(2026),
      lumpSumCategories: buildLumpSumCategories(2026),
      healthContributionByMainCategory: HEALTH_AMOUNTS[2026] ?? [],
      legalReference: 'Δ.15/Δ\'/1865/23-01-2026 (ΦΕΚ Β\' 318/29-01-2026) · Εγκ. e-ΕΦΚΑ 5/2026',
    },
  ],
]);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Λήψη ρυθμίσεων ΕΦΚΑ για ένα έτος
 *
 * @param year - Φορολογικό έτος
 * @returns EFKAYearConfig ή throw αν δεν βρεθεί
 */
export function getEfkaConfigForYear(year: number): EFKAYearConfig {
  const config = EFKA_YEAR_CONFIGS.get(year);
  if (!config) {
    const years = Array.from(EFKA_YEAR_CONFIGS.keys()).sort((a, b) => b - a);
    const latestYear = years[0];
    if (latestYear === undefined) {
      throw new Error(`[EFKAConfig] No EFKA config for year ${year} and no fallback available`);
    }
    const latestConfig = EFKA_YEAR_CONFIGS.get(latestYear);
    if (!latestConfig) {
      throw new Error(`[EFKAConfig] Failed to load fallback EFKA config for year ${latestYear}`);
    }
    console.warn(`[EFKAConfig] No config for ${year}, falling back to ${latestYear}`);
    return { ...latestConfig, year };
  }
  return config;
}

/**
 * Υπολογισμός μηνιαίας ανάλυσης εισφορών
 *
 * @param year - Φορολογικό έτος
 * @param mainCode - Κωδικός κύριας σύνταξης (π.χ. 'main_1')
 * @param suppCode - Κωδικός επικουρικής (π.χ. 'supplementary_1')
 * @param lumpCode - Κωδικός εφάπαξ (π.χ. 'lump_sum_1')
 * @returns EFKAMonthlyBreakdown array (12 μήνες)
 */
export function calculateMonthlyBreakdown(
  year: number,
  mainCode: string,
  suppCode: string,
  lumpCode: string
): EFKAMonthlyBreakdown[] {
  const config = getEfkaConfigForYear(year);

  const mainCat = config.mainPensionCategories.find((c) => c.code === mainCode);
  const suppCat = config.supplementaryCategories.find((c) => c.code === suppCode);
  const lumpCat = config.lumpSumCategories.find((c) => c.code === lumpCode);

  if (!mainCat || !suppCat || !lumpCat) {
    throw new Error(
      `[EFKAConfig] Invalid category codes: main=${mainCode}, supp=${suppCode}, lump=${lumpCode}`
    );
  }

  const mainIndex = config.mainPensionCategories.indexOf(mainCat);
  const healthAmount = config.healthContributionByMainCategory[mainIndex];
  if (healthAmount === undefined) {
    throw new Error(`[EFKAConfig] No health contribution for ${mainCode} in ${config.year}`);
  }

  const months: EFKAMonthlyBreakdown[] = [];
  for (let month = 1; month <= 12; month++) {
    const totalMonthly = roundToTwo(
      mainCat.monthlyAmount + suppCat.monthlyAmount + lumpCat.monthlyAmount + healthAmount
    );

    months.push({
      month,
      year,
      mainPensionAmount: mainCat.monthlyAmount,
      supplementaryAmount: suppCat.monthlyAmount,
      lumpSumAmount: lumpCat.monthlyAmount,
      healthAmount,
      totalMonthly,
    });
  }

  return months;
}

