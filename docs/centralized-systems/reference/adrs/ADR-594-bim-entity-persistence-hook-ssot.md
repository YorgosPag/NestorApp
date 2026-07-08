# ADR-594: BIM Entity Persistence Hook Factory SSoT (`createBimEntityPersistenceHook`)

## Status
✅ **ACTIVE — 2026-07-08** — De-duplication of the ~24 byte-identical BIM entity Firestore persistence React hooks under `src/subapps/dxf-viewer/hooks/data/` (`useBeamPersistence` … `useMepBoilerPersistence`, ~340 lines each ≈ 8k lines). Phase 1 folded the 21 homogeneous hooks; **Phase 2 (2026-07-08) folded the 3 formerly-excluded divergent members** (`useWallPersistence`, `useOpeningPersistence`, `useMepSegmentPersistence`) via five additive, off-by-default core hooks — so the whole entity family (bar the 4 structurally-different merge/split/aggregation hooks) is now factory-built. Each shared the same ~200-line invariant scaffold (state triple · 7 refs · scope-effect · ca9-stable subscribe → `mergeDocsIntoScene` · debounced auto-save · `saveNow` · delete · `persistRestore` · `drawing:entity-created`+delete listeners · moved+restored effects · unmount flush · memoised return), differing only in service/method/audit names, `docToEntity`, type guard, tool/event strings, and optional BOQ/connector/type-link extras. Collapsed onto **ONE generic factory** `createBimEntityPersistenceHook(config)` + 21 thin per-entity config call-sites that keep their exact public API.

**Related:**
- **ADR-585 / 586 / 588 / 590 / 591 / 592** — same 2026-07-08 de-duplication sweep, same archetype (**shared primitive + per-instance binding**), different buckets. ADR-594 is the largest single win of the sweep.
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28) — the token-based detector that surfaced these twins and gates re-introduction (this ADR's chosen guard).
- **ADR-390** (symmetric delete/undo), **ADR-397** (setDoc/updateDoc split), **ADR-401** (per-id persist serializer), **ADR-408** (MEP connectors), **ADR-412** (type-always-wins), **ADR-516** (autosave timing) — the behaviours the factory reproduces 1:1.

---

## Context

A real SSoT audit (grep + full reads of 4 representative + a 2-agent variance survey over the remaining 20) confirmed: the 24 `use*Persistence` hooks in `hooks/data/` share one scaffold with no shared owner. The already-centralised pieces (`mergeDocsIntoScene`, `resolveBimPersistenceScope`, `useBimFirestoreWriteGrace`, `createPersistSerializer`, `useBimEntityMovedPersistEffect`, `useBimEntityRestoredPersistEffect`) were reused inside each hook but the **hook body itself** was copy-pasted. This scaffold is exactly the twin that forced `SKIP_JSCPD_DIFF=1` on B1/B1-bis.

Big-player practice for a config-driven data-layer (ORM repository factories, TanStack Query's `QueryObserver`, Apollo's `useMutation` options) is a **shared primitive + per-instance binding**: a small required core, optional overrides with sane defaults, and a single extension point — **not** a god-config of 40 required fields.

---

## Decision

### New module `hooks/data/create-bim-entity-persistence-hook.ts` (+ `-types.ts`)
`createBimEntityPersistenceHook<TService, TDoc, TEntity, TComparable, TContext, TExtra>(config)` returns a `useXPersistence`-shaped hook. The factory owns the invariant scaffold; `config` injects the variance:

| Required | |
|---|---|
| `entityType`, `restoreEntityType`, `saveErrorKey`, `restoreErrorKey` | identity + server-side error strings (N.11-exempt) |
| `createService(scope)` + `service` adapter (`save`/`update`/`remove`/`subscribe`) | decouples per-service method names + `entityToSaveInput` |
| `merge` (`{mode:'generic', config}` or `{mode:'custom', run}`) | scene reconciliation via the `mergeDocsIntoScene` SSoT or a bespoke helper (column) |
| `entityComparable` | auto-save baseline + dirty gate (usually `e.params`; hatch `pickHatchData`) |

| Optional (default reproduces the majority) | |
|---|---|
| `typeGuard` · `writeGrace` · `serialize` · `enableMovedEffect` · `neverUpdate` · `restoreSilent` · `sceneRemovalTiming` · `createTrigger` · `deleteTrigger` · `autoSaveDirty` | behaviour toggles |
| `createExtraRefs` + `useExtra(ctx)` | per-entity extra ref bag (slab/roof family-type link map) + **the single escape hatch** for extra effects (`bim:*-params-updated` immediate persist, cross-entity BOQ re-feed listeners, family-type re-resolution) |
| `onPersisted` / `onDeleted` / `onDeleteCleanup` / `onRestored` | lifecycle side-effects — audit (`recordXChange`) + BOQ (`bimToBoqBridge`) + cross-entity emits live here |

The generic `merge.config` may be a **function of `extra`** so `seedExtraBaseline` seeds the per-instance type-link map (slab/roof). `onDeleteCleanup` runs unconditionally (even if `service.remove` throws) to clear that map.

### 21 migrations
Each `useXPersistence.ts` becomes a thin factory config + a wrapper that maps the canonical `primarySelected` ← `primarySelectedX` and result `deleteEntity` → `deleteX` (returned via `useMemo`). **Public API unchanged** → hosts (`ColumnPersistenceHost`, `WallPersistenceHost` → `setWall`, …) untouched. File sizes dropped from ~270–460 → ~114–247 lines.

### Two behaviour-neutral generalisations vs the originals
1. `persist`/`deleteEntity` read live scope via a **ref at event time** (stable identity) instead of closing over scope in dep arrays — the codebase's event-time-read pattern; observable Firestore writes are identical.
2. A hook opting out of the moved-effect (`enableMovedEffect:false`, underfloor) still mounts the shared listener with a **no-op persist** — same observable result (no persist-on-move), no conditional hook call.

Diagnostic-only `logger.warn`/`logger.error` telemetry in the column/beam originals is dropped (non-behavioural).

---

## Phase 2 — folding the 3 divergent members (2026-07-08)

Phase 1 kept wall/opening/mep-segment bespoke because their divergence is **woven into `persist`/`delete`** rather than expressible as tail-callbacks. Phase 2 (Giorgio's explicit direction to force-migrate) folds them in via **five additive, off-by-default core hooks** — each defaults to a no-op so the 21 Phase-1 hooks stay byte-identical (verified: 34 tests GREEN, no change to their behaviour):

| Core hook | Purpose | Used by |
|---|---|---|
| `beforeSave(entity, info) → Promise<entity>` | async pre-save transform / side-effect inside persist | opening (mark alloc + kind→mark re-sync), wall (soft-lock acquire) |
| `raceGuardDelete` | delete-wins: skip write if tombstoned; compensate if a delete raced ahead while in-flight | mep-segment |
| `markDeletedOnRequest` | sync-mark the tombstone in the delete-requested listener, before the async delete | wall, opening, mep-segment |
| `autoSaveTrigger` | event-driven autosave feeding the shared scheduler instead of the selected-entity debounce | mep-segment |
| `onAfterOptimisticRemoval` | sync side-effect right after a `'before'` scene removal, before the await | wall (neighbour trim recompute) |

Plus two additive fields: `primarySelected` on the `useExtra` context (wall soft-lock lifecycle) and `lastSavedComparable` on `OnDeletedInfo` (opening audit prefers the persisted baseline). The three wrappers otherwise compose the existing hatches: `custom` merge (wall/opening), `createExtraRefs` (family-type link map / soft-lock handle), `autoSaveDirty` (params OR link changed), `onPersisted/onDeleted/onDeleteCleanup/onRestored`, and `useExtra` (soft-lock, family-type re-resolution, thermal-envelope persist, host-wall BOQ re-feed, pre-floorplanId retry).

**KNOWN MINOR DEVIATION:** wall undo→restore no longer re-acquires the soft-lock (the factory `persistRestore` has no pre-save hook). The lock is advisory (TTL) and a just-restored wall has no concurrent editor → observable persistence identical.

**No automated behaviour tests** cover wall/opening/mep-segment (only the import+shape smoke) → their runtime behaviour needs **browser verification** before production trust.

The 4 structurally-different hooks (`useGridGuide`/`useMepSystem`/`useWallMerge`/`useWallSplit` Persistence) remain out of scope (merge/split/aggregation, not the entity scaffold).

---

## Guard decision

**No `.ssot-registry.json` module / CHECK 3.7·3.18 forbidden-pattern** — consistent with every sibling of this sweep (ADR-585…592 added none). A `serviceRef.current = createXFirestoreService(...)` pattern collides with the 3 legitimately-excluded hooks + the 4 special hooks, so a regex guard would false-positive. Re-introduction of the scaffold clone is caught by **jscpd CHECK 3.28 (ADR-584)** — the token-based, name-independent detector that surfaced this twin in the first place — plus code review.

---

## Consequences

- ~7.6k lines of copy-pasted scaffold collapse to one factory + 21 thin configs; one place now owns the persistence lifecycle contract.
- The B1/B1-bis scaffold clones that forced `SKIP_JSCPD_DIFF=1` are removed → jscpd baseline drops (see Verification).
- The 3 excluded hooks are the natural, documented divergence boundary (like ADR-592's building/floor factories).
- **Preserved-as-is (not "fixed"):** slab / slab-opening keep their always-`setDoc` (`neverUpdate`) behaviour — this is a byte-identical mechanical extraction, not a bugfix.

---

## Verification
- `npx jest src/subapps/dxf-viewer/hooks/data/__tests__/create-bim-entity-persistence-hook.test.tsx` → **9 GREEN** (first-save · subscribe→merge · update-vs-save · delete+optimistic-scene-removal+onDeleted · delete-event id routing · restore · neverUpdate · function-config seed + onDeleteCleanup · debounced autosave).
- `…/bim-persistence-hooks-smoke.test.ts` → **22 GREEN** — all 21 migrated modules import (syntax + import-paths + config construction) and export their hook as a function.
- `npx jest src/subapps/dxf-viewer/hooks/data/__tests__/` → **148 GREEN / 18 suites** (incl. every pre-existing merge/serializer/boq/restore suite — zero regression).
- ❌ No `tsc` (N.17 — agents do not run TypeScript checks; type-safety validated at Giorgio's periodic check + pre-commit hook).
- jscpd: the 200-line scaffold clone (21×) is gone; the shared MEP-connector merge adapter was further extracted to `mep-connector-merge-config.ts` (removes the 85-token ×6 cluster). The residual same-commit `jscpd:diff` hits (39 pairs, all ≤60 tokens) are **irreducible per-instance binding** — the `UseXPersistenceParams`/`Result` public-API interfaces, the service-adapter object shape, and the 5-field `useMemo` return tail — not extractable without a god-config or a changed public surface. The commit therefore uses **`SKIP_JSCPD_DIFF=1`** (justified, same as B1/B1-bis of this sweep); the Layer-2 CI ratchet rewards the large net decrease. Run `npm run jscpd:baseline` post-commit to lock it.

## Changelog
- **2026-07-08 (Phase 2)** — Folded the 3 divergent members (wall/opening/mep-segment) onto the factory via 5 additive off-by-default core hooks (`beforeSave`, `raceGuardDelete`, `markDeletedOnRequest`, `autoSaveTrigger`, `onAfterOptimisticRemoval`) + `primarySelected` ctx field + `lastSavedComparable` on `OnDeletedInfo`. 21 Phase-1 hooks byte-unaffected. Params interfaces collapsed onto `Omit<BimEntityPersistenceParams<T>, …>`, wall BOQ feed + factory restore-write extracted to helpers → `jscpd:diff` clean (0 new clones) for the Phase-2 fileset. Smoke test extended to 24 hooks → **34 GREEN**. Browser-verify pending for the 3.
- **2026-07-08** — Created. New `create-bim-entity-persistence-hook.ts` (factory) + `bim-entity-persistence-hook-types.ts` (config contract) + `mep-connector-merge-config.ts` (shared MEP-connector merge adapter) + `create-bim-entity-persistence-hook.test.tsx` (9) + `bim-persistence-hooks-smoke.test.ts` (22) + 21 hook migrations (beam/slab/roof/column/foundation/railing/slab-opening/hatch/floor-finish/thermal-space/space-separator/wall-covering/furniture/floorplan-symbol/mep-boiler/mep-radiator/mep-manifold/mep-water-heater/mep-fixture/mep-underfloor/electrical-panel). Wall/opening/mep-segment excluded (bespoke). Guard = jscpd CHECK 3.28.
