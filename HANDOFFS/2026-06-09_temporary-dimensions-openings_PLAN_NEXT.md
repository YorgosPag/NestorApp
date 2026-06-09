# 🧠 HANDOFF — Revit-style «Temporary / Listening Dimensions» για ΚΟΥΦΩΜΑΤΑ (ADR-363 Φ1G.5 Slice 2f)

> **Σύνταξη:** Opus 4.8, 2026-06-09. **Στόχος νέας συνεδρίας:** Plan Mode → εκτίμηση → υλοποίηση. **FULL ENTERPRISE + FULL SSOT, «όπως η Revit».** Καθαρό context.

---

## ⚠️ ΚΑΝΟΝΕΣ (πάγιοι — διάβασέ τους ΠΡΩΤΑ)
- **Ελληνικά** όλες οι απαντήσεις στον Giorgio.
- **FULL ENTERPRISE + FULL SSOT** — μηδέν `any`/`as any`/`@ts-ignore`· αρχεία ≤500 γρ.· functions ≤40 γρ.· καμία διπλή υλοποίηση (reuse τα SSoT της §3).
- **Πάρε ΕΣΥ τις Revit αποφάσεις** + ζήτα ΜΟΝΟ έγκριση plan ([[feedback_make_revit_grade_decisions_yourself]]).
- **SHARED working tree** με ΑΛΛΟΝ agent (κάνει commits μόνος του). `git add` **ΜΟΝΟ** τα δικά σου αρχεία· **ΠΟΤΕ** `git add -A`. Έλεγχε `git log`/`git status` συχνά.
- **COMMIT/PUSH = ΜΟΝΟ ο Giorgio** (N.(-1)). Ο agent ΔΕΝ κάνει commit. **ΜΗΝ** adr-index.
- **N.17:** ΕΝΑΣ tsc τη φορά — έλεγξε process πρώτα (`Get-CimInstance Win32_Process … *tsc --noEmit*`), συχνά τρέχουν άλλων agents· ΠΕΡΙΜΕΝΕ, μην σκοτώνεις.
- **«Confirm repro before re-implementing»** ([[feedback_confirm_repro_before_reimplementing]]).
- **ADR-040:** τα scene-leaf overlays (ghost/marker/dim) προστίθενται στο `scene`, ΟΧΙ στο `bimLayer.group` → εκτός micro-leaf· αλλά αν αγγίξεις canvas-drawing αρχεία → CHECK 6B/6D θέλουν staged ADR.

---

## 0) ΤΟ ΑΙΤΗΜΑ (Giorgio)

Όταν μετακινείς **κούφωμα** (πόρτα/παράθυρο), η εφαρμογή να δείχνει **«όπως η Revit»**:
1. **Temporary / listening dimensions:** μπλε **γραμμές διάστασης** από το κούφωμα (παρειές) προς **κοντινές αναφορές** (διπλανό άνοιγμα, **άκρο τοίχου**) με **ζωντανό αριθμό** που ενημερώνεται καθώς σέρνεις.
2. **Numeric input:** πληκτρολογείς αριθμό → το κούφωμα πάει στο **ακριβές offset**.
3. **Alignment:** στιγμιαία ευθυγράμμιση όταν η παρειά ταιριάζει με αναφορά.

**Γιατί ΟΧΙ snap glyph:** δοκιμάστηκε (Slice 2e) και αφαιρέθηκε — το cursor-point snapping είναι λάθος μοντέλο για hosted element (ο κέρσορας είναι πάντα στον τοίχο → κουμπώνει διαρκώς σε λάθος). Η Revit εδώ χρησιμοποιεί **temporary dimensions**, ΟΧΙ σύμβολο έλξης. Δες [[project_adr363_2d_move_from_point]].

---

## 1) ΠΟΥ ΕΙΜΑΣΤΕ — τι ΥΠΑΡΧΕΙ ήδη (μην το ξαναφτιάξεις)

**✅ COMMITTED (f5e299d4 + 5cda16bd):**
- **Slice 2d** — ειδικός 3Δ drag κουφώματος (ΟΧΙ gizmo) με ζωντανό μπλε ghost (`OpeningMoveGhost`)· press→drag→`resolveOpeningAltMove`→ghost→release `UpdateOpeningParamsCommand`. **Δουλεύει σωστά.**
- Το gizmo είναι gated-off για openings (`use-bim3d-edit-interaction`).

**⛔ Slice 2e (snap glyph) ΑΦΑΙΡΕΘΗΚΕ** (λάθος μοντέλο, βλ. §0). Το `use-bim3d-opening-move.ts` είναι στο καθαρό pre-snap state (raw cursor → `resolveOpeningAltMove`). **Αυτό το slice ΧΤΙΖΕΙ ΠΑΝΩ σε αυτό** — δεν επαναφέρει το snap.

---

## 2) ΤΙ ΚΑΝΕΙ Η REVIT (το πρότυπο)

Στη Revit, σέρνοντας κούφωμα: μπλε **προσωρινές διαστάσεις** από τις δύο παρειές προς τις πλησιέστερες αναφορές (διπλανό άνοιγμα / άκρο τοίχου), με **ζωντανό αριθμό**. Πατάς σε διάσταση ή απλώς πληκτρολογείς → **listening dimension** δέχεται αριθμό → ακριβής τοποθέτηση. Οι διαστάσεις είναι **read-model κατά το drag** (δεν αποθηκεύονται), εξαφανίζονται στο release.

---

## 3) 🧩 SSOT ΧΑΡΤΗΣ — ΤΙ ΝΑ REUSE (μηδέν duplication)

| Τι | Αρχείο | Σημείωση |
|----|--------|----------|
| **3Δ dim renderer** `createDimension3DRenderer(dim)` → `{root, update, dispose}` | `bim-3d/dimensions/Dimension3DRenderer.ts` | dimLine/leader=`THREE.Line`, arrows=Cone, text=`Sprite`+`CanvasTexture` (billboard). **Το πρότυπο για κάθε witness line.** |
| **3Δ dim line layout** `buildDim3DLineLayout(...)` → `{dimLine, leaderLines, textAnchor, arrows}` | `bim-3d/dimensions/dim3d-line-geometry.ts` | pure |
| **3Δ dim type** `BimDimension3D` | `bim-3d/dimensions/dim3d-types.ts` | transient in-memory (ΜΗ persisted) |
| **format τιμής** `formatDim3DValue` | `bim-3d/dimensions/dim3d-value-computer.ts` | mm→label |
| **opening γεωμετρία** `.position`/`.rotation`/`.outline.vertices` | `bim/geometry/opening-geometry.ts` (`computeOpeningGeometry`) | center + 4 jamb corners + rotation (axis γωνία) |
| **projection** `projectPointToWallOffsetMm(point, host)` | `bim/geometry/opening-geometry.ts` | world point → mm offset από wall start (= ζωντανή απόσταση) |
| **opening grips/παρειές** `getOpeningGrips` | `bim/walls/opening-grips.ts` | center + corner-{nw,sw}=start-jamb, {ne,se}=end-jamb |
| **re-host/offset SSoT** `resolveOpeningAltMove` | `bim/walls/opening-grips.ts` | ΗΔΗ υπολογίζει live `offsetFromStart` (η raw τιμή) |
| **wall άκρα** `host.params.start`/`.end`, `host.geometry.length×1000` | wall entity | reference anchors |
| **numeric input** `CanvasNumericInputStore.activate(sign, refGuideId, onConfirm, onCancel)` + overlay | `systems/canvas-numeric-input/` | typed-distance χωρίς να κλέβει focus (`pointer-events-none`)· **προτεινόμενο** για το listening |
| **overlay leaf pattern** | `bim-3d/placement/OpeningMoveGhost.ts` / `PlacementSnapMarker.ts` / `BeamFromWallGhost.ts` | constructor(scene)→`scene.add`· `update/show`/`hide`/`dispose`· non-pickable· add στο `scene` ΟΧΙ `bimLayer.group` |
| **integration point** drag lifecycle | `bim-3d/viewport/use-bim3d-opening-move.ts` | hook-in στο `onMove` ΜΕΤΑ το `ghost.showFor(...)`· hide στο `endDrag`/`onCancel` |
| **(Phase 3) 2Δ preview dim** `renderPreviewDimension` + `buildDimensionGeometry` + `AlignedDimensionEntity` | `canvas-v2/preview-canvas/preview-dimension-renderer.ts`, `systems/dimensions/dim-geometry-builder.ts`, `types/dimension.ts` | για 2Δ temp dims στον PreviewCanvas |

**Χρώματα (SSoT):** `UI_COLORS_BASE.MEASUREMENT_LINE` / `DISTANCE_MEASUREMENT_TEXT` (ίδια με 2Δ measurement).

---

## 4) 🔴 GAPS — τι ΠΡΕΠΕΙ να φτιαχτεί (δεν υπάρχει)

1. **`getSiblingOpeningsOnWall(wallId, allOpenings): OpeningEntity[]`** — pure, filter `params.wallId===wallId` + sort by `offsetFromStart`. (Building block `filterHostedOpenings` υπάρχει αλλά είναι δεμένο σε SyncContext — ΟΧΙ pure· φτιάξε pure SSoT.)
2. **`resolveOpeningDimReferences(opening, resolvedParams, host, siblings)`** — pure → επιστρέφει τα reference σημεία: `{ startJamb, endJamb, prevRef, nextRef }` όπου prevRef/nextRef = πλησιέστερη παρειά διπλανού ανοίγματος Ή άκρο τοίχου σε κάθε πλευρά, + οι αποστάσεις (mm). Reuse `projectPointToWallOffsetMm`.
3. **`TempOpeningDimOverlay` (3Δ scene-leaf)** — mirror `OpeningMoveGhost`· wraps N× `createDimension3DRenderer` (μία ανά witness line: αριστερά + δεξιά)· `update(opening, resolvedParams, host, siblings)` ανά frame· `hide()`/`dispose()`. Add στο `scene`.
4. **Hook-in στο `use-bim3d-opening-move`** — instantiate overlay στο `useEffect`· `overlay.update(...)` στο `onMove` ΜΕΤΑ το `ghost.showFor`· `overlay.hide()` στο `endDrag`/`onCancel`· `overlay.dispose()` στο cleanup. (siblings από `useBim3DEntitiesStore.getState().openings`.)
5. **Numeric input routing (listening)** — `CanvasNumericInputStore.activate(...)` στο `onDown`· AbortController-gated `keydown` listener (ίδιο pattern με τα υπάρχοντα listeners) που δρομολογεί digits/Enter/Esc· στο `confirm` → re-run `resolveOpeningAltMove` με το **ακριβές typed offset** αντί για projection κέρσορα.
6. **(Phase 3) 2Δ parity** — temp dims στον PreviewCanvas κατά το 2Δ Alt-drag/grip (`renderPreviewDimension`). Ξεχωριστό integration point (2Δ grip path), όχι μέρος της Phase 1.

---

## 5) 📐 ΠΡΟΤΕΙΝΟΜΕΝΟ SLICING (Revit-grade· πάρε ΕΣΥ τελική απόφαση στο Plan)

- **Phase 1 — 3Δ read-only temporary dimensions** (ο πυρήνας): GAPS 1-4. Δύο witness lines (αριστερά/δεξιά παρειά → πλησιέστερη αναφορά) με ζωντανό αριθμό κατά το 3Δ drag. **Ξεκίνα από εδώ.**
- **Phase 2 — listening dimension (numeric input):** GAP 5. Πληκτρολογείς → ακριβές offset.
- **Phase 3 — 2Δ parity:** GAP 6. Ίδιες temp dims στο 2Δ.
- **Phase 4 — alignment snap (διακριτό):** στιγμιαίο highlight όταν ευθυγραμμίζονται παρειές + dimension snap increments.

**Πιθανή απόφαση:** Phase 1 μόνο σε αυτό το slice (αυτόνομο, ορατό αποτέλεσμα)· Phase 2-4 = επόμενα slices.

---

## 6) RECOGNITION (ΠΡΙΝ κώδικα — επιβεβαίωσε)
1. Διάβασε **πλήρως** `Dimension3DRenderer.ts` + `dim3d-line-geometry.ts` + `dim3d-types.ts` — η ακριβής signature του `createDimension3DRenderer` + `update` + τι θέλει το `BimDimension3D`.
2. Διάβασε `use-bim3d-opening-move.ts` (το onMove lifecycle — που ακριβώς μπαίνει το `overlay.update`).
3. Διάβασε `opening-geometry.ts` (`computeOpeningGeometry` outputs + `projectPointToWallOffsetMm`) — από πού παίρνεις τις 2 παρειές world + host axis.
4. Επιβεβαίωσε `CanvasNumericInputStore` API (για Phase 2) — `activate/addChar/confirm`.
5. Επιβεβαίωσε ότι ο 3Δ dim renderer χρωματίζει/billboard-άρει όπως περιμένεις (text Sprite).

---

## 7) TESTS / TSC / DOCS
- **Tests:** pure `getSiblingOpeningsOnWall` (filter+sort), pure `resolveOpeningDimReferences` (start/end refs vs siblings/wall-ends), `TempOpeningDimOverlay` (build/update/hide/dispose), hook-in (overlay.update καλείται στο onMove, hide στο endDrag). Mirror των υπαρχόντων opening-move/ghost tests.
- **tsc:** background (N.17 — έλεγξε process). Γνωστά **προϋπάρχοντα** errors άλλων agents (ΑΓΝΟΗΣΕ): `mesh-to-object3d.ts(124)`, `mep-fixture-types.ts(151)`.
- **N.15 docs:** ADR-363 §12 changelog (Slice 2f)· memory [[project_adr363_2d_move_from_point]]· `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`. **ΜΗΝ** adr-index. (Cross-ref ADR-362 dimensions, ADR-357 dynamic-input.)

## 8) ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗΝ ξαναφέρεις το snap glyph (Slice 2e — αφαιρέθηκε σκόπιμα).
- ΜΗΝ φτιάξεις νέο dimension renderer/μηχανή — reuse `createDimension3DRenderer` + `buildDim3DLineLayout` (§3).
- ΜΗΝ αποθηκεύσεις temp dims στο Firestore — είναι **transient read-model** (όπως το ghost).
- ΜΗΝ αγγίξεις αρχεία άλλων agents. ΜΗΝ commit/push/adr-index. ΜΗΝ `git add -A`. ΜΗΝ 2ο tsc.

## 9) ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. Διάβασε αυτό + `git log -5` + `git status` (επιβεβαίωσε Slice 2d/2e state §1).
2. Recognition §6 (1-5).
3. Plan Mode → file-level σχέδιο Phase 1 (§4 GAPS 1-4 + §5) + εκτίμηση → έγκριση Giorgio.
4. Υλοποίηση + tests + tsc + ADR-363 changelog + memory + ΕΚΚΡΕΜΟΤΗΤΕΣ.

## 10) ΜΝΗΜΕΣ
[[project_adr363_2d_move_from_point]] (Slice 2d/2e ιστορικό + το μάθημα «hosted≠cursor-snap»)· [[feedback_make_revit_grade_decisions_yourself]]· [[feedback_confirm_repro_before_reimplementing]].
