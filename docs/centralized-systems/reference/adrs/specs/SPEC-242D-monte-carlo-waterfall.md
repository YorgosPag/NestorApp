# SPEC-242D: Monte Carlo Simulation & Equity Waterfall Distribution

| Field | Value |
|-------|-------|
| **ADR** | ADR-242 |
| **Phase** | D — Advanced Modeling |
| **Priority** | ⭐⭐⭐ MEDIUM |
| **Status** | 📋 SPEC READY |
| **Estimated Effort** | 2 sessions |
| **Prerequisite** | SPEC-242A (sensitivity engine — reuse perturbation logic) |
| **Dependencies** | SPEC-242A (sensitivity-engine.ts) |
| **Features** | D1 (Monte Carlo Simulation) + B2 (Equity Waterfall Distribution) |

---

## 1. Objective

Δύο advanced financial modeling features:

1. **Monte Carlo Tab** — 10.000 scenarios, P10/P50/P90 probability bands, fan chart + histogram. Δείχνει "ποια είναι η πιθανότητα το NPV να είναι πάνω από €X;"
2. **Equity Waterfall Dialog** — Tiered distribution: LP preferred return → GP catch-up → promote split. Για JV/LP-GP structures.

### Γιατί μαζί

| Κριτήριο | Εξήγηση |
|----------|---------|
| Advanced math | Και τα δύο heavy computation, pure math |
| Monte Carlo χρειάζεται sensitivity engine | Reuses perturbation variables from SPEC-242A |
| Waterfall = Monte Carlo output | Τα MC scenarios τροφοδοτούν waterfall distributions |
| Ίδιο audience | Advanced users που κάνουν JV deals |

### Πηγές Έρευνας

| Πηγή | Feature | Τι πήραμε |
|------|---------|-----------|
| Bloomberg PORT | Monte Carlo | 10,000+ scenarios, fan chart pattern |
| Morgan Stanley RE Research | Probability distributions | P10/P50/P90 bands standard |
| Adventures in CRE | Equity Waterfall | Tiered structure, promote calculation |
| Goldman Sachs Capital Solutions | JV Structuring | LP/GP split, catch-up mechanics |
| PropertyMetrics | IRR Hurdle | IRR vs equity multiple hurdle toggle |

---

## 2. Data Model

### 2.1 Monte Carlo Types

```typescript
// ═══════════════════════════════════════════════════════════════
// MONTE CARLO SIMULATION — Προστίθενται στο interest-calculator.ts
// ═══════════════════════════════════════════════════════════════

/** Configuration for Monte Carlo simulation */
export interface MonteCarloConfig {
  /** Number of scenarios to simulate (default: 10,000) */
  numScenarios: number;
  /** Variables to randomize with their distributions */
  variables: MonteCarloVariable[];
  /** Base case input */
  baseCase: CostCalculationInput;
  /** Random seed for reproducibility (optional) */
  seed?: number;
}

/** A variable with its probability distribution */
export interface MonteCarloVariable {
  /** Which variable to randomize */
  variable: SensitivityVariable;
  /** Distribution type */
  distribution: 'normal' | 'triangular' | 'uniform';
  /** Mean (for normal) or most likely (for triangular) */
  mean: number;
  /** Standard deviation (for normal) */
  stdDev?: number;
  /** Min value (for triangular/uniform) */
  min?: number;
  /** Max value (for triangular/uniform) */
  max?: number;
}

/** Full result of Monte Carlo simulation */
export interface MonteCarloResult {
  /** Number of scenarios run */
  numScenarios: number;
  /** Execution time (ms) */
  executionTimeMs: number;

  // --- NPV Statistics ---
  /** Mean NPV (€) */
  meanNPV: number;
  /** Median NPV (€) */
  medianNPV: number;
  /** Standard deviation of NPV (€) */
  stdDevNPV: number;
  /** P10 NPV — 10th percentile (worst realistic) */
  p10NPV: number;
  /** P25 NPV — 25th percentile */
  p25NPV: number;
  /** P50 NPV — 50th percentile (median) */
  p50NPV: number;
  /** P75 NPV — 75th percentile */
  p75NPV: number;
  /** P90 NPV — 90th percentile (best realistic) */
  p90NPV: number;
  /** Minimum NPV observed */
  minNPV: number;
  /** Maximum NPV observed */
  maxNPV: number;

  // --- Probability Metrics ---
  /** Probability NPV >= salePrice (%) — chance of breaking even */
  probBreakEven: number;
  /** Probability NPV >= target (%) — user-defined threshold */
  probAboveTarget: number;
  /** Target used for probAboveTarget */
  targetNPV: number;

  // --- Distribution Data (for charts) ---
  /** Histogram bins for NPV distribution */
  histogram: HistogramBin[];
  /** Fan chart data points (time series with percentile bands) */
  fanChartData: FanChartPoint[];
}

/** Histogram bin for NPV distribution */
export interface HistogramBin {
  /** Bin range start (€) */
  rangeStart: number;
  /** Bin range end (€) */
  rangeEnd: number;
  /** Number of scenarios in this bin */
  count: number;
  /** Frequency (count / total) */
  frequency: number;
  /** Cumulative frequency */
  cumulativeFrequency: number;
}

/** Fan chart point — percentile bands at each cash flow date */
export interface FanChartPoint {
  /** Date (ISO string) */
  date: string;
  /** Month index from reference date */
  monthIndex: number;
  /** Percentile values at this point */
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}
```

### 2.2 Equity Waterfall Types

```typescript
// ═══════════════════════════════════════════════════════════════
// EQUITY WATERFALL — Προστίθενται στο interest-calculator.ts
// ═══════════════════════════════════════════════════════════════

/** A single tier in the waterfall */
export interface WaterfallTier {
  /** Tier number (1-based) */
  tier: number;
  /** Description (e.g. "Preferred Return 8%") */
  description: string;
  /** i18n key for description */
  descriptionKey: string;
  /** Hurdle type */
  hurdleType: 'irr' | 'equity_multiple' | 'none';
  /** Hurdle rate or multiple (e.g. 8 for 8% IRR or 1.5 for 1.5x) */
  hurdleValue: number;
  /** LP split percentage (e.g. 90 = 90% to LP) */
  lpSplitPercent: number;
  /** GP split percentage (e.g. 10 = 10% to GP) */
  gpSplitPercent: number;
  /** Is this a GP catch-up tier? */
  isCatchUp: boolean;
}

/** Input for waterfall calculation */
export interface WaterfallInput {
  /** Total equity invested (€) */
  totalEquity: number;
  /** LP equity contribution (€) */
  lpEquity: number;
  /** GP equity contribution (€) */
  gpEquity: number;
  /** Total profit to distribute (€) */
  totalProfit: number;
  /** Distribution tiers (ordered) */
  tiers: WaterfallTier[];
  /** Return of capital first? (LP-first = true, pari-passu = false) */
  lpFirstReturnOfCapital: boolean;
}

/** Result of waterfall calculation */
export interface WaterfallResult {
  /** Per-tier distribution breakdown */
  tierDistributions: WaterfallTierResult[];
  /** Total to LP (€) */
  totalToLP: number;
  /** Total to GP (€) */
  totalToGP: number;
  /** LP equity multiple achieved */
  lpEquityMultiple: number;
  /** GP equity multiple achieved */
  gpEquityMultiple: number;
  /** LP IRR (% — approximate) */
  lpIRR: number;
  /** GP IRR (% — approximate) */
  gpIRR: number;
  /** Undistributed (should be 0) */
  undistributed: number;
}

/** Per-tier distribution result */
export interface WaterfallTierResult {
  /** Tier info */
  tier: WaterfallTier;
  /** Amount distributed in this tier (€) */
  amountDistributed: number;
  /** Amount to LP in this tier (€) */
  toLP: number;
  /** Amount to GP in this tier (€) */
  toGP: number;
  /** Remaining profit after this tier (€) */
  remainingProfit: number;
  /** Was the hurdle met? */
  hurdleMet: boolean;
}
```

---

## 3. Calculation Logic

### 3.1 Monte Carlo Engine — `src/lib/monte-carlo-engine.ts`

```
Αρχείο: src/lib/monte-carlo-engine.ts
Εκτιμώμενες γραμμές: ~300
Dependencies: npv-engine.ts, sensitivity-engine.ts (perturbation logic)
Side effects: ZERO — pure math
Execution: Web Worker recommended (10,000 iterations = ~50-200ms)
```

#### Simulation Algorithm

```
function runMonteCarloSimulation(config: MonteCarloConfig): MonteCarloResult {
  const npvResults: number[] = []
  const rng = createSeededRNG(config.seed ?? Date.now())

  for (let i = 0; i < config.numScenarios; i++) {
    // 1. Generate random values for each variable
    const modifiedInput = clone(config.baseCase)
    for (const variable of config.variables) {
      const randomValue = sampleDistribution(variable, rng)
      applyVariable(modifiedInput, variable.variable, randomValue)
    }

    // 2. Calculate NPV
    const npv = calculateNPV(modifiedInput)
    npvResults.push(npv)
  }

  // 3. Sort and compute statistics
  npvResults.sort((a, b) => a - b)
  return computeStatistics(npvResults, config)
}
```

#### Distribution Sampling

```
Normal distribution (Box-Muller transform):
  u1 = rng(), u2 = rng()
  z = sqrt(-2 * ln(u1)) * cos(2π * u2)
  value = mean + z * stdDev

Triangular distribution:
  u = rng()
  if u < (mode - min) / (max - min):
    value = min + sqrt(u * (max - min) * (mode - min))
  else:
    value = max - sqrt((1 - u) * (max - min) * (max - mode))

Uniform distribution:
  value = min + rng() * (max - min)
```

#### Seeded RNG (Reproducibility)

```
Mulberry32 PRNG — fast, deterministic:

function createSeededRNG(seed: number): () => number {
  let t = seed
  return () => {
    t = (t + 0x6D2B79F5) | 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}
```

#### Histogram Binning

```
numBins = 50 (or Sturges' rule: ceil(1 + 3.322 * log10(n)))
binWidth = (maxNPV - minNPV) / numBins

for each bin i:
  rangeStart = minNPV + i * binWidth
  rangeEnd = rangeStart + binWidth
  count = scenarios in [rangeStart, rangeEnd)
  frequency = count / numScenarios
  cumulativeFrequency = sum(frequency[0..i])
```

### 3.2 Waterfall Engine — `src/lib/waterfall-engine.ts`

```
Αρχείο: src/lib/waterfall-engine.ts
Εκτιμώμενες γραμμές: ~250
Dependencies: interest-calculator.ts (types)
Side effects: ZERO — pure math
```

#### Waterfall Algorithm

```
function calculateWaterfall(input: WaterfallInput): WaterfallResult {
  let remainingProfit = input.totalProfit
  const results: WaterfallTierResult[] = []

  // Step 0: Return of Capital
  if (input.lpFirstReturnOfCapital) {
    // LP gets capital back first
    const lpReturn = Math.min(remainingProfit, input.lpEquity)
    remainingProfit -= lpReturn
    const gpReturn = Math.min(remainingProfit, input.gpEquity)
    remainingProfit -= gpReturn
  } else {
    // Pari-passu return of capital
    const totalEquity = input.lpEquity + input.gpEquity
    const capitalReturn = Math.min(remainingProfit, totalEquity)
    remainingProfit -= capitalReturn
  }

  // Step 1+: Distribute through tiers
  for (const tier of input.tiers) {
    if (remainingProfit <= 0) {
      results.push({ tier, amountDistributed: 0, toLP: 0, toGP: 0,
                     remainingProfit: 0, hurdleMet: false })
      continue
    }

    // Calculate amount available for this tier
    let tierAmount: number
    if (tier.hurdleType === 'none') {
      // No hurdle — distribute all remaining
      tierAmount = remainingProfit
    } else {
      // Calculate amount needed to reach hurdle
      tierAmount = calculateAmountToReachHurdle(tier, input, results)
      tierAmount = Math.min(tierAmount, remainingProfit)
    }

    // Split between LP and GP
    const toLP = tierAmount * (tier.lpSplitPercent / 100)
    const toGP = tierAmount * (tier.gpSplitPercent / 100)
    remainingProfit -= tierAmount

    results.push({ tier, amountDistributed: tierAmount, toLP, toGP,
                   remainingProfit, hurdleMet: tierAmount >= requiredAmount })
  }

  return aggregateResults(results, input)
}
```

#### Typical JV Waterfall Structure (3 Tiers)

| Tier | Description | Hurdle | LP/GP Split |
|------|-------------|--------|-------------|
| 1 | Preferred Return | 8% IRR | 100% / 0% |
| 2 | GP Catch-Up | 12% IRR | 0% / 100% |
| 3 | Promote | None | 70% / 30% |

---

## 4. UI Components

### 4.1 Component Tree

```
InterestCostDialog.tsx (EXISTING — add 1 tab + 1 dialog link)
  └── TabsList
       ├── ... (existing + previous SPEC tabs) ...
       └── Monte Carlo ← NEW

MonteCarloTab.tsx ← NEW
  ├── MCConfigPanel (variable configuration)
  ├── MCFanChart (percentile bands, recharts AreaChart)
  ├── MCHistogram (NPV distribution, recharts BarChart)
  └── MCStatisticsCard (P10/P50/P90, probabilities)

EquityWaterfallDialog.tsx ← NEW (standalone dialog, opened from button)
  ├── WaterfallInputForm (equity, tiers, splits)
  ├── WaterfallVisualization (stacked horizontal bar)
  └── WaterfallSummaryTable (LP/GP totals, multiples)
```

### 4.2 MonteCarloTab — `src/components/sales/payments/financial-intelligence/MonteCarloTab.tsx`

```
Αρχείο: src/components/sales/payments/financial-intelligence/MonteCarloTab.tsx
Εκτιμώμενες γραμμές: ~350
```

#### Fan Chart (Recharts AreaChart)

```
Type: AreaChart with stacked transparent areas

Bands:
  P10-P90: very light blue fill (opacity 0.1)
  P25-P75: light blue fill (opacity 0.2)
  P50 line: solid blue line (2px)

X axis: Months
Y axis: NPV (€)

Tooltip: "Μήνας {m}: P10=€{p10} | P50=€{p50} | P90=€{p90}"

Παράδειγμα:
  ┌───────────────────────────────────────────────────┐
  │ 📊 Monte Carlo Fan Chart — 10,000 Scenarios       │
  │                                                    │
  │ €160K │         ╱───────── P90                     │
  │       │       ╱  ╱──────── P75                     │
  │ €150K │     ╱──╱── P50                             │
  │       │   ╱──╱                                     │
  │ €140K │  ╱─╱─── P25                                │
  │       │ ╱╱───── P10                                │
  │ €130K │╱                                           │
  │       │────────────────────────────────────────     │
  │         M0    M6    M12    M18    M24               │
  └───────────────────────────────────────────────────┘
```

#### Histogram (Recharts BarChart)

```
Type: BarChart (vertical bars)

X axis: NPV range bins (€)
Y axis left: Count
Y axis right: Cumulative probability (%)

Bars: blue with darker shade near median
Overlay line: cumulative distribution function (CDF)
Vertical reference lines: P10, P50, P90

Highlight: bin containing target NPV
Label: "Πιθανότητα NPV ≥ €{target}: {probability}%"
```

### 4.3 EquityWaterfallDialog — `src/components/sales/payments/financial-intelligence/EquityWaterfallDialog.tsx`

```
Αρχείο: src/components/sales/payments/financial-intelligence/EquityWaterfallDialog.tsx
Εκτιμώμενες γραμμές: ~350
```

#### Waterfall Visualization

```
Stacked horizontal bar chart (recharts BarChart, layout="vertical"):

Each tier = one bar:
  LP portion: blue
  GP portion: green

Labels: tier description + amounts

Παράδειγμα:
  ┌──────────────────────────────────────────────────────────────┐
  │ 💧 Equity Waterfall Distribution                             │
  │                                                               │
  │ Total Profit: €500.000  │  LP Equity: €800.000               │
  │ GP Equity: €200.000     │  Total: €1.000.000                 │
  │                                                               │
  │ Return of     │████████████████████████████│                  │
  │ Capital       │ LP: €800K        GP: €200K │                  │
  │               │                            │                  │
  │ Pref Return   │████████████████│           │                  │
  │ (8% IRR)      │ LP: €200K      │           │                  │
  │               │                │           │                  │
  │ GP Catch-Up   │         │██████│           │                  │
  │               │         │GP:€80│           │                  │
  │               │                │           │                  │
  │ Promote       │████████│███│               │                  │
  │ (70/30)       │LP:€154K│GP:│               │                  │
  │               │        │66K│               │                  │
  │ ──────────────┼────────┼───┼───────────────│                  │
  │ TOTAL         │ LP: €1.154K (1.44x)                          │
  │               │ GP: €546K   (2.73x)                          │
  └──────────────────────────────────────────────────────────────┘
```

#### Tier Input Form

```
Dynamic form — add/remove tiers:
  - Tier 1: Preferred Return [8%] IRR | LP [100%] GP [0%]
  - Tier 2: GP Catch-Up [12%] IRR | LP [0%] GP [100%]  ☑ Catch-Up
  - Tier 3: Promote [—] | LP [70%] GP [30%]
  [+ Add Tier]

Presets:
  - "Standard 80/20" — Pref 8%, then 80/20 split
  - "JV with Catch-Up" — Pref 8%, Catch-Up to 12%, then 70/30
  - "Simple Split" — No hurdle, straight 50/50
```

---

## 5. Web Worker Strategy

### 5.1 Monte Carlo Performance

```
10,000 scenarios × NPV calculation each = ~50-200ms on modern hardware

Options:
  A. Main thread (simple, <200ms is acceptable for UI)
  B. Web Worker (non-blocking, better UX)

Recommendation: Option A first. If >200ms → move to Web Worker.

Web Worker setup (if needed):
  src/workers/monte-carlo.worker.ts
  - Receives MonteCarloConfig via postMessage
  - Runs simulation
  - Returns MonteCarloResult via postMessage
  - Progress callback every 1000 scenarios
```

### 5.2 Progress UI

```
While Monte Carlo runs:
  [████████░░░░░░░░] 5,200 / 10,000 scenarios (52%)
  Estimated: ~2 seconds remaining

After completion:
  ✅ 10,000 scenarios in 156ms
```

---

## 6. File Inventory

### Νέα αρχεία

| File | Lines (est.) | Description |
|------|-------------|-------------|
| `src/lib/monte-carlo-engine.ts` | ~300 | 10,000 scenario simulation |
| `src/lib/waterfall-engine.ts` | ~250 | Tiered equity distribution |
| `src/components/sales/payments/financial-intelligence/MonteCarloTab.tsx` | ~350 | Fan chart + histogram |
| `src/components/sales/payments/financial-intelligence/EquityWaterfallDialog.tsx` | ~350 | Standalone dialog |

### Τροποποιημένα αρχεία

| File | Change |
|------|--------|
| `src/types/interest-calculator.ts` | +~120 lines: MonteCarloConfig/Result, WaterfallTier/Input/Result |
| `src/components/sales/payments/InterestCostDialog.tsx` | +1 tab (Monte Carlo) + 1 button (Waterfall dialog) |
| `src/i18n/locales/el/payments.json` | +~55 keys: monteCarlo.*, waterfall.* |
| `src/i18n/locales/en/payments.json` | +~55 keys |

---

## 7. i18n Keys

```json
{
  "monteCarlo": {
    "title": "Monte Carlo Simulation",
    "subtitle": "Πιθανοτική ανάλυση — 10.000 σενάρια",
    "config": {
      "scenarios": "Αριθμός Σεναρίων",
      "variables": "Μεταβλητές",
      "distribution": "Κατανομή",
      "normal": "Κανονική",
      "triangular": "Τριγωνική",
      "uniform": "Ομοιόμορφη",
      "mean": "Μέσος",
      "stdDev": "Τυπική Απόκλιση",
      "min": "Ελάχιστο",
      "max": "Μέγιστο",
      "seed": "Seed (αναπαραγωγιμότητα)",
      "run": "Εκτέλεση Simulation"
    },
    "results": {
      "meanNPV": "Μέσο NPV",
      "medianNPV": "Διάμεσο NPV",
      "stdDevNPV": "Τυπική Απόκλιση",
      "p10": "P10 (Χειρότερο ρεαλιστικό)",
      "p50": "P50 (Διάμεσο)",
      "p90": "P90 (Καλύτερο ρεαλιστικό)",
      "probBreakEven": "Πιθανότητα Break-Even",
      "probAboveTarget": "Πιθανότητα ≥ €{target}",
      "executionTime": "Χρόνος εκτέλεσης: {ms}ms"
    },
    "fanChart": {
      "title": "Fan Chart — Εύρος NPV",
      "band90": "P10 – P90",
      "band50": "P25 – P75",
      "median": "Διάμεσο (P50)"
    },
    "histogram": {
      "title": "Κατανομή NPV",
      "count": "Πλήθος",
      "cumulative": "Αθροιστική %",
      "target": "Στόχος"
    }
  },
  "waterfall": {
    "title": "Equity Waterfall Distribution",
    "subtitle": "Κατανομή κερδών LP / GP",
    "input": {
      "totalEquity": "Συνολικό Equity",
      "lpEquity": "LP Equity",
      "gpEquity": "GP Equity",
      "totalProfit": "Συνολικό Κέρδος",
      "lpFirst": "LP-First Return of Capital"
    },
    "tiers": {
      "title": "Βαθμίδες Κατανομής",
      "addTier": "Προσθήκη Βαθμίδας",
      "removeTier": "Αφαίρεση",
      "description": "Περιγραφή",
      "hurdleType": "Τύπος Hurdle",
      "irr": "IRR",
      "equityMultiple": "Equity Multiple",
      "none": "Κανένα",
      "hurdleValue": "Τιμή Hurdle",
      "lpSplit": "LP %",
      "gpSplit": "GP %",
      "catchUp": "GP Catch-Up"
    },
    "presets": {
      "title": "Προεπιλογές",
      "standard8020": "Standard 80/20",
      "jvCatchUp": "JV με Catch-Up",
      "simpleSplit": "Απλή Κατανομή"
    },
    "results": {
      "totalToLP": "Σύνολο LP",
      "totalToGP": "Σύνολο GP",
      "lpMultiple": "LP Multiple",
      "gpMultiple": "GP Multiple",
      "lpIRR": "LP IRR",
      "gpIRR": "GP IRR"
    }
  }
}
```

---

## 8. Verification Criteria

1. **Monte Carlo**: 10,000 scenarios default, configurable, reproducible with seed
2. **Distributions**: Normal (Box-Muller), Triangular, Uniform — correct sampling
3. **Statistics**: P10/P25/P50/P75/P90 accurate, mean/median/stdDev correct
4. **Fan chart**: AreaChart with transparent bands, P50 center line
5. **Histogram**: 50 bins, CDF overlay, target line
6. **Break-even probability**: Correctly calculated percentage
7. **Performance**: <500ms for 10,000 scenarios on main thread
8. **Waterfall**: Correct tier-by-tier distribution, LP-first vs pari-passu
9. **GP Catch-Up**: Correctly fills GP to target percentage before promote
10. **Presets**: 3 preset structures load correctly
11. **Visualization**: Stacked horizontal bars, color-coded LP/GP
12. **i18n**: EL + EN πλήρεις
13. **Zero `any`**, semantic HTML, enterprise TypeScript
14. **Recharts**: Reuse existing chart.tsx wrapper
15. **No new dependencies**: Pure math + recharts (already installed)

---

*SPEC Format: Google Engineering Design Docs standard — ADR-242 Smart Financial Intelligence Suite*
