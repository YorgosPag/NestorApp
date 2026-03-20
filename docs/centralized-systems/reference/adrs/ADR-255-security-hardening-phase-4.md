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
| 3 | Client-Side Writes Migration | [SPEC-255C](./specs/SPEC-255C-client-writes-migration.md) | 19 files (3 CRITICAL) | **P1** | 8h | 📋 PLANNED |
| 4 | Input Validation — Zod | [SPEC-255D](./specs/SPEC-255D-input-validation-zod.md) | 73 routes without Zod | **P2** | incremental | 📋 PLANNED |
| 5 | Financial Audit Trail | [SPEC-255E](./specs/SPEC-255E-audit-trail-financial-ops.md) | ~15 transitions + ~35 DELETEs | **P1** | 6h | ✅ IMPLEMENTED (partial — 5 transitions + 1 DELETE) |
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
