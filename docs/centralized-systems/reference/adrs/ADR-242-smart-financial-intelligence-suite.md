# ADR-242: Smart Financial Intelligence Suite — Enterprise Features for InterestCostDialog

| Metadata | Value |
|----------|-------|
| **Status** | 🟡 IN PROGRESS — SPEC-242A✅ B✅ C✅ D✅ E🟡 |
| **Date** | 2026-03-18 |
| **Category** | Entity Systems / Sales & Finance |
| **Priority** | P2 — Strategic Enhancement |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Related** | ADR-234 (Payment Plan & Installment Tracking), ADR-198 (Sales-Accounting Bridge), ADR-197 (Sales Pages) |

---

## 1. Context & Motivation

### 1.1 Τρέχουσα Κατάσταση

Το InterestCostDialog (ADR-234 Phase 4, SPEC-234E) υλοποιεί ήδη:

| Feature | Status |
|---------|--------|
| Cash Flow Analysis (per-installment NPV) | ✅ Implemented |
| Scenario Comparison (Cash / Off-Plan / Loan / Current) | ✅ Implemented |
| Pricing Recommendation (highlighted callout) | ✅ Implemented |
| Settings (discount rate source, bank spread, refresh) | ✅ Implemented |
| Euribor rate fetching + caching | ✅ Implemented |
| Bank spread configuration | ✅ Implemented |
| Fullscreen mode (ADR-241) | ✅ Implemented |

**Αρχείο:** `src/components/sales/payments/InterestCostDialog.tsx`

### 1.2 Γιατί Αυτή η Έρευνα

Ο Γιώργος ζήτησε βαθιά έρευνα: *"Τι κάνουν οι μεγάλοι; Bloomberg, Goldman Sachs, Procore, fintech — ποια features θα μας κάνουν enterprise-class;"*

Στόχος: να μετατρέψουμε το InterestCostDialog από απλό NPV calculator σε **Financial Intelligence Hub** επιπέδου enterprise real estate development.

### 1.3 Methodology

Έρευνα σε 20+ πηγές:

| Πηγή | Τομέας | Κύρια Features |
|------|--------|----------------|
| Bloomberg Terminal (SWPM, FWCV, PORT) | Market Data / Rate Forecasting | Forward curves, swap pricing, Monte Carlo |
| Goldman Sachs Capital Solutions | Debt Advisory / Hedging | Rate hedging, JV waterfalls |
| JP Morgan CRE | Interest Rate Risk | Cap/Swap/Collar strategies |
| Procore Financial Management | Construction Finance | Budget snapshots, change order tracking |
| Yardi Voyager / Debt Manager | Property Management | Debt maturity wall, portfolio analytics |
| Northspyre | Development Intelligence | AI budget categorization, variance analysis |
| ARGUS Enterprise (Altus Group) | DCF / Valuation | Lease-level cash flow, sensitivity analysis |
| CoStar / MSCI Real Capital Analytics | Market Intelligence | Cap rates, comparable sales, 6M+ properties |
| Chatham Financial | Hedging Advisory | Swap/cap/collar simulator |
| Built Technologies / Rabbet | Construction Lending | Draw schedule modeling, loan monitoring |
| Brex / Ramp / Modern Treasury | Treasury Management | Auto-reconciliation, payment optimization |

---

## 2. Ευρήματα Έρευνας — 12 Enterprise Features

### Κατηγορία A: Market Intelligence & Rate Forecasting

---

#### A1. Real-Time Interest Rate Dashboard with Forward Curves

**Πηγή:** Bloomberg Terminal (SWPM, FWCV functions), Chatham Financial

**Πρόβλημα:** Οι developers χρειάζονται visibility στο πού πηγαίνουν τα επιτόκια πριν κλειδώσουν όρους δανείου ή refinancing. Χωρίς forward curves, λαμβάνουν αποφάσεις στα τυφλά.

**Παρουσίαση Δεδομένων:**
- Interactive yield curve charts
- Forward rate tables (1m / 3m / 6m / 1y / 2y)
- Color-coded alerts όταν η καμπύλη ανατρέπεται ή το spread ξεπερνά thresholds

**AI/ML:** Bloomberg χρησιμοποιεί time-series modeling και regression analysis.

| Impact | Complexity | External API |
|--------|------------|-------------|
| **High** | **High** | **Yes** — ECB Rate APIs |

**Σύνδεση με Nestor:** Το InterestCostDialog ήδη κάνει fetch Euribor rates. Η επέκταση σε forward curves θα δώσει **predictive** capability.

---

#### A2. Debt Maturity Wall & Refinancing Risk Monitor

**Πηγή:** Yardi Debt Manager, Bloomberg (DDIS function)

**Πρόβλημα:** Portfolio owners χρειάζονται visibility σε πότε λήγει κάθε δάνειο, πώς θα είναι το refinancing environment, και το gap μεταξύ τρέχοντος και market rate.

**Παρουσίαση Δεδομένων:**
- Timeline/Gantt chart of loan maturities
- Bar charts annual debt coming due
- Traffic-light risk indicators (green/amber/red) βάσει LTV & DSCR at projected refi rate

| Impact | Complexity | External API |
|--------|------------|-------------|
| **High** | **Medium** | **No** — Λειτουργεί με user-entered loan data. Optional: rate feed |

**Σύνδεση με Nestor:** Μπορεί να αξιοποιήσει τα existing loan data από payment plans (ADR-234).

---

#### A3. Interest Rate Hedging Simulator (Swap / Cap / Collar)

**Πηγή:** JP Morgan CRE Hedging, Chatham Financial, Derivative Logic

**Πρόβλημα:** Developers με floating-rate construction loans χρειάζονται evaluation: cap vs. swap vs. collar — κόστος vs. protection level.

**Παρουσίαση Δεδομένων:**
- Side-by-side comparison: Swap vs. Cap vs. Collar
- Upfront cost, effective rate range, break-even scenario, NPV impact
- Interactive sliders για strike rates

**AI/ML:** Monte Carlo simulation για rate path probabilities.

| Impact | Complexity | External API |
|--------|------------|-------------|
| **High** | **High** | **Yes** — Real-time swap/cap pricing |

---

### Κατηγορία B: Advanced Scenario Modeling

---

#### B1. Multi-Scenario NPV/IRR Engine with Sensitivity Analysis

**Πηγή:** ARGUS Enterprise, PropertyMetrics, Adventures in CRE

**Πρόβλημα:** Ένα μόνο NPV number είναι άχρηστο — οι developers χρειάζονται Best / Base / Worst Case και ποιες μεταβλητές έχουν τον μεγαλύτερο αντίκτυπο.

**Παρουσίαση Δεδομένων:**
- **Tornado charts** (κάθε μεταβλητή → NPV impact)
- **Sensitivity matrices** (2-variable grid: rate vs. exit cap)
- Scenario comparison tables με color-coded deltas

| Impact | Complexity | External API |
|--------|------------|-------------|
| **High** | **Medium** | **No** — Pure computation |

**Σύνδεση με Nestor:** Το InterestCostDialog ήδη κάνει scenario comparison. Η προσθήκη tornado chart + sensitivity matrix είναι η πιο **high-value / low-effort** επέκταση.

---

#### B2. Equity Waterfall Distribution Modeling

**Πηγή:** Adventures in CRE, Goldman Sachs Capital Solutions

**Πρόβλημα:** JV/LP-GP structures χρειάζονται ακριβή υπολογισμό: ποιος παίρνει τι σε κάθε return hurdle (preferred return, promote tiers). Λάθος υπολογισμός = νομικές διαφορές.

**Παρουσίαση Δεδομένων:**
- Tiered waterfall visualization (έως 5 tiers)
- IRR hurdle vs. equity multiple hurdle toggle
- GP catch-up calculation
- LP-first vs. pari-passu return of capital

| Impact | Complexity | External API |
|--------|------------|-------------|
| **High** | **High** | **No** — Pure financial math |

---

#### B3. Construction Loan Draw Schedule & Interest Reserve Modeling

**Πηγή:** Built Technologies, Land Gorilla, Rabbet, Cync Software

**Πρόβλημα:** Κατά την κατασκευή, οι developers σηκώνουν κεφάλαια σε στάδια. Χρειάζονται modeling: πότε κάθε draw, πόσος τόκος, αν αρκεί το interest reserve, συνολικό κόστος κεφαλαίου.

**Παρουσίαση Δεδομένων:**
- Gantt-style draw timeline
- Cumulative interest accrual chart
- Interest reserve depletion curve + "reserve exhaustion date" alert
- Budget-to-draw alignment tracker

**AI/ML:** Rabbet uses ML to flag budget overruns automatically.

| Impact | Complexity | External API |
|--------|------------|-------------|
| **High** | **Medium** | **No** — User-entered draw schedule + loan terms |

**Σύνδεση με Nestor:** Direct fit — ο Γιώργος πουλάει ακίνητα off-plan, τα construction loans είναι core business.

---

### Κατηγορία Γ: Portfolio & Risk Analytics

---

#### C1. Portfolio-Level Financial Dashboard with KPI Alerts

**Πηγή:** Yardi Voyager, Northspyre, ARGUS Enterprise

**Πρόβλημα:** Developers με πολλαπλά projects χρειάζονται single view financial health — όχι per-project spreadsheets.

**Παρουσίαση Δεδομένων:**
- Executive dashboard: total portfolio value, weighted average cap rate
- Aggregate DSCR, LTV distribution, NOI trending
- Cash-on-cash return per property
- Email/push alerts when KPIs breach thresholds

**AI/ML:** Northspyre uses patented AI budget categorizations.

| Impact | Complexity | External API |
|--------|------------|-------------|
| **High** | **Medium** | **No** — Aggregation of internal project data |

**Σύνδεση με Nestor:** Μπορεί να αξιοποιήσει υπάρχοντα unit/project data + payment plans.

---

#### C2. Budget vs. Actual Variance Analysis with Cost Trending

**Πηγή:** Procore Financial Management, Northspyre

**Πρόβλημα:** Τα construction budgets αλλάζουν πάντα. Χρειάζεται ακριβής εικόνα: πού είμαστε over/under budget, γιατί, και τη trend direction.

**Παρουσίαση Δεδομένων:**
- Budget & Forecast Snapshots (historical comparison at any point)
- Change order impact waterfall
- Cost code-level drill-down
- AI-powered pattern detection across similar projects

**AI/ML:** Procore auto-aligns change orders to budget lines. Northspyre uses AI for anomaly detection.

| Impact | Complexity | External API |
|--------|------------|-------------|
| **High** | **Medium** | **No** — Internal budget/accounting data |

---

#### C3. DSCR Stress Testing

**Πηγή:** Yardi Debt Manager, Bloomberg, Goldman Sachs debt advisory

**Πρόβλημα:** Lenders απαιτούν ελάχιστο DSCR (τυπικά 1.20-1.25x). Developers χρειάζονται stress test: *"Αν τα rates ανέβουν 200bps, περνάω ακόμα covenant;"*

**Παρουσίαση Δεδομένων:**
- DSCR gauge (speedometer-style)
- Rate sensitivity table: DSCR at +50/+100/+150/+200bps
- Covenant breach probability indicator
- Time-series DSCR projection

| Impact | Complexity | External API |
|--------|------------|-------------|
| **High** | **Medium** | **No** — User inputs. Optional: rate forecasts |

---

### Κατηγορία Δ: Automation & AI Features

---

#### D1. AI Cash Flow Forecasting with Monte Carlo Simulation

**Πηγή:** Bloomberg (PORT function), Morgan Stanley RE Research, Modern Treasury

**Πρόβλημα:** Παραδοσιακές cash flow projections χρησιμοποιούν single-point estimates. Τα πραγματικά projects έχουν probabilistic outcomes — η AI μπορεί να μοντελοποιήσει χιλιάδες σενάρια ταυτόχρονα.

**Παρουσίαση Δεδομένων:**
- Probability distribution fan chart (P10 / P50 / P90 cash flow bands)
- Confidence intervals σε IRR/NPV
- Probability of meeting minimum return thresholds
- Monte Carlo histogram of terminal values

**AI/ML:** Monte Carlo engines generating 10,000+ σενάρια μεταβάλλοντας: rates, occupancy, construction timeline, exit cap rate.

| Impact | Complexity | External API |
|--------|------------|-------------|
| **High** | **High** | **No** — Computational. Benefits from historical datasets |

---

#### D2. Predictive Cost Overrun Detection

**Πηγή:** Northspyre, Cherre, Procore (emerging)

**Πρόβλημα:** Μέχρι ένα cost overrun να γίνει ορατό στο traditional reporting, είναι ήδη αργά. Η AI μπορεί να ανιχνεύσει patterns πριν υλοποιηθούν.

**Παρουσίαση Δεδομένων:**
- Risk score per budget line (0-100)
- Early warning alerts: *"Material costs trending 12% above comparable projects"*
- Historical pattern comparison

**AI/ML:** ML models trained on historical project data. Μια mid-sized construction company πέτυχε 20% μείωση καθυστερήσεων και 15% μείωση κόστους.

| Impact | Complexity | External API |
|--------|------------|-------------|
| **High** | **High** | **No** — Internal ML model. Benefits from historical data |

---

#### D3. Natural Language Financial Query (Conversational Analytics)

**Πηγή:** Northspyre, Bloomberg Terminal GPT integration (emerging)

**Πρόβλημα:** Executives θέλουν απαντήσεις σαν: *"Ποιο είναι το blended cost of debt στο portfolio Αθηνών;"* χωρίς να πλοηγούνται σε complex dashboards.

**Παρουσίαση Δεδομένων:**
- Chat-style interface
- Auto-generated charts από natural language queries
- Exportable answers with source data citations

**AI/ML:** LLM integration (GPT-4o / Claude) με structured financial data.

| Impact | Complexity | External API |
|--------|------------|-------------|
| **Medium** | **High** | **Yes** — OpenAI/Anthropic API (ήδη στο stack) |

**Σύνδεση με Nestor:** Ήδη υπάρχει AI pipeline (ADR-171 agentic loop). Η επέκταση σε financial queries είναι natural evolution.

---

## 3. Summary Matrix — Ταξινόμηση κατά Αξία / Πολυπλοκότητα

| # | Feature | Impact | Complexity | External API | Priority Score |
|---|---------|--------|------------|-------------|----------------|
| **B1** | Multi-Scenario NPV/IRR + Sensitivity | High | Medium | No | ⭐⭐⭐⭐⭐ |
| **B3** | Construction Loan Draw & Interest Reserve | High | Medium | No | ⭐⭐⭐⭐⭐ |
| **C3** | DSCR Stress Testing | High | Medium | No | ⭐⭐⭐⭐⭐ |
| **C1** | Portfolio Financial Dashboard + KPI Alerts | High | Medium | No | ⭐⭐⭐⭐ |
| **C2** | Budget vs. Actual Variance Analysis | High | Medium | No | ⭐⭐⭐⭐ |
| **A2** | Debt Maturity Wall & Refi Risk Monitor | High | Medium | Optional | ⭐⭐⭐⭐ |
| **D1** | Monte Carlo Cash Flow Simulation | High | High | No | ⭐⭐⭐ |
| **B2** | Equity Waterfall Distribution | High | High | No | ⭐⭐⭐ |
| **A1** | Interest Rate Dashboard + Forward Curves | High | High | Yes (ECB) | ⭐⭐⭐ |
| **D2** | Predictive Cost Overrun Detection | High | High | No | ⭐⭐⭐ |
| **A3** | Interest Rate Hedging Simulator | High | High | Yes | ⭐⭐ |
| **D3** | Natural Language Financial Query | Medium | High | Yes (OpenAI) | ⭐⭐ |

**Priority Score Logic:** Impact × (1/Complexity) × (No API bonus)

---

## 4. Προτεινόμενες Φάσεις Υλοποίησης

### Phase 1: Quick Wins — Χωρίς External APIs (est. 2-3 sessions)

| Feature | Τι προσθέτει στο InterestCostDialog |
|---------|-------------------------------------|
| **B1** Sensitivity Analysis | 5th tab: Tornado chart + 2-variable sensitivity matrix |
| **C3** DSCR Stress Testing | DSCR gauge + rate sensitivity table in existing tabs |
| **B3** Construction Loan Draw | New section: draw schedule, interest reserve depletion |

**Αρχιτεκτονική:** Νέα tabs/sections στο InterestCostDialog + pure math functions στο `npv-engine.ts`.

### Phase 2: Portfolio Intelligence (est. 3-4 sessions)

| Feature | Τι προσθέτει |
|---------|-------------|
| **C1** Portfolio Dashboard | New page: `/sales/financial-intelligence` |
| **C2** Budget vs. Actual | Integration with accounting subapp (ACC) |
| **A2** Debt Maturity Wall | New component: timeline visualization |

**Αρχιτεκτονική:** Νέα σελίδα + data aggregation service.

### Phase 3: Advanced Modeling (est. 4-5 sessions)

| Feature | Τι προσθέτει |
|---------|-------------|
| **D1** Monte Carlo Simulation | P10/P50/P90 fan charts, 10,000 scenario engine |
| **B2** Equity Waterfall | New dialog: JV distribution calculator |
| **A1** Forward Curves | ECB API integration, yield curve visualization |

**Αρχιτεκτονική:** Monte Carlo engine in Web Worker, ECB rate API route.

### Phase 4: AI-Powered (est. 3-4 sessions)

| Feature | Τι προσθέτει |
|---------|-------------|
| **D2** Predictive Overrun | ML model for cost prediction (needs historical data) |
| **D3** NL Financial Query | Chat interface for financial questions |
| **A3** Hedging Simulator | Swap/Cap/Collar comparison tool |

**Αρχιτεκτονική:** Extension of ADR-171 agentic loop + new financial tools.

---

## 5. Τεχνική Αρχιτεκτονική (High-Level)

### 5.1 Δομή Αρχείων (Proposed)

```
src/
├── lib/
│   ├── npv-engine.ts              ← EXISTING — extend with sensitivity + Monte Carlo
│   ├── dscr-engine.ts             ← NEW — DSCR calculations + stress testing
│   ├── draw-schedule-engine.ts    ← NEW — construction loan draw modeling
│   └── waterfall-engine.ts        ← NEW — equity waterfall calculations
├── components/sales/payments/
│   ├── InterestCostDialog.tsx     ← EXISTING — add new tabs
│   ├── SensitivityTab.tsx         ← NEW — tornado chart + matrix
│   ├── DSCRGauge.tsx              ← NEW — speedometer widget
│   ├── DrawScheduleChart.tsx      ← NEW — Gantt-style draw timeline
│   └── MonteCarloChart.tsx        ← NEW — fan chart visualization
├── types/
│   └── interest-calculator.ts     ← EXISTING — extend with new types
└── services/
    └── financial-intelligence/    ← NEW — portfolio-level aggregation
        ├── portfolio-aggregator.ts
        └── variance-analyzer.ts
```

### 5.2 Σχέση με Existing ADRs

```
ADR-234 (Payment Plans)
    ├── SPEC-234E (InterestCostDialog) ← τρέχον
    └── ADR-242 (Financial Intelligence Suite) ← ΑΥΤΟ ΤΟ ADR
         ├── Phase 1: Sensitivity + DSCR + Draw Schedule
         ├── Phase 2: Portfolio Dashboard
         ├── Phase 3: Monte Carlo + Waterfall + Forward Curves
         └── Phase 4: AI-Powered Features

ADR-171 (Agentic Loop) ← D3 Natural Language Query
ADR-198 (Sales-Accounting Bridge) ← C2 Budget vs. Actual
ACC-001 (Invoice Types) ← C2 Budget vs. Actual
```

---

## 6. Πηγές Έρευνας (Sources)

### Market Data & Rate Intelligence
1. Bloomberg Terminal — SWPM (Swap Manager), FWCV (Forward Curves), PORT (Portfolio Analytics)
2. Chatham Financial — Interest Rate Risk Management Solutions
3. JP Morgan — Hedging Interest Rates in Commercial Real Estate (2025 insights)
4. Derivative Logic — Rate Cap, Swap and Collar: The Hedger's Guide

### Real Estate Development Platforms
5. Procore — Construction Financial Management (Budget Snapshots, Forecasting)
6. Northspyre — AI-Powered Budget Categorization, Forecasting, Enterprise Year in Review 2025
7. ARGUS Enterprise (Altus Group) — DCF Analysis, Property Valuation
8. Yardi Voyager — Debt Manager, Investment Suite
9. CoStar — Market Analytics (6M+ properties, 3,000+ submarkets)
10. MSCI Real Capital Analytics — 1.8M+ real estate transactions database

### Construction Lending
11. Built Technologies — Construction Loan Management Software
12. Rabbet — Construction Loan Monitoring Reports (8 essential report types)
13. Land Gorilla — Construction Loan Administration

### Treasury & Fintech
14. Brex — Corporate Treasury Management
15. Ramp — Treasury Management Systems (ML-driven savings)
16. Modern Treasury — Automated Ledger-to-Bank Matching

### Advisory & Research
17. Goldman Sachs — Capital Solutions (Debt Advisory, JV Structuring)
18. Morgan Stanley — AI in Real Estate 2025 Research Report
19. Adventures in CRE — Real Estate Equity Waterfall Modeling
20. PropertyMetrics — NPV/IRR Sensitivity Analysis for RE

---

## 7. Implementation SPECs

| SPEC | Features | Priority | Effort | Dependencies |
|------|----------|----------|--------|-------------|
| [SPEC-242A](specs/SPEC-242A-sensitivity-dscr.md) | B1 Sensitivity Analysis + C3 DSCR Stress Testing | ⭐⭐⭐⭐⭐ | 1 session | None — ΠΡΩΤΟ |
| [SPEC-242B](specs/SPEC-242B-draw-schedule.md) | B3 Construction Loan Draw Schedule | ⭐⭐⭐⭐⭐ | 1 session | None — ΠΑΡΑΛΛΗΛΑ με A |
| [SPEC-242C](specs/SPEC-242C-portfolio-dashboard.md) | C1 Portfolio Dashboard + A2 Debt Maturity + C2 Variance | ⭐⭐⭐⭐ | 2 sessions | Optional A/B |
| [SPEC-242D](specs/SPEC-242D-monte-carlo-waterfall.md) | D1 Monte Carlo + B2 Equity Waterfall | ⭐⭐⭐ | 2 sessions | SPEC-242A |
| [SPEC-242E](specs/SPEC-242E-forward-curves-hedging-ai.md) | A1 Forward Curves + A3 Hedging + D3 NL Query | ⭐⭐ | 2-3 sessions | SPEC-242A + C | 🟡 Session 1/2 done |

**Εξαιρείται:** D2 (Predictive Cost Overrun) — χρειάζεται historical data, μελλοντικό SPEC-242F.

### Dependency Graph

```
SPEC-242A (Sensitivity + DSCR)    ← ΠΡΩΤΟ
SPEC-242B (Draw Schedule)         ← ΠΑΡΑΛΛΗΛΑ με A
    ↓
SPEC-242C (Portfolio Dashboard)   ← ΜΕΤΑ A+B
SPEC-242D (Monte Carlo + Waterfall) ← ΜΕΤΑ A
    ↓
SPEC-242E (Forward Curves + AI)   ← ΤΕΛΕΥΤΑΙΟ
```

---

## 8. Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-18 | Initial research document — 12 features across 4 categories | Claude Code + Γιώργος |
| 2026-03-18 | Created 5 SPEC files (SPEC-242A through SPEC-242E) with full implementation details | Claude Code |
| 2026-03-18 | SPEC-242E Session 1: Forward Curves (engine+API+UI) + Hedging Simulator (engine+UI) — 5 new files, 1,281 lines. NL Query pending Session 2. | Claude Code |
