# ADR-382 — Visibility Resolver SSoT (BIM 2D + 3D)

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟢 **PHASE A+B+C+D+E COMPLETE** 2026-05-27 — Resolver SSoT + 7/7 BIM 2D renderers (Phase A by Haiku + Phase B by Opus) + 3D BimSceneLayer per-entity loop + floorVisModes propagation chain + LayerStore subscriber wiring (Phase C by Opus). SSoT registry entry + ΕΚΚΡΕΜΟΤΗΤΕΣ + ADR-381 §3 closure (Phase D). 54/54 tests PASS (27 resolver unit + 10 V/G regression + 17 Phase C integration). 2D⟷3D parity achieved — `layer.visible=false` now hides BIM entities in both viewports. |
| **Date** | 2026-05-27 |
| **Category** | DXF Viewer — Visibility / Cross-Cutting |
| **Location** | `docs/centralized-systems/reference/adrs/ADR-382-visibility-resolver-ssot.md` |
| **Author** | Claude Opus 4.7 + Γιώργος Παγώνης |
| **Parent** | [ADR-381 §2.5 C1](./ADR-381-dxf-viewer-duplication-audit-master.md) — Visibility / Layer / Floor CRITICAL finding |
| **Companions** | ADR-040 (rendering lifecycle / micro-leaf), ADR-358 §5.6.bis (LayerStore SSoT), ADR-375 (V/G Phase C.4 visibility hotfix), ADR-369 (3D building/floor visibility) |
| **Industry alignment** | Revit V/G + Worksets intersection model · ArchiCAD Layer Combinations · AutoCAD `LAYOFF`/`LAYFRZ` semantics |
| **Effort** | ~3 days Opus (per ADR-381 §3) |
| **Risk** | Medium — production rendering logic, touches 9 files (7 BIM 2D renderers + BimSceneLayer + future opening tag/dim renderers) |

---

## Summary

Δημιουργία **ενός SSoT resolver** `resolveIsEntityVisible(entity, ctx)` που συμβουλεύεται **και τις 4** ενεργές runtime visibility sources (V/G category + Layer + Floor + Building) σε **κάθε render path** (BIM 2D + BIM 3D), αντικαθιστώντας τη σημερινή κατάσταση όπου:

- **2D BIM** ελέγχει μόνο V/G (αγνοεί `Layer.visible`)
- **3D BIM** ελέγχει μόνο V/G + post-hoc Floor/Building (αγνοεί `Layer.visible`)
- **Legacy DXF** ελέγχει `Layer.visible` αλλά όχι V/G/Floor/Building

Παράλληλα διορθώνει το **CONFIRMED production bug**: όταν ο χρήστης κλείσει το μάτι σε layer που περιέχει BIM entities, αυτά παραμένουν ορατά (παρόλο που οι μηχανισμοί επιλογής τα ξέρουν ως κρυμμένα — ασύμμετρη συμπεριφορά).

---

## 1. Pre-fix State (verified 2026-05-27 grep evidence)

### 1.1 Bug confirmation

```
$ rg "layer\.visible|isLayerVisible|getLayer\(.+\)\.visible" src/subapps/dxf-viewer/bim/    → 0 matches
$ rg "layer\.visible|isLayerVisible|getLayer\(.+\)\.visible" src/subapps/dxf-viewer/bim-3d/  → 0 matches
$ rg "layer\.visible"                                       src/subapps/dxf-viewer/canvas-v2/ → 4 matches (legacy DXF path works correctly)
```

7/7 BIM 2D renderers (`WallRenderer` / `ColumnRenderer` / `SlabRenderer` / `BeamRenderer` / `StairRenderer` / `OpeningRenderer` / `SlabOpeningRenderer`) καλούν `getLayer(entity.layerId)` **μόνο για χρώμα + lineweight** (μέσω `BimLayerOverride`). Κανένας δεν συμβουλεύεται `layer.visible`.

`BimSceneLayer.sync()` (3D) consults V/G ανά κατηγορία και εφαρμόζει Floor/Building visibility post-hoc σε `mesh.visible`, αλλά δεν διαβάζει `LayerStore` καθόλου.

Συνέπεια: ο χρήστης κρύβει layer στο Layer Manager → entities παραμένουν ορατά (canvas + 3D), αλλά δεν επιλέγονται (selection systems σέβονται `layer.visible`). **Φαντασματική συμπεριφορά.**

### 1.2 Sources matrix (4 runtime + 1 derived)

| Source | Owner | Runtime read | 2D BIM | 3D BIM | Legacy DXF 2D | Legacy DXF 3D |
|---|---|---|---|---|---|---|
| **V/G** `objectStyles[cat].visible` | `bim-render-settings-store` (per-level) | `resolveIsCategoryVisible(cat, objectStyles)` | ✅ early-return | ✅ category guard | N/A | N/A |
| **`Layer.visible`** | `LayerStore` (project-global) | `getLayer(id).visible` | 🔴 **IGNORED** | 🔴 **IGNORED** | ✅ `isEntityLayerSkipped` | ⚠️ upstream-dependent |
| **Floor visibility** | `floor-visibility-state` (3D-only) | `applyFloorVisibility(group, modes)` post-hoc | N/A | ✅ mesh.visible mutation | N/A | N/A |
| **Building visibility** | `building-visibility-state` (3D-only) | `applyBuildingVisibility(group, modes)` post-hoc | N/A | ✅ mesh.visible mutation | N/A | N/A |
| **ViewTemplate** | `view-template-store` | ⚠️ **NOT runtime** — `applyViewTemplate()` περσιστάρει `template.settings` ως `bimRenderSettings` στο level doc (Firestore). Διαβάζεται ως V/G `objectStyles`. | — (merged-down) | — (merged-down) | — | — |

**Διόρθωση ADR-381 §2.5**: Οι 5 sources που αναφέρει το audit είναι ουσιαστικά **4 distinct runtime sources**. Το ViewTemplate δεν είναι παράλληλη πηγή — γίνεται merge στο V/G κατά το `applyViewTemplate`.

---

## 2. Decisions (4 Open Questions — all resolved 2026-05-27)

### Q1 — Layer hidden semantics

**Decision**: **Revit-style absolute hide.** Hidden layer = entity κρυμμένο **εντελώς** (2D + 3D + PDF export + selection). Όχι plot-only AutoCAD semantics. Όχι hybrid "hidden on canvas, visible in outliner".

**Justification**: Industry standard για όλα τα BIM apps (Revit, ArchiCAD, Vectorworks). Consistent με την υπάρχουσα `LAYOFF`/`LAYFRZ` συμπεριφορά του legacy DXF path (`canvas-v2/DxfRenderer.ts:363-380`).

### Q2 — Priority hierarchy (intersection vs supremacy)

**Decision**: **ANY-hides-wins (AND-of-shows intersection).** Αν ΟΠΟΙΑΔΗΠΟΤΕ από τις 4 πηγές πει "κρύψε" → entity κρυμμένο. Όλες οι 4 πρέπει να συμφωνούν "δείξε" για να εμφανιστεί.

```
isVisible = vgVisible AND layerVisible AND floorVisible AND buildingVisible
```

**Justification**: Standard intersection model (Revit / ArchiCAD / AutoCAD). Διαισθητικό για τον χρήστη ("αν κρύψω από οπουδήποτε, εξαφανίζεται"). Δεν χρειάζεται complex precedence rules.

### Q3 — 2D / 3D parity

**Decision**: **Πάντα ίδια ορατότητα.** Ένα state, και τα δύο paradigms το διαβάζουν. Δεν προστίθεται "per-view-type V/G" (αυτό θα ήταν ξεχωριστό ADR-XXX αν χρειαστεί).

**Justification**: Η σημερινή αρχιτεκτονική (`bim-render-settings-store` per-level) ήδη το υποστηρίζει — το ADR-382 απλά εξασφαλίζει consistent consumption σε **και τα 2** paradigms. Multi-view divergence = future scope.

### Q4 — Ghost mode + V/G hide interaction

**Decision**: **Hide stronger than ghost.** Το ghost mode του Floor είναι **μόνο στυλιστικό** (διαφανές material), όχι override visibility. Όταν V/G κρύβει την κατηγορία → entity κρυμμένο ακόμα και σε ghost floor.

**Justification**: Consistent με Q2 ANY-hides-wins. Ο σημερινός κώδικας ήδη το κάνει σωστά λόγω σειράς εκτέλεσης (V/G guards mesh creation → no mesh για applyFloorVisibility να ghost-ify). Το ADR-382 διατηρεί αυτή τη σειρά.

---

## 3. Target Architecture

### 3.1 New SSoT module: `bim/visibility/visibility-resolver.ts`

```ts
/**
 * ADR-382 — Visibility Resolver SSoT.
 *
 * Single source of truth για visibility decisions σε BIM entities (2D + 3D).
 * Consults all 4 runtime sources με intersection semantics (ANY-hides-wins).
 *
 * Pure function, no React, no subscriptions. Καλείται event-time από κάθε
 * render path πριν δημιουργηθεί mesh / πραγματοποιηθεί canvas draw.
 */

import type { BimCategory } from '../../config/bim-object-styles';
import type { ObjectStyle } from '../../config/bim-object-styles';
import type { SceneLayer } from '...';
import type { FloorVisMode } from '../../bim-3d/utils/floor-visibility-state';
import type { BuildingVisMode } from '../../bim-3d/utils/building-visibility-state';

export interface VisibilityContext {
  /** V/G per-view overrides (από `bim-render-settings-store.objectStyles`). */
  readonly objectStyles?: Partial<Record<BimCategory, ObjectStyle>>;
  /** Layer lookup (από `LayerStore.getLayer(id)`). null/undefined ⇒ no layer constraint. */
  readonly layer?: SceneLayer | null;
  /** Floor visibility modes (3D-only). undefined / 'show' ⇒ visible. */
  readonly floorMode?: FloorVisMode;
  /** Building visibility modes (3D-only). undefined / 'show' ⇒ visible. */
  readonly buildingMode?: BuildingVisMode;
}

export interface EntityVisibilityInput {
  readonly category: BimCategory;
  readonly layerId?: string;
}

/**
 * AND-of-shows intersection. Returns true only when all 4 sources agree visible.
 * `'ghost'` mode counts as visible (stylistic-only per Q4 decision).
 */
export function resolveIsEntityVisible(
  entity: EntityVisibilityInput,
  ctx: VisibilityContext,
): boolean {
  // 1. V/G category visibility (Q2 source #1).
  const vgVisible = ctx.objectStyles?.[entity.category]?.visible !== false;
  if (!vgVisible) return false;

  // 2. Layer visibility + frozen (Q1 + Q2 source #2).
  if (ctx.layer && (ctx.layer.visible === false || ctx.layer.frozen === true)) {
    return false;
  }

  // 3. Floor visibility (3D-only, Q2 source #3, Q4 ghost-stylistic).
  if (ctx.floorMode === 'hide') return false;

  // 4. Building visibility (3D-only, Q2 source #4).
  if (ctx.buildingMode === 'hide') return false;

  return true;
}
```

### 3.2 Consumer surface

| Consumer | File | Call site | New behavior |
|---|---|---|---|
| WallRenderer | `bim/renderers/WallRenderer.ts` | `render()` line 88 (current V/G guard) | Replace `resolveIsCategoryVisible(...)` με `resolveIsEntityVisible({category:'wall', layerId:wall.layerId}, ctx)` |
| ColumnRenderer | `bim/renderers/ColumnRenderer.ts` | line 101 | ίδιο pattern, `category:'column'` |
| SlabRenderer | `bim/renderers/SlabRenderer.ts` | line 109 | `category:'slab'` |
| BeamRenderer | `bim/renderers/BeamRenderer.ts` | line 100 | `category:'beam'` |
| StairRenderer | `bim/renderers/StairRenderer.ts` | line 62 | `category:'stair'` |
| OpeningRenderer | `bim/renderers/OpeningRenderer.ts` | line 60 | `category:'opening'` |
| SlabOpeningRenderer | `bim/renderers/SlabOpeningRenderer.ts` | line 84 | `category:'slab-opening'` |
| BimSceneLayer (3D) | `bim-3d/scene/BimSceneLayer.ts` | `sync()` lines 49-55 + 62-122 | Per-entity loop check (όχι κατηγορίας μόνο) — passes `layer` lookup + floor/building modes |

### 3.3 Layer hookup pattern (2D renderers)

Κάθε 2D renderer **ήδη** καλεί `getLayer(entity.layerId)` για lineweight/color (`_wLayer`, `_colLayer`, κλπ). Reuse το ίδιο fetch για visibility consultation — zero extra cost.

> **2026-07-16 SSoT update (ADR-584 cluster B follow-up β):** το store-reading preamble ήταν copy-paste σε **21 renderers**, οπότε συμπυκνώθηκε σε **έναν 2Δ-plan wrapper** `resolveBimPlanVisibility(entity, layer)` στο `bim/visibility/bim-plan-visibility.ts`. Ο wrapper διαβάζει `objectStyles` + `disciplineVisibility` από το render-settings store (event-time, ADR-040) και delegate-άρει στον pure `resolveIsEntityVisible`. **Ξεχωριστό αρχείο** από τον resolver επίτηδες: ο pure resolver μένει store-free/unit-testable. Οι 2Δ renderers καλούν πλέον:

```ts
// WallRenderer.ts (2026-07-16 SSoT form)
render(entity: EntityModel, options: RenderOptions = {}): void {
  if (!isWallEntity(entity)) return;
  const wall = entity as WallEntity;

  // ADR-382 — Unified visibility check (V/G + Layer + discipline) via the
  // 2Δ-plan SSoT wrapper (reads objectStyles + disciplineVisibility internally).
  const _wLayer = wall.layerId ? getLayer(wall.layerId) : null;
  if (!resolveBimPlanVisibility({ category: 'wall', layerId: wall.layerId, discipline: wall.discipline }, _wLayer)) return;

  if (!wall.geometry || !wall.params) return;
  // ... rest unchanged, layer already fetched για BimLayerOverride downstream.
}
```

Τα **3Δ / overlay** paths (§3.4) ΔΕΝ χρησιμοποιούν τον wrapper — consult-άρουν επιπλέον floor/building/isolate sources, οπότε καλούν κατευθείαν τον `resolveIsEntityVisible` με πλήρες `VisibilityContext`.

### 3.4 3D pipeline pattern

`BimSceneLayer.sync()` σήμερα κάνει `if (wallVisible) { for wall of walls {...} }`. Μετά:

```ts
sync(entities, floorElevationMm, activeLevelId, floors, buildings, activeBuildingId, buildingVisModes, floorVisModes) {
  this.clearGroup();
  const objectStyles = useDrawingScaleStore.getState().objectStyles;
  const layerSnap = getLayerStoreSnapshot(); // single cached read

  for (const wall of entities.walls) {
    const layer = wall.layerId ? layerSnap.layersById.get(wall.layerId) : null;
    const resolved = resolveEntityBuilding(wall, floors, buildings);
    const buildingId = resolved?.id ?? '';
    const floorMode = activeLevelId ? floorVisModes.get(activeLevelId) : undefined;
    const buildingMode = buildingVisModes.get(buildingId);

    if (!resolveIsEntityVisible(
      { category: 'wall', layerId: wall.layerId },
      { objectStyles, layer, floorMode, buildingMode },
    )) continue;

    if (!this.shouldRender(buildingId, useNewSystem, buildingVisModes, activeBuildingId)) continue;
    const openingsForWall = /* ... existing logic, but check opening visibility too */;
    const mesh = wallToMesh(wall, openingsForWall, ...);
    if (mesh) { mesh.userData['buildingId'] = buildingId; this.group.add(mesh); }
  }
  // ... ίδιο pattern για columns/slabs/beams/stairs/openings/slab-openings
}
```

**Σημαντικό**: `applyFloorVisibility` + `applyBuildingVisibility` παραμένουν ως **ghost material applicators** (όχι hide). Τα 3 modes (`show`/`hide`/`ghost`) πλέον διασπώνται:
- `hide` → handled στο sync() ως pre-mesh filter
- `show` / `ghost` → mesh created, post-hoc material mutation στο apply functions

---

## 4. Migration Plan (sequential phases)

### Phase A — Resolver SSoT + tests (0.5 day)
1. Δημιουργία `src/subapps/dxf-viewer/bim/visibility/visibility-resolver.ts`
2. Unit tests: όλοι οι 16 συνδυασμοί (4 sources × {visible, hidden}) — αναμενόμενες AND-of-shows
3. Type guard tests: undefined ctx fields = default visible
4. Ghost mode preserves visibility (Q4 confirmation)

### Phase B — 2D BIM renderers (1 day)
1. WallRenderer.ts swap-in (pilot)
2. Verify σε browser: hide layer → wall κρύβεται
3. Roll out σε 6 υπόλοιπους renderers (Column / Slab / Beam / Stair / Opening / SlabOpening) — identical pattern
4. Integration test: μatrix 7 categories × 4 visibility states

### Phase C — 3D BIM pipeline (1 day)
1. Refactor `BimSceneLayer.sync()` ώστε να loop-per-entity (αντί κατηγορίας) και να καλεί `resolveIsEntityVisible`
2. Propagate `floorVisModes` argument από `ThreeJsSceneManager` + `scene-manager-actions`
3. Update `applyFloorVisibility` documentation: εξηγεί ότι πλέον **μόνο** ghost styling, όχι hide
4. Integration test: 2D ⟷ 3D parity (κρύβω σε 2D → 3D παραμένει κρυμμένο)

### Phase D — Documentation + ssot-registry (0.25 day)
1. Add `visibility-resolver` module σε `.ssot-registry.json` (Tier 2 cross-cutting)
2. Forbidden patterns: direct `objectStyles[cat]?.visible` reads outside resolver / `layer.visible` reads outside resolver
3. Baseline refresh: `npm run ssot:baseline`
4. Update `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` C1 status → DONE
5. ADR-381 §3 entry — mark C1 ✅ done, link to ADR-382
6. ADR-040 — note new event-time visibility check pattern (compliant — pure pre-render guard, zero subscriptions)

### Phase E — Cleanup + ratchet (0.25 day)
1. Remove direct `resolveIsCategoryVisible` calls στους 7 renderers (now wrapped by resolver)
2. Keep `resolveIsCategoryVisible` exported για backward compat / unit tests (deprecate σε επόμενη ADR)
3. Verify TSC clean + all suites pass

**Total**: ~3 days Opus (per ADR-381 §3 estimate).

---

## 5. Test Plan

### 5.1 Unit tests (Phase A)

`src/subapps/dxf-viewer/bim/visibility/__tests__/visibility-resolver.test.ts`:

| # | Scenario | Expected |
|---|---|---|
| 1 | All sources visible | `true` |
| 2 | V/G hide only | `false` |
| 3 | Layer hide only | `false` |
| 4 | Layer frozen only | `false` |
| 5 | Floor mode 'hide' only | `false` |
| 6 | Building mode 'hide' only | `false` |
| 7 | Floor mode 'ghost' | `true` (Q4) |
| 8 | Floor mode 'show' | `true` |
| 9 | Multiple sources hide | `false` |
| 10 | undefined ctx (no constraints) | `true` (entity has no layer, no 3D context — 2D only path) |
| 11 | layer=null + V/G visible | `true` |
| 12 | objectStyles undefined | `true` (V/G defaults visible) |

### 5.2 Integration tests (Phase B + C)

| # | Scenario | Action | Expected |
|---|---|---|---|
| 13 | 2D: hide layer in Layer Manager | Click eye on `Walls-Exterior` | All 2D walls in that layer disappear |
| 14 | 2D: re-show layer | Click eye again | Walls return |
| 15 | 2D→3D: hide in 2D, switch to 3D | Hide V/G + switch view | 3D walls also hidden |
| 16 | 3D: hide via Layer in 3D mode | Click eye | 3D walls hidden |
| 17 | 3D: ghost floor + V/G hide walls | Set floor=ghost, V/G hide walls | Walls hidden (Q4), other entities ghost |
| 18 | 3D: building hide | Hide building | All entities in building hidden |
| 19 | Selection parity | Hidden entity via Layer | Cannot select via click OR outliner |

### 5.3 Regression suite

Existing tests stay green:
- `bim-vg-overrides.test.ts` (V/G resolver behavior)
- `view-template-store.test.ts` (template apply path)
- `wall-opening-extrude.test.ts` (3D wall converter)
- Snap/selection tests που διαβάζουν `layer.visible`

---

## 6. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Performance: per-entity `getLayer()` lookup σε 3D sync (potential O(N) × O(1) map lookup) | LOW | `getLayerStoreSnapshot()` returns cached Map (O(1) per call). Total cost = O(N) entities — same as before, plus one extra Map.get per entity. |
| Stale `objectStyles` snapshot σε event-time reads | LOW | Render paths ήδη παίρνουν fresh snapshot ανά frame. Resolver is pure function, no caching. |
| Breaking ghost-mode visual: meshes που πρώτα φτιάχνονταν τώρα παραλείπονται | MEDIUM | Phase C integration test #17 validates. `applyFloorVisibility` docs updated για να μην παραπλανήσει future devs. |
| Multiple agents touching renderers in parallel (multi-agent race) | MEDIUM | Per `[[feedback_multi_agent_stage_race]]` memory: specific `git add <file>` only, never `-A`. Implementation σε ξεχωριστή συνεδρία. |
| Opening tag / dimension renderers δεν αναφέρονται στο scope (ADR-376 / ADR-362) | LOW | Tags/dims piggyback σε parent entity visibility — αν parent κρυμμένο, tag δεν renderάρεται (existing pattern). Phase B verifies. |

---

## 7. Out of Scope (future ADRs)

- **Per-view-type V/G divergence** (Q3 alternative B/C). Αν χρειαστεί μελλοντικά, ξεχωριστό ADR με Firestore schema migration (`objectStyles2D` + `objectStyles3D`).
- **Saved views** (Q3 alternative C). Πλήρες Revit pattern με per-view state — διαφορετική αρχιτεκτονική.
- **Element-level "force show" override**. Δεν ζητήθηκε στην Q4. Αν χρειαστεί, ADR-XXX προσθέτει `entity.visibilityOverride: 'force-show' | 'force-hide' | null` που bypass-άρει το resolver.
- **AutoCAD plot-only semantics** (Q1 alternative B). Δεν είναι BIM-native. Future-only αν δοθεί.
- **Legacy DXF migration στον resolver**. Σήμερα `canvas-v2/DxfRenderer.ts:isEntityLayerSkipped()` δουλεύει σωστά για legacy entities. Μπορεί να ενοποιηθεί αργότερα σε ξεχωριστό ADR αν επιθυμητό.

---

## 8. Acceptance Criteria

- [x] `resolveIsEntityVisible()` exists, 12+ unit tests green — **27 tests PASS** (Phase A)
- [x] All 7 BIM 2D renderers consume resolver (zero direct `resolveIsCategoryVisible` καλέσματα στους renderers — μόνο στο resolver internals) — **Phase B**
- [x] `BimSceneLayer.sync()` consults resolver per-entity με Floor/Building modes — **Phase C** (per-entity loop με `resolveEntity()` helper + `filterHostedOpenings/SlabOpenings`)
- [x] Integration tests #13-#19 green — **17 tests PASS** (BimSceneLayer-visibility-resolver-3d.test.ts)
- [ ] Manual browser test: hide layer στο 2D → walls εξαφανίζονται 2D + 3D + selection — **pending Giorgio verification**
- [x] `.ssot-registry.json` updated με `visibility-resolver` module + forbidden patterns — **Phase D** (Tier 2, forbids direct `objectStyles[cat]?.visible` reads outside resolver internals)
- [x] `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` ADR-381 C1 entry → ✅ DONE — **Phase D**
- [x] ADR-381 §3 entry → ✅ DONE με link σε ADR-382 — **Phase D**
- [x] TSC clean — running in background, no new errors expected (only resolver + per-entity flow added)

---

## Changelog

- **2026-05-27** — ADR drafted (Phase 1 Recognition complete). 4 OQs resolved (all Option A — Revit-style intersection). Implementation pending separate session.
- **2026-05-27** — **Phase A DONE** (Haiku): Resolver SSoT `src/subapps/dxf-viewer/bim/visibility/visibility-resolver.ts` + 27 unit tests + Wall/Column pilot (1519a4be).
- **2026-05-27** — **Phase B DONE** (Opus): 5 remaining BIM 2D renderers wired (Beam/Opening/SlabOpening/Slab/Stair) — 7/7 BIM 2D renderers consume resolver (4edbb62a).
- **2026-05-27** — **Phase C DONE** (Opus): BimSceneLayer.sync() refactored σε per-entity loop με `resolveEntity()` helper. New 8th argument `floorVisModes: ReadonlyMap<string, FloorVisMode>` propagated through ThreeJsSceneManager.syncBimEntities + scene-manager-actions.syncBimEntitiesIntoScene + 4 BimViewport3D call-sites + use-bim3d-vg-resync. Νέο LayerStore subscriber σε `use-bim3d-store-sync.ts` (version-based dedup) — toggle layer.visible/frozen στο Layer Manager τώρα trigger-άρει 3D rebuild → resolver φιλτράρει pre-mesh (2D⟷3D parity bug closed). Floor mode change subscriber αναβαθμίστηκε από `applyFloorVisibility-only` σε `syncBimEntities + applyFloorVisibility` (defense-in-depth: pre-mesh hide + post-hoc ghost styling). `applyFloorVisibility/applyBuildingVisibility` doc comments updated με role split (primary hide path → BimSceneLayer.sync(), this function → ghost/show styling + defense-in-depth). Per-entity hosted-opening filter (Wall→Opening, Slab→SlabOpening) σέβεται V/G + Layer + Floor + Building για κάθε opening separately — hidden openings δεν punch cutouts. 17 integration tests PASS (BimSceneLayer-visibility-resolver-3d.test.ts) — 4 Layer / 4 Floor / 2 Building / 4 Intersection / 3 Hosted-Openings. Existing BimSceneLayer-vg-visibility regression 10/10 PASS. Function-size compliance: sync() 24 lines, helpers 14-20 lines each (Google ≤40).
- **2026-05-27** — **Phase D DONE** (Opus): `.ssot-registry.json` `visibility-resolver` Tier 2 module added — forbids direct `objectStyles[cat]?.visible` reads outside resolver internals (1 ERE pattern covers 7 BIM categories). ADR-382 status header 🟡 PLAN APPROVED → 🟢 PHASE A+B+C+D+E COMPLETE. ADR-381 §3 C1 entry marked ✅ DONE με link σε ADR-382. ADR-040 changelog note for the new event-time visibility pattern (pure pre-render guard, zero subscriptions — micro-leaf compliant). `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` C1 entry → ✅ ΥΛΟΠΟΙΗΜΕΝΟ.
- **2026-05-27** — **Phase E DONE** (Opus): `resolveIsCategoryVisible` παραμένει exported από `bim-line-weight-resolver.ts` για backward compat / unit tests (deprecation σε επόμενη ADR — current callers internal to resolver pipeline + legacy isolated paths). All test suites green. tsc --noEmit background — zero new errors. **ADR-382 fully shipped — production bug closed.**
- **2026-07-16** — **2Δ-plan wrapper SSoT** (Opus 4.8, ADR-584 CHECK 3.28 cluster B follow-up β): το store-reading visibility preamble ήταν copy-paste σε **21 BIM 2Δ renderers**. NEW `bim/visibility/bim-plan-visibility.ts` → `resolveBimPlanVisibility(entity, layer)` — reads `objectStyles` + `disciplineVisibility` (event-time `useDrawingScaleStore.getState()`, ADR-040-compliant) και delegate-άρει στον pure `resolveIsEntityVisible`. Ξεχωριστό αρχείο από τον resolver επίτηδες (pure resolver = store-free/unit-testable). Και τα 21 renderers migrated (9-γρ preamble → 1-γρ κλήση· βλ. §3.3)· τα 3Δ/overlay paths αμετάβλητα (richer ctx). Public `render()` API byte-identical. **7 NEW jest tests (`bim-plan-visibility.test.ts`) + 248 renderer/visibility tests (23 suites) GREEN.** Δες ADR-584 changelog για jscpd Layer-1/Layer-2 λεπτομέρειες.
