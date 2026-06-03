# ADR-412 — BIM Family Types (Revit-grade Type/Instance system)

**Status:** 🟡 DRAFT v0.1 — awaiting Giorgio approval (NO code until approved)
**Date:** 2026-06-03
**Author:** Claude (Opus 4.8)
**Supersedes numbering note:** This is the "BIM Family Types" successor that ADR-377 §Related
mistakenly called "ADR-378". **ADR-378 is the Snap System Master** — the correct number for Family
Types is **ADR-412** (next free after ADR-411). ADR-377 §Related must be corrected to point here.

**Related:**
- ADR-377 (BIM Subcategories) — *orthogonal sibling*. Subcategories style **parts of geometry**;
  Family Types define **named variants of an element**. Q7 scope-split locked 2026-05-26.
- ADR-363 (BIM Drawing Mode) — `BimEntity<TKind, TParams, TGeometry>` base.
- ADR-358 (Stair tool) §5.3 #7 / §6.6 / §9.2 Q32 — existing `stair_presets` 3-scope library
  (**this ADR's unification target**, Phase 6).
- ADR-375 (V/G + object styles) — render-settings store pattern reused for type-aware resolution.
- ADR-017 / ADR-210 / ADR-294 (Enterprise IDs) — new `generateBimFamilyTypeId()` generator.
- ADR-040 (Canvas performance) — type-resolved params must fold into render/cache invalidation.

---

## 1. Context

Today every BIM entity stores **all** its parameters inline in `entity.params`
(`BimEntity<TKind, TParams, TGeometry>`, ADR-363 §5.1). A wall that is "the same" as 50 other walls
duplicates `thickness`, `dna` (layer composition), `category`, `material` 50 times. To change "all
exterior 30cm walls to 35cm" the user must edit each wall.

Real BIM tools solve this with a **Type/Instance** split:

| Layer | Owns | Example (Wall) |
|---|---|---|
| **Type** (Family Type) | Shared properties common to all instances of the type | structure (layers), thickness, function, material |
| **Instance** | Per-placement geometry + optional overrides | location line, height, base/top constraints, flip |

Editing a Type live-updates every instance referencing it (unless an instance overrides that
parameter). This is **the** defining BIM feature missing from the platform.

### Partial precedents already in the codebase (RECOGNITION — code wins)

The platform already grew **proto-type systems**, scattered and inconsistent — this ADR unifies them:

| System | What it does today | Gap vs Revit Type |
|---|---|---|
| `stair_presets` (`StairPresetsService`) | 3-scope (user/company/project) named param libraries, `setDoc`+`generateStairPresetId`, Firestore rules, 5-min cache | **Snapshot** (copy-on-apply) — no live link, no propagation |
| `section-catalog.ts` (`ISHAPE_CATALOG`, EN 10365) | Built-in steel sections for column/beam | Built-in catalog only — not user-extensible, not a "type" doc |
| `wall-dna-types.ts` + `getDefaultDnaForCategory()` | Layered wall composition + per-category defaults | A wall Type's structure **in disguise** — not named, not shared, not persisted as a type |
| `wall-material-catalog.ts` / `stair-material-catalog.ts` | Built-in materials | Type-level params, ad-hoc |

**Decision driver (Giorgio, 2026-06-03):** *"Do it the way the big players (Revit) do it — full
enterprise + full SSoT."* → one unified Type system, live links, instance overrides, built-in +
user types, with the scattered precedents migrating into it.

---

## 2. Industry research (Revit / ArchiCAD / Vectorworks)

| Tool | Type concept | Instance override | Built-in + user | Storage |
|---|---|---|---|---|
| **Revit** | System Families (Wall/Floor/Roof) have **Types**; Loadable Families have Types. "Type Parameters" vs "Instance Parameters". Edit Type → all instances update. "Duplicate" to fork. | Instance parameters override; some params are instance-only | Built-in system types + user-duplicated | In-model `.rvt` |
| **ArchiCAD** | Favorites + Building Materials + Composites (layered = wall DNA) | Per-element override | Built-in attributes + user | Attribute manager |
| **Vectorworks** | Resource Manager styles; "by style" vs "by instance" param toggle per parameter | Per-parameter style/instance toggle | Built-in + user | Resource libraries |

**Convergence (3/3):** (a) named shared type definition, (b) live propagation on type edit,
(c) per-parameter instance override, (d) built-in + user-defined, (e) "duplicate to fork".
ADR-412 adopts all five. Vectorworks' **per-parameter by-style/by-instance toggle** is the cleanest
UX for (c) and is adopted for the override model.

---

## 3. Decision

### 3.1 Core model — `BimFamilyType` (unified, category-discriminated)

One document type, one collection, category discriminator (Q4 — full-SSoT single collection):

```ts
// bim/types/bim-family-type.ts  (NEW — SSoT)
export type BimFamilyTypeScope = 'user' | 'company' | 'project';
export type BimFamilyTypeOrigin = 'built-in' | 'user';

/** Category-keyed map of which params are TYPE-level (shared). SSoT. */
export interface BimTypeParamsByCategory {
  wall: WallTypeParams;
  column: ColumnTypeParams;
  beam: BeamTypeParams;
  opening: OpeningTypeParams;
  slab: SlabTypeParams;
  stair: StairTypeParams;
  // ... extended per slice
}

export interface BimFamilyType<C extends keyof BimTypeParamsByCategory = keyof BimTypeParamsByCategory> {
  readonly id: string;                       // generateBimFamilyTypeId()
  readonly category: C;                       // discriminator
  readonly name: string;                      // 'Εξωτερικός 30cm'
  readonly scope: BimFamilyTypeScope;         // user | company | project (mirror stair_presets)
  readonly origin: BimFamilyTypeOrigin;       // built-in (seeded) | user
  readonly typeParams: BimTypeParamsByCategory[C]; // ONLY type-level params
  // enterprise tenant + audit fields (mirror stair_presets exactly)
  readonly companyId: string;
  readonly ownerId: string;
  readonly projectId?: string;                // only when scope === 'project'
  readonly createdAt?: Timestamp | null;
  readonly createdBy?: string;
  readonly updatedAt?: Timestamp | null;
  readonly updatedBy?: string;
}
```

### 3.2 Type-param vs Instance-param split (Wall, slice #1)

Following Revit Wall semantics exactly:

| Param | Layer | Rationale |
|---|---|---|
| `dna` (layer composition) | **Type** | Revit "Structure" = type param |
| `thickness` | **Type** (derived from `dna.totalThickness`) | function of structure |
| `category` (exterior/interior/partition/parapet/fence) | **Type** | Revit "Function" = type param |
| `material` (bare-wall hatch) | **Type** | type param |
| `start` / `end` (location line) | **Instance** | per-placement geometry |
| `height` | **Instance** | Revit: height is instance (top constraint / unconnected height) |
| `flip`, `startBevel`/`endBevel`, miters | **Instance** | per-placement |
| `tilt` | **Instance** | per-placement (ADR-404) |
| `baseBinding`/`topBinding`/offsets, `attachTopToIds`/`attachBaseToIds` | **Instance** | ADR-369/401 constraints |
| `storeyId`, `sceneUnits`, `envelopeFunction` | **Instance** | placement context |

→ `WallTypeParams = { dna?, thickness, category, material? }`. Everything else stays instance-level.

### 3.3 Instance ↔ Type link + override (hybrid model — Q1)

```ts
// added to BimEntity (or per-entity interface) — back-compat optional
readonly typeId?: string;                              // FK → BimFamilyType.id
readonly typeOverrides?: Partial<BimTypeParamsByCategory[C]>; // per-instance override of type params
```

- `typeId` absent → **legacy/ad-hoc** instance (params self-contained, today's behaviour). Full
  back-compat — no migration of existing entities required.
- `typeId` present, param **not** in `typeOverrides` → value comes **live** from the Type.
- `typeId` present, param **in** `typeOverrides` → instance value wins (Revit "by instance").

### 3.4 Resolution SSoT — the heart of full-SSoT

ONE pure function resolves effective params. Every geometry/render/BOQ/grip path reads through it:

```ts
// bim/family-types/resolve-effective-params.ts  (NEW — SSoT)
export function resolveEffectiveParams<C>(
  instance: { params; typeId?; typeOverrides? },
  type: BimFamilyType<C> | null,
): EffectiveParams {
  if (!instance.typeId || !type) return instance.params;        // legacy fast-path
  return {
    ...instance.params,        // instance-only params (start/end/height/flip/...)
    ...type.typeParams,        // type params (dna/thickness/category/material)
    ...instance.typeOverrides, // per-instance overrides win
  };
}
```

**`entity.params` becomes a derived read-model cache** (same philosophy as `entity.geometry` cache
in ADR-363 §5.1 — re-derivable, SSoT = type + instance fields). Consumers that read `entity.params`
keep working unchanged; the cache is refreshed whenever the type changes (§3.5). This is the **key
architectural call** flagged for Giorgio's review (§8 Q1).

### 3.5 Propagation + undo (Google-level N.7.2)

Editing a Type is **one** undoable operation:

```
UpdateFamilyTypeCommand (CompoundCommand):
  1. update BimFamilyType doc (typeParams)
  2. for each instance with this typeId AND no override of changed field:
       recompute geometry + refresh params cache + persist
  3. re-feed BOQ for each affected instance (bimToBoqBridge)
  4. audit: recordChange on type + touched instances
→ single undo restores type + all instances atomically.
```

- **Idempotent** (N.7.2 #3): re-running with same typeParams = no-op diff.
- **Race-free** (N.7.2 #2): type write commits before instance recompute fan-out.
- Overriding instances are **skipped** for the overridden field only (per-param granularity).

### 3.6 Built-in (factory) types

Seed read-only built-in types per category (Revit system types). For Wall: derive 5 from
`getDefaultDnaForCategory()` (exterior / interior / partition / parapet / fence) →
`origin: 'built-in'`. Built-ins are **clone-to-edit** ("Duplicate", Revit pattern): editing a
built-in forks a `user`-scoped copy. This **unifies wall-DNA defaults into the type system** (SSoT
for defaults). Seeded lazily on first read per company (idempotent, `setDoc` with deterministic id).

### 3.7 UI (Revit-grade)

- **Type Selector** — Radix `Select` (ADR-001 canonical) in the contextual ribbon when a wall is
  selected / the wall tool is active. Lists built-in + user types (3-scope merge).
- **Type Properties panel** — edit type params; `Edit Type` + `Duplicate` buttons (Revit).
- **Instance override affordance** — per-param "by type / by instance" toggle (Vectorworks pattern);
  overridden params badged.
- All strings via i18n (N.11), no hardcoded text.

---

## 4. Storage, IDs, Rules (full enterprise — mirror `stair_presets`)

- **Collection:** `companies/{companyId}/bim_family_types/{typeId}` (subcollection — same parent as
  `stair_presets`). New `COLLECTIONS.BIM_FAMILY_TYPES` in `firestore-collections.ts`.
- **IDs (N.6):** `setDoc()` + new `generateBimFamilyTypeId()` in `enterprise-id.service.ts`
  (prefix e.g. `bimftype_`). No `addDoc`.
- **Rules:** clone the `stair_presets` block verbatim (3-scope read, owner-create with
  `companyId`/`ownerId`/`scope` validation, owner-only update with immutable companyId/scope/owner,
  owner-or-company_admin delete). Add CHECK 3.16 rules test coverage (ADR-298).
- **Audit (N.11 CHECK 3.17):** type writes call `EntityAuditService.recordChange()`.
- **Service:** `BimFamilyTypeService` mirrors `StairPresetsService` (3-scope fetch, 5-min cache,
  invalidate-on-write).

---

## 5. Phase plan (vertical slice = Wall, then unify)

| Phase | Scope | Files (est.) | Notes |
|---|---|---|---|
| **Φ1 Foundation** | `BimFamilyType` types + Zod schema + collection const + `generateBimFamilyTypeId` + Firestore rules + `BimFamilyTypeService` + rules test | ~8 | No UI, no entity wiring. Wall typeParams only. |
| **Φ2 Resolution** | `resolveEffectiveParams` SSoT + `WallEntity.typeId/typeOverrides` + thread resolver into geometry/render/BOQ + params-cache refresh | ~10 | The full-SSoT core. Legacy fast-path = zero regression. |
| **Φ3 Built-in seed** | 5 wall built-ins from `getDefaultDnaForCategory()` + lazy idempotent seeding | ~3 | Unifies wall-DNA defaults. |
| **Φ4 UI** | Type Selector (Radix Select) + Type Properties panel + Duplicate/Edit Type + i18n el+en | ~8 | Contextual ribbon, ADR-001. |
| **Φ5 Propagation + undo** | `UpdateFamilyTypeCommand` CompoundCommand + BOQ re-feed + audit + per-param override skip | ~5 | Google-level N.7.2. |
| **Φ6 Unification roadmap** | Migrate `stair_presets` → `bim_family_types` (snapshot→live); fold `section-catalog`/`wall-DNA` defaults as built-ins (column/beam/stair slices) | separate ADR slices | Documented target, not in slice #1. |

**N.8 note:** Φ1–Φ5 together = 15+ files across 3+ domains (types/persistence/render/UI/commands) =
**Orchestrator territory**. Per N.8, orchestrator runs **only with Giorgio's explicit approval after
this ADR is approved**. Alternative: Plan-Mode, one phase per session.

---

## 6. SSoT registry (N.12)

New `.ssot-registry.json` Tier 3 module `bim-family-types`:
- Forbid re-declaration of `BimFamilyType` / `resolveEffectiveParams` / `BimTypeParamsByCategory`
  outside the canonical files.
- Forbid direct writes to `bim_family_types` outside `BimFamilyTypeService`.
- Forbid inline `companies/.../bim_family_types` queries outside the service.

---

## 7. Open Questions (for Giorgio — review before code)

| Q | Topic | Proposed (review) |
|---|---|---|
| **Q1** | `params` as derived cache vs denormalized copy | **Derived cache** (SSoT = type+instance, params re-derived; Revit-true). Trade-off: every read path must resolve. Alternative = denormalized copy + propagation rewrite (simpler, less pure). **Confirm.** |
| Q2 | `height` type vs instance | **Instance** (Revit). Confirm — some users expect "wall type" to fix height. |
| Q3 | Built-in editing | **Clone-to-edit** (Revit Duplicate). Built-ins read-only. Confirm. |
| Q4 | Override granularity | **Per-parameter** (Vectorworks by-style/by-instance). Confirm vs all-or-nothing. |
| Q5 | Scope default for new types | **company** (team reuse). Confirm vs user. |
| Q6 | Type rename / delete with live instances | On delete: instances fall back to ad-hoc (snapshot last resolved params, `typeId` cleared). Confirm. |
| Q7 | Unify `stair_presets` now or later | **Later** (Φ6, separate slice) to keep slice #1 small. Confirm. |

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Resolver in every read path → perf | Pure fn + per-frame type-map cache (sub-µs lookup, ADR-377 pattern); legacy fast-path skips entirely |
| Migration of existing walls | None required — `typeId` optional, absent = today's behaviour |
| Propagation fan-out on large models | Single CompoundCommand, batched persist, idempotent; skip overriding instances |
| `params` cache drift from type | Cache refreshed inside `UpdateFamilyTypeCommand`; re-derivable on corruption (geometry-cache pattern) |
| ADR-040 cache invalidation | `bimSettingsHash` / entity params hash already folds params; type-resolved params land in params cache → invalidation automatic |
| Scope/tenant leakage | Firestore rules cloned from hardened `stair_presets` block + CHECK 3.16 test |

---

## 9. Changelog

- **v0.1 (2026-06-03)** — DRAFT created (Opus 4.8). RECOGNITION (N.0.1): confirmed ADR number =
  **412** (not 378 = Snap System); mapped existing proto-type systems (`stair_presets`,
  `section-catalog`, `wall-DNA`, material catalogs). Locked with Giorgio: Q1 hybrid live+override,
  Q2 Wall first slice, Q3 full-SSoT unification (target; slice #1 Wall), Q4 single
  `bim_family_types` collection mirroring `stair_presets` enterprise plumbing. Directive: "Revit way,
  full enterprise + full SSoT." Awaiting design approval before any code; implementation is N.8
  orchestrator territory (explicit approval required).
