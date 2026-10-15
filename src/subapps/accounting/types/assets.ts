/**
 * @fileoverview Accounting Subapp — Fixed Assets & Depreciation Types
 * @description Τύποι για πάγια στοιχεία και αποσβέσεις
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-007 Fixed Assets & Depreciation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { AccountingAuditEntry } from './accounting-audit';

// ============================================================================
// ASSET CATEGORY & STATUS
// ============================================================================

/**
 * Κατηγορίες παγίων στοιχείων
 *
 * Κάθε κατηγορία έχει δικό της συντελεστή απόσβεσης (Ν.4172/2013, αρ.24). Οι συντελεστές ζουν ΜΟΝΟ στο SSoT
 * `services/config/depreciation-config.ts` — μην τους ξαναγράψεις εδώ ούτε σε σχόλιο.
 */
export const ASSET_CATEGORIES = [
  'buildings',               // Κτίρια
  'machinery',               // Μηχανήματα
  'vehicles',                // Οχήματα
  'furniture',               // Έπιπλα & εξοπλισμός
  'computers',               // Η/Υ & λογισμικό
  'measurement_instruments', // Όργανα μέτρησης
  'other',                   // Λοιπά πάγια
] as const;

export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

/**
 * Κατάσταση παγίου
 *
 * - `active`: Ενεργό, σε χρήση, αποσβένεται
 * - `fully_depreciated`: Πλήρως αποσβεσμένο (αξία 0)
 * - `disposed`: Πωλήθηκε ή διαγράφτηκε
 * - `inactive`: Αδρανές (δεν χρησιμοποιείται αλλά δεν πωλήθηκε)
 */
export const ASSET_STATUSES = ['active', 'fully_depreciated', 'disposed', 'inactive'] as const;

export type AssetStatus = (typeof ASSET_STATUSES)[number];

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
  /** Ετήσιος συντελεστής απόσβεσης (%) — τον αποφασίζει ο διακομιστής από την κατηγορία (`depreciation-config`). */
  depreciationRate: number;
  /** Μέθοδος απόσβεσης */
  depreciationMethod: 'straight_line';
  /** Ωφέλιμη ζωή σε έτη */
  usefulLifeYears: number;
  /**
   * Η νεότερη χρήση με καταχωρημένη απόσβεση. Τα `accumulatedDepreciation` / `netBookValue` είναι η ΠΡΟΒΟΛΗ του
   * κλεισίματος αυτής της χρήσης· η αλήθεια είναι οι εγγραφές `accounting_depreciation_records`.
   * Λείπει σε πάγια πριν από τη Φάση 4 (ADR-ACC-010 §2.1.1) = καμία καταχώριση.
   */
  lastDepreciatedFiscalYear?: number | null;

  // — Τιμολόγιο Αγοράς —
  /** Αριθμός τιμολογίου αγοράς */
  purchaseInvoiceNumber: string | null;
  /** Προμηθευτής */
  supplierName: string | null;
  /** ΑΦΜ προμηθευτή */
  supplierVatNumber: string | null;

  // — Tenant Isolation (Q3/Q7) —
  /** Company ID for tenant isolation */
  companyId?: string;
  /** User who created this document */
  createdBy?: string;

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

  // — Tenant Isolation (Q3/Q7) —
  /** Company ID for tenant isolation */
  companyId?: string;
  /** User who created this document */
  createdBy?: string;

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
 * Εξαιρεί auto-generated πεδία — και τον συντελεστή: τον αποφασίζει ο διακομιστής από την κατηγορία.
 */
export type CreateFixedAssetInput = Omit<
  FixedAsset,
  | 'assetId'
  | 'accumulatedDepreciation'
  | 'netBookValue'
  | 'fullyDepreciatedDate'
  | 'disposalDate'
  | 'lastDepreciatedFiscalYear'
  | 'depreciationRate'
  | 'createdAt'
  | 'updatedAt'
>;

/**
 * Φίλτρα της ΣΕΛΙΔΑΣ οθόνης παγίων. Οι υποστηριζόμενοι συνδυασμοί (κλειστό σύνολο, ο καθένας με δείκτη) ζουν στο
 * `FIXED_ASSET_LIST` (`services/repository/accounting-list-specs.ts`).
 * ⚠️ `acquisitionDateRange` / `searchText` αφαιρέθηκαν (2026-10-15): δηλώνονταν, ΔΕΝ εφαρμόζονταν.
 */
export interface FixedAssetFilters {
  /** Κατηγορία */
  category?: AssetCategory;
  /** Κατάσταση */
  status?: AssetStatus;
  /** Φορολογικό έτος κτήσης */
  acquisitionYear?: number;
}

// ============================================================================
// DEPRECIATION RUN — πλήρης σάρωση + καταχώριση (ADR-ACC-010 §2.1.1 Φάση 4)
// ============================================================================

/**
 * Εμβέλεια σάρωσης παγίων για ΥΠΟΛΟΓΙΣΜΟ — `depreciationYear`: όσα άρχισαν να χρησιμοποιούνται ως το τέλος της
 * χρήσης, ανεξαρτήτως κατάστασης (και όσα εκποιήθηκαν μέσα στη χρήση).
 */
export type FixedAssetLedgerScope = { readonly kind: 'depreciationYear'; readonly fiscalYear: number };

/** Ερώτημα σάρωσης παγίων — χωρίς `pageSize`, ώστε το κόψιμο να είναι αδύνατο από τον τύπο. */
export interface FixedAssetLedgerQuery {
  readonly scope: FixedAssetLedgerScope;
}

/**
 * Αίτημα καταχώρισης της απόσβεσης ΜΙΑΣ χρήσης για ΕΝΑ πάγιο. Το `compute` τρέχει ΜΕΣΑ στη συναλλαγή, πάνω στο
 * ΦΡΕΣΚΟ έγγραφο του παγίου — ποτέ σε αντίγραφο της σάρωσης που μπορεί να άλλαξε στο μεταξύ.
 */
export interface DepreciationPostingRequest {
  readonly assetId: string;
  readonly fiscalYear: number;
  /** `null` = τίποτα προς καταχώριση (π.χ. μηδενική απόσβεση). */
  readonly compute: (asset: FixedAsset) => DepreciationPosting | null;
  /** Το ίχνος ελέγχου — γράφεται στην ΙΔΙΑ συναλλαγή με την εγγραφή (το συνθέτει ο audited wrapper). */
  readonly auditOf?: (record: DepreciationRecord) => readonly AccountingAuditEntry[];
}

/** Τι γράφεται: η εγγραφή απόσβεσης + η νέα προβολή του παγίου. */
export interface DepreciationPosting {
  readonly record: Omit<DepreciationRecord, 'recordId'>;
  readonly assetProjection: Pick<FixedAsset, 'accumulatedDepreciation' | 'netBookValue' | 'status' | 'fullyDepreciatedDate'>;
}

/** Αποτέλεσμα καταχώρισης — ιδεμπότητο: η ίδια (πάγιο, χρήση) δεύτερη φορά δίνει `already_posted`. */
export type DepreciationPostingOutcome =
  | { readonly kind: 'posted'; readonly record: DepreciationRecord }
  | { readonly kind: 'already_posted'; readonly record: DepreciationRecord }
  | { readonly kind: 'nothing_to_post' };

/** Αποτέλεσμα εκτέλεσης αποσβέσεων χρήσης (SAP AFAB / Xero «run depreciation»). */
export interface DepreciationRunResult {
  readonly fiscalYear: number;
  /** Γράφτηκαν ΤΩΡΑ. */
  readonly posted: readonly DepreciationRecord[];
  /** Υπήρχαν ήδη από προηγούμενη εκτέλεση — δεν ξαναγράφτηκαν. */
  readonly alreadyPosted: readonly DepreciationRecord[];
  /** Σύνολο απόσβεσης της χρήσης (`posted` + `alreadyPosted`) — ίδιο σε κάθε επανεκτέλεση. */
  readonly totalDepreciation: number;
}
