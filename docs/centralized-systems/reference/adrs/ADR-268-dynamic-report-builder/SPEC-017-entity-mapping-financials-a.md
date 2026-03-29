# SPEC-017: Πλήρης Χαρτογράφηση — Οικονομικά A (Payment Plans + Cheques + Legal Contracts)

**ADR**: 268 — Dynamic Report Builder
**Version**: 1.0
**Last Updated**: 2026-03-29
**Source of Truth**: Κώδικας (`src/types/payment-plan.ts`, `src/types/loan-tracking.ts`, `src/types/cheque-registry.ts`, `src/types/legal-contracts.ts`)

---

# ΟΝΤΟΤΗΤΑ 1: Payment Plans (Πλάνα Πληρωμών)

## 1.1 Ταυτότητα Οντότητας

| Στοιχείο | Τιμή |
|----------|------|
| **Collection** | `units/{unitId}/payment_plans` (subcollection) |
| **TypeScript** | `PaymentPlan` (`src/types/payment-plan.ts`) |
| **ID Pattern** | Enterprise ID (`enterprise-id.service.ts`) |
| **Tenant Isolation** | Inherited via unit → building → project → `companyId` |
| **FSM** | 5-state: `negotiation → draft → active → completed / cancelled` |
| **ADRs** | ADR-234 (Payment Plan & Installment Tracking), ADR-244 (Multi-Owner Support) |

---

## 1.2 Πλήρης Κατάλογος Πεδίων

### 1.2.1 Βασικά Στοιχεία

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | Yes | Document ID |
| 2 | `unitId` | string | Yes | FK → unit |
| 3 | `buildingId` | string | Yes | FK → building |
| 4 | `projectId` | string | Yes | FK → project |
| 5 | `buyerContactId` | string | Yes | FK → contacts (αγοραστής) |
| 6 | `buyerName` | string | Yes | Denormalized display name |
| 7 | `status` | PaymentPlanStatus | Yes | `negotiation` / `draft` / `active` / `completed` / `cancelled` |

### 1.2.2 ADR-244: Multi-Owner Support

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 8 | `planGroupId` | string? | No | Ομάδα πλάνων — συνδέει joint/individual plans |
| 9 | `planType` | `'joint'` / `'individual'` | No | Κοινό ή ατομικό πλάνο |
| 10 | `ownerContactId` | string? | No | FK → contacts (ιδιοκτήτης αυτού του πλάνου, null = κοινό) |
| 11 | `ownerName` | string? | No | Ονοματεπώνυμο ιδιοκτήτη |
| 12 | `ownershipPct` | number? | No | Ποσοστό ιδιοκτησίας (π.χ. 70 = 70%) |

### 1.2.3 Ποσά

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 13 | `totalAmount` | number | Yes | Συνολικό ποσό (€) |
| 14 | `paidAmount` | number | Yes | Πληρωμένο ποσό |
| 15 | `remainingAmount` | number | Yes | Υπόλοιπο |
| 16 | `currency` | `'EUR'` | Yes | Πάντα EUR |

### 1.2.4 Φορολογικό Καθεστώς

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 17 | `taxRegime` | SaleTaxRegime | Yes | `vat_24` / `vat_suspension_3` / `transfer_tax_3` / `custom` |
| 18 | `taxRate` | number | Yes | Ποσοστό φόρου |

### 1.2.5 Audit

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 19 | `notes` | string | No | Ελεύθερες σημειώσεις |
| 20 | `createdAt` | string (ISO) | Yes | Ημ/νία δημιουργίας |
| 21 | `createdBy` | string | Yes | User ID δημιουργού |
| 22 | `updatedAt` | string (ISO) | Yes | Ημ/νία ενημέρωσης |
| 23 | `updatedBy` | string | Yes | User ID τελευταίας αλλαγής |

---

## 1.3 Nested Objects & Arrays

### 1.3.1 `installments[]` (Installment)

Κάθε δόση στο πρόγραμμα αποπληρωμής.

| Πεδίο | Τύπος | Required | Περιγραφή |
|-------|-------|----------|-----------|
| `index` | number | Yes | Αύξων αριθμός (0-based) |
| `label` | string | Yes | Ετικέτα (π.χ. "Κράτηση", "Θεμελίωση 30%") |
| `type` | InstallmentType | Yes | `reservation` / `down_payment` / `stage_payment` / `final_payment` / `custom` |
| `amount` | number | Yes | Ποσό δόσης (gross) |
| `percentage` | number | Yes | Ποσοστό επί τελικής τιμής |
| `dueDate` | string (ISO) | Yes | Ημ/νία λήξης |
| `status` | InstallmentStatus | Yes | `pending` / `due` / `paid` / `partial` / `waived` |
| `paidAmount` | number | Yes | Πληρωμένο ποσό |
| `paidDate` | string? | No | Ημ/νία πληρωμής |
| `paymentIds` | string[] | Yes | IDs πληρωμών στο payments subcollection |
| `notes` | string? | No | Σημειώσεις |

### 1.3.2 `loan` (LoanInfo) — Legacy Phase 1

| Πεδίο | Τύπος | Required | Περιγραφή |
|-------|-------|----------|-----------|
| `status` | LoanStatus | Yes | `not_applicable` / `pending` / `applied` / `pre_approved` / `approved` / `disbursed` / `rejected` |
| `bankName` | string? | No | Τράπεζα |
| `loanAmount` | number? | No | Ποσό δανείου |
| `financingPercentage` | number? | No | % χρηματοδότησης |
| `interestRate` | number? | No | Επιτόκιο |
| `termYears` | number? | No | Διάρκεια (έτη) |
| `approvalDate` | string? | No | Ημ/νία έγκρισης |
| `disbursementDate` | string? | No | Ημ/νία εκταμίευσης |
| `bankReferenceNumber` | string? | No | Αριθμός αναφοράς τράπεζας |
| `notes` | string? | No | Σημειώσεις |

### 1.3.3 `loans[]` (LoanTracking) — Phase 2 Multi-Bank

Πλήρης παρακολούθηση δανείων. Αντικαθιστά `loan` (backward compatible).

| Πεδίο | Τύπος | Required | Περιγραφή |
|-------|-------|----------|-----------|
| `loanId` | string | Yes | Internal ID |
| `isPrimary` | boolean | Yes | Κύριο ή δευτερεύον δάνειο |
| `status` | LoanTrackingStatus | Yes | 15-state FSM (βλ. παρακάτω) |
| `bankName` | string | Yes | Τράπεζα |
| `bankBranch` | string? | No | Υποκατάστημα |
| `bankReferenceNumber` | string? | No | Αρ. αναφοράς |
| `bankContactPerson` | string? | No | Υπεύθυνος τράπεζας |
| `bankContactPhone` | string? | No | Τηλ. υπευθύνου |
| `requestedAmount` | number? | No | Αιτηθέν ποσό |
| `approvedAmount` | number? | No | Εγκεκριμένο ποσό |
| `disbursedAmount` | number | Yes | Εκταμιευμένο ποσό |
| `remainingDisbursement` | number | Yes | Υπολειπόμενη εκταμίευση |
| `ltvPercentage` | number? | No | Loan-to-Value % |
| `interestRate` | number? | No | Επιτόκιο |
| `interestRateType` | InterestRateType? | No | `fixed` / `variable` / `mixed` |
| `termYears` | number? | No | Διάρκεια (έτη) |
| `monthlyPayment` | number? | No | Μηνιαία δόση |
| `dstiRatio` | number? | No | Debt-Service-To-Income ratio |
| `bankFees` | number? | No | Τραπεζικά έξοδα |
| `disbursementType` | DisbursementType | Yes | `lump_sum` / `phased` |
| `collateralType` | CollateralType? | No | `mortgage` / `pre_notation` / `personal_guarantee` / `other` |
| `collateralAmount` | number? | No | Ποσό εγγύησης |
| `collateralRegistrationNumber` | string? | No | Αρ. εγγραφής υποθήκης |
| `collateralRegistrationDate` | string? | No | Ημ/νία εγγραφής |
| `appraisalValue` | number? | No | Αξία εκτίμησης |
| `appraisalDate` | string? | No | Ημ/νία εκτίμησης |
| `appraiserName` | string? | No | Εκτιμητής |
| `applicationDate` | string? | No | Ημ/νία αίτησης |
| `preApprovalDate` | string? | No | Ημ/νία προέγκρισης |
| `approvalDate` | string? | No | Ημ/νία έγκρισης |
| `firstDisbursementDate` | string? | No | Ημ/νία 1ης εκταμίευσης |
| `fullDisbursementDate` | string? | No | Ημ/νία πλήρους εκταμίευσης |
| `preApprovalExpiryDate` | string? | No | Λήξη προέγκρισης |
| `notes` | string? | No | Σημειώσεις |
| `createdAt` | string (ISO) | Yes | Δημιουργία |
| `updatedAt` | string (ISO) | Yes | Ενημέρωση |

#### LoanTracking — Nested: `disbursements[]` (DisbursementEntry)

| Πεδίο | Τύπος | Required | Περιγραφή |
|-------|-------|----------|-----------|
| `order` | number | Yes | Σειρά (1, 2, 3…) |
| `amount` | number | Yes | Ποσό εκταμίευσης |
| `milestone` | string | Yes | Ετικέτα ορόσημου (π.χ. "Θεμελίωση") |
| `disbursementDate` | string? | No | Ημ/νία |
| `status` | DisbursementStatus | Yes | `pending` / `requested` / `approved` / `disbursed` |
| `paymentMethod` | `'crossed_cheque'` / `'wire_transfer'`? | No | Μέσο |
| `paymentId` | string? | No | FK → PaymentRecord |
| `notes` | string? | No | Σημειώσεις |

#### LoanTracking — Nested: `communicationLog[]` (BankCommunicationEntry)

| Πεδίο | Τύπος | Required | Περιγραφή |
|-------|-------|----------|-----------|
| `date` | string (ISO) | Yes | Ημ/νία επικοινωνίας |
| `type` | CommunicationEntryType | Yes | `phone` / `email` / `meeting` / `document` / `note` |
| `summary` | string | Yes | Περίληψη |
| `contactPerson` | string? | No | Υπεύθυνος |
| `nextAction` | string? | No | Επόμενη ενέργεια |
| `nextActionDate` | string? | No | Προθεσμία |

### 1.3.4 `config` (PaymentPlanConfig)

| Πεδίο | Τύπος | Default | Περιγραφή |
|-------|-------|---------|-----------|
| `defaultGracePeriodDays` | number | 0 | Περίοδος χάριτος (ημέρες) |
| `defaultLateFeeType` | `'none'` / `'fixed_percentage'` / `'daily_percentage'` | `'none'` | Τύπος τόκου υπερημερίας |
| `defaultLateFeeRate` | number | 0 | Ποσοστό τόκου |
| `defaultLateFeeCapPercentage` | number? | 10 | Ανώτατο πλαφόν τόκων |
| `sequentialPaymentRequired` | boolean | true | Σειριακή πληρωμή δόσεων |
| `allowPartialPayments` | boolean | true | Μερικές πληρωμές |
| `allowOverpayments` | boolean | true | Υπερπληρωμές |
| `autoApplyOverpayment` | boolean | true | Αυτόματη εφαρμογή υπερπληρωμής |
| `currency` | `'EUR'` | `'EUR'` | Νόμισμα |

---

## 1.4 Subcollection: `payments` (PaymentRecord)

**Path**: `units/{unitId}/payments/{paymentId}`

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | Yes | Document ID |
| 2 | `paymentPlanId` | string | Yes | FK → payment plan |
| 3 | `installmentIndex` | number | Yes | Index δόσης |
| 4 | `amount` | number | Yes | Ποσό (gross) |
| 5 | `method` | PaymentMethod | Yes | `bank_transfer` / `bank_cheque` / `personal_cheque` / `bank_loan` / `cash` / `promissory_note` / `offset` |
| 6 | `paymentDate` | string (ISO) | Yes | Ημ/νία πληρωμής |
| 7 | `methodDetails` | PaymentMethodDetails | Yes | Discriminated union (βλ. 1.4.1) |
| 8 | `splitAllocations` | SplitAllocation[] | Yes | Κατανομή σε δόσεις |
| 9 | `overpaymentAmount` | number | Yes | Ποσό υπερπληρωμής |
| 10 | `invoiceId` | string? | No | FK → accounting invoice (ADR-198) |
| 11 | `transactionChainId` | string? | No | FK → transaction chain (ADR-198) |
| 12 | `notes` | string? | No | Σημειώσεις |
| 13 | `createdAt` | string (ISO) | Yes | Δημιουργία |
| 14 | `createdBy` | string | Yes | User ID |
| 15 | `updatedAt` | string (ISO) | Yes | Ενημέρωση |

### 1.4.1 PaymentMethodDetails (Discriminated Union)

| Method | Πεδία |
|--------|-------|
| `bank_transfer` | bankName, iban, referenceNumber |
| `bank_cheque` / `personal_cheque` | chequeNumber, bankName, issueDate, maturityDate, drawerName |
| `bank_loan` | bankName, loanReferenceNumber, disbursementDate |
| `cash` | receiptNumber |
| `promissory_note` | noteNumber, issueDate, maturityDate, drawerName |
| `offset` | offsetReason, relatedDocumentId |

### 1.4.2 SplitAllocation

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `installmentIndex` | number | Index δόσης |
| `amount` | number | Ποσό κατανομής |

---

## 1.5 Enums Σύνοψη

| Enum | Τιμές | Πλήθος |
|------|-------|--------|
| PaymentPlanStatus | negotiation, draft, active, completed, cancelled | 5 |
| InstallmentStatus | pending, due, paid, partial, waived | 5 |
| InstallmentType | reservation, down_payment, stage_payment, final_payment, custom | 5 |
| PaymentMethod | bank_transfer, bank_cheque, personal_cheque, bank_loan, cash, promissory_note, offset | 7 |
| SaleTaxRegime | vat_24, vat_suspension_3, transfer_tax_3, custom | 4 |
| LoanStatus (legacy) | not_applicable, pending, applied, pre_approved, approved, disbursed, rejected | 7 |
| LoanTrackingStatus | 15 states (βλ. FSM) | 15 |
| DisbursementType | lump_sum, phased | 2 |
| CollateralType | mortgage, pre_notation, personal_guarantee, other | 4 |
| InterestRateType | fixed, variable, mixed | 3 |
| DisbursementStatus | pending, requested, approved, disbursed | 4 |
| LateFeeType | none, fixed_percentage, daily_percentage | 3 |

---

## 1.6 FSM — Finite State Machines

### PaymentPlan FSM (5-state)

```
  negotiation ──→ draft ──→ active ──→ completed
       │             │          │
       └─────────────┴──────────┴──→ cancelled
```

| From | To |
|------|----|
| negotiation | draft, cancelled |
| draft | active, cancelled |
| active | completed, cancelled |
| completed | (terminal) |
| cancelled | (terminal) |

### LoanTracking FSM (15-state)

```
  not_applicable → exploring → applied → pre_approved → appraisal_pending →
  appraisal_completed → legal_review → approved → collateral_pending →
  collateral_registered → disbursement_pending → partially_disbursed →
  fully_disbursed

  Exit from ANY state → rejected | cancelled
```

---

# ΟΝΤΟΤΗΤΑ 2: Cheques (Αξιόγραφα)

## 2.1 Ταυτότητα Οντότητας

| Στοιχείο | Τιμή |
|----------|------|
| **Collection** | `cheques` (top-level) |
| **TypeScript** | `ChequeRecord` (`src/types/cheque-registry.ts`) |
| **ID Pattern** | Enterprise ID (`enterprise-id.service.ts`) |
| **Tenant Isolation** | Via `context.projectId` → project → `companyId` |
| **FSM** | 10-state: received → in_custody → deposited → clearing → cleared (+ bounced/endorsed/cancelled/expired/replaced) |
| **ADR** | ADR-234 Phase 3 (SPEC-234A) |
| **Νομοθεσία** | Ν. 5960/1933 (Ελληνικό δίκαιο επιταγών) |

---

## 2.2 Πλήρης Κατάλογος Πεδίων

### 2.2.1 Βασικά Στοιχεία

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `chequeId` | string | Yes | Document ID |
| 2 | `chequeType` | ChequeType | Yes | `bank_cheque` / `personal_cheque` |
| 3 | `chequeNumber` | string | Yes | Αριθμός επιταγής |
| 4 | `amount` | number | Yes | Ποσό (€) |
| 5 | `currency` | `'EUR'` | Yes | Νόμισμα |

### 2.2.2 Τράπεζα / Εκδότης

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 6 | `bankName` | string | Yes | Τράπεζα |
| 7 | `bankBranch` | string? | No | Υποκατάστημα |
| 8 | `drawerName` | string | Yes | Εκδότης |
| 9 | `drawerTaxId` | string? | No | ΑΦΜ εκδότη |
| 10 | `accountNumber` | string? | No | Αριθμός λογαριασμού |

### 2.2.3 Ημερομηνίες

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 11 | `issueDate` | string (ISO) | Yes | Ημ/νία έκδοσης |
| 12 | `maturityDate` | string (ISO) | Yes | Ημ/νία λήξης |
| 13 | `postDated` | boolean | Yes | Μεταχρονολογημένη (computed: maturity > issue) |

### 2.2.4 Ασφάλεια

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 14 | `crossedCheque` | boolean | Yes | Δίγραμμη επιταγή |

### 2.2.5 Κατάσταση

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 15 | `status` | ChequeStatus | Yes | 10-state FSM |

### 2.2.6 Bounced Workflow

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 16 | `bouncedDate` | string? | No | Ημ/νία σφράγισης |
| 17 | `bouncedReason` | BouncedReason? | No | `insufficient_funds` / `account_closed` / `signature_mismatch` / `stop_payment` / `post_dated_early` / `technical_issue` / `other` |
| 18 | `bouncedNotes` | string? | No | Σημειώσεις σφράγισης |
| 19 | `teiresiasFiled` | boolean | Yes | Καταχωρήθηκε στον ΤΕΙΡΕΣΙΑ |
| 20 | `teiresiasFiledDate` | string? | No | Ημ/νία καταχώρησης ΤΕΙΡΕΣΙΑ |
| 21 | `policeCaseFiled` | boolean | Yes | Μηνυτήρια αναφορά |
| 22 | `policeCaseFiledDate` | string? | No | Ημ/νία αναφοράς |
| 23 | `policeCaseReference` | string? | No | Αρ. φακέλου αστυνομίας |

### 2.2.7 Deposit / Clearing

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 24 | `depositDate` | string? | No | Ημ/νία κατάθεσης |
| 25 | `depositBankName` | string? | No | Τράπεζα κατάθεσης |
| 26 | `depositAccountNumber` | string? | No | Λογαριασμός κατάθεσης |
| 27 | `clearingDate` | string? | No | Ημ/νία εκκαθάρισης |

### 2.2.8 Replacement Chain

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 28 | `replacedByChequeId` | string? | No | FK → cheque (αντικαταστάθηκε ΑΠΟ) |
| 29 | `replacesChequeId` | string? | No | FK → cheque (ΑΝΤΙΚΑΘΙΣΤΑ) |

### 2.2.9 Payment Link

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 30 | `paymentId` | string? | No | FK → PaymentRecord |

### 2.2.10 Σημειώσεις & Audit

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 31 | `notes` | string? | No | Ελεύθερες σημειώσεις |
| 32 | `createdAt` | string (ISO) | Yes | Δημιουργία |
| 33 | `createdBy` | string | Yes | User ID |
| 34 | `updatedAt` | string (ISO) | Yes | Ενημέρωση |
| 35 | `updatedBy` | string | Yes | User ID |

---

## 2.3 Nested Objects & Arrays

### 2.3.1 `context` (ChequeContext)

| Πεδίο | Τύπος | Required | Περιγραφή |
|-------|-------|----------|-----------|
| `type` | ChequeContextType | Yes | `unit_sale` / `supplier` / `contractor` / `other` |
| `entityId` | string? | No | Entity ID (context-dependent) |
| `projectId` | string | Yes | FK → project |
| `unitId` | string? | No | FK → unit |
| `paymentPlanId` | string? | No | FK → payment plan |
| `contactId` | string? | No | FK → contact (εκδότης/αποδέκτης) |
| `direction` | ChequeDirection | Yes | `incoming` / `outgoing` |

### 2.3.2 `endorsementChain[]` (EndorsementEntry)

| Πεδίο | Τύπος | Required | Περιγραφή |
|-------|-------|----------|-----------|
| `order` | number | Yes | Σειρά οπισθογράφησης |
| `endorserName` | string | Yes | Οπισθογράφος |
| `endorseeName` | string | Yes | Αποδέκτης οπισθογράφησης |
| `endorsementDate` | string (ISO) | Yes | Ημ/νία |
| `notes` | string? | No | Σημειώσεις |

---

## 2.4 Enums Σύνοψη

| Enum | Τιμές | Πλήθος |
|------|-------|--------|
| ChequeType | bank_cheque, personal_cheque | 2 |
| ChequeStatus | received, in_custody, deposited, clearing, cleared, bounced, endorsed, cancelled, expired, replaced | 10 |
| BouncedReason | insufficient_funds, account_closed, signature_mismatch, stop_payment, post_dated_early, technical_issue, other | 7 |
| ChequeContextType | unit_sale, supplier, contractor, other | 4 |
| ChequeDirection | incoming, outgoing | 2 |

---

## 2.5 FSM — Cheque Lifecycle (10-state)

```
  received ──→ in_custody ──→ deposited ──→ clearing ──→ cleared (terminal)
     │              │              │
     │              ├──→ endorsed (terminal)
     │              ├──→ cancelled (terminal)
     │              └──→ expired ──→ replaced (terminal)
     │
     ├──→ deposited
     ├──→ endorsed (terminal)
     └──→ cancelled (terminal)

  clearing ──→ bounced ──→ replaced (terminal)
                   └──→ cancelled (terminal)
```

| From | To |
|------|----|
| received | in_custody, deposited, endorsed, cancelled |
| in_custody | deposited, endorsed, cancelled, expired |
| deposited | clearing, cancelled |
| clearing | cleared, bounced |
| cleared | (terminal) |
| bounced | replaced, cancelled |
| endorsed | (terminal) |
| cancelled | (terminal) |
| expired | replaced |
| replaced | (terminal) |

---

# ΟΝΤΟΤΗΤΑ 3: Legal Contracts (Νομικά Συμβόλαια)

## 3.1 Ταυτότητα Οντότητας

| Στοιχείο | Τιμή |
|----------|------|
| **Collection** | `legal_contracts` (top-level) |
| **TypeScript** | `LegalContract` (`src/types/legal-contracts.ts`) |
| **ID Pattern** | Enterprise ID (`enterprise-id.service.ts`) |
| **Tenant Isolation** | Via `projectId` → project → `companyId` |
| **FSM** | Per-phase: `draft → pending_signature → signed → completed` |
| **ADR** | ADR-230 (Contract Workflow & Legal Process) |
| **Νομοθεσία** | Ελληνικό Αστικό Δίκαιο (ΑΚ 402-403 αρραβώνας) |

---

## 3.2 Πλήρης Κατάλογος Πεδίων

### 3.2.1 Αναφορές

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 1 | `id` | string | Yes | Document ID |
| 2 | `unitId` | string | Yes | FK → unit |
| 3 | `projectId` | string | Yes | FK → project |
| 4 | `buildingId` | string | Yes | FK → building |
| 5 | `buyerContactId` | string | Yes | FK → contacts (αγοραστής) |

### 3.2.2 Phase & Status (FSM)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 6 | `phase` | ContractPhase | Yes | `preliminary` / `final` / `payoff` |
| 7 | `status` | ContractStatus | Yes | `draft` / `pending_signature` / `signed` / `completed` |

### 3.2.3 Οικονομικά

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 8 | `contractAmount` | number? | No | Ποσό συμβολαίου (αντικειμενική ή εμπορική αξία) |
| 9 | `depositAmount` | number? | No | Ποσό αρραβώνα (μόνο στο preliminary) |
| 10 | `depositTerms` | DepositTermsOnCancellation? | No | `forfeit` / `double_return` / `refund` (ΑΚ 402-403) |

### 3.2.4 Νομικοί Επαγγελματίες (Snapshots)

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 11 | `sellerLawyer` | ProfessionalSnapshot? | No | Δικηγόρος πωλητή (immutable) |
| 12 | `buyerLawyer` | ProfessionalSnapshot? | No | Δικηγόρος αγοραστή (immutable) |
| 13 | `notary` | ProfessionalSnapshot? | No | Συμβολαιογράφος (immutable) |

### 3.2.5 Αρχεία & Σημειώσεις

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 14 | `fileIds` | string[] | Yes | FK → FileRecord IDs (ADR-191) |
| 15 | `notes` | string? | No | Σημειώσεις |

### 3.2.6 Audit

| # | Πεδίο | Τύπος | Required | Περιγραφή |
|---|-------|-------|----------|-----------|
| 16 | `createdBy` | string | Yes | User ID δημιουργού |
| 17 | `createdAt` | string (ISO) | Yes | Δημιουργία |
| 18 | `updatedAt` | string (ISO) | Yes | Ενημέρωση |
| 19 | `signedAt` | string? | No | Ημ/νία υπογραφής |
| 20 | `completedAt` | string? | No | Ημ/νία ολοκλήρωσης |

---

## 3.3 Nested Objects

### 3.3.1 ProfessionalSnapshot (Immutable)

SAP Business Partner pattern: snapshot δεδομένων κατά την υπογραφή. Αν ο δικηγόρος αλλάξει στοιχεία αργότερα, το contract κρατάει τα αρχικά.

| Πεδίο | Τύπος | Required | Περιγραφή |
|-------|-------|----------|-----------|
| `contactId` | string | Yes | FK → contacts |
| `displayName` | string | Yes | Ονοματεπώνυμο |
| `role` | LegalProfessionalRole | Yes | `seller_lawyer` / `buyer_lawyer` / `notary` |
| `phone` | string? | No | Τηλέφωνο |
| `email` | string? | No | Email |
| `taxId` | string? | No | ΑΦΜ |
| `roleSpecificData` | LawyerSnapshotData / NotarySnapshotData | Yes | Βλ. 3.3.2 |
| `snapshotAt` | string (ISO) | Yes | Timestamp snapshot |

### 3.3.2 roleSpecificData (Discriminated Union)

| Variant | Πεδία |
|---------|-------|
| **LawyerSnapshotData** (`type: 'lawyer'`) | `barAssociationNumber`, `barAssociation` |
| **NotarySnapshotData** (`type: 'notary'`) | `notaryRegistryNumber`, `notaryDistrict` |

---

## 3.4 Enums Σύνοψη

| Enum | Τιμές | Πλήθος |
|------|-------|--------|
| ContractPhase | preliminary, final, payoff | 3 |
| ContractStatus | draft, pending_signature, signed, completed | 4 |
| LegalPhase (denormalized) | none, preliminary_pending, preliminary_signed, final_pending, final_signed, payoff_pending, payoff_completed | 7 |
| DepositTermsOnCancellation | forfeit, double_return, refund | 3 |
| LegalProfessionalRole | seller_lawyer, buyer_lawyer, notary | 3 |

---

## 3.5 FSM — Contract Lifecycle

### Per-Phase Status Transitions (forward-only)

```
  draft ──→ pending_signature ──→ signed ──→ completed
```

### Phase Prerequisites

| Phase | Prerequisite |
|-------|-------------|
| preliminary | Κανένα — δημιουργείται ελεύθερα |
| final | Αν υπάρχει preliminary → πρέπει να είναι `signed`. Αν ΔΕΝ υπάρχει preliminary → OK |
| payoff | Final πρέπει να είναι `signed` |

### LegalPhase Computation (denormalized στο unit.commercial)

| Phase + Status | → LegalPhase |
|----------------|-------------|
| preliminary + draft/pending_signature | `preliminary_pending` |
| preliminary + signed/completed | `preliminary_signed` |
| final + draft/pending_signature | `final_pending` |
| final + signed/completed | `final_signed` |
| payoff + draft/pending_signature | `payoff_pending` |
| payoff + signed/completed | `payoff_completed` |

---

# 4. Σχέσεις μεταξύ των 3 Οντοτήτων + Εξωτερικές

## 4.1 Διάγραμμα Σχέσεων

```
                        ┌───────────┐
                        │ PROJECTS  │
                        └─────┬─────┘
                              │
                    ┌─────────┼─────────┐
                    │         │         │
              ┌─────┴─────┐   │   ┌─────┴─────┐
              │ BUILDINGS │   │   │ CONTACTS  │
              └─────┬─────┘   │   └─────┬─────┘
                    │         │         │
              ┌─────┴─────┐   │         │
              │   UNITS   │   │         │
              └─────┬─────┘   │         │
                    │         │         │
         ┌──────────┼─────────┤         │
         │          │         │         │
   ┌─────┴──────┐ ┌─┴──────┐ ┌┴────────┴───────┐
   │  PAYMENT   │ │CHEQUES │ │ LEGAL CONTRACTS  │
   │   PLANS    │ │        │ │                  │
   │ (subcol)   │ │(top-lv)│ │   (top-level)    │
   └─────┬──────┘ └────┬───┘ └──────────────────┘
         │              │              │
         │    ┌─────────┤              │
         │    │         │              │
   ┌─────┴────┴┐  ┌────┴────┐  ┌──────┴───────┐
   │ PAYMENTS  │  │ENDORSE- │  │ PROFESSIONAL │
   │ (subcol)  │  │MENT     │  │ SNAPSHOTS    │
   └───────────┘  │CHAIN    │  │ (immutable)  │
                  └─────────┘  └──────────────┘
```

## 4.2 Αναλυτικός Πίνακας Σχέσεων

| # | Από | Προς | Πεδίο(α) σύνδεσης | Σχέση | Περιγραφή |
|---|-----|------|--------------------|-------|-----------|
| 1 | **payment_plans** | units | `unitId` (subcollection parent) | N:1 | Πλάνο ανήκει σε μονάδα |
| 2 | **payment_plans** | buildings | `buildingId` | N:1 | Κτίριο μονάδας |
| 3 | **payment_plans** | projects | `projectId` | N:1 | Έργο μονάδας |
| 4 | **payment_plans** | contacts | `buyerContactId` | N:1 | Αγοραστής |
| 5 | **payment_plans** | contacts | `ownerContactId` (ADR-244) | N:1 | Ιδιοκτήτης (individual plan) |
| 6 | **payment_plans** | cheques | via unit/buyer context | 1:N | Επιταγές σχετικές |
| 7 | **payment_plans** | legal_contracts | same unitId + buyerContactId | 1:N | Συμβόλαια ίδιας πώλησης |
| 8 | **payment_plans** | payments | subcollection reference | 1:N | Καταγραφές πληρωμών |
| 9 | **cheques** | projects | `context.projectId` | N:1 | Έργο |
| 10 | **cheques** | units | `context.unitId` | N:1 | Μονάδα (optional) |
| 11 | **cheques** | contacts | `context.contactId` | N:1 | Εκδότης/Αποδέκτης |
| 12 | **cheques** | payment_plans | `context.paymentPlanId` | N:1 | Πλάνο πληρωμής (optional) |
| 13 | **cheques** | cheques | `replacedByChequeId` / `replacesChequeId` | 1:1 | Αντικατάσταση chain |
| 14 | **cheques** | payments | `paymentId` | 1:1 | Σύνδεση με PaymentRecord |
| 15 | **cheques** | buildings | via `context.projectId` → project → buildings | N:1 | Indirect (κτίριο μέσω έργου) |
| 16 | **legal_contracts** | units | `unitId` | N:1 | Μονάδα |
| 17 | **legal_contracts** | projects | `projectId` | N:1 | Έργο |
| 18 | **legal_contracts** | buildings | `buildingId` | N:1 | Κτίριο |
| 19 | **legal_contracts** | contacts | `buyerContactId` | N:1 | Αγοραστής |
| 20 | **legal_contracts** | contacts | `sellerLawyer.contactId` | N:1 | Δικηγόρος πωλητή |
| 21 | **legal_contracts** | contacts | `buyerLawyer.contactId` | N:1 | Δικηγόρος αγοραστή |
| 22 | **legal_contracts** | contacts | `notary.contactId` | N:1 | Συμβολαιογράφος |
| 23 | **legal_contracts** | payment_plans | same unitId + buyerContactId | 1:N | Πλάνα ίδιας πώλησης |
| 24 | **legal_contracts** | cheques | same unit/buyer context | 1:N | Αξιόγραφα ίδιας πώλησης |
| 25 | **legal_contracts** | file_records | `fileIds[]` | N:M | Επισυναπτόμενα αρχεία (ADR-191) |
| 26 | **payments** | accounting_invoices | `invoiceId` | N:1 | Λογιστικό παραστατικό |
| 27 | **payments** | transaction_chains | `transactionChainId` | N:1 | Αλυσίδα συναλλαγών (ADR-198) |

---

# 5. Report Builder Impact

## 5.1 Domain C1 (Payment Plans) — Tier 1 (Flat Table)

### Primary Columns

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Μονάδα | _ref: unit.code | text |
| Κτίριο | _ref: building.name | text |
| Έργο | _ref: project.name | text |
| Αγοραστής | buyerName | text |
| Ιδιοκτήτης | ownerName | text |
| Τύπος Πλάνου | planType | enum |
| % Ιδιοκτησίας | ownershipPct | percentage |
| Status | status | enum |
| Σύνολο | totalAmount | currency |
| Πληρωμένα | paidAmount | currency |
| Υπόλοιπο | remainingAmount | currency |
| Φορολ. Καθεστώς | taxRegime | enum |
| Φόρος % | taxRate | percentage |
| Δόσεις (πλήθος) | installments.length | number |
| Δημιουργία | createdAt | date |
| Ενημέρωση | updatedAt | date |

### Computed/Joined Columns

| Στήλη | Υπολογισμός | Τύπος |
|-------|-------------|-------|
| % Πληρωμής | paidAmount / totalAmount × 100 | percentage |
| Καθυστερημένες Δόσεις | COUNT installments WHERE status='due' | number |
| Ποσό Καθυστέρησης | SUM installments[status='due'].amount | currency |
| Επόμενη Δόση | installments[status='pending'][0].amount | currency |
| Ημ/νία Επόμενης | installments[status='pending'][0].dueDate | date |
| Δάνειο (κύριο) Status | loans[isPrimary].status | enum |
| Τράπεζα (κύρια) | loans[isPrimary].bankName | text |
| Εγκεκριμένο Δάνειο | loans[isPrimary].approvedAmount | currency |
| Εκταμιευμένο | SUM loans[].disbursedAmount | currency |
| Αρ. Αξιογράφων | COUNT cheques WHERE context.paymentPlanId | number |
| Αρ. Συμβολαίων | COUNT legal_contracts WHERE unitId+buyerContactId | number |

## 5.2 Domain C2 (Cheques) — Tier 1 (Flat Table)

### Primary Columns

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Αριθμός | chequeNumber | text |
| Τύπος | chequeType | enum |
| Ποσό | amount | currency |
| Τράπεζα | bankName | text |
| Εκδότης | drawerName | text |
| ΑΦΜ Εκδότη | drawerTaxId | text |
| Ημ/νία Έκδοσης | issueDate | date |
| Λήξη | maturityDate | date |
| Μεταχρονολογημένη | postDated | boolean |
| Δίγραμμη | crossedCheque | boolean |
| Status | status | enum |
| Κατεύθυνση | context.direction | enum |
| Context Τύπος | context.type | enum |
| Κατάθεση | depositDate | date |
| Τράπεζα Κατάθεσης | depositBankName | text |
| Εκκαθάριση | clearingDate | date |
| Σφράγιση | bouncedDate | date |
| Λόγος Σφράγισης | bouncedReason | enum |
| ΤΕΙΡΕΣΙΑΣ | teiresiasFiled | boolean |
| Αστυνομία | policeCaseFiled | boolean |
| Δημιουργία | createdAt | date |

### Computed/Joined Columns

| Στήλη | Join | Τύπος |
|-------|------|-------|
| Έργο | _ref: context.projectId → project.name | text |
| Μονάδα | _ref: context.unitId → unit.code | text |
| Κτίριο | _ref: context.unitId → unit.buildingId → building.name | text |
| Επαφή | _ref: context.contactId → contact.displayName | text |
| Αρ. Οπισθογραφήσεων | endorsementChain.length | number |
| Ημέρες μέχρι λήξη | maturityDate - today | number |
| Αντικαταστάθηκε από | _ref: replacedByChequeId → cheque.chequeNumber | text |

## 5.3 Domain C3 (Legal Contracts) — Tier 1 (Flat Table)

### Primary Columns

| Στήλη | Πεδίο | Τύπος |
|-------|-------|-------|
| Φάση | phase | enum |
| Status | status | enum |
| Ποσό Συμβολαίου | contractAmount | currency |
| Αρραβώνας | depositAmount | currency |
| Όροι Αρραβώνα | depositTerms | enum |
| Δικηγόρος Πωλητή | sellerLawyer.displayName | text |
| Δικηγόρος Αγοραστή | buyerLawyer.displayName | text |
| Συμβολαιογράφος | notary.displayName | text |
| Ημ/νία Υπογραφής | signedAt | date |
| Ημ/νία Ολοκλήρωσης | completedAt | date |
| Δημιουργία | createdAt | date |

### Computed/Joined Columns

| Στήλη | Join | Τύπος |
|-------|------|-------|
| Μονάδα | _ref: unitId → unit.code | text |
| Κτίριο | _ref: buildingId → building.name | text |
| Έργο | _ref: projectId → project.name | text |
| Αγοραστής | _ref: buyerContactId → contact.displayName | text |
| ΑΦΜ Αγοραστή | _ref: buyerContactId → contact.vatNumber | text |
| Νομική Φάση (unit) | computeLegalPhase(phase, status) | enum |
| Αρ. Αρχείων | fileIds.length | number |
| Αρ. Πληρωμών | COUNT payments WHERE unitId+buyerContactId | number |
| Σύνολο Πληρωμών | SUM payments.amount | currency |

## 5.4 Tier 2 (Row Repetition) — Arrays που χρειάζονται expansion

### Payment Plans

| Array | Πεδία ανά row | Μέγιστο πλήθος |
|-------|---------------|----------------|
| `installments[]` | index, label, type, amount, percentage, dueDate, status, paidAmount, paidDate | ~20 |
| `loans[]` | loanId, bankName, status, approvedAmount, disbursedAmount, interestRate, termYears | ~3 |
| `loans[].disbursements[]` | order, amount, milestone, status, disbursementDate | ~10 |
| `loans[].communicationLog[]` | date, type, summary, contactPerson, nextAction | ~50 |

### Cheques

| Array | Πεδία ανά row | Μέγιστο πλήθος |
|-------|---------------|----------------|
| `endorsementChain[]` | order, endorserName, endorseeName, endorsementDate, notes | ~5 |

### Legal Contracts

| Array | Πεδία ανά row | Μέγιστο πλήθος |
|-------|---------------|----------------|
| `fileIds[]` | fileId (expand to filename, size, type) | ~20 |

## 5.5 Tier 3 (Card PDF Layouts)

### Payment Plan Card

```
┌─────────────────────────────────────────┐
│ ΠΛΑΝΟ ΠΛΗΡΩΜΩΝ — [unit.code]            │
│ Αγοραστής: [buyerName]                  │
│ Status: [status] | Τύπος: [planType]    │
├─────────────────────────────────────────┤
│ ΠΟΣΑ                                     │
│ Σύνολο: €XXX | Πληρωμένα: €XXX          │
│ Υπόλοιπο: €XXX | Πληρωμή: XX%          │
│ Φόρος: [taxRegime] @ XX%               │
├─────────────────────────────────────────┤
│ ΔΟΣΕΙΣ                                   │
│ [πίνακας: #, Ετικέτα, Τύπος, Ποσό,     │
│  Ημ/νία, Status, Πληρωμένα]            │
├─────────────────────────────────────────┤
│ ΔΑΝΕΙΑ                                   │
│ [πίνακας: Τράπεζα, Status, Ποσό,       │
│  Εκταμίευση, Επιτόκιο, LTV]            │
│ [Εκταμιεύσεις: order, ποσό, milestone]  │
├─────────────────────────────────────────┤
│ CONFIG                                   │
│ Grace: [days] | Late Fee: [type] @ [%]  │
│ Sequential: [bool] | Partial: [bool]    │
├─────────────────────────────────────────┤
│ ΣΗΜΕΙΩΣΕΙΣ                               │
│ [notes]                                 │
└─────────────────────────────────────────┘
```

### Cheque Card

```
┌─────────────────────────────────────────┐
│ ΕΠΙΤΑΓΗ — [chequeNumber]                │
│ [chequeType] | [status]                 │
├─────────────────────────────────────────┤
│ ΣΤΟΙΧΕΙΑ                                 │
│ Ποσό: €XXX | Τράπεζα: [bankName]       │
│ Εκδότης: [drawerName] ΑΦΜ: [drawerTax] │
│ Έκδοση: [issueDate] | Λήξη: [maturity] │
│ Μεταχρ.: [✓/✗] | Δίγραμμη: [✓/✗]     │
├─────────────────────────────────────────┤
│ CONTEXT                                  │
│ Έργο: [project] | Μονάδα: [unit]        │
│ Κατεύθυνση: [incoming/outgoing]         │
│ Επαφή: [contactName]                   │
├─────────────────────────────────────────┤
│ ΚΥΚΛΟΣ ΖΩΗΣ                              │
│ Κατάθεση: [date] → [bankName]           │
│ Εκκαθάριση: [date]                      │
├─────────────────────────────────────────┤
│ ΣΦΡΑΓΙΣΗ (αν bounced)                    │
│ Λόγος: [bouncedReason]                  │
│ ΤΕΙΡΕΣΙΑΣ: [✓/✗] [date]               │
│ Αστυνομία: [✓/✗] [reference]           │
├─────────────────────────────────────────┤
│ ΟΠΙΣΘΟΓΡΑΦΗΣΕΙΣ                          │
│ [πίνακας: #, Από, Προς, Ημ/νία]        │
├─────────────────────────────────────────┤
│ ΑΝΤΙΚΑΤΑΣΤΑΣΗ                            │
│ Αντικαθιστά: [replacesChequeId]         │
│ Αντικαταστάθηκε από: [replacedBy...]    │
└─────────────────────────────────────────┘
```

### Legal Contract Card

```
┌─────────────────────────────────────────┐
│ ΣΥΜΒΟΛΑΙΟ — [phase] [status]            │
│ Μονάδα: [unit.code] | Κτίριο: [bldg]   │
├─────────────────────────────────────────┤
│ ΜΕΡΗ                                     │
│ Αγοραστής: [buyerContact.displayName]   │
│ ΑΦΜ: [buyerContact.vatNumber]           │
├─────────────────────────────────────────┤
│ ΟΙΚΟΝΟΜΙΚΑ                               │
│ Ποσό: €XXX                              │
│ Αρραβώνας: €XXX ([depositTerms])        │
├─────────────────────────────────────────┤
│ ΝΟΜΙΚΟΙ ΕΠΑΓΓΕΛΜΑΤΙΕΣ                    │
│ Δικ. Πωλητή: [name] [bar#] [barAssoc]  │
│ Δικ. Αγοραστή: [name] [bar#] [barAss]  │
│ Συμβ/φος: [name] [reg#] [district]     │
├─────────────────────────────────────────┤
│ ΗΜΕΡΟΜΗΝΙΕΣ                              │
│ Δημιουργία: [createdAt]                 │
│ Υπογραφή: [signedAt]                   │
│ Ολοκλήρωση: [completedAt]              │
├─────────────────────────────────────────┤
│ ΑΡΧΕΙΑ                                   │
│ [πίνακας: Αρχείο, Τύπος, Μέγεθος]      │
├─────────────────────────────────────────┤
│ ΣΗΜΕΙΩΣΕΙΣ                               │
│ [notes]                                 │
└─────────────────────────────────────────┘
```

---

# 6. Denormalized Data (PaymentSummary)

Το `PaymentSummary` object είναι denormalized στο `unit.commercial.paymentSummary` και συνοψίζει τα δεδομένα payment plan σε επίπεδο μονάδας.

| Πεδίο | Τύπος | Περιγραφή |
|-------|-------|-----------|
| `planStatus` | PaymentPlanStatus | Status πλάνου |
| `totalAmount` | number | Σύνολο |
| `paidAmount` | number | Πληρωμένα |
| `remainingAmount` | number | Υπόλοιπο |
| `paidPercentage` | number | % πληρωμής |
| `totalInstallments` | number | Σύνολο δόσεων |
| `paidInstallments` | number | Πληρωμένες δόσεις |
| `overdueInstallments` | number | Ληξιπρόθεσμες δόσεις |
| `nextInstallmentAmount` | number? | Ποσό επόμενης δόσης |
| `nextInstallmentDate` | string? | Ημ/νία επόμενης |
| `loanStatus` | LoanStatus | Legacy status δανείου |
| `primaryLoanStatus` | LoanTrackingStatus? | Phase 2 status |
| `primaryLoanBank` | string? | Τράπεζα κύριου δανείου |
| `totalApprovedLoanAmount` | number? | Σύνολο εγκεκριμένων |
| `totalDisbursedAmount` | number? | Σύνολο εκταμιεύσεων |
| `paymentPlanId` | string | FK → payment plan |

---

# 7. Στατιστικά

| Μέτρηση | Payment Plans | Cheques | Legal Contracts | Σύνολο |
|---------|--------------|---------|-----------------|--------|
| Πεδία (direct) | 23 | 35 | 20 | **78** |
| Nested object fields | config: 9 | context: 7 | snapshot: 8 ×3 = 24 | **40** |
| Nested array fields | installment: 11, loan(legacy): 10, loan(v2): 35, disbursement: 8, commLog: 6 | endorsement: 5 | — | **75** |
| Payment subcol fields | 15 + methodDetails: ~4 avg | — | — | **19** |
| Enums | 12 (64 τιμές σύνολο) | 5 (25 τιμές) | 5 (20 τιμές) | **22 enums** |
| FSM states | 5 (plan) + 15 (loan) | 10 | 4 (per phase) × 3 phases | **~42** |
| Cross-entity references | 8 | 7 (direct) + 1 (indirect) | 9 | **25** |
| **Σύνολο πεδίων** | **~100+** | **~47** | **~65** | **~212+** |
