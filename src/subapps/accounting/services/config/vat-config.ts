/**
 * @fileoverview VAT Configuration — Greek VAT Rates & Deductibility Rules
 * @description SSoT for VAT rates, myDATA mappings, and per-category deductibility
 * @author Claude Code (Anthropic AI) + Giorgos Pagonis
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-004 VAT Engine
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { VATRate, VATDeductibilityRule } from '../../types/vat';
import type { ExpenseCategory } from '../../types/common';
import { ACCOUNT_CATEGORIES } from '../../config/account-categories';

// ============================================================================
// GREEK VAT RATES (Ν.2859/2000 — Κώδικας ΦΠΑ)
// ============================================================================

/**
 * Ελληνικοί συντελεστές ΦΠΑ (ηπειρωτική Ελλάδα)
 *
 * Ισχύοντες από 01/06/2016:
 * - 24% Κανονικός (Ν.4389/2016)
 * - 13% Μειωμένος
 * - 6% Υπερμειωμένος
 * - 0% Απαλλαγή (αρ.22 Ν.2859/2000)
 */
export const GREEK_VAT_RATES: readonly VATRate[] = [
  {
    code: 'standard_24',
    rate: 24,
    mydataCategory: 1,
    label: 'Κανονικός 24%',
    validFrom: '2016-06-01',
    validTo: null,
  },
  {
    code: 'reduced_13',
    rate: 13,
    mydataCategory: 2,
    label: 'Μειωμένος 13%',
    validFrom: '2016-06-01',
    validTo: null,
  },
  {
    code: 'super_reduced_6',
    rate: 6,
    mydataCategory: 3,
    label: 'Υπερμειωμένος 6%',
    validFrom: '2016-06-01',
    validTo: null,
  },
  {
    code: 'exempt_0',
    rate: 0,
    mydataCategory: 8,
    label: 'Απαλλαγή 0%',
    validFrom: '2016-06-01',
    validTo: null,
  },
] as const;

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

  /** Νομική βάση ανά κατηγορία */
  const legalBasisMap: Partial<Record<ExpenseCategory, string>> = {
    third_party_fees: 'Ν.2859/2000 αρ.30 §1',
    rent: 'Ν.2859/2000 αρ.22 — Απαλλαγή ΦΠΑ ενοικίων',
    utilities: 'Ν.2859/2000 αρ.30 §1',
    telecom: 'ΠΟΛ.1029/2006 — 50% μικτή χρήση',
    fuel: 'Ν.2859/2000 αρ.30 §1 — Επαγγελματικό όχημα',
    vehicle_expenses: 'ΠΟΛ.1029/2006 — 50% μικτή χρήση',
    vehicle_insurance: 'Ν.2859/2000 αρ.22 — Ασφάλιστρα εκτός ΦΠΑ',
    office_supplies: 'Ν.2859/2000 αρ.30 §1',
    software: 'Ν.2859/2000 αρ.30 §1',
    equipment: 'Ν.2859/2000 αρ.30 §1',
    travel: 'Ν.2859/2000 αρ.30 §1',
    training: 'Ν.2859/2000 αρ.30 §1',
    advertising: 'Ν.2859/2000 αρ.30 §1',
    efka: 'Εκτός πεδίου ΦΠΑ — Ασφαλιστικές εισφορές',
    professional_tax: 'Εκτός πεδίου ΦΠΑ — Τέλος επιτηδεύματος',
    bank_fees: 'Ν.2859/2000 αρ.22 — Χρηματοπιστωτικές υπηρεσίες',
    tee_fees: 'Εκτός πεδίου ΦΠΑ — Εισφορές ΤΕΕ',
    depreciation: 'Λογιστική εγγραφή — Δεν υπάρχει ΦΠΑ',
    other_expense: 'Ν.2859/2000 αρ.30 §1',
  };

  for (const cat of expenseCategories) {
    const code = cat.code as ExpenseCategory;
    rulesMap.set(code, {
      category: code,
      deductiblePercent: cat.vatDeductiblePercent,
      legalBasis: legalBasisMap[code] ?? 'Ν.2859/2000 αρ.30',
      notes: cat.vatDeductiblePercent === 50 ? 'Μικτή χρήση (επαγγελματική + προσωπική)' : null,
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Λήψη ισχύοντος συντελεστή ΦΠΑ για δεδομένη ημερομηνία
 *
 * @param rate - Αριθμητικός συντελεστής (24, 13, 6, 0)
 * @param date - Ημερομηνία αναφοράς (ISO 8601), default = σήμερα
 * @returns VATRate ή null αν δεν βρεθεί
 */
export function getVatRateForDate(rate: number, date?: string): VATRate | null {
  const refDate = date ?? new Date().toISOString().split('T')[0];

  return (
    GREEK_VAT_RATES.find(
      (vr) =>
        vr.rate === rate &&
        vr.validFrom <= refDate &&
        (vr.validTo === null || vr.validTo >= refDate)
    ) ?? null
  );
}

/**
 * Λήψη myDATA κατηγορίας ΦΠΑ από συντελεστή
 *
 * @param rate - Αριθμητικός συντελεστής (24, 13, 6, 0)
 * @returns myDATA category number (1, 2, 3, 8) ή null
 */
export function getMyDataVatCategory(rate: number): number | null {
  const vatRate = GREEK_VAT_RATES.find((vr) => vr.rate === rate && vr.validTo === null);
  return vatRate?.mydataCategory ?? null;
}
