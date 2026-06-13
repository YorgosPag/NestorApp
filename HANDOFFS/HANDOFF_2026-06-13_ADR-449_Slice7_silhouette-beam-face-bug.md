# HANDOFF — ADR-449 Slice 7 (merged structural silhouette): ΑΝΟΙΧΤΟ bug «σοβάς δοκαριού σε ΜΙΑ όψη»

**Ημερομηνία:** 2026-06-13
**Από:** Opus session (Slice 7 silhouette + winding/un-dilate/hole fixes) → **Προς:** νέα session
**Working tree:** SHARED με άλλον agent. **Commit:** ΜΟΝΟ ο Giorgio (N.(-1)). ΠΟΤΕ `git add -A`/`--no-verify`. **git add ΜΟΝΟ δικά σου.** **Ελληνικά πάντα.**
**Quality bar:** FULL ENTERPRISE + FULL SSOT, Revit-grade. Παίρνεις εσύ τις professional αποφάσεις, ζητάς έγκριση plan.

---

## ΜΕΡΟΣ Α — ΤΙ ΕΓΙΝΕ (Slice 7, UNCOMMITTED, 72/72 ADR-449 jest)

**Στόχος Slice 7:** ΕΝΙΑΙΟΣ σοβάς στις συμβολές. 2 αρχικά προβλήματα (Giorgio screenshots 151222 + 151127):
- **Β (γωνίες):** στη συμβολή κολόνα↔δοκάρι ο σοβάς δεν ενώνεται. → **✅ ΛΥΘΗΚΕ** από το ενιαίο `safeUnion` (ένα outline → συνεπής miter).
- **Α (σκαλοπάτι δοκάρι↔τοίχος):** → **απόφαση big-player (Revit/ArchiCAD):** immutable δομική διατομή + **additive-outward** σοβάς, ΠΟΤΕ recess/bury. Ομοεπιπεδότητα = ευθύνη διαστάσεων αρχιτέκτονα (στενότερο δοκάρι → φυσικά coplanar· ίδιο πλάτος → ειλικρινώς proud). **Δεν χρειάζεται ειδικός κώδικας** — η αρχική ADR-449 σύμβαση είναι η σωστή.

**Αρχιτεκτονική (ΕΝΑ scene-level pass):**
- NEW `bim/finishes/structural-finish-silhouette.ts` (pure): `computeStructuralSilhouetteBands(input)` — height-band decomposition + ανά band `safeUnion` δομικών cores → **ΟΛΑ τα rings** (poly[0] outer + poly[1..] holes) → `resolveStructuralFinishFaces` → merged faces. **additive-outward**.
- NEW `bim-3d/converters/structural-finish-silhouette-3d.ts`: `buildStructuralSilhouetteSkin` (REUSE `buildFinishSkinFromFaces`).
- `structural-finish-scene.ts`: NEW `computeStructuralFinishSilhouette(columns, beams, walls, floorElevationMm)` scene adapter (z-extents building-relative· wall obstacles **un-dilated**· classifier· default spec) + exports `buildStructuralFinishClassifier`/`wallFootprintPolygon`.
- `structural-finish-3d.ts`: export `buildFinishSkinFromFaces`.
- `structural-finish-resolver.ts`: `ensureCCW`→`orientRing(poly, holeRing)` + `FinishResolveInput.holeRing?` (hole→CW, σοβάς προς το δωμάτιο). **Solid default = byte-for-byte** (per-element ανέγγιχτο).
- `BimSceneLayer.ts` (MIXED): NEW `syncStructuralFinishSkin()` (group ανά κτίριο=baseElevation). `bim-three-structural-converters.ts` (MIXED): `columnToMesh`/`beamToMesh` `+suppressFinishSkin`. `bim-scene-attach-syncs.ts` (MIXED): `syncColumns` περνά true.

**3 fixes που έγιναν στην πορεία (όλα uncommitted):**
1. **Winding fix:** `polygon-clipping` winding-sensitive — CW beam outline (`buildOutlineRect`) = τρύπα → `safeUnion` δεν ένωνε. FIX: `footprintToPolygon` CCW-normalise (shoelace) πριν το union. +regression test.
2. **Un-dilate fix:** είχα dilate-άρει τους τοίχους-obstacles (10mm) για το Α → στο grid model (δοκάρια collinear πάνω σε τοίχους) κάλυπτε ΟΛΗ την πλάγια όψη → σοβάς εξαφανιζόταν. REVERT σε **un-dilated** τοίχους.
3. **Inward-align A-fix → ΑΝΑΙΡΕΘΗΚΕ:** δοκίμασα shift segment inward ώστε outer στην όψη τοίχου → **έθαβε** τον σοβά μέσα στον συμπαγή πυρήνα (Giorgio «χάνονται μέσα στο σώμα»). Διαγνώστηκε σωστά από Giorgio: τοίχος=σοβάς ΜΕΣΑ στο ονομαστικό (DNA), δοκάρι=σοβάς ΕΞΩ (additive). → big-player απόφαση = additive-outward (βλ. Α παραπάνω).
4. **Hole fix:** frame δοκαριών → `safeUnion` δίνει πολύγωνο **με τρύπα** (δωμάτιο)· επεξεργαζόμουν μόνο `poly[0]` → inner όψεις αγνοούνταν. FIX: loop ΟΛΑ τα rings + `holeRing` flag.

---

## ΜΕΡΟΣ Β — ΤΟ ΑΝΟΙΧΤΟ BUG (η δουλειά σου)

**Συμπτώματα (Giorgio, διαδοχικά μετά από κάθε fix):**
1. (πριν hole fix) «2 όμορα δοκάρια σοβά μόνο εξωτερικά, 2 διαγώνια καθόλου».
2. (μετά hole fix) «ΤΩΡΑ ΕΧΟΥΝ ΟΛΑ ΣΟΒΑ ΜΟΝΟΝ ΑΠΟ ΤΗΝ ΜΙΑ ΠΛΕΥΡΑ. Άλλα από τη ΜΕΣΑ, άλλα από την ΕΞΩ.»
3. **Giorgio insight (κρίσιμο):** «Ίσως έχει σημασία ποια θεωρεί το πρόγραμμα εξωτερική και ποια εσωτερική πλευρά. Μήπως άλλα δοκάρια έχουν την εσωτερική όψη εξωτερικά και την εξωτερική εσωτερικά;»

**Διάγνωση μέχρι τώρα:** Έτρεξα διαγνωστικό με **κλειστό πλαίσιο** (4 δοκάρια annulus [0,100]² τρύπα [30,70]²) → η σιλουέτα δίνει **ΣΩΣΤΑ και τις 8 όψεις**: 4 outer (normals προς τα έξω) + 4 inner (normals προς το κέντρο/δωμάτιο). **Κάθε δοκάρι παίρνει ΚΑΙ τις δύο όψεις.** Άρα **το bug ΔΕΝ αναπαράγεται σε κλειστό πλαίσιο** — εξαρτάται από την **πραγματική τοπολογία** της σκηνής του Giorgio.

**Υποθέσεις προς διερεύνηση (χρειάζεται screenshot/scene data ΠΡΩΤΑ):**
- **Ανοιχτή τοπολογία** (όχι κλειστό δωμάτιο): αν τα δοκάρια δεν σχηματίζουν κλειστό loop, η `safeUnion` δεν δημιουργεί τρύπα → μόνο το outer ring → κάθε δοκάρι παίρνει ΜΙΑ όψη (την outward-facing του union). Διαφορετικά δοκάρια → διαφορετική φορά → «άλλα μέσα, άλλα έξω». **Πιθανότατα ΑΥΤΟ.**
- **Δοκάρια πάνω σε τοίχους** (grid ADR-441): οι τοίχοι ως obstacles ίσως κόβουν μία όψη ασύμμετρα.
- **Διαφορετικά z** (topElevation) ανά δοκάρι → δεν ενώνονται στο ίδιο band.
- **Giorgio's swap υπόθεση:** classification exterior/interior επηρεάζει το ΥΛΙΚΟ (plaster-int/ext χρώμα), ΟΧΙ την παρουσία. Αν το πρόβλημα είναι παρουσία (μία όψη χωρίς σοβά), είναι **γεωμετρικό** (ποια ακμή στο union boundary), όχι classification.

**ΣΥΣΤΑΣΗ (η professional άποψή μου):** Η προσέγγιση **σιλουέτας** δίνει σοβά μόνο στις όψεις που είναι στο **union boundary** — εξαρτάται από τοπολογία, γι' αυτό εμφανίζονται διαρκώς edge-cases. Η **per-element** προσέγγιση (Slice 6) έδινε **αξιόπιστα ΚΑΙ τις δύο πλάγιες όψεις** κάθε δοκαριού (`includeEdge` = 2 ακμές ∥ άξονα), με μόνο μειονέκτημα τις γωνίες. Σκέψου σοβαρά:
- **(Α) Revert δοκαριών σε per-element** (Slice 6, αξιόπιστες 2 όψεις) + σιλουέτα ΜΟΝΟ για corner-join κολόνας↔δοκαριού (ή accept Slice 6 chamfer). **Πιο αξιόπιστο.**
- **(Β) Κράτα σιλουέτα** + debug την πραγματική τοπολογία (χρειάζεται screenshot + ποια δοκάρια, αν κλείνουν δωμάτιο, αν είναι πάνω σε τοίχους). Πιθανό: αν είναι ανοιχτό πλαίσιο, η σιλουέτα **εγγενώς** δίνει μία όψη → χρειάζεται per-element fallback για τις μη-boundary όψεις.

**ΠΡΩΤΟ ΒΗΜΑ:** Ζήτα από Giorgio **screenshot 3D/2D της διάταξης** + απάντηση: τα δοκάρια **κλείνουν δωμάτιο** (loop) ή είναι **ανοιχτή/γραμμική** διάταξη; Είναι **πάνω σε τοίχους**; Μετά PHASE 1 RECOGNITION (διάβασε τα παρακάτω) → Plan Mode.

---

## SSoT touchpoints (PHASE 1 RECOGNITION — διάβασέ τα ΠΡΩΤΑ)
1. `bim/finishes/structural-finish-silhouette.ts` — `resolveBandFaces` (loop rings + holeRing)· `unionFootprints` (CCW-normalise)· band decomposition. **ΕΔΩ ζει το bug αν είναι silhouette-side.**
2. `bim/finishes/structural-finish-resolver.ts` — `orientRing(poly, holeRing)` + `resolveStructuralFinishFaces`. Το `includeEdge` (per-element beams) ΔΕΝ χρησιμοποιείται από τη σιλουέτα → όλες οι ακμές outline (ends δοκαριών συμπεριλαμβ.).
3. `bim/finishes/structural-finish-scene.ts` — `computeStructuralFinishSilhouette` (members z-extents· wall obstacles un-dilated)· `computeBeamFinishFaces`/`buildBeamFinishSkin` (per-element path, αν γίνει revert).
4. `bim-3d/converters/structural-finish-3d.ts` — `buildFinishSkinFromFaces` (offset outward + miter)· `buildBeamFinishSkin`/`buildColumnFinishSkin` (per-element).
5. `bim-3d/converters/bim-three-structural-converters.ts` (MIXED) — `suppressFinishSkin` flag (αν revert → δώσε false στα δοκάρια).
6. `bim-3d/scene/BimSceneLayer.ts` (MIXED) — `syncStructuralFinishSkin` + `syncBeams` (suppressFinishSkin=true).
7. `bim/geometry/beam-geometry.ts` `buildOutlineRect` — beam outline winding (CW).

## Tests
- `bim/finishes/__tests__/structural-finish-silhouette.test.ts` (10): union/merge/winding-CW/hole-frame/band/additive-outward.
- ΕΝΑ tsc τη φορά (N.17 — έλεγξε running tsc ΠΡΩΤΑ· στο τέλος αυτής της session έτρεχαν 2 tsc άλλων agents → SKIP, ts-jest validated).

## Git (UNCOMMITTED — git add ΜΟΝΟ δικά σου)
NEW: `structural-finish-silhouette.ts`, `structural-finish-silhouette-3d.ts`, `__tests__/structural-finish-silhouette.test.ts`.
MOD: `structural-finish-scene.ts`, `structural-finish-3d.ts`, `structural-finish-resolver.ts`, `bim-three-structural-converters.ts`[MIXED], `BimSceneLayer.ts`[MIXED], `bim-scene-attach-syncs.ts`[MIXED], `ADR-449.md`, `adr-index.md`, `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`, MEMORY `project_adr449_structural_finish_skin.md`.
⚠️ Άλλος agent έχει stage-άρει/commit-άρει στο shared tree (ADR-401/452, section-stencil, persist-serializer) — πιθανό git add -A έπιασε & δικά μου. **Μην ξεστάρεις/commit-άρεις ξένα.**

## ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
Ελληνικά. ΟΧΙ commit/push (Giorgio). ΟΧΙ git add -A. ΟΧΙ --no-verify. git add ΜΟΝΟ δικά σου. MIXED → μόνο δικές σου γραμμές. ΕΝΑ tsc τη φορά (N.17). N.7.1 (40γρ/func, 500γρ/file). Αν αγγίξεις DxfRenderer/renderer/composite → STAGE ADR-040. **Ζήτα screenshot ΠΡΙΝ γράψεις κώδικα** (μάθημα [[feedback_confirm_repro_before_reimplementing]]: «δεν δουλεύει»→ζήτα ακριβές repro).

**Resume pointers:** ADR `docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md` (§3.septies + §6 changelog). MEMORY `~/.claude/projects/C--Nestor-Pagonis/memory/project_adr449_structural_finish_skin.md`. Tracker `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (γραμμή ADR-449).
