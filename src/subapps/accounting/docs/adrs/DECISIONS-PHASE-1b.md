# Accounting Phase 1b — Αποφάσεις Σχεδιασμού

**Ημερομηνία**: 2026-03-29
**Status**: ✅ IMPLEMENTED (2026-03-29)
**Scope**: Customer Balances + Fiscal Period Management
**Μέθοδος**: Ερωτήσεις → Αποφάσεις Γιώργου → Τεκμηρίωση

---

## Changelog

### 2026-03-29 — Phase 1b Implementation Complete

**New Files (8)**:
- `types/customer-balance.ts` — CustomerBalance, AgingBuckets, CreditCheckResult types
- `types/fiscal-period.ts` — FiscalPeriod, FiscalPeriodStatus, YearEndChecklist types
- `services/balance-service.ts` — Hybrid balance management (aging, reconciliation, credit check)
- `services/fiscal-period-service.ts` — Period state machine (OPEN→CLOSED→LOCKED, year-end checklist)
- `services/repository/accounting-repo-balances.ts` — CRUD for balances + fiscal periods
- `app/api/accounting/balances/route.ts` — GET list, POST reconcile
- `app/api/accounting/balances/[customerId]/route.ts` — GET single balance
- `app/api/accounting/fiscal-periods/route.ts` — GET list, POST create year
- `app/api/accounting/fiscal-periods/[periodId]/route.ts` — PATCH close/lock/reopen

**Modified Files (10)**:
- `types/invoice.ts` — +3 dispute fields (isDisputed, disputeReason, disputeDate)
- `types/journal.ts` — +3 cross-period fields (crossPeriodReversal, originalPeriod, reversalPeriod)
- `types/interfaces.ts` — +7 new IAccountingRepository methods
- `types/index.ts` — barrel exports for new types
- `services/repository/firestore-accounting-repository.ts` — delegation for new methods
- `services/reversal-service.ts` — period validation + cross-period logic
- `services/index.ts` — barrel exports for new services
- `config/firestore-collections.ts` — +2 collections (ACCOUNTING_CUSTOMER_BALANCES, ACCOUNTING_FISCAL_PERIODS)
- `services/enterprise-id.service.ts` — +2 prefixes (cbal, fp), +2 generators

---

## Πηγές Έρευνας

Η σχεδιαστική διαδικασία βασίστηκε σε enterprise research:
- **SAP S/4HANA**: ACDOCA Universal Journal, OB52 Period Control, KNKK Credit Management, FBL5N Customer Line Items
- **SAP Business One**: OCRD.Balance (maintained field), OINV.PaidToDate, JDT1 clearing
- **Oracle NetSuite**: 6-state period model, AR/AP separate close, period close checklist
- **SAGE 300**: Module-level calendars, Period 13/14 adjustment, cross-module closing sequence
- **Xero**: Lock date mechanism (period + year), advisor override
- **Ελληνικά ERP**: Softone, Entersoft (3 states + soft close), Epsilon Net (auto-lock μετά myDATA)

---

## Ερωτήσεις & Αποφάσεις

### Q1: Customer Balances — Αρχιτεκτονικό Μοντέλο

**Ερώτηση**: Πώς θα αποθηκεύουμε και υπολογίζουμε τα υπόλοιπα πελατών;

**Τι κάνουν οι μεγάλοι παίκτες:**

| Σύστημα | Μοντέλο | Τεχνικά |
|---------|---------|---------|
| **SAP S/4HANA** | **Pure aggregation** — ΔΕΝ αποθηκεύει balance. Κάνει SUM(HSL) FROM ACDOCA WHERE AUGDT=NULL (open items). Βασίζεται στην HANA in-memory engine για ταχύτητα. Κατήργησε τα παλιά summary tables (KNC1, KNC3) |
| **SAP Business One** | **Stored field (event-driven)** — `OCRD.Balance` ενημερώνεται σύγχρονα σε κάθε posting (invoice/payment/credit note). Instant reads, application-level triggers |
| **Oracle NetSuite** | **Stored field (event-driven)** — `Customer.balance` ενημερώνεται real-time. Αποθηκεύει `balance`, `depositbalance`, `overduebalance`. Υπολογίζει `unbilledorders`, `daysoverdue` on-the-fly |
| **SAGE / Zoho** | **Stored + periodic verification** |

**Οι 3 επιλογές:**

**A) SAP S/4HANA Pattern — Pure Aggregation:**
- Κανένα `customer_balances` collection
- Query: `SUM(balanceDue) FROM accounting_invoices WHERE customerId=X AND paymentStatus != 'paid'`
- Aging: `CASE WHEN daysOverdue BETWEEN 1 AND 30...` on-the-fly
- Pro: Πάντα 100% ακριβές, zero sync complexity
- Con: Πιο αργό σε πολλά invoices (αλλά Firestore handles it fine σε <10K docs)

**B) SAP B1 / NetSuite Pattern — Stored Balance (Event-Driven):**
- Νέα collection `customer_balances` με `totalOwed`, `totalPaid`, `netBalance`, aging buckets
- Κάθε invoice/payment/credit note → Firestore transaction ενημερώνει atomic το balance
- Pro: Instant reads (1 doc read vs query), ready-made aging data
- Con: Πολυπλοκότητα sync, risk αποσυγχρονισμού, πρέπει να καλύψεις ΟΛΕΣ τις περιπτώσεις (create, update, delete, void, credit note, payment, partial payment)

**C) Hybrid — Stored + Reconciliation:**
- Stored balance (pattern B) + periodic reconciliation endpoint που ξανυπολογίζει
- Αν βρει διαφορά → auto-correct + audit log
- Pro: Speed + safety net
- Con: Πιο πολύς κώδικας

**Απόφαση Γιώργου**: ✅ **C — Hybrid** (SAP B1/NetSuite stored balance + reconciliation safety net)

**Λόγος**: Περιλαμβάνει τα πάντα (instant reads + verification). Κόστος Firestore αμελητέο (~50 reads dashboard vs ~250 με pure aggregation). Reconciliation endpoint πιάνει bugs/race conditions.

**Υλοποίηση**:
- Νέα collection `customer_balances` (stored, event-driven updates)
- Κάθε invoice/payment/credit note → Firestore transaction ενημερώνει balance ατομικά
- Reconciliation endpoint (manual trigger ή 1x/μήνα) → ξαναϋπολογίζει από invoices, auto-correct + audit log

---

### Q2: Customer Balances — Aging Buckets

**Ερώτηση**: Ποια aging buckets θέλουμε;

**Τι κάνουν οι μεγάλοι:**

| Σύστημα | Default Buckets | Configurable; |
|---------|----------------|---------------|
| **SAP S/4HANA** | Not Due, 1-30, 31-60, 61-90, 91-120, >120 (6 buckets) | Ναι, πλήρως μέσω sort variant |
| **SAP Business One** | Not Due, 1-30, 31-60, 61-90, >90 (5 buckets) | Όχι (fixed 4 aging periods) |
| **NetSuite** | Current, 1-30, 31-60, 61-90, >90 (5 buckets) | Ναι, custom aging reports |
| **SAGE 300** | Current, 1-30, 31-60, 61-90, >90 (5 buckets) | Ναι |
| **Xero** | Current, 1-30, 31-60, 61-90, >90 (5 buckets) | Όχι |
| **Ελληνική πρακτική** | Συνήθως 30/60/90/90+ | — |

**Οι επιλογές:**

**A) 5 buckets (SAP B1/NetSuite/Xero standard):**
`current` | `days1_30` | `days31_60` | `days61_90` | `days90plus`

**B) 6 buckets (SAP S/4HANA — enterprise):**
`current` | `days1_30` | `days31_60` | `days61_90` | `days91_120` | `days120plus`

**C) Configurable buckets:**
Ο χρήστης ορίζει τα boundaries (π.χ. 15/30/45/60/90+). Πιο πολύπλοκο.

**Πρόταση**: **B (6 buckets)** — SAP S/4HANA standard, καλύτερη ορατότητα στα πολύ καθυστερημένα. Hardcoded (όχι configurable) γιατί η παραμετροποίηση δεν αξίζει την πολυπλοκότητα σε αυτή τη φάση.

**Απόφαση Γιώργου**: ✅ **B — 6 buckets** (SAP S/4HANA enterprise standard)

**Buckets**: `current` | `days1_30` | `days31_60` | `days61_90` | `days91_120` | `days120plus`
**Hardcoded** — δεν χρειάζεται configurable σε αυτή τη φάση.

---

### Q3: Customer Balances — Credit Limit & Credit Hold

**Ερώτηση**: Θέλουμε credit management (πιστωτικό όριο πελάτη);

**Τι κάνουν οι μεγάλοι:**

| Σύστημα | Credit Limit | Credit Hold | Exposure Formula |
|---------|-------------|-------------|-----------------|
| **SAP S/4HANA** | Ναι, πίνακας KNKK — `KLIMK` (limit), `CTLPC` (risk class), `NXTRV` (next review) | Auto block σε Sales Order αν exposure > limit | `Open AR + Open Orders + Open Deliveries + Open Billing` |
| **SAP Business One** | Ναι, `OCRD.CreditLine` + `OCRD.DebtLine` + `OCRD.MaxCommitment` | Block σε delivery/invoice | `Balance + DNotesBal + OrdersBal` |
| **NetSuite** | Ναι, `creditlimit` field + 3 hold rules (Auto/Manual/Off) | Auto hold σε Sales Order approval | `balance + unbilledorders` |
| **Xero** | ❌ Δεν έχει | ❌ | — |
| **QuickBooks** | ❌ Δεν έχει | ❌ | — |
| **SAGE** | Ναι, per-customer credit limit | Warning ή block | `Open AR + Open Orders` |

**Οι επιλογές:**

**A) Πλήρες Credit Management (SAP/NetSuite):**
- Πεδίο `creditLimit` στον πελάτη
- Auto-check σε νέο τιμολόγιο: `if (currentBalance + newInvoice > creditLimit) → warning/block`
- Credit hold status (auto/manual/off)
- Risk classification
- Next review date

**B) Απλό Credit Limit (light):**
- Μόνο `creditLimit` field στον πελάτη
- Warning (όχι block) όταν ξεπερνά — ο χρήστης αποφασίζει
- Χωρίς risk class, χωρίς auto-hold

**C) Χωρίς Credit Management (Xero/QuickBooks):**
- Κανένα credit limit
- Μόνο aging visibility — ο χρήστης βλέπει και αποφασίζει

**Πρόταση αρχική**: B (Απλό). **Αναθεώρηση**: A — η πολυπλοκότητα είναι σχεδόν ίδια (~30 λεπτά παραπάνω) γιατί δεν έχουμε orders/deliveries pipeline (μόνο invoices → exposure = currentBalance).

**Απόφαση Γιώργου**: ✅ **A — Πλήρες Credit Management**

**Πεδία στο `CustomerBalance`**:
- `creditLimit: number | null` — Πιστωτικό όριο (null = απεριόριστο)
- `creditHoldRule: 'auto' | 'manual' | 'off'` — Κανόνας hold
- `creditHoldActive: boolean` — Τρέχουσα κατάσταση hold
- `riskClass: 'low' | 'medium' | 'high' | 'critical'` — Κατηγορία κινδύνου
- `nextReviewDate: string | null` — Ημερομηνία επόμενου ελέγχου
- `availableCredit: number` — `creditLimit - netBalance` (computed)

**Exposure formula** (απλοποιημένη — δεν έχουμε orders/deliveries):
```
exposure = currentBalance (open AR)
check = exposure + newInvoiceAmount > creditLimit
```

**Behavior**:
- `auto` → Block τιμολογίου + API error 422 + UI warning
- `manual` → Warning μόνο, ο χρήστης αποφασίζει
- `off` → Κανένας έλεγχος

---

### Q4: Customer Balances — Disputed Invoices

**Ερώτηση**: Πώς χειριζόμαστε αμφισβητούμενα τιμολόγια στο balance;

**Τι κάνουν οι μεγάλοι:**

| Σύστημα | Dispute Management |
|---------|-------------------|
| **SAP S/4HANA** | Πλήρες FSCM-DM module — dispute cases, reason codes, processors, workflow. Disputed items ΠΑΡΑΜΕΝΟΥΝ στο AR balance αλλά εξαιρούνται από dunning |
| **SAP Business One** | Manual — payment block flag στο line item |
| **NetSuite** | Custom fields/workflows — δεν έχει built-in dispute |
| **Xero / QuickBooks** | ❌ Τίποτα |
| **Ελληνική πρακτική** | Informal — σημείωση στο τιμολόγιο, χειροκίνητη διαχείριση |

**Οι επιλογές:**

**A) SAP-style Dispute Management:**
- Dispute case entity, reason codes, assigned processor, workflow statuses
- Πολύ πολύπλοκο, overkill για ατομική

**B) Απλό Dispute Flag (SAP B1 pattern):**
- Boolean `isDisputed` + `disputeReason` + `disputeDate` στο Invoice
- Disputed invoices: ΠΑΡΑΜΕΝΟΥΝ στο balance (ελληνικός νόμος — χρωστάει μέχρι να λυθεί)
- ΕΞΑΙΡΟΥΝΤΑΙ από aging alerts/dunning
- Visual indicator στο UI (κίτρινο flag)
- Dashboard: `Total AR = Undisputed (€X) + Disputed (€Y)`

**C) Χωρίς dispute tracking:**
- Μόνο notes field στο invoice

**Πρόταση**: **B (Απλό Dispute Flag)** — Enterprise feature, 3 πεδία, μεγάλη αξία στη διαχείριση. Χωρίς overkill workflow.

**Απόφαση Γιώργου**: ✅ **B — Απλό Dispute Flag**

**Πεδία στο Invoice**:
- `isDisputed?: boolean` — Flag αμφισβήτησης
- `disputeReason?: string` — Λόγος αμφισβήτησης (free text)
- `disputeDate?: string` — Πότε αμφισβητήθηκε (ISO 8601)

**Behavior**:
- Disputed invoices ΠΑΡΑΜΕΝΟΥΝ στο AR balance (νομικά χρωστάει)
- ΕΞΑΙΡΟΥΝΤΑΙ από aging alerts
- Dashboard split: `Total AR = Undisputed (€X) + Disputed (€Y)`
- Visual indicator (κίτρινο flag) στο UI

---

### Q5: Fiscal Period Management — Μοντέλο Καταστάσεων (States)

**Ερώτηση**: Πόσες καταστάσεις θέλουμε για τις φορολογικές περιόδους;

**Τι κάνουν οι μεγάλοι:**

| Σύστημα | States | Λεπτομέρεια |
|---------|--------|-------------|
| **SAP S/4HANA** | 2 (Open/Closed via ranges) | Ελέγχεται μέσω OB52 ranges + authorization groups. Εξαιρετικά flexible αλλά πολύπλοκο |
| **Oracle NetSuite** | **6**: Not Yet Open, Open, Closed to AR, Closed to AP, Closed, Locked | Module-level granularity (AR/AP ξεχωριστά πριν GL). Period close checklist |
| **SAGE 300** | 3: Open, Closed, Locked | Per-module calendar. Locked = permanent (Year End) |
| **Xero** | 2 lock dates (Period/Year) | Απλό αλλά limited — global, όχι per-period |
| **Entersoft (Ελληνικό)** | 3: Ανοιχτή, Προσωρινά Κλειστή, Οριστικά Κλειστή | "Προσωρινά Κλειστή" = soft close, reversible |
| **Epsilon Net (Ελληνικό)** | 3: Ανοιχτή, Κλειδωμένη, Κλεισμένη | Auto-lock μηνός μετά myDATA submission |

**Οι επιλογές:**

**A) 3-state (SAGE/Entersoft pattern):**
- `OPEN` → Δέχεται εγγραφές κανονικά
- `SOFT_CLOSED` → Μπλοκάρει νέες εγγραφές, αλλά admin μπορεί να ξανανοίξει (reversible)
- `HARD_CLOSED` → Permanent lock, μόνο reversal στην επόμενη ανοιχτή περίοδο

**B) 4-state (NetSuite simplified):**
- `NOT_OPEN` → Μελλοντική περίοδος, δεν δέχεται τίποτα
- `OPEN` → Δέχεται εγγραφές
- `CLOSED` → Μπλοκ + admin override δυνατότητα
- `LOCKED` → Permanent, μηδενική αλλαγή

**C) 6-state (Full NetSuite):**
- `NOT_OPEN`, `OPEN`, `CLOSED_AR`, `CLOSED_AP`, `CLOSED`, `LOCKED`
- Module-level granularity (AR/AP ξεχωριστά)
- Overkill: Εμείς δεν έχουμε ξεχωριστό AP module

**Αρχική πρόταση**: B (4-state). **Αναθεώρηση μετά νομοθετική ανάλυση**: A (3-state).

**Νομοθετικό πλαίσιο (Ν.4308/2014 ΕΛΠ + ΚΦΔ Ν.4987/2022)**:
- Η νομοθεσία ΔΕΝ επιβάλλει κλείδωμα περιόδων, αλλά η καλή πρακτική (και όλα τα ελληνικά ERP) το κάνει
- Μετά υποβολή ΦΠΑ: αλλαγή = τροποποιητική δήλωση ΦΠΑ (νόμιμο αλλά ρίσκο)
- Μετά φορολογική δήλωση (Ε3/Ε1): αλλαγή = τροποποιητική + κίνδυνος ελέγχου
- Μελλοντικά τιμολόγια: δεν χρειάζεται "NOT_OPEN" state — ελέγχεται μέσω invoice date validation
- Παραγραφή: 5 έτη

**Απόφαση Γιώργου**: ✅ **A — 3 states** (σύμφωνα με ελληνική νομοθεσία)

**States**:
- `OPEN` — Δέχεται εγγραφές κανονικά (τρέχον τρίμηνο)
- `CLOSED` — Μπλοκ μετά υποβολή ΦΠΑ. Admin μπορεί να ξανανοίξει (reversible). Warning: "Αν γράψεις εδώ, θα χρειαστεί τροποποιητική ΦΠΑ"
- `LOCKED` — Permanent lock μετά φορολογική δήλωση (Ε3/Ε1). Κανείς δεν πειράζει. Μόνο reversal στην τρέχουσα ανοιχτή περίοδο

---

### Q6: Fiscal Periods — Granularity (Μηνιαία ή Τριμηνιαία;)

**Ερώτηση**: Ποια θα είναι η μονάδα περιόδου;

**Τι λέει η νομοθεσία:**
- **ΦΠΑ ατομικής / Β' κατηγορίας**: Τριμηνιαία υποβολή (Q1-Q4)
- **ΦΠΑ Γ' κατηγορίας (ΟΕ/ΕΠΕ/ΑΕ)**: Μηνιαία υποβολή
- **myDATA**: Μηνιαίες προθεσμίες (ανεξαρτήτως κατηγορίας)
- **Φόρος εισοδήματος**: Ετήσια (χρήση = Ιαν-Δεκ)

**Τι κάνουν τα ελληνικά ERP:**
- **Softone**: Μηνιαίες περίοδοι + ετήσια χρήση (12 + 1 κλεισίματος)
- **Entersoft**: Μηνιαίες περίοδοι (12 + 1)
- **Epsilon Net**: Μηνιαίες, auto-lock μετά myDATA

**Οι επιλογές:**

**A) Τριμηνιαίες (4 περίοδοι/χρόνο):**
- Ευθυγραμμισμένες με ΦΠΑ ατομικής
- Πρόβλημα: Αν αλλάξει σε ΟΕ/ΕΠΕ/ΑΕ, δεν ταιριάζει (μηνιαίο ΦΠΑ)

**B) Μηνιαίες (12 περίοδοι/χρόνο):**
- Ευθυγραμμισμένες με myDATA (μηνιαίο) + ΦΠΑ Γ' κατηγορίας
- Λειτουργεί και για τριμηνιαίο ΦΠΑ (κλείνεις 3 μήνες μαζί)
- Πιο granular έλεγχος
- Enterprise standard (SAP, NetSuite, Softone, Entersoft = μηνιαίες)

**C) Μηνιαίες + 1 Adjustment Period (13η):**
- 12 κανονικές + Period 13 για year-end adjustments (SAP/SAGE/Entersoft pattern)
- Ο λογιστής γράφει adjustments στην 13η χωρίς να πειράξει τον Δεκέμβριο

**Πρόταση**: **C (Μηνιαίες + Period 13)** — Full enterprise. Λειτουργεί για ΟΛΕΣ τις μορφές εταιρείας (ατομική, ΟΕ, ΕΠΕ, ΑΕ). Period 13 = SAP/Entersoft pattern.

**Απόφαση Γιώργου**: ✅ **C — Μηνιαίες + Period 13**

**Δομή ανά χρήση**:
- Periods 1-12: Ιανουάριος - Δεκέμβριος (μηνιαίες)
- Period 13: Year-end adjustments (μοιράζεται ημερομηνίες Δεκεμβρίου, manual assignment)
- Ο χρήστης κλειδώνει ανά μήνα ή ανά τρίμηνο (ευέλικτο)
- Τριμηνιαίο ΦΠΑ ατομικής: κλείνεις μήνες 1-3 μαζί μετά υποβολή Q1
- Μηνιαίο ΦΠΑ Γ' κατηγορίας: κλείνεις κάθε μήνα ξεχωριστά

---

### Q7: Fiscal Periods — Cross-Period Reversals

**Ερώτηση**: Τι γίνεται όταν ακυρώνεις τιμολόγιο που ανήκει σε κλειστή περίοδο;

**Σενάριο**: Είσαι στον Μάιο (Period 5, OPEN). Θέλεις να ακυρώσεις τιμολόγιο Μαρτίου (Period 3, CLOSED).

**Τι κάνουν οι μεγάλοι:**

| Σύστημα | Συμπεριφορά |
|---------|-------------|
| **SAP S/4HANA** | Η αντιλογιστική εγγραφή (reversal) γράφεται στην **τρέχουσα ανοιχτή** περίοδο. Πεδίο `STGRD` (reversal reason) = "01" (reversal in current period). Η κλειστή περίοδο ΔΕΝ ανοίγει |
| **NetSuite** | Ίδιο — reversal στην τρέχουσα. Flag `differentPeriod: true` |
| **SAGE** | Ίδιο — reversal goes to first open period |
| **Entersoft** | Ίδιο |
| **Ελληνική νομοθεσία** | Το πιστωτικό τιμολόγιο εκδίδεται με **σημερινή** ημερομηνία (όχι παλιά). Υποβάλλεται στο myDATA του τρέχοντος μήνα. Αν το αρχικό ήταν σε κλειστό τρίμηνο ΦΠΑ → τροποποιητική ΦΠΑ |

**Οι επιλογές:**

**A) Reversal στην τρέχουσα ανοιχτή (industry standard + νομοθεσία):**
- Η κλειστή περίοδος ΔΕΝ ανοίγει
- Η reversal entry γράφεται στην τρέχουσα με flag `crossPeriodReversal: true`
- Αναφέρει: `originalPeriod: 3`, `reversalPeriod: 5`
- Ο VAT Engine μαθαίνει ότι αφορά Q1 αλλά δηλώθηκε στο Q2

**B) Ξεκλείδωμα + reversal στην αρχική:**
- Ξεκλειδώνεις Period 3, γράφεις reversal, ξανακλειδώνεις
- Πρόβλημα: Τροποποιεί κλειστή περίοδο, μπελάδες με ΦΠΑ

**Πρόταση**: **A** — Είναι τόσο industry standard όσο και νομικά σωστό. Το πιστωτικό εκδίδεται σήμερα, η reversal γράφεται σήμερα.

**Απόφαση Γιώργου**: ✅ **A — Reversal στην τρέχουσα ανοιχτή περίοδο**

**Υλοποίηση**:
- Η κλειστή περίοδος ΔΕΝ ανοίγει ποτέ αυτόματα
- Reversal entry γράφεται στην τρέχουσα ανοιχτή περίοδο
- Flags: `crossPeriodReversal: true`, `originalPeriod`, `reversalPeriod`
- Credit note: σημερινή ημερομηνία (ελληνική νομοθεσία)
- myDATA: υποβάλλεται στον τρέχοντα μήνα

---

### Q8: Fiscal Periods — Auto-creation & Year-End

**Ερώτηση**: Πώς δημιουργούνται οι περίοδοι και τι γίνεται στο κλείσιμο χρήσης;

**Τι κάνουν οι μεγάλοι:**

| Σύστημα | Δημιουργία Periods | Year-End Close |
|---------|-------------------|----------------|
| **SAP** | Manual setup fiscal year variant (T009). Periods ορίζονται 1 φορά, ισχύουν κάθε χρόνο | Transaction FAGL_FC_BAL: P&L → Retained Earnings, B/S carry-forward |
| **NetSuite** | Auto-create κατά Setup Fiscal Year. 12 periods + optional adjustment | Period close checklist (13 βήματα). Admin κάνει lock |
| **SAGE** | Manual fiscal calendar setup | Year End Processing: close P&L, create opening balances, permanent lock |
| **Entersoft** | Auto-create 12+1 κατά δημιουργία χρήσης | Κλείσιμο χρήσης: μεταφορά υπολοίπων + lock |
| **Ελληνική πρακτική** | Χρήση = Ιαν-Δεκ. Δημιουργία 12 + 1 κλεισίματος | Ισοζύγιο κλεισίματος (ΕΛΠ), μεταφορά Ε-Ε, P&L → Ίδια Κεφάλαια |

**Οι επιλογές:**

**A) Auto-create κατά Company Setup:**
- Ο χρήστης κάνει setup εταιρεία → αυτόματα δημιουργούνται 13 periods για το τρέχον fiscal year (12 μήνες + Period 13)
- Όλα OPEN by default
- Κάθε Ιανουάριο: νέος κύκλος 13 periods (αυτόματα ή manual trigger)

**B) On-demand creation:**
- Δεν δημιουργούνται αυτόματα — ο χρήστης δημιουργεί όταν θέλει
- Πιο flexible αλλά πιο error-prone

**Πρόταση**: **A (Auto-create)** — Κατά company setup → 13 periods. Νέα χρήση → button "Δημιουργία Νέας Χρήσης" που φτιάχνει 13 νέες periods.

**Year-End Close**: Simplified checklist (6 βήματα — Entersoft/Softone pattern):
1. ✅ Έλεγχος εκκρεμών εγγραφών
2. ✅ Αποσβέσεις παγίων (αυτόματο — DepreciationEngine)
3. ✅ Τελικές διορθώσεις στην Period 13
4. ✅ Ισοζύγιο κλεισίματος (report)
5. ✅ Κλείδωμα περιόδων 1-13 (CLOSED → LOCKED)
6. ✅ Δημιουργία νέας χρήσης (13 νέες periods)

**Απόφαση Γιώργου**: ✅ **A — Auto-create + 6-step Year-End Checklist**

**Υλοποίηση**:
- Company setup → auto-create 13 periods (1-12 μήνες + Period 13 adjustments), status: OPEN
- Button "Δημιουργία Νέας Χρήσης" → 13 νέες periods για επόμενο έτος
- Year-End checklist: 6 βήματα (Entersoft pattern — validated by industry research)
- Period 13: ίδιες ημερομηνίες με Δεκέμβριο, manual assignment κατά posting

---

## ΣΥΝΟΨΗ ΟΛΩΝ ΤΩΝ ΑΠΟΦΑΣΕΩΝ

| # | Θέμα | Απόφαση | Pattern |
|---|------|---------|---------|
| Q1 | Customer Balances — Αρχιτεκτονική | **C — Hybrid** (stored + reconciliation) | SAP B1/NetSuite + safety net |
| Q2 | Aging Buckets | **B — 6 buckets** (current, 1-30, 31-60, 61-90, 91-120, 120+) | SAP S/4HANA enterprise |
| Q3 | Credit Management | **A — Πλήρες** (limit, hold rule, risk class, review date) | SAP/NetSuite full credit mgmt |
| Q4 | Disputed Invoices | **B — Απλό Dispute Flag** (3 πεδία) | SAP B1 pattern |
| Q5 | Period States | **A — 3 states** (OPEN, CLOSED, LOCKED) | Ελληνική νομοθεσία + Entersoft |
| Q6 | Period Granularity | **C — Μηνιαίες + Period 13** | SAP/Entersoft/Softone |
| Q7 | Cross-Period Reversal | **A — Reversal στην τρέχουσα** | Industry standard + νομοθεσία |
| Q8 | Creation & Year-End | **A — Auto-create + 6-step checklist** | Entersoft/Softone pattern |
