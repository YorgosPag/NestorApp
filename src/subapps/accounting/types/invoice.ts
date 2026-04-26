/**
 * @fileoverview Accounting Subapp — Invoice Types
 * @description Τύποι για τιμολόγια και παραστατικά (ADR-ACC-002)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-02-09
 * @version 1.0.0
 * @see ADR-ACC-002 Invoicing System §3
 * @see ADR-ACC-003 myDATA Integration
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

import type { CurrencyCode } from '@/types/contacts/banking';
import type {
  MyDataDocumentStatus,
  MyDataIncomeType,
  PaymentMethod,
  PeriodRange,
} from './common';

// ============================================================================
// INVOICE TYPE (ADR-ACC-002 §3.1)
// ============================================================================

/**
 * Τύποι παραστατικών που εκδίδει η εφαρμογή
 *
 * - `service_invoice`: ΤΠΥ — Τιμολόγιο Παροχής Υπηρεσιών (myDATA 2.1)
 * - `sales_invoice`: ΤΠ — Τιμολόγιο Πώλησης (myDATA 1.1)
 * - `retail_receipt`: ΑΛΠ — Απόδειξη Λιανικής Πώλησης (myDATA 11.1)
 * - `service_receipt`: ΑΠΥ — Απόδειξη Παροχής Υπηρεσιών (myDATA 11.2)
 * - `credit_invoice`: Πιστωτικό Τιμολόγιο (myDATA 5.1)
 * - `service_invoice_eu`: ΤΠΥ Ενδοκοινοτικό (myDATA 2.2) — Phase 2+
 * - `service_invoice_3rd`: ΤΠΥ Τρίτες Χώρες (myDATA 2.3) — Phase 2+
 */
export type InvoiceType =
  | 'service_invoice'
  | 'sales_invoice'
  | 'retail_receipt'
  | 'service_receipt'
  | 'credit_invoice'
  | 'service_invoice_eu'
  | 'service_invoice_3rd';

// ============================================================================
// CANCELLATION REASON (Phase 1a — AUDIT A-1, ΑΑΔΕ compliance)
// ============================================================================

/**
 * Λόγοι ακύρωσης/πιστωτικού (SAP/Oracle pattern, ΑΑΔΕ compliance)
 *
 * Ο λόγος αποστέλλεται μαζί με το ακυρωτικό παραστατικό στο myDATA.
 * Όταν ο κωδικός = 'OTHER', το πεδίο cancellationNotes είναι υποχρεωτικό.
 */
export type CancellationReasonCode =
  | 'BILLING_ERROR'
  | 'DUPLICATE'
  | 'ORDER_CANCELLED'
  | 'TERMS_CHANGED'
  | 'GOODS_RETURNED'
  | 'OTHER';

// ============================================================================
// INVOICE LINE ITEM
// ============================================================================

/** Γραμμή τιμολογίου */
export interface InvoiceLineItem {
  /** Αύξων αριθμός γραμμής (1-based) */
  lineNumber: number;
  /** Περιγραφή υπηρεσίας/αγαθού */
  description: string;
  /** Ποσότητα */
  quantity: number;
  /** Μονάδα μέτρησης (π.χ. 'τεμ', 'ώρες', 'τ.μ.') */
  unit: string;
  /** Τιμή μονάδας (χωρίς ΦΠΑ) */
  unitPrice: number;
  /** Συντελεστής ΦΠΑ (24, 13, 6 ή 0) */
  vatRate: number;
  /** Καθαρό ποσό γραμμής (quantity × unitPrice) */
  netAmount: number;
  /** myDATA classification code για αυτή τη γραμμή */
  mydataCode: MyDataIncomeType;
}

// ============================================================================
// INVOICE PAYMENT
// ============================================================================

/** Πληρωμή τιμολογίου */
export interface InvoicePayment {
  /** Μοναδικό ID πληρωμής */
  paymentId: string;
  /** Ημερομηνία πληρωμής (ISO 8601) */
  date: string;
  /** Ποσό πληρωμής σε EUR */
  amount: number;
  /** Τρόπος πληρωμής */
  method: PaymentMethod;
  /** Σημειώσεις πληρωμής */
  notes: string | null;
}

// ============================================================================
// ISSUER / CUSTOMER INFO
// ============================================================================

/** Στοιχεία εκδότη (η εταιρεία μας) — snapshot κατά την έκδοση (ADR-ACC-018) */
export interface InvoiceIssuer {
  /** Επωνυμία */
  name: string;
  /** ΑΦΜ */
  vatNumber: string;
  /** ΔΟΥ */
  taxOffice: string;
  /** Διεύθυνση */
  address: string;
  /** Πόλη */
  city: string;
  /** ΤΚ */
  postalCode: string;
  /** Τηλέφωνο */
  phone: string | null;
  /** Κινητό (ADR-ACC-018) */
  mobile: string | null;
  /** Email */
  email: string | null;
  /** Website (ADR-ACC-018 — footer) */
  website: string | null;
  /** Δραστηριότητα/Επάγγελμα */
  profession: string;
  /** Τραπεζικοί λογαριασμοί — snapshot κατά την έκδοση (ADR-ACC-018) */
  bankAccounts: Array<{
    bankName: string;
    iban: string;
  }>;
}

/** Στοιχεία πελάτη/λήπτη */
export interface InvoiceCustomer {
  /** Firestore contact ID (αν υπάρχει) */
  contactId: string | null;
  /** Επωνυμία/Ονοματεπώνυμο */
  name: string;
  /** ΑΦΜ (υποχρεωτικό για ΤΠΥ/ΤΠ, προαιρετικό για ΑΛΠ/ΑΠΥ) */
  vatNumber: string | null;
  /** ΔΟΥ */
  taxOffice: string | null;
  /** Διεύθυνση */
  address: string | null;
  /** Πόλη */
  city: string | null;
  /** ΤΚ */
  postalCode: string | null;
  /** Χώρα (ISO 3166-1 alpha-2, default: 'GR') */
  country: string;
  /** Email (για αποστολή) */
  email: string | null;
}

// ============================================================================
// VAT SUMMARY
// ============================================================================

/** Ανάλυση ΦΠΑ ανά συντελεστή */
export interface VatBreakdown {
  /** Συντελεστής ΦΠΑ */
  vatRate: number;
  /** Καθαρό ποσό για αυτόν τον συντελεστή */
  netAmount: number;
  /** Ποσό ΦΠΑ */
  vatAmount: number;
}

// ============================================================================
// MYDATA METADATA
// ============================================================================

/** myDATA metadata τιμολογίου */
export interface InvoiceMyDataMeta {
  /** Κατάσταση στο myDATA */
  status: MyDataDocumentStatus;
  /** ΜΑΡΚ αριθμός (από ΑΑΔΕ μετά την υποβολή) */
  mark: string | null;
  /** UID παραστατικού στο myDATA */
  uid: string | null;
  /** Authentication code */
  authCode: string | null;
  /** Ημερομηνία υποβολής (ISO 8601) */
  submittedAt: string | null;
  /** Ημερομηνία αποδοχής/απόρριψης */
  respondedAt: string | null;
  /** Μήνυμα σφάλματος (αν rejected) */
  errorMessage: string | null;
}

// ============================================================================
// EMAIL SEND RECORD (ADR-ACC-019)
// ============================================================================

/**
 * Καταγραφή μίας αποστολής τιμολογίου μέσω email.
 * Αποθηκεύεται ως `emailHistory[]` μέσα στο Invoice document (embedded array).
 */
export interface EmailSendRecord {
  /** Timestamp αποστολής (ISO 8601) */
  sentAt: string;
  /** Παραλήπτης email */
  recipientEmail: string;
  /** Subject του email */
  subject: string;
  /** Mailgun message ID (null αν απέτυχε πριν φτάσει στο Mailgun) */
  mailgunMessageId: string | null;
  /** Αποτέλεσμα αποστολής */
  status: 'sent' | 'failed';
  /** Μήνυμα σφάλματος (null αν επιτυχής) */
  error: string | null;
  /** ADR-326 Phase 6.3: how email was resolved (omitted for pre-existing records) */
  resolvedSource?: 'manual' | 'head' | 'backup' | 'dept';
}

// ============================================================================
// INVOICE (ADR-ACC-002 §3 — Πλήρης δομή)
// ============================================================================

/**
 * Πλήρες τιμολόγιο/παραστατικό
 *
 * Firestore path: `accounting_invoices/{invoiceId}`
 *
 * @example
 * ```typescript
 * const invoice: Invoice = {
 *   invoiceId: 'inv_2026_042',
 *   series: 'A',
 *   number: 42,
 *   type: 'service_invoice',
 *   issueDate: '2026-02-09',
 *   dueDate: '2026-03-09',
 *   // ... issuer, customer, lineItems, etc.
 * };
 * ```
 */
export interface Invoice {
  /** Μοναδικό αναγνωριστικό (Firestore doc ID) */
  invoiceId: string;

  // — Αρίθμηση —
  /** Σειρά (π.χ. 'A', 'B') */
  series: string;
  /** Αύξων αριθμός */
  number: number;
  /** Τύπος παραστατικού */
  type: InvoiceType;

  // — Ημερομηνίες —
  /** Ημερομηνία έκδοσης (ISO 8601) */
  issueDate: string;
  /** Ημερομηνία λήξης/πληρωμής (ISO 8601) */
  dueDate: string | null;

  // — Εκδότης & Πελάτης —
  /** Στοιχεία εκδότη */
  issuer: InvoiceIssuer;
  /** Στοιχεία πελάτη */
  customer: InvoiceCustomer;

  // — Γραμμές & Ποσά —
  /** Γραμμές τιμολογίου */
  lineItems: InvoiceLineItem[];
  /** Νόμισμα (default: EUR) */
  currency: CurrencyCode;
  /** Σύνολο καθαρών ποσών */
  totalNetAmount: number;
  /** Σύνολο ΦΠΑ */
  totalVatAmount: number;
  /** Γενικό σύνολο (net + ΦΠΑ) */
  totalGrossAmount: number;
  /** Ανάλυση ΦΠΑ ανά συντελεστή */
  vatBreakdown: VatBreakdown[];

  // — Πληρωμή —
  /** Τρόπος πληρωμής */
  paymentMethod: PaymentMethod;
  /** Κατάσταση πληρωμής */
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  /** Καταχωρημένες πληρωμές */
  payments: InvoicePayment[];
  /** Σύνολο πληρωμών */
  totalPaid: number;
  /** Υπόλοιπο */
  balanceDue: number;

  // — myDATA Integration —
  /** myDATA metadata */
  mydata: InvoiceMyDataMeta;

  // — Σχέσεις —
  /** Αναφορά σε project (Firestore doc ID) */
  projectId: string | null;
  /** Αναφορά σε property (Firestore doc ID) — πωλήσεις ακινήτων (ADR-198) */
  propertyId: string | null;
  /** Αναφορά σε αρχικό τιμολόγιο (για πιστωτικά) */
  relatedInvoiceId: string | null;
  /** Αναφορά σε εγγραφή Ε-Ε (Firestore doc ID) */
  journalEntryId: string | null;

  // — Παρακράτηση Φόρου (ADR-ACC-020) —
  /**
   * Συντελεστής παρακράτησης φόρου (%).
   * Επιτρεπτές τιμές: 0 (καμία), 1 (αντιπρόσωποι), 3 (κατασκευαστικές), 20 (υπηρεσίες ΤΠΥ).
   * Optional — backward compatible με existing invoices. Null = δεν εφαρμόζεται παρακράτηση.
   */
  withholdingRate?: number | null;
  /**
   * Ποσό παρακράτησης φόρου σε EUR (= totalNetAmount × withholdingRate / 100).
   * Αποθηκεύεται ως snapshot — ανεξάρτητο από μελλοντικές αλλαγές συντελεστή.
   * Optional — backward compatible με existing invoices.
   */
  withholdingAmount?: number | null;

  // — Email History (ADR-ACC-019) —
  /**
   * Ιστορικό αποστολών email.
   * Optional — υπάρχει μόνο αν έχει σταλεί τουλάχιστον μία φορά.
   * Backward compatible με existing invoices (απουσία = δεν έχει σταλεί ποτέ).
   */
  emailHistory?: EmailSendRecord[];

  // — Ακύρωση / Πιστωτικό (Phase 1a — AUDIT A-1) —
  /** Κωδικός λόγου ακύρωσης (set κατά void ή credit note) */
  cancellationReason?: CancellationReasonCode;
  /** Ελεύθερο κείμενο ακύρωσης (υποχρεωτικό αν reason='OTHER') */
  cancellationNotes?: string;
  /** ID πιστωτικού τιμολογίου που εκδόθηκε κατά αυτού (bidirectional link) */
  creditNoteInvoiceId?: string;

  // — Dispute (Phase 1b — Q4, SAP B1 pattern) —
  /** Αμφισβητούμενο τιμολόγιο; Παραμένει στο AR balance, εξαιρείται από aging alerts */
  isDisputed?: boolean;
  /** Λόγος αμφισβήτησης (free text) */
  disputeReason?: string;
  /** Ημερομηνία αμφισβήτησης (ISO 8601) */
  disputeDate?: string;

  // — Tenant Isolation (Q3/Q7) —
  /** Company ID for tenant isolation */
  companyId?: string;
  /** User who created this document */
  createdBy?: string;

  // — Metadata —
  /** Σημειώσεις/Παρατηρήσεις */
  notes: string | null;
  /** Φορολογικό έτος */
  fiscalYear: number;
  /** Timestamp δημιουργίας (ISO 8601) */
  createdAt: string;
  /** Timestamp τελευταίας ενημέρωσης (ISO 8601) */
  updatedAt: string;
}

// ============================================================================
// INVOICE SERIES (Σειρές Αρίθμησης)
// ============================================================================

/**
 * Σειρά αρίθμησης τιμολογίων
 *
 * Firestore path: `accounting_invoice_counters/{seriesCode}`
 */
export interface InvoiceSeries {
  /** Κωδικός σειράς (π.χ. 'A', 'B', 'CREDIT') */
  code: string;
  /** Πρόθεμα (π.χ. 'ΤΠΥ-Α', 'ΑΠΥ-Β') */
  prefix: string;
  /** Επόμενος αύξων αριθμός */
  nextNumber: number;
  /** Τύποι παραστατικών που χρησιμοποιούν αυτή τη σειρά */
  documentTypes: InvoiceType[];
  /** Ενεργή; */
  isActive: boolean;
  /** Περιγραφή */
  description: string;
}

// ============================================================================
// INVOICE FILTERS
// ============================================================================

/** Φίλτρα αναζήτησης τιμολογίων */
export interface InvoiceFilters {
  /** Τύπος παραστατικού */
  type?: InvoiceType;
  /** Κατάσταση πληρωμής */
  paymentStatus?: 'unpaid' | 'partial' | 'paid';
  /** Κατάσταση myDATA */
  mydataStatus?: MyDataDocumentStatus;
  /** Εύρος ημερομηνιών έκδοσης */
  issueDateRange?: PeriodRange;
  /** Φορολογικό έτος */
  fiscalYear?: number;
  /** Αναζήτηση πελάτη (contactId) */
  customerId?: string;
  /** Αναζήτηση κειμένου */
  searchText?: string;
  /** Αναζήτηση project */
  projectId?: string;
  /** Φιλτράρισμα ανά property (πωλήσεις ακινήτων — ADR-198) */
  propertyId?: string;
}

// ============================================================================
// INPUT TYPES
// ============================================================================

/**
 * Input για δημιουργία νέου τιμολογίου
 * Εξαιρεί auto-generated πεδία
 */
export type CreateInvoiceInput = Omit<
  Invoice,
  'invoiceId' | 'number' | 'createdAt' | 'updatedAt'
>;

/**
 * Input για ενημέρωση τιμολογίου
 * Όλα τα πεδία προαιρετικά
 */
export type UpdateInvoiceInput = Partial<
  Omit<Invoice, 'invoiceId' | 'series' | 'number' | 'createdAt'>
>;

// ============================================================================
// SERVICE PRESETS (ADR-ACC-011)
// ============================================================================

/**
 * Προκαθορισμένη περιγραφή υπηρεσίας — auto-fill σε γραμμές τιμολογίου
 *
 * Firestore path: `accounting_settings/service_presets` (array μέσα σε single doc)
 */
export interface ServicePreset {
  /** Μοναδικό ID preset (format: 'sp_xxxxx') */
  presetId: string;
  /** Περιγραφή υπηρεσίας (π.χ. "ΠΕΑ — Πιστοποιητικό Ενεργειακής Απόδοσης") */
  description: string;
  /** Μονάδα μέτρησης (π.χ. 'τεμ', 'ώρες', 'τ.μ.') */
  unit: string;
  /** Τιμή μονάδας (0 = variable — ο χρήστης συμπληρώνει) */
  unitPrice: number;
  /** Συντελεστής ΦΠΑ (24, 13, 6 ή 0) */
  vatRate: number;
  /** myDATA classification code */
  mydataCode: MyDataIncomeType;
  /** Ενεργό preset */
  isActive: boolean;
  /** Σειρά ταξινόμησης */
  sortOrder: number;
}

/**
 * Single Firestore document που αποθηκεύει όλα τα presets
 *
 * Firestore path: `accounting_settings/service_presets`
 */
export interface ServicePresetsDocument {
  /** Array με τα presets */
  presets: ServicePreset[];
  /** Timestamp τελευταίας ενημέρωσης (ISO 8601) */
  updatedAt: string;
}
