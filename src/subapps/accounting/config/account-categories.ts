/**
 * @fileoverview Accounting Subapp — Account Categories Registry
 * @description Πλήρες registry 24 κατηγοριών εσόδων-εξόδων (ADR-ACC-001 §4.3)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-001 Chart of Accounts §4.1–§4.3
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { AccountCategory, IncomeCategory, ExpenseCategory } from '../types/common';
import type { CategoryDefinition } from '../types/journal';

// ============================================================================
// ACCOUNT CATEGORIES — FULL REGISTRY (5 income + 19 expense = 24 total)
// ============================================================================

/**
 * Κεντρικοποιημένο registry κατηγοριών λογιστικού σχεδίου
 *
 * Single Source of Truth (SSoT) — ADR-ACC-001 §4.3
 * Κάθε κατηγορία φέρει πλήρη metadata: myDATA, E3, ΦΠΑ, ΚΑΔ κ.λπ.
 *
 * @remarks
 * Σειρά: πρώτα τα 5 έσοδα (sortOrder 1–5), μετά τα 19 έξοδα (sortOrder 6–24)
 */
export const ACCOUNT_CATEGORIES: readonly CategoryDefinition[] = [
  // ════════════════════════════════════════════════════════════════════════════
  // ΕΣΟΔΑ (5 κατηγορίες)
  // ════════════════════════════════════════════════════════════════════════════
  {
    code: 'service_income',
    type: 'income',
    label: 'Αμοιβές Υπηρεσιών',
    description: 'Μελέτες, ΠΕΑ, άδειες, ρυθμίσεις, επιβλέψεις',
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
    label: 'Κατασκευαστικά Έσοδα',
    description: 'Εργολαβίες κατασκευής (μη οικιστικά κτήρια)',
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
    label: 'Κατασκευαστικά (Οικιστικά)',
    description: 'Εργολαβίες κατασκευής (οικιστικά κτήρια)',
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
    code: 'asset_sale_income',
    type: 'income',
    label: 'Πώληση Παγίου',
    description: 'Πώληση εξοπλισμού, οχήματος, Η/Υ',
    mydataCode: 'category1_4',
    e3Code: '570_003',
    defaultVatRate: 24,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 4,
    icon: 'PackageOpen',
    kadCode: null,
  },
  {
    code: 'other_income',
    type: 'income',
    label: 'Λοιπά Έσοδα',
    description: 'Τόκοι, αποζημιώσεις, λοιπά',
    mydataCode: 'category1_5',
    e3Code: '561_005',
    defaultVatRate: 0,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 5,
    icon: 'Coins',
    kadCode: null,
  },

  // ════════════════════════════════════════════════════════════════════════════
  // ΕΞΟΔΑ (19 κατηγορίες)
  // ════════════════════════════════════════════════════════════════════════════
  {
    code: 'third_party_fees',
    type: 'expense',
    label: 'Αμοιβές Τρίτων',
    description: 'Υπεργολαβίες, συνεργάτες, λογιστής',
    mydataCode: 'category2_3',
    e3Code: '585_001',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 6,
    icon: 'Users',
    kadCode: null,
  },
  {
    code: 'rent',
    type: 'expense',
    label: 'Ενοίκιο Γραφείου',
    description: 'Μηνιαίο ενοίκιο επαγγελματικού χώρου',
    mydataCode: 'category2_3',
    e3Code: '585_002',
    defaultVatRate: 0,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 7,
    icon: 'DoorOpen',
    kadCode: null,
  },
  {
    code: 'utilities',
    type: 'expense',
    label: 'ΔΕΗ / Νερό / Θέρμανση',
    description: 'Ηλεκτρισμός, ύδρευση, θέρμανση γραφείου',
    mydataCode: 'category2_4',
    e3Code: '585_002',
    defaultVatRate: 6,
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 8,
    icon: 'Zap',
    kadCode: null,
  },
  {
    code: 'telecom',
    type: 'expense',
    label: 'Τηλεφωνία / Internet',
    description: 'Κινητό, σταθερό, internet γραφείου',
    mydataCode: 'category2_4',
    e3Code: '585_002',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 50,
    isActive: true,
    sortOrder: 9,
    icon: 'Phone',
    kadCode: null,
  },
  {
    code: 'fuel',
    type: 'expense',
    label: 'Καύσιμα',
    description: 'Βενζίνη, πετρέλαιο επαγγελματικού οχήματος',
    mydataCode: 'category2_5',
    e3Code: '585_006',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 10,
    icon: 'Fuel',
    kadCode: null,
  },
  {
    code: 'vehicle_expenses',
    type: 'expense',
    label: 'Έξοδα Οχήματος',
    description: 'Service, ελαστικά, ΚΤΕΟ, διόδια',
    mydataCode: 'category2_5',
    e3Code: '585_006',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 50,
    isActive: true,
    sortOrder: 11,
    icon: 'Car',
    kadCode: null,
  },
  {
    code: 'vehicle_insurance',
    type: 'expense',
    label: 'Ασφάλεια Οχήματος',
    description: 'Ετήσια ασφάλεια επαγγελματικού οχήματος',
    mydataCode: 'category2_5',
    e3Code: '585_006',
    defaultVatRate: 0,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 12,
    icon: 'Shield',
    kadCode: null,
  },
  {
    code: 'office_supplies',
    type: 'expense',
    label: 'Αναλώσιμα Γραφείου',
    description: 'Χαρτικά, μελάνια, αναλώσιμα εκτυπωτή',
    mydataCode: 'category2_5',
    e3Code: '585_006',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 13,
    icon: 'Paperclip',
    kadCode: null,
  },
  {
    code: 'software',
    type: 'expense',
    label: 'Λογισμικό / Subscriptions',
    description: 'AutoCAD, Office 365, Cloud, SaaS subscriptions',
    mydataCode: 'category2_5',
    e3Code: '585_006',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 14,
    icon: 'Monitor',
    kadCode: null,
  },
  {
    code: 'equipment',
    type: 'expense',
    label: 'Εξοπλισμός (<1.500€)',
    description: 'Μικροεξοπλισμός κάτω από 1.500€ (δεν αποσβένεται)',
    mydataCode: 'category2_5',
    e3Code: '585_006',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 15,
    icon: 'Wrench',
    kadCode: null,
  },
  {
    code: 'travel',
    type: 'expense',
    label: 'Ταξίδια / Μετακινήσεις',
    description: 'Αεροπορικά, ξενοδοχεία, ημερήσιες αποζημιώσεις',
    mydataCode: 'category2_5',
    e3Code: '585_006',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 16,
    icon: 'Plane',
    kadCode: null,
  },
  {
    code: 'training',
    type: 'expense',
    label: 'Εκπαίδευση / Σεμινάρια',
    description: 'Επαγγελματικά σεμινάρια, πιστοποιήσεις',
    mydataCode: 'category2_5',
    e3Code: '585_006',
    defaultVatRate: 6,
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 17,
    icon: 'GraduationCap',
    kadCode: null,
  },
  {
    code: 'advertising',
    type: 'expense',
    label: 'Διαφήμιση / Marketing',
    description: 'Google Ads, social media, εκτυπώσεις',
    mydataCode: 'category2_5',
    e3Code: '585_016',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 18,
    icon: 'Megaphone',
    kadCode: null,
  },
  {
    code: 'efka',
    type: 'expense',
    label: 'Εισφορές ΕΦΚΑ',
    description: 'Μηνιαίες ασφαλιστικές εισφορές ΕΦΚΑ',
    mydataCode: 'category2_12',
    e3Code: '585_005',
    defaultVatRate: 0,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 19,
    icon: 'HeartPulse',
    kadCode: null,
  },
  {
    code: 'professional_tax',
    type: 'expense',
    label: 'Τέλος Επιτηδεύματος',
    description: 'Ετήσιο τέλος επιτηδεύματος (650€/1.000€)',
    mydataCode: 'category2_12',
    e3Code: '585_009',
    defaultVatRate: 0,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 20,
    icon: 'Receipt',
    kadCode: null,
  },
  {
    code: 'bank_fees',
    type: 'expense',
    label: 'Τραπεζικά Έξοδα',
    description: 'Προμήθειες, τόκοι, κόστη τραπεζικών συναλλαγών',
    mydataCode: 'category2_12',
    e3Code: '585_008',
    defaultVatRate: 0,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 21,
    icon: 'Landmark',
    kadCode: null,
  },
  {
    code: 'tee_fees',
    type: 'expense',
    label: 'Εισφορές ΤΕΕ',
    description: 'Εισφορές Τεχνικού Επιμελητηρίου Ελλάδας',
    mydataCode: 'category2_12',
    e3Code: '585_009',
    defaultVatRate: 0,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 22,
    icon: 'Award',
    kadCode: null,
  },
  {
    code: 'depreciation',
    type: 'expense',
    label: 'Αποσβέσεις',
    description: 'Ετήσιες αποσβέσεις παγίων (H/Y, αυτοκίνητο, εξοπλισμός)',
    mydataCode: 'category2_11',
    e3Code: '587_001',
    defaultVatRate: 0,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    isActive: true,
    sortOrder: 23,
    icon: 'TrendingDown',
    kadCode: null,
  },
  {
    code: 'other_expense',
    type: 'expense',
    label: 'Λοιπά Έξοδα',
    description: 'Μη κατηγοριοποιημένα λειτουργικά έξοδα',
    mydataCode: 'category2_14',
    e3Code: '585_016',
    defaultVatRate: 24,
    vatDeductible: true,
    vatDeductiblePercent: 100,
    isActive: true,
    sortOrder: 24,
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
 * console.log(cat?.label); // 'Αμοιβές Υπηρεσιών'
 * ```
 */
export function getCategoryByCode(code: AccountCategory): CategoryDefinition | undefined {
  return ACCOUNT_CATEGORIES.find((cat) => cat.code === code);
}

/**
 * Επιστρέφει μόνο τις κατηγορίες εσόδων
 *
 * @returns Πίνακας 5 income categories, ταξινομημένες κατά sortOrder
 */
export function getIncomeCategories(): CategoryDefinition[] {
  return ACCOUNT_CATEGORIES.filter(
    (cat): cat is CategoryDefinition & { code: IncomeCategory } => cat.type === 'income'
  );
}

/**
 * Επιστρέφει μόνο τις κατηγορίες εξόδων
 *
 * @returns Πίνακας 19 expense categories, ταξινομημένες κατά sortOrder
 */
export function getExpenseCategories(): CategoryDefinition[] {
  return ACCOUNT_CATEGORIES.filter(
    (cat): cat is CategoryDefinition & { code: ExpenseCategory } => cat.type === 'expense'
  );
}

/**
 * Αναζήτηση κατηγορίας βάσει myDATA code
 *
 * @param mydataCode - myDATA classification code (π.χ. 'category1_3')
 * @returns Πρώτη κατηγορία που ταιριάζει, ή undefined
 *
 * @remarks
 * Ένας myDATA code μπορεί να αντιστοιχεί σε πολλές κατηγορίες.
 * Π.χ. category2_5 → fuel, vehicle_expenses, office_supplies, κ.λπ.
 * Αυτή η function επιστρέφει την **πρώτη** (μικρότερο sortOrder).
 */
export function getCategoryByMyDataCode(mydataCode: string): CategoryDefinition | undefined {
  return ACCOUNT_CATEGORIES.find((cat) => cat.mydataCode === mydataCode);
}

/**
 * Επιστρέφει όλες τις κατηγορίες που αντιστοιχούν σε myDATA code
 *
 * @param mydataCode - myDATA classification code
 * @returns Πίνακας κατηγοριών (μπορεί να είναι κενός)
 */
export function getCategoriesByMyDataCode(mydataCode: string): CategoryDefinition[] {
  return ACCOUNT_CATEGORIES.filter((cat) => cat.mydataCode === mydataCode);
}

/**
 * Επιστρέφει μόνο τις ενεργές κατηγορίες
 *
 * @returns Πίνακας ενεργών categories
 */
export function getActiveCategories(): CategoryDefinition[] {
  return ACCOUNT_CATEGORIES.filter((cat) => cat.isActive);
}
