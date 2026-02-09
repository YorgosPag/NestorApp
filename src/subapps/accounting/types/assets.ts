/**
 * @fileoverview Accounting Subapp — Fixed Assets & Depreciation Types
 * @description Τύποι για πάγια στοιχεία και αποσβέσεις
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-007 Fixed Assets & Depreciation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { PeriodRange } from './common';

// ============================================================================
// ASSET CATEGORY & STATUS
// ============================================================================

/**
 * Κατηγορίες παγίων στοιχείων
 *
 * Κάθε κατηγορία έχει διαφορετικό συντελεστή απόσβεσης (Ν.4172/2013, αρ.24).
 */
export type AssetCategory =
  | 'buildings'               // Κτίρια (4%)
  | 'machinery'               // Μηχανήματα (10%)
  | 'vehicles'                // Οχήματα (16%)
  | 'furniture'               // Έπιπλα & εξοπλισμός (10%)
  | 'computers'               // Η/Υ & λογισμικό (20%)
  | 'measurement_instruments' // Όργανα μέτρησης (10%)
  | 'other';                  // Λοιπά πάγια (10%)

/**
 * Κατάσταση παγίου
 *
 * - `active`: Ενεργό, σε χρήση, αποσβένεται
 * - `fully_depreciated`: Πλήρως αποσβεσμένο (αξία 0)
 * - `disposed`: Πωλήθηκε ή διαγράφτηκε
 * - `inactive`: Αδρανές (δεν χρησιμοποιείται αλλά δεν πωλήθηκε)
 */
export type AssetStatus = 'active' | 'fully_depreciated' | 'disposed' | 'inactive';

// ============================================================================
// DEPRECIATION RATE CONFIG
// ============================================================================

/**
 * Συντελεστής απόσβεσης ανά κατηγορία
 *
 * Βάσει Ν.4172/2013 αρ.24 (Κώδικας Φορολογίας Εισοδήματος).
 */
export interface DepreciationRateConfig {
  /** Κατηγορία παγίου */
  category: AssetCategory;
  /** Ετήσιος συντελεστής απόσβεσης (%) */
  annualRate: number;
  /** Μέθοδος απόσβεσης */
  method: 'straight_line';
  /** Νομική βάση */
  legalBasis: string;
  /** Ετικέτα κατηγορίας */
  label: string;
}

// ============================================================================
// FIXED ASSET — Πάγιο Στοιχείο
// ============================================================================

/**
 * Πλήρης εγγραφή παγίου στοιχείου
 *
 * Firestore path: `accounting_fixed_assets/{assetId}`
 */
export interface FixedAsset {
  /** Μοναδικό αναγνωριστικό (Firestore doc ID) */
  assetId: string;
  /** Περιγραφή παγίου */
  description: string;
  /** Κατηγορία */
  category: AssetCategory;
  /** Κατάσταση */
  status: AssetStatus;

  // — Αξίες —
  /** Αξία κτήσης (αγοράς) σε EUR */
  acquisitionCost: number;
  /** Σωρευμένες αποσβέσεις σε EUR */
  accumulatedDepreciation: number;
  /** Τρέχουσα (αναπόσβεστη) αξία σε EUR */
  netBookValue: number;
  /** Υπολειμματική αξία (συνήθως 0 για ελ. επαγγελματίες) */
  residualValue: number;

  // — Ημερομηνίες —
  /** Ημερομηνία αγοράς/κτήσης (ISO 8601) */
  acquisitionDate: string;
  /** Ημερομηνία έναρξης απόσβεσης (ISO 8601) */
  depreciationStartDate: string;
  /** Ημερομηνία πλήρους απόσβεσης (ISO 8601, null αν δεν ολοκληρώθηκε) */
  fullyDepreciatedDate: string | null;
  /** Ημερομηνία εκποίησης (ISO 8601, null αν δεν πωλήθηκε) */
  disposalDate: string | null;

  // — Απόσβεση —
  /** Ετήσιος συντελεστής απόσβεσης (%) */
  depreciationRate: number;
  /** Μέθοδος απόσβεσης */
  depreciationMethod: 'straight_line';
  /** Ωφέλιμη ζωή σε έτη */
  usefulLifeYears: number;

  // — Τιμολόγιο Αγοράς —
  /** Αριθμός τιμολογίου αγοράς */
  purchaseInvoiceNumber: string | null;
  /** Προμηθευτής */
  supplierName: string | null;
  /** ΑΦΜ προμηθευτή */
  supplierVatNumber: string | null;

  // — Metadata —
  /** Σημειώσεις */
  notes: string | null;
  /** Φορολογικό έτος κτήσης */
  acquisitionFiscalYear: number;
  /** Timestamp δημιουργίας (ISO 8601) */
  createdAt: string;
  /** Timestamp τελευταίας ενημέρωσης (ISO 8601) */
  updatedAt: string;
}

// ============================================================================
// DEPRECIATION RECORD
// ============================================================================

/**
 * Εγγραφή ετήσιας απόσβεσης
 *
 * Μία εγγραφή ανά πάγιο ανά φορολογικό έτος.
 */
export interface DepreciationRecord {
  /** Μοναδικό ID */
  recordId: string;
  /** Αναφορά σε πάγιο */
  assetId: string;
  /** Φορολογικό έτος */
  fiscalYear: number;
  /** Αξία κτήσης (για αναφορά) */
  acquisitionCost: number;
  /** Σωρευμένη απόσβεση αρχής περιόδου */
  openingAccumulatedDepreciation: number;
  /** Ποσό απόσβεσης τρέχοντος έτους */
  annualDepreciation: number;
  /** Σωρευμένη απόσβεση τέλους περιόδου */
  closingAccumulatedDepreciation: number;
  /** Αναπόσβεστη αξία τέλους περιόδου */
  closingNetBookValue: number;
  /** Συντελεστής που εφαρμόστηκε (%) */
  appliedRate: number;
  /** Αναλογία μηνών (π.χ. 6/12 αν αγοράστηκε μέσα στο έτος) */
  monthsApplied: number;
  /** Αντιστοιχεί σε εγγραφή Ε-Ε; (journal entry ID) */
  journalEntryId: string | null;
  /** Ημερομηνία εκτέλεσης (ISO 8601) */
  calculatedAt: string;
}

// ============================================================================
// DISPOSAL RESULT
// ============================================================================

/**
 * Αποτέλεσμα εκποίησης/διαγραφής παγίου
 *
 * Υπολογίζει κέρδος/ζημιά από πώληση ή διαγραφή.
 */
export interface DisposalResult {
  /** ID παγίου */
  assetId: string;
  /** Αξία κτήσης */
  acquisitionCost: number;
  /** Σωρευμένες αποσβέσεις κατά τη στιγμή της εκποίησης */
  accumulatedDepreciation: number;
  /** Αναπόσβεστη αξία (book value) */
  netBookValue: number;
  /** Τιμή πώλησης (0 αν διαγραφή) */
  salePrice: number;
  /** Κέρδος από εκποίηση (sale - book, αν θετικό) */
  gain: number;
  /** Ζημιά από εκποίηση (book - sale, αν θετικό) */
  loss: number;
  /** Ημερομηνία εκποίησης (ISO 8601) */
  disposalDate: string;
  /** Τύπος εκποίησης */
  disposalType: 'sale' | 'write_off' | 'donation';
}

// ============================================================================
// INPUT / FILTER TYPES
// ============================================================================

/**
 * Input για δημιουργία νέου παγίου
 * Εξαιρεί auto-generated πεδία
 */
export type CreateFixedAssetInput = Omit<
  FixedAsset,
  'assetId' | 'accumulatedDepreciation' | 'netBookValue' | 'fullyDepreciatedDate' | 'disposalDate' | 'createdAt' | 'updatedAt'
>;

/** Φίλτρα αναζήτησης παγίων */
export interface FixedAssetFilters {
  /** Κατηγορία */
  category?: AssetCategory;
  /** Κατάσταση */
  status?: AssetStatus;
  /** Φορολογικό έτος κτήσης */
  acquisitionYear?: number;
  /** Εύρος ημερομηνιών κτήσης */
  acquisitionDateRange?: PeriodRange;
  /** Αναζήτηση κειμένου (περιγραφή, προμηθευτής) */
  searchText?: string;
}
