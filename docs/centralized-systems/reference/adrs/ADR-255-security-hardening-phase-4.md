# ADR-255: Security Hardening Phase 4 — Tenant Isolation, Validation, Audit Trail

> **Status**: 🔄 IN PROGRESS (P0 + P1 partial implemented)
> **Date**: 2026-03-20
> **Category**: Security / Authorization / Data Integrity
> **Depends On**: ADR-253 (Deep Integrity Audit), ADR-252 (Security Audit), ADR-249 (Server-Side Integrity)
> **Scope**: Firestore Rules, API Routes, Client Writes, Input Validation, Audit Trail, Cleanup

---

## 1. Context & Motivation

Μετά την υλοποίηση του ADR-253 (error handling, race conditions, API auth), νέος audit αποκάλυψε **6 κατηγορίες κρίσιμων gaps** που ΔΕΝ καλύπτονται πλήρως:

- **ADR-253** κάλυψε: `.catch(() => {})`, race conditions, API auth → IMPLEMENTED
- **ADR-252** κάλυψε: Firestore rules γενικά → αλλά **ΕΧΑΣΕ collections** (`file_comments`, `file_audit_log`)
- **ADR-249** κάλυψε: Server-side integrity → αλλά **ΔΕΝ κάλυψε API tenant checks** για units/storages/parking/opportunities
- **Κανένα ADR** δεν κάλυψε: Zod validation σε API routes, financial audit trail, client-side writes migration

Αυτό το ADR ομαδοποιεί 6 SPECs που αντιμετωπίζουν κάθε gap ξεχωριστά, με σαφή phasing (P0 → P1 → P2).

---

## 2. Executive Summary

| # | Category | SPEC | Findings | Priority | Effort | Status |
|---|----------|------|----------|----------|--------|--------|
| 1 | Firestore Rules — Tenant Isolation | [SPEC-255A](./specs/SPEC-255A-firestore-rules-tenant-isolation.md) | 2 collections (+ 1 prerequisite fix) | **P0** | 2h | ✅ IMPLEMENTED |
| 2 | API Route Tenant Checks | [SPEC-255B](./specs/SPEC-255B-api-route-tenant-checks.md) | ~20 routes missing checks | **P0** | 4h | ✅ IMPLEMENTED |
| 3 | Client-Side Writes Migration | [SPEC-255C](./specs/SPEC-255C-client-writes-migration.md) | 19 files (3 CRITICAL) | **P1** | 8h | ✅ IMPLEMENTED (3 CRITICAL: attendance, EFKA, employment — 4 API routes + 3 hooks migrated) |
| 4 | Input Validation — Zod | [SPEC-255D](./specs/SPEC-255D-input-validation-zod.md) | 73 routes without Zod | **P2** | incremental | ✅ IMPLEMENTED (Tier 1: 15 financial ✅, Tier 2: 12 entity CRUD ✅, Tier 3: 15 remaining ✅ — total 42 routes with Zod schemas) |
| 5 | Financial Audit Trail | [SPEC-255E](./specs/SPEC-255E-audit-trail-financial-ops.md) | ~15 transitions + ~35 DELETEs | **P1** | 6h | ✅ IMPLEMENTED (13 routes: cheque PATCH, loan PATCH, payment POST, invoice PATCH/DELETE, document confirm/reject, journal PATCH/DELETE, category PATCH/DELETE, APY cert PATCH, commission PATCH, agreement PATCH/DELETE) |
| 6 | Cleanup Test Endpoints | [SPEC-255F](./specs/SPEC-255F-cleanup-test-endpoints.md) | 1 endpoint | **P0** | 0.5h | ✅ ALREADY DONE (pre-existing) |

**Συνολικό effort**: ~20.5h | **Κρίσιμο P0**: ~6.5h

---

## 3. Existing Infrastructure (Προς Επαναχρησιμοποίηση)

Η εφαρμογή **ΗΔΗ** διαθέτει enterprise-grade utilities που θα χρησιμοποιηθούν:

### 3.1 Tenant Isolation (`src/lib/auth/tenant-isolation.ts`)
- `requireProjectInTenant()` — Validates project belongs to user's company
- `requireBuildingInTenant()` — Validates building belongs to user's company
- `requireUnitInTenant()` — ✅ Added (SPEC-255B, 2026-03-20)
- `requireStorageInTenant()` — ✅ Added (SPEC-255B, 2026-03-20)
- `requireParkingInTenant()` — ✅ Added (SPEC-255B, 2026-03-20)
- `requireOpportunityInTenant()` — ✅ Added (SPEC-255B, 2026-03-20)
- `TenantIsolationError` — Typed error with 404/403 codes
- `isRoleBypass()` — Super admin bypass (ADR-232)

### 3.2 Auth Middleware (`src/lib/auth/middleware.ts`)
- `withAuth()` — Authentication wrapper
- `withRateLimit()` / `withHeavyRateLimit()` — Rate limiting
- `belongsToCompany()` — Company ownership check

### 3.3 Audit System (`src/lib/auth/audit.ts`, 699 lines)
- `logAuditEvent()` — Core audit function
- 15+ convenience functions (roles, permissions, communications, webhooks)
- `logFinancialTransition()` — ✅ Added (SPEC-255E, 2026-03-20)
- `logEntityDeletion()` — ✅ Added (SPEC-255E, 2026-03-20)

### 3.4 Firestore Rules (`firestore.rules`)
- `belongsToCompany()` custom function — enforces `resource.data.companyId == request.auth.token.companyId`
- Ήδη εφαρμόζεται σε ~30 collections

### 3.5 Zod (ήδη εγκατεστημένο)
- Χρησιμοποιείται σε accounting subapp (`src/subapps/accounting/`)
- Pattern: `schema.parse(await req.json())` σε route handlers

---

## 4. Phasing Strategy

### Phase P0 — Immediate (CRITICAL, 1-2 days)
1. **SPEC-255F**: Διαγραφή `/api/test-alert/route.ts` (0.5h)
2. **SPEC-255A**: Firestore rules + prerequisite code fix στο `file_comments` (2h)
3. **SPEC-255B**: Tenant checks σε ~20 API routes (4h)

### Phase P1 — Short-term (1-2 weeks)
4. **SPEC-255C**: Client-side writes migration — 3 CRITICAL files πρώτα (8h)
5. **SPEC-255E**: Financial audit trail — transitions + deletes (6h)

### Phase P2 — Incremental (migrate-on-touch)
6. **SPEC-255D**: Zod validation σε 73 routes — touch-on-edit strategy (ongoing)

---

## 5. SPEC Reference Table

| SPEC | Title | File | Priority |
|------|-------|------|----------|
| SPEC-255A | Firestore Rules — Tenant Isolation | [📄](./specs/SPEC-255A-firestore-rules-tenant-isolation.md) | P0 |
| SPEC-255B | API Route Tenant Checks | [📄](./specs/SPEC-255B-api-route-tenant-checks.md) | P0 |
| SPEC-255C | Client-Side Writes Migration | [📄](./specs/SPEC-255C-client-writes-migration.md) | P1 |
| SPEC-255D | Input Validation — Zod | [📄](./specs/SPEC-255D-input-validation-zod.md) | P2 |
| SPEC-255E | Audit Trail — Financial Operations | [📄](./specs/SPEC-255E-audit-trail-financial-ops.md) | P1 |
| SPEC-255F | Cleanup Test Endpoints | [📄](./specs/SPEC-255F-cleanup-test-endpoints.md) | P0 |

---

## 6. Decision

Προχωράμε με phased implementation:
- P0 πρώτα (Firestore rules, tenant checks, cleanup)
- P1 για business-critical gaps (client writes, audit trail)
- P2 incremental (Zod validation migrate-on-touch)

Κάθε SPEC υλοποιείται ανεξάρτητα, με δικό του commit.

---

## 7. Changelog

| Date | Change | By |
|------|--------|----|
| 2026-03-20 | Initial ADR + 6 SPECs created (documentation only) | Claude |
| 2026-03-20 | **SPEC-255A IMPLEMENTED**: Firestore rules tenant isolation for `file_comments` + `file_audit_log`, companyId added to `FileComment` interface + `CreateCommentInput` + `setDoc()`, callers updated (CommentsPanel, FilePreviewPanel, EntityFilesManager, FileManagerPageContent) | Claude |
| 2026-03-20 | **SPEC-255B IMPLEMENTED**: 4 new tenant isolation functions (`requireUnitInTenant`, `requireStorageInTenant`, `requireParkingInTenant`, `requireOpportunityInTenant`), 5 new audit target types added, ~23 route files updated with centralized tenant checks | Claude |
| 2026-03-20 | **SPEC-255E IMPLEMENTED (partial)**: `logFinancialTransition()` + `logEntityDeletion()` convenience functions, `financial_transition` audit action + `financial_status` change type added, 5 financial transition routes + 1 DELETE route updated with audit logging | Claude |
| 2026-04-10 | **Ratchet Phase 7 — Hooks (companyId enforcement)**: 4 hooks/services migrated to tenant-scoped queries (`useContactProjectRoles`, `useFloorOverlays`, `layer-management-persistence`, `layer-sync`). `SystemLayerContext` + `UseLayerManagementOptions` extended with `companyId`. `LayerSyncManager` constructor + `useLayerSync` + `forceSyncLayers` + `createGlobalLayerSync` thread companyId. Callers updated: `ProjectRolesSection`, `AdminLayerManager`. **Skipped (data model issues)**: `useEntityStatusResolver` (properties/parking_spots/storage_units use `buildingId` for tenant isolation, no `companyId` field), `useProjectWorkers` (CONTACT_RELATIONSHIPS legacy data without companyId). Baseline: 74 → ~68 violations. | Claude |
| 2026-04-10 | **Ratchet Phase 8 — Misc services (companyId enforcement)**: 10 violations cleared across 7 files. **Real fixes (3 files)**: `boq-repository.ts` + `boq-service.ts` + `contracts.ts` — added `companyId` parameter to `getByBuilding/getByProject/search/getStatistics/getBuildingSummary` (IBOQRepository + IBOQService); callers updated (`useBOQItems`, `ProjectMeasurementsTab`, `useScheduleDashboard`, `ScheduleDashboardView`, `TimelineTabContent`). `dxf-firestore.service.ts` — `findExistingFileRecord(companyId, fileName)` tenant-scoped; caller `useAutoSaveSceneManager` resolves `lookupCompanyId` from save context or auth user. **False-positive markers (5 files)**: `esco.service.ts` (2), `esco-skill.service.ts` (1), `file-share.service.ts` (1), `firestore-query.service.ts` (1), `EnterpriseNotificationService.ts` (2) — annotated with inline `companyId: N/A` justifications (public taxonomies, anonymous share validation, generic `documentId()` batchGet, path-based tenancy). **Deferred**: `navigation-companies.service.ts` (2) — requires schema change (NavigationCompanyEntry has no `companyId` field) + 4 caller updates with naming conflict (caller variable `companyId` references contact ID, not tenant). Baseline: 68 → **58 violations** (28 → 21 files). | Claude |
| 2026-04-10 | **Ratchet Phase 8 follow-up — navigation-companies.service.ts**: Resolved deferred item. Added `companyId: string \| null` to `NavigationCompanyEntry` interface (matches server API route which already writes it). All 5 public methods now call `requireAuthContext()` internally (same pattern as `companies.service.ts`) — no caller changes needed, avoiding the naming conflict entirely. Queries in `removeCompanyFromNavigation` / `isCompanyInNavigation` / `getNavigationCompanyIds` / `getAllNavigationCompanies` add `where('companyId', '==', companyId)` for regular users; super_admin (null companyId) branches to unfiltered queries for cross-tenant visibility. Cache migrated from single-entry static to `Map<cacheKey, { data, timestamp }>` with per-tenant isolation (`SUPER_ADMIN_CACHE_KEY` sentinel). Baseline: 58 → **56 violations** (21 → 20 files). | Claude |
| 2026-04-10 | **Ratchet Phase 10C.4 — Assignment policy repository query-chaining false positives**: `AssignmentPolicyRepository.ts` (3 violations) fully annotated. All three violations come from the query-extension pattern in `getAssignmentPolicies()`: the base query at `query(policiesRef, where('companyId', '==', queryParams.companyId))` is tenant-scoped, and subsequent calls `q = query(q, where('projectId'|'status'|'status', ...))` extend it — Firestore preserves all constraints from the parent query. The detector scans 12-line windows around each `query(` call and does not understand query chaining. Inline comments added to each chained extension: `🔒 companyId: inherited from base query above (query extension pattern)`. Baseline: 36 → **33 violations** (7 → 6 files). | Claude |
| 2026-04-10 | **Ratchet Phase 10C.3 — Building spaces service false-positive annotations**: `building-spaces.service.ts` (3 violations) fully annotated as false positives. All three queries in `getBuildingSpaces()` filter by `buildingId` on collections that have **no `companyId` field**. Firestore rules enforce tenant isolation via parent entity lookup: `properties` → `belongsToProjectCompany(project)` (rules line ~613), `parking_spots` → `belongsToBuildingCompany(buildingId)` (rules line ~691), `storage_units` → `belongsToBuildingCompany(buildingId)` (rules line ~660). Since this service receives pre-resolved building IDs (already tenant-scoped upstream by the caller), filtering by `buildingId` IS the tenant filter. Inline `🔒 companyId: N/A` markers added inside all three `query(...)` blocks. Baseline: 39 → **36 violations** (8 → 7 files). | Claude |
| 2026-04-10 | **Ratchet Phase 10C.2 — Ownership table service (mixed: 1 real fix + 2 false positives)**: `ownership-table-service.ts` (3 violations) cleared. **Real fix**: `getBuildingIdsByProject(projectId, companyId)` — promoted to required `companyId` parameter, query now filters `where('companyId', '==', companyId)` before `projectId`. Caller `OwnershipTableTab.tsx` consumes `useCompanyId()?.companyId` and guards the `useEffect` until companyId is resolved. **False-positive markers (2)**: `validateBuildingData()` queries on `floors` and `properties` — neither schema has a `companyId` field (`Floor` and `Property` interfaces in `src/types/building/contracts.ts` confirm). Firestore rules enforce tenant isolation via parent entity lookup: `floors` via `belongsToBuildingCompany(buildingId)` (rules line ~582), `properties` via `belongsToProjectCompany(project)` (rules line ~613). Inline `🔒 companyId: N/A` annotations added inside both `query(...)` blocks. Baseline: 42 → **39 violations** (9 → 8 files). | Claude |
| 2026-04-10 | **Ratchet Phase 10C.1 — BankAccounts subcollection false-positive annotations**: `BankAccountsService.ts` (3 violations) annotated as false positives. Queries target `contacts/{contactId}/bank_accounts/{accountId}` subcollection, tenant-isolated via path + Firestore rule `canAccessParentContact()` (rules line ~1465) which inherits access from the parent contact document (the contact IS companyId-scoped). `BankAccount` type schema has no `companyId` field — adding one would be data-model noise. Inline markers added in both `query(...)` blocks in `getAccounts` (2 branches: includeInactive / default) and `getPrimaryAccount`. Same pattern as Phase 10B.1 (EnterpriseSessionService). Baseline: 45 → **42 violations** (10 → 9 files). | Claude |
| 2026-04-10 | **Ratchet Phase 10B.1 — Session subcollection false-positive annotations**: `EnterpriseSessionService.ts` (2 violations) annotated as false positives. Queries target the `users/{userId}/sessions` subcollection which is tenant-isolated via path + Firestore rule `allow read, write: if isOwner(userId)` (rules line ~1340). Session documents belong to a user, not a company — no `companyId` field exists on this schema. Inline markers added inside both `query(...)` blocks in `getActiveSessions` and `markOtherSessionsNotCurrent`. **Deferred to 10B.2**: `EnterpriseTeamsService.ts` (6 violations) — Google-level recommendation is to **delete** the service (has its own Firebase init, fallback factories, single caller `CrmTeamsPageContent`, dual `organizationId`/`companyId` schema debt) and inline queries in caller via `useCompanyId()`. Requires dedicated session + potentially 3 new composite indexes if kept. Baseline: 47 → **45 violations** (11 → 10 files). | Claude |
| 2026-04-10 | **Ratchet Phase 10A — companyId quick wins**: 3 isolated violations fixed across 3 different domains (1 violation each). **Real fixes**: `buildings.service.ts::getBuildingStats(buildingId, companyId)` — added required `companyId` parameter, query now filters `where('companyId', '==', companyId)` before `buildingId`. Caller `BuildingStats.tsx` uses `useCompanyId()` hook + guard. `TelegramNotifications.tsx` — component now consumes `useCompanyId()`; `onSnapshot` query on `MESSAGES` adds `where('companyId', '==', companyId)` as first clause, `useEffect` dependency array updated. `vat-validation.ts::checkVatUniqueness(vatNumber, companyId, excludeContactId)` — promoted to required `companyId` parameter (tenant isolation is non-negotiable); `useVatUniqueness` hook absorbs companyId via `useCompanyId()` so its 7 callers (VatNumberField, accounting CustomerSelector / BasicInfoSection / MemberRow / PartnerRow / ShareholderRow + 1) need no changes. Baseline: 50 → **47 violations** (14 → 11 files). | Claude |
| 2026-04-10 | **Ratchet Phase 9 — Server/Infra false-positive annotations**: 6 files (6 violations) cleared by adding inline `🔒 companyId: N/A` justifications within the query() block. **Server-side / admin-only**: `email-worker.ts` (background worker, processes pending email jobs across all tenants — tenant isolation enforced downstream per job), `migrations/003_enterprise_database_architecture_consolidation.ts` (one-time rollback script, elevated privileges). **Generic infrastructure**: `query-middleware.ts` (configurable `ownerField`, tenant scoping passed via `additionalConstraints` by caller), `RelationshipQueryBuilder.ts` (fluent builder — companyId filter is caller's responsibility via `.where('companyId', ...)`). **Data-model deferred**: `useEntityStatusResolver.ts` (batch-get by `documentId()` for units/parking_spots/storage_units — tenant resolved via buildingId/projectId, not a companyId field), `useProjectWorkers.ts` (CONTACT_RELATIONSHIPS legacy schema has no companyId field — full fix requires data migration). **Deferred to next phase** (require real fixes, not annotations): `TelegramNotifications.tsx`, `buildings.service.ts`, `vat-validation.ts`. Baseline: 56 → **50 violations** (20 → 14 files). | Claude |
