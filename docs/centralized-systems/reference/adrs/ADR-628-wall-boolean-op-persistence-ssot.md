# ADR-628: Wall boolean-op persistence primitive + BIM BOQ/audit lifecycle SSoT (`hooks/data`)

## Status
✅ **ACTIVE — 2026-07-10** — Cluster #18 of the jscpd de-duplication sweep (ADR-584 / N.18), targeting `src/subapps/dxf-viewer/hooks/data/`. Two independent duplication families in the persistence layer collapsed onto two new SSoTs — with **identical public APIs** and **1:1 behaviour** — plus a Boy-Scout dedup of the wrapper param surface.

**Related:**
- **ADR-566** (merge/join walls) + **ADR-363 §Phase X** (split walls) — the two byte-twin boolean-op persistence hooks migrated onto the new primitive.
- **ADR-594** — `createBimEntityPersistenceHook`, the persistence factory the 5 MEP hooks already consume; the new lifecycle builder plugs into its `onPersisted`/`onDeleted`/`onRestored` config slots.
- **ADR-408** — the MEP entities (boiler / manifold / radiator / water-heater / underfloor) whose audit + Η-Μ BOQ auto-feed lifecycle is centralised.
- **ADR-626** — cluster #17 (same sweep, `hooks/drawing`). **ADR-627** — hatch grip parity (unrelated, concurrent).
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28 / N.18) — gated the iteration; `jscpd:diff` clean on all touched files, no `SKIP_JSCPD_DIFF`.

---

## Context

A real SSoT audit (fresh jscpd pass grouping `hooks/data` at **604 cloned lines / 53 intra-dir pairs**, plus full reads of both members of every twin AND the existing ADR-594 factory) found three duplication sub-families. The user chose scope **B + A**:

- **B — Wall boolean-op twin** (`useWallMergePersistence` ⇄ `useWallSplitPersistence`): the densest single clone in the directory (~108 shared lines across 2 files). Both are pure side-effect EventBus subscribers mounted in `WallPersistenceHost`, sharing the entire scaffold: params surface, wall+opening service refs, live-scope refs (read at event time), the `resolveBimPersistenceScope` service-init effect, the wall-BOQ upsert/delete blocks, the opening-update fan-out, and the subscribe effect. The ONLY genuine variance is the committed event + the delete/save sequence it triggers.
- **A — Entity BOQ/audit lifecycle**: the 5 MEP persistence hooks already adopt the ADR-594 factory, but each hand-rolled a byte-identical `onPersisted`/`onDeleted`/`onRestored` triplet (audit via `recordMep<X>Change` + a `company+project+building`-guarded BOQ upsert + a `company`-guarded BOQ delete + a restore audit). Per-entity variance is only the BOQ discriminant, the audit client, the delete-snapshot fallback `kind`, and (underfloor only) the BOQ payload shape.
- **NOT in scope** (N.1 — divergent behaviour): the finish/scene-aware structural feeds (`useWallPersistence`/`useBeamPersistence` use `wallBoqEntity`/`beamBoqEntity(entity, scene)` + `bim:*-persisted` emits + restore-feeds-BOQ). Their BOQ payload is scene-derived, not the minimal `{ id, kind }` snapshot — deliberately kept bespoke.

---

## Decision

Extract two SSoTs and migrate; keep every public hook name, param/result shape, and observable Firestore/BOQ/audit effect unchanged.

### B — `use-wall-boolean-op-persistence.ts` — `useWallBooleanOpPersistence(params, event, run)`

Owns the invariant scaffold once. Generic over the committed event key (`K extends DrawingEventType`); the caller passes only the op-specific `run(payload, ctx)` where `ctx = { wallSvc, openingSvc, boqScope }`. **Reference-stability (ADR-626 lesson):** `run` is read through a ref at event time, so the subscribe effect keys on the stable `event` literal only (subscribe once per mount) even though callers pass an inline `run` each render. Exports the shared BOQ/opening primitives `upsertMergedWallBoq` / `deleteWallBoq` / `applyOpeningUpdates` (the minimal, deliberately non-scene-aware wall-BOQ payload preserved byte-for-byte).

- `useWallMergePersistence` → thin binding on `'bim:wall-merge-committed'` (delete A+B + save merged; BOQ delete A+B + upsert merged; audit deleted×2 + created).
- `useWallSplitPersistence` → thin binding on `'bim:wall-split-committed'` (delete original + save w1+w2; BOQ delete original + upsert w1+w2; audit deleted + created×2).

### A — `create-bim-boq-audit-lifecycle.ts` — `createBimBoqAuditLifecycle<TEntity>(config)`

Returns the `{ onPersisted, onDeleted, onRestored }` triplet spread into an ADR-594 factory config. Config = `{ boqType, recordChange, deletedFallbackKind, boqPayload? }`; `boqPayload` defaults to `{ id, kind }`, underfloor overrides with developed pipe length (`geometry.lengthM`). `recordChange` is typed `BimEntityAuditRecorder<TEntity>` (accepts the full scene entity OR the minimal delete snapshot) — every `recordMep<X>Change` is structurally assignable, no `as any`. Adopted by all 5 MEP hooks (`...createBimBoqAuditLifecycle<Mep…Entity>({…})`).

### Boy-Scout — `BimEntityPersistencePublicScope`

The public wrapper param interfaces cloned an identical 7-field scope block (also vs the internal `BimEntityPersistenceParams`). Extracted one base interface in `bim-entity-persistence-hook-types.ts`; `BimEntityPersistenceParams` and all 5 MEP `Use…Params` now `extends BimEntityPersistencePublicScope` (+ their named `primarySelected<X>` field). Kills the last 4 diff-flagged clones and reduces the baseline further. Structural wrapper interfaces can adopt it on touch (future).

---

## Consequences

- **jscpd:** full-scan **3494 → 3262** (−232 vs the locked baseline, incl. earlier #12–#17). `jscpd:diff` clean on all 10 touched src files — no new sibling clones, no `SKIP_JSCPD_DIFF`.
- **Tests:** 60/60 green — the existing `useWallSplitPersistence` behavior test (unchanged, proves the wall refactor is 1:1) + the persistence smoke (all 5 MEP hooks module-load) + the factory test, plus two new suites: `create-bim-boq-audit-lifecycle.test.ts` (lifecycle triplet units) and `useWallMergePersistence.test.ts` (behavior parity + a reference-stable-subscription regression test).
- **Behaviour:** identical Firestore writes, BOQ rows, audit records, in the same order. Public hook names + param/result shapes unchanged.
- **Files:** 2 new SSoT modules + 2 new test suites; 8 files migrated to thin bindings.

---

## Changelog
- **2026-07-10** — ADR created. Cluster #18: `useWallBooleanOpPersistence` primitive (merge/split twins → thin), `createBimBoqAuditLifecycle` builder (5 MEP hooks adopt), `BimEntityPersistencePublicScope` param-surface SSoT. Full-scan 3494→3262; 60 jest; jscpd:diff clean.
