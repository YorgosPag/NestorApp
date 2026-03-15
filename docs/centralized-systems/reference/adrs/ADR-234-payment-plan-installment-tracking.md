# ADR-234: Payment Plan & Installment Tracking (Πρόγραμμα Αποπληρωμής Ακινήτου)

| Metadata | Value |
|----------|-------|
| **Status** | ✅ IMPLEMENTED — Phase 1 (SPEC-234D) + Phase 2 (SPEC-234C) + Phase 3 (SPEC-234A) |
| **Date** | 2026-03-15 |
| **Category** | Entity Systems / Sales & Finance |
| **Priority** | P1 — Business-Critical Process |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Related** | ADR-197 (Sales Pages), ADR-198 (Sales-Accounting Bridge), ADR-230 (Contract Workflow), ACC-001 (Invoice Types) |

---

## 1. Πρόβλημα (Context & Problem)

### 1.1 Τρέχουσα Κατάσταση

Η εφαρμογή υποστηρίζει ήδη πλήρη κύκλο πώλησης:

```
Τιμολόγηση (askingPrice) → Κράτηση (reservationDeposit) → Πώληση (finalPrice)
  → Νομικά (ADR-230: Προσύμφωνο → Οριστικό → Εξοφλητήριο)
  → Λογιστική γέφυρα (ADR-198: deposit_invoice → final_sale_invoice)
```

**Τι ΥΠΑΡΧΕΙ:**
- ✅ `reservationDeposit` — εφάπαξ ποσό κράτησης
- ✅ `finalPrice` — τελική τιμή πώλησης
- ✅ `transactionChainId` — σύνδεση invoices (ADR-198)
- ✅ Contract workflow 5 φάσεων (ADR-230)
- ✅ Accounting invoices: deposit, final_sale, credit (ACC-001)

**Τι ΛΕΙΠΕΙ:**
- ❌ Πρόγραμμα δόσεων (payment plan / installment schedule)
- ❌ Tracking εισπράξεων ανά δόση (installment tracking)
- ❌ Μέσα πληρωμής registry (επιταγές, μεταφορές, δάνειο)
- ❌ Τραπεζικό δάνειο tracking (loan amount, bank, approval status)
- ❌ Ειδοποιήσεις ληξιπρόθεσμων δόσεων (overdue alerts)
- ❌ Κράτηση εγγύησης (retainage / retention)

### 1.2 Γιατί Είναι Πρόβλημα

| Κενό | Επίπτωση |
|------|----------|
| Δεν υπάρχει payment schedule | Ο κατασκευαστής δεν βλέπει πότε αναμένεται κάθε πληρωμή |
| Δεν υπάρχει installment tracking | Δεν ξέρει ποιες δόσεις πληρώθηκαν, ποιες είναι ληξιπρόθεσμες |
| Δεν υπάρχει μέσο πληρωμής | Δεν φαίνεται αν πληρώθηκε με μεταφορά, επιταγή, ή μετρητά |
| Δεν υπάρχει loan tracking | Δεν γνωρίζει αν ο αγοραστής περιμένει δάνειο ή σε ποιο στάδιο είναι |
| Δεν υπάρχουν alerts | Ληξιπρόθεσμες δόσεις περνούν απαρατήρητες |

### 1.3 Ελληνική Πρακτική — Off-Plan Πωλήσεις

**Τυπική ροή πληρωμών κατασκευαστικής εταιρείας στην Ελλάδα:**

| Φάση | Ποσοστό | Τρόπος | Timing |
|------|---------|--------|--------|
| Reservation fee | €5.000–€10.000 | Μεταφορά / Μετρητά | Κράτηση |
| Προκαταβολή | 10–30% | Τραπεζική μεταφορά | Στο προσύμφωνο |
| Stage payments | Κατά κατασκευή | Μεταφορά / Επιταγή | Milestones |
| Υπόλοιπο (loan + ίδια) | 50–70% | Τράπεζα + μεταφορά | Στο οριστικό συμβόλαιο |
| Κράτηση εγγύησης | 5% | — | 6 μήνες μετά την παράδοση |

**Τρόποι πληρωμής:**
- Τραπεζική μεταφορά (IBAN) — πιο συνηθισμένη
- Τραπεζική επιταγή (cheque)
- Τραπεζικό δάνειο (70–75% αξίας, εγγραφή υποθήκης 120%)
- Μετρητά — μόνο μικρά ποσά (νομικό όριο)
- Συναλλαγματική (promissory note) — σπάνια σε ακίνητα

**ΦΠΑ:** 24% για νεόδμητα από κατασκευαστικές εταιρείες

### 1.4 Enterprise Best Practices (SAP RE-FX / Yardi / Oracle)

**SAP RE-FX Billing Plan Pattern:**
- Milestone-based billing: ποσοστό ή σταθερό ποσό ανά milestone
- Billing Plan: schedule of individual billing dates
- Payment Terms: πολλαπλά payment terms per installment

**Industry Standards:**
- 20% signing / 30% midway / 50% completion (τυπική δομή)
- Progress-based ή milestone-based payments
- Retainage: 5–10% κράτηση μέχρι substantial completion
- Evidence-backed milestones (π.χ. φωτογραφίες, πιστοποιητικά)
- Automated reminders πριν τα due dates

---

## 2. Αρχιτεκτονική Απόφαση

### 2.1 Στρατηγικές Αποφάσεις

| Θέμα | Απόφαση | Γιατί |
|------|---------|-------|
| **Storage** | Nested subcollection `units/{unitId}/payment_plans` | Ανήκει στη μονάδα, δεν φουσκώνει το unit doc |
| **Installments** | Array μέσα στο payment plan document | Δεν θέλουμε 3ο level nesting, τυπικά 3–8 δόσεις |
| **Payment records** | Subcollection `units/{unitId}/payments` | Independent lifecycle, audit trail, invoice linking |
| **Loan tracking** | Embedded στο payment plan | Ένα δάνειο ανά πώληση, δεν χρειάζεται ξεχωριστό collection |
| **Retainage** | ~~Αφαιρέθηκε~~ — δεν ισχύει στις πωλήσεις ακινήτων στην Ελλάδα | Αν χρειαστεί σε εργολαβικά → ξεχωριστό module |
| **Unit summary** | Denormalized `paymentSummary` στο `unit.commercial` | Cards/lists χωρίς extra fetch |
| **Accounting bridge** | Κάθε payment → invoice μέσω ADR-198 | Reuse existing infrastructure |
| **Alerts** | Cron/scheduled function (μελλοντική φάση) | MVP: manual check, Phase 2: automated |

### 2.2 Αρχιτεκτονικό Διάγραμμα

```
┌─────────────────────────────────────────────────────────────────┐
│                      Unit (Μονάδα)                               │
│  commercial.paymentSummary: PaymentSummary (denormalized)       │
│  commercial.transactionChainId: string (ADR-198)                │
│  commercial.legalPhase: LegalPhase (ADR-230)                    │
└──────────────────────┬──────────────────────────────────────────┘
                       │ unitId
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│         payment_plans (Subcollection of unit)                    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐     │
│  │ PaymentPlan Document                                    │     │
│  │                                                         │     │
│  │  totalAmount: €150.000                                  │     │
│  │  paidAmount:  €55.000                                   │     │
│  │  status: 'active'                                       │     │
│  │                                                         │     │
│  │  installments: [                                        │     │
│  │    { label: "Κράτηση",      amount: €5.000,  ✅ paid } │     │
│  │    { label: "Προκαταβολή",  amount: €30.000, ✅ paid } │     │
│  │    { label: "Θεμελίωση",   amount: €20.000, ✅ paid } │     │
│  │    { label: "Σκελετός",    amount: €25.000, ⏳ due  } │     │
│  │    { label: "Αποπεράτωση", amount: €35.000, 📅 future}│     │
│  │    { label: "Συμβόλαιο",   amount: €35.000, 📅 future}│     │
│  │  ]                                                      │     │
│  │                                                         │     │
│  │  loan: { bank: "Εθνική", amount: €105.000, ... }       │     │
│  │  retainage: { percentage: 5, amount: €7.500, ... }     │     │
│  └────────────────────────────────────────────────────────┘     │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│           payments (Subcollection of unit)                        │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Payment #1   │  │ Payment #2   │  │ Payment #3   │          │
│  │              │  │              │  │              │          │
│  │ amount: 5K   │  │ amount: 30K  │  │ amount: 20K  │          │
│  │ method: bank │  │ method: bank │  │ method:cheque│          │
│  │ installment:0│  │ installment:1│  │ installment:2│          │
│  │ invoiceId:...│  │ invoiceId:...│  │ invoiceId:...│          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└──────────────────────┬──────────────────────────────────────────┘
                       │ invoiceId (ADR-198)
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              invoices (Accounting — ACC-001)                     │
│  transactionChainId → links all invoices of same sale           │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Σχέση με Υπάρχουσα Ροή

```
┌─────────────────── ΠΛΗΡΗΣ ΡΟΗ ΠΩΛΗΣΗΣ ───────────────────┐
│                                                            │
│  1. Τιμολόγηση → askingPrice (ADR-197)                    │
│  2. ⭐ Αγοραστής ρωτά "πώς πληρώνω;"                     │
│     → PAYMENT PLAN δημιουργείται (status: 'negotiation')  │
│     → Χρήστης καταχωρεί δόσεις/τρόπο πληρωμής            │
│     → Calculator κόστους χρήματος (SPEC-234E)             │
│     → Αναθεώρηση τιμής πώλησης αν χρειάζεται             │
│  3. Κράτηση → reservationDeposit + buyerContactId         │
│     → PaymentPlan status: 'draft' (μπορεί ακόμα να αλλάξει)│
│  4. Προσύμφωνο (ADR-230 Phase 1)                          │
│     → PaymentPlan status: 'active' — ΚΛΕΙΔΩΝΕΙ            │
│     → Πληρωμή προκαταβολής (installment #1)               │
│  5. Stage payments κατά κατασκευή (installments #2..N)     │
│  6. Δάνειο: Έγκριση → Εκταμίευση                          │
│  7. Οριστικό Συμβόλαιο (ADR-230 Phase 2)                  │
│     → Υπόλοιπο πληρωμής (final installment)               │
│  8. Εξοφλητήριο (ADR-230 Phase 3)                         │
│     → PaymentPlan status: 'completed'                      │
│                                                            │
│  Κάθε πληρωμή → SalesAccountingBridge (ADR-198)           │
│               → Invoice + Journal Entry αυτόματα           │
└────────────────────────────────────────────────────────────┘
```

---

## 3. Data Model

### 3.1 Types — `src/types/payment-plan.ts` (Νέο αρχείο)

```typescript
import type { Timestamp } from 'firebase/firestore';

// =============================================================================
// 🏦 PAYMENT PLAN STATUS
// =============================================================================

/**
 * Κατάσταση προγράμματος αποπληρωμής
 *
 * Ροή (2026-03-15 — απόφαση Γιώργου):
 *   negotiation: Διαπραγμάτευση — ο χρήστης καταχωρεί δόσεις, τρέχει calculator κόστους
 *                χρήματος, αναθεωρεί τιμή. Μπορεί να αλλάξει ελεύθερα.
 *   draft:       Κράτηση έγινε — plan υπάρχει αλλά μπορεί ακόμα να αλλάξει
 *                μέχρι το προσύμφωνο/οριστικό.
 *   active:      Προσύμφωνο ή Οριστικό υπογράφηκε — ΚΛΕΙΔΩΜΕΝΟ. Δόσεις τρέχουν.
 *                Αλλαγές μόνο με amendment (σπάνιο).
 *   completed:   Πλήρης εξόφληση.
 *   cancelled:   Ακύρωση πώλησης.
 */
export type PaymentPlanStatus =
  | 'negotiation' // Διαπραγμάτευση — ελεύθερη τροποποίηση + calculator
  | 'draft'       // Κράτηση — μπορεί να αλλάξει μέχρι προσύμφωνο
  | 'active'      // Κλειδωμένο — προσύμφωνο/οριστικό υπογράφηκε
  | 'completed'   // Ολοκληρωμένο — πλήρης εξόφληση
  | 'cancelled';  // Ακυρωμένο

// =============================================================================
// 🏦 INSTALLMENT (Δόση)
// =============================================================================

/** Κατάσταση μεμονωμένης δόσης */
export type InstallmentStatus =
  | 'pending'     // Αναμένεται (μελλοντική ημερομηνία)
  | 'due'         // Ληξιπρόθεσμη (πέρασε η ημερομηνία, δεν πληρώθηκε)
  | 'paid'        // Πληρωμένη
  | 'partial'     // Μερικώς πληρωμένη
  | 'waived';     // Παραιτήθηκε (π.χ. εμπορική έκπτωση)

/** Τύπος δόσης */
export type InstallmentType =
  | 'reservation'    // Κράτηση (reservation fee)
  | 'down_payment'   // Προκαταβολή (στο προσύμφωνο)
  | 'stage_payment'  // Δόση κατασκευής (milestone-based)
  | 'final_payment'  // Τελική πληρωμή (στο οριστικό συμβόλαιο)
  | 'custom';        // Προσαρμοσμένη δόση
  // ΑΦΑΙΡΕΘΗΚΕ: 'retainage' — δεν ισχύει σε πωλήσεις ακινήτων (2026-03-15)

/** Μεμονωμένη δόση στο πρόγραμμα αποπληρωμής */
export interface Installment {
  /** Αύξων αριθμός δόσης (0-based) */
  index: number;

  /** Ετικέτα εμφάνισης (π.χ. "Κράτηση", "Θεμελίωση 30%") */
  label: string;

  /** Τύπος δόσης */
  type: InstallmentType;

  /** Ποσό δόσης (gross, συμπ. ΦΠΑ) */
  amount: number;

  /** Ποσοστό επί της τελικής τιμής (π.χ. 10 = 10%) — υπολογισμένο */
  percentage: number;

  /** Ημερομηνία λήξης (due date) */
  dueDate: Timestamp;

  /** Κατάσταση */
  status: InstallmentStatus;

  /** Ποσό που έχει πληρωθεί (για partial payments) */
  paidAmount: number;

  /** Ημερομηνία πληρωμής (αν πληρώθηκε) */
  paidDate: Timestamp | null;

  /** ID πληρωμής στο payments subcollection */
  paymentId: string | null;

  /** Σημειώσεις (π.χ. "Κατά την ολοκλήρωση σκελετού") */
  notes: string | null;
}

// =============================================================================
// 🏦 PAYMENT METHOD (Μέσο Πληρωμής)
// =============================================================================

/** Φορολογικό καθεστώς πώλησης */
export type SaleTaxRegime =
  | 'vat_24'              // Νεόδμητο — ΦΠΑ 24%
  | 'vat_suspension_3'    // Νεόδμητο — Αναστολή ΦΠΑ, 3% ΦΜΑ (μέχρι τέλος 2026)
  | 'transfer_tax_3'      // Μεταχειρισμένο — 3% Φόρος Μεταβίβασης
  | 'custom';             // Custom ποσοστό (ο λογιστής αποφασίζει)

/** Μέσο πληρωμής */
export type PaymentMethod =
  | 'bank_transfer'    // Τραπεζική μεταφορά (IBAN)
  | 'bank_cheque'      // Τραπεζική επιταγή
  | 'personal_cheque'  // Προσωπική επιταγή
  | 'bank_loan'        // Εκταμίευση δανείου
  | 'cash'             // Μετρητά
  | 'promissory_note'  // Συναλλαγματική
  | 'offset';          // Συμψηφισμός

// =============================================================================
// 🏦 PAYMENT RECORD (Καταγραφή Πληρωμής)
// =============================================================================

/** Μεμονωμένη πληρωμή — subcollection units/{unitId}/payments */
export interface PaymentRecord {
  /** Document ID (auto-generated) */
  id: string;

  /** Reference → payment plan */
  paymentPlanId: string;

  /** Index δόσης στην οποία αντιστοιχεί */
  installmentIndex: number;

  /** Ποσό πληρωμής (gross) */
  amount: number;

  /** Μέσο πληρωμής */
  method: PaymentMethod;

  /** Ημερομηνία πληρωμής */
  paymentDate: Timestamp;

  /** Στοιχεία μέσου πληρωμής */
  methodDetails: PaymentMethodDetails;

  /** Reference → accounting invoice (ADR-198) */
  invoiceId: string | null;

  /** Reference → transaction chain (ADR-198) */
  transactionChainId: string | null;

  /** Ελεύθερες σημειώσεις */
  notes: string | null;

  /** Audit fields */
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
}

/** Λεπτομέρειες ανά μέσο πληρωμής (discriminated union) */
export type PaymentMethodDetails =
  | BankTransferDetails
  | ChequeDetails
  | BankLoanDetails
  | CashDetails
  | PromissoryNoteDetails
  | OffsetDetails;

export interface BankTransferDetails {
  method: 'bank_transfer';
  bankName: string;
  iban: string | null;
  referenceNumber: string | null;
}

export interface ChequeDetails {
  method: 'bank_cheque' | 'personal_cheque';
  chequeNumber: string;
  bankName: string;
  issueDate: Timestamp;
  maturityDate: Timestamp | null;
  drawerName: string | null;
}

export interface BankLoanDetails {
  method: 'bank_loan';
  bankName: string;
  loanReferenceNumber: string | null;
  disbursementDate: Timestamp;
}

export interface CashDetails {
  method: 'cash';
  receiptNumber: string | null;
}

export interface PromissoryNoteDetails {
  method: 'promissory_note';
  noteNumber: string;
  issueDate: Timestamp;
  maturityDate: Timestamp;
  drawerName: string;
}

export interface OffsetDetails {
  method: 'offset';
  offsetReason: string;
  relatedDocumentId: string | null;
}

// =============================================================================
// 🏦 LOAN TRACKING (Παρακολούθηση Δανείου)
// =============================================================================

/** Κατάσταση δανείου */
export type LoanStatus =
  | 'not_applicable'   // Δεν χρειάζεται δάνειο
  | 'pending'          // Αναμένεται αίτηση
  | 'applied'          // Κατατέθηκε αίτηση
  | 'pre_approved'     // Προέγκριση
  | 'approved'         // Εγκρίθηκε
  | 'disbursed'        // Εκταμιεύτηκε
  | 'rejected';        // Απορρίφθηκε

/** Στοιχεία τραπεζικού δανείου */
export interface LoanInfo {
  /** Κατάσταση δανείου */
  status: LoanStatus;

  /** Τράπεζα */
  bankName: string | null;

  /** Ποσό δανείου */
  loanAmount: number | null;

  /** Ποσοστό χρηματοδότησης (π.χ. 70%) */
  financingPercentage: number | null;

  /** Επιτόκιο (ετήσιο %) */
  interestRate: number | null;

  /** Διάρκεια δανείου σε έτη */
  termYears: number | null;

  /** Ημερομηνία έγκρισης */
  approvalDate: Timestamp | null;

  /** Ημερομηνία εκταμίευσης */
  disbursementDate: Timestamp | null;

  /** Αρ. πρωτοκόλλου τράπεζας */
  bankReferenceNumber: string | null;

  /** Σημειώσεις */
  notes: string | null;
}

// =============================================================================
// ΑΦΑΙΡΕΘΗΚΕ: RetainageInfo (2026-03-15)
// Δεν ισχύει στις πωλήσεις ακινήτων στην Ελλάδα.
// Αν χρειαστεί σε εργολαβικά → ξεχωριστό contractor payments module.
// =============================================================================

// =============================================================================
// 🏦 PAYMENT PLAN (Πρόγραμμα Αποπληρωμής)
// =============================================================================

/** Πρόγραμμα αποπληρωμής — subcollection units/{unitId}/payment_plans */
export interface PaymentPlan {
  /** Document ID (auto-generated) */
  id: string;

  /** Reference → unit */
  unitId: string;

  /** Reference → building (denormalized) */
  buildingId: string;

  /** Reference → project (denormalized) */
  projectId: string;

  /** Reference → αγοραστής (contacts collection) */
  buyerContactId: string;

  /** Όνομα αγοραστή (denormalized) */
  buyerName: string;

  /** Κατάσταση προγράμματος */
  status: PaymentPlanStatus;

  // --- Ποσά ---

  /** Συνολικό ποσό πώλησης (= unit.commercial.finalPrice) */
  totalAmount: number;

  /** Συνολικό ποσό που έχει πληρωθεί */
  paidAmount: number;

  /** Υπόλοιπο (totalAmount - paidAmount) */
  remainingAmount: number;

  /** Νόμισμα (ISO 4217) */
  currency: 'EUR';

  // --- Δόσεις ---

  /** Λίστα δόσεων (ordered by index) */
  installments: Installment[];

  // --- Δάνειο ---

  /** Στοιχεία τραπεζικού δανείου */
  loan: LoanInfo;

  // --- Κράτηση εγγύησης ---
  // ΑΦΑΙΡΕΘΗΚΕ (2026-03-15): Δεν ισχύει στις πωλήσεις ακινήτων στην Ελλάδα.
  // Αν χρειαστεί σε εργολαβικά → ξεχωριστό contractor payments module.

  // --- Φορολογικό Καθεστώς ---

  /** Φορολογικό καθεστώς πώλησης */
  taxRegime: SaleTaxRegime;

  /** Συντελεστής φόρου (%) — αυτόματο από taxRegime, override αν custom */
  taxRate: number;

  // --- Audit ---

  /** Σημειώσεις */
  notes: string | null;

  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;
}

// =============================================================================
// 🏦 PAYMENT SUMMARY (Denormalized στο unit.commercial)
// =============================================================================

/** Σύνοψη πληρωμών — denormalized στο unit.commercial.paymentSummary */
export interface PaymentSummary {
  /** Κατάσταση προγράμματος */
  planStatus: PaymentPlanStatus;

  /** Συνολικό ποσό */
  totalAmount: number;

  /** Πληρωμένο ποσό */
  paidAmount: number;

  /** Υπόλοιπο */
  remainingAmount: number;

  /** Ποσοστό εξόφλησης (0–100) */
  paidPercentage: number;

  /** Πλήθος δόσεων */
  totalInstallments: number;

  /** Πλήθος πληρωμένων δόσεων */
  paidInstallments: number;

  /** Ληξιπρόθεσμες δόσεις */
  overdueInstallments: number;

  /** Επόμενη δόση: ποσό */
  nextInstallmentAmount: number | null;

  /** Επόμενη δόση: ημερομηνία */
  nextInstallmentDate: Timestamp | null;

  /** Κατάσταση δανείου */
  loanStatus: LoanStatus;

  /** ID του payment plan document */
  paymentPlanId: string;
}
```

### 3.2 Firestore Collection Structure

```
units/{unitId}/
  ├── payment_plans/{planId}     ← PaymentPlan document
  │     installments: [...]      ← Embedded array (3-8 items)
  │     loan: {...}              ← Embedded object
  │     retainage: {...}         ← Embedded object
  │
  └── payments/{paymentId}       ← PaymentRecord documents
        method: 'bank_transfer'
        methodDetails: {...}
        installmentIndex: 2
        invoiceId: 'inv_xxx'     ← Links to accounting
```

### 3.3 Firestore Collection Registration

```typescript
// src/config/firestore-collections.ts — additions
PAYMENT_PLANS: 'payment_plans',   // Subcollection of units
PAYMENTS: 'payments',             // Subcollection of units
```

### 3.4 Unit Commercial Extension

```typescript
// Addition to UnitCommercialData (src/types/unit.ts)
export interface UnitCommercialData {
  // ... existing fields ...

  /** Σύνοψη πληρωμών (denormalized — ADR-234) */
  paymentSummary: PaymentSummary | null;
}
```

---

## 4. Service Layer

### 4.1 PaymentPlanService — `src/services/payment-plan.service.ts`

```typescript
// Ενδεικτικό API — λεπτομέρειες κατά την υλοποίηση

interface PaymentPlanService {
  // --- CRUD ---
  createPaymentPlan(unitId: string, plan: CreatePaymentPlanInput): Promise<PaymentPlan>;
  getPaymentPlan(unitId: string, planId: string): Promise<PaymentPlan | null>;
  getActivePaymentPlan(unitId: string): Promise<PaymentPlan | null>;
  updatePaymentPlan(unitId: string, planId: string, updates: UpdatePaymentPlanInput): Promise<void>;

  // --- Installment Management ---
  addInstallment(unitId: string, planId: string, installment: CreateInstallmentInput): Promise<void>;
  updateInstallment(unitId: string, planId: string, index: number, updates: UpdateInstallmentInput): Promise<void>;
  removeInstallment(unitId: string, planId: string, index: number): Promise<void>;

  // --- Payment Recording ---
  recordPayment(unitId: string, payment: CreatePaymentInput): Promise<PaymentRecord>;
  getPayments(unitId: string): Promise<PaymentRecord[]>;

  // --- Loan ---
  updateLoanInfo(unitId: string, planId: string, loan: LoanInfo): Promise<void>;

  // --- Denormalization ---
  syncPaymentSummary(unitId: string, planId: string): Promise<void>;

  // --- Queries ---
  getOverdueInstallments(projectId: string): Promise<OverdueInstallmentView[]>;
  getPaymentPlansByProject(projectId: string): Promise<PaymentPlanSummaryView[]>;
}
```

### 4.2 Accounting Bridge Integration

Κάθε `recordPayment()` ενεργοποιεί αυτόματα τη SalesAccountingBridge (ADR-198):

```
recordPayment()
  → Create PaymentRecord in Firestore
  → Update installment status (paid/partial)
  → Recalculate paidAmount/remainingAmount
  → Sync PaymentSummary to unit.commercial
  → POST /api/sales/{unitId}/accounting-event
    → SalesAccountingBridge creates invoice + journal entry
```

---

## 5. UI Components

### 5.1 Placement — Tab "Πληρωμές" στο Sales Sidebar

```
Sales Sidebar (unit detail)
  ├── Info Tab
  ├── Νομικά Tab (ADR-230) — conditional: reserved/sold
  ├── ⭐ Πληρωμές Tab (ADR-234) — conditional: reserved/sold
  └── Έγγραφα Tab
```

### 5.2 Components (Ενδεικτική Δομή)

| Component | Περιγραφή |
|-----------|-----------|
| `PaymentPlanTab` | Container tab — orchestrates child components |
| `PaymentPlanOverview` | Summary card: progress bar, ποσά, status badges |
| `InstallmentSchedule` | Table/list δόσεων με status, dates, amounts |
| `RecordPaymentDialog` | Dialog καταγραφής πληρωμής (amount, method, details) |
| `LoanInfoCard` | Card τραπεζικού δανείου (status, bank, amount) |
| `PaymentHistoryTable` | Ιστορικό πληρωμών (payments subcollection) |
| `CreatePaymentPlanDialog` | Wizard δημιουργίας — template ή custom |

### 5.3 Payment Plan Templates

Predefined templates για συνηθισμένες δομές:

| Template | Δόσεις | Δομή |
|----------|--------|------|
| **Off-Plan Πλήρης** | 9 | Κράτηση (ποσό) → Προκαταβολή → Θεμελίωση → Σκελετός → Τοιχοποιία → Σοβάδες → Δάπεδα → Κουφώματα → Αποπεράτωση/Οριστικό |
| **Off-Plan Συμπυκνωμένο** | 5 | Κράτηση (ποσό) → Προκαταβολή → Σκελετός → Αποπεράτωση → Οριστικό |
| **Έτοιμο Ακίνητο** | 3 | Κράτηση (ποσό) → Προκαταβολή → Οριστικό (+ δάνειο) |
| **Εφάπαξ** | 1 | Ολόκληρο ποσό |
| **Custom** | N | Ελεύθερη διαμόρφωση |

> **Σημ.**: Τα ποσοστά ανά φάση είναι θέμα συμφωνίας — ο χρήστης τα ορίζει ελεύθερα στο wizard.
> Η κράτηση (reservation) είναι τυπικά σταθερό ποσό (π.χ. €5.000), όχι ποσοστό.

---

## 6. API Routes

### 6.1 Endpoints

| Method | Route | Περιγραφή |
|--------|-------|-----------|
| `GET` | `/api/units/[unitId]/payment-plan` | Ανάκτηση ενεργού payment plan |
| `POST` | `/api/units/[unitId]/payment-plan` | Δημιουργία payment plan |
| `PATCH` | `/api/units/[unitId]/payment-plan` | Ενημέρωση payment plan |
| `POST` | `/api/units/[unitId]/payments` | Καταγραφή πληρωμής |
| `GET` | `/api/units/[unitId]/payments` | Ιστορικό πληρωμών |
| `PATCH` | `/api/units/[unitId]/payment-plan/loan` | Ενημέρωση δανείου |

---

## 7. Validation Rules

### 7.1 Business Rules (Server-Enforced)

| Κανόνας | Περιγραφή |
|---------|-----------|
| **Sum = Total** | Άθροισμα installments = totalAmount (± €0.01 tolerance) |
| **Sequential payment** | Δεν μπορείς να πληρώσεις δόση N+1 αν η N δεν είναι paid/waived/partial (default ON, configurable) |
| **Single active plan** | Μία μόνο active plan ανά μονάδα |
| **Status guards** | Plan μόνο σε reserved/sold units |
| **Loan ≤ total** | Loan amount ≤ totalAmount |
| **Currency** | Μόνο EUR (v1) |
| **No negative** | Κανένα αρνητικό ποσό |

### 7.2 Date Rules

| Κανόνας | Περιγραφή |
|---------|-----------|
| **Due date order** | Κάθε installment.dueDate ≥ προηγούμενη |
| **Payment date** | paymentDate ≤ σήμερα (δεν καταγράφεις μελλοντική πληρωμή) |

---

## 8. Phased Implementation Plan

### Phase 1: Δόσεις & Πληρωμές — SPEC-234D (MVP)
- [ ] Types: `src/types/payment-plan.ts`
- [ ] Firestore collections registration
- [ ] PaymentPlanService (CRUD + record payment + sync summary)
- [ ] API routes (CRUD)
- [ ] PaymentPlanTab UI (overview + installment schedule + record payment)
- [ ] Unit commercial extension (paymentSummary)
- [ ] Payment templates (Standard Off-Plan, Ready Unit, Loan-Heavy, Custom)
- [ ] CreatePaymentPlanWizard
- [ ] Grace period + late fee engine
- [ ] Aging analysis

### Phase 2: Δάνεια — SPEC-234C
- [ ] Extended LoanTracking interface (αντικαθιστά LoanInfo)
- [ ] `loans: LoanTracking[]` (multi-bank, UI: 1 primary + optional secondary)
- [ ] LoanCard UI + LoanStatusTimeline
- [ ] Phased disbursement (lump_sum + phased)
- [ ] LTV/DSTI warning indicators
- [ ] Bank communication log
- [ ] Collateral tracking (προσημείωση)
### Phase 3: Επιταγές — SPEC-234A (Wider Scope)
- [ ] Top-level `cheques` collection (NOT subcollection — wider scope)
- [ ] ChequeContext: unit_sale + supplier + contractor + direction
- [ ] Cheque lifecycle (received → cleared/bounced)
- [ ] Bounced workflow (Τειρεσίας, μήνυση)
- [ ] Endorsement chain
- [ ] Aggregate views per project, per unit, per contact

### Phase 4: Υπολογιστής Κόστους — SPEC-234E ✅ IMPLEMENTED
- [x] ECB Euribor API integration + cache (24h TTL, fallback)
- [x] NPV calculation engine (pure math, client+server)
- [x] Bank spread configuration (Firestore settings/bank_spreads)
- [x] Scenario comparison UI (4 scenarios: Cash/Off-Plan/Loan 70%/Current)
- [x] Pricing recommendation (recommendedPrice = salePrice²/NPV)
- [x] Auto-populate from PaymentPlan installments

### Phase 5: Alerts & Reports
- [ ] Overdue installment alerts (dashboard notification)
- [ ] Payment report per project (aggregate view)
- [ ] Export to Excel/PDF
- [ ] Email reminders (μελλοντικό — Mailgun integration)

### FROZEN — SPEC-234B (Συναλλαγματικές)
> **Απόφαση 2026-03-15**: Δεν υλοποιείται. Η spec παραμένει ως τεκμηρίωση.
> Λόγος: Οι συναλλαγματικές δεν χρησιμοποιούνται αρκετά στην πράξη.

---

## 9. i18n Keys

```json
{
  "paymentPlan": {
    "title": "Πρόγραμμα Αποπληρωμής",
    "overview": "Επισκόπηση",
    "installments": "Δόσεις",
    "payments": "Πληρωμές",
    "loan": "Τραπεζικό Δάνειο",
    "status": {
      "negotiation": "Διαπραγμάτευση",
      "draft": "Σχέδιο (Κράτηση)",
      "active": "Ενεργό (Κλειδωμένο)",
      "completed": "Ολοκληρωμένο",
      "cancelled": "Ακυρωμένο"
    },

    "installmentStatus": {
      "pending": "Αναμένεται",
      "due": "Ληξιπρόθεσμη",
      "paid": "Πληρωμένη",
      "partial": "Μερικώς πληρωμένη",
      "waived": "Χαρισμένη"
    },

    "installmentType": {
      "reservation": "Κράτηση",
      "down_payment": "Προκαταβολή",
      "stage_payment": "Δόση Κατασκευής",
      "final_payment": "Τελική Πληρωμή",
      "custom": "Προσαρμοσμένη"
    },

    "paymentMethod": {
      "bank_transfer": "Τραπεζική Μεταφορά",
      "bank_cheque": "Τραπεζική Επιταγή",
      "personal_cheque": "Προσωπική Επιταγή",
      "bank_loan": "Εκταμίευση Δανείου",
      "cash": "Μετρητά",
      "promissory_note": "Συναλλαγματική",
      "offset": "Συμψηφισμός"
    },

    "loanStatus": {
      "not_applicable": "Δεν απαιτείται",
      "pending": "Αναμένεται",
      "applied": "Κατατέθηκε αίτηση",
      "pre_approved": "Προέγκριση",
      "approved": "Εγκρίθηκε",
      "disbursed": "Εκταμιεύτηκε",
      "rejected": "Απορρίφθηκε"
    },

    "taxRegime": {
      "vat_24": "Νεόδμητο — ΦΠΑ 24%",
      "vat_suspension_3": "Νεόδμητο — Αναστολή ΦΠΑ (3% ΦΜΑ)",
      "transfer_tax_3": "Μεταχειρισμένο — 3% Φόρος Μεταβίβασης",
      "custom": "Προσαρμοσμένο ποσοστό"
    },

    "actions": {
      "createPlan": "Δημιουργία Προγράμματος",
      "recordPayment": "Καταγραφή Πληρωμής",
      "addInstallment": "Προσθήκη Δόσης",
    },

    "labels": {
      "totalAmount": "Συνολικό Ποσό",
      "paidAmount": "Πληρωμένο",
      "remainingAmount": "Υπόλοιπο",
      "nextInstallment": "Επόμενη Δόση",
      "overdueCount": "Ληξιπρόθεσμες Δόσεις",
      "paidPercentage": "Ποσοστό Εξόφλησης"
    }
  }
}
```

---

## 10. Security Considerations

| Θέμα | Μέτρο |
|------|-------|
| **Authorization** | Μόνο authenticated users — ΟΛΟΙ βλέπουν/γράφουν (family team: Γιώργος, αδερφός, παιδιά). Μελλοντικό: customer portal read-only για αγοραστές. |
| **Input validation** | Server-side validation: amounts > 0, valid dates, sum checks |
| **Firestore rules** | Subcollection inherits unit-level access rules |
| **Sensitive data** | Loan details, IBAN, cheque numbers — encrypted at rest (Firestore default) |
| **Audit trail** | Κάθε payment record: createdBy + createdAt |
| **No deletion** | Payments δεν διαγράφονται — μόνο void/credit |

---

## 11. Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-15 | Initial ADR creation — research & architecture | Claude Code |
| 2026-03-15 | SPEC-234A: Cheque Registry — full lifecycle, bounced workflow, Ν. 5960/1933 | Claude Code |
| 2026-03-15 | SPEC-234B: Bills of Exchange — acceptance, protest, recourse, Ν. 5325/1932 | Claude Code |
| 2026-03-15 | SPEC-234C: Loan Tracking — multi-bank, phased disbursement, LTV/DSTI | Claude Code |
| 2026-03-15 | SPEC-234D: Installments & Payments — partial/split/over, grace, aging, templates | Claude Code |
| 2026-03-15 | SPEC-234E: Interest Cost Calculator — NPV engine, ECB Euribor API, scenario compare, pricing recommendation | Claude Code |
| 2026-03-15 | **Αποφάσεις Γιώργου**: SPEC-234B FROZEN (συναλλαγματικές δεν χρησιμοποιούνται), SPEC-234A wider scope (επιταγές σε project level — αγοραστές + προμηθευτές + συνεργεία), loans ~50%+ αγοραστών, multi-bank υποστηρίζεται (UI: primary + optional secondary). Σειρά: D→C→A→E→B(frozen) | Γιώργος + Claude |
| 2026-03-15 | **Grace period & late fees**: Default OFF (grace=0, fee=none). Configurable — ενεργοποιείται μόνο αν ο χρήστης θέλει. Στην πράξη η Pagonis δεν βάζει ρήτρες πάντα, αλλά η δυνατότητα υπάρχει. | Γιώργος + Claude |
| 2026-03-15 | **Templates**: Ποσοστά = θέμα συμφωνίας (ελεύθερα στο wizard). Κράτηση = σταθερό ποσό (not %). Milestones expanded: +τοιχοποιία, +δάπεδα, +κουφώματα (7 construction milestones). Off-Plan Πλήρης = 9 δόσεις. | Γιώργος + Claude |
| 2026-03-15 | **Retainage ΑΦΑΙΡΕΘΗΚΕ**: Δεν ισχύει στις πωλήσεις ακινήτων στην Ελλάδα (ο αγοραστής δεν κρατά %). Αφαιρέθηκε: RetainageInfo interface, retainage installment type, API route, UI component. Αν χρειαστεί σε εργολαβικά → ξεχωριστό module. | Γιώργος + Claude |
| 2026-03-15 | **Sequential payments**: Default ON (αγοραστές πληρώνουν με σειρά). Overpayment auto-apply: αν πληρώσει €7.500 σε δόση €5.000, τα €2.500 κολλάνε αυτόματα στην επόμενη δόση (SAP/Google pattern). | Γιώργος + Claude |
| 2026-03-15 | **ΦΠΑ → SaleTaxRegime**: Αντικατάσταση subjectToVat/vatRate με configurable taxRegime (vat_24, vat_suspension_3, transfer_tax_3, custom). Λόγος: η εταιρεία πουλά και νεόδμητα (ΦΠΑ) και ανακαινισμένα (ΦΜΑ 3%). Ο λογιστής αποφασίζει, η εφαρμογή καταγράφει. | Γιώργος + Claude |
| 2026-03-15 | **Permissions**: Admin only (family team). Μηδέν permissions complexity. Εξωτερικό λογιστήριο — η εφαρμογή καταγράφει παράλληλα. Customer portal (αγοραστής βλέπει δόσεις) → μελλοντικό. | Γιώργος + Claude |
| 2026-03-15 | **Ροή + Statuses**: Νέο status 'negotiation' (πριν κράτηση — διαπραγμάτευση τιμής + calculator). Plan δημιουργείται στη διαπραγμάτευση, κλειδώνει στο προσύμφωνο/οριστικό. Calculator (SPEC-234E) τρέχει ΚΑΤΑ τη διαπραγμάτευση, πριν κλείσει η τιμή. | Γιώργος + Claude |
| 2026-03-15 | **Phase 1 IMPLEMENTED (SPEC-234D)**: 16 new files + 4 modified. Types (`payment-plan.ts`), Service (`payment-plan.service.ts`), API routes (3 endpoints), Hook (`usePaymentPlan.ts`), Templates (4 predefined), i18n (EL+EN), UI components (6: PaymentTabContent, PaymentPlanOverview, InstallmentSchedule, RecordPaymentDialog, LoanInfoCard, CreatePaymentPlanWizard), SalesSidebar integration (payment tab after legal). Firestore subcollections: `payment_plans`, `payments`. Enterprise IDs: `pp_`, `pay_`. | Claude Code |
| 2026-03-15 | **Phase 2 IMPLEMENTED (SPEC-234C)**: Multi-bank loan tracking. 8 new files + 8 modified. Types (`loan-tracking.ts` — 15-stage FSM, LoanTracking interface ~40 fields), Service (`loan-tracking.service.ts`), 5 API routes (`/loans`, `/loans/[loanId]`, `/transition`, `/disburse`, `/comm-log`), Hook (`useLoanTracking.ts`), UI components (5: LoanTrackingSection, LoanCard, LoanStatusTimeline, LoanDetailDialog, AddLoanDialog). PaymentPlan.loans[] array (multi-bank), migration `LoanInfo→LoanTracking`, PaymentSummary extended fields, i18n (EL+EN), Enterprise ID `loan_`. Backward compatible: old `loan: LoanInfo` auto-migrated. | Claude Code |
| 2026-03-16 | **Phase 3 IMPLEMENTED (SPEC-234A)**: Cheque Registry — enterprise cheque lifecycle management per Ν. 5960/1933. 13 new files + 7 modified (~2100 lines). Types (`cheque-registry.ts` — 10-state FSM, ChequeRecord ~35 fields, ChequeContext, EndorsementEntry), Service (`cheque-registry.service.ts` — CRUD, FSM transitions, endorsement, bounce, replacement, auto PaymentRecord on clearing), 5 API routes (`/cheques`, `/cheques/[chequeId]`, `/transition`, `/endorse`, `/bounce`), Hook (`useChequeRegistry.ts`), UI components (5: ChequeRegistrySection, ChequeTable, ChequeStatusBadge, AddChequeDialog, ChequeDetailDialog with 3 tabs). Firestore top-level `cheques` collection, Enterprise ID `chq_`, i18n (EL+EN), V-CHQ-001~008 server-enforced. Bounced workflow: Τειρεσίας + μήνυση toggles. Integrated in PaymentTabContent. | Claude Code |
| 2026-03-16 | **Phase 4 IMPLEMENTED (SPEC-234E)**: Interest Cost Calculator — NPV-based cost-of-money analysis. 10 new files + 7 modified (~1900 lines). Types (`interest-calculator.ts` — EuriborRatesCache, BankSpreadConfig, CostCalculationInput/Result, ScenarioComparison, CashFlowAnalysisEntry), Pure math engine (`npv-engine.ts` — calculateDiscountFactor, calculateNPV, calculateFullResult, buildComparisonScenarios), Server service (`euribor.service.ts` — ECB SDMX-JSON API fetch, 24h cache, bank spread CRUD), 4 API routes (`/euribor/rates`, `/euribor/refresh`, `/settings/bank-spreads`, `/calculator/cost`), Hook (`useInterestCalculator.ts`), UI components (2: InterestCostSection summary card + InterestCostDialog 4-tab full analysis). Tabs: Cash Flow Analysis, Scenario Comparison (4 scenarios), Pricing Recommendation, Settings (Euribor refresh, discount source, bank spread). Firestore settings docs: `euribor_rates`, `bank_spreads`. Auto-populate from plan installments. i18n (EL+EN). Radix Select, semantic HTML, zero `any`. | Claude Code |
