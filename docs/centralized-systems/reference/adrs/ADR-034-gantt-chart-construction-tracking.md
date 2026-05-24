# ADR-034: Gantt Chart - Construction Phase Tracking

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED - Phase 1+2+3+4 Complete (4.1+4.2+4.3+4.4+4.5+4.6+4.7+4.8+4.9 ALL DONE) |
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

## 3. Data Model (IMPLEMENTED 2026-02-07)

### 3.1 Firestore Collection: `construction_phases`

Φάσεις κατασκευής (top-level grouping) ανά κτίριο.

**TypeScript SSoT**: `src/types/building/construction.ts`

```typescript
export type ConstructionPhaseStatus =
  | 'planning'
  | 'inProgress'
  | 'completed'
  | 'delayed'
  | 'blocked';

export interface ConstructionPhase {
  id: string;
  buildingId: string;
  companyId: string;                       // Tenant isolation
  name: string;                            // "Θεμελίωση", "Σκελετός", κλπ
  code: string;                            // "PH-001", "PH-002" (auto-generated)
  order: number;                           // Sort order within building
  status: ConstructionPhaseStatus;
  plannedStartDate: string;                // ISO 8601
  plannedEndDate: string;                  // ISO 8601
  actualStartDate?: string;
  actualEndDate?: string;
  progress: number;                        // 0-100
  description?: string;
  createdAt?: string;                      // FieldValue.serverTimestamp() → ISO
  updatedAt?: string;
  createdBy?: string;                      // User ID (ctx.uid)
  updatedBy?: string;
}
```

### 3.2 Firestore Collection: `construction_tasks`

Εργασίες μέσα σε κάθε φάση.

```typescript
export type ConstructionTaskStatus =
  | 'notStarted'
  | 'inProgress'
  | 'completed'
  | 'delayed'
  | 'blocked';

export interface ConstructionTask {
  id: string;
  phaseId: string;                         // FK → construction_phases
  buildingId: string;                      // FK → buildings (denormalized)
  companyId: string;                       // Tenant isolation
  name: string;                            // "Σκυροδέτηση πλάκας Β1"
  code: string;                            // "TSK-001" (auto-generated)
  order: number;                           // Sort order within phase
  status: ConstructionTaskStatus;
  plannedStartDate: string;                // ISO 8601
  plannedEndDate: string;                  // ISO 8601
  actualStartDate?: string;
  actualEndDate?: string;
  progress: number;                        // 0-100
  dependencies?: string[];                 // Array of task IDs (simple string[])
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}
```

### 3.3 API Payload Types

```typescript
// Create payloads — minimal required fields, server auto-generates code/order
export interface ConstructionPhaseCreatePayload {
  name: string;
  code?: string;
  order?: number;
  status?: ConstructionPhaseStatus;
  plannedStartDate: string;
  plannedEndDate: string;
  description?: string;
}

export interface ConstructionTaskCreatePayload {
  phaseId: string;
  name: string;
  code?: string;
  order?: number;
  status?: ConstructionTaskStatus;
  plannedStartDate: string;
  plannedEndDate: string;
  dependencies?: string[];
  description?: string;
}

// Update payloads — all fields optional, server validates allowed fields
export interface ConstructionPhaseUpdatePayload {
  name?: string; code?: string; order?: number;
  status?: ConstructionPhaseStatus;
  plannedStartDate?: string; plannedEndDate?: string;
  actualStartDate?: string | null; actualEndDate?: string | null;
  progress?: number; description?: string;
}

export interface ConstructionTaskUpdatePayload {
  name?: string; code?: string; order?: number;
  status?: ConstructionTaskStatus;
  plannedStartDate?: string; plannedEndDate?: string;
  actualStartDate?: string | null; actualEndDate?: string | null;
  progress?: number; dependencies?: string[]; description?: string;
}
```

### 3.4 Firestore Collection Registration

Αρχείο: `src/config/firestore-collections.ts`

```typescript
// 🏗️ CONSTRUCTION PHASES & TASKS (ADR-034: Gantt Chart)
CONSTRUCTION_PHASES: process.env.NEXT_PUBLIC_CONSTRUCTION_PHASES_COLLECTION || 'construction_phases',
CONSTRUCTION_TASKS: process.env.NEXT_PUBLIC_CONSTRUCTION_TASKS_COLLECTION || 'construction_tasks',
```

### 3.5 Composite Indexes (Firestore)

Απαιτούνται 2 composite indexes (auto-created on first query ή via `firebase deploy`):

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
        { "fieldPath": "order", "order": "ASCENDING" }
      ]
    }
  ]
}
```

### 3.6 Design Decision Notes

| Αρχική πρόταση (ADR draft) | Τελική υλοποίηση | Λόγος |
|----------------------------|-------------------|-------|
| `projectId` field | Αφαιρέθηκε | Το building ανήκει ήδη σε project — δεν χρειάζεται denormalization |
| `ConstructionPhaseType` enum | Αφαιρέθηκε | Free-text `name` field — πιο ευέλικτο |
| `TaskDependency` complex type | `string[]` | Απλούστερο — αρκεί array task IDs |
| `duration`, `actualDuration` | Αφαιρέθηκαν | Υπολογίζονται client-side από dates |
| `assignedTo`, `assignedRole` | Αφαιρέθηκαν | Phase 4 feature (future) |
| `isMilestone`, `color` | Αφαιρέθηκαν | Δεν υποστηρίζεται από react-modern-gantt |
| `notes`, `attachments` | Αφαιρέθηκαν | Phase 4 feature (future) |
| Timestamps as `Timestamp` | ISO 8601 strings | API transport-friendly, converted on read |
| `on_hold`, `cancelled` statuses | Αφαιρέθηκαν | Simplified MVP status set |

---

## 4. UI Architecture (IMPLEMENTED 2026-02-07)

### 4.1 Component Tree (Actual)

```
TimelineTabContent (existing - manages milestones/gantt toggle)
│
├── ViewToggle [Ορόσημα | Gantt]  (existing toggle buttons)
│
├── [view === 'milestones']
│   ├── TimelineHeader              (existing)
│   ├── OverallProgressCard         (existing)
│   ├── TimelineMilestones          (existing)
│   ├── CriticalPathCard            (existing)
│   └── CompletionForecastCard      (existing)
│
└── [view === 'gantt']
    └── GanttView                                ← MAIN COMPONENT
        ├── Toolbar                              (New Phase / New Task buttons)
        ├── SummaryCards                          (4 stat cards: total, completed, delayed, progress)
        ├── GanttChart (react-modern-gantt)       (interactive Gantt visualization)
        │   ├── editMode=true
        │   ├── allowProgressEdit=true
        │   ├── allowTaskResize=true
        │   ├── allowTaskMove=true
        │   ├── onTaskUpdate → handleTaskUpdate   (drag/resize → API update)
        │   ├── onTaskClick → handleTaskClick     (click → edit dialog)
        │   └── onGroupClick → handleGroupClick   (click phase → edit dialog)
        ├── StatusLegend                          (5 status badges)
        └── ConstructionPhaseDialog               (create/edit phase or task)
```

### 4.2 File Structure (Actual)

```
src/types/building/
└── construction.ts                    ← TypeScript types SSoT

src/config/
└── firestore-collections.ts          ← +2 collections (CONSTRUCTION_PHASES, CONSTRUCTION_TASKS)

src/app/api/buildings/[buildingId]/
└── construction-phases/
    └── route.ts                       ← Full CRUD API (GET/POST/PATCH/DELETE)

src/components/building-management/
├── construction-services.ts           ← Client CRUD services (apiClient)
├── hooks/
│   └── useConstructionGantt.ts        ← Data hook (load, transform, CRUD, dialog state)
├── dialogs/
│   └── ConstructionPhaseDialog.tsx    ← Phase/Task create/edit dialog
└── tabs/TimelineTabContent/
    ├── TimelineTabContent.tsx         (existing - passes building to GanttView)
    └── gantt/
        ├── GanttView.tsx              ← Main Gantt container (REWRITTEN)
        └── gantt-mock-data.ts         (retained: calculateGanttStats, GanttTaskStatus reused)

src/i18n/locales/
├── el/building.json                   ← +dialog/action/validation keys
└── en/building.json                   ← +dialog/action/validation keys
```

### 4.3 View Modes (react-modern-gantt)

Υποστηρίζονται 5 zoom levels μέσω `ViewMode` enum:

| Level | Enum | Default |
|-------|------|---------|
| **Day** | `ViewMode.DAY` | |
| **Week** | `ViewMode.WEEK` | |
| **Month** | `ViewMode.MONTH` | **DEFAULT** |
| **Quarter** | `ViewMode.QUARTER` | |
| **Year** | `ViewMode.YEAR` | |

### 4.4 Color Scheme (Actual — CSS Variables)

Χρήση **CSS custom properties** για theme-aware Gantt bar colors:

```typescript
const STATUS_TO_CSS_COLOR: Record<GanttTaskStatus, string> = {
  completed:  'hsl(var(--bg-success))',
  inProgress: 'hsl(var(--bg-info))',
  notStarted: 'hsl(var(--muted-foreground))',
  delayed:    'hsl(var(--destructive))',
  blocked:    'hsl(var(--bg-warning))',
};
```

Dynamic color resolver via `getTaskColor` prop που διαβάζει `taskStatus` metadata από κάθε task.

---

## 5. Integration Points (IMPLEMENTED 2026-02-07)

### 5.1 Centralized Systems Used

| Σύστημα | Πώς χρησιμοποιείται | Αρχείο |
|---------|---------------------|--------|
| **apiClient** | HTTP CRUD calls (Bearer token auto-inject) | `src/lib/api/enterprise-api-client.ts` |
| **withAuth** | API auth + tenant context | `src/lib/auth` |
| **withStandardRateLimit** | API rate limiting | `src/lib/middleware/with-rate-limit.ts` |
| **ApiError** | Typed error responses | `src/lib/api/ApiErrorHandler.ts` |
| **getAdminFirestore** | Server-side Firestore writes | `src/lib/firebaseAdmin.ts` |
| **requireBuildingInTenant** | Tenant isolation check | `src/lib/auth` |
| **logAuditEvent** | Audit trail logging | `src/lib/auth` |
| **COLLECTIONS** | Collection name registry | `src/config/firestore-collections.ts` |
| **FieldValue.serverTimestamp** | Audit timestamps | `firebase-admin/firestore` |
| **Design Tokens** | `useSpacingTokens()`, `useIconSizes()` | `src/hooks/` |
| **i18n System** | `useTranslation('building')` | `src/i18n/locales/{en,el}/building.json` |
| **Radix Select** | Status dropdown (ADR-001) | `@/components/ui/select` |
| **FormGrid/FormField** | Dialog form layout | `@/components/ui/form` |
| **SaveButton/CancelButton/DeleteButton** | Action buttons | `@/components/ui/form/ActionButtons` |
| **getStatusColor** | Status badge colors | `@/lib/design-system` |
| **cn()** | Class name utility | `@/lib/utils` |
| **Card, Badge, Button** | UI primitives | `@/components/ui` |

### 5.2 Data Flow (Actual)

```
Browser (GanttView)
         │
         ▼
useConstructionGantt(buildingId)         ← Custom hook
         │
         ├── Calls construction-services.ts (apiClient)
         │         │
         │         ▼
         │   /api/buildings/[buildingId]/construction-phases
         │         │
         │         ├── withStandardRateLimit
         │         ├── withAuth (Bearer token → AuthContext)
         │         ├── requireBuildingInTenant (tenant isolation)
         │         └── getAdminFirestore() → Firestore Admin SDK
         │               ├── construction_phases (where buildingId == X, orderBy order)
         │               └── construction_tasks   (where buildingId == X, orderBy order)
         │
         ├── Transforms → TaskGroup[] (react-modern-gantt format)
         ├── Calculates stats (calculateGanttStats)
         ├── Manages dialog state (open/close/mode)
         │
         ▼
GanttView Component
         │
         ├── Toolbar (Νέα Φάση, Νέα Εργασία buttons)
         ├── Summary Cards (4 stat cards)
         ├── GanttChart (react-modern-gantt)
         │     ├── Drag/Resize → handleTaskUpdate → optimistic update + API PATCH
         │     ├── Click Task → handleTaskClick → openEditTaskDialog
         │     └── Click Phase → handleGroupClick → openEditPhaseDialog
         ├── Status Legend (5 badges)
         └── ConstructionPhaseDialog
               ├── Create/Edit Phase → savePhase/updatePhase → API POST/PATCH
               ├── Create/Edit Task → saveTask/updateTask → API POST/PATCH
               └── Delete → removePhase/removeTask → API DELETE (query params)
```

### 5.3 API Endpoint Details

**Endpoint**: `GET/POST/PATCH/DELETE /api/buildings/[buildingId]/construction-phases`

| Method | Action | Body/Params | Response |
|--------|--------|-------------|----------|
| **GET** | Load phases + tasks | — | `{ success, phases[], tasks[], buildingId }` |
| **POST** | Create phase or task | `{ type, name, plannedStartDate, plannedEndDate, ... }` | `{ success, id, type }` |
| **PATCH** | Update phase or task | `{ type, id, updates: {...} }` | `{ success, id, type }` |
| **DELETE** | Delete phase or task | Query params: `?type=phase&id=xxx` | `{ success, id, type, cascadedTasks? }` |

**Cascade Delete**: Deleting a phase automatically deletes all its tasks (batch operation).

**Auto-generated codes**: `PH-001`, `PH-002`, ... / `TSK-001`, `TSK-002`, ...

### 5.4 i18n Keys (Implemented)

Namespace: `building` → `tabs.timeline.gantt`

```
tabs.timeline.gantt.empty              → "Δεν υπάρχουν φάσεις κατασκευής."
tabs.timeline.gantt.emptyHint          → "Ξεκινήστε προσθέτοντας μια νέα φάση."
tabs.timeline.gantt.actions.newPhase   → "Νέα Φάση"
tabs.timeline.gantt.actions.newTask    → "Νέα Εργασία"
tabs.timeline.gantt.dialog.createPhase → "Νέα Κατασκευαστική Φάση"
tabs.timeline.gantt.dialog.editPhase   → "Επεξεργασία Φάσης"
tabs.timeline.gantt.dialog.createTask  → "Νέα Εργασία"
tabs.timeline.gantt.dialog.editTask    → "Επεξεργασία Εργασίας"
tabs.timeline.gantt.dialog.name        → "Όνομα"
tabs.timeline.gantt.dialog.code        → "Κωδικός"
tabs.timeline.gantt.dialog.status      → "Κατάσταση"
tabs.timeline.gantt.dialog.startDate   → "Ημ. Έναρξης"
tabs.timeline.gantt.dialog.endDate     → "Ημ. Λήξης"
tabs.timeline.gantt.dialog.progress    → "Πρόοδος"
tabs.timeline.gantt.dialog.description → "Περιγραφή"
tabs.timeline.gantt.validation.*       → Validation messages

// Export keys (Phase 4.4)
tabs.timeline.gantt.export.export      → "Εξαγωγή" / "Export"
tabs.timeline.gantt.export.pdf         → "PDF (Έγγραφο)" / "PDF (Document)"
tabs.timeline.gantt.export.png         → "PNG (Εικόνα)" / "PNG (Image)"
tabs.timeline.gantt.export.svg         → "SVG (Διάνυσμα)" / "SVG (Vector)"
tabs.timeline.gantt.export.excel       → "Excel (Δεδομένα)" / "Excel (Data)"
tabs.timeline.gantt.export.exporting   → "Εξαγωγή..." / "Exporting..."
tabs.timeline.gantt.export.success     → "Η εξαγωγή ολοκληρώθηκε" / "Export completed"
tabs.timeline.gantt.export.error       → "Σφάλμα εξαγωγής" / "Export error"
```

---

## 6. Implementation Record

### Phase 1: Foundation (Mock Data + UI) — COMPLETED (2026-02-07)

**Στόχος**: Gantt visualization με mock data, ενσωμάτωση στο Timeline Tab.

| Βήμα | Περιγραφή | Αρχεία | Status |
|------|-----------|--------|--------|
| 1.1 | Εγκατάσταση `react-modern-gantt` v0.6.1 (MIT) | `package.json` | **DONE** |
| 1.2 | Mock data (8 φάσεις, 28 εργασίες) | `gantt/gantt-mock-data.ts` | **DONE** |
| 1.3 | ViewToggle (Ορόσημα / Gantt) στο TimelineTabContent | `TimelineTabContent.tsx` | **DONE** |
| 1.4 | GanttView container με summary cards + legend | `gantt/GanttView.tsx` | **DONE** |
| 1.5 | i18n translations (EL/EN) — base keys | `building.json` | **DONE** |

### Phase 2: Firestore Integration — COMPLETED (2026-02-07)

**Στόχος**: Αντικατάσταση mock data με real Firestore CRUD.

| Βήμα | Περιγραφή | Αρχεία | Status |
|------|-----------|--------|--------|
| 2.1 | TypeScript types SSoT | `src/types/building/construction.ts` | **DONE** |
| 2.2 | Firestore collections registration (+2) | `src/config/firestore-collections.ts` | **DONE** |
| 2.3 | Full CRUD API endpoint (GET/POST/PATCH/DELETE) | `src/app/api/buildings/[buildingId]/construction-phases/route.ts` | **DONE** |
| 2.4 | Client CRUD services (apiClient) | `src/components/building-management/construction-services.ts` | **DONE** |
| 2.5 | `useConstructionGantt` data hook | `src/components/building-management/hooks/useConstructionGantt.ts` | **DONE** |
| 2.6 | GanttView rewrite (Firestore data, loading/empty states) | `gantt/GanttView.tsx` | **DONE** |

### Phase 3: Interactivity (Edit + Drag & Drop) — COMPLETED (2026-02-07)

**Στόχος**: Full interactivity - drag bars, edit tasks, create/delete.

| Βήμα | Περιγραφή | Αρχεία | Status |
|------|-----------|--------|--------|
| 3.1 | ConstructionPhaseDialog (create/edit phase & task) | `dialogs/ConstructionPhaseDialog.tsx` | **DONE** |
| 3.2 | Enable `editMode`, `allowProgressEdit`, `allowTaskResize`, `allowTaskMove` | `GanttView.tsx` | **DONE** |
| 3.3 | Drag & drop task bars → API date update (optimistic) | `useConstructionGantt.ts` | **DONE** |
| 3.4 | Click task → edit dialog | `handleTaskClick` | **DONE** |
| 3.5 | Click phase → edit dialog | `handleGroupClick` | **DONE** |
| 3.6 | Progress slider (0-100%) in dialog | `ConstructionPhaseDialog.tsx` | **DONE** |
| 3.7 | Cascade delete (phase → all tasks) | `route.ts DELETE` | **DONE** |
| 3.8 | i18n: dialog/action/validation keys (EL/EN) | `building.json` | **DONE** |

### Phase 4: Advanced Features — PARTIAL (In Progress)

**Στόχος**: Enterprise-grade features.

| Βήμα | Περιγραφή | Status |
|------|-----------|--------|
| 4.1 | Critical path calculation & highlighting | **DONE** (2026-03-28 — ADR-266 Phase C.2) |
| 4.2 | Actual vs Planned overlay (dual bars) | **DONE** (2026-03-28 — ADR-266 Phase A: ScheduleVarianceTable) |
| 4.3 | Resource allocation (assignedTo, assignedRole) | **DONE** (2026-03-29 — ADR-266 Phase C.4: ResourceHistogramChart) |
| 4.4 | **Export: PDF, PNG, SVG, Excel** | **DONE** (2026-02-07) |
| 4.5 | Alert Engine integration (deadline notifications) | ✅ DONE 2026-05-21 → ADR-266 Phase D.3+D.5 (7 alert rules, `construction_alerts`, API, dashboard banner, Telegram, Portfolio) |
| 4.6 | AI integration (UC-017: auto-suggest delays, forecasting) | PLANNED → ADR-034 §12 (no implementation) |
| 4.7 | Baseline snapshots (save planned dates for comparison) | **DONE** (2026-03-28 — ADR-266 Phase C.3: BaselineSection + `construction_baselines`) |
| 4.8 | Dependency arrows visualization | **DONE** (2026-05-21 — SVG bezier overlay via portal) |
| 4.9 | **Context menu (right-click actions)** | **DONE** (2026-02-07) |

#### ⚠️ ADR-266 Cross-Reference (2026-05-21)

Phases 4.1, 4.2, 4.3, 4.7 υλοποιήθηκαν μέσω **ADR-266 (Gantt & Construction Schedule Reports)**, όχι απευθείας εδώ.

| ADR-034 Phase | ADR-266 Phase | Key Files |
|---|---|---|
| 4.1 Critical Path | ADR-266 Phase C.2 | `src/hooks/useCriticalPath.ts`, `src/services/construction-scheduling/cpm-calculator.ts`, `src/components/.../dashboard/CriticalPathSection.tsx` |
| 4.2 Actual vs Planned | ADR-266 Phase A | `src/components/.../dashboard/ScheduleVarianceTable.tsx`, `useBaselineComparison.ts` |
| 4.3 Resource Allocation | ADR-266 Phase C.4 | `src/services/construction-scheduling/resource-assignment.service.ts`, `ResourceHistogramChart.tsx`, `useResourceHistogram.ts` |
| 4.7 Baseline Snapshots | ADR-266 Phase C.3 | `src/components/.../dashboard/BaselineSection.tsx`, Firestore: `construction_baselines` |

**ADR-266 επίσης προσθέτει** Dashboard view (3rd toggle button) με S-Curve, KPIs, Lookahead Table, DelayBreakdown, Resource Histogram, Owner Report PDF export.

---

#### 4.4 Export Feature — Implementation Details (2026-02-07)

**4 formats υποστηρίζονται:**

| Format | Library | Περιγραφή |
|--------|---------|-----------|
| **PDF** | `jspdf` + `jspdf-autotable` (existing) | Landscape A4: Page 1 = chart screenshot, Page 2+ = data table |
| **PNG** | `html-to-image` (νέο, MIT) | High-DPI raster capture (2x pixel ratio) |
| **SVG** | `html-to-image` (νέο, MIT) | Vector format, scalable/editable |
| **Excel** | `exceljs` (νέο, MIT) | 2 sheets: Timeline (styled data) + Summary (stats) |

**Αρχιτεκτονική Export**:

```
GanttView (toolbar)
├── DropdownMenu (Εξαγωγή button)
│   ├── PDF → exportGanttToPDF()
│   ├── PNG → exportGanttAsImage('png')
│   ├── SVG → exportGanttAsImage('svg')
│   └── Excel → exportGanttToExcel()
│
├── gantt-export-utils.ts (shared)
│   ├── captureGanttAsDataUrl() — DOM capture with overflow expansion
│   ├── flattenTaskGroupsToRows() — TaskGroup[] → flat data rows
│   └── triggerDownload() / triggerBlobDownload()
│
├── gantt-pdf-exporter.ts
│   ├── registerGreekFont() — Roboto + Identity-H encoding
│   └── exportGanttToPDF() — chart image + autoTable
│
├── gantt-image-exporter.ts
│   └── exportGanttAsImage() — PNG/SVG via html-to-image
│
├── gantt-excel-exporter.ts
│   └── exportGanttToExcel() — ExcelJS workbook (2 sheets)
│
└── roboto-font-data.ts (lazy-loaded ~687KB base64)
```

**DOM Capture Strategy**: Η `react-modern-gantt` χρησιμοποιεί `overflow-x: auto` στον `.rmg-timeline-container`. Κατά το capture, γίνεται temporary expansion (`overflow: visible`, `width: auto`) ώστε να αποτυπωθεί ΟΛΟΚΛΗΡΟ το timeline, ακόμα και αν scrolls.

**Greek Font Solution (PDF)**: Η default Helvetica του jsPDF υποστηρίζει μόνο Latin. Λύση:
1. Embedded Roboto-Regular.ttf ως base64 (pre-computed, lazy dynamic import)
2. `addFont()` με **Identity-H encoding** (κρίσιμο για Unicode/Greek)
3. Καταχώρηση font και ως `normal` και ως `bold` (autoTable χρησιμοποιεί bold για headers)
4. `didParseCell` hook forces Roboto σε κάθε κελί

#### 4.8 Dependency Arrows — Implementation Details (2026-05-21)

SVG bezier overlay που εμφανίζει Finish-to-Start dependency arrows μεταξύ tasks.

**Αρχεία:**

| Αρχείο | Ρόλος |
|--------|-------|
| `gantt/hooks/useGanttDependencyArrows.ts` | Υπολογισμός bezier paths από DOM. RAF-throttled ResizeObserver + scroll + MutationObserver |
| `gantt/GanttDependencyArrows.tsx` | SVG overlay component, portal into `.rmg-timeline-container` |
| `gantt/GanttView.tsx` | Mount point — renders `<GanttDependencyArrows>` inside ganttChartRef |

**Τεχνική Αρχιτεκτονική:**

```
.rmg-timeline-container (position: relative, overflow-x: auto)
  ├── .rmg-timeline → .rmg-timeline-grid → .rmg-task-row → .rmg-task-item[data-task-id]
  └── <svg> [portal] (position: absolute, top:0, left:0, pointer-events: none)
        └── <path> bezier Finish-to-Start per dependency pair
```

**Position computation:**
- x: `parseFloat(el.style.left)` + `parseFloat(el.style.width)` — βρίσκει right/left edge bar (pixels, σε content coordinate space)
- y: `el.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop + el.offsetHeight / 2` — handles overlap rows automatically

**Arrow shape:** Cubic bezier `M x1 y1 C (x1+cp) y1 (x2-cp) y2 x2 y2` όπου `cp = max(40, |dx| × 0.4)`.

**Re-trigger events:** ResizeObserver (container resize) + scroll event + MutationObserver on `style` attributes (drag/resize). Throttled via `requestAnimationFrame`.

**Styling:** `currentColor` + `hsl(var(--muted-foreground))` — theme-aware (light/dark). `strokeDasharray="5 3"` για visual distinction από bars. `strokeOpacity=0.55`.

**Fullscreen:** Arrows render in normal view. Fullscreen GanttChart (FullscreenOverlay) does not have dependency arrows in this phase — acceptable for Phase 4.8.

#### 4.8 Dependency UI — Task Form Multi-Select (2026-05-21)

`ConstructionPhaseDialog` task tab έχει "Εξαρτάται από" `MultiCombobox` field — επιλογή N task IDs από tasks του ίδιου building (εκτός του τρέχοντος).

**Αρχεία:**

| Αρχείο | Αλλαγή |
|--------|--------|
| `dialogs/ConstructionPhaseDialog.tsx` | `dependencies` state + `MultiCombobox` field + payload wire-up |
| `dialogs/construction-dialog.types.ts` | `tasks?: ConstructionTask[]` prop + `dependencies?: string[]` σε `TaskFormData` |
| `gantt/GanttView.tsx` | `tasks={tasks}` prop πάει στο dialog |
| `i18n/locales/el/building-timeline.json` | `dependsOn`, `dependsOnPlaceholder`, `dependsOnSearch`, `dependsOnEmpty` |
| `i18n/locales/en/building-timeline.json` | Αντίστοιχα EN keys |

**Data flow:** `tasks` prop (από `useConstructionGantt`) → φιλτράρονται (εκτός τρέχοντος task) → `MultiComboboxOption[]` → UI. Save/update περνούν `dependencies: string[]` στα `ConstructionTaskCreatePayload` / `Record<string, unknown>` (CRUD χειρίζεται ήδη).

---

#### 4.9 Context Menu — Implementation Details (2026-02-07)

Right-click σε task/phase bars εμφανίζει context menu με:
- Επεξεργασία (edit dialog)
- Αλλαγή κατάστασης (status submenu)
- Αλλαγή χρώματος (color picker — 10 predefined + custom)
- Διαγραφή (with confirmation)

Custom color picker με ColorPicker component (inline, no external dependency).

### Changelog

| Ημερομηνία | Αλλαγή |
|------------|--------|
| 2026-02-07 | Initial implementation: Phase 1+2+3 + Phase 4.4 (Export) + Phase 4.9 (Context Menu) |
| 2026-03-28 | ADR-266 Phase A+B+C.1-5 implemented: 4.1/4.2/4.3/4.7 now DONE (via ADR-266). Status updated. |
| 2026-05-21 | ADR-034 reconciliation: synced Phase 4 table with actual code reality. Cross-ref to ADR-266 added. |
| 2026-05-21 | Phase 4.8 DONE: dependency arrows SVG overlay. `GanttDependencyArrows.tsx` + `useGanttDependencyArrows.ts`. Portal into `.rmg-timeline-container`, RAF-throttled, theme-aware. |
| 2026-05-21 | Phase 4.8 UI: dependency multi-select στο `ConstructionPhaseDialog` task tab. `MultiCombobox`, `tasks` prop, i18n keys. |
| 2026-05-22 | Phase 4.5 status sync: ADR-266 Phase D.3+D.5 είχε ολοκληρωθεί 2026-05-21 (alert rules engine + Portfolio Dashboard) αλλά ADR-034 παρέμεινε stale. Status line + Phase 4 table ενημερώθηκαν. |
| 2026-05-23 | Phase 4.6 DONE: UC-017 Gantt AI module. 6 features (FAST: delay_prediction + natural_language, QUALITY: risk_assessment + auto_scheduling + resource_optimization, VISION: photo_progress). Files: `src/services/ai-pipeline/modules/uc-017-gantt-ai/` (11 source files + 4 test files, 41 tests). New intent `ADMIN_GANTT_AI` added to `PipelineIntentType`. Module registered in `register-modules.ts`. |

---

### Implementation Summary

| Metric | Value |
|--------|-------|
| **Ημερομηνία υλοποίησης** | 2026-02-07 |
| **Νέα αρχεία** | 13 (types, API route, services, hook, dialog, 7 export files, font) |
| **Τροποποιημένα αρχεία** | 4 (GanttView, firestore-collections, building.json el/en) |
| **TypeScript errors** | 0 (verified with `npx tsc --noEmit`) |
| **API Security** | withAuth + withStandardRateLimit + requireBuildingInTenant + logAuditEvent |
| **Tenant Isolation** | companyId check on all operations |
| **Cascade Delete** | Phase deletion removes all child tasks (batch) |
| **Export Formats** | PDF, PNG, SVG, Excel (4 formats) |
| **Greek Font Support** | Roboto + Identity-H encoding (embedded base64) |

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

## Appendix A: Related Files (Actual Implementation)

### New Files Created (2026-02-07)

| Αρχείο | Ρόλος | Lines |
|--------|-------|-------|
| `src/types/building/construction.ts` | TypeScript types SSoT | ~127 |
| `src/app/api/buildings/[buildingId]/construction-phases/route.ts` | Full CRUD API endpoint | ~447 |
| `src/components/building-management/construction-services.ts` | Client CRUD services | ~201 |
| `src/components/building-management/hooks/useConstructionGantt.ts` | Data hook + dialog state | ~350+ |
| `src/components/building-management/dialogs/ConstructionPhaseDialog.tsx` | Phase/Task create/edit dialog | ~400+ |
| `src/services/gantt-export/types.ts` | Export types & interfaces | ~30 |
| `src/services/gantt-export/gantt-export-utils.ts` | DOM capture, data flattening, download helpers | ~100+ |
| `src/services/gantt-export/gantt-pdf-exporter.ts` | PDF export (chart image + autoTable) | ~110 |
| `src/services/gantt-export/gantt-image-exporter.ts` | PNG & SVG export | ~25 |
| `src/services/gantt-export/gantt-excel-exporter.ts` | Excel export (2 sheets) | ~120+ |
| `src/services/gantt-export/roboto-font-data.ts` | Pre-computed Roboto base64 (~687KB) | ~1 |
| `src/services/gantt-export/index.ts` | Barrel export | ~10 |
| `public/fonts/Roboto-Regular.ttf` | Roboto font file (Greek + Latin) | 515KB |

### Modified Files

| Αρχείο | Αλλαγή |
|--------|--------|
| `src/components/building-management/tabs/TimelineTabContent/gantt/GanttView.tsx` | REWRITTEN (mock → Firestore, editing, export, context menu) |
| `src/config/firestore-collections.ts` | +2 collections (CONSTRUCTION_PHASES, CONSTRUCTION_TASKS) |
| `src/i18n/locales/el/building.json` | +dialog/action/validation/export keys |
| `src/i18n/locales/en/building.json` | +dialog/action/validation/export keys |

### Existing Files (No Changes Needed)

| Αρχείο | Λόγος |
|--------|-------|
| `src/components/building-management/tabs/TimelineTabContent.tsx` | Already passes `building` prop to lazy-loaded GanttView |
| `gantt/gantt-mock-data.ts` | Retained — `calculateGanttStats()` and `GanttTaskStatus` reused by hook |
| `package.json` | `react-modern-gantt` v0.6.1 already installed (Phase 1) |

## Appendix B: Technology Sources

### Core Library
- [react-modern-gantt (npm)](https://www.npmjs.com/package/react-modern-gantt) - MIT, React 17/18/19, TypeScript - **ΕΠΙΛΕΧΘΗΚΕ**
- [react-modern-gantt (GitHub)](https://github.com/NillsvanLimworwortel/react-modern-gantt) - Source code

### Export Dependencies (Phase 4.4)

| Package | Version | License | Χρήση |
|---------|---------|---------|-------|
| `jspdf` | v3.0.3 | MIT | PDF generation (pre-existing) |
| `jspdf-autotable` | v5.0.2 | MIT | PDF data tables (pre-existing) |
| `html-to-image` | latest | MIT | DOM capture → PNG/SVG (**νέο**) |
| `exceljs` | latest | MIT | Excel workbook generation (**νέο**) |

### Rejected Libraries
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
