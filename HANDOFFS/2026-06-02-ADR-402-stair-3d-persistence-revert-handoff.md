# HANDOFF — ADR-402: 3Δ BIM editing — αλυσίδα 5 latent bugs (4 διορθωμένα, 1 εκκρεμεί) + η ΠΡΑΓΜΑΤΙΚΗ φάση (3Δ grips σκάλας)

**Ημερομηνία:** 2026-06-02
**Συντάκτης:** Developer A (Opus 4.8, SOLO) — context exhausted (~96%)
**Θέμα:** ADR-402 — 3D Viewport BIM Element Editing
**Κατάσταση:** ΟΛΑ uncommitted (κανένα commit/push — N.(-1)). tsc 0. Πολλά tests PASS.

---

## 0. ΠΡΩΤΟ ΒΗΜΑ
1. **`git status`** — το working tree έχει ΚΑΙ δουλειά άλλων ADR (401/396/beam-slope). **ΠΟΤΕ `git add -A`.** Δες §4 για ΤΑ ΔΙΚΑ ΜΑΣ αρχεία.
2. **Διάβασε memory:** `project_adr402_genarc_gizmo_port.md` (πλήρες state, οι 4 fixes είναι καταγεγραμμένοι εκεί) + `project_adr402_3d_bim_editing.md` + `project_adr393_stair_extended_grips.md`.
3. **🔴 ΞΕΚΙΝΑ ΑΠΟ §1 (το ΕΝΑ εκκρεμές bug).** Είναι one-line fix, υψηλή βεβαιότητα. Μετά §5 (η πραγματική φάση).

---

## 1. 🔴 ΤΟ ΕΝΑ ΕΚΚΡΕΜΕΣ BUG — σκάλα κάνει revert στο 3Δ move (ΥΨΗΛΗ ΒΕΒΑΙΟΤΗΤΑ, one-line fix)

### Σύμπτωμα (Giorgio, επιβεβαιωμένο 4 φορές)
Επιλέγω σκάλα στο 3Δ → gizmo (2 οριζόντιοι άξονες, ΟΧΙ κατακόρυφος — **by design**, βλ. §3). Σέρνω βελάκι move → μετακινείται μόνο το gizmo (η σκάλα μένει επιλεγμένη). Αφήνω → η σκάλα **πάει στη ΣΩΣΤΗ νέα θέση** (το unit fix δούλεψε) και **ΑΣΤΡΑΠΙΑΙΑ επιστρέφει στην αρχική + αποεπιλέγεται**. = optimistic update → rollback.

### Root cause (ΕΝΤΟΠΙΣΜΕΝΟ)
Το `useStairPersistence` (`src/subapps/dxf-viewer/bim/hooks/use-stair-persistence.ts`) auto-save-άρει ΜΟΝΟ τον `primarySelectedStair` όταν αλλάζουν τα params, **ΜΕ gate** στη γραμμή ~317:
```ts
const known = lastSavedParamsRef.current.has(stair.id);
const pendingStair = pendingFirstSaveIdsRef.current.has(stair.id);
if (!known && !pendingStair) return;   // ← ΕΔΩ μπλοκάρει
```
Για σκάλα **φορτωμένη από Firestore** (προηγούμενη συνεδρία), το `lastSavedParamsRef` είναι **ΑΔΕΙΟ** → `known=false` → το auto-save **κάνει return χωρίς να persist-άρει**. Μετά το diff-merge subscription (γρ. ~187-188) βλέπει scene-stair ≠ remote και (αφού δεν είναι dirty) **επαναφέρει** τη σκάλα στα remote (παλιά) params → **revert + αποεπιλογή**.

**ΑΠΟΔΕΙΞΗ ότι αυτό είναι:** το `useWallPersistence` (`src/subapps/dxf-viewer/hooks/data/useWallPersistence.ts`) είχε ΤΟ ΙΔΙΟ bug και το **έλυσε** seed-άροντας το `lastSavedParamsRef` στο subscription στο load (γρ. ~188: `lastSavedParamsRef.current.set(doc.id, doc.params);` με σχόλιο γρ. ~181-185 που περιγράφει ΑΚΡΙΒΩΣ αυτό το revert). Ο τοίχος **τώρα persist-άρει σωστά** (Giorgio: το wall error εξαφανίστηκε). Το stair subscription **ΔΕΝ έχει** αυτό το seeding → γι' αυτό μόνο η σκάλα κάνει ακόμα revert.

### FIX (mirror του wall pattern)
Στο `use-stair-persistence.ts`, στο subscription diff-merge (μέσα στο `svc.subscribeStairs(...)`, εκεί που γίνεται `nextStairs.push(stairDocToEntity(doc))` ΚΑΙ στο merge branch), **seed το baseline** για κάθε φορτωμένη σκάλα που δεν είναι dirty:
```ts
// mirror useWallPersistence — ώστε το auto-save gate να βλέπει τις φορτωμένες σκάλες ως `known`
if (!dirty.has(doc.id)) lastSavedParamsRef.current.set(doc.id, doc.params);
```
Τοποθέτησέ το ώστε να τρέχει για ΚΑΘΕ doc που έρχεται από Firestore (remote add + remote merge + unchanged), εκτός αν είναι locally-dirty (μη χαλάσεις in-flight edit baseline). **Δες ΑΚΡΙΒΩΣ πώς το κάνει το `useWallPersistence` (γρ. ~160-190) και αντίγραψέ το 1-1.**

### Verify
- Φόρτωσε σελίδα (ώστε η σκάλα να είναι «loaded»), 3Δ move σκάλας → **μένει** + reload → σωσμένη.
- Test: πρόσθεσε στο `use-stair-persistence` test (αν υπάρχει) ή regression που το subscription seed-άρει `lastSavedParamsRef`.

### ⚠️ Πιθανό 2ο layer
Αν ΜΕΤΑ το seeding ΑΚΟΜΑ κάνει revert: ίσως υπάρχει stair-specific undefined field που το Firestore απορρίπτει (όπως ο τοίχος είχε `polylineVertices`). Το firestore-sanitize fix (§2 #4) **ήδη** καλύπτει saveStair/updateStair, άρα μάλλον όχι — αλλά τσέκαρε το console για `updateDoc ... undefined` σε `floorplan_stairs`.

---

## 2. ΟΙ 4 ΔΙΟΡΘΩΜΕΝΟΙ ΚΡΙΚΟΙ (όλοι latent, βγήκαν στο browser verify — ΚΑΝΕΝΑΣ δεν είναι η «φάση grips»)

1. **Crash snap-drag σε σκάλα/πλάκα.** `computeDxfEntityGrips` περίμενε DXF wrapper (`.stairEntity`/`.slabEntity`) αλλά ο 3Δ snap path δίνει domain entity. Fix: `grip-computation.ts` cases stair/slab δέχονται **και** τις δύο μορφές (`.stairEntity ?? entity`). +regression test.
2. **Unit mismatch σκάλας.** wall/column/beam/slab params = **raw mm**· σκάλα = **inferred drawing units** (StairToThreeConverter sceneToM). Το 3Δ move/rotate έδινε mm χωρίς μετατροπή → σκάλα 1000× εκτός. Fix: ΝΕΟ SSoT `mmToEntityUnitFactor(entity)` στο `bim3d-edit-math.ts` → εφαρμογή σε move delta + rotate pivot (single) στο `bim3d-edit-interaction-handlers.ts`. +3 tests.
3. **3Δ επιλογή δεν τροφοδοτούσε το persistence.** Το per-type persistence auto-save-άρει το `primarySelectedId` = από `universalSelection` (2Δ). Η `Selection3DStore` δεν το ενημέρωνε → 3Δ edits δεν έφταναν ποτέ στο persistence. Fix (full SSoT, Revit unified-selection): ΝΕΟ one-way bridge `use3DSelectionUniversalBridge` (`bim-3d/systems/selection/`) → mirror 3Δ sel στο `universalSelection.replaceEntitySelection`, diff-guard (loop-safe), mount στο `DxfViewerContent`. **ΔΟΥΛΕΥΕΙ** (το επιβεβαίωσε το wall error που εμφανίστηκε = το persistence ξεκλειδώθηκε).
4. **Firestore απορρίπτει nested undefined.** `WallFirestoreService.save/updateWall` + `StairFirestoreService.save/updateStair` έστελναν `params` με nested undefined (π.χ. `polylineVertices`). Fix: εφαρμογή υπάρχοντος SSoT `stripUndefinedDeep` (`@/utils/firestore-sanitize`) **μόνο στα data sub-objects** (params/validation/geometry — ΟΧΙ σε όλο το payload γιατί έχει serverTimestamp/deleteField sentinels· το stripUndefinedDeep ΔΕΝ έχει isPlainObject guard). 2 services. +2 regression tests + διόρθωση `toBe→toEqual` (γρ. 301-302 stair test, αφού πλέον deep-copy).

---

## 3. #1 & #2 ΤΟΥ GIORGIO — ΟΧΙ bugs
- **«Δεν φαίνεται κατακόρυφος άξονας στη σκάλα»** = **by design**. `BASE_HANDLES` (bim-gizmo-overlay) δεν έχει vertical MOVE άξονα κανένα entity· `RESIZE_HANDLES_BY_TYPE.stair=[resize-x,resize-z]` (όχι resize-y — ύψος=rise×stepCount από πάνελ). column/wall/beam έχουν resize-y. Αν ο Giorgio θέλει κατακόρυφο για σκάλα → απόφαση στη φάση grips.
- **«Δεν εμφανίζονται grips»** = **η ΦΑΣΗ που δεν χτίστηκε ακόμα** (§5).

---

## 4. ΤΑ ΔΙΚΑ ΜΑΣ ΑΡΧΕΙΑ (working tree, uncommitted) — ΜΗΝ μπλέξεις άλλα ADR
**MODIFIED:**
- `src/subapps/dxf-viewer/hooks/grip-computation.ts` (fix #1)
- `src/subapps/dxf-viewer/bim-3d/utils/bim3d-edit-math.ts` (fix #2: mmToEntityUnitFactor)
- `src/subapps/dxf-viewer/bim-3d/animation/bim3d-edit-interaction-handlers.ts` (fix #2 apply move+rotate)
- `src/subapps/dxf-viewer/app/DxfViewerContent.tsx` (fix #3: mount bridge)
- `src/subapps/dxf-viewer/bim/walls/wall-firestore-service.ts` (fix #4)
- `src/subapps/dxf-viewer/bim/stairs/stair-firestore-service.ts` (fix #4)
- `src/subapps/dxf-viewer/bim-3d/utils/__tests__/bim3d-edit-math.test.ts` (+3 tests)
- `src/subapps/dxf-viewer/bim/stairs/__tests__/stair-firestore-service.test.ts` (+2 tests, toBe→toEqual)
- `docs/.../ADR-402-3d-bim-element-editing.md` (changelog fixes #1-3· **#4 changelog ΕΚΚΡΕΜΕΙ**)
- `use-stair-persistence.ts` ← **ΕΔΩ θα μπει το fix §1** (δεν το άγγιξα ακόμα)

**NEW:**
- `src/subapps/dxf-viewer/bim-3d/systems/selection/use-3d-selection-universal-bridge.ts` (fix #3)
- `src/subapps/dxf-viewer/hooks/__tests__/grip-computation-bim-domain-entity.test.ts` (fix #1)

**Tests status:** gizmo 63/63, edit-math 9/9, stair-firestore 21/21, Selection3DStore/Bim3DEditStore PASS. tsc 0.

---

## 5. Η ΠΡΑΓΜΑΤΙΚΗ ΦΑΣΗ (δεν ξεκίνησε) — Πλήρη Revit-style 3Δ grips για σκάλα
Φέρε το 2Δ stair grip σύστημα (ADR-393, `getStairGrips` 5-13 grips) στο 3Δ: draggable 3Δ handles πάνω στη σκάλα → ΙΔΙΟ `applyStairGripDrag`/`commitStairGripDrag`/`UpdateStairParamsCommand` SSoT.
- **Reference:** `Dim3DGripsRenderer.ts` (sprite grips + raycaster pick), `WaypointDragHandle.ts`+`waypoint-drag-controller.ts` (AbortController 3Δ drag), `coordinate-transforms` (dxfPlanToWorld/worldToDxfPlan).
- **🚨 ΠΡΟΣΟΧΗ UNITS:** οι grip θέσεις (`getStairGrips`) είναι σε **drawing units** (όχι mm). Ο 3Δ drag δίνει world→mm· χρειάζεσαι `mmToEntityUnitFactor` (που έφτιαξα, fix #2) ή `mmToSceneUnits(inferSceneUnitsFromWidth)`. Μάθημα: η σκάλα είναι το ΜΟΝΟ BIM type σε drawing units.
- **Design questions (ΡΩΤΑ ΕΝΑ-ΕΝΑ, απλά ελληνικά):** (Q1) grips ΑΝΤΙΚΑΘΙΣΤΟΥΝ τα resize τετραγωνάκια ή ΣΥΜΠΛΗΡΩΝΟΥΝ; (Q2) ποια grips (όλα/υποσύνολο); (Q3) glyph/σχήμα 3Δ; (Q4) γενικό `Bim3DGripRenderer` ή μόνο σκάλα;
- **N.8:** >3 αρχεία → Plan Mode, ζήτα έγκριση.

---

## 6. ΑΛΛΕΣ ΕΚΚΡΕΜΟΤΗΤΕΣ
- ADR-402 changelog για fix #4 (δεν πρόλαβα).
- **Έλεγξε column/beam/slab/opening/slab-opening firestore services** για το ΙΔΙΟ nested-undefined κενό (same `stripUndefinedDeep` fix) — μόλις 3Δ edits τους φτάσουν στο persistence (μέσω του bridge), μπορεί να σκάσουν όπως ο τοίχος.
- N.15: ΕΚΚΡΕΜΟΤΗΤΕΣ.txt + adr-index ενημέρωση μαζί με commit.

## 7. ΟΡΙΑ / ΚΑΝΟΝΕΣ
- **ΜΗΝ commit/push χωρίς εντολή Giorgio (N.(-1)).** ΠΟΤΕ `git add -A`.
- ΜΗΝ αγγίξεις δουλειά άλλων ADR (401/396/beam-slope) στο tree.
- Το fix §1 αγγίζει `use-stair-persistence.ts` (bim/hooks) — serialization/baseline, ΟΧΙ stair geometry λογική. OK.
- Greek responses πάντα.
