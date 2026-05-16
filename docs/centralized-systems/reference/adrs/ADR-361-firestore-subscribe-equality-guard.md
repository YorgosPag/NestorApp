# ADR-361 — Firestore Subscribe Equality Guard (SSoT)

**Status**: Implemented
**Date**: 2026-05-16
**Related**: ADR-040 (Preview canvas performance — Phase XV root cause), ADR-214 (Firestore Query Centralization), ADR-227 (Real-Time Subscription Consolidation), ADR-354 (Super Admin Company Switcher), ADR-355 (Realtime Subscription SSoT Consolidation), ADR-294 (SSoT Ratchet)
**Owner**: Data layer / Performance

---

## Context

After ADR-355 (same day, 2026-05-16) collapsed every Firestore real-time subscription onto a single canonical entry point — `firestoreQueryService.subscribe` / `subscribeDoc` / `subscribeSubcollection` — a residual idle re-render loop persisted in the DXF Viewer. Render-trace instrumentation (`src/subapps/dxf-viewer/debug/render-loop-trace.ts`) revealed that `levelManagerLevels` was in `ref-only` churn on every commit: the same content, a brand-new reference, ~3-10Hz at idle.

Firestore `onSnapshot` re-fires on every cache hydration, every pending-write ack, and every metadata change. Each emission produces:

```ts
const documents = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
```

— a fresh array containing fresh object references with identical content. Because the service forwards the array directly to `onData`, every consumer of every subscription re-renders at the cache-emission rate. The 58+ call sites of `subscribe`, 13 of `subscribeDoc`, and 2 of `subscribeSubcollection` were all latent amplifiers of the same bug.

The original Phase XV fix in `useLevelsFirestoreSync.ts` was an inline `JSON.stringify` hash guard scoped to one hook. Correct behaviour, wrong place — it left every other consumer exposed.

## Decision

**Move the equality guard into the canonical service, so every subscription benefits.** Suppress same-content snapshot re-emissions by default, with explicit opt-out and override for the rare consumer that needs raw-cache delivery.

### Industry convergence

| Library | Default equality | Override knob |
|---------|-----------------|---------------|
| RxJS `distinctUntilChanged` | `===` | `compareFn` |
| React Query `structuralSharing` | deep structural merge | `boolean \| fn` |
| SWR `compare` | `dequal` (deep equal) | custom fn |
| Apollo `useQuery` | shallow + `__typename` | `equalityCheck` |
| Zustand `subscribe` | `Object.is` | `equalityFn` |
| reactfire (Firestore) | `distinctUntilChanged` on id+metadata | — |

Every mature reactive layer guards by default. We adopt the SWR-aligned pattern: **`dequal` deep equal**, custom fn override, explicit opt-out. `dequal` (MIT, 1.2KB, 0 dependencies, 35M weekly downloads) handles Firestore Timestamp, Date, undefined, NaN, and nested structures correctly — `JSON.stringify` does not.

### Architecture

```
Before ADR-361
──────────────
firestoreQueryService.subscribe
   │
   onSnapshot(q, snap => {
     const documents = snap.docs.map(...) ;   // ← fresh array, fresh refs
     onData({ documents, ... });               // ← fires every emission
   })

Consumer (~60 sites): setState(documents) → React rerenders ~3-10Hz idle


After ADR-361
─────────────
firestoreQueryService.subscribe
   │
   onSnapshot(q, snap => {
     const documents = snap.docs.map(...);
     if (slot.shouldSkip(documents, equalityFn)) return;  // ← guard
     onData({ documents, ... });
   })

Consumer: setState only on real content change → idle = silence
```

The guard is implemented as a tiny SSoT module — `src/services/firestore/firestore-equality.ts` — exporting:

- `defaultDocumentsEqual<T>(prev, next)` — array comparator (length-short-circuit + `dequal`).
- `defaultDocumentEqual<T>(prev, next)` — single-doc comparator (null/undefined transitions explicit).
- `EqualitySlot<T>` — per-subscription state holder with `reset()` for super-admin switcher rebuilds.

### Subscription contract

```ts
interface EqualityGuardOptions {
  /** Disable guard entirely. Default false (guard active). */
  skipEqualityGuard?: boolean;
}

interface SubscribeOptions<T> extends QueryOptions, EqualityGuardOptions {
  enabled?: boolean;
  /** Custom comparator. Default: dequal deep equal. */
  equalityFn?: (prev: readonly T[] | null, next: readonly T[]) => boolean;
}

interface SubscribeDocOptions<T> extends EqualityGuardOptions {
  enabled?: boolean;
  equalityFn?: (prev: T | null | undefined, next: T | null) => boolean;
}
```

### Lifecycle

- `EqualitySlot.reset()` is called on every `rebuild` in `subscribe` (i.e. on each `onSuperAdminActiveCompanyChange` tick, ADR-354 entry point #3). Rationale: the new tenant's first emission MUST reach the consumer, even if it happens to deep-equal the previous tenant's last payload by coincidence.
- `subscribeDoc` and `subscribeSubcollection` do not rebuild (no switcher integration there), so they keep a single slot for the subscription's lifetime.
- The guard runs synchronously on the snapshot callback hot path. Length-short-circuit makes the common idle case (`prev.length === next.length`) O(1) before invoking `dequal`.

## Security

No surface change. The guard operates on payloads that have already passed `firestore.rules` and the tenant filter. Suppressing redundant deliveries cannot widen access.

## Performance

- `dequal` benchmarks: ~3μs per N=100 docs on typical content shape. Idle Firestore cache emissions in the affected DXF Viewer scenario fire at ~10Hz; total guard overhead is ~30μs/s ≈ 0.003% CPU, vs. the cascade of React rerenders previously consuming the main thread.
- Worst-case (deep-equal of two genuinely-different large payloads) is O(n·d) but still terminates as soon as the first diverging field is hit.
- Custom `equalityFn` is provided for collections with very large payloads (>500 docs) where hashing a subset of fields is cheaper than a full `dequal`. None of the current 58 caller sites need this; the option exists for future hot paths.

## Affected Files

| File | Change |
|------|--------|
| `src/services/firestore/firestore-equality.ts` | **NEW** — SSoT comparators + `EqualitySlot`. |
| `src/services/firestore/firestore-query.types.ts` | Added `EqualityGuardOptions`, `SubscribeDocOptions<T>`. `SubscribeOptions<T>` is now generic and carries `equalityFn`. |
| `src/services/firestore/firestore-query.service.ts` | All three `subscribe*` methods wire an `EqualitySlot` and call it before `onData`. `subscribe` resets the slot on each rebuild. |
| `src/services/firestore/index.ts` | Re-exports `defaultDocumentsEqual`, `defaultDocumentEqual`, `EqualitySlot`, `SubscribeDocOptions`, `EqualityGuardOptions`. |
| `src/services/firestore/__tests__/firestore-equality.test.ts` | **NEW** — 26 tests, 100% coverage of the SSoT module. |
| `src/services/firestore/__tests__/firestore-query-equality.test.ts` | **NEW** — 8 integration tests verifying the service applies the guard correctly across all three methods (default, `skipEqualityGuard`, custom `equalityFn`). |
| `src/subapps/dxf-viewer/systems/levels/hooks/useLevelsFirestoreSync.ts` | Removed inline `prevLevelsHashRef` guard — now redundant. Hook shrinks from 134 → 115 lines. |
| `docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md` | Phase XV cross-referenced to ADR-361. |
| `.ssot-registry.json` | `firestore-realtime` module description updated; `firestore-equality.ts` added to allowlist. |
| `package.json` | `dequal@^2.0.3` (MIT, 0 deps). |

## Testing

| Suite | Tests | Coverage |
|-------|-------|----------|
| `firestore-equality.test.ts` | 26 | statements 100% / branches 100% / functions 100% on `firestore-equality.ts` |
| `firestore-query-equality.test.ts` | 8 | integration: subscribe / subscribeDoc / subscribeSubcollection default-guard, `skipEqualityGuard`, custom `equalityFn`, `enabled:false` |

Run: `npx jest src/services/firestore/__tests__/firestore-equality.test.ts src/services/firestore/__tests__/firestore-query-equality.test.ts`.

## Rollback

The guard is opt-out per subscription (`skipEqualityGuard: true`). If a future regression surfaces in a specific consumer that relied on receiving same-content emissions (e.g. for cache-warming side effects), the fix is local: set `skipEqualityGuard: true` on that one call site. The SSoT remains.

A full rollback (revert this ADR) requires reverting the three `subscribe*` methods in `firestore-query.service.ts` and deleting `firestore-equality.ts`. No data migration involved.

## Industry references

- SWR — https://swr.vercel.app/docs/options.en (`compare` option, `dequal` default)
- React Query — https://tanstack.com/query/latest/docs/framework/react/reference/useQuery (`structuralSharing`)
- RxJS — `distinctUntilChanged` operator
- Apollo Client — https://www.apollographql.com/docs/react/data/queries/ (notify-on-network-status-change, equality semantics)
- Zustand — https://docs.pmnd.rs/zustand/integrations/middleware (`subscribeWithSelector`, `equalityFn`)
- `dequal` — https://github.com/lukeed/dequal (MIT)

## Changelog

- **2026-05-16 (initial)**: SSoT module, guard applied to all 3 subscribe methods, inline guard in `useLevelsFirestoreSync` removed, ADR-040 Phase XV cross-referenced, 34 tests (100% module coverage), `dequal` adopted.
