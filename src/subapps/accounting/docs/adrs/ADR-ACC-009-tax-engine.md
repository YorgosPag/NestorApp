# ADR-ACC-009: Tax Engine — Μηχανή Φορολογίας (Εισόδημα + Εταιρικός Φόρος)

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-09 |
| **Category** | Accounting / Income Tax |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Parent** | [ADR-ACC-000](./ADR-ACC-000-founding-decision.md) |
| **Module** | M-010: Reports (Tax Reports) |

---

## 1. Context

Ο Γιώργος ως **ελεύθερος επαγγελματίας** (ατομική επιχείρηση) φορολογείται με την κλίμακα φυσικών προσώπων για εισόδημα από επιχειρηματική δραστηριότητα (άρθρο 29 Ν.4172/2013).

### Φορολογικό Προφίλ

| Παράμετρος | Τιμή |
|-----------|-------|
| Τύπος φορολογούμενου | Ελεύθερος επαγγελματίας |
| Κλίμακα φόρου | Φυσικών προσώπων (9%-44%) |
| Προκαταβολή φόρου | 55% (1-3 χρόνια) → 100% (>3 χρόνια) |
| Τέλος επιτηδεύματος | 650€/έτος |
| Εισφορά αλληλεγγύης | Αναστέλλεται (2021-2025), ελέγχεται ετήσια |
| Φορολογικό έτος | 1/1 — 31/12 |
| Υποβολή Ε1/Ε3 | Ιούνιος (κάθε χρόνο) |

---

## 2. Income Tax Scale (Κλίμακα Φόρου ανά έτος)

> ⚠️ **Ευθυγραμμίστηκε με τον κώδικα 2026-10-14.** Αυτή η ενότητα έγραφε «Κλίμακα 2026 = 9/22/28/36/44» —
> ήταν η κλίμακα 2024–2025. Το 2026 ισχύει ο **ν.5246/2025** (ΦΕΚ Α' 198/11-11-2025). SSoT: `services/config/tax-config.ts`
> (`GREEK_TAX_SCALES`, `getTaxScaleForYear`). Ο πίνακας εδώ είναι ΠΡΟΒΟΛΗ· η αυθεντία είναι το config και το
> `tax-engine.test.ts` που καρφώνει ανεξάρτητα υπολογισμένα νούμερα.

### 2.1 Κλιμάκια

**2024–2025** (ν.4172/2013 αρ.15)

| Κλιμάκιο | Εισόδημα | Συντελεστής | Σωρευτικός Φόρος |
|----------|----------|-------------|------------------|
| 1ο | 0 — 10.000€ | 9% | 900€ |
| 2ο | 10.000 — 20.000€ | 22% | 3.100€ |
| 3ο | 20.000 — 30.000€ | 28% | 5.900€ |
| 4ο | 30.000 — 40.000€ | 36% | 9.500€ |
| 5ο | 40.000+ | 44% | — |

**2026+** (ν.5246/2025 — μισθοί, συντάξεις, επιχειρηματική δραστηριότητα)

| Κλιμάκιο | Εισόδημα | Συντελεστής | Σωρευτικός Φόρος |
|----------|----------|-------------|------------------|
| 1ο | 0 — 10.000€ | 9% | 900€ |
| 2ο | 10.000 — 20.000€ | 20% | 2.900€ |
| 3ο | 20.000 — 30.000€ | 26% | 5.500€ |
| 4ο | 30.000 — 40.000€ | 34% | 8.900€ |
| 5ο | 40.000 — 60.000€ | 39% | 16.700€ |
| 6ο | 60.000+ | 44% | — |

⚠️ **Δεν μοντελοποιούνται** οι μειώσεις του ν.5246/2025 που εξαρτώνται από το πρόσωπο (ηλικία ≤ 30, αριθμός
τέκνων): η εφαρμογή δεν κρατά αυτά τα στοιχεία του φορολογουμένου.

**Πλάτος κλιμακίου** (`helpers/tax-brackets.ts`, διόρθωση 2026-10-14): μετριέται από το **άνω όριο του
προηγούμενου** κλιμακίου. Το `from` (π.χ. `10_001`) είναι ετικέτα εμφάνισης σε ακέραια €. Πριν, με
`to − from + 1`, το 1ο κλιμάκιο κάλυπτε 10.001 € (φόρος 10.000 € = 900,09 € αντί 900 €).

### 2.2 Config (date-aware)

```typescript
interface TaxBracket {
  from: number;           // Από ποσό
  to: number | null;      // Μέχρι ποσό (null = απεριόριστο)
  rate: number;           // Συντελεστής (0.09, 0.22, 0.28, 0.36, 0.44)
}

interface TaxScaleConfig {
  year: number;
  validFrom: string;
  brackets: TaxBracket[];
  prepaymentRate: number;       // 0.55 ή 1.00
  professionalTax: number;      // 650 ή 325
  solidarityTaxEnabled: boolean;
}

const TAX_SCALE_2026: TaxScaleConfig = {
  year: 2026,
  validFrom: '2026-01-01',
  brackets: [
    { from: 0,     to: 10000, rate: 0.09 },
    { from: 10001, to: 20000, rate: 0.22 },
    { from: 20001, to: 30000, rate: 0.28 },
    { from: 30001, to: 40000, rate: 0.36 },
    { from: 40001, to: null,  rate: 0.44 },
  ],
  prepaymentRate: 1.00,           // >3 χρόνια → 100%
  professionalTax: 650,           // Θεσσαλονίκη (>200.000 κάτοικοι)
  solidarityTaxEnabled: false,    // Αναστολή
};
```

---

## 3. Tax Calculation Engine

### 3.1 Core Interface

```typescript
interface ITaxEngine {
  /** Υπολογισμός ετήσιου φόρου εισοδήματος */
  calculateAnnualTax(params: TaxCalculationParams): TaxResult;

  /** Εκτίμηση φόρου (real-time, κατά τη διάρκεια του έτους) */
  estimateTax(
    companyId: string,
    year: number,
    asOfDate: string
  ): Promise<TaxEstimate>;

  /** Κλίμακα φόρου (date-aware) */
  getTaxScale(year: number): TaxScaleConfig;
}

interface TaxCalculationParams {
  year: number;
  grossIncome: number;            // Ακαθάριστα έσοδα
  deductibleExpenses: number;     // Εκπιπτόμενες δαπάνες
  efkaContributions: number;      // Εισφορές ΕΦΚΑ (εκπίπτουν)
  withheldTax: number;            // Παρακρατηθέντες φόροι (20%, 3%)
  previousYearPrepayment: number; // Προκαταβολή προηγ. έτους
  yearsInBusiness: number;        // Χρόνια δραστηριότητας
}
```

### 3.2 Tax Result

```typescript
interface TaxResult {
  year: number;

  // === Εισόδημα ===
  grossIncome: number;              // Ακαθάριστα έσοδα
  deductibleExpenses: number;       // Εκπιπτόμενες δαπάνες
  efkaContributions: number;        // ΕΦΚΑ (εκπίπτουν)
  taxableIncome: number;            // Φορολογητέο = gross - expenses - efka

  // === Φόρος Εισοδήματος ===
  incomeTax: number;                // Από κλίμακα
  taxBreakdown: TaxBracketResult[]; // Ανάλυση ανά κλιμάκιο

  // === Τέλος Επιτηδεύματος ===
  professionalTax: number;          // 650€

  // === Εισφορά Αλληλεγγύης ===
  solidarityTax: number;            // 0 (αν αναστέλλεται)

  // === Προκαταβολή Φόρου ===
  prepaymentRate: number;           // 55% ή 100%
  prepaymentAmount: number;         // incomeTax × rate

  // === Σύνολα ===
  totalTax: number;                 // incomeTax + professionalTax + solidarity
  totalWithPrepayment: number;      // totalTax + prepayment

  // === Μειώσεις ===
  withheldTax: number;              // Παρακρατηθέντες (20%, 3%)
  previousPrepayment: number;       // Προκαταβολή προηγ. έτους
  totalCredits: number;             // withheld + previousPrepayment

  // === ΤΕΛΙΚΟ ΠΛΗΡΩΤΕΟ ===
  finalPayable: number;             // totalWithPrepayment - totalCredits
  // Αν < 0 → επιστροφή φόρου
}

interface TaxBracketResult {
  bracket: TaxBracket;
  taxableAmount: number;            // Ποσό στο κλιμάκιο
  taxAmount: number;                // Φόρος κλιμακίου
}
```

### 3.3 Calculation Logic

```typescript
function calculateIncomeTax(
  taxableIncome: number,
  brackets: TaxBracket[]
): { total: number; breakdown: TaxBracketResult[] } {
  let remainingIncome = taxableIncome;
  let totalTax = 0;
  const breakdown: TaxBracketResult[] = [];

  for (const bracket of brackets) {
    if (remainingIncome <= 0) break;

    const bracketSize = bracket.to
      ? bracket.to - bracket.from + 1
      : remainingIncome;

    const taxableInBracket = Math.min(remainingIncome, bracketSize);
    const taxForBracket = taxableInBracket * bracket.rate;

    breakdown.push({
      bracket,
      taxableAmount: taxableInBracket,
      taxAmount: Math.round(taxForBracket * 100) / 100,
    });

    totalTax += taxForBracket;
    remainingIncome -= taxableInBracket;
  }

  return {
    total: Math.round(totalTax * 100) / 100,
    breakdown,
  };
}
```

---

## 3A. Corporate Tax Engine (ΕΠΕ / ΑΕ) — Added 2026-02-12

### 3A.1 Context

Η ΕΠΕ και ΑΕ φορολογούνται ως **νομικά πρόσωπα** — flat rate 22% (Ν.4172/2013, αρ.58), ΟΧΙ κλίμακα φυσικών προσώπων. Η μέθοδος `calculateCorporateTax()` γενικεύτηκε με `entityType` parameter.

### 3A.2 Εταιρικός Φόρος — Συντελεστές

| Παράμετρος | Τιμή | Νόμος |
|-----------|-------|-------|
| Εταιρικός φόρος | **22%** flat | Ν.4172/2013, αρ.58 |
| Φόρος μερισμάτων | **5%** | Ν.4172/2013, αρ.64 |
| Προκαταβολή φόρου | **80%** | Ν.4172/2013, αρ.71 |
| Τέλος επιτηδεύματος | **1.000€** | — |

### 3A.3 Generalized Tax Engine

```typescript
// tax-engine.ts — Γενίκευση calculateCorporateTax()
calculateCorporateTax(params: {
  revenue: number;
  expenses: number;
  efkaTotal: number;
  members: Array<{ memberId: string; name: string; dividendSharePercent: number }>;
  distributionPercent?: number;  // default 100%
  entityType?: EntityType;       // default 'epe' — backward compatible
}): CorporateTaxResult

// Wrapper για ΑΕ — maps shareholders → members
calculateAETax(params: {
  revenue: number;
  expenses: number;
  efkaTotal: number;
  shareholders: Shareholder[];
  distributionPercent?: number;
}): AETaxResult
```

### 3A.4 Key Architecture Decision

**Reuse, not duplicate**: `calculateCorporateTax()` δέχεται `entityType` parameter → χρησιμοποιεί `getPrepaymentRateForEntity()` και `getProfessionalTaxForEntity()` δυναμικά. Μόνη διαφορά EPE vs AE: τα member types (Member vs Shareholder). Η `calculateAETax()` κάνει mapping internally.

### 3A.5 Dividend Distribution

```
Κέρδη μετά φόρων × distributionPercent = Διανεμόμενα μερίσματα
Ανά μέτοχο/εταίρο: dividendSharePercent% × μερίσματα
Φόρος μερισμάτων: 5% × gross dividend ανά μέτοχο
Καθαρό μέρισμα = gross - 5% φόρος
```

### 3A.6 Config (tax-config.ts)

```typescript
// Ήδη υπαρχόντα — added with EPE (ADR-ACC-014)
getCorporateTaxRate(): 0.22
getDividendTaxRate(): 0.05
getPrepaymentRateForEntity('epe'): 0.80
getPrepaymentRateForEntity('ae'): 0.80
getProfessionalTaxForEntity('epe'): 1000
getProfessionalTaxForEntity('ae'): 1000
```

---

## 4. Practical Examples

### 4.1 Παράδειγμα: Γιώργος 2026

```
ΕΣΟΔΑ:
  Αρχιτεκτονικές υπηρεσίες:     45.000€
  Κατασκευαστικά:                15.000€
  ─────────────────────────────────────
  Ακαθάριστα Έσοδα:             60.000€

ΕΞΟΔΑ:
  Αμοιβές τρίτων (λογιστής):     3.000€
  Ενοίκιο γραφείου:              4.800€ (400×12)
  ΔΕΚΟ + Τηλέφωνο:               2.400€
  Καύσιμα:                       3.600€
  Αναλώσιμα + Software:          2.000€
  Αποσβέσεις:                    2.930€
  Λοιπά:                         1.270€
  ─────────────────────────────────────
  Σύνολο Εξόδων:                20.000€

  ΕΦΚΑ:                          3.964€ (330,37 × 12)

ΦΟΡΟΛΟΓΗΤΕΟ ΕΙΣΟΔΗΜΑ:
  60.000 - 20.000 - 3.964 = 36.036€

ΦΟΡΟΣ ΕΙΣΟΔΗΜΑΤΟΣ (κλίμακα):
  0-10.000:     10.000 × 9%  =    900€
  10.001-20.000: 10.000 × 22% =  2.200€
  20.001-30.000: 10.000 × 28% =  2.800€
  30.001-36.036:  6.036 × 36% =  2.173€
  ─────────────────────────────────────
  Φόρος εισοδήματος:             8.073€

ΤΕΛΟΣ ΕΠΙΤΗΔΕΥΜΑΤΟΣ:              650€

ΠΡΟΚΑΤΑΒΟΛΗ (100%):              8.073€

ΣΥΝΟΛΟ ΦΟΡΟΥ:
  8.073 + 650 + 8.073 =        16.796€

ΜΕΙΩΣΕΙΣ:
  Παρακρατηθέντες 20%:           7.200€ (45.000 × 0.80 × 0.20... approx)
  Προκαταβολή 2025:              6.500€ (εκτίμηση)
  ─────────────────────────────────────
  Σύνολο μειώσεων:              13.700€

ΠΛΗΡΩΤΕΟ:
  16.796 - 13.700 =             3.096€
```

### 4.2 Δόσεις Πληρωμής

Ο φόρος εισοδήματος πληρώνεται σε **3 δόσεις**:

| Δόση | Ποσοστό | Ημ/νία | Ποσό (παράδειγμα) |
|------|---------|--------|-------------------|
| 1η | 33,33% | Ιούλιος | 1.032€ |
| 2η | 33,33% | Σεπτέμβριος | 1.032€ |
| 3η | 33,34% | Νοέμβριος | 1.032€ |

---

## 5. Real-time Tax Estimator

### 5.1 Estimate Interface

```typescript
interface TaxEstimate {
  asOfDate: string;
  year: number;

  // === Μέχρι Στιγμής ===
  currentIncome: number;          // Τρέχοντα έσοδα
  currentExpenses: number;        // Τρέχοντα έξοδα
  currentEfka: number;            // ΕΦΚΑ πληρωμένα
  currentTaxableIncome: number;

  // === Εκτίμηση Τέλους Έτους ===
  projectedIncome: number;        // Προβολή (annualized)
  projectedExpenses: number;
  projectedTaxableIncome: number;

  // === Εκτιμώμενος Φόρος ===
  estimatedTax: TaxResult;

  // === Χρήσιμα ===
  effectiveTaxRate: number;       // Πραγματικός συντελεστής
  monthlyTaxReserve: number;      // Πόσα να βάζει στην άκρη/μήνα
  withheldSoFar: number;          // Ήδη παρακρατηθέντες
}
```

### 5.2 Projection Method

```
projectedIncome = currentIncome × (12 / currentMonth)
projectedExpenses = currentExpenses × (12 / currentMonth)

Ή:
projectedIncome = currentIncome + (avgMonthlyIncome × remainingMonths)
```

### 5.3 Dashboard Card

```
┌─────────────────────────────────────┐
│  📊 Εκτίμηση Φόρου 2026            │
│  (μέχρι Φεβρουάριο)                │
│─────────────────────────────────────│
│  Τρέχον εισόδημα:     12.500€      │
│  Εκτίμηση τέλος:      ~60.000€     │
│  ─────────────────────              │
│  Εκτιμώμενος φόρος:   ~8.073€      │
│  + Τέλος επιτηδ.:        650€      │
│  + Προκαταβολή:        ~8.073€     │
│  - Παρακρατήσεις:      ~7.200€     │
│  - Προκαταβολή 2025:   ~6.500€     │
│  ─────────────────────              │
│  Εκτ. πληρωτέο:       ~3.096€      │
│  ─────────────────────              │
│  Μηνιαίο reserve:        ~258€     │
│  Effective rate:          13,5%     │
└─────────────────────────────────────┘
```

---

## 6. E1/E3 Form Auto-fill

### 6.1 Κωδικοί Ε3 (Κατάσταση Οικονομικών Στοιχείων)

| Κωδικός | Πεδίο | Πηγή |
|---------|-------|------|
| **047** | Πωλήσεις αγαθών & υπηρεσιών | journal_entries (type=income) |
| **048** | Λοιπά συνήθη έσοδα | other_income |
| **049** | Ασυνήθη έσοδα (πώληση παγίων) | asset_sale_income |
| **102** | Παροχές σε εργαζομένους | — (δεν έχει υπαλλήλους) |
| **181** | Αγορές αγαθών & υπηρεσιών | category2_1..2_5 expenses |
| **202** | Λοιπά λειτουργικά έξοδα | 585_xxx expenses |
| **302** | Αποσβέσεις | depreciation entries |

### 6.2 Κωδικοί Ε1 (Δήλωση Φορολογίας Εισοδήματος)

| Κωδικός | Πεδίο | Πηγή |
|---------|-------|------|
| **401-402** | Ακαθάριστα έσοδα | Σύνολο εσόδων Ε3 |
| **403-404** | Καθαρά κέρδη | taxableIncome |
| **601-602** | Παρακρατηθέντες φόροι | Σύνολο withheld |
| **605-606** | Προκαταβολή προηγ. | previousPrepayment |

### 6.3 Export

```typescript
interface TaxFormExport {
  type: 'E1' | 'E3';
  year: number;
  fields: Record<string, number>;

  /** Export formats */
  exportToCsv(): string;         // Για manual upload TAXISnet
  exportToJson(): object;        // Για API (μελλοντικό)
  generatePdf(): Promise<Blob>;  // Εκτύπωση
}
```

---

## 7. Withholding Tax Reconciliation

### 7.1 Βεβαιώσεις Αποδοχών

Κάθε πελάτης που παρακρατεί φόρο εκδίδει **βεβαίωση αποδοχών** (ετήσια). Η εφαρμογή:

```typescript
interface WithholdingReconciliation {
  year: number;

  /** Ανά πελάτη */
  byCustomer: Array<{
    contactId: string;
    contactName: string;
    contactVat: string;
    totalGross: number;           // Ακαθάριστο ποσό
    totalWithheld: number;        // Παρακρατηθέν
    withholdingRate: number;      // 20% ή 3%
    invoiceCount: number;
    certificateReceived: boolean; // Λάβαμε βεβαίωση;
  }>;

  /** Σύνολα */
  totalWithheld: number;          // Σύνολο παρακρατηθέντων
  certificatesReceived: number;
  certificatesPending: number;
}
```

### 7.2 Workflow

```
[1] Τέλος Φεβρουαρίου: Reminder "Ζήτα βεβαιώσεις αποδοχών 2025"
    ↓
[2] Εφαρμογή: Λίστα πελατών με παρακρατήσεις
    ├─ ΠΑΠΑΔΟΠΟΥΛΟΣ ΑΕ:  7.200€ παρακρατηθέντα  [⏳ Pending]
    ├─ ΔΗΜΟΣ ΘΕΣ/ΝΙΚΗΣ:  1.500€ παρακρατηθέντα  [✅ Received]
    ├─ ΝΕΣΤΩΡ ΕΠΕ:          900€ παρακρατηθέντα  [⏳ Pending]
    ↓
[3] Mark as received → cross-check ποσά
    ↓
[4] Αν discrepancy → flag για τον λογιστή
```

---

## 8. Payment Installments

### 8.1 Δόσεις Φόρου

```typescript
interface TaxInstallment {
  installmentNumber: 1 | 2 | 3;
  dueDate: string;                // Τέλος Ιουλίου / Σεπτ. / Νοεμ.
  amount: number;
  status: 'upcoming' | 'due' | 'paid' | 'overdue';
  paidDate: string | null;
  paidAmount: number | null;
  journalEntryId: string | null;  // → journal_entries (αν πληρωθεί)
}

function calculateInstallments(
  totalPayable: number,
  year: number
): TaxInstallment[] {
  const installment = Math.round(totalPayable / 3 * 100) / 100;
  const lastInstallment = totalPayable - (installment * 2);

  return [
    { installmentNumber: 1, dueDate: `${year}-07-31`,
      amount: installment, status: 'upcoming', /* ... */ },
    { installmentNumber: 2, dueDate: `${year}-09-30`,
      amount: installment, status: 'upcoming', /* ... */ },
    { installmentNumber: 3, dueDate: `${year}-11-30`,
      amount: lastInstallment, status: 'upcoming', /* ... */ },
  ];
}
```

### 8.2 Reminders

| Trigger | Ημέρες | Μήνυμα |
|---------|--------|--------|
| Δόση πλησιάζει | 15 πριν | "Δόση φόρου [#]: [ποσό]€ μέχρι [date]" |
| Δόση due | 0 | "Σήμερα λήγει η [#]η δόση φόρου: [ποσό]€" |
| Εκπρόθεσμη | +3 | "⚠️ Εκπρόθεσμη δόση! Πρόστιμο ξεκινά" |
| Ε1/Ε3 υποβολή | 1 Ιουν | "Υποβολή φορολογικής δήλωσης μέχρι 30/6" |

---

## 9. UI Pages

| Route | Σελίδα | Λειτουργία |
|-------|--------|------------|
| `/accounting/reports/tax` | Tax Dashboard | Εκτίμηση + ιστορικό |
| `/accounting/reports/tax/{year}` | Ετήσια Ανάλυση | Πλήρης υπολογισμός |
| `/accounting/reports/tax/{year}/e3` | Ε3 Preview | Αυτόματη προσυμπλήρωση |
| `/accounting/reports/tax/{year}/installments` | Δόσεις | Status πληρωμών |
| `/accounting/reports/tax/{year}/withholding` | Παρακρατήσεις | Βεβαιώσεις + reconciliation |

### 9.1 Tax Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  📊 Φόρος Εισοδήματος 2026                                  │
│─────────────────────────────────────────────────────────────│
│                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ 💼 Εισόδημα  │ │ 📉 Φόρος     │ │ 📊 Eff. Rate │        │
│  │  36.036€     │ │   8.073€    │ │    13,5%     │        │
│  │ (φορολογητέο)│ │ (κλίμακα)   │ │              │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                             │
│  ΑΝΑΛΥΣΗ ΚΛΙΜΑΚΙΩΝ                                         │
│  ─────────────────                                          │
│  9%  │ ██████████████████████ │ 10.000€ →    900€          │
│  22% │ ██████████████████████ │ 10.000€ →  2.200€          │
│  28% │ ██████████████████████ │ 10.000€ →  2.800€          │
│  36% │ ████████████           │  6.036€ →  2.173€          │
│  44% │                        │      0€ →      0€          │
│                                                             │
│  ΠΛΗΡΩΤΕΟ                                                   │
│  ─────────                                                  │
│  Φόρος:               8.073€                                │
│  + Τέλος επιτηδ.:       650€                                │
│  + Προκαταβολή:       8.073€                                │
│  - Παρακρατήσεις:    -7.200€                                │
│  - Προκ. 2025:       -6.500€                                │
│  ════════════════════════════                                │
│  ΤΕΛΙΚΟ:              3.096€  (3 δόσεις × 1.032€)           │
│                                                             │
│  ΔΟΣΕΙΣ                                                     │
│  ──────                                                     │
│  1η │ 31/07/2026 │ 1.032€ │ ⏳ Upcoming                     │
│  2η │ 30/09/2026 │ 1.032€ │ 📅                              │
│  3η │ 30/11/2026 │ 1.032€ │ 📅                              │
│                                                             │
│  [📄 Ε3 Preview]  [📤 Export]  [💡 Φοροσχεδιασμός]          │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Tax Planning Insights

### 10.1 AI-Assisted Tips

```typescript
interface TaxPlanningInsight {
  type: 'expense_gap' | 'efka_upgrade' | 'prepayment_warning' | 'deadline';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  potentialSaving: number | null;
}
```

Παραδείγματα:
- "Αν αγοράσεις εξοπλισμό 3.000€ πριν 31/12, εξοικονομείς ~1.080€ φόρο"
- "Η αλλαγή κατηγορίας ΕΦΚΑ σε 2η αυξάνει τις εκπιπτόμενες δαπάνες"
- "Έχεις 5.000€ δαπάνες χωρίς παραστατικό — ψάξε αποδείξεις"

> **Σημείωση**: Tips μόνο ενδεικτικά — δεν αντικαθιστούν λογιστή.

---

## 11. Firestore Structure

```
accounting/{companyId}/
  ├── tax_calculations/{year}          ← Ετήσιος υπολογισμός φόρου
  │
  ├── tax_installments/{year}_{n}      ← Δόσεις (3 ανά έτος)
  │
  ├── withholding_certificates/{year}  ← Βεβαιώσεις παρακρατήσεων
  │
  └── tax_estimates/{year}_{month}     ← Μηνιαίες εκτιμήσεις (cache)

accounting/shared/
  └── tax_scales/
      ├── 2025
      └── 2026                         ← Κλιμάκια φόρου
```

---

## 12. Dependencies

| Module | Σχέση | Περιγραφή |
|--------|-------|-----------|
| **M-002** (Income/Expense) | **READS** | Σύνολα εσόδων/εξόδων |
| **ACC-001** (Chart of Accounts) | **READS** | E3 code mapping |
| **ACC-004** (VAT) | **INDEPENDENT** | ΦΠΑ ξεχωριστός (δεν αφορά φόρο εισοδήματος) |
| **ACC-006** (EFKA) | **READS** | ΕΦΚΑ εκπιπτόμενες (585_005) |
| **ACC-007** (Fixed Assets) | **READS** | Αποσβέσεις (587_001) |
| **M-003** (Invoicing) | **READS** | Παρακρατηθέντες φόροι |
| **M-010** (Reports) | **FEEDS** | Ε1/Ε3 auto-fill |

---

## 13. Open Questions

| # | Ερώτηση | Status |
|---|---------|--------|
| 1 | Πόσα χρόνια δραστηριότητας; (55% ή 100% προκαταβολή) | DEFAULT: 100% (>3 χρόνια) |
| 2 | Εισφορά αλληλεγγύης 2026: Αναστέλλεται; | DEFAULT: Αναστολή (ελέγχεται) |
| 3 | Αυτόματη υποβολή Ε1/Ε3 μέσω TAXISnet API; | DEFAULT: Export CSV only |

---

## 14. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-02-09 | ADR Created — Tax Engine (Income Tax) | Γιώργος + Claude Code |
| 2026-02-09 | Κλίμακα 5 κλιμακίων (9%-44%), config-driven | Claude Code |
| 2026-02-09 | Προκαταβολή: 100% (>3 χρόνια δραστηριότητας) | Claude Code |
| 2026-02-09 | Τέλος επιτηδεύματος: 650€ (Θεσσαλονίκη >200K) | Claude Code |
| 2026-02-09 | 3 δόσεις (Ιούλ, Σεπτ, Νοεμ) + reminders | Claude Code |
| 2026-02-09 | Real-time estimator: annualized projection + monthly reserve | Claude Code |
| 2026-02-09 | Withholding reconciliation: track βεβαιώσεων ανά πελάτη | Claude Code |
| 2026-02-09 | E1/E3 auto-fill κωδικών (export CSV) | Claude Code |
| 2026-02-09 | Tax planning insights (AI tips — ενδεικτικά) | Claude Code |
| 2026-02-09 | **Phase 2 implemented** — types/tax.ts: TaxBracket, TaxScaleConfig (brackets + prepayment + solidarity), TaxCalculationParams, TaxBracketResult, TaxResult (full breakdown), TaxEstimate (real-time projection), TaxInstallment (3 δόσεις), TaxPlanningInsight, WithholdingReconciliation. types/interfaces.ts: ITaxEngine (calculateAnnualTax, estimateTax, getTaxScale, calculateInstallments) | Claude Code |
| 2026-02-09 | **Phase 3 implemented** — services/config/tax-config.ts: `GREEK_TAX_SCALES` (ReadonlyMap 2024/2025/2026), 5 brackets (9%/22%/28%/36%/44%), prepaymentRate 55%, professionalTax 650€, `getTaxScaleForYear()` with fallback. services/engines/tax-engine.ts: `TaxEngine implements ITaxEngine` — `calculateAnnualTax(params)` progressive bracket calculation, `estimateTax(fiscalYear)` async projection, `getTaxScale(year)`, `calculateInstallments(amount, year)` with 3 due dates (July/September/November) | Claude Code |
| 2026-02-09 | **Phase 4 implemented** — API: `GET /api/accounting/tax/estimate`. UI: `ReportsPageContent` (FiscalYearPicker + grid: VATReportCard + TaxEstimateCard + TaxDashboard), `VATReportCard` (annual VAT summary from useVATSummary), `TaxEstimateCard` (projected income/expenses/tax/effective rate from /api/accounting/tax/estimate), `TaxDashboard` (key figures grid + TaxBracketsVisual + InstallmentsCard), `TaxBracketsVisual` (5 Greek brackets 9%/22%/28%/36%/44% with colored progress bars), `InstallmentsCard` (3 installments: July/September/November with status badges) | Claude Code |
| 2026-02-10 | **OE Partnership Tax** — `calculatePartnershipTax()` added: pass-through taxation, per-partner progressive tax (ADR-ACC-012) | Claude Code |
| 2026-02-12 | **EPE Corporate Tax** — `calculateCorporateTax()` added: 22% flat, 5% dividends, 80% prepayment. Config: `getCorporateTaxRate()`, `getDividendTaxRate()` (ADR-ACC-014) | Claude Code |
| 2026-02-12 | **Generalization** — `calculateCorporateTax()` now accepts `entityType` parameter for reuse across EPE + AE. Backward compatible (default 'epe') | Claude Code |
| 2026-02-12 | **AE Tax** — `calculateAETax()` wrapper: maps shareholders → members, delegates to `calculateCorporateTax()`. `AETaxResult` + `ShareholderDividendResult` types (ADR-ACC-016) | Claude Code |
| 2026-02-12 | **Title updated**: "Income Tax + Prepayment" → "Income Tax + Corporate Tax" to reflect all entity types | Claude Code |
| 2026-10-14 | **Κλίμακα 2026 = ν.5246/2025** (9/20/26/34/39/44, νέο κλιμάκιο 40–60K)· το config είχε την κλίμακα 2024. **Πλάτος κλιμακίου** από το άνω όριο του προηγούμενου (το 1ο κάλυπτε 10.001 €). **`yearToDateProgress`** (SSoT αναγωγής σε έτος): ο `estimateTax` δεν αναγάγει πια κλεισμένη χρήση με την ημέρα-του-έτους της σημερινής ημερομηνίας· `getDayOfYear` ανεξάρτητο ζώνης ώρας. **`services/tax/entity-tax-profile.ts`**: SSoT φόρου εισοδήματος ανά νομική μορφή + `sumPaidEfka` (ήταν 9 αντίγραφα σε 4 αρχεία)· τα `calculatePartnershipTax / EPETax / AETax` του accounting-service φορτώνουν ΕΦΚΑ από εκεί. Οι αναφορές P&L / Σύνοψη Φόρων υπολογίζουν φόρο κατά **IAS 34** μέσω αυτού — βλ. ADR-ACC-010 §2.1.1 | Giorgio + Claude Code |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
