# SPEC-234D: Installments & Payments (Δόσεις & Πληρωμές)

| Field | Value |
|-------|-------|
| **ADR** | ADR-234 |
| **Phase** | D — Core Payment Operations |
| **Priority** | CRITICAL |
| **Status** | PLANNING |
| **Estimated Effort** | 2-3 sessions |
| **Prerequisite** | ADR-234 types, SPEC-234A (cheques), SPEC-234C (loans) |
| **Dependencies** | Κεντρικό module — SPEC-234A/B/C feed into this |

---

## 1. Objective

Πλήρης specification για τη **διαχείριση δόσεων και πληρωμών** — το core module του ADR-234. Καλύπτει: partial payments, split payments, overpayments, grace periods, late fees, aging analysis, payment templates, και UI/UX flow.

**Κεντρική ιδέα**: Μία πληρωμή μπορεί να αντιστοιχεί σε μία δόση (1:1), μέρος δόσης (partial), πολλαπλές δόσεις (split), ή ακόμα και περίσσεια (overpayment). Αυτό είναι πολύ πιο σύνθετο από ένα απλό "paid / not paid".

---

## 2. Ελληνικό Πλαίσιο Δόσεων Ακινήτων

### 2.1 Τυπική Δομή Off-Plan Πώλησης

| Φάση | Τύπος | Ποσοστό | Trigger | Μέσο Πληρωμής |
|------|-------|---------|---------|---------------|
| 1 | Κράτηση (reservation) | 2-5% | Προφορική συμφωνία | Μεταφορά / Μετρητά |
| 2 | Προκαταβολή (down_payment) | 10-25% | Προσύμφωνο (ADR-230) | Μεταφορά |
| 3 | Stage: Θεμελίωση | 10-20% | Milestone κατασκευής | Μεταφορά / Επιταγή |
| 4 | Stage: Σκελετός | 10-20% | Milestone κατασκευής | Μεταφορά / Επιταγή |
| 5 | Stage: Αποπεράτωση | 10-20% | Milestone κατασκευής | Μεταφορά / Επιταγή |
| 6 | Τελική (final_payment) | 30-50% | Οριστικό συμβόλαιο (ADR-230) | Δάνειο + Μεταφορά |
| 7 | Κράτηση εγγύησης (retainage) | 5% | 6 μήνες μετά παράδοση | Μεταφορά |

### 2.2 Πρακτικές Αγοράς

| Πρακτική | Περιγραφή | Συχνότητα |
|----------|-----------|-----------|
| **Milestone-based** | Δόσεις συνδεδεμένες με κατασκευαστικά milestones | 80%+ off-plan |
| **Fixed schedule** | Σταθερές ημερομηνίες ανεξαρτήτως κατασκευής | 10% (ready units) |
| **Mixed** | Κάποιες fixed + κάποιες milestone | 10% |
| **Negotiated** | Πλήρως custom ανά αγοραστή | Κατά περίπτωση |

### 2.3 Νομικό Πλαίσιο Εκπρόθεσμων

| Θέμα | Κανόνας |
|------|---------|
| **Νόμιμος τόκος** | 2 μονάδες πάνω από ECB (τρέχον ~6%) — μόνο αν υπάρχει ρήτρα στο συμβόλαιο |
| **Υπερημερία** | Ξεκινά μετά από έγγραφη όχληση ή αυτοδίκαια (αν προβλέπεται) |
| **Καταγγελία** | Δικαίωμα πωλητή αν > 2 δόσεις ληξιπρόθεσμες (αν στο συμβόλαιο) |
| **Ποινική ρήτρα** | Μέχρι 5% ανά ληξιπρόθεσμη δόση (αν στο συμβόλαιο) |

---

## 3. Data Model — Extensions

### 3.1 Extended Installment Interface

```typescript
import type { Timestamp } from 'firebase/firestore';

/**
 * Extended Installment — επέκταση του βασικού Installment (ADR-234 §3.1)
 * Προσθήκη: grace period, late fees, milestone linking, allocation tracking
 */
export interface InstallmentExtended {
  // --- Base fields (from ADR-234) ---
  index: number;
  label: string;
  type: InstallmentType;
  amount: number;
  percentage: number;
  dueDate: Timestamp;
  status: InstallmentStatus;
  paidAmount: number;
  paidDate: Timestamp | null;
  paymentId: string | null;
  notes: string | null;

  // --- Grace Period ---

  /** Ημέρες χάριτος μετά το dueDate (default: 0 = OFF) */
  gracePeriodDays: number;

  /**
   * Effective due date = dueDate + gracePeriodDays
   * Μετά αυτή, η δόση γίνεται "overdue" αντί "due"
   */
  effectiveDueDate: Timestamp;

  // --- Late Fee ---

  /** Late fee τύπος */
  lateFeeType: 'none' | 'fixed_percentage' | 'daily_percentage';

  /** Late fee ποσοστό (π.χ. 5 = 5% ή 0.1 = 0.1%/ημέρα) */
  lateFeeRate: number;

  /** Υπολογισμένο late fee ποσό (σήμερα) */
  lateFeeAmount: number;

  /** Late fee cap (μέγιστο ποσοστό, π.χ. 10%) */
  lateFeeCapPercentage: number | null;

  // --- Milestone Link ---

  /** Σύνδεση με κατασκευαστικό milestone (αν stage_payment) */
  milestoneId: string | null;

  /** Ημ. ολοκλήρωσης milestone (trigger: unlocks installment) */
  milestoneCompletedDate: Timestamp | null;

  /** Milestone locked; (δεν μπορεί να πληρωθεί πριν ολοκληρωθεί) */
  milestoneLocked: boolean;

  // --- Payment Allocation ---

  /**
   * Πολλαπλές πληρωμές μπορούν να καλύψουν μία δόση.
   * Π.χ. partial 1 + partial 2 + final = total.
   */
  paymentAllocations: PaymentAllocation[];

  // --- Overdue ---

  /** Ημέρες υπερημερίας (υπολογισμένο, 0 αν δεν είναι overdue) */
  daysOverdue: number;

  /** Aging bucket */
  agingBucket: AgingBucket;
}

/** Αντιστοίχιση πληρωμής → δόση */
export interface PaymentAllocation {
  /** Reference → PaymentRecord.id */
  paymentId: string;

  /** Ποσό που εφαρμόστηκε σε αυτή τη δόση */
  allocatedAmount: number;

  /** Ημερομηνία εφαρμογής */
  allocationDate: Timestamp;
}

/** Aging bucket categories */
export type AgingBucket =
  | 'current'    // Δεν είναι ληξιπρόθεσμη
  | '1_30'       // 1-30 ημέρες
  | '31_60'      // 31-60 ημέρες
  | '61_90'      // 61-90 ημέρες
  | '90_plus';   // 90+ ημέρες
```

### 3.2 Extended PaymentRecord Interface

```typescript
/**
 * Extended PaymentRecord — επέκταση του βασικού (ADR-234 §3.1)
 * Προσθήκη: split allocation, overpayment handling, reconciliation
 */
export interface PaymentRecordExtended {
  // --- Base fields (from ADR-234) ---
  id: string;
  paymentPlanId: string;
  installmentIndex: number;
  amount: number;
  method: PaymentMethod;
  paymentDate: Timestamp;
  methodDetails: PaymentMethodDetails;
  invoiceId: string | null;
  transactionChainId: string | null;
  notes: string | null;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;

  // --- Split Payment (μία πληρωμή → πολλές δόσεις) ---

  /**
   * Αν η πληρωμή καλύπτει πολλαπλές δόσεις (split payment).
   * Αν null/empty → η πληρωμή αφορά μόνο installmentIndex.
   */
  splitAllocations: SplitAllocation[];

  /** Συνολικό ποσό πληρωμής (= amount, αλλά allocations αθροίζουν) */
  totalAllocated: number;

  // --- Overpayment ---

  /** Ποσό πέραν του οφειλόμενου (θετικό αν υπάρχει) */
  overpaymentAmount: number;

  /** Τι γίνεται με την περίσσεια */
  overpaymentHandling: OverpaymentHandling | null;

  // --- Reconciliation ---

  /** Ημερομηνία που η τράπεζα επιβεβαίωσε (value date) */
  valueDate: Timestamp | null;

  /** Reconciled (ταιριάζει με bank statement); */
  reconciled: boolean;

  /** Ημερομηνία reconciliation */
  reconciledDate: Timestamp | null;

  // --- Reversal ---

  /** Αν αυτή η πληρωμή ακυρώθηκε / reversed */
  reversed: boolean;

  /** Λόγος ακύρωσης */
  reversalReason: string | null;

  /** Ημερομηνία ακύρωσης */
  reversalDate: Timestamp | null;

  /** Reference → νέα πληρωμή (αν αντικαταστάθηκε) */
  replacedByPaymentId: string | null;
}

/** Allocation ανά δόση (split payment) */
export interface SplitAllocation {
  /** Index δόσης */
  installmentIndex: number;

  /** Ποσό που εφαρμόστηκε */
  amount: number;
}

/** Τρόπος χειρισμού περίσσειας */
export type OverpaymentHandling =
  | 'apply_to_next'    // Εφαρμογή στην επόμενη δόση
  | 'credit_note'      // Πιστωτικό σημείωμα
  | 'refund'           // Επιστροφή στον αγοραστή
  | 'hold';            // Κράτηση (αναμένεται απόφαση)
```

### 3.3 PaymentPlanConfig (Plan-Level Settings)

```typescript
/**
 * Configurable settings ανά Payment Plan
 * Embedded στο PaymentPlan document
 */
export interface PaymentPlanConfig {
  /** Default grace period ημέρες (override per installment) */
  defaultGracePeriodDays: number;  // Default: 0 (OFF — καμία χάρη)

  /** Default late fee type */
  defaultLateFeeType: 'none' | 'fixed_percentage' | 'daily_percentage';  // Default: 'none' (OFF)

  /** Default late fee rate */
  defaultLateFeeRate: number;  // Default: 0 (OFF — ενεργοποιείται μόνο αν ο χρήστης το θέλει)

  /** Late fee cap (safety net — ενεργό μόνο αν late fee > 'none') */
  defaultLateFeeCapPercentage: number | null;  // Default: 10

  /** Sequential payment enforced; (πρέπει πρώτα #1, μετά #2) */
  sequentialPaymentRequired: boolean;  // Default: true (2026-03-15 — αγοραστές πληρώνουν συνήθως με σειρά)

  /** Allow partial payments; */
  allowPartialPayments: boolean;  // Default: true

  /** Allow overpayments; */
  allowOverpayments: boolean;  // Default: true

  /** Auto-apply overpayment to next installment */
  autoApplyOverpayment: boolean;  // Default: true

  /** Currency */
  currency: 'EUR';
}
```

---

## 4. Payment Scenarios (Business Logic)

### 4.1 Scenario: Normal Payment (1:1)

```
Δόση #3: €25.000 (due: 2026-04-15)
Πληρωμή: €25.000 (date: 2026-04-10)

→ installment[3].status = 'paid'
→ installment[3].paidAmount = 25000
→ installment[3].paidDate = 2026-04-10
→ installment[3].paymentAllocations = [{ paymentId: 'pay_xxx', allocatedAmount: 25000 }]
→ PaymentRecord: amount = 25000, installmentIndex = 3
→ Sync PaymentSummary
```

### 4.2 Scenario: Partial Payment

```
Δόση #3: €25.000 (due: 2026-04-15)
Πληρωμή 1: €15.000 (date: 2026-04-10)
Πληρωμή 2: €10.000 (date: 2026-04-20)

Μετά πληρωμή 1:
→ installment[3].status = 'partial'
→ installment[3].paidAmount = 15000
→ installment[3].paymentAllocations = [{ paymentId: 'pay_1', allocatedAmount: 15000 }]
→ remaining = 25000 - 15000 = 10000

Μετά πληρωμή 2:
→ installment[3].status = 'paid'
→ installment[3].paidAmount = 25000
→ installment[3].paymentAllocations = [
    { paymentId: 'pay_1', allocatedAmount: 15000 },
    { paymentId: 'pay_2', allocatedAmount: 10000 }
  ]
```

### 4.3 Scenario: Overpayment

```
Δόση #3: €25.000
Πληρωμή: €30.000

→ installment[3].status = 'paid'
→ installment[3].paidAmount = 25000
→ PaymentRecord: amount = 30000, overpaymentAmount = 5000

Αν autoApplyOverpayment = true:
→ installment[4].paidAmount += 5000
→ installment[4].status = 'partial' (αν 5000 < installment[4].amount)
→ PaymentRecord.splitAllocations = [
    { installmentIndex: 3, amount: 25000 },
    { installmentIndex: 4, amount: 5000 }
  ]

Αν autoApplyOverpayment = false:
→ PaymentRecord.overpaymentHandling = 'hold'
→ UI: prompt user — "Τι θέλετε να κάνετε με τα €5.000 περίσσεια;"
```

### 4.4 Scenario: Split Payment (1 πληρωμή → πολλές δόσεις)

```
Δόση #3: €25.000 (partial: €15.000 paid, remaining: €10.000)
Δόση #4: €20.000 (pending)
Πληρωμή: €30.000

Allocation:
→ installment[3]: +€10.000 (completes) → status = 'paid'
→ installment[4]: +€20.000 (completes) → status = 'paid'
→ PaymentRecord.splitAllocations = [
    { installmentIndex: 3, amount: 10000 },
    { installmentIndex: 4, amount: 20000 }
  ]
→ PaymentRecord.totalAllocated = 30000
```

### 4.5 Scenario: Late Payment with Grace Period

```
Δόση #3: €25.000 (due: 2026-04-15, grace: 15 days)
effectiveDueDate = 2026-04-30

Πληρωμή: €25.000 (date: 2026-05-10)

→ daysOverdue = 10 (μετά τη grace period)
→ Late fee (5% fixed): €25.000 × 5% = €1.250
→ Total owed: €25.000 + €1.250 = €26.250

Option A: Αγοραστής πληρώνει €26.250 → covers installment + fee
Option B: Αγοραστής πληρώνει €25.000 → installment paid, fee outstanding
```

---

## 5. Grace Period & Late Fee Engine

> **Απόφαση 2026-03-15 (Γιώργος)**: Grace period και late fees είναι **configurable, default OFF**.
> - Out of the box: grace = 0 ημέρες, late fee = none
> - Ο χρήστης ενεργοποιεί μόνο αν θέλει (π.χ. ρήτρα σε συμβόλαιο)
> - Αν δεν αγγιχτεί τίποτα → δόση λήγει, γίνεται "ληξιπρόθεσμη", μηδέν πρόστιμα
> - Ο κώδικας υπάρχει, δεν κοστίζει σε πολυπλοκότητα (5 γραμμές υπολογισμός)

### 5.1 Grace Period Calculation

```
effectiveDueDate = dueDate + gracePeriodDays (calendar days)

Installment status logic:
- TODAY < dueDate                         → 'pending'
- dueDate ≤ TODAY ≤ effectiveDueDate      → 'due' (within grace)
- TODAY > effectiveDueDate AND paidAmount < amount → 'due' (overdue)
```

### 5.2 Late Fee Calculation

```typescript
type LateFeeCalculation = {
  /** Σταθερό ποσοστό: amount × rate% (μία φορά) */
  fixed_percentage: (amount: number, rate: number) => number;

  /** Ημερήσιο ποσοστό: amount × rate% × daysOverdue */
  daily_percentage: (amount: number, rate: number, days: number) => number;
};

// Cap: min(calculated, amount × capPercentage%)
```

### 5.3 Late Fee Capping

```
lateFee = min(calculatedFee, unpaidAmount × lateFeeCapPercentage / 100)

Παράδειγμα:
  Δόση €25.000, daily 0.1%, cap 10%, 120 ημέρες overdue
  Raw: 25000 × 0.001 × 120 = €3.000
  Cap: 25000 × 10% = €2.500
  → lateFee = €2.500 (capped)
```

---

## 6. Aging Analysis

### 6.1 Aging Buckets

| Bucket | Days Overdue | Color | Severity |
|--------|-------------|-------|----------|
| `current` | 0 (not overdue) | Green | — |
| `1_30` | 1-30 | Yellow | Low |
| `31_60` | 31-60 | Orange | Medium |
| `61_90` | 61-90 | Red | High |
| `90_plus` | 90+ | Dark Red | Critical |

### 6.2 Aging Calculation

```
daysOverdue = max(0, TODAY - effectiveDueDate)  // in calendar days

agingBucket:
  daysOverdue = 0         → 'current'
  1 ≤ daysOverdue ≤ 30    → '1_30'
  31 ≤ daysOverdue ≤ 60   → '31_60'
  61 ≤ daysOverdue ≤ 90   → '61_90'
  daysOverdue > 90        → '90_plus'
```

### 6.3 Aging Report (Project-Level)

```typescript
interface AgingReport {
  projectId: string;
  reportDate: Timestamp;

  /** Σύνολα ανά bucket */
  summary: {
    current: number;      // Ποσό (€)
    bucket_1_30: number;
    bucket_31_60: number;
    bucket_61_90: number;
    bucket_90_plus: number;
    totalOverdue: number;
    totalOutstanding: number;
  };

  /** Αναλυτικά per unit */
  details: AgingReportEntry[];
}

interface AgingReportEntry {
  unitId: string;
  unitLabel: string;
  buyerName: string;
  installmentIndex: number;
  installmentLabel: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: Timestamp;
  daysOverdue: number;
  agingBucket: AgingBucket;
  lateFeeAmount: number;
}
```

---

## 7. Payment Templates

### 7.1 Predefined Templates

> **Απόφαση 2026-03-15 (Γιώργος)**: Τα ποσοστά είναι **θέμα συμφωνίας** — δεν υπάρχει σταθερό template.
> Η κράτηση (reservation) είναι τυπικά **σταθερό ποσό** (π.χ. €5.000), όχι ποσοστό.
> Τα templates είναι **αφετηρία** — ο χρήστης αλλάζει ελεύθερα ποσοστά/ποσά στο wizard.

| Template | Δόσεις | Φάσεις (ενδεικτικά ποσοστά — ο χρήστης τα αλλάζει) |
|----------|--------|------|
| **Off-Plan Πλήρης (9 δόσεις)** | 9 | Κράτηση (ποσό) → Προκαταβολή → Θεμελίωση → Σκελετός → Τοιχοποιία → Σοβάδες → Δάπεδα → Κουφώματα → Αποπεράτωση + Οριστικό |
| **Off-Plan Συμπυκνωμένο (5 δόσεις)** | 5 | Κράτηση (ποσό) → Προκαταβολή → Σκελετός → Αποπεράτωση → Οριστικό |
| **Έτοιμο Ακίνητο (3 δόσεις)** | 3 | Κράτηση (ποσό) → Προκαταβολή → Οριστικό (+ δάνειο) |
| **Εφάπαξ (1 δόση)** | 1 | Ολόκληρο το ποσό (μετρητά ή δάνειο) |
| **Custom** | N | Ελεύθερη διαμόρφωση — ο χρήστης προσθέτει φάσεις |

#### Milestones Κατασκευής (Standard Set)

Τα **κατασκευαστικά milestones** που μπορεί να επιλέξει ο χρήστης ως trigger δόσης:

| # | Milestone | Ελληνικά | Τυπική σειρά |
|---|-----------|----------|-------------|
| 1 | `foundation` | Θεμελίωση | 1ο |
| 2 | `frame` | Σκελετός | 2ο |
| 3 | `masonry` | Τοιχοποιία | 3ο |
| 4 | `plastering` | Σοβάδες | 4ο |
| 5 | `flooring` | Δάπεδα | 5ο |
| 6 | `windows_doors` | Κουφώματα | 6ο |
| 7 | `completion` | Αποπεράτωση | 7ο |

### 7.2 Template Interface

```typescript
export interface PaymentPlanTemplate {
  /** Unique template ID */
  id: string;

  /** Display name (i18n key) */
  nameKey: string;

  /** Περιγραφή */
  descriptionKey: string;

  /** Installment slots */
  slots: TemplateSlot[];

  /** Default config */
  defaultConfig: PaymentPlanConfig;
}

export interface TemplateSlot {
  /** Τύπος δόσης */
  type: InstallmentType;

  /** Default label (i18n key) */
  labelKey: string;

  /**
   * Ποσοστό (0-100) — ΑΝ amountType = 'percentage'.
   * Αν amountType = 'fixed', αυτό είναι 0 (υπολογίζεται αυτόματα).
   */
  percentage: number;

  /**
   * Τρόπος ορισμού ποσού:
   * 'percentage': ποσοστό επί της τελικής τιμής (π.χ. 25%)
   * 'fixed': σταθερό ποσό (π.χ. €5.000 κράτηση)
   */
  amountType: 'percentage' | 'fixed';

  /** Σταθερό ποσό (μόνο αν amountType = 'fixed') */
  fixedAmount: number | null;

  /**
   * Trigger: πότε γίνεται due
   * 'immediate': αμέσως
   * 'days_from_start': +N ημέρες
   * 'milestone': κατά milestone
   * 'contract_phase': κατά ADR-230 φάση
   */
  triggerType: 'immediate' | 'days_from_start' | 'milestone' | 'contract_phase';

  /** Ημέρες αν triggerType = 'days_from_start' */
  triggerDays: number | null;

  /** Milestone label αν triggerType = 'milestone' */
  triggerMilestone: string | null;

  /** Contract phase αν triggerType = 'contract_phase' */
  triggerPhase: string | null;
}
```

### 7.3 Template → Plan Wizard

```
Βήμα 1: Επιλογή template ή "Custom"
Βήμα 2: Input totalAmount (finalPrice)
Βήμα 3: Auto-calculate amounts per slot (percentage × total)
Βήμα 4: Set due dates (manual ή auto-calculate)
Βήμα 5: Configure grace period, late fee settings
Βήμα 6: Review & Create
```

---

## 8. UI Components & Flow

### 8.1 Component Tree

| Component | Location | Description |
|-----------|----------|-------------|
| `PaymentPlanTab` | Sales Sidebar tab | Master container |
| `PaymentPlanOverview` | PaymentPlanTab | Summary: progress bar, amounts, status |
| `InstallmentSchedule` | PaymentPlanTab | Table/list δόσεων |
| `InstallmentRow` | InstallmentSchedule | Μεμονωμένη δόση — status, amount, actions |
| `RecordPaymentDialog` | Modal | Καταγραφή πληρωμής — amount, method, allocation |
| `PaymentAllocationPanel` | RecordPaymentDialog | Split/partial allocation UI |
| `PaymentHistoryTable` | PaymentPlanTab | Ιστορικό πληρωμών |
| `CreatePaymentPlanWizard` | Modal | Template selection → config → create |
| `AgingReportView` | Project-level page | Aging report per project |
| `OverdueAlertBanner` | PaymentPlanTab / Dashboard | Ληξιπρόθεσμα warning |
| `LateFeeIndicator` | InstallmentRow | Late fee badge αν overdue |
| `ProgressBar` | PaymentPlanOverview | Visual % paid |

### 8.2 PaymentPlanOverview Card

```
┌──────────────────────────────────────────────────────────┐
│ 📋 Πρόγραμμα Αποπληρωμής          Status: ● Ενεργό      │
│                                                           │
│ Συνολικό Ποσό:    €150.000                               │
│ Πληρωμένο:        €55.000  (36.7%)                       │
│ Υπόλοιπο:         €95.000                                │
│                                                           │
│ ████████████░░░░░░░░░░░░░░░░░░░░  36.7%                  │
│                                                           │
│ Δόσεις: 3/6 πληρωμένες  │  Ληξιπρόθεσμες: 1 ⚠️          │
│ Επόμενη: €25.000 στις 15/04/2026                         │
│                                                           │
│ [Καταγραφή Πληρωμής]  [Ιστορικό]  [Λεπτομέρειες]       │
└──────────────────────────────────────────────────────────┘
```

### 8.3 InstallmentSchedule Table

| # | Ετικέτα | Ποσό | Ημ. Λήξης | Πληρωμένο | Κατάσταση | Actions |
|---|---------|------|-----------|-----------|-----------|---------|
| 1 | Κράτηση | €5.000 | 01/01/26 | €5.000 | ✅ Paid | View |
| 2 | Προκαταβολή | €30.000 | 15/01/26 | €30.000 | ✅ Paid | View |
| 3 | Θεμελίωση | €20.000 | 15/03/26 | €20.000 | ✅ Paid | View |
| 4 | Σκελετός | €25.000 | 15/04/26 | €0 | ⏳ Due | **[Πληρωμή]** |
| 5 | Αποπεράτωση | €35.000 | 15/07/26 | €0 | 📅 Pending | — |
| 6 | Συμβόλαιο | €35.000 | 15/10/26 | €0 | 📅 Pending | — |

### 8.4 RecordPaymentDialog Flow

```
┌─────────────────────────────────────────────────────┐
│ 💳 Καταγραφή Πληρωμής                              │
│                                                      │
│ Ποσό: [€_________]                                  │
│                                                      │
│ Μέσο πληρωμής: [▼ Τραπεζική Μεταφορά           ]  │
│                                                      │
│ Ημερομηνία: [15/04/2026]                            │
│                                                      │
│ ── Στοιχεία Μεταφοράς ──                            │
│ Τράπεζα: [▼ Εθνική Τράπεζα]                        │
│ IBAN: [GR__________________________]                │
│ Αρ. Ref: [___________]                              │
│                                                      │
│ ── Αντιστοίχιση ──                                   │
│ ◉ Δόση #4 — Σκελετός (€25.000)                     │
│ ○ Split σε πολλές δόσεις                            │
│ ○ Custom allocation                                  │
│                                                      │
│ Σημειώσεις: [_________________________]             │
│                                                      │
│           [Ακύρωση]  [Καταχώρηση]                   │
└─────────────────────────────────────────────────────┘
```

Αν **split**:

```
│ ── Split Allocation ──                               │
│ Δόση #3 (υπόλοιπο €10.000): [€10.000]              │
│ Δόση #4 (€25.000):          [€20.000]              │
│ Σύνολο allocation:           €30.000 ✅              │
```

---

## 9. API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/units/[unitId]/payment-plan` | Get active plan + installments |
| `POST` | `/api/units/[unitId]/payment-plan` | Create plan (from template or custom) |
| `PATCH` | `/api/units/[unitId]/payment-plan` | Update plan settings |
| `POST` | `/api/units/[unitId]/payment-plan/installments` | Add installment |
| `PATCH` | `/api/units/[unitId]/payment-plan/installments/[index]` | Update installment |
| `DELETE` | `/api/units/[unitId]/payment-plan/installments/[index]` | Remove installment (draft only) |
| `POST` | `/api/units/[unitId]/payments` | Record payment (with allocation) |
| `GET` | `/api/units/[unitId]/payments` | Payment history |
| `POST` | `/api/units/[unitId]/payments/[paymentId]/reverse` | Reverse payment |
| `GET` | `/api/units/[unitId]/payment-plan/aging` | Aging analysis per unit |
| `GET` | `/api/projects/[projectId]/aging-report` | Aging report per project |
| `GET` | `/api/payment-templates` | List available templates |

---

## 10. Integration Points

| System | Integration | Details |
|--------|-------------|---------|
| **ADR-234 Core** | PaymentPlan, PaymentRecord base types | Extends interfaces |
| **SPEC-234A Cheques** | Payment method = cheque → link ChequeRecord | Cross-reference via chequeId |
| **SPEC-234B Bills** | Payment method = promissory_note → link BillRecord | Cross-reference via billId |
| **SPEC-234C Loans** | Disbursement → PaymentRecord auto-creation | Automatic |
| **ADR-198 Accounting** | Every payment → SalesAccountingBridge → Invoice | Automatic |
| **ADR-230 Contracts** | Contract phase change → unlock installments | Trigger |
| **ADR-197 Sales** | Unit sale → triggers CreatePaymentPlan | Workflow |
| **Dashboard** | Overdue count, aging summary, next due | Real-time widgets |
| **Notifications** | Overdue alerts, approaching due dates | Phase 4 |

---

## 11. i18n Keys

```json
{
  "installments": {
    "title": "Δόσεις",
    "schedule": "Πρόγραμμα Δόσεων",
    "addInstallment": "Προσθήκη Δόσης",

    "status": {
      "pending": "Αναμένεται",
      "due": "Ληξιπρόθεσμη",
      "paid": "Πληρωμένη",
      "partial": "Μερικώς Πληρωμένη",
      "waived": "Χαρισμένη"
    },

    "gracePeriod": {
      "label": "Περίοδος Χάριτος",
      "days": "{days} ημέρες",
      "withinGrace": "Εντός περιόδου χάριτος"
    },

    "lateFee": {
      "label": "Πρόστιμο Καθυστέρησης",
      "fixed": "{rate}% εφάπαξ",
      "daily": "{rate}%/ημέρα",
      "capped": "Μέγιστο: {cap}%",
      "amount": "Πρόστιμο: €{amount}"
    },

    "aging": {
      "title": "Ανάλυση Ηλικίας Οφειλών",
      "current": "Τρέχουσες",
      "bucket_1_30": "1-30 ημέρες",
      "bucket_31_60": "31-60 ημέρες",
      "bucket_61_90": "61-90 ημέρες",
      "bucket_90_plus": "90+ ημέρες",
      "totalOverdue": "Σύνολο Ληξιπρόθεσμων",
      "daysOverdue": "{days} ημέρες υπερημερίας"
    }
  },

  "payments": {
    "title": "Πληρωμές",
    "recordPayment": "Καταγραφή Πληρωμής",
    "history": "Ιστορικό Πληρωμών",

    "allocation": {
      "single": "Μία Δόση",
      "split": "Πολλαπλές Δόσεις",
      "custom": "Προσαρμοσμένη Κατανομή"
    },

    "overpayment": {
      "detected": "Περίσσεια €{amount}",
      "applyToNext": "Εφαρμογή στην Επόμενη Δόση",
      "creditNote": "Πιστωτικό Σημείωμα",
      "refund": "Επιστροφή",
      "hold": "Κράτηση (Αναμονή)"
    },

    "reversal": {
      "title": "Ακύρωση Πληρωμής",
      "reason": "Λόγος Ακύρωσης",
      "confirm": "Επιβεβαίωση Ακύρωσης"
    },

    "reconciliation": {
      "reconciled": "Συμφωνημένη",
      "pending": "Εκκρεμής Συμφωνία",
      "valueDate": "Ημ. Αξίας (Value Date)"
    }
  },

  "templates": {
    "title": "Πρότυπα Αποπληρωμής",
    "standardOffPlan5": "Standard Off-Plan (5 δόσεις)",
    "standardOffPlan7": "Standard Off-Plan (7 δόσεις)",
    "readyUnit": "Έτοιμη Μονάδα (3 δόσεις)",
    "loanHeavy": "Δάνειο Κυρίαρχο (3 δόσεις)",
    "equalMonthly": "Ισόποσες Μηνιαίες",
    "custom": "Προσαρμοσμένο"
  },

  "wizard": {
    "title": "Δημιουργία Προγράμματος Αποπληρωμής",
    "step1_template": "Επιλογή Προτύπου",
    "step2_amounts": "Ποσά",
    "step3_dates": "Ημερομηνίες",
    "step4_config": "Ρυθμίσεις",
    "step5_review": "Επισκόπηση"
  }
}
```

---

## 12. Verification Criteria

1. `InstallmentExtended` + `PaymentRecordExtended`: πλήρεις, χωρίς `any`
2. Partial payment: installment.status transitions (pending → partial → paid)
3. Split payment: allocation array sums to total amount
4. Overpayment: 4 handling options, auto-apply to next
5. Grace period: correct effectiveDueDate calculation
6. Late fee: fixed + daily + capping
7. Aging buckets: correct categorization
8. Templates: 6 predefined, wizard flow
9. Reversal: safe undo with reason + audit
10. Integration: cheque/bill/loan cross-references
11. i18n: EL + EN πλήρεις

---

*SPEC Format: Google Engineering Design Docs standard*
