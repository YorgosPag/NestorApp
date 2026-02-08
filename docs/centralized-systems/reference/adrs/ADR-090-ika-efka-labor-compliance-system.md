# ADR-090: IKA/EFKA Labor Compliance System

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED - Phase 1 + Phase 2 Complete |
| **Date** | 2026-02-08 |
| **Category** | Backend Systems / Labor Compliance |
| **Canonical Location** | `src/components/projects/ika/` |
| **Author** | Georgios Pagonis + Claude Code (Anthropic AI) |
| **Related** | ADR-012 (Entity Linking Service), ADR-032 (Association Service), ADR-063 (Company Isolation) |
| **Use Case** | UC-024 — Labor Compliance |

---

## 1. Context

Greek labor law requires construction projects to maintain proper worker registration, attendance tracking, social security stamp calculations, and EFKA declarations. The Nestor Pagonis application needs to support these requirements for real estate construction projects.

**Key requirement**: EFKA declarations (Αναγγελία Έργου) are issued **per Project**, not per Building. The AMOE (Αριθμός Μητρώου Οικοδομικού Έργου) is a project-level registry number.

## 2. Decision

### 2.1 Architecture — 4 Pillars (Phased Implementation)

| Pillar | Sub-Tab | Phase | Status |
|--------|---------|-------|--------|
| Workers (Εργατοτεχνίτες) | Workers | Phase 1 | IMPLEMENTED |
| EFKA Declaration (Αναγγελία Έργου) | EFKA Declaration | Phase 1 | IMPLEMENTED |
| Attendance (Παρουσιολόγιο) | Timesheet | Phase 2 | IMPLEMENTED |
| Stamps & APD (Ένσημα & ΑΠΔ) | Stamps Calculation + APD Payments | Phase 3 | Planned |
| ERGANI II (Ψηφιακή Κάρτα) | — | Phase 4 | Planned |

### 2.2 Data Model — No New Worker Registry

**Critical decision**: Workers are **existing individual contacts** linked to projects via `contact_links`. No separate worker collection is created.

```
contact_links (targetEntityType='project', targetEntityId=projectId)
  → contacts (type='individual')
  → contact_relationships (type='employee')
  → ProjectWorker view model
```

### 2.3 EFKA Declaration — Project Document Field

EFKA declaration data is stored as a field on the Project document (`projects/{projectId}.efkaDeclaration`), not in a separate collection.

**7 Required Fields**:
1. ΑΦΜ Εργοδότη (Employer VAT Number)
2. Διεύθυνση Έργου (Project Address)
3. Περιγραφή Έργου (Project Description)
4. Ημερομηνία Έναρξης (Start Date)
5. Εκτιμώμενη Λήξη (Estimated End Date)
6. Αριθμός Εργαζομένων (Estimated Worker Count)
7. Κατηγορία Έργου (Project Category: construction | technical)

**Status Flow**: `draft` → `preparation` → `submitted` → `active` → `amended` → `closed`

**Document Tracking**: Ε.1, Ε.3, Ε.4 (each with status: pending → uploaded → submitted → approved)

### 2.4 UI Location

The IKA tab already existed in Projects with 4 placeholder sub-tabs. Phase 1 implements:
- Sub-tab 1: **Workers** (full implementation)
- Sub-tab 2: **EFKA Declaration** (new 5th sub-tab, moved to 2nd position)
- Sub-tabs 3-5: Timesheet, Stamps, APD (placeholders for future phases)

## 3. File Structure

```
src/components/projects/ika/
├── contracts.ts                          # TypeScript interfaces (SSoT)
├── WorkersTabContent.tsx                 # Workers management tab
├── EfkaDeclarationTabContent.tsx         # EFKA declaration form
├── TimesheetTabContent.tsx               # Phase 2: Enterprise attendance UI
├── StampsCalculationTabContent.tsx       # Phase 3 placeholder
├── ApdPaymentsTabContent.tsx             # Phase 3 placeholder
├── hooks/
│   ├── useProjectWorkers.ts              # Fetch workers via contact_links
│   ├── useEfkaDeclaration.ts             # Read/write EFKA declaration
│   ├── useAttendanceEvents.ts            # Phase 2: Query + create immutable events
│   └── useAttendanceSummary.ts           # Phase 2: Computed summaries & anomalies
└── components/
    ├── WorkerCard.tsx                     # Individual worker display
    ├── WorkerAssignmentDialog.tsx         # Assign contact to project
    ├── EfkaChecklist.tsx                  # 7-field completion checklist
    ├── EfkaStatusBadge.tsx               # Status badge component
    ├── EfkaDocumentTracker.tsx           # E.1/E.3/E.4 tracking
    ├── DateNavigator.tsx                  # Phase 2: Date navigation (< Σήμερα >)
    ├── AttendanceDashboard.tsx            # Phase 2: 4 summary cards
    ├── AttendanceEventRow.tsx             # Phase 2: Single event in timeline
    ├── DailyTimeline.tsx                  # Phase 2: Workers table with events
    ├── CrewGroupFilter.tsx                # Phase 2: Filter by crew (company)
    └── AttendanceRecordDialog.tsx         # Phase 2: Manual event entry
```

## 4. Key Interfaces

```typescript
export type EfkaDeclarationStatus =
  | 'draft' | 'preparation' | 'submitted' | 'active' | 'amended' | 'closed';

export interface EfkaDeclarationData {
  projectId: string;
  employerVatNumber: string | null;
  projectAddress: string | null;
  projectDescription: string | null;
  startDate: string | null;
  estimatedEndDate: string | null;
  estimatedWorkerCount: number | null;
  projectCategory: EfkaProjectCategory | null;
  amoe: string | null;
  status: EfkaDeclarationStatus;
  documents: EfkaDocument[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ProjectWorker {
  contactId: string;
  name: string;
  specialty: string | null;
  company: string | null;
  insuranceClassId: string | null;
  amka: string | null;
  employmentStatus: string;
  hireDate: string | null;
  linkId: string;
}
```

## 5. Reused Enterprise Systems

| System | Usage |
|--------|-------|
| `AssociationService` | Link contacts to projects via `contact_links` |
| `COLLECTIONS` (firestore-collections.ts) | SSoT for collection names |
| `useTranslation('projects')` | i18n (el/en) |
| Design tokens | `useIconSizes`, `useSemanticColors`, `useTypography`, `useSpacingTokens`, `useBorderTokens` |
| Radix Select (ADR-001) | Project category dropdown |

## 6. Firestore Collections

### Existing (used by Phase 1)
- `contacts` — Individual contacts (workers)
- `contact_links` — Links between contacts and entities (projects)
- `contact_relationships` — Employment relationships
- `projects` — Project documents (stores `efkaDeclaration` field)

### New (Phase 2+)
- `attendance_events` — Immutable attendance records (Phase 2 — IMPLEMENTED)
- `employment_records` — Monthly employment records per worker/project (Phase 3)
- `digital_work_cards` — ERGANI II digital work cards (Phase 4)

## 7. Phase 2: Enterprise Attendance System (IMPLEMENTED)

### 7.1 Architecture — Immutable Event Logging

Attendance events are **append-only** — once created, they cannot be updated or deleted. This provides legal compliance for ΣΕΠΕ inspections and accident documentation.

**Firestore rules**: `attendance_events` collection allows `create` only (authenticated + validated enum fields). `update` and `delete` are `false`.

**Composite index**: `projectId` (ASC) + `timestamp` (ASC)

### 7.2 Event Types

| Event Type | Description | Actor |
|-----------|-------------|-------|
| `check_in` | Worker arrives at site | Worker / siteManager |
| `check_out` | Worker leaves at end | Worker / siteManager |
| `break_start` | Break begins | Worker |
| `break_end` | Break ends | Worker |
| `left_site` | Worker left during work | Worker / geofence |
| `returned` | Worker returned after leaving | Worker / geofence |
| `exit_permission` | Approved exit | siteManager |

**Recording methods**: `manual`, `qr`, `geofence`, `nfc`

### 7.3 Computed Types

| Type | Purpose |
|------|---------|
| `WorkerDailySummary` | Daily summary per worker: status, check-in/out, hours, breaks, gaps, anomalies |
| `ProjectDailySummary` | Project-level aggregates: present/absent/off-site counts, total hours |
| `CrewGroup` | Workers grouped by company (συνεργείο) with present/total counts |
| `AttendanceAnomaly` | Detected issues: missing_checkout, unauthorized_absence, long_break, etc. |
| `WorkerAttendanceStatus` | Real-time: present, absent, off_site, on_break, checked_out |
| `AttendanceViewMode` | UI mode: daily, weekly, monthly |

### 7.4 UI Architecture

```
TimesheetTabContent (main orchestrator)
├── DateNavigator        — Date navigation (< Σήμερα >, day/week/month selector)
├── AttendanceDashboard  — 4 summary cards (Παρόντες / Απόντες / Εκτός / Ώρες)
├── CrewGroupFilter      — Filter by company/crew (Radix Select, ADR-001)
├── DailyTimeline        — Workers table with expandable event rows
│   └── AttendanceEventRow — Individual event display (icon + badge + time)
└── AttendanceRecordDialog — Manual event creation (worker + type + notes)
```

### 7.5 Hooks

| Hook | Type | Purpose |
|------|------|---------|
| `useAttendanceEvents` | Firestore I/O | Query events by project + date range, create new (immutable) |
| `useAttendanceSummary` | Pure computation | Derives summaries, crew groups, anomalies from events + workers |

### 7.6 Anomaly Detection

The `useAttendanceSummary` hook automatically detects:
- **missing_checkout**: Check-in without check-out (past days only)
- **missing_checkin**: Check-out without preceding check-in
- **unauthorized_absence**: Off-site > 30 minutes without exit_permission
- **long_break**: Break duration > 60 minutes

### 7.7 i18n

All text is from `useTranslation('projects')` → `ika.timesheetTab.*` (~50 keys in el + en).

## 8. Security

- `contact_links`: Authenticated read, validated create, creator-only update/delete
- `attendance_events`: Authenticated read, validated create, **NO update, NO delete** (immutable)
- EFKA declaration data: Protected by project-level tenant isolation rules
- Workers list: Read-only unless user has project access

## 9. Future Phases

### Phase 3: Stamps & APD (Ένσημα & ΑΠΔ)
- Insurance class configuration (config-driven from `system/settings.laborCompliance`)
- Monthly employment record calculation from attendance data
- APD generation, deadlines, penalty tracking
- `employment_records` collection

### Phase 4: ERGANI II
- Digital work card integration
- Cross-checks: Attendance ↔ ERGANI ↔ APD
- `digital_work_cards` collection

## 10. Consequences

### Positive
- No new worker registry — reuses existing contacts/relationships system
- EFKA data on project document — no additional collection for Phase 1
- Immutable attendance events — legal compliance for ΣΕΠΕ / accident documentation
- Crew grouping from existing company relationships — no separate crew collection
- Pure computation summaries (useMemo) — no derived data in Firestore
- Enterprise patterns throughout — all 5 design token hooks, i18n, proper TypeScript, Radix Select

### Negative
- `contact_links` needs Firestore rules (resolved — rules deployed)
- Worker search currently client-side filtered (scales to ~1000 contacts)
- EFKA status transitions not yet enforced server-side
- Attendance summary computation is client-side (acceptable for <100 workers/project)

### Risks
- Insurance class rates change annually — needs config-driven approach (Phase 3)
- Real-time geofence/QR integration requires mobile app (Phase 2 implements manual fallback)
