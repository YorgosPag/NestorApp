# ADR-641 — Block Editor (AutoCAD BEDIT): exclusive block-local editing of a Block instance

- **Status:** 🟡 IN PROGRESS (Φ1 Foundation + Φ2 Exclusive render scope + Φ3 Enter/exit UX + Φ4 Edit-tools scope implemented; Φ5 Commit/sync planned)
- **Date:** 2026-07-12
- **Domain:** DXF Viewer · Block subsystem · Canvas render scope · Editing tools/commands/undo · UX/i18n
- **Related:** ADR-640 (Block instance subsystem — this realizes its §7 "enter-block" deferral), ADR-575 (GROUP drill-in — the architectural template), ADR-040 (micro-leaf render discipline), ADR-527 (LevelSceneManagerAdapter synchronous read-after-write)
- **Design input:** 5-agent read-only orchestrator fan-out (2026-07-12) — render-scope, enter/exit-UX, edit-tools-scope maps (group-drill-in + data-commit domains cross-covered).

---

## 1. Context

Giorgio wants the **AutoCAD Block Editor (BEDIT)**: double-click a block → the canvas becomes an
**exclusive editor** showing ONLY that block's members in **block-local space** (base at origin),
everything else hidden; edit members with the normal tools; **"Close Block Editor"** writes the
changes back to the block DEFINITION and **syncs ALL instances** of the same `block.name`
(AutoCAD/Revit parity). Confirmed 2026-07-12: **BEDIT now** (exclusive, sync-all-instances);
REFEDIT (in-place, single instance) is a later phase.

**Why not reuse GROUP drill-in as-is?** GROUP is an IDENTITY container: members live in the live
world scene, so "enter group" is a conditional id-retag in the SAME coordinate frame
(`expandGroupEntity`). BLOCK is INSERT-semantic (ADR-640 Fork-2): members live in
`block.entities` in **BLOCK-LOCAL** coords and only reach world space via `expandBlockInstance`
(`p_world = pos + Rot·Scale·member`). So BEDIT cannot be a fade/retag — it is a **scene-scope
SWAP** to a synthetic block-local scene.

## 2. Decision

**Exclusive scene-scope swap.** While a block is entered, the canvas renders a **synthetic
block-local `SceneModel`** built from `block.entities` verbatim (identity placement, base at
origin, member ids preserved). Nothing else is in that scene, so hit-test / hover / grips scope
to the members **for free** (no id-filtering) — the mirror-image of how GROUP gets scoping from
re-tagging.

**Edits go in-place through the same command stack.** Member Move/Rotate/Scale/Delete/Add run
through the existing `ISceneManager` seam, made **member-aware** (mirror
`group-member-scene-access.ts`) so the 17+ tool hooks work unchanged. One global
`CommandHistory` — no per-session stack.

**Commit on close = one undoable fan-out command.** `SyncBlockDefinitionCommand` snapshots the
active block's final `entities` and replaces `.entities` on EVERY `BlockEntity` (across levels)
whose `.name` matches — keeping each instance's own `position/scale/rotation/layerId`. All-or-nothing.

**Single level, no nesting.** AutoCAD BEDIT is not nestable; import flattens nested INSERTs to
primitives (ADR-640), so `block.entities` never holds a nested `BlockEntity` → the store is a
single active id, not a stack (unlike `ActiveGroupStore`).

## 3. Architecture

```
systems/block/ActiveBlockEditStore.ts   enter/exit/getActiveBlockEditId/Name + subscribe   (mirror ActiveGroupStore, single-id)
systems/block/useActiveBlockEdit.ts      useActiveBlockEditId / useActiveBlockEditName        (mirror useActiveGroup)
systems/block/block-edit-scene.ts        buildBlockEditScene(block, layersById) + resolveBlockEditScene(scene, activeId): Scene|null  (local-space synthetic scene + top-level/fallback SSoT resolver)
systems/block/useEffectiveLevelScene.ts  useEffectiveLevelScene(levelId): SceneModel   (leaf hook: world scene, or block-local scene while entered — the canvas render-scope SSoT)  [Φ2]
systems/block/exit-block-editor.ts       exitBlockEditAndReselect()   (SSoT exit gesture — close + re-select block; shared by Esc hook + Close button)  [Φ3]
systems/block/useBlockEditorExitEscape.ts  ESC @ BLOCK_EDITOR_EXIT(274) → exitBlockEditAndReselect  (mirror useGroupExitEscape)  [Φ3]
ui/toolbar/StatusBarActiveBlockLeaf.tsx  breadcrumb «Επεξεργασία μπλοκ «name»» + clickable Close  (micro-leaf on useActiveBlockEditName)  [Φ3]
systems/block/block-member-scene-access.ts  find/update/updateEntities/add/remove member of the active block, gated on activeBlockId (mirror group-member-scene-access; single-level, blocks don't nest)  [Φ4 ✅]
systems/entity-creation/level-scene-vertex-ops.ts  pure per-type vertex transforms extracted from LevelSceneManagerAdapter (made room under the N.7.1 500-line ceiling; reused by both writeback paths)  [Φ4 ✅]
systems/entity-creation/entity-zorder-ops.ts  shared moveEntityInList/frontBackTargetIndex — z-order render-list reorder SSoT for BOTH adapters (CHECK 3.28 de-dup of pre-existing reorder/moveToIndex twins)  [Φ4 ✅]
core/commands/entity-commands/SyncBlockDefinitionCommand.ts  write-back + sync all same-name instances (one undoable) [Φ5]
```

| Domain | File | Change | Phase |
|---|---|---|---|
| State | `systems/block/ActiveBlockEditStore.ts` + `useActiveBlockEdit.ts` | **NEW** single-active-block store + hook | **Φ1 ✅** |
| Render | `systems/block/block-edit-scene.ts` | **NEW** synthetic local-space scene builder | **Φ1 ✅** |
| Render | `systems/block/block-edit-scene.ts` (`resolveBlockEditScene`) + `systems/block/useEffectiveLevelScene.ts` (**NEW** leaf hook) + `canvas-layer-stack-leaves.tsx` (`DxfCanvasSubscriber`: `useLevelScene` → `useEffectiveLevelScene`) | scope-swap at the **SceneModel level** (not `useDxfSceneConversion` — see note): the canvas render leaf feeds the block-local synthetic scene when a block is entered; whole-container highlight (`groupIds`) then scopes to members «for free» | **Φ2 ✅** |
| Render | `components/dxf-layout/BlockGizmoLayer.tsx` + `BlockSelectionOverlaySubscriber.tsx` | suppress the whole-BLOCK gizmo + selection box/pill while a block is entered (each a low-freq `useActiveBlockEditId()` leaf guard — the WORLD-bounds affordance would mis-render in block-local space) | **Φ2 ✅** |
| Render | `systems/isolate/IsolateEffectsStore` (reuse) | optional faded underlay — DEFERRED (AutoCAD shows blank canvas) | Φ2 |
| UX | `hooks/canvas/useCanvasSectionUI.ts` | double-click a selected block (`collectBlockEntities.get(id)`) → `enterBlockEdit`, gated on `getActiveGroupId()===null`; the group-enter path gated on `!isBlockEditActive()` (GROUP mutual-exclusivity, §7) | **Φ3 ✅** |
| UX | `systems/escape-bus/escape-priority.ts` + `systems/block/useBlockEditorExitEscape.ts` + `systems/block/exit-block-editor.ts` (**NEW** exit SSoT) + `hooks/useKeyboardShortcuts.ts` (mount) | new `BLOCK_EDITOR_EXIT` (274) priority + Esc hook → `exitBlockEditAndReselect` (close + re-select block); shared with the Close button | **Φ3 ✅** |
| UX | `ui/toolbar/StatusBarActiveBlockLeaf.tsx` (**NEW**) + `ToolbarStatusBar.tsx` (mount) | breadcrumb «Επεξεργασία μπλοκ «name» · Esc για έξοδο» + clickable `<button>` Close (`exitBlockEditAndReselect`); micro-leaf on `useActiveBlockEditName` | **Φ3 ✅** |
| UX | `src/i18n/locales/{el,en}/dxf-viewer.json` | new `activeBlock.{editingActive,editingHint,close}` keys (N.11, no hardcoded) | **Φ3 ✅** |
| Edit | `systems/block/block-member-scene-access.ts` | **NEW** member find/update/updateEntities/add/remove for the active block, gated on `activeBlockId` (single-level — blocks don't nest) | **Φ4 ✅** |
| Edit | `grip-scene-manager-adapter.ts` + `LevelSceneManagerAdapter.ts` | make BOTH adapters block-member-aware. Each reads `getActiveBlockEditId()` at method-time (event-time getter, ADR-040-safe) → block helpers while inside BEDIT, else the top-level/group path. **N.0.1 code=truth:** `useSceneManagerAdapter.ts` is UNCHANGED — the generic adapter self-reads the store, so no signature threading was needed (the §3 plan named it; the code shows the adapter is the sole site). Extracted `level-scene-vertex-ops.ts` + `entity-zorder-ops.ts` to stay under the N.7.1 ceiling + kill CHECK 3.28 twins. | **Φ4 ✅** |
| Edit | `hooks/grips/grip-registry.ts` + `GripRegistryPublisher.tsx` | Publisher swaps to the effective (block-local) scene via `resolveBlockEditScene` (mirror the paint leaf) so member grips compute in the rendered frame + the whole-block gizmo drops «for free»; threads `activeBlockEditId` into `useGripRegistry` as a defensive gizmo-suppression guard (mirror `activeGroupStack`) | **Φ4 ✅** |
| Commit | `core/commands/entity-commands/SyncBlockDefinitionCommand.ts` | **NEW** write-back + sync all same-name instances (undoable) wired to Close | Φ5 |

## 4. Phasing

- **Φ1 — Foundation** (this ADR): `ActiveBlockEditStore` + `useActiveBlockEdit` + `buildBlockEditScene`. Pure/testable, zero coupling, only new files. ✅
- **Φ2 — Exclusive render scope** (this ADR): canvas scope-swap (`resolveBlockEditScene` +
  `useEffectiveLevelScene`, the `DxfCanvasSubscriber` reads the effective scene) + whole-BLOCK
  gizmo/overlay suppression. ✅
  - **NOTE (N.0.1 code=truth):** the §3 plan originally named `useDxfSceneConversion.ts` as the
    swap site; the implemented swap is at the **SceneModel level** instead (a new
    `useEffectiveLevelScene` leaf hook), because (a) the synthetic scene needs **block-local
    bounds**, which `buildBlockEditScene` owns and the entity-level converter can't produce, and
    (b) the render leaf also derives `groupIds` (whole-container highlight) from the scene, so the
    swap must happen BEFORE the leaf, not hidden inside `convertScene`. `useDxfSceneConversion.ts`
    is therefore unchanged; `convertScene` converts whatever effective scene the leaf hands it.
- **Φ3 — Enter/exit UX** (this ADR): double-click a selected block enters (gated on no active
  group); Esc **and** a clickable status-bar «Κλείσιμο» both close via the SSoT
  `exitBlockEditAndReselect` (close + re-select the block → second-Esc deselects); breadcrumb
  «Επεξεργασία μπλοκ «name»»; `activeBlock.*` i18n (el+en); GROUP mutual-exclusivity both ways. ✅
- **Φ4 — Edit-tools scope**: member-aware `ISceneManager` adapters + grip threading.
- **Φ5 — Commit/sync**: `SyncBlockDefinitionCommand` (all-or-nothing fan-out) on Close.
- **Φ6 — Cancel/discard** (optional, AutoCAD parity): undo-to-mark via CompositeCommand. Future.

**Why phased-sequential, not parallel-agent implementation:** Φ2 and Φ4 both edit
`useDxfSceneConversion.ts` and `grip-registry.ts` — parallel worktrees would conflict. The
orchestrator's value was the design fan-out (done); implementation is coupled and proceeds
one phase per session (≤70% context).

## 5. Alternatives rejected
- **Fade + inverse-transform underlay** (show the rest of the drawing in block-local space): needs
  an inverse-placement pass over the whole scene; AutoCAD BEDIT shows a blank canvas — not worth it.
- **Working-copy scratch scene reconciled on close**: split undo stack risk; in-place edits on the
  live block through the SAME `CommandHistory` (ADR-575 precedent) are simpler and safer.
- **Reuse GROUP `expandGroupEntity` retag**: assumes members already in the render frame — false for
  block-local geometry.
- **Nest-capable stack store**: blocks don't nest (import flattens) — a single active id is correct.

## 6. Google-level declaration
🟡 **PARTIAL** — Φ1 foundation + Φ2 render scope + Φ3 enter/exit UX + Φ4 edit-tools scope are
Google-level (pure `resolveBlockEditScene` + `block-member-scene-access` SSoTs reused by every scene /
command consumer, ADR-040-safe leaf-only subscriptions, coordinate-frame-correct in-place edits, one
global CommandHistory, fully unit-tested, zero duplication — CHECK 3.28 clean incl. de-dup of legacy
adapter twins). The exclusive-scope now holds end-to-end: render + hit-test + hover + SNAP + viewport
fit all scope to the block-local scene through the SAME `useEffectiveLevelScene`/`resolveBlockEditScene`
SSoT (no parallel scene subscription left reading the world). Full feature PARTIAL only until Φ5
(commit/sync write-back) lands. Tracked in changelog.

## 7. Risks (from design fan-out)
- **ADR-040 micro-leaf**: the scene-swap subscription (Φ2) and status leaf (Φ3) must stay leaf-only
  re-renders (`useSyncExternalStore` on the low-freq active-id store) — never bubble to CanvasSection.
- **Coordinate-frame**: no path may call `expandBlockInstance`/`placeBlockMembersWorld` on the active
  block while inside BEDIT — hover/click would hit world-transformed coords. Every "current scene"
  consumer (grips/snap/hit-test/hover) must point at the synthetic scene.
- **Sync fan-out** (Φ5): all-or-nothing single command across ALL same-name instances (possibly across
  levels via `LevelsSystem`) — a partial write leaves instances out of sync.
- **GROUP mutual-exclusivity**: block double-click suppressed while `getActiveGroupId()≠null` and vice
  versa, else two fade/scope systems fight over one canvas.
- **ADR-527**: any block-scoped read/write added to `LevelSceneManagerAdapter` must keep the
  synchronous read-after-write guarantee.

## Changelog
- **2026-07-12** — **Φ4 follow-up: ALL fit / zoom-extents paths are now block-edit-aware (single
  chokepoint).** Symptom (Giorgio, browser): inside BEDIT, HOME/Shift+1 made the block vanish, «F»
  fit-to-selection did nothing, wheel-zoom made the block vanish, and the enter-fit framed
  unreliably. **Root cause (traced, not assumed):** every zoom-extents path computed bounds from the
  WORLD scene — `handleFitToView` used `createCombinedBounds(dxfScene=world)`, «F» filtered
  `currentScene.entities` (world top-level, where block members don't live → empty → no-op), the
  ruler-corner fit used world `createCombinedBounds` too — and, crucially, the enter-fit applied its
  transform through a **plain `setTransform`** that never synced the `ZoomManager`, so the next
  `wheelZoom` (which reads `ZoomManager.currentTransform`) computed from the STALE world transform →
  the block jumped off-screen. **Fix (full SSoT, no new module):** the ONE `canvas-fit-to-view`
  handler (`useFitToView.handleFitToView` — the chokepoint every trigger funnels through:
  HOME/Shift+1, toolbar, middle-double-click, ruler button, BEDIT enter) is now block-aware — while
  `getActiveBlockEditId()` it fits `resolveBlockEditScene(worldScene, id)?.bounds` (block-LOCAL, the
  SAME scope resolver render/hit-test/snap use) via the SAME **uncapped** `zoomToFit` the «F»/«Z»
  selection fit uses (centered, `alignToOrigin=false`) — NO artificial `maxScale`, because AutoCAD/
  Revit «zoom extents» in the block editor frames the block to fill the viewport regardless of scale
  (Giorgio: a `maxScale=20` cap left a small block «far»). `zoomToFit` keeps the `ZoomManager` in
  sync (wheel afterward stays on the block); it never falls through to the world fit. `useViewportAutoFit` now **delegates**
  the enter fit to that handler via `EventBus.emit('canvas-fit-to-view')` (one fit implementation,
  N.18 — dropped its own `FitToViewService`/`resolveBlockEditScene` copy) and restores the pre-enter
  view on exit **through `zoomSystem.setTransform`** (re-syncs the `ZoomManager` → no post-exit wheel
  jump). «F»/«Z» (`useKeyboardShortcuts`) now filters the **effective** scene
  (`resolveBlockEditScene(currentScene, getActiveBlockEditId())?.entities`) so a selected member's
  LOCAL bounds are found. The ruler-corner `handleRulerZoomToFit` routes to the same handler while
  `isBlockEditActive()`. **N.18 hygiene:** extracted `applyCappedFit` (shared by `fitToOverlay` + the
  block branch) and `applyZoomToFit` (shared by the world zoom-extents branch + fit-to-selection —
  killed a pre-existing NaN-guard twin); `useFitToView` shrank. New test `block-fit-scope.test.ts`
  (5 green) pins both the HOME whole-block-extents and «F» selection scope with the real SSoT; block
  suite 70 green; jscpd:diff clean. Touched `CanvasSection.tsx` (one prop) → ADR-040 changelog updated.
- **2026-07-12** — **Φ4 Edit-tools scope implemented.** New pure `block-member-scene-access.ts`
  (mirror `group-member-scene-access.ts`, but **gated on `activeBlockId`** + **single-level** — blocks
  don't nest): `findEntityOrBlockMember` / `updateEntityOrBlockMember` / `updateEntitiesOrBlockMembers`
  / `addBlockMember` / `removeEntityOrBlockMember`, with a shared `mapWithActiveBlock` engine. BOTH
  `ISceneManager` adapters made block-member-aware — `grip-scene-manager-adapter` (was group-aware;
  now routes to block helpers via `getActiveBlockEditId()`) and the generic `LevelSceneManagerAdapter`
  (getEntity/getEntities/updateEntity/updateEntities/addEntity/removeEntity + vertex methods; a private
  `commitMemberUpdate` shares the writeback shape). Edits land on the LIVE `block.entities` (ADR-527
  read-after-write intact) so the next `buildBlockEditScene` shows them; no `expandBlockInstance` on the
  active block (coordinate-frame safe, §7). Grip threading: `GripRegistryPublisher` swaps to the
  effective (block-local) scene via `resolveBlockEditScene` so member grips compute in the rendered
  frame + the whole-block gizmo drops «for free»; `useGripRegistry` takes `activeBlockEditId` as a
  defensive gizmo-suppression guard (mirror `activeGroupStack`). **N.7.1/N.18 hygiene:** extracted
  `level-scene-vertex-ops.ts` (per-type vertex transforms — freed the adapter from its 500-line ceiling)
  + `entity-zorder-ops.ts` (`moveEntityInList`/`frontBackTargetIndex` — ONE z-order SSoT for both
  adapters, killed the pre-existing CHECK 3.28 reorder/moveToIndex twins). **N.0.1 code=truth:**
  `useSceneManagerAdapter.ts` is UNCHANGED — the generic adapter self-reads the store, so no signature
  threading was needed. New tests: `block-member-scene-access.test.ts` (18) + `level-scene-vertex-ops.test.ts`
  (10) + `grip-adapter-block-member-writeback.test.ts` (6) + `entity-zorder-ops.test.ts` (5); all green,
  jscpd:diff clean.
  **Same-session exclusive-scope fixes (browser end-to-end, Giorgio):** (1) **Snap scope** —
  `SnapSceneSyncLeaf` fed the snap engine off `useLevelScene` (WORLD), so inside BEDIT the cursor was
  attracted to every entity of the whole drawing; switched to `useEffectiveLevelScene` (the SAME source
  the paint leaf + hit-test already use), so the engine indexes only the block-local members. (2)
  **Viewport fit** — entering a block swapped the canvas to block-local space (members @ origin) but the
  world transform left them off-screen (blank canvas); folded a BEDIT enter/exit fit into the ONE
  auto-fit controller `useViewportAutoFit` (ADR-399): on the `useActiveBlockEditId()` transition it fits
  the block-local bounds (`resolveBlockEditScene(...).bounds`, no re-implemented math), saving/restoring
  the pre-enter view on exit (AutoCAD parity); the scene-load policy effect is untouched (deps don't
  change on enter/exit). **Over-zoom follow-up (Giorgio: entered at 220:1):** the first cut used
  `zoomSystem.zoomToFit`, whose `ZoomManager` cap is the interactive `maxScale=100000` (effectively
  uncapped) → a small block filled the screen at an extreme scale. Switched to
  `FitToViewService.calculateFitToViewFromBounds(bounds, vp, { padding: 0.1 })` — the SAME call + defaults
  (10% padding, `maxScale=20`) the normal DXF content fit uses (`useFitToView`), so entering a block frames
  it exactly like «zoom extents» does elsewhere. One shared `applyFitTransform` helper commits either fit
  (N.18, no twin). Hover/hit-test needed no change (already read the effective scene via
  `DxfCanvasSubscriber`). **Remaining Φ4-follow-up:** z-order reorder inside BEDIT is top-level-only (a
  member id no-ops, graceful).
- **2026-07-12** — **Φ3 Enter/exit UX implemented.** Double-click a selected block in
  `useCanvasSectionUI` (`collectBlockEntities.get(id)`) enters its editor, gated on
  `getActiveGroupId()===null`; the existing group-enter path now gated on `!isBlockEditActive()`
  (GROUP mutual-exclusivity both ways, §7). New `BLOCK_EDITOR_EXIT` (274) escape priority + new
  `useBlockEditorExitEscape` hook (mounted in `useKeyboardShortcuts` beside `useGroupExitEscape`),
  both routed through the new SSoT `exitBlockEditAndReselect` (close + re-select the exited block).
  New `StatusBarActiveBlockLeaf` (breadcrumb «Επεξεργασία μπλοκ «name» · Esc για έξοδο» + clickable
  `<button>` Close, micro-leaf on `useActiveBlockEditName`), mounted in `ToolbarStatusBar`. New
  `activeBlock.{editingActive,editingHint,close}` i18n keys (el+en, N.11). New tests:
  `exit-block-editor.test.ts` + `useBlockEditorExitEscape.test.ts` (4 green). jscpd clean. Member
  editing (grip/tool scope) + write-back remain Φ4/Φ5.
- **2026-07-12** — **Φ2 Exclusive render scope implemented.** New pure `resolveBlockEditScene(scene,
  activeId)` (top-level passthrough / block-local swap / safe fallback when the id no longer resolves
  to a block) + new leaf hook `useEffectiveLevelScene` (the canvas render-scope SSoT: `useLevelScene`
  + `useActiveBlockEditId` → effective scene, ADR-040-safe low-freq). `DxfCanvasSubscriber` now reads
  `useEffectiveLevelScene`, so while a block is entered the canvas shows ONLY its block-local members
  and `groupIds` scopes to them «for free» (no whole-block highlight). `BlockGizmoLayer` +
  `BlockSelectionOverlaySubscriber` suppress the whole-BLOCK gizmo / selection box while entered
  (world-bounds affordance would mis-render in block-local space). **Correction (N.0.1):** the swap
  lives at the SceneModel level, NOT in `useDxfSceneConversion.ts` (unchanged) — see Φ2 note. New
  tests: `resolveBlockEditScene` cases in `block-edit-scene.test.ts` + `useEffectiveLevelScene.test.tsx`
  (20 tests total green). jscpd clean. GROUP mutual-exclusivity + double-click enter remain Φ3.
- **2026-07-12** — **Φ1 Foundation implemented.** `ActiveBlockEditStore` (single-active-block, zero
  React state, mirror `ActiveGroupStore`) + `useActiveBlockEdit` hook + pure `buildBlockEditScene`
  (synthetic block-local `SceneModel` from `block.entities`, identity placement, bounds via the
  `DxfSceneBuilder.calculateBounds` SSoT). Design captured from a 5-agent read-only orchestrator
  fan-out. New tests: `ActiveBlockEditStore.test.ts`, `block-edit-scene.test.ts`. jscpd clean.
