# HANDOFF — ADR-449 Structural Finish Skin (σοβάς), Slice 7: ΕΝΙΑΙΟΣ ΣΟΒΑΣ ΣΤΙΣ ΣΥΜΒΟΛΕΣ (coplanar + connected junctions, Revit-grade)

**Ημερομηνία:** 2026-06-13
**Από:** Opus session (Slice 6 + fixes #1/#2/#3) → **Προς:** νέα session
**Working tree:** SHARED με άλλον agent (ADR-448/441/450/446/363 move-readout). **Commit:** ΜΟΝΟ ο Giorgio. ΠΟΤΕ `git add -A`, ΠΟΤΕ `--no-verify`. **git add ΜΟΝΟ δικά σου αρχεία.** **Ελληνικά πάντα.**
**Quality bar (ρητή εντολή Giorgio):** **FULL ENTERPRISE + FULL SSOT, όπως Revit/big-player.** Παίρνεις εσύ τις professional αποφάσεις (Revit-grade), ζητάς μόνο έγκριση plan. **ΜΗ διπλασιάζεις — ΕΠΕΚΤΕΙΝΕ/ΓΕΝΙΚΕΥΣΕ υπάρχοντα SSoT.**

---

## ΜΕΡΟΣ Α — ΤΙ ΕΓΙΝΕ (Slices 1-6 + fixes, στο working tree· εν μέρει committed)

ADR-449 = σοβάς (structural finish skin) σε κολόνες/δοκάρια, per-face adjacency-driven. Στατικός πυρήνας `width/depth` = immutable· σοβάς = additive derived skin + BOQ ξεχωριστές γραμμές.

- **Slices 1-5** (committed): pure resolver `bim/finishes/structural-finish-resolver.ts` (per-face partial-coverage· `coveredIntervals`/`exposedComplement` από `bim/geometry/shared/segment-polygon-coverage.ts`)· scene adapter `bim/finishes/structural-finish-scene.ts` (obstacles=walls + classifier exterior/interior)· 3D `bim-3d/converters/structural-finish-3d.ts` (band prisms, `stripPrismGeometry`)· 2D `ColumnRenderer`/`BeamRenderer` outline· BOQ `structural-finish-boq.ts`· view toggle `showFinishSkin` (default ON) + gate `structural-finish-visibility.ts`· factory δίνει `createDefaultStructuralFinishSpec()` (15mm) σε κολόνα+δοκάρι.
- **Slice 6 (beam↔column junction) + 3 fixes** (working tree· split σε commits 5a05dd79/74419215/b994b4c1 από τον άλλον agent με git add -A — ΟΧΙ από Giorgio· κάποια δικά μου ακόμη uncommitted):
  1. **Mutual obstacles**: ο scene adapter περνά footprints δοκαριών (resolve κολόνας) / κολώνων (resolve δοκαριού) ως obstacles. NEW `bim/geometry/shared/polygon-dilate.ts` `dilatePolygonOutward` + join-tolerance `STRUCTURAL_JOIN_TOL_MM=10` (flush framing → coverage=0 χωρίς dilation). Τοίχοι ΧΩΡΙΣ dilation.
  2. **Height-aware bands** (`computeColumnFinishBands`): η αφαίρεση λόγω δοκαριών ισχύει ΜΟΝΟ στη ζώνη ύψους δοκαριού (πάνω)· κάτω ζώνη = πλήρης παρειά. 3D = prism set ανά ζώνη· BOQ = `bandedFinishAreasM2`· **2D plan = walls-only**.
  3. **Attached-path σοβάς** (`composeColumnWithFinish` στο `bim-three-structural-converters.ts`): η attached κολόνα (auto-attach σε δοκάρια) έπαιρνε ΜΟΝΟ πυρήνα → τώρα παίρνει σοβά (ύψος = min attached top· flat-top approx).
  4. **Chamfer άκρων δοκαριού** (`chamferOpenOuterEnds` στο structural-finish-3d.ts): τα ανοιχτά άκρα λωρίδας σοβά κόβονται 45° (όχι square «κεφάλι»). `computeMiteredOuter(..., chamferOpenEnds)` — δοκάρι=true, κολόνα=false.
- **Tests:** 74/74 ADR-449 jest (structural-finish* + polygon-dilate + finish-param + junction + 3d/3d-beam).

---

## ΜΕΡΟΣ Β — ΤΙ ΜΕΝΕΙ (Slice 7): ΟΙ ΣΥΜΒΟΛΕΣ ΣΟΒΑ ΔΕΝ ΕΙΝΑΙ ΕΝΙΑΙΕΣ

### Τα 2 προβλήματα (Giorgio screenshots 2026-06-13 151127 + 151222)

**Πρόβλημα Α — ΟΧΙ ομοεπίπεδα (151127, κάτω όψη):** ο σοβάς του **δοκαριού** προεξέχει/δεν είναι στο ίδιο επίπεδο με τον σοβά του **υποκείμενου τοίχου**. Σκαλοπάτι στη συνέχεια της επιφάνειας (κόκκινα βέλη κατά μήκος).

**Πρόβλημα Β — δεν ενώνονται οι γωνίες (151222, άνω όψη):** στις γωνίες της συμβολής, ο σοβάς της **κολόνας** (mitered γωνίες) και ο σοβάς του **δοκαριού** (square/chamfered άκρο) **δεν συνδέονται** — διαφορετική μεταχείριση γωνίας → κενό/ασυνέχεια (κόκκινοι κύκλοι).

### ROOT CAUSE (διάγνωση)
Ο σοβάς υπολογίζεται **per-element, ανεξάρτητα**, με **τοπική** μεταχείριση γωνίας (miter για κολόνα-γωνίες, chamfer για beam-άκρα, square για wall-gaps). Στις **διεπαφές ΜΕΤΑΞΥ διαφορετικών στοιχείων** (δοκάρι↔τοίχος, δοκάρι↔κολόνα):
- κάθε στοιχείο offset-άρει από το **δικό του** footprint με **δικό του** reference → όχι ομοεπίπεδα (Α),
- κάθε στοιχείο κλείνει τη γωνία **μόνο του** (miter vs chamfer vs square) → δεν συναντιούνται (Β).

Είναι θεμελιώδες όριο του per-element μοντέλου. Τα τοπικά fixes (#3 chamfer) δεν αρκούν — γι' αυτό ο Giorgio ζητά **Revit-grade ενιαία λύση**.

### Η REVIT-GRADE FULL-SSOT ΛΥΣΗ (recommended target): **MERGED STRUCTURAL SILHOUETTE OFFSET**

Αντί για per-element bands, ο σοβάς = **συνεχές outward offset της ΕΝΩΣΗΣ των footprints** όλων των δομικών στοιχείων που συνυπάρχουν σε κάθε **ζώνη ύψους**:

1. **Height-band decomposition** (γενίκευση του `computeColumnFinishBands`): σπάσε το ύψος σε z-διαστήματα όπου το σύνολο των παρόντων στοιχείων είναι σταθερό. Κάθε στοιχείο συνεισφέρει το footprint του στο band που καταλαμβάνει: κολόνα (όλο το ύψος), δοκάρι (ζώνη depth στην κορυφή), τοίχος (ύψος του), foundation κ.λπ.
2. **Union silhouette** ανά band: `safeUnion` (SSoT `bim/geometry/shared/safe-polygon-boolean.ts` — ΗΔΗ σε χρήση από building-footprint/foundation-grid-boq/column-adjacency) → ΕΝΑ πολύγωνο (με holes) = η σιλουέτα του συνολικού δομικού σώματος στο band.
3. **Outward offset** της σιλουέτας κατά το πάχος σοβά → ΕΝΑ συνεχές «δέρμα» (reuse `dilatePolygonOutward` ή ο resolver με obstacles=∅ πάνω στη σιλουέτα).
4. **Αποτέλεσμα — λύνει ΚΑΙ τα δύο εγγενώς:**
   - **Α (ομοεπίπεδα):** δοκάρι+τοίχος+κολόνα = ΙΔΙΟ offset της ΙΔΙΑΣ σιλουέτας → coplanar by construction.
   - **Β (γωνίες):** ΕΝΑ πολύγωνο → όλες οι γωνίες mitered συνεπώς, μηδέν ασυνέχεια.
   - Junction (frame-into) = **εσωτερικό** της ένωσης → κανένας σοβάς εκεί (subsumes mutual-obstacle + height-aware + chamfer σε ΕΝΑ SSoT).

### ΔΥΣΚΟΛΙΕΣ / αποφάσεις (πάρε τις Revit-grade)
- **Per-material attribution:** η ενιαία σιλουέτα χάνει το «ποια ακμή ανήκει σε ποιο στοιχείο/υλικό». Χρειάζεται map κάθε offset-ακμής → source element (nearest-edge / origin tagging) για το σωστό υλικό (plaster-int/ext) + exterior/interior classifier (ΗΔΗ building-footprint based). Revit: material per face.
- **BOQ attribution:** το BOQ μετρά ανά στοιχείο (κολόνα/δοκάρι ξεχωριστές γραμμές). Με ενιαία σιλουέτα, η επιφάνεια πρέπει να αποδοθεί πίσω στα στοιχεία (π.χ. ανά ακμή→origin element × band-height). ΜΗΝ χαλάσεις τις ξεχωριστές BOQ γραμμές.
- **Phasing (πρόταση):** Φ1 3D-only ενιαία σιλουέτα (visual fix Α+Β) κρατώντας το per-element BOQ ως έχει (banded area)· Φ2 unify BOQ/2D αν χρειαστεί. Έτσι το 3D διορθώνεται χωρίς ρίσκο στο BOQ.
- **Performance:** union per band per frame = ακριβό. Lazy (μόνο finish-active)· cache ανά scene-signature· spatial grouping (μόνο γειτονικά στοιχεία). v1 ΟΚ, optimize αν χρειαστεί.
- **Εναλλακτική (λιγότερο ρίσκο, λιγότερο «Revit»):** κράτα per-element ΑΛΛΑ πρόσθεσε **junction-resolver** που (α) ευθυγραμμίζει το offset reference όλων των στοιχείων (κοινό plaster-face datum → coplanar) και (β) ενιαίο corner-join (miter) ανάμεσα σε segments ΔΙΑΦΟΡΕΤΙΚΩΝ στοιχείων που συναντιούνται. Πιο εύκολο BOQ, αλλά δεν είναι τόσο καθαρό SSoT όσο η σιλουέτα.

**Σύσταση:** ξεκίνα PHASE 1 RECOGNITION (διάβασε τα παρακάτω), μετά Plan Mode με ΣΑΦΗ πρόταση (σιλουέτα Φ1 3D-only) για έγκριση Giorgio ΠΡΙΝ γράψεις κώδικα.

### SSoT touchpoints (PHASE 1 RECOGNITION — διάβασέ τα ΠΡΩΤΑ)
1. `bim/finishes/structural-finish-resolver.ts` — pure per-face resolver (obstacles/classify/includeEdge). Πιθανώς θα γίνει consumer της σιλουέτας ή θα μείνει για το per-element BOQ.
2. `bim/finishes/structural-finish-scene.ts` — adapter· `computeColumnFinishFaces/Bands`, `computeBeamFinishFaces`, contributions· `BeamFinishObstacle`/`ColumnFinishObstacle`. **ΕΔΩ μπαίνει το silhouette SSoT** (π.χ. `computeStructuralFinishSilhouette(elements, band)`).
3. `bim/geometry/shared/safe-polygon-boolean.ts` (`safeUnion`/difference) + `polygon-utils.ts` + `polygon-dilate.ts` — geometry SSoT για union+offset. **REUSE, ΜΗΝ διπλασιάσεις.**
4. `bim-3d/converters/structural-finish-3d.ts` — `buildFinishSkinFromFaces`, `computeMiteredOuter`, `chamferOpenOuterEnds`, `buildColumnFinishSkin`/`buildBeamFinishSkin`. Με σιλουέτα → ένα build από το offset ring.
5. `bim-3d/converters/bim-three-structural-converters.ts` — `columnToMesh`/`beamToMesh`/`composeColumnWithFinish` (MIXED ADR-448/441). Καλεί per-element· με σιλουέτα ίσως χρειαστεί scene-level pass (ΟΧΙ per-element) → δες `BimSceneLayer.ts` orchestration.
6. `bim-3d/scene/BimSceneLayer.ts` + `bim-scene-attach-syncs.ts` (MIXED) — εδώ συγκεντρώνονται entities.walls/beams/columns· φυσικό σημείο για scene-level silhouette pass.
7. **Πρόβλημα Α (wall coplanarity):** ΕΡΕΥΝΗΣΕ πώς γεννιέται ο σοβάς ΤΟΙΧΟΥ — ADR-449 skin ή multi-layer wall (ADR-416)? Αν διαφορετικό σύστημα → εκεί η μη-ομοεπιπεδότητα. Η σιλουέτα ενοποιεί ΜΟΝΟ αν ο τοίχος μπει στο union (πρόσθεσε wall footprint στη σιλουέτα).
8. 2D: `canvas-v2/dxf-canvas/dxf-renderer-frame-builders.ts` (`buildFinishFacesByColumn/Beam`) + `ColumnRenderer`/`BeamRenderer` outline. ADR-040: αν αγγίξεις DxfRenderer/renderer/composite → STAGE ADR-040 changelog (CHECK 6B/6D).
9. BOQ: `hooks/data/column-boq-feed.ts` + `beam-boq-feed.ts` + `structural-finish-boq.ts`.

### Tests
- silhouette/union: δοκάρι+τοίχος ομοαξονικά → ΕΝΑ συνεχές offset (coplanar)· κολόνα+δοκάρι → ΕΝΑ πολύγωνο, mitered γωνίες, μηδέν junction-plaster εσωτερικά.
- regression: μεμονωμένο στοιχείο → ίδιο με πριν· BOQ ξεχωριστές γραμμές ακέραιες.
- ΕΝΑ tsc τη φορά (N.17 — έλεγξε running tsc πρώτα).

### DEFER (μετά το Slice 7)
- «Μερικά δοκάρια χωρίς σοβά» (Giorgio screenshot 143918) — ΑΝΟΙΧΤΟ· πιθανό short perimeter beams πλήρως cut από column-obstacle, ή legacy/grid beams χωρίς finish spec. Χρειάζεται identification ποιων δοκαριών (κλικ → finish.enabled?).
- Beam soffit (κάτω-όψη) από κορυφές τοίχων· retroactive backfill παλιών στοιχείων· elevation-based banding (sloped/offset beams)· per-corner sloped finish σε attached κολόνα 3D.

---

## ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
Ελληνικά. **ΟΧΙ commit/push (ο Giorgio).** **ΟΧΙ `git add -A`** (shared tree). ΟΧΙ `--no-verify`. **git add ΜΟΝΟ δικά σου αρχεία.** MIXED αρχεία (bim-three-structural-converters, BimSceneLayer, bim-scene-attach-syncs) → άγγιξε ΜΟΝΟ δικές σου γραμμές, μην καθαρίσεις ξένες. **ΕΝΑ tsc τη φορά** (N.17). N.7.1 (40 γρ./func, 500 γρ./file). ADR-driven (PHASE 1 RECOGNITION → Plan Mode έγκριση → impl → ADR-449 §changelog + adr-index + local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt + MEMORY στο ίδιο commit). **FULL ENTERPRISE + FULL SSOT — ΕΝΟΠΟΙΗΣΕ μέσω σιλουέτας/union, ΜΗ διπλασιάσεις.**

**Resume pointers:**
- ADR: `docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md` (§3.sexies + §6 changelog, fixes #1/#2/#3).
- MEMORY: `~/.claude/projects/C--Nestor-Pagonis/memory/project_adr449_structural_finish_skin.md`.
- Tracker: `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (γραμμή ADR-449).
- Screenshots προβλημάτων: `Στιγμιότυπο οθόνης 2026-06-13 151127.jpg` (Α coplanar) + `...151222.jpg` (Β corners).
- Git: committed μέχρι ~b994b4c1· κάποια fixes Slice 6 ακόμη uncommitted (ADR-449.md, structural-finish-3d.ts, bim-three-structural-converters.ts, 2 test files) — ο Giorgio θα τα κάνει commit.
- Polygon SSoT: `bim/geometry/shared/safe-polygon-boolean.ts` (`safeUnion`), `polygon-dilate.ts`, `segment-polygon-coverage.ts`.
