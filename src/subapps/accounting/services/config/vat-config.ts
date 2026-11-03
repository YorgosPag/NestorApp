/**
 * @fileoverview VAT Configuration — Greek VAT Rates & Deductibility Rules
 * @description SSoT for VAT rates, myDATA mappings, and per-category deductibility
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-004 VAT Engine
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { VATDeductibilityRule } from '../../types/vat';
import type { ExpenseCategory } from '../../types/common';
import { ACCOUNT_CATEGORIES } from '../../config/account-categories';

// ============================================================================
// GREEK VAT RATES (Ν.2859/2000 — Κώδικας ΦΠΑ)
// ============================================================================

/** Ο πίνακας ζει στο ελαφρύ `vat-rates.ts` (ADR-928 Φ0)· επανεξάγεται εδώ για τους υπάρχοντες εισαγωγείς. */
export { GREEK_VAT_RATES } from './vat-rates';

// ============================================================================
// VAT DEDUCTIBILITY RULES (Ν.2859/2000, αρ.30)
// ============================================================================

/**
 * Κανόνες εκπτωσιμότητας ΦΠΑ ανά κατηγορία εξόδου
 *
 * Derived from ACCOUNT_CATEGORIES (SSoT) + πρόσθετη νομική βάση.
 * Κατασκευάζεται δυναμικά από τα account-categories data.
 */
function buildDeductibilityRules(): ReadonlyMap<ExpenseCategory, VATDeductibilityRule> {
  const expenseCategories = ACCOUNT_CATEGORIES.filter((cat) => cat.type === 'expense');
  const rulesMap = new Map<ExpenseCategory, VATDeductibilityRule>();

  /** i18n keys for legal basis per category (resolved at render time) */
  const legalBasisMap: Partial<Record<ExpenseCategory, string>> = {
    third_party_fees: 'vatConfig.legalBasis.third_party_fees',
    rent: 'vatConfig.legalBasis.rent',
    utilities: 'vatConfig.legalBasis.utilities',
    telecom: 'vatConfig.legalBasis.telecom',
    fuel: 'vatConfig.legalBasis.fuel',
    vehicle_expenses: 'vatConfig.legalBasis.vehicle_expenses',
    vehicle_insurance: 'vatConfig.legalBasis.vehicle_insurance',
    office_supplies: 'vatConfig.legalBasis.office_supplies',
    software: 'vatConfig.legalBasis.software',
    equipment: 'vatConfig.legalBasis.equipment',
    travel: 'vatConfig.legalBasis.travel',
    training: 'vatConfig.legalBasis.training',
    advertising: 'vatConfig.legalBasis.advertising',
    efka: 'vatConfig.legalBasis.efka',
    professional_tax: 'vatConfig.legalBasis.professional_tax',
    bank_fees: 'vatConfig.legalBasis.bank_fees',
    tee_fees: 'vatConfig.legalBasis.tee_fees',
    depreciation: 'vatConfig.legalBasis.depreciation',
    other_expense: 'vatConfig.legalBasis.other_expense',
  };

  for (const cat of expenseCategories) {
    const code = cat.code as ExpenseCategory;
    rulesMap.set(code, {
      category: code,
      deductiblePercent: cat.vatDeductiblePercent,
      legalBasis: legalBasisMap[code] ?? 'vatConfig.legalBasis.default',
      notes: cat.vatDeductiblePercent === 50 ? 'vatConfig.notes.mixedUse' : null,
    });
  }

  return rulesMap;
}

/** Κανόνες εκπτωσιμότητας ΦΠΑ (lazy-built, cached) */
let _cachedRules: ReadonlyMap<ExpenseCategory, VATDeductibilityRule> | null = null;

export function getVatDeductibilityRules(): ReadonlyMap<ExpenseCategory, VATDeductibilityRule> {
  if (!_cachedRules) {
    _cachedRules = buildDeductibilityRules();
  }
  return _cachedRules;
}

