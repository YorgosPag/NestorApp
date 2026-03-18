# SPEC-242A: Sensitivity Analysis & DSCR Stress Testing

| Field | Value |
|-------|-------|
| **ADR** | ADR-242 |
| **Phase** | A — Quick Wins (Pure Math) |
| **Priority** | ⭐⭐⭐⭐⭐ CRITICAL |
| **Status** | ✅ IMPLEMENTED (2026-03-18) |
| **Estimated Effort** | 1 session |
| **Prerequisite** | SPEC-234E (InterestCostDialog) — ήδη υλοποιημένο |
| **Dependencies** | Κανένα — ΠΡΩΤΟ στη σειρά υλοποίησης |
| **Features** | B1 (Sensitivity Analysis) + C3 (DSCR Stress Testing) |

---

## 1. Objective

Προσθήκη δύο νέων tabs στο InterestCostDialog:

1. **Sensitivity Tab** — Tornado chart + 2-variable heat map matrix. Δείχνει ποιες μεταβλητές επηρεάζουν περισσότερο το NPV (ποιο input αξίζει να διαπραγματευτεί ο κατασκευαστής).
2. **DSCR Stress Tab** — Gauge widget + rate sensitivity table. Ελέγχει αν ο κατασκευαστής πληροί τα covenant thresholds σε αυξημένα επιτόκια.

### Γιατί μαζί

| Κριτήριο | Εξήγηση |
|----------|---------|
| Ίδια κατηγορία | Pure math — zero API, zero Firestore writes |
| Συμπληρωματικά | Sensitivity δείχνει "τι σε επηρεάζει", DSCR δείχνει "πόσο αντέχεις" |
| Ίδιο integration point | Και τα δύο νέα tabs στο InterestCostDialog |
| Reuse | Ο DSCR engine χρειάζεται τα ίδια cash flow data με τον sensitivity engine |

### Πηγές Έρευνας

| Πηγή | Feature | Τι πήραμε |
|------|---------|-----------|
| ARGUS Enterprise | Sensitivity Analysis | Tornado chart pattern, ±20% perturbation standard |
| PropertyMetrics | 2-variable matrix | Rate vs. exit cap grid visualization |
| Yardi Debt Manager | DSCR Stress Testing | Gauge widget, +50/+100/+150/+200bps stress levels |
| Goldman Sachs | Covenant Monitoring | Breach probability indicator |

---

## 2. Data Model

### 2.1 Sensitivity Engine Types

```typescript
// ═══════════════════════════════════════════════════════════════
// SENSITIVITY ANALYSIS — Προστίθενται στο interest-calculator.ts
// ═══════════════════════════════════════════════════════════════

/** Μεταβλητές που μπορούν να μεταβληθούν στο sensitivity analysis */
export type SensitivityVariable =
  | 'discountRate'      // Επιτόκιο αναφοράς
  | 'bankSpread'        // Spread τράπεζας
  | 'salePrice'         // Τιμή πώλησης
  | 'constructionCost'  // Κόστος κατασκευής
  | 'paymentDelay'      // Καθυστέρηση πληρωμής (ημέρες)
  | 'downPayment';      // Ποσοστό προκαταβολής

/** Μία γραμμή του Tornado chart */
export interface TornadoEntry {
  /** Ποια μεταβλητή μεταβάλλεται */
  variable: SensitivityVariable;
  /** i18n key για display name */
  labelKey: string;
  /** Base value (τρέχουσα τιμή) */
  baseValue: number;
  /** NPV αν η μεταβλητή αυξηθεί κατά perturbation% */
  npvHigh: number;
  /** NPV αν η μεταβλητή μειωθεί κατά perturbation% */
  npvLow: number;
  /** NPV range = |npvHigh - npvLow| (για sorting) */
  npvRange: number;
}

/** Input για sensitivity analysis */
export interface SensitivityInput {
  /** Base case calculation input */
  baseCase: CostCalculationInput;
  /** Perturbation percentage (default: 20 = ±20%) */
  perturbationPercent: number;
  /** Ποιες μεταβλητές να αναλύσει */
  variables: SensitivityVariable[];
}

/** Αποτέλεσμα sensitivity analysis */
export interface SensitivityResult {
  /** Base case NPV */
  baseNpv: number;
  /** Tornado entries (sorted by npvRange descending) */
  tornado: TornadoEntry[];
  /** 2-variable heat map matrix */
  matrix: SensitivityMatrixResult | null;
}

/** 2-variable sensitivity matrix */
export interface SensitivityMatrixResult {
  /** Row variable (Y axis) */
  rowVariable: SensitivityVariable;
  /** Column variable (X axis) */
  colVariable: SensitivityVariable;
  /** Row values (e.g. discount rates: [3%, 4%, 5%, 6%, 7%]) */
  rowValues: number[];
  /** Column values (e.g. down payment: [10%, 20%, 30%, 40%, 50%]) */
  colValues: number[];
  /** NPV matrix[row][col] */
  npvMatrix: number[][];
  /** Row labels for display */
  rowLabels: string[];
  /** Column labels for display */
  colLabels: string[];
}
```

### 2.2 DSCR Engine Types

```typescript
// ═══════════════════════════════════════════════════════════════
// DSCR STRESS TESTING — Προστίθενται στο interest-calculator.ts
// ═══════════════════════════════════════════════════════════════

/** Input για DSCR υπολογισμό */
export interface DSCRInput {
  /** Ετήσιο Net Operating Income (€) */
  annualNOI: number;
  /** Ποσό δανείου (€) */
  loanAmount: number;
  /** Τρέχον ετήσιο επιτόκιο (%) */
  currentRate: number;
  /** Διάρκεια δανείου σε έτη */
  loanTermYears: number;
  /** Amortization period σε έτη (μπορεί > loanTermYears) */
  amortizationYears: number;
  /** Ελάχιστο DSCR covenant (τυπικά 1.20 ή 1.25) */
  covenantMinDSCR: number;
}

/** Αποτέλεσμα DSCR υπολογισμού */
export interface DSCRResult {
  /** Τρέχον DSCR (NOI / Annual Debt Service) */
  currentDSCR: number;
  /** Annual Debt Service (€) */
  annualDebtService: number;
  /** Monthly payment (€) */
  monthlyPayment: number;
  /** Κατάσταση σε σχέση με covenant */
  covenantStatus: 'safe' | 'warning' | 'breach';
  /** Πόσα bps headroom μέχρι breach */
  headroomBps: number;
  /** Μέγιστο επιτόκιο πριν breach */
  maxRateBeforeBreach: number;
}

/** Μία γραμμή στο stress test table */
export interface DSCRStressRow {
  /** Rate scenario label (e.g. "+100bps") */
  label: string;
  /** Stressed rate (%) */
  stressedRate: number;
  /** DSCR at stressed rate */
  dscr: number;
  /** Annual debt service at stressed rate (€) */
  annualDebtService: number;
  /** Status: safe | warning | breach */
  status: 'safe' | 'warning' | 'breach';
}

/** Πλήρες αποτέλεσμα DSCR stress test */
export interface DSCRStressResult {
  /** Base case */
  base: DSCRResult;
  /** Stress scenarios */
  stressRows: DSCRStressRow[];
  /** Stress levels σε bps */
  stressLevels: number[];
}
```

---

## 3. Calculation Logic

### 3.1 Sensitivity Engine — `src/lib/sensitivity-engine.ts`

```
Αρχείο: src/lib/sensitivity-engine.ts
Εκτιμώμενες γραμμές: ~200
Dependencies: npv-engine.ts (calculateNPV), interest-calculator.ts (types)
Side effects: ZERO — pure math
```

#### Tornado Algorithm

```
Για κάθε μεταβλητή V στο variables[]:
  1. baseNPV = calculateNPV(baseCase)
  2. highCase = clone(baseCase), αύξησε V κατά +perturbation%
  3. lowCase = clone(baseCase), μείωσε V κατά -perturbation%
  4. npvHigh = calculateNPV(highCase)
  5. npvLow = calculateNPV(lowCase)
  6. npvRange = |npvHigh - npvLow|

Ταξινόμησε tornado[] κατά npvRange DESC
→ Η μεταβλητή #1 = αυτή που επηρεάζει ΠΕΡΙΣΣΟΤΕΡΟ το NPV
```

#### Perturbation Rules per Variable

| Variable | Base | -20% | +20% | Μονάδα |
|----------|------|------|------|--------|
| `discountRate` | 5.40% | 4.32% | 6.48% | % |
| `bankSpread` | 2.40% | 1.92% | 2.88% | % |
| `salePrice` | €150.000 | €120.000 | €180.000 | € |
| `constructionCost` | €90.000 | €72.000 | €108.000 | € |
| `paymentDelay` | 0 days | 0 days | +60 days | days (μόνο θετικό) |
| `downPayment` | 20% | 16% | 24% | % of salePrice |

#### 2-Variable Matrix Algorithm

```
Default: rowVariable = discountRate, colVariable = downPayment

rowValues = [base - 2σ, base - 1σ, base, base + 1σ, base + 2σ]
  Παράδειγμα discountRate: [3.40%, 4.40%, 5.40%, 6.40%, 7.40%]

colValues = [10%, 15%, 20%, 25%, 30%, 35%, 40%]

Για κάθε (row, col):
  modifiedInput = clone(baseCase)
  modifiedInput.discountRate = rowValues[row]
  modifiedInput.downPayment = colValues[col]
  npvMatrix[row][col] = calculateNPV(modifiedInput)
```

### 3.2 DSCR Engine — `src/lib/dscr-engine.ts`

```
Αρχείο: src/lib/dscr-engine.ts
Εκτιμώμενες γραμμές: ~180
Dependencies: interest-calculator.ts (types)
Side effects: ZERO — pure math
```

#### DSCR Formula

```
Monthly Payment = P × [r(1+r)^n] / [(1+r)^n - 1]

Όπου:
  P = loan amount
  r = monthly rate = annualRate / 12 / 100
  n = amortization months = amortizationYears × 12

Annual Debt Service = Monthly Payment × 12
DSCR = NOI / Annual Debt Service
```

#### Stress Test Algorithm

```
stressLevels = [0, +50, +100, +150, +200] (bps)

Για κάθε stress level:
  stressedRate = currentRate + (stress / 100)
  monthlyPayment = calculatePayment(loanAmount, stressedRate, amortizationYears)
  annualDS = monthlyPayment × 12
  dscr = NOI / annualDS
  status = dscr >= covenant ? 'safe' : dscr >= covenant × 0.95 ? 'warning' : 'breach'
```

#### Maximum Rate Before Breach

```
Binary search:
  low = currentRate
  high = currentRate + 10%  (practical upper bound)

  Επανάλαβε μέχρι |high - low| < 0.01:
    mid = (low + high) / 2
    dscr = calculateDSCR(mid)
    Αν dscr > covenant → low = mid
    Αλλιώς → high = mid

  maxRateBeforeBreach = low
  headroomBps = (maxRate - currentRate) × 100
```

#### Covenant Status Logic

| DSCR vs Covenant | Status | Color | Αποτέλεσμα |
|------------------|--------|-------|------------|
| DSCR ≥ covenant × 1.10 | `safe` | Green | Comfortable headroom |
| covenant ≤ DSCR < covenant × 1.10 | `warning` | Amber | Close to minimum |
| DSCR < covenant | `breach` | Red | Covenant breach |

---

## 4. UI Components

### 4.1 Component Tree

```
InterestCostDialog.tsx (EXISTING — add 2 tabs)
  └── TabsList
       ├── ... (5 existing tabs) ...
       ├── Sensitivity ← NEW
       └── DSCR Stress ← NEW

SensitivityTab.tsx ← NEW
  ├── TornadoChart (recharts HorizontalBarChart)
  ├── MatrixVariableSelector (2 dropdowns)
  └── HeatMapMatrix (HTML table with colored cells)

DSCRStressTab.tsx ← NEW
  ├── DSCRInputForm (NOI, loan amount, rate, term)
  ├── DSCRGauge (speedometer-style arc)
  ├── StressTestTable (rate scenarios table)
  └── HeadroomIndicator (bps until breach)
```

### 4.2 SensitivityTab — `src/components/sales/payments/financial-intelligence/SensitivityTab.tsx`

```
Αρχείο: src/components/sales/payments/financial-intelligence/SensitivityTab.tsx
Εκτιμώμενες γραμμές: ~300
```

#### Tornado Chart (Recharts)

```
Recharts BarChart (horizontal layout):
  - Y axis: Variable names (sorted by impact)
  - X axis: NPV range (€)
  - 2 bars per variable: LOW (κόκκινο, αριστερά) | HIGH (πράσινο, δεξιά)
  - Vertical line: base NPV
  - Tooltip: "Αν {variable} αλλάξει κατά ±20%, NPV = €XXX - €YYY"

Παράδειγμα output:
  ┌─────────────────────────────────────────────────────────┐
  │ 🌪️ Tornado Chart — Ευαισθησία NPV                      │
  │                                                          │
  │ Τιμή Πώλησης   ████████████████████████████│████████████ │
  │ Προκαταβολή    ████████████│████████████                 │
  │ Επιτόκιο       ███████│███████                           │
  │ Spread         ████│████                                 │
  │ Καθυστέρηση    ██│██                                     │
  │ Κόστος Κατ.    █│█                                       │
  │                        ↑                                 │
  │                   Base NPV                               │
  │                   €143.200                               │
  └─────────────────────────────────────────────────────────┘
```

#### Heat Map Matrix

```
HTML <table> with conditional cell background-color via CSS classes:

  Classes in globals.css (NOT inline styles):
    .sensitivity-cell-positive-3 { background-color: hsl(142, 71%, 85%); }
    .sensitivity-cell-positive-2 { background-color: hsl(142, 71%, 90%); }
    .sensitivity-cell-positive-1 { background-color: hsl(142, 71%, 95%); }
    .sensitivity-cell-base       { background-color: hsl(0, 0%, 97%); }
    .sensitivity-cell-negative-1 { background-color: hsl(0, 71%, 95%); }
    .sensitivity-cell-negative-2 { background-color: hsl(0, 71%, 90%); }
    .sensitivity-cell-negative-3 { background-color: hsl(0, 71%, 85%); }

  Παράδειγμα:
               10%      20%      30%      40%    ← Προκαταβολή
    3.40%   €148.200  €149.100  €150.000  €150.500
    4.40%   €145.800  €146.700  €147.600  €148.100
    5.40%   €143.200  €144.100  €145.000  €145.500  ← BASE
    6.40%   €140.500  €141.400  €142.300  €142.800
    7.40%   €137.700  €138.600  €139.500  €140.000
      ↑
  Discount Rate
```

### 4.3 DSCRStressTab — `src/components/sales/payments/financial-intelligence/DSCRStressTab.tsx`

```
Αρχείο: src/components/sales/payments/financial-intelligence/DSCRStressTab.tsx
Εκτιμώμενες γραμμές: ~280
```

#### DSCR Gauge Widget

```
SVG arc gauge (custom, no library):
  - Arc 180° (semicircle)
  - Red zone: 0 — covenant
  - Amber zone: covenant — covenant × 1.10
  - Green zone: covenant × 1.10 — 3.0+
  - Needle: current DSCR
  - Center text: "1.38x" (large font)
  - Below: "SAFE — 45bps headroom" (status text)

  Παράδειγμα:
  ┌───────────────────────────────┐
  │       ╭──────────────╮       │
  │     ╱     ◉ 1.38x      ╲     │
  │   ╱  🔴  🟡  🟢  ▲       ╲   │
  │  ╱────────────│──────────╲  │
  │                                │
  │  ✅ SAFE — 45bps headroom     │
  │  Covenant: 1.25x              │
  │  Max rate before breach: 7.85% │
  └───────────────────────────────┘
```

#### Stress Test Table

```
  ┌──────────────────────────────────────────────────────────────┐
  │ 📊 Stress Test — Αντοχή σε Αύξηση Επιτοκίου                │
  │                                                               │
  │ Σενάριο    │ Επιτόκιο │ Μηνιαία Δόση │ Ετήσια DS  │ DSCR    │
  │ ──────────┼──────────┼──────────────┼───────────┼──────── │
  │ Τρέχον     │ 5.40%    │ €2.812       │ €33.744   │ 🟢 1.48 │
  │ +50bps     │ 5.90%    │ €2.965       │ €35.580   │ 🟢 1.40 │
  │ +100bps    │ 6.40%    │ €3.121       │ €37.452   │ 🟢 1.33 │
  │ +150bps    │ 6.90%    │ €3.280       │ €39.360   │ 🟡 1.27 │
  │ +200bps    │ 7.40%    │ €3.442       │ €41.304   │ 🔴 1.21 │
  │                                                               │
  │ ⚠️ BREACH σε +185bps (7.25%) — covenant minimum 1.25x       │
  └──────────────────────────────────────────────────────────────┘
```

### 4.4 InterestCostDialog Changes

```
Τροποποίηση: src/components/sales/payments/InterestCostDialog.tsx

Αλλαγές:
  1. Import SensitivityTab, DSCRStressTab
  2. Προσθήκη 2 TabsTrigger στο TabsList
  3. Προσθήκη 2 TabsContent

Tab order μετά:
  Cash Flow | Scenarios | Pricing | What-If | Settings | Sensitivity | DSCR Stress
  (existing) ─────────────────────────────── (new) ─────────────────────
```

---

## 5. File Inventory

### Νέα αρχεία

| File | Lines (est.) | Description |
|------|-------------|-------------|
| `src/lib/sensitivity-engine.ts` | ~200 | Tornado + matrix calculation |
| `src/lib/dscr-engine.ts` | ~180 | DSCR + stress test calculation |
| `src/components/sales/payments/financial-intelligence/SensitivityTab.tsx` | ~300 | Tornado chart + heat map |
| `src/components/sales/payments/financial-intelligence/DSCRStressTab.tsx` | ~280 | Gauge + stress table |

### Τροποποιημένα αρχεία

| File | Change |
|------|--------|
| `src/types/interest-calculator.ts` | +~100 lines: SensitivityVariable, TornadoEntry, DSCRInput, DSCRResult, DSCRStressRow |
| `src/components/sales/payments/InterestCostDialog.tsx` | +2 tabs, +2 imports |
| `src/i18n/locales/el/payments.json` | +~40 keys: sensitivity.*, dscr.* |
| `src/i18n/locales/en/payments.json` | +~40 keys: sensitivity.*, dscr.* |
| `src/app/globals.css` | +~14 lines: sensitivity heat map cell classes |

---

## 6. i18n Keys

```json
{
  "sensitivity": {
    "title": "Ανάλυση Ευαισθησίας",
    "subtitle": "Ποιες μεταβλητές επηρεάζουν περισσότερο το NPV;",
    "tornadoTitle": "Tornado Chart — Αντίκτυπος στο NPV",
    "matrixTitle": "Heat Map — 2 Μεταβλητές",
    "perturbation": "Μεταβολή ±{percent}%",
    "baseNpv": "Base NPV",
    "variables": {
      "discountRate": "Επιτόκιο Αναφοράς",
      "bankSpread": "Spread Τράπεζας",
      "salePrice": "Τιμή Πώλησης",
      "constructionCost": "Κόστος Κατασκευής",
      "paymentDelay": "Καθυστέρηση Πληρωμής",
      "downPayment": "Προκαταβολή"
    },
    "matrixRow": "Μεταβλητή Γραμμής",
    "matrixCol": "Μεταβλητή Στήλης",
    "highImpact": "Υψηλός αντίκτυπος",
    "lowImpact": "Χαμηλός αντίκτυπος"
  },
  "dscr": {
    "title": "DSCR Stress Test",
    "subtitle": "Πόσο αντέχετε αν αυξηθούν τα επιτόκια;",
    "currentDSCR": "Τρέχον DSCR",
    "covenant": "Covenant Minimum",
    "headroom": "Headroom",
    "bps": "bps",
    "maxRate": "Μέγιστο Επιτόκιο πριν Breach",
    "status": {
      "safe": "Ασφαλές",
      "warning": "Προσοχή",
      "breach": "Παραβίαση Covenant"
    },
    "input": {
      "noi": "Ετήσιο Καθαρό Λειτουργικό Εισόδημα (NOI)",
      "loanAmount": "Ποσό Δανείου",
      "currentRate": "Τρέχον Επιτόκιο",
      "loanTerm": "Διάρκεια Δανείου (έτη)",
      "amortization": "Περίοδος Απόσβεσης (έτη)",
      "covenantMin": "Ελάχιστο DSCR Covenant"
    },
    "stressTable": {
      "title": "Stress Test — Αντοχή σε Αύξηση Επιτοκίου",
      "scenario": "Σενάριο",
      "rate": "Επιτόκιο",
      "monthlyPayment": "Μηνιαία Δόση",
      "annualDS": "Ετήσια DS",
      "dscr": "DSCR",
      "current": "Τρέχον",
      "breachAt": "Breach σε {bps}bps ({rate}%)"
    }
  }
}
```

---

## 7. Verification Criteria

1. **Tornado chart**: 6 μεταβλητές, sorted by impact, horizontal bars, base NPV line
2. **Perturbation**: ±20% default, configurable
3. **Heat map matrix**: 5×7 grid minimum, green→red color scale via CSS classes (NOT inline)
4. **DSCR calculation**: Standard amortization formula, ακρίβεια ≤ €0.01
5. **Stress test**: 5 stress levels (0/+50/+100/+150/+200bps)
6. **Gauge widget**: SVG arc, 3 zones (red/amber/green), needle
7. **Max rate**: Binary search accuracy ≤ 1bp
8. **Headroom**: Calculated in bps, displayed clearly
9. **Covenant breach**: Auto-detect breach level, highlighted warning
10. **Tab integration**: 2 νέα tabs στο InterestCostDialog, seamless navigation
11. **i18n**: EL + EN πλήρεις
12. **Zero `any`**, semantic HTML, enterprise TypeScript
13. **Recharts**: Reuse existing chart.tsx wrapper, NO new chart libraries
14. **CSS classes**: Heat map colors via globals.css, NOT inline styles

---

*SPEC Format: Google Engineering Design Docs standard — ADR-242 Smart Financial Intelligence Suite*
