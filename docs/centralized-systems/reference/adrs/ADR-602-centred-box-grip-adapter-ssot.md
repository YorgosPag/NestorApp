# ADR-602: Centred-box Grip Adapter factory SSoT (`createCentredBoxGripAdapter`)

## Status
✅ **ACTIVE — 2026-07-08** — De-duplication of the 8 thin grip *adapters* around the shared centred rotatable-box grip SSoT (`bim/grips/centred-box-grips.ts`): `mep-boiler` · `mep-radiator` · `mep-water-heater` · `electrical-panel` · `mep-manifold` · `mep-fixture` · `furniture` · `floorplan-symbol`. Each `{entity}-grips.ts` copy-pasted the SAME thin wrapper — the `ROLE_TO_KIND` / `KIND_TO_ROLE` maps (6 + 6 mechanical `${prefix}-${role}` entries), the `get{X}Grips` emit loop (`getCentredBoxGrips(...).map(...)` wrapping each grip into the entity's `GripInfo` discriminant field), the `apply{X}GripDrag` delegation, and the `{X}GripDragInput` interface (the SAME 5 fields). Collapsed onto **one generic factory** `createCentredBoxGripAdapter(config)` + 8 thin per-entity config call-sites that keep their exact public API. **No new grip core** — the geometry/drag SSoT is untouched.

**Related:**
- **ADR-594** (BIM Entity Persistence Hook factory) + **ADR-600** (Single-click Placement Tool factory) — the SAME MEP/furniture/floorplan family's OTHER two legs. ADR-602 is the **third leg** (grip adapters) of the same 2026-07-08 sweep, same archetype (**shared primitive + per-instance binding + No-God-shell escape hatch**).
- **ADR-397 / 408 / 406 / 410 / 415 / 363** — the centred-box grip SSoT + the individual entities' grip behaviours, reproduced 1:1.
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28) — the token-based detector that gates re-introduction (this ADR's chosen guard); it caught a sibling twin (furniture ↔ floorplan-symbol field bridge) DURING this work, which was then extracted to `mmSuffixedBoxBridge`.

---

## Context

A real SSoT audit (grep for `getCentredBoxGrips` / `rect-grip-engine` + full reads of all 9 candidate grip files) confirmed the box GEOMETRY + drag math already live in ONE place (`centred-box-grips.ts`, itself over the entity-agnostic `rect-grip-engine`). Its own docstring already states «each caller maps role↔kind» — i.e. the per-entity **thin adapter** was duplication by design, awaiting a factory. Each `{entity}-grips.ts` copy-pasted:

- `ROLE_TO_KIND` (`Record<CentredBoxGripRole, {X}GripKind>`) + `KIND_TO_ROLE` (its inverse), 6 + 6 entries, all mechanically `${prefix}-${role}`;
- `get{X}Grips(entity) = getCentredBoxGrips(params).map(g => ({ entityId, gripIndex, type, position, movesEntity, {x}GripKind: ROLE_TO_KIND[g.role] }))`;
- `apply{X}GripDrag(kind, input) = { role = KIND_TO_ROLE[kind]; patch = applyCentredBoxGripDrag(role, {...}); return patch ? {...orig, ...patch} : orig }`;
- `interface {X}GripDragInput { originalParams; delta; ortho?; pivot?; currentPos? }`.

Big-player practice for a family of near-identical adapters over one primitive is a small typed factory + per-instance binding, not a copy-pasted adapter per entity.

---

## Decision

### New factory `bim/grips/create-centred-box-grip-adapter.ts`
`createCentredBoxGripAdapter<TEntity, TParams, TKind>(config)` returns `{ getGrips, applyGripDrag }`. It owns the invariant emit + drag delegation; `config` injects the variance:

| Field | Role |
|---|---|
| `roleToKind` / `kindToRole` | the two grip-kind maps — built once by the exported `buildCentredBoxKindMaps(prefix)` helper (replaces the 12 hand-written entries) |
| `minDimensionMm` | the entity's corner-resize clamp |
| `toBoxParams` / `fromBoxPatch` | the param bridge — identity + spread for entities whose params already carry the box fields; the shared `mmSuffixedBoxBridge<T>()` for the `rotationDeg`/`widthMm`/`depthMm` shape |
| `toGripInfo(base, kind)` | binds the entity's `GripInfo` discriminant field (`(base, kind) => ({ ...base, {x}GripKind: kind })`) — a **type-safe** closure, NOT a computed key + cast |

**`CentredBoxKind<P> = \`${P}-${CentredBoxGripRole}\``** — a template-literal type that reconstructs each entity's 6-kind union from its prefix, so `buildCentredBoxKindMaps` is exact-typed (no `any`; the two runtime concatenations are provable narrowings).

### `mmSuffixedBoxBridge<T>()` (shared field bridge)
Furniture + floorplan-symbol have **identical** `toBoxParams`/`fromBoxPatch` (both map `rotationDeg`/`widthMm`/`depthMm` ↔ the box fields). Extracted to ONE exported helper so they don't ship twin bridges — this is exactly the N.18 sibling-clone the jscpd diff caught mid-work.

### 8 migrations
Each `{entity}-grips.ts` becomes: `buildCentredBoxKindMaps(prefix)` + `minDimensionMm` + the param bridge + `toGripInfo`, then `export const get{X}Grips = adapter.getGrips` / `apply{X}GripDrag = adapter.applyGripDrag` and `export type {X}GripDragInput = CentredBoxAdapterDragInput<{X}Params>`. **Public API byte-identical.** One behaviour-neutral cleanup: `mep-water-heater-grips.ts` dropped its now-stale legacy `MepWaterHeaterGripInfo` intersection type + docstring (the `mepWaterHeaterGripKind` field it claimed was "not yet on `GripInfo`" IS now first-class; the type was self-referential / unused externally — verified by grep).

---

## Exclusions (No God-shell)

- **`bim/walls/opening-grips.ts` — EXCLUDED.** A wall-hosted opening is genuinely divergent: its grip positions are derived from `geometry.outline` (host-wall footprint), its drag is **wall-constrained** (`projectPointToWallOffsetMm`), and it carries flip-hand / flip-facing / re-host affordances. It only borrows the centred-box ROLE vocabulary + the `ROTATION_HANDLE_OFFSET_MM` constant, NOT the box emit/drag path — folding it into the factory would God-shell it. Left untouched.
- **`mep-fixture` (circular diameter handle) + `mep-manifold` (Revit ▲/▼ outlet action grips) — escape-hatch, NOT excluded.** Both keep their extra affordance locally and COMPOSE the factory: the fixture's circular branch is handled before delegating its rectangular path to `adapter.getGrips`/`applyGripDrag`; the manifold appends its outlet grips after `adapter.getGrips` and uses `adapter.applyGripDrag` directly (the outlet kinds have no box role → the adapter short-circuits, and they commit via `commitMepManifoldOutletCountGrip`).

---

## Guard decision

**No `.ssot-registry.json` module / CHECK 3.7·3.18 forbidden-pattern** — consistent with every sibling of this sweep (ADR-594 / 599 / 600). A regex on the adapter shape (`getCentredBoxGrips(...).map`, `KIND_TO_ROLE[...]`) would false-positive on the legitimately-divergent `opening-grips` and on any future bespoke box consumer. Re-introduction of the adapter clone — including a name-independent sibling twin like the field bridge — is caught by **jscpd CHECK 3.28 (ADR-584)**, the token-based detector, plus code review.

---

## Consequences

- **8 adapter files collapsed to ~50-line thin config call-sites** (from ~100-160), the duplicated map/emit/delegate token mass exists exactly once, and the furniture/floorplan field bridge exists exactly once (`mmSuffixedBoxBridge`).
- **A new centred-box grip adapter is a config object** — prefix + min dimension + param bridge + discriminant binding — not a copy-pasted wrapper. Type-safe by construction (`CentredBoxKind<P>`, `toGripInfo` closure; no `any` / no cast on the discriminant).
- **Verification: 68 jest GREEN / 7 suites** — new `create-centred-box-grip-adapter.test.ts` (kind-map round-trip, emit→discriminant binding, corner-drag delegation, referential no-op short-circuit, unknown-kind guard, field-remap round-trip) + the 6 pre-existing box/adapter suites (centred-box + electrical-panel + furniture + mep-fixture + mep-manifold + floorplan-symbol), unchanged. **jscpd CHECK 3.28 (diff) — no new clones across the 9 changed files** (after extracting `mmSuffixedBoxBridge`). No `tsc` (N.17).

---

## Changelog
- **2026-07-08** — Created. TIER B / B5 of the 2026-07-08 duplicate-audit sweep; third leg of the MEP/furniture/floorplan family after ADR-594 (persistence) + ADR-600 (placement). NEW `create-centred-box-grip-adapter.ts` (factory + `buildCentredBoxKindMaps` + `mmSuffixedBoxBridge`) + `create-centred-box-grip-adapter.test.ts`; 8 `{entity}-grips.ts` migrated; `opening-grips.ts` excluded (No God-shell). 68 jest GREEN, jscpd-clean. Uncommitted (Giorgio commits). ADR minted at 602 after 596/598/599/600/601 were taken by concurrent shared-tree agents.
