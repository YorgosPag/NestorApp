# ADR-266: Gantt & Construction Schedule Reports

**Status**: PHASE A IMPLEMENTED
**Date**: 2026-03-28
**Author**: Claude (Research Agents × 4)
**Related ADRs**: ADR-034 (Gantt Chart), ADR-265 (Enterprise Reports System), ADR-175 (BOQ/Quantity Surveying)

### Changelog
| Date | Changes |
|------|---------|
| 2026-03-28 | Initial research & architecture — DRAFT for review |
| 2026-03-28 | **Phase A IMPLEMENTED**: 8 new files, 7 modified — Dashboard view toggle, KPIs, S-Curve, Variance Table, Lookahead, Export (PDF/Excel), i18n (el+en) |

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
▶ PH-002 Foundation          Planned: 01/03–15/04   Actual: 05/03–22/04   +7d  🔴  85%
  ├─ TSK-001 Excavation       Planned: 01/03–10/03   Actual: 05/03–12/03   +2d  🟡  100%
  ├─ TSK-002 Footings         Planned: 11/03–25/03   Actual: 13/03–28/03   +3d  🟡  100%
  ├─ TSK-003 Concrete pour    Planned: 26/03–05/04   Actual: 29/03–12/04   +7d  🔴  100%
  └─ TSK-004 Curing           Planned: 06/04–15/04   Actual: 13/04–22/04   +7d  🔴  50%
▶ PH-003 Structural Frame    Planned: 16/04–30/05   Actual: —              0d   🟢  0%
```

#### Columns:

| Column | Phase Row (summary) | Task Row (detail) |
|--------|--------------------|--------------------|
| `▶`/`▼` Name | Phase name (bold) | Task name (indented) |
| Planned Start | plannedStartDate | plannedStartDate |
| Planned End | plannedEndDate | plannedEndDate |
| Actual Start | MIN(tasks.actualStartDate) | actualStartDate |
| Actual End | MAX(tasks.actualEndDate) | actualEndDate |
| Variance (days) | MAX(tasks.variance) — worst case | actualEnd - plannedEnd |
| Status | Traffic light: worst child status | 🟢 ≤0d, 🟡 1-7d, 🔴 >7d |
| Progress | WEIGHTED_AVG(tasks.progress) | Progress bar 0-100% |

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

**Columns**: Task Name, Phase, Start, End, Duration, Dependencies, Status, Assignee (future).

**Toggle**: 2 εβδομάδες / 4 εβδομάδες (Radix Select).

**Use Case**: On-screen view + εκτύπωση (PDF/Excel) για εβδομαδιαία σύσκεψη εργοταξίου.

**Export**: Και on-screen ΚΑΙ exportable — χρησιμοποιεί τα υπάρχοντα enterprise export systems (βλ. §5.7).

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

### 5.6 Gantt Snapshot Card

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

### Phase B: Enhanced Analysis + Owner Report
**Εκτίμηση**: ~6 αρχεία, ~900 LOC

1. `DelayBreakdownChart` — Delays ανά phase
2. `exportOwnerReportToPdf()` — Simplified 1-2 page PDF for building owner
3. Server-side Gantt table PDF (jspdf-autotable, χωρίς DOM)
4. EVM Trend sparklines (SPI/CPI over time — needs monthly snapshots)
5. Procurement contextual badges in Lookahead (after ADR-267)
6. Chart zoom via recharts `<Brush>` component

### Phase C: Advanced (Μελλοντικά)
**Εκτίμηση**: ~1.500 LOC, αλγοριθμική πολυπλοκότητα

1. Critical Path calculation (forward/backward pass)
2. Baseline snapshots (new Firestore collection `construction_baselines`)
3. `delayReason` field migration στο task/phase schema
4. Resource allocation tracking
5. Chart accessibility layer for screen readers

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
