# UC-BOQ-003: Gantt Link + Cashflow / EVM-lite

**Parent ADR:** ADR-175 — Σύστημα Επιμετρήσεων (Quantity Surveying / BOQ)
**Phase:** B (Gantt ↔ BOQ link UI) + D-partial (EVM kernel)
**Status:** Draft — Implementation Contract
**Date:** 2026-02-11
**Depends on:** UC-BOQ-001, UC-BOQ-002
**Blocks:** —

---

## 1. Σκοπός

Σύνδεση BOQ items με **φάσεις κατασκευής** (Gantt chart) ώστε:
1. Κάθε φάση να έχει **κόστος** (5D concept)
2. **Cash-flow projection** — πότε χρειάζονται τα χρήματα
3. **EVM-lite** — Earned Value metrics (PV/EV/AC, SPI/CPI)

Πρότυπο: RIB iTWO, Bentley SYNCHRO, Oracle Primavera.

---

## 2. Actors

| Actor | Ρόλος | Ενέργειες |
|-------|-------|-----------|
| **Μηχανικός** | Κύριος | Link items σε phases, verify costs |
| **Project Manager** | Ελέγχει | Cash-flow review, EVM dashboard |
| **Εργοδηγός** | Field | Progress update → trigger EV calc |

---

## 3. Preconditions

1. UC-BOQ-001: BOQ items υπάρχουν στο κτίριο
2. UC-BOQ-002: Τιμές resolved (inherited ή overridden)
3. Gantt chart: φάσεις κατασκευής υπάρχουν (construction_phases + construction_tasks)
4. Φάσεις έχουν ημερομηνίες (startDate, endDate)

### 3.1 Technical Debt Prerequisites (ΠΡΙΝ την υλοποίηση)

Πηγή: `docs/architecture-review/2026-02-11-timeline-gantt-measurements-integration-report.md`

| # | Τεχνικό χρέος | Τρέχουσα κατάσταση | Απαιτούμενη ενέργεια |
|---|--------------|-------------------|---------------------|
| 1 | **Milestones static** | Hardcoded dates (2006-2009) σε `utils.ts` | Migration σε `construction_milestones` collection |
| 2 | **CompletionForecastCard** | Fixed `delayDays = 5` | Υπολογισμός βάσει SPI + schedule slippage |
| 3 | **CriticalPathCard** | Static UI content | Real CPM βάσει dependencies |
| 4 | **Gantt types χωρίς cost fields** | `construction.ts` δεν έχει cost πεδία | Προσθήκη §4.1.2 πεδίων |

**ΚΡΙΣΙΜΟ:** Τα #1-#4 πρέπει να αντιμετωπιστούν **πριν** ή **παράλληλα** με τη σύνδεση BOQ↔Gantt, αλλιώς η ολοκλήρωση θα είναι μόνο οπτική.

---

## 4. Data Model

### 4.1 Link Model — Hybrid: Primary FK + Many-to-Many Table

**Πρόβλημα (Codex report §3.2):** Απλό `linkedPhaseId` (1:1) δεν αρκεί — 1 BOQ item μπορεί να εκτείνεται σε πολλές φάσεις.

**Λύση: Hybrid approach**

#### 4.1.1 Primary Link (BOQItem — quick query, απλές περιπτώσεις)

```typescript
// Πεδία ήδη στο BOQItem (UC-BOQ-001):
linkedPhaseId: string | null;    // FK → construction_phases (primary/main phase)
linkedTaskId: string | null;     // FK → construction_tasks (optional granularity)
```

#### 4.1.2 Many-to-Many Link Table (σύνθετα σενάρια)

```typescript
interface BOQTaskLink {
  id: string;
  buildingId: string;
  phaseId: string;
  taskId: string | null;         // null = phase-level link
  boqItemId: string;
  weightPct: number;             // 0-1, default 1.0 (100% σε primary link)
  createdAt: string;
  createdBy: string;
}
```

**Κανόνες:**
- Αν item linked σε 1 phase → μόνο primary FK, link table optional
- Αν item σε πολλές phases → link table mandatory, weightPct για επιμερισμό κόστους
- Σύνολο weightPct ανά item = 1.0 (100%)
- Phase cost = Σ(linked items × weightPct × totalCost)

**Παράδειγμα:**
```
BOQ Item "Σοβάδες τοίχων" (450m², 11.50€/m², total 5.175€)
  ├─ Phase PH-004 "Σοβάδες 1ου-2ου" → weightPct = 0.6 → 3.105€
  └─ Phase PH-007 "Σοβάδες 3ου-4ου" → weightPct = 0.4 → 2.070€
```

#### 4.1.3 Gantt Type Extensions (υπάρχοντα types)

Προσθήκη πεδίων στο `ConstructionPhase` / `ConstructionTask` (`src/types/building/construction.ts`):

```typescript
// Νέα πεδία (cached, recalculated on BOQ change):
plannedCost?: number;         // Σύνολο linked BOQ items (estimated)
actualCost?: number;          // Σύνολο πληρωμένων ποσών
earnedValue?: number;         // Σ(certifiedQty × unitCost)
linkedBoqCount?: number;      // Πόσα BOQ items συνδέονται
boqCoveragePct?: number;      // % budget καλυμμένο από BOQ items
```

#### 4.1.4 Construction Milestones (νέα entity)

```typescript
interface ConstructionMilestone {
  id: string;
  buildingId: string;
  name: string;
  type: MilestoneType;
  targetDate: string;
  actualDate: string | null;
  status: 'pending' | 'reached' | 'overdue' | 'cancelled';
  linkedPhaseId: string | null;
  linkedTaskId: string | null;
  linkedCertificationId: string | null;
  linkedInvoiceId: string | null;
  createdAt: string;
  updatedAt: string;
}

type MilestoneType =
  | 'phase_start'
  | 'phase_complete'
  | 'measurement_freeze'      // Κλείδωμα ποσοτήτων (πριν πιστοποίηση)
  | 'certification_cutoff'    // Τελική ημερ. πιστοποίησης
  | 'invoice_approved'        // Έγκριση τιμολογίου
  | 'retainage_release'       // Αποδέσμευση κράτησης
  | 'permit'                  // Αδειοδοτικό ορόσημο
  | 'inspection'              // Επιθεώρηση
  | 'handover';               // Παράδοση
```

### 4.2 Phase Cost Summary (computed, δεν αποθηκεύεται)

```typescript
interface PhaseCostSummary {
  phaseId: string;
  phaseName: string;
  startDate: string;
  endDate: string;
  progress: number;              // 0-100% από Gantt
  linkedItems: number;           // πόσα BOQ items
  estimatedCost: number;         // Σ(item.totalCost) για linked items
  certifiedCost: number;         // Σ(certifiedQuantity × unitCost)
  variance: number;              // certified - estimated
  variancePct: number;
}
```

### 4.3 Cash-Flow Projection

```typescript
interface CashFlowPeriod {
  month: string;                 // "2026-03"
  plannedSpend: number;          // PV — Planned Value
  actualSpend: number;           // AC — Actual Cost
  earnedValue: number;           // EV — Earned Value
  cumulativePlanned: number;
  cumulativeActual: number;
  cumulativeEarned: number;
}

interface CashFlowProjection {
  buildingId: string;
  periods: CashFlowPeriod[];
  totalBudget: number;           // BAC — Budget At Completion
  estimateAtCompletion: number;  // EAC = BAC / CPI
}
```

### 4.4 EVM Kernel (persisted monthly — Phase D)

```typescript
interface BOQEvmPeriod {
  id: string;
  buildingId: string;
  periodMonth: string;           // "2026-03"
  pv: number;                    // Planned Value
  ev: number;                    // Earned Value
  ac: number;                    // Actual Cost
  // Computed:
  // SPI = EV / PV
  // CPI = EV / AC
  // SV = EV - PV (Schedule Variance)
  // CV = EV - AC (Cost Variance)
  // EAC = BAC / CPI
  // ETC = EAC - AC
  snapshotDate: string;
  createdAt: string;
}
```

---

## 5. Happy Path

### 5.1 Flow: Link BOQ Item σε Phase (Simple — 1:1)

```
1. Χρήστης → Building → Tab "Επιμετρήσεις"
2. Ανοίγει BOQ Item Editor (ή inline)
3. Section "Συνδέσεις": dropdown "Φάση Gantt"
   • Δείχνει φάσεις του κτιρίου: "PH-001: Σκυροδέματα", "PH-002: Τοιχοποιίες"...
4. Επιλέγει φάση → linkedPhaseId = selected phase
5. Optionally: dropdown "Εργασία" → linkedTaskId (εντός φάσης)
6. Αποθήκευση → primary FK + auto-create BOQTaskLink (weightPct=1.0)
7. Αποτέλεσμα: item εμφανίζεται και στο Gantt (cost overlay)
```

### 5.1b Flow: Link BOQ Item σε Πολλές Φάσεις (Advanced — M:N)

```
1. Χρήστης → BOQ Item Editor → Section "Συνδέσεις"
2. Click "Πολλαπλή Σύνδεση" (toggle advanced mode)
3. Multi-select phases + weight allocation:
   ┌──────────────────────────────────────────────┐
   │ Σύνδεση με Φάσεις                            │
   │                                               │
   │ ☑ PH-004: Σοβάδες 1ου-2ου   [60%]           │
   │ ☑ PH-007: Σοβάδες 3ου-4ου   [40%]           │
   │ ☐ PH-009: Φινιρίσματα       [  %]           │
   │                                               │
   │ Σύνολο: 100% ✅                               │
   └──────────────────────────────────────────────┘
4. Αποθήκευση → BOQTaskLinks created, primary FK = first phase
5. Phase costs re-computed: 60% και 40% αντίστοιχα
```

### 5.1c Progress Rule: Ποσοτικός Υπολογισμός Προόδου

```
Task/Phase progress = Σ(certifiedQty × unitCost) / Σ(estimatedQty × unitCost) × 100

Παράδειγμα:
  Phase "Σοβάδες" — linked BOQ items:
    Σοβάς τοίχων:   certified 320m² / estimated 450m² × 5.175€ = 3.680€
    Σοβάς οροφών:   certified 100m² / estimated 120m² × 1.680€ = 1.400€
    Γωνιόκρανα:     certified 70m  / estimated 85m   × 314.50€ = 259€
  ──────────────────
  EV = 3.680 + 1.400 + 259 = 5.339€
  PV = 5.175 + 1.680 + 314.50 = 7.169.50€
  Progress = 5.339 / 7.170 × 100 = 74.5%

Πλεονέκτημα: αντικειμενικός δείκτης αντί subjective "νομίζω 75%"
```

### 5.2 Flow: Phase Cost Summary (Gantt view)

```
1. Χρήστης → Building → Tab "Χρονοδιάγραμμα" (Gantt)
2. Βλέπει φάσεις κατασκευής
3. Δίπλα σε κάθε φάση: 💰 badge με συνολικό κόστος
   "PH-004: Σοβάδες — 15 Μαρ→30 Μαρ — 7.170€"
4. Click badge → expand: λίστα linked BOQ items
5. Σύστημα υπολογίζει:
   • estimatedCost = Σ(grossQty × totalUnitCost) για linked items
   • certifiedCost = Σ(certifiedQty × totalUnitCost)
   • variance = certifiedCost - estimatedCost
```

### 5.3 Flow: Cash-Flow Projection

```
1. Χρήστης → Building → Tab "Χρηματοροή" (ή section μέσα στα Measurements)
2. Σύστημα αντλεί:
   • Κάθε φάση → startDate, endDate, progress
   • Linked BOQ items → estimated + certified costs
3. Κατανέμει κόστος ανά μήνα:
   • PV: linear ή weighted κατανομή ανάμεσα σε start-end
   • EV: progress% × phaseBudget (ή Σ certifiedQuantity × unitCost)
   • AC: Σ actual invoiced amounts (from accounting bridge — future)
4. Δείχνει S-curve:
   • X axis: μήνες
   • Y axis: κόστος (€)
   • Γραμμές: Planned (PV), Earned (EV), Actual (AC)
5. Summary metrics:
   • BAC (Budget At Completion): Σ estimated costs
   • EAC (Estimate At Completion): BAC / CPI
   • Remaining: EAC - AC
```

### 5.4 Flow: EVM Dashboard

```
1. Χρήστης → Building → Section "Project Controls" (ή card)
2. Σύστημα υπολογίζει current period:
   • PV = Σ(planned cost of work scheduled to date)
   • EV = Σ(certified quantities × unit costs)
   • AC = Σ(actual payments) — bridge field, null αν δεν έχει ακόμα
3. KPIs:
   • SPI = EV / PV → traffic light (< 0.95 = 🔴, 0.95-1.05 = 🟢, > 1.05 = 🔵)
   • CPI = EV / AC → traffic light (< 0.95 = 🔴, 0.95-1.05 = 🟢, > 1.05 = 🟡)
   • EAC = BAC / CPI
4. Chart: S-curve with planned/earned/actual
5. Table: monthly PV/EV/AC series
```

---

## 6. Edge Cases

| # | Σενάριο | Συμπεριφορά |
|---|---------|-------------|
| 1 | BOQ item χωρίς linked phase | Δεν εμφανίζεται στο Gantt cost overlay, cash-flow δείχνει ως "unlinked budget" |
| 2 | Phase χωρίς linked BOQ items | Phase cost = 0€, warning indicator |
| 3 | Phase dates αλλάζουν | Cash-flow re-computed, PV redistribution |
| 4 | Progress = 100% αλλά certified < estimated | Variance warning (positive — under-budget ή incomplete certification) |
| 5 | AC = null (δεν υπάρχει accounting bridge) | CPI undefined, δείχνει "—", EAC = BAC (fallback) |
| 6 | Multiple items → ίδια phase | Σύνολο = Σ item costs (normal aggregation) |
| 7 | Item αλλάζει phase (re-link) | Old phase cost μειώνεται, new phase cost αυξάνεται — both re-computed |
| 8 | Κτίριο χωρίς Gantt (δεν έχει φάσεις) | BOQ λειτουργεί χωρίς linking, cash-flow/EVM disabled |
| 9 | M:N link weights δεν κάνουν σύνολο 100% | Validation error — "Σύνολο βαρών πρέπει = 100%" |
| 10 | Item σε M:N link διαγράφεται | Cascade delete links, re-compute phase costs |
| 11 | Milestone measurement_freeze reached | Block new BOQ items σε draft, force submit |
| 12 | Phase progress > 100% (certified > estimated) | Allow, show warning "Over-certified" |

---

## 7. UI Components

### 7.1 Gantt Cost Overlay

```
<GanttCostOverlay phases={phases} boqItems={boqItems}>
  {phases.map(phase => (
    <PhaseCostBadge
      phase={phase}
      estimatedCost={summary.estimatedCost}
      certifiedCost={summary.certifiedCost}
      variance={summary.variance}
    />
  ))}
</GanttCostOverlay>
```

### 7.2 Cash-Flow Chart

```
<CashFlowChart
  buildingId={buildingId}
  periods={cashFlowPeriods}
  showPlanned showEarned showActual
/>
```

- Library: recharts (ήδη στο project) ή chart.js
- S-curve: cumulative line chart
- Monthly bars: grouped bar chart (PV/EV/AC)

### 7.3 EVM Dashboard Card

```
<EVMDashboard buildingId={buildingId}>
  <EVMKpiCard label="SPI" value={spi} threshold={0.95} />
  <EVMKpiCard label="CPI" value={cpi} threshold={0.95} />
  <EVMSummaryRow bac={bac} eac={eac} etc={etc} />
  <EVMSCurveChart periods={evmPeriods} />
</EVMDashboard>
```

### 7.4 Linking UI (μέσα στο BOQ Item Editor)

Ήδη σχεδιασμένο στο UC-BOQ-001 SCREEN 2:
```
── Συνδέσεις ──
Φάση Gantt:     [PH-002: Σκυροδέματα  ▼]
Εργασία:        [T-005: Θεμέλια        ▼]  (optional)
```

---

## 8. Service Operations

```typescript
interface GanttBridgeService {
  // Simple Linking (1:1 — updates BOQItem FK)
  linkItemToPhase(itemId: string, phaseId: string, taskId?: string): Promise<void>;
  unlinkItemFromPhase(itemId: string): Promise<void>;
  getItemsByPhase(phaseId: string): Promise<BOQItem[]>;

  // M:N Linking (many-to-many — boq_task_links collection)
  createMultiLink(itemId: string, links: { phaseId: string; taskId?: string; weightPct: number }[]): Promise<BOQTaskLink[]>;
  updateLinkWeights(itemId: string, weights: { linkId: string; weightPct: number }[]): Promise<void>;
  removeLink(linkId: string): Promise<void>;
  getLinksByItem(itemId: string): Promise<BOQTaskLink[]>;
  getLinksByPhase(phaseId: string): Promise<BOQTaskLink[]>;

  // Phase summaries (weighted cost computation)
  getPhaseCostSummary(phaseId: string): Promise<PhaseCostSummary>;
  getBuildingPhaseCosts(buildingId: string): Promise<PhaseCostSummary[]>;
  computePhaseProgress(phaseId: string): Promise<number>;  // certifiedCost/estimatedCost × 100

  // Milestones
  createMilestone(data: CreateMilestoneInput): Promise<ConstructionMilestone>;
  updateMilestone(id: string, data: Partial<ConstructionMilestone>): Promise<void>;
  getMilestones(buildingId: string): Promise<ConstructionMilestone[]>;
  checkMilestoneStatus(buildingId: string): Promise<MilestoneStatusReport>;

  // Cash-flow
  computeCashFlow(buildingId: string): Promise<CashFlowProjection>;
  computeProjectCashFlow(projectId: string): Promise<CashFlowProjection>;

  // EVM
  computeCurrentEVM(buildingId: string): Promise<EVMSnapshot>;
  snapshotEVMPeriod(buildingId: string, month: string): Promise<BOQEvmPeriod>;
  getEVMHistory(buildingId: string): Promise<BOQEvmPeriod[]>;
  computeForecast(buildingId: string): Promise<CompletionForecast>;  // SPI-based
}
```

---

## 9. Firestore

### 9.1 Collections (νέα)

```
boq_task_links                # Many-to-many BOQ↔Phase/Task (with weightPct)
construction_milestones       # Ορόσημα ως first-class entity
boq_evm_periods               # Monthly EVM snapshots (Phase D)
```

### 9.2 Indexes

```
boq_items: buildingId ASC, linkedPhaseId ASC (ήδη στο UC-BOQ-001)
boq_task_links: buildingId ASC, boqItemId ASC
boq_task_links: buildingId ASC, phaseId ASC
construction_milestones: buildingId ASC, type ASC, status ASC
boq_evm_periods: buildingId ASC, periodMonth ASC
```

---

## 10. Affected Files

### 10.1 Νέα Αρχεία

```
src/services/measurements/gantt-bridge-service.ts    # Phase linking + cost summaries
src/services/measurements/task-link-service.ts       # M:N link management + weight allocation
src/services/measurements/milestone-service.ts       # Construction milestones CRUD
src/services/measurements/cashflow-engine.ts         # Cash-flow projection computation
src/services/measurements/evm-engine.ts              # EVM computation + snapshots
src/types/measurements/gantt-link.ts                 # BOQTaskLink, ConstructionMilestone, MilestoneType
src/types/measurements/cashflow.ts                   # CashFlowPeriod, CashFlowProjection
src/types/measurements/evm.ts                        # BOQEvmPeriod, EVMSnapshot
src/components/building-management/measurements/GanttCostOverlay.tsx
src/components/building-management/measurements/PhaseCostBadge.tsx
src/components/building-management/measurements/MultiPhaseLinkDialog.tsx  # M:N link UI
src/components/building-management/measurements/MilestoneTimeline.tsx     # Data-driven milestones
src/components/building-management/measurements/CashFlowChart.tsx
src/components/building-management/measurements/EVMDashboard.tsx
src/components/building-management/measurements/EVMKpiCard.tsx
```

### 10.2 Τροποποιούμενα Αρχεία

```
src/types/building/construction.ts                       # +plannedCost, actualCost, earnedValue, linkedBoqCount, boqCoveragePct
src/components/building-management/gantt/GanttChart.tsx  # +cost overlay integration
src/components/building-management/tabs/TimelineTabContent.tsx              # Milestones → data-driven
src/components/building-management/tabs/TimelineTabContent/utils.ts        # Remove hardcoded milestones
src/components/building-management/tabs/TimelineTabContent/CompletionForecastCard.tsx  # Real SPI-based forecast
src/components/building-management/tabs/TimelineTabContent/CriticalPathCard.tsx        # Real CPM analysis
src/components/building-management/hooks/useConstructionGantt.ts           # +cost fields handling
src/app/api/buildings/[buildingId]/construction-phases/route.ts            # +cost fields in allowlist
src/services/measurements/boq-service.ts                 # +phase linking methods
src/config/firestore-collections.ts                      # +BOQ_TASK_LINKS, +CONSTRUCTION_MILESTONES, +BOQ_EVM_PERIODS
src/i18n/locales/el/measurements.json                    # +gantt/cashflow/evm/milestone translations
src/i18n/locales/en/measurements.json
firestore.indexes.json                                   # +link/milestone/evm indexes
```

---

## 11. Acceptance Criteria

### Phase B — Gantt Link

- [ ] Simple link: BOQ item → 1 phase via dropdown
- [ ] Advanced link: BOQ item → πολλές phases via M:N dialog + weight allocation
- [ ] Weight validation: Σ weights = 100% ανά item
- [ ] Phase cost badge εμφανίζεται στο Gantt (weighted)
- [ ] Click badge → expand linked items
- [ ] Unlinked items εμφανίζονται ξεχωριστά
- [ ] Re-link: cost μετακινείται σωστά μεταξύ phases
- [ ] Progress from quantities: certifiedQty/estimatedQty (ΟΧΙ subjective %)
- [ ] Gantt types extended: plannedCost, actualCost, earnedValue σε phases/tasks

### Phase B — Milestones (data-driven)

- [ ] `construction_milestones` collection αντί hardcoded dates
- [ ] Milestone types: phase_start, phase_complete, measurement_freeze, certification_cutoff, etc.
- [ ] CompletionForecastCard: forecast βάσει SPI (ΟΧΙ fixed +5 days)
- [ ] CriticalPathCard: real delayed critical tasks (ΟΧΙ static content)

### Phase B — Cash-Flow

- [ ] S-curve chart: PV cumulative line
- [ ] Monthly breakdown: bar chart PV
- [ ] EV line (βάσει certified quantities)
- [ ] BAC summary card

### Phase D — EVM

- [ ] SPI + CPI computed σωστά
- [ ] Traffic lights: < 0.95 🔴, 0.95-1.05 🟢
- [ ] EAC = BAC / CPI
- [ ] Monthly snapshot persist (boq_evm_periods)
- [ ] S-curve with 3 lines (PV/EV/AC)

---

## 12. Out of Scope

- Gantt scheduling logic (ήδη υπάρχει)
- Detailed resource leveling → Future
- Monte Carlo simulation → Future
- Multi-building consolidated EVM → Future phase

---

*Implementation contract for ADR-175 Phase B + D (EVM). Cash-flow uses linear distribution as MVP; weighted distribution (early/late start) as future enhancement.*
