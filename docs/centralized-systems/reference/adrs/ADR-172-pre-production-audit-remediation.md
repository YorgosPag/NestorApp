# ADR-172: Pre-Production Code Quality Audit & Remediation

| Metadata | Value |
|----------|-------|
| **Status** | IN_PROGRESS |
| **Date** | 2026-02-10 |
| **Category** | Security & Code Quality / Infrastructure |
| **Author** | Γιώργος Παγώνης + Claude Code |
| **Triggered By** | Pre-Production Audit Report (`local_ΑΝΑΦΟΡΑ_1.txt`) |

---

## 1. Context

Δημιουργήθηκε Pre-Production Audit Report με **7,086 ευρήματα** σε 7 κατηγορίες:

| Κατηγορία | Ευρήματα | Πραγματικά Issues | Σημείωση |
|-----------|----------|-------------------|----------|
| Security (unprotected routes) | 120 | **2** | 118 false positives — ήδη χρησιμοποιούν `withAuth()` |
| Error Handling | 9 | **0** | Όλα χρησιμοποιούν `withAuth` wrapper → ApiError catching |
| Type Safety (`as any`) | 1 | **1** | `as unknown as Contact` double assertion |
| Console.log | 3,624 | **~3,624** | Υπάρχει Logger service, migrate-on-touch strategy |
| Unused Imports | 776 | **~776** | ESLint plugin installed, NOT configured |
| Inline Styles | 81 | **~15** | Τα περισσότερα justified (dynamic values) |
| Hardcoded Strings | 2,475 | **TBD** | Long-term i18n migration |

**Συμπέρασμα Triage**: Τα security findings ήταν κατά 98% false positives. Η εφαρμογή είναι ήδη καλά προστατευμένη.

---

## 2. Decision

Phased remediation approach — από κρίσιμα σε λιγότερο κρίσιμα:

1. **ΦΑΣΗ 1** (CRITICAL): Security fixes — 2 πραγματικά ευρήματα
2. **ΦΑΣΗ 2** (HIGH): Type safety — 1 double assertion fix
3. **ΦΑΣΗ 3** (MEDIUM-HIGH): Unused imports — ESLint auto-fix (776)
4. **ΦΑΣΗ 4** (MEDIUM): Console.log — duplicate logger removal + ESLint upgrade
5. **ΦΑΣΗ 5** (LOW): Inline styles — triage + policy
6. **ΦΑΣΗ 6** (LOW): Hardcoded strings — strategy document only

---

## 3. Security Triage Results

### Route-by-Route Analysis

#### ✅ PROTECTED (False Positives — 7 routes)
| Route | Auth | Rate Limit | Notes |
|-------|------|-----------|-------|
| `/api/admin/migrations/execute-admin` | `withAuth` + `super_admin` | `withSensitiveRateLimit` | Enterprise-grade |
| `/api/admin/migrations/execute` | `withAuth` + `super_admin` | `withSensitiveRateLimit` | GET intentionally public (discovery) |
| `/api/admin/migrations/normalize-floors` | `withAuth` + `super_admin` | `withSensitiveRateLimit` | Enterprise-grade |
| `/api/admin/setup-admin-config` | `withAuth` | `withSensitiveRateLimit` | First-setup open by design |
| `/api/audit/bootstrap` | `withAuth` + permissions | `withSensitiveRateLimit` | Enterprise-grade |
| `/api/buildings/[buildingId]/construction-phases` | `withAuth` + tenant isolation | `withStandardRateLimit` | Full CRUD protected |
| `/api/buildings/[buildingId]/customers` | `withAuth` + tenant isolation | `withStandardRateLimit` | Double tenant validation |

#### ❌ FIXED — 2 Real Issues
| Route | Issue | Fix Applied |
|-------|-------|-------------|
| `/api/admin/ensure-user-profile` | No auth, no rate limit | Added `withAuth` + `withSensitiveRateLimit` |
| `/api/contacts/[contactId]` | Missing rate limiting | Added `withStandardRateLimit` wrapper |

### Error Handling Analysis
Όλα τα 9 routes που flagged για missing error handling χρησιμοποιούν τον `withAuth` wrapper, ο οποίος κάνει catch `ApiError` exceptions μέσω `apiErrorHandler.handleError()`. **Κανένα πραγματικό πρόβλημα**.

---

## 4. Fixes Applied

### ΦΑΣΗ 1: Security (2026-02-10)

**Fix 1**: `src/app/api/admin/ensure-user-profile/route.ts`
- Added `withAuth()` wrapper with `requiredGlobalRoles: ['super_admin', 'company_admin']`
- Added `withSensitiveRateLimit()` wrapper
- Impact: Prevents unauthorized profile creation via Admin SDK

**Fix 2**: `src/app/api/contacts/[contactId]/route.ts`
- Added `withStandardRateLimit()` wrapper
- Impact: Prevents contact enumeration attacks

### ΦΑΣΗ 2: Type Safety (2026-02-10)

**Fix**: `src/app/api/projects/[projectId]/customers/route.ts:208`
- Replaced `as unknown as Contact` with proper Firestore type guard

### ΦΑΣΗ 3: Unused Imports (2026-02-10)

**Config**: `eslint.config.mjs`
- Enabled `unused-imports/no-unused-imports: "error"`
- Enabled `unused-imports/no-unused-vars: ["warn", { varsIgnorePattern: "^_" }]`
- Ran `npx eslint --fix` for auto-cleanup

### ΦΑΣΗ 4: Console.log Cleanup (2026-02-10)

**Fix 1**: Removed duplicate telegram logger
- Deleted: `src/app/api/communications/webhooks/telegram/shared/logging.ts`
- Replaced with: `createModuleLogger('TelegramWebhook')` from `@/lib/telemetry/Logger`

**Fix 2**: ESLint `no-console-log` — upgraded strategy documented
- New code: `error` level (blocked)
- Existing code: `warn` level (migrate-on-touch)

---

## 5. Remaining Work (Long-term)

### Console.log Migration (3,624 remaining)
**Strategy**: Migrate-on-touch — when editing a file, replace `console.log` with `createModuleLogger()`
- Priority files: DxfCanvasAdapter (17), GeoCanvasAdapter (12+)
- Estimated completion: Ongoing over next months

### Inline Styles (81 findings)
**Policy**: Inline styles justified when value is **dynamic at runtime** (brand colors, cursor positions, calculated dimensions). Static inline styles MUST use Tailwind classes.

### Hardcoded Strings (2,475 findings)
**Strategy**: Long-term i18n migration. Categories:
- **UI-visible strings**: Must use `t()` — prioritize customer-facing screens
- **Error messages**: Can remain hardcoded (internal/debugging)
- **Test data**: Can remain hardcoded
- **Admin-only**: Low priority for i18n

---

## 6. Prohibitions (New Code Standards)

Από σήμερα, **νέος κώδικας ΠΡΕΠΕΙ** να:

1. **Χρησιμοποιεί `withAuth()`** σε όλα τα API routes (εκτός webhooks με HMAC verification)
2. **Χρησιμοποιεί `createModuleLogger()`** αντί για `console.log`
3. **Χρησιμοποιεί `t()`** για user-visible strings
4. **ΜΗΝ εισάγει unused imports** (ESLint `error` level)
5. **ΜΗΝ χρησιμοποιεί `as any` ή `as unknown as T`** — proper typing μόνο

---

## Changelog

| Date | Phase | Changes |
|------|-------|---------|
| 2026-02-10 | 1-4 | Initial audit + fixes: security, type safety, unused imports, console.log |
