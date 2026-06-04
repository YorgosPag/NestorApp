# HANDOFF — ADR-417 BIM «Στέγη» (Roof) · Φ1-part-2 **#2: 2D-SELECT FIX + GRIPS** (πλήρες σχέδιο, έτοιμο για υλοποίηση)

- **Ημερομηνία**: 2026-06-05
- **Από**: Opus 4.8 (συνεδρία έρευνας/σχεδιασμού — 2 Explore agents + επαλήθευση τύπων `RoofParams` & `UpdateRoofParamsCommand`)
- **Execution mode (εγκεκριμένο από Giorgio)**: **Plan Mode — ΕΝΑΣ Opus agent, sequential edits** (ΟΧΙ orchestrator: shared tree + στενά συζευγμένος type-graph → ρίσκο conflicts).
- **Μοντέλο**: **Opus 4.8**.
- **Directive Giorgio**: «σαν Revit — **FULL ENTERPRISE + FULL SSOT**».
- **Γλώσσα απαντήσεων**: **ΠΑΝΤΑ Ελληνικά**.

---

## ⚠️⚠️ ΚΡΙΣΙΜΟ — SHARED WORKING TREE + NO COMMIT
- Το working tree **μοιράζεται με άλλον agent**. **ΠΟΤΕ** `git add -A` / `git add .` — **ΜΟΝΟ** τα συγκεκριμένα αρχεία που γράφεις εσύ.
- **ΜΗΝ** πειράξεις το `adr-index.md` αν το επεξεργάζεται ο άλλος agent.
- Πρόσεξε shared αρχεία (grip-types, unified-grip-types, useSmartDelete, drawing-event-map κ.λπ.) → **targeted edits, ΟΧΙ overwrite**.
- **COMMIT/PUSH τα κάνει ΑΠΟΚΛΕΙΣΤΙΚΑ ο Giorgio** (N.(-1)). Εσύ ετοιμάζεις, σταματάς, περιμένεις.
- **pre-existing tsc error (ΑΓΝΟΗΣΕ)**: `bim-3d/converters/mesh-to-object3d.ts(124)` = ADR-411, ΟΧΙ δικό σου (baseline = 1).
- Git path Windows: `"C:\Program Files\Git\cmd\git.exe"`.

---

## ✅ ΚΑΤΑΣΤΑΣΗ (τι υπάρχει ήδη)
- **ADR-417 Φ1** (κορμός: entity+engine+2D+3D+tool+persistence+RoofTypes+BOQ+ribbon+i18n) = DONE.
- **Φ1-part-2 #1** (contextual tab «Στέγη» + `UpdateRoofParamsCommand` + delete-event + **winding-agnostic engine fix**) = DONE & browser-verified. tsc 0, 6/6 engine tests PASS. **Χωρίς commit.**
- Η μηχανή `computeRoofGeometry` είναι **έτοιμη & winding-agnostic** — τα grips απλώς αλλάζουν `params.outline.vertices` + `params.edges` και ξανακαλούν τη μηχανή μέσω `UpdateRoofParamsCommand`. **Μηδέν νέο geometry path.**

## 🎯 ΕΡΓΟ ΤΗΣ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ — Φ1-part-2 #2
**(Α) Προαπαιτούμενο: 2D selection της στέγης** (τώρα επιλέγεται ΜΟΝΟ στο 3Δ) → **(Β) Grips** (Revit «Edit Footprint»: per-vertex move + edge-midpoint insert + vertex delete).

---

## 🔴 (Α) ROOT CAUSE 2D-SELECT — ΕΠΑΛΗΘΕΥΜΕΝΟ (fix = 1 γραμμή)

**Αρχείο:** `src/subapps/dxf-viewer/services/HitTestingService.ts` → μέθοδος `convertToEntityModel()` (switch ~γρ. 220–450).

**Bug:** Δεν υπάρχει `case 'roof':`. Η στέγη πέφτει στο `default` (γρ. ~447) που επιστρέφει `{ ...baseModel }` **χωρίς `geometry`/`params`/`kind`** → `BoundsCalculator.calculateBimEntityBounds()` βλέπει `geometry === undefined` → επιστρέφει `null` → `HitTester.setEntities()` (γρ. ~61–70, `if (entityBounds)` guard) **σιωπηλά ΔΕΝ εισάγει τη στέγη στο spatial index** → `RoofRenderer.hitTest()` δεν καλείται ποτέ.

**Η στέγη είναι DIRECT entity** (όπως wall/beam), ΟΧΙ wrapped όπως το slab (`slabEntity`). Ο `dxf-scene-entity-converter` (case 'roof', γρ. ~348) ήδη βγάζει top-level `geometry`/`params`. Άρα:

**FIX (mirror wall/beam, γρ. ~389–391):**
```ts
case 'roof':
  return buildBimEntityModel('roof', entity, baseModel);
```
**ΚΑΜΙΑ άλλη πύλη δεν λείπει** — `Bounds.ts:141`, `entity-bounds.ts:154`, `bim-bounds.ts:47` έχουν ΟΛΕΣ σωστό `case 'roof'`. Επιβεβαιωμένο. Ο `RoofRenderer.hitTest()` (bbox + `pointInPolygon`) είναι ήδη σωστός.

---

## 🔴 (Β) GRIPS — 16-STEP CHECKLIST (1 νέο αρχείο + 15 edits)

**Πρότυπο:** `bim/slabs/slab-grips.ts` + όλη η slab forwarding chain. Νέος discriminant `roofGripKind` με 2 παραλλαγές: `` `roof-vertex-${number}` `` + `` `roof-edge-midpoint-${number}` ``. Optional discriminant → **μη-breaking**.

### 🔑 ΜΟΝΑΔΙΚΗ ΔΙΑΦΟΡΑ ΑΠΟ ΤΟ SLAB (ΚΡΙΣΙΜΟ — αλλιώς ΟΛΑ τα grips απορρίπτονται)
Το `RoofParams.edges: readonly RoofEdgeSlope[]` είναι **παράλληλο** με το `outline.vertices` (μία `RoofEdgeSlope` ανά κορυφή/ακμή). Το `UpdateRoofParamsCommand.validate()` (γρ. 114) **απαιτεί ρητά** `edges.length === outline.vertices.length` → επιστρέφει error αλλιώς → το command απορρίπτεται.
Άρα στο `roof-grips.ts`:
- **move vertex** (`roof-vertex-N`): `edges` **αμετάβλητο** (ίδιο count, αλλάζει μόνο θέση).
- **insert vertex** (`roof-edge-midpoint-N`): splice **νέα** `RoofEdgeSlope` στο `edges` σε index `N+1` = **αντίγραφο του `edges[N]`** (ίδιο slope/definesSlope/overhang με την ακμή που σπάει).
- **delete vertex** (`removeVertexFromRoof`): guard `verts.length <= 3` (ελάχιστο τρίγωνο)· filter ΚΑΙ `outline.vertices[index]` ΚΑΙ `edges[index]` (lockstep).
- `RoofEdgeSlope` = `{ definesSlope: boolean; slope: number; overhangMm: number }`.

### Υπογραφή command (επαληθευμένη):
`new UpdateRoofParamsCommand(roofId, params, previousParams, sceneManager, isDragging, typeChange?)`
→ recompute geometry+validation atomically. EventBus: `'bim:roof-params-updated'` (ήδη υπάρχει στο drawing-event-map από #1).

### CHECKLIST

1. **NEW** `src/subapps/dxf-viewer/bim/roofs/roof-grips.ts` — pure functions (zero React/DOM/Firestore). Clone `bim/slabs/slab-grips.ts`:
   - `getRoofGrips(entity: Readonly<RoofEntity>): GripInfo[]` — `2N` grips (N vertex `roof-vertex-i` + N midpoint `roof-edge-midpoint-i`). Διάβασε κορυφές από `entity.params.outline.vertices` (ή `getBimEntityKeyPoints2D` όπως slab). `slabGripKind` → `roofGripKind`.
   - `applyRoofGripDrag(gripKind: RoofGripKind, input: Readonly<RoofGripDragInput>): RoofParams` — `roof-vertex-` → `moveOutlineVertex` (edges αμετάβλητο)· `roof-edge-midpoint-` → `insertVertexOnEdge` (**+ splice edges[N+1]=copy edges[N]**). Υποστήριξε `rectilinear` (Shift, `quantizeToDominantAxis`).
   - `removeVertexFromRoof(originalParams, vertexIndex): RoofParams` — guard `<=3`· filter vertices **& edges**.
   - `RoofGripDragInput { originalParams: RoofParams; delta: Point2D; rectilinear?: boolean }`.

2. **`hooks/grip-kinds.ts`** — `export type RoofGripKind = \`roof-vertex-${number}\` | \`roof-edge-midpoint-${number}\`;` (μετά το `SlabOpeningGripKind`, ~γρ. 149).

3. **`hooks/grip-types.ts`** — import + re-export `RoofGripKind` (γρ. 17 & 39)· πεδίο `roofGripKind?: RoofGripKind;` στο `GripInfo` (μετά `slabOpeningGripKind`, ~γρ. 88–93).

4. **`hooks/grips/unified-grip-types.ts`** — import `RoofGripKind` (γρ. 13)· `readonly roofGripKind?: RoofGripKind;` στο `UnifiedGripInfo` (~γρ. 167–174).

5. **`hooks/grips/grip-registry.ts`** — στο `wrapDxfGrip` (~γρ. 49–52): `...(grip.roofGripKind ? { roofGripKind: grip.roofGripKind } : {}),`.

6. **`hooks/grip-computation.ts`** — import `RoofGripKind` + `RoofEntity` + `getRoofGrips` (από `'../bim/roofs/roof-grips'`)· πεδίο `roofGripKind?: RoofGripKind;` στο `DxfGripDragPreview` (~γρ. 88–89)· **νέο `case 'roof'`** στο `computeDxfEntityGrips` (μετά `mep-segment`, ~γρ. 398): `const roof = entity as unknown as RoofEntity; grips.push(...getRoofGrips(roof)); break;` — **ΠΡΟΣΟΧΗ: roof = DIRECT entity, ΟΧΙ `entity.roofEntity ?? ...`** (αντίθετα με slab που είναι wrapped). Επαλήθευσε πώς φτάνει το entity εδώ.

7. **`hooks/grips/grip-parametric-commits.ts`** — import `UpdateRoofParamsCommand` + `applyRoofGripDrag` + `RoofEntity`· **νέα** `commitRoofGripDrag(grip, delta, deps)` (clone `commitSlabGripDrag` ~γρ. 222–257): guard `grip.roofGripKind`· `candidate.type !== 'roof'`· `ShiftKeyTracker.getSnapshot()` → rectilinear· `applyRoofGripDrag(...)`· `new UpdateRoofParamsCommand(id, newParams, originalParams, sceneManager, /*isDragging*/ true)`· `command.validate()===null` → `deps.execute`· `EventBus.emit('bim:roof-params-updated', ...)`. Export το.

8. **`hooks/grips/grip-commit-adapters.ts`** — import `commitRoofGripDrag`· στο `commitDxfGripDragModeAware` (~γρ. 361–377) μετά το `slabOpeningGripKind` block: `if (grip.roofGripKind) { commitRoofGripDrag(grip, delta, deps); return; }`.

9. **`hooks/grips/grip-projections.ts`** — στο `buildDxfDragPreview` (~γρ. 71–74): `...(activeGrip.roofGripKind ? { roofGripKind: activeGrip.roofGripKind, anchorPos } : {}),`.

10. **`rendering/ghost/entity-preview-types.ts`** — import `RoofGripKind`· `readonly roofGripKind?: RoofGripKind;` στο `EntityPreviewTransform` (~γρ. 69–70).

11. **`rendering/ghost/apply-entity-preview.ts`** — import `applyRoofGripDrag` + `RoofEntity`· `roofGripKind` στο destructuring (~γρ. 93)· νέο preview branch (μετά slab-opening, ~γρ. 266): `if (roofGripKind && entity.type === 'roof') { const roof = entity as unknown as RoofEntity; const newParams = applyRoofGripDrag(roofGripKind, { originalParams: roof.params, delta }); if (newParams === roof.params) return entity; return { ...(entity as object), params: newParams } as unknown as DxfEntityUnion; }`.

12. **`hooks/tools/grip-drag-preview-transform.ts`** — pass-through (~γρ. 35–36): `...(dp.roofGripKind ? { roofGripKind: dp.roofGripKind } : {}),`.

13. **`systems/grip/grip-context-menu-resolver.ts`** — στο `buildVertexOpsSection` (~γρ. 123–141): πρόσθεσε `?? grip.roofGripKind` στο `kind` resolution· πρόσθεσε `|| kind.startsWith('roof-vertex-')` (deleteCorner) και `|| kind.startsWith('roof-edge-midpoint-')` (addCorner).

14. **`hooks/grips/useGripContextMenuController.ts`** — import `removeVertexFromRoof` + `applyRoofGripDrag` + `UpdateRoofParamsCommand` + `RoofEntity`· πρόσθεσε `onRoofVertexOp` handler (mirror `onSlabVertexOp` ~γρ. 159–176: type `'roof'`, `roof-vertex-`→`removeVertexFromRoof`, `roof-edge-midpoint-`→`applyRoofGripDrag` με delta 0)· wire-up στο `bindContextMenuAction` (έλεγξε signature `grip-context-menu-actions.ts`).

15. **`hooks/canvas/useSmartDelete.ts`** — import `removeVertexFromRoof` + `UpdateRoofParamsCommand` + `RoofEntity`· νέο **PRIORITY 0.5 (roof)** block αμέσως μετά το slab (~γρ. 107–135): `if (hoveredDxfGrip?.roofGripKind?.startsWith('roof-vertex-') ...)` → `LevelSceneManagerAdapter` → `candidate.type==='roof'` → `removeVertexFromRoof` → `UpdateRoofParamsCommand(..., false)` → `validate()===null` → execute → `return true`. **SHARED αρχείο** — targeted edit.

16. **`bim/renderers/RoofRenderer.ts`** — `getGrips()` σήμερα επιστρέφει `[]` (γρ. 99–102). Άλλαξέ το να καλεί `getRoofGrips` (mirror `SlabRenderer.getGrips` γρ. 209–223): `if (!isRoofEntity(entity)) return []; return getRoofGrips(entity as RoofEntity).map(g => ({ id, position, type, entityId, isVisible: true, gripIndex }));`.

> **Σημείωση roof-grips στον renderer**: ίσως ο grip pipeline να περνά από `grip-computation.ts case 'roof'` (step 6) ΑΝΤΙ για `RoofRenderer.getGrips`. Επαλήθευσε ποιο μονοπάτι χρησιμοποιείται ζωντανά (slab χρησιμοποιεί ΚΑΙ τα δύο) — κάνε και τα δύο consistent.

---

## 🧪 TESTS (N.7 / §10 #6)
- NEW `bim/roofs/__tests__/roof-grips.test.ts` (mirror slab-grips tests): move vertex (edges count αμετάβλητο), insert midpoint (vertices+1 **& edges+1**, edge=copy), delete vertex (guard <=3, vertices-1 **& edges-1**), rectilinear quantize, out-of-range no-op (identity return).
- Τρέξε: τα υπάρχοντα `roof-geometry.test.ts` (6/6) + νέα grip tests.

## 🔬 VERIFICATION
- `npx tsc --noEmit` (background, ΟΧΙ blocking) — μόνο pre-existing `mesh-to-object3d.ts:124`.
- Browser: επίλεξε στέγη **στο 2Δ** (πρέπει τώρα να επιλέγεται), δες grips, drag κορυφή, insert από midpoint, delete κορυφή (Delete key + right-click menu), undo/redo. Live ghost preview κατά το drag.

## 📌 ΜΕΤΑ ΤΗΝ ΥΛΟΠΟΙΗΣΗ (N.15 — όλα μαζί, **commit ο Giorgio**)
1. `ADR-417` §9 changelog (#2 grips + 2D-select fix) + §10 (mark #2 ✅).
2. `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (ομάδα ADR-417).
3. `adr-index.md` — **ΜΟΝΟ αν δεν το πειράζει άλλος agent**.
4. memory `project_adr417_roof.md` + `MEMORY.md` (μία γραμμή).
5. **ΟΧΙ commit/push** — ετοίμασε, σταμάτα, ανέφερε στον Giorgio τη λίστα αρχείων (`git add` ΜΟΝΟ δικά σου).

## 📂 ΑΡΧΕΙΑ ΑΥΤΗΣ ΤΗΣ ΥΛΟΠΟΙΗΣΗΣ (git add ΜΟΝΟ αυτά)
**Νέα (2):** `bim/roofs/roof-grips.ts`, `bim/roofs/__tests__/roof-grips.test.ts`
**Τροποποιημένα (16):** `services/HitTestingService.ts`, `bim/renderers/RoofRenderer.ts`, `hooks/grip-kinds.ts`, `hooks/grip-types.ts`, `hooks/grips/unified-grip-types.ts`, `hooks/grips/grip-registry.ts`, `hooks/grip-computation.ts`, `hooks/grips/grip-parametric-commits.ts`, `hooks/grips/grip-commit-adapters.ts`, `hooks/grips/grip-projections.ts`, `rendering/ghost/entity-preview-types.ts`, `rendering/ghost/apply-entity-preview.ts`, `hooks/tools/grip-drag-preview-transform.ts`, `systems/grip/grip-context-menu-resolver.ts`, `hooks/grips/useGripContextMenuController.ts`, `hooks/canvas/useSmartDelete.ts`
+ docs (ADR/index/ΕΚΚΡΕΜΟΤΗΤΕΣ/memory).

## ⚠️ ADR-040 staging
- `RoofRenderer.ts` (canvas drawing file) + `useSmartDelete.ts` + `apply-entity-preview.ts` ίσως ενεργοποιήσουν CHECK 6B/6D → **STAGE ADR-040** μαζί αν το pre-commit hook το ζητήσει (όπως το slab grip work). Ο Giorgio το βλέπει στο hook.

---

## ▶️ ΞΕΚΙΝΑ
1. Διάβασε ΑΥΤΟ το handoff + `ADR-417-bim-roof-element.md` (§5/§9/§10) + memory `project_adr417_roof.md`.
2. Επαλήθευσε τα ~line numbers (μπορεί να μετακινήθηκαν) με Grep πριν κάθε edit.
3. Plan Mode, sequential. FULL ENTERPRISE + FULL SSOT. Απάντα στα Ελληνικά.
