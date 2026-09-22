# ADR-367: Firestore Internal Assertion Recovery (Single-Tab Cache + Safety Net)

**Status:** ✅ APPROVED — §2.1 superseded by §2.5 (2026-09-22)
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

Our subscription pipeline (`firestoreQueryService` with ADR-361 dedupe, `useLevelsFirestoreSync` with `currentLevelIdRef`) is correct at the query layer — the b815/ca9 multi-tab path is purely an SDK-internal bug.

> **2026-06-08 update (code = truth, N.0.1):** the same `ca9 {ve:-1}` assertion was
> later reproduced *deterministically* when MEP pipe networks are on the canvas — a
> SECOND, client-side trigger distinct from the multi-tab lease race. Root cause:
> **subscription listener churn**. See §2.4.

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

### 2.4 Root fix #2 — Subscription listener-churn stabilization (2026-06-08)

**Symptom:** with MEP pipe segments on the canvas, the console floods with
`INTERNAL ASSERTION FAILED (ID: ca9) CONTEXT: {"ve":-1}` (and the secondary `b815`).
The reported stack originated in `useWallPersistence` cleanup →
`firestore-query.service.ts:313 innerUnsub()`.

**Root cause (distinct from the multi-tab race of §2.1):** the BIM persistence hooks
in `src/subapps/dxf-viewer/hooks/data/` keyed their `onSnapshot` subscription effect
on the **`levelManager` object** (`useLevels` return). That object is a fresh `useMemo`
that changes identity across renders. When pipes exist, the auto-design reconcilers
(`useMepFittingAutoReconciliation`, `useMepConnectorReconciliation`) call `setLevelScene`
in bursts → render storms → each subscription effect unsubscribes + re-subscribes on
nearly every render. A watch **target removed before the server acknowledges it**
(`{ve:-1}` = target version −1) is the textbook `ca9` trigger.

**Fix (proven pattern):** key each subscription effect off **stable scope primitives +
`currentLevelId`**, reading `levelManager` through a `levelManagerRef` (zero behavior
change). This is the exact pattern already applied to `useMepFittingAutoReconciliation`
(2026-06-04 render-loop fix) — now propagated to **all 20 persistence hooks** that still
held the unstable dependency (`useWallPersistence`, `useMepSegmentPersistence`,
`useMepManifoldPersistence`, `useMepFixturePersistence`, `useElectricalPanelPersistence`,
+ column/beam/opening/slab/roof/floor-finish/furniture/symbol/railing/slab-opening/
thermal-space/radiator/boiler/water-heater/underfloor).

This is a **proactive root fix** at the source of the churn — the §2.1 single-tab cache
and the §2.2 recovery listener remain as the safety net for any residual SDK-internal
path. ADR-040 micro-leaf files are untouched (persistence hooks are not on the CHECK
6B/6D list). Related: ADR-408 (MEP auto-design — the reconcilers that amplify the churn).

### 2.5 Root fix #3 — memory cache, every environment (2026-09-22) — SUPERSEDES §2.1

**Symptom:** `b815` again, now on a **public** page with an anonymous visitor
(`/search/results`, `userId: null`), CONTEXT = *"Failed to obtain exclusive access to the
persistence layer"*. That is the **single-tab** manager: a second tab (or a tab frozen in the
background by Chrome, whose lease then expires) loses exclusive IndexedDB access, the SDK's
AsyncQueue enters its failed state, and the next Firestore call trips `b815`.

**Finding 1 — both tab managers produce `b815`.** Multi-tab via the lease swap (§1), single-tab
via lost exclusive access (this incident). The class is `persistentLocalCache` itself, open
upstream for years across 8.x → 12.x (firebase-js-sdk #7884, #8250, #7161 — all IndexedDB-only;
*"does not occur when persistence is disabled"*). No tab manager choice fixes it.

**Finding 2 — the §4 reason for keeping persistence was void.** §4 rejected memory cache because
*"field engineers on construction sites without network would be blocked"*. Measured: `public/sw.js`
is a **zero-cache passthrough**, so without network the app shell never loads — a persistent
Firestore cache can't deliver an offline cold start. What the field engineer actually gets
(open listeners keep their data, writes queue and retry while the tab lives) is provided by
`memoryLocalCache` identically.

**Finding 3 — the §2.2 net did not cover public routes.** `GlobalErrorSetup` was mounted only in
`(app)/layout.tsx`; `(light)` / `(auth)` / `(me)` load `db` too but had **no** recovery listener.

**Decision (industry practice: Google Docs/Gmail keep offline storage an explicit per-device
opt-in, never a silent default; portal sites like Zillow/Idealista keep no client DB for
anonymous browsing):**
1. `src/lib/firebase.ts` → `memoryLocalCache()` in **every** environment (was dev-only).
2. `src/lib/firestore-legacy-cache.ts` (**NEW**) → deletes the orphaned IndexedDB
   `firestore/<app.name>/<projectId>/main` + SDK `firestore_zombie_*` localStorage keys, once per
   browser (flag set only on success). Tenant data no longer sits on shared-computer disks.
3. `GlobalErrorSetup` moved to the **root** layout (zero DOM) → recovery net on every route group.
4. `firestore-recovery.ts` → `terminate` + reload only (nothing on disk to clear).

**Only trade-off:** writes still pending when a tab is **closed while offline** are lost (they
were kept in IndexedDB before) — **closed by §2.6** (warning on close + no auto-reload over them). Re-introducing persistence requires an offline app shell **and**
an explicit per-device opt-in — see the ⚠️ in `firebase.ts`.

### 2.6 Pending writes → unsaved-work registry (2026-09-22) — closes the §2.5 trade-off

With memory cache, unacknowledged writes live only in tab memory: offline they queue and flush on
reconnect, but a tab **closed** before that loses them. Industry practice (Google Docs, Gmail, Figma):
the owner of the save queue knows when it is non-empty → *"Changes you made may not be saved"* on
close, and no automatic reload over it.

**Ask the owner, don't wrap the writers.** ~100 client files call `setDoc`/`updateDoc` directly; a
wrapper would have to be remembered by every future write, and the first to forget would lose data
silently. The queue's owner is the SDK, and its one public question is `waitForPendingWrites(db)` —
measured in @firebase/firestore 4.9.3 (`__PRIVATE_syncEngineRegisterPendingWritesCallback`): it
resolves **immediately** when nothing is pending, **even offline**, otherwise on server ack.

`src/lib/firestore-pending-writes.ts` (**NEW**) — pure state machine + installer:
- probe every `PROBE_INTERVAL_MS` (500) + on `offline` + on `visibilitychange`;
- the owner `firestore:pending-writes` is marked in `unsaved-work-registry` only if a probe stays
  open past `SETTLE_THRESHOLD_MS` (400 — above a normal online ack) → no flicker on every save;
- a **slow** resolution never clears — it re-probes (writes enqueued while waiting were not covered);
  only a **fast** resolution ("nothing pending") clears; rejection (terminated / user change) clears.
- Failure direction: a busy SDK queue > threshold may mark briefly (harmless false positive). The
  opposite — "clean" while writes are pending — cannot happen.

Consumers of the registry (ADR-860 §Ε3β/§Ε3γ): the single `beforeunload` guard warns the human; the
deploy-skew recovery **defers** its automatic reload. Installed lazily from `GlobalErrorSetup` (root).

### 2.7 Visible save status in the header (2026-09-22) — Google Docs pattern

`src/components/header/SaveStatusIndicator.tsx` (**NEW**), first item of the `AppHeader` right cluster.
State from `src/hooks/useSaveStatus.ts` (**NEW**) = pure `deriveSaveStatus({pending, connected}, previous)`:

| pending | connected | status | shown |
|---|---|---|---|
| ✔ | ✔ | `saving` | «Αποθήκευση…» |
| ✔ | ✘ | `offline-pending` | «Εκτός σύνδεσης — αλλαγές σε αναμονή» + tooltip **«Μην κλείσετε την καρτέλα»** |
| ✘ | ✘ | `offline` | «Εκτός σύνδεσης» (warns *before* the human writes) |
| ✘ | ✔ | `saved` only right after `saving`/`offline-pending`, 3 s → `idle` | «Όλες οι αλλαγές αποθηκεύτηκαν» |
| ✘ | ✔ | `idle` otherwise | nothing (zero visible DOM) |

- `pending` = `hasUnsavedWorkFrom('firestore:pending-writes')` (**NEW** registry query) — *only* Firestore
  writes; an open dirty form is a different sentence.
- `connected` = `src/hooks/useConnectivity.ts` (**NEW** SSoT: `navigator.onLine` ∧ Firestore channel).
  It was hand-composed in `procurement/quotes/page.tsx` and `procurement/rfqs/[id]/RfqDetailClient.tsx`
  (N.0.2) — both migrated.
- **No change count**: the SDK exposes only empty/non-empty (`waitForPendingWrites`), never the queue
  size. Showing a number would be invented. (Google Docs shows no count either.)
- **Beyond Docs**: Docs persists offline edits to disk; we keep them in the tab (§2.5), so the
  `offline-pending` tooltip says explicitly not to close the tab — and §2.6 enforces it on close.
- A11y: icon **and** text per state (CHECK 3.41); permanent `sr-only` `role="status"` live region
  (a region born with its first message is not reliably announced); the visible chip is `aria-hidden`.
- i18n: `common:saveStatus.*` (el + en) with **literal** `t()` keys — the header lives in the shell,
  where the slice generator (CHECK 3.34) refuses unresolved dynamic keys.

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
| `memoryLocalCache` in production | ~~Loses offline support~~ — **REVERSED 2026-09-22 (§2.5)**: the app shell has no offline cache (`sw.js` passthrough), so this offline support never existed. Now the adopted fix. |
| SDK upgrade only (12.7 → latest) | The Firebase team has patched assertion variants across multiple releases; no guarantee any single upgrade closes this specific path. Not a strategy. |
| Recovery-only (keep multi-tab + add listener) | Anti-pattern: leaves the known crash path in place. Recovery must be a safety net, not the only line of defense. |
| Custom retry on assertion (no reload) | Not feasible — once the SDK trips its internal state machine, no public API can re-stabilize it without a process restart. |

## 5. Files

| File | Change |
|------|--------|
| `src/lib/firebase.ts` | Multi-tab manager → single-tab; comment block updated to point here. |
| `src/lib/firestore-recovery.ts` | **NEW** — global listener + recovery sequence (~95 lines). |
| `src/components/GlobalErrorSetup.tsx` | Wire-in dynamic import of recovery listener. |
| `src/lib/firestore-legacy-cache.ts` | **NEW (§2.5)** — one-time purge of the orphaned `persistentLocalCache` IndexedDB + SDK zombie lease keys. |
| `src/app/layout.tsx` / `src/app/(app)/layout.tsx` | **§2.5** — `GlobalErrorSetup` moved from the `(app)` group to the root layout. |
| `src/lib/firestore-pending-writes.ts` + `__tests__/firestore-pending-writes.test.ts` | **NEW (§2.6)** — SDK pending-writes → `unsaved-work-registry`; 7 tests pin no-flicker, slow-never-clears, stale-timer, rejection. |
| `src/components/header/SaveStatusIndicator.tsx` · `src/hooks/useSaveStatus.ts` · `src/hooks/useConnectivity.ts` + 2 tests | **NEW (§2.7)** — header save status; 21 derive cases + 6 component tests. |
| `src/lib/__tests__/firestore-legacy-cache.test.ts` | **NEW (§2.5)** — pins the exact SDK database name, zombie-only key removal, success-only flag. |
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
- **2026-06-08** — Added §2.4 **Root fix #2 (subscription listener-churn stabilization)**. A second, deterministic `ca9 {ve:-1}` trigger was found: BIM persistence hooks re-subscribed `onSnapshot` on every render because their effect depended on the unstable `levelManager` object — amplified into a render storm by the MEP pipe auto-design reconcilers. Stabilized all 20 persistence hooks to key off `currentLevelId` + scope primitives via a `levelManagerRef` (mirror of the `useMepFittingAutoReconciliation` render-loop fix). No behavior change; §2.1/§2.2 remain as the SDK-internal safety net.
- **2026-09-22** — §2.5 **memory cache in every environment** (supersedes §2.1 single-tab). Trigger: `b815` with *"Failed to obtain exclusive access to the persistence layer"* at public `/search/results` (errorId `err_9a24e54b`). Both tab managers proven to produce `b815`; §4's offline rationale void (`sw.js` = zero-cache passthrough). NEW `firestore-legacy-cache.ts` purges orphaned IndexedDB; `GlobalErrorSetup` moved to root layout so public route groups get the recovery net; recovery drops `clearIndexedDbPersistence`.
- **2026-09-22** — §2.6 **pending writes → unsaved-work registry**: closes the §2.5 trade-off. `waitForPendingWrites` probe (immediate when empty, even offline — measured in SDK source) with a 400ms settle threshold; registry drives the single `beforeunload` guard (ADR-860 §Ε3γ) and defers deploy auto-reload.
- **2026-09-22** — §2.7 **visible save status in the header** (Google Docs pattern): `saving` / `offline-pending` ("do not close the tab") / `offline` / `saved` (3 s) / `idle`. New `useConnectivity` SSoT replaced two hand-composed copies in procurement. No change count — the SDK does not expose one.
