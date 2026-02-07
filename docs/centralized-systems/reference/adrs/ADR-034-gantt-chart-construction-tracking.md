# ADR-034: Gantt Chart - Construction Phase Tracking

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED - Architecture Design |
| **Date** | 2026-02-07 |
| **Category** | UI Components / Construction Management |
| **Author** | Georgios Pagonis + Claude Code (Anthropic AI) |
| **Related** | UC-017 (Construction Phase Tracking), ADR-169 (AI Architecture) |

---

## 1. Context

### Vision

Η εφαρμογή χρειάζεται **Gantt Chart** για την παρακολούθηση κατασκευής κάθε κτιρίου. Το Gantt θα εμφανίζεται **ανά κτίριο** (per building) και θα ενσωματωθεί μέσα στο υπάρχον **Timeline Tab** (Tab 3) των building details, ως εναλλακτικό sub-view δίπλα στα milestones.

### Τρέχουσα Κατάσταση

| Τι υπάρχει | Τι λείπει |
|------------|-----------|
| Timeline Tab με vertical milestones | Gantt Chart visualization (horizontal bars) |
| `building.status` (planning/construction/completed/active) | Task-level granularity (εργασίες ανά φάση) |
| `building.progress` (0-100%) | Dependencies μεταξύ εργασιών |
| `building.startDate` / `completionDate` | Resource allocation (ποιος κάνει τι) |
| `unit.operationalStatus` (ready/under-construction/...) | Actual vs Planned timeline comparison |
| recharts library εγκατεστημένο | Gantt-specific library |
| 7 mock milestones στο TimelineTabContent | Real data από Firestore |
| ChartContainer/ChartTooltip wrappers | Gantt-specific components |

### Ιεραρχία Δεδομένων (Context)

```
Company
  └── Project (status, progress, startDate, completionDate)
        └── Building (status, progress, startDate, completionDate)  ← GANTT ΕΔΩΕ
              ├── Floor
              │     └── Unit (operationalStatus, deliveryDate)
              ├── Storage
              └── Parking
```

**Το Gantt Chart θα εμφανίζεται στο επίπεδο Building**, δείχνοντας:
- Φάσεις κατασκευής (phases) ως group bars
- Εργασίες (tasks) ως individual bars μέσα σε κάθε φάση
- Milestones ως diamond markers
- Dependencies ως βέλη μεταξύ tasks

---

## 2. Decision

### 2.1 UI Placement

**Απόφαση**: Ενσωμάτωση μέσα στο υπάρχον **Timeline Tab** (Tab 3) των building details.

**Υλοποίηση**: Toggle μεταξύ δύο views:
- **Milestones View** (υπάρχον) - Vertical timeline με milestone cards
- **Gantt View** (νέο) - Horizontal bar chart με tasks/phases/dependencies

```
TimelineTabContent
├── ViewToggle [Milestones | Gantt]  ← ΝΕΟ
├── IF Milestones:
│   ├── TimelineHeader
│   ├── OverallProgressCard
│   ├── TimelineMilestones
│   ├── CriticalPathCard
│   └── CompletionForecastCard
│
└── IF Gantt:
    ├── GanttToolbar (zoom, filters, export)  ← ΝΕΟ
    ├── GanttChart (main visualization)       ← ΝΕΟ
    └── GanttSummaryCards (stats, delays)     ← ΝΕΟ
```

**Αρχείο**: `src/components/building-management/tabs/TimelineTabContent.tsx`

### 2.2 Technology Stack

#### Ανάλυση Libraries

| Library | License | TypeScript | React 19 | Maintenance | Verdict |
|---------|---------|-----------|----------|-------------|---------|
| SVAR React Gantt | **GPLv3** | v2.3+ | Compatible | Active (2026) | **ΑΠΟΚΛΕΙΣΤΗΚΕ** - GPLv3 υποχρεώνει ανοιχτό κώδικα |
| gantt-task-react | MIT | Native TS | Compat | Εγκαταλελειμμένη (4 χρόνια) | Απορρίφθηκε - unmaintained |
| **react-modern-gantt** | MIT | Native TS | React 17/18/19 | Active (2026) | **ΕΠΙΛΕΧΘΗΚΕ** |
| DHTMLX Gantt | GPL | Full | Full | Active | **ΑΠΟΚΛΕΙΣΤΗΚΕ** - GPL υποχρεώνει ανοιχτό κώδικα |
| Bryntum | Commercial | Full | Full | Active | Απορρίφθηκε - πολύ ακριβό (~$2000+/χρόνο) |
| Syncfusion | Commercial | Full | Full | Active | Απορρίφθηκε - πληρωμένο |
| Custom (recharts) | - | Ήδη installed | Ήδη | Δικό μας | Απορρίφθηκε - υπερβολική δουλειά |

#### ΤΕΛΙΚΗ ΑΠΟΦΑΣΗ: react-modern-gantt

**Package**: `react-modern-gantt` (npm)
**Version**: `0.6.1`
**License**: **MIT** - Δωρεάν, χωρίς υποχρέωση δημοσίευσης πηγαίου κώδικα
**Repository**: https://github.com/NillsvanLimworwortel/react-modern-gantt

**Γιατί react-modern-gantt**:
- **MIT License** → Μπορούμε να πουλήσουμε την εφαρμογή χωρίς κανένα νομικό πρόβλημα
- **Native TypeScript** → Full type safety (Task, TaskGroup, ViewMode types)
- **React 17/18/19 compatible** → Συμβατό με React 19 tech stack μας
- **Ενεργή ανάπτυξη** (τελευταίο update: 4 μήνες πριν)
- **Built-in features** (δωρεάν):
  - TaskGroup model (φάσεις → tasks)
  - Drag-and-drop (μετακίνηση/resize bars)
  - Progress bars (ποσοστό ολοκλήρωσης)
  - ViewMode enum (DAY/WEEK/MONTH/QUARTER/YEAR)
  - Today marker (κάθετη γραμμή σημερινής ημέρας)
  - Dark mode support (CSS variables)
  - Custom render props (tooltip, task, header)
  - Built-in themes (default, dark)

**ΣΗΜΑΝΤΙΚΟ - Αλλαγή βιβλιοθήκης (2026-02-07)**:
Αρχικά είχε επιλεγεί SVAR React Gantt (`wx-react-gantt`), αλλά κατά τον έλεγχο αδειών
αποδείχθηκε ότι η SVAR χρησιμοποιεί **GPLv3** (ΟΧΙ MIT όπως ανέφερε το marketing).
Η GPLv3 υποχρεώνει δημοσίευση πηγαίου κώδικα — αντίθετο με την απαίτηση του Γιώργου.

**Κρίσιμη απαίτηση Γιώργου**: Δεν θέλει να δίνει τον κώδικά του δωρεάν. Η MIT license **εγγυάται** ότι:
- Ο κώδικας της εφαρμογής παραμένει **κλειστός** (closed-source)
- Μπορεί να πουλήσει την εφαρμογή **χωρίς περιορισμούς**
- Μόνη υποχρέωση: να αναφέρουμε ότι χρησιμοποιούμε τη βιβλιοθήκη (copyright notice)

**Γιατί αποκλείστηκαν οι άλλες**:
| Library | Λόγος αποκλεισμού |
|---------|-------------------|
| SVAR React Gantt | **GPLv3 = ΑΠΟΚΛΕΙΕΤΑΙ** - υποχρεώνει ανοιχτό κώδικα (παρά το marketing "MIT") |
| gantt-task-react | Εγκαταλελειμμένη 4 χρόνια - κίνδυνος ασυμβατότητας |
| DHTMLX Gantt | **GPL = ΑΠΟΚΛΕΙΕΤΑΙ** - υποχρεώνει ανοιχτό κώδικα |
| Bryntum / Syncfusion | Commercial license - ακριβό, μη αναγκαίο |
| Custom recharts | Πολύ χρόνος development, reinventing the wheel |

### 2.3 Alternatives Considered

| Εναλλακτική | Γιατί απορρίφθηκε |
|-------------|-------------------|
| **Νέο ξεχωριστό Tab** | Κατακερματισμός UI - ο χρήστης πρέπει να ψάχνει σε 2 tabs για timeline info |
| **Αντικατάσταση Timeline Tab** | Χάνονται τα milestones/progress/forecast cards που έχουν αξία |
| **Project-level Gantt μόνο** | Ο Γιώργος ζήτησε ρητά ανά κτίριο |
| **Απλό progress bar** | Δεν δείχνει dependencies, critical path, actual vs planned |
| **SVAR React Gantt** | GPLv3 license - υποχρεώνει ανοιχτό κώδικα (αντίθετο με απαίτηση Γιώργου) |
| **gantt-task-react** | MIT αλλά εγκαταλελειμμένη 4 χρόνια - κίνδυνος ασυμβατότητας |
| **DHTMLX Gantt** | GPL license - υποχρεώνει ανοιχτό κώδικα (αντίθετο με απαίτηση Γιώργου) |
| **Bryntum / Syncfusion** | Commercial - ακριβά χωρίς λόγο όταν υπάρχει δωρεάν MIT εναλλακτική |
| **Custom με recharts** | Reinventing the wheel - υπερβολικός χρόνος development |

### 2.4 Consequences

**Θετικές**:
- Πλήρης ορατότητα κατασκευαστικής προόδου ανά κτίριο
- Dependencies visualization (ποια task μπλοκάρει ποια)
- Actual vs Planned comparison (σύγκριση πραγματικού vs σχεδιασμένου)
- Critical path identification (ποιες εργασίες καθορίζουν την ολοκλήρωση)
- Resource tracking (ποιος κάνει τι)

**Αρνητικές / Κίνδυνοι**:
- Νέα dependency: `react-modern-gantt` (mitigated: MIT license, ενεργή ανάπτυξη, lightweight)
- Νέο Firestore collection `construction_tasks` (mitigated: flat collection pattern)
- Composite indexes για efficient queries (mitigated: known pattern, ADR-073)
- Mock data αρχικά, real data σε φάση 2 (mitigated: clean separation)

---

## 3. Data Model

### 3.1 Firestore Collection: `construction_phases`

Φάσεις κατασκευής (top-level grouping) ανά κτίριο.

```typescript
interface ConstructionPhase {
  // Identity
  id: string;                              // Auto-generated
  buildingId: string;                      // FK → buildings collection
  projectId: string;                       // FK → projects collection (denormalized)

  // Phase Info
  name: string;                            // "Θεμελίωση", "Σκελετός", κλπ
  code: string;                            // "PH-001", "PH-002"
  order: number;                           // Display order (1, 2, 3...)
  type: ConstructionPhaseType;             // Enum

  // Timeline
  plannedStartDate: Timestamp;             // Σχεδιασμένη αρχή
  plannedEndDate: Timestamp;               // Σχεδιασμένο τέλος
  actualStartDate?: Timestamp;             // Πραγματική αρχή
  actualEndDate?: Timestamp;               // Πραγματικό τέλος

  // Progress
  progress: number;                        // 0-100%
  status: PhaseStatus;                     // 'not_started' | 'in_progress' | 'completed' | 'delayed' | 'blocked'

  // Metadata
  color?: string;                          // CSS color for Gantt bar
  description?: string;
  notes?: string;

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;                      // User ID
}

type ConstructionPhaseType =
  | 'preparation'        // Προετοιμασία
  | 'excavation'         // Εκσκαφή
  | 'foundation'         // Θεμελίωση
  | 'structure'          // Σκελετός
  | 'masonry'            // Τοιχοποιία
  | 'roofing'            // Στέγη
  | 'plumbing'           // Υδραυλικά
  | 'electrical'         // Ηλεκτρολογικά
  | 'hvac'               // Θέρμανση/Κλιματισμός
  | 'insulation'         // Μόνωση
  | 'plastering'         // Σοβατίσματα
  | 'flooring'           // Δάπεδα
  | 'painting'           // Βαφές
  | 'fixtures'           // Εξαρτήματα
  | 'landscaping'        // Περιβάλλων χώρος
  | 'inspection'         // Επιθεώρηση
  | 'handover'           // Παράδοση
  | 'custom';            // Προσαρμοσμένη

type PhaseStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'delayed'
  | 'blocked'
  | 'on_hold';
```

### 3.2 Firestore Collection: `construction_tasks`

Εργασίες μέσα σε κάθε φάση.

```typescript
interface ConstructionTask {
  // Identity
  id: string;                              // Auto-generated
  phaseId: string;                         // FK → construction_phases
  buildingId: string;                      // FK → buildings (denormalized)
  projectId: string;                       // FK → projects (denormalized)

  // Task Info
  name: string;                            // "Σκυροδέτηση πλάκας Β1"
  code: string;                            // "TSK-001-003"
  order: number;                           // Order within phase

  // Timeline
  plannedStartDate: Timestamp;
  plannedEndDate: Timestamp;
  actualStartDate?: Timestamp;
  actualEndDate?: Timestamp;
  duration: number;                        // Ημέρες (planned)
  actualDuration?: number;                 // Ημέρες (actual)

  // Progress
  progress: number;                        // 0-100%
  status: TaskStatus;

  // Dependencies
  dependencies: TaskDependency[];          // Ποιες tasks πρέπει να ολοκληρωθούν πρώτα

  // Assignment
  assignedTo?: string;                     // Contact ID ή company name
  assignedRole?: string;                   // 'contractor' | 'subcontractor' | 'engineer' | 'architect'

  // Gantt Display
  isMilestone: boolean;                    // true = diamond marker, false = bar
  color?: string;                          // Override phase color

  // Metadata
  description?: string;
  notes?: string;
  attachments?: string[];                  // Document/photo IDs

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy?: string;
}

type TaskStatus =
  | 'not_started'
  | 'in_progress'
  | 'completed'
  | 'delayed'
  | 'blocked'
  | 'on_hold'
  | 'cancelled';

interface TaskDependency {
  taskId: string;                          // ID of the dependency task
  type: DependencyType;                    // Τύπος εξάρτησης
}

type DependencyType =
  | 'finish_to_start'    // FS: Η task B αρχίζει αφού τελειώσει η A (πιο κοινό)
  | 'start_to_start'     // SS: Η task B αρχίζει μαζί με την A
  | 'finish_to_finish'   // FF: Η task B τελειώνει μαζί με την A
  | 'start_to_finish';   // SF: Η task B τελειώνει όταν αρχίζει η A (σπάνιο)
```

### 3.3 Firestore Collection Registration

Προσθήκη στο `src/config/firestore-collections.ts`:

```typescript
// Construction Tracking (ADR-034)
CONSTRUCTION_PHASES: 'construction_phases',
CONSTRUCTION_TASKS: 'construction_tasks',
```

### 3.4 Composite Indexes (Firestore)

```json
{
  "indexes": [
    {
      "collectionGroup": "construction_phases",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "buildingId", "order": "ASCENDING" },
        { "fieldPath": "order", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "construction_tasks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "buildingId", "order": "ASCENDING" },
        { "fieldPath": "plannedStartDate", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "construction_tasks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "phaseId", "order": "ASCENDING" },
        { "fieldPath": "order", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "construction_tasks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "buildingId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "plannedEndDate", "order": "ASCENDING" }
      ]
    }
  ]
}
```

---

## 4. UI Architecture

### 4.1 Component Tree

```
TimelineTabContent (ENHANCED)
│
├── TimelineViewToggle                          ← ΝΕΟ
│   ├── Button: "Milestones" (List icon)
│   └── Button: "Gantt" (GanttChart icon)
│
├── [view === 'milestones']
│   ├── TimelineHeader              (existing)
│   ├── OverallProgressCard         (existing)
│   ├── TimelineMilestones          (existing)
│   ├── CriticalPathCard            (existing)
│   └── CompletionForecastCard      (existing)
│
└── [view === 'gantt']
    ├── GanttToolbar                            ← ΝΕΟ
    │   ├── ZoomControls (Day/Week/Month/Quarter/Year)
    │   ├── FilterDropdown (status, phase, assignee)
    │   ├── TodayButton (scroll to today)
    │   └── ExportButton (PDF/PNG export)
    │
    ├── GanttChart                              ← ΝΕΟ
    │   ├── GanttHeader (date scale ruler)
    │   ├── GanttTaskList (left panel - task names)
    │   │   └── GanttTaskRow (per task/phase)
    │   ├── GanttTimeline (right panel - bars)
    │   │   ├── GanttPhaseBar (group bar)
    │   │   ├── GanttTaskBar (individual bar)
    │   │   ├── GanttMilestone (diamond marker)
    │   │   ├── GanttDependencyArrow (connection lines)
    │   │   └── GanttTodayLine (vertical red line)
    │   └── GanttTooltip (hover info)
    │
    └── GanttSummaryCards                       ← ΝΕΟ
        ├── OverallProgressCard (reuse existing)
        ├── DelayedTasksCard
        ├── UpcomingDeadlinesCard
        └── CriticalPathSummary
```

### 4.2 File Structure

```
src/components/building-management/tabs/TimelineTabContent/
├── index.tsx                          (existing - entry point)
├── TimelineTabContent.tsx             (existing - ENHANCED with view toggle)
├── TimelineViewToggle.tsx             ← ΝΕΟ
│
├── [Milestones View - existing]
│   ├── TimelineHeader.tsx
│   ├── TimelineMilestones.tsx
│   ├── MilestoneItem.tsx
│   ├── OverallProgressCard.tsx
│   ├── CriticalPathCard.tsx
│   ├── CompletionForecastCard.tsx
│   └── utils.ts
│
└── gantt/                             ← ΝΕΟ DIRECTORY
    ├── GanttView.tsx                  (main Gantt container)
    ├── GanttToolbar.tsx               (zoom, filters, export)
    ├── GanttChart.tsx                 (chart wrapper)
    ├── GanttSummaryCards.tsx          (stats cards)
    ├── gantt-utils.ts                 (helpers, transformers)
    ├── gantt-mock-data.ts             (mock data for Phase 1)
    └── types.ts                       (Gantt-specific types)
```

### 4.3 View Toggle Component

```typescript
// TimelineViewToggle.tsx
type TimelineView = 'milestones' | 'gantt';

interface TimelineViewToggleProps {
  activeView: TimelineView;
  onViewChange: (view: TimelineView) => void;
}
```

Χρησιμοποιεί τα υπάρχοντα Radix UI Tabs ή toggle buttons.

### 4.4 Gantt Zoom Levels

| Level | Κλίμακα | Χρήση |
|-------|---------|-------|
| **Day** | 1 day = 30px | Λεπτομερής προβολή (1-2 εβδομάδες) |
| **Week** | 1 week = 40px | Μηνιαία προβολή |
| **Month** | 1 month = 60px | Default - 6-12 μήνες |
| **Quarter** | 1 quarter = 80px | Ετήσια προβολή |
| **Year** | 1 year = 100px | Multi-year overview |

### 4.5 Color Scheme

Χρήση **design tokens** και **semantic colors** (ADR-004):

| Status | Color Token | Χρήση |
|--------|-------------|-------|
| `completed` | `colors.bg.success` / `--color-success` | Ολοκληρωμένες εργασίες |
| `in_progress` | `colors.bg.info` / `--color-info` | Τρέχουσες εργασίες |
| `not_started` | `colors.bg.muted` / `--color-muted` | Μελλοντικές εργασίες |
| `delayed` | `colors.bg.error` / `--color-destructive` | Καθυστερημένες |
| `blocked` | `colors.bg.warning` / `--color-warning` | Μπλοκαρισμένες |
| `on_hold` | `colors.bg.muted` + dashed border | Σε αναμονή |
| **Today line** | `--color-destructive` | Κόκκινη κάθετη γραμμή |
| **Phase bar** | Slightly darker variant | Group bars |

---

## 5. Integration Points

### 5.1 Existing Systems Used

| Σύστημα | Πώς χρησιμοποιείται | Αρχείο |
|---------|---------------------|--------|
| **Unified Tabs Factory** | Timeline tab config | `src/config/unified-tabs-factory.ts` |
| **Building Tabs Config** | Tab registration | `src/config/building-tabs-config.ts` |
| **Semantic Colors** | Theme-aware colors | `@/ui-adapters/react/useSemanticColors` |
| **Design Tokens** | Spacing, borders | `src/styles/design-tokens.ts` |
| **i18n System** | Μεταφράσεις EL/EN | `src/i18n/locales/{en,el}/building.json` |
| **Firestore Collections** | Collection registry | `src/config/firestore-collections.ts` |
| **ThemeProgressBar** | Progress visualization | `src/core/progress/ThemeProgressBar.tsx` |
| **ChartContainer** | Chart wrapper (αν custom) | `src/components/ui/chart/` |
| **Entity ID Generation** | Task/Phase IDs | Existing ID utils |
| **Radix Select** | Dropdowns (ADR-001) | `@/components/ui/select` |
| **Alert Engine** | Deadline notifications | `packages/core/alert-engine/` |

### 5.2 Data Flow

```
Firestore
  ├── construction_phases (query by buildingId)
  └── construction_tasks (query by buildingId)
         │
         ▼
useConstructionGantt(buildingId)     ← Custom hook
         │
         ├── phases: ConstructionPhase[]
         ├── tasks: ConstructionTask[]
         ├── ganttItems: GanttItem[]    (transformed for chart)
         ├── stats: GanttStats          (summary metrics)
         └── actions: {
         │     addTask, updateTask, deleteTask,
         │     addPhase, updatePhase, deletePhase,
         │     updateProgress, reorderTasks
         │   }
         │
         ▼
GanttView Component
         │
         ├── GanttToolbar (zoom, filter controls)
         ├── GanttChart (visualization)
         └── GanttSummaryCards (metrics)
```

### 5.3 i18n Keys (νέα)

Namespace: `building`

```json
{
  "tabs": {
    "timeline": {
      "views": {
        "milestones": "Ορόσημα",
        "gantt": "Gantt"
      },
      "gantt": {
        "title": "Διάγραμμα Gantt",
        "toolbar": {
          "zoom": "Κλίμακα",
          "day": "Ημέρα",
          "week": "Εβδομάδα",
          "month": "Μήνας",
          "quarter": "Τρίμηνο",
          "year": "Έτος",
          "today": "Σήμερα",
          "export": "Εξαγωγή",
          "filters": "Φίλτρα"
        },
        "status": {
          "notStarted": "Δεν ξεκίνησε",
          "inProgress": "Σε εξέλιξη",
          "completed": "Ολοκληρώθηκε",
          "delayed": "Καθυστερημένη",
          "blocked": "Μπλοκαρισμένη",
          "onHold": "Σε αναμονή"
        },
        "phases": {
          "preparation": "Προετοιμασία",
          "excavation": "Εκσκαφή",
          "foundation": "Θεμελίωση",
          "structure": "Σκελετός",
          "masonry": "Τοιχοποιία",
          "roofing": "Στέγη",
          "plumbing": "Υδραυλικά",
          "electrical": "Ηλεκτρολογικά",
          "hvac": "Κλιματισμός",
          "insulation": "Μόνωση",
          "plastering": "Σοβατίσματα",
          "flooring": "Δάπεδα",
          "painting": "Βαφές",
          "fixtures": "Εξαρτήματα",
          "landscaping": "Περιβάλλων χώρος",
          "inspection": "Επιθεώρηση",
          "handover": "Παράδοση"
        },
        "summary": {
          "totalTasks": "Σύνολο Εργασιών",
          "completedTasks": "Ολοκληρωμένες",
          "delayedTasks": "Καθυστερημένες",
          "overallProgress": "Συνολική Πρόοδος",
          "daysRemaining": "Υπολειπόμενες Ημέρες",
          "criticalPath": "Κρίσιμη Διαδρομή",
          "upcomingDeadlines": "Επερχόμενες Προθεσμίες"
        },
        "dependency": {
          "finishToStart": "Τέλος → Αρχή",
          "startToStart": "Αρχή → Αρχή",
          "finishToFinish": "Τέλος → Τέλος",
          "startToFinish": "Αρχή → Τέλος"
        },
        "empty": "Δεν υπάρχουν εργασίες. Προσθέστε φάσεις κατασκευής.",
        "addPhase": "Προσθήκη Φάσης",
        "addTask": "Προσθήκη Εργασίας"
      }
    }
  }
}
```

---

## 6. Implementation Plan

### Phase 1: Foundation (Mock Data + UI)

**Στόχος**: Gantt visualization με mock data, ενσωμάτωση στο Timeline Tab.

| Βήμα | Περιγραφή | Αρχεία |
|------|-----------|--------|
| 1.1 | Εγκατάσταση `react-modern-gantt` | `package.json` |
| 1.2 | TypeScript interfaces (ConstructionPhase, ConstructionTask) | `src/types/construction/` |
| 1.3 | Mock data (ρεαλιστικά construction phases) | `gantt/gantt-mock-data.ts` |
| 1.4 | TimelineViewToggle component | `TimelineViewToggle.tsx` |
| 1.5 | GanttView container | `gantt/GanttView.tsx` |
| 1.6 | GanttChart visualization | `gantt/GanttChart.tsx` |
| 1.7 | GanttToolbar (zoom levels) | `gantt/GanttToolbar.tsx` |
| 1.8 | GanttSummaryCards | `gantt/GanttSummaryCards.tsx` |
| 1.9 | i18n translations (EL/EN) | `src/i18n/locales/` |
| 1.10 | Integration στο TimelineTabContent | `TimelineTabContent.tsx` |

### Phase 2: Firestore Integration (Real Data)

**Στόχος**: Αντικατάσταση mock data με real Firestore data.

| Βήμα | Περιγραφή | Αρχεία |
|------|-----------|--------|
| 2.1 | Firestore collections registration | `firestore-collections.ts` |
| 2.2 | Firestore rules (security) | `firestore.rules` |
| 2.3 | Composite indexes deploy | `firestore.indexes.json` |
| 2.4 | `useConstructionGantt` hook | `src/hooks/useConstructionGantt.ts` |
| 2.5 | CRUD operations (add/edit/delete phases & tasks) | Hook methods |
| 2.6 | Real-time listeners | Firestore `onSnapshot` |
| 2.7 | Data migration (mock milestones → real tasks) | One-time script |

### Phase 3: Interactivity (Drag & Drop + Edit)

**Στόχος**: Full interactivity - drag bars, edit tasks, manage dependencies.

| Βήμα | Περιγραφή |
|------|-----------|
| 3.1 | Drag & drop task bars (change dates) |
| 3.2 | Resize bars (change duration) |
| 3.3 | Click to edit task (inline/modal) |
| 3.4 | Add/remove dependencies (drag arrows) |
| 3.5 | Progress slider (update % on bar) |
| 3.6 | Context menu (right-click actions) |

### Phase 4: Advanced Features

**Στόχος**: Enterprise-grade features.

| Βήμα | Περιγραφή |
|------|-----------|
| 4.1 | Critical path calculation & highlighting |
| 4.2 | Actual vs Planned overlay (dual bars) |
| 4.3 | Resource allocation view |
| 4.4 | PDF/PNG export |
| 4.5 | Alert Engine integration (deadline notifications) |
| 4.6 | AI integration (UC-017: auto-suggest delays, forecasting) |
| 4.7 | Baseline snapshots (save planned dates for comparison) |

---

## 7. Mock Data (Phase 1)

Ρεαλιστικά δεδομένα κατασκευής πολυκατοικίας:

```typescript
const MOCK_PHASES: ConstructionPhase[] = [
  { code: 'PH-001', name: 'Εκσκαφή & Θεμελίωση', type: 'foundation',
    plannedStart: '2025-03-01', plannedEnd: '2025-05-15',
    actualStart: '2025-03-10', actualEnd: '2025-05-20',
    progress: 100, status: 'completed', order: 1 },

  { code: 'PH-002', name: 'Σκελετός (Φέρων Οργανισμός)', type: 'structure',
    plannedStart: '2025-05-16', plannedEnd: '2025-09-30',
    actualStart: '2025-05-25', actualEnd: '2025-10-15',
    progress: 100, status: 'completed', order: 2 },

  { code: 'PH-003', name: 'Τοιχοποιία & Στέγη', type: 'masonry',
    plannedStart: '2025-10-01', plannedEnd: '2025-12-31',
    actualStart: '2025-10-20', progress: 75, status: 'in_progress', order: 3 },

  { code: 'PH-004', name: 'Η/Μ Εγκαταστάσεις', type: 'electrical',
    plannedStart: '2025-11-15', plannedEnd: '2026-03-15',
    progress: 30, status: 'in_progress', order: 4 },

  { code: 'PH-005', name: 'Μόνωση & Σοβατίσματα', type: 'insulation',
    plannedStart: '2026-01-15', plannedEnd: '2026-04-30',
    progress: 0, status: 'not_started', order: 5 },

  { code: 'PH-006', name: 'Δάπεδα & Βαφές', type: 'flooring',
    plannedStart: '2026-04-01', plannedEnd: '2026-06-30',
    progress: 0, status: 'not_started', order: 6 },

  { code: 'PH-007', name: 'Εξαρτήματα & Τελειώματα', type: 'fixtures',
    plannedStart: '2026-06-01', plannedEnd: '2026-08-15',
    progress: 0, status: 'not_started', order: 7 },

  { code: 'PH-008', name: 'Περιβάλλων Χώρος & Παράδοση', type: 'handover',
    plannedStart: '2026-08-01', plannedEnd: '2026-09-30',
    progress: 0, status: 'not_started', order: 8 }
];
```

---

## 8. Responsive Design

| Breakpoint | Συμπεριφορά |
|------------|-------------|
| **Desktop** (≥1024px) | Full Gantt: task list (left) + timeline (right), dual panel |
| **Tablet** (768-1023px) | Compact Gantt: collapsible task list, smaller bars |
| **Mobile** (<768px) | List view fallback: tasks ως vertical cards με progress bars (Gantt δεν λειτουργεί καλά σε μικρές οθόνες) |

---

## 9. Accessibility

| Requirement | Implementation |
|------------|----------------|
| Keyboard navigation | Arrow keys για πλοήγηση μεταξύ tasks |
| Screen reader | `aria-label` σε κάθε bar με task info |
| Color contrast | WCAG AA minimum - no color-only information |
| Focus indicators | Visible focus ring σε interactive elements |
| Alternative view | Milestones view ως accessible fallback |

---

## 10. Performance Considerations

| Concern | Mitigation |
|---------|-----------|
| Πολλά tasks (100+) | Virtualization (render only visible rows) |
| Real-time updates | Debounced Firestore listeners |
| Dependency arrows | SVG path caching, render on viewport |
| Zoom/pan | RequestAnimationFrame, throttled |
| Initial load | Skeleton loading, lazy component |
| Mobile | Fallback to list view (no Gantt rendering) |

---

## 11. Security Considerations (ref: Security Audit)

| Concern | Mitigation |
|---------|-----------|
| Data access | Firestore rules: only project members can read/write |
| Role-based editing | Only project managers can edit phases/tasks |
| Audit trail | `createdBy`, `updatedAt` fields on all documents |
| Input validation | Server-side validation on dates, progress (0-100), durations |
| Rate limiting | Firestore write limits per user |

---

## 12. Future AI Integration (UC-017)

Μελλοντική ενσωμάτωση με AI Architecture (ADR-169):

| Feature | AI Tier | Περιγραφή |
|---------|---------|-----------|
| Auto-scheduling | QUALITY | AI προτείνει βέλτιστη σειρά tasks |
| Delay prediction | FAST | Πρόβλεψη καθυστερήσεων βάσει ιστορικών δεδομένων |
| Resource optimization | QUALITY | Βέλτιστη κατανομή πόρων |
| Risk assessment | QUALITY | Εντοπισμός κινδύνων στο timeline |
| Natural language | FAST | "Δείξε μου τις καθυστερημένες εργασίες" |
| Photo progress | VISION | Αυτόματη εκτίμηση % από φωτογραφίες εργοταξίου |

---

## 13. Decision Log

| # | Ερώτημα | Απόφαση | Status |
|---|---------|---------|--------|
| D-001 | Πού θα εμφανίζεται το Gantt; | Μέσα στο Timeline Tab (Tab 3) ως sub-view | **DECIDED** |
| D-002 | Ανά project ή ανά building; | Ανά building (ξεχωριστό Gantt per building) | **DECIDED** |
| D-003 | Ποια library; | **react-modern-gantt** (npm) - MIT license, Native TypeScript, React 17/18/19, ενεργή ανάπτυξη | **DECIDED** |
| D-004 | Mock data πρώτα ή real data; | Phase 1: Mock data, Phase 2: Real Firestore | **DECIDED** |
| D-005 | Νέα Firestore collections; | construction_phases + construction_tasks (flat) | **DECIDED** |

---

## Appendix A: Related Files

| Αρχείο | Ρόλος | Αλλαγή |
|--------|-------|--------|
| `src/components/building-management/tabs/TimelineTabContent.tsx` | Timeline container | ENHANCE (add view toggle) |
| `src/components/building-management/tabs/TimelineTabContent/` | Timeline directory | ADD gantt/ subdirectory |
| `src/config/building-tabs-config.ts` | Tab configuration | NO CHANGE (tab exists) |
| `src/config/firestore-collections.ts` | Collection registry | ADD 2 collections |
| `src/i18n/locales/el/building.json` | Greek translations | ADD gantt keys |
| `src/i18n/locales/en/building.json` | English translations | ADD gantt keys |
| `src/types/construction/` | TypeScript types | NEW directory |
| `firestore.indexes.json` | Composite indexes | ADD 4 indexes |
| `package.json` | Dependencies | ADD `react-modern-gantt` (MIT) |

## Appendix B: Technology Sources

- [react-modern-gantt (npm)](https://www.npmjs.com/package/react-modern-gantt) - MIT, React 17/18/19, TypeScript - **ΕΠΙΛΕΧΘΗΚΕ**
- [react-modern-gantt (GitHub)](https://github.com/NillsvanLimworwortel/react-modern-gantt) - Source code
- [SVAR React Gantt](https://svar.dev/react/gantt/) - **ΑΠΟΚΛΕΙΣΤΗΚΕ** (GPLv3 αντί MIT)
- [Best JavaScript Gantt Chart Libraries Guide](https://www.anychart.com/blog/2025/11/05/best-javascript-gantt-chart-libraries/)

## Appendix C: License Compliance

### MIT License - Τι σημαίνει για εμάς

**Δικαιώματα** (μπορούμε):
- Να χρησιμοποιούμε τη βιβλιοθήκη σε commercial εφαρμογή
- Να πουλάμε την εφαρμογή χωρίς περιορισμούς
- Να κρατάμε τον δικό μας κώδικα **κλειστό** (closed-source)
- Να τροποποιούμε τη βιβλιοθήκη αν χρειαστεί

**Υποχρεώσεις** (πρέπει):
- Να διατηρούμε το MIT copyright notice στο package (αυτόματο μέσω npm)
- Τίποτα άλλο

**Σημαντική σημείωση**: Η MIT license **ΔΕΝ** απαιτεί:
- Δημοσίευση του δικού μας κώδικα
- Αναφορά στη βιβλιοθήκη στο UI
- Πληρωμή royalties
- Attribution στο frontend (μόνο στο source code)
