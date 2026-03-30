/**
 * @fileoverview Accounting Subapp — APY Certificate Types
 * @description Τύποι για Βεβαίωση Παρακράτησης Φόρου (ADR-ACC-020)
 * @author Claude Code (Anthropic AI) + Γιώργος Παγώνης
 * @created 2026-03-17
 * @version 1.0.0
 * @see ADR-ACC-020 Βεβαίωση Παρακράτησης Φόρου
 * @compliance CLAUDE.md Enterprise Standards — zero `any`
 */

// ============================================================================
// APY CERTIFICATE LINE ITEM — Γραμμή Τιμολογίου στη Βεβαίωση
// ============================================================================

/**
 * Μία γραμμή (τιμολόγιο) στον πίνακα της βεβαίωσης παρακράτησης.
 * Αποθηκεύεται ως snapshot — ανεξάρτητο από αλλαγές στο original invoice.
 */
export interface APYCertificateLineItem {
  /** Firestore doc ID τιμολογίου (`accounting_invoices/{invoiceId}`) */
  invoiceId: string;
  /** Αριθμός τιμολογίου για display (π.χ. "Α-042") */
  invoiceNumber: string;
  /** Ημερομηνία έκδοσης τιμολογίου (ISO 8601) */
  issueDate: string;
  /** Καθαρό ποσό τιμολογίου (χωρίς ΦΠΑ) σε EUR */
  netAmount: number;
  /** Συντελεστής παρακράτησης (%) — 1, 3, ή 20 */
  withholdingRate: number;
  /** Ποσό παρακράτησης (= netAmount × withholdingRate / 100) σε EUR */
  withholdingAmount: number;
}

// ============================================================================
// APY EMAIL SEND RECORD — Καταγραφή Αποστολής Reminder Email
// ============================================================================

/**
 * Καταγραφή αποστολής reminder email στον πελάτη.
 * Ίδιο pattern με `EmailSendRecord` (ADR-ACC-019) — embedded array.
 */
export interface APYEmailSendRecord {
  /** Timestamp αποστολής (ISO 8601) */
  sentAt: string;
  /** Παραλήπτης email (ο πελάτης) */
  recipientEmail: string;
  /** Subject του email */
  subject: string;
  /** Mailgun message ID (null αν απέτυχε πριν φτάσει στο Mailgun) */
  mailgunMessageId: string | null;
  /** Αποτέλεσμα αποστολής */
  status: 'sent' | 'failed';
  /** Μήνυμα σφάλματος (null αν επιτυχής) */
  error: string | null;
}

// ============================================================================
// APY CERTIFICATE PROVIDER — Στοιχεία Παρόχου (Γιώργος — Snapshot)
// ============================================================================

/**
 * Snapshot στοιχείων παρόχου (ο Γιώργος) κατά τη δημιουργία βεβαίωσης.
 * Παγώνει τα στοιχεία — ανεξάρτητο από μελλοντικές αλλαγές στο company profile.
 */
export interface APYCertificateProvider {
  /** Επωνυμία / Ονοματεπώνυμο */
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
  /** Επάγγελμα / Δραστηριότητα */
  profession: string;
  /** Τηλέφωνο (optional) */
  phone: string | null;
  /** Email (optional) */
  email: string | null;
}

// ============================================================================
// APY CERTIFICATE CUSTOMER — Στοιχεία Πελάτη (Snapshot)
// ============================================================================

/**
 * Snapshot στοιχείων πελάτη (αυτός που παρακράτησε) κατά τη δημιουργία βεβαίωσης.
 */
export interface APYCertificateCustomer {
  /** Επωνυμία */
  name: string;
  /** ΑΦΜ */
  vatNumber: string;
  /** ΔΟΥ (optional) */
  taxOffice: string | null;
  /** Διεύθυνση (optional) */
  address: string | null;
  /** Πόλη (optional) */
  city: string | null;
}

// ============================================================================
// APY CERTIFICATE — Βεβαίωση Παρακράτησης Φόρου
// ============================================================================

/**
 * Βεβαίωση Παρακράτησης Φόρου.
 *
 * Firestore path: `accounting_apy_certificates/{certificateId}`
 *
 * Μία βεβαίωση ανά πελάτη ανά φορολογικό έτος (Annual Grouped — ADR-ACC-020).
 * Ο Γιώργος (πάροχος) χρησιμοποιεί τη βεβαίωση για tracking παρακρατήσεων
 * που ΛΑΜΒΑΝΕΙ από πελάτες + αποστολή reminder email αν αργεί ο πελάτης.
 *
 * @example
 * ```typescript
 * const cert: APYCertificate = {
 *   certificateId: 'apy_2025_001',
 *   fiscalYear: 2025,
 *   provider: { name: 'Παγώνης Νέστωρ', vatNumber: '123456789', ... },
 *   customer: { name: 'Εταιρεία ΑΕ', vatNumber: '987654321', ... },
 *   customerId: 'contact_abc',
 *   lineItems: [
 *     { invoiceId: 'inv_2025_042', invoiceNumber: 'Α-042', ... },
 *   ],
 *   totalNetAmount: 3000,
 *   totalWithholdingAmount: 600,
 *   isReceived: false,
 *   receivedAt: null,
 *   notes: null,
 *   createdAt: '2026-03-17T10:00:00.000Z',
 *   updatedAt: '2026-03-17T10:00:00.000Z',
 * };
 * ```
 */
export interface APYCertificate {
  /** Μοναδικό αναγνωριστικό — Enterprise ID prefix "apy_" (ADR-017, ADR-210) */
  certificateId: string;

  // — Φορολογικό Έτος —
  /** Φορολογικό έτος (π.χ. 2025) */
  fiscalYear: number;

  // — Εμπλεκόμενα Μέρη (Snapshots) —
  /** Στοιχεία παρόχου (ο Γιώργος) — snapshot κατά τη δημιουργία */
  provider: APYCertificateProvider;
  /** Firestore contact ID (αν υπάρχει) — για shortcut navigation */
  customerId: string | null;
  /** Στοιχεία πελάτη (αυτός που παρακράτησε) — snapshot κατά τη δημιουργία */
  customer: APYCertificateCustomer;

  // — Τιμολόγια —
  /**
   * Γραμμές τιμολογίων που περιλαμβάνει η βεβαίωση.
   * Μόνο ΤΠΥ με withholdingAmount > 0, εξαιρούνται τα credit_invoice.
   */
  lineItems: APYCertificateLineItem[];

  // — Σύνολα —
  /** Σύνολο καθαρών ποσών όλων των τιμολογίων της βεβαίωσης σε EUR */
  totalNetAmount: number;
  /** Σύνολο παρακρατήσεων σε EUR (= Σ withholdingAmount ανά γραμμή) */
  totalWithholdingAmount: number;

  // — Κατάσταση Παρακράτησης —
  /**
   * Έχει ληφθεί η βεβαίωση από τον πελάτη;
   * false = εκκρεμεί | true = ελήφθη
   */
  isReceived: boolean;
  /** Ημερομηνία λήψης (ISO 8601). Null αν δεν έχει ληφθεί ακόμα. */
  receivedAt: string | null;

  // — Email History (ADR-ACC-019 pattern) —
  /**
   * Ιστορικό αποστολών reminder email στον πελάτη.
   * Optional — υπάρχει μόνο αν έχει σταλεί τουλάχιστον ένα reminder.
   */
  emailHistory?: APYEmailSendRecord[];

  // — Tenant Isolation (Q3/Q7) —
  /** Company ID for tenant isolation */
  companyId?: string;
  /** User who created this document */
  createdBy?: string;

  // — Metadata —
  /** Σημειώσεις */
  notes: string | null;
  /** Timestamp δημιουργίας (ISO 8601) */
  createdAt: string;
  /** Timestamp τελευταίας ενημέρωσης (ISO 8601) */
  updatedAt: string;
}
