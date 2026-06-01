# HANDOFF — ADR-363 Φάση 3: «Τοιχίο από περίγραμμα» (Column από faces)

**Ημερομηνία:** 2026-06-01
**Συντάκτης:** Opus 4.8 — μετά την ολοκλήρωση **Φ2** (ColumnKind `U-shape`/`composite`).
**ADR:** ADR-363 §5.6 + §6 Phase «Από περίγραμμα» (Φ0+Φ1+Φ2 ήδη γραμμένα + §12 changelog).
**Γλώσσα:** Ελληνικά πάντα. **Commit/push:** ΜΟΝΟ Giorgio (ποτέ ο agent).
**Shared working tree (άλλος agent τρέχει):** `git add <specific>`, ΠΟΤΕ `-A`/`checkout`/`restore`/`reset --hard` σε ξένα αρχεία. Verify `git diff --cached` πριν από οτιδήποτε.

---

## 🎯 ΣΤΟΧΟΣ Φ3

Νέο εργαλείο **«Τοιχίο από περίγραμμα»**: ο χρήστης κάνει **box-select στις παρειές** (περιγράμματα) ενός δομικού στοιχείου (ορθογώνιο/Γ/Τ/Π/σύνθετο) → το σύστημα βρίσκει την κλειστή περίμετρο και φτιάχνει **ΕΝΑ `ColumnEntity` ανά κλειστή περίμετρο** (τοιχίο Ο.Σ.), με το είδος (`ColumnKind`) και τη γεωμετρία να προκύπτουν από το σχήμα.

**ΑΠΟΛΥΤΟΣ ΚΑΝΟΝΑΣ (Giorgio, κλειδωμένο):** τοιχίο = **ΠΑΝΤΑ ΕΝΑ ενιαίο entity** — **ΠΟΤΕ** αποσύνθεση σε ανεξάρτητα κομμάτια (Eurocode 8: σύνθετη στατική λειτουργία + boundary elements/κρυφοκολώνες στις συμβολές). Αυτό είναι ο λόγος που το Φ2 έκανε τα `U-shape`/`composite` **polygon-backed**.

Mirror **ΑΚΡΙΒΩΣ** του ολοκληρωμένου Φ1 «Τοίχος από περίγραμμα» — η Φ3 είναι ο 2ος builder πάνω στο ΙΔΙΟ κοινό SSoT.

---

## ✅ ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ (μην το ξαναφτιάξεις)

### Φ2 — ColumnKind (committed/pending, polygon-backed):
- `ColumnKind` = …`| 'U-shape' | 'composite'` (`bim/types/column-types.ts`).
- `ColumnUshapeParams { legThickness?, baseThickness?, flipY?, polygon? }` — αν `polygon` υπάρχει, ΕΙΝΑΙ το ακριβές SSoT.
- `ColumnCompositeParams { polygon }` — υποχρεωτικό polygon ≥3.
- **Σύμβαση polygon:** LOCAL mm, **κεντραρισμένο στο bbox-center**, CCW. Η `column-geometry.ts` (`buildUshapeLocal`/`buildCompositeLocal`/`polygonToLocal`) + `transformFootprint` (bbox-override) **εμπιστεύονται** ότι το polygon είναι bbox-centered → **η Φ3 ΠΡΕΠΕΙ να κεντράρει το polygon στο bbox-center** και να βάλει `position` = bbox-center σε world, `anchor:'center'`.
- Validator/dim-labels/palette/atoe/3D/BOQ/hatch όλα δουλεύουν (kind-agnostic downstream). i18n `invalidUshapeLeg/Base/CompositePolygon` υπάρχουν.

### Φ0 — κοινό SSoT `bim/walls/perimeter-from-faces.ts` (TESTED, το καταναλώνεις):
- `extractClosedPolygons(entities, tol): Point2D[][]`
- `classifyPerimeter(polygon, tol): 'rectangle'|'L'|'T'|'U'|'composite'`
- `perimeterFacesToRects(entities, tol): { perimeters: ClosedPerimeter[]; rects; ignoredCount }`
- `ClosedPerimeter = { polygon: readonly Point2D[]; shape: PerimeterShape; rects }`
- `Point2D` = `{ x:number; y:number }` από `rendering/types/Types` (ΙΔΙΟ που χρησιμοποιεί ColumnUshapeParams.polygon — pass-through χωρίς conversion).
- **Για τα τοιχία:** χρησιμοποίησε `ClosedPerimeter.polygon` + `shape` (ΟΧΙ `decomposeRectilinear` — τα τοιχία είναι ΕΝΑ entity, δεν σπάνε σε σκέλη).

### Φ1 — «Τοίχος από περίγραμμα» (το mirror-άρεις):
- Tool `'wall-from-perimeter'`, `WallPlacementMode 'outer-perimeter'`, EventBus `bim:wall-region-box-select` (κοινό) + `bim:walls-from-perimeter` (toast).

---

## 🔒 MAP `shape → ColumnKind` (Giorgio)

| PerimeterShape | ColumnKind | Σημείωση |
|---|---|---|
| `rectangle` | `'rectangular'` (ή `'shear-wall'` αν λεπτό-μακρόστενο) | ευθύ τοιχίο = shear-wall (aspect ≥4· βλ. `SHEAR_WALL_MIN_ASPECT_RATIO`) |
| `L` | `'L-shape'` | υπάρχει |
| `T` | `'T-shape'` | υπάρχει |
| `U` | `'U-shape'` | **explicit polygon** (πάχη ανά σκέλος από τη γεωμετρία) |
| `composite` | `'composite'` | **explicit polygon** |

**Για L/T:** μπορείς είτε (α) να βγάλεις τις παραμετρικές διαστάσεις (width/depth/armLength…) από το bbox+γεωμετρία, είτε (β) — απλούστερο & πιστότερο — να τα κάνεις κι αυτά polygon-backed μέσω `composite`. **Προτεινόμενο για Φ3 v1:** rectangle→rectangular(/shear-wall), **όλα τα υπόλοιπα (L/T/U/composite) → polygon-backed** (U-shape για το `U`, composite για L/T/composite) ώστε να διατηρείται 100% η γεωμετρία του σχεδίου. Επιβεβαίωσε με Giorgio αν θέλει παραμετρικό L/T ή polygon-backed.

---

## 📂 CHECKLIST — 17 σημεία (mirror `wall-from-perimeter`)

**NEW SSoT:**
1. `bim/columns/column-from-faces.ts` — `perimeterFacesToColumns(entities, tol, layerId, sceneUnits) → { columns: ColumnEntity[]; ignored: number }`. Reuse `perimeterFacesToRects`/`classifyPerimeter`. Ανά `ClosedPerimeter`: map shape→kind· **κεντράρισε το polygon στο bbox-center (mm)**· `position`=bbox-center world, `anchor:'center'`, `width/depth`=bbox· Enterprise ID από `enterprise-id.service` (column generator)· ΕΝΑ entity ανά περίμετρο.
2. `core/commands/.../AddColumnsFromFacesCommand.ts` — ΕΝΑ undo για ΟΛΑ τα τοιχία της επιλογής (mirror του υπάρχοντος column add command σε `hooks/drawing/column-completion.ts`).

**Tool wiring (mirror ΑΚΡΙΒΩΣ τα 4 box-select gates του Φ1):**
3. `systems/events/EventBus.ts` — ADD `'bim:columns-from-perimeter': { built: number; ignored: number }` στο `DrawingEventMap`. (reuse `bim:wall-region-box-select` για το box-select· ή νέο `bim:column-region-box-select` αν θες καθαρότητα.)
4. `systems/tools/tool-definitions.ts` — ADD `'column-from-perimeter'` entry (mirror `'wall-from-perimeter'`).
5. `ui/toolbar/types.ts` — ADD `| 'column-from-perimeter'` στο tool-id union.
6. `hooks/drawing/useColumnTool.ts` — ADD `placementMode: 'freehand'|'outer-perimeter'` + `setPlacementMode` + `onPerimeterClick` (κλικ-μέσα via `isPointInPolygon`) + box-select listener (ενεργό μόνο σε `outer-perimeter`). Στο `outer-perimeter`, `getGhostFootprints`→null. (Σκέψου `use-column-tool-event-listeners.ts` NEW, mirror `use-wall-tool-event-listeners.ts`, για N.7.1.)
7. `systems/cursor/useCentralizedMouseHandlers.ts` — ADD `|| activeTool === 'column-from-perimeter'` στο lasso-down gate.
8. `systems/cursor/mouse-handler-move.ts` — ADD `|| activeTool === 'column-from-perimeter'` στο drag-activate gate.
9. `systems/cursor/mouse-handler-up.ts` — ADD `|| activeTool === 'column-from-perimeter'` στο marquee-intercept gate (emit `bim:wall-region-box-select`).
10. `hooks/canvas/useCanvasClickHandler.ts` — ADD priority block: `if (activeTool === 'column-from-perimeter' && columnTool?.isActive) { columnTool.onCanvasClick(worldPoint); return; }`.
11. `canvas-v2/dxf-canvas/dxf-canvas-renderer.ts` — ADD `|| activeTool === 'column-from-perimeter'` στο `gripsAllowed`.
12. `app/ribbon-contextual-config.ts` — EXPAND column guard → `activeTool === 'column' || activeTool === 'column-from-perimeter'` → `COLUMN_CONTEXTUAL_TRIGGER`.
13. `hooks/tools/useSpecialTools.ts` — EXPAND column lifecycle σε `'column'||'column-from-perimeter'` + `useEffect` που θέτει `setPlacementMode` ανά tool.

**Ribbon + toast + i18n:**
14. `ui/ribbon/data/home-tab-draw.ts` — ADD entry `draw.bim.columnFromPerimeter` (commandKey `'column-from-perimeter'`, mirror `wallFromPerimeter`).
15. `hooks/useDxfViewerNotifications.ts` — ADD listener `bim:columns-from-perimeter` (toast `perimeterColumn.*`, mirror `perimeterWall.*`).
16. `src/i18n/locales/{el,en}/dxf-viewer-shell.json` — ADD `perimeterColumn.{built,builtWithIgnored,noneBuilt}` + `ribbon.commands.bim.columnFromPerimeter.{label,tooltip}`.

**Tests:**
17. NEW test (mirror `wall-from-perimeter.test.ts`): Γ→ένα L-shape(ή composite)· Π→ένα U-shape· σταυρός→composite· ευθύ→rectangular/shear-wall· μικτή→ignored+toast count· ΕΝΑ entity ανά περίμετρο (μη-αποσύνθεση).

⚠️ **ADR-040 CHECK 6D:** αγγίζεις cursor/canvas/renderer files (7,8,9,10,11) → **stage ADR-363 (ή ADR-040) μαζί** αλλιώς blocked. Files ≤500 γρ (N.7.1).

---

## 📌 N.15 trackers (ίδιο commit με κώδικα)
`ADR-363` §6 + §12 changelog · `docs/centralized-systems/reference/adr-index.md` · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (Φ3 → ✅) · memory `project_adr363_from_perimeter_walls.md` + `MEMORY.md` index.

## ⚠️ Παγίδες / προαπαιτούμενα
- 🔴 **Φ1 ΔΕΝ είναι browser-verified.** Η Φ3 χτίζει πάνω στο ΙΔΙΟ `perimeter-from-faces.ts`. **Ζήτα από Giorgio να verify το Φ1** (Γ/Π τοίχος από περίγραμμα) πριν — αν υπάρχει bug εκεί, επηρεάζει και τα τοιχία.
- **polygon centering:** η Νο1 ευθύνη της Φ3 — κεντράρισε στο bbox-center, αλλιώς το anchor offset βγαίνει λάθος (η geometry pipeline το εμπιστεύεται).
- **Pending uncommitted ΞΕΝΑ (ΜΗΝ πειράξεις):** 2 gizmo fixes (units 1000× vanish + tilted-rotate) + Φ0+Φ1+Φ2 (αν δεν έχουν γίνει commit ακόμα). `git add <specific>` + `git diff --cached`.
- Repo **jest-only**. Commit/push = Giorgio.

## 🧭 Deferred (εκτός Φ3)
- **Φ2b:** interactive resize grips (U-shape: `column-variant-grips`/`column-grips`) + mirror flipY (`bim/transforms/bim-mirror-geometry.ts`) + section-profile steel symbols + column-panel kind-picker για manual U-shape/composite.
