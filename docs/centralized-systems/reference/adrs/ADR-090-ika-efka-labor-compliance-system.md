# ADR-090: IKA/EFKA Labor Compliance System

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED - Phase 1 + Phase 2 + Phase 3 + Phase 4A Complete |
| **Date** | 2026-02-09 |
| **Category** | Backend Systems / Labor Compliance |
| **Canonical Location** | `src/components/projects/ika/` |
| **Author** | Georgios Pagonis + Claude Code (Anthropic AI) |
| **Related** | ADR-012 (Entity Linking Service), ADR-032 (Association Service), ADR-063 (Company Isolation), ADR-170 (QR + GPS Geofencing) |
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
| Stamps & APD (Ένσημα & ΑΠΔ) | Stamps Calculation + APD Payments | Phase 3 | IMPLEMENTED |
| QR + GPS + Photo Verification | Timesheet (enhanced) | Phase 4A | IMPLEMENTED (ADR-170) |
| ERGANI II (Ψηφιακή Κάρτα) | — | Phase 4B | Planned |

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
├── StampsCalculationTabContent.tsx       # Phase 3: Enterprise stamps calculator
├── ApdPaymentsTabContent.tsx             # Phase 3: APD tracking & management
├── hooks/
│   ├── useProjectWorkers.ts              # Fetch workers via contact_links
│   ├── useEfkaDeclaration.ts             # Read/write EFKA declaration
│   ├── useAttendanceEvents.ts            # Phase 2: Query + create immutable events
│   ├── useAttendanceSummary.ts           # Phase 2: Computed summaries & anomalies
│   ├── useLaborComplianceConfig.ts       # Phase 3: Insurance classes + contribution rates
│   ├── useStampsCalculation.ts           # Phase 3: Pure computation (stamps → contributions)
│   └── useEmploymentRecords.ts           # Phase 3: CRUD employment records (Firestore)
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
    ├── AttendanceRecordDialog.tsx         # Phase 2: Manual event entry
    ├── MonthYearSelector.tsx              # Phase 3: Month/year navigation (Radix Select)
    ├── StampsSummaryDashboard.tsx         # Phase 3: 4 summary cards (stamps/contributions)
    ├── WorkerStampsTable.tsx              # Phase 3: Per-worker stamps table with totals
    ├── InsuranceClassBadge.tsx            # Phase 3: Insurance class badge
    └── EmploymentRecordDialog.tsx         # Phase 3: Edit insurance class dialog
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
- `attendance_qr_tokens` — Daily HMAC-signed QR tokens (Phase 4A — ADR-170 — IMPLEMENTED)
- `employment_records` — Monthly employment records per worker/project (Phase 3)
- `digital_work_cards` — ERGANI II digital work cards (Phase 4B)

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

## 8. Phase 3: Stamps & APD System (IMPLEMENTED)

### 8.1 Architecture — Config-Driven Computation

Stamps calculation is **pure computation** derived from attendance data + insurance class configuration. No stamps data is stored — it is computed on-the-fly via `useMemo`.

Employment records (the output of computation) are persisted to `employment_records` for APD tracking.

**Legal basis**: ΕΦΚΑ Εγκύκλιος 39/2024 & 11/2025, ΚΠΚ 781 (Οικοδομοτεχνικά).

### 8.2 EFKA Contribution Rates (ΚΠΚ 781 — Construction, 01/01/2025)

| Category | Employer (%) | Employee (%) | Total (%) |
|----------|-------------|-------------|-----------|
| Κύρια σύνταξη (Main Pension) | 13.33 | 6.67 | 20.00 |
| Υγεία (Health) | 4.55 | 2.55 | 7.10 |
| Επικουρική (Supplementary/ΕΤΕΑΕΠ) | 3.25 | 3.25 | 6.50 |
| Ανεργία (Unemployment/ΔΥΠΑ) | 2.43 | 2.00 | 4.43 |
| ΙΕΚ / Πρόσθετες (IEK/Additional) | 0.837 | 2.32 | 3.157 |
| Εφάπαξ (Once Payment) | — | 4.00 | 4.00 |
| **ΣΥΝΟΛΟ ΚΠΚ 781** | **24.397** | **20.790** | **45.187** |

Rates are stored as `DEFAULT_CONTRIBUTION_RATES` in `contracts.ts` and can be overridden via `system/settings.laborCompliance` Firestore document.

### 8.3 Insurance Classes (Config-Driven)

28 insurance classes with imputed daily wages (τεκμαρτά ημερομίσθια). Stored in `DEFAULT_INSURANCE_CLASSES` with annual updates via config.

**Calculation formula**:
```
1 ένσημο = 1 ημέρα εργασίας (from attendance_events)

Εισφορά Εργοδότη = ένσημα × τεκμαρτό_ημερομίσθιο × (employerRate / 100)
Εισφορά Εργαζομένου = ένσημα × τεκμαρτό_ημερομίσθιο × (employeeRate / 100)
Συνολική Εισφορά = Εργοδότη + Εργαζομένου
```

### 8.4 Data Flow

```
attendance_events (Phase 2, immutable)
  │
  ├─ useAttendanceEvents(projectId, month range)
  │    → Count unique working days per worker
  │
  └─ useLaborComplianceConfig()
       → Read: system/settings.laborCompliance (Firestore)
       → Fallback: DEFAULT_LABOR_COMPLIANCE_CONFIG
       │
       └─ useStampsCalculation(workers, attendanceDays, config)
            → Pure computation (useMemo, NO Firestore)
            → Maps: worker.insuranceClassId → InsuranceClass
            → Computes: stamps, contributions per worker
            → Returns: StampsMonthSummary
            │
            ├─ StampsCalculationTabContent (main UI)
            │   ├─ MonthYearSelector (Radix Select)
            │   ├─ StampsSummaryDashboard (4 cards)
            │   ├─ WorkerStampsTable (per-worker detail)
            │   └─ EmploymentRecordDialog (assign class)
            │
            └─ useEmploymentRecords(projectId, month, year)
                 → Batch save to employment_records (Firestore)
                 → Used by ApdPaymentsTabContent
```

### 8.5 Computed Types

| Type | Purpose |
|------|---------|
| `StampsMonthSummary` | Monthly project totals: stamps, employer/employee/total contributions, issues |
| `WorkerStampsSummary` | Per-worker: insurance class, imputed wage, days worked, contributions, issues |
| `ApdPeriod` | APD submission tracking: status, deadline, reference number |
| `ContributionRates` | Rate structure: mainPension, health, supplementary, unemployment, iek, oncePayment |
| `InsuranceClass` | Class definition: number, min/max daily wage, imputed wage, year |
| `LaborComplianceConfig` | Top-level config: insurance classes + contribution rates |

### 8.6 UI Architecture

```
StampsCalculationTabContent (main orchestrator)
├── MonthYearSelector        — 2 Radix Selects (month + year) + prev/next buttons
├── StampsSummaryDashboard   — 4 summary cards (Ένσημα / Εργοδ. / Εργαζ. / Σύνολο)
├── WorkerStampsTable        — Per-worker table with 8 columns + totals row
│   └── InsuranceClassBadge  — Badge: "Κλ. 10 — €39.08" or "Χωρίς κλάση"
└── EmploymentRecordDialog   — Assign insurance class (Radix Select, 28 classes)

ApdPaymentsTabContent (APD tracking)
└── Table                    — Monthly periods: status (Badge), contribution, actions
    └── Button               — "Σημείωση Υποβολής" (mark as submitted)
```

### 8.7 Hooks

| Hook | Type | Purpose |
|------|------|---------|
| `useLaborComplianceConfig` | Firestore read | Insurance classes + contribution rates from `system/settings` |
| `useStampsCalculation` | Pure computation | Derives StampsMonthSummary from workers + attendance + config |
| `useEmploymentRecords` | Firestore CRUD | Batch save/update employment records, APD status tracking |

### 8.8 Employment Records Collection

**Collection**: `employment_records` (registered in `COLLECTIONS`)

**Document fields**: `projectId`, `contactId`, `workerName`, `companyName`, `month`, `year`, `insuranceClassNumber`, `imputedDailyWage`, `totalDaysWorked`, `stampsCount`, `employerContribution`, `employeeContribution`, `totalContribution`, `apdStatus`, `apdReferenceNumber`, `notes`, `createdAt`, `updatedAt`

**Composite index**: `projectId` (ASC) + `year` (ASC) + `month` (ASC)

**APD Status Flow**: `pending` → `submitted` → `accepted` | `rejected` → `corrected`

### 8.9 i18n

All text from `useTranslation('projects')`:
- `ika.stampsTab.*` (~30 keys): dashboard, columns, issues, dialog, months
- `ika.apdTab.*` (~20 keys): title, columns, status, actions

## 9. Security

- `contact_links`: Authenticated read, validated create, creator-only update/delete
- `attendance_events`: Authenticated read, validated create, **NO update, NO delete** (immutable)
- `employment_records`: Authenticated read, validated create (required fields + enum), authenticated update (projectId/contactId immutable), **NO delete** (legal documents)
- EFKA declaration data: Protected by project-level tenant isolation rules
- Workers list: Read-only unless user has project access

## 10. Future Phases

### Phase 4A: QR Code + GPS Geofencing + Photo Verification (IMPLEMENTED — ADR-170)
- Daily QR code generation with HMAC-SHA256 signing (anti-forgery)
- GPS Geofencing — Haversine distance verification against project site radius
- Optional photo capture for buddy-punching prevention
- Public check-in page (`/attendance/check-in/[token]`) — no app installation required
- 3 new services: `geofence-service`, `qr-token-service`, `attendance-server-service`
- 4 API routes: generate, validate, check-in, geofence config
- 2 admin components: `QrCodePanel`, `GeofenceConfigMap`
- 2 client hooks: `useGeolocation`, `usePhotoCapture`
- See: **[ADR-170](ADR-170-attendance-qr-gps-verification.md)**

### Phase 4B: ERGANI II
- Digital work card integration
- Cross-checks: Attendance ↔ ERGANI ↔ APD
- `digital_work_cards` collection

### Phase 5: Native App (if needed)
- Background geofencing (requires iOS/Android native)
- Push notifications for clock reminders
- Offline check-in with sync

## 11. Consequences

### Positive
- No new worker registry — reuses existing contacts/relationships system
- EFKA data on project document — no additional collection for Phase 1
- Immutable attendance events — legal compliance for ΣΕΠΕ / accident documentation
- Crew grouping from existing company relationships — no separate crew collection
- Pure computation summaries (useMemo) — no derived data in Firestore
- Config-driven insurance classes — annual rate updates without code changes
- Batch save for employment records — atomic writes for all workers in a month
- APD status preserved on re-save — doesn't overwrite submitted/accepted records
- Enterprise patterns throughout — all 5 design token hooks, i18n, proper TypeScript, Radix Select

### Negative
- `contact_links` needs Firestore rules (resolved — rules deployed)
- Worker search currently client-side filtered (scales to ~1000 contacts)
- EFKA status transitions not yet enforced server-side
- Attendance summary computation is client-side (acceptable for <100 workers/project)
- Stamps computation uses simplified attendance day count (single-day query per worker)

### Risks
- Insurance class rates change annually — mitigated by config-driven approach (Phase 3 ✅)
- Real-time geofence/QR integration requires mobile app — **MITIGATED** by ADR-170: web-based QR + GPS (Phase 4A ✅)
