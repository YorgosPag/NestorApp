# HANDOFF — ADR-407 Railings: Φ1 VERTICAL SLICE (Φ1.D–G) DONE · Φ2+ NEXT

**Ημερομηνία:** 2026-06-02
**Συντάκτης:** Opus 4.8 (υλοποίηση Φ1.D–G railings)
**Γλώσσα:** Ελληνικά πάντα. **Commit/push:** ΜΟΝΟ ο Giorgio (N.-1) — ο agent ΔΕΝ κάνει commit.
**⚠️ SHARED working tree** με άλλον agent → `git add` **μόνο specific αρχεία**, ΠΟΤΕ `git add -A`. Verify `git diff --cached` πριν commit.

---

## ✅ ΤΙ ΟΛΟΚΛΗΡΩΘΗΚΕ ΑΥΤΗ ΤΗ SESSION (Φ1.D + Φ1.E + Φ1.F + Φ1.G)

**Κατάσταση:** tsc **0 errors** (όλο το codebase), railing tests **65/65 PASS**, pending commit, 🔴 browser verify εκκρεμεί.
(Φ1.A–C είχαν γίνει σε προηγούμενη session — geometry SSoT, Zod, symbol, registrations, factory, persistence, audit, command, EventBus, store.)

### Φ1.D — 2Δ tool + renderer + canvas wiring
**NEW:**
- `src/subapps/dxf-viewer/hooks/drawing/railing-completion.ts` — `buildDefaultRailingParams` (2 κλικ→straight sketch path) + `buildRailingEntity` + `completeRailingFromTwoClicks`
- `src/subapps/dxf-viewer/hooks/drawing/useRailingTool.ts` — FSM `idle→awaitingStart→awaitingEnd` (συνεχόμενη αλυσίδα)· 3Δ bridge listener `bim:place-railing-3d` (ένα point/κλικ→FSM resolve)· pure `getGhostPath(cursor)` (ADR-040, χωρίς cursor-store subscription)
- `src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/railing-tool-bridge-store.ts` — mirror mep-fixture bridge store
- `src/subapps/dxf-viewer/bim/renderers/RailingRenderer.ts` — ADR-040 micro-leaf· path stroke + post footprints + baluster dots (buildRailingSymbol)· polyline hit-test· grips από resolvedPath
- `src/subapps/dxf-viewer/hooks/drawing/__tests__/railing-completion.test.ts` (6 tests)

**MODIFIED:**
- `rendering/core/EntityRendererComposite.ts` — import + instantiate + `renderers.set('railing', …)`
- `ui/toolbar/types.ts` — ToolType += `'railing'`
- `systems/tools/tool-definitions.ts` — `'railing'` entry (drawing, allowsContinuous, requiresCanvas)
- `hooks/tools/useSpecialTools.ts` — import useRailingTool + addRailingToScene + instantiate + `useToolLifecycle('railing')` + `UseSpecialToolsReturn.railingTool` + return
- `components/dxf-layout/CanvasSection.tsx` — destructure `railingTool` + pass στο useCanvasClickHandler
- `hooks/canvas/canvas-click-types.ts` — `RailingToolLike` + `railingTool?` prop
- `hooks/canvas/useCanvasClickHandler.ts` — destructure + dispatch (`activeTool==='railing'`→`onCanvasClick(bimPoint)` ORTHO-aware) + 2× deps arrays
- `app/DxfViewerTopBar.tsx` — import + mount `<RailingPersistenceHost …>` (μετά το MepFixturePersistenceHost) + buildingId/floorId props

### Φ1.E — 3Δ (units-safe, InstancedMesh)
**NEW:**
- `src/subapps/dxf-viewer/bim-3d/converters/railing-to-three.ts` — `railingToMesh()`→`THREE.Group`. **ΚΡΙΣΙΜΟ: ακολουθεί το stair-converter `sceneUnitsToMeters(units)` pattern** (κλιμακώνει canvas XY × sceneToM), **ΟΧΙ τον latent-buggy fixture pattern** (`fixtureToMesh` ΔΕΝ κλιμακώνει XY → λάθος σε meter-scenes). **InstancedMesh** balusters (unit Cylinder/Box + per-instance Matrix4) + posts (per-mesh) + `TubeGeometry` rails (CatmullRom).
- `src/subapps/dxf-viewer/bim-3d/converters/__tests__/railing-mesh.test.ts` (5 tests, incl. units-safety mm==m)

**MODIFIED:**
- `bim-3d/scene/BimSceneLayer.ts` — import railingToMesh + `syncRailings()` (append-only στο τέλος του syncFloorEntities) + κλήση
- `bim-3d/materials/MaterialCatalog3D.ts` — `elem-railing` (brushed metal 0x999999) + `getElementMaterial3D` union += `'railing'`

### Φ1.F — ribbon + i18n + BOQ
**MODIFIED:**
- `ui/ribbon/data/home-tab-draw.ts` — railing entry (commandKey `'railing'`, icon `'bim-railing'`, shortcut `RL`)
- `ui/ribbon/components/buttons/RibbonButtonIcon.tsx` — import lucide `Fence` + `case 'bim-railing'`
- `src/i18n/locales/el/dxf-viewer-shell.json` + `src/i18n/locales/en/dxf-viewer-shell.json` — **surgical CRLF-preserving insert** (μόνο +22 lines/file, 0 deletions): `tools.railing.{statusStart,statusEnd}` · `ribbon.commands.bim.railing.{label,tooltip}` · `railing.validation.hardErrors.{pathTooShort,nonPositiveHeight,nonPositiveSpacing,dimensionTooSmall}` · `railing.validation.codeViolations.{guardrailHeight,balusterGap}`
- `bim/config/bim-to-atoe-mapping.ts` — `BimEntityType += 'railing'` + `RAILING_MAPPING` (OIK-12.01, unit `m`) + `BIM_TO_ATOE_MAPPING.railing` + `deriveAtoeQuantity` νέο `'m'`→`geometry.lengthM` branch
- `bim/config/__tests__/bim-to-atoe-mapping.test.ts` — railing cases + ενημερώθηκε το stale «m unhandled» test
- `bim/services/BimToBoqBridge.ts` — `BimEntityForBoq.geometry.lengthM?`
- `bim/schedule/schedule-presets.ts` — `COMBINED_ATOE_TYPES += 'railing'` + geometry cast `lengthM`
- `src/types/boq/boq.ts` — `BOQItem.sourceEntityType += 'railing'`
- `app/RailingPersistenceHost.tsx` — buildingId/floorId props
- `hooks/data/useRailingPersistence.ts` — buildingId/floorId params + `bimToBoqBridge.upsertBoqItemForBim('railing', …)` στο persist (deps updated)

### Φ1.G — docs (N.15)
- `docs/.../adrs/ADR-407-bim-railings.md` — Status → 🟢 Φ1 DONE + changelog v0.2
- `docs/.../adr-index.md` — 2 πίνακες (📋 DESIGN → 🟢 Φ1 DONE)
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` — ΟΜΑΔΑ ADR-407 → Φ1 DONE
- memory: `project_adr407_railings.md` + `MEMORY.md` index line

---

## 📋 ΛΙΣΤΑ ΑΡΧΕΙΩΝ ΓΙΑ `git add` (specific — ΠΟΤΕ -A)

**NEW (railing core):**
```
src/services/factories/railing.factory.ts
src/subapps/dxf-viewer/bim/types/railing-types.ts
src/subapps/dxf-viewer/bim/types/railing.schemas.ts
src/subapps/dxf-viewer/bim/types/__tests__/railing.schemas.test.ts
src/subapps/dxf-viewer/bim/railings/            (whole dir: geometry/symbol/firestore/audit/add-to-scene + __tests__)
src/subapps/dxf-viewer/bim/renderers/RailingRenderer.ts
src/subapps/dxf-viewer/hooks/drawing/railing-completion.ts
src/subapps/dxf-viewer/hooks/drawing/useRailingTool.ts
src/subapps/dxf-viewer/hooks/drawing/__tests__/railing-completion.test.ts
src/subapps/dxf-viewer/hooks/data/useRailingPersistence.ts
src/subapps/dxf-viewer/core/commands/entity-commands/UpdateRailingParamsCommand.ts
src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/railing-tool-bridge-store.ts
src/subapps/dxf-viewer/app/RailingPersistenceHost.tsx
src/subapps/dxf-viewer/bim-3d/converters/railing-to-three.ts
src/subapps/dxf-viewer/bim-3d/converters/__tests__/railing-mesh.test.ts
docs/centralized-systems/reference/adrs/ADR-407-bim-railings.md
```

**MODIFIED (railing-related — επιβεβαίωσε με `git diff` ότι κάθε αλλαγή είναι railing):**
```
src/subapps/dxf-viewer/types/base-entity.ts
src/subapps/dxf-viewer/types/entities.ts
src/subapps/dxf-viewer/bim/types/bim-base.ts
src/subapps/dxf-viewer/bim/types/ifc-entity-mixin.ts
src/subapps/dxf-viewer/bim/discipline/bim-discipline.ts
src/subapps/dxf-viewer/config/bim-object-styles.ts
src/services/enterprise-id-prefixes.ts
src/services/enterprise-id-class.ts
src/services/enterprise-id-convenience.ts
src/services/enterprise-id.service.ts
src/config/firestore-collections.ts
src/config/audit-tracked-fields.ts
src/subapps/dxf-viewer/core/commands/entity-commands/DeleteEntityCommand.ts
src/subapps/dxf-viewer/systems/events/EventBus.ts
src/subapps/dxf-viewer/hooks/data/useBimEntityRestoredPersistEffect.ts
src/subapps/dxf-viewer/bim-3d/stores/Bim3DEntitiesStore.ts
src/subapps/dxf-viewer/hooks/data/useFloors3DAggregator.ts
src/subapps/dxf-viewer/bim-3d/scene/bim3d-resync.ts
src/subapps/dxf-viewer/rendering/core/EntityRendererComposite.ts
src/subapps/dxf-viewer/ui/toolbar/types.ts
src/subapps/dxf-viewer/systems/tools/tool-definitions.ts
src/subapps/dxf-viewer/hooks/tools/useSpecialTools.ts
src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx
src/subapps/dxf-viewer/hooks/canvas/canvas-click-types.ts
src/subapps/dxf-viewer/hooks/canvas/useCanvasClickHandler.ts
src/subapps/dxf-viewer/app/DxfViewerTopBar.tsx
src/subapps/dxf-viewer/bim-3d/scene/BimSceneLayer.ts
src/subapps/dxf-viewer/bim-3d/materials/MaterialCatalog3D.ts
src/subapps/dxf-viewer/ui/ribbon/data/home-tab-draw.ts
src/subapps/dxf-viewer/ui/ribbon/components/buttons/RibbonButtonIcon.tsx
src/i18n/locales/el/dxf-viewer-shell.json
src/i18n/locales/en/dxf-viewer-shell.json
src/subapps/dxf-viewer/bim/config/bim-to-atoe-mapping.ts
src/subapps/dxf-viewer/bim/config/__tests__/bim-to-atoe-mapping.test.ts
src/subapps/dxf-viewer/bim/services/BimToBoqBridge.ts
src/subapps/dxf-viewer/bim/schedule/schedule-presets.ts
src/types/boq/boq.ts
docs/centralized-systems/reference/adr-index.md
local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt
src/subapps/dxf-viewer/bim-3d/scene/__tests__/BimSceneLayer-multifloor.test.ts          (⚠️ fixture railings:[]/fixtures:[] — ίσως άλλου agent· verify diff)
src/subapps/dxf-viewer/bim-3d/scene/__tests__/BimSceneLayer-vg-visibility.test.ts        (⚠️ ίδιο)
src/subapps/dxf-viewer/bim-3d/scene/__tests__/BimSceneLayer-visibility-resolver-3d.test.ts (⚠️ ίδιο)
```
⚠️ `Bim3DReadOnlyOverlay.tsx` + `useDxfSceneConversion.ts` + λοιπά στο `git status` που ΔΕΝ είναι railing → **ΜΗΝ τα stage** εκτός αν `git diff` δείξει railing αλλαγή.

---

## ⚠️ ΚΡΙΣΙΜΕΣ ΣΗΜΕΙΩΣΕΙΣ

1. **Pre-existing test failures (ΟΧΙ regression μου):** 3 suites στο `bim-3d/scene/__tests__/` (BimSceneLayer-vg-visibility / multifloor / visibility-resolver-3d) αποτυγχάνουν με `TypeError: reading 'start'` μέσα στο `syncWalls` — που τρέχει **ΠΡΙΝ** το append-only `syncRailings` μου, άρα δομικά αδύνατο να τα προκάλεσα. Ταιριάζουν με τα τεκμηριωμένα «12 pre-existing 3D-test failures (ADR-401/404)».
2. **MEP `fixtureToMesh` έχει latent units bug** (δεν κλιμακώνει XY×sceneToM → λάθος σε meter-scenes). Το railing-to-three ΔΕΝ τον αντιγράφει — χρησιμοποιεί το σωστό stair `sceneUnitsToMeters` pattern. **Μην «διορθώσεις» το railing για να ταιριάξει με τον fixture.**
3. **i18n:** τα locale JSON είναι **CRLF** — μην κάνεις full json.dump reserialize (reformat-άρει 2000+ γραμμές σε shared tree). Surgical text insert μόνο.

---

## ❌ ΤΙ ΕΜΕΙΝΕ (επόμενη φάση)

### Deferred από Φ1 (μικρά, προαιρετικά):
- 3Δ-viewport raycast placement hook `use-bim3d-railing-placement.ts` + `RailingPlacementGhost.ts` (draw railing μέσα από 3Δ· ο MEP το ανέβαλε ομοίως — το EventBus `bim:place-railing-3d` + ο tool listener ΕΙΝΑΙ ήδη έτοιμα, λείπει μόνο το 3Δ ghost UI)
- Property panel για railing (height/spacing/Type overrides)
- ORTHO/POLAR για railing 2Δ (χρειάζεται railing preview store + entry στο `bim-ortho-reference.ts` BIM_ORTHO_TOOLS· τώρα no-op)

### Φ2–Φ7 (ADR-407 §Implementation Phases):
- **Φ2 — Stair hosting:** path από walkline· `pathSource.kind='hosted'` + `RailingHostContext`· perTread balusters. (το hosting scaffolding ΥΠΑΡΧΕΙ στο railing-types.ts)
- **Φ3 — Slab/balcony-edge hosting** + ADR-401 follow-on-host-change
- **Φ4 — Top Rail / Handrail separation** + ADA returns/extensions + intermediate rails (railStructure[]) + supports
- **Φ5 — Infill panels** (γυαλί/πλέγμα → IfcPlate)
- **Φ6 — RailingType UI** (Rail Structure + Baluster Placement editor) + named types persistence
- **Φ7 — Migration** `StairHandrails` → hosted `RailingEntity` (retire ο stair tube)

---

## 🔴 BROWSER VERIFY (Φ1 DoD)
1. Ribbon Home→Draw→«Κιγκλίδωμα» (RL)· 2 κλικ → railing με posts (άκρα) + balusters (10cm) + top rail σε 2Δ
2. Persist Firestore (`floorplan_railings`, id `ral_*`) + audit
3. 3Δ: instanced balusters + posts + tube rail, μεταλλικό υλικό, σωστή θέση/κλίμακα (δοκίμασε ΚΑΙ meter-scene σχέδιο)
4. Discipline toggle «Αρχιτεκτονικά» κρύβει/δείχνει railing (2Δ+3Δ)
5. BOQ: γραμμή «Κιγκλίδωμα μεταλλικό» OIK-12.01 με μήκος (m)
