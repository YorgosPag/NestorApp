# ADR-077: Firebase Admin SDK — Unified Lazy Initialization

| Metadata | Value |
|----------|-------|
| **Status** | IMPLEMENTED |
| **Date** | 2026-02-06 |
| **Category** | Infrastructure & SDK |
| **Canonical Location** | `src/lib/firebaseAdmin.ts` |
| **Author** | Giorgos Pagonis + Claude Code (Anthropic AI) |

---

## Context

The application had **3 competing Firebase Admin initialization systems**:

| System | File | Pattern | Consumers | Issue |
|--------|------|---------|-----------|-------|
| **Canonical** | `src/lib/firebaseAdmin.ts` | `export const adminDb = getFirestore()` (EAGER) | ~55 files | **Crashes at module load** |
| **Deprecated** | `src/lib/firebase-admin.ts` | `export { getDB as db }` (LAZY function) | ~15 files | Duplicate init logic |
| **Wrapper** | `src/server/admin/admin-guards.ts` | `getAdminFirestore()` (LAZY function) | ~4 files | Duplicate init logic |

### Root Cause

`firebaseAdmin.ts:153` — `export const adminDb = getFirestore()` executes **eagerly** at module load time. If `initializeApp()` fails (missing credentials, JSON parse error, network issues), `getFirestore()` crashes immediately, taking down all importing modules.

This is an **anti-pattern** in enterprise applications. AWS SDK v3, Google Cloud SDK, and SAP Cloud SDK all use **lazy function exports**.

---

## Decision

### Unified Lazy Initialization Architecture

All Firebase Admin SDK initialization is now handled by a single module (`src/lib/firebaseAdmin.ts`) using:

1. **Lazy singleton pattern** (Google Cloud SDK / AWS SDK v3)
2. **Credential chain**: B64 → JSON → Application Default Credentials
3. **Zero module-load side effects** (no eager `getFirestore()`/`getAuth()`)
4. **Custom error class** (`FirebaseAdminInitError`) with structured context
5. **Type-safe interfaces** — zero `any`, zero `@ts-ignore`

### New Canonical API

```typescript
// Primary API (lazy — safe)
export function getAdminFirestore(): Firestore { ... }
export function getAdminAuth(): Auth { ... }

// Diagnostics (non-throwing)
export function isFirebaseAdminAvailable(): boolean { ... }
export function getAdminDiagnostics(): AdminDiagnosticReport { ... }

// Safe operations wrapper
export async function safeFirestoreOperation<T>(
  operation: (db: Firestore) => Promise<T>,
  fallback: T
): Promise<T> { ... }
```

### Credential Chain (Priority Order)

1. **B64** — `FIREBASE_SERVICE_ACCOUNT_KEY_B64` (Base64, safe for Vercel)
2. **JSON** — `FIREBASE_SERVICE_ACCOUNT_KEY` (Plain JSON)
3. **Application Default Credentials** — `GOOGLE_APPLICATION_CREDENTIALS` (development)

---

## Alternatives Rejected

1. **Proxy backward compatibility** — Workaround, not enterprise-grade
2. **Keep 3 systems** — Maintenance nightmare, inconsistent behavior
3. **Full const removal without migration** — Too disruptive for a single PR

---

## Implementation

### Phase 0: Rewrite `firebaseAdmin.ts`
- Replaced module-level eager initialization with lazy `ensureInitialized()` function
- Added credential chain (B64 → JSON → ADC)
- Added `ServiceAccountCredential` interface, `FirebaseAdminInitError` class
- Added `getAdminFirestore()`, `getAdminAuth()`, `isFirebaseAdminAvailable()`, `getAdminDiagnostics()`
- Added `safeFirestoreOperation()` (replaces `safeDbOperation` from deprecated module)

### Phase 1: Migrated 17 `firebase-admin.ts` consumers
- All `import { db } from '@/lib/firebase-admin'` → `import { getAdminFirestore } from '@/lib/firebaseAdmin'`
- All `db()` calls → `getAdminFirestore()` calls

### Phase 2: Migrated ~50 `adminDb`/`adminAuth` const consumers
- All `import { adminDb } from '@/lib/firebaseAdmin'` → `import { getAdminFirestore } from '@/lib/firebaseAdmin'`
- All `adminDb.collection(...)` → `getAdminFirestore().collection(...)`
- Auth consumers: `adminAuth.verifyIdToken(...)` → `getAdminAuth().verifyIdToken(...)`

### Phase 3: Unified `admin-guards.ts` + Cleanup
- Removed duplicate `initializeAdmin()` function from `admin-guards.ts`
- Replaced `getAdminFirestore()` implementation with re-export from canonical module
- Updated `verifyIdToken()` and `verifySessionCookieToken()` to use `getAdminAuth()`
- Deleted `src/lib/firebase-admin.ts` (deprecated module)

---

## Files Changed

| File | Action |
|------|--------|
| `src/lib/firebaseAdmin.ts` | **REWRITE** — Lazy init + credential chain |
| `src/lib/firebase-admin.ts` | **DELETED** |
| `src/server/admin/admin-guards.ts` | **EDIT** — Removed duplicate init, re-exports from canonical |
| ~70 consumer files in `src/` | **EDIT** — Import migration |

---

## Verification

```bash
# Zero imports from deprecated module
grep -r "from '@/lib/firebase-admin'" src/
# Expected: 0 results

# Zero eager const imports
grep -r "import.*adminDb.*from '@/lib/firebaseAdmin'" src/
# Expected: 0 results

# TypeScript compilation
npx tsc --noEmit
# Expected: 0 firebase-related errors

# Runtime verification
npm run dev
# Expected: No "default Firebase app does not exist" errors
```

---

---

## Phase 4: Full Migration — Eliminate Manual Initialization (2026-02-06)

### Problem Addressed
13 files bypassed the centralized module with manual `initializeApp()` / `getApps()` / `getFirestore()` calls. This caused:
- **CRITICAL BUG**: Files using `initializeApp({ projectId })` without credentials → Firebase stuck in ADC mode
- **HARDCODED VALUES**: `'nestor-pagonis'` hardcoded in 2 files
- **DUPLICATE CREDENTIAL CHAIN**: 3 files copied B64/JSON credential parsing logic

### Changes Made

#### A. Centralized Module Extended (`src/lib/firebaseAdmin.ts`)
- Added `getAdminStorage()` — Lazy singleton for Firebase Storage
- Added `storageBucket` config in credential chain initialization
- Added re-exports: `FieldValue`, `Timestamp`, `FieldPath` (runtime + type)
- Added `Storage` type re-export

#### B. Auth Core (3 files)
| File | Change |
|------|--------|
| `src/lib/auth/auth-context.ts` | Removed `getAdminApp()` function, uses `getAdminAuth()` + `isFirebaseAdminAvailable()` |
| `src/lib/auth/permissions.ts` | Removed `getDb()` manual init, uses `getAdminFirestore()` + `isFirebaseAdminAvailable()` |
| `src/lib/auth/audit.ts` | Removed `getDb()` manual init, uses `getAdminFirestore()` + `isFirebaseAdminAvailable()` + `FieldValue` |

#### C. Admin Routes — No Credentials (5 files)
| File | Change |
|------|--------|
| `src/app/api/admin/create-clean-projects/route.ts` | Removed module-scope init block, uses `getAdminFirestore()` in handler |
| `src/app/api/admin/fix-projects-direct/route.ts` | Same pattern |
| `src/app/api/admin/migrations/normalize-floors/route.ts` | Same pattern, **removed hardcoded `'nestor-pagonis'`** |
| `src/app/api/admin/migrations/execute-admin/route.ts` | Same pattern, **removed hardcoded `'nestor-pagonis'`** |
| `src/app/api/fix-projects/route.ts` | Same pattern, **removed hardcoded `'nestor-pagonis'` fallback** |

#### D. Storage Routes — Duplicate Credential Chain (3 files)
| File | Change |
|------|--------|
| `src/app/api/upload/photo/route.ts` | Removed 30-line init block, uses `getAdminStorage()` |
| `src/app/api/floorplans/process/route.ts` | Removed 30-line init block, uses `getAdminFirestore()` + `getAdminStorage()` |
| `src/app/api/floorplans/scene/route.ts` | Removed 30-line init block, uses `getAdminFirestore()` + `getAdminStorage()` |

#### E. Telegram Dynamic Imports (2 files)
| File | Change |
|------|--------|
| `src/app/api/communications/webhooks/telegram/firebase/helpers-lazy.ts` | `await import('firebase-admin/firestore')` → `await import('@/lib/firebaseAdmin')` |
| `src/app/api/communications/webhooks/telegram/telegram/media-download.ts` | 4 dynamic imports migrated to `@/lib/firebaseAdmin` |

### Canonical API (Updated)

```typescript
// Primary API (lazy singletons)
export function getAdminFirestore(): Firestore { ... }
export function getAdminAuth(): Auth { ... }
export function getAdminStorage(): Storage { ... }  // NEW

// Diagnostics (non-throwing)
export function isFirebaseAdminAvailable(): boolean { ... }
export function getAdminDiagnostics(): AdminDiagnosticReport { ... }

// Safe operations wrapper
export async function safeFirestoreOperation<T>(...): Promise<T> { ... }

// Re-exports (avoid direct firebase-admin imports)
export { FieldValue, Timestamp, FieldPath };
export type { Firestore, Auth, Storage };
```

### Verification Results (2026-02-06)

```bash
# Zero direct firebase-admin/app imports (except centralized module)
grep -r "from 'firebase-admin/app'" src/ --include="*.ts"
# Result: ONLY src/lib/firebaseAdmin.ts ✅

# TypeScript compilation
npx tsc --noEmit
# Result: 0 new errors ✅
```

---

## Consequences

### Positive
- **No more module-load crashes** — SDK initializes lazily on first use
- **Single source of truth** — One module, one credential chain, one initialization path
- **Better error messages** — `FirebaseAdminInitError` with credential source and environment context
- **B64 credential support** — Safe for Vercel environment variables
- **Diagnostics API** — `getAdminDiagnostics()` for health-check endpoints
- **Storage support** — `getAdminStorage()` with storageBucket config
- **Zero hardcoded project IDs** — All project IDs from environment variables
- **Zero duplicate credential chains** — One chain in centralized module

### Negative
- Each handler function call triggers a (cached) function call instead of a const reference
- Negligible performance difference (singleton caching, sub-microsecond)
