/**
 * @fileoverview Accounting Subapp — myDATA/ΑΑΔΕ Integration Types
 * @description Τύποι για τη διασύνδεση με το myDATA (ΑΑΔΕ)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-003 myDATA Integration
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { MyDataDocumentStatus, MyDataIncomeType, MyDataExpenseType } from './common';

// ============================================================================
// MYDATA ENVIRONMENT & CONFIG
// ============================================================================

/** Περιβάλλον myDATA API */
export type MyDataEnvironment = 'development' | 'production';

/**
 * Ρυθμίσεις σύνδεσης myDATA API
 *
 * Development: https://mydataapidev.aade.gr
 * Production: https://mydatapi.aade.gr
 */
export interface MyDataConfig {
  /** Περιβάλλον (dev ή production) */
  environment: MyDataEnvironment;
  /** Base URL του API */
  baseUrl: string;
  /** ΑΦΜ χρήστη */
  userVatNumber: string;
  /** Subscription key (από ΑΑΔΕ) */
  subscriptionKey: string;
  /** Timeout σε milliseconds */
  timeoutMs: number;
  /** Μέγιστες αυτόματες επαναπροσπάθειες */
  maxRetries: number;
}

// ============================================================================
// MYDATA SUBMISSION ACTIONS
// ============================================================================

/**
 * Ενέργειες υποβολής στο myDATA
 *
 * - `submit`: Υποβολή νέου παραστατικού
 * - `cancel`: Ακύρωση υποβληθέντος παραστατικού
 * - `classify`: Χαρακτηρισμός εξόδου (classification)
 */
export type MyDataSubmissionAction = 'submit' | 'cancel' | 'classify';

// ============================================================================
// MYDATA RESPONSE TYPES
// ============================================================================

/** Κατάσταση απάντησης myDATA API */
export type MyDataResponseStatus = 'Success' | 'Error' | 'Pending';

/** Σφάλμα από myDATA API */
export interface MyDataError {
  /** Κωδικός σφάλματος ΑΑΔΕ */
  code: string;
  /** Μήνυμα σφάλματος */
  message: string;
  /** Πεδίο που αφορά (αν υπάρχει) */
  field: string | null;
}

/**
 * Εγγραφή υποβολής στο myDATA
 *
 * Κάθε υποβολή (submit/cancel/classify) δημιουργεί ένα record.
 */
export interface MyDataSubmission {
  /** Μοναδικό ID υποβολής */
  submissionId: string;
  /** Ενέργεια που εκτελέστηκε */
  action: MyDataSubmissionAction;
  /** ΜΑΡΚ αριθμός (αποδίδεται από ΑΑΔΕ) */
  mark: string | null;
  /** UID παραστατικού στο myDATA */
  uid: string | null;
  /** Authentication code */
  authCode: string | null;
  /** Κατάσταση απάντησης */
  responseStatus: MyDataResponseStatus;
  /** Σφάλματα (αν υπάρχουν) */
  errors: MyDataError[];
  /** Αριθμός επαναπροσπαθειών */
  retryCount: number;
  /** Αναφορά σε invoice (Firestore doc ID) */
  invoiceId: string;
  /** Ημερομηνία υποβολής (ISO 8601) */
  submittedAt: string;
  /** Ημερομηνία τελευταίας ενημέρωσης (ISO 8601) */
  updatedAt: string;
}

// ============================================================================
// MYDATA VAT CATEGORY MAPPING
// ============================================================================

/**
 * Αντιστοίχιση κατηγοριών ΦΠΑ myDATA
 *
 * Κωδικοί ΑΑΔΕ:
 * - 1 = 24% (κανονικός)
 * - 2 = 13% (μειωμένος)
 * - 3 = 6% (υπερμειωμένος)
 * - 4 = 17% (νησιωτικός κανονικός)
 * - 5 = 9% (νησιωτικός μειωμένος)
 * - 6 = 4% (νησιωτικός υπερμειωμένος)
 * - 7 = 0% (άνευ ΦΠΑ, άρθρο 43)
 * - 8 = 0% (χωρίς ΦΠΑ, λοιπές περιπτώσεις)
 */
export interface MyDataVatCategory {
  /** Κωδικός κατηγορίας myDATA (1-8) */
  code: number;
  /** Συντελεστής ΦΠΑ */
  rate: number;
  /** Περιγραφή */
  label: string;
  /** Νησιωτική κατηγορία; */
  isIsland: boolean;
}

// ============================================================================
// RECEIVED DOCUMENTS (Λήψη παραστατικών από ΑΑΔΕ)
// ============================================================================

/**
 * Παραστατικό που λήφθηκε από τον πάροχο μέσω myDATA
 *
 * Τα εισερχόμενα τιμολόγια (παραστατικά τρίτων) εμφανίζονται
 * αυτόματα στο myDATA και πρέπει να χαρακτηριστούν.
 */
export interface ReceivedDocument {
  /** ΜΑΡΚ αριθμός (μοναδικός αριθμός ΑΑΔΕ) */
  mark: string;
  /** UID παραστατικού */
  uid: string;
  /** ΑΦΜ εκδότη */
  issuerVatNumber: string;
  /** Επωνυμία εκδότη */
  issuerName: string;
  /** Ημερομηνία έκδοσης (ISO 8601) */
  issueDate: string;
  /** Τύπος παραστατικού myDATA (π.χ. '2.1', '1.1') */
  invoiceType: string;
  /** Καθαρό ποσό */
  netAmount: number;
  /** Ποσό ΦΠΑ */
  vatAmount: number;
  /** Μικτό ποσό */
  grossAmount: number;
  /** myDATA κατηγορία εσόδων/εξόδων */
  mydataClassification: MyDataIncomeType | MyDataExpenseType;
  /** Κατάσταση χαρακτηρισμού */
  classificationStatus: MyDataDocumentStatus;
  /** Ημερομηνία λήψης (ISO 8601) */
  receivedAt: string;
  /** Σημειώσεις */
  notes: string | null;
}
