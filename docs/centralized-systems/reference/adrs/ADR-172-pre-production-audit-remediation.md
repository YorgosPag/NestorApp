# ADR-172: Pre-Production Code Quality Audit & Remediation

| Metadata | Value |
|----------|-------|
| **Status** | PHASE_3_COMPLETE |
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
| Console.log | 3,624 | **~1,500 fixed** | Phase 2: Massive migration → ~2,145 remaining (mostly subapps) |
| Unused Imports | 776 | **~776** | ESLint plugin installed, NOT configured |
| Inline Styles | 81 | **4 fixed** | Phase 2: 4 static → Tailwind, 77 justified (dynamic values) |
| Hardcoded Strings | 2,475 | **~40 fixed** | Phase 2: banking (4 components) + addresses (5 components) i18n |

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

## 5. Phase 2: Massive Remediation (2026-02-10)

### 5.1 Console.log → Logger Migration (~1,500 calls migrated)

**Scope**: 164 files across API routes, services, hooks, and components
**Method**: 12 parallel background agents processing file batches simultaneously

| Batch | Scope | Files | Status |
|-------|-------|-------|--------|
| API Routes — Communications | `src/app/api/communications/` | ~21 | ✅ Complete |
| API Routes — Buildings + Projects | `src/app/api/buildings/`, `projects/` | ~14 | ✅ Complete |
| API Routes — Contacts + Admin | `src/app/api/contacts/`, `admin/` | ~24 | ✅ Partial (agent killed) |
| API Routes — Remaining | `src/app/api/*` | ~47 | ✅ Partial (agent killed) |
| Services A-E | `src/services/a*` through `e*` | ~34 | ✅ Complete |
| Services F-Z | `src/services/f*` through `z*` | ~34 | ✅ Partial (agent killed) |
| Hooks A-M | `src/hooks/a*` through `m*` | ~28 | ✅ Complete |
| Hooks N-Z | `src/hooks/n*` through `z*` | ~26 | ✅ Complete |
| Components shared+contacts | `src/components/shared/`, `contacts/` | ~36 | ✅ Complete |
| Components building+projects | `src/components/building-management/`, `projects/` | ~49 | ✅ Complete |
| Components UI+CRM+generic | `src/components/ui/`, `crm/`, etc. | ~43 | ✅ Complete |
| Components remaining | Remaining component files | ~50 | ✅ Complete |

**Pattern used in each file:**
```typescript
import { createModuleLogger } from '@/lib/telemetry';
const logger = createModuleLogger('ModuleName');

// console.log('msg', data) → logger.info('msg', { data })
// console.warn('msg')      → logger.warn('msg')
// console.error('msg', e)  → logger.error('msg', { error: e })
```

**Results**: console.log reduced from ~3,624 to ~2,145 (~1,500 migrated). Remaining calls are mostly in `subapps/dxf-viewer` and `subapps/geo-canvas` (out of scope — different architecture).

### 5.2 Inline Styles Fix (4 static → Tailwind)

| File | Before | After |
|------|--------|-------|
| `UnifiedColorPicker.tsx` | `style={{ width: '6rem' }}` | `className="w-24"` |
| `CanvasSection.tsx` | `style={{ cursor: 'none' }}` | `className="cursor-none"` |
| `EnterpriseColorDialog.tsx:194` | `style={{ pointerEvents: 'none' }}` | `className="pointer-events-none"` |
| `EnterpriseColorDialog.tsx:254` | `style={{ cursor: 'default', pointerEvents: 'auto' }}` | `className="cursor-default pointer-events-auto"` |

Note: Dynamic inline styles (zIndex, brand colors, calculated dimensions) remain as `style={{}}` — this is correct per policy.

### 5.3 i18n — Banking Namespace (0% → 100%)

**New files:**
- `src/i18n/locales/el/banking.json` — Greek translations
- `src/i18n/locales/en/banking.json` — English translations

**Updated components (4):**
- `BankSelector.tsx` — label, placeholder, group headers
- `IBANInput.tsx` — label, validation messages
- `BankAccountCard.tsx` — status labels, action buttons
- `BankAccountForm.tsx` — all form labels, validation, submit buttons

**Registration**: Added `'banking'` namespace to `src/i18n/lazy-config.ts`

### 5.4 i18n — Addresses Namespace (0% → 100%)

**New files:**
- `src/i18n/locales/el/addresses.json` — Greek translations
- `src/i18n/locales/en/addresses.json` — English translations

**Updated components (5):**
- `AddressFormSection.tsx` — form labels, placeholders, validation
- `AddressCard.tsx` — display labels, type names
- `AddressListCard.tsx` — list headers, empty states
- `AddressMap.tsx` — map labels
- `AddressMarker.tsx` — marker labels

**Registration**: Added `'addresses'` namespace to `src/i18n/lazy-config.ts`

---

## 6. Phase 3: DXF Viewer OpenAI Audit Remediation (2026-02-12)

External OpenAI audit report identified findings across 4 severity levels in the DXF Viewer subapp. All fixes applied in 4 commits.

### 6.1 CRITICAL — Auth Bypass Removal

| File | Issue | Fix |
|------|-------|-----|
| `src/app/dxf/viewer/page.tsx` | `AdminGuard` bypassed entirely in `NODE_ENV === 'development'` | Removed 4-line dev bypass. `useUserRole()` works in dev+prod |

### 6.2 HIGH — Dead Code + Environment Guard

| File | Issue | Fix |
|------|-------|-----|
| `src/subapps/dxf-viewer/DxfViewerApp.tsx` | Duplicate `CanvasProvider` — outer one was dead code (inner one in DxfViewerContent is the real consumer) | Removed outer `CanvasProvider` + import |
| `src/subapps/dxf-viewer/DxfViewerApp.tsx` | `LevelsSystem enableFirestore` always true — unnecessary Firestore connections in dev | Changed to `enableFirestore={process.env.NODE_ENV === 'production'}` |

### 6.3 MEDIUM — Centralized Constants + Debug Logging

| File | Issue | Fix |
|------|-------|-----|
| `EnterpriseColorDialog.tsx` | Hardcoded z-index `2147483646`/`2147483647` | → `MODAL_Z_INDEX.COLOR_DIALOG_CONTAINER` / `MODAL_Z_INDEX.COLOR_DIALOG` |
| `EnterpriseColorDialog.tsx` | Inline `pointerEvents`/`isolation` styles | → Tailwind `pointer-events-auto isolate` |
| `BaseModal.tsx` | Mock `portalComponents` object (identity function) | Removed mock, direct `zIndex` / `zIndex + 1` |
| `CanvasSection.tsx` | Hardcoded `?? 30` fallback | → `?? COORDINATE_LAYOUT.RULER_TOP_HEIGHT` |
| `DxfViewerContent.tsx` | 6 unconditional `console.log` in core render flow | → `dlog('DxfViewerContent', ...)` via UnifiedDebugManager |

### 6.4 LOW — Orphaned Legacy Files

| File | Action |
|------|--------|
| `config/modal-select-old.ts` | `git rm` — no imports found |
| `afairesh_DXFcanvasRefactored.txt` | `git rm` — no references found |

### 6.5 Deferred

- **CentralizedAutoSaveStatus.tsx**: 297-line style companion file → Tailwind/CSS modules conversion deferred to separate PR
- **TypeScript errors** (`isLlc`, `calculateEPETax`): Confirmed as stale findings — code compiles successfully

---

## 7. Remaining Work (Long-term)

### Console.log (~2,139 remaining)
**Strategy**: Continue migrate-on-touch for non-subapp files. DXF Viewer core render flow now uses `dlog()`. Remaining DXF calls use `dlog` or `DEBUG_DXF_VIEWER_CONTENT` flag.

### Inline Styles (~76 remaining)
**Policy**: All remaining are justified (dynamic values). No action needed.

### Hardcoded Strings (~2,435 remaining)
**Strategy**: Long-term i18n migration. Categories:
- **UI-visible strings**: Must use `t()` — prioritize customer-facing screens
- **Error messages**: Can remain hardcoded (internal/debugging)
- **Test data**: Can remain hardcoded
- **Admin-only**: Low priority for i18n

---

## 8. Prohibitions (New Code Standards)

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
| 2026-02-10 | Phase 2 | Massive remediation: ~1,500 console.log → Logger, 4 inline styles → Tailwind, i18n banking (4 components) + addresses (5 components). 164 files, 4250 insertions, 1647 deletions |
| 2026-02-12 | Phase 3 | DXF Viewer OpenAI audit: CRITICAL auth bypass removed, duplicate CanvasProvider removed, LevelsSystem Firestore guarded, hardcoded z-index → MODAL_Z_INDEX, mock portalComponents removed, hardcoded px → centralized constant, 6 console.log → dlog, 2 orphaned files deleted |
