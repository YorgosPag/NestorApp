# ADR-266: Gantt & Construction Schedule Reports

**Status**: PHASE C COMPLETE (Sub-phases 1+2+3+4+5 complete)
**Date**: 2026-03-29
**Author**: Claude (Research Agents × 4)
**Related ADRs**: ADR-034 (Gantt Chart), ADR-265 (Enterprise Reports System), ADR-175 (BOQ/Quantity Surveying)

### Changelog
| Date | Changes |
|------|---------|
| 2026-03-28 | Initial research & architecture — DRAFT for review |
| 2026-03-28 | **Phase A IMPLEMENTED**: 8 new files, 7 modified — Dashboard view toggle, KPIs, S-Curve, Variance Table, Lookahead, Export (PDF/Excel), i18n (el+en) |
| 2026-03-28 | **Phase B IMPLEMENTED**: 3 new files, 7 modified — DelayBreakdownChart, Owner Report PDF, Gantt Table PDF, S-Curve Brush zoom, 4 export options |
| 2026-03-28 | **Phase C Sub-phase 1 IMPLEMENTED**: delayReason + delayNote fields — SSoT DELAY_REASONS array, conditional UI in dialog, per-reason stacked bar chart, API + i18n. Also refactored: route.ts split (229+186), dialog split (490+186+245+79) |
| 2026-03-28 | **Phase C Sub-phase 2 IMPLEMENTED**: Critical Path Method — CPM algorithm (forward/backward pass, Kahn's cycle detection), CriticalPathCard rewrite with real data, CriticalPathSection dashboard table, 7th KPI card, useCriticalPath hook, i18n (en+el) |
| 2026-03-28 | **Phase C Sub-phase 3 IMPLEMENTED**: Baseline Snapshots — Firestore `construction_baselines` collection, `cbase_` enterprise IDs, API routes (GET list/detail, POST create, DELETE), client services, `useBaselineComparison` hook, `BaselineSection` UI (save dialog, list, compare toggle, delete), Variance Table baseline columns (start/end/vs baseline), i18n (en+el) |
| 2026-03-29 | **Phase C Sub-phase 4 IMPLEMENTED**: Resource Allocation — Firestore `construction_resource_assignments`, `crasn_` enterprise IDs, API route (GET/POST/PATCH/DELETE), cascade delete on task/phase deletion, client service + `useResourceAssignments` hook, `ResourceAssignmentSection` in task edit dialog (workers + equipment), `ResourceHistogramChart` (stacked bar/week, 40h capacity line), `ResourceUtilizationKPIs` (3 cards), `DelayFieldsSection` extracted, i18n (en+el) |
| 2026-03-29 | **Phase C Sub-phase 5 IMPLEMENTED**: Accessibility (WCAG AA) — Charts: `<figure role="img">` wrappers + sr-only data tables (SCurveChart, DelayBreakdownChart, ResourceHistogramChart). Tables: `<th scope="row">` on first column + `aria-expanded` on expandable phase rows (ScheduleVarianceTable, LookaheadTable, CriticalPathSection). KPI Cards: keyboard support (`role="button"`, `tabIndex`, `onKeyDown` Enter/Space, `aria-label`, focus-visible ring) in ReportKPIGrid. i18n (en+el) |

---

## 1. EXECUTIVE SUMMARY

Η εφαρμογή διαθέτει **πλήρες interactive Gantt** (ADR-034) και **Reports System** (ADR-265) με 13 phases ολοκληρωμένες. Η Phase 11 (Construction) καλύπτει ήδη EVM KPIs, milestone completion, phase progress, και BOQ cost breakdown.

**Τι ΛΕΙΠΕΙ** και προτείνεται σε αυτό το ADR:
- **Schedule Variance Report** — Planned vs Actual ανά task/phase (As-Planned vs As-Built)
- **S-Curve Chart** — Cumulative progress & cost σε χρόνο (ήδη υπάρχει `generateSCurveData()` στον evm-calculator!)
- **Lookahead Report** — Τι έρχεται τις επόμενες 2/4 εβδομάδες
- **Gantt PDF (Static)** — Print-ready Gantt εξαγωγή για αποστολή σε πελάτη/ιδιοκτήτη
- **Delay Analysis Summary** — Κατηγοριοποίηση & σύνοψη καθυστερήσεων

**Δεν χρειάζεται ΚΑΜΙΑ νέα library.** Όλα γίνονται με τα υπάρχοντα (recharts, jspdf, exceljs, html-to-image).

---

## 2. ΥΠΑΡΧΟΥΣΑ ΥΠΟΔΟΜΗ (Inventory)

### 2.1 Data Layer (ΗΔΗ ΥΠΑΡΧΕΙ)

| Component | Location | Γραμμές | Τι κάνει |
|-----------|----------|---------|----------|
| `ConstructionPhase` type | `src/types/building/construction.ts` | 130 | Phase entity (status, planned/actual dates, progress) |
| `ConstructionTask` type | ↑ | ↑ | Task entity (dependencies[], planned/actual dates, progress) |
| `BOQItem` type | `src/types/boq/boq.ts` | 295 | BOQ entity (linkedPhaseId, linkedTaskId, costs) |
| `construction-templates.ts` | `src/config/construction-templates.ts` | 250 | 15 phases, 60+ predefined tasks |
| `firestore-collections.ts` | `src/config/firestore-collections.ts` | — | CONSTRUCTION_PHASES, CONSTRUCTION_TASKS, BOQ_ITEMS, BUILDING_MILESTONES |

### 2.2 EVM Calculator (ΗΔΗ ΥΠΑΡΧΕΙ)

| Function | Location | Τι υπολογίζει |
|----------|----------|---------------|
| `computeEVM()` | `src/services/report-engine/evm-calculator.ts` | Orchestrator: PV, EV, AC, CPI, SPI, EAC, TCPI, health traffic lights |
| `generateSCurveData()` | ↑ | Monthly S-curve points (plannedValue, earnedValue, actualCost) |
| `computeBudgetAtCompletion()` | ↑ | SUM estimated item costs |
| `computeActualCost()` | ↑ | SUM actual costs |
| `computeEarnedValue()` | ↑ | SUM(phase.progress% × phaseBudget) |
| `computePlannedValue()` | ↑ | SUM(elapsed% × phaseBudget) based on date |

### 2.3 Existing Construction Reports (Phase 11 ADR-265)

| Component | Location | Τι δείχνει |
|-----------|----------|-----------|
| `ConstructionKPIs` | `src/components/reports/sections/construction/` | 4 KPI cards |
| `MilestoneCompletionChart` | ↑ | Bar chart: milestones by status |
| `PhaseProgressChart` | ↑ | Bar chart: phase progress % |
| `BOQCostBreakdownChart` | ↑ | Stacked bar: material/labor/equipment costs |
| `useConstructionReport` | `src/hooks/reports/useConstructionReport.ts` | Data fetch + transform |
| `/api/reports/construction` | `src/app/api/reports/construction/route.ts` | Server-side aggregation |

### 2.4 Gantt Export (ΗΔΗ ΥΠΑΡΧΕΙ)

| Exporter | Location | Format |
|----------|----------|--------|
| `exportGanttToPDF()` | `src/services/gantt-export/gantt-pdf-exporter.ts` | PDF (jspdf + Greek Roboto) |
| `exportGanttAsImage()` | `src/services/gantt-export/gantt-image-exporter.ts` | PNG, SVG |
| `exportGanttToExcel()` | `src/services/gantt-export/gantt-excel-exporter.ts` | Excel (exceljs) |

---

## 3. INDUSTRY RESEARCH (Procore / Primavera P6 / Buildertrend)

### 3.1 Τι κάνουν οι μεγάλοι

| Report Type | Procore | Primavera P6 | Buildertrend | Ρεαλιστικό για Nestor |
|-------------|---------|--------------|--------------|----------------------|
| Schedule Overview | ✅ | ✅ | ✅ | ✅ **Phase A** |
| S-Curve (Progress) | ✅ | ✅ | — | ✅ **Phase A** (data exists!) |
| Lookahead (2/4 wks) | ✅ | ✅ | ✅ | ✅ **Phase A** |
| As-Planned vs As-Built | — | ✅ | — | ✅ **Phase A** |
| SPI/CPI Dashboard | — | ✅ | — | ✅ **Phase A** (exists in Phase 11) |
| Delay Analysis | — | ✅ | ✅ | ✅ **Phase B** |
| Static Gantt PDF | ✅ | ✅ | ✅ | ✅ **Phase A** (exporter exists!) |
| Critical Path Report | — | ✅ | — | 🔶 **Phase C** (αλγοριθμική) |
| Baseline Comparison | — | ✅ | — | 🔶 **Phase C** |
| Float Analysis | — | ✅ | — | ❌ Overkill |
| Resource Loading | ✅ | ✅ | — | ❌ Overkill |

### 3.2 Τιεράρχηση για μικρή ομάδα

| Tier | Report | Δυσκολία | Αξία | Δεδομένα υπάρχουν; |
|------|--------|----------|------|---------------------|
| **Tier 1** | Schedule Overview + Status Summary | Χαμηλή | Υψηλή | ✅ Ναι |
| **Tier 1** | S-Curve Chart (Progress & Cost) | Χαμηλή | Υψηλή | ✅ `generateSCurveData()` |
| **Tier 1** | Lookahead Report (2/4 εβδομάδες) | Χαμηλή | Υψηλή | ✅ Ναι (date filter) |
| **Tier 1** | As-Planned vs As-Built Table | Χαμηλή | Υψηλή | ✅ planned/actual dates |
| **Tier 1** | Static Gantt PDF | Χαμηλή | Υψηλή | ✅ Exporter exists |
| **Tier 2** | Delay Analysis Summary | Μέτρια | Υψηλή | 🔶 Partial (status='delayed') |
| **Tier 2** | EVM Trend Chart (SPI/CPI σε χρόνο) | Μέτρια | Μέτρια | 🔶 Needs monthly snapshots |
| **Tier 3** | Critical Path Report | Υψηλή | Μέτρια | 🔶 Needs CPM algorithm |
| **Tier 3** | Baseline Snapshots | Υψηλή | Μέτρια | ❌ New data model |

---

## 4. ΑΡΧΙΤΕΚΤΟΝΙΚΗ — PROPOSED SOLUTION

### 4.1 Placement: Per-Building Report (μέσα στο Building Management)

**Απόφαση**: Τα schedule reports είναι **per-building**. Ο χρήστης επιλέγει building και βλέπει τα reports μόνο για αυτό.

**Placement**: Τρίτη επιλογή στο υπάρχον view toggle του Timeline Tab.

**Industry Pattern — "Views" (Procore / Monday.com / MS Project / Google)**:
Οι μεγάλοι χρησιμοποιούν **tabbed views** στο ίδιο επίπεδο — ίδια data, διαφορετική οπτική.
- **Procore**: `Gantt` · `Lookahead` · `Reports` tabs μέσα στο Schedule tool
- **Monday.com**: `Board` · `Timeline` · `Chart` · `Dashboard` view switcher
- **Primavera P6**: `Activities` · `Resources` · `Tracking` · `Analytics`
- **MS Project**: `Task (Gantt)` · `Report` ribbon tabs
- **Google**: Interactive view + `Dashboard/Insights` tab δίπλα

**Εφαρμογή στο Nestor**:
```
Building Management → Timeline Tab → View Toggle:

  [ Milestones ]   [ Gantt ]   [ Dashboard ]
                                 ↑ ΝΕΟ (ADR-266)
```

**Dashboard view** (read-only analytics):
- KPIs Overview (6 cards)
- S-Curve Chart (PV/EV/AC)
- Schedule Variance Table (Planned vs Actual)
- Lookahead Table (2/4 εβδομάδες)
- Gantt PDF Export link

**Gantt view** μένει αμετάβλητο (interactive editing: drag, CRUD, context menu).

**Διαχωρισμός concerns**:
- Gantt = **edit mode** (CRUD, drag & drop, resize)
- Dashboard = **analytics mode** (read-only, KPIs, charts, tables)

**Πλεονέκτημα per-building**: Ο χρήστης βλέπει schedule analytics στο context του building, δίπλα στο Gantt. Δεν χρειάζεται building selector dropdown. Ίδια data source (`useConstructionGantt`), διαφορετική presentation.

### 4.2 New Files Structure

```
src/
├── app/
│   ├── api/reports/schedule/
│   │   └── route.ts                          # API endpoint — server-side data
│   └── reports/schedule/
│       └── page.tsx                           # Page component
├── hooks/reports/
│   └── useScheduleReport.ts                  # Data hook
├── components/reports/sections/schedule/
│   ├── types.ts                              # Report-specific types
│   ├── ScheduleOverviewKPIs.tsx              # Section 1: KPI grid
│   ├── SCurveChart.tsx                       # Section 2: S-Curve
│   ├── ScheduleVarianceTable.tsx             # Section 3: Planned vs Actual
│   ├── LookaheadTable.tsx                    # Section 4: Next 2/4 weeks
│   ├── DelayBreakdownChart.tsx               # Section 5: Delays by category
│   └── GanttSnapshotCard.tsx                 # Section 6: Static Gantt PDF link
```

**Εκτίμηση**: ~8 νέα αρχεία, ~1.200 γραμμές κώδικα.

### 4.3 Data Flow — Reuse Loaded Data + Lazy Compute (Google Pattern)

**Industry Pattern (Google Analytics / Cloud Console / Gmail)**:
Lazy load per tab, reuse already-fetched data, skeleton loaders during compute.

**Key Insight**: Το Dashboard χρησιμοποιεί τα **ΙΔΙΑ data** (phases + tasks) που ο `useConstructionGantt` **ΗΔΗ φόρτωσε** στο Timeline Tab. Ο `computeEVM()` τρέχει **client-side**. Δεν χρειάζεται νέο API call για τα βασικά data.

```
Timeline Tab opens
  └→ useConstructionGantt() fetches phases + tasks + milestones  ← ONE existing API call

User clicks [Milestones] → renders from cached data              ← instant
User clicks [Gantt]      → renders from cached data              ← instant
User clicks [Dashboard]  → useScheduleDashboard() computes:      ← instant compute
                            ├── computeEVM(phases, boqItems, milestones)   ← client-side
                            ├── generateSCurveData(phases, boqItems)       ← client-side
                            ├── calculateVariances(phases, tasks)          ← client-side (NEW helper)
                            ├── filterLookahead(tasks, windowDays)         ← client-side (NEW helper)
                            └── BOQ items fetch (lazy, only if not cached) ← skeleton loader
```

**Αρχή**: Zero νέα API calls για phases/tasks. Μόνο BOQ items lazy fetch αν δεν είναι ήδη loaded. Skeleton loaders κατά τη διάρκεια compute/fetch.

**Export Flow** (ξεχωριστό, on-demand):
```
User clicks [Export PDF/Excel]
  └→ exportReportToPdf() / exportReportToExcel()  ← from already-computed dashboard data
```

---

## 5. SECTION SPECIFICATIONS

### 5.1 Schedule Overview KPIs — vs Plan Pattern (Construction Industry Standard)

**Industry Pattern (Primavera / MS Project / Procore)**:
Στην κατασκευή τα KPIs δεν δείχνουν "vs previous period" (SaaS/marketing pattern) αλλά **"vs Plan/Baseline"** — πού είμαι σε σχέση με το πλάνο. Αυτό υπολογίζεται **real-time** από planned dates + actual dates + progress — **δεν χρειάζονται historical snapshots**.

| KPI | Τρέχουσα Τιμή | vs Plan (real-time) | Indicator |
|-----|---------------|---------------------|-----------|
| Overall Progress | WEIGHTED_AVG(phases.progress) | Expected progress βάσει ημερομηνίας: `elapsed% of total duration` → delta | 🟢 on/ahead, 🟡 -1~-5%, 🔴 >-5% |
| SPI | computeEVM().spi | Baseline: 1.0 → `< 1.0 = behind schedule` | 🟢 ≥0.95, 🟡 0.85-0.94, 🔴 <0.85 |
| CPI | computeEVM().cpi | Baseline: 1.0 → `< 1.0 = over budget` | 🟢 ≥0.95, 🟡 0.85-0.94, 🔴 <0.85 |
| **SPI(t)** | computeEarnedSchedule().spiT | **Time-based SPI** — δεν ψεύδεται στο τέλος project | 🟢 ≥0.95, 🟡 0.85-0.94, 🔴 <0.85 |
| **EAC(t)** | computeEarnedSchedule().eacT | **Estimated completion date** (time-based, πιο ακριβής) | Ημερομηνία + ±days vs planned |
| Days Remaining | MAX(plannedEndDate) - today | Planned remaining vs actual estimate → `±N days` | 🟢 ≤0, 🟡 1-7, 🔴 >7 |
| Phases On Track | COUNT(on-time) / COUNT(total) | Fraction + percentage | 🟢 >80%, 🟡 50-80%, 🔴 <50% |
| Delayed Tasks | COUNT(status='delayed' OR 'blocked') | Absolute count | 🟢 0, 🟡 1-3, 🔴 >3 |

**Display Format (Google Analytics card pattern)**:
```
┌──────────────────────┐
│ 📊 Overall Progress  │
│ ██████████░░░░  65%  │
│ Expected: 72%        │
│ ▼ -7% behind plan    │  ← RED indicator
└──────────────────────┘
```

**Implementation**: Reuse `ReportKPI` component from `src/components/reports/core/`. Κάθε KPI card δείχνει: value + vs-plan delta + traffic light color. **Μηδέν snapshots, μηδέν cron jobs.**

#### Earned Schedule (ES) — Time-Based Forecasting (Primavera P6 / PMI Standard)

**Πρόβλημα με traditional SPI**: Το cost-based SPI πάντα τείνει στο 1.0 στο τέλος του project, ακόμα κι αν είναι 6 μήνες καθυστερημένο. Αυτό είναι γνωστό πρόβλημα στη βιβλιογραφία (Lipke, 2003) και οδηγεί σε ψευδή αισιοδοξία.

**Λύση — Earned Schedule**: Μετράει πρόοδο σε **χρόνο** αντί κόστους. Εισήχθη στο PMI Standard Practice (2019) και χρησιμοποιείται σε Primavera P6, Deltek Cobra, EcoSys.

**Μαθηματικό μοντέλο**:
```
ES (Earned Schedule):
  Βρες τη χρονική στιγμή t στο ΠΛΑΝΟ όπου PV(t) = EV(now)
  Δηλαδή: "πόση δουλειά έχω κάνει" αντιστοιχεί σε ποιο σημείο του πλάνου;

  ES = t + (EV - PV(t)) / (PV(t+1) - PV(t))   ← linear interpolation

SPI(t) = ES / AT
  AT = Actual Time elapsed (μήνες από project start)
  SPI(t) > 1 → ahead of schedule
  SPI(t) < 1 → behind schedule
  SPI(t) ΔΕΝ τείνει στο 1.0 στο τέλος — αξιόπιστο μέχρι τέλους

EAC(t) = PD / SPI(t)
  PD = Planned Duration (total project months)
  EAC(t) = Estimated total duration σε μήνες

IEAC(t) = AT + (PD - ES)
  Independent estimate — πόσο ακόμα χρειάζεται

Estimated Completion Date = projectStart + EAC(t) months
```

**Implementation**: Νέα function `computeEarnedSchedule()` στον `evm-calculator.ts` (~50 LOC):
```typescript
interface EarnedScheduleResult {
  es: number;              // Earned Schedule (months)
  at: number;              // Actual Time elapsed (months)
  spiT: number;            // Time-based SPI — ES / AT
  eacT: number;            // Estimated duration (months) — PD / SPI(t)
  ieacT: number;           // Independent EAC — AT + (PD - ES)
  estimatedEndDate: string; // ISO date — project start + EAC(t)
  varianceDays: number;    // estimatedEndDate - plannedEndDate (+ = late)
}
```

**Data Source**: Reuse S-Curve data points (`generateSCurveData()`) — PV per month ΗΔΗ ΥΠΑΡΧΕΙ. Κανένα νέο data fetch.

**Display — 2 νέα KPI cards**:
```
┌──────────────────────┐  ┌──────────────────────┐
│ 📊 SPI(t)            │  │ 📅 Est. Completion    │
│ 0.82                 │  │ 15 Ιουλίου 2026      │
│ ▼ behind schedule    │  │ +32 μέρες vs πλάνο   │
│ (time-based)         │  │ (Earned Schedule)     │
└──────────────────────┘  └──────────────────────┘
```

**KPI Grid Layout**: 6 → **8 KPIs** → 4×2 grid desktop, 2×4 tablet, 1×8 mobile.

### 5.2 S-Curve Chart

**Data Source**: `generateSCurveData()` — ΗΔΗ ΥΠΑΡΧΕΙ στον evm-calculator.

```typescript
interface SCurveDataPoint {
  date: string;          // ISO, first day of month
  plannedValue: number;  // Cumulative budget for planned work
  earnedValue: number;   // Cumulative value of completed work
  actualCost: number;    // Cumulative actual expenditure
}
```

**Visualization**: recharts `<LineChart>` with 3 lines:
- **Planned (PV)** — dashed gray line (baseline)
- **Earned (EV)** — solid blue line (value produced)
- **Actual Cost (AC)** — solid red line (money spent)

**Tooltip**: Ημερομηνία, PV, EV, AC, SV (EV-PV), CV (EV-AC).

**Σημείωση**: Αν PV > EV → behind schedule. Αν AC > EV → over budget.

#### Time Range: Full Lifecycle (Construction Industry Standard + Google Finance Pattern)

**Κατασκευή = finite, bounded project** — δεν είναι continuous stream (σαν web traffic). Η S-curve **πρέπει** να δείχνει full lifecycle, αλλιώς χάνει νόημα.

- **Primavera / Procore / MS Project**: Πάντα full project lifecycle, κανένα date range picker
- **Google Finance**: Full timeline by default + optional zoom (1D, 1M, 1Y, MAX)

**Εφαρμογή**:
- **Default**: Full lifecycle — από plannedStartDate πρώτης φάσης μέχρι plannedEndDate τελευταίας
- **Today marker**: Vertical dashed line στο σημερινό σημείο (χωρίζει actual/forecast)
- **No date range picker** — δεν χρειάζεται στην κατασκευή
- **Phase B (optional)**: Chart zoom via recharts `<Brush>` component (click-drag zoom area)
- **Lookahead table**: Ήδη time-filtered by design (2/4 εβδομάδες toggle)

### 5.3 Schedule Variance Table (As-Planned vs As-Built) — Expandable Tree Table

**Industry Pattern (Primavera / MS Project / Procore / Google Analytics)**:
Όλοι χρησιμοποιούν **expandable tree table** — phases collapsed by default, expand για tasks.

#### Δομή:
```
▶ PH-002 Foundation          Planned: 01/03–15/04   Actual: 05/03–22/04   +7d  🔴  +€12.000 🔴  ⏱80% 🔨50%
  ├─ TSK-001 Excavation       Planned: 01/03–10/03   Actual: 05/03–12/03   +2d  🟡                ⏱100% 🔨100%
  ├─ TSK-002 Footings         Planned: 11/03–25/03   Actual: 13/03–28/03   +3d  🟡                ⏱100% 🔨100%
  ├─ TSK-003 Concrete pour    Planned: 26/03–05/04   Actual: 29/03–12/04   +7d  🔴                ⏱100% 🔨100%
  └─ TSK-004 Curing           Planned: 06/04–15/04   Actual: 13/04–22/04   +7d  🔴                ⏱80%  🔨50%
▶ PH-003 Structural Frame    Planned: 16/04–30/05   Actual: —              0d   🟢   -€2.000 🟢  ⏱0%   🔨0%
```

#### Dual Progress Tracking (Primavera P6 pattern)

**Industry Standard**: Στην κατασκευή υπάρχουν **δύο** τύποι progress:

| Τύπος | Σύμβολο | Υπολογισμός | Ποιος το ενημερώνει |
|-------|---------|-------------|---------------------|
| **Duration %** (⏱) | ⏱ | `(today - actualStart) / (plannedEnd - plannedStart) × 100` | **Αυτόματο** — υπολογίζεται από ημερομηνίες |
| **Physical %** (🔨) | 🔨 | Πόσο πραγματικά ολοκληρώθηκε η εργασία | **Manual** — ο εργοδηγός το ενημερώνει |

**Γιατί χρειάζονται και τα δύο**: Αν ⏱80% αλλά 🔨50% → η εργασία πάει πολύ πίσω, θα καθυστερήσει σίγουρα. Αν ⏱50% αλλά 🔨80% → η εργασία πάει μπροστά, μπορεί να τελειώσει νωρίτερα.

**Divergence Alert**: Αν `|duration% - physical%| > 20%` → ⚠️ warning badge:
- ⏱80% 🔨50% → `⚠️ -30% divergence — at risk`
- ⏱50% 🔨80% → `✅ +30% ahead of pace`

**Schema Extension — ConstructionTask**:
```typescript
// Υπάρχον πεδίο (γίνεται rename → physicalProgress):
progress: number;           // 0-100 — manual entry by εργοδηγός → RENAME to physicalProgress

// Νέο computed field (δεν αποθηκεύεται, υπολογίζεται real-time):
// durationProgress = computed from dates
```

**Implementation**:
- `physicalProgress`: Manual — ο εργοδηγός ενημερώνει (υπάρχον `progress` field, rename)
- `durationProgress`: Computed — `Math.min(100, ((today - actualStart) / (plannedEnd - plannedStart)) * 100)`
- **EVM χρησιμοποιεί `physicalProgress`** (πραγματική δουλειά, όχι χρόνο) — industry standard
- **Variance Table δείχνει και τα δύο** side-by-side

**Display (compact dual bar)**:
```
┌─────────────────────────────┐
│ ⏱ ████████░░ 80%  Duration  │
│ 🔨 █████░░░░░ 50%  Physical  │
│ ⚠️ -30% divergence           │
└─────────────────────────────┘
```

**Phase Assignment**: Phase C (schema rename `progress` → `physicalProgress` + migration)

#### Columns:

| Column | Phase Row (summary) | Task Row (detail) | Responsive |
|--------|--------------------|--------------------|------------|
| `▶`/`▼` Name | Phase name (bold) | Task name (indented) | Always visible |
| Planned Start | plannedStartDate | plannedStartDate | Hidden on mobile |
| Planned End | plannedEndDate | plannedEndDate | Hidden on mobile |
| Actual Start | MIN(tasks.actualStartDate) | actualStartDate | Hidden on mobile |
| Actual End | MAX(tasks.actualEndDate) | actualEndDate | Hidden on mobile |
| Variance (days) | MAX(tasks.variance) — worst case | actualEnd - plannedEnd | Always visible |
| Status | Traffic light: worst child status | 🟢 ≤0d, 🟡 1-7d, 🔴 >7d | Always visible |
| **Cost Variance** | SUM(BOQ actual) - SUM(BOQ estimated) per phase | — (phase-level only) | **Visible desktop, hidden mobile** |
| **Duration %** (⏱) | WEIGHTED_AVG(tasks.durationProgress) | Computed from dates | Always visible |
| **Physical %** (🔨) | WEIGHTED_AVG(tasks.physicalProgress) | Manual entry | Always visible |

**Cost Variance Column (Primavera P6 / Procore pattern)**:
- **Data source**: `BOQItem.linkedPhaseId` → SUM(actualCost) - SUM(estimatedCost) per phase
- **Display**: `+€12.000` (over budget, 🔴) / `-€2.000` (under budget, 🟢) / `€0` (on budget, 🟢)
- **Thresholds**: 🟢 ≤0%, 🟡 1-10% over, 🔴 >10% over (percentage of phase budget)
- **Task rows**: Cost variance shown only at **phase level** (BOQ items link to phases, not tasks)
- **Responsive**: Visible on desktop (≥1024px), hidden on tablet/mobile — user sees cost in KPIs (CPI)

#### Behavior:
- **Default**: Όλες οι phases **collapsed** — compact overview
- **Expand**: Click `▶` → φαίνονται τα tasks indented κάτω από τη φάση
- **Collapse**: Click `▼` → κρύβονται τα tasks
- **Expand All / Collapse All**: Buttons στο table header
- **Sorting**: Default by variance DESC (worst delays first)
- **Filtering**: By status (on-time / delayed / blocked)

### 5.4 Lookahead Report (2/4 Weeks)

**Logic**: Φιλτράρισμα tasks where:
- `plannedStartDate ≤ today + N_DAYS` AND `status ≠ 'completed'`
- OR `plannedEndDate` falls within lookahead window

**Columns**: Task Name, Phase, Start, End, Duration, Dependencies, Workers, Status, Assignee (future).

**Toggle**: 2 εβδομάδες / 4 εβδομάδες (Radix Select).

**Use Case**: On-screen view + εκτύπωση (PDF/Excel) για εβδομαδιαία σύσκεψη εργοταξίου.

**Export**: Και on-screen ΚΑΙ exportable — χρησιμοποιεί τα υπάρχοντα enterprise export systems (βλ. §5.7).

#### Dependency Warnings (Primavera P6 / Procore / MS Project pattern)

**Industry Standard**: Στο Lookahead, αν μια εργασία εξαρτάται από predecessor που δεν έχει ολοκληρωθεί, εμφανίζεται **inline warning**.

**Data source**: `ConstructionTask.dependencies[]` — ΗΔΗ ΥΠΑΡΧΕΙ στο schema.

**Logic**:
```
for each task in lookahead:
  for each dependencyId in task.dependencies:
    predecessor = findTask(dependencyId)
    if predecessor.status !== 'completed':
      show warning: "Blocked by: {predecessor.name} ({predecessor.progress}%)"
```

**Display (Google inline contextual warning pattern)**:
```
TSK-005 Concrete Pour     03/04–10/04   In Progress   65%
  ⚠️ Blocked by: Formwork Installation (80%)
```

- **Inline subtitle**: Κάτω από το task name, muted text + warning icon
- **Tooltip**: Hover → "Η εργασία εξαρτάται από {predecessor} που δεν έχει ολοκληρωθεί"
- **Multiple predecessors**: Αν >1 unfinished → δείχνει τον χειρότερο (lowest progress%)
- **No warning**: Αν όλοι οι predecessors = completed → καθαρό, χωρίς warning
- **Responsive**: Warning visible σε όλα τα breakpoints (κρίσιμη πληροφορία για εργοτάξιο)

#### Resource / Workforce Loading (Primavera P6 / Procore pattern)

**Industry Standard**: Στη σύσκεψη εργοταξίου η #1 ερώτηση είναι: "Πόσα άτομα χρειαζόμαστε αυτή την εβδομάδα και τα έχουμε;" Primavera P6 και Procore δείχνουν workforce breakdown ανά task + weekly summary.

**Schema Extension — ConstructionTask**:
```typescript
// Νέο πεδίο στο ConstructionTask
interface TaskWorkforce {
  totalWorkers: number;          // συνολικά άτομα
  breakdown: Array<{
    specialty: string;           // 'concrete' | 'welder' | 'electrician' | 'plumber' | 'labor' | 'crane_operator' | 'painter' | κλπ
    count: number;
  }>;
}

// Προστίθεται στο ConstructionTask:
requiredWorkforce?: TaskWorkforce;
```

**Specialty Registry** (configurable ανά company):
| Key | Ελληνικά | English |
|-----|----------|---------|
| `labor` | Εργάτης | General Labor |
| `concrete` | Σκυροδεματάς | Concrete Worker |
| `welder` | Συγκολλητής | Welder |
| `electrician` | Ηλεκτρολόγος | Electrician |
| `plumber` | Υδραυλικός | Plumber |
| `painter` | Ελαιοχρωματιστής | Painter |
| `crane_operator` | Χειριστής γερανού | Crane Operator |
| `rigger` | Σκαλωσιάς | Rigger/Scaffolder |
| `mason` | Κτίστης | Mason |
| `carpenter` | Ξυλουργός | Carpenter |
| `ironworker` | Σιδεράς | Ironworker |
| `heavy_equipment` | Χειριστής μηχανημάτων | Heavy Equipment Operator |

**Lookahead Display — Per Task**:
```
TSK-005 Concrete Pour    03/04–10/04    👷 8 (3 σκυροδ., 2 αντλία, 3 εργάτες)    65%
TSK-006 Steel Erection   04/04–12/04    👷 5 (2 συγκολλ., 1 γερανός, 2 σκαλ.)     0%
  ⚠️ Blocked by: Formwork (80%)
```

**Weekly Summary Bar (κάτω από τον πίνακα)**:
```
┌─────────────────────────────────────────────────────────────────────┐
│ 📊 Εβδομαδιαίο Σύνολο Εργατικού Δυναμικού                         │
│                                                                     │
│ Εβδ. 31/3–04/4:  👷 13 άτομα (3 σκυροδ., 2 συγκολλ., 1 γερανός,  │
│                              2 σκαλ., 2 αντλία, 3 εργάτες)         │
│ Εβδ. 07/4–11/4:  👷 9 άτομα  (2 ηλεκτρ., 2 υδραυλ., 5 εργάτες)  │
│                                                                     │
│ Peak: 👷 13 (εβδ. 31/3)   |   Avg: 👷 11   |   Σύνολο ειδικοτ.: 6│
└─────────────────────────────────────────────────────────────────────┘
```

**Stacked Bar Chart (optional — visual summary)**:
- X axis: Εβδομάδες lookahead
- Y axis: Αριθμός εργατών
- Stacked bars: Κάθε χρώμα = 1 ειδικότητα
- Δείχνει peak weeks και resource conflicts

**Responsive**:
- **Desktop**: Full breakdown (specialty + count) visible
- **Tablet**: Total workers only, breakdown in tooltip
- **Mobile**: Total workers only, summary bar collapsed

**Phase Assignment**: Phase C (νέο πεδίο στο schema → migration)

#### Content: Tasks Primary + Contextual Material Warnings (Google Progressive Disclosure)

**Industry Pattern**: Primavera, Procore, Buildertrend — το lookahead δείχνει **μόνο tasks**. Procurement είναι ξεχωριστό module. Κανείς δεν αναμειγνύει τα δύο.

**Google Pattern**: Δεν γεμίζεις ένα view με data από άλλο domain. Βάζεις **contextual warnings** — μικρά alerts/badges:
- Gmail δεν δείχνει calendar στο inbox → δείχνει card "Meeting at 2pm"
- Google Maps δεν δείχνει gas prices → δείχνει ⚠️ "Low fuel nearby"

**Εφαρμογή**:
- **Phase A**: Lookahead = **tasks only** (procurement module δεν υπάρχει ακόμα)
- **Phase B** (μετά ADR-267 Procurement): Contextual warning badges ανά task:
  - `BOQItem.linkedPhaseId` → check αν υπάρχει PO → ⚠️ "No PO for 50m³ concrete" badge
  - `PO.status = 'ordered'` → 📦 "PO pending delivery" badge
  - Click badge → navigate to Procurement module
  - **Δεν αλλάζει η δομή του table** — μόνο ένα μικρό icon/badge κάτω από το task name

### 5.5 Delay Breakdown Chart

**Data**: Φάσεις/tasks με `status = 'delayed'` ή `status = 'blocked'`.

**Visualization**: recharts `<BarChart>` — delays ανά building ή ανά phase.

**Μέλλον**: Delay reason categories (weather, materials, permits, subcontractor) — σήμερα δεν υπάρχει πεδίο `delayReason` στο schema, θα χρειαστεί migration.

### 5.6 Weather Forecast Widget (Procore / Fieldwire / Buildertrend pattern)

**Industry Context**: Ο καιρός είναι ο **#1 λόγος καθυστέρησης** στην κατασκευή. Procore, Fieldwire, Buildertrend δείχνουν πρόγνωση καιρού **μέσα στο schedule dashboard** — όχι ξεχωριστή σελίδα.

#### Data Source — OpenWeatherMap API (Free Tier)

| Χαρακτηριστικό | Τιμή |
|----------------|-------|
| **API** | OpenWeatherMap One Call API 3.0 |
| **License** | CC BY-SA 4.0 (data), API usage = free tier OK |
| **Free Tier** | 1.000 calls/day (60 calls/min) — υπεραρκετό |
| **Forecast** | 7-day hourly forecast |
| **Needs** | API key (env var `OPENWEATHERMAP_API_KEY`) + building coordinates (lat/lng) |

#### Building Location — Prerequisite

Το Building entity χρειάζεται **coordinates** (lat, lng) για weather lookup. Πιθανές πηγές:
1. **Building address → Geocoding**: Αν υπάρχει ήδη address στο Building → geocode once, cache lat/lng
2. **Manual entry**: Ο χρήστης βάζει lat/lng στο Building settings (fallback)
3. **Map click**: Ο χρήστης κλικάρει σε χάρτη → αποθηκεύονται coordinates

**Σημείωση**: Αν δεν υπάρχουν coordinates → weather widget δείχνει empty state: "Προσθέστε τοποθεσία κτιρίου για πρόγνωση καιρού"

#### Placement — Dashboard + Lookahead

**1. Dashboard Weather Strip** (πάνω από τα KPIs):
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📍 Θεσσαλονίκη — Πρόγνωση 7 ημερών                                        │
│                                                                             │
│  Δευ 31/3    Τρι 1/4     Τετ 2/4     Πεμ 3/4    Παρ 4/4    Σαβ    Κυρ     │
│  ☀️ 22°C     🌤️ 19°C     🌧️ 14°C     🌧️ 13°C    ☀️ 18°C    ☀️      ☀️     │
│              wind 25km/h  ⚠️ Rain     ⚠️ Rain                              │
│                           No outdoor   No outdoor                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

**2. Lookahead Table — Weather Column** (inline, per day):
```
TSK-005 Concrete Pour     Τετ 02/04–Πεμ 03/04    🌧️ ⚠️ Rain forecast
TSK-006 Steel Erection    Παρ 04/04–Δευ 07/04    ☀️ Clear
```

#### Work Impact Rules (Construction Industry Standard)

| Condition | Impact | Icon |
|-----------|--------|------|
| Rain > 5mm/h | Outdoor work at risk | 🌧️ ⚠️ |
| Wind > 40 km/h | Crane operations suspended | 💨 ⚠️ |
| Temperature < 5°C | Concrete pouring at risk | 🥶 ⚠️ |
| Temperature > 40°C | Worker safety risk | 🌡️ ⚠️ |
| Snow / Ice | All outdoor work suspended | ❄️ ⚠️ |
| Clear / Mild | No impact | ☀️ |

**Configurable thresholds**: Στο Building settings ο χρήστης μπορεί να αλλάξει τα thresholds (π.χ. concrete ok at 3°C αντί 5°C).

#### Architecture

```
Building coordinates (lat/lng)
  └→ API Route: /api/weather/forecast?lat=X&lng=Y
       └→ OpenWeatherMap API call (server-side, cached 1h)
            └→ Returns 7-day forecast
                 └→ Client: useWeatherForecast(buildingId) hook
                      ├→ Dashboard Weather Strip component
                      └→ Lookahead: weather badges per task date
```

**Caching**: Server-side cache 1 ώρα (ο καιρός δεν αλλάζει κάθε λεπτό). Redis ή in-memory Map.

**Fallback**: Αν API αποτύχει → widget δείχνει "Πρόγνωση μη διαθέσιμη" — δεν σπάει το dashboard.

#### Phase Assignment
- **Phase C** (νέο feature, χρειάζεται API key setup + coordinates + new API route)

### 5.7 Photo Documentation & Daily Log (Procore / Fieldwire / PlanGrid pattern)

**Industry Context**: Ο εργοδηγός βγάζει φωτογραφίες καθημερινά στο εργοτάξιο. Procore, Fieldwire, PlanGrid συνδέουν αυτόματα τις φωτογραφίες με phases/tasks και τις δείχνουν inline στο schedule dashboard.

#### Data Model — New Collections

**1. Site Photos** (`construction_site_photos`):
```typescript
interface ConstructionSitePhoto {
  id: string;              // 'csphoto_XXXXX' (enterprise-id)
  buildingId: string;
  companyId: string;
  phaseId: string;         // linked to ConstructionPhase
  taskId?: string;         // optional: linked to specific task
  url: string;             // Firebase Storage URL
  thumbnailUrl: string;    // compressed thumbnail (max 200px)
  caption?: string;        // optional description
  takenAt: Timestamp;      // when photo was taken
  takenBy: string;         // userId
  gpsCoordinates?: {       // auto-captured from device
    lat: number;
    lng: number;
  };
  createdAt: Timestamp;
}
```

**2. Daily Logs** (`construction_daily_logs`):
```typescript
interface ConstructionDailyLog {
  id: string;              // 'cdlog_XXXXX' (enterprise-id)
  buildingId: string;
  companyId: string;
  date: string;            // ISO date (one log per day per building)
  weather: string;         // manual: 'sunny' | 'cloudy' | 'rain' | 'snow'
  temperature?: number;    // manual entry (°C)
  workforceCount: number;  // workers on site today
  summary: string;         // free-text: what happened today
  phases: Array<{          // which phases were active today
    phaseId: string;
    notes: string;         // phase-specific notes
  }>;
  issues: Array<{          // problems encountered
    description: string;
    severity: 'low' | 'medium' | 'high';
    resolved: boolean;
  }>;
  photoIds: string[];      // linked photos from today
  createdBy: string;       // userId
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### Dashboard Integration — Variance Table Enhancement

Στο Variance Table, κάθε phase row δείχνει **inline photo/log summary**:

```
▶ PH-002 Foundation          +7d 🔴   +€12.000 🔴   85%
  📷 12 photos (τελευταία: χθες 14:32)   📝 3 logs αυτή την εβδομάδα
  ├─ TSK-001 Excavation       +2d 🟡   100%
  │  📷 4 photos
  ...
```

**Click behavior**:
- 📷 Click → Slideshow/gallery modal (φωτογραφίες της φάσης, chronological)
- 📝 Click → Daily log list panel (side panel ή modal)

#### Lookahead Integration

Στο Lookahead table, κάθε task δείχνει **latest photo thumbnail**:

```
TSK-005 Concrete Pour     03/04–10/04   65%   [📷 thumbnail]
  ⚠️ Blocked by: Formwork (80%)
```

**Thumbnail**: Μικρή εικόνα (40x40px) — hover → μεγαλύτερο preview (200px). Click → full gallery.

#### Photo Upload Flow (Mobile-First — Procore pattern)

```
Εργοδηγός στο εργοτάξιο (tablet/mobile)
  └→ Opens Building → Timeline → Gantt view
       └→ Click phase/task → Context menu → "Προσθήκη φωτογραφίας"
            └→ Camera opens (usePhotoCapture hook — ΗΔΗ ΥΠΑΡΧΕΙ από ADR-170)
                 └→ Compress (max 1MB) → Upload to Firebase Storage
                      └→ Create SitePhoto document (auto-link phaseId/taskId)
                           └→ Dashboard shows updated count instantly
```

**Reuse**: Το `usePhotoCapture` hook υπάρχει ήδη (ADR-170 Attendance). Camera + compression ready.

#### Daily Log Entry Flow

```
PM/Εργοδηγός τέλος ημέρας
  └→ Dashboard → "Νέο Ημερήσιο Log" button
       └→ Form: weather, workers count, summary, link phases, add issues
            └→ Auto-attach today's photos
                 └→ Save → visible στο Dashboard next day
```

#### Owner Report PDF Enhancement

Στο Owner Report PDF (§5.8) προστίθεται section:
- **Recent Photos**: 4 τελευταίες φωτογραφίες (thumbnails) με caption + date
- **Weekly Summary**: "Αυτή την εβδομάδα: 5 εργάσιμες μέρες, 12 εργάτες avg, 3 issues resolved"

#### Phase Assignment
- **Phase D** (νέο feature, νέες collections, Firebase Storage, UI components)
- Εξαρτάται από: `usePhotoCapture` (ADR-170 — ΗΔΗ ΥΠΑΡΧΕΙ)

### 5.8 Schedule Alerts & Notifications (Procore / Buildertrend pattern)

**Industry Context**: Ο PM δεν μπαίνει στο Dashboard κάθε μέρα. Procore και Buildertrend στέλνουν **proactive alerts** όταν κάτι πάει στραβά — ο PM μαθαίνει πριν γίνει κρίσιμο.

#### Alert Rules (Configurable Thresholds)

| Rule | Default Threshold | Severity | Trigger |
|------|-------------------|----------|---------|
| Task Overdue | actualDate > plannedEndDate | HIGH | Task δεν τελείωσε στην ώρα του |
| Phase SPI Drop | SPI < 0.85 | HIGH | Φάση πέφτει πίσω σημαντικά |
| CPI Drop | CPI < 0.85 | MEDIUM | Κόστος ξεπερνά τον προϋπολογισμό |
| Task Blocked | status = 'blocked' > 3 days | HIGH | Εργασία κολλημένη |
| Milestone At Risk | milestone due in ≤7 days AND progress < 80% | HIGH | Milestone κινδυνεύει |
| Weather Risk | Rain/Wind/Cold forecast on workday | MEDIUM | Καιρός απειλεί εξωτερικές εργασίες |
| No Progress | phase progress unchanged > 5 days | LOW | Στασιμότητα |

**Configurable**: Ο χρήστης μπορεί να αλλάξει thresholds ανά building (π.χ. SPI < 0.90 αντί 0.85).

#### Channel 1: Dashboard Alert Banner (In-App)

Πάνω από τα KPIs, collapsible alert banner:

```
┌─────────────────────────────────────────────────────────────────────┐
│ ⚠️ 3 Alerts                                              [Dismiss] │
│                                                                     │
│ 🔴 HIGH  TSK-003 Concrete Pour — Overdue by 7 days                 │
│ 🔴 HIGH  PH-002 Foundation — SPI dropped to 0.78                   │
│ 🟡 MED   CPI at 0.83 — budget overrun risk                         │
└─────────────────────────────────────────────────────────────────────┘
```

**Behavior**:
- **Collapsed by default**: Δείχνει μόνο count + worst severity icon
- **Expand**: Click → βλέπεις όλα τα alerts
- **Dismiss**: Per-alert dismiss (δεν ξαναεμφανίζεται μέχρι νέο trigger)
- **Click alert**: Navigate to relevant phase/task στο Gantt view
- **Badge**: Στο "Dashboard" tab button → red badge με count (π.χ. `Dashboard (3)`)

#### Channel 2: Telegram Notifications (Reuse ADR-145 / ADR-171 Pipeline)

**Reuse existing infrastructure**:
- Telegram Bot **ΗΔΗ ΥΠΑΡΧΕΙ** (ADR-145 Super Admin AI Assistant)
- `sendTelegramMessage()` utility **ΗΔΗ ΥΠΑΡΧΕΙ**
- Telegram channel routing **ΗΔΗ ΥΠΑΡΧΕΙ** (ADR-070/071)

**Telegram Alert Message Format**:
```
🚨 SCHEDULE ALERT — Πολυκατοικία Τούμπας

🔴 Overdue: Σκυροδέτηση θεμελίωσης
   Planned: 05/04 → Actual: σήμερα 12/04 (+7 μέρες)
   Progress: 50%

🔴 SPI Alert: Φάση Θεμελίωσης
   SPI: 0.78 (threshold: 0.85)
   Εκτίμηση: +12 μέρες καθυστέρηση

📊 Dashboard: https://nestor-app.vercel.app/buildings/{id}?tab=timeline&view=dashboard
```

**Delivery Rules**:
- **Frequency**: Max 1 alert digest per building per day (δεν σπαμάρει)
- **Digest time**: 08:00 πρωί (configurable) — ο PM βλέπει alerts πριν πάει εργοτάξιο
- **Immediate**: Μόνο για CRITICAL (π.χ. milestone missed) — στέλνει αμέσως
- **Recipients**: Building owner (PM) + optional: εργοδηγός, ιδιοκτήτης
- **Mute**: Ο χρήστης μπορεί να κάνει mute alerts ανά building ή ανά rule

#### Architecture

```
Trigger: Cron job (daily 07:30) OR real-time on data change
  └→ API Route: /api/alerts/schedule-check
       └→ For each active building:
            ├→ Fetch phases + tasks + BOQ
            ├→ Run alert rules engine
            ├→ Generate alerts (new only, skip dismissed)
            ├→ Save to Firestore: construction_alerts collection
            ├→ Dashboard: useScheduleAlerts(buildingId) hook reads alerts
            └→ Telegram: sendTelegramDigest() (if alerts exist)
```

**New Collection**: `construction_alerts`
```typescript
interface ConstructionAlert {
  id: string;              // 'calert_XXXXX' (enterprise-id)
  buildingId: string;
  companyId: string;
  ruleType: 'task_overdue' | 'spi_drop' | 'cpi_drop' | 'task_blocked' | 'milestone_risk' | 'weather_risk' | 'no_progress';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;           // human-readable title
  message: string;         // detailed description
  phaseId?: string;
  taskId?: string;
  data: Record<string, number | string>;  // threshold, actual value, etc.
  status: 'active' | 'dismissed' | 'resolved';
  notifiedVia: ('dashboard' | 'telegram')[];
  createdAt: Timestamp;
  dismissedAt?: Timestamp;
  dismissedBy?: string;
}
```

#### Phase Assignment
- **Phase D** (μαζί με Site Documentation — shared infrastructure: collections, notifications)

### 5.9 Portfolio Dashboard — Cross-Building Overview (Procore / Primavera / Monday.com pattern)

**Industry Context**: Ο PM διαχειρίζεται **πολλά buildings ταυτόχρονα**. Procore, Primavera, Monday.com έχουν Portfolio View — ΟΛΑ τα ενεργά buildings σε μία οθόνη, ranked by risk.

#### Placement — Standalone Page (NOT inside Building Management)

**Απόφαση**: Portfolio View είναι **cross-building** → δεν ανήκει μέσα σε ένα building. Είναι **ξεχωριστή σελίδα** στο main navigation.

```
Main Navigation:
  ├── Dashboard (existing — general app overview)
  ├── Buildings
  ├── Contacts
  ├── ...
  └── Construction Portfolio   ← ΝΕΟ
       └→ /construction/portfolio
```

#### Portfolio Table — Summary per Building

```
Construction Portfolio — 4 Active Buildings                    [Export PDF] [Export Excel]

┌──────────────────────┬──────────┬──────┬──────┬──────────┬───────────┬────────────┬─────────┐
│ Building             │ Progress │ SPI  │ CPI  │ Delayed  │ Alerts    │ Next Mile. │ Status  │
├──────────────────────┼──────────┼──────┼──────┼──────────┼───────────┼────────────┼─────────┤
│ Πολυκατοικία Τούμπας │ ██████░ 65%  │ 0.78 │ 0.83 │ 3 tasks  │ ⚠️ 3      │ Roofing 12/04  │ 🔴 Late │
│ Μεζονέτα Καλαμαριά   │ ████░░ 40%  │ 1.02 │ 0.95 │ 0 tasks  │ —         │ Frame 20/04    │ 🟢 OK   │
│ Γραφεία Πυλαία       │ █░░░░░ 12%  │ 0.98 │ 1.01 │ 1 task   │ ⚠️ 1      │ Found. 05/05   │ 🟢 OK   │
│ Αποθήκη Σίνδος       │ █████████ 90% │ 0.91 │ 0.88 │ 2 tasks  │ ⚠️ 2      │ Handover 01/05 │ 🟡 Risk │
└──────────────────────┴──────────┴──────┴──────┴──────────┴───────────┴────────────┴─────────┘
```

#### Columns:

| Column | Source | Display |
|--------|--------|---------|
| Building | Building name | Link → Building Dashboard (per-building) |
| Progress | WEIGHTED_AVG(phases.progress) | Progress bar + percentage |
| SPI | computeEVM().spi | Color-coded: 🟢 ≥0.95, 🟡 0.85-0.94, 🔴 <0.85 |
| CPI | computeEVM().cpi | Color-coded: same thresholds |
| Delayed Tasks | COUNT(status='delayed' OR 'blocked') | Number + click → expand |
| Alerts | COUNT(active construction_alerts) | Badge + click → alert list |
| Next Milestone | Nearest incomplete milestone | Name + date |
| Status | Worst of (SPI, CPI, delayed count) | Traffic light: 🟢 OK, 🟡 Risk, 🔴 Late |

#### Sorting & Filtering:

- **Default sort**: Status DESC (worst first — 🔴 on top)
- **Sort by**: Click column header → sort by that column
- **Filter**: Status dropdown (All / On Track / At Risk / Late)
- **Filter**: Search by building name

#### KPI Summary Cards (Top of Page)

```
┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ 4 Active       │ │ Avg Progress   │ │ Avg SPI        │ │ Total Alerts   │
│ Buildings      │ │ 52%            │ │ 0.92           │ │ ⚠️ 6           │
│                │ │ ▼ -3% vs plan  │ │ ▼ 0.08 below 1 │ │ 3 🔴 2 🟡 1 ℹ️ │
└────────────────┘ └────────────────┘ └────────────────┘ └────────────────┘
```

#### Click-Through (Google Drill-Down Pattern)

- **Click building row** → Navigate to per-building Dashboard (`/buildings/{id}?tab=timeline&view=dashboard`)
- **Click alert badge** → Expand inline alert list for that building
- **Click delayed count** → Expand inline delayed tasks list

#### Data Loading

```
Portfolio Page loads
  └→ Fetch ALL buildings where constructionStatus = 'active'
       └→ For each building (parallel):
            ├→ Fetch phases (lightweight — only progress, dates, status)
            ├→ Fetch alerts count
            ├→ computeEVM() per building (client-side)
            └→ Find nearest milestone
  └→ Render table (skeleton loaders per row while computing)
```

**Performance**: Αν 10+ buildings → paginate (10 per page) ή virtual scroll. Για μικρό αριθμό (1-10) → load all.

#### Export

- **PDF**: Portfolio summary table — 1 page A4 landscape
- **Excel**: Building comparison workbook (summary + per-building sheets)

#### Phase Assignment
- **Phase D** (μαζί με Alerts — shared alert count column)

### 5.10 RFI Tracking (Procore / PlanGrid / Fieldwire pattern)

**Industry Context**: Τα RFIs (Requests for Information) είναι τεχνικά ερωτήματα προς μηχανικό/αρχιτέκτονα. Αν δεν απαντηθούν, **μπλοκάρουν εργασίες**. Procore, PlanGrid, Fieldwire τα δείχνουν inline στο schedule dashboard.

#### Data Model — New Collection

**`construction_rfis`**:
```typescript
interface ConstructionRFI {
  id: string;                // 'crfi_XXXXX' (enterprise-id)
  buildingId: string;
  companyId: string;
  number: number;            // sequential per building: RFI-001, RFI-002...
  subject: string;           // "Θέση πίνακα στο υπόγειο;"
  description: string;       // detailed question
  phaseId: string;           // linked phase
  taskId?: string;           // optional linked task
  status: 'draft' | 'open' | 'answered' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;       // userId — μηχανικός/αρχιτέκτονας
  dueDate?: string;          // ISO date — deadline for response
  answer?: string;           // the response text
  answeredBy?: string;       // userId who answered
  answeredAt?: Timestamp;
  attachments: Array<{       // photos, drawings, PDFs
    url: string;
    name: string;
    type: string;
  }>;
  blocksTask: boolean;       // true = αυτό το RFI μπλοκάρει εργασία
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### Dashboard Integration — Variance Table

Στο Variance Table, κάθε phase row δείχνει **open RFI count**:

```
▶ PH-004 Electrical        +3d 🟡   +€5.000 🟡   ⏱60% 🔨45%
  📋 2 open RFIs
  ├─ TSK-010 Panel Install    +3d 🟡   ⏱70% 🔨40%
  │  📋 RFI-012: "Θέση πίνακα στο υπόγειο;" — pending 5d ⚠️
  ├─ TSK-011 Cable Routing    0d  🟢   ⏱30% 🔨30%
  │  📋 RFI-014: "Τύπος καλωδίου UTP;" — pending 2d
```

**Click behavior**: Click RFI → Side panel with full RFI details + answer form

#### Lookahead Integration

Στο Lookahead table, tasks με blocking RFIs δείχνουν warning:

```
TSK-010 Panel Install    08/04–15/04    👷 3    ⏱70% 🔨40%
  ⚠️ Blocked by: Formwork (80%)
  📋 RFI-012: "Θέση πίνακα;" — pending 5d, BLOCKS task
```

#### RFI List View (dedicated section στο Dashboard)

Κάτω από το Variance Table, collapsible section:

```
┌─────────────────────────────────────────────────────────────────────┐
│ 📋 RFIs — 4 Open, 2 Answered, 8 Closed                    [+ New] │
│                                                                     │
│ # │ Subject                    │ Phase      │ Priority │ Age  │ Sta │
│ 12│ Θέση πίνακα υπόγειο       │ Electrical │ 🔴 High  │ 5d   │ Open│
│ 14│ Τύπος καλωδίου UTP        │ Electrical │ 🟡 Med   │ 2d   │ Open│
│ 15│ Στεγάνωση δώματος τύπος   │ Roofing    │ 🔴 High  │ 1d   │ Open│
│ 16│ Χρώμα εξωτερικής βαφής    │ Finishes   │ 🟢 Low   │ 0d   │ Open│
└─────────────────────────────────────────────────────────────────────┘
```

**Sorting**: Default by priority DESC → age DESC (highest priority, oldest first)
**Filter**: Status (open / answered / all), Priority

#### RFI Create/Answer Flow

```
Εργοδηγός βρίσκει πρόβλημα στο εργοτάξιο
  └→ Dashboard → RFI section → [+ New RFI]
       └→ Form: subject, description, phase, task, priority, due date
            └→ Optional: attach photo (reuse usePhotoCapture)
                 └→ Save → status: 'open'
                      └→ Notification στον αρχιτέκτονα (Telegram + in-app)

Αρχιτέκτονας απαντάει
  └→ RFI detail panel → Answer field → Submit
       └→ status: 'answered'
            └→ Notification στον εργοδηγό (Telegram + in-app)
                 └→ Εργοδηγός κλείνει: status: 'closed'
```

#### Alert Integration (§5.8)

Νέοι alert rules:

| Rule | Default Threshold | Severity |
|------|-------------------|----------|
| RFI Overdue | age > dueDate | HIGH |
| RFI Blocking Task | blocksTask = true AND age > 3 days | CRITICAL |
| RFI Unanswered | status = 'open' AND age > 7 days | MEDIUM |

#### Owner Report PDF

Στο Owner Report προστίθεται:
- **Open RFIs count**: "4 ανοιχτά τεχνικά ερωτήματα"
- **Critical RFIs**: Αν blocksTask = true, αναφέρεται ρητά

#### Phase Assignment
- **Phase E** (νέο module, νέα collection, notification integration)

### 5.11 Inspection Checklists & Quality Hold Points (Procore / PlanGrid / Fieldwire pattern)

**Industry Context**: Σε κρίσιμα σημεία της κατασκευής πρέπει να γίνει έλεγχος ποιότητας πριν προχωρήσει η εργασία. Procore, PlanGrid, Fieldwire χρησιμοποιούν **checklists με hold points** — η εργασία μπλοκάρεται αυτόματα αν δεν περάσει ο έλεγχος.

#### Τύποι Inspection Items

| Τύπος | Σύμβολο | Behavior |
|-------|---------|----------|
| **Checkpoint** | ✅/🔲 | Regular check — informational, δεν μπλοκάρει |
| **Hold Point** | 🛑 | **CRITICAL** — η εργασία ΔΕΝ μπορεί να συνεχιστεί χωρίς approval |
| **Witness Point** | 👁️ | Ο μηχανικός πρέπει να είναι παρών (αλλά δεν μπλοκάρει αν δεν έρθει) |

#### Data Model — New Collections

**`construction_checklists`** (template per phase):
```typescript
interface ConstructionChecklist {
  id: string;                // 'cchk_XXXXX' (enterprise-id)
  buildingId: string;
  companyId: string;
  phaseId: string;           // linked to ConstructionPhase
  taskId?: string;           // optional: linked to specific task
  name: string;              // "Έλεγχος Θεμελίωσης"
  status: 'pending' | 'in_progress' | 'passed' | 'failed' | 'passed_with_issues';
  items: Array<{
    id: string;              // 'cchki_XXXXX'
    description: string;     // "Οπλισμός τοποθετημένος σύμφωνα με μελέτη"
    type: 'checkpoint' | 'hold_point' | 'witness_point';
    status: 'pending' | 'passed' | 'failed' | 'not_applicable';
    checkedBy?: string;      // userId
    checkedAt?: Timestamp;
    notes?: string;          // optional comment
    photoIds?: string[];     // evidence photos (reuse construction_site_photos)
  }>;
  inspectorId?: string;      // userId — μηχανικός/επιβλέπων
  scheduledDate?: string;    // ISO date — πότε θα γίνει ο έλεγχος
  completedAt?: Timestamp;
  signedOff: boolean;        // final approval by inspector
  signedOffBy?: string;
  signedOffAt?: Timestamp;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### Hold Point Enforcement

**Αυτόματο blocking**: Αν μια checklist έχει hold_point items που είναι `pending` ή `failed`:
- Η συνδεδεμένη φάση/task **δεν μπορεί να αλλάξει σε status `completed`**
- Στο Gantt: **🛑 icon** δίπλα στο task name
- Στο Dashboard: Warning alert

**Logic**:
```
on task.setStatus('completed'):
  checklist = getChecklist(task.phaseId, task.id)
  holdPoints = checklist.items.filter(i => i.type === 'hold_point')
  unresolved = holdPoints.filter(i => i.status !== 'passed')
  if (unresolved.length > 0):
    BLOCK completion → show error: "🛑 Hold Point: {item.description} — δεν έχει περάσει"
```

#### Checklist Templates (Pre-configured per Phase Type)

Κάθε τύπος φάσης έχει **default checklist template** (configurable):

**Foundation Phase**:
```
🔲 Εκσκαφή σε σωστό βάθος ± 5cm
🔲 Στάθμη υπεδάφους ελεγμένη
🔲 Οπλισμός τοποθετημένος σύμφωνα με μελέτη
🛑 HOLD POINT: Επιθεώρηση μηχανικού ΠΡΙΝ σκυροδέτηση
🔲 Ξυλότυπος ευθυγραμμισμένος & σταθερός
👁️ WITNESS: Παρουσία μηχανικού κατά σκυροδέτηση
🔲 Δείγμα σκυροδέματος ληφθέν (κύβοι)
🔲 Σκυρόδεμα δονημένο & επιπεδωμένο
```

**Structural Frame**:
```
🔲 Κολώνες ευθυγραμμισμένες ± 2mm
🔲 Διαστάσεις δοκών σύμφωνα με μελέτη
🛑 HOLD POINT: Έλεγχος οπλισμού πριν σκυροδέτηση πλάκας
👁️ WITNESS: Παρουσία μηχανικού κατά σκυροδέτηση πλάκας
🔲 Δείγμα σκυροδέματος ληφθέν
```

**Templates**: Αποθηκεύονται στο `construction-templates.ts` (ΗΔΗ ΥΠΑΡΧΕΙ — 15 phases, 60+ tasks). Προσθήκη `defaultChecklist` ανά phase type.

#### Dashboard Integration

**Variance Table — Checklist status per phase**:
```
▶ PH-002 Foundation        +7d 🔴  +€12.000 🔴  ⏱80% 🔨50%
  📋 2 RFIs   🛑 Hold Point: Επιθεώρηση μηχανικού (pending)
  ✅ Checklist: 5/8 items passed
```

**Lookahead — Upcoming inspections**:
```
TSK-003 Concrete Pour    03/04–10/04    👷 8
  🛑 HOLD POINT: Επιθεώρηση μηχανικού — scheduled 02/04
```

#### Alert Integration (§5.8)

Νέοι alert rules:

| Rule | Default Threshold | Severity |
|------|-------------------|----------|
| Hold Point Upcoming | scheduledDate ≤ today + 2 days | HIGH |
| Hold Point Overdue | scheduledDate < today AND status = 'pending' | CRITICAL |
| Checklist Failed | status = 'failed' | HIGH |
| Inspection Not Scheduled | phase progress > 70% AND no checklist scheduled | MEDIUM |

#### Mobile Flow (Εργοδηγός/Μηχανικός στο εργοτάξιο)

```
Μηχανικός φτάνει στο εργοτάξιο
  └→ Building → Timeline → Dashboard → Checklist section
       └→ Open checklist for current phase
            └→ Tap item → Pass ✅ / Fail ❌ / N/A
                 └→ Optional: attach photo (evidence)
                      └→ Hold Point passed → task unblocked
                           └→ Sign-off → checklist completed
```

#### Phase Assignment
- **Phase E** (μαζί με RFI — shared inspection/quality domain)

### 5.12 Punch List / Snag List (Procore / PlanGrid / Fieldwire pattern)

**Industry Context**: Στο τέλος κάθε φάσης (ή πριν την παράδοση), ο μηχανικός επιθεωρεί και καταγράφει **ελαττώματα/ελλείψεις** που πρέπει να διορθωθούν. Χωρίς Punch List η παράδοση γίνεται χαοτική.

#### Data Model — New Collection

**`construction_punch_items`**:
```typescript
interface ConstructionPunchItem {
  id: string;                // 'cpunch_XXXXX' (enterprise-id)
  buildingId: string;
  companyId: string;
  number: number;            // sequential per building: #1, #2, #3...
  phaseId: string;           // linked phase
  taskId?: string;           // optional linked task
  location: string;          // "Βόρεια γωνία θεμελίου", "Υπόγειο, δωμάτιο Β2"
  description: string;       // "Ρωγμή στη βόρεια γωνία θεμελίου"
  category: 'defect' | 'incomplete' | 'damage' | 'cosmetic' | 'safety';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'fixed' | 'verified' | 'rejected';
  assignedTo?: string;       // userId ή εξωτερικός εργολάβος (free text)
  assignedCompany?: string;  // "Εργολάβος Α", "Υδραυλικός Β"
  dueDate?: string;          // ISO date
  photosBefore: string[];    // evidence photos — τι βρέθηκε
  photosAfter: string[];     // verification photos — τι διορθώθηκε
  floorplanPin?: {           // optional: pin στο floorplan (αν υπάρχει)
    x: number;
    y: number;
    floorId: string;
  };
  fixedBy?: string;
  fixedAt?: Timestamp;
  verifiedBy?: string;       // μηχανικός που επαλήθευσε τη διόρθωση
  verifiedAt?: Timestamp;
  rejectionReason?: string;  // αν verification απέτυχε
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### Punch List Lifecycle (Procore 4-step pattern)

```
1. ΔΗΜΙΟΥΡΓΙΑ (μηχανικός/εργοδηγός)
   └→ Εντοπίζει ελάττωμα → φωτογραφία → περιγραφή → assign
        └→ status: 'open'

2. ΔΙΟΡΘΩΣΗ (εργολάβος/τεχνίτης)
   └→ Βλέπει τα assigned items → διορθώνει → φωτογραφία "after"
        └→ status: 'fixed'

3. ΕΠΑΛΗΘΕΥΣΗ (μηχανικός)
   └→ Ελέγχει τη διόρθωση → OK ή reject
        └→ status: 'verified' ✅  ή  'rejected' → πίσω στο 'open'

4. ΠΑΡΑΔΟΣΗ
   └→ Όταν ΟΛΑ τα items = 'verified' → phase/building ready for handover
```

#### Dashboard Integration

**Νέο KPI card** (Phase E):
```
┌──────────────────────┐
│ 📋 Punch List        │
│ 12 open / 28 total   │
│ 4 🔴  5 🟡  3 🟢     │
│ Oldest: 8 days       │
└──────────────────────┘
```

**Variance Table — per phase**:
```
▶ PH-002 Foundation        +7d 🔴   ⏱80% 🔨50%
  📋 2 RFIs  🛑 Hold Point  📌 4 punch items (2 open, 1 fixed, 1 verified)
```

#### Punch List View (dedicated section στο Dashboard)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📌 Punch List — 12 Open, 8 Fixed, 8 Verified                    [+ New]  │
│ Filter: [All ▼] [All Phases ▼] [All Priority ▼]                          │
│                                                                            │
│ #  │ Description                │ Phase      │ Assigned    │ Pri │ Status  │
│  1 │ Ρωγμή βόρεια γωνία θεμ.  │ Foundation │ Εργολάβος Α │ 🔴  │ Open    │
│  2 │ Στεγάνωση ατελής ΒΑ      │ Foundation │ Υδραυλικός  │ 🟡  │ Fixed   │
│  3 │ Καθαρισμός χώρου          │ Foundation │ Εργάτης     │ 🟢  │ ✅ Done │
│  4 │ Σοβάς αποκόλληση 2ος     │ Finishes   │ Σοβατζής    │ 🟡  │ Open    │
│  ...                                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Row click** → Side panel:
- Before/After photos side-by-side
- Description + location
- Status history (created → fixed → verified)
- Action buttons: Fix / Verify / Reject

#### Before/After Photo Comparison (PlanGrid pattern)

```
┌─────────────────────────────────┐
│ 📌 #1 — Ρωγμή βόρεια γωνία    │
│                                  │
│  BEFORE         │  AFTER         │
│  [📷 photo]     │  [📷 photo]    │
│  05/04 14:32    │  09/04 10:15   │
│                                  │
│  Status: Fixed → Pending verify  │
│  [✅ Verify]  [❌ Reject]        │
└─────────────────────────────────┘
```

#### Handover Readiness Check

Πριν την παράδοση φάσης/building, αυτόματος έλεγχος:

```
🏁 Handover Readiness — PH-002 Foundation:
  ✅ All tasks completed
  ✅ All hold points passed
  ✅ All RFIs answered & closed
  ❌ 2 punch items still open ← BLOCKS handover
  ⚠️ 1 punch item fixed, pending verification
```

**Blocking rule**: Handover **δεν** ολοκληρώνεται αν υπάρχουν `open` ή `fixed` (unverified) punch items με priority `high` ή `critical`.

#### Alert Integration (§5.8)

| Rule | Default Threshold | Severity |
|------|-------------------|----------|
| Punch Item Overdue | dueDate < today AND status ∈ ['open', 'in_progress'] | HIGH |
| Critical Defect Open | priority = 'critical' AND status = 'open' > 2 days | CRITICAL |
| Phase Handover Blocked | all tasks done BUT open punch items exist | MEDIUM |
| Punch Items Aging | 5+ items open > 7 days | MEDIUM |

#### Owner Report PDF

Στο Owner Report προστίθεται:
- **Punch List Summary**: "12 items identified, 8 resolved, 4 pending"
- **Critical items**: Λίστα priority=high/critical items

#### Phase Assignment
- **Phase E** (μαζί με RFI + Inspection — shared quality domain)

### 5.13 Change Orders / Εντολές Αλλαγής (Procore / Buildertrend / CoConstruct pattern)

**Industry Context**: Κατά τη διάρκεια του έργου ο ιδιοκτήτης, ο μηχανικός ή οι συνθήκες εργοταξίου δημιουργούν αλλαγές στο scope. Χωρίς Change Order tracking, στο τέλος κανείς δεν ξέρει **γιατί** ξεπέρασε τον budget ή γιατί καθυστέρησε.

#### Data Model — New Collection

**`construction_change_orders`**:
```typescript
interface ConstructionChangeOrder {
  id: string;                // 'cco_XXXXX' (enterprise-id)
  buildingId: string;
  companyId: string;
  number: number;            // sequential per building: CO-001, CO-002...
  title: string;             // "Αντικατάσταση πλακιδίων με μάρμαρο"
  description: string;       // detailed scope of change
  reason: 'owner_request' | 'design_change' | 'site_condition' | 'regulatory' | 'error_correction' | 'value_engineering';
  requestedBy: string;       // who asked for the change
  requestedAt: Timestamp;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'executed' | 'voided';

  // Impact
  costImpact: number;        // +€8.500 (positive = cost increase, negative = saving)
  durationImpact: number;    // +5 days (positive = delay, negative = acceleration)
  phasesAffected: string[];  // phaseIds impacted by the change
  tasksAffected: string[];   // taskIds impacted

  // BOQ Changes
  boqItemsAdded: Array<{
    description: string;
    estimatedCost: number;
  }>;
  boqItemsRemoved: string[]; // boqItemIds removed
  boqItemsModified: Array<{
    boqItemId: string;
    originalCost: number;
    revisedCost: number;
  }>;

  // Approval
  approvedBy?: string;       // userId
  approvedAt?: Timestamp;
  rejectedBy?: string;
  rejectedAt?: Timestamp;
  rejectionReason?: string;

  // Execution
  executedAt?: Timestamp;

  // Attachments
  attachments: Array<{
    url: string;
    name: string;
    type: string;            // 'drawing' | 'photo' | 'document' | 'estimate'
  }>;

  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### Change Order Lifecycle (Procore 5-step pattern)

```
1. DRAFT (PM/Εργοδηγός)
   └→ Εντοπίζει ανάγκη αλλαγής → περιγραφή + cost/duration impact estimate
        └→ status: 'draft'

2. PENDING APPROVAL (→ Ιδιοκτήτης/PM)
   └→ Submit for approval → ιδιοκτήτης βλέπει impact
        └→ status: 'pending_approval'
        └→ Telegram notification → "CO-003: +€8.500, +5 days — approve?"

3. APPROVED / REJECTED
   └→ Ιδιοκτήτης εγκρίνει ή απορρίπτει
        └→ status: 'approved' → budget/schedule revised
        └→ status: 'rejected' → no changes

4. EXECUTED (PM)
   └→ Οι αλλαγές υλοποιήθηκαν στο εργοτάξιο
        └→ status: 'executed'
        └→ BOQ items updated, phase dates adjusted

5. VOIDED (αν ακυρωθεί μετά approval)
   └→ status: 'voided' → budget/schedule reverted
```

#### Budget Impact Tracking

**Running Total** — πάντα visible στο Dashboard:
```
┌──────────────────────────────────────────┐
│ 💰 Budget Tracking                       │
│                                          │
│ Original Contract:      €185.000         │
│ Approved Change Orders: +€22.300 (3 COs) │
│ Revised Budget:         €207.300         │
│ Actual Spent:           €142.500         │
│ Remaining:              €64.800          │
│                                          │
│ Pending COs:            +€8.500 (1 CO)   │
│ Potential Revised:      €215.800         │
└──────────────────────────────────────────┘
```

#### Schedule Impact Tracking

```
┌──────────────────────────────────────────┐
│ 📅 Schedule Impact                       │
│                                          │
│ Original Duration:      180 days         │
│ CO Duration Impact:     +12 days (3 COs) │
│ Revised Duration:       192 days         │
│ Original Completion:    15/06/2026       │
│ Revised Completion:     27/06/2026       │
│                                          │
│ Pending COs:            +5 days (1 CO)   │
│ Potential Completion:   02/07/2026       │
└──────────────────────────────────────────┘
```

#### Dashboard Integration

**Νέο KPI card**:
```
┌──────────────────────┐
│ 📝 Change Orders     │
│ 3 approved (+€22.3K) │
│ 1 pending (+€8.5K)   │
│ Budget: +12% vs orig │
└──────────────────────┘
```

**Variance Table — cost column enhanced**:
```
▶ PH-008 Finishes     +5d 🟡   +€8.500 🔴 (CO-003)   ⏱40% 🔨35%
                                 ↑ click → CO detail
```

#### Change Order List View

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 📝 Change Orders — 3 Approved, 1 Pending, 0 Rejected              [+ New] │
│                                                                             │
│ CO# │ Title                     │ Reason      │ Cost     │ Days │ Status    │
│ 003 │ Μάρμαρο αντί πλακίδια   │ Owner Req.  │ +€8.500  │ +5   │ 🟡 Pending│
│ 002 │ Ενίσχυση θεμελίου       │ Site Cond.  │ +€12.000 │ +7   │ ✅ Exec.  │
│ 001 │ Αλλαγή ηλεκτρ. πίνακα  │ Design Chg. │ +€1.800  │ 0    │ ✅ Exec.  │
│ 000 │ Απαλοιφή αποθήκης       │ Value Eng.  │ -€3.200  │ -3   │ ✅ Exec.  │
│                                                          ──────            │
│                                        Total Approved:  +€19.100  +9 days  │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Reason Categories (i18n)

| Key | Ελληνικά | English |
|-----|----------|---------|
| `owner_request` | Αίτημα ιδιοκτήτη | Owner Request |
| `design_change` | Αλλαγή μελέτης | Design Change |
| `site_condition` | Συνθήκες εργοταξίου | Unforeseen Site Condition |
| `regulatory` | Κανονιστική απαίτηση | Regulatory Requirement |
| `error_correction` | Διόρθωση σφάλματος | Error/Omission Correction |
| `value_engineering` | Βελτιστοποίηση αξίας | Value Engineering |

#### Owner Report PDF — Enhanced

Το Owner Report αποκτά **κρίσιμο νέο section**:

```
📝 ΕΝΤΟΛΕΣ ΑΛΛΑΓΗΣ
──────────────────
Εγκεκριμένες: 3 (σύνολο: +€19.100, +9 ημέρες)
Εκκρεμείς:    1 (εκτίμηση: +€8.500, +5 ημέρες)

Αρχικός Π/Υ:    €185.000 → Αναθεωρημένος: €207.300 (+12%)
Αρχική Διάρκεια: 180 ημ. → Αναθεωρημένη: 192 ημ. (+7%)

Ανάλυση ανά αιτία:
  Αίτημα ιδιοκτήτη:    €8.500  (41%)
  Συνθήκες εργοταξίου: €12.000 (58%)
  Value Engineering:    -€3.200 (-15%)  ← εξοικονόμηση
```

**Γιατί κρίσιμο**: Ο ιδιοκτήτης βλέπει **ακριβώς** γιατί αυξήθηκε ο budget — δεν μπορεί να κατηγορήσει τον εργολάβο αν η αύξηση είναι δικά του αιτήματα.

#### Alert Integration (§5.8)

| Rule | Default Threshold | Severity |
|------|-------------------|----------|
| CO Pending > 5 days | age > 5 AND status = 'pending_approval' | HIGH |
| Budget Overrun | total COs > 15% of original budget | HIGH |
| CO Impact on Critical Path | CO affects phase on critical path | CRITICAL |
| CO Unapproved but Work Started | status = 'pending' AND work in progress | CRITICAL |

#### S-Curve Enhancement

Στο S-Curve chart (§5.2), **δεύτερη planned line** μετά τα approved COs:

```
--- Original PV (dashed gray)     ← αρχικό πλάνο
─── Revised PV (solid gray)       ← μετά approved COs  ← ΝΕΟ
─── Earned Value (solid blue)
─── Actual Cost (solid red)
```

Αυτό δείχνει ξεκάθαρα: "βάσει αρχικού πλάνου ήμασταν πίσω, αλλά βάσει αναθεωρημένου (με COs) είμαστε on track".

#### Phase Assignment
- **Phase F** (νέο module, νέα collection, budget/schedule revision logic)

### 5.14 Safety Incidents & Toolbox Talks (Procore / SafetyCulture / Legal Requirement)

**Industry & Legal Context**: Στην Ελλάδα είναι **νομική υποχρέωση** (ΠΔ 305/96, Ν.3850/2010, ΠΔ 17/96) η τήρηση αρχείου ατυχημάτων/συμβάντων εργοταξίου. Procore, SafetyCulture, Fieldwire ενσωματώνουν safety tracking στο schedule dashboard.

#### Data Model — New Collections

**`construction_safety_incidents`**:
```typescript
interface ConstructionSafetyIncident {
  id: string;                // 'csafe_XXXXX' (enterprise-id)
  buildingId: string;
  companyId: string;
  number: number;            // sequential: INC-001, INC-002...
  date: string;              // ISO date of incident
  time?: string;             // HH:mm
  type: 'near_miss' | 'first_aid' | 'medical_treatment' | 'lost_time' | 'fatality' | 'property_damage' | 'environmental';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;       // what happened
  location: string;          // where on site
  phaseId?: string;          // related phase
  taskId?: string;           // related task

  // People involved
  injuredPerson?: {
    name: string;
    role: string;            // 'worker' | 'visitor' | 'subcontractor' | 'supervisor'
    company?: string;
    injuryType?: string;     // 'cut' | 'fall' | 'struck_by' | 'strain' | 'burn' | 'other'
    bodyPart?: string;       // 'hand' | 'head' | 'back' | 'leg' | 'eye' | 'other'
  };
  witnesses: string[];       // names

  // Investigation
  rootCause?: string;        // investigation finding
  correctiveActions: Array<{
    description: string;
    assignedTo: string;
    dueDate: string;
    status: 'open' | 'completed';
    completedAt?: Timestamp;
  }>;
  preventiveMeasures?: string; // what we'll do to prevent recurrence

  // Evidence
  photoIds: string[];        // incident photos
  attachments: Array<{       // reports, forms
    url: string;
    name: string;
    type: string;
  }>;

  // Reporting
  reportedBy: string;
  reportedAt: Timestamp;
  reportedToAuthorities: boolean;  // ΣΕΠΕ notification required for serious incidents
  authoritiesReportDate?: string;

  status: 'reported' | 'investigating' | 'corrective_actions' | 'closed';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**`construction_toolbox_talks`**:
```typescript
interface ConstructionToolboxTalk {
  id: string;                // 'ctalk_XXXXX' (enterprise-id)
  buildingId: string;
  companyId: string;
  date: string;              // ISO date
  topic: string;             // "Ασφάλεια σκαλωσιών"
  category: 'fall_protection' | 'electrical' | 'excavation' | 'scaffolding' | 'fire' | 'ppe' | 'lifting' | 'confined_space' | 'weather' | 'housekeeping' | 'other';
  presenter: string;         // who gave the talk
  attendees: Array<{
    name: string;
    company?: string;
    signed: boolean;         // digital signature / attendance confirmation
  }>;
  duration: number;          // minutes
  notes?: string;            // key points discussed
  attachments: Array<{       // presentation, handout
    url: string;
    name: string;
  }>;
  createdBy: string;
  createdAt: Timestamp;
}
```

#### Incident Severity Classification (Greek Law + OSHA alignment)

| Type | Ελληνικά | Severity | ΣΕΠΕ Report | Work Stoppage |
|------|----------|----------|-------------|---------------|
| `near_miss` | Παρ' ολίγον ατύχημα | 🟡 LOW | Όχι | Όχι |
| `first_aid` | Πρώτες βοήθειες | 🟡 MEDIUM | Όχι | Όχι |
| `medical_treatment` | Ιατρική περίθαλψη | 🔴 HIGH | Ναι (48h) | Πιθανό |
| `lost_time` | Απώλεια εργάσιμου χρόνου | 🔴 HIGH | Ναι (24h) | Ναι |
| `fatality` | Θανατηφόρο | 🔴 CRITICAL | Άμεσα | Υποχρεωτικό |
| `property_damage` | Υλική ζημιά | 🟡 MEDIUM | Εξαρτάται | Όχι |
| `environmental` | Περιβαλλοντικό | 🟡 MEDIUM | Εξαρτάται | Όχι |

#### Dashboard Integration

**Safety KPI Card**:
```
┌──────────────────────┐
│ 🦺 Safety            │
│ 0 incidents (30d)    │
│ 45 days incident-free│
│ 3 toolbox talks (mo) │
│ ✅ ΣΕΠΕ compliant     │
└──────────────────────┘
```

**Key Metrics**:
- **Days Since Last Incident**: Counter — resets on any incident
- **Incident Rate**: Incidents per 1000 worker-hours (TRIR equivalent)
- **Toolbox Talk Frequency**: Talks per month vs target (min 1/week)
- **Open Corrective Actions**: From past incidents

#### Safety Section (collapsible στο Dashboard)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🦺 Safety Log — 45 days incident-free                    [+ Incident] [+ Talk] │
│                                                                                 │
│ INCIDENTS (3 total, 0 open)                                                    │
│ # │ Date    │ Type       │ Description                 │ Severity │ Status     │
│ 3 │ 03/04  │ Near-miss  │ Πτώση υλικού σκαλωσιά      │ 🟡       │ ✅ Closed  │
│ 2 │ 28/03  │ First Aid  │ Κόψιμο χεριού εργάτη       │ 🟡       │ ✅ Closed  │
│ 1 │ 15/03  │ Property   │ Σπασμένο τζάμι φορτωτής   │ 🟡       │ ✅ Closed  │
│                                                                                 │
│ TOOLBOX TALKS (8 total)                                                        │
│ Date   │ Topic                    │ Attendees │ Duration │
│ 05/04  │ Ασφάλεια σκαλωσιών     │ 8         │ 15 min   │
│ 29/03  │ PPE υποχρεώσεις        │ 12        │ 10 min   │
│ 22/03  │ Ανύψωση φορτίων        │ 6         │ 20 min   │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Owner Report PDF

```
🦺 ΑΣΦΑΛΕΙΑ ΕΡΓΟΤΑΞΙΟΥ
──────────────────────
Ημέρες χωρίς ατύχημα:  45
Συμβάντα (σύνολο):      3 (0 σοβαρά)
Toolbox Talks:           8 (μέσος όρος: 2/εβδομάδα ✅)
Ανοιχτές διορθωτικές:   0

✅ Συμμόρφωση ΣΕΠΕ: Πλήρης
```

#### Alert Integration (§5.8)

| Rule | Default Threshold | Severity |
|------|-------------------|----------|
| Serious Incident | type ∈ ['medical_treatment', 'lost_time', 'fatality'] | CRITICAL — immediate Telegram |
| Corrective Action Overdue | dueDate < today AND status = 'open' | HIGH |
| No Toolbox Talk | 0 talks in last 7 days | MEDIUM |
| ΣΕΠΕ Report Due | serious incident AND reportedToAuthorities = false AND age > 24h | CRITICAL |

#### Toolbox Talk Scheduling (Procore pattern)

**Auto-suggest**: Αν γίνει incident type X → suggest relevant toolbox talk topic:
- `near_miss` πτώση → suggest "Fall Protection" talk
- `first_aid` κόψιμο → suggest "PPE Requirements" talk
- Weather alert → suggest "Weather Safety" talk

#### Phase Assignment
- **Phase G** (ξεχωριστό safety domain, legal compliance)

### 5.15 Submittals / Υποβολές Υλικών (Procore / PlanGrid pattern)

**Industry Context**: Πριν τοποθετηθεί υλικό στο εργοτάξιο, ο εργολάβος πρέπει να υποβάλει **δείγμα ή τεχνικό φυλλάδιο** στον αρχιτέκτονα/μηχανικό για έγκριση. Χωρίς tracking → λάθος υλικά → αφαίρεση → κόστος + καθυστέρηση.

**Σχέση με ADR-267 (Procurement)**: Τα Submittals συνδέονται με Purchase Orders — μετά το submittal approval γίνεται η παραγγελία. Αυτό το section τεκμηριώνει τη λειτουργικότητα, η υλοποίηση θα ενσωματωθεί στο ADR-267 Procurement module.

#### Data Model — New Collection

**`construction_submittals`**:
```typescript
interface ConstructionSubmittal {
  id: string;                // 'csubm_XXXXX' (enterprise-id)
  buildingId: string;
  companyId: string;
  number: number;            // sequential: SUB-001, SUB-002...
  title: string;             // "Πλακίδια δαπέδου Porcelanosa"
  description: string;       // τεχνικά χαρακτηριστικά, specifications
  category: 'material' | 'equipment' | 'shop_drawing' | 'product_data' | 'sample' | 'mock_up';
  phaseId: string;           // linked phase
  taskId?: string;           // optional linked task
  boqItemId?: string;        // linked BOQ item (αν υπάρχει)
  purchaseOrderId?: string;  // linked PO (ADR-267, μετά approval)

  // Spec Reference
  specSection?: string;      // "09 30 00 — Tiling" (CSI format)

  // Submission
  submittedBy: string;       // εργολάβος/προμηθευτής
  submittedAt: Timestamp;

  // Review
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'approved_with_comments' | 'revise_and_resubmit' | 'rejected';
  reviewedBy?: string;       // αρχιτέκτονας/μηχανικός
  reviewedAt?: Timestamp;
  reviewComments?: string;
  revisionNumber: number;    // 0 = original, 1+ = revisions after rejection

  // Schedule Impact
  requiredByDate: string;    // ISO — πότε πρέπει να έχει εγκριθεί (otherwise blocks work)
  leadTime: number;          // days — πόσες μέρες μετά approval χρειάζεται για delivery

  // Attachments
  attachments: Array<{
    url: string;
    name: string;
    type: string;            // 'spec_sheet' | 'sample_photo' | 'shop_drawing' | 'catalog' | 'test_report'
    revision: number;
  }>;

  // History (all revisions)
  history: Array<{
    action: 'submitted' | 'reviewed' | 'revised' | 'approved' | 'rejected';
    by: string;
    at: Timestamp;
    comments?: string;
    revision: number;
  }>;

  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### Submittal Lifecycle (Procore 6-step pattern)

```
1. DRAFT (Εργολάβος/PM)
   └→ Ετοιμάζει spec sheet, δείγμα, shop drawing
        └→ status: 'draft'

2. SUBMITTED (→ Αρχιτέκτονας/Μηχανικός)
   └→ Upload attachments → submit for review
        └→ status: 'submitted'
        └→ Telegram: "SUB-005: Πλακίδια Porcelanosa — review needed by 10/04"

3. UNDER REVIEW (Αρχιτέκτονας)
   └→ Examines spec, compares with design intent
        └→ status: 'under_review'

4. DECISION
   └→ ✅ 'approved' — proceed with procurement
   └→ ✅ 'approved_with_comments' — OK with minor notes
   └→ 🔄 'revise_and_resubmit' — εργολάβος υποβάλει ξανά (revision++)
   └→ ❌ 'rejected' — find alternative material

5. PROCUREMENT (μετά approval)
   └→ Create Purchase Order (ADR-267 link)
        └→ purchaseOrderId linked

6. DELIVERY + INSTALLATION
   └→ Material arrives → ready for task
```

#### Dashboard Integration

**Variance Table — per phase**:
```
▶ PH-008 Finishes      +5d 🟡  +€8.500 🔴  ⏱40% 🔨35%
  📋 1 RFI  📦 SUB-005: Πλακίδια — 🟡 Under Review (5d, due 10/04)
```

**Lookahead — schedule impact warning**:
```
TSK-020 Tile Installation    15/04–25/04    👷 4
  📦 SUB-005: Πλακίδια Porcelanosa — 🟡 Under Review
  ⚠️ If not approved by 10/04 + 5d lead time → task delayed
```

#### Submittal Log Section (collapsible στο Dashboard)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ 📦 Submittals — 3 Approved, 2 Under Review, 1 Revise              [+ New]    │
│                                                                                │
│ SUB# │ Title                  │ Phase    │ Category │ Due      │ Lead │ Status │
│ 005  │ Πλακίδια Porcelanosa  │ Finishes │ Sample   │ 10/04   │ 5d   │ 🟡 Rev.│
│ 004  │ Κουφώματα αλουμινίου  │ Frames   │ Shop Dwg │ 05/04   │ 15d  │ 🟡 Rev.│
│ 003  │ Σκυρόδεμα C25/30     │ Found.   │ Prod.Data│ 01/03   │ 2d   │ ✅ Appr│
│ 002  │ Χάλυβας Β500C        │ Struct.  │ Test Rep.│ 15/02   │ 7d   │ ✅ Appr│
│ 001  │ Μόνωση XPS 80mm      │ Insul.   │ Spec     │ 10/02   │ 3d   │ ✅ Appr│
│                                                                                │
│ Timeline: ██████████░░░░ 3/6 approved — 2 blocking upcoming work              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### Schedule Risk Calculation

```
For each pending submittal:
  criticalDate = requiredByDate
  deliveryDate = approvalDate + leadTime
  taskStart = linkedTask.plannedStartDate

  if (today > criticalDate AND status !== 'approved'):
    🔴 OVERDUE — task WILL be delayed
  elif (today + 3 > criticalDate AND status !== 'approved'):
    🟡 AT RISK — approval needed within 3 days
  elif (deliveryDate > taskStart):
    ⚠️ LEAD TIME RISK — even if approved today, delivery after task start
```

#### Alert Integration (§5.8)

| Rule | Default Threshold | Severity |
|------|-------------------|----------|
| Submittal Overdue | today > requiredByDate AND status ∉ ['approved', 'approved_with_comments'] | CRITICAL |
| Submittal At Risk | requiredByDate - today ≤ 3 days AND not approved | HIGH |
| Lead Time Risk | approval date + leadTime > task.plannedStartDate | HIGH |
| Submittal Under Review > 7 days | status = 'under_review' AND age > 7 | MEDIUM |
| Revise & Resubmit Pending | status = 'revise_and_resubmit' > 5 days | MEDIUM |

#### Owner Report PDF

```
📦 ΥΠΟΒΟΛΕΣ ΥΛΙΚΩΝ
──────────────────
Εγκεκριμένες: 3/6 (50%)
Υπό εξέταση:  2
Αναμένουν αναθεώρηση: 1

⚠️ 2 υποβολές μπλοκάρουν επερχόμενες εργασίες
   SUB-005 Πλακίδια: due 10/04 — εκκρεμεί
   SUB-004 Κουφώματα: due 05/04 — OVERDUE
```

#### Phase Assignment
- **Phase F** (μαζί με Change Orders — shared procurement/approval domain, integrates with ADR-267)

### 5.16 Meeting Minutes / Πρακτικά Συσκέψεων (Procore / Buildertrend pattern)

**Industry Context**: Κάθε εβδομάδα γίνεται σύσκεψη εργοταξίου (site meeting). Τα πρακτικά καταγράφουν αποφάσεις και action items. Χωρίς tracking → "δεν θυμάμαι τι συμφωνήσαμε", "δεν ήξερα ότι ήταν δική μου δουλειά".

**Διαφορά από Daily Log (§5.7)**: Daily Log = τι έγινε σήμερα (παρελθόν). Meeting Minutes = τι αποφασίστηκε + τι πρέπει να γίνει (μέλλον/action items).

#### Data Model — New Collection

**`construction_meetings`**:
```typescript
interface ConstructionMeeting {
  id: string;                // 'cmeet_XXXXX' (enterprise-id)
  buildingId: string;
  companyId: string;
  number: number;            // sequential: MTG-001, MTG-002...
  date: string;              // ISO date
  startTime?: string;        // HH:mm
  endTime?: string;          // HH:mm
  type: 'weekly_site' | 'progress_review' | 'safety' | 'design_coordination' | 'handover' | 'ad_hoc';
  location: string;          // "Εργοτάξιο" | "Γραφείο" | "Online"

  // Attendees
  attendees: Array<{
    name: string;
    role: string;            // 'pm' | 'site_engineer' | 'architect' | 'owner' | 'subcontractor' | 'inspector'
    company?: string;
    present: boolean;        // παρών/απών
  }>;

  // Agenda
  agenda: Array<{
    topic: string;
    presenter?: string;
    notes: string;           // discussion notes
    decision?: string;       // αν λήφθηκε απόφαση
  }>;

  // Action Items — η καρδιά των πρακτικών
  actionItems: Array<{
    id: string;              // 'cmai_XXXXX'
    description: string;     // "Υποβολή σχεδίου πίνακα"
    assignedTo: string;      // υπεύθυνος
    dueDate: string;         // ISO date
    priority: 'low' | 'medium' | 'high';
    status: 'open' | 'in_progress' | 'completed' | 'overdue';
    completedAt?: Timestamp;
    // Cross-references (optional links to other entities)
    linkedTaskId?: string;
    linkedRfiId?: string;
    linkedChangeOrderId?: string;
    linkedSubmittalId?: string;
  }>;

  // Summary
  summary?: string;          // executive summary (auto-generated ή manual)
  nextMeetingDate?: string;  // ISO date

  // Distribution
  distributedTo: string[];   // userIds — who received the minutes
  distributedAt?: Timestamp;

  // Attachments
  attachments: Array<{
    url: string;
    name: string;
    type: string;
  }>;

  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### Meeting Lifecycle

```
1. ΠΡΙΝ ΤΗ ΣΥΣΚΕΨΗ (PM)
   └→ Create meeting → set date, attendees, agenda topics
        └→ Auto-populate agenda:
             ├→ Open action items from previous meeting
             ├→ Open RFIs pending decision
             ├→ Pending Change Orders
             ├→ Pending Submittals
             ├→ Upcoming Lookahead tasks (2 weeks)
             └→ Safety alerts

2. ΚΑΤΑ ΤΗ ΣΥΣΚΕΨΗ
   └→ PM καταγράφει notes per agenda item
   └→ Νέα action items δημιουργούνται live
   └→ Previous action items updated (done/ongoing)

3. ΜΕΤΑ ΤΗ ΣΥΣΚΕΨΗ
   └→ PM finalizes minutes → distribute
        └→ PDF generation (formatted minutes)
        └→ Email/Telegram distribution to attendees
        └→ Action items → appear in Dashboard
```

#### Auto-Populated Agenda (Google Smart Compose pattern)

Κατά τη δημιουργία νέας σύσκεψης, αυτόματη πρόταση agenda:

```
📋 Αυτόματη Ατζέντα — MTG-013 (12/04/2026)

1. Review Previous Action Items (3 open from MTG-012)
   🔲 [Ηλεκτρολόγος] Σχέδιο πίνακα — Due 10/04 ⚠️ OVERDUE
   🔲 [PM] Έγκριση CO-003 — Due 08/04 ⚠️ OVERDUE
   ☑️ [PM] Παραγγελία σωλήνων PVC — Done ✅

2. Schedule Update
   └→ Auto: Current SPI/CPI, delayed tasks, upcoming milestones

3. Open RFIs (2)
   └→ Auto: RFI-012 pending 10d, RFI-014 pending 7d

4. Pending Submittals (1)
   └→ Auto: SUB-005 Πλακίδια under review

5. Pending Change Orders (1)
   └→ Auto: CO-003 pending approval

6. Lookahead (next 2 weeks)
   └→ Auto: 5 tasks starting, 2 weather warnings

7. Safety
   └→ Auto: Days since incident, upcoming toolbox talk

8. Other Business
   └→ Manual items
```

**Πλεονέκτημα**: Ο PM δεν ξεχνάει τίποτα — το σύστημα φέρνει αυτόματα τα ανοιχτά θέματα.

#### Dashboard Integration

**Action Items KPI card**:
```
┌──────────────────────┐
│ 📋 Action Items      │
│ 5 open (2 overdue)   │
│ Next meeting: 12/04  │
│ 3 items from MTG-012 │
└──────────────────────┘
```

**Action Items section (collapsible)**:
```
┌────────────────────────────────────────────────────────────────────────────┐
│ 📋 Action Items — 5 Open, 2 Overdue, 12 Completed          [All Meetings]│
│                                                                           │
│ From │ Description                  │ Assigned    │ Due    │ Status       │
│ #012 │ Σχέδιο πίνακα              │ Ηλεκτρολ.  │ 10/04 │ ⚠️ Overdue   │
│ #012 │ Έγκριση CO-003             │ PM          │ 08/04 │ ⚠️ Overdue   │
│ #012 │ Πρόγραμμα βαφής            │ Εργοδηγός  │ 15/04 │ 🔵 Open      │
│ #011 │ Ενημέρωση ασφαλιστηρίου   │ PM          │ 20/04 │ 🔵 Open      │
│ #011 │ Δείγμα μαρμάρου           │ Προμηθευτής│ 12/04 │ 🔵 Open      │
└────────────────────────────────────────────────────────────────────────────┘
```

#### Meeting Minutes PDF (Auto-generated)

```
╔═══════════════════════════════════════════════════════════╗
║  ΠΡΑΚΤΙΚΑ ΣΥΣΚΕΨΕΩΣ ΕΡΓΟΤΑΞΙΟΥ                          ║
║  MTG-012 — 05/04/2026                                     ║
║  Πολυκατοικία Τούμπας                                     ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  Παρόντες: Γ. Παγώνης (PM), Α. Νικολάου (Εργοδηγός),   ║
║            Κ. Δημητρίου (Ηλεκτρ.), Β. Γεωργίου (Υδρ.)  ║
║                                                           ║
║  1. ΑΝΑΣΚΟΠΗΣΗ ΕΡΓΑΣΙΩΝ                                   ║
║     Πρόοδος: 65% (vs πλάνο 72%, -7%)                    ║
║     SPI: 0.78 | CPI: 0.83                                ║
║     ...                                                   ║
║                                                           ║
║  ACTION ITEMS                                             ║
║  □ [Ηλεκτρολόγος] Σχέδιο πίνακα — Due 10/04            ║
║  □ [PM] Έγκριση CO-003 — Due 08/04                      ║
║  □ [Εργοδηγός] Πρόγραμμα βαφής — Due 15/04            ║
║                                                           ║
║  Επόμενη σύσκεψη: 12/04/2026                            ║
╚═══════════════════════════════════════════════════════════╝
```

#### Alert Integration (§5.8)

| Rule | Default Threshold | Severity |
|------|-------------------|----------|
| Action Item Overdue | dueDate < today AND status ∈ ['open', 'in_progress'] | HIGH |
| No Meeting in 10+ days | last meeting > 10 days ago | MEDIUM |
| Meeting Not Distributed | meeting finalized > 24h AND not distributed | LOW |

#### Phase Assignment
- **Phase G** (μαζί με Safety — shared site coordination domain)

### 5.17 Drawing Management / Σχέδια & Εκδόσεις (Procore / PlanGrid / Autodesk Build pattern)

**Industry Context**: Το #1 πρόβλημα εργοταξίου: ο εργολάβος δουλεύει με **παλιό σχέδιο** → λάθος εργασία → ξήλωμα → κόστος. Procore, PlanGrid, Autodesk Build έχουν full drawing management με version control, markups, RFI/punch linking.

#### Data Model — New Collections

**`construction_drawings`**:
```typescript
interface ConstructionDrawing {
  id: string;                // 'cdraw_XXXXX' (enterprise-id)
  buildingId: string;
  companyId: string;
  number: string;            // "A-101", "S-201", "M-301" (discipline + number)
  title: string;             // "Κάτοψη Ισογείου"
  discipline: 'architectural' | 'structural' | 'mechanical' | 'electrical' | 'plumbing' | 'civil' | 'landscape' | 'fire_protection';

  // Current revision
  currentRevision: string;   // "C"

  // All revisions (history)
  revisions: Array<{
    revision: string;        // "A", "B", "C"
    fileUrl: string;         // Firebase Storage URL (PDF/DWG/DXF)
    thumbnailUrl: string;    // auto-generated preview image
    uploadedBy: string;
    uploadedAt: Timestamp;
    description: string;     // "Αλλαγή θέσης κολώνας Κ3"
    status: 'current' | 'superseded';
    fileSize: number;        // bytes
    fileType: string;        // 'pdf' | 'dwg' | 'dxf' | 'png'
  }>;

  // Linked phases/tasks
  phaseIds: string[];        // σχετικές φάσεις

  // Stats (computed)
  openRfiCount: number;      // RFIs linked to this drawing
  openPunchCount: number;    // punch items linked to this drawing
  markupCount: number;       // annotations on current revision

  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**`construction_drawing_markups`**:
```typescript
interface ConstructionDrawingMarkup {
  id: string;                // 'cmkup_XXXXX' (enterprise-id)
  drawingId: string;
  revision: string;          // on which revision
  buildingId: string;
  companyId: string;

  // Position on drawing
  position: {
    x: number;               // % from left (0-100)
    y: number;               // % from top (0-100)
    type: 'pin' | 'area' | 'arrow' | 'text' | 'measurement';
    // For area type:
    width?: number;
    height?: number;
  };

  // Content
  label: string;             // short label shown on drawing
  description: string;       // detailed note
  color: string;             // category color

  // Links (creates item on the drawing)
  linkedRfiId?: string;      // → click pin → go to RFI
  linkedPunchItemId?: string;// → click pin → go to punch item
  linkedPhotoId?: string;    // → click pin → see photo

  createdBy: string;
  createdAt: Timestamp;
}
```

#### Drawing Discipline Registry (i18n)

| Key | Ελληνικά | English | Code Prefix |
|-----|----------|---------|-------------|
| `architectural` | Αρχιτεκτονικά | Architectural | A- |
| `structural` | Στατικά | Structural | S- |
| `mechanical` | Μηχανολογικά | Mechanical | M- |
| `electrical` | Ηλεκτρολογικά | Electrical | E- |
| `plumbing` | Υδραυλικά | Plumbing | P- |
| `civil` | Πολιτικού Μηχανικού | Civil | C- |
| `landscape` | Περιβάλλοντος Χώρου | Landscape | L- |
| `fire_protection` | Πυροπροστασίας | Fire Protection | FP- |

#### Drawing Set View (PlanGrid pattern)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ 📐 Drawing Set — Πολυκατοικία Τούμπας                    [+ Upload] [Compare]  │
│ Filter: [All Disciplines ▼] [Current Only ☑️]                                   │
│                                                                                  │
│  📐  │ Number │ Title                    │ Rev │ Date   │ RFIs │ Punch │ Markup │
│  ─── │ A-101  │ Κάτοψη Ισογείου        │ C   │ 02/04 │ 1    │ 0     │ 3      │
│  ─── │ A-102  │ Κάτοψη 1ου Ορόφου     │ B   │ 15/03 │ 0    │ 2     │ 1      │
│  ─── │ S-201  │ Ξυλότυπος Θεμελίωσης  │ B   │ 20/03 │ 3    │ 0     │ 5      │
│  ─── │ S-202  │ Ξυλότυπος Πλάκας      │ A   │ 01/02 │ 0    │ 0     │ 0      │
│  ─── │ E-301  │ Ηλεκτρολογικά Ισογ.   │ A   │ 01/02 │ 2    │ 1     │ 2      │
│  ─── │ P-401  │ Υδραυλικά Ισογείου    │ A   │ 01/02 │ 0    │ 0     │ 0      │
│                                                                                  │
│ 📊 6 drawings │ 3 disciplines │ Latest upload: 02/04                            │
└──────────────────────────────────────────────────────────────────────────────────┘
```

#### Drawing Viewer (Interactive — PlanGrid core feature)

```
┌─────────────────────────────────────────────────────────────────┐
│ A-101 — Κάτοψη Ισογείου (Rev.C)            [◀ Rev.B] [Rev.C ▶]│
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                                                             │ │
│ │              [PDF/Image of drawing]                         │ │
│ │                                                             │ │
│ │        📌 RFI-012                    📌 Markup #3           │ │
│ │          ↓                              ↓                   │ │
│ │     "Θέση πίνακα;"              "Αλλαγή ρεύματος"         │ │
│ │                                                             │ │
│ │                    🔴 Punch #7                              │ │
│ │                       ↓                                     │ │
│ │                  "Ρωγμή τοίχου"                            │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ Tools: [📌 Pin] [📋 RFI] [🔴 Punch] [📏 Measure] [✏️ Text]   │
│ Zoom: [- ─────●───── +]  Layers: [Markups ☑️] [RFIs ☑️]       │
└─────────────────────────────────────────────────────────────────┘
```

**Viewer features**:
- **Pan & Zoom**: Pinch/scroll zoom, drag to pan (mobile-friendly)
- **Pin tools**: Click to place RFI, punch item, or markup pin
- **Measure tool**: Click two points → shows distance (σε μέτρα)
- **Layer toggle**: Show/hide markup pins, RFI pins, punch pins
- **Revision compare**: Side-by-side ή overlay δύο revisions (spot differences)
- **Offline**: Cache current set for field use (Service Worker)

#### Revision Compare (Bluebeam / PlanGrid pattern)

```
┌──────────────────────────────────────────────────────────┐
│ COMPARE: A-101 Rev.B vs Rev.C                           │
│                                                          │
│  [Rev.B]              │  [Rev.C]                        │
│  ┌──────────────────┐ │ ┌──────────────────┐           │
│  │                  │ │ │     ██████       │           │
│  │                  │ │ │     ██████ ← NEW │           │
│  │                  │ │ │                  │           │
│  └──────────────────┘ │ └──────────────────┘           │
│                                                          │
│  Mode: [Side-by-Side] [Overlay] [Differences Only]      │
│  Changes detected: 3 (highlighted in red)                │
└──────────────────────────────────────────────────────────┘
```

#### Cross-Module Integration

| From Drawing Viewer | Action | Creates |
|---------------------|--------|---------|
| Click 📋 RFI tool → click on drawing | New RFI with pin location | RFI linked to drawing + position |
| Click 🔴 Punch tool → click on drawing | New Punch Item with pin | Punch item linked to drawing + position |
| Click 📌 Markup → add note | Annotation on drawing | Markup visible to all team |
| Drawing updated (new revision) | Auto-notification | Telegram: "A-101 updated to Rev.C" |

#### Dashboard Integration

**Drawing Set KPI card**:
```
┌──────────────────────┐
│ 📐 Drawings          │
│ 6 drawings (3 disc.) │
│ Latest rev: 02/04    │
│ 6 open RFIs on plans │
│ 3 punch items pinned │
└──────────────────────┘
```

#### Alert Integration (§5.8)

| Rule | Default Threshold | Severity |
|------|-------------------|----------|
| Drawing Superseded | New revision uploaded | MEDIUM — notify all team |
| RFI on Old Revision | RFI linked to superseded revision | HIGH — needs re-review |
| No Drawings Uploaded | Building has phases but 0 drawings | LOW |

#### Mobile Field Use (PlanGrid killer feature)

- **Offline cache**: Current drawing set cached on device (Service Worker)
- **Quick pin**: Long-press on drawing → choose RFI/Punch/Photo → create instantly
- **Photo from drawing**: Take photo → auto-link to drawing + pin position
- **Field markup**: Draw/annotate directly on drawing with finger/stylus

#### Phase Assignment
- **Phase H** (νέο module, 2 νέες collections, viewer component, Firebase Storage)

### 5.18 Progress Claims & Retention / Πιστοποιήσεις & Κρατήσεις (Procore / CoConstruct pattern)

**Industry & Legal Context**: Στην Ελλάδα κάθε μήνα ο εργολάβος υποβάλλει **πιστοποίηση** (progress claim) στον ιδιοκτήτη: "Αυτόν τον μήνα ολοκληρώσαμε X εργασίες, πληρώστε €Y." Ο ιδιοκτήτης **κρατάει 5-10%** (retention/εγγυητική) που αποδεσμεύεται μετά τη λήξη της περιόδου ευθύνης (12-24 μήνες).

Χωρίς tracking: "Πόσα μας χρωστάει ο ιδιοκτήτης;" → κανείς δεν ξέρει ακριβώς.

#### Data Model

**`construction_progress_claims`**:
```typescript
interface ConstructionProgressClaim {
  id: string;                // 'cclaim_XXXXX'
  buildingId: string;
  companyId: string;
  number: number;            // sequential: CERT-001, CERT-002...
  period: string;            // "2026-04" (month)

  // Work completed this period
  lineItems: Array<{
    phaseId: string;
    description: string;
    contractAmount: number;      // from BOQ
    previouslyClaimed: number;   // sum of previous claims
    thisPeriodAmount: number;    // work done this month
    cumulativeClaimed: number;   // total to date
    percentComplete: number;     // % of contract amount
  }>;

  // Totals
  grossAmount: number;           // total claimed this period
  retentionPercent: number;      // 5% or 10%
  retentionAmount: number;       // held back
  netPayable: number;            // gross - retention
  cumulativeGross: number;       // all claims to date
  cumulativeRetention: number;   // total held back

  // Change Orders included
  changeOrderIds: string[];      // COs claimed in this period

  // Status
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'partially_approved' | 'paid' | 'disputed';
  submittedAt?: Timestamp;
  approvedAmount?: number;       // may differ from claimed
  approvedBy?: string;
  approvedAt?: Timestamp;
  paidAt?: Timestamp;
  paymentReference?: string;     // bank transfer reference

  // Retention release
  retentionReleaseDate?: string; // when retention becomes payable
  retentionReleased: boolean;

  attachments: Array<{ url: string; name: string; }>;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### Cash Flow Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│ 💰 Cash Flow — Πολυκατοικία Τούμπας                            │
│                                                                 │
│ Σύμβαση:         €185.000                                       │
│ Change Orders:    +€22.300                                      │
│ Αναθ. Σύμβαση:   €207.300                                      │
│                                                                 │
│ Πιστοποιημένα:   €142.500 (69%)  ████████████████░░░░░░         │
│ Κρατήσεις:        -€14.250 (10%)                                │
│ Πληρωθέντα:      €128.250                                       │
│ Εκκρεμή:          €12.800 (CERT-006 under review)              │
│                                                                 │
│ Monthly: [Bar chart — claimed vs paid per month]                │
└─────────────────────────────────────────────────────────────────┘
```

#### Phase Assignment
- **Phase H** (μαζί με Drawings — shared financial/document domain)

### 5.19 Permits & Compliance Tracker / Άδειες & Συμμόρφωση (Procore / Buildertrend pattern)

**Industry & Legal Context**: Κάθε κατασκευή στην Ελλάδα χρειάζεται δεκάδες άδειες/εγκρίσεις. Αν λήξει μια άδεια ή λείπει μια έγκριση, το εργοτάξιο **σταματάει** (πρόστιμο/σφράγιση).

#### Tracked Items

| Κατηγορία | Παραδείγματα | Expiry/Renewal |
|-----------|-------------|----------------|
| **Οικοδομική Άδεια** | Πολεοδομία, ΥΔΟΜ | Λήγει — ανανέωση |
| **Περιβαλλοντικοί Όροι** | ΜΠΕ, αρχαιολογική | Εγκεκριμένο ή όχι |
| **Ασφάλιση Εργοταξίου** | CAR, Third Party | Λήγει — ανανέωση |
| **Πιστοποιητικά Υπεργολάβων** | Ασφαλιστική ενημερότητα, ΕΦΚΑ | Λήγει μηνιαία |
| **Πιστοποιήσεις Εργατών** | Χειριστής γερανού, ηλεκτρολόγος | Λήγει — ανανέωση |
| **Κοινοχρήστων** | Κατάληψη πεζοδρομίου, κυκλοφοριακή | Περίοδος ισχύος |
| **ΔΕΗ/ΕΥΔΑΠ** | Προσωρινές παροχές | Status tracking |
| **Πυροσβεστική** | Μελέτη πυροπροστασίας | Εγκεκριμένο ή όχι |

#### Data Model

```typescript
interface ConstructionPermit {
  id: string;                // 'cperm_XXXXX'
  buildingId: string;
  companyId: string;
  category: 'building_permit' | 'environmental' | 'insurance' | 'subcontractor_cert' | 'worker_cert' | 'utility' | 'fire' | 'occupancy' | 'other';
  title: string;
  issuedBy: string;          // "Πολεοδομία Θεσσαλονίκης"
  referenceNumber?: string;  // αριθμός πρωτοκόλλου
  status: 'pending' | 'approved' | 'active' | 'expired' | 'rejected' | 'renewal_needed';
  issuedDate?: string;
  expiryDate?: string;       // ← CRITICAL for alerts
  renewalDate?: string;      // when to start renewal process
  linkedPhaseIds: string[];  // phases that depend on this permit
  blocksWork: boolean;       // if expired → blocks work
  attachments: Array<{ url: string; name: string; }>;
  notes: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### Dashboard Card + Alerts

```
┌──────────────────────┐
│ 📄 Permits           │
│ 8 active / 10 total  │
│ ⚠️ 1 expires in 5d   │
│ ❌ 1 pending approval │
│ ✅ All insured         │
└──────────────────────┘
```

| Alert Rule | Threshold | Severity |
|-----------|-----------|----------|
| Permit Expiring | expiryDate - today ≤ 14 days | HIGH |
| Permit Expired | expiryDate < today | CRITICAL — immediate Telegram |
| Insurance Lapsed | subcontractor insurance expired | CRITICAL — STOP WORK |
| Worker Cert Expired | certification expired | HIGH |

#### Phase Assignment
- **Phase H** (permits/compliance domain)

### 5.20 Warranty Tracker / Εγγυήσεις (Procore / CoConstruct pattern)

**Industry Context**: Μετά την παράδοση, κάθε υλικό/σύστημα έχει **περίοδο εγγύησης**. Αν σπάσει κάτι εντός εγγύησης, ο εργολάβος/προμηθευτής πληρώνει. Χωρίς tracking → η εγγύηση λήγει χωρίς να το ξέρεις → πληρώνεις εσύ.

#### Data Model

```typescript
interface ConstructionWarranty {
  id: string;                // 'cwarr_XXXXX'
  buildingId: string;
  companyId: string;
  item: string;              // "Στεγάνωση δώματος", "Κουφώματα αλουμινίου"
  category: 'waterproofing' | 'structural' | 'mechanical' | 'electrical' | 'finishes' | 'appliances' | 'roofing' | 'windows_doors' | 'other';
  supplier: string;          // vendor/subcontractor
  phaseId: string;
  installationDate: string;
  warrantyPeriod: number;    // months
  warrantyEndDate: string;   // computed: installationDate + warrantyPeriod
  warrantyDocument?: string; // attachment URL
  contactPerson?: string;
  contactPhone?: string;
  notes?: string;
  status: 'active' | 'expiring_soon' | 'expired' | 'claimed';
  claims: Array<{            // if something broke under warranty
    date: string;
    description: string;
    status: 'open' | 'resolved';
    resolvedAt?: Timestamp;
  }>;
  createdBy: string;
  createdAt: Timestamp;
}
```

#### Dashboard Card

```
┌──────────────────────┐
│ 🛡️ Warranties       │
│ 12 active            │
│ ⚠️ 2 expire in 30d  │
│ 1 claim open         │
│ Coverage: 85%        │
└──────────────────────┘
```

| Alert Rule | Threshold | Severity |
|-----------|-----------|----------|
| Warranty Expiring | endDate - today ≤ 30 days | MEDIUM |
| Warranty Expired | endDate < today | LOW (informational) |
| Warranty Claim Unresolved | claim open > 14 days | HIGH |

#### Phase Assignment
- **Phase I** (post-construction/handover domain)

### 5.21 As-Built Documentation & Handover Package (Procore / Autodesk Build pattern)

**Industry Context**: Στο τέλος του έργου, ο εργολάβος παραδίδει στον ιδιοκτήτη ένα **πλήρες πακέτο τεκμηρίωσης**: σχέδια as-built, εγχειρίδια εξοπλισμού, πιστοποιητικά, εγγυήσεις, φωτογραφίες. Χωρίς αυτό, η συντήρηση του κτιρίου γίνεται αδύνατη.

#### Handover Package Contents

```
📁 Handover Package — Πολυκατοικία Τούμπας

📐 As-Built Drawings (auto-compiled from Drawing Set — latest revisions)
   ├── A-101 Rev.C — Κάτοψη Ισογείου
   ├── S-201 Rev.B — Ξυλότυπος Θεμελίωσης
   └── ... (all current revisions)

📋 Certificates & Permits
   ├── Οικοδομική Άδεια
   ├── Ενεργειακό Πιστοποιητικό
   ├── Πιστοποιητικό Πυροπροστασίας
   └── Βεβαίωση Περαίωσης

🛡️ Warranties (auto-compiled from Warranty Tracker)
   ├── Στεγάνωση — 10 years (exp. 2036)
   ├── Κουφώματα — 5 years (exp. 2031)
   └── ...

📖 O&M Manuals (Operation & Maintenance)
   ├── Ανελκυστήρας — εγχειρίδιο λειτουργίας
   ├── Λέβητας — εγχειρίδιο συντήρησης
   └── Κλιματισμός — service schedule

📷 Photo Archive (auto-compiled from Site Photos)
   ├── Foundation (24 photos)
   ├── Structure (38 photos)
   └── ...

📊 Project Summary
   ├── Final cost: €207.300 (original €185.000 + COs €22.300)
   ├── Duration: 192 days (original 180 + COs 12)
   ├── Safety: 0 serious incidents
   └── Quality: 28 punch items, all verified
```

**Auto-compilation**: Το σύστημα **συλλέγει αυτόματα** τα δεδομένα από τα existing modules — δεν χρειάζεται manual assembly.

**Deliverable**: Downloadable ZIP ή online portal link για τον ιδιοκτήτη.

#### Handover Readiness Checklist (auto-calculated)

```
🏁 HANDOVER READINESS — Πολυκατοικία Τούμπας

✅ All phases completed (15/15)
✅ All hold points passed (8/8)
✅ All RFIs closed (12/12)
✅ All punch items verified (28/28)
✅ All change orders executed (3/3)
❌ 2 warranties missing documentation
⚠️ 1 permit pending (occupancy certificate)
✅ As-built drawings uploaded (6/6)
❌ O&M manuals: 2/4 uploaded

Progress: 8/10 items complete — NOT READY
```

#### Phase Assignment
- **Phase I** (μαζί με Warranties — post-construction/handover domain)

### 5.22 Gantt Snapshot Card

**Concept**: Κάρτα με link/button που τρέχει τον υπάρχοντα `exportGanttToPDF()` ανά building.

**Σημαντικό**: Ο exporter απαιτεί DOM element (html-to-image). Στο Dashboard view δεν υπάρχει rendered Gantt. Λύσεις:
1. **Link στο Gantt view** → export από εκεί (απλούστερο)
2. **Server-side PDF generation** — jspdf-autotable χωρίς DOM (μόνο πίνακας, χωρίς bars)
3. **Hidden Gantt render** — offscreen DOM render + capture (πολύπλοκο)

**Πρόταση**: Λύση 1 (link/switch to Gantt view) για Phase A. Λύση 2 (server table PDF) για Phase B.

### 5.7 Export Strategy — REUSE ΥΠΑΡΧΟΝΤΟΣ INFRASTRUCTURE (SSoT)

**ΥΠΑΡΧΕΙ ΗΔΗ ΠΛΗΡΕΣ EXPORT SYSTEM** (ADR-265 Phase 13). Δεν δημιουργούμε νέο — επεκτείνουμε.

#### Υπάρχοντα Export Systems (REUSE):

| System | Location | Τι κάνει |
|--------|----------|----------|
| `exportReportToPdf()` | `src/services/report-engine/report-pdf-exporter.ts` (393 LOC) | Enterprise PDF: header, KPI cards, chart images (PNG), tables (autoTable), Greek Roboto, footer |
| `exportReportToExcel()` | `src/services/report-engine/report-excel-exporter.ts` (349 LOC) | 4-sheet workbook: Σύνοψη, Δεδομένα Γραφημάτων, Αναλυτικά, Raw Data |
| `ReportExportBar` | `src/components/reports/core/ReportExportBar.tsx` (106 LOC) | PDF/Excel/CSV buttons — ήδη στο ReportPage header |
| `useExportCenter` | `src/hooks/reports/useExportCenter.ts` (187 LOC) | Export state, job tracking, dynamic imports |
| `ExportDomainGrid` | `src/components/reports/sections/export/ExportDomainGrid.tsx` | 9 domain cards (θα γίνει 10 με schedule) |
| `ExportStatusPanel` | `src/components/reports/sections/export/ExportStatusPanel.tsx` | Real-time job status tracker |
| `triggerBlobDownload()` | `src/services/gantt-export/gantt-export-utils.ts` | Client-side file download (shared utility) |

#### Dashboard View Export Flow:
```
Dashboard View (per-building schedule analytics)
  ├── On-screen: KPIs + S-Curve + Variance Table + Lookahead
  ├── PDF Export button → exportReportToPdf({
  │     title: "Schedule Report — {buildingName}",
  │     kpis: [...6 KPI cards],
  │     charts: [sCurveChartImage],     // html-to-image capture
  │     tables: [varianceTable, lookaheadTable]
  │   })
  └── Excel Export button → exportReportToExcel({
        summary: [...KPI metrics],
        chartData: [sCurveData],
        detail: [varianceRows],
        rawData: [allPhasesAndTasks]
      })
```

#### Export Center Integration:
Προσθήκη νέου domain `'schedule'` στο `useExportCenter` hook → εμφανίζεται ως 10η κάρτα στο Export Center page.

**Αρχή**: **ΜΗΔΕΝ νέος export κώδικας** — μόνο configuration objects για τα υπάρχοντα `exportReportToPdf()` / `exportReportToExcel()`.

#### Owner Report PDF — Simplified Export Template (Buildertrend / Procore Pattern)

**Industry Pattern**: Ο ιδιοκτήτης δεν μπαίνει στο app. Ο PM δημιουργεί **"Owner Report" PDF** και τον στέλνει email. Ξεχωριστό export template, ΟΧΙ separate view.

```
Dashboard → [Export ▼]
  ├── Technical PDF    (full: SPI, CPI, S-Curve, Variance, Lookahead)
  ├── Technical Excel  (4-sheet workbook)
  └── Owner Report PDF (simplified: progress, milestones, expected completion)
       ↑ NEW template — Phase B
```

**Owner Report PDF** (1-2 σελίδες A4):
1. **Header**: Building name, report date, company logo
2. **Overall Progress**: Μεγάλο progress bar (65% ██████████░░░░)
3. **Milestone Checklist**: ✅ Foundation ✅ Frame 🔲 Roofing 🔲 Electrical ...
4. **Expected Completion**: Ημερομηνία + days remaining
5. **Key Updates** (αν υπάρχουν): "Θεμελίωση ολοκληρώθηκε 3 μέρες νωρίτερα"
6. **Χωρίς**: SPI, CPI, EVM, S-Curve, variance tables — τίποτα τεχνικό

**Implementation**: Νέο `exportOwnerReportToPdf()` function — reuse jspdf + Greek Roboto, simplified layout. ~150 LOC.

---

## 6. CENTRALIZED SYSTEMS — ΥΠΟΧΡΕΩΤΙΚΗ ΧΡΗΣΗ (SSoT)

### 6.1 Design System Hooks + Dark Mode (Automatic)

**Dark Mode**: ✅ Υποστηρίζεται αυτόματα. Τα design system hooks επιστρέφουν dark-mode variants χωρίς επιπλέον κώδικα. Αρκεί να μην χρησιμοποιούμε hardcoded colors — **μόνο hooks**.

| Hook | Χρήση στα Schedule Reports | Dark Mode |
|------|---------------------------|-----------|
| `useSemanticColors()` | Traffic light colors, chart palette, card backgrounds | ✅ Auto |
| `useSpacingTokens()` | Section gaps, card padding, table spacing | ✅ Auto |
| `useBorderTokens()` | Card borders, table row separators | ✅ Auto |
| `useIconSizes()` | KPI icons, status indicators | N/A |
| `useTypography()` | Table headers, KPI values, section titles | ✅ Auto |
| `useLayoutClasses()` | Grid layouts, responsive flex patterns | N/A |

**Κανόνας**: Στα recharts charts, τα χρώματα γραμμών/bars πρέπει να έρχονται από `useSemanticColors()`, ΟΧΙ hardcoded hex. Π.χ. S-curve lines: `colors.text.success` (EV), `colors.text.error` (AC), `colors.text.muted` (PV).

### 6.2 Report Core Components (ADR-265)

| Component | Import | Χρήση |
|-----------|--------|-------|
| `ReportPage` | `@/components/reports/core` | Page wrapper (header + content) |
| `ReportSection` | ↑ | Section container (title + chart/table) |
| `ReportKPI` | ↑ | KPI card (icon + value + label + trend) |
| `ChartContainer` | `@/components/ui/chart` | Recharts wrapper (responsive) |
| `ChartTooltip` | ↑ | Unified tooltip styling |

### 6.3 Data Utilities

| Utility | Import | Χρήση |
|---------|--------|-------|
| `formatDateShort()` | `@/lib/intl-utils` | Date display |
| `formatCurrency()` | ↑ | Cost values |
| `cn()` | `@/lib/utils` | Class merging |
| `sumBy()`, `groupByKey()` | `@/lib/collection-utils` | Data aggregation |

### 6.4 Infrastructure

| System | Χρήση |
|--------|-------|
| `withAuth()` + `withStandardRateLimit()` | API route protection |
| `requireBuildingInTenant()` | Tenant isolation (if per-building) |
| `logAuditEvent()` | Audit logging |
| i18n: `useTranslation('reports')` | Localization (el + en) |
| `getAdminFirestore()` | Server-side Firestore SDK |

---

## 7. IMPLEMENTATION PHASES

### Phase A: Core Schedule Dashboard (MVP)
**Εκτίμηση**: ~10 αρχεία, ~1.500 LOC

1. `useScheduleDashboard()` hook — reuse `useConstructionGantt` data + lazy BOQ fetch + `computeEVM()`
2. `ScheduleOverviewKPIs` — 6 KPI cards (vs Plan pattern, traffic lights)
3. `SCurveChart` — 3-line recharts LineChart (PV, EV, AC) + today marker
4. `ScheduleVarianceTable` — Expandable tree table (phases → tasks) + traffic lights
5. `LookaheadTable` — 2/4 week toggle, task-only
6. `GanttSnapshotCard` — Link to Gantt view export
7. Dashboard view integration in TimelineViewToggle (3rd option)
8. Empty states for all sections (no phases, no data, no BOQ)
9. Responsive layout (tablet/mobile) + `@media print` CSS
10. i18n keys (el + en) + a11y (ARIA labels, keyboard nav, color+shape)
11. Refresh button + "Last updated" timestamp
12. Export: PDF + Excel via existing `exportReportToPdf()` / `exportReportToExcel()`

### Phase B: Enhanced Analysis + Owner Report ✅ IMPLEMENTED
**Εκτίμηση**: ~6 αρχεία, ~900 LOC → **Actual: 3 new + 7 modified, ~750 LOC**

1. ✅ `DelayBreakdownChart` — Stacked bar chart: delayed + blocked tasks ανά phase
2. ✅ `exportOwnerReportToPdf()` — Simplified 1-2 page portrait PDF for building owner
3. ✅ `exportGanttTableToPdf()` — Server-side Gantt table PDF (jspdf-autotable, χωρίς DOM)
4. ⏭️ EVM Trend sparklines — **Moved to Phase C** (needs monthly snapshot collection)
5. ⏭️ Procurement contextual badges — **Moved to Phase C** (ADR-267 procurement module not yet built)
6. ✅ S-Curve Brush zoom — `enableBrush` prop, renders `<Brush>` when data.length ≥ 6

**New files:**
- `src/components/building-management/tabs/TimelineTabContent/dashboard/DelayBreakdownChart.tsx` (144 LOC)
- `src/services/report-engine/owner-report-pdf-exporter.ts` (315 LOC)
- `src/services/gantt-export/gantt-table-pdf-exporter.ts` (208 LOC)

**Modified files:**
- `schedule-dashboard.types.ts` (+DelayBreakdownDataPoint)
- `useScheduleDashboard.ts` (+delay computation, expose phases/tasks)
- `SCurveChart.tsx` (+Brush import, enableBrush prop)
- `ScheduleDashboardView.tsx` (+DelayBreakdownChart, +3 export options in dropdown)
- `gantt-export/index.ts` (+re-export)
- `dashboard/index.ts` (+re-export)
- i18n en/el building.json (+30 keys each)

### Phase C: Advanced
**Εκτίμηση**: ~1.500 LOC, αλγοριθμική πολυπλοκότητα

#### Sub-phase 1: delayReason Field Migration ✅ IMPLEMENTED
- `DELAY_REASONS` SSoT array in `construction.ts`: weather, materials, permits, subcontractor, other
- `delayReason?: DelayReason | null` + `delayNote?: string | null` on Phase & Task
- Conditional UI in ConstructionPhaseDialog (visible when delayed/blocked, cleared otherwise)
- API route PATCH allowlist updated
- DelayBreakdownChart: 6 stacked bars per reason (from 2 bars delayed/blocked)
- i18n: en + el keys for dialog + dashboard
- **Refactored**: route.ts → route.ts (229) + _helpers.ts (186); dialog → 4 files (490+186+245+79)

**New files:**
- `src/app/api/buildings/[buildingId]/construction-phases/_helpers.ts` (186 LOC)
- `src/components/building-management/dialogs/usePhaseNameCombobox.ts` (186 LOC)
- `src/components/building-management/dialogs/NameComboboxField.tsx` (245 LOC)
- `src/components/building-management/dialogs/construction-dialog.types.ts` (79 LOC)

#### Sub-phase 2: Critical Path ✅ IMPLEMENTED
- CPM algorithm: forward/backward pass, Kahn's cycle detection, float computation
- `computeCPM()` pure function → CPMResult with ES/EF/LS/LF/Float per task
- `useCriticalPath` hook for Milestones view (lazy load via useConstructionGantt)
- CriticalPathCard: real CPM data (top-5 critical tasks, delay impact badges)
- CriticalPathSection: full dashboard table (all tasks, sorted by float ASC)
- KPI card: "Critical Path Length: X days" in ScheduleOverviewKPIs (7th card)
- Edge cases: no deps (float>0), circular deps (detect+exclude+warning), empty tasks
- i18n: en + el keys for card + dashboard section + KPI

**New files:**
- `src/services/construction-scheduling/cpm-types.ts` (58 LOC)
- `src/services/construction-scheduling/cpm-calculator.ts` (336 LOC)
- `src/services/construction-scheduling/index.ts` (barrel)
- `src/hooks/useCriticalPath.ts` (30 LOC)
- `src/components/.../dashboard/CriticalPathSection.tsx` (218 LOC)

**Modified files:**
- `CriticalPathCard.tsx` (rewrite: 56→203 LOC, real CPM data)
- `TimelineTabContent.tsx` + `index.tsx` (+buildingId prop)
- `schedule-dashboard.types.ts` (+criticalPathLength KPI)
- `useScheduleDashboard.ts` (+computeCPM import, criticalPathLength in KPIs)
- `ScheduleDashboardView.tsx` (+CriticalPathSection)
- `ScheduleOverviewKPIs.tsx` (+7th KPI card: Route icon)
- `en/el building.json` (+criticalPath i18n keys)

#### Sub-phase 3: Baseline Snapshots ✅ IMPLEMENTED
- Firestore collection `construction_baselines` (top-level, `buildingId`+`companyId` indexed)
- Enterprise ID prefix `cbase_` via `generateConstructionBaselineId()`
- Full denormalized copies of phases+tasks per snapshot (~20KB max)
- API routes: GET list (summary), GET /:id (full detail), POST (create), DELETE
- Max 10 baselines per building (server-enforced)
- `useBaselineComparison` hook: list, select, lazy-load detail, CRUD
- `BaselineSection` UI: save dialog, baseline list with compare/delete, max warning
- `ScheduleVarianceTable` enhanced: optional baseline columns (start/end/vs baseline)
- i18n: en + el keys under `tabs.timeline.dashboard.baseline`

**New files:**
- `src/app/api/buildings/[buildingId]/construction-baselines/route.ts` (199 LOC)
- `src/app/api/buildings/[buildingId]/construction-baselines/[baselineId]/route.ts` (68 LOC)
- `src/components/.../dashboard/useBaselineComparison.ts` (120 LOC)
- `src/components/.../dashboard/BaselineSection.tsx` (216 LOC)

**Modified files:**
- `src/types/building/construction.ts` (+ConstructionBaseline, +Summary, +CreatePayload)
- `src/config/firestore-collections.ts` (+CONSTRUCTION_BASELINES)
- `src/config/domain-constants.ts` (+CONSTRUCTION_BASELINES route)
- `src/services/enterprise-id.service.ts` (+cbase prefix, +generator)
- `construction-services.ts` (+4 baseline client functions)
- `schedule-dashboard.types.ts` (+baseline fields on ScheduleVarianceRow)
- `ScheduleVarianceTable.tsx` (+baseline columns, comparison badge)
- `ScheduleDashboardView.tsx` (+useBaselineComparison, +BaselineSection)
- `dashboard/index.ts` (+exports)
- `en/el building.json` (+30 baseline i18n keys each)

#### Sub-phase 4: Resource Allocation ✅ IMPLEMENTED
- Firestore collection `construction_resource_assignments` (top-level, buildingId+taskId+phaseId indexed)
- Enterprise ID prefix `crasn_` via `generateConstructionResourceAssignmentId()`
- Resource types: `worker` (from contacts) | `equipment` (free text)
- API route: GET (list, ?taskId filter), POST (create, max 20/task), PATCH (hours/notes), DELETE
- Cascade delete: task deletion → delete assignments; phase deletion → delete all child assignments
- `useResourceAssignments` hook: CRUD with optimistic updates
- `ResourceAssignmentSection` in task edit dialog: worker select, equipment input, hours, remove
- `ResourceHistogramChart`: stacked bars per resource per week, 40h capacity reference line
- `ResourceUtilizationKPIs`: 3 cards (Total Resources, Avg Utilization, Over-Allocated)
- `DelayFieldsSection` extracted from dialog (SRP, 500-line limit)
- i18n: en + el keys

**New files:**
- `src/app/api/buildings/[buildingId]/construction-resource-assignments/route.ts` (250 LOC)
- `src/services/construction-scheduling/resource-assignment.service.ts` (115 LOC)
- `src/hooks/useResourceAssignments.ts` (115 LOC)
- `src/components/.../dialogs/ResourceAssignmentSection.tsx` (255 LOC)
- `src/components/.../dialogs/DelayFieldsSection.tsx` (80 LOC)
- `src/components/.../dashboard/resource-histogram.types.ts` (50 LOC)
- `src/components/.../dashboard/useResourceHistogram.ts` (210 LOC)
- `src/components/.../dashboard/ResourceHistogramChart.tsx` (165 LOC)
- `src/components/.../dashboard/ResourceUtilizationKPIs.tsx` (80 LOC)

#### Sub-phase 5: Accessibility (WCAG AA) ✅ IMPLEMENTED
- Charts: `<figure role="img" aria-label>` wrapper + sr-only `<table>` with raw data for screen readers
- Tables: `<th scope="row">` on first column (ScheduleVarianceTable, LookaheadTable, CriticalPathSection)
- ScheduleVarianceTable: `aria-expanded` on phase rows, i18n expand/collapse labels with phase name
- KPI Cards (ReportKPIGrid): `role="button"` + `tabIndex={0}` + `onKeyDown` (Enter/Space) + `aria-label` + focus-visible ring when clickable
- i18n: en + el keys for aria-labels + expand/collapse

**Modified files:**
- `SCurveChart.tsx` (+figure wrap, +sr-only table)
- `DelayBreakdownChart.tsx` (+figure wrap, +sr-only table)
- `ResourceHistogramChart.tsx` (+figure wrap, +sr-only table)
- `ScheduleVarianceTable.tsx` (+aria-expanded, +th scope="row", +i18n labels)
- `LookaheadTable.tsx` (+th scope="row")
- `CriticalPathSection.tsx` (+th scope="row")
- `ReportKPIGrid.tsx` (+keyboard support, +aria-label, +focus-visible)
- `en/el building.json` (+a11y i18n keys)

### Phase D: Site Documentation + Schedule Alerts (Μελλοντικά)
**Εκτίμηση**: ~2.500 LOC, 4 νέες Firestore collections, Firebase Storage

#### D.1 Site Photos
1. **Site Photos system** — `construction_site_photos` collection (βλ. §5.7)
   - Photo upload via `usePhotoCapture` (reuse ADR-170)
   - Firebase Storage integration (compress + thumbnail)
   - Link photos to phases/tasks
   - Photo gallery modal (slideshow, chronological)

#### D.2 Daily Logs
2. **Daily Logs system** — `construction_daily_logs` collection (βλ. §5.7)
   - Daily log form (weather, workforce, summary, issues, phase notes)
   - Auto-attach today's photos
   - Daily log list panel

#### D.3 Schedule Alerts & Telegram Notifications
3. **Alert rules engine** — `construction_alerts` collection (βλ. §5.8)
   - 7 configurable alert rules (overdue, SPI/CPI drop, blocked, milestone risk, weather, no progress)
   - Dashboard alert banner (collapsible, dismiss, navigate)
   - Tab badge count
4. **Telegram alert digest** — Reuse ADR-145/171 pipeline (βλ. §5.8)
   - Daily digest 08:00 (configurable)
   - Immediate for CRITICAL alerts
   - Per-building mute support
   - `sendTelegramDigest()` function

#### D.4 Dashboard Integration
5. **Variance Table** — Photo count + log count inline per phase
6. **Lookahead** — Latest photo thumbnail per task
7. **Owner Report PDF** — Recent photos section + weekly summary

#### Enterprise ID generators
- `csphoto_XXXXX`, `cdlog_XXXXX`, `calert_XXXXX`

#### D.5 Portfolio Dashboard
8. **Portfolio page** — `/construction/portfolio` (βλ. §5.9)
   - Cross-building overview table (progress, SPI, CPI, alerts, next milestone)
   - 4 KPI summary cards (active buildings, avg progress, avg SPI, total alerts)
   - Sort by status (worst first), filter by status/name
   - Click-through to per-building Dashboard
   - PDF + Excel export (portfolio summary)
9. **Navigation**: New entry in main navigation → "Construction Portfolio"

#### Enterprise ID generators
- `csphoto_XXXXX`, `cdlog_XXXXX`, `calert_XXXXX`

**Dependencies**: `usePhotoCapture` (ADR-170), Firebase Storage, Telegram Bot (ADR-145)

### Phase E: RFI + Inspection Checklists (Μελλοντικά)
**Εκτίμηση**: ~2.500 LOC, 2 νέες Firestore collections

#### E.1 RFI Tracking
1. **RFI collection** — `construction_rfis` (βλ. §5.10)
   - CRUD: create, answer, close
   - Sequential numbering per building (RFI-001, RFI-002...)
   - File attachments (reuse Firebase Storage)
2. **RFI list section** — Collapsible section στο Dashboard
   - Sort by priority + age, filter by status
   - RFI detail side panel (view + answer form)
3. **Dashboard integration** — Open RFI count inline στο Variance Table + Lookahead
   - Blocking RFI warning per task
4. **Notification integration** — Telegram + in-app (reuse §5.8 alert system)
   - RFI overdue, RFI blocking task, RFI unanswered alerts

#### E.2 Inspection Checklists & Hold Points
5. **Checklist collection** — `construction_checklists` (βλ. §5.11)
   - Per-phase checklists with 3 item types (checkpoint, hold_point, witness_point)
   - Pass/Fail/N/A per item + evidence photos
   - Inspector sign-off flow
6. **Hold Point Enforcement** — Auto-block task completion if hold_point not passed
   - 🛑 icon στο Gantt + Dashboard warning
7. **Checklist Templates** — Default checklists ανά phase type στο `construction-templates.ts`
   - Foundation, Structural, Electrical, Plumbing, Roofing κλπ
8. **Mobile inspection flow** — Tap to check items + attach photo evidence
9. **Dashboard integration** — Checklist status per phase + upcoming inspection warnings
10. **Alert rules** — Hold point upcoming/overdue, checklist failed, inspection not scheduled

#### E.3 Punch List / Snag List
11. **Punch List collection** — `construction_punch_items` (βλ. §5.12)
    - CRUD: create, fix, verify, reject
    - Sequential numbering per building (#1, #2...)
    - Before/After photo comparison
    - 4-step lifecycle: open → fixed → verified / rejected
12. **Punch List view** — Collapsible section στο Dashboard
    - Sort by priority + age, filter by status/phase/priority
    - Side panel with Before/After photos + action buttons
13. **Handover Readiness Check** — Auto-check πριν παράδοση
    - Blocks handover αν critical/high punch items open
14. **Dashboard integration** — Punch List KPI card + per-phase count in Variance Table

#### E.4 Shared
15. **Owner Report PDF** — RFIs + hold points + punch list summary
16. **Alert rules** — Punch item overdue, critical defect, handover blocked
17. **Enterprise ID generators**: `crfi_XXXXX`, `cchk_XXXXX`, `cchki_XXXXX`, `cpunch_XXXXX`

**Εκτίμηση Phase E**: ~3.500 LOC, 3 νέες Firestore collections
**Dependencies**: Alert system (Phase D), Telegram Bot (ADR-145), Firebase Storage, `construction-templates.ts`

### Phase F: Change Orders + Submittals (Μελλοντικά)
**Εκτίμηση**: ~3.000 LOC, 2 νέες Firestore collections

#### F.1 Change Orders
1. **Change Order collection** — `construction_change_orders` (βλ. §5.13)
   - 5-step lifecycle: draft → pending_approval → approved → executed (+ rejected/voided)
   - Cost + duration impact tracking per CO
   - BOQ items link (added/removed/modified)
   - Reason categories (6 types, i18n el+en)
   - File attachments (drawings, estimates)
2. **Budget Impact Dashboard** — Running total: original + COs = revised budget
3. **Schedule Impact Dashboard** — Duration impact: original + COs = revised completion
4. **CO List view** — Collapsible section στο Dashboard, sort/filter
5. **S-Curve enhancement** — Revised PV line (after approved COs) alongside original PV

#### F.2 Submittals
6. **Submittal collection** — `construction_submittals` (βλ. §5.15)
   - 6-step lifecycle: draft → submitted → under_review → approved/revise/rejected
   - Revision tracking (revision number, full history)
   - Lead time + requiredByDate → schedule risk calculation
   - Link to BOQ items + Purchase Orders (ADR-267)
   - Spec section reference (CSI format)
7. **Submittal Log view** — Collapsible section, sort/filter, approval timeline
8. **Lookahead integration** — Submittal status badges per task, lead time warnings
9. **Schedule Risk Calculator** — Overdue / at risk / lead time risk per submittal

#### F.3 Shared
10. **Owner Report PDF** — CO summary + submittal status
11. **Alert rules** — CO pending >5d, budget overrun, submittal overdue, lead time risk
12. **Telegram notifications** — CO/submittal submitted, approved/rejected
13. **Enterprise ID generators**: `cco_XXXXX`, `csubm_XXXXX`

**Dependencies**: BOQ system (ADR-175), ADR-267 Procurement, Alert system (Phase D), Telegram Bot (ADR-145)

### Phase G: Safety + Meeting Minutes (Μελλοντικά)
**Εκτίμηση**: ~3.000 LOC, 3 νέες Firestore collections

#### G.1 Safety Incidents
1. **Safety Incidents collection** — `construction_safety_incidents` (βλ. §5.14)
   - CRUD: report, investigate, corrective actions, close
   - Sequential numbering per building (INC-001, INC-002...)
   - Severity classification (7 types, Greek law alignment)
   - Root cause + corrective actions tracking
   - ΣΕΠΕ reporting compliance flag
2. **Toolbox Talks collection** — `construction_toolbox_talks` (βλ. §5.14)
   - Topic categories (10 types, i18n el+en)
   - Attendee list with digital sign-off
   - Auto-suggest topic after incident
3. **Dashboard integration** — Safety KPI card + Safety Log section

#### G.2 Meeting Minutes
4. **Meetings collection** — `construction_meetings` (βλ. §5.16)
   - Meeting lifecycle: create → agenda → notes → action items → distribute
   - Auto-populated agenda (open items, RFIs, COs, submittals, lookahead, safety)
   - Action items with cross-references (task, RFI, CO, submittal links)
   - Sequential numbering per building (MTG-001, MTG-002...)
5. **Action Items tracking** — Dashboard KPI card + collapsible section
   - Sort by due date, filter by status/assignee
   - Overdue highlighting
6. **Meeting Minutes PDF** — Auto-generated formatted document
   - Attendees, agenda, notes, decisions, action items
   - Distribution via email/Telegram
7. **Auto-agenda generation** — Pulls open items from all modules

#### G.3 Shared
8. **Owner Report PDF** — Safety summary + upcoming meeting actions
9. **Alert rules** — Incident (immediate Telegram), corrective action overdue, ΣΕΠΕ report due, action item overdue, no meeting >10 days
10. **Enterprise ID generators**: `csafe_XXXXX`, `ctalk_XXXXX`, `cmeet_XXXXX`, `cmai_XXXXX`

**Dependencies**: Alert system (Phase D), Telegram Bot (ADR-145), Firebase Storage, RFI + CO + Submittal systems (Phase E/F)

### Phase H: Drawings + Progress Claims + Permits (Μελλοντικά)
**Εκτίμηση**: ~4.000 LOC, 4 νέες Firestore collections

#### H.1 Drawing Management
1. **Drawing collection** — `construction_drawings` (βλ. §5.17)
   - Discipline-coded numbering (A-101, S-201, E-301...)
   - Revision control (A, B, C... with supersede flow)
   - Thumbnail generation
2. **Markup collection** — `construction_drawing_markups` (βλ. §5.17)
   - Pin/area/arrow/text/measurement annotations
   - Cross-links: RFI pin, Punch pin, Photo pin
3. **Drawing Viewer** — Interactive pan/zoom, markup tools, layer toggle
4. **Revision Compare** — Side-by-side / overlay δύο revisions

#### H.2 Progress Claims & Retention
5. **Progress Claims collection** — `construction_progress_claims` (βλ. §5.18)
   - Monthly certification lifecycle: draft → submitted → approved → paid
   - Line items per phase (contract amount, previously claimed, this period)
   - Retention calculation (5-10%)
   - Cash flow dashboard (claimed vs paid per month)
6. **Retention tracking** — Release date, cumulative held amount

#### H.3 Permits & Compliance
7. **Permits collection** — `construction_permits` (βλ. §5.19)
   - 8 permit categories (Greek law aligned)
   - Expiry date tracking with proactive alerts
   - Blocks-work flag (expired permit → stop work warning)
   - Subcontractor insurance + worker certification tracking
8. **Dashboard integration** — Permits KPI card, expiry warnings

#### H.4 Shared
9. **Owner Report PDF** — Drawing set summary, cash flow, permits status
10. **Alert rules** — New revision uploaded, permit expiring, claim overdue, insurance lapsed
11. **Enterprise ID generators**: `cdraw_XXXXX`, `cmkup_XXXXX`, `cclaim_XXXXX`, `cperm_XXXXX`

**Dependencies**: Alert system (Phase D), Firebase Storage, BOQ system (ADR-175)

### Phase I: Warranties + As-Built Handover (Μελλοντικά)
**Εκτίμηση**: ~1.500 LOC, 1 νέα Firestore collection

1. **Warranty collection** — `construction_warranties` (βλ. §5.20)
   - Per-item warranty tracking (item, supplier, period, expiry)
   - Warranty claims (open/resolved)
   - Expiry alerts (30 days before)
2. **As-Built Documentation Package** — Auto-compilation (βλ. §5.21)
   - Pulls latest revisions from Drawing Set
   - Pulls certificates from Permits
   - Pulls warranties from Warranty Tracker
   - Pulls photos from Site Photos (per phase)
   - Generates project summary (cost, duration, safety, quality)
3. **Handover Readiness Checklist** — Auto-calculated from all modules
   - 10-point checklist (phases, hold points, RFIs, punch, COs, warranties, permits, drawings, O&M manuals)
   - Progress bar + blocking items
4. **Downloadable package** — ZIP export or online portal link
5. **Enterprise ID generator**: `cwarr_XXXXX`

**Dependencies**: ALL previous phases (compiles data from every module)

---

## 8. FIRESTORE IMPACT

### Δεν χρειάζονται νέες collections για Phase A!
Τα πάντα υπολογίζονται από: `construction_phases`, `construction_tasks`, `boq_items`, `building_milestones`.

### Phase C — Νέα collection (μελλοντικά):
```typescript
// construction_baselines — monthly schedule snapshots
interface ConstructionBaseline {
  id: string;           // 'cbase_XXXXX'
  buildingId: string;
  companyId: string;
  snapshotDate: string;
  phases: ConstructionPhase[];  // Full copy
  tasks: ConstructionTask[];    // Full copy
  createdAt: Timestamp;
}
```

---

## 9. UX PATTERNS — INDUSTRY STANDARDS

### 9.1 Empty States (Google Standard)

**Google Pattern**: Κάθε view έχει thoughtful empty state με CTA.

**Dashboard Empty States**:
| Κατάσταση | Empty State Message | CTA Button |
|-----------|---------------------|------------|
| No phases exist | "Δεν υπάρχουν φάσεις κατασκευής. Δημιουργήστε τη πρώτη φάση στο Gantt view." | [Μετάβαση στο Gantt →] |
| Phases exist but no actual data | "Η κατασκευή δεν έχει ξεκινήσει ακόμα. Τα analytics θα εμφανιστούν μόλις ξεκινήσουν οι εργασίες." | — |
| S-Curve empty (no BOQ costs) | "Δεν υπάρχουν δεδομένα κόστους (BOQ). Η S-curve δείχνει μόνο πρόοδο." | [Προσθήκη BOQ →] |
| Lookahead empty | "Δεν υπάρχουν εργασίες στις επόμενες {N} εβδομάδες." | — |

**Implementation**: Reuse existing `EmptyState` component pattern.

### 9.2 Mobile/Tablet Layout (Procore Pattern — Construction On-Site)

**Context**: Εργοδηγοί χρησιμοποιούν **tablet στο εργοτάξιο**. Το dashboard πρέπει να είναι usable σε 768px+.

**Responsive Breakpoints**:
| Section | Desktop (1024+) | Tablet (768-1023) | Mobile (<768) |
|---------|----------------|-------------------|---------------|
| KPI Cards | 3×2 grid | 2×3 grid | 1×6 stack |
| S-Curve Chart | Full width, 400px height | Full width, 300px height | Full width, 250px height |
| Variance Table | Full columns | Hide Planned Start, Actual Start | Show only: Name, Variance, Status |
| Lookahead Table | Full columns | Hide Duration, Dependencies | Show only: Name, End, Status |
| Export Buttons | Inline bar | Dropdown menu | Dropdown menu |

**Κανόνας**: Χρήση `useLayoutClasses()` responsive patterns. Tailwind responsive prefixes (`md:`, `lg:`).

### 9.3 Print-Optimized Layout (Buildertrend Pattern — Site Meeting)

**Use Case**: Εκτύπωση A4 για σύσκεψη εργοταξίου (εβδομαδιαία). Ο εργοδηγός κλικ Ctrl+P ή Export PDF.

**`@media print` Rules**:
- Hide: navigation, sidebar, export buttons, toggle bar, scrollbars
- Show: KPIs (compact), Variance table (expanded), Lookahead table
- S-Curve: Render σε grayscale-friendly colors (dashed vs solid vs dotted lines)
- Page break: Between S-Curve section and Variance Table
- Header: Building name + date σε κάθε σελίδα
- Font size: 10pt for tables (fit more data)

**Implementation**: CSS `@media print` block στο Dashboard component. ~30 γραμμές CSS.

### 9.4 Refresh / Stale Data (Google Pattern)

**Google Pattern**: Refresh button + "Last updated X min ago" timestamp.

**Implementation**:
- **"Last updated" timestamp**: Εμφανίζεται στο header → `"Τελευταία ενημέρωση: 14:32"` (muted text)
- **Refresh button**: Icon button (RefreshCw icon) δίπλα στο timestamp → re-fetches data
- **Auto-refresh**: ΟΧΙ — construction data δεν αλλάζει κάθε δευτερόλεπτο
- **Tab switch refresh**: Όταν ο χρήστης γυρίζει στο Dashboard tab, ΔΕΝ κάνει auto-refetch αν <5 min πέρασαν. Αν >5 min → subtle "Data may be outdated" hint.

**Implementation**: `useConstructionGantt` ήδη έχει `reload()` function. Wire to refresh button.

### 9.5 Accessibility (Google Standard — a11y)

**Mandatory (Phase A)**:
- **Keyboard navigation**: Tab through KPI cards, table rows, buttons
- **ARIA labels**: Charts (`aria-label="S-Curve showing planned vs actual progress"`), KPI cards (`role="status"`)
- **Color + shape**: Traffic lights δεν βασίζονται ΜΟΝΟ σε χρώμα — icon + text label μαζί (🟢 "On Track", 🔴 "+7d Late")
- **Screen reader**: Table headers properly scoped (`<th scope="col">`), progress values announced
- **Focus visible**: Outline on all interactive elements

**Phase B**:
- **Chart data table**: Hidden table behind S-Curve for screen readers (recharts `<AccessibilityLayer>`)
- **High contrast mode**: Ensure design token colors meet WCAG AA (4.5:1 contrast)

---

## 10. RISKS & MITIGATIONS

| Risk | Impact | Mitigation |
|------|--------|------------|
| S-Curve empty αν δεν υπάρχουν BOQ costs | Κενό chart | Fallback: progress-only S-curve (χωρίς cost) |
| Gantt PDF χωρίς DOM element | Δεν γίνεται html-to-image | Server-side table PDF ως fallback |
| Delay reasons δεν υπάρχουν στο schema | Delay chart μόνο count, χωρίς categories | Phase C: Add `delayReason` field |
| Monthly EVM snapshots δεν υπάρχουν | EVM trend μόνο current point | Phase C: Cron/manual baseline snapshots |

---

## 10. TESTING STRATEGY

1. **Unit tests**: `computeScheduleVariance()`, `filterLookahead()` pure functions
2. **Visual**: Verify charts render with empty, partial, and full data
3. **Integration**: API route returns correct payload structure
4. **Responsive**: Reports render correctly σε mobile, tablet, desktop

---

## 11. DECISION RECORD

| Ερώτημα | Απόφαση | Σκεπτικό |
|---------|---------|----------|
| Cross-building ή per-building? | **Per-building** (Dashboard tab μέσα στο Building Management) | Procore/Primavera pattern — schedule analytics στο context του building |
| Placement UX? | **Τρίτο tab** στο view toggle (Milestones \| Gantt \| Dashboard) | Procore/Monday.com "Views" pattern — ίδια data, different lens |
| Drill-down level? | **Expandable tree table** (phases collapsed → expand to tasks) | Primavera/MS Project universal pattern |
| KPI trends? | **vs Plan** (real-time computed, zero snapshots) | Construction standard — "where am I vs where I should be" |
| Date range? | **Full lifecycle** (no date picker) + today marker | Construction = finite project, S-curve needs full context |
| Lookahead + materials? | **Tasks only** (Phase A). Procurement badges Phase B | Google progressive disclosure — contextual warnings, not mixed content |
| Dark mode? | **Automatic** via design system hooks | Google standard — table stakes 2026 |
| Data loading? | **Reuse `useConstructionGantt` data** + lazy BOQ fetch | Google pattern — zero redundant API calls |
| Owner report? | **Simplified PDF export template** (Phase B) | Buildertrend pattern — PM generates, emails to owner |
| Critical Path? | Phase C | CPM algorithm + dependencies[] not fully used yet |
| Baseline snapshots? | Phase C | New collection + cron job — over-engineering for Phase A |
| Νέα library? | **Όχι** | recharts + jspdf + exceljs αρκούν |
| Mobile/Tablet? | **Responsive layout** — stacked cards, simplified tables | Procore: construction managers use tablets on-site |
| Print? | **`@media print` CSS** + PDF export | Buildertrend: weekly site meeting printout |
| Accessibility? | **Phase A**: keyboard nav, ARIA, color+shape. **Phase B**: chart data table | Google mandatory standard |
| Refresh? | **Manual button + "Last updated" timestamp**, no auto-refresh | Google pattern — construction data doesn't change per-second |
| Empty states? | **Thoughtful messages + CTA** per section | Google standard — never blank screen |
