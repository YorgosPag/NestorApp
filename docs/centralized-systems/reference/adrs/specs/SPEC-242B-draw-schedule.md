# SPEC-242B: Construction Loan Draw Schedule & Interest Reserve Modeling

| Field | Value |
|-------|-------|
| **ADR** | ADR-242 |
| **Phase** | B — Quick Wins (Core Business) |
| **Priority** | ⭐⭐⭐⭐⭐ CRITICAL |
| **Status** | 📋 SPEC READY |
| **Estimated Effort** | 1 session |
| **Prerequisite** | SPEC-234E (InterestCostDialog) — ήδη υλοποιημένο |
| **Dependencies** | Κανένα — ΠΑΡΑΛΛΗΛΑ με SPEC-242A |
| **Features** | B3 (Construction Loan Draw Schedule & Interest Reserve Modeling) |

---

## 1. Objective

Νέο tab στο InterestCostDialog: **Draw Schedule**. Μοντελοποιεί τη σταδιακή εκταμίευση κατασκευαστικού δανείου:

1. **Draw timeline** — Gantt-style: πότε κάθε εκταμίευση, πόσο, σωρευτικό υπόλοιπο
2. **Cumulative interest** — Τόκοι που τρέχουν σε κάθε draw period
3. **Interest reserve depletion** — Πότε εξαντλείται το interest reserve, alert
4. **Total cost of capital** — Συνολικό κόστος κεφαλαίου στη λήξη

### Γιατί είναι κρίσιμο

| Πρόβλημα | Επίπτωση |
|----------|----------|
| Κατασκευαστικό δάνειο = σταδιακή εκταμίευση | Τόκοι τρέχουν μόνο στο εκταμιευμένο ποσό |
| Interest reserve = κεφάλαιο δεσμευμένο για τόκους | Αν εξαντληθεί, ο builder πληρώνει cash |
| Καθυστερήσεις κατασκευής = περισσότεροι τόκοι | Κάθε μήνα καθυστέρηση κοστίζει |
| Off-plan πωλήσεις = core business Παγώνης | Τα construction loans είναι η βάση |

### Πηγές Έρευνας

| Πηγή | Feature | Τι πήραμε |
|------|---------|-----------|
| Built Technologies | Construction Loan Management | Draw schedule modeling pattern |
| Rabbet | Loan Monitoring Reports | 8 essential report types, budget-to-draw alignment |
| Land Gorilla | Construction Loan Admin | Draw inspection workflow |
| Cync Software | Draw management | Interest accrual tracking |

---

## 2. Data Model

### 2.1 Draw Schedule Types

```typescript
// ═══════════════════════════════════════════════════════════════
// DRAW SCHEDULE — Προστίθενται στο interest-calculator.ts
// ═══════════════════════════════════════════════════════════════

/** Φάση κατασκευής (construction milestone) */
export type ConstructionPhase =
  | 'land_acquisition'     // Αγορά οικοπέδου
  | 'permits'              // Αδειοδότηση
  | 'foundation'           // Θεμελίωση
  | 'structure'            // Σκελετός
  | 'masonry'              // Τοιχοποιία
  | 'mechanical'           // Η/Μ εγκαταστάσεις
  | 'finishes'             // Αποπεράτωση
  | 'landscaping'          // Περιβάλλων χώρος
  | 'custom';              // Custom phase

/** Μία εκταμίευση (draw) */
export interface DrawScheduleEntry {
  /** Φάση κατασκευής */
  phase: ConstructionPhase;
  /** Display label (e.g. "Θεμελίωση") */
  label: string;
  /** Ποσό εκταμίευσης (€) */
  drawAmount: number;
  /** Αναμενόμενη ημερομηνία εκταμίευσης (ISO string) */
  drawDate: string;
  /** Ποσοστό ολοκλήρωσης πριν το draw (%) */
  completionPercent: number;
}

/** Όροι κατασκευαστικού δανείου */
export interface LoanTerms {
  /** Συνολικό ποσό δανείου (€) */
  totalCommitment: number;
  /** Ετήσιο επιτόκιο (%) — τυπικά Euribor + spread */
  annualRate: number;
  /** Interest reserve ποσό (€) — κεφάλαιο δεσμευμένο για τόκους */
  interestReserve: number;
  /** Ημερομηνία λήξης δανείου (ISO string) */
  maturityDate: string;
  /** Origination fee (%) — one-time */
  originationFee: number;
  /** Τρόπος υπολογισμού τόκων */
  interestAccrual: 'simple' | 'compound_monthly';
  /** Reference date (loan closing, ISO string) */
  closingDate: string;
}

/** Ανάλυση μίας περιόδου (month) */
export interface DrawPeriodAnalysis {
  /** Μήνας (1-indexed) */
  month: number;
  /** Ημερομηνία (ISO string) */
  date: string;
  /** Σωρευτικό εκταμιευμένο ποσό (€) */
  cumulativeDrawn: number;
  /** Τόκοι περιόδου (€) */
  periodInterest: number;
  /** Σωρευτικοί τόκοι (€) */
  cumulativeInterest: number;
  /** Υπόλοιπο interest reserve (€) */
  reserveBalance: number;
  /** Draw event αυτόν τον μήνα (αν υπάρχει) */
  drawEvent: DrawScheduleEntry | null;
}

/** Πλήρες αποτέλεσμα draw schedule analysis */
export interface DrawScheduleResult {
  /** Per-month breakdown */
  periods: DrawPeriodAnalysis[];
  /** Total interest cost (€) */
  totalInterest: number;
  /** Total draws (€) */
  totalDrawn: number;
  /** Interest reserve status */
  reserveStatus: InterestReserveStatus;
  /** All-in cost of capital (€) = interest + fees */
  totalCostOfCapital: number;
  /** All-in cost as percentage of commitment */
  costOfCapitalPercent: number;
  /** Origination fee amount (€) */
  originationFeeAmount: number;
  /** Weighted average outstanding balance (€) */
  weightedAverageBalance: number;
}

/** Interest reserve status */
export interface InterestReserveStatus {
  /** Αρχικό reserve (€) */
  initialReserve: number;
  /** Τελικό υπόλοιπο (€) — μπορεί < 0 */
  finalBalance: number;
  /** Αρκεί μέχρι τη λήξη; */
  sufficient: boolean;
  /** Μήνας εξάντλησης (null αν αρκεί) */
  exhaustionMonth: number | null;
  /** Ημερομηνία εξάντλησης (null αν αρκεί) */
  exhaustionDate: string | null;
  /** Cash shortfall (€) — πόσα χρήματα πρέπει να βάλει ο builder */
  cashShortfall: number;
}
```

---

## 3. Calculation Logic

### 3.1 Draw Schedule Engine — `src/lib/draw-schedule-engine.ts`

```
Αρχείο: src/lib/draw-schedule-engine.ts
Εκτιμώμενες γραμμές: ~250
Dependencies: interest-calculator.ts (types)
Side effects: ZERO — pure math
```

#### Monthly Interest Accrual Algorithm

```
Για κάθε μήνα m = 1 to totalMonths:
  1. Check αν υπάρχει draw event αυτόν τον μήνα
     → Αν ναι: cumulativeDrawn += drawAmount

  2. Simple interest:
     periodInterest = cumulativeDrawn × (annualRate / 100) / 12

  3. Compound monthly:
     periodInterest = cumulativeDrawn × ((1 + annualRate/100/12) - 1)
     (Note: για construction loans, τυπικά simple interest)

  4. cumulativeInterest += periodInterest

  5. reserveBalance -= periodInterest
     → Αν reserveBalance < 0 ΚΑΙ exhaustionMonth === null:
        exhaustionMonth = m
        exhaustionDate = date

  6. Αποθήκευσε DrawPeriodAnalysis
```

#### Interest Reserve Depletion

```
Αρχικό reserve = loanTerms.interestReserve

Κάθε μήνα, αφαιρούνται οι τόκοι:
  reserve[m] = reserve[m-1] - periodInterest[m]

Αν reserve[m] < 0:
  → exhaustionDate = m
  → cashShortfall = |reserve[τελευταίος μήνας]|
  → Alert: "Το interest reserve θα εξαντληθεί τον μήνα {m} ({date}).
            Θα χρειαστείτε €{shortfall} cash για τους εναπομείναντες τόκους."
```

#### Weighted Average Outstanding Balance

```
WAOB = Σ (cumulativeDrawn[m] × days_in_month[m]) / totalDays

Χρήσιμο για:
  - Σύγκριση κόστους μεταξύ διαφορετικών draw schedules
  - Ακριβέστερη εκτίμηση πραγματικού κόστους κεφαλαίου
```

#### Total Cost of Capital

```
totalCostOfCapital = totalInterest + originationFeeAmount
originationFeeAmount = totalCommitment × (originationFee / 100)
costOfCapitalPercent = (totalCostOfCapital / totalCommitment) × 100
```

---

## 4. UI Components

### 4.1 Component Tree

```
InterestCostDialog.tsx (EXISTING — add 1 tab)
  └── TabsList
       ├── ... (existing + SPEC-242A tabs) ...
       └── Draw Schedule ← NEW

DrawScheduleTab.tsx ← NEW (master tab)
  ├── LoanTermsForm (input section)
  ├── DrawTimelineChart (Gantt-style)
  ├── InterestReserveChart (depletion curve)
  └── DrawSummaryCard (total cost of capital)
```

### 4.2 DrawScheduleTab — `src/components/sales/payments/financial-intelligence/DrawScheduleTab.tsx`

```
Αρχείο: src/components/sales/payments/financial-intelligence/DrawScheduleTab.tsx
Εκτιμώμενες γραμμές: ~350
```

#### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│ 🏗️ Construction Loan Draw Schedule                              │
│                                                                   │
│ ┌─── Loan Terms ──────────────────────────────────────────────┐ │
│ │ Ποσό: €1.200.000  │ Επιτόκιο: 5.40%  │ Reserve: €80.000   │ │
│ │ Λήξη: 15/03/2028  │ Fee: 1.50%       │ Τόκοι: Simple      │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─── Draw Timeline ───────────────────────────────────────────┐ │
│ │ (Gantt-style recharts BarChart - see 4.3)                   │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─── Interest Reserve ────────────────────────────────────────┐ │
│ │ (Depletion curve recharts AreaChart - see 4.4)              │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─── Summary ─────────────────────────────────────────────────┐ │
│ │ Συνολικοί Τόκοι: €86.400  │  Fee: €18.000                  │ │
│ │ Συνολικό Κόστος: €104.400  │  Cost %: 8.70%                │ │
│ │ Μ.Ο. Εκταμιευμένου: €720.000  │  Reserve: ⚠️ εξαντλείται  │ │
│ └──────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 4.3 DrawTimelineChart — `src/components/sales/payments/financial-intelligence/DrawTimelineChart.tsx`

```
Αρχείο: src/components/sales/payments/financial-intelligence/DrawTimelineChart.tsx
Εκτιμώμενες γραμμές: ~180
```

#### Recharts ComposedChart

```
Type: ComposedChart (Bar + Line)

Bars: Draw amounts per month (stacked by phase, color-coded)
Line: Cumulative drawn amount (stepped line)

X axis: Months (M1, M2, ..., M24)
Y axis left: Draw amount (€)
Y axis right: Cumulative drawn (€)

Color coding per phase:
  land_acquisition → slate
  permits → gray
  foundation → amber
  structure → blue
  masonry → orange
  mechanical → purple
  finishes → green
  landscaping → teal

Tooltip: "Μήνας {m}: Draw €{amount} ({phase}) | Σύνολο: €{cumulative}"
```

### 4.4 InterestReserveChart — `src/components/sales/payments/financial-intelligence/InterestReserveChart.tsx`

```
Αρχείο: src/components/sales/payments/financial-intelligence/InterestReserveChart.tsx
Εκτιμώμενες γραμμές: ~160
```

#### Recharts AreaChart

```
Type: AreaChart

Area: Reserve balance over time
  - Green gradient: reserve > 50%
  - Amber gradient: reserve 20-50%
  - Red gradient: reserve < 20%

Reference line: y = 0 (exhaustion threshold)
Reference line: exhaustion date (vertical, dashed red)

X axis: Months
Y axis: Reserve balance (€)

Annotation at exhaustion point:
  "⚠️ Reserve εξαντλείται: Μήνας {m} ({date})"
  "Χρειάζεστε €{shortfall} cash"
```

---

## 5. File Inventory

### Νέα αρχεία

| File | Lines (est.) | Description |
|------|-------------|-------------|
| `src/lib/draw-schedule-engine.ts` | ~250 | Draw modeling, interest accrual, reserve depletion |
| `src/components/sales/payments/financial-intelligence/DrawScheduleTab.tsx` | ~350 | Master tab with form + charts |
| `src/components/sales/payments/financial-intelligence/DrawTimelineChart.tsx` | ~180 | Gantt-style draw visualization |
| `src/components/sales/payments/financial-intelligence/InterestReserveChart.tsx` | ~160 | Reserve depletion curve |

### Τροποποιημένα αρχεία

| File | Change |
|------|--------|
| `src/types/interest-calculator.ts` | +~90 lines: DrawScheduleEntry, LoanTerms, DrawScheduleResult, InterestReserveStatus |
| `src/components/sales/payments/InterestCostDialog.tsx` | +1 tab, +1 import |
| `src/i18n/locales/el/payments.json` | +~45 keys: drawSchedule.* |
| `src/i18n/locales/en/payments.json` | +~45 keys: drawSchedule.* |

---

## 6. i18n Keys

```json
{
  "drawSchedule": {
    "title": "Πρόγραμμα Εκταμιεύσεων",
    "subtitle": "Μοντελοποίηση κατασκευαστικού δανείου & κόστος κεφαλαίου",
    "loanTerms": {
      "title": "Όροι Δανείου",
      "totalCommitment": "Ποσό Δανείου",
      "annualRate": "Ετήσιο Επιτόκιο",
      "interestReserve": "Interest Reserve",
      "maturityDate": "Ημερομηνία Λήξης",
      "originationFee": "Origination Fee",
      "interestAccrual": "Υπολογισμός Τόκων",
      "simple": "Απλός Τόκος",
      "compound": "Ανατοκισμός (Μηνιαίος)",
      "closingDate": "Ημερομηνία Εκταμίευσης"
    },
    "draws": {
      "title": "Εκταμιεύσεις",
      "addDraw": "Προσθήκη Εκταμίευσης",
      "phase": "Φάση Κατασκευής",
      "amount": "Ποσό",
      "date": "Ημερομηνία",
      "completion": "% Ολοκλήρωσης"
    },
    "phases": {
      "land_acquisition": "Αγορά Οικοπέδου",
      "permits": "Αδειοδότηση",
      "foundation": "Θεμελίωση",
      "structure": "Σκελετός",
      "masonry": "Τοιχοποιία",
      "mechanical": "Η/Μ Εγκαταστάσεις",
      "finishes": "Αποπεράτωση",
      "landscaping": "Περιβάλλων Χώρος",
      "custom": "Προσαρμοσμένη Φάση"
    },
    "timeline": {
      "title": "Draw Timeline",
      "month": "Μήνας {m}",
      "drawAmount": "Εκταμίευση",
      "cumulative": "Σωρευτικά"
    },
    "reserve": {
      "title": "Interest Reserve",
      "balance": "Υπόλοιπο Reserve",
      "sufficient": "Επαρκεί μέχρι τη λήξη",
      "exhaustionWarning": "⚠️ Εξαντλείται μήνα {month} ({date})",
      "cashNeeded": "Χρειάζεστε €{amount} cash"
    },
    "summary": {
      "title": "Σύνοψη Κόστους Κεφαλαίου",
      "totalInterest": "Συνολικοί Τόκοι",
      "originationFee": "Origination Fee",
      "totalCost": "Συνολικό Κόστος Κεφαλαίου",
      "costPercent": "Κόστος %",
      "weightedAvgBalance": "Μ.Ο. Εκταμιευμένου Υπολοίπου"
    }
  }
}
```

---

## 7. Predefined Templates

### 7.1 Τυπικό Ελληνικό Off-Plan Draw Schedule

Ο χρήστης μπορεί να φορτώσει template αντί να εισάγει χειροκίνητα:

| Φάση | % Commitment | Τυπικός Μήνας |
|------|-------------|---------------|
| Αγορά Οικοπέδου | 25% | M1 |
| Θεμελίωση | 15% | M4 |
| Σκελετός | 20% | M8 |
| Τοιχοποιία | 15% | M12 |
| Η/Μ + Αποπεράτωση | 20% | M16 |
| Περιβάλλων χώρος | 5% | M20 |

**Template implementation**: Hardcoded array στο draw-schedule-engine.ts, δεν χρειάζεται API.

---

## 8. Verification Criteria

1. **Draw entries**: Τουλάχιστον 1 draw, amounts sum ≤ totalCommitment
2. **Monthly interest**: Simple interest default, compound optional, ακρίβεια ≤ €0.01
3. **Cumulative drawn**: Step function, αυξάνεται μόνο σε draw months
4. **Reserve depletion**: Μονοτονικά φθίνουσα, clear exhaustion alert
5. **Exhaustion date**: Calculated accurately, highlighted in red
6. **Cash shortfall**: Calculated when reserve < 0
7. **Total cost**: Interest + origination fee, as percentage of commitment
8. **Timeline chart**: Bar (draws) + Line (cumulative), color-coded by phase
9. **Reserve chart**: AreaChart with gradient, reference line at y=0
10. **Template**: Quick-fill with typical Greek construction schedule
11. **Tab integration**: 1 νέο tab στο InterestCostDialog
12. **i18n**: EL + EN πλήρεις
13. **Zero `any`**, semantic HTML, enterprise TypeScript
14. **Recharts**: Reuse existing chart.tsx wrapper

---

*SPEC Format: Google Engineering Design Docs standard — ADR-242 Smart Financial Intelligence Suite*
