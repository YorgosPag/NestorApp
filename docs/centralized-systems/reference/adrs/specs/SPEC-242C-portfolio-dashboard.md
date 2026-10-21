# SPEC-242C: Portfolio Dashboard & Debt Maturity Wall

| Field | Value |
|-------|-------|
| **ADR** | ADR-242 |
| **Phase** | C — Portfolio Intelligence |
| **Priority** | ⭐⭐⭐⭐ HIGH |
| **Status** | ✅ IMPLEMENTED |
| **Estimated Effort** | 2 sessions |
| **Prerequisite** | SPEC-234E (InterestCostDialog), ADR-234 (Payment Plans), ADR-197 (Sales) |
| **Dependencies** | Προαιρετικά SPEC-242A/B (χρησιμοποιεί DSCR engine, draw schedule data) |
| **Features** | C1 (Portfolio Dashboard) + A2 (Debt Maturity Wall) + C2 (Budget vs Actual Variance) |

---

## 1. Objective

Δημιουργία **νέας σελίδας** `/sales/financial-intelligence` — Portfolio-level financial dashboard. ΔΕΝ χωράει στο InterestCostDialog (αυτό είναι per-unit). Η σελίδα αυτή:

1. **Portfolio Dashboard** — Aggregate KPIs: σύνολο portfolio value, weighted avg cost of money, cash position
2. **Debt Maturity Wall** — Timeline: πότε λήγει κάθε δάνειο, refinancing exposure
3. **Budget vs Actual** — Waterfall chart: πού είμαστε over/under budget, variance trend

### Γιατί μαζί

| Κριτήριο | Εξήγηση |
|----------|---------|
| Portfolio-level | Αφορούν ΟΛΟΚΛΗΡΑ τα projects, όχι ένα unit |
| Ίδια σελίδα | Χρησιμοποιούν ίδια data source (aggregation) |
| Συμπληρωματικά | Dashboard = overview, Maturity = debt risk, Variance = execution risk |
| Ίδια αρχιτεκτονική | Data aggregation service + visualization components |

### Πηγές Έρευνας

| Πηγή | Feature | Τι πήραμε |
|------|---------|-----------|
| Yardi Voyager | Portfolio Dashboard | KPI cards, traffic-light indicators |
| Bloomberg DDIS | Debt Maturity Wall | Stacked bar per year, LTV overlay |
| Procore Financial | Budget vs Actual | Waterfall chart, change order impact |
| Northspyre | Variance Analysis | AI budget categorization, trend detection |
| ARGUS Enterprise | Portfolio Analytics | Aggregate cap rates, NOI trending |

---

## 2. Data Model

### 2.1 Portfolio Aggregation Types

```typescript
// ═══════════════════════════════════════════════════════════════
// PORTFOLIO DASHBOARD — Νέο αρχείο types ή extension
// ═══════════════════════════════════════════════════════════════

/** Summary KPIs across all projects */
export interface PortfolioSummary {
  /** Αριθμός active projects */
  activeProjects: number;
  /** Συνολικά units στο portfolio */
  totalUnits: number;
  /** Πουλημένα units */
  soldUnits: number;
  /** Μη πουλημένα units */
  unsoldUnits: number;
  /** Συνολική αξία portfolio (€) — sum of unit prices */
  totalPortfolioValue: number;
  /** Σύνολο εισπραχθέντων (€) */
  totalCollected: number;
  /** Σύνολο εκκρεμών εισπράξεων (€) */
  totalOutstanding: number;
  /** Weighted average cost of money (%) — across all units with plans */
  weightedAvgCostOfMoney: number;
  /** Weighted average collection period (days) */
  weightedAvgCollectionDays: number;
  /** Total NPV all payment plans (€) */
  totalNPV: number;
  /** Total time cost (€) — sum of salePrice - NPV per unit */
  totalTimeCost: number;
  /** Timestamp of calculation */
  calculatedAt: string;
}

/** Per-project financial summary */
export interface ProjectFinancialSummary {
  /** Project ID */
  projectId: string;
  /** Project name */
  projectName: string;
  /** Units stats */
  totalUnits: number;
  soldUnits: number;
  /** Total value (€) */
  totalValue: number;
  /** Total collected (€) */
  collected: number;
  /** Cost of money (%) — weighted avg for this project */
  costOfMoney: number;
  /** Average collection period (days) */
  avgCollectionDays: number;
  /** KPI status */
  healthStatus: 'excellent' | 'good' | 'warning' | 'critical';
}
```

### 2.2 Debt Maturity Types

```typescript
/** Single debt/loan maturity entry */
export interface DebtMaturityEntry {
  /** Loan/debt identifier */
  loanId: string;
  /** Project document ID — absent only on legacy free-text entries (see §9) */
  projectId?: string;
  /** Project display name — resolved server-side from projectId at write time */
  projectName: string;
  /** Loan type */
  loanType: 'construction' | 'mortgage' | 'bridge' | 'mezzanine';
  /** Outstanding principal (€) */
  outstandingBalance: number;
  /** Current interest rate (%) */
  currentRate: number;
  /** Maturity date (ISO string) */
  maturityDate: string;
  /** Months until maturity */
  monthsToMaturity: number;
  /** Estimated refinancing rate (%) — current market */
  estimatedRefiRate: number;
  /** LTV ratio at maturity (%) */
  ltvAtMaturity: number;
  /** DSCR at current rate */
  currentDSCR: number;
  /** Risk level */
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
}

/** Aggregated maturity wall data (per year) */
export interface MaturityWallYear {
  /** Year (e.g. 2027) */
  year: number;
  /** Total maturing debt (€) */
  totalMaturing: number;
  /** Entries maturing this year */
  entries: DebtMaturityEntry[];
  /** Average refinancing gap (current rate - market rate, bps) */
  avgRefiGapBps: number;
}
```

### 2.3 Budget Variance Types

```typescript
/** Budget vs Actual per category */
export interface BudgetVarianceEntry {
  /** Category name (e.g. "Θεμελίωση", "Η/Μ Εγκαταστάσεις") */
  category: string;
  /** i18n key for category */
  categoryKey: string;
  /** Budgeted amount (€) */
  budgetAmount: number;
  /** Actual spent (€) */
  actualAmount: number;
  /** Variance = actual - budget (€) — positive = over budget */
  variance: number;
  /** Variance percentage */
  variancePercent: number;
  /** Trend direction */
  trend: 'improving' | 'stable' | 'worsening';
}

/** Full variance analysis for a project */
export interface BudgetVarianceAnalysis {
  /** Project ID */
  projectId: string;
  /** Project name */
  projectName: string;
  /** Total budget (€) */
  totalBudget: number;
  /** Total actual (€) */
  totalActual: number;
  /** Overall variance (€) */
  totalVariance: number;
  /** Overall variance (%) */
  totalVariancePercent: number;
  /** Per-category breakdown */
  categories: BudgetVarianceEntry[];
  /** Top 3 categories by absolute variance */
  topVariances: BudgetVarianceEntry[];
}
```

---

## 3. Service Layer

### 3.1 Portfolio Aggregator — `src/services/financial-intelligence/portfolio-aggregator.ts`

```
Αρχείο: src/services/financial-intelligence/portfolio-aggregator.ts
Εκτιμώμενες γραμμές: ~300
Dependencies: Firestore (read-only), npv-engine.ts
Side effects: READ-ONLY Firestore queries
```

#### Data Flow

```
Firestore Sources:
  projects collection → active projects list
  units collection → per-project units, sold/unsold status
  payment_plans collection → installment data per unit
  settings/euribor_rates → current discount rate

Aggregation Pipeline:
  1. Fetch all active projects
  2. Per project: fetch units + payment plans
  3. Per unit with plan: run calculateNPV() from npv-engine
  4. Aggregate: weighted averages, totals, health scores
  5. Return PortfolioSummary + ProjectFinancialSummary[]
```

#### Health Status Logic

**SSoT**: `src/services/financial-intelligence/portfolio-health.ts` (`HEALTH_THRESHOLDS`, `rateMetric`, `assessHealth`, `combineAssessments`, `assessPortfolioKpis`) — used by the server aggregator **and** the KPI cards. Thresholds live nowhere else.

| Metric | Excellent | Good | Warning | Critical | No data |
|--------|-----------|------|---------|----------|---------|
| Cost of Money | < 3% | 3-5% | 5-8% | ≥ 8% | no unit reports it |
| Collection Period | < 180 days | 180-365 | 365-540 | ≥ 540 days | no unit reports it |
| Sold % | > 80% | 60-80% | 40-60% | ≤ 40% | project has no units |
| Collected % (KPI card) | > 75% | 50-75% | 25-50% | ≤ 25% | portfolio value is 0 |

Rules: (1) a metric without a sample is `null` → `noData`, **never** `0`; (2) project/portfolio status = worst **measured** metric, `noData` only if nothing was measured; (3) every assessment carries `drivers` — the metrics that set it — shown in the badge tooltip; (4) value-weighted portfolio averages count only projects that report the metric.

### 3.2 Variance Analyzer — `src/services/financial-intelligence/variance-analyzer.ts`

> ⚠️ **ΑΝΤΙΚΑΘΙΣΤΑΤΑΙ ΑΠΟ [ADR-917](../ADR-917-project-cost-taxonomy-budget-vs-actual.md)** (2026-10-20).
> Ο κώδικας **δεν** ακολούθησε αυτή την ενότητα: το `variance-analyzer.ts` **δεν υπάρχει**· η κάρτα γράφει χειροκίνητα
> στο `settings/budget_variance_{projectId}` (`api/financial-intelligence/budget-variance`). Η «Phase 2» (πηγές
> αντί για πληκτρολόγηση) σχεδιάζεται στο ADR-917. **Φ0 ✅**: έλεγχος ενοικίου στη διαδρομή + στο εργαλείο AI
> `get_budget_variance` (πριν: οποιοσδήποτε συνδεδεμένος χρήστης διάβαζε/έγραφε κάθε έργο με γνωστό ID).
> **Φ2 ✅** (2026-10-20): η κάρτα **διαβάζει** `GET /api/projects/[projectId]/cost-ledger` (BOQ + παραγγελίες, μόνο
> ανάγνωση, drill-down, πληρότητα)· το εργαλείο AI διαβάζει τον ίδιο πυρήνα. Η χειροκίνητη φόρμα μένει **κλειστή** και
> **δεν** τροφοδοτεί το γράφημα μέχρι την απόσυρση (ADR-917 Φ5).

```
Αρχείο: src/services/financial-intelligence/variance-analyzer.ts
Εκτιμώμενες γραμμές: ~200
Dependencies: Firestore (read-only)
Side effects: READ-ONLY Firestore queries
```

#### Data Sources

```
Budget data: project document → budgetCategories (array)
  Αν δεν υπάρχει → manual input via form

Actual data:
  Option A: accounting subapp invoices (ACC-001)
  Option B: manual input per category
  Option C: payment records (για εισπράξεις)

Σημείωση: Στο initial implementation, budget + actual
θα εισάγονται χειροκίνητα. Integration με accounting
subapp σε Phase 2.
```

---

## 4. UI Components

### 4.1 Component Tree

```
/sales/financial-intelligence (NEW PAGE)
  └── PortfolioDashboard.tsx (master container)
       ├── KPICardRow (4 KPI cards)
       │    ├── KPIAlertCard — Portfolio Value
       │    ├── KPIAlertCard — Cost of Money
       │    ├── KPIAlertCard — Collection Period
       │    └── KPIAlertCard — Sold %
       ├── ProjectsTable (per-project summary)
       ├── DebtMaturityWall.tsx (timeline/bar)
       └── BudgetVarianceChart.tsx (waterfall)
```

### 4.2 Page Route — `src/app/(protected)/sales/financial-intelligence/page.tsx`

```
Αρχείο: src/app/(protected)/sales/financial-intelligence/page.tsx
Εκτιμώμενες γραμμές: ~60
```

```
Next.js page component:
  - Protected route (within (protected) layout)
  - Imports PortfolioDashboard
  - Passes auth context
  - Title: "Financial Intelligence — Portfolio Overview"
```

### 4.3 PortfolioDashboard — `src/components/sales/financial-intelligence/PortfolioDashboard.tsx`

```
Αρχείο: src/components/sales/financial-intelligence/PortfolioDashboard.tsx
Εκτιμώμενες γραμμές: ~400

Layout (desktop):
┌──────────────────────────────────────────────────────────────────────┐
│ 📊 Financial Intelligence — Portfolio Overview        [⟳ Refresh]   │
│                                                                      │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│ │ 💰       │ │ 📉       │ │ ⏱️       │ │ 🏘️       │               │
│ │ €4.2M    │ │ 4.8%     │ │ 245 days │ │ 68%      │               │
│ │ Portfolio │ │ Cost of  │ │ Avg Coll.│ │ Sold     │               │
│ │ Value    │ │ Money    │ │ Period   │ │ Units    │               │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘               │
│                                                                      │
│ ┌─── Projects ────────────────────────────────────────────────────┐ │
│ │ Project        │ Units │ Sold │ Value    │ CoM  │ Status        │ │
│ │ ──────────────┼───────┼──────┼──────────┼──────┼────────────── │ │
│ │ Πανόραμα Α     │ 12    │ 9    │ €1.8M    │ 3.2% │ 🟢 Excellent │ │
│ │ Κηφισιά Β      │ 8     │ 5    │ €1.4M    │ 5.1% │ 🟡 Good      │ │
│ │ Γλυφάδα Γ      │ 6     │ 2    │ €1.0M    │ 7.8% │ 🟠 Warning   │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ ┌─── Debt Maturity Wall (see 4.4) ───────────────────────────────┐ │
│ │                                                                  │ │
│ └──────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ ┌─── Budget vs Actual (see 4.5) ─────────────────────────────────┐ │
│ │                                                                  │ │
│ └──────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.4 KPIAlertCard — `src/components/sales/financial-intelligence/KPIAlertCard.tsx`

```
Αρχείο: src/components/sales/financial-intelligence/KPIAlertCard.tsx
Εκτιμώμενες γραμμές: ~80
```

```
Reusable card component:
  Props:
    title: string (i18n key)
    value: string | number
    format: 'currency' | 'percentage' | 'days' | 'number'
    status: 'excellent' | 'good' | 'warning' | 'critical'
    icon: LucideIcon
    trend?: { direction: 'up' | 'down' | 'flat', value: string }
    threshold?: { warning: number, critical: number }

  Visual:
    - Colored left border (green/amber/red by status)
    - Icon top-left
    - Large value
    - Status badge (bottom)
    - Optional trend arrow
```

### 4.5 DebtMaturityWall — `src/components/sales/financial-intelligence/DebtMaturityWall.tsx`

```
Αρχείο: src/components/sales/financial-intelligence/DebtMaturityWall.tsx
Εκτιμώμενες γραμμές: ~250
```

#### Recharts BarChart

```
Type: BarChart (stacked)

X axis: Years (2026, 2027, 2028, ...)
Y axis: Maturing debt amount (€)

Stacked bars by loan type:
  construction → blue
  mortgage → green
  bridge → amber
  mezzanine → purple

Overlay line: weighted avg LTV per year

Annotations:
  - Red bar border if any entry has riskLevel = 'critical'
  - Tooltip: "2027: €800K maturing — 2 construction, 1 bridge"
  - Click bar → expand to see individual loans

Παράδειγμα:
  ┌──────────────────────────────────────────────┐
  │ 🏦 Debt Maturity Wall                        │
  │                                               │
  │ €1.2M │                      ┌──┐            │
  │       │           ┌──┐       │  │            │
  │ €0.8M │    ┌──┐   │  │  ┌──┐│  │            │
  │       │    │  │   │  │  │  ││  │            │
  │ €0.4M │    │  │   │  │  │  ││  │  ┌──┐     │
  │       │    │  │   │  │  │  ││  │  │  │     │
  │    0  │────┴──┴───┴──┴──┴──┴┴──┴──┴──┴──── │
  │         2026   2027   2028   2029   2030     │
  └──────────────────────────────────────────────┘
```

### 4.6 BudgetVarianceChart — `src/components/sales/financial-intelligence/BudgetVarianceChart.tsx`

```
Αρχείο: src/components/sales/financial-intelligence/BudgetVarianceChart.tsx
Εκτιμώμενες γραμμές: ~220
```

#### Recharts Waterfall Chart

```
Type: BarChart (waterfall pattern using invisible base bars)

X axis: Budget categories
Y axis: Variance amount (€)

Green bars: under budget (negative variance)
Red bars: over budget (positive variance)
Last bar: total variance

Tooltip: "{category}: Budget €{budget}, Actual €{actual}, Variance {sign}€{variance} ({percent}%)"

Παράδειγμα:
  ┌───────────────────────────────────────────────────┐
  │ 📊 Budget vs Actual Variance                      │
  │                                                    │
  │      │                    ┌──┐                     │
  │  +8% │               ┌──┐│  │                     │
  │      │          ┌──┐ │  ││  │                     │
  │   0% │──────────│  │─┤  ├┤  ├──────── ┌──┐       │
  │      │     ┌──┐ │  │ │  │         │  │       │
  │  -5% │┌──┐ │  │                        │  │       │
  │      ││  │ │  │                        │  │ TOTAL │
  │      │└──┘ └──┘                        └──┘       │
  │       Θεμ. Σκελ. Τοιχ. Η/Μ  Αποπ. Περ.           │
  └───────────────────────────────────────────────────┘
```

---

## 5. Navigation Integration

### 5.1 Smart Navigation

```
Τροποποίηση: src/config/smart-navigation-factory.ts

Νέο item στο sales section:
  {
    id: 'financial-intelligence',
    labelKey: 'navigation.financialIntelligence',
    href: '/sales/financial-intelligence',
    icon: BarChart3,  // from lucide-react
    badge: null,
  }
```

### 5.2 Navigation i18n

```json
// navigation.json additions
{
  "financialIntelligence": "Financial Intelligence"
}
// el/navigation.json
{
  "financialIntelligence": "Χρηματοοικονομική Ανάλυση"
}
```

---

## 6. File Inventory

### Νέα αρχεία

| File | Lines (est.) | Description |
|------|-------------|-------------|
| `src/app/(protected)/sales/financial-intelligence/page.tsx` | ~60 | Νέα σελίδα |
| `src/services/financial-intelligence/portfolio-aggregator.ts` | ~300 | Data aggregation |
| `src/services/financial-intelligence/variance-analyzer.ts` | ~200 | Budget vs actual |
| `src/components/sales/financial-intelligence/PortfolioDashboard.tsx` | ~400 | Master container |
| `src/components/sales/financial-intelligence/DebtMaturityWall.tsx` | ~250 | Timeline/bar chart |
| `src/components/sales/financial-intelligence/BudgetVarianceChart.tsx` | ~220 | Waterfall chart |
| `src/components/sales/financial-intelligence/KPIAlertCard.tsx` | ~80 | Reusable KPI card |

### Τροποποιημένα αρχεία

| File | Change |
|------|--------|
| `src/types/interest-calculator.ts` | +~80 lines: PortfolioSummary, DebtMaturityEntry, BudgetVarianceEntry |
| `src/config/smart-navigation-factory.ts` | +1 nav item |
| `src/i18n/locales/el/navigation.json` | +1 key |
| `src/i18n/locales/en/navigation.json` | +1 key |
| `src/i18n/locales/el/payments.json` | +~60 keys: portfolio.*, maturity.*, variance.* |
| `src/i18n/locales/en/payments.json` | +~60 keys |

---

## 7. i18n Keys

```json
{
  "portfolio": {
    "title": "Portfolio Overview",
    "subtitle": "Συγκεντρωτικά οικονομικά στοιχεία όλων των projects",
    "refresh": "Ανανέωση",
    "kpi": {
      "portfolioValue": "Αξία Portfolio",
      "costOfMoney": "Κόστος Χρήματος",
      "avgCollectionPeriod": "Μ.Ο. Είσπραξης",
      "soldPercent": "Πωλημένα %",
      "totalCollected": "Εισπραχθέντα",
      "totalOutstanding": "Εκκρεμή",
      "totalNPV": "Συνολικό NPV",
      "totalTimeCost": "Συνολικό Κόστος Χρόνου"
    },
    "projects": {
      "title": "Projects",
      "name": "Project",
      "units": "Units",
      "sold": "Πωλημένα",
      "value": "Αξία",
      "costOfMoney": "Κόστος",
      "status": "Κατάσταση",
      "excellent": "Εξαιρετικό",
      "good": "Καλό",
      "warning": "Προσοχή",
      "critical": "Κρίσιμο"
    }
  },
  "maturity": {
    "title": "Debt Maturity Wall",
    "subtitle": "Πότε λήγουν τα δάνεια — Refinancing exposure",
    "year": "Έτος",
    "totalMaturing": "Λήγουν",
    "loanType": {
      "construction": "Κατασκευαστικό",
      "mortgage": "Στεγαστικό",
      "bridge": "Bridge",
      "mezzanine": "Mezzanine"
    },
    "risk": {
      "low": "Χαμηλός Κίνδυνος",
      "moderate": "Μέτριος",
      "high": "Υψηλός",
      "critical": "Κρίσιμος"
    },
    "refiGap": "Refinancing Gap",
    "ltv": "LTV"
  },
  "variance": {
    "title": "Budget vs Actual",
    "subtitle": "Πού είμαστε over/under budget",
    "budget": "Προϋπολογισμός",
    "actual": "Πραγματικό",
    "variance": "Απόκλιση",
    "overBudget": "Υπέρβαση",
    "underBudget": "Κάτω",
    "total": "Σύνολο",
    "trend": {
      "improving": "Βελτιώνεται",
      "stable": "Σταθερό",
      "worsening": "Χειροτερεύει"
    },
    "selectProject": "Επιλέξτε Project",
    "noData": "Δεν υπάρχουν δεδομένα budget"
  }
}
```

---

## 8. Verification Criteria

1. **Page route**: `/sales/financial-intelligence` accessible, protected
2. **Portfolio aggregation**: Reads real data from Firestore projects + units + payment plans
3. **KPI cards**: 4 cards with correct values, traffic-light status
4. **Projects table**: Sortable, health status color-coded
5. **Debt maturity wall**: Stacked bars by year + loan type, click to expand
6. **Budget variance**: Waterfall chart, green/red bars, total
7. **Navigation**: New item in sales sidebar section
8. **Data refresh**: Manual refresh button, loading states
9. **Empty states**: Graceful handling when no projects/units/plans exist
10. **i18n**: EL + EN πλήρεις
11. **Zero `any`**, semantic HTML, enterprise TypeScript
12. **Recharts**: Reuse existing chart.tsx wrapper
13. **CSS**: No inline styles — use Tailwind + globals.css

---

## 9. Changelog

| Date | Change |
|------|--------|
| 2026-10-20 | **Health badges translated.** `HealthStatusBadge.tsx` is the single `HealthStatus` → badge variant + i18n label (`payments:portfolio.healthStatus.*`). Before: `KPIAlertCard` carried hardcoded English labels, the projects table rendered the raw enum (`critical`), and the variant map was copied in 3 files (`DebtMaturityWall` now imports `HEALTH_BADGE_VARIANT`). |
| 2026-10-20 | **Debt Maturity project = picker, not free text.** The add-loan form selects from the portfolio's projects (Radix `Select`, ADR-001). The client sends `projectId`; `POST /api/financial-intelligence/debt-maturity` resolves the display name from the project document via `resolveCompanyProjectName` (`src/services/financial-intelligence/project-reference.ts`) and answers 404 for a missing project **or one of another company**. Entries written before this change keep only `projectName` (no migration — the name is still displayed). Test: `src/services/financial-intelligence/__tests__/project-reference.test.ts`. |
| 2026-10-20 | **«Χωρίς δεδομένα» + explainable health** (§3.1 Health Status Logic). Measured bug: every project with 0 units showed **Critical** (0% sold), while the empty portfolio's cost-of-money and collection cards showed **Excellent** (0.00% / 0d) — both fabricated from missing data. Now: `HealthStatus` gains `noData` (neutral `muted` badge); `ProjectFinancialSummary.costOfMoney/avgCollectionDays` and `PortfolioSummary.weightedAvg*` are `number \| null` (UI shows «—»); `ProjectFinancialSummary.healthDrivers` names the deciding metrics, shown in the badge tooltip («Καθορίζεται από: Ποσοστό πωλήσεων»). Also fixed: portfolio weighted averages used to give weight to projects that did not report the metric, dragging the average towards 0. The collected-share card moved from an ad-hoc `> 50% good / else warning` to the shared 4-band thresholds. Precedent: monitoring tools (e.g. Datadog) keep «No Data» as its own state, distinct from OK and Alert. Test: `__tests__/portfolio-health.test.ts`. |
| 2026-10-20 | **Read / compute split.** `aggregatePortfolio` was one ~160-line function mixing Firestore reads with arithmetic (N.7.1: max 40). Now `portfolio-aggregator.ts` only reads (`readLiveUnits` — tenant-scoped, retired units excluded) and the pure `portfolio-rollup.ts` computes: `readUnitFinancials` (unit doc → `UnitFinancials`, missing metrics `null`) → `rollUpProject` (summary + health) → `rollUpPortfolio` (totals + value-weighted averages over reporting projects only). Behaviour unchanged; the rollup had **no tests** and now has `__tests__/portfolio-rollup.test.ts` (mutation-checked). |
| 2026-10-20 | **Project picker shows full names.** The list of the «Έργο» picker (add-loan form, `DebtMaturityWall`) and the variance project picker (`BudgetVarianceChart`) had the narrow trigger's width, so long names were cut («ΕΡΓΟ ΙΩΑΝΝΙΝΩΝ —…»). Both now use `<SelectContent width="content">` — a generic option added **once** in `ui/select` (ADR-001 «Content width»): the list grows to the longest name, never narrower than the trigger, capped at `min(28rem, available viewport width)`; past the cap the label wraps instead of truncating. The trigger keeps its single-line ellipsis; the full name is one click away in the list. Verified on localhost (add-loan form, 10 projects): trigger 189px → list 329px, every name on one line, none clipped (`scrollWidth ≤ clientWidth`). Test: `src/components/ui/__tests__/select-content-width.test.tsx`. |

---

*SPEC Format: Google Engineering Design Docs standard — ADR-242 Smart Financial Intelligence Suite*
