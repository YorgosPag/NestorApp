# HANDOFF — ADR-408 Εύρος Β #3: ΕΝΔΟΔΑΠΕΔΙΑ ΘΕΡΜΑΝΣΗ (`mep-underfloor`)

**Ημερομηνία:** 2026-06-07
**Session model:** Opus 4.8 (Plan Mode → impl)
**Κανόνας Giorgio:** «ΟΠΩΣ Η REVIT, FULL ENTERPRISE + FULL SSOT»
**⚠️ COMMIT/PUSH: ΜΟΝΟ ο Giorgio. Working tree SHARED με άλλον agent (IfcCovering/IfcFlowStorageDevice).**
**⚠️ git add ΜΟΝΟ δικά σου αρχεία, ΠΟΤΕ `-A`. ΜΗΝ adr-index. ΜΗΝ `--no-verify`.**

---

## 0) ΑΡΧΙΤΕΚΤΟΝΙΚΕΣ ΑΠΟΦΑΣΕΙΣ (κλειδωμένες από Giorgio σε Plan Mode — ΜΗΝ τις ξαναρωτήσεις)

1. **Standalone AREA entity** `mep-underfloor` με ΔΙΚΟ του `footprint: Polygon3D` (world mm, CCW). Clone του **FloorFinish** pattern (ADR-419 «one polygon per room»). Polygon-draw tool (clone `useFloorFinishTool`). **ΟΧΙ** hard FK σε πλάκα.
2. **patternType** param: `'boustrophedon' | 'counterflow-spiral'` — **και τα δύο** υλοποιημένα, default boustrophedon.
3. **Computed serpentine polyline σε ΕΝΑ entity** (όχι N segments). `totalLengthM` → BOQ-ready. **2 connectors** στην είσοδο: supply (`flow:in`, hydronic-supply) + return (`flow:out`, hydronic-return) — όπως καλοριφέρ → member supply+return δικτύου ταυτόχρονα (per-(entity,connector), μηδέν special logic). **ΟΧΙ** auto-fittings. **ΟΧΙ** network source.
4. **IFC: `IfcSpaceHeater`** — ήδη στο `ifc-entity-mixin.ts` union → **ΜΗΔΕΝ αλλαγή εκεί**.
5. **Connectors = IDENTITY transform:** το underfloor ΔΕΝ έχει `position`/`rotation`· τα connectors αποθηκεύουν `localPosition` σε WORLD coords (τα entry points) και resolve με `connectorWorldPosition(c, {0,0,0}, 0)` — ίδιο opt-out με `mep-segment`.

**Prefix enterprise-id:** `uhf` · **Collection:** `floorplan_mep_underfloors`.

---

## 1) ✅ ΤΙ ΟΛΟΚΛΗΡΩΘΗΚΕ

### Wave 0 — FOUNDATION (δικό μου, **tsc 0 στα δικά μου, 13/13 geometry tests PASS, beam-hatch 23/23 PASS**)

**Νέα αρχεία:**
- `bim/types/mep-underfloor-types.ts` — `MepUnderfloorEntity` (type `'mep-underfloor'`, ifcType `'IfcSpaceHeater'`), `MepUnderfloorParams` (footprint/pipeSpacingMm/edgeClearanceMm/patternType/entrySide?/screedOffsetMm/connectorDiameterMm/thermalOutputW?/sceneUnits?/floorId?/name?/connectors?), `MepUnderfloorGeometry` (bbox/areaM2/totalLengthM/loopPath/supplyConnectorLocal/returnConnectorLocal), defaults (SPACING 150, CLEARANCE 100, SCREED 50, DIAM 16, MIN_VERTICES 3, MIN_SPACING 50).
- `bim/types/mep-underfloor.schemas.ts` — Zod (Polygon3DSchema min 3, params/entity).
- `bim/mep-underfloor/mep-underfloor-geometry.ts` — **ο serpentine SSoT** (βλ. §4). Exports: `computeMepUnderfloorGeometry(params)`, `buildUnderfloorConnectors(params)`, `validateMepUnderfloorParams(params)`.
- `bim/mep-underfloor/__tests__/mep-underfloor-geometry.test.ts` — 13 tests PASS.

**Additive co-edits (shared hubs — append-only):**
- `bim/types/mep-connector-types.ts` — `buildUnderfloorSupplyConnector`/`buildUnderfloorReturnConnector` + ids `uf-supply`/`uf-return` (clone radiator builders, flow in/out, hydronic-supply/return).
- `bim/geometry/shared/polygon-utils.ts` — **SSoT promotion (N.12):** exported `buildAxisAlignedHatch` + `clipLineToBbox` + types `HatchPoint2D/HatchDirection/HatchLineSegment` (extracted verbatim από beam-hatch· beam re-imports).
- `bim/beams/beam-hatch-patterns.ts` — re-import promoted helpers (διαγράφηκαν τα private copies· behavior αμετάβλητη, 23/23 PASS).
- `types/base-entity.ts` (EntityType) · `bim/types/bim-base.ts` (BimElementType) · `types/entities.ts` (re-export + import + AnySceneEntity union + `isMepUnderfloorEntity` guard + `isBimEntity` arm).
- `bim/mep-systems/connector-access.ts` — `getEntityConnectors` + `isMepConnectorHost` arms.
- `snapping/engines/MepConnectorSnapEngine.ts` — `extractMepConnectorPoints` underfloor branch (identity transform: c.localPosition.x/y).
- `systems/events/drawing-event-map.ts` — `bim:mep-underfloor-params-updated {underfloorId}` + `bim:mep-underfloor-delete-requested {underfloorId}` + entity-restore-requested entityType union += `'mep-underfloor'`. ⚠️ **ΕΓΙΝΕ duplicate από Wave B subagent → ΤΟ ΔΙΟΡΘΩΣΑ** (κράτησα μία έκδοση, lines ~245).
- enterprise-id: `enterprise-id-prefixes.ts` (`MEP_UNDERFLOOR: 'uhf'`), `enterprise-id-class.ts` (`generateMepUnderfloorId`), `enterprise-id-convenience.ts`, `enterprise-id.service.ts` (re-export).
- `config/firestore-collections.ts` — `FLOORPLAN_MEP_UNDERFLOORS: ...|| 'floorplan_mep_underfloors'` + στη `*_COLLECTION` λίστα (~line 480).
- `systems/tools/tool-definitions.ts` + `ui/toolbar/types.ts` (ToolType) — `'mep-underfloor'` drawing tool.
- `core/commands/entity-commands/DeleteEntityCommand.ts` — `BIM_ENTITY_TYPES` Set + `BimEntityType` union += `'mep-underfloor'` (για delete/restore).

### Wave B — GRIPS (⚠️ έγινε από **Sonnet subagent**, **ΔΕΝ έχει επιβεβαιωθεί με tsc από εμένα** — ΕΛΕΓΞΕ ΠΡΩΤΑ)

Ο subagent ανέφερε ότι ακολούθησε πιστά το floor-finish polygon-grips pattern:
**Νέα:** `bim/mep-underfloor/mep-underfloor-grips.ts` (`getMepUnderfloorGrips`/`applyMepUnderfloorGripDrag` + `recomputeConnectors` μέσω `buildUnderfloorConnectors` μετά από footprint edit)· `core/commands/entity-commands/UpdateMepUnderfloorParamsCommand.ts` (clone `UpdateFloorFinishParamsCommand`)· `hooks/grips/grip-polygon-commits.ts` (`commitMepUnderfloorGripDrag`, split για 500-line limit).
**Edits:** `hooks/grip-kinds.ts` (`MepUnderfloorGripKind` union), `hooks/grip-types.ts`, `hooks/useGripMovement.ts`, `hooks/grips/unified-grip-types.ts`, `hooks/grips/grip-registry.ts`, `hooks/grip-computation.ts` (`case 'mep-underfloor'`), `hooks/grips/grip-parametric-commits.ts`, `hooks/grips/grip-commit-adapters.ts`, `bim/utils/bim-entity-points.ts` (footprint vertices branch).
**⚠️ TODO:** τρέξε `npx tsc --noEmit 2>&1 | grep -iE "underfloor|MepUnderfloor"` → πρέπει EMPTY. Έλεγξε ότι το `UpdateMepUnderfloorParamsCommand` recompute-άρει geometry σωστά (μέσω `computeMepUnderfloorGeometry`). Έλεγξε ότι ΔΕΝ έσπασε το 500-line limit (`grip-parametric-commits.ts` ανέφερε 497).

---

## 2) ❌ ΤΙ ΕΜΕΙΝΕ (Waves A, C, D, E, F + Final)

Πλήρης χάρτης registration σημείων στο approved plan: `C:\Users\user\.claude\plans\fancy-launching-spindle.md` (§B). Κάθε wave = clone από boiler (point) ή FloorFinish (area)· **area entity → πάντα clone FloorFinish/slab, ΟΧΙ boiler centred-box.**

### Wave A — 2D RENDERING (ΑΠΟΡΡΙΦΘΗΚΕ, δεν έγινε) — ΚΡΙΣΙΜΟ για ορατότητα
- **NEW** `bim/renderers/MepUnderfloorRenderer.ts` — clone `bim/renderers/FloorFinishRenderer.ts`: footprint translucent fill (warm red) + outline + stroke `geometry.loopPath` ως pipe polyline (`#dc2626`, 2px) + 2 ◇ connectors. Recompute geometry αν λείπει (corruption-safe, όπως FloorFinishRenderer).
- **Additive:** `rendering/core/EntityRendererComposite.ts` (`renderers.set('mep-underfloor', ...)`), **`hooks/canvas/dxf-scene-entity-converter.ts` (CRITICAL silent-drop case ~line 415 — mirror mep-boiler/floor-finish)**, `canvas-v2/dxf-canvas/dxf-renderer-entity-model.ts`, `bim/utils/bim-bounds.ts` (footprint bbox — mirror floor-finish/slab), `services/hit-test-entity-model.ts`, `rendering/ghost/draw-ghost-entity.ts` (polygon ghost — mirror floor-finish/slab), `systems/selection/shared/selection-duplicate-utils.ts`.

### Wave C — TOOL + GHOST + FACTORY — ΚΡΙΣΙΜΟ για δημιουργία
- **NEW** `hooks/drawing/useMepUnderfloorTool.ts` (clone `useFloorFinishTool.ts` — polygon N-click+Enter+auto-close FSM)· `hooks/drawing/mep-underfloor-completion.ts` (clone `floor-finish-completion.ts` → `buildMepUnderfloorEntity` + `buildDefaultMepUnderfloorParams`· καλεί `computeMepUnderfloorGeometry` + `buildUnderfloorConnectors` + factory)· `bim/mep-underfloor/mep-underfloor-preview-store.ts` (clone `floor-finish-preview-store.ts`)· `bim/mep-underfloor/add-mep-underfloor-to-scene.ts`· ghost component `components/dxf-layout/canvas-layer-stack-mep-underfloor-ghost.tsx`· **NEW** `services/factories/mep-underfloor.factory.ts` (clone `mep-boiler.factory.ts`· `generateMepUnderfloorId`, ifcType `'IfcSpaceHeater'`).
- **Additive:** `hooks/canvas/canvas-click-types.ts` (+`mepUnderfloorTool?`), `hooks/canvas/canvas-click-tool-types.ts` (`MepUnderfloorToolLike`), `hooks/canvas/useCanvasClickHandler.ts` (routing), `hooks/tools/useSpecialTools-placement-tools.ts` (lifecycle + onCreated), `components/dxf-layout/canvas-layer-stack-leaves.tsx` + `canvas-layer-stack-types.ts` (ghost mount), `hooks/canvas/useSmartDelete.ts`, `hooks/data/useBimEntityRestoredPersistEffect.ts`, `ui/ribbon/data/home-tab-draw.ts` (ribbon button «Ενδοδαπέδια», Heating group δίπλα radiator/boiler), i18n `el/en` `dxf-viewer-shell.json` (`tools.mepUnderfloor.*` + statusFirstVertex/statusNextVertex).

### Wave D — 3D
- **Additive:** `bim-3d/converters/bim-three-point-converters.ts` (`underfloorToMesh` = extrude footprint thin slab band @ screed elevation· **ΟΧΙ box**), `bim-3d/converters/BimToThreeConverter.ts` (re-export), `bim/materials/material-catalog-defs.ts` (`elem-mep-underfloor`), `bim-3d/materials/MaterialCatalog3D.ts`, `bim-3d/stores/Bim3DEntitiesStore.ts` (`underfloors` slice + `setUnderfloors`), `bim-3d/scene/BimSceneLayer.ts` (sync loop), `bim-3d/scene/bim3d-resync.ts`, `hooks/data/useFloors3DAggregator.ts` (filter `isMepUnderfloorEntity`). **ΟΧΙ host εδώ** (το host ανήκει στο Wave E).

### Wave E — PERSISTENCE + CONNECTIVITY
- **NEW** `bim/mep-underfloor/mep-underfloor-firestore-service.ts` (clone `bim/floor-finishes/floor-finish-firestore-service.ts`, COLLECTION `FLOORPLAN_MEP_UNDERFLOORS`)· `hooks/data/useMepUnderfloorPersistence.ts`· `bim/mep-underfloor/mep-underfloor-audit-client.ts`· `app/MepUnderfloorPersistenceHost.tsx` (clone `MepBoilerPersistenceHost.tsx` — listen `drawing:entity-created` tool `'mep-underfloor'` + Firestore subscribe + `setUnderfloors` στο 3D store).
- **Additive:** `app/DxfViewerTopBar.tsx` (mount host), `config/audit-tracked-fields.ts` (`MEP_UNDERFLOOR_TRACKED_FIELDS` + case), `bim/mep-systems/mep-connector-seed.ts` (seed via `buildUnderfloorConnectors`), `hooks/data/useMepConnectorReconciliation.ts`, `bim/mep-segments/mep-connector-elevation.ts` (`pointHostMountingElevationMm` → screed offset· **ΠΡΟΣΟΧΗ:** underfloor ΔΕΝ έχει `position`/`mountingElevationMm` — χρειάζεται special branch: elevation = floor FFL + `params.screedOffsetMm`), `firestore.rules` (match `floorplan_mep_underfloors` — clone boiler block), `firestore.indexes.json` (clone boiler indexes ×2). **DEPLOY:** `firebase deploy --only firestore:indexes,firestore:rules` (μετά από Giorgio έγκριση).

### Wave F — CONTEXTUAL TAB
- **NEW** `ui/ribbon/data/contextual-mep-underfloor-tab.ts` (clone `contextual-mep-boiler-tab.ts` — Geometry [spacing/clearance/patternType selector/totalLength readout] / Thermal [thermalOutputW] / **Δίκτυο fold-in** [reuse `mep-circuit-picker`/`name`/`color`] / Actions)· `ui/ribbon/hooks/bridge/mep-underfloor-command-keys.ts`· `ui/ribbon/hooks/bridge/mep-underfloor-tool-bridge-store.ts`· `ui/ribbon/hooks/useRibbonMepUnderfloorBridge.ts` (clone `useRibbonMepBoilerBridge.ts`· bridge επιστρέφει `null` ΟΧΙ `''` για unset — βλ. ΜΑΘΗΜΑ #3 παλιού handoff).
- **Additive:** `app/ribbon-contextual-config.ts` (trigger `if entity.type === 'mep-underfloor'`), `app/useDxfBimBridges.ts`, `ui/ribbon/hooks/useRibbonCommands.ts`, `ui/ribbon/components/buttons/RibbonButtonIcon.tsx` (icon — Waves/Grid glyph).

### Final
- `npx tsc --noEmit` → exit 0 στο scope μου.
- Tests: geometry 13/13 (✅) + νέα connector/bridge tests.
- **N.15 docs (ΙΔΙΟ commit):** ADR-408 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory (`project_adr408_underfloor.md`). **ΟΧΙ adr-index** (shared).
- Browser verify (Giorgio): σχεδίαση περιοχής → serpentine fill 2D · εναλλαγή patternType · grips vertex/edge · tab «Ιδιότητες Ενδοδαπέδιας» · underfloor+σωλήνες→hydronic δίκτυο · snap supply/return · 3D thin band @ screed.

---

## 3) 🔢 Ο SERPENTINE ΑΛΓΟΡΙΘΜΟΣ (`computeMepUnderfloorGeometry`) — ο πυρήνας, ΕΤΟΙΜΟΣ & TESTED

Footprint vertices = world mm (FloorFinish convention)· όλα mm· `totalLengthM = pathMm/1000`· `areaM2 = polygonArea/1e6`.
1. **Preamble:** `stripClosingDuplicate` → guard <3 → enforce CCW (`isPolygonCCW` reverse) → bbox/area → entry points (entrySide edge midpoint ±spacing/4 κατά την ακμή) → **degenerate guard: αν `min(bboxW,bboxH) ≤ 2×clearance` → empty loop, length 0** (αλλιώς over-inset folds inverted) → `insetClosedPolygon(ring, clearance)`.
2. **Rows:** `buildAxisAlignedHatch(insetBbox, spacing, u)` (u = μεγαλύτερη διάσταση) → clip κάθε line στο inset polygon (`clipSegmentToPolygon`: intersections + `pointInPolygon` midpoint → spans· concave-safe).
3. **boustrophedon:** `stitchSnake` (ox-plough, εναλλαγή orientation ανά row).
4. **counterflow-spiral:** `stitchCounterflow` (even rows forward + odd rows reversed → bifilar, supply/return εναλλάξ, και τα δύο άκρα στην είσοδο).
5. `loopPath = [entry.supply, ...field, entry.ret]` · connectors = entry points (identity transform).

**Tests κλειδώνουν:** length monotonic με spacing (both patterns), όλα τα vertices `pointInPolygon`, connectors ~spacing/2 apart στην entrySide, degenerate→0, CW normalisation.

---

## 4) 🧠 ΚΡΙΣΙΜΑ / ΜΑΘΗΜΑΤΑ
- **SHARED tree:** άλλος agent ενεργός. Additive-only στα co-edited· **ΠΟΤΕ revert** IfcCovering/IfcFlowStorageDevice/floor-finish/roof γραμμές. ΜΗΝ adr-index.
- **ΜΑΘΗΜΑ — subagent duplication:** ο Wave B subagent ξανα-πρόσθεσε events που υπήρχαν ήδη → duplicate key. **Πριν αναθέσεις wave σε subagent, πες του ρητά «τα events/unions ΥΠΑΡΧΟΥΝ ήδη στο Wave 0 — ΜΗΝ τα ξαναπροσθέσεις».**
- **ΜΑΘΗΜΑ — subagent αργό:** ένας Sonnet subagent για grips πήρε ~22 λεπτά/94 εργαλεία. Για ταχύτητα: είτε μικρότερο scope ανά subagent, είτε χειροκίνητα.
- **area entity = clone FloorFinish/slab παντού** (όχι boiler centred-box): bim-bounds, grips, ghost, hit-test, renderer.
- **mep-connector-elevation:** underfloor ΔΕΝ έχει `position`/`mountingElevationMm` → χρειάζεται ξεχωριστό branch (FFL + `screedOffsetMm`).
- **5-σημεία trap (silent-drop) νέου 2D BIM entity:** `dxf-scene-entity-converter` (ΚΡΙΣΙΜΟ), `dxf-renderer-entity-model`, `bim-bounds`, `hit-test-entity-model`, selection-duplicate — αλλιώς αόρατο.

## 5) ❌ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗΝ commit/push (μόνο Giorgio). ΜΗΝ `git add -A`. ΜΗΝ adr-index. ΜΗΝ `--no-verify`. ΜΗΝ revert άλλου agent. ΜΗΝ προσθέσεις underfloor στο `pipe-network-source.ts` (terminal, όχι source). ΜΗΝ αγγίξεις `ifc-entity-mixin.ts` (IfcSpaceHeater υπάρχει).
