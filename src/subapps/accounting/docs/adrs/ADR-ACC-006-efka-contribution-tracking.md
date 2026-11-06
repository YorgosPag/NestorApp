# ADR-ACC-006: EFKA Contribution Tracking — Παρακολούθηση Εισφορών ΕΦΚΑ

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-09 |
| **Category** | Accounting / Social Insurance |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Parent** | [ADR-ACC-000](./ADR-ACC-000-founding-decision.md) |
| **Module** | M-007: EFKA Tracker |

---

## 1. Context

Ο Γιώργος ως ελεύθερος επαγγελματίας μηχανικός είναι υποχρεωτικά ασφαλισμένος στον **ΕΦΚΑ** (πρώην ΤΣΜΕΔΕ/ΤΕΕ). Πληρώνει μηνιαία εισφορά **330,37€** (1η κατηγορία σε όλους τους κλάδους).

### Πρόβλημα

- Οι εισφορές πρέπει να πληρώνονται **κάθε μήνα** — ληξιπρόθεσμες → πρόσθετα τέλη → ΚΕΑΟ
- Η κατηγορία επιλέγεται **μέχρι 31/1** κάθε έτους — δεσμευτική για όλο το έτος
- Οι εισφορές αλλάζουν **ετησίως** (~2,5% αύξηση)
- Καταγράφονται ως **έξοδο** στο Βιβλίο Ε-Ε (κατηγορία `efka`, myDATA `category2_12`)
- Χρειάζεται **παρακολούθηση πληρωμών** + **reminders** + **ετήσια σύνοψη**

### Στοιχεία Γιώργου (από ΕΦΚΑ ειδοποιητήριο 12/2025)

| Παράμετρος | Τιμή |
|-----------|-------|
| Ασφαλιστικός φορέας | ΕΦΚΑ (πρώην ΤΣΜΕΔΕ) |
| Κατηγορία Κύριας | **1η** (ελάχιστη) |
| Κατηγορία Επικουρικής | **1η** |
| Κατηγορία Εφάπαξ | **1η** |
| Μηνιαία εισφορά | **330,37€** |
| Ετήσιο σύνολο | **3.964,44€** |

---

## 2. Contribution Breakdown

### 2.1 Ανάλυση Κλάδων (1η Κατηγορία — 2025/2026)

| Κλάδος | Μηνιαία 2025 | Μηνιαία 2026 (+2,5%) | Σκοπός |
|--------|-------------|---------------------|--------|
| Κλάδος Σύνταξης | 180,58€ | 185,09€ | Κύρια σύνταξη |
| Κλάδος Υγείας (σε Είδος) | 58,25€ | 59,71€ | Ιατροφαρμακευτική |
| Κλάδος Υγείας (σε Χρήμα) | 5,82€ | 5,97€ | Παροχές σε χρήμα |
| ΟΑΕΔ | 10,00€ | 10,25€ | Ανεργία |
| Επικουρική Ασφάλιση | 45,43€ | 46,57€ | Επικουρική σύνταξη |
| Εφάπαξ Παροχή | 30,29€ | 31,05€ | Εφάπαξ |
| **ΣΥΝΟΛΟ** | **330,37€** | **338,64€** | |

> **Σημείωση**: Τα ποσά 2026 είναι εκτιμώμενα (+2,5%). Τα πραγματικά ποσά θα ενημερωθούν από ειδοποιητήριο ΕΦΚΑ.

### 2.2 Όλες οι Κατηγορίες (Config)

#### Κύρια Ασφάλιση (6 κατηγορίες)

| Κατηγορία | Μηνιαία 2025 | Μηνιαία 2026 (εκτ.) | Ετήσιο 2026 (εκτ.) |
|-----------|-------------|---------------------|---------------------|
| **1η** ← Γιώργος | 254,65€ | 261,01€ | 3.132,12€ |
| 2η | 303,64€ | 311,23€ | 3.734,76€ |
| 3η | 361,94€ | 370,99€ | 4.451,88€ |
| 4η | 432,97€ | 443,80€ | 5.325,60€ |
| 5η | 516,79€ | 529,71€ | 6.356,52€ |
| 6η | 669,46€ | 686,20€ | 8.234,40€ |

#### Επικουρική Ασφάλιση (3 κατηγορίες)

| Κατηγορία | Μηνιαία 2025 | Μηνιαία 2026 (εκτ.) |
|-----------|-------------|---------------------|
| **1η** ← Γιώργος | 45,43€ | 46,57€ |
| 2η | 54,79€ | 56,16€ |
| 3η | 65,28€ | 66,91€ |

#### Εφάπαξ Παροχή (3 κατηγορίες)

| Κατηγορία | Μηνιαία 2025 | Μηνιαία 2026 (εκτ.) |
|-----------|-------------|---------------------|
| **1η** ← Γιώργος | 30,29€ | 31,05€ |
| 2η | 36,13€ | 37,03€ |
| 3η | 43,12€ | 44,20€ |

---

## 3. TypeScript Configuration

### 3.1 Rate Config (Config-driven, ετήσια ενημέρωση)

```typescript
interface EFKAYearConfig {
  year: number;
  annualIncrease: number;           // π.χ. 0.025 (2,5%)
  validFrom: string;                // "2026-01-01"

  mainCategories: EFKACategoryRate[];     // 6 κατηγορίες
  supplementaryCategories: EFKACategoryRate[];  // 3 κατηγορίες
  lumpSumCategories: EFKACategoryRate[];        // 3 κατηγορίες

  /** Σταθερά κλάδων (Υγεία, ΟΑΕΔ) — κοινά σε όλες τις κατηγορίες */
  fixedBranches: {
    healthInKind: number;           // 58,25€ (2025)
    healthInCash: number;           // 5,82€
    unemployment: number;           // 10,00€
  };
}

interface EFKACategoryRate {
  category: number;                 // 1, 2, 3, (4, 5, 6 μόνο κύρια)
  monthlyAmount: number;
  annualAmount: number;
}
```

### 3.2 User Config

```typescript
interface EFKAUserConfig {
  companyId: string;
  selectedCategories: {
    main: 1 | 2 | 3 | 4 | 5 | 6;
    supplementary: 1 | 2 | 3;
    lumpSum: 1 | 2 | 3;
  };
  paymentReferenceCode: string;     // RF κωδικός (μοναδικός ανά ασφαλισμένο)
  selectionDeadline: string;        // "2026-01-31"
  startDate: string;                // Ημ/νία έναρξης ασφάλισης
}
```

### 3.3 Monthly Breakdown Calculator

```typescript
interface EFKAMonthlyBreakdown {
  month: number;                    // 1-12
  year: number;

  /** Ανάλυση ανά κλάδο */
  branches: {
    pension: number;                // Σύνταξη (από main category)
    healthInKind: number;           // Υγεία Είδος (σταθερό)
    healthInCash: number;           // Υγεία Χρήμα (σταθερό)
    unemployment: number;           // ΟΑΕΔ (σταθερό)
    supplementary: number;          // Επικουρική (από supplementary category)
    lumpSum: number;                // Εφάπαξ (από lumpSum category)
  };

  /** Σύνολα */
  mainTotal: number;                // pension + health + oaed
  supplementaryTotal: number;
  lumpSumTotal: number;
  grandTotal: number;               // mainTotal + supplementary + lumpSum

  /** Πληρωμή */
  deadline: string;                 // Τέλος μήνα (π.χ. "2026-01-31")
  status: 'upcoming' | 'due' | 'paid' | 'overdue' | 'keao';
}
```

---

## 4. Payment Tracking

### 4.1 Payment Record

```typescript
interface EFKAPayment {
  paymentId: string;                // Auto-generated
  companyId: string;

  /** Περίοδος */
  year: number;
  month: number;                    // 1-12 (μήνας αναφοράς)

  /** Ποσά */
  expectedAmount: number;           // Αναμενόμενη εισφορά
  paidAmount: number;               // Πληρωθέν ποσό
  lateFee: number;                  // Πρόσθετα τέλη (αν ληξιπρόθεσμο)
  totalPaid: number;                // paidAmount + lateFee

  /** Πληρωμή */
  paymentDate: string | null;       // Ημ/νία πληρωμής
  paymentMethod: 'bank_transfer' | 'web_banking' | 'elta' | 'manual';
  paymentReference: string | null;  // RF κωδικός ή reference
  deadline: string;                 // Προθεσμία (τέλος μήνα)

  /** Status */
  status: 'upcoming' | 'due' | 'paid' | 'overdue' | 'keao';
  // upcoming: Ο μήνας δεν έχει φτάσει ακόμα
  // due: Εντός μήνα πληρωμής
  // paid: Πληρώθηκε
  // overdue: Ληξιπρόθεσμο (δεν πληρώθηκε εγκαίρως)
  // keao: Βεβαιώθηκε στο ΚΕΑΟ (~40 ημέρες μετά)

  /** Σύνδεση */
  journalEntryId: string | null;    // → journal_entries (Βιβλίο Ε-Ε)
  bankTransactionId: string | null; // → bank reconciliation

  /** Meta */
  createdAt: string;
  updatedAt: string;
}
```

### 4.2 Status Transitions

```
upcoming → due           (1η μέρα μήνα πληρωμής)
due → paid               (καταχώρηση πληρωμής)
due → overdue            (μετά deadline χωρίς πληρωμή)
overdue → paid           (πληρωμή + πρόσθετα τέλη)
overdue → keao           (~40 ημέρες — βεβαίωση ΚΕΑΟ)
keao → paid              (εξόφληση μέσω ΚΕΑΟ)
```

### 4.3 Late Fees Calculation

```typescript
function calculateLateFee(
  expectedAmount: number,
  deadlineDate: string,
  paymentDate: string
): number {
  const daysOverdue = daysBetween(deadlineDate, paymentDate);
  if (daysOverdue <= 0) return 0;

  // Πρόσθετο τέλος: 0,73% ανά μήνα καθυστέρησης
  const monthsOverdue = Math.ceil(daysOverdue / 30);
  const feeRate = 0.0073;  // 0,73% ανά μήνα
  const lateFee = expectedAmount * feeRate * monthsOverdue;

  return Math.round(lateFee * 100) / 100;  // Στρογγυλοποίηση 2 δεκαδικά
}
```

---

## 5. Reminders & Notifications

### 5.1 Reminder Rules

| Trigger | Ημέρες | Τύπος | Μήνυμα |
|---------|--------|-------|--------|
| Πλησιάζει πληρωμή | 10 πριν | `approaching` | "ΕΦΚΑ [μήνας]: 330,37€ — πληρωμή μέχρι [deadline]" |
| Ημέρα πληρωμής | 0 | `due` | "ΕΦΚΑ [μήνας]: Σήμερα λήγει η προθεσμία!" |
| Ληξιπρόθεσμο | +3 μέρες | `overdue` | "⚠️ ΕΦΚΑ [μήνας]: Ληξιπρόθεσμο! Πρόσθετα τέλη ξεκινούν" |
| ΚΕΑΟ κίνδυνος | +30 μέρες | `critical` | "🚨 ΕΦΚΑ [μήνας]: Σε ~10 ημέρες βεβαίωση ΚΕΑΟ!" |
| Επιλογή κατηγορίας | 15 Ιαν | `category` | "Μέχρι 31/1: Επιλογή ασφαλιστικής κατηγορίας" |

### 5.2 Notification Channels

```typescript
interface EFKANotification {
  type: 'approaching' | 'due' | 'overdue' | 'critical' | 'category';
  month: number;
  year: number;
  amount: number;
  deadline: string;
  daysRemaining: number;          // Αρνητικό αν εκπρόθεσμο

  /** Delivery */
  channels: Array<'app' | 'telegram' | 'email'>;
  // Telegram: Μέσω admin bot (ADR-145)
  // App: In-app notification
  // Email: Μελλοντικό
}
```

---

## 6. Annual Summary

### 6.1 Ετήσια Σύνοψη

```typescript
interface EFKAAnnualSummary {
  year: number;
  companyId: string;

  /** Επιλεγμένες κατηγορίες */
  selectedCategories: {
    main: number;
    supplementary: number;
    lumpSum: number;
  };

  /** 12 μήνες */
  months: EFKAPayment[];

  /** Σύνολα */
  totals: {
    expectedTotal: number;        // 12 × μηνιαία εισφορά
    paidTotal: number;            // Σύνολο πληρωμών
    lateFeesTotal: number;        // Σύνολο πρόσθετων τελών
    remainingDue: number;         // Υπόλοιπο (αν δεν πληρώθηκαν όλοι)
    paidMonths: number;           // Πόσοι μήνες πληρώθηκαν
    overdueMonths: number;        // Ληξιπρόθεσμοι μήνες
  };

  /** Φορολογική χρήση */
  taxDeductibleAmount: number;    // = paidTotal (εκπίπτει 100%)
  // Εισφορές ΕΦΚΑ εκπίπτουν πλήρως από φόρο εισοδήματος

  /** Σύγκριση με προηγούμενο έτος */
  previousYearTotal: number | null;
  yearOverYearChange: number | null;  // ποσοστό αλλαγής
}
```

### 6.2 Φορολογική Σημασία

Οι εισφορές ΕΦΚΑ:
- **Εκπίπτουν 100%** από τα ακαθάριστα έσοδα
- Καταχωρούνται στο **Ε3 κωδικό `585_005`** (Ασφαλιστικές εισφορές)
- myDATA χαρακτηρισμός: **`category2_12`** (Λοιπές εκπιπτόμενες δαπάνες)
- Κάθε πληρωμή → αυτόματη εγγραφή στο Βιβλίο Ε-Ε

---

## 7. Auto-Booking Integration

### 7.1 ΕΦΚΑ → Journal Entry

Κάθε πληρωμή ΕΦΚΑ δημιουργεί αυτόματα εγγραφή:

```typescript
function createEFKAJournalEntry(payment: EFKAPayment): JournalEntry {
  return {
    type: 'expense',
    date: payment.paymentDate,
    description: `Εισφορά ΕΦΚΑ ${monthName(payment.month)} ${payment.year}`,
    category: 'efka',
    mydataCode: 'category2_12',
    e3Code: '585_005',
    netAmount: payment.paidAmount,
    vatRate: 0,
    vatAmount: 0,
    totalAmount: payment.paidAmount,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    vatDeductibleAmount: 0,
    sourceType: 'efka',
    sourceId: payment.paymentId,
    counterpartyName: 'ΕΦΚΑ',
    counterpartyVat: null,
    // ...
  };
}
```

### 7.2 Πρόσθετα Τέλη

Αν υπάρχουν πρόσθετα τέλη, δημιουργούνται **2 εγγραφές**:
1. Κανονική εισφορά → `efka` (category2_12 / 585_005)
2. Πρόσθετα τέλη → `other_expense` (category2_14 / 585_016)

---

## 8. ΕΦΚΑ Document AI Integration

### 8.1 Αυτόματη Αναγνώριση Ειδοποιητηρίου

Μέσω του Expense Tracker (ACC-005):

```
[1] Upload ΕΦΚΑ PDF ειδοποιητήριο
    ↓
[2] AI Classification → efka_notice (confidence: 99%)
    ↓
[3] AI Extraction:
    - Μήνας αναφοράς: 12/2025
    - Ποσό: 330,37€
    - Ανάλυση κλάδων: [180.58, 58.25, 5.82, 10.00, 45.43, 30.29]
    - Προθεσμία: 31/01/2026
    - Πρόσθετα τέλη: 0,00€ (ή ποσό αν ληξιπρόθεσμο)
    ↓
[4] Auto-match: Βρες αντίστοιχο EFKAPayment record
    ↓
[5] Update payment status + amounts
```

### 8.2 Telegram Quick Entry

```
Admin: "Πλήρωσα ΕΦΚΑ Ιανουαρίου"
  ↓
Bot: "✅ Καταχωρήθηκε πληρωμή ΕΦΚΑ 01/2026: 338,64€
      Εγγραφή στο Βιβλίο Ε-Ε: ✅
      Υπόλοιπο έτους: 11 μήνες (3.725,04€)"
```

---

## 9. Firestore Structure

```
accounting/{companyId}/
  ├── settings/
  │   └── efka                         ← User config (κατηγορίες, RF code)
  │
  ├── efka_payments/{year}_{month}     ← Πληρωμές (1 doc ανά μήνα)
  │
  ├── efka_annual/{year}               ← Ετήσια σύνοψη
  │
  └── efka_reminders/{reminderId}      ← Scheduled reminders

accounting/shared/
  └── efka_rates/
      ├── 2025                         ← Rates 2025
      └── 2026                         ← Rates 2026
```

### 9.1 Composite Indexes

```
efka_payments:
  - (year ASC, month ASC)              ← Χρονολογική σειρά
  - (status ASC, deadline ASC)         ← Ληξιπρόθεσμα πρώτα
```

---

## 10. UI Pages

| Route | Σελίδα | Λειτουργία |
|-------|--------|------------|
| `/accounting/efka` | Dashboard | Τρέχων μήνας + ετήσια overview |
| `/accounting/efka/{year}` | Ετήσια Ανάλυση | 12 μήνες + σύνολα |
| `/accounting/efka/settings` | Ρυθμίσεις | Κατηγορίες, RF code |

### 10.1 Dashboard Mockup

```
┌─────────────────────────────────────────────────────────────┐
│  ΕΦΚΑ — Εισφορές 2026                                      │
│  Κατηγορία: 1η (Κύρια + Επικουρική + Εφάπαξ)              │
│  Μηνιαία εισφορά: 338,64€                                  │
│─────────────────────────────────────────────────────────────│
│                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ ✅ Πληρωμένοι │ │ ⏳ Τρέχων    │ │ 📅 Υπόλοιπο  │        │
│  │   1 / 12     │ │ Φεβ 2026    │ │  11 μήνες    │        │
│  │   338,64€    │ │ 338,64€ due │ │  3.725,04€   │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                             │
│  ΜΗΝΙΑΙΑ ΚΑΤΑΣΤΑΣΗ                                         │
│  ────────────────                                           │
│  Ιαν │ ✅ Paid    │ 338,64€ │ 28/01/2026                   │
│  Φεβ │ ⏳ Due     │ 338,64€ │ Deadline: 28/02/2026         │
│  Μαρ │ 📅 Upcoming│ 338,64€ │ Deadline: 31/03/2026         │
│  Απρ │ 📅 Upcoming│ 338,64€ │ Deadline: 30/04/2026         │
│  ... │            │         │                               │
│                                                             │
│  ΑΝΑΛΥΣΗ ΚΛΑΔΩΝ (Φεβρουάριος)                              │
│  ──────────────────────────                                 │
│  ├─ Σύνταξη:           185,09€                              │
│  ├─ Υγεία (Είδος):     59,71€                              │
│  ├─ Υγεία (Χρήμα):      5,97€                              │
│  ├─ ΟΑΕΔ:               10,25€                              │
│  ├─ Επικουρική:         46,57€                              │
│  └─ Εφάπαξ:             31,05€                              │
│                                                             │
│  [📝 Καταχώρηση Πληρωμής]  [📄 Ειδοποιητήρια]              │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Category Selection Workflow

### 11.1 Ετήσια Επιλογή (μέχρι 31/1)

```
[1] Δεκέμβριος: Reminder "Επιλογή κατηγορίας μέχρι 31/1"
    ↓
[2] UI: Σύγκριση κατηγοριών
    ┌──────────────────────────────────────────────┐
    │ Σύγκριση Κατηγοριών 2027                    │
    │──────────────────────────────────────────────│
    │ Κατ. │ Κύρια    │ Επικ.  │ Εφάπαξ │ Σύνολο │
    │  1η  │ 267,54€  │ 47,73€ │ 31,83€ │ 347,10€│ ← Τρέχουσα
    │  2η  │ 319,01€  │ 57,57€ │ 37,96€ │ 414,54€│
    │  3η  │ 380,26€  │ 68,58€ │ 45,31€ │ 494,15€│
    │  4η  │ 454,90€  │   —    │   —    │ 454,90€│
    │  5η  │ 542,95€  │   —    │   —    │ 542,95€│
    │  6η  │ 703,36€  │   —    │   —    │ 703,36€│
    │──────────────────────────────────────────────│
    │ [Διατήρηση 1η]  [Αλλαγή σε ...]             │
    └──────────────────────────────────────────────┘
    ↓
[3] Χρήστης επιβεβαιώνει → αποθήκευση νέας κατηγορίας
    ↓
[4] Auto-recalculate μηνιαίες εισφορές 2027
```

---

## 11A. ΕΦΚΑ per Entity Type — Added 2026-02-12

### 11A.1 Overview

Η αρχική τεκμηρίωση αφορούσε μόνο ατομική επιχείρηση. Τώρα υποστηρίζονται **4 entity types** με διαφορετική ΕΦΚΑ λογική:

| Entity Type | ΕΦΚΑ Λογική | Ασφαλισμένοι | ADR |
|-------------|-------------|--------------|-----|
| **Ατομική** | 1 ασφαλισμένος, κατηγορίες 1-6 | Ιδιοκτήτης | ACC-006 (αυτό) |
| **ΟΕ** | Per-partner ΕΦΚΑ, κατηγορίες 1-6 | Κάθε εταίρος | ACC-012 |
| **ΕΠΕ** | Μόνο managers (αυτοαπασχολούμενοι) | Διαχειριστές | ACC-014 |
| **ΑΕ** | **Dual-mode** βάσει μετοχών | Μέλη ΔΣ με αμοιβή | ACC-017 |

### 11A.2 ΟΕ — Per-Partner ΕΦΚΑ (ADR-ACC-012)

- Κάθε εταίρος (Partner) πληρώνει **δικό του** ΕΦΚΑ
- Ίδιες 6+3+3 κατηγορίες με ατομική
- `PartnerEFKAConfig`: mainCategory, supplementaryCategory, lumpSumCategory
- `partnerId` field added to `EFKAPayment` (nullable — null = sole proprietor)
- `PartnershipEFKASummary`: per-partner + grand totals
- UI: `PartnerEFKATabs` — ένα tab ανά εταίρο

### 11A.3 ΕΠΕ — Manager ΕΦΚΑ (ADR-ACC-014)

- **Μόνο διαχειριστές** (isManager = true) πληρώνουν ΕΦΚΑ
- Ίδιες κατηγορίες αυτοαπασχολούμενων (κατηγορίες 1-6)
- `MemberEFKAConfig`: Ίδια δομή με PartnerEFKAConfig
- `ManagerEFKASummary`: per-manager breakdown
- `EPEEFKASummary`: managers-only totals
- Service: `getEPEEfkaSummary(year)` — filters isManager=true

### 11A.4 ΑΕ — Dual-Mode ΕΦΚΑ (ADR-ACC-017)

**Κρίσιμη διαφορά**: Η κατηγοριοποίηση εξαρτάται από ποσοστό μετοχών.

| Ιδιότητα | Αμοιβή | Μετοχές | ΕΦΚΑ Mode | Κατηγορία |
|---|---|---|---|---|
| Μέλος ΔΣ | ΝΑΙ | <3% | **employee** | Μισθωτός (33,60%) |
| Μέλος ΔΣ | ΝΑΙ | ≥3% | **self_employed** | Αυτοαπασχολούμενος |
| Μέλος ΔΣ | ΟΧΙ | — | **none** | — |
| Μέτοχος (μόνο) | — | — | **none** | — |

**Employee mode**: 33,60% επί μηνιαίας αμοιβής (12,47% ασφαλισμένος + 21,13% εργοδότης)
**Self-employed mode**: Κατηγορίες ΕΦΚΑ (reuse ManagerEFKASummary)

```typescript
type ShareholderEFKAMode = 'employee' | 'self_employed' | 'none';

// Auto-derived — NOT user-set
function deriveEfkaMode(shareholder, totalShares): ShareholderEFKAMode {
  if (!isBoardMember || !compensation || compensation <= 0) return 'none';
  const percent = (sharesCount / totalShares) * 100;
  return percent < 3 ? 'employee' : 'self_employed';
}
```

**Types**: `EmployeeBoardMemberEFKA`, `AEEFKASummary`
**Service**: `getAEEfkaSummary(year)` — splits employee + self-employed board members
**Legal**: Εγκύκλιοι ΕΦΚΑ 4/2017, 17/2017

---

## 12. Dependencies

| Module | Σχέση | Περιγραφή |
|--------|-------|-----------|
| **M-001** (Company Setup) | **BLOCKED BY** | Χρειάζεται ΑΜΚΑ, ασφαλιστικά στοιχεία |
| **M-002** (Income/Expense) | **FEEDS** | Κάθε πληρωμή → journal entry |
| **ACC-001** (Chart of Accounts) | **READS** | Κατηγορία `efka`, myDATA/E3 codes |
| **ACC-005** (AI Document) | **READS** | Αναγνώριση ΕΦΚΑ ειδοποιητηρίων |
| **M-009** (Bank Reconciliation) | **LINKS** | Πληρωμή → τραπεζική κίνηση |
| **ADR-145** (Admin Bot) | **TRIGGERS** | Telegram reminders + quick entry |
| **M-010** (Reports) | **FEEDS** | Ετήσια ΕΦΚΑ σύνοψη |

---

## 13. Open Questions

| # | Ερώτηση | Status |
|---|---------|--------|
| 1 | RF κωδικός Γιώργου — χρειάζεται για auto-fill πληρωμής | PENDING (ευαίσθητο δεδομένο) |
| 2 | Ειδοποιήσεις: Push notification ή μόνο Telegram; | DEFAULT: Telegram + in-app |
| 3 | Ιστορικά δεδομένα: Import πληρωμών 2025 ή μόνο 2026+; | DEFAULT: 2026+ (fresh start) |

---

## 14. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-02-09 | ADR Created — EFKA Contribution Tracking | Γιώργος + Claude Code |
| 2026-02-09 | Config-driven rates (ετήσια ενημέρωση, +2,5% default) | Claude Code |
| 2026-02-09 | 6-branch breakdown (σύνταξη, υγεία×2, ΟΑΕΔ, επικ., εφάπαξ) | Claude Code |
| 2026-02-09 | Late fee: 0,73%/μήνα — auto-calculate | Claude Code |
| 2026-02-09 | ΚΕΑΟ status (~40 μέρες μετά overdue) | Claude Code |
| 2026-02-09 | Auto-booking: πληρωμή → journal entry (efka, category2_12) | Claude Code |
| 2026-02-09 | Reminders: 10d πριν, due day, +3d overdue, +30d ΚΕΑΟ | Claude Code |
| 2026-02-09 | Category selection UI: σύγκριση κατηγοριών + deadline 31/1 | Claude Code |
| 2026-02-09 | AI integration: αναγνώριση ΕΦΚΑ ειδοποιητηρίου (ACC-005) | Claude Code |
| 2026-02-09 | Telegram quick entry: "Πλήρωσα ΕΦΚΑ [μήνα]" | Claude Code |
| 2026-02-09 | **Phase 2 implemented** — types/efka.ts: EFKACategoryRate, EFKAYearConfig (6+3+3 κατηγορίες), EFKAUserConfig, EFKAMonthlyBreakdown (6 κλάδοι), EFKAPaymentStatus (5 states incl. keao), EFKAPayment, EFKAAnnualSummary, EFKANotification. types/interfaces.ts: IAccountingRepository with getEFKAPayments, updateEFKAPayment, get/saveEFKAUserConfig | Claude Code |
| 2026-02-09 | **Phase 3 implemented** — services/config/efka-config.ts: `EFKA_YEAR_CONFIGS` (ReadonlyMap 2025+2026), 6 main pension categories (185.09–703.69€/mo), 3 supplementary (46.57–68.62€/mo), 3 lump sum (31.05–45.33€/mo). Helpers: `getEfkaConfigForYear()`, `calculateMonthlyBreakdown(year, mainCode, suppCode, lumpCode)`, `calculateAnnualTotal()`. services/repository: `getEFKAPayments(year)`, `updateEFKAPayment()`, `getEFKAConfig()`, `saveEFKAConfig()`. services/accounting-service.ts: `getEfkaAnnualSummary()` | Claude Code |
| 2026-02-09 | **Phase 4 implemented** — API: `GET /api/accounting/efka/summary`. Hook: `useEFKASummary(year)`. UI: `EFKAPageContent` (FiscalYearPicker + 3 summary cards: total paid/due/balance), `EFKAMonthlyBreakdown` (12 months table: pension/healthcare/supplementary/lumpSum/total), `EFKAPaymentsList` (payments table with 5 status badges: upcoming/due/paid/overdue/keao) | Claude Code |
| 2026-02-10 | **OE per-partner ΕΦΚΑ** — `partnerId` on EFKAPayment (nullable), `PartnerEFKASummary`, `PartnerEFKATabs` UI (ADR-ACC-012) | Claude Code |
| 2026-02-12 | **EPE manager ΕΦΚΑ** — `ManagerEFKASummary`, `EPEEFKASummary`, `getEPEEfkaSummary(year)` — managers-only (ADR-ACC-014) | Claude Code |
| 2026-02-12 | **AE dual-mode ΕΦΚΑ** — `EmployeeBoardMemberEFKA`, `AEEFKASummary`, `getAEEfkaSummary(year)` — employee (<3%) vs self-employed (≥3%) (ADR-ACC-017) | Claude Code |
| 2026-02-12 | **Section 11A added** — Entity-type ΕΦΚΑ overview: ατομική, ΟΕ, ΕΠΕ, ΑΕ | Claude Code |
| 2026-11-06 | **Ποσά 2026 = Δ.15/Δ'/1865/23-01-2026 (ΦΕΚ Β' 318/2026)** + εγκ. e-ΕΦΚΑ 5/2026: κύρια 185,09–597,06 · επικουρική 46,57/56,13/66,88 · εφάπαξ 31,05/37,02/44,18 (το config είχε μη τεκμηριωμένες στρογγυλές τιμές). Υγεία **ανά κατηγορία** (`healthContributionByMainCategory`, 1η 65,68 · 2η–6η 78,81) αντί για σταθερό 55 €. Τα ποσά 2025 δεν επαληθεύτηκαν. Βλ. ADR-ACC-022 §8.2 | Giorgio + Claude Code |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
