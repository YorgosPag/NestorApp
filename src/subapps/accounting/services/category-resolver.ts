/**
 * @fileoverview Category Resolver — Unified Built-in + Custom Category Lookup
 * @description Ενοποιημένος resolver για built-in (25) και user-defined κατηγορίες
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-18
 * @version 1.0.0
 * @see ADR-ACC-021 Custom Categories §4.2 Unified Flow
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import {
  ACCOUNT_CATEGORIES,
  getIncomeCategories,
  getExpenseCategories,
} from '../config/account-categories';
import type { CategoryDefinition } from '../types/journal';
import type { AccountCategory, EntryType } from '../types/common';
import type { CustomCategoryDocument } from '../types/custom-category';
import { isCustomCategoryCode } from '../types/custom-category';

// ============================================================================
// CATEGORY RESOLVER
// ============================================================================

/**
 * Unified resolver για built-in και custom κατηγορίες.
 *
 * Architecture (ADR-ACC-021 §4.2):
 * ```
 * Built-in (25, hardcoded) + Custom (N, Firestore)
 *         ↓
 *   CategoryResolver
 *         ↓
 *   Unified lookup
 * ```
 *
 * @remarks
 * Χρησιμοποιεί constructor injection για τις custom categories.
 * Το hook `useCustomCategories` παρέχει το array από Firestore.
 */
export class CategoryResolver {
  constructor(
    private readonly customCategories: readonly CustomCategoryDocument[]
  ) {}

  // ── Lookup ────────────────────────────────────────────────────────────────

  /**
   * Εύρεση κατηγορίας βάσει code (built-in ή custom).
   *
   * @param code - AccountCategory code (π.χ. 'service_income' ή 'custom_a3f8b2')
   * @returns CategoryDefinition ή undefined αν δεν βρεθεί
   */
  getCategoryByCode(code: AccountCategory): CategoryDefinition | undefined {
    if (isCustomCategoryCode(code)) {
      return this.customToDefinition(
        this.customCategories.find((c) => c.code === code)
      );
    }
    return ACCOUNT_CATEGORIES.find((cat) => cat.code === code);
  }

  /**
   * Όλες οι κατηγορίες εσόδων (built-in + custom income, ταξινομημένες)
   */
  getIncomeCategories(): CategoryDefinition[] {
    const builtIn = getIncomeCategories();
    const custom = this.customCategories
      .filter((c) => c.type === 'income' && c.isActive)
      .map((c) => this.customToDefinition(c))
      .filter((c): c is CategoryDefinition => c !== undefined);

    return [...builtIn, ...custom].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /**
   * Όλες οι κατηγορίες εξόδων (built-in + custom expense, ταξινομημένες)
   */
  getExpenseCategories(): CategoryDefinition[] {
    const builtIn = getExpenseCategories();
    const custom = this.customCategories
      .filter((c) => c.type === 'expense' && c.isActive)
      .map((c) => this.customToDefinition(c))
      .filter((c): c is CategoryDefinition => c !== undefined);

    return [...builtIn, ...custom].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /**
   * Όλες οι κατηγορίες ενός τύπου (income ή expense)
   */
  getCategoriesByType(type: EntryType): CategoryDefinition[] {
    return type === 'income'
      ? this.getIncomeCategories()
      : this.getExpenseCategories();
  }

  // ── Conversion ────────────────────────────────────────────────────────────

  /**
   * Μετατροπή CustomCategoryDocument → CategoryDefinition
   * (ίδιο shape με built-in — uniform interface για όλα τα consumers)
   */
  private customToDefinition(
    doc: CustomCategoryDocument | undefined
  ): CategoryDefinition | undefined {
    if (!doc) return undefined;

    return {
      code: doc.code,
      type: doc.type,
      label: doc.label,
      description: doc.description,
      mydataCode: doc.mydataCode,
      e3Code: doc.e3Code,
      defaultVatRate: doc.defaultVatRate,
      vatDeductible: doc.vatDeductible,
      vatDeductiblePercent: doc.vatDeductiblePercent,
      isActive: doc.isActive,
      sortOrder: doc.sortOrder,
      icon: doc.icon,
      kadCode: doc.kadCode,
    };
  }
}

// ============================================================================
// FACTORY — Standalone resolver (για server-side use χωρίς hook)
// ============================================================================

/**
 * Δημιουργεί CategoryResolver με δεδομένα custom categories.
 *
 * @param customCategories - Array από Firestore (ή κενό array αν δεν υπάρχουν)
 */
export function createCategoryResolver(
  customCategories: readonly CustomCategoryDocument[]
): CategoryResolver {
  return new CategoryResolver(customCategories);
}
