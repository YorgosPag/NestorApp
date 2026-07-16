# ADR-412 — BIM Family Types (Revit-grade Type/Instance system)

**Status:** 🟢 v0.9 — Φ1+Φ2+Φ3+Φ4+Φ5 + wall auto-typing + **auto-type-on-create (Revit «Generic Wall»)** ✅ browser-verified 2026-06-06. Every new wall (incl. region/manual arbitrary thickness) is born with a shared, persisted, directly-editable type (same thickness ⇒ same type). Φ6 (stair migration) remains. Pending commit (Giorgio commits).
**Date:** 2026-06-06
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

## 5. Phase plan (Wall + Stair unified from the start — Q7)

Q7 (locked): the existing `stair_presets` system is folded into the unified Type system **from the
start**, not deferred. Initial scope therefore covers **Wall (new) + Stair (migrated)**; other
categories (column/beam/opening/slab) follow on the same architecture in later slices.

| Phase | Scope | Files (est.) | Notes |
|---|---|---|---|
| **Φ1 Foundation** ✅ | `BimFamilyType` types + Zod schema + `COLLECTIONS.BIM_FAMILY_TYPES` + `generateBimFamilyTypeId` + Firestore rules + rules test + `BimFamilyTypeService` (3-scope, cache) | ~9 | ✅ DONE (v0.3). No UI. `WallTypeParams` + `StairTypeParams`. |
| **Φ2 Resolution SSoT** ✅ | `resolveEffectiveParams` + `WallEntity.typeId/typeOverrides` + thread resolver into geometry/render/BOQ/grips + params derived-cache refresh | ~10 | ✅ DONE (v0.4). Full-SSoT core. Legacy fast-path (no `typeId`) = zero regression. |
| **Φ3 Built-in catalog** ✅ | Wall built-ins from `getDefaultDnaForCategory()` (5) + Stair built-ins from `buildDefaultStairParams` defaults; client-store merge | ~4 | ✅ DONE (v0.5). **Architecture deviation (CODE wins, N.0.1): built-ins are CODE CONSTANTS** in `built-in-types.ts`, NOT lazy Firestore-seeded — no drift, zero seeding step, every company sees identical factory catalog. `cloneTypeToInput` = clone-to-edit. Merged in `useBimFamilyTypes` (idempotent, built-ins first → fetched win on id collision). |
| **Φ4 UI** ✅ | Type Selector (Radix Select, ADR-001) + Type Properties panel + Duplicate/Rename Type + per-param override + i18n el+en | ~10 | ✅ DONE (v0.6). Contextual Wall ribbon «Τύπος» panel. Per-param override scoped to `category` in Φ4 (always-defined enum); `thickness`/`material` read-only (DNA/structural). New `AssignWallTypeCommand` (undoable) + persistence clear-via-`deleteField` + auto-save type-link detection. |
| **Φ5 Propagation + undo** ✅ | Type-param editing (Edit Type dialog + DNA editor) + all-floors BOQ re-feed + audit + delete→warn→detach (Q6) | ~18 | ✅ DONE (v0.7, Plan Mode). Sync optimistic `UpdateWallFamilyTypeCommand` (NOT compound — in-scene re-flow is free via store-version `useWallTypeReresolution`; emits `bim:family-type-changed`). `DeleteWallFamilyTypeCommand` = CompoundCommand (N×`AssignWallTypeCommand` detach + `CatalogDeleteOp`). All-floors BOQ fan-out via `family-type-side-effects` + host hook `useFamilyTypeBoqRefeed` (`loadFileV2`, no new index). DNA editor = Boy-Scout extracted `WallDnaEditor` (reuse). |
| **Φ6 Stair migration** | Migrate `stair_presets` docs → `bim_family_types` (snapshot→live); `StairEntity.typeId`; data-migration pass; deprecate `StairPresetsService` (re-export shim); update ADR-358 | ~8 | Replaces snapshot model with live links. Back-compat shim during transition. |

**N.8 — Orchestrator territory (CONFIRMED).** Φ1–Φ6 = 40+ files across types / persistence /
rendering / UI / commands / migration = clearly 5+ files & 2+ domains. Per N.8 this needs Giorgio's
**explicit approval** before running an orchestrator (~2.5–3.5× tokens). Alternative = Plan-Mode, one
phase per session (slower, cheaper, more checkpoints). **Decision pending Giorgio (see §7 / handoff).**

---

## 6. SSoT registry (N.12)

New `.ssot-registry.json` Tier 3 module `bim-family-types`:
- Forbid re-declaration of `BimFamilyType` / `resolveEffectiveParams` / `BimTypeParamsByCategory`
  outside the canonical files.
- Forbid direct writes to `bim_family_types` outside `BimFamilyTypeService`.
- Forbid inline `companies/.../bim_family_types` queries outside the service.

---

## 7. Locked decisions (Giorgio, 2026-06-03)

| Q | Topic | Decision |
|---|---|---|
| **Q1** | Where shared params live | **Central live type card** (Revit). `entity.params` = derived read-model cache; SSoT = type + instance fields. Edit type → instances update live. |
| **Q2** | `height` type vs instance | **Instance** (per-wall) — Revit. Type owns structure/thickness/function/material only. |
| **Q3** | Built-in editing | **Clone-to-edit** (Revit Duplicate). Built-ins read-only; editing forks a `user` copy. |
| **Q4** | Override granularity | **Per-parameter** — change one param on one instance, rest stays type-linked; overridden param badged. |
| **Q5** | Default scope for new types | **company** (team-wide). User/project still selectable per save. |
| **Q6** | Delete type in use | **Revit-faithful, non-destructive:** warning dialog; on confirm, instances **detach** (snapshot last resolved params + clear `typeId`) and keep their appearance. Geometry is **never silently deleted**. (Giorgio said "like Revit"; interpreted as Revit's warn-before-acting safety, minus destructive instance deletion. Re-open if hard-delete desired.) |
| **Q7** | Unify `stair_presets` | **From the start** (Φ6 in initial scope, not deferred). Stair snapshot presets → live Types alongside Wall. |

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

- **v0.15 (2026-07-16)** — **`family-type-ui-helpers.ts`: μία generic factory αντί για 4 αντίγραφα**
  (ADR-584 / N.18, Plan Mode μετά από N.8 gate). Η πεντάδα helpers των §3.3/§3.4 ήταν γραμμένη **4
  φορές** (wall/slab/roof/opening). Πλέον τα σώματα ζουν **μία φορά** στη module-private
  `makeFamilyTypeHelpers<C, P>(category, overridableKeys, resolveEffective)` και κάθε κατηγορία είναι
  ~5 γρ. config + thin named re-exports — **ίδιο σχήμα με το αδελφό `resolve-effective-params.ts`**
  (generic core + named wrappers), που είναι η καθιερωμένη πρακτική του φακέλου.
  - **Public API αμετάβλητο**: και οι 20 εξαγωγές κρατούν τις υπογραφές τους → **οι 14 καταναλωτές
    (widgets / dialogs / controllers / stores) δεν αγγίχτηκαν**. Μηδέν cast — τα 4 `*TypeAssignment`
    είναι δομικά ταυτόσημα, άρα structural assignability προς τα named interfaces των commands.
  - **Νέα εγγύηση**: το `C` παράγει το type-param payload μέσω `BimTypeParamsByCategory[C]`, οπότε ο
    compiler απορρίπτει λάθος ζευγάρωμα category/keys/resolver. **Νέα κατηγορία** (`stair`: έχει ήδη
    `StairTypeParams` χωρίς helpers) = ένα config block, όχι 5ο αντίγραφο ~80 γρ.
  - **Κάλυψη**: slab/roof/opening ήταν **ατέστωτα** (μόνο wall είχε δίχτυ). ΝΕΟ
    `__tests__/family-type-helpers-parity.test.ts` (26 tests) πινώνει το per-category wiring· τα 10 wall
    tests **αμετάβλητα**. Σύνολο 205/205. Λεπτομέρειες + mutation-verify: ADR-584 changelog 2026-07-16.

- **v0.14 (2026-07-16)** — **SSoT extraction: `useFamilyTypeEditor` + `family-type-properties-parts`**
  (ADR-584 / N.18 clone ratchet, κοινό με ADR-421 SLICE C). Το CHECK 3.28 σήμανε το
  `RibbonWallTypePropertiesWidget` ↔ `RibbonOpeningTypePropertiesWidget` ως sibling clones (107 διπλές
  γραμμές): **ολόκληρο** το header (label + inline rename input + built-in badge + «Reset to type»),
  **ολόκληρο** το footer («Edit type…»/«Duplicate & edit» + «Delete») και τα rename callbacks ήταν
  identical — διέφερε **μόνο** ποιο Edit-Type store ανοίγει (`openEditWallType` vs
  `openEditOpeningType`). Εξήχθησαν:
  - `ui/ribbon/hooks/useFamilyTypeEditor.ts` — rename draft + re-sync στην αλλαγή τύπου + commit
    guards (built-in read-only / trim / unchanged) + Enter-blur/Escape-revert + το clone-then-open
    flow του «Edit type…». Δέχεται τον category-agnostic `FamilyTypeEditorController` (currentType /
    overriddenKeys / canWrite / resetOverrides / duplicateCurrent / renameType / deleteType) — **κάθε**
    `useXFamilyTypeController` είναι structurally assignable χωρίς αλλαγή· τα category-specific μέλη
    (`wall`/`opening`, `setOverride`, …) μένουν στο δικό τους widget.
  - `ui/ribbon/components/family-type-properties-parts.tsx` — `FamilyTypePropertiesHeader`,
    `FamilyTypeParamRow`, `FamilyTypeOverrideBadge`, `FamilyTypeActions` (pure render).

  Wall widget **240→129** γραμμές — κράτησε μόνο τα δικά του (category Select, thickness/material
  read-only, U-value). Συμπεριφορά αμετάβλητη· το `editable` σφίχτηκε σε `currentType !== null &&
  !isBuiltIn && canWrite` (τα widgets self-hide πριν, αλλά το default ήταν λάθος εκτός context).
  NEW `hooks/__tests__/useFamilyTypeEditor.test.ts` — 18 tests. Επαλήθευση: CHECK 3.28 diff καθαρό,
  full scan 2978→2926 clones (−52), 18/18 GREEN. tsc skip βάσει N.17 (Giorgio / CI CHECK 3.29).
  ⚠️ **Εκκρεμεί απόφαση:** το `RibbonRoofTypePropertiesWidget` (ADR-417 §10 #3) **δεν** μπήκε στο SSoT —
  αποκλίνει σε τρία σημεία (δικό του `roofFamilyType.*` i18n namespace αντί για το κοινό
  `bimFamilyType.*`· χωρίς Tooltip + άλλο input styling· `commitRename` συγκρίνει `currentType.name`
  αντί για το **display** name, με το `typeName` εκτός deps → auto/renamed τύπος δεν συγκρίνεται σωστά).
  Επίσης δείχνει το built-in badge **πάντα**, ακόμα και για user types. Πιθανά bugs, όχι clone —
  χρειάζεται δική του απόφαση, όχι τυφλό merge.
- **v0.13 (2026-06-23)** — **Edit-time auto-type re-flow (fix «το πάχος τοίχου δεν σώζεται»).** **Root cause:** ένας
  default τοίχος είναι auto-linked σε read-only built-in type· ο `UpdateWallParamsCommand.applyPatch` ενημέρωνε
  `params/geometry/validation` αλλά **όχι** το `typeId`, οπότε στο reload ο `docToEntity` ξανα-resolve-άρει params από
  τον (αμετάβλητο) τύπο («type always wins») → πάχος/dna **επαναφέρονταν** στο seed. **Fix (SSoT, ένα chokepoint):** το
  `applyPatch` ξανατρέχει την creation-time policy `resolveAutoWallTypeId(params)` στα ΝΕΑ params — **μόνο** για
  AUTO-linked (built-in) ή untyped τοίχους (νέος SSoT guard `isBuiltInWallTypeId(id)` στο `built-in-types.ts`, mirror του
  `getBuiltInWallTypeId`): custom cross-section → detach (`typeId=undefined` → reload κρατάει το edit)· still-matching
  seed → relink (effective===params)· **undo** συμμετρικό (previousPatch ξανα-resolve-άρει)· user-assigned **custom**
  type μένει ανέγγιχτος (δικός του lifecycle). Καλύπτει όλα τα edit paths (panel/ribbon/grips — ένα command). Tests:
  `UpdateWallParamsCommand.autotype.test.ts` (detach/relink/undo/custom-untouched). Βλ. ADR-363 §wall-panel-2026-06-23.
- **v0.12 (2026-06-12)** — **ADR-447 — Revit wall-type catalog (1→πολλοί τύποι/category).** Νέο SSoT
  `WALL_TYPE_SEEDS` (`wall-dna-types.ts`) + `getBuiltInWallTypeId(key)` key-based + `getBuiltInWallTypes` iterate
  seeds (7 τύποι: exterior 25cm / 25cm+θερμοπρόσοψη / 20cm + interior/partition/parapet/fence). PRIMARY key===category
  → id αμετάβλητο (existing walls resolve)· variants νέα ids. `resolveAutoWallTypeId` matchάρει όλους τους seeds (DNA
  deep-equal). Default cores = κόκκινο τούβλο (RC-frame infill), όχι RC. Βλ. ADR-447.
- **v0.11 (2026-06-08)** — **Opening cross-floor BOQ re-feed (ADR-421 SLICE C follow-up (b))** — the all-floors BOQ
  re-feed (Φ5) now covers the **opening** category, completing project-wide type-edit propagation for all 5 categories.
  Unlike wall/slab/roof (per-entity `bimToBoqBridge`, walls live in the `loadFileV2` scene), openings live **only** in
  `FLOORPLAN_OPENINGS` and use signature-group aggregation — so the opening fan-out is **pure-Firestore** and
  **effective-aware** (no doc re-persist): the type is the SSoT, each persisted doc is resolved «type wins» before
  grouping, the affected signature groups (OLD from the stale drift-cache + NEW effective) are recomputed, and geometry
  self-heals lazily on load. NEW `bim/family-types/opening-boq-side-effects.ts` (`refeedOpeningBoqForTypeAcrossFloors`)
  + `opening-boq-sync.refeedOpeningBoqForTypeOnFloorplan` + grouper pure helpers
  (`buildEffectiveSignatureMembers`/`collectAffectedSignatures`)· `useFamilyTypeBoqRefeed` gains an `opening` branch.
  No new Firestore index (reuses `companyId+projectId+floorplanId`), zero opening/audit writes. Full detail in
  **ADR-421 §changelog 2026-06-08**.
- **v0.10 (2026-06-08)** — **Opening category added (ADR-421 SLICE C consumer)** — the generic framework gains a
  5th category with **ZERO infrastructure fork**: `BimTypeParamsByCategory.opening` + `OpeningTypeParams`
  (kind/width/height/frameWidth?/material?/glazingPanes?/fireRating?), `OpeningTypeParamsSchema` branch in the
  discriminatedUnion + `schemaByCategory.opening`, `resolveEffectiveOpeningParams` wrapper, `getBuiltInOpeningTypes`
  (1/kind = 17). The service/store/collection/enterprise-id/Firestore-rules are reused verbatim (category-blind).
  NEW **generic** `UpdateFamilyTypeCommand` + `DeleteFamilyTypeCommand` extracted (category-agnostic) for opening;
  wall migration to them is a pending-ratchet item. Full detail in **ADR-421 §changelog 2026-06-08**.
- **v0.9 (2026-06-06)** — **Auto-type-on-create (Revit «Generic Wall») — region/manual walls are no longer untyped**
  (Giorgio-approved Plan Mode). **Root cause:** «Τοίχος σε περιοχή» + manual walls with an explicit thickness are
  born with `dna=null` → `resolveAutoWallTypeId` returns `undefined` → no `typeId` → no «Edit Type», no mass
  layer-edit. **Decision (Giorgio):** «like Revit, FULL ENTERPRISE + FULL SSOT» (Q1/Q2), **directly editable** (Q3),
  **no load-migration of legacy walls** (Q5). **Architecture = persisted find-or-create with a SYNCHRONOUS
  enterprise-id stamp at the `onWallCreated` convergence** (all six creation paths funnel through `addWallToScene`):
  same nominal thickness ⇒ same shared type. When the thickness equals a category built-in default → reuse the
  read-only **built-in** (cross-method grouping); else mint a `origin:'auto'`, persisted, **directly-editable**
  «Generic - {thickness}» type. The store is read synchronously → find-or-create is idempotent within a draw batch
  (1st wall inserts the type, 2nd reuses it) with **no flicker, no extra undo step, no new resolution/derive
  plumbing** — Edit Type / reflow (`useWallTypeReresolution`) / BOQ refeed / delete / audit all reused as-is.
  **NEW:** `bim/family-types/auto-wall-type.ts` (pure SSoT: `resolveAutoWallTypeSignature` / `findAutoWallType` /
  `resolveAutoWallTypeIdForSignature` built-in-preference / `buildAutoWallType`) + host hook
  `bim/family-types/useWallAutoTyping.ts §ensureAutoWallType(entity)` (mint via `generateBimFamilyTypeId` N.6 →
  optimistic `setTypes` → fire-and-forget `service.createTypeWithId` + audit → resolve effective params + recompute
  geometry, non-destructive) + `wall-dna-types.ts §buildGenericWallDna(category, thickness)` (single core layer,
  inherits category core material). **CHANGED (additive):** `BimFamilyTypeOrigin`/`BimFamilyTypeOriginSchema` +=
  `'auto'`; `bim-family-type-service.ts §createTypeWithId(type)` (persist with a pre-minted id, validated, sibling
  of `restoreType`); `family-type-ui-helpers.ts §isAutoType` + `resolveTypeDisplayName` interpolates `{thickness}`
  for auto names; `RibbonWallTypePropertiesWidget` (auto = editable + deletable, Edit Type direct, NO inline
  rename — name is a stable key); `useSpecialTools` wraps `onWallCreated` with `ensureAutoWallType`. **i18n:**
  `ribbon.commands.bimFamilyType.auto.wall.generic` (el+en, single-brace ICU per CHECK 3.9). **Tests:** NEW
  `auto-wall-type.test.ts` → family-types **118 PASS**. `buildWallEntity` unchanged (built-in path + its tests
  intact). Not in ADR-040 high-freq path. **Known limitation:** a wall drawn before the initial `listTypes` fetch
  lands may mint a benign duplicate auto-type (non-destructive). **✅ Core browser-verified 2026-06-06 (Giorgio «όλα λειτουργούν»).** **+Direct rename of
generic types (2026-06-06, Giorgio «like Revit»):** auto types are now inline-renamable in the properties widget;
the first rename turns the i18n-key `name` into the literal the user typed while KEEPING the signature grouping
(`findAutoWallType` matches by `origin`+`category`+`thickness`, name-independent → all same-thickness walls stay on
the renamed type — Revit «rename the type, it stays the same type»). `resolveTypeDisplayName` returns the literal
once renamed, the interpolated «Generic {thickness}mm» while still the default key. Reuses `renameType`
(service.updateType + optimistic). +2 tests → **120 PASS**. **Next: 🔴 verify rename + commit.** | Claude (Opus 4.8)
- **v0.8 (2026-06-04)** — **Wall auto-typing — closes the ADR-414 gap «every wall shows the same layers»**
  (Giorgio-approved Plan Mode, recognition-first). **Root cause:** walls were created + persisted WITHOUT a
  `typeId`, so the «Edit Wall Type» panel (ADR-414) edited a type no instance referenced. The whole «type always
  wins» machine was already wired (persistence reads/writes `typeId`, `resolveEffectiveWallParams` runs on load +
  on store `version` bump, built-ins merged in the store) — only the two `typeId` injection points were missing.
  **Decision (Giorgio, locked):** *Read-only built-in + Duplicate-to-edit* — new/legacy walls link to the
  category's read-only built-in type; editing layers goes through Duplicate first (zero seeding/persistence of new
  default types). **Implementation:** NEW SSoT `bim/family-types/built-in-types.ts §getBuiltInWallTypeId(category)`
  (id string declared once, N.0.2) + NEW `bim/family-types/wall-type-auto-assign.ts §resolveAutoWallTypeId(params)`
  — the ONE non-destructive policy: returns the built-in id ONLY when the wall's `thickness`+`dna` are byte-equal
  to the category default (`dequal`), else `undefined` (manual/customised walls stay ad-hoc → resolution never
  snaps geometry to default). Consumed by **creation** (`hooks/drawing/wall-completion.ts buildWallEntity`) and
  **load** (`hooks/data/wall-persistence-helpers.ts docToEntity`, Revit «re-materialise on load»: in-scene +
  drift-tolerant, persisted on next auto-save — NOT a destructive backfill). **Edit panel guard (ADR-414):**
  `EditWallTypeDialog` now detects `origin==='built-in'` → read-only notice + «Duplicate & edit» (clone→assign→
  retarget) + Save disabled; user types show an «applies to N walls» warning via NEW
  `useWallFamilyTypeController.countWallsOfType` (reuse `findWallsByTypeId`). i18n + `editTypeBuiltinNotice`/
  `editTypeAffectsCount` (el+en, single-brace ICU per CHECK 3.9). **Tests:** NEW `wall-type-auto-assign.test.ts`
  (default→built-in id ×5, manual/customised/no-category→undefined) → family-types 83 PASS + wall-completion 22
  PASS; tsc 0 own. Not in ADR-040 high-freq path → no CHECK 6B/6D staging. **Next: Φ6 stair migration.** Pending
  commit + 🔴 browser verify. | Claude (Opus 4.8)
- **v0.7 (2026-06-03)** — **Φ5 Propagation + undo + delete IMPLEMENTED** (Plan Mode, recognition-first).
  Revit-grade «Edit Type» → re-flows to ALL instances on ALL floors, FULL SSoT.
  **Architecture (recognition, N.0.1):** the in-scene geometry re-flow ALREADY exists from Φ2
  (`useWallTypeReresolution` re-resolves the active scene synchronously on the store `version` bump), so the
  edit command is a **synchronous optimistic** op — NOT a CompoundCommand and with NO per-instance children
  (that would double-propagate). NEW `core/commands/entity-commands/UpdateWallFamilyTypeCommand.ts`
  (injected `FamilyTypeMutationDeps`: optimistic `setTypes` + fire-and-forget `service.updateType` + audit +
  EventBus `bim:family-type-changed`). **All-floors BOQ re-feed** (only the BOQ aggregate cache needs eager
  fan-out — geometry re-resolves on load elsewhere): NEW pure `bim/family-types/family-type-side-effects.ts`
  (`findWallsByTypeId` + `refeedBoqForTypeAcrossFloors` via `useLevels().levels` + `DxfFirestoreService.loadFileV2`
  — **no new Firestore index**) driven by NEW host hook `hooks/data/useFamilyTypeBoqRefeed.ts` (mounted in
  `WallPersistenceHost`, which holds project/building context — same separation as wall BOQ). **Edit Type UI:**
  NEW `ui/ribbon/components/EditWallTypeDialog.tsx` (Radix Dialog, ADR-001) editing category/material/thickness +
  full DNA layers; opened via NEW `edit-wall-type-store.ts` from a «Edit type…» button in
  `RibbonWallTypePropertiesWidget` (built-ins → «Duplicate & edit» clone-first). **DNA editor = Boy-Scout SSoT
  extraction (N.0.2):** NEW entity-agnostic `ui/wall-advanced-panel/sections/WallDnaEditor.tsx`; `WallDnaSection`
  is now a thin wrapper — both consumers share one editor, zero new DNA i18n. **Delete→warn→detach (Q6):** NEW
  `DeleteWallFamilyTypeCommand.ts` = `CompoundCommand` of N×`AssignWallTypeCommand` (detach current-scene
  instances, params kept = non-destructive) + `CatalogDeleteOp` (optimistic store removal + `service.deleteType`,
  undo restores via NEW `service.restoreType` preserving the ORIGINAL id). Warn dialog: NEW
  `bim-family-type-delete-store.ts` (Promise handshake) + `ui/dialogs/BimFamilyTypeDeleteDialog.tsx` (mirror
  `WallCascadeDeleteDialog`). **Audit (N.11 CHECK 3.17):** `bim_family_type` added to `AuditEntityType` +
  `/api/audit-trail/record` route (subcollection ownership-verify path: `companies/{companyId}/bim_family_types`)
  + `BIM_FAMILY_TYPE_TRACKED_FIELDS` + NEW client `bim-family-type-audit-client.ts`; service comment updated
  (audit now at command layer). i18n: + `editType*`/`duplicateAndEdit`/`deleteType*` keys (el+en parity,
  single-brace ICU per CHECK 3.9). **Known limitation (documented, not silent):** instances on levels without a
  `sceneFileId`, and cross-floor walls on type DELETE, keep correct geometry (type=SSoT on load with graceful
  fallback when the type is gone) but their BOQ / dangling `typeId` are eventual — full eager coverage would need
  a `floorplan_walls WHERE buildingId==X AND typeId==Y` composite-index query (out of Φ5 scope). **Tests:** 22 new
  (`UpdateWallFamilyTypeCommand` 7 + `family-type-side-effects` 5 + `DeleteWallFamilyTypeCommand` 5 + reuse) →
  309 family-types+commands tests PASS; tsc 0 own errors (the single repo error
  `bim-3d/converters/mesh-to-object3d.ts:124` is unrelated shared-tree mesh work). No canvas/micro-leaf file →
  no ADR-040 staging (CHECK 6B/6D N/A). **Next: Φ6 stair migration.** Pending commit + 🔴 browser verify. | Claude (Opus 4.8)
- **v0.6 (2026-06-03)** — **Φ4 UI IMPLEMENTED** (orchestrator, recognition-first → serial,
  Giorgio-approved N.8). Contextual Wall ribbon gains a «Τύπος» panel with two leaf widgets:
  NEW `ui/ribbon/components/RibbonWallFamilyTypeWidget.tsx` (Radix `Select`, ADR-001 — built-in +
  user wall types + «no type / ad-hoc» clear via `SELECT_CLEAR_VALUE`, NOT '' per the ADR-411 lesson;
  «Duplicate» = clone-to-edit Q3) and NEW `RibbonWallTypePropertiesWidget.tsx` (effective type-governed
  params display + per-param **override** badge with reset-to-type Q4 + inline rename of user types).
  Both are presentational; all logic lives in NEW `ui/ribbon/hooks/useWallFamilyTypeController.ts` (SSoT:
  assign/clear/override via the NEW undoable `core/commands/entity-commands/AssignWallTypeCommand.ts`,
  duplicate/rename via `BimFamilyTypeService` + optimistic `bim-family-type-store` update — the MEP
  «optimistic upsert» idiom). NEW pure `bim/family-types/family-type-ui-helpers.ts` (catalog slicing,
  display-name resolution, override detection, effective-param assignment builder). Panel registered in
  `contextual-wall-tab.ts` + `RibbonPanel.tsx` `renderButton` switch. i18n: new `ribbon.commands.bimFamilyType.*`
  block (el+en, 28 keys, parity verified) + `ribbon.panels.wallFamilyType`. **Persistence gap closed:**
  `useWallPersistence.persist` now sends the family-type link through `updateWall` (NEW `wallUpdatePatch`
  helper) and a clear/detach persists as `deleteField()` (`WallUpdateInput.typeId/typeOverrides` accept
  `null`); the auto-save trigger ORs in a type-link change (NEW `wallTypeLinkChanged`) so a non-destructive
  detach — which keeps params identical (Q6) — still re-saves. **Φ4 scoping (recorded N.0.1):** the
  per-param override editor exposes `category` only (always-defined enum, no none-ambiguity); `thickness`/
  `material` are shown read-only (DNA-/structurally-governed, edited on the type itself). Full propagation +
  undo on a type edit (BOQ re-feed + audit) remains Φ5 (`UpdateFamilyTypeCommand`); Φ4 «Rename» updates the
  doc + bumps the store version, and the existing `useWallTypeReresolution` re-flows it onto instances. 17
  new tests (`family-type-ui-helpers` 10 + `AssignWallTypeCommand` 7), 76/76 family-types+command tests PASS,
  0 tsc errors in own files (the single repo error `bim-3d/converters/mesh-to-object3d.ts:124` is unrelated
  furniture/mesh work). NOT a canvas/micro-leaf file → no ADR-040 staging (CHECK 6B/6D do not apply). **Next:
  Φ5 propagation + undo.** | Claude (Opus 4.8)
- **v0.5 (2026-06-03)** — **Φ3 Built-in catalog CONFIRMED DONE** (was folded into the Φ2 orchestrator
  output; verified in a fresh session after the orchestrator screen froze mid-run). `bim/family-types/built-in-types.ts`
  ships `getBuiltInWallTypes` (5 categories from `getDefaultDnaForCategory` SSoT), `getBuiltInStairTypes`
  (residential + narrow, seeded from `buildDefaultStairParams` constants — rise 175 / tread 280, ΝΟΚ
  profile), `getAllBuiltInTypes`, and `cloneTypeToInput` (clone-to-edit, Q3). **Architecture deviation from
  the §5 Φ3 plan, recorded per N.0.1 (CODE = source of truth): built-ins are CODE CONSTANTS, NOT lazy
  Firestore per-company seeding** — rationale: no drift (code is SSoT), zero seeding step, identical
  factory catalog for every company, and built-ins derive directly from the wall-DNA / stair-default
  SSoTs so they can never disagree with the defaults they are named after. `useBimFamilyTypes` merges
  built-ins (built-ins first, Firestore-fetched user/company/project types win on id collision) and the
  store's `dequal` guard keeps the merge idempotent. 104/104 family-types tests PASS, 0 tsc (own files);
  the single repo tsc error (`bim-3d/converters/mesh-to-object3d.ts:124`) is pre-existing furniture/mesh
  work by another agent, unrelated to ADR-412. **Next: Φ4 UI.** | Claude (Opus 4.8)
- **v0.4 (2026-06-03)** — **Φ2 Resolution IMPLEMENTED**. NEW `bim/family-types/resolve-effective-params.ts`
  — pure SSoT: `resolveEffectiveParams<P,TP>(params, typeParams, overrides)` = `{...params, ...typeParams,
  ...overrides}` (type wins over instance for type-governed fields, overrides win last) +
  `resolveEffectiveWallParams(instance, type)` with legacy fast-path (no `typeId`/no type → params
  unchanged = ZERO regression). NEW `bim-family-type-store.ts` (zustand + `subscribeWithSelector` +
  dequal idempotent set + monotonic `version`, mirrors `mep-system-store`) + `useBimFamilyTypes` hook
  (sole store writer, mounted in `WallPersistenceHost`). `WallEntity.typeId?`/`typeOverrides?` +
  `wall.schemas` + `wall-firestore-service` round-trip (additive, optional). Resolution injected in
  `docToEntity` (single WallDoc→WallEntity point, static store read so the pure helper resolves;
  recomputes geometry+validation only when effective params changed); `wallEntityDiffersFromDoc`
  compares **effective** params (no per-snapshot churn). Re-resolution on type edit / late type-load via
  `useWallTypeReresolution` (subscribes to store `version`, re-resolves only non-dirty typed walls —
  local edits win). 92/92 tests PASS, 0 tsc (own files). | Claude (Opus 4.8)
- **v0.3 (2026-06-03)** — **Φ1 Foundation IMPLEMENTED** (orchestrator, Giorgio-approved N.8). NEW
  `bim/types/bim-family-type.ts` (`BimFamilyType<C>`, `WallTypeParams`, `StairTypeParams`,
  `BimTypeParamsByCategory`, scope/origin — 14 exports) + `bim/types/bim-family-type.schemas.ts` (Zod
  1:1). Plumbing: `COLLECTIONS.BIM_FAMILY_TYPES` + `generateBimFamilyTypeId` (prefix `bimftype` in
  `enterprise-id-prefixes.ts`, N.6) + Firestore rules `match /companies/{companyId}/bim_family_types/{typeId}`
  (verbatim clone of the hardened `stair_presets` block, 3-scope, owner-create, immutable
  companyId/scope/owner on update, owner-or-company_admin delete). NEW
  `bim/family-types/bim-family-type-service.ts` (353 lines: listTypes/saveType/updateType/deleteType +
  5-min cache + factory, Zod-validated writes, mirrors `StairPresetsService`). 77/77 tests PASS, 0 tsc
  errors (own files). `height`=instance confirmed (not in `WallTypeParams`). | Claude (Opus 4.8)
- **v0.2 (2026-06-03)** — Clarification phase with Giorgio complete (Q1-Q7 locked, asked one-by-one
  in plain language). §7 Open Questions → **Locked decisions**: Q1 central live type card (params =
  derived cache), Q2 height=instance, Q3 clone-to-edit, Q4 per-parameter override, Q5 default
  scope=company, Q6 non-destructive warn+detach on delete, Q7 unify `stair_presets` from the start.
  §5 phase plan restructured → **Wall + Stair unified from the start** (Φ6 stair migration now in
  initial scope, was deferred), N.8 orchestrator territory CONFIRMED (40+ files, decision pending).
  Still DRAFT — awaiting Giorgio's go-ahead on the design + the orchestrator-vs-Plan-Mode choice. | Claude (Opus 4.8)
- **v0.1 (2026-06-03)** — DRAFT created (Opus 4.8). RECOGNITION (N.0.1): confirmed ADR number =
  **412** (not 378 = Snap System); mapped existing proto-type systems (`stair_presets`,
  `section-catalog`, `wall-DNA`, material catalogs). Locked with Giorgio: Q1 hybrid live+override,
  Q2 Wall first slice, Q3 full-SSoT unification (target; slice #1 Wall), Q4 single
  `bim_family_types` collection mirroring `stair_presets` enterprise plumbing. Directive: "Revit way,
  full enterprise + full SSoT." Awaiting design approval before any code; implementation is N.8
  orchestrator territory (explicit approval required).
