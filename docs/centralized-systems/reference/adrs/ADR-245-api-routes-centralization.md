# ADR-245: API Routes Centralization — Zero Hardcoded Endpoints

| Metadata | Value |
|----------|-------|
| **Status** | PHASE_A_COMPLETE — Registry extended. Phase B SPECs ready (SPEC-245B1, SPEC-245B2) |
| **Date** | 2026-03-19 |
| **Category** | Backend Systems / Infrastructure |
| **Canonical Location** | `src/config/domain-constants.ts` → `API_ROUTES` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## 1. Context

### Trigger: Production Bug

Στις 2026-03-18, εντοπίστηκε bug στο dialog κράτησης: η αποθήκη εμφανίζει "δεν έχει εμβαδόν" ενώ πραγματικά έχει 10 m². **Root cause**: Typo σε hardcoded URL — `/api/storage/${id}` αντί `/api/storages/${id}`. Ένα γράμμα → 404 → `area = 0` → ψεύτικο warning.

Αυτό αποδεικνύει ότι **hardcoded API paths = ticking time bomb**. Η Google δεν θα είχε ποτέ hardcoded URLs σε 80+ αρχεία.

### The Problem

- ❌ **150+ hardcoded API paths** σε 80+ αρχεία — κανένα compile-time validation
- ❌ **Typo bugs αόρατα** — μόνο runtime 404 τα αποκαλύπτει (αν κάποιος ελέγξει)
- ❌ **Duplicates παντού** — `/api/floorplans/process` σε 4 αρχεία, `/api/projects/list` σε 4 αρχεία
- ❌ **Zero refactoring safety** — αλλαγή API route path απαιτεί manual search σε ΟΛΟ το codebase
- ❌ **`API_ROUTES` στο `domain-constants.ts` έχει ΜΟΝΟ 2 entries** (auth endpoints) — ελλιπές

### Υπάρχουσα Κατάσταση

Στο `src/config/domain-constants.ts` υπάρχει ήδη:

```typescript
export const API_ROUTES = {
  AUTH_SESSION: '/api/auth/session',
  AUTH_MFA_ENROLL_COMPLETE: '/api/auth/mfa/enroll/complete',
} as const;
```

Αυτό είναι **σωστό pattern αλλά ελλιπές** — καλύπτει μόνο 2 από 150+ endpoints.

---

## 2. Ευρήματα Καθολικής Έρευνας

### 2.1 Στατιστικά

| Μετρική | Τιμή |
|---------|------|
| Hardcoded API paths (σύνολο) | **150+** |
| Αρχεία με hardcoded paths | **80+** |
| Domains/Κατηγορίες endpoints | **25+** |
| Duplicates (ίδιο path σε 2+ αρχεία) | **15+** patterns |
| Αρχεία με 4+ hardcoded paths | **10+** |

### 2.2 Κρίσιμα Duplicates (ίδιο path σε πολλαπλά αρχεία)

| Hardcoded Path | Πόσα αρχεία | Αρχεία |
|----------------|-------------|--------|
| `/api/floorplans/process` | **4** | `useFloorplanUpload.ts`, `useFloorplanFiles.ts`, `FloorplanProcessor.ts`, `EntityFilesManager.tsx` |
| `/api/projects/list` | **4** | `projects-client.service.ts`, `building-services.ts`, `useFirestoreProjects.ts`, `obligations/new/page.tsx` |
| `/api/files/classify` | **3** | `EntityFilesManager.tsx`, `useFileClassification.ts`, `FileManagerPageContent.tsx` |
| `/api/files/batch-download` | **2** | `useBatchFileOperations.ts`, `FileManagerPageContent.tsx` |
| `/api/files/archive` | **2** | `useBatchFileOperations.ts`, `FileManagerPageContent.tsx` |
| `/api/buildings` | **4+** | `building-services.ts`, `BuildingSelectorCard.tsx`, `useFirestoreBuildings.ts`, admin pages |
| `/api/units/${id}` | **5+** | `units.service.ts`, `UnitsTabContent.tsx`, `ProfessionalsCard.tsx` |
| `/api/notifications/error-report` | **3** | `ErrorBoundary.tsx` (x2), `ErrorTracker.ts` |
| `/api/audit-trail/record` | **3** | `contacts.service.ts`, `association.service.ts` (x2) |

### 2.3 Ανάλυση ανά Domain

#### ADMIN (`/api/admin/*`) — 10+ paths
| Αρχείο | Path |
|--------|------|
| `AuthContext.tsx` | `/api/admin/ensure-user-profile` |
| `admin/setup/page.tsx` | `/api/admin/setup-admin-config` (x2) |
| `OperatorInboxClient.tsx` | `/api/admin/operator-inbox` (**x4** — polling + POST) |
| `ProjectMembersTab.tsx` | `/api/admin/role-management/project-members` (x2) |
| `search-backfill/page.tsx` | `/api/admin/search-backfill` |
| `claims-repair/page.tsx` | `/api/admin/set-user-claims` |

#### UNITS / BUILDINGS / SPACES (`/api/units/*`, `/api/buildings/*`, `/api/parking/*`, `/api/storages/*`) — 25+ paths
| Αρχείο | Path |
|--------|------|
| `units.service.ts` | `/api/units/create`, `/api/units/${unitId}` (**x5**) |
| `UnitsTabContent.tsx` | `/api/units/${editingId}`, `/api/units/${item.id}` (**x4**) |
| `SoldUnitsPreview.tsx` | `/api/units` |
| `LinkSoldUnitsToCustomers.tsx` | `/api/units/admin-link` |
| `building-services.ts` | `/api/buildings` (**x3**) |
| `FloorsTabContent.tsx` | `/api/floors` (x2) |
| `ParkingTabContent.tsx` | `/api/parking` (x2) |
| `StorageTab.tsx` | `/api/storages` (x2) |
| `AddParkingDialog.tsx` | `/api/parking` |
| `AddStorageDialog.tsx` | `/api/storages` |
| `useLinkedSpacesForSale.ts` | `/api/parking/${id}`, `/api/storages/${id}` |

#### FILES / FLOORPLANS (`/api/files/*`, `/api/floorplans/*`) — 12+ paths
| Αρχείο | Path |
|--------|------|
| `useFloorplanUpload.ts` | `/api/floorplans/process` |
| `useFloorplanFiles.ts` | `/api/floorplans/process` |
| `FloorplanProcessor.ts` | `/api/floorplans/process` |
| `EntityFilesManager.tsx` | `/api/floorplans/process`, `/api/files/classify`, `/api/${entityType}s/${entityId}/activity` |
| `FloorplanGallery.tsx` | `/api/floorplans/scene?fileId=${id}` |
| `useFileClassification.ts` | `/api/files/classify` |
| `useBatchFileOperations.ts` | `/api/files/batch-download`, `/api/files/archive` |
| `FileManagerPageContent.tsx` | `/api/files/batch-download`, `/api/files/archive`, `/api/files/classify` |

#### PROJECTS (`/api/projects/*`) — 6+ paths
| Αρχείο | Path |
|--------|------|
| `projects-client.service.ts` | `/api/projects/list`, `/api/projects/${projectId}` (**x3**) |
| `building-services.ts` | `/api/projects/list` |
| `useFirestoreProjects.ts` | `/api/projects/list` |
| `obligations/new/page.tsx` | `/api/projects/list` |

#### ACCOUNTING (`/api/accounting/*`) — **40+ paths** (ΜΕΓΑΛΥΤΕΡΟ CLUSTER)
| Κατηγορία | Paths |
|-----------|-------|
| Invoices | `/api/accounting/invoices`, `/api/accounting/invoices/${id}` (**8+**) |
| Journal | `/api/accounting/journal` (**4+**) |
| VAT | `/api/accounting/vat/summary` (**2+**) |
| Tax | `/api/accounting/tax/estimate`, `/api/accounting/tax/dashboard` (**3+**) |
| Bank | `/api/accounting/bank/transactions`, `/api/accounting/bank/import` (**2+**) |
| Documents | `/api/accounting/documents/${id}` (**3+**) |
| Setup | `/api/accounting/setup`, `/api/accounting/setup/presets` (**2+**) |
| Categories | `/api/accounting/categories/${id}` (**2+**) |
| Partners | `/api/accounting/partners` (**2+**) |
| APY Certs | `/api/accounting/apy-certificates` (**3+**) |
| Fixed Assets | `/api/accounting/fixed-assets` (**1+**) |
| EFKA | `/api/accounting/efka/summary` (**1+**) |

#### MESSAGES / NOTIFICATIONS (`/api/messages/*`, `/api/notifications/*`) — 10+ paths
| Αρχείο | Path |
|--------|------|
| `useRealtimeMessages.ts` | `/api/notifications/dispatch` |
| `useMessagePin.ts` | `/api/messages/pin` (x2) |
| `useMessageEdit.ts` | `/api/messages/edit` |
| `ErrorBoundary.tsx` | `/api/notifications/error-report` (x2) |
| `ErrorTracker.ts` | `/api/notifications/error-report` |
| `notificationApi.ts` | `/api/notifications/read` |
| `ProfessionalsCard.tsx` | `/api/notifications/professional-assigned` |

#### FINANCIAL INTELLIGENCE (`/api/financial-intelligence/*`, `/api/ecb/*`) — 7+ paths
| Αρχείο | Path |
|--------|------|
| `PortfolioDashboard.tsx` | `/api/financial-intelligence/portfolio`, `/debt-maturity`, `/budget-variance` (**6 calls**) |
| `ForwardCurveChart.tsx` | `/api/ecb/forward-rates` |

#### ATTENDANCE (`/api/attendance/*`) — 6 paths
| Αρχείο | Path |
|--------|------|
| `QrCodePanel.tsx` | `/api/attendance/qr/generate` |
| `GeofenceConfigMap.tsx` | `/api/attendance/geofence` (x2) |
| `LiveWorkerMap.tsx` | `/api/attendance/geofence?projectId=${id}` |
| `CheckInClient.tsx` | `/api/attendance/qr/validate`, `/api/attendance/check-in` |

#### COMMUNICATIONS (`/api/communications/*`) — 2 paths
| Αρχείο | Path |
|--------|------|
| `useSendEmailModal.ts` | `/api/communications/email` |
| `ShareModal.tsx` | `/api/communications/email/property-share/` |

#### INTEREST CALCULATOR — 6 paths σε 1 αρχείο
| Αρχείο | Path |
|--------|------|
| `useInterestCalculator.ts` | `/api/euribor/rates`, `/api/settings/bank-spreads`, `/api/calculator/cost` (**6 calls**) |

#### VOICE / CALENDAR — 3 paths
| Αρχείο | Path |
|--------|------|
| `useVoiceRecorder.ts` | `/api/voice/transcribe` |
| `useVoiceCommand.ts` | `/api/voice/command` |
| `CalendarNLPInput.tsx` | `/api/calendar/parse-event` |

#### MISC — 10+ paths
| Αρχείο | Path |
|--------|------|
| `photo-upload.service.ts` | `/api/upload/photo` |
| `usePaymentReport.ts` | `/api/projects/${projectId}/payment-report` |
| `useGlobalSearch.ts` | `/api/search` |
| `useEnterpriseIds.ts` | `/api/enterprise-ids/migrate` (x2) |
| `useEnterpriseRelationships.ts` | `/api/relationships/validate-integrity` |
| `NavigationCompanyManager.tsx` | `/api/navigation/company` |
| `contacts.service.ts` | `/api/audit-trail/record` |
| `association.service.ts` | `/api/audit-trail/record` (x2) |

---

## 3. Decision

### Google-Level Architecture: Centralized API Routes Registry

**Επέκταση του ΥΠΑΡΧΟΝΤΟΣ `API_ROUTES`** στο `src/config/domain-constants.ts` ώστε να καλύπτει ΟΛΟΥΣ τους endpoints με **type-safe URL builders**.

### 3.1 Canonical Source

```
src/config/domain-constants.ts → API_ROUTES (επέκταση)
```

### 3.2 Target API (Google-Level Pattern)

```typescript
// ===== CURRENT STATE (2 entries) =====
export const API_ROUTES = {
  AUTH_SESSION: '/api/auth/session',
  AUTH_MFA_ENROLL_COMPLETE: '/api/auth/mfa/enroll/complete',
} as const;

// ===== TARGET STATE (Google-Level) =====
export const API_ROUTES = {
  // ── Auth ──────────────────────────────────────────
  AUTH: {
    SESSION: '/api/auth/session',
    MFA_ENROLL_COMPLETE: '/api/auth/mfa/enroll/complete',
  },

  // ── Admin ─────────────────────────────────────────
  ADMIN: {
    ENSURE_USER_PROFILE: '/api/admin/ensure-user-profile',
    SETUP_CONFIG: '/api/admin/setup-admin-config',
    OPERATOR_INBOX: '/api/admin/operator-inbox',
    ROLE_MANAGEMENT: {
      PROJECT_MEMBERS: '/api/admin/role-management/project-members',
    },
    SEARCH_BACKFILL: '/api/admin/search-backfill',
    SET_USER_CLAIMS: '/api/admin/set-user-claims',
  },

  // ── Buildings & Spaces ────────────────────────────
  BUILDINGS: {
    LIST: '/api/buildings',
    BY_ID: (id: string) => `/api/buildings/${id}` as const,
  },
  FLOORS: {
    LIST: '/api/floors',
    BY_ID: (id: string) => `/api/floors/${id}` as const,
  },
  UNITS: {
    LIST: '/api/units',
    CREATE: '/api/units/create',
    BY_ID: (id: string) => `/api/units/${id}` as const,
    ADMIN_LINK: '/api/units/admin-link',
    ACTIVITY: (id: string) => `/api/units/${id}/activity` as const,
  },
  PARKING: {
    LIST: '/api/parking',
    BY_ID: (id: string) => `/api/parking/${id}` as const,
  },
  STORAGES: {
    LIST: '/api/storages',
    BY_ID: (id: string) => `/api/storages/${id}` as const,
  },

  // ── Projects ──────────────────────────────────────
  PROJECTS: {
    LIST: '/api/projects/list',
    BY_ID: (id: string) => `/api/projects/${id}` as const,
    PAYMENT_REPORT: (id: string) => `/api/projects/${id}/payment-report` as const,
  },

  // ── Files & Floorplans ────────────────────────────
  FILES: {
    CLASSIFY: '/api/files/classify',
    BATCH_DOWNLOAD: '/api/files/batch-download',
    ARCHIVE: '/api/files/archive',
  },
  FLOORPLANS: {
    PROCESS: '/api/floorplans/process',
    SCENE: (fileId: string) => `/api/floorplans/scene?fileId=${fileId}` as const,
  },

  // ── Accounting ────────────────────────────────────
  ACCOUNTING: {
    INVOICES: {
      LIST: '/api/accounting/invoices',
      BY_ID: (id: string) => `/api/accounting/invoices/${id}` as const,
    },
    JOURNAL: '/api/accounting/journal',
    VAT: { SUMMARY: '/api/accounting/vat/summary' },
    TAX: {
      ESTIMATE: '/api/accounting/tax/estimate',
      DASHBOARD: '/api/accounting/tax/dashboard',
    },
    BANK: {
      TRANSACTIONS: '/api/accounting/bank/transactions',
      IMPORT: '/api/accounting/bank/import',
    },
    DOCUMENTS: {
      BY_ID: (id: string) => `/api/accounting/documents/${id}` as const,
    },
    SETUP: {
      BASE: '/api/accounting/setup',
      PRESETS: '/api/accounting/setup/presets',
    },
    CATEGORIES: {
      BY_ID: (id: string) => `/api/accounting/categories/${id}` as const,
    },
    PARTNERS: '/api/accounting/partners',
    APY_CERTIFICATES: '/api/accounting/apy-certificates',
    FIXED_ASSETS: '/api/accounting/fixed-assets',
    EFKA: { SUMMARY: '/api/accounting/efka/summary' },
  },

  // ── Messages & Notifications ──────────────────────
  MESSAGES: {
    PIN: '/api/messages/pin',
    EDIT: '/api/messages/edit',
  },
  NOTIFICATIONS: {
    DISPATCH: '/api/notifications/dispatch',
    ERROR_REPORT: '/api/notifications/error-report',
    READ: '/api/notifications/read',
    PROFESSIONAL_ASSIGNED: '/api/notifications/professional-assigned',
  },

  // ── Financial Intelligence ────────────────────────
  FINANCIAL_INTELLIGENCE: {
    PORTFOLIO: '/api/financial-intelligence/portfolio',
    DEBT_MATURITY: '/api/financial-intelligence/debt-maturity',
    BUDGET_VARIANCE: '/api/financial-intelligence/budget-variance',
  },
  ECB: {
    FORWARD_RATES: '/api/ecb/forward-rates',
  },

  // ── Attendance ────────────────────────────────────
  ATTENDANCE: {
    QR_GENERATE: '/api/attendance/qr/generate',
    QR_VALIDATE: '/api/attendance/qr/validate',
    CHECK_IN: '/api/attendance/check-in',
    GEOFENCE: '/api/attendance/geofence',
  },

  // ── Communications ────────────────────────────────
  COMMUNICATIONS: {
    EMAIL: '/api/communications/email',
    EMAIL_PROPERTY_SHARE: '/api/communications/email/property-share/',
  },

  // ── Interest Calculator ───────────────────────────
  EURIBOR: { RATES: '/api/euribor/rates' },
  SETTINGS: { BANK_SPREADS: '/api/settings/bank-spreads' },
  CALCULATOR: { COST: '/api/calculator/cost' },

  // ── Voice & Calendar ──────────────────────────────
  VOICE: {
    TRANSCRIBE: '/api/voice/transcribe',
    COMMAND: '/api/voice/command',
  },
  CALENDAR: {
    PARSE_EVENT: '/api/calendar/parse-event',
  },

  // ── Audit Trail ───────────────────────────────────
  AUDIT_TRAIL: {
    RECORD: '/api/audit-trail/record',
  },

  // ── Misc ──────────────────────────────────────────
  UPLOAD: { PHOTO: '/api/upload/photo' },
  SEARCH: '/api/search',
  ENTERPRISE_IDS: { MIGRATE: '/api/enterprise-ids/migrate' },
  RELATIONSHIPS: { VALIDATE_INTEGRITY: '/api/relationships/validate-integrity' },
  NAVIGATION: { COMPANY: '/api/navigation/company' },

  // ── Entity Activity (generic) ─────────────────────
  ENTITY_ACTIVITY: (entityType: string, entityId: string) =>
    `/api/${entityType}s/${entityId}/activity` as const,
} as const;
```

### 3.3 Χρήση στον Κώδικα (Before → After)

```typescript
// ❌ ΠΡΙΝ (hardcoded — production bug risk)
const endpoint = ls.spaceType === 'parking'
  ? `/api/parking/${ls.spaceId}`
  : `/api/storage/${ls.spaceId}`;  // TYPO! → 404

// ✅ ΜΕΤΑ (centralized — compile-time safe)
const endpoint = ls.spaceType === 'parking'
  ? API_ROUTES.PARKING.BY_ID(ls.spaceId)
  : API_ROUTES.STORAGES.BY_ID(ls.spaceId);  // Αδύνατο typo
```

```typescript
// ❌ ΠΡΙΝ
const data = await apiClient.get('/api/floorplans/process');

// ✅ ΜΕΤΑ
const data = await apiClient.get(API_ROUTES.FLOORPLANS.PROCESS);
```

```typescript
// ❌ ΠΡΙΝ
await fetch('/api/projects/list');  // Duplicated σε 4 αρχεία

// ✅ ΜΕΤΑ
await apiClient.get(API_ROUTES.PROJECTS.LIST);  // Single source of truth
```

### 3.4 Google-Level Quality Criteria

| Κριτήριο | Πώς το πετυχαίνουμε |
|----------|---------------------|
| **Compile-time safety** | TypeScript `as const` + function signatures = αδύνατο typo |
| **Single Source of Truth** | ΟΛΟΙ οι URLs σε ΕΝΑ αντικείμενο |
| **Zero Duplicates** | Κάθε path ορίζεται ΑΚΡΙΒΩΣ ΜΙΑ φορά |
| **Refactoring safety** | Αλλαγή URL σε 1 σημείο → αυτόματα παντού |
| **IDE autocomplete** | `API_ROUTES.` → full IntelliSense |
| **Grep-friendly** | `API_ROUTES.STORAGES.BY_ID` = εύκολο search |

---

## 4. Prohibitions (after this ADR)

- ⛔ **ΑΠΑΓΟΡΕΥΕΤΑΙ** hardcoded API path string σε οποιοδήποτε αρχείο εκτός `domain-constants.ts`
- ⛔ **ΑΠΑΓΟΡΕΥΕΤΑΙ** template literal με `/api/` σε hooks, components, ή services
- ⛔ **ΑΠΑΓΟΡΕΥΕΤΑΙ** δημιουργία νέου API endpoint χωρίς entry στο `API_ROUTES`
- ⛔ **ΑΠΑΓΟΡΕΥΕΤΑΙ** import API path από οπουδήποτε εκτός `@/config/domain-constants`

---

## 5. Migration Plan

### Φάση A: Extend `API_ROUTES` (1 commit)
Πρόσθεσε ΟΛΟΥΣ τους endpoints στο `domain-constants.ts`. Backward compatible — δεν σπάει τίποτα.

### Φάση B: Migrate Consumers (σταδιακά, ανά domain)

**Σειρά προτεραιότητας** (βάσει risk + duplicate count):

| Προτεραιότητα | Domain | Αρχεία | Λόγος |
|---------------|--------|--------|-------|
| 🔴 P0 | **Buildings/Spaces** | ~15 | Production bug area — ήδη σπασμένο |
| 🔴 P0 | **Floorplans** | ~4 | 4x duplicate `/api/floorplans/process` |
| 🟡 P1 | **Projects** | ~4 | 4x duplicate `/api/projects/list` |
| 🟡 P1 | **Files** | ~5 | 3x duplicate `/api/files/classify` |
| 🟡 P1 | **Units** | ~5 | 5+ hardcoded paths |
| 🟢 P2 | **Notifications** | ~6 | 3x duplicate error-report |
| 🟢 P2 | **Admin** | ~6 | 4x in operator-inbox |
| 🟢 P2 | **Financial Intelligence** | ~2 | 6 paths σε 1 αρχείο |
| 🔵 P3 | **Accounting** | ~20+ | Μεγαλύτερο cluster (40+) αλλά isolated subapp |
| 🔵 P3 | **Attendance** | ~4 | Isolated feature |
| 🔵 P3 | **Misc** | ~10 | Voice, Calendar, Search, κλπ |

### Φάση C: Lint Rule (optional)
ESLint rule που απαγορεύει hardcoded `/api/` strings εκτός `domain-constants.ts`.

---

## 6. Phase B — SPEC Documents

### SPEC-245B1: High-Priority Consumer Migration
- **Scope**: Buildings, Floors, Units, Parking, Storages, Projects, Files, Floorplans, Contacts
- **Files**: ~35 | **Instances**: ~105 hardcoded paths
- **Key finding**: 9 αρχεία χρησιμοποιούν `fetch()` αντί `apiClient` (path-only migration σε αυτή τη φάση)
- **Bonus**: Αφαίρεση duplicate `ENTITY_API_ENDPOINTS` registry στο `entity-linking/config.ts`
- **Location**: [`specs/SPEC-245B1-high-priority-consumer-migration.md`](./specs/SPEC-245B1-high-priority-consumer-migration.md)

### SPEC-245B2: Lower-Priority Consumer Migration
- **Scope**: Financial, Attendance, Messages, Voice, Calendar, Admin, Notifications, Misc, Accounting
- **Status**: **MOSTLY COMPLETE** — ~30 αρχεία ΗΔΗ χρησιμοποιούν `API_ROUTES`
- **Remaining**: 2 optional (rate-limit config, geocoding config)
- **Location**: [`specs/SPEC-245B2-lower-priority-consumer-migration.md`](./specs/SPEC-245B2-lower-priority-consumer-migration.md)

---

## 7. References

- **Bug report**: Commit `a7844444` — fix: correct storage API endpoint in useLinkedSpacesForSale
- **Existing `API_ROUTES`**: `src/config/domain-constants.ts` (lines 522-781)
- **Enterprise API Client**: `src/lib/api/enterprise-api-client.ts`
- **Firestore Collections SSoT**: `src/config/firestore-collections.ts` (αντίστοιχο pattern)
- Related: [ADR-030](./ADR-030-unified-frame-scheduler.md) (Zero Hardcoded Values)
- Related: [ADR-062](./ADR-062-no-debug-endpoints-in-production.md) (Endpoint Governance)
- Related: [ADR-068](./ADR-068-api-rate-limiting-system.md) (API Rate Limiting)

---

## 8. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-03-19 | ADR Created — Καθολική έρευνα, ευρήματα, migration plan | Γιώργος Παγώνης + Claude Code |
| 2026-03-19 | Status: PLANNING — Αναμένει συζήτηση πριν υλοποίηση | Γιώργος Παγώνης |
| 2026-03-19 | **Phase A COMPLETE** — API_ROUTES extended from 2→95+ entries. Nested structure with type-safe builders. Backward-compat aliases for AUTH. 2 existing consumers migrated. | Claude Code |
| 2026-03-19 | **Phase B SPECs CREATED** — SPEC-245B1 (high-priority, ~35 files, ~105 instances) + SPEC-245B2 (lower-priority, mostly already migrated). Audit revealed ~30 files already use API_ROUTES. | Claude Code |

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
*Enterprise standards inspired by: Google API Design Guide, Autodesk, Adobe, Bentley Systems, SAP*
