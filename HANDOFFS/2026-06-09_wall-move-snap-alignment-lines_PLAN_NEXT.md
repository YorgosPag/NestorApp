# 🧠 HANDOFF — ADR-363 Φ1G.5 Slice 2i: Revit-grade ΕΛΞΗ + Dashed Alignment Lines (μετακίνηση τοίχου)

> **Σύνταξη:** Opus 4.8, 2026-06-09. **Στόχος νέας συνεδρίας:** Recognition → Plan Mode → έγκριση Giorgio → υλοποίηση. **FULL ENTERPRISE + FULL SSOT, «όπως η Revit»** (ρητή απαίτηση Giorgio). Καθαρό context (το προηγούμενο γέμισε με Slice 2h+2h-fix).

---

## ⚠️ ΚΑΝΟΝΕΣ (διάβασέ τους ΠΡΩΤΑ)
- **Ελληνικά** όλες οι απαντήσεις.
- **FULL SSOT** — reuse τη μηχανή έλξης (`getGlobalSnapEngine`), ΜΗΝ γράψεις νέα snap logic. Αρχεία ≤500 γρ., functions ≤40, μηδέν `any`.
- **SHARED working tree** με άλλους agents (γράφουν συχνά — ειδικά `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`, `ADR-363`). `git add` ΜΟΝΟ τα δικά σου. ΠΟΤΕ `-A`. COMMIT/PUSH = ΜΟΝΟ ο Giorgio.
- **N.17:** ΕΝΑΣ tsc τη φορά — process-check ΠΡΩΤΑ (έτρεχαν 2 tsc άλλων agents). ΜΗΝ adr-index.
- **Πάρε ΕΣΥ τις Revit αποφάσεις** + ζήτα έγκριση plan ([[feedback_make_revit_grade_decisions_yourself]]).

---

## 0) ΑΙΤΗΜΑ Giorgio (locked απαντήσεις)
«Όταν μετακινώ τοίχο, να κουμπώνει (έλξη) στις ακμές/παρειές/πλευρές άλλων τοίχων, **όπως η Revit**, με **dashed alignment lines**. FULL ENTERPRISE + FULL SSOT.»
- **Snap feedback:** «+ Dashed alignment lines (Revit πλήρες)» — μικρό glyph **+** διακεκομμένες γραμμές ευθυγράμμισης.
- **Snap targets:** «όπως οι μεγάλοι παίκτες (Revit)» — άκρα/μέσα/τομές/γωνίες/**παρειές-ακμές**/grids.

## 1) ΤΙ ΗΔΗ ΕΓΙΝΕ (Slice 2h + 2h-fix — μη το ξαναφτιάξεις)
- **Temp dimensions μετακίνησης τοίχου** (παρειά→παρειά): `bim/walls/wall-move-dim-references.ts` + `bim-3d/placement/TempWallMoveDimOverlay.ts`. ✅
- **Gizmo καθαρό στο move:** `BimGizmoOverlay.collapseToMoveHandles()`/`restoreConfiguredHandles()` (κρύβει resize/endpoint/tilt) + `isPlanarMoveType()` export· wiring `bim3d-edit-interaction-handlers.ts`. ✅
- **Έλξη ΗΔΗ δουλεύει** στη μετακίνηση τοίχου μέσω `makeMoveSnapFn(getGlobalSnapEngine(), grips, id)` (`buildDragSnapFn`). ✅
- **Μικρό snap glyph:** ο σιελ «κύβος» (= ο snap marker `createSnapMarker`, `SNAP_MARKER_COLOR 0x00e5ff`, ήταν 13% οθόνης) **σμικρύνθηκε** σε `MOVE_SNAP_MARKER_SCREEN_SCALE=0.05` κατά το planar move (`snapMarkerScaleOverride` στο overlay). ✅
- 70 νέα PASS + 195 γειτονικά. tsc 0 δικά μου.

## 2) ΤΟ ΚΕΝΟ (τι λείπει = αυτό το slice)
**(α) Dashed alignment lines** — ΔΕΝ υπάρχουν στο 3Δ. Η Revit, όταν παρειά/άξονας του κινούμενου τοίχου γίνεται **collinear** με παρειά/άξονα άλλου τοίχου/grid, δείχνει μακριά **διακεκομμένη γραμμή** + «κολλάει» εκεί.
**(β) Face/edge snapping** — να επιβεβαιωθεί ότι κουμπώνει στις ΠΑΡΕΙΕΣ/ΑΚΜΕΣ τοίχων (όχι μόνο σημεία).

## 3) 🧩 SSOT ΧΑΡΤΗΣ + ΚΡΙΣΙΜΟ ΕΥΡΗΜΑ
| Τι | Αρχείο |
|----|--------|
| Μηχανή έλξης (ΕΝΑ SSoT) | `snapping/global-snap-engine.ts` → `ProSnapEngineV2` |
| 3Δ bridge (move) | `bim-3d/gizmo/bim3d-snap-bridge.ts` — `makeMoveSnapFn` |
| snap marker glyph | `bim-3d/gizmo/bim-gizmo-overlay-markers.ts` `createSnapMarker` + overlay `showSnapMarker` |
| controller snap call | `bim-3d/gizmo/bim-gizmo-controller.ts` (~γρ.131 `showSnapMarker`) |
| dimension renderer (πρότυπο για dashed γραμμή 3Δ) | `bim-3d/dimensions/Dimension3DRenderer.ts` |

**🔴 ΚΡΙΣΙΜΟ:** το `SnapFn`/`SnapResolution` (`bim3d-snap-bridge.ts`) επιστρέφει **ΜΟΝΟ `{snappedMm, markerMm}`** — ΟΧΙ snap **type** ούτε **reference geometry**. Για alignment lines χρειάζεσαι την **πλήρη** πληροφορία του `ProSnapEngineV2.findSnapPoint` (snap type: EXTENSION/PARALLEL/PERPENDICULAR/collinear + το reference line/άξονα). **Πρώτο βήμα Recognition:** διάβασε τι ΠΡΑΓΜΑΤΙΚΑ επιστρέφει το `findSnapPoint` (full result, όχι το narrowed `SnapQueryEngine`) — πιθανώς ήδη έχει `type`/`referenceEntity`/`direction`. Αν ναι → surface το μέσω εμπλουτισμένου `SnapResolution` (additive, back-compat) → νέο overlay σχεδιάζει τη γραμμή.

## 4) ΠΡΟΤΑΣΗ ΣΧΕΔΙΟΥ (οριστικοποίησε στο Plan)
1. **Recognition:** `ProSnapEngineV2.findSnapPoint` full return type· ποιοι snap types φέρουν reference direction (EXTENSION/PARALLEL/collinear)· αν το engine κάνει ήδη face/edge (NEAREST) για τοίχους (targets registered στο `useGlobalSnapSceneSync`).
2. **Εμπλούτισε `SnapResolution`** (additive optional πεδία: `snapType?`, `alignmentRefMm?: {a:Point2D,b:Point2D}` ή direction) — back-compat, μηδέν regression στα resize/υπάρχοντα.
3. **NEW `bim-3d/placement/TempAlignmentLineOverlay.ts`** (scene-leaf, mirror `TempWallMoveDimOverlay`): δοθέντος alignment ref → διακεκομμένη γραμμή (reuse line geometry SSoT· ΟΧΙ μαύρο περίγραμμα). Hide όταν δεν υπάρχει alignment.
4. **Wiring:** ο gizmo move drag (controller/handlers) περνά το alignment ref στο overlay (mirror του τρόπου που δίνει `markerMm` στο `showSnapMarker`).
5. **Face/edge snapping:** επιβεβαίωσε/πρόσθεσε wall face & edge targets (αν λείπουν) στο snap scene sync — reuse, ΟΧΙ νέα μηχανή.

**Revit decisions (πάρ' τες εσύ):** ποια alignment refs v1 (παρειές+άξονες τοίχων+grids)· χρώμα/στυλ dashed (Revit μπλε/πράσινο)· πόσες ταυτόχρονες γραμμές (Revit: 1-2 ενεργές).

## 5) ΑΡΧΕΙΑ (git add ΜΟΝΟ δικά σου)
- NEW `bim-3d/placement/TempAlignmentLineOverlay.ts` + test.
- MOD `bim3d-snap-bridge.ts` (εμπλουτισμός SnapResolution — additive).
- MOD `bim-gizmo-overlay.ts` / `bim-gizmo-controller.ts` / `bim3d-edit-interaction-handlers.ts` (wiring alignment overlay — shared/hot, minimal).
- ΠΙΘΑΝΟΝ snap scene sync (face/edge targets) — έλεγξε πρώτα αν υπάρχουν.
- DOCS: ADR-363 §12 + ΕΚΚΡΕΜΟΤΗΤΕΣ + memory [[project_adr363_2d_move_from_point]]. ΜΗΝ adr-index.

## 6) ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗΝ γράψεις νέα snap μηχανή/intersection math (reuse engine).
- ΜΗΝ μαύρο περίγραμμα σε γραμμές/βέλη.
- ΜΗΝ commit/push/adr-index/`git add -A`/2ο tsc.

## 7) ΜΝΗΜΕΣ
[[project_adr363_2d_move_from_point]] (πλήρες ιστορικό Slice 2d→2h-fix)· [[feedback_make_revit_grade_decisions_yourself]]· [[feedback_confirm_repro_before_reimplementing]].
