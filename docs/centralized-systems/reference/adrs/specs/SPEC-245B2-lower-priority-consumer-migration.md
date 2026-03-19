# SPEC-245B2: Lower-Priority Consumer Migration — Remaining Domains + Infrastructure Cleanup

| Metadata | Value |
|----------|-------|
| **ADR** | ADR-245 (API Routes Centralization) |
| **Phase** | B2 (Lower-Priority Consumer Migration) |
| **Scope** | Financial, Attendance, Messages, Voice, Calendar, Admin, Notifications, Misc, Accounting, Infrastructure |
| **Date** | 2026-03-19 |
| **Status** | ✅ COMPLETE — All optional migrations executed (2026-03-19) |
| **Remaining Files** | ~5 (infrastructure config + geocoding) |

---

## 1. Κρίσιμη Αλλαγή από το Αρχικό Plan

### Η πλειοψηφία των medium/low priority αρχείων **ΗΔΗ χρησιμοποιεί `API_ROUTES`**.

Κατά τη Φάση A ή σε προηγούμενα refactorings, τα ακόλουθα domains μεταβήθηκαν **πλήρως**:

| Domain | Αρχεία | Status |
|--------|--------|--------|
| Financial Intelligence | PortfolioDashboard, ForwardCurveChart | ✅ ΗΔΗ `API_ROUTES` |
| Interest Calculator | useInterestCalculator | ✅ ΗΔΗ `API_ROUTES` |
| Attendance | QrCodePanel, GeofenceConfigMap, LiveWorkerMap, CheckInClient | ✅ ΗΔΗ `API_ROUTES` |
| Messages | useMessagePin, useMessageEdit, useMessageActions | ✅ ΗΔΗ `API_ROUTES` |
| Notifications | useRealtimeMessages, ErrorBoundary, ErrorTracker, notificationApi | ✅ ΗΔΗ `API_ROUTES` |
| Voice/Calendar | useVoiceRecorder, useVoiceCommand, CalendarNLPInput | ✅ ΗΔΗ `API_ROUTES` |
| Admin | AuthContext, OperatorInboxClient, admin/setup, search-backfill, claims-repair | ✅ ΗΔΗ `API_ROUTES` |
| Communications | useSendEmailModal, ShareModal | ✅ ΗΔΗ `API_ROUTES` |
| Audit Trail | contacts.service, association.service | ✅ ΗΔΗ `API_ROUTES` |
| Accounting subapp | ALL accounting components | ✅ ΗΔΗ `API_ROUTES` |
| Misc | useGlobalSearch, useEnterpriseIds, useEnterpriseRelationships, NavigationCompanyManager, photo-upload.service, usePaymentReport | ✅ ΗΔΗ `API_ROUTES` |

**Αυτό σημαίνει ότι η Φάση B2 είναι σχεδόν ολοκληρωμένη.**

---

## 2. Εναπομείναντα Αρχεία — Infrastructure/Config

Τα ακόλουθα αρχεία εξακολουθούν να έχουν hardcoded `/api/` strings, αλλά για **διαφορετικό λόγο** — δεν είναι API consumers αλλά infrastructure config:

### 2.1 Middleware Rate Limit Config

**File**: `src/lib/middleware/rate-limit-config.ts`

| Line | Code | Αξιολόγηση |
|------|------|-----------|
| 95 | `'/api/admin': 'SENSITIVE'` | ⚠️ Config — prefix matching |
| 96 | `'/api/admin/buildings': 'SENSITIVE'` | ⚠️ Config — prefix matching |
| 97 | `'/api/admin/templates': 'SENSITIVE'` | ⚠️ Config — prefix matching |
| 100 | `'/api/search': 'HIGH'` | ⚠️ Config — prefix matching |
| 101 | `'/api/projects/list': 'HIGH'` | ⚠️ Config — prefix matching |
| 102 | `'/api/contacts/list': 'HIGH'` | ⚠️ Config — prefix matching |
| 105 | `'/api/reports': 'HEAVY'` | ⚠️ Config — prefix matching |
| 106 | `'/api/export': 'HEAVY'` | ⚠️ Config — prefix matching |
| 107 | `'/api/analytics': 'HEAVY'` | ⚠️ Config — prefix matching |
| 110 | `'/api/communications/webhooks': 'WEBHOOK'` | ⚠️ Config — prefix matching |
| 113 | `'/api/communications/webhooks/telegram': 'TELEGRAM'` | ⚠️ Config — prefix matching |

**Απόφαση**: **OPTIONAL migration**. Αυτά χρησιμοποιούνται ως prefix matching keys σε middleware, όχι ως API call endpoints. Μπορούν να μεταβούν σε `API_ROUTES` references αλλά:
- Κάποια paths (π.χ. `/api/admin`, `/api/reports`) δεν υπάρχουν στο `API_ROUTES` γιατί είναι prefixes
- Η αλλαγή θα αυξήσει τη σύζευξη μεταξύ middleware και domain-constants
- **Πρόταση**: Αφαίρεση μόνο των paths που έχουν exact match στο `API_ROUTES` (π.χ. `'/api/search'` → `API_ROUTES.SEARCH`, `'/api/projects/list'` → `API_ROUTES.PROJECTS.LIST`)

### 2.2 Middleware (Next.js)

**File**: `src/middleware.ts`

| Line | Code | Αξιολόγηση |
|------|------|-----------|
| 165 | `pathname.startsWith('/api/communications/webhooks')` | ℹ️ Infrastructure — prefix matching |

**Απόφαση**: **NO CHANGE**. Αυτό είναι Next.js middleware routing logic, δεν είναι API consumer.

### 2.3 Geographic Config

**File**: `src/config/geographic-config.ts`

| Line | Code | Αξιολόγηση |
|------|------|-----------|
| 91 | `process.env.NEXT_PUBLIC_GEOCODING_API_ENDPOINT \|\| '/api/geocoding'` | ⚠️ Fallback value |

**Απόφαση**: **OPTIONAL**. Αυτό χρειάζεται νέο `API_ROUTES.GEOCODING` entry αν θέλουμε να το κεντρικοποιήσουμε. Χαμηλή προτεραιότητα γιατί η τιμή έρχεται κυρίως από env var.

### 2.4 Webhook Process Message

**File**: `src/app/api/communications/webhooks/telegram/message/process-message.ts`

| Line | Code | Αξιολόγηση |
|------|------|-----------|
| 79 | `'/api/communications/webhooks/telegram'` | ℹ️ Rate limit path reference |

**Απόφαση**: **NO CHANGE**. Server-side reference σε rate limit config.

### 2.5 DXF Viewer Test/Debug Files

| File | Line | Code | Αξιολόγηση |
|------|------|------|-----------|
| `subapps/dxf-viewer/ui/components/tests-modal/hooks/useApiTests.ts` | 20, 50, 80 | `/api/run-vitest`, `/api/run-jest`, `/api/run-playwright` | ℹ️ Test-only |
| `subapps/dxf-viewer/ui/components/tests-modal/constants/automatedTests.ts` | 39 | `/api/validate-line-drawing` | ℹ️ Test-only |
| `subapps/dxf-viewer/performance/DxfPerformanceOptimizer.ts` | 640 | `/api/dxf-files` | ℹ️ Perf config |
| `subapps/geo-canvas/profiling/PerformanceProfiler.ts` | 804 | `url.includes('/api/')` | ℹ️ Detection pattern |
| `subapps/geo-canvas/deployment/DockerOrchestrator.ts` | 677 | `/api/health` | ℹ️ Health check |

**Απόφαση**: **NO CHANGE**. Αυτά είναι subapp-specific test/debug paths που δεν είναι production consumers.

### 2.6 Documentation/Comment References

| File | Line | Code | Type |
|------|------|------|------|
| `lib/api/enterprise-api-client.ts` | 28, 31 | `/api/endpoint` | JSDoc example |
| `services/entity-linking/utils/retry.ts` | 176, 263 | `/api/data` | JSDoc example |
| `lib/middleware/rate-limiter.ts` | 86 | `/api/projects/list` | JSDoc example |
| `lib/auth/tenant-isolation.ts` | 68, 137 | `/api/projects/[id]/customers` | JSDoc example |
| `lib/firestore/entity-linking.service.ts` | 116 | `/api/storages/[id]` | JSDoc example |
| `app/api/admin/bootstrap-admin/route.ts` | 85 | `/api/admin/bootstrap-admin` | JSDoc comment |

**Απόφαση**: **NO CHANGE**. Comments/docs μπορούν να παραμείνουν ως-έχουν.

### 2.7 Server-side Route Files

Πολλαπλά `route.ts` αρχεία στο `src/app/api/` περιέχουν hardcoded paths στα audit/logging calls:

| File | Context |
|------|---------|
| `app/api/units/[id]/route.ts:323` | Audit path reference |
| `app/api/units/create/route.ts:120` | Audit path reference |
| `app/api/parking/route.ts:177, 217` | Audit + error path |
| `app/api/floors/route.ts:259` | Audit path reference |
| `app/api/buildings/route.ts:165, 285` | Audit path reference |
| `app/api/buildings/[buildingId]/milestones/route.ts` | Error response paths |
| `app/api/buildings/[buildingId]/construction-phases/route.ts` | Error response paths |
| `app/api/buildings/[buildingId]/customers/route.ts` | Error response path |
| Various cron routes | JSDoc schedule config |

**Απόφαση**: **NO CHANGE**. Server-side audit/error references. Δεν είναι API consumers.

---

## 3. Σύνοψη Αποφάσεων

| Κατηγορία | Αρχεία | Απόφαση |
|-----------|--------|---------|
| ✅ ΗΔΗ μεταβήθηκαν (30+ αρχεία) | Financial, Attendance, Messages, Voice, Admin, Accounting, Misc | **DONE** — Δεν χρειάζεται ενέργεια |
| ⚠️ Optional: Rate limit config | 1 αρχείο, ~11 instances | **OPTIONAL** — Χαμηλή αξία, αυξάνει σύζευξη |
| ⚠️ Optional: Geographic config | 1 αρχείο, 1 instance | **OPTIONAL** — Νέο API_ROUTES entry needed |
| ℹ️ Infrastructure (middleware, routes) | ~15 αρχεία | **NO CHANGE** — Server-side/infrastructure |
| ℹ️ Test/Debug code | ~5 αρχεία | **NO CHANGE** — Non-production |
| ℹ️ JSDoc/Comments | ~6 αρχεία | **NO CHANGE** — Documentation |

---

## 4. Potential Future Entry: GEOCODING

Αν αποφασιστεί η μετάβαση του geographic config:

```typescript
// Στο API_ROUTES (domain-constants.ts):
GEOCODING: '/api/geocoding',

// Στο geographic-config.ts:
import { API_ROUTES } from '@/config/domain-constants';

API_ENDPOINT: process.env.NEXT_PUBLIC_GEOCODING_API_ENDPOINT || API_ROUTES.GEOCODING,
```

---

## 5. `fetch()` vs `apiClient` — Status Update

Ο αρχικός audit εντόπισε ~15 αρχεία με raw `fetch()`. Τρέχουσα κατάσταση:

| Αρχείο | Status | Λόγος fetch |
|--------|--------|-------------|
| EntityFilesManager.tsx | ⚠️ Hardcoded path (SPEC-245B1) | Multipart upload |
| FloorplanGallery.tsx | ⚠️ Hardcoded path (SPEC-245B1) | Auth header manual |
| useFileClassification.ts | ⚠️ Hardcoded path (SPEC-245B1) | Auth header manual |
| useBatchFileOperations.ts | ⚠️ Hardcoded path (SPEC-245B1) | Blob response |
| FileManagerPageContent.tsx | ⚠️ Hardcoded path (SPEC-245B1) | Blob + streaming |
| ProfessionalsCard.tsx | ⚠️ Hardcoded path (SPEC-245B1) | Fire-and-forget |
| usePaymentPlan.ts | ⚠️ Hardcoded path (SPEC-245B1) | Custom fetchJson |
| useChequeRegistry.ts | ⚠️ Hardcoded path (SPEC-245B1) | SWR + fetch |
| useLoanTracking.ts | ⚠️ Hardcoded path (SPEC-245B1) | SWR + fetch |
| PortfolioDashboard.tsx | ✅ Migrated | — |
| ForwardCurveChart.tsx | ✅ Migrated | — |
| useInterestCalculator.ts | ✅ Migrated | — |
| QrCodePanel.tsx | ✅ Migrated | — |
| GeofenceConfigMap.tsx | ✅ Migrated | — |
| CheckInClient.tsx | ✅ Migrated | — |
| useVoiceRecorder.ts | ✅ Migrated | — |
| useVoiceCommand.ts | ✅ Migrated | — |
| CalendarNLPInput.tsx | ✅ Migrated | — |
| useMessagePin.ts | ✅ Migrated | — |
| useMessageEdit.ts | ✅ Migrated | — |
| useMessageActions.ts | ✅ Migrated | — |

**Εναπομένουν 9 αρχεία με `fetch()`** — ΟΛΑ καλύπτονται στο SPEC-245B1 (path migration). Η πλήρης μετάβαση `fetch→apiClient` είναι ξεχωριστό ADR scope.

---

## 6. Migration Checklist

- [x] Financial Intelligence (PortfolioDashboard, ForwardCurveChart) — ΗΔΗ `API_ROUTES`
- [x] Interest Calculator (useInterestCalculator) — ΗΔΗ `API_ROUTES`
- [x] Attendance (QrCodePanel, GeofenceConfigMap, LiveWorkerMap, CheckInClient) — ΗΔΗ `API_ROUTES`
- [x] Messages (useMessagePin, useMessageEdit, useMessageActions) — ΗΔΗ `API_ROUTES`
- [x] Notifications (ErrorBoundary, ErrorTracker, notificationApi, useRealtimeMessages) — ΗΔΗ `API_ROUTES`
- [x] Voice/Calendar (useVoiceRecorder, useVoiceCommand, CalendarNLPInput) — ΗΔΗ `API_ROUTES`
- [x] Admin (AuthContext, OperatorInboxClient, setup, search-backfill, claims-repair) — ΗΔΗ `API_ROUTES`
- [x] Communications (useSendEmailModal, ShareModal) — ΗΔΗ `API_ROUTES`
- [x] Audit Trail (contacts.service, association.service) — ΗΔΗ `API_ROUTES`
- [x] Accounting subapp (ALL components) — ΗΔΗ `API_ROUTES`
- [x] Misc (useGlobalSearch, useEnterpriseIds, etc.) — ΗΔΗ `API_ROUTES`
- [x] **Optional**: Rate limit config paths → `API_ROUTES` (2 exact-match paths migrated: SEARCH, PROJECTS.LIST)
- [x] **Optional**: Geographic config fallback → `API_ROUTES.GEOCODING` (new entry + migration done)

---

## 7. Στατιστικά Σύνοψη

| Μετρική | Τιμή |
|---------|------|
| Αρχεία στο αρχικό scope | **~19** |
| ΗΔΗ migrated σε `API_ROUTES` | **~30** ✅ |
| Εναπομένοντα (optional) | **~2** |
| Infrastructure (no change) | **~25** |
| Test/Debug (no change) | **~5** |
| Comments/Docs (no change) | **~6** |

---

*SPEC-245B2 — Created 2026-03-19 by Claude Code (Anthropic AI)*
