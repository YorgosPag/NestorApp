# ADR-ACC-004: VAT Engine — Μηχανή ΦΠΑ

| Metadata | Value |
|----------|-------|
| **Status** | DRAFT |
| **Date** | 2026-02-09 |
| **Category** | Accounting / VAT |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Parent** | [ADR-ACC-000](./ADR-ACC-000-founding-decision.md) |
| **Module** | M-005: VAT Engine |

---

## 1. Context

Ο Γιώργος ανήκει στο **κανονικό καθεστώς ΦΠΑ** και υποβάλλει **τριμηνιαία περιοδική δήλωση ΦΠΑ** (Φ2).

### Βασικά Δεδομένα

| Παράμετρος | Τιμή |
|-----------|-------|
| Καθεστώς ΦΠΑ | Κανονικό |
| Ενδοκοινοτικές | ΟΧΙ |
| Κύριος συντελεστής | 24% |
| Περίοδος δήλωσης | Τριμηνιαία (Q1-Q4) |
| Υποβολή | Μέχρι τέλος μήνα μετά το τρίμηνο |
| Πληρωμή | Ταυτόχρονα με υποβολή |

### Τι Πρέπει να Κάνει η Μηχανή

1. **Αυτόματος υπολογισμός ΦΠΑ** σε κάθε τιμολόγιο/δαπάνη
2. **Τριμηνιαία συγκέντρωση** εκροών (output) & εισροών (input)
3. **Υπολογισμός εκπιπτόμενου ΦΠΑ** ανά κατηγορία δαπάνης
4. **Πιστωτικό υπόλοιπο** — μεταφορά σε επόμενο τρίμηνο
5. **Ετήσια εκκαθαριστική** — σύνοψη χρήσης
6. **Προσυμπλήρωση Φ2** — αυτόματη δημιουργία δήλωσης

---

## 2. VAT Rates Configuration

### 2.1 Ισχύοντες Συντελεστές (2026)

| Συντελεστής | Ποσοστό | myDATA vatCategory | Εφαρμογή |
|-------------|---------|-------------------|----------|
| Κανονικός | 24% | 1 | Υπηρεσίες, αγαθά, τηλεφωνία, λογισμικό |
| Μειωμένος | 13% | 2 | Τρόφιμα, ξενοδοχεία, ύδρευση, μεταφορές |
| Υπερμειωμένος | 6% | 3 | ΔΕΗ, βιβλία, φάρμακα, εκπαίδευση |
| Εξαιρούμενο | 0% | 8 | Ενοίκια, ασφάλειες, τραπεζικές υπηρεσίες, ΕΦΚΑ |

### 2.2 TypeScript Config

```typescript
interface VATRate {
  code: string;           // 'standard', 'reduced', 'super_reduced', 'exempt'
  rate: number;           // 24, 13, 6, 0
  mydataCategory: number; // 1, 2, 3, 8
  label: string;          // Ελληνικό label
  validFrom: string;      // ISO date — πότε ισχύει
  validTo: string | null; // null = ισχύει ακόμα
}

const VAT_RATES: VATRate[] = [
  {
    code: 'standard',
    rate: 24,
    mydataCategory: 1,
    label: 'Κανονικός 24%',
    validFrom: '2016-06-01',
    validTo: null,
  },
  {
    code: 'reduced',
    rate: 13,
    mydataCategory: 2,
    label: 'Μειωμένος 13%',
    validFrom: '2016-06-01',
    validTo: null,
  },
  {
    code: 'super_reduced',
    rate: 6,
    mydataCategory: 3,
    label: 'Υπερμειωμένος 6%',
    validFrom: '2016-06-01',
    validTo: null,
  },
  {
    code: 'exempt',
    rate: 0,
    mydataCategory: 8,
    label: 'Εξαιρούμενο ΦΠΑ',
    validFrom: '2000-01-01',
    validTo: null,
  },
];
```

> **Config-driven**: Αν αλλάξουν οι συντελεστές, ενημερώνεται μόνο αυτό το config + νέα `validFrom` ημερομηνία. Οι παλιοί συντελεστές παραμένουν για ιστορικές εγγραφές.

---

## 3. VAT Deductibility per Category

### 3.1 Κανόνες Εκπεσιμότητας

| Κατηγορία Δαπάνης | Default ΦΠΑ Rate | Εκπίπτει; | Ποσοστό | Λόγος |
|-------------------|-----------------|-----------|---------|-------|
| `third_party_fees` | 24% | ✅ | 100% | Επαγγελματική δαπάνη |
| `rent` | 0% | ❌ | 0% | Εξαιρείται ΦΠΑ |
| `utilities` | 6%/13% | ✅ | 100% | Επαγγελματικός χώρος |
| `telecom` | 24% | ✅ | **50%** | Μικτή χρήση (επαγγ. + προσωπική) |
| `fuel` | 24% | ✅ | 100% | Αν αποκλειστικά επαγγελματικό |
| `vehicle_expenses` | 24% | ✅ | **50%** | Μικτή χρήση |
| `vehicle_insurance` | 0% | ❌ | 0% | Εξαιρείται ΦΠΑ |
| `office_supplies` | 24% | ✅ | 100% | Επαγγελματική δαπάνη |
| `software` | 24% | ✅ | 100% | Επαγγελματική δαπάνη |
| `equipment` | 24% | ✅ | 100% | Επαγγελματική δαπάνη |
| `travel` | 24%/13% | ✅ | 100% | Επαγγελματικό ταξίδι |
| `training` | 6% | ✅ | 100% | Επαγγελματική ανάπτυξη |
| `advertising` | 24% | ✅ | 100% | Επαγγελματική δαπάνη |
| `efka` | — | ❌ | — | Χωρίς ΦΠΑ |
| `professional_tax` | — | ❌ | — | Χωρίς ΦΠΑ |
| `bank_fees` | 0% | ❌ | 0% | Εξαιρούνται ΦΠΑ |
| `tee_fees` | — | ❌ | — | Χωρίς ΦΠΑ |
| `depreciation` | — | ❌ | — | Λογιστική εγγραφή |

### 3.2 Deductibility Config

```typescript
interface VATDeductibilityRule {
  category: ExpenseCategory;
  vatDeductible: boolean;
  deductiblePercent: number;    // 0, 50, 100
  reason: string;
  configurable: boolean;        // Μπορεί ο χρήστης να αλλάξει;
}

const VAT_DEDUCTIBILITY_RULES: VATDeductibilityRule[] = [
  { category: 'telecom', vatDeductible: true, deductiblePercent: 50,
    reason: 'Μικτή χρήση (50% επαγγελματική / 50% προσωπική)',
    configurable: true },
  { category: 'vehicle_expenses', vatDeductible: true, deductiblePercent: 50,
    reason: 'Μικτή χρήση οχήματος',
    configurable: true },
  { category: 'fuel', vatDeductible: true, deductiblePercent: 100,
    reason: 'Αποκλειστικά επαγγελματική χρήση',
    configurable: true },
  // ... υπόλοιπες κατηγορίες (100% ή 0% — non-configurable)
];
```

> **Configurable**: Ο χρήστης μπορεί να αλλάξει τα ποσοστά τηλεφωνίας/οχήματος/καυσίμων αν ισχύει διαφορετικός λόγος (π.χ. 100% αν το όχημα είναι αποκλειστικά επαγγελματικό).

---

## 4. VAT Calculation Engine

### 4.1 Core Interface

```typescript
interface IVATEngine {
  /** Υπολογισμός ΦΠΑ τιμολογίου (εκροές) */
  calculateOutputVat(
    netAmount: number,
    vatRate: number
  ): VATCalculation;

  /** Υπολογισμός εκπιπτόμενου ΦΠΑ δαπάνης (εισροές) */
  calculateInputVat(
    netAmount: number,
    vatRate: number,
    category: ExpenseCategory
  ): VATInputCalculation;

  /** Τριμηνιαία περίληψη */
  calculateQuarterSummary(
    companyId: string,
    year: number,
    quarter: 1 | 2 | 3 | 4
  ): Promise<VATQuarterSummary>;

  /** Ετήσια εκκαθαριστική */
  calculateAnnualSummary(
    companyId: string,
    year: number
  ): Promise<VATAnnualSummary>;

  /** Ισχύων συντελεστής ΦΠΑ (date-aware) */
  getVatRate(code: string, date: string): number;
}
```

### 4.2 Calculation Types

```typescript
/** Αποτέλεσμα υπολογισμού ΦΠΑ */
interface VATCalculation {
  netAmount: number;        // Καθαρή αξία
  vatRate: number;          // Συντελεστής (π.χ. 24)
  vatAmount: number;        // ΦΠΑ = net × rate/100
  grossAmount: number;      // Μικτό = net + vat
}

/** Αποτέλεσμα εκπιπτόμενου ΦΠΑ (εισροές) */
interface VATInputCalculation extends VATCalculation {
  deductiblePercent: number;    // 0, 50, 100
  deductibleVat: number;        // ΦΠΑ × deductiblePercent/100
  nonDeductibleVat: number;     // ΦΠΑ - deductibleVat
}
```

### 4.3 Formulas

```
ΕΚΡΟΕΣ (Output — από τιμολόγια):
  vatAmount = netAmount × (vatRate / 100)
  grossAmount = netAmount + vatAmount

ΕΙΣΡΟΕΣ (Input — από δαπάνες):
  vatAmount = netAmount × (vatRate / 100)
  deductibleVat = vatAmount × (deductiblePercent / 100)
  nonDeductibleVat = vatAmount - deductibleVat

ΤΡΙΜΗΝΙΑΙΟΣ ΥΠΟΛΟΓΙΣΜΟΣ:
  outputVatTotal = Σ(vatAmount) όλων εσόδων Q
  inputVatDeductible = Σ(deductibleVat) όλων εξόδων Q
  vatPayable = outputVatTotal - inputVatDeductible - carryForward

  Αν vatPayable > 0 → ΠΛΗΡΩΝΟΥΜΕ ΦΠΑ
  Αν vatPayable < 0 → ΠΙΣΤΩΤΙΚΟ (μεταφέρεται στο επόμενο Q)
```

---

## 5. Quarter Summary Structure

```typescript
interface VATQuarterSummary {
  // === Ταυτότητα ===
  periodId: string;             // "2026_Q1"
  companyId: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  status: 'open' | 'calculated' | 'submitted' | 'paid';

  // === Περίοδος ===
  periodStart: string;          // "2026-01-01"
  periodEnd: string;            // "2026-03-31"
  submissionDeadline: string;   // "2026-04-30"

  // === ΦΠΑ ΕΚΡΟΩΝ (Output — τιμολόγια) ===
  output: {
    totalNet: number;
    totalVat: number;
    byRate: VATRateBreakdown[];
    invoiceCount: number;
  };

  // === ΦΠΑ ΕΙΣΡΟΩΝ (Input — δαπάνες) ===
  input: {
    totalNet: number;
    totalVat: number;
    totalDeductible: number;
    totalNonDeductible: number;
    byRate: VATInputRateBreakdown[];
    expenseCount: number;
  };

  // === ΑΠΟΤΕΛΕΣΜΑ ===
  calculation: {
    outputVat: number;          // Σύνολο ΦΠΑ εκροών
    inputVatDeductible: number; // Εκπιπτόμενο ΦΠΑ εισροών
    rawBalance: number;         // output - input
    carryForwardIn: number;     // Πιστωτικό από προηγ. τρίμηνο
    vatPayable: number;         // Πληρωτέο ΦΠΑ (αν > 0)
    carryForwardOut: number;    // Πιστωτικό → επόμενο (αν < 0)
  };

  // === Meta ===
  calculatedAt: string | null;
  submittedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface VATRateBreakdown {
  vatRate: number;              // 24, 13, 6, 0
  mydataCategory: number;       // 1, 2, 3, 8
  netAmount: number;
  vatAmount: number;
  transactionCount: number;
}

interface VATInputRateBreakdown extends VATRateBreakdown {
  deductibleAmount: number;
  nonDeductibleAmount: number;
}
```

---

## 6. Annual Summary Structure

```typescript
interface VATAnnualSummary {
  year: number;
  companyId: string;
  status: 'open' | 'calculated' | 'submitted';

  // === 4 Τρίμηνα ===
  quarters: VATQuarterSummary[];

  // === Ετήσια Σύνολα ===
  annualTotals: {
    outputVat: number;            // Σύνολο ΦΠΑ εκροών
    inputVatDeductible: number;   // Σύνολο εκπιπτόμενου ΦΠΑ
    inputVatNonDeductible: number;
    totalPaid: number;            // Σύνολο πληρωμένου ΦΠΑ
    totalCarryForward: number;    // Τελικό πιστωτικό (αν υπάρχει)
  };

  // === Pro-rata (αν χρειάζεται) ===
  proRataPercent: number | null;  // null = 100% (δεν χρειάζεται)
  // Pro-rata χρησιμοποιείται μόνο αν έχουμε μικτές δραστηριότητες
  // (φορολογητέες + εξαιρούμενες) — δεν ισχύει για τον Γιώργο

  // === Εκκαθαριστική ===
  annualSettlement: {
    totalDue: number;             // Σύνολο οφειλής
    totalPaidInQuarters: number;  // Ήδη πληρώθηκε σε τρίμηνα
    remainingDue: number;         // Υπόλοιπο (due - paid)
  };
}
```

---

## 7. Φ2 Declaration (Περιοδική Δήλωση ΦΠΑ)

### 7.1 Κωδικοί Φ2

Η τριμηνιαία δήλωση ΦΠΑ (Φ2) έχει συγκεκριμένους κωδικούς:

| Κωδικός | Πεδίο | Πηγή |
|---------|-------|------|
| **301** | Φορολογητέα αξία εκροών (24%) | output.byRate[24].net |
| **302** | Φορολογητέα αξία εκροών (13%) | output.byRate[13].net |
| **303** | Φορολογητέα αξία εκροών (6%) | output.byRate[6].net |
| **331** | ΦΠΑ εκροών (24%) | output.byRate[24].vat |
| **332** | ΦΠΑ εκροών (13%) | output.byRate[13].vat |
| **333** | ΦΠΑ εκροών (6%) | output.byRate[6].vat |
| **361** | Φορολογητέα αξία εισροών (24%) | input.byRate[24].net |
| **362** | Φορολογητέα αξία εισροών (13%) | input.byRate[13].net |
| **363** | Φορολογητέα αξία εισροών (6%) | input.byRate[6].net |
| **371** | ΦΠΑ εκπιπτόμενο εισροών (24%) | input.byRate[24].deductible |
| **372** | ΦΠΑ εκπιπτόμενο εισροών (13%) | input.byRate[13].deductible |
| **373** | ΦΠΑ εκπιπτόμενο εισροών (6%) | input.byRate[6].deductible |
| **402** | Σύνολο ΦΠΑ εκροών | outputVat |
| **422** | Σύνολο εκπιπτόμενου ΦΠΑ | inputVatDeductible |
| **470** | Πιστωτικό υπόλοιπο προηγ. | carryForwardIn |
| **480** | ΦΠΑ για καταβολή | vatPayable (αν > 0) |
| **490** | Πιστωτικό υπόλοιπο | carryForwardOut (αν < 0) |

### 7.2 Auto-Fill Logic

```typescript
interface F2Declaration {
  year: number;
  quarter: 1 | 2 | 3 | 4;

  /** Αυτόματη προσυμπλήρωση από VATQuarterSummary */
  fields: Record<string, number>;
  // fields['301'] = output 24% net
  // fields['331'] = output 24% vat
  // ... κλπ.

  /** Export formats */
  exportToCsv(): string;       // Για manual upload στο TAXISnet
  exportToJson(): object;      // Για API (αν γίνει διαθέσιμο)
  generatePdf(): Promise<Blob>; // Για εκτύπωση/αρχείο
}
```

---

## 8. Deadlines & Reminders

### 8.1 Προθεσμίες

| Τρίμηνο | Περίοδος | Υποβολή Φ2 | Πληρωμή |
|---------|----------|-----------|---------|
| Q1 | Ιαν - Μαρ | **30 Απριλίου** | 30 Απριλίου |
| Q2 | Απρ - Ιουν | **31 Ιουλίου** | 31 Ιουλίου |
| Q3 | Ιουλ - Σεπ | **31 Οκτωβρίου** | 31 Οκτωβρίου |
| Q4 | Οκτ - Δεκ | **31 Ιανουαρίου (+1)** | 31 Ιανουαρίου (+1) |

### 8.2 Reminder System

```typescript
interface VATReminder {
  type: 'approaching' | 'due' | 'overdue';
  quarter: string;              // "Q1 2026"
  deadline: string;             // ISO date
  daysRemaining: number;        // Αρνητικό αν εκπρόθεσμο
  estimatedAmount: number;      // Εκτίμηση πληρωτέου ΦΠΑ
}

/** Reminder triggers */
const REMINDER_RULES = [
  { daysBeforeDeadline: 15, type: 'approaching' },  // 15 μέρες πριν
  { daysBeforeDeadline: 5, type: 'approaching' },   // 5 μέρες πριν
  { daysBeforeDeadline: 0, type: 'due' },            // Ημέρα υποβολής
  { daysAfterDeadline: 1, type: 'overdue' },         // Εκπρόθεσμο
];
```

---

## 9. Reverse Charge & Special Cases

### 9.1 Αντίστροφη Χρέωση (Reverse Charge)

Δεν ισχύει για τον Γιώργο (δεν κάνει ενδοκοινοτικές), αλλά η αρχιτεκτονική το προβλέπει:

```typescript
interface VATSpecialCase {
  code: 'reverse_charge' | 'intra_eu' | 'export' | 'exempt_activity';
  applies: boolean;           // false για τον Γιώργο
  description: string;
}
```

### 9.2 Pro-rata (Αναλογική Έκπτωση)

Δεν ισχύει αν **όλες** οι δραστηριότητες υπόκεινται σε ΦΠΑ (ισχύει για τον Γιώργο). Θα χρειαστεί μόνο αν προστεθούν εξαιρούμενες δραστηριότητες στο μέλλον.

---

## 10. Firestore Structure

```
accounting/{companyId}/
  ├── settings/
  │   └── vat                          ← VAT config (rates, deductibility overrides)
  │
  ├── vat_periods/
  │   ├── 2026_Q1                      ← Quarter summary
  │   ├── 2026_Q2
  │   ├── 2026_Q3
  │   └── 2026_Q4
  │
  └── vat_annual/
      └── 2026                         ← Annual summary + εκκαθαριστική

accounting/shared/
  └── vat_rates                        ← Rate config (date-aware)
```

### 10.1 Composite Indexes

```
vat_periods:
  - (year ASC, quarter ASC)            ← Χρονολογική σειρά
  - (status ASC, submissionDeadline ASC)  ← Εκκρεμείς δηλώσεις
```

---

## 11. UI Pages

| Route | Σελίδα | Λειτουργία |
|-------|--------|------------|
| `/accounting/vat` | Dashboard | Τρέχον τρίμηνο + ιστορικό |
| `/accounting/vat/{year}/Q{n}` | Τρίμηνο | Αναλυτική ανάλυση Q |
| `/accounting/vat/{year}/annual` | Ετήσια | Εκκαθαριστική |
| `/accounting/vat/settings` | Ρυθμίσεις | Ποσοστά εκπεσιμότητας |

### 11.1 Dashboard Mockup

```
┌─────────────────────────────────────────────────────────────┐
│  ΦΠΑ — Τρέχον Τρίμηνο: Q1 2026                            │
│  Υποβολή μέχρι: 30/04/2026 (σε 49 ημέρες)                 │
│─────────────────────────────────────────────────────────────│
│                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │  📤 ΕΚΡΟΕΣ   │ │  📥 ΕΙΣΡΟΕΣ  │ │  💰 ΠΛΗΡΩΤΕΟ │        │
│  │  ΦΠΑ: 3.000€ │ │  ΦΠΑ: 1.008€ │ │    1.992€    │        │
│  │  (12.500€)   │ │  (4.200€)    │ │              │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                             │
│  ΑΝΑΛΥΣΗ ΑΝΑ ΣΥΝΤΕΛΕΣΤΗ                                    │
│  ─────────────────────                                      │
│  24% │ Εκροές: 2.880€ │ Εισροές (εκπ.): 864€ │ = 2.016€   │
│  13% │ Εκροές:     0€ │ Εισροές (εκπ.):  26€ │ =   -26€   │
│   6% │ Εκροές:     0€ │ Εισροές (εκπ.):  18€ │ =   -18€   │
│   0% │ Εκροές:   120€ │ Εισροές:          0€ │ =     0€   │
│  ──────────────────────────────────────────────             │
│  Πιστωτικό Q4 2025:                        0€              │
│  ΤΕΛΙΚΟ ΠΛΗΡΩΤΕΟ:                      1.972€              │
│                                                             │
│  [📋 Δες Φ2]  [📤 Export CSV]  [📄 PDF]                    │
│                                                             │
│  ΙΣΤΟΡΙΚΟ ΤΡΙΜΗΝΩΝ                                         │
│  ─────────────────                                          │
│  Q4 2025 │ ✅ Submitted │ 1.450,00€ │ Paid 28/01/2026      │
│  Q3 2025 │ ✅ Submitted │ 2.100,00€ │ Paid 30/10/2025      │
│  Q2 2025 │ ✅ Submitted │ 1.800,00€ │ Paid 31/07/2025      │
│  Q1 2025 │ ✅ Submitted │   950,00€ │ Paid 30/04/2025      │
└─────────────────────────────────────────────────────────────┘
```

---

## 12. Edge Cases

### 12.1 Πιστωτικό Υπόλοιπο

Αν σε ένα τρίμηνο τα έξοδα > έσοδα (σπάνιο):

```
Q1: output=1.000€, input=1.500€ → payable = -500€
    carryForwardOut = 500€ (μεταφέρεται σε Q2)

Q2: output=2.000€, input=800€ → raw = 1.200€
    carryForwardIn = 500€ (από Q1)
    payable = 1.200€ - 500€ = 700€
```

### 12.2 Πιστωτικό Τιμολόγιο

Πιστωτικό (5.1) μειώνει τις εκροές:

```
output -= creditNote.vatAmount
// ΔΕΝ πηγαίνει στις εισροές — αφαιρείται από εκροές
```

### 12.3 Αλλαγή Συντελεστή Mid-quarter

Αν αλλάξει ο συντελεστής μέσα στο τρίμηνο (σπάνιο):
- Date-aware lookup: `getVatRate(code, date)`
- Κάθε εγγραφή χρησιμοποιεί τον rate της ημερομηνίας της
- Η ανάλυση ανά rate τα κρατάει ξεχωριστά

### 12.4 Εκπρόθεσμη Υποβολή

```
Πρόσθετο τέλος: 0,73% ανά μήνα (max 100%)
Πρόστιμο: 100€ (αν δεν υποβληθεί)
```

Η εφαρμογή **δεν υπολογίζει** πρόστιμα — μόνο **ειδοποιεί** για πλησίον/εκπρόθεσμες.

---

## 13. Dependencies

| Module | Σχέση | Περιγραφή |
|--------|-------|-----------|
| **ACC-001** (Chart of Accounts) | **READS** | Κατηγορίες δαπανών + deductibility rules |
| **M-002** (Income/Expense) | **READS** | Journal entries (vatAmount per entry) |
| **M-003** (Invoicing) | **READS** | Εκροές — τιμολόγια |
| **M-004** (myDATA) | **FEEDS** | VAT categories per document |
| **M-010** (Reports) | **FEEDS** | Φ2 report generation |

---

## 14. Open Questions

| # | Ερώτηση | Status |
|---|---------|--------|
| 1 | Αυτόματη υποβολή Φ2 μέσω TAXISnet API; Ή μόνο export CSV; | DEFAULT: Export CSV |
| 2 | Πληρωμή ΦΠΑ: Καταγραφή ημερομηνίας πληρωμής ή auto-detect; | DEFAULT: Manual |

---

## 15. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-02-09 | ADR Created — VAT Engine | Γιώργος + Claude Code |
| 2026-02-09 | Τριμηνιαία δήλωση (Φ2) — auto-fill κωδικών | Claude Code |
| 2026-02-09 | Config-driven VAT rates (date-aware, ιστορικά preserved) | Claude Code |
| 2026-02-09 | VAT deductibility per expense category (configurable) | Claude Code |
| 2026-02-09 | Πιστωτικό υπόλοιπο: auto carry-forward μεταξύ τριμήνων | Claude Code |
| 2026-02-09 | Reminders: 15d, 5d πριν + due day + overdue | Claude Code |
| 2026-02-09 | Pro-rata: Δεν ισχύει (μόνο φορολογητέες δραστηριότητες) | Claude Code |
| 2026-02-09 | **Phase 2 implemented** — types/vat.ts: VATRate, VATDeductibilityRule, VATCalculation, VATInputCalculation, VATRateBreakdown, VATInputRateBreakdown, VATQuarterStatus, VATQuarterSummary, VATAnnualSummary. types/interfaces.ts: IVATEngine (calculateOutputVat, calculateInputVat, getDeductibilityRule, calculateQuarterSummary, calculateAnnualSummary) | Claude Code |
| 2026-02-09 | **Phase 3 implemented** — services/config/vat-config.ts: `GREEK_VAT_RATES` (4 rates with validFrom/validTo), `getVatDeductibilityRules()` (builds Map from ACCOUNT_CATEGORIES), `getVatRateForDate()`, `getMyDataVatCategory()`. services/engines/vat-engine.ts: `VATEngine implements IVATEngine` — `calculateOutputVat()` (pure), `calculateInputVat()` (pure, deductibility-aware), `getDeductibilityRule()`, `calculateQuarterSummary()` (async, fetches journal entries), `calculateAnnualSummary()` (async, aggregates 4 quarters). Uses `roundToTwoDecimals()` for financial precision | Claude Code |
| 2026-02-09 | **Phase 4 implemented** — API: `GET /api/accounting/vat/summary` (quarter/annual). Hook: `useVATSummary(fiscalYear, quarter?)`. UI: `VATPageContent` (FiscalYearPicker + 3 sections), `VATQuarterCards` (4 quarter cards with status badges: open/calculated/submitted/paid), `VATSummaryCard` (annual output/input/payable/credit with color-coding), `VATDeductibilityTable` (deductibility rules from vat-config + account-categories) | Claude Code |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
