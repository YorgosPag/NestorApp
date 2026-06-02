# HANDOFF — ADR-407 Φ1 ΠΡΟΟΔΟΣ: Φ1.A-C DONE, Φ1.D-G NEXT

**Ημερομηνία:** 2026-06-02
**Συντάκτης:** Opus 4.8 (υλοποίηση Φ1 railings vertical slice)
**Γλώσσα:** Ελληνικά πάντα. **Commit/push:** ΜΟΝΟ ο Giorgio (N.-1). **git add specific** μόνο.
**⚠️ Shared tree** με MEP agent (ADR-405/406). Surgical edits μόνο.

---

## ✅ ΤΙ ΕΓΙΝΕ (Φ1.A + Φ1.B + Φ1.C) — tsc-clean, 26/26 tests PASS

### Φ1.A — Geometry core SSoT (DONE, tested)
- `bim/types/railing-types.ts` — full Revit `RailingType` (Rail Structure[] + Baluster Placement + Top/Handrail + Infill) + `RailingParams` + derived `RailingGeometry` (posts/balusters/rails/panels + bbox + **lengthM** για BOQ) + `RailingEntity` + `DEFAULT_RAILING_TYPE` + constants. **PATH ⊥ TYPE**, path = flat `Point3D[]` (bim-base optional-z).
- `bim/railings/railing-geometry.ts` — **`computeRailingGeometry(params, host?)` SSoT engine** + `validateRailingParams`. Φ1: straight sketch → end/corner posts + center-justified balusters (ball-rule spacing, canvas-unit aware) + ένα centred top rail. railStructure/handrail/panels loops υπάρχουν αλλά κενά (DEFAULT). Functions ≤40 γρ.
- `bim/types/railing.schemas.ts` — Zod strict (όλα τα sub-systems + discriminatedUnion pathSource).
- `bim/railings/railing-symbol.ts` — 2Δ plan symbol (pathStroke + post squares/circles + baluster dots).
- Tests: `bim/railings/__tests__/railing-geometry.test.ts` (17), `railing-symbol.test.ts` (3), `bim/types/__tests__/railing.schemas.test.ts` (6). **26/26 PASS.**

### Φ1.B — Registrations type-system + factory (DONE, tsc-clean)
Όλα mirror του 'mep-fixture':
- `types/base-entity.ts` EntityType += 'railing' · `bim/types/bim-base.ts` BimElementType += 'railing'
- `types/entities.ts` re-export RailingKind/Type/Params/Geometry/Entity + `Entity` union + `isRailingEntity` + `isBimEntity` chain
- `config/bim-object-styles.ts` BimCategory += 'railing' + BIM_CATEGORIES + MODEL_BIM_CATEGORIES + DEFAULT_OBJECT_STYLES (`railing: {projectionPen:4, cutPen:5}`)
- `bim/discipline/bim-discipline.ts` DISCIPLINE_BY_CATEGORY `railing: 'architectural'`
- `bim/types/ifc-entity-mixin.ts` IfcEntityType + values + Zod enum += 'IfcRailing'
- `src/services/enterprise-id-{prefixes(RAILING:'ral'),class(generateRailingId),convenience,service}` (4 αρχεία)
- `src/config/firestore-collections.ts` `FLOORPLAN_RAILINGS: 'floorplan_railings'`
- `src/config/audit-tracked-fields.ts` RAILING_TRACKED_FIELDS_RAW (layerId/totalHeightMm/baseElevationMm/storeyId) + switch case
- `core/commands/entity-commands/DeleteEntityCommand.ts` BIM_ENTITY_TYPES set + BimEntityType union += 'railing'
- `src/services/factories/railing.factory.ts` — `createRailing` (enterprise-id + ifcGuid + ifcType 'IfcRailing')

### Φ1.C — Persistence + command + EventBus + store field (DONE, tsc-clean)
- `bim/railings/railing-firestore-service.ts` — setDoc + generateRailingId, subscribeRailings, entityToSaveInput
- `bim/railings/railing-audit-client.ts` — recordRailingChange (ADR-195)
- `bim/railings/add-railing-to-scene.ts` — tag 'railing'
- `hooks/data/useRailingPersistence.ts` — full mirror (auto-save, diff-merge, first-save listener tool==='railing', delete, restore)
- `app/RailingPersistenceHost.tsx` — renders null, feeds `setRailings`
- `core/commands/entity-commands/UpdateRailingParamsCommand.ts` — recompute geometry+validation, merge for drag
- `systems/events/EventBus.ts` — `bim:railing-params-updated`, `bim:railing-delete-requested`, `bim:place-railing-3d`, restore union += 'railing'
- `hooks/data/useBimEntityRestoredPersistEffect.ts` — BimRestoreEntityType += 'railing'
- `bim-3d/stores/Bim3DEntitiesStore.ts` — **railings field REQUIRED** + setRailings + EMPTY + selector
- Construction sites κλεισμένα: `hooks/data/useFloors3DAggregator.ts` (extract + liveActive + selector + import isRailingEntity), `bim-3d/scene/bim3d-resync.ts` (railings: s.railings)

---

## ❌ ΤΙ ΜΕΝΕΙ — Φ1.D, Φ1.E, Φ1.F, Φ1.G

### Φ1.D — 2Δ tool + renderer + canvas wiring
**NEW:**
- `hooks/drawing/useRailingTool.ts` + `hooks/drawing/railing-completion.ts` — FSM **2 κλικ** (start→end) → straight sketch path → buildDefaultRailingParams (DEFAULT_RAILING_TYPE, sceneUnits) → computeRailingGeometry → createRailing → onRailingCreated. Listen `bim:place-railing-3d`. Mirror `useMepFixtureTool` (ΑΛΛΑ point→**2-click line**, όχι single click· δες FSM phases). getGhost = preview path.
- `ui/ribbon/hooks/bridge/railing-tool-bridge-store.ts` — mirror mepFixtureToolBridgeStore (state για ribbon/3D ghost).
- `bim/renderers/RailingRenderer.ts` — ADR-040 micro-leaf· render path stroke + post outlines + baluster dots (buildRailingSymbol)· getGrips (endpoints + maybe posts)· hitTest (bbox + distance-to-polyline). Register στο `EntityRendererComposite` (grep πού γίνεται register ο MepFixtureRenderer).
**MODIFIED (registrations Φ1.D):**
- `ui/toolbar/types.ts` ToolType += 'railing' · `systems/tools/tool-definitions.ts` 'railing' entry (allowsContinuous true, requiresCanvas true)
- `hooks/tools/useSpecialTools.ts` — import useRailingTool + addRailingToScene + railingTool field + instantiate + useToolLifecycle('railing') + return
- `components/dxf-layout/CanvasSection.tsx` — destructure railingTool + pass to click handler (ADR-040: ΜΗΝ subscribe high-freq stores)
- `hooks/canvas/canvas-click-types.ts` RailingToolLike + prop · `hooks/canvas/useCanvasClickHandler.ts` destructure + dispatch (activeTool==='railing') + deps
- **Mount `RailingPersistenceHost` στο `DxfViewerTopBar`** (grep πού mount-άρεται ο MepFixturePersistenceHost — ΙΔΙΑ props).

### Φ1.E — 3Δ (InstancedMesh balusters — locked Giorgio «όπως οι μεγάλοι»)
**NEW:**
- `railingToMesh()` στο `bim-3d/converters/BimToThreeConverter.ts` — επιστρέφει `THREE.Group` (ή Object3D):
  - **balusters → ΕΝΑ `THREE.InstancedMesh`** (CylinderGeometry για round / BoxGeometry για rectangular), Matrix4 ανά baluster (basePoint canvas→m, z=base, height=heightMm). **ΠΡΩΤΗ χρήση InstancedMesh στο subapp** — δες `feedback`/μέτρα. Canvas→m factor: μίμηση `fixtureToMesh` (sceneToM) + `StairToThreeConverter.handrailTube` (p.x*sceneToM, baseY + p.z*sceneToM, -p.y*sceneToM).
  - **posts → InstancedMesh ή per-mesh** (λίγα· per-mesh ok) BoxGeometry rotated.
  - **rails → TubeGeometry** (reuse pattern `handrailTube`: CatmullRomCurve3 + TubeGeometry r=profile/2). role top-rail.
  - tagMesh (bimType 'railing', railingComponent 'post'/'baluster'/'rail') + levelId.
- `bim-3d/placement/use-bim3d-railing-placement.ts` + `RailingPlacementGhost.ts` — mirror MEP (ΑΛΛΑ 2-click line: ghost δείχνει preview railing μετά το 1ο κλικ). Emits `bim:place-railing-3d`.
**MODIFIED:**
- `bim-3d/materials/MaterialCatalog3D.ts` — `elem-railing` (metal: π.χ. color 0x999999, roughness 0.3, metalness 0.85) + getElementMaterial3D union += 'railing'
- `bim-3d/scene/BimSceneLayer.ts` — import railingToMesh + `syncRailings(entities, ctx)` (mirror syncFixtures, resolveEntity(railing,'railing',ctx)) + κλήση στο sync flow
- (resync ΗΔΗ έγινε Φ1.C)

### Φ1.F — Ribbon + i18n + BOQ
- `ui/ribbon/data/home-tab-draw.ts` — railing entry (commandKey 'railing', icon, shortcut π.χ. 'RL', labelKey/tooltipKey)
- **i18n el+en** (N.11 — keys ΠΡΙΝ τη χρήση):
  - `ribbon.commands.bim.railing.{label,tooltip}`
  - `railing.validation.hardErrors.{pathTooShort,nonPositiveHeight,nonPositiveSpacing,dimensionTooSmall}`
  - `railing.validation.codeViolations.{guardrailHeight,balusterGap}`
  - (+ property panel keys αν προστεθεί panel — προαιρετικό Φ1)
- **BOQ (locked Giorgio «απαραίτητα»):** `bim/config/bim-to-atoe-mapping.ts` — πρόσθεσε 'railing' στο BimEntityType + mapping. Railing quantity = **running length (m)** = `geometry.lengthM` (ΑΤΟΕ μέτρηση μήκους, π.χ. ΟΙΚ μεταλλικά κιγκλιδώματα). Grep πώς το stair/beam τροφοδοτεί `deriveAtoeQuantity`/BOQ feed — railing είναι ΠΡΩΤΟ path-length entity, μπορεί να χρειαστεί νέο quantity-kind 'length'. Δες αν υπάρχει length-based μέτρηση αλλού (beam μήκος;).

### Φ1.G — Verify + docs (N.15)
- `npx tsc --noEmit` clean · `npm run test:ai-pipeline` ΟΧΙ σχετικό · jest railing + bim-3d converters suites
- Browser DoD: 2 κλικ → railing με posts+balusters+top rail σε 2Δ· persist Firestore (ral_*)· audit· 3Δ instanced balusters· discipline toggle «Αρχιτεκτονικά» κρύβει/δείχνει 2Δ+3Δ· BOQ μετράει μήκος
- Update: **ADR-407** (Status → Φ1 DONE + changelog v0.2) · `adr-index.md` · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` · memory `project_adr407_railings.md` (N.15)

---

## 🔑 LOCKED DECISIONS (μην ξανα-ρωτήσεις)
1. **InstancedMesh** για balusters (Giorgio: full enterprise, «όπως οι μεγάλοι»).
2. **BOQ απαραίτητο** στη Φ1 (running length m).
3. Path = flat `Point3D[]` (bim-base optional-z)· offsetPolyline reuse = Φ2 (stair/lateral rails), ΟΧΙ τώρα.
4. Tool = **2 κλικ** straight sketch (Φ1)· hosted = Φ2-Φ3.
5. Generation engine `computeRailingGeometry` = ΜΟΝΑΔΙΚΟ SSoT· downstream διαβάζουν μόνο derived geometry.

## 📐 TEMPLATES (mirror ΑΥΤΑ)
useMepFixtureTool · mep-fixture-completion · MepFixtureRenderer (+EntityRendererComposite register) · fixtureToMesh · use-bim3d-mep-fixture-placement · MepFixturePlacementGhost · home-tab-draw (mepFixture entry) · StairToThreeConverter.handrailTube (TubeGeometry rails) · stair stringer loop (per-instance matrices pattern).
