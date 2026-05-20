# ADR-367: Firestore Internal Assertion Recovery (Single-Tab Cache + Safety Net)

**Status:** ✅ APPROVED
**Date:** 2026-05-20
**Category:** Infrastructure / Performance
**Owner:** Platform
**Related:** ADR-040 (DXF perf, untouched), ADR-361 (subscribe equality guard), ADR-328 (Tabs UI — historical mis-reference cleaned up)

---

## 1. Context

Production Sentry caught a `firebase-js-sdk` internal assertion at `/dxf/viewer`:

```
FIRESTORE (12.6.0) INTERNAL ASSERTION FAILED: Unexpected state (ID: b815)
CONTEXT: { "Pc": "... ID: ca9, ve:-1 ..." }
mechanism: auto.browser.browserapierrors.addEventListener
URL: https://nestorconstruct.gr/dxf/viewer
```

Root cause is a long-standing firebase-js-sdk bug (see issue tracker on `firebase/firebase-js-sdk`, recurring across 11.x → 12.x): when `persistentLocalCache` is paired with `persistentMultipleTabManager`, a tab-lease swap during in-flight `onSnapshot` delivery causes the watch-stream's internal target state to desync from the IndexedDB target cache, tripping the `ID: b815` assertion (with `ca9` as the inner exception).

Once the assertion fires, the Firestore SDK becomes unstable for the rest of the page lifetime: subsequent snapshots stop firing silently. The UI does not crash (the error is caught by the browser's global error handler) but the app becomes invisibly broken for the user.

Our subscription pipeline (`firestoreQueryService` with ADR-361 dedupe, `useLevelsFirestoreSync` with `currentLevelIdRef`) is correct — this is purely an SDK-internal bug.

### Discovery

The cache strategy in `src/lib/firebase.ts` referenced `ADR-328 §5.J / §5.5` as rationale for the multi-tab manager choice. Audit revealed: ADR-328 covers **Tabs UI consolidation** and contains no such sections. The multi-tab choice was an **undocumented technical pick**, not an architectural commitment. Safe to revisit.

## 2. Decision

**Belt-and-suspenders fix per Google-level architecture checklist (N.7.2):**

### 2.1 Root fix — Single-tab cache manager

Swap `persistentMultipleTabManager()` → `persistentSingleTabManager({ forceOwnership: false })` in `src/lib/firebase.ts`.

This eliminates the lease-coordination race that triggers the b815 assertion. Each tab gets its own independent persistent cache; no cross-tab lease swap is possible during snapshot delivery.

### 2.2 Safety net — Recovery listener

Add `src/lib/firestore-recovery.ts` exporting `installFirestoreRecoveryListener()`:

- Listens on `window.error` and `window.unhandledrejection`.
- Pattern: `/FIRESTORE.*INTERNAL ASSERTION FAILED/i` (case-insensitive, version-agnostic).
- On match: `terminate(db)` → `clearIndexedDbPersistence(db)` → `location.reload()`.
- Idempotency:
  - Module-scope `installed` boolean → listeners mounted once per page lifetime.
  - `sessionStorage['firestore-recovery-fired']` → recovery sequence runs once per browser session (prevents reload-loop on chronic local corruption).
- Sentry telemetry: `captureMessage('firestore-internal-assertion-recovery', 'error', { tags: { 'firestore.recovery': 'true', 'firestore.assertion_id': '<id>' } })` fires before reload. Used to monitor post-deploy effectiveness.

### 2.3 Wire-in

`src/components/GlobalErrorSetup.tsx` (already mounted at root via `ConditionalAppShell`) dynamically imports and invokes `installFirestoreRecoveryListener()` alongside the existing `ErrorTracker` init. No new provider, no SSR impact.

## 3. Trade-offs

| Aspect | Before | After |
|--------|--------|-------|
| Multi-tab offline sync (shared IndexedDB) | ✅ Yes | ❌ No (each tab has its own cache) |
| Multi-tab lease race → b815 assertion | ❌ Possible | ✅ Eliminated |
| Offline support per tab | ✅ Yes | ✅ Yes (unchanged) |
| Recovery from residual SDK bugs | ❌ None | ✅ Auto reload + Sentry signal |
| Bundle size | — | +~1.2 KB (recovery module) |

**Why the multi-tab loss is acceptable:** the DXF viewer is a single-tab workflow (one viewer per session). The construction-management surfaces (Buildings, Procurement, Contacts) do not share cache across tabs in any user-visible way; each tab refreshes its data from Firestore on focus regardless. We lose nothing the user perceives.

## 4. Rejected alternatives

| Option | Why rejected |
|--------|--------------|
| `memoryLocalCache` in production | Loses offline support — field engineers on construction sites without network would be blocked. |
| SDK upgrade only (12.7 → latest) | The Firebase team has patched assertion variants across multiple releases; no guarantee any single upgrade closes this specific path. Not a strategy. |
| Recovery-only (keep multi-tab + add listener) | Anti-pattern: leaves the known crash path in place. Recovery must be a safety net, not the only line of defense. |
| Custom retry on assertion (no reload) | Not feasible — once the SDK trips its internal state machine, no public API can re-stabilize it without a process restart. |

## 5. Files

| File | Change |
|------|--------|
| `src/lib/firebase.ts` | Multi-tab manager → single-tab; comment block updated to point here. |
| `src/lib/firestore-recovery.ts` | **NEW** — global listener + recovery sequence (~95 lines). |
| `src/components/GlobalErrorSetup.tsx` | Wire-in dynamic import of recovery listener. |
| `docs/centralized-systems/reference/adrs/ADR-367-...md` | **NEW** — this document. |

## 6. Google-level checklist (N.7.2)

| # | Question | Answer |
|---|----------|--------|
| 1 | Proactive or reactive? | **Proactive** root fix + **reactive** safety net. |
| 2 | Race condition possible? | **No** — single-tab eliminates lease coordination. |
| 3 | Idempotent? | **Yes** — module flag + sessionStorage flag. |
| 4 | Belt-and-suspenders? | **Yes** — root fix + recovery + telemetry. |
| 5 | Single Source of Truth? | **Yes** — `firebase.ts` owns cache config, `firestore-recovery.ts` owns recovery. |
| 6 | Fire-and-forget or await? | **Await** `terminate()` and `clearIndexedDbPersistence()` before reload. |
| 7 | Owner? | `firestore-recovery.ts` (single service). |

✅ **Google-level: YES** — root cause addressed, recovery layered, telemetry wired, no UX regression.

## 7. Verification

1. **Build:** `npx tsc --noEmit` clean.
2. **Local smoke (`npm run dev`):**
   - `/dxf/viewer` opens, no console warnings from Firestore SDK init.
   - Open a second tab on the same URL — first tab does not error (single-tab manager isolates cache).
3. **Recovery dispatch test (DevTools console):**
   ```js
   window.dispatchEvent(new ErrorEvent('error', {
     message: 'FIRESTORE (12.7.0) INTERNAL ASSERTION FAILED: Unexpected state (ID: b815)'
   }));
   ```
   Expected: `sessionStorage['firestore-recovery-fired']` === `'1'`, Sentry breadcrumb fires (visible via Sentry session replay or `debug=*`), page reloads. Second dispatch in the same session → no recovery (guard works).
4. **Production monitoring (post-deploy):**
   - Sentry filter `firestore.recovery:true` should be at or near 0.
   - The original `INTERNAL ASSERTION FAILED (ID: b815)` event count should drop sharply.
   - If `firestore.recovery:true` remains frequent → escalate to firebase-js-sdk with reproduction; revisit ADR.

## 8. Changelog

- **2026-05-20** — Initial decision: single-tab manager + recovery listener. Triggered by Sentry event `a4374d38b9374d089437a899341626a6` at `/dxf/viewer` on commit `e660b1de`.
