# HANDOFF — ADR-449 Structural Finish Skin (σοβάς), Slice 4: ΔΟΚΑΡΙΑ (beams)

**Ημερομηνία:** 2026-06-13
**Από:** Opus session (Slices 1+2+3 done) → **Προς:** νέα session
**Working tree:** SHARED με άλλον agent (ADR-448 Storey-Aware). **Commit:** ΜΟΝΟ ο Giorgio. Ποτέ `git add -A`, ποτέ `--no-verify`. **Ελληνικά πάντα.**
**Quality bar:** **FULL ENTERPRISE + FULL SSOT, όπως Revit/big-player.** Παίρνεις εσύ τις professional αποφάσεις (Revit-grade), ζητάς μόνο έγκριση plan. ΜΗ διπλασιάζεις — **ΕΠΕΚΤΕΙΝΕ/ΓΕΝΙΚΕΥΣΕ** υπάρχοντα SSoT.

---

## ⚠️ ΠΡΟΣΟΧΗ ΣΤΟΝ ΑΡΙΘΜΟ ADR + SHARED TREE
- **Δικό μας = ADR-449** (`ADR-449-structural-finish-skin.md`). Το **ADR-448 = «Storey-Aware DXF Viewer» ΑΛΛΟΥ agent** — **ΜΗΝ το αγγίξεις**.
- **2 αρχεία έχουν ΜΙΚΤΕΣ αλλαγές** (ADR-449 δικές μου + ADR-448 του άλλου agent), γιατί κι οι δυο αγγίξαμε column 3D path:
  - `bim-3d/converters/bim-three-structural-converters.ts` (εγώ: `walls` param + finish wrap· αυτός: `nominalHeightMm`)
  - `bim-3d/scene/bim-scene-attach-syncs.ts` (εγώ: `entities.walls` arg· αυτός: storey-ceiling context)
  → ο Giorgio το ξέρει· εσύ απλώς **μην** «καθαρίσεις» τις ξένες αλλαγές.
- Pre-existing tsc errors σε ΞΕΝΑ αρχεία (foundation-level, slab-grid-commit, mesh-to-object3d, proposal-ghost-3d, useDxfSceneConversion, **wall-tilt-pieces-3d 1 fail = ADR-448 agent's wallToMesh nominalHeightMm**) — **ΟΧΙ δικά μας, μην τα διορθώσεις**.

---

## ΜΕΡΟΣ Α — ΤΙ ΕΓΙΝΕ (Slices 1+2+3, ΚΟΛΟΝΕΣ, DONE, UNCOMMITTED)

**Σύστημα:** στατικός πυρήνας κολόνας/δοκαριού = **immutable SSoT** (`width`/`depth` ΠΟΤΕ δεν αλλάζει)· σοβάς = **additive derived skin** per-face adjacency-driven (interior-Knauf / exterior-σοβάς / καλυμμένη-από-τοίχο / ΜΕΡΙΚΩΣ καλυμμένη). Default `finish.enabled:false` → δεν φαίνεται μέχρι UI (Slice 5).

### Ο ΠΥΡΗΝΑΣ SSoT που θα ΞΑΝΑΧΡΗΣΙΜΟΠΟΙΗΣΕΙΣ ΑΥΤΟΥΣΙΟ:
- **`bim/finishes/structural-finish-resolver.ts`** — `resolveStructuralFinishFaces({coreFootprint, heightMm, spec, obstacles, classify, unitToMeters})`: pure. Ανά ακμή footprint → `coveredIntervals` − complement → εκτεθειμένες υπο-ακμές → injected `classify` → υλικό + εμβαδά. **Entity-agnostic ΗΔΗ** (δέχεται οποιοδήποτε CCW footprint + heightMm + obstacles). Τα δοκάρια θα τον καλέσουν με `coreFootprint=beam.geometry.outline.vertices`, `heightMm=beam.params.depth`, `obstacles=κολόνες(+τοίχοι)`.
- **`bim/finishes/structural-finish-types.ts`** — `StructuralFinishSpec` (stored) + `StructuralFinishFaces`/`FinishFaceSegment` (derived) + `isFinishActive()`.
- **`bim/finishes/structural-finish-scene.ts`** — scene adapter. **ΕΧΕΙ ΗΔΗ minimal-interface signatures** (`ColumnFinishSource`/`WallFinishObstacle`) ώστε να το τροφοδοτούν ΚΑΙ BIM ΚΑΙ Dxf entities (μηδέν cast). `computeColumnFinishFaces(column, coreFootprint, heightMm, walls)` = το πρότυπο που θα **mirror-άρεις σε `computeBeamFinishFaces`**.
- **3D:** `bim-3d/converters/structural-finish-3d.ts` `buildColumnFinishSkin(column, walls, baseY, levelId)` → `THREE.Group` band prisms (REUSE `stripPrismGeometry` από `envelope-three-mesh.ts`, ΟΧΙ `addBandPrism`). Tag `structuralFinish:true`.
- **2D:** `bim/renderers/ColumnRenderer.ts` `setColumnFinishFaces()`+`drawFinishOutline()` (offset «λωρίδα» ανά εκτεθειμένη παρειά, plaster colour SSoT). Per-frame index: `buildFinishFacesByColumn` (`dxf-renderer-frame-builders.ts`) → `DxfRenderer.render` inject → `EntityRendererComposite.setColumnFinishFaces` → leaf. **ADR-040 orchestrator-drives pattern (mirror openings-by-wall).**
- **BOQ:** `bim/services/structural-finish-boq.ts` (parent πυρήνας + interior/exterior children) + `BimToBoqBridge.upsertWithFinish`. Contribution από `hooks/data/column-boq-feed.ts` (`computeColumnFinishContribution`).

### Επαλήθευση: **29/29 jest** (13+10+6) + 50/50 renderer regression + **tsc καθαρό στα δικά μου**.

### ΤΑ ΑΡΧΕΙΑ ΜΟΥ (για `git add` ονομαστικά — shared tree):
NEW: `bim/finishes/{structural-finish-types,structural-finish-resolver,structural-finish-scene}.ts` · `bim/finishes/__tests__/structural-finish-resolver.test.ts` · `bim/geometry/shared/segment-polygon-coverage.ts` · `bim/services/structural-finish-boq.ts` · `bim/services/__tests__/structural-finish-boq.test.ts` · `bim-3d/converters/structural-finish-3d.ts` · `bim-3d/converters/__tests__/structural-finish-3d.test.ts` · `bim/renderers/__tests__/ColumnRenderer-finish.test.ts` · `docs/.../adrs/ADR-449-structural-finish-skin.md`
MOD: `bim/geometry/wall-host-plan-builder.ts` · `bim/services/{boq-multi-layer-builder,BimToBoqBridge}.ts` · `bim/types/column-types.ts` · `hooks/data/column-boq-feed.ts` · `bim-3d/converters/bim-three-structural-converters.ts`* · `bim-3d/scene/bim-scene-attach-syncs.ts`* · `bim-3d/placement/ColumnPlacementGhost.ts` · `bim/renderers/ColumnRenderer.ts` · `canvas-v2/dxf-canvas/dxf-renderer-frame-builders.ts` · `canvas-v2/dxf-canvas/DxfRenderer.ts` · `rendering/core/EntityRendererComposite.ts` · `docs/.../adrs/ADR-040-preview-canvas-performance.md` (changelog) · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`
(* = ΜΙΚΤΟ αρχείο με ADR-448 agent — δες προειδοποίηση πάνω)

---

## ΜΕΡΟΣ Β — ΤΙ ΝΑ ΚΑΝΕΙΣ (Slice 4: ΔΟΚΑΡΙΑ)

**PHASE 1 RECOGNITION ΠΡΩΤΑ (N.0.1), μετά Plan Mode για έγκριση πριν γράψεις κώδικα.** Διάβασε:
- `bim/types/beam-types.ts` — `BeamParams` (width/depth/topElevation/topElevationEnd/sceneUnits· **ΔΕΝ έχει `finish` → πρόσθεσέ το** όπως στο `column-types.ts`)· `BeamGeometry.outline` = plan rectangle CCW (width×length), `volume` m³, `bbox`.
- `bim/columns/column-face-trim.ts` → **`trimSegmentEndpointsToColumns`** (line 75) = το framing SSoT (δοκάρι «κουρεύεται» στις κολόνες· οι κολόνες είναι τα obstacles των ΑΚΡΩΝ).
- `bim-3d/converters/bim-three-structural-converters.ts` → `beamToMesh` (box extrude / swept-I· baseY = `beamTopMm*MM_TO_M − beamDepthM`).
- `bim/renderers/BeamRenderer.ts` → 2D (drawPolygonPath σε `beam.geometry.outline.vertices`, dashed outline· ΙΔΙΑ δομή με ColumnRenderer → εύκολο mirror του `drawFinishOutline`).
- **BOQ beams:** ΔΕΝ υπάρχει `beam-boq-feed.ts` (υπάρχουν column/wall/slab/foundation). Ο `BimToBoqBridge` υποστηρίζει beam single-entry/multi-layer. **Βρες πώς τα δοκάρια φτάνουν σήμερα στο BOQ** (ή αν δεν φτάνουν) πριν αποφασίσεις πού μπαίνει το `finishContribution`. Πιθανό open item.

### Στόχος Slice 4 (Revit-grade, FULL SSoT — ΓΕΝΙΚΕΥΣΕ, μη διπλασιάσεις):
1. **`BeamParams.finish?: StructuralFinishSpec`** (mirror column).
2. **`computeBeamFinishFaces(beam, outline, depthMm, obstacles)`** στο `structural-finish-scene.ts` — mirror `computeColumnFinishFaces`. Διαφορές δοκαριού (Giorgio): **πάνω=πλάκα** (no finish)· **κάτω=κορυφές τοίχων** (covered)· **άκρα=κολόνες** (covered, obstacles=columns via framing)· → **συνήθως μένουν 2 πλάγιες όψεις** (long sides). `heightMm = beam.params.depth`. Obstacles = κολόνες (άκρα) + ίσως τοίχοι. Classifier: ίδιο building-footprint exterior test (REUSE).
   - ⚠️ Σκέψου: η outline rectangle έχει 4 ακμές = 2 long sides + 2 ends. Ο resolver δίνει side+end exposed sub-edges. Η **κάτω οριζόντια όψη** ΔΕΝ είναι ακμή της plan outline → αν θες bottom-coverage από wall-tops, είναι ξεχωριστό (DEFER ή refine· δες ADR-449 §5 «Beam coverage κάτω-όψης = Slice 4 refinement»).
3. **3D:** ΓΕΝΙΚΕΥΣΕ τον band builder. Ιδανικά extract `buildFinishSkinFromFaces(faces, s, heightM, baseY, id, levelId)` (pure, entity-agnostic) από το `buildColumnFinishSkin`, και κάνε ΚΑΙ column ΚΑΙ beam να τον καλούν. `beamToMesh` → composite `Group{πυρήνας+σοβάς}` (mirror column). baseY = beam base. **Στατικό `width/depth` ΑΜΕΤΑΒΛΗΤΟ.**
4. **2D:** `BeamRenderer.setBeamFinishFaces()`+`drawFinishOutline` (mirror column· μπορείς να εξάγεις κοινό helper) + `buildFinishFacesByBeam` index + `EntityRendererComposite.setBeamFinishFaces` + `DxfRenderer` inject. **ADR-040 orchestrator-drives — μηδέν νέα subscription στο leaf, μηδέν αλλαγή σε bitmap cache key.** ⚠️ Άγγιγμα `DxfRenderer.ts`/`BeamRenderer.ts`/composite → **STAGE ADR-040 changelog** (CHECK 6B/6D) + ADR-449.
5. **BOQ:** parent πυρήνας δοκαριού (m³ σκυρόδεμα) + interior/exterior σοβάς children — μέσω του ΥΠΑΡΧΟΝΤΟΣ `structural-finish-boq.ts` + `BimToBoqBridge.upsertWithFinish` (ήδη entity-agnostic). Χρειάζεται beam feed (δες recognition).
6. **Tests:** beam resolver faces (2 sides exposed, ends covered από κολόνες)· 3D band count/offset· 2D plaster stroke· BOQ payload.

**ΜΗΝ** αγγίξεις στατικό πυρήνα. **ΜΗΝ** βάλεις σοβά στο `width/depth`. Default `finish.enabled:false`.

---

## ΜΕΡΟΣ Γ — ROADMAP (μετά το Slice 4)
- **Slice 5** — Toggle «Σοβατισμένη όψη» (dedicated V/G ή ADR-405 discipline ή ADR-446 Visual Style — **ανοιχτή απόφαση, ρώτα Giorgio**) + UI material/thickness override + factory `createDefaultStructuralFinishSpec` + ενεργοποίηση finish στο column/beam factory.
- **DEFER:** beam bottom-coverage από wall-tops (refine)· attached/κεκλιμένες κορυφές κολόνας στο 3D· stale finish children σε toggle-off (re-sync)· ETICS-grade per-element exterior detection.

---

## ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
Ελληνικά. ΟΧΙ commit/push (Giorgio). ΟΧΙ `git add -A` (shared tree· git add ΜΟΝΟ δικά σου ονομαστικά). ΟΧΙ `--no-verify`. ΕΝΑ tsc τη φορά (N.17). N.7.1 (40 γρ./func, 500 γρ./file). ADR-driven (code=SoT· ADR-449 + **ADR-040 changelog αν αγγίξεις DxfRenderer/renderer/composite** + ΕΚΚΡΕΜΟΤΗΤΕΣ + MEMORY στο ίδιο commit). FULL ENTERPRISE + FULL SSOT (Revit-grade) — ΓΕΝΙΚΕΥΣΕ, μη διπλασιάσεις.

**Resume pointers:** ADR-449 (§3/§3.bis/§3.ter + §4 roadmap + §6 changelog) · MEMORY `project_adr449_structural_finish_skin.md` · plan `~/.claude/plans/idempotent-drifting-dongarra.md`.
