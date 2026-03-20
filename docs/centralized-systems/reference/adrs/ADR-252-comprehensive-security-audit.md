# ADR-252: Comprehensive Security Audit

| Field | Value |
|-------|-------|
| **Status** | ✅ PHASE_1_IMPLEMENTED |
| **Date** | 2026-03-19 |
| **Category** | Security / Infrastructure |
| **Depends On** | ADR-249, ADR-250 |
| **Scope** | Full application: Firestore Rules, API Routes, Server-side Validation |

---

## 1. Context & Motivation

Μετά τα P0 fixes του ADR-250 (S-1, S-2, F-2), ο Γιώργος ζήτησε **ολοκληρωμένο security audit** σε 3 άξονες:

1. **Firestore Rules** — Database-level access control
2. **API Routes** — Server-side authentication & authorization
3. **Server-side Validation** — Input validation & business logic guards

Αυτό το ADR συγκεντρώνει τα ευρήματα από 3 παράλληλα audits σε ενιαίο αναφοράς document.

**Στόχος:** Τεκμηρίωση ΜΟΝΟ — zero code changes.

---

## 2. Executive Summary

| Axis | Critical | High | Medium | Total |
|------|----------|------|--------|-------|
| **Firestore Rules** | 3 | 3 | 3 | 9 |
| **API Routes** | 0 | 0 | 4 | 4 |
| **Server-side Validation** | 2 | 2 | 1 | 5 |
| **TOTAL** | **5** | **5** | **8** | **18** |

**Overall Verdict:** ⚠️ Acceptable for Development, ❌ NOT Production-Ready

**Positive highlights:**
- Zero Trust architecture (deny-by-default in Firestore rules)
- 86+ API routes with rate limiting (multi-tier: standard/heavy/webhook/sensitive)
- HMAC-SHA256 webhook validation (timing-safe)
- Enterprise RBAC via `withAuth()` + PermissionCache
- Immutable audit trails (attendance events: append-only)
- Deletion guards with dependency checking (ADR-226)

---

## 3. Axis 1: Firestore Rules Audit

**File:** `firestore.rules` (3,095 lines)
**Architecture:** Deny-by-default (`allow read, write: if false;` at root)

### 3.1 Positive Patterns

| Pattern | Implementation |
|---------|---------------|
| Default DENY | Line 20-22: `allow read, write: if false;` |
| Tenant isolation | `belongsToCompany()` helper on sensitive collections |
| Super admin bypass | Controlled exception for cross-tenant admin ops |
| Creator ownership | `createdBy == request.auth.uid` checks |
| Immutable audit trail | `attendance_events`: CREATE only, UPDATE/DELETE forbidden |
| Enum validation | eventType, method validated in rules |
| Field presence checks | Required fields enforced at database level |

### 3.2 Critical Findings (3)

#### FR-C1: cadFiles — Cross-Tenant Read + Delete

| Field | Detail |
|-------|--------|
| **Severity** | 🔴 CRITICAL |
| **Collection** | `cadFiles` |
| **Issue** | Missing `belongsToCompany()` filter on READ and DELETE |
| **Impact** | User from Company A can read/delete CAD files of Company B |
| **Risk** | Total data breach of proprietary engineering drawings |
| **Fix** | Add `belongsToCompany(resource.data.companyId)` to read/delete rules |

#### FR-C2: file_shares — Public Read + Update

| Field | Detail |
|-------|--------|
| **Severity** | 🔴 CRITICAL |
| **Collection** | `file_shares` |
| **Issue** | Any authenticated user can READ all shares and UPDATE without ownership check |
| **Impact** | Exposure of all file sharing metadata; unauthorized share modifications |
| **Risk** | Data exfiltration via share enumeration |
| **Fix** | Add tenant isolation + ownership validation on READ/UPDATE |

#### FR-C3: companies — Cross-Tenant Read

| Field | Detail |
|-------|--------|
| **Severity** | 🔴 CRITICAL |
| **Collection** | `companies` |
| **Issue** | Missing tenant filter on READ — any authenticated user can list all companies |
| **Impact** | Competitive intelligence leak (company names, metadata) |
| **Risk** | Business data exposure |
| **Fix** | Restrict READ to own company document only |

### 3.3 High Findings (3)

#### FR-H1: boq_items — No companyId Ownership Validation

| Field | Detail |
|-------|--------|
| **Severity** | 🟠 HIGH |
| **Collection** | `boq_items` |
| **Issue** | No `companyId` field validation on CREATE/READ |
| **Impact** | Cross-tenant access to Bill of Quantities data |
| **Fix** | Add `companyId` field requirement + tenant filter |

#### FR-H2: ownership_tables — Fully Open

| Field | Detail |
|-------|--------|
| **Severity** | 🟠 HIGH |
| **Collection** | `ownership_tables` |
| **Issue** | No tenant isolation — any authenticated user has full access |
| **Impact** | Property ownership data exposed cross-tenant |
| **Fix** | Implement `belongsToCompany()` on all CRUD operations |

#### FR-H3: 6+ Collections Missing Tenant Filter

| Field | Detail |
|-------|--------|
| **Severity** | 🟠 HIGH |
| **Collections** | `contact_relationships`, `contact_links`, `attendance_qr_tokens`, `boq_categories`, `employment_records`, `attendance_events` |
| **Issue** | READ rules use `isAuthenticated()` without `belongsToCompany()` |
| **Impact** | Cross-tenant data leakage for relationship metadata, attendance tokens, employment data |
| **Fix** | Add `companyId` field to these collections + enforce in rules |

### 3.4 Medium Findings (3)

#### FR-M1: system/config — Overly Permissive Reads

| Field | Detail |
|-------|--------|
| **Severity** | 🟡 MEDIUM |
| **Collection** | `system` (config subcollection) |
| **Issue** | Broad read access may expose internal configuration |
| **Impact** | Internal routing rules, feature flags visible to all users |
| **Fix** | Restrict to admin-only or split public/private config |

#### FR-M2: boq_items CREATE Without companyId

| Field | Detail |
|-------|--------|
| **Severity** | 🟡 MEDIUM |
| **Collection** | `boq_items` |
| **Issue** | Documents can be created without `companyId` field |
| **Impact** | Orphaned documents without tenant association |
| **Fix** | Require `companyId` in CREATE rules |

#### FR-M3: Missing Business Logic in Rules

| Field | Detail |
|-------|--------|
| **Severity** | 🟡 MEDIUM |
| **Scope** | All financial collections |
| **Issue** | No state transition validation (e.g., payment: paid→pending) |
| **Impact** | Invalid financial states possible at database level |
| **Fix** | Server-side state machine validation (rules too limited for complex logic) |

---

## 4. Axis 2: API Routes Audit

**Total Routes:** 209 across all modules
**Architecture:** Next.js Route Handlers with middleware composition

### 4.1 Positive Patterns

| Pattern | Coverage |
|---------|----------|
| `withAuth()` middleware | All protected routes (40+ verified) |
| `withStandardRateLimit` (60 req/min) | Standard operations |
| `withHeavyRateLimit` (10 req/min) | Public/brute-force endpoints |
| `withWebhookRateLimit` (100 req/min) | Inbound webhooks |
| `withSensitiveRateLimit` (20 req/min) | Admin operations |
| RBAC permissions | `projects:projects:view`, `contacts:contacts:update`, etc. |
| Tenant isolation | `companyId` validated in request context |
| Audit logging | `logAuditEvent()` on mutations |
| HMAC webhook validation | Mailgun, Telegram (timing-safe) |
| Bootstrap fail-closed | `NODE_ENV === 'production'` → 403 |

### 4.2 Route Security Matrix

| Module | Routes | Auth | Rate Limit | Validation | Status |
|--------|--------|------|------------|------------|--------|
| **Accounting** | 27 | ✅ withAuth | ✅ Standard | ✅ TypeScript types | SOLID |
| **Projects** | 11 | ✅ withAuth + RBAC | ✅ Standard | ✅ Tenant check | SOLID |
| **Contacts** | 8 | ✅ withAuth + RBAC | ✅ Standard | ✅ Deletion guard | SOLID |
| **Units** | 12 | ✅ withAuth | ✅ Standard | ✅ Field locking (SPEC-249A) | SOLID |
| **Files** | 15 | ✅ withAuth | ✅ Standard | ✅ Path validation | SOLID |
| **Attendance** | 5 | ⚠️ Mixed (public check-in) | ✅ Heavy for public | ✅ AMKA + HMAC | ACCEPTABLE |
| **Communications** | 8 | ✅ Webhook HMAC | ✅ Webhook rate | ✅ Signature | SOLID |
| **Admin** | 34 | ✅ withAuth + guards | ✅ Sensitive | ✅ Dev-only gates | SOLID |
| **Floors** | 3 | ✅ withAuth | ✅ Standard | ✅ Uniqueness (SPEC-249A) | SOLID |

### 4.3 Medium Findings (4)

#### AR-M1: Bootstrap Admin — Default Secret Risk

| Field | Detail |
|-------|--------|
| **Severity** | 🟡 MEDIUM |
| **Endpoint** | `/api/admin/bootstrap-admin` |
| **Issue** | Relies on env var `BOOTSTRAP_ADMIN_SECRET` — if weak or default, risk of unauthorized admin creation |
| **Mitigation** | Endpoint is fail-closed in production (`NODE_ENV` check), one-time use guard |
| **Fix** | Verify secret strength; consider removing endpoint entirely post-bootstrap |

#### AR-M2: Invoice Input Sanitization

| Field | Detail |
|-------|--------|
| **Severity** | 🟡 MEDIUM |
| **Endpoint** | `/api/accounting/invoices` |
| **Issue** | Type assertions (`as CreateInvoiceInput`) without runtime validation |
| **Impact** | Malformed data could pass type checks but fail business logic |
| **Fix** | Add Zod schema validation at route entry point |

#### AR-M3: Watermark Endpoint — SSRF Potential

| Field | Detail |
|-------|--------|
| **Severity** | 🟡 MEDIUM |
| **Endpoint** | Watermark/image processing routes |
| **Issue** | If URL parameters are accepted for image sources, potential SSRF |
| **Mitigation** | Heavy rate limiting (10 req/min) |
| **Fix** | Validate URL origins against allowlist; restrict to Firebase Storage URLs |

#### AR-M4: Search Query Validation

| Field | Detail |
|-------|--------|
| **Severity** | 🟡 MEDIUM |
| **Endpoints** | Search routes across modules |
| **Issue** | Query parameters parsed without sanitization (type coercion, NaN handling) |
| **Impact** | Unexpected behavior on malformed queries |
| **Fix** | Centralized input validation middleware (`@/lib/api/input-validators.ts`) |

---

## 5. Axis 3: Server-side Validation Audit

**Scope:** Input validation, business logic guards, data sanitization

### 5.1 Positive Patterns

| Pattern | Implementation |
|---------|---------------|
| Deletion guard | `executeDeletion()` with dependency checking (ADR-226) |
| Invoice immutability | Status check before PATCH (SPEC-249A P0-1) |
| Field locking | 19 locked fields for sold/rented units (SPEC-249A P0-2) |
| Floor uniqueness | `(buildingId, number)` check before create (SPEC-249A P0-3) |
| Name cascade | `propagateContactNameChange()` (SPEC-249B P1-1/2) |
| Cross-company guard | `companyId` match on entity linking (SPEC-249B P1-3) |
| Installment sum check | Route-level + service-level (SPEC-249C P2-2) |

### 5.2 Critical Findings (2)

#### SV-C1: Photo Upload — Path Traversal Vulnerability

| Field | Detail |
|-------|--------|
| **Severity** | 🔴 CRITICAL |
| **Location** | Photo/file upload handlers |
| **Issue** | `folderPath` parameter lacks sanitization — no `..` sequence blocking, no path normalization |
| **Attack** | Attacker sends `folderPath: "../../sensitive/"` → writes to unauthorized directories |
| **Impact** | Access to unauthorized Firebase Storage paths; potential data overwrite |
| **Fix** | Implement whitelist validation, `path.normalize()`, reject `..` sequences, validate against allowed prefixes |

#### SV-C2: Message Content — Stored XSS

| Field | Detail |
|-------|--------|
| **Severity** | 🔴 CRITICAL |
| **Location** | Message processing pipeline (Mailgun webhook → Firestore) |
| **Issue** | HTML email content stored in Firestore without sanitization |
| **Attack** | Malicious email with `<script>` tags → stored in `messages` collection → rendered to operator |
| **Impact** | Stored XSS attack on operator inbox users |
| **Mitigation** | Frontend uses `SafeHTMLContent` with DOMPurify for rendering |
| **Fix** | Add DOMPurify sanitization at **ingestion point** (defense-in-depth); don't rely solely on render-time sanitization |

### 5.3 High Findings (2)

#### SV-H1: Mailgun Email HTML — Unsanitized Storage

| Field | Detail |
|-------|--------|
| **Severity** | 🟠 HIGH |
| **Location** | Mailgun webhook inbound handler |
| **Issue** | Raw HTML from inbound emails stored directly in Firestore without sanitization |
| **Impact** | Stored XSS if any rendering path bypasses DOMPurify |
| **Related** | SV-C2 (same root cause, different entry point) |
| **Fix** | Sanitize at webhook processing layer before Firestore write |

#### SV-H2: Accounting Invoice Type — Insufficient Validation

| Field | Detail |
|-------|--------|
| **Severity** | 🟠 HIGH |
| **Location** | Invoice creation/update endpoints |
| **Issue** | Invoice `type` field not validated against enum at server-side; relies on TypeScript type assertions |
| **Impact** | Invalid invoice types could be persisted, breaking downstream processes (VAT, tax calculations) |
| **Fix** | Runtime enum validation with Zod or manual check before Firestore write |

### 5.4 Medium Findings (1)

#### SV-M1: Webhook Timestamp — Replay Attack Potential

| Field | Detail |
|-------|--------|
| **Severity** | 🟡 MEDIUM |
| **Location** | Mailgun webhook handler |
| **Issue** | Missing timestamp freshness validation — old webhook payloads could be replayed |
| **Mitigation** | HMAC signature still required (so attacker needs the signing key) |
| **Fix** | Reject webhooks older than 5 minutes; add nonce/idempotency check |

---

## 6. Priority Matrix

### P0 — CRITICAL (Immediate Fix Required)

| ID | Finding | Axis | Impact |
|----|---------|------|--------|
| FR-C1 | cadFiles cross-tenant read+delete | Firestore | Total data breach of CAD files |
| FR-C2 | file_shares public read+update | Firestore | Share metadata exposure |
| FR-C3 | companies cross-tenant read | Firestore | Business intelligence leak |
| SV-C1 | Photo upload path traversal | Validation | Unauthorized storage access |
| SV-C2 | Message content stored XSS | Validation | XSS attack on operators |

### P1 — HIGH (Fix Within 1 Week)

| ID | Finding | Axis | Impact |
|----|---------|------|--------|
| FR-H1 | boq_items no companyId | Firestore | Cross-tenant BOQ access |
| FR-H2 | ownership_tables fully open | Firestore | Property data exposure |
| FR-H3 | 6+ collections missing tenant filter | Firestore | Broad cross-tenant leakage |
| SV-H1 | Mailgun HTML unsanitized | Validation | Stored XSS via email |
| SV-H2 | Invoice type insufficient validation | Validation | Financial data corruption |

### P2 — MEDIUM (Fix Within 2 Weeks)

| ID | Finding | Axis | Impact |
|----|---------|------|--------|
| FR-M1 | system/config overly permissive | Firestore | Internal config exposure |
| FR-M2 | boq_items create without companyId | Firestore | Orphaned documents |
| FR-M3 | Missing business logic in rules | Firestore | Invalid financial states |
| AR-M1 | Bootstrap admin default secret | API | Unauthorized admin creation |
| AR-M2 | Invoice input sanitization | API | Malformed data persistence |
| AR-M3 | Watermark SSRF potential | API | Server-side request forgery |
| AR-M4 | Search query validation | API | Unexpected query behavior |
| SV-M1 | Webhook timestamp replay | Validation | Replay attacks |

---

## 7. Remediation Roadmap

### Phase 1: Critical Firestore Rules (Week 1)

```
Target: FR-C1, FR-C2, FR-C3
Scope: Add belongsToCompany() to cadFiles, file_shares, companies
Effort: 2-4 hours
Risk: May break admin tools relying on cross-tenant reads
Test: Verify tenant isolation, verify super admin bypass still works
```

### Phase 2: Path Traversal + XSS (Week 1)

```
Target: SV-C1, SV-C2, SV-H1
Scope: Photo upload path validation, DOMPurify at ingestion
Effort: 4-6 hours
Risk: Low — additive validation, no behavior change for valid inputs
Test: Upload with '../' paths, send email with script tags
```

### Phase 3: Tenant Isolation Completion (Week 2)

```
Target: FR-H1, FR-H2, FR-H3
Scope: Add companyId to 6+ collections, update rules
Effort: 8-12 hours (includes migration of existing documents)
Risk: Medium — documents without companyId will be inaccessible
Test: Cross-tenant query attempts from different company accounts
```

### Phase 4: Validation Hardening (Week 2-3)

```
Target: SV-H2, AR-M1-M4, FR-M1-M3, SV-M1
Scope: Zod schemas, input validators, timestamp checks
Effort: 6-8 hours
Risk: Low — additive validation
Test: Malformed requests, expired webhooks, NaN parameters
```

---

## 8. Compliance Checklist

| Item | Status | Notes |
|------|--------|-------|
| Default Deny Rules | ✅ PASS | Root-level deny in Firestore rules |
| Authentication Required | ✅ PASS | `withAuth()` on all protected routes |
| Tenant Isolation | ⚠️ PARTIAL | 8 collections done, 9+ remaining |
| Rate Limiting | ✅ PASS | 86+ routes with multi-tier limits |
| Input Validation | ⚠️ PARTIAL | TypeScript types, no centralized Zod framework |
| XSS Prevention | ⚠️ PARTIAL | Render-time DOMPurify, missing ingestion-time sanitization |
| CSRF Protection | ✅ PASS | NextAuth/Firebase session handling |
| SQL Injection | ✅ N/A | Firestore (no SQL) |
| RBAC | ✅ PASS | Permission-based access via PermissionCache |
| Audit Logging | ✅ PASS | EntityAuditService + deletion guard logging |
| Webhook Validation | ✅ PASS | HMAC-SHA256, timing-safe comparison |
| Secrets Management | ⚠️ CHECK | Env vars used correctly, strength unverified |

---

## 9. Relationship to Other ADRs

| ADR | Relationship |
|-----|-------------|
| **ADR-249** | Parent audit — server-side integrity focus |
| **ADR-250** | P0 fixes implemented (S-1, S-2, F-2) — this ADR extends the analysis |
| **SPEC-249A** | Invoice immutability, field locking, floor uniqueness — ✅ implemented |
| **SPEC-249B** | Name cascade, cross-company guard — ✅ implemented |
| **SPEC-249C** | unitCoverage drift, installment sum — ✅ implemented |
| **SECURITY_AUDIT_REPORT.md** | Original 2025-12-15 audit — this ADR supersedes with deeper analysis |

---

## 10. Changelog

| Date | Change |
|------|--------|
| 2026-03-19 | Initial creation — 18 findings across 3 axes (5 Critical, 5 High, 8 Medium) |
| 2026-03-20 | **PHASE 1 IMPLEMENTED** — 11 unique fixes across Firestore Rules + Server-side: |
| | **Firestore Rules (9 fixes):** FR-C1 (cadFiles tenant isolation), FR-C2 (file_shares CREATE companyId enforcement + UPDATE tenant-scoped), FR-C3 (companies own-company-only READ), FR-H1 (boq_items CREATE/READ/UPDATE/DELETE tenant check), FR-H2 (ownership_tables full tenant isolation), FR-H3 (6 collections: contact_relationships, contact_links, attendance_qr_tokens, boq_categories, employment_records, attendance_events — tenant-scoped READ), FR-M1 (system collection → isCompanyAdmin() + merged duplicate blocks, removed dangerous duplicate config block with open writes) |
| | **Server-side (5 fixes):** SV-C1 (path traversal prevention — `sanitizeStoragePath()` in photo upload), AR-M3 (SSRF prevention — `validateFetchUrl()` + AbortSignal.timeout in watermark API), SV-H1 (email HTML defense-in-depth — `sanitizeHtmlForStorage()` before Firestore write), SV-H2 (invoice type runtime enum validation), SV-M1 (webhook timestamp replay rejection — 5 min max age) |
| | **New file:** `src/lib/security/path-sanitizer.ts` — centralized security utilities |
