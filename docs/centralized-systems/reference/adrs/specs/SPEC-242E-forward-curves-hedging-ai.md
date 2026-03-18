# SPEC-242E: Forward Curves, Hedging Simulator & Natural Language Financial Query

| Field | Value |
|-------|-------|
| **ADR** | ADR-242 |
| **Phase** | E — AI-Powered & External APIs |
| **Priority** | ⭐⭐ LOW |
| **Status** | 📋 SPEC READY |
| **Estimated Effort** | 2-3 sessions |
| **Prerequisite** | SPEC-242A (sensitivity engine), SPEC-242C (portfolio dashboard) |
| **Dependencies** | SPEC-242A, SPEC-242C, ECB API (ήδη σε χρήση), OpenAI (ήδη στο stack) |
| **Features** | A1 (Forward Curves) + A3 (Hedging Simulator) + D3 (NL Financial Query) |

---

## 1. Objective

Τρία features που χρειάζονται **external APIs**:

1. **Forward Curves** — Yield curve visualization, forward rate interpolation. Δείχνει "πού πηγαίνουν τα επιτόκια" χρησιμοποιώντας ECB data.
2. **Hedging Simulator** — Σύγκριση Swap vs Cap vs Collar. NPV comparison, break-even analysis.
3. **NL Financial Query** — Chat interface στο financial intelligence dashboard. "Ποιο project έχει το μεγαλύτερο cost of money;" — extends ADR-171 agentic loop.

### Γιατί μαζί

| Κριτήριο | Εξήγηση |
|----------|---------|
| External APIs | A1 + A3 χρειάζονται ECB market data, D3 χρειάζεται OpenAI |
| Market data sharing | Forward curves τροφοδοτούν hedging simulator |
| Last priority | Αυτά είναι "nice to have" — τα core features είναι στα A-D |
| Extends existing | ECB API ήδη στο stack (SPEC-234E), OpenAI ήδη στο stack (ADR-171) |

### Πηγές Έρευνας

| Πηγή | Feature | Τι πήραμε |
|------|---------|-----------|
| Bloomberg FWCV | Forward Curves | Yield curve interpolation, forward rate tables |
| Chatham Financial | Hedging Simulator | Swap/Cap/Collar comparison tool |
| JP Morgan CRE | Rate Hedging | Break-even analysis, NPV comparison |
| Derivative Logic | Hedging Guide | Cap vs Swap vs Collar decision matrix |
| Northspyre | NL Query | Chat-style analytics interface |
| Bloomberg GPT | NL Query | LLM + structured financial data |

---

## 2. Data Model

### 2.1 Forward Curve Types

```typescript
// ═══════════════════════════════════════════════════════════════
// FORWARD CURVES — Προστίθενται στο interest-calculator.ts
// ═══════════════════════════════════════════════════════════════

/** A single point on the yield curve */
export interface ForwardRatePoint {
  /** Tenor in months (e.g. 1, 3, 6, 12, 24, 36, 60) */
  tenorMonths: number;
  /** Display label (e.g. "3M", "1Y", "5Y") */
  tenorLabel: string;
  /** Spot rate (%) — current rate for this tenor */
  spotRate: number;
  /** Forward rate (%) — implied future rate */
  forwardRate: number;
  /** Date this rate applies (ISO string) */
  asOfDate: string;
}

/** Full yield curve data */
export interface YieldCurveData {
  /** Currency */
  currency: 'EUR';
  /** Curve date */
  curveDate: string;
  /** Data points */
  points: ForwardRatePoint[];
  /** Curve shape */
  shape: 'normal' | 'inverted' | 'flat' | 'humped';
  /** Source */
  source: 'ecb_derived' | 'manual';
  /** When fetched */
  fetchedAt: string;
}
```

### 2.2 Hedging Types

```typescript
/** Hedging strategy type */
export type HedgeStrategyType = 'no_hedge' | 'swap' | 'cap' | 'collar';

/** A hedging strategy for comparison */
export interface HedgeStrategy {
  /** Strategy type */
  type: HedgeStrategyType;
  /** Display name i18n key */
  nameKey: string;
  /** Notional amount (€) */
  notionalAmount: number;
  /** Hedge start date (ISO string) */
  startDate: string;
  /** Hedge end date (ISO string) */
  endDate: string;
  /** Fixed rate (for swap) (%) */
  fixedRate?: number;
  /** Cap strike rate (%) */
  capStrike?: number;
  /** Floor strike rate — collar only (%) */
  floorStrike?: number;
  /** Upfront premium (€) — for cap/collar */
  upfrontPremium?: number;
}

/** Result of hedging comparison */
export interface HedgingComparisonResult {
  /** Base scenario (no hedge) */
  noHedge: HedgeScenarioResult;
  /** Hedged scenarios */
  strategies: HedgeScenarioResult[];
  /** Best strategy (lowest total cost in base case) */
  recommendedStrategy: HedgeStrategyType;
}

/** Per-strategy result */
export interface HedgeScenarioResult {
  /** Strategy */
  strategy: HedgeStrategy;
  /** Total interest cost over period (€) */
  totalInterestCost: number;
  /** Effective rate (%) — blended */
  effectiveRate: number;
  /** NPV of hedge (€) — positive = saves money */
  hedgeNPV: number;
  /** Break-even rate (%) — rate at which hedge starts saving money */
  breakEvenRate: number;
  /** Worst case cost (at +300bps) (€) */
  worstCaseCost: number;
  /** Best case cost (at -100bps) (€) */
  bestCaseCost: number;
  /** Rate scenarios */
  scenarios: HedgeRateScenario[];
}

/** Per-rate-scenario result */
export interface HedgeRateScenario {
  /** Rate scenario label */
  label: string;
  /** Market rate in scenario (%) */
  marketRate: number;
  /** Effective cost in scenario (€) */
  effectiveCost: number;
  /** Savings vs no-hedge (€) */
  savingsVsNoHedge: number;
}
```

### 2.3 NL Financial Query Types

```typescript
/** Financial query tool definitions for agentic loop */
export interface FinancialQueryTool {
  /** Tool name */
  name: string;
  /** Description for AI */
  description: string;
  /** Parameters schema */
  parameters: Record<string, unknown>;
}

/** Financial query result */
export interface FinancialQueryResult {
  /** Answer text */
  answer: string;
  /** Data used to answer */
  data: Record<string, unknown> | null;
  /** Suggested chart type */
  suggestedChart: 'bar' | 'line' | 'pie' | 'table' | null;
  /** Chart data (if applicable) */
  chartData: unknown[] | null;
  /** Sources referenced */
  sources: string[];
}
```

---

## 3. Calculation Logic

### 3.1 Forward Curve Engine — `src/lib/forward-curve-engine.ts`

```
Αρχείο: src/lib/forward-curve-engine.ts
Εκτιμώμενες γραμμές: ~200
Dependencies: ECB Euribor data (existing), interest-calculator.ts
Side effects: ZERO — pure math (API call is in route handler)
```

#### Forward Rate Derivation from Spot Rates

```
Forward rate from t1 to t2:

  f(t1, t2) = [(1 + s2)^t2 / (1 + s1)^t1]^(1/(t2-t1)) - 1

Όπου:
  s1 = spot rate at t1
  s2 = spot rate at t2
  t1, t2 = time in years

Παράδειγμα:
  Euribor 3M = 2.90% (spot)
  Euribor 6M = 2.85% (spot)

  Forward 3M→6M = [(1.0285)^0.5 / (1.029)^0.25]^(1/0.25) - 1
                 = ~2.80% (implied 3M rate, 3 months from now)
```

#### Yield Curve Shape Detection

```
points sorted by tenor

if all forward rates increasing: shape = 'normal'
else if all forward rates decreasing: shape = 'inverted'
else if max variance < 0.15%: shape = 'flat'
else: shape = 'humped'
```

### 3.2 Hedging Engine — `src/lib/hedging-engine.ts`

```
Αρχείο: src/lib/hedging-engine.ts
Εκτιμώμενες γραμμές: ~280
Dependencies: forward-curve-engine.ts, interest-calculator.ts
Side effects: ZERO — pure math
```

#### Swap NPV Calculation

```
Swap: fix the rate for the entire period

effectiveRate = fixedRate (constant)
totalCost = notional × fixedRate × (months / 12)
savings = totalCostNoHedge - totalCost

NPV = Σ savings per period, discounted

Break-even: the floating rate at which swap cost = no-hedge cost
  → breakEven = fixedRate (by definition — swap fixes the rate)
```

#### Cap NPV Calculation

```
Cap: pay premium, get protection above strike

Per period:
  if marketRate > capStrike:
    payoff = notional × (marketRate - capStrike) × (months / 12)
  else:
    payoff = 0

effectiveCost = min(marketRate, capStrike) × notional × period + upfrontPremium

Break-even: rate at which cap savings = upfrontPremium
  → Solve: notional × (breakEven - capStrike) × duration = premium
  → breakEven = capStrike + premium / (notional × duration)
```

#### Collar Calculation

```
Collar = Cap + Floor (sell floor to reduce premium)

Per period:
  if marketRate > capStrike: rate = capStrike
  else if marketRate < floorStrike: rate = floorStrike
  else: rate = marketRate

effectiveCost = effectiveRate × notional × period + netPremium
(netPremium = capPremium - floorPremium — often near zero)
```

### 3.3 Financial Query Tools — `src/services/ai-pipeline/tools/financial-query-tools.ts`

```
Αρχείο: src/services/ai-pipeline/tools/financial-query-tools.ts
Εκτιμώμενες γραμμές: ~200
Dependencies: portfolio-aggregator.ts, variance-analyzer.ts, npv-engine.ts
Side effects: READ-ONLY Firestore
```

#### Tool Definitions for Agentic Loop

```
Νέα financial tools για ADR-171 agentic loop:

1. get_portfolio_summary
   → Calls portfolio-aggregator.ts
   → Returns: PortfolioSummary

2. get_project_financial_details
   params: { projectId: string }
   → Returns: ProjectFinancialSummary

3. get_debt_maturity_schedule
   → Returns: MaturityWallYear[]

4. get_budget_variance
   params: { projectId: string }
   → Returns: BudgetVarianceAnalysis

5. calculate_scenario_npv
   params: { salePrice, cashFlows[], discountRate }
   → Returns: CostCalculationResult

6. compare_hedging_strategies
   params: { notional, rate, duration }
   → Returns: HedgingComparisonResult
```

---

## 4. API Endpoints

### 4.1 Forward Rates API — `src/app/api/ecb/forward-rates/route.ts`

```
Αρχείο: src/app/api/ecb/forward-rates/route.ts
Εκτιμώμενες γραμμές: ~120

GET /api/ecb/forward-rates
  → Fetches Euribor tenors from ECB API (existing pattern from SPEC-234E)
  → Derives forward rates using forward-curve-engine
  → Returns YieldCurveData
  → Cache: 24h (same as Euribor rates)

Response:
{
  success: true,
  curve: YieldCurveData
}
```

---

## 5. UI Components

### 5.1 Component Tree

```
InterestCostDialog.tsx (EXISTING — add 2 tabs)
  └── TabsList
       ├── ... (existing + previous SPEC tabs) ...
       ├── Forward Curves ← NEW
       └── Hedging ← NEW

ForwardCurveChart.tsx ← NEW
  ├── YieldCurveLineChart (spot + forward curves)
  ├── RateTableDisplay (tabular rates)
  └── CurveShapeBadge (normal/inverted/flat)

HedgingComparisonTable.tsx ← NEW
  ├── StrategyInputForm (swap/cap/collar parameters)
  ├── ComparisonTable (side-by-side)
  └── BreakEvenChart (rate vs cost per strategy)

FinancialQueryChat.tsx ← NEW (in portfolio dashboard, NOT in dialog)
  ├── ChatMessageList
  ├── ChatInput
  └── QueryResultCard (auto-generated charts)
```

### 5.2 ForwardCurveChart — `src/components/sales/payments/financial-intelligence/ForwardCurveChart.tsx`

```
Αρχείο: src/components/sales/payments/financial-intelligence/ForwardCurveChart.tsx
Εκτιμώμενες γραμμές: ~220
```

#### Recharts LineChart

```
Type: LineChart with 2 lines

Line 1: Spot curve (solid blue)
Line 2: Forward curve (dashed green)

X axis: Tenor (1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y)
Y axis: Rate (%)

Reference area: spread between spot and forward (light gray fill)

Annotation: Curve shape badge (e.g. "📈 Normal — rates expected to rise")

Tooltip: "3M: Spot 2.90% | Forward 2.80%"

Παράδειγμα:
  ┌───────────────────────────────────────────────────┐
  │ 📈 Yield Curve — EUR Euribor          [Normal]    │
  │                                                    │
  │ 3.5% │                           ╱── Spot         │
  │      │                      ╱───╱                  │
  │ 3.0% │               ╱────╱                        │
  │      │          ╱───╱    ╱── Forward               │
  │ 2.5% │    ╱───╱    ╱───╱                           │
  │      │───╱    ╱───╱                                │
  │ 2.0% │──╱───╱                                      │
  │      │──────────────────────────────────────────── │
  │        1M   3M   6M   1Y   2Y   3Y   5Y           │
  └───────────────────────────────────────────────────┘
```

### 5.3 HedgingComparisonTable — `src/components/sales/payments/financial-intelligence/HedgingComparisonTable.tsx`

```
Αρχείο: src/components/sales/payments/financial-intelligence/HedgingComparisonTable.tsx
Εκτιμώμενες γραμμές: ~280
```

#### Side-by-Side Comparison

```
  ┌──────────────────────────────────────────────────────────────────┐
  │ 🛡️ Hedging Strategy Comparison                                  │
  │                                                                   │
  │ Notional: €1.000.000  │  Term: 24 months  │  Current Rate: 5.40% │
  │                                                                   │
  │                │ No Hedge │ Swap    │ Cap     │ Collar           │
  │ ──────────────┼──────────┼─────────┼─────────┼─────────         │
  │ Fixed Rate     │ —        │ 4.80%   │ —       │ —                │
  │ Cap Strike     │ —        │ —       │ 5.50%   │ 5.50%           │
  │ Floor Strike   │ —        │ —       │ —       │ 4.00%           │
  │ Premium        │ —        │ €0      │ €12.000 │ €3.000          │
  │ ──────────────┼──────────┼─────────┼─────────┼─────────         │
  │ Eff. Rate      │ 5.40%    │ 4.80%   │ ≤5.50%  │ 4.00-5.50%     │
  │ Total Cost     │ €108.000 │ €96.000 │ ≤€122K  │ ≤€113K         │
  │ NPV            │ —        │ +€12K   │ varies  │ varies          │
  │ Break-Even     │ —        │ 4.80%   │ 6.10%   │ 4.15%          │
  │ ──────────────┼──────────┼─────────┼─────────┼─────────         │
  │ Best Case      │ €80.000  │ €96.000 │ €92.000 │ €83.000        │
  │ Worst Case     │ €168.000 │ €96.000 │ €122.000│ €113.000       │
  │ ──────────────┼──────────┼─────────┼─────────┼─────────         │
  │ ✅ Recommended │          │ ★       │         │                  │
  └──────────────────────────────────────────────────────────────────┘
```

### 5.4 FinancialQueryChat — `src/components/sales/financial-intelligence/FinancialQueryChat.tsx`

```
Αρχείο: src/components/sales/financial-intelligence/FinancialQueryChat.tsx
Εκτιμώμενες γραμμές: ~250

Τοποθεσία: Στο portfolio dashboard (SPEC-242C page), NOT στο InterestCostDialog.

Layout:
  ┌──────────────────────────────────────────────┐
  │ 🤖 Financial Assistant                       │
  │                                               │
  │ User: Ποιο project έχει το μεγαλύτερο        │
  │       cost of money;                          │
  │                                               │
  │ AI: Το project "Γλυφάδα Γ" έχει το           │
  │     μεγαλύτερο κόστος χρήματος στο           │
  │     7.8%, λόγω μεγάλης μέσης                 │
  │     περιόδου είσπραξης (420 ημέρες).         │
  │                                               │
  │     📊 Cost of Money per Project:             │
  │     [Bar Chart — auto-generated]              │
  │                                               │
  │ ┌─────────────────────────────────────┐      │
  │ │ Ρωτήστε για τα οικονομικά σας...    │      │
  │ └─────────────────────────────────────┘      │
  └──────────────────────────────────────────────┘

Capabilities:
  - Portfolio questions ("μέσο κόστος χρήματος")
  - Project-specific ("status Πανόραμα Α")
  - What-if ("αν αυξηθεί το Euribor κατά 100bps")
  - Comparison ("σύγκρινε Πανόραμα Α vs Κηφισιά Β")
```

---

## 6. File Inventory

### Νέα αρχεία

| File | Lines (est.) | Description |
|------|-------------|-------------|
| `src/lib/forward-curve-engine.ts` | ~200 | Yield curve, forward rate derivation |
| `src/lib/hedging-engine.ts` | ~280 | Swap/Cap/Collar NPV comparison |
| `src/app/api/ecb/forward-rates/route.ts` | ~120 | ECB API proxy for forward rates |
| `src/components/sales/payments/financial-intelligence/ForwardCurveChart.tsx` | ~220 | Yield curve visualization |
| `src/components/sales/payments/financial-intelligence/HedgingComparisonTable.tsx` | ~280 | Side-by-side comparison |
| `src/components/sales/financial-intelligence/FinancialQueryChat.tsx` | ~250 | NL chat interface |
| `src/services/ai-pipeline/tools/financial-query-tools.ts` | ~200 | Agentic tools for financial queries |

### Τροποποιημένα αρχεία

| File | Change |
|------|--------|
| `src/types/interest-calculator.ts` | +~80 lines: ForwardRatePoint, YieldCurveData, HedgeStrategy |
| `src/services/ai-pipeline/tools/agentic-tool-definitions.ts` | +6 financial tool definitions |
| `src/components/sales/payments/InterestCostDialog.tsx` | +2 tabs (Forward Curves, Hedging) |
| `src/components/sales/financial-intelligence/PortfolioDashboard.tsx` | +FinancialQueryChat section |
| `src/i18n/locales/el/payments.json` | +~60 keys: forwardCurves.*, hedging.*, financialQuery.* |
| `src/i18n/locales/en/payments.json` | +~60 keys |

---

## 7. i18n Keys

```json
{
  "forwardCurves": {
    "title": "Yield Curve & Forward Rates",
    "subtitle": "Πού πηγαίνουν τα επιτόκια — ECB derived",
    "spotCurve": "Spot Curve",
    "forwardCurve": "Forward Curve",
    "shape": {
      "normal": "Κανονική — τα επιτόκια αναμένεται να αυξηθούν",
      "inverted": "Ανεστραμμένη — τα επιτόκια αναμένεται να μειωθούν",
      "flat": "Επίπεδη — τα επιτόκια αναμένεται να παραμείνουν σταθερά",
      "humped": "Ακανόνιστη — μικτές προσδοκίες"
    },
    "tenor": "Tenor",
    "spotRate": "Spot Rate",
    "forwardRate": "Forward Rate",
    "asOfDate": "Ημερομηνία δεδομένων"
  },
  "hedging": {
    "title": "Hedging Simulator",
    "subtitle": "Swap vs Cap vs Collar — Ποια στρατηγική σας ταιριάζει;",
    "strategy": {
      "noHedge": "Χωρίς Hedge",
      "swap": "Interest Rate Swap",
      "cap": "Interest Rate Cap",
      "collar": "Interest Rate Collar"
    },
    "input": {
      "notional": "Ονομαστικό Ποσό",
      "term": "Διάρκεια (μήνες)",
      "currentRate": "Τρέχον Επιτόκιο",
      "fixedRate": "Σταθερό Επιτόκιο (Swap)",
      "capStrike": "Cap Strike",
      "floorStrike": "Floor Strike (Collar)",
      "premium": "Premium"
    },
    "results": {
      "effectiveRate": "Πραγματικό Επιτόκιο",
      "totalCost": "Συνολικό Κόστος",
      "npv": "NPV Hedge",
      "breakEven": "Break-Even Rate",
      "bestCase": "Καλύτερη Περίπτωση",
      "worstCase": "Χειρότερη Περίπτωση",
      "recommended": "Προτεινόμενη Στρατηγική"
    }
  },
  "financialQuery": {
    "title": "Financial Assistant",
    "placeholder": "Ρωτήστε για τα οικονομικά σας...",
    "thinking": "Αναλύω...",
    "error": "Σφάλμα στην ανάλυση. Δοκιμάστε ξανά.",
    "examples": {
      "title": "Παραδείγματα ερωτήσεων",
      "q1": "Ποιο project έχει το μεγαλύτερο κόστος χρήματος;",
      "q2": "Πόσα χρήματα εκκρεμούν συνολικά;",
      "q3": "Σύγκρινε τα δύο projects στην απόδοση",
      "q4": "Αν αυξηθεί το Euribor κατά 50bps, τι αλλάζει;"
    }
  }
}
```

---

## 8. Verification Criteria

1. **Forward rates**: Correct derivation from spot rates, mathematically verified
2. **Yield curve chart**: 2 lines (spot + forward), tenor labels, shape badge
3. **Curve shape detection**: Correct classification (normal/inverted/flat/humped)
4. **Swap calculation**: Fixed rate × notional × time, correct NPV
5. **Cap calculation**: Max(0, market - strike) per period + premium, break-even correct
6. **Collar calculation**: Bounded rate [floor, cap], net premium
7. **Comparison table**: 4 strategies side-by-side, recommended highlighted
8. **Break-even rates**: Correctly calculated for each strategy
9. **API route**: `/api/ecb/forward-rates` returns YieldCurveData, 24h cache
10. **NL chat**: Uses ADR-171 agentic loop with financial tools
11. **Financial tools**: 6 tools registered in agentic-tool-definitions
12. **Auto-generated charts**: Chat can produce bar/line charts from query results
13. **i18n**: EL + EN πλήρεις
14. **Zero `any`**, semantic HTML, enterprise TypeScript
15. **License**: ECB API = δημόσια δεδομένα (OK), OpenAI = already in stack (OK)
16. **No new dependencies**: ECB + OpenAI already configured

---

*SPEC Format: Google Engineering Design Docs standard — ADR-242 Smart Financial Intelligence Suite*
