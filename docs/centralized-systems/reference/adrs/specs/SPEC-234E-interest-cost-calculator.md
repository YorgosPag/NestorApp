# SPEC-234E: Interest Cost Calculator (Υπολογιστής Κόστους Χρήματος)

| Field | Value |
|-------|-------|
| **ADR** | ADR-234 |
| **Phase** | E — Financial Intelligence Tools |
| **Priority** | HIGH |
| **Status** | ✅ IMPLEMENTED |
| **Estimated Effort** | 2-3 sessions |
| **Prerequisite** | ADR-234 types, SPEC-234D (installments), SPEC-234C (loans) |
| **Dependencies** | Standalone calculator — μπορεί να υλοποιηθεί ανεξάρτητα |

---

## 1. Objective

Δημιουργία **εργαλείου υπολογισμού κόστους χρήματος** για τον κατασκευαστή. Όταν ο αγοραστής δηλώνει τρόπο πληρωμής (δόσεις, δάνειο, επιταγές), η εφαρμογή αυτόματα:

1. **Υπολογίζει το πραγματικό κόστος** της καθυστέρησης είσπραξης (time value of money)
2. **Τραβάει real-time Euribor** από το ECB API (δωρεάν, χωρίς API key)
3. **Προτείνει αναπροσαρμογή τιμής** ώστε ο κατασκευαστής να μην χάνει χρήματα
4. **Συγκρίνει σενάρια** (μετρητά vs δόσεις vs δάνειο)

### Γιατί χρειάζεται

| Πρόβλημα | Επίπτωση |
|----------|----------|
| €150.000 σε 6 δόσεις / 18 μήνες ≠ €150.000 σήμερα | Ο κατασκευαστής χάνει 4-7% σε αγοραστική δύναμη |
| Δάνειο αγοραστή = καθυστέρηση 2-3 μήνες εκταμίευσης | Κόστος ευκαιρίας: δεν μπορεί να χρησιμοποιήσει τα χρήματα |
| Πληθωρισμός + κόστος κεφαλαίου δεν φαίνεται πουθενά | Αγοραστής ζητά «την ίδια τιμή» αλλά πληρώνει αργά |
| Κατασκευαστής δεν ξέρει πόσο να φορτώσει σε δόσεις | Τιμολογεί με ένστικτο αντί με μαθηματικά |

---

## 2. Πηγές Επιτοκίων — API Strategy

### 2.1 ECB Data Portal API (Κύρια Πηγή)

| Πεδίο | Λεπτομέρεια |
|-------|-------------|
| **Provider** | European Central Bank |
| **Base URL** | `https://data-api.ecb.europa.eu/service/data/FM/` |
| **Κόστος** | **Δωρεάν** — χωρίς API key, χωρίς registration |
| **Format** | SDMX-JSON (via Accept header) |
| **Ενημέρωση** | Ημερήσια (TARGET2 business days) |
| **Άδεια** | Δημόσια δεδομένα — ελεύθερη χρήση (permissive) |
| **Rate limits** | Fair use — δεν αναφέρονται αυστηρά limits |
| **Docs** | `https://data.ecb.europa.eu/help/api/overview` |

#### Euribor Endpoints

| Tenor | Series Key |
|-------|-----------|
| Euribor 1 Week | `FM.B.U2.EUR.RT.MM.EURIBOR1WD_.HSTA` |
| Euribor 1 Month | `FM.B.U2.EUR.RT.MM.EURIBOR1MD_.HSTA` |
| Euribor 3 Months | `FM.B.U2.EUR.RT.MM.EURIBOR3MD_.HSTA` |
| Euribor 6 Months | `FM.B.U2.EUR.RT.MM.EURIBOR6MD_.HSTA` |
| Euribor 12 Months | `FM.B.U2.EUR.RT.MM.EURIBOR1YD_.HSTA` |
| ECB Main Refinancing Rate | `FM.B.U2.EUR.4F.KR.MRR_FR.LEV` |

#### Παράδειγμα Κλήσης

```
GET https://data-api.ecb.europa.eu/service/data/FM/B.U2.EUR.RT.MM.EURIBOR3MD_.HSTA?lastNObservations=1
Accept: application/vnd.sdmx.data+json;version=1.0.0-wd
```

#### Caching Strategy

```
ECB API → Server-side cache (Next.js API route)
  → Cache TTL: 24 ώρες (Euribor αλλάζει 1x/ημέρα)
  → Fallback: τελευταία cached τιμή αν API down
  → Firestore: settings/euribor_rates (persistent cache)
```

### 2.2 Fallback: API Ninjas

| Πεδίο | Λεπτομέρεια |
|-------|-------------|
| **URL** | `https://api.api-ninjas.com/v1/interestrate?name=euribor` |
| **Κόστος** | Freemium — 50.000 req/μήνα δωρεάν |
| **Απαιτεί** | API key (env var: `API_NINJAS_KEY`) |
| **Format** | JSON |
| **Ενημέρωση** | Κάθε 4 ώρες |

### 2.3 Ελληνικές Τράπεζες — Manual Configuration

**Δεν υπάρχει API** για στεγαστικά επιτόκια ελληνικών τραπεζών. Λύση:

```
Τελικό επιτόκιο = Euribor (αυτόματο) + Spread (manual per τράπεζα)
```

| Τράπεζα | Τυπικό Spread (2025-2026) | Πηγή |
|---------|--------------------------|------|
| Εθνική | +2.20% – +3.00% | nbg.gr |
| Πειραιώς | +2.30% – +3.20% | piraeusbank.gr |
| Alpha Bank | +2.00% – +2.80% | alpha.gr |
| Eurobank | +2.10% – +3.00% | eurobank.gr |
| Μέσος Όρος | +2.40% (default) | Υπολογισμένος |

Τα spreads εισάγονται από τον χρήστη ή χρησιμοποιείται ο default μέσος όρος.

---

## 3. Data Model

### 3.1 Euribor Rate Cache

```typescript
import type { Timestamp } from 'firebase/firestore';

/**
 * Cached Euribor rates — Firestore: settings/euribor_rates
 * Ενημερώνεται 1x/ημέρα μέσω API route
 */
export interface EuriborRatesCache {
  /** Euribor 1 Week (%) */
  euribor1W: number;

  /** Euribor 1 Month (%) */
  euribor1M: number;

  /** Euribor 3 Months (%) — πιο χρησιμοποιούμενο στα στεγαστικά */
  euribor3M: number;

  /** Euribor 6 Months (%) */
  euribor6M: number;

  /** Euribor 12 Months (%) */
  euribor12M: number;

  /** ECB Main Refinancing Rate (%) */
  ecbMainRate: number;

  /** Ημερομηνία τιμών (observation date) */
  rateDate: string;  // ISO date: "2026-03-15"

  /** Πότε ανανεώθηκε τελευταία φορά */
  lastFetchedAt: Timestamp;

  /** Πηγή */
  source: 'ecb' | 'api_ninjas' | 'manual';
}
```

### 3.2 Bank Spread Configuration

```typescript
/**
 * Configurable spread ανά τράπεζα — Firestore: settings/bank_spreads
 * Ο χρήστης μπορεί να τα ενημερώνει χειροκίνητα
 */
export interface BankSpreadConfig {
  /** Array τραπεζών με τα spreads τους */
  banks: BankSpreadEntry[];

  /** Default spread (μέσος όρος αγοράς) */
  defaultSpread: number;  // Default: 2.40

  /** Τελευταία ενημέρωση */
  lastUpdatedAt: Timestamp;

  /** Ποιος ενημέρωσε */
  lastUpdatedBy: string;
}

export interface BankSpreadEntry {
  /** ID τράπεζας (slug) */
  bankId: string;

  /** Όνομα τράπεζας */
  bankName: string;

  /** Minimum spread (%) */
  spreadMin: number;

  /** Maximum spread (%) */
  spreadMax: number;

  /** Τυπικό/default spread (%) */
  spreadTypical: number;

  /** Euribor tenor που χρησιμοποιεί (3M, 6M, 12M) */
  referenceTenor: '1M' | '3M' | '6M' | '12M';

  /** Σημειώσεις */
  notes: string | null;
}
```

### 3.3 Cost Calculation Input

```typescript
/**
 * Input για τον υπολογισμό κόστους χρήματος.
 * Μπορεί να έρχεται από υπάρχον payment plan ή manual input.
 */
export interface CostCalculationInput {
  /** Τιμή πώλησης (cash price) */
  salePrice: number;

  /** Ημερομηνία αναφοράς (σήμερα ή ημερομηνία σύμβασης) */
  referenceDate: string;  // ISO date

  /** Cash flows: πότε μπαίνουν τα χρήματα */
  cashFlows: CashFlowEntry[];

  /** Discount rate source */
  discountRateSource: DiscountRateSource;

  /** Manual discount rate (αν source = 'manual') */
  manualDiscountRate: number | null;
}

export interface CashFlowEntry {
  /** Ετικέτα (π.χ. "Κράτηση", "Δόση #3") */
  label: string;

  /** Ποσό (EUR) */
  amount: number;

  /** Αναμενόμενη ημερομηνία είσπραξης */
  expectedDate: string;  // ISO date

  /** Βεβαιότητα είσπραξης */
  certainty: 'certain' | 'probable' | 'uncertain';

  /** Μέσο πληρωμής (επηρεάζει certainty) */
  paymentMethod: PaymentMethod | null;
}

/** Πηγή discount rate */
export type DiscountRateSource =
  | 'euribor_3m_plus_spread'   // Euribor 3M + bank spread (default)
  | 'euribor_12m_plus_spread'  // Euribor 12M + bank spread
  | 'ecb_rate_plus_spread'     // ECB main rate + spread
  | 'wacc'                     // Weighted Average Cost of Capital (advanced)
  | 'manual';                  // Χειροκίνητο (ο χρήστης βάζει %)
```

### 3.4 Cost Calculation Result

```typescript
/**
 * Αποτέλεσμα υπολογισμού — τι επιστρέφει ο calculator
 */
export interface CostCalculationResult {
  /** Τιμή πώλησης (nominal) */
  nominalPrice: number;

  /** Discount rate που χρησιμοποιήθηκε (ετήσιο %) */
  discountRateUsed: number;

  /** Breakdown discount rate */
  discountRateBreakdown: {
    euriborRate: number;
    euriborTenor: string;
    bankSpread: number;
    totalRate: number;
  };

  // --- NPV Analysis ---

  /** Net Present Value (παρούσα αξία cash flows) */
  npv: number;

  /** NPV ως % της ονομαστικής τιμής */
  npvPercentage: number;

  /** Κόστος χρήματος (nominal - NPV) */
  timeCost: number;

  /** Κόστος χρήματος ως % */
  timeCostPercentage: number;

  // --- Pricing Recommendation ---

  /** Προτεινόμενη τιμή ώστε NPV = salePrice */
  recommendedPrice: number;

  /** Προσαύξηση ποσού */
  priceAdjustmentAmount: number;

  /** Προσαύξηση % */
  priceAdjustmentPercentage: number;

  // --- Cash Flow Analysis ---

  /** Μέσος σταθμισμένος χρόνος είσπραξης (ημέρες) */
  weightedAverageDays: number;

  /** Μέσος σταθμισμένος χρόνος (μήνες) */
  weightedAverageMonths: number;

  /** Ημερομηνία τελικής είσπραξης */
  lastCashFlowDate: string;

  /** Συνολική διάρκεια αποπληρωμής (ημέρες) */
  totalDurationDays: number;

  // --- Per Cash Flow Breakdown ---

  /** Ανάλυση ανά cash flow */
  cashFlowAnalysis: CashFlowAnalysisEntry[];

  // --- Metadata ---

  /** Ημερομηνία υπολογισμού */
  calculatedAt: string;

  /** Πηγή Euribor */
  euriborSource: 'ecb' | 'api_ninjas' | 'cached' | 'manual';

  /** Ημερομηνία Euribor rate */
  euriborRateDate: string;
}

export interface CashFlowAnalysisEntry {
  /** Ετικέτα */
  label: string;

  /** Ονομαστικό ποσό */
  nominalAmount: number;

  /** Ημέρες από reference date */
  daysFromReference: number;

  /** Discount factor */
  discountFactor: number;

  /** Παρούσα αξία */
  presentValue: number;

  /** Κόστος καθυστέρησης (nominal - PV) */
  timeCostAmount: number;
}
```

### 3.5 Scenario Comparison

```typescript
/**
 * Σύγκριση σεναρίων πληρωμής
 */
export interface ScenarioComparison {
  /** Reference price (cash price) */
  referencePrice: number;

  /** Discount rate */
  discountRate: number;

  /** Σενάρια */
  scenarios: ScenarioResult[];

  /** Best scenario (highest NPV) */
  bestScenarioIndex: number;
}

export interface ScenarioResult {
  /** Ετικέτα σεναρίου */
  label: string;

  /** Περιγραφή */
  description: string;

  /** Cash flows */
  cashFlows: CashFlowEntry[];

  /** Υπολογισμός */
  calculation: CostCalculationResult;

  /** Ranking (1 = best NPV) */
  rank: number;
}
```

---

## 4. Calculation Engine

### 4.1 NPV (Net Present Value) Formula

```
NPV = Σ (CFi / (1 + r)^(ti/365))

Όπου:
  CFi = Cash flow i (ποσό)
  r   = Annual discount rate (decimal, π.χ. 0.055 για 5.5%)
  ti  = Ημέρες από reference date μέχρι cash flow i
```

### 4.2 Discount Factor

```
DFi = 1 / (1 + r)^(ti/365)

Παράδειγμα:
  r = 5.5% (Euribor 3M 2.90% + spread 2.60%)
  t = 180 ημέρες

  DF = 1 / (1.055)^(180/365) = 1 / 1.0269 = 0.9738

  → €25.000 σε 180 ημέρες αξίζει €25.000 × 0.9738 = €24.345 σήμερα
  → Κόστος καθυστέρησης: €655
```

### 4.3 Recommended Price Calculation

```
Αν θέλουμε NPV(adjusted_cash_flows) = salePrice:

adjustmentFactor = salePrice / NPV(original_cash_flows)
recommendedPrice = salePrice × adjustmentFactor

Δηλαδή: κάθε cash flow πολλαπλασιάζεται × adjustmentFactor

Παράδειγμα:
  salePrice = €150.000
  NPV = €143.200
  adjustmentFactor = 150.000 / 143.200 = 1.0475
  recommendedPrice = €150.000 × 1.0475 = €157.125
  Πρόταση: ζήτα +€7.125 (+4.75%)
```

### 4.4 Weighted Average Collection Period

```
WACP = Σ (CFi × ti) / Σ CFi   (σε ημέρες)

Παράδειγμα:
  €5.000 × 0 + €30.000 × 30 + €20.000 × 90 + €25.000 × 180 + €35.000 × 360 + €35.000 × 540
  ÷ €150.000

  = (0 + 900.000 + 1.800.000 + 4.500.000 + 12.600.000 + 18.900.000) / 150.000
  = 38.700.000 / 150.000
  = 258 ημέρες (≈ 8.6 μήνες)
```

### 4.5 Certainty Adjustment (Advanced)

Κάθε cash flow έχει certainty level που επηρεάζει τον αποτελεσματικό discount rate:

| Certainty | Rate Multiplier | Λόγος |
|-----------|----------------|-------|
| `certain` | × 1.0 | Μεταφορά/μετρητά — σχεδόν σίγουρο |
| `probable` | × 1.1 | Δάνειο — εξαρτάται από έγκριση |
| `uncertain` | × 1.3 | Επιταγές/συναλλαγματικές — κίνδυνος bounced |

```
effectiveRate = baseRate × certaintyMultiplier

Παράδειγμα: baseRate 5.5%, uncertain payment
  effectiveRate = 5.5% × 1.3 = 7.15%
  → Μεγαλύτερο discount → μικρότερο NPV → πιο ακριβό για τον κατασκευαστή
```

---

## 5. Business Rules & Validation

### 5.1 Validation Rules

| Rule | Description | Enforcement |
|------|-------------|-------------|
| **V-CALC-001** | `salePrice` > 0 | Input validation |
| **V-CALC-002** | `discountRate` 0%-30% range | Soft warning αν > 15% |
| **V-CALC-003** | Cash flows sum ≥ salePrice | Warning αν < (μπορεί λόγω credit) |
| **V-CALC-004** | Τουλάχιστον 1 cash flow | Required |
| **V-CALC-005** | Cash flow dates ≥ referenceDate | Validation (δεν γίνεται πληρωμή στο παρελθόν) |
| **V-CALC-006** | Euribor cache < 48 ώρες | Αν παλαιότερο → refetch, αλλιώς warning |

### 5.2 Euribor Refresh Rules

| Trigger | Action |
|---------|--------|
| API route `/api/euribor/rates` called | Check cache age |
| Cache age > 24h AND business day | Fetch from ECB API |
| Cache age > 24h AND weekend/holiday | Use cached (ECB δεν δημοσιεύει) |
| ECB API error | Use cached + display warning badge |
| First ever fetch | Fetch from ECB, store in Firestore |

### 5.3 Auto-Calculate from Payment Plan

Όταν ο χρήστης έχει ήδη δημιουργήσει PaymentPlan (SPEC-234D):

```
PaymentPlan.installments[] → CashFlowEntry[]
  mapping:
    label = installment.label
    amount = installment.amount
    expectedDate = installment.dueDate
    certainty = derivedFromMethod(installment)
    paymentMethod = installment.expectedMethod

→ Auto-populate CostCalculationInput
→ Run calculation
→ Display result στο PaymentPlanTab
```

---

## 6. Predefined Scenarios

### 6.1 Auto-Generated Scenarios

Όταν ο χρήστης ανοίγει τον calculator, η εφαρμογή auto-generates 4 σενάρια:

| Σενάριο | Περιγραφή | Cash Flows |
|---------|-----------|------------|
| **Α: Μετρητά** | 100% αμέσως | 1 CF: €150.000, Day 0 |
| **Β: Standard Off-Plan** | Template 5 δόσεων | 5 CFs: 5% + 25% + 20% + 25% + 25% |
| **Γ: Δάνειο 70%** | 30% ίδια + 70% δάνειο (90 ημέρες μετά) | 2 CFs: 30% Day 0, 70% Day 90 |
| **Δ: Τρέχον Plan** | Από το υπάρχον PaymentPlan | CFs from installments[] |

Ο χρήστης μπορεί να προσθέσει custom σενάρια.

### 6.2 Σενάριο Quick Compare Output

```
┌─────────────────────────────────────────────────────────────────┐
│ 📊 Σύγκριση Σεναρίων Πληρωμής                                  │
│                                                                  │
│ Τιμή Πώλησης: €150.000  │  Euribor 3M: 2.90%  │  Spread: 2.50% │
│ Discount Rate: 5.40%     │  Ημ/νία: 15/03/2026                  │
│                                                                  │
│ Σενάριο         │ NPV        │ Κόστος    │ % Απώλ. │ Πρόταση    │
│ ────────────────┼────────────┼───────────┼─────────┼─────────── │
│ Α: Μετρητά      │ €150.000   │ €0        │ 0.0%    │ €150.000   │
│ Β: 5 Δόσεις     │ €143.200   │ €6.800    │ -4.5%   │ €156.800   │
│ Γ: Δάνειο 70%   │ €146.500   │ €3.500    │ -2.3%   │ €153.500   │
│ Δ: Τρέχον Plan  │ €144.800   │ €5.200    │ -3.5%   │ €155.200   │
│                                                                  │
│ ✅ Καλύτερο: Σενάριο Α (Μετρητά) — NPV 100%                    │
│ ⚠️ Αν δεχτείτε δόσεις, ζητήστε τουλάχιστον +4.5%              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. UI Components & Flow

### 7.1 Component Tree

| Component | Location | Description |
|-----------|----------|-------------|
| `InterestCostCalculator` | PaymentPlanTab section ή standalone page | Master container |
| `EuriborRateCard` | Calculator header | Τρέχον Euribor + ECB rate, last updated badge |
| `DiscountRateConfig` | Calculator settings | Source selector + bank spread config |
| `CashFlowEditor` | Calculator main | Editable table cash flows (manual ή from plan) |
| `ScenarioComparisonTable` | Calculator results | Σύγκριση σεναρίων side-by-side |
| `NpvResultCard` | Calculator results | NPV, κόστος, πρόταση τιμής |
| `CashFlowTimeline` | Calculator visualization | Horizontal timeline cash flows + PV overlay |
| `PricingRecommendation` | Calculator results | Highlighted box: "Ζητήστε +X%" |
| `BankSpreadSettings` | Settings page (ή inline) | Configurable spreads per τράπεζα |
| `EuriborHistoryChart` | Optional expandable | Euribor trend (6-12 μήνες) |

### 7.2 Entry Points (πώς μπαίνει ο χρήστης)

| Entry Point | Context | Behavior |
|-------------|---------|----------|
| **PaymentPlanTab → "Κόστος Χρήματος"** | Υπάρχει plan | Auto-load cash flows from plan |
| **Unit Detail → Quick Calculator** | Πριν δημιουργήσει plan | Manual entry |
| **Project Dashboard → Αναφορά Κόστους** | Aggregate | Μέσος κόστος χρήματος per project |
| **Sales Sidebar → Διαπραγμάτευση** | Κατά τη συζήτηση με αγοραστή | Quick scenario compare |

### 7.3 EuriborRateCard

```
┌──────────────────────────────────────────────────┐
│ 📈 Τρέχοντα Επιτόκια          Πηγή: ECB         │
│                                                   │
│ Euribor 3M:  2.90%   │  ECB Rate: 3.65%         │
│ Euribor 12M: 2.75%   │  Ενημέρωση: 15/03/2026   │
│                                                   │
│ Spread τράπεζας: +2.50% (μέσος όρος)            │
│ ─────────────────────────                         │
│ Τελικό Επιτόκιο: 5.40%                          │
│                                   [⚙️ Ρυθμίσεις] │
└──────────────────────────────────────────────────┘
```

### 7.4 CashFlowEditor Table

```
┌────────────────────────────────────────────────────────────────────┐
│ 📋 Cash Flows                         [+ Προσθήκη] [Από Plan ↗]  │
│                                                                     │
│ # │ Ετικέτα        │ Ποσό      │ Ημερομηνία  │ Μέσο     │ PV      │
│ ──┼────────────────┼───────────┼─────────────┼──────────┼──────── │
│ 1 │ Κράτηση        │ €5.000    │ 01/01/2026  │ Transfer │ €5.000  │
│ 2 │ Προκαταβολή    │ €30.000   │ 15/01/2026  │ Transfer │ €29.935 │
│ 3 │ Θεμελίωση      │ €20.000   │ 15/04/2026  │ Cheque   │ €19.707 │
│ 4 │ Σκελετός       │ €25.000   │ 15/07/2026  │ Transfer │ €24.270 │
│ 5 │ Αποπεράτωση    │ €35.000   │ 15/10/2026  │ Loan     │ €33.478 │
│ 6 │ Συμβόλαιο      │ €35.000   │ 15/01/2027  │ Loan     │ €33.070 │
│ ──┼────────────────┼───────────┼─────────────┼──────────┼──────── │
│   │ ΣΥΝΟΛΟ         │ €150.000  │             │          │€145.460 │
│                                                                     │
│ Κόστος Χρήματος: €4.540 (3.03%)                                   │
│ Πρόταση: Ζητήστε €154.540 αντί €150.000 (+3.03%)                 │
└────────────────────────────────────────────────────────────────────┘
```

### 7.5 PricingRecommendation Callout

```
┌──────────────────────────────────────────────────────────────┐
│ 💡 ΠΡΟΤΑΣΗ ΤΙΜΟΛΟΓΗΣΗΣ                                       │
│                                                               │
│ Με τον τρέχοντα τρόπο πληρωμής (6 δόσεις / 12 μήνες),       │
│ χάνετε €4.540 σε κόστος χρήματος.                            │
│                                                               │
│ ┌─────────────────────────────────────────────────┐          │
│ │ Ζητήστε τουλάχιστον: €154.540 (+3.03%)         │          │
│ │ ή: ζητήστε μεγαλύτερη προκαταβολή (>30%)       │          │
│ │ ή: μικρότερη διάρκεια (6 αντί 12 μήνες)        │          │
│ └─────────────────────────────────────────────────┘          │
│                                                               │
│ Μέσος χρόνος είσπραξης: 258 ημέρες (8.6 μήνες)              │
│ Αν ήταν μετρητά, θα είχατε ήδη €150.000 στο λ/σμό σας.     │
└──────────────────────────────────────────────────────────────┘
```

---

## 8. API Endpoints

### 8.1 Application API Routes

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/euribor/rates` | Τρέχοντα Euribor rates (cached, auto-refresh) |
| `POST` | `/api/euribor/refresh` | Force refresh από ECB API |
| `GET` | `/api/settings/bank-spreads` | Bank spread configuration |
| `PUT` | `/api/settings/bank-spreads` | Update bank spreads |
| `POST` | `/api/calculator/cost` | Υπολογισμός κόστους χρήματος (single scenario) |
| `POST` | `/api/calculator/compare` | Σύγκριση πολλαπλών σεναρίων |
| `POST` | `/api/calculator/recommend-price` | Πρόταση αναπροσαρμοσμένης τιμής |

### 8.2 ECB API Proxy (Server-Side)

```
Client → /api/euribor/rates → Server checks Firestore cache
  → Cache fresh (<24h)? Return cached
  → Cache stale? Fetch ECB API → Update Firestore → Return fresh
  → ECB API error? Return cached + stale warning
```

**Γιατί proxy αντί direct client call:**
- CORS: ECB API μπορεί να μην επιτρέπει browser requests
- Caching: αποφεύγουμε πολλαπλά requests
- Reliability: fallback σε cached data
- Rate limiting: ελέγχουμε τη συχνότητα

---

## 9. Integration Points

| System | Integration | Details |
|--------|-------------|---------|
| **ADR-234 PaymentPlan** | Auto-populate cash flows from installments | Bidirectional |
| **SPEC-234C Loans** | Loan disbursement timing → cash flow entry | certainty = 'probable' |
| **SPEC-234A Cheques** | Cheque maturity → cash flow entry | certainty = 'uncertain' (bounced risk) |
| **SPEC-234D Installments** | Payment plan template → scenario auto-generate | Pre-filled scenarios |
| **ADR-197 Sales** | Unit askingPrice → salePrice input | Auto-populate |
| **Unit.commercial** | finalPrice → salePrice | Auto-populate |
| **Settings** | bank_spreads, euribor_rates | Firestore documents |
| **Dashboard** | Average cost-of-money per project | Aggregate widget |

---

## 10. i18n Keys

```json
{
  "costCalculator": {
    "title": "Υπολογιστής Κόστους Χρήματος",
    "subtitle": "Πόσο σας κοστίζει η καθυστέρηση πληρωμής;",

    "euribor": {
      "title": "Τρέχοντα Επιτόκια",
      "source": "Πηγή",
      "ecb": "Ευρωπαϊκή Κεντρική Τράπεζα",
      "lastUpdated": "Τελευταία Ενημέρωση",
      "staleWarning": "Τα επιτόκια δεν ενημερώθηκαν τις τελευταίες {hours} ώρες",
      "tenor": {
        "1W": "Euribor 1 Εβδ.",
        "1M": "Euribor 1 Μήνα",
        "3M": "Euribor 3 Μηνών",
        "6M": "Euribor 6 Μηνών",
        "12M": "Euribor 12 Μηνών"
      },
      "ecbRate": "Επιτόκιο ECB"
    },

    "discountRate": {
      "title": "Επιτόκιο Αναφοράς",
      "source": "Πηγή Υπολογισμού",
      "euribor3mSpread": "Euribor 3M + Spread",
      "euribor12mSpread": "Euribor 12M + Spread",
      "ecbSpread": "ECB + Spread",
      "manual": "Χειροκίνητο",
      "bankSpread": "Spread Τράπεζας",
      "totalRate": "Τελικό Επιτόκιο"
    },

    "bankSpreads": {
      "title": "Spreads Τραπεζών",
      "bankName": "Τράπεζα",
      "spreadMin": "Ελάχιστο",
      "spreadMax": "Μέγιστο",
      "spreadTypical": "Τυπικό",
      "defaultSpread": "Μέσος Όρος Αγοράς",
      "lastUpdated": "Τελ. Ενημέρωση"
    },

    "cashFlows": {
      "title": "Cash Flows",
      "addEntry": "Προσθήκη",
      "fromPlan": "Από Πρόγραμμα Αποπληρωμής",
      "label": "Ετικέτα",
      "amount": "Ποσό",
      "date": "Ημερομηνία",
      "method": "Μέσο",
      "presentValue": "Παρούσα Αξία",
      "total": "Σύνολο"
    },

    "results": {
      "title": "Αποτελέσματα Ανάλυσης",
      "npv": "Καθαρή Παρούσα Αξία (NPV)",
      "timeCost": "Κόστος Χρήματος",
      "timeCostPercentage": "Κόστος %",
      "weightedAvgDays": "Μέσος Χρόνος Είσπραξης",
      "months": "{months} μήνες",
      "days": "{days} ημέρες"
    },

    "recommendation": {
      "title": "Πρόταση Τιμολόγησης",
      "requestAtLeast": "Ζητήστε τουλάχιστον",
      "orHigherDownPayment": "ή: μεγαλύτερη προκαταβολή (>{percentage}%)",
      "orShorterDuration": "ή: μικρότερη διάρκεια",
      "ifCash": "Αν ήταν μετρητά, θα είχατε ήδη €{amount} στο λ/σμό σας"
    },

    "scenarios": {
      "title": "Σύγκριση Σεναρίων",
      "addScenario": "Νέο Σενάριο",
      "cash": "Μετρητά",
      "standardOffPlan": "Standard Off-Plan",
      "loanHeavy": "Δάνειο 70%",
      "currentPlan": "Τρέχον Πρόγραμμα",
      "custom": "Custom",
      "bestScenario": "Καλύτερο Σενάριο",
      "npvColumn": "NPV",
      "costColumn": "Κόστος",
      "lossColumn": "% Απώλεια",
      "suggestedColumn": "Πρόταση Τιμής"
    },

    "certainty": {
      "certain": "Βέβαιη",
      "probable": "Πιθανή",
      "uncertain": "Αβέβαιη"
    }
  }
}
```

---

## 11. Verification Criteria

1. **ECB API integration**: Fetch Euribor 1W/1M/3M/6M/12M + ECB main rate, JSON parse, cache in Firestore
2. **Caching**: 24h TTL, fallback σε cached αν ECB down, stale warning badge
3. **NPV calculation**: Ακρίβεια ≤ €0.01 σε τυπικά σενάρια
4. **Discount rate**: Euribor + configurable spread, manual override
5. **Certainty adjustment**: Different rates per payment method certainty
6. **Scenario comparison**: 4+ σενάρια side-by-side, ranking by NPV
7. **Pricing recommendation**: Αυτόματη πρόταση αναπροσαρμογής τιμής
8. **Auto-populate**: Από PaymentPlan installments → cash flows
9. **Bank spreads**: Configurable per bank, default μέσος όρος
10. **i18n**: EL + EN πλήρεις
11. **License**: ECB API = δημόσια δεδομένα (OK), API Ninjas = free tier (OK)
12. **Κανένα `any`**, semantic HTML, enterprise TypeScript

---

*SPEC Format: Google Engineering Design Docs standard*
