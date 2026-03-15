# SPEC-234C: Loan Tracking (Παρακολούθηση Τραπεζικού Δανείου)

| Field | Value |
|-------|-------|
| **ADR** | ADR-234 |
| **Phase** | C — Loan & Bank Financing |
| **Priority** | HIGH |
| **Status** | ✅ IMPLEMENTED |
| **Estimated Effort** | 1-2 sessions |
| **Prerequisite** | ADR-234 types (LoanInfo, LoanStatus) |
| **Dependencies** | SPEC-234D depends on this (disbursement → payment record) |

---

## 1. Objective

Επέκταση του βασικού `LoanInfo` interface (ADR-234 §3.1) σε πλήρες **Loan Tracking Module** για παρακολούθηση τραπεζικών δανείων στεγαστικής πίστης. Περιλαμβάνει: multi-bank scenario, phased disbursement (under-construction), collateral tracking, bank communication log, και LTV/DSTI compliance checks.

**Κεντρική ιδέα**: Ο κατασκευαστής πρέπει να γνωρίζει σε πραγματικό χρόνο σε ποιο στάδιο βρίσκεται το δάνειο του αγοραστή, πότε θα γίνει η εκταμίευση, και αν υπάρχουν εκκρεμότητες που μπλοκάρουν την πώληση.

---

## 2. Νομικό & Τραπεζικό Πλαίσιο

### 2.1 Κανονιστικά Πλαίσια (2025-2026)

| Κανόνας | Τιμή | Πηγή |
|---------|-------|------|
| **LTV (Loan-to-Value)** — first-time buyer | Μέχρι 90% | ΤτΕ Guidelines 2025 |
| **LTV** — λοιποί αγοραστές | Μέχρι 80% | ΤτΕ Guidelines 2025 |
| **DSTI (Debt-Service-to-Income)** | Μέχρι 50% (πρώτη κατοικία), 40% (λοιπά) | ΤτΕ |
| **Εγγραφή προσημείωσης** | ~120% του ποσού δανείου | Πρακτική τραπεζών |
| **ΦΠΑ αναστολή** | Μέχρι τέλος 2026 (μόνο 3% φόρος μεταβίβασης) | Ν. 4864/2021 |
| **Νόμιμο κόστος δανείου** | Τόκοι + ασφάλιστρα + έξοδα φακέλου + εκτίμηση | Προεγκριτική αξιολόγηση |

### 2.2 Ελληνική Τραπεζική Πρακτική — Στεγαστικό Δάνειο

**Ροή δανείου για αγορά ακινήτου:**

| Φάση | Τι γίνεται | Χρόνος | Stakeholder |
|------|-----------|--------|-------------|
| 1. Αίτηση | Αγοραστής υποβάλει αίτηση + δικαιολογητικά | Ημέρα 0 | Αγοραστής → Τράπεζα |
| 2. Προέγκριση | Τράπεζα ελέγχει φερεγγυότητα (LTV, DSTI) | 1-2 εβδ. | Τράπεζα |
| 3. Εκτίμηση | Μηχανικός τράπεζας εκτιμά ακίνητο | 1-2 εβδ. | Εκτιμητής |
| 4. Νομικός έλεγχος | Δικηγόρος τράπεζας ελέγχει τίτλους | 1-3 εβδ. | Δικηγόρος τράπεζας |
| 5. Έγκριση | Τράπεζα εγκρίνει δάνειο | 1-2 εβδ. | Τράπεζα |
| 6. Προσημείωση | Εγγραφή στο Κτηματολόγιο/Υποθηκοφυλακείο | 1-2 εβδ. | Δικηγόρος + Κτηματολόγιο |
| 7. Εκταμίευση | Μεταφορά ποσού → πωλητής (δίγραμμη επιταγή ή IBAN) | Ημέρα Σ | Τράπεζα → Πωλητής |

**Σύνολο: 6-10 εβδομάδες** τυπικά

### 2.3 Εκταμίευση: Τρόποι

| Τρόπος | Περιγραφή | Πότε |
|--------|-----------|------|
| **Εφάπαξ** | Ολόκληρο το ποσό στην υπογραφή του οριστικού | Έτοιμο ακίνητο |
| **Phased (σταδιακή)** | Τμηματική εκταμίευση κατά milestone | Υπό κατασκευή |
| **Δίγραμμη επιταγή** | Η τράπεζα εκδίδει cheque υπέρ πωλητή | Παραδοσιακός τρόπος |
| **Απευθείας μεταφορά** | Wire transfer σε IBAN πωλητή | Σύγχρονος τρόπος |

### 2.4 Πολλαπλές Τράπεζες (Multi-Bank Scenario)

| Σενάριο | Δυνατότητα | Πρακτική |
|---------|------------|----------|
| Ένα δάνειο, μία τράπεζα | ✅ Πιο συνηθισμένο | 95%+ περιπτώσεων |
| Δύο δάνεια, δύο τράπεζες | ⚠️ Θεωρητικά δυνατό (2η προσημείωση) | Πολύ σπάνιο, δυσκολότερο |
| Bridge loan + κύριο | ⚠️ Σπάνιο — βραχυπρόθεσμο + μακροπρόθεσμο | Για κατασκευαστικές |

**Απόφαση**: Υποστηρίζουμε **πολλαπλά δάνεια** per payment plan (array αντί single object), αλλά η UI εμφανίζει primary + secondary. 95% θα έχει 1 δάνειο.

---

## 3. Data Model

### 3.1 Extended LoanTracking Interface

```typescript
import type { Timestamp } from 'firebase/firestore';

/** Κατάσταση δανείου — extended from ADR-234 LoanStatus */
export type LoanTrackingStatus =
  | 'not_applicable'       // Δεν χρειάζεται δάνειο (ίδια κεφάλαια)
  | 'exploring'            // Αγοραστής ψάχνει τράπεζα
  | 'applied'              // Κατατέθηκε αίτηση
  | 'pre_approved'         // Προέγκριση (conditional)
  | 'appraisal_pending'    // Αναμένεται εκτίμηση ακινήτου
  | 'appraisal_completed'  // Εκτίμηση ολοκληρώθηκε
  | 'legal_review'         // Νομικός έλεγχος τράπεζας
  | 'approved'             // Πλήρης έγκριση
  | 'collateral_pending'   // Αναμένεται εγγραφή προσημείωσης
  | 'collateral_registered' // Προσημείωση εγγράφηκε
  | 'disbursement_pending' // Αναμένεται εκταμίευση
  | 'partially_disbursed'  // Μερική εκταμίευση (phased)
  | 'fully_disbursed'      // Πλήρης εκταμίευση
  | 'rejected'             // Απορρίφθηκε
  | 'cancelled';           // Ακυρώθηκε (αγοραστής αποσύρθηκε)

/** Τύπος εκταμίευσης */
export type DisbursementType =
  | 'lump_sum'             // Εφάπαξ
  | 'phased';              // Σταδιακή (milestones)

/** Τύπος εγγύησης */
export type CollateralType =
  | 'mortgage'             // Υποθήκη
  | 'pre_notation'         // Προσημείωση υποθήκης
  | 'personal_guarantee'   // Προσωπική εγγύηση
  | 'other';               // Άλλο

/**
 * Πλήρες Loan Tracking — αντικαθιστά το απλό LoanInfo (ADR-234 §3.1)
 * Embedded στο PaymentPlan.loans[] (array — υποστηρίζει multi-bank)
 */
export interface LoanTracking {
  /** Internal ID (αν είναι σε array) */
  loanId: string;

  /** Primary ή Secondary δάνειο */
  isPrimary: boolean;

  /** Κατάσταση */
  status: LoanTrackingStatus;

  // --- Τράπεζα ---

  /** Τράπεζα */
  bankName: string;

  /** Υποκατάστημα */
  bankBranch: string | null;

  /** Αρ. πρωτοκόλλου / reference */
  bankReferenceNumber: string | null;

  /** Υπεύθυνος τράπεζας (contact person) */
  bankContactPerson: string | null;

  /** Τηλέφωνο υπεύθυνου */
  bankContactPhone: string | null;

  // --- Ποσά ---

  /** Αιτηθέν ποσό δανείου */
  requestedAmount: number | null;

  /** Εγκεκριμένο ποσό */
  approvedAmount: number | null;

  /** Εκταμιευθέν ποσό (σύνολο) */
  disbursedAmount: number;

  /** Υπόλοιπο εκταμίευσης (approved - disbursed) */
  remainingDisbursement: number;

  // --- Οικονομικοί Όροι ---

  /** Ποσοστό χρηματοδότησης (LTV) */
  ltvPercentage: number | null;

  /** Επιτόκιο (ετήσιο %) */
  interestRate: number | null;

  /** Τύπος επιτοκίου */
  interestRateType: 'fixed' | 'variable' | 'mixed' | null;

  /** Διάρκεια σε έτη */
  termYears: number | null;

  /** Μηνιαία δόση δανείου */
  monthlyPayment: number | null;

  /** DSTI (Debt-Service-to-Income) ratio */
  dstiRatio: number | null;

  /** Κόστος φακέλου / Έξοδα τράπεζας */
  bankFees: number | null;

  // --- Εκταμίευση ---

  /** Τρόπος εκταμίευσης */
  disbursementType: DisbursementType;

  /** Εκταμιεύσεις (αν phased) */
  disbursements: DisbursementEntry[];

  // --- Εγγύηση / Collateral ---

  /** Τύπος εγγύησης */
  collateralType: CollateralType | null;

  /** Ποσό εγγύησης (τυπικά 120% δανείου) */
  collateralAmount: number | null;

  /** Αρ. εγγραφής (Κτηματολόγιο / Υποθηκοφυλακείο) */
  collateralRegistrationNumber: string | null;

  /** Ημερομηνία εγγραφής */
  collateralRegistrationDate: Timestamp | null;

  // --- Εκτίμηση ---

  /** Αξία εκτίμησης τράπεζας */
  appraisalValue: number | null;

  /** Ημερομηνία εκτίμησης */
  appraisalDate: Timestamp | null;

  /** Εκτιμητής */
  appraiserName: string | null;

  // --- Ημερομηνίες ---

  /** Ημ. αίτησης */
  applicationDate: Timestamp | null;

  /** Ημ. προέγκρισης */
  preApprovalDate: Timestamp | null;

  /** Ημ. οριστικής έγκρισης */
  approvalDate: Timestamp | null;

  /** Ημ. πρώτης εκταμίευσης */
  firstDisbursementDate: Timestamp | null;

  /** Ημ. πλήρους εκταμίευσης */
  fullDisbursementDate: Timestamp | null;

  /** Λήξη προέγκρισης (expiry) */
  preApprovalExpiryDate: Timestamp | null;

  // --- Communication Log ---

  /** Ιστορικό επικοινωνίας με τράπεζα */
  communicationLog: BankCommunicationEntry[];

  // --- Σημειώσεις ---
  notes: string | null;

  // --- Audit ---
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Εγγραφή εκταμίευσης (phased disbursement) */
export interface DisbursementEntry {
  /** Σειρά (1, 2, 3...) */
  order: number;

  /** Ποσό εκταμίευσης */
  amount: number;

  /** Milestone (π.χ. "Θεμελίωση", "Σκελετός", "Αποπεράτωση") */
  milestone: string;

  /** Ημερομηνία εκταμίευσης */
  disbursementDate: Timestamp | null;

  /** Κατάσταση */
  status: 'pending' | 'requested' | 'approved' | 'disbursed';

  /** Τρόπος πληρωμής (δίγραμμη επιταγή ή μεταφορά) */
  paymentMethod: 'crossed_cheque' | 'wire_transfer' | null;

  /** Reference → PaymentRecord (αν δημιουργήθηκε) */
  paymentId: string | null;

  /** Σημειώσεις */
  notes: string | null;
}

/** Εγγραφή επικοινωνίας με τράπεζα */
export interface BankCommunicationEntry {
  /** Ημερομηνία */
  date: Timestamp;

  /** Τύπος */
  type: 'phone' | 'email' | 'meeting' | 'document' | 'note';

  /** Σύντομη περιγραφή */
  summary: string;

  /** Ποιος επικοινώνησε */
  contactPerson: string | null;

  /** Αναμενόμενη ενέργεια */
  nextAction: string | null;

  /** Deadline */
  nextActionDate: Timestamp | null;
}
```

### 3.2 PaymentPlan Extension

```typescript
// ADR-234 PaymentPlan — αλλαγή loan field
export interface PaymentPlan {
  // ... existing fields ...

  /**
   * Δάνεια αγοραστή.
   * Αντικαθιστά το παλιό `loan: LoanInfo` (single object).
   * Array: 1 δάνειο (95%), σπάνια 2 (bridge + main).
   * Empty array = χωρίς δάνειο (ίδια κεφάλαια).
   */
  loans: LoanTracking[];

  // ... rest of fields ...
}
```

### 3.3 PaymentSummary Extension

```typescript
// Unit.commercial.paymentSummary — extended fields
export interface PaymentSummary {
  // ... existing fields ...

  /** Primary loan status */
  primaryLoanStatus: LoanTrackingStatus;

  /** Primary loan bank */
  primaryLoanBank: string | null;

  /** Συνολικό εγκεκριμένο ποσό δανείων */
  totalApprovedLoanAmount: number | null;

  /** Συνολικό εκταμιευθέν ποσό */
  totalDisbursedAmount: number;
}
```

---

## 4. Lifecycle / State Machine

### 4.1 State Diagram

```
┌────────────────┐
│ not_applicable │  (ίδια κεφάλαια — δεν χρειάζεται δάνειο)
└────────────────┘

┌──────────┐
│exploring │  (ψάχνει τράπεζα)
└────┬─────┘
     │
┌────▼───┐
│applied │  (κατατέθηκε αίτηση)
└────┬───┘
     │
┌────▼────────┐
│pre_approved │  (conditional approval)
└────┬────────┘
     │
┌────▼──────────────┐
│appraisal_pending  │  (αναμένεται εκτίμηση)
└────┬──────────────┘
     │
┌────▼────────────────┐
│appraisal_completed  │  (εκτίμηση ολοκληρώθηκε)
└────┬────────────────┘
     │
┌────▼──────────┐
│legal_review   │  (νομικός έλεγχος τράπεζας)
└────┬──────────┘
     │
┌────▼─────┐
│approved  │  (πλήρης έγκριση!)
└────┬─────┘
     │
┌────▼──────────────┐
│collateral_pending │  (αναμένεται προσημείωση)
└────┬──────────────┘
     │
┌────▼───────────────────┐
│collateral_registered   │  (προσημείωση εγγράφηκε)
└────┬───────────────────┘
     │
┌────▼────────────────┐
│disbursement_pending │  (αναμένεται εκταμίευση)
└────┬────────────────┘
     │
     ├────────────────────┐
     │                    │
┌────▼──────────────┐  ┌─▼──────────────┐
│partially_disbursed│  │fully_disbursed │  (phased vs lump_sum)
└────┬──────────────┘  └────────────────┘
     │
┌────▼──────────────┐
│fully_disbursed    │
└───────────────────┘

Parallel exit from ANY state:
  → rejected (τράπεζα απέρριψε)
  → cancelled (αγοραστής αποσύρθηκε)
```

### 4.2 Fast-Track Paths

Ορισμένοι stages μπορούν να παραλειφθούν:

| Path | Stages | Πότε |
|------|--------|------|
| **Standard** | All stages | Κανονική ροή |
| **Pre-approved buyer** | Skip exploring, applied → pre_approved | Αγοραστής ήδη εγκεκριμένος |
| **Cash + partial loan** | exploring → applied → ... | Μικρότερο ποσό, ταχύτερη έγκριση |

---

## 5. Business Rules & Validation

### 5.1 Validation Rules

| Rule | Description | Enforcement |
|------|-------------|-------------|
| **V-LOAN-001** | `bankName` required όταν status ≠ 'not_applicable', 'exploring' | Server-side |
| **V-LOAN-002** | `approvedAmount` ≤ totalAmount (payment plan) | Server-side |
| **V-LOAN-003** | `disbursedAmount` ≤ `approvedAmount` | Server-side |
| **V-LOAN-004** | `ltvPercentage` ≤ 90 (first-time) ή ≤ 80 (others) | Warning (soft) |
| **V-LOAN-005** | `dstiRatio` ≤ 50 (first home) ή ≤ 40 (other) | Warning (soft) |
| **V-LOAN-006** | `collateralAmount` ≈ 120% × `approvedAmount` | Warning (soft) |
| **V-LOAN-007** | `preApprovalExpiryDate` → alert 14 days before expiry | Notification |
| **V-LOAN-008** | Max 3 loans per payment plan | Hard limit |
| **V-LOAN-009** | Exactly 1 `isPrimary = true` loan (if any loans exist) | Server-side |

### 5.2 LTV Compliance Check

```
LTV = approvedAmount / appraisalValue × 100

If LTV > 90% (first-time) or > 80% (other):
  → Display warning: "Υπέρβαση LTV — η τράπεζα πιθανόν δεν θα εγκρίνει"
  → NOT a blocker (τράπεζα αποφασίζει)
```

### 5.3 Disbursement → Payment Integration

```
Κάθε DisbursementEntry με status = 'disbursed':
  → Αυτόματη δημιουργία PaymentRecord
    method: 'bank_loan'
    methodDetails: {
      method: 'bank_loan',
      bankName: loan.bankName,
      loanReferenceNumber: loan.bankReferenceNumber,
      disbursementDate: entry.disbursementDate
    }
  → Update installment (αν linked)
  → Sync PaymentSummary
```

---

## 6. UI Components & Flow

### 6.1 Component Tree

| Component | Location | Description |
|-----------|----------|-------------|
| `LoanTrackingSection` | PaymentPlanTab child | Container — loan cards + timeline |
| `LoanCard` | LoanTrackingSection | Card ανά δάνειο — status, bank, amounts |
| `LoanStatusTimeline` | LoanCard expandable | Vertical timeline: applied → ... → disbursed |
| `LoanDetailDialog` | Modal | Πλήρεις λεπτομέρειες + edit |
| `AddLoanDialog` | Modal | Φόρμα νέου δανείου |
| `DisbursementSchedule` | LoanDetailDialog section | Phased disbursement table |
| `BankCommLogTable` | LoanDetailDialog section | Ιστορικό επικοινωνίας |
| `LtvDstiIndicator` | LoanCard inline | Visual gauge LTV / DSTI |
| `PreApprovalExpiryBadge` | LoanCard inline | Countdown badge αν κοντά σε expiry |

### 6.2 LoanCard Summary View

```
┌─────────────────────────────────────────────────────┐
│ 🏦 Εθνική Τράπεζα                    [PRIMARY]     │
│                                                      │
│ Κατάσταση: ● Εγκρίθηκε                              │
│ Ποσό:      €105.000 / €105.000 approved              │
│ LTV:       70%  ████████░░ OK                        │
│ Επιτόκιο:  3.2% (σταθερό)  │  Διάρκεια: 25 έτη     │
│                                                      │
│ Εκταμίευση: €0 / €105.000  [Αναμένεται]             │
│ ████████████████████░░░░░░░░░░░░ 0%                  │
│                                                      │
│ [Λεπτομέρειες]  [Εκταμίευση]  [Ιστορικό]           │
└─────────────────────────────────────────────────────┘
```

### 6.3 LoanStatusTimeline

Vertical timeline showing all passed stages with dates:

```
✅ 2026-03-01  Κατάθεση αίτησης
✅ 2026-03-08  Προέγκριση
✅ 2026-03-15  Εκτίμηση — €160.000
✅ 2026-03-22  Νομικός έλεγχος
✅ 2026-03-25  Οριστική έγκριση — €105.000
⏳ 2026-04-01  Εγγραφή προσημείωσης
○             Εκταμίευση (αναμένεται)
```

---

## 7. API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/units/[unitId]/payment-plan/loans` | Λίστα δανείων |
| `POST` | `/api/units/[unitId]/payment-plan/loans` | Προσθήκη δανείου |
| `PATCH` | `/api/units/[unitId]/payment-plan/loans/[loanId]` | Ενημέρωση δανείου |
| `POST` | `/api/units/[unitId]/payment-plan/loans/[loanId]/transition` | State transition |
| `POST` | `/api/units/[unitId]/payment-plan/loans/[loanId]/disburse` | Καταγραφή εκταμίευσης |
| `POST` | `/api/units/[unitId]/payment-plan/loans/[loanId]/comm-log` | Νέα εγγραφή επικοινωνίας |
| `GET` | `/api/projects/[projectId]/loans/overview` | Aggregate — δάνεια project |

---

## 8. Integration Points

| System | Integration | Details |
|--------|-------------|---------|
| **ADR-234 PaymentPlan** | `loans[]` array embedded in PaymentPlan | Direct reference |
| **ADR-198 Accounting** | Disbursement → PaymentRecord → Invoice | Automatic |
| **ADR-230 Contracts** | Loan approval → unblocks οριστικό συμβόλαιο | Status check |
| **SPEC-234A Cheques** | Disbursement via crossed cheque → ChequeRecord | Optional link |
| **SPEC-234D Installments** | Loan installment → linked to disbursement | installmentIndex |
| **Unit.commercial** | `paymentSummary.primaryLoanStatus` denormalized | Sync on change |
| **Dashboard** | Pre-approval expiry alerts, pending disbursements | Notifications |

---

## 9. i18n Keys

```json
{
  "loanTracking": {
    "title": "Τραπεζικά Δάνεια",
    "addLoan": "Νέο Δάνειο",
    "primaryLoan": "Κύριο Δάνειο",
    "secondaryLoan": "Δευτερεύον Δάνειο",

    "status": {
      "not_applicable": "Δεν Απαιτείται",
      "exploring": "Αναζήτηση Τράπεζας",
      "applied": "Κατατέθηκε Αίτηση",
      "pre_approved": "Προέγκριση",
      "appraisal_pending": "Αναμένεται Εκτίμηση",
      "appraisal_completed": "Εκτίμηση Ολοκληρώθηκε",
      "legal_review": "Νομικός Έλεγχος",
      "approved": "Εγκρίθηκε",
      "collateral_pending": "Αναμένεται Προσημείωση",
      "collateral_registered": "Προσημείωση Εγγράφηκε",
      "disbursement_pending": "Αναμένεται Εκταμίευση",
      "partially_disbursed": "Μερική Εκταμίευση",
      "fully_disbursed": "Πλήρης Εκταμίευση",
      "rejected": "Απορρίφθηκε",
      "cancelled": "Ακυρώθηκε"
    },

    "disbursementType": {
      "lump_sum": "Εφάπαξ",
      "phased": "Σταδιακή (Milestones)"
    },

    "collateralType": {
      "mortgage": "Υποθήκη",
      "pre_notation": "Προσημείωση Υποθήκης",
      "personal_guarantee": "Προσωπική Εγγύηση",
      "other": "Άλλο"
    },

    "fields": {
      "bankName": "Τράπεζα",
      "bankBranch": "Υποκατάστημα",
      "bankReference": "Αρ. Πρωτοκόλλου",
      "requestedAmount": "Αιτηθέν Ποσό",
      "approvedAmount": "Εγκεκριμένο Ποσό",
      "disbursedAmount": "Εκταμιευθέν",
      "ltvPercentage": "LTV (%)",
      "interestRate": "Επιτόκιο (%)",
      "termYears": "Διάρκεια (Έτη)",
      "monthlyPayment": "Μηνιαία Δόση",
      "dstiRatio": "DSTI (%)",
      "appraisalValue": "Αξία Εκτίμησης",
      "collateralAmount": "Ποσό Εγγύησης"
    },

    "actions": {
      "recordDisbursement": "Καταγραφή Εκταμίευσης",
      "addCommLog": "Νέα Επικοινωνία",
      "updateStatus": "Ενημέρωση Κατάστασης"
    },

    "commLog": {
      "title": "Ιστορικό Επικοινωνίας",
      "type": {
        "phone": "Τηλέφωνο",
        "email": "Email",
        "meeting": "Συνάντηση",
        "document": "Έγγραφο",
        "note": "Σημείωση"
      }
    },

    "alerts": {
      "preApprovalExpiring": "Η Προέγκριση λήγει σε {days} ημέρες!",
      "ltvExceeded": "LTV {value}% — υπερβαίνει το όριο {limit}%",
      "dstiExceeded": "DSTI {value}% — υπερβαίνει το όριο {limit}%"
    }
  }
}
```

---

## 10. Verification Criteria

1. `LoanTracking` interface: πλήρης, χωρίς `any`, multi-bank support
2. State machine: sequential stages + fast-track paths
3. Disbursement: lump_sum vs phased — auto PaymentRecord creation
4. LTV/DSTI: warning indicators (soft validation)
5. Pre-approval expiry: alert system
6. Communication log: structured entries with next-action tracking
7. PaymentSummary sync: `primaryLoanStatus`, `totalDisbursedAmount`
8. i18n: EL + EN πλήρεις

---

*SPEC Format: Google Engineering Design Docs standard*
