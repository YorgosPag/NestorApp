/**
 * @fileoverview Accounting Subapp — AI Document Processing Types
 * @description Τύποι για AI-επεξεργασία εισερχόμενων παραστατικών (εξόδων)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-005 AI Document Processing
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { ExpenseCategory, PaymentMethod } from './common';

// ============================================================================
// DOCUMENT TYPE & STATUS
// ============================================================================

/**
 * Τύποι εισερχόμενων παραστατικών εξόδων
 *
 * Αυτά είναι τα παραστατικά που λαμβάνει ο μηχανικός
 * (ΟΧΙ αυτά που εκδίδει — αυτά είναι στο invoice.ts).
 */
export type DocumentType =
  | 'purchase_invoice'  // Τιμολόγιο αγοράς (ΤΠΥ/ΤΠ λήψης)
  | 'receipt'           // Απόδειξη (ΑΛΠ/ΑΠΥ)
  | 'utility_bill'      // Λογαριασμός ΔΕΚΟ (ΔΕΗ, ΕΥΔΑΠ, κ.λπ.)
  | 'telecom_bill'      // Λογαριασμός τηλεπικοινωνιών
  | 'fuel_receipt'      // Απόδειξη καυσίμων
  | 'bank_statement'    // Αντίγραφο κίνησης τραπέζης
  | 'other';            // Λοιπά παραστατικά

/**
 * Κατάσταση επεξεργασίας εγγράφου
 *
 * - `processing`: Σε εξέλιξη AI-ανάλυση
 * - `review`: Ολοκληρώθηκε AI, αναμένει ανθρώπινο έλεγχο
 * - `confirmed`: Επιβεβαιώθηκε από τον χρήστη
 * - `rejected`: Απορρίφθηκε (ακατάλληλο/λάθος)
 */
export type DocumentProcessingStatus = 'processing' | 'review' | 'confirmed' | 'rejected';

// ============================================================================
// EXTRACTED DOCUMENT DATA — AI-Extracted Πεδία
// ============================================================================

/** Εξαγόμενη γραμμή παραστατικού */
export interface ExtractedLineItem {
  /** Περιγραφή */
  description: string;
  /** Ποσότητα (null αν δεν αναγνωρίστηκε) */
  quantity: number | null;
  /** Τιμή μονάδας (null αν δεν αναγνωρίστηκε) */
  unitPrice: number | null;
  /** Καθαρό ποσό */
  netAmount: number;
  /** Συντελεστής ΦΠΑ (null αν δεν αναγνωρίστηκε) */
  vatRate: number | null;
}

/**
 * Πεδία που εξάγονται μέσω AI (OCR + NLP) από το παραστατικό
 *
 * Ορισμένα πεδία μπορεί να είναι null αν δεν αναγνωρίστηκαν.
 */
export interface ExtractedDocumentData {
  /** Εκδότης — Επωνυμία */
  issuerName: string | null;
  /** Εκδότης — ΑΦΜ */
  issuerVatNumber: string | null;
  /** Εκδότης — Διεύθυνση */
  issuerAddress: string | null;
  /** Αριθμός παραστατικού */
  documentNumber: string | null;
  /** Ημερομηνία έκδοσης (ISO 8601, null αν δεν αναγνωρίστηκε) */
  issueDate: string | null;
  /** Καθαρό ποσό */
  netAmount: number | null;
  /** Ποσό ΦΠΑ */
  vatAmount: number | null;
  /** Μικτό ποσό */
  grossAmount: number | null;
  /** Συντελεστής ΦΠΑ (αν ενιαίος) */
  vatRate: number | null;
  /** Γραμμές παραστατικού (αν αναγνωρίστηκαν) */
  lineItems: ExtractedLineItem[];
  /** Τρόπος πληρωμής (αν αναγνωρίστηκε) */
  paymentMethod: PaymentMethod | null;
  /** Βαθμός εμπιστοσύνης εξαγωγής (0-100) */
  overallConfidence: number;
}

// ============================================================================
// RECEIVED EXPENSE DOCUMENT — Πλήρης Εγγραφή
// ============================================================================

/**
 * Πλήρης εγγραφή εισερχόμενου παραστατικού εξόδου
 *
 * Firestore path: `accounting_expense_documents/{documentId}`
 */
export interface ReceivedExpenseDocument {
  /** Μοναδικό ID (Firestore doc ID) */
  documentId: string;
  /** Τύπος παραστατικού */
  type: DocumentType;
  /** Κατάσταση επεξεργασίας */
  status: DocumentProcessingStatus;

  // — Αρχείο —
  /** URL αποθηκευμένου αρχείου (Firebase Storage) */
  fileUrl: string;
  /** Όνομα αρχείου */
  fileName: string;
  /** MIME type (π.χ. 'application/pdf', 'image/jpeg') */
  mimeType: string;
  /** Μέγεθος αρχείου σε bytes */
  fileSize: number;

  // — AI-Extracted Data —
  /** Πεδία που εξήγαγε το AI */
  extractedData: ExtractedDocumentData;

  // — Επιβεβαιωμένα Πεδία (μετά τον ανθρώπινο έλεγχο) —
  /** Επιβεβαιωμένη κατηγορία εξόδου */
  confirmedCategory: ExpenseCategory | null;
  /** Επιβεβαιωμένο καθαρό ποσό */
  confirmedNetAmount: number | null;
  /** Επιβεβαιωμένο ΦΠΑ */
  confirmedVatAmount: number | null;
  /** Επιβεβαιωμένη ημερομηνία */
  confirmedDate: string | null;
  /** Επιβεβαιωμένος εκδότης */
  confirmedIssuerName: string | null;
  /** Αναφορά σε εγγραφή Ε-Ε (μετά την επιβεβαίωση) */
  journalEntryId: string | null;

  // — Metadata —
  /** Σημειώσεις χρήστη */
  notes: string | null;
  /** Φορολογικό έτος */
  fiscalYear: number;
  /** Timestamp δημιουργίας (ISO 8601) */
  createdAt: string;
  /** Timestamp τελευταίας ενημέρωσης (ISO 8601) */
  updatedAt: string;
}

// ============================================================================
// VENDOR CATEGORY LEARNING
// ============================================================================

/**
 * Εκμάθηση κατηγοριοποίησης ανά προμηθευτή
 *
 * Κάθε φορά που ο χρήστης διορθώνει την AI κατηγορία,
 * αποθηκεύουμε τη μάθηση για μελλοντικά παραστατικά.
 *
 * Firestore path: `accounting_vendor_learning/{vendorVatNumber}`
 */
export interface VendorCategoryLearning {
  /** ΑΦΜ προμηθευτή (Firestore doc ID) */
  vendorVatNumber: string;
  /** Επωνυμία προμηθευτή */
  vendorName: string;
  /** Προτεινόμενη κατηγορία (η πιο συχνή) */
  suggestedCategory: ExpenseCategory;
  /** Ιστορικό κατηγοριοποιήσεων */
  categoryHistory: Array<{
    category: ExpenseCategory;
    count: number;
    lastUsed: string;
  }>;
  /** Σύνολο εγγράφων από αυτόν τον προμηθευτή */
  totalDocuments: number;
  /** Τελευταία ενημέρωση (ISO 8601) */
  updatedAt: string;
}

// ============================================================================
// EXPENSE PROCESSING QUEUE
// ============================================================================

/** Κατάσταση στοιχείου ουράς */
export type QueueItemStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Στοιχείο ουράς ασύγχρονης επεξεργασίας
 *
 * Τα παραστατικά εισάγονται στην ουρά για AI processing.
 */
export interface ExpenseProcessingQueue {
  /** Μοναδικό ID */
  queueItemId: string;
  /** ID εγγράφου */
  documentId: string;
  /** Κατάσταση */
  status: QueueItemStatus;
  /** Αριθμός προσπαθειών */
  retryCount: number;
  /** Μέγιστες προσπάθειες */
  maxRetries: number;
  /** Μήνυμα σφάλματος (αν failed) */
  errorMessage: string | null;
  /** Ημερομηνία προσθήκης στην ουρά (ISO 8601) */
  enqueuedAt: string;
  /** Ημερομηνία έναρξης επεξεργασίας (ISO 8601) */
  processingStartedAt: string | null;
  /** Ημερομηνία ολοκλήρωσης (ISO 8601) */
  completedAt: string | null;
}

// ============================================================================
// DOCUMENT CLASSIFICATION — AI Αποτέλεσμα
// ============================================================================

/**
 * Αποτέλεσμα AI ταξινόμησης εγγράφου
 *
 * Επιστρέφεται από τον document classifier.
 */
export interface DocumentClassification {
  /** Αναγνωρισμένος τύπος εγγράφου */
  documentType: DocumentType;
  /** Προτεινόμενη κατηγορία εξόδου */
  suggestedCategory: ExpenseCategory;
  /** Βαθμός εμπιστοσύνης τύπου (0-100) */
  typeConfidence: number;
  /** Βαθμός εμπιστοσύνης κατηγορίας (0-100) */
  categoryConfidence: number;
  /** Εναλλακτικές κατηγορίες */
  alternativeCategories: Array<{
    category: ExpenseCategory;
    confidence: number;
  }>;
}
