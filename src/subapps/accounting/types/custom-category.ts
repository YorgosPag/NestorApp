/**
 * @fileoverview Accounting Subapp — Custom Category Types
 * @description Τύποι για user-defined κατηγορίες εσόδων/εξόδων (ADR-ACC-021)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-18
 * @version 1.0.0
 * @see ADR-ACC-021 Custom Categories
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { EntryType, MyDataIncomeType, MyDataExpenseType } from './common';

// ============================================================================
// CUSTOM CATEGORY CODE TYPE (ADR-ACC-021 §Απόφαση 2)
// ============================================================================

/**
 * Template literal type για custom category codes.
 *
 * Εγγυάται compile-time ότι κάθε custom code ξεκινά με `custom_`.
 * Zero collision με built-in codes (service_income, third_party_fees κ.λπ.).
 *
 * @example
 * const code: CustomCategoryCode = 'custom_a3f8b2c1'; // ✅
 * const code: CustomCategoryCode = 'service_income';  // ❌ TypeScript error
 */
export type CustomCategoryCode = `custom_${string}`;

/**
 * Type guard — ελέγχει αν ένα string είναι CustomCategoryCode
 *
 * @param code - Οποιοδήποτε string
 * @returns true αν το code ξεκινά με 'custom_'
 *
 * @example
 * isCustomCategoryCode('custom_a3f8b2') // true
 * isCustomCategoryCode('third_party_fees') // false
 */
export function isCustomCategoryCode(code: string): code is CustomCategoryCode {
  return code.startsWith('custom_');
}

// ============================================================================
// CUSTOM CATEGORY DOCUMENT (Firestore: accounting_custom_categories/{id})
// ============================================================================

/**
 * Firestore document για user-defined κατηγορία εσόδου/εξόδου.
 *
 * Firestore path: `accounting_custom_categories/{categoryId}`
 *
 * Enterprise ID format: `custcat_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`
 * Code format: `custom_xxxxxxxx` (auto-generated, immutable)
 *
 * @remarks
 * - `categoryId` = Enterprise ID (immutable, never changes)
 * - `code` = CustomCategoryCode (immutable, referenced by journal entries)
 * - `label` = mutable display name (αλλαγή label δεν επηρεάζει παλιές εγγραφές)
 * - `vatDeductiblePercent` = default inherit από myDATA code, user μπορεί να override
 * - `isActive` = false → soft delete (εξαφανίζεται από dropdowns, παλιές εγγραφές intact)
 */
export interface CustomCategoryDocument {
  /** Enterprise ID — `custcat_xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx` */
  categoryId: string;

  /**
   * Immutable unique code — `custom_xxxxxxxx`
   * Generated από enterprise-id.service, ΠΟΤΕ δεν αλλάζει.
   * Referenced by JournalEntry.category
   */
  code: CustomCategoryCode;

  /** Τύπος: έσοδο ή έξοδο */
  type: EntryType;

  /**
   * Ελληνικό display name (mutable)
   * Αλλαγή label ΔΕΝ επηρεάζει παλιές journal entries (denormalized snapshot pattern).
   */
  label: string;

  /** Αναλυτική περιγραφή */
  description: string;

  /**
   * myDATA classification code (ΥΠΟΧΡΕΩΤΙΚΟ — νομική υποχρέωση)
   * Κάθε παραστατικό υποβάλλεται στο ΑΑΔΕ με valid classification.
   */
  mydataCode: MyDataIncomeType | MyDataExpenseType;

  /** E3 φορολογικός κωδικός (inherited από myDATA code) */
  e3Code: string;

  /** Προεπιλεγμένος συντελεστής ΦΠΑ (24, 13, 6, 0) */
  defaultVatRate: number;

  /** Εκπίπτει ο ΦΠΑ; */
  vatDeductible: boolean;

  /**
   * Ποσοστό έκπτωσης ΦΠΑ (0, 50, 100)
   * Default: inherited από myDATA code.
   * Override: λογιστής μπορεί να αλλάξει (audit trail via updatedAt).
   */
  vatDeductiblePercent: 0 | 50 | 100;

  /**
   * Ενεργή κατηγορία
   * false = soft delete — εξαφανίζεται από dropdowns, παλιές εγγραφές intact.
   */
  isActive: boolean;

  /**
   * Σειρά εμφάνισης στο UI
   * Ξεκινά από 100 — αποφεύγει collision με built-in (1–25).
   */
  sortOrder: number;

  /** Lucide icon name (default: 'Tag') */
  icon: string;

  /** ΚΑΔ κωδικός (income only, συνήθως null) */
  kadCode: string | null;

  /** Timestamp δημιουργίας (ISO 8601) */
  createdAt: string;

  /** Timestamp τελευταίας ενημέρωσης (ISO 8601) */
  updatedAt: string;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

/**
 * Input για δημιουργία νέας custom category.
 * Εξαιρεί auto-generated πεδία (categoryId, code, createdAt, updatedAt).
 */
export interface CreateCustomCategoryInput {
  type: EntryType;
  label: string;
  description: string;
  mydataCode: MyDataIncomeType | MyDataExpenseType;
  e3Code: string;
  defaultVatRate: number;
  vatDeductible: boolean;
  vatDeductiblePercent: 0 | 50 | 100;
  sortOrder?: number;
  icon?: string;
  kadCode?: string | null;
}

/**
 * Input για ενημέρωση custom category.
 * Εξαιρεί immutable πεδία (categoryId, code, createdAt).
 * ΑΠΑΓΟΡΕΥΕΤΑΙ αλλαγή του `code` — θα έσπαζε references σε journal entries.
 */
export type UpdateCustomCategoryInput = Partial<
  Omit<CustomCategoryDocument, 'categoryId' | 'code' | 'createdAt'>
>;
