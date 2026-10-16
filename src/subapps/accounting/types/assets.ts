/**
 * @fileoverview Accounting Subapp — Fixed Assets & Depreciation Types
 * @description Τύποι για πάγια στοιχεία και αποσβέσεις
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-007 Fixed Assets & Depreciation
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { CreateJournalEntryInput } from './journal';
import type { PostingPeriodDenial } from './fiscal-period';

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
  /**
   * ΟΛΕΣ οι χρήσεις με καταχωρημένη (μη μηδενική) απόσβεση — ADR-ACC-010 §2.1.1 Φ5. Η αναίρεση της νεότερης ξέρει έτσι
   * σε ποια χρήση γυρίζει η προβολή, χωρίς ερώτημα. Λείπει σε πάγια πριν από τη Φάση 5 ⇒ `[lastDepreciatedFiscalYear]`.
   */
  depreciatedFiscalYears?: number[];

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
  /** Η ΝΕΟΤΕΡΗ εγγραφή Ε-Ε (η διαφορά της τελευταίας αναθεώρησης) — `null` πριν καταχωρηθεί στο βιβλίο. */
  journalEntryId: string | null;
  /**
   * ΟΛΕΣ οι εγγραφές Ε-Ε της απόσβεσης, με τη σειρά — ADR-ACC-010 §2.1.1 Φ5. Το άθροισμά τους στο βιβλίο ΙΣΟΥΤΑΙ με
   * το `annualDepreciation` (SAP repeat run: κάθε διόρθωση = ΝΕΑ εγγραφή διαφοράς, ποτέ αλλαγή της παλιάς).
   */
  journalEntryIds?: string[];
  /** Πόσες φορές άλλαξε το καταχωρημένο ποσό (1 = πρώτη καταχώριση). Λείπει πριν από τη Φάση 5 ⇒ 0. */
  revision?: number;

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
 * Τι ζητά η εκτέλεση για (πάγιο, χρήση) — ADR-ACC-010 §2.1.1 Φ5:
 * - `book`: το καταχωρημένο ποσό να ΣΥΓΚΛΙΝΕΙ στο σωστό του πίνακα αποσβέσεων (πρώτη φορά = όλο, μετά = η διαφορά —
 *   SAP AFAB repeat run)·
 * - `reverse`: να συγκλίνει στο 0 (Xero «rollback depreciation») — μόνο για τη ΝΕΟΤΕΡΗ καταχωρημένη χρήση.
 */
export type DepreciationIntent = 'book' | 'reverse';

/** Ό,τι διάβασε η συναλλαγή — η απόφαση παίρνεται ΠΑΝΩ σε αυτό, ποτέ σε αντίγραφο της σάρωσης. */
export interface DepreciationDecisionInput {
  readonly asset: FixedAsset;
  readonly current: DepreciationRecord | null;
}

/** Η εγγραφή Ε-Ε της διαφοράς, χωρίς ταυτότητα και προέλευση (τις βάζει ο γραφέας από (εγγραφή, αναθεώρηση)). */
export type DepreciationJournalLine = Omit<CreateJournalEntryInput, 'source'>;

/** Η προβολή του παγίου: το κλείσιμο της νεότερης καταχωρημένης χρήσης. */
export type DepreciationAssetProjection = Required<Pick<
  FixedAsset,
  'accumulatedDepreciation' | 'netBookValue' | 'status' | 'fullyDepreciatedDate' | 'lastDepreciatedFiscalYear' | 'depreciatedFiscalYears'
>>;

/** Λόγος άρνησης ανά πάγιο. */
export type DepreciationRefusal = 'LATER_YEAR_POSTED';

/** Η απόφαση για (πάγιο, χρήση) — καθαρή συνάρτηση της μηχανής, την εκτελεί ΕΝΑΣ γραφέας. */
export type DepreciationDecision =
  /** Καταχωρημένο = σωστό (ή τίποτα και στα δύο) — καμία εγγραφή. */
  | { readonly kind: 'unchanged' }
  /** Αναίρεση χρήσης που ΔΕΝ είναι η νεότερη καταχωρημένη: θα άφηνε κενό στη σειρά (Xero: rollback από το τέλος). */
  | { readonly kind: 'refused'; readonly reason: DepreciationRefusal }
  | {
      readonly kind: 'post';
      /** Η εγγραφή απόσβεσης μετά τη σύγκλιση (ταυτότητα / αναθεώρηση / εγγραφές Ε-Ε τα βάζει ο γραφέας). */
      readonly record: Omit<DepreciationRecord, 'recordId' | 'journalEntryId' | 'journalEntryIds' | 'revision'>;
      /** Η εγγραφή της ΔΙΑΦΟΡΑΣ στο βιβλίο (αρνητική = αντιλογισμός). */
      readonly journal: DepreciationJournalLine;
      /** Η νέα προβολή του παγίου — `null` = δεν αλλάζει (παλαιότερη χρήση από τη νεότερη καταχωρημένη). */
      readonly assetProjection: DepreciationAssetProjection | null;
    };

/** Τι άλλαξε σε μία σύγκλιση — για το ίχνος ελέγχου και το αποτέλεσμα. */
export interface DepreciationPostedChange {
  readonly intent: DepreciationIntent;
  readonly record: DepreciationRecord;
  /** Η διαφορά που μπήκε στο βιβλίο (αρνητική = αντιλογισμός). */
  readonly delta: number;
  readonly journalEntryId: string;
  /** `true` = υπήρχε ήδη καταχωρημένο ποσό (διόρθωση ή αναίρεση, όχι πρώτη καταχώριση). */
  readonly wasPosted: boolean;
}

/**
 * Αίτημα σύγκλισης της απόσβεσης ΜΙΑΣ χρήσης για ΕΝΑ πάγιο. Το `decide` τρέχει ΜΕΣΑ στη συναλλαγή, πάνω στα ΦΡΕΣΚΑ
 * έγγραφα — ποτέ σε αντίγραφο της σάρωσης που μπορεί να άλλαξε στο μεταξύ.
 */
export interface DepreciationPostingRequest {
  readonly assetId: string;
  readonly fiscalYear: number;
  readonly decide: (input: DepreciationDecisionInput) => DepreciationDecision;
}

/** Αποτέλεσμα σύγκλισης — ιδεμπότητο: η ίδια (πάγιο, χρήση) δεύτερη φορά δίνει `unchanged`. */
export type DepreciationPostingOutcome =
  | { readonly kind: 'posted'; readonly change: DepreciationPostedChange }
  | { readonly kind: 'unchanged'; readonly record: DepreciationRecord | null }
  | { readonly kind: 'refused'; readonly assetId: string; readonly reason: DepreciationRefusal };

/** Αποτέλεσμα εκτέλεσης (καταχώρισης ή αναίρεσης) αποσβέσεων χρήσης. */
export interface DepreciationRunResult {
  readonly fiscalYear: number;
  readonly intent: DepreciationIntent;
  /** Πρώτη καταχώριση ΤΩΡΑ. */
  readonly posted: readonly DepreciationPostedChange[];
  /** Διόρθωση (διαφορά) ή αναίρεση ΤΩΡΑ, πάνω σε ήδη καταχωρημένο ποσό. */
  readonly adjusted: readonly DepreciationPostedChange[];
  /** Ήταν ήδη σωστά — δεν γράφτηκε τίποτα. */
  readonly unchanged: readonly DepreciationRecord[];
  /** Αρνήθηκαν (π.χ. αναίρεση χρήσης που δεν είναι η νεότερη του παγίου). */
  readonly refused: readonly { readonly assetId: string; readonly reason: DepreciationRefusal }[];
  /** Καταχωρημένη απόσβεση της χρήσης ΜΕΤΑ την εκτέλεση — ίδια σε κάθε επανεκτέλεση. */
  readonly totalDepreciation: number;
  /** Η καθαρή μεταβολή εξόδων που μπήκε στο βιβλίο σε ΑΥΤΗ την εκτέλεση (0 στην επανεκτέλεση). */
  readonly bookedDelta: number;
}

/** Μία γραμμή προεπισκόπησης (SAP AFAB test run / Xero «Run depreciation» πριν το Post). */
export interface DepreciationPreviewLine {
  readonly assetId: string;
  readonly description: string;
  readonly category: AssetCategory;
  readonly appliedRate: number;
  readonly monthsApplied: number;
  /** Το σωστό ποσό της χρήσης κατά τον πίνακα αποσβέσεων. */
  readonly target: number;
  /** Ό,τι είναι ήδη καταχωρημένο στο βιβλίο. */
  readonly booked: number;
  /** Τι θα μπει στο βιβλίο με την καταχώριση (`target − booked`). */
  readonly delta: number;
}

/**
 * Γιατί η καταχώριση / αναίρεση δεν επιτρέπεται (η προεπισκόπηση επιτρέπεται ΠΑΝΤΑ). Η περίοδος αρνείται με ΤΟ
 * λεξιλόγιο καταχώρησης (`POSTING_PERIOD_DENIALS`, ADR-ACC-010 §2.1.1 Φ7) — όχι με δικό της `PERIOD_NOT_OPEN`.
 */
export type DepreciationRunBlocker = 'FISCAL_YEAR_NOT_ENDED' | PostingPeriodDenial;

/** Προεπισκόπηση — ΚΑΜΙΑ εγγραφή. */
export interface DepreciationPreview {
  readonly fiscalYear: number;
  readonly lines: readonly DepreciationPreviewLine[];
  readonly totalTarget: number;
  readonly totalBooked: number;
  readonly totalDelta: number;
  /** `null` = η καταχώριση επιτρέπεται. */
  readonly blocker: DepreciationRunBlocker | null;
  /** Υπάρχει καταχωρημένο ποσό που μπορεί να αναιρεθεί (αν ο `blocker` το επιτρέπει). */
  readonly hasBooked: boolean;
}
