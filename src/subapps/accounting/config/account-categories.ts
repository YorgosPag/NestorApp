/**
 * @fileoverview Accounting Subapp — Account Categories Registry
 * @description Πλήρες registry 24 κατηγοριών εσόδων-εξόδων (ADR-ACC-001 §4.3)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-001 Chart of Accounts §4.1–§4.3
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import i18next from 'i18next';
import type { AccountCategory, IncomeCategory, ExpenseCategory } from '../types/common';
import type { CategoryDefinition } from '../types/journal';

// ============================================================================
// ACCOUNT CATEGORIES — FULL REGISTRY (6 income + 19 expense = 25 total)
// ============================================================================

/**
 * Κεντρικοποιημένο registry κατηγοριών λογιστικού σχεδίου
 *
 * Single Source of Truth (SSoT) — ADR-ACC-001 §4.3
 * Κάθε κατηγορία φέρει πλήρη metadata: myDATA, E3, ΦΠΑ, ΚΑΔ κ.λπ.
 *
 * @remarks
 * Σειρά: πρώτα τα 6 έσοδα (sortOrder 1–6), μετά τα 19 έξοδα (sortOrder 7–25)
 */
export const ACCOUNT_CATEGORIES: readonly CategoryDefinition[] = [
  // ════════════════════════════════════════════════════════════════════════════
  // ΕΣΟΔΑ (6 κατηγορίες)
  // ════════════════════════════════════════════════════════════════════════════
  {
    code: 'service_income',
    type: 'income',
    label: 'categories.income.service_income',
    description: 'categories.descriptions.service_income',
    mydataCode: 'category1_3',
    e3Code: '561_003',
    defaultVatRate: 24,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 1,
    icon: 'Briefcase',
    kadCode: '71112000',
  },
  {
    code: 'construction_income',
    type: 'income',
    label: 'categories.income.construction_income',
    description: 'categories.descriptions.construction_income',
    mydataCode: 'category1_1',
    e3Code: '561_001',
    defaultVatRate: 24,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 2,
    icon: 'Building',
    kadCode: '41202003',
  },
  {
    code: 'construction_res_income',
    type: 'income',
    label: 'categories.income.construction_res_income',
    description: 'categories.descriptions.construction_res_income',
    mydataCode: 'category1_1',
    e3Code: '561_001',
    defaultVatRate: 24,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 3,
    icon: 'Home',
    kadCode: '41201001',
  },
  {
    code: 'rental_income',
    type: 'income',
    label: 'categories.income.rental_income',
    description: 'categories.descriptions.rental_income',
    mydataCode: 'category1_5',
    e3Code: '561_005',
    defaultVatRate: 24,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 4,
    icon: 'KeyRound',
    kadCode: '68201100',
  },
  {
    code: 'asset_sale_income',
    type: 'income',
    label: 'categories.income.asset_sale_income',
    description: 'categories.descriptions.asset_sale_income',
    mydataCode: 'category1_4',
    e3Code: '570_003',
    defaultVatRate: 24,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 5,
    icon: 'PackageOpen',
    kadCode: null,
  },
  {
    code: 'other_income',
    type: 'income',
    label: 'categories.income.other_income',
    description: 'categories.descriptions.other_income',
    mydataCode: 'category1_5',
    e3Code: '561_005',
    defaultVatRate: 0,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 6,
    icon: 'Coins',
    kadCode: null,
  },

  // ════════════════════════════════════════════════════════════════════════════
  // ΕΞΟΔΑ (19 κατηγορίες)
  // ════════════════════════════════════════════════════════════════════════════
  {
    code: 'third_party_fees',
    type: 'expense',
    label: 'categories.expense.third_party_fees',
    description: 'categories.descriptions.third_party_fees',
    mydataCode: 'category2_3',
    e3Code: '585_001',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 7,
    icon: 'Users',
    kadCode: null,
  },
  {
    code: 'rent',
    type: 'expense',
    label: 'categories.expense.rent',
    description: 'categories.descriptions.rent',
    mydataCode: 'category2_3',
    e3Code: '585_002',
    defaultVatRate: 0,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 8,
    icon: 'DoorOpen',
    kadCode: null,
  },
  {
    code: 'utilities',
    type: 'expense',
    label: 'categories.expense.utilities',
    description: 'categories.descriptions.utilities',
    mydataCode: 'category2_4',
    e3Code: '585_002',
    defaultVatRate: 6,
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 9,
    icon: 'Zap',
    kadCode: null,
  },
  {
    code: 'telecom',
    type: 'expense',
    label: 'categories.expense.telecom',
    description: 'categories.descriptions.telecom',
    mydataCode: 'category2_4',
    e3Code: '585_002',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 50,
    isActive: true,
    sortOrder: 10,
    icon: 'Phone',
    kadCode: null,
  },
  {
    code: 'fuel',
    type: 'expense',
    label: 'categories.expense.fuel',
    description: 'categories.descriptions.fuel',
    mydataCode: 'category2_5',
    e3Code: '585_006',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 11,
    icon: 'Fuel',
    kadCode: null,
  },
  {
    code: 'vehicle_expenses',
    type: 'expense',
    label: 'categories.expense.vehicle_expenses',
    description: 'categories.descriptions.vehicle_expenses',
    mydataCode: 'category2_5',
    e3Code: '585_006',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 50,
    isActive: true,
    sortOrder: 12,
    icon: 'Car',
    kadCode: null,
  },
  {
    code: 'vehicle_insurance',
    type: 'expense',
    label: 'categories.expense.vehicle_insurance',
    description: 'categories.descriptions.vehicle_insurance',
    mydataCode: 'category2_5',
    e3Code: '585_006',
    defaultVatRate: 0,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 13,
    icon: 'Shield',
    kadCode: null,
  },
  {
    code: 'office_supplies',
    type: 'expense',
    label: 'categories.expense.office_supplies',
    description: 'categories.descriptions.office_supplies',
    mydataCode: 'category2_5',
    e3Code: '585_006',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 14,
    icon: 'Paperclip',
    kadCode: null,
  },
  {
    code: 'software',
    type: 'expense',
    label: 'categories.expense.software',
    description: 'categories.descriptions.software',
    mydataCode: 'category2_5',
    e3Code: '585_006',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 15,
    icon: 'Monitor',
    kadCode: null,
  },
  {
    code: 'equipment',
    type: 'expense',
    label: 'categories.expense.equipment',
    description: 'categories.descriptions.equipment',
    mydataCode: 'category2_5',
    e3Code: '585_006',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 16,
    icon: 'Wrench',
    kadCode: null,
  },
  {
    code: 'travel',
    type: 'expense',
    label: 'categories.expense.travel',
    description: 'categories.descriptions.travel',
    mydataCode: 'category2_5',
    e3Code: '585_006',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 17,
    icon: 'Plane',
    kadCode: null,
  },
  {
    code: 'training',
    type: 'expense',
    label: 'categories.expense.training',
    description: 'categories.descriptions.training',
    mydataCode: 'category2_5',
    e3Code: '585_006',
    defaultVatRate: 6,
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 18,
    icon: 'GraduationCap',
    kadCode: null,
  },
  {
    code: 'advertising',
    type: 'expense',
    label: 'categories.expense.advertising',
    description: 'categories.descriptions.advertising',
    mydataCode: 'category2_5',
    e3Code: '585_016',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 19,
    icon: 'Megaphone',
    kadCode: null,
  },
  {
    code: 'efka',
    type: 'expense',
    label: 'categories.expense.efka',
    description: 'categories.descriptions.efka',
    mydataCode: 'category2_12',
    e3Code: '585_005',
    defaultVatRate: 0,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 20,
    icon: 'HeartPulse',
    kadCode: null,
  },
  {
    code: 'professional_tax',
    type: 'expense',
    label: 'categories.expense.professional_tax',
    description: 'categories.descriptions.professional_tax',
    mydataCode: 'category2_12',
    e3Code: '585_009',
    defaultVatRate: 0,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 21,
    icon: 'Receipt',
    kadCode: null,
  },
  {
    code: 'bank_fees',
    type: 'expense',
    label: 'categories.expense.bank_fees',
    description: 'categories.descriptions.bank_fees',
    mydataCode: 'category2_12',
    e3Code: '585_008',
    defaultVatRate: 0,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 22,
    icon: 'Landmark',
    kadCode: null,
  },
  {
    code: 'tee_fees',
    type: 'expense',
    label: 'categories.expense.tee_fees',
    description: 'categories.descriptions.tee_fees',
    mydataCode: 'category2_12',
    e3Code: '585_009',
    defaultVatRate: 0,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 23,
    icon: 'Award',
    kadCode: null,
  },
  {
    code: 'depreciation',
    type: 'expense',
    label: 'categories.expense.depreciation',
    description: 'categories.descriptions.depreciation',
    mydataCode: 'category2_11',
    e3Code: '587_001',
    defaultVatRate: 0,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 24,
    icon: 'TrendingDown',
    kadCode: null,
  },
  {
    code: 'other_expense',
    type: 'expense',
    label: 'categories.expense.other_expense',
    description: 'categories.descriptions.other_expense',
    mydataCode: 'category2_14',
    e3Code: '585_016',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 25,
    icon: 'MoreHorizontal',
    kadCode: null,
  },
] as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Αναζήτηση κατηγορίας βάσει κωδικού
 *
 * @param code - Κωδικός κατηγορίας (π.χ. 'service_income')
 * @returns CategoryDefinition ή undefined αν δεν βρεθεί
 *
 * @example
 * ```typescript
 * const cat = getCategoryByCode('service_income');
 * // cat.label is an i18n key — resolve via getCategoryDisplayLabel() or t()
 * ```
 */
export function getCategoryByCode(code: AccountCategory): CategoryDefinition | undefined {
  return ACCOUNT_CATEGORIES.find((cat) => cat.code === code);
}

/**
 * Επιστρέφει μόνο τις κατηγορίες εσόδων
 *
 * @returns Πίνακας 6 income categories, ταξινομημένες κατά sortOrder
 */
/**
 * Resolves a category's i18n label key to the user's current locale.
 *
 * Uses imperative i18next so it works in both React components AND plain TS services.
 *
 * @param code - AccountCategory code (e.g. 'service_income')
 * @returns Translated label string, or the code as fallback
 */
export function getCategoryDisplayLabel(code: AccountCategory): string {
  const cat = getCategoryByCode(code);
  if (!cat) return code;
  return i18next.t(cat.label, { ns: 'accounting' }) || code;
}
