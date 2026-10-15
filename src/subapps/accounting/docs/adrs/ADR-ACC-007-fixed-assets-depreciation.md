# ADR-ACC-007: Fixed Assets & Depreciation — Πάγια & Αποσβέσεις

| Metadata | Value |
|----------|-------|
| **Status** | DRAFT |
| **Date** | 2026-02-09 |
| **Category** | Accounting / Fixed Assets |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Parent** | [ADR-ACC-000](./ADR-ACC-000-founding-decision.md) |
| **Module** | M-008: Fixed Assets |

---

## 1. Context

Ο αρχιτέκτονας-μηχανικός αποκτά πάγια στοιχεία (εξοπλισμό, όχημα, Η/Υ) που δεν εκπίπτουν εφάπαξ αλλά μέσω **φορολογικών αποσβέσεων** σε βάθος χρόνου.

### Τι είναι Πάγιο

Υλικό ή άυλο περιουσιακό στοιχείο που:
- Χρησιμοποιείται **>1 έτος** στην επιχείρηση
- Έχει αξία κτήσης **≥1.500€** (φορολογικό όριο, Ν.4172/2013 άρθρο 24)
- Αποσβένεται σταδιακά μέσω **ετήσιων αποσβέσεων**

> **Κάτω από 1.500€** → εκπίπτει εφάπαξ ως δαπάνη (`equipment` category, ACC-001)

### Τυπικά Πάγια Αρχιτέκτονα

| Πάγιο | Κατηγορία | Συντελεστής | Ωφέλιμη Ζωή |
|-------|-----------|-------------|--------------|
| Αυτοκίνητο (ΙΧ επαγγελματικό) | Μεταφορικά μέσα | 16% | ~6 έτη |
| Ηλεκτρονικός υπολογιστής | Η/Υ & περιφερειακά | 20% | 5 έτη |
| Εκτυπωτής / Plotter | Η/Υ & περιφερειακά | 20% | 5 έτη |
| Λογισμικό (άδεια >1.500€) | Άυλα | 10% | 10 έτη |
| Έπιπλα γραφείου | Έπιπλα & εξοπλισμός | 10% | 10 έτη |
| Κλιματιστικό | Μηχ. εγκαταστάσεις | 10% | 10 έτη |
| Φωτογραφική μηχανή / Drone | Εξοπλισμός | 20% | 5 έτη |
| Όργανα μέτρησης (σταθμός, GPS) | Εξοπλισμός | 20% | 5 έτη |

---

## 2. Depreciation Methods

### 2.1 Σταθερή Μέθοδος (Straight-line) — ΜΟΝΗ ΕΠΙΤΡΕΠΤΗ

Για απλογραφικό (Β' κατηγορίας), επιτρέπεται **μόνο** η σταθερή μέθοδος:

```
Ετήσια Απόσβεση = Αξία Κτήσης × Συντελεστής Απόσβεσης

Παράδειγμα: Laptop 2.000€, συντελεστής 20%
  Έτος 1: 2.000 × 20% = 400€
  Έτος 2: 2.000 × 20% = 400€
  Έτος 3: 2.000 × 20% = 400€
  Έτος 4: 2.000 × 20% = 400€
  Έτος 5: 2.000 × 20% = 400€
  ──────────────────────────────
  Σύνολο: 2.000€ (πλήρως αποσβεσμένο)
```

### 2.2 Αναλογική Απόσβεση 1ου Έτους

Αν αγοράστηκε μέσα στο έτος, η απόσβεση υπολογίζεται **αναλογικά**. Η απόσβεση αρχίζει τον μήνα που
**ακολουθεί** την έναρξη χρήσης (ΚΦΕ αρ.24 παρ.6 · ΠΟΛ 1073/2015)· ο μήνας της εκποίησης μετρά.

```
Αναλογική = (Αξία × Συντελ.) × (μήνες χρήσης / 12)

Παράδειγμα: Laptop 2.000€ σε χρήση 1/7/2026 ⇒ πρώτος μήνας ο Αύγουστος
  Έτος 2026: 2.000 × 20% × (5/12) = 166,67€
  Έτος 2027: 2.000 × 20% = 400€
  ...
  Έτος 2031: Υπόλοιπο 233,33€
```

> **Κώδικας (2026-10-15, ADR-ACC-010 §2.1.1 Φάση 4):** σύμβαση `DEPRECIATION_PERIOD_CONTROL`
> (`services/config/depreciation-config.ts`, SAP «period control»)· ο υπολογισμός ζει **μόνο** στο
> `services/engines/depreciation-schedule.ts`. Ως τις 2026-10-15 ο κώδικας μετρούσε και τον μήνα έναρξης (+1 μήνας
> στην πρώτη χρήση) — η μηχανή δεν εκτελέστηκε ποτέ στην παραγωγή, άρα κανένα καταχωρημένο ποσό δεν επηρεάστηκε.

### 2.3 Φορολογικοί Συντελεστές (Ν.4172/2013 άρ.24)

| Κατηγορία Παγίου | Συντελεστής | Ωφέλιμη Ζωή |
|------------------|-------------|--------------|
| Κτίρια / Κατασκευές | 4% | 25 έτη |
| Μηχανήματα / Εγκαταστάσεις | 10% | 10 έτη |
| Μεταφορικά μέσα | 16% | ~6 έτη |
| Έπιπλα / Σκεύη | 10% | 10 έτη |
| Η/Υ & Περιφερειακά | 20% | 5 έτη |
| Λογισμικό (άυλα) | 10% | 10 έτη |
| Λοιπά πάγια | 10% | 10 έτη |

> **Κώδικας:** η αυθεντία είναι το `ASSET_DEPRECIATION_RATES` (`services/config/depreciation-config.ts`) — 7 κατηγορίες
> (`buildings` · `machinery` · `vehicles` · `furniture` · `computers` 20% · `measurement_instruments` · `other`)·
> το «Λογισμικό» του πίνακα **δεν** υπάρχει ως ξεχωριστή κατηγορία. Ο συντελεστής του παγίου **τον αποφασίζει ο
> διακομιστής** από την κατηγορία (`createFixedAsset`)· ό,τι στείλει ο πελάτης αγνοείται.

---

## 3. TypeScript Types

### 3.1 Fixed Asset

```typescript
type AssetCategory =
  | 'buildings'          // Κτίρια / Κατασκευές (4%)
  | 'machinery'          // Μηχανήματα / Εγκαταστάσεις (10%)
  | 'vehicles'           // Μεταφορικά μέσα (16%)
  | 'furniture'          // Έπιπλα / Σκεύη (10%)
  | 'computers'          // Η/Υ & Περιφερειακά (20%)
  | 'software'           // Λογισμικό / Άυλα (10%)
  | 'other';             // Λοιπά (10%)

type AssetStatus =
  | 'active'             // Ενεργό (αποσβένεται)
  | 'fully_depreciated'  // Πλήρως αποσβεσμένο (αξία=0, ακόμα σε χρήση)
  | 'disposed'           // Πωλήθηκε / Καταστράφηκε
  | 'inactive';          // Εκτός χρήσης (δεν αποσβένεται)

interface FixedAsset {
  // === Ταυτότητα ===
  assetId: string;                  // Auto-generated (asset_XXXXX)
  companyId: string;
  status: AssetStatus;

  // === Περιγραφή ===
  name: string;                     // "MacBook Pro 16"
  description: string | null;       // Λεπτομέρειες
  category: AssetCategory;          // computers
  serialNumber: string | null;      // S/N (αν υπάρχει)
  location: string | null;          // "Γραφείο Σαμοθράκης 16"

  // === Αξίες ===
  acquisitionCost: number;          // Αξία κτήσης (καθαρό + ΦΠΑ αν μη εκπιπτόμενο)
  acquisitionDate: string;          // ISO date αγοράς
  depreciationRate: number;         // Συντελεστής (π.χ. 0.20 = 20%)
  usefulLifeYears: number;          // Ωφέλιμη ζωή σε έτη

  // === Αποσβέσεις ===
  totalDepreciation: number;        // Σωρευμένες αποσβέσεις μέχρι τώρα
  bookValue: number;                // Αναπόσβεστη αξία = cost - totalDepreciation
  depreciationStartDate: string;    // Έναρξη αποσβέσεων (= acquisitionDate)
  fullyDepreciatedDate: string | null; // Πότε αποσβέστηκε πλήρως

  // === Πώληση / Διάθεση ===
  disposalDate: string | null;
  disposalAmount: number | null;    // Τιμή πώλησης
  disposalGainLoss: number | null;  // Κέρδος/Ζημία = disposalAmount - bookValue

  // === Πηγή ===
  purchaseDocId: string | null;     // → received_expenses (τιμολόγιο αγοράς)
  vendorName: string | null;
  vendorVat: string | null;

  // === ΦΠΑ ===
  vatAmount: number;                // ΦΠΑ αγοράς
  vatDeducted: boolean;             // Εκπέστηκε ο ΦΠΑ;

  // === Meta ===
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}
```

### 3.2 Depreciation Record

```typescript
interface DepreciationRecord {
  recordId: string;
  assetId: string;                  // → fixed_assets
  companyId: string;

  /** Περίοδος */
  fiscalYear: number;               // Έτος απόσβεσης
  isProRata: boolean;               // Αναλογική (1ο ή τελευταίο έτος);
  monthsInUse: number;              // 1-12 (12 = πλήρες έτος)

  /** Ποσά */
  annualRate: number;               // Συντελεστής (π.χ. 0.20)
  fullYearAmount: number;           // Πλήρες ποσό = cost × rate
  actualAmount: number;             // Πραγματικό = fullYear × (months/12)
  cumulativeDepreciation: number;   // Σωρευμένο μετά αυτό το έτος
  remainingBookValue: number;       // Αναπόσβεστο μετά

  /** Booking */
  journalEntryId: string | null;    // → journal_entries
  status: 'calculated' | 'booked';  // Υπολογίστηκε ή καταχωρήθηκε

  /** Meta */
  calculatedAt: string;
  bookedAt: string | null;
}
```

### 3.3 Depreciation Rate Config

```typescript
interface DepreciationRateConfig {
  category: AssetCategory;
  rate: number;                     // 0.04, 0.10, 0.16, 0.20
  label: string;
  usefulLifeYears: number;
  legalBasis: string;               // "Ν.4172/2013 άρ.24"
}

const DEPRECIATION_RATES: DepreciationRateConfig[] = [
  { category: 'buildings', rate: 0.04, label: 'Κτίρια / Κατασκευές',
    usefulLifeYears: 25, legalBasis: 'Ν.4172/2013 άρ.24' },
  { category: 'machinery', rate: 0.10, label: 'Μηχανήματα / Εγκαταστάσεις',
    usefulLifeYears: 10, legalBasis: 'Ν.4172/2013 άρ.24' },
  { category: 'vehicles', rate: 0.16, label: 'Μεταφορικά Μέσα',
    usefulLifeYears: 6, legalBasis: 'Ν.4172/2013 άρ.24' },
  { category: 'furniture', rate: 0.10, label: 'Έπιπλα / Σκεύη',
    usefulLifeYears: 10, legalBasis: 'Ν.4172/2013 άρ.24' },
  { category: 'computers', rate: 0.20, label: 'Η/Υ & Περιφερειακά',
    usefulLifeYears: 5, legalBasis: 'Ν.4172/2013 άρ.24' },
  { category: 'software', rate: 0.10, label: 'Λογισμικό / Άυλα',
    usefulLifeYears: 10, legalBasis: 'Ν.4172/2013 άρ.24' },
  { category: 'other', rate: 0.10, label: 'Λοιπά Πάγια',
    usefulLifeYears: 10, legalBasis: 'Ν.4172/2013 άρ.24' },
];
```

---

## 4. Depreciation Engine

### 4.1 Core Interface

```typescript
interface IDepreciationEngine {
  /** Υπολογισμός ετήσιας απόσβεσης ενός παγίου */
  calculateAnnualDepreciation(
    asset: FixedAsset,
    fiscalYear: number
  ): DepreciationRecord | null;
  // null αν πλήρως αποσβεσμένο ή inactive

  /** Υπολογισμός αποσβέσεων ΟΛΩΝ παγίων για ένα έτος */
  calculateYearDepreciations(
    companyId: string,
    fiscalYear: number
  ): Promise<DepreciationRecord[]>;

  /** Καταχώρηση αποσβέσεων στο Βιβλίο Ε-Ε */
  bookDepreciations(
    records: DepreciationRecord[]
  ): Promise<void>;
  // → Δημιουργεί journal entries (1 ανά πάγιο ή 1 συγκεντρωτική)

  /** Υπολογισμός κέρδους/ζημίας πώλησης */
  calculateDisposalGainLoss(
    asset: FixedAsset,
    saleAmount: number,
    saleDate: string
  ): DisposalResult;
}
```

### 4.2 Calculation Logic

```typescript
function calculateAnnualDepreciation(
  asset: FixedAsset,
  fiscalYear: number
): DepreciationRecord | null {
  // Αν πλήρως αποσβεσμένο → null
  if (asset.bookValue <= 0) return null;
  if (asset.status !== 'active') return null;

  const acquisitionYear = new Date(asset.acquisitionDate).getFullYear();
  const acquisitionMonth = new Date(asset.acquisitionDate).getMonth() + 1;

  // Πλήρες ετήσιο ποσό
  const fullYearAmount = asset.acquisitionCost * asset.depreciationRate;

  let monthsInUse = 12;
  let isProRata = false;

  // 1ο Έτος: αναλογική
  if (fiscalYear === acquisitionYear) {
    monthsInUse = 13 - acquisitionMonth; // Ιαν=12, Φεβ=11, ..., Δεκ=1
    isProRata = true;
  }

  // Πραγματικό ποσό
  let actualAmount = fullYearAmount * (monthsInUse / 12);

  // Δεν μπορεί να ξεπεράσει το bookValue
  if (actualAmount > asset.bookValue) {
    actualAmount = asset.bookValue;
    isProRata = true; // Τελευταίο έτος
  }

  // Στρογγυλοποίηση
  actualAmount = Math.round(actualAmount * 100) / 100;

  return {
    assetId: asset.assetId,
    companyId: asset.companyId,
    fiscalYear,
    isProRata,
    monthsInUse,
    annualRate: asset.depreciationRate,
    fullYearAmount,
    actualAmount,
    cumulativeDepreciation: asset.totalDepreciation + actualAmount,
    remainingBookValue: asset.bookValue - actualAmount,
    status: 'calculated',
    // ...
  };
}
```

### 4.3 Disposal (Πώληση/Καταστροφή)

```typescript
interface DisposalResult {
  asset: FixedAsset;
  disposalDate: string;
  bookValueAtDisposal: number;    // Αναπόσβεστη αξία κατά πώληση
  saleAmount: number;
  gainLoss: number;               // sale - bookValue
  // Αν gain > 0 → έσοδο (category: asset_sale_income, myDATA: category1_4)
  // Αν gain < 0 → ζημία (category: other_expense)

  /** Αναλογική απόσβεση μέχρι ημ/νία πώλησης */
  partialYearDepreciation: number;
}
```

---

## 5. Auto-Booking

### 5.1 Ετήσια Αποσβέσεις → Journal Entries

Στο τέλος κάθε φορολογικού έτους:

```typescript
function bookDepreciation(record: DepreciationRecord): JournalEntry {
  return {
    type: 'expense',
    date: `${record.fiscalYear}-12-31`,  // Τελευταία μέρα έτους
    description: `Απόσβεση ${record.fiscalYear}: ${assetName}`,
    category: 'depreciation',
    mydataCode: 'category2_11',
    e3Code: '587_001',
    netAmount: record.actualAmount,
    vatRate: 0,
    vatAmount: 0,
    totalAmount: record.actualAmount,
    vatDeductible: false,
    vatDeductiblePercent: 0,
    vatDeductibleAmount: 0,
    sourceType: 'depreciation',
    sourceId: record.recordId,
    // ...
  };
}
```

### 5.2 Αγορά Παγίου → Journal Entry

Η αγορά παγίου **ΔΕΝ** εκπίπτει εφάπαξ. Αλλά ο ΦΠΑ εκπίπτει (αν applicable):

```
Αγορά laptop 2.000€ + ΦΠΑ 480€ = 2.480€
  → ΦΠΑ 480€ εκπίπτει στο Q που αγοράστηκε
  → Αξία 2.000€ αποσβένεται σε 5 χρόνια (400€/έτος)
  → myDATA: category2_7 (Αγορές Παγίων)
```

### 5.3 Πώληση Παγίου

```
Πώληση laptop μετά 3 χρόνια → bookValue = 800€
  Αν πωληθεί στα 500€ → Ζημία 300€ (other_expense)
  Αν πωληθεί στα 1.000€ → Κέρδος 200€ (asset_sale_income, category1_4)
```

---

## 6. Asset Register Report

### 6.1 Μητρώο Παγίων (Εκτύπωση)

```
┌───────────────────────────────────────────────────────────────────────────┐
│  ΜΗΤΡΩΟ ΠΑΓΙΩΝ ΣΤΟΙΧΕΙΩΝ — ΧΡΗΣΗ 2026                                   │
│  Παγώνης Νέστ. Γεώργιος — ΑΦΜ: XXXXXXXXX                               │
│─────────────────────────────────────────────────────────────────────────│
│ # │ Πάγιο          │ Κατηγ.  │ Ημ/νία  │ Αξία    │ Συντ.│ Απόσβ.2026│
│ 1 │ Toyota Yaris   │ Οχήματα │ 15/3/22 │12.000,00│ 16%  │  1.920,00 │
│ 2 │ MacBook Pro 16 │ Η/Υ     │ 10/1/25 │ 2.500,00│ 20%  │    500,00 │
│ 3 │ Plotter HP     │ Η/Υ     │  5/6/26 │ 1.800,00│ 20%  │    210,00 │
│ 4 │ AutoCAD License│ Λογισμ. │  1/1/24 │ 3.000,00│ 10%  │    300,00 │
│───────────────────────────────────────────────────────────────────────│
│ # │ Σωρ. Αποσβ.│ Αναπόσβ. │ Status              │                    │
│ 1 │   7.680,00 │ 4.320,00 │ Ενεργό              │                    │
│ 2 │   1.000,00 │ 1.500,00 │ Ενεργό              │                    │
│ 3 │     210,00 │ 1.590,00 │ Ενεργό              │                    │
│ 4 │     900,00 │ 2.100,00 │ Ενεργό              │                    │
│───────────────────────────────────────────────────────────────────────│
│  ΣΥΝΟΛΑ:  Αξία Κτήσης: 19.300,00€                                    │
│           Αποσβέσεις 2026: 2.930,00€                                  │
│           Σωρευμένες: 9.790,00€                                       │
│           Αναπόσβεστη Αξία: 9.510,00€                                 │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 7. Firestore Structure

```
accounting/{companyId}/
  ├── fixed_assets/{assetId}           ← Πάγια στοιχεία
  │
  ├── depreciation_records/
  │   └── {year}_{assetId}             ← Εγγραφή απόσβεσης ανά έτος/πάγιο
  │
  └── settings/
      └── depreciation                 ← Config (rates override, threshold)
```

### 7.1 Composite Indexes

```
fixed_assets:
  - (status ASC, category ASC)         ← Ενεργά ανά κατηγορία
  - (acquisitionDate ASC)              ← Χρονολογική σειρά

depreciation_records:
  - (fiscalYear ASC, assetId ASC)      ← Αποσβέσεις ανά έτος
  - (status ASC, fiscalYear ASC)       ← Pending booking
```

---

## 8. UI Pages

| Route | Σελίδα | Λειτουργία |
|-------|--------|------------|
| `/accounting/assets` | Μητρώο Παγίων | Λίστα + φίλτρα (status, κατηγορία) |
| `/accounting/assets/new` | Νέο Πάγιο | Φόρμα καταχώρησης |
| `/accounting/assets/[id]` | Λεπτομέρειες | Ιστορικό αποσβέσεων + timeline |
| `/accounting/assets/[id]/dispose` | Πώληση/Καταστροφή | Disposal workflow |
| `/accounting/assets/depreciation` | Ετήσιες Αποσβέσεις | Calculate + book per year |

### 8.1 Dashboard Mockup

```
┌─────────────────────────────────────────────────────────────┐
│  Πάγια Στοιχεία — 2026                                      │
│─────────────────────────────────────────────────────────────│
│                                                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ 📦 Ενεργά    │ │ 💰 Αξία      │ │ 📉 Αποσβ.2026│        │
│  │     4        │ │  19.300,00€  │ │   2.930,00€  │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│                                                             │
│  ΠΑΓΙΑ                                                      │
│  ─────                                                      │
│  🚗 Toyota Yaris    │ Οχήματα │ 12.000€ │ ████████░░ 64%    │
│  💻 MacBook Pro 16  │ Η/Υ     │  2.500€ │ ████░░░░░░ 40%    │
│  🖨️ Plotter HP      │ Η/Υ     │  1.800€ │ █░░░░░░░░░ 12%    │
│  📀 AutoCAD License │ Λογισμ. │  3.000€ │ ███░░░░░░░ 30%    │
│                                                             │
│  Progress bar = σωρευμένη απόσβεση / αξία κτήσης            │
│                                                             │
│  [+ Νέο Πάγιο]  [📊 Υπολογισμός Αποσβέσεων 2026]          │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. AI Integration

### 9.1 Αυτόματη Αναγνώριση Παγίου

Μέσω Expense Tracker (ACC-005):

```
Upload τιμολογίου αγοράς
  ↓
AI Extraction: ποσό = 2.500€, περιγραφή = "MacBook Pro 16"
  ↓
AI Check: ποσό ≥ 1.500€ → ΠΑΓΙΟ (ΟΧΙ δαπάνη)
  ↓
Prompt: "Αυτό φαίνεται πάγιο (≥1.500€). Να καταχωρηθεί ως πάγιο;"
  ↓
User: ✅ → Create FixedAsset + auto-fill category (computers)
      ❌ → Book ως δαπάνη (equipment)
```

### 9.2 Telegram

```
Admin: "Αγόρασα laptop 2.500€"
Bot: "💻 Ποσό ≥1.500€ — πάγιο στοιχείο.
      Κατηγορία: Η/Υ (20%, 5 χρόνια)
      Ετήσια απόσβεση: 500€
      Να το καταχωρήσω; ✅/❌"
```

---

## 10. Year-End Depreciation Workflow

### 10.1 Ετήσια Ροή (Δεκέμβριος)

```
[1] Reminder: "Δεκέμβριος — Υπολογισμός αποσβέσεων 2026"
    ↓
[2] Auto-calculate: Για κάθε ενεργό πάγιο
    → calculateAnnualDepreciation(asset, 2026)
    ↓
[3] Preview: Εμφάνιση λίστας αποσβέσεων
    ┌──────────────────────────────────────────┐
    │ Αποσβέσεις 2026 — Preview               │
    │──────────────────────────────────────────│
    │ Toyota Yaris:     1.920,00€  (16%)       │
    │ MacBook Pro:        500,00€  (20%)       │
    │ Plotter HP:         210,00€  (20%, 7μ)   │
    │ AutoCAD:            300,00€  (10%)       │
    │──────────────────────────────────────────│
    │ ΣΥΝΟΛΟ:           2.930,00€              │
    │ [✅ Καταχώρηση στο Βιβλίο Ε-Ε]          │
    └──────────────────────────────────────────┘
    ↓
[4] Book: Δημιουργία journal entries (depreciation)
    → 1 entry ανά πάγιο (ή 1 συγκεντρωτική — config)
    → myDATA: category2_11 / E3: 587_001
    ↓
[5] Update: asset.totalDepreciation += amount
            asset.bookValue -= amount
```

---

## 11. Dependencies

| Module | Σχέση | Περιγραφή |
|--------|-------|-----------|
| **M-001** (Company Setup) | **BLOCKED BY** | Χρειάζεται company context |
| **M-002** (Income/Expense) | **FEEDS** | Αποσβέσεις → journal entries |
| **ACC-001** (Chart of Accounts) | **READS** | Κατηγορία `depreciation` + codes |
| **ACC-005** (AI Document) | **TRIGGERS** | Αναγνώριση παγίου (≥1.500€) |
| **M-004** (myDATA) | **TRIGGERS** | Αγορά παγίου → category2_7 |
| **M-010** (Reports) | **FEEDS** | Μητρώο παγίων, ετήσιες αποσβέσεις |

---

## 12. Open Questions

| # | Ερώτηση | Status |
|---|---------|--------|
| 1 | Υπάρχοντα πάγια: Import ιστορικών ή fresh start 2026; | DEFAULT: Manual entry (λίγα πάγια) |
| 2 | Booking mode: 1 entry ανά πάγιο ή 1 συγκεντρωτική; | DEFAULT: 1 ανά πάγιο (αναλυτικό) |
| 3 | Αυτοκίνητο: Μικτή χρήση (50%) → μισή απόσβεση; | DEFAULT: Config per asset |

---

## 13. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-02-09 | ADR Created — Fixed Assets & Depreciation | Γιώργος + Claude Code |
| 2026-02-09 | Σταθερή μέθοδος μόνο (straight-line, Ν.4172/2013) | Claude Code |
| 2026-02-09 | Όριο παγίου: 1.500€ (κάτω → εφάπαξ δαπάνη) | Claude Code |
| 2026-02-09 | 7 κατηγορίες παγίων (4%-20% συντελεστές) | Claude Code |
| 2026-02-09 | Pro-rata 1ο/τελευταίο έτος (αναλογική μήνες/12) | Claude Code |
| 2026-02-09 | Year-end workflow: auto-calculate → preview → book | Claude Code |
| 2026-02-09 | AI: auto-detect πάγιο αν ≥1.500€ (ACC-005 integration) | Claude Code |
| 2026-02-09 | Disposal: κέρδος → asset_sale_income, ζημία → other_expense | Claude Code |
| 2026-02-09 | **Phase 2 implemented** — types/assets.ts: AssetCategory (7 types), AssetStatus (4 states), DepreciationRateConfig, FixedAsset (~25 fields), DepreciationRecord, DisposalResult (sale/write_off/donation), CreateFixedAssetInput, FixedAssetFilters. types/interfaces.ts: IDepreciationEngine (calculateAnnual, bookDepreciations, calculateDisposal, forecastDepreciations) | Claude Code |
| 2026-02-09 | **Phase 3 implemented** — services/config/depreciation-config.ts: `DEPRECIATION_RATES` (7 categories: buildings 4%, machinery 10%, vehicles 16%, furniture 10%, computers 20%, instruments 10%, other 10%), `getDepreciationRate()`, `calculateUsefulLife()`. services/engines/depreciation-engine.ts: `DepreciationEngine implements IDepreciationEngine` — `calculateAnnualDepreciation()` (pro-rata first year, capped at remaining value), `bookDepreciations(fiscalYear)` (fetches active assets, creates records, updates accumulatedDepreciation), `calculateDisposal()` (gain/loss + book value), `forecastDepreciations()` (multi-year projection). Straight-line only per N.4172/2013 | Claude Code |
| 2026-02-09 | **Phase 4 implemented** — API: `GET/POST /api/accounting/assets`. Hook: `useFixedAssets(filters)`. UI: `AssetsPageContent` (category+status filters + "Add Asset" dialog), `AssetsList` (table: name/category/date/cost/depreciation/netBookValue/status), `AddAssetForm` (dialog: description/category/date/cost/usefulLife/residualValue + auto-set useful life per DEPRECIATION_RATES), `DepreciationSchedule` (card with year-by-year: opening/depreciation/closing values) | Claude Code |
| 2026-10-15 | **Εκτέλεση αποσβέσεων «όπως οι μεγάλοι» (ADR-ACC-010 §2.1.1 Φάση 4)** — ⚠️ η γραμμή «Phase 3» παραπάνω ανέφερε `services/config/depreciation-config.ts` που **δεν υπήρχε**: οι συντελεστές ζούσαν μόνο στη φόρμα και ο διακομιστής δεχόταν τον συντελεστή του πελάτη. Τώρα: SSoT `depreciation-config.ts` (συντελεστές + `DEPRECIATION_PERIOD_CONTROL`) · καθαρός πίνακας `depreciation-schedule.ts` (υπόλοιπο αρχής από τα στοιχεία του παγίου, όχι από το μεταβλητό πεδίο) · έναρξη τον **επόμενο** μήνα (ΚΦΕ αρ.24 παρ.6) · `bookDepreciations` = πλήρης σάρωση (`collectFixedAssets`), μόνο χρήση που έληξε, `DepreciationRunResult` · ΕΝΑΣ ατομικός, ιδεμπότητος γραφέας `postDepreciation` (ντετερμινιστικό id `depr_` ανά μισθωτή/πάγιο/χρήση, `create` στη συναλλαγή, ίχνος `DEPRECIATION_POSTED` στην ίδια συναλλαγή) · `FixedAsset.lastDepreciatedFiscalYear` · `inactive` εκτός (ΠΟΛ 1073/2015) · εκποιημένο μέσα στη χρήση: ως τον μήνα εκποίησης · `forecastDepreciations` από τον ίδιο πίνακα · +1 δείκτης `(companyId, depreciationStartDate)` | Giorgio + Claude Code |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
