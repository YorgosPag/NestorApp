# HANDOFF — ADR-449: συνέπεια στις ΕΝΩΣΕΙΣ σοβά δοκαριού↔κολόνας (miter vs κάθετη κοπή)

**Ημερομηνία:** 2026-06-13
**Από:** Opus session (Slice 7-revert + Slice 8 + Slice 8b «μία όψη μόνο» fix) → **Προς:** νέα session
**Working tree:** ΜΟΙΡΑΖΕΤΑΙ με άλλον agent (ADR-452 cut-plane). **Commit:** ΜΟΝΟ ο Giorgio (N.(-1)). ΠΟΤΕ `git add -A`/`--no-verify`. **git add ΜΟΝΟ δικά σου.** **Ελληνικά πάντα.**
**Quality bar:** FULL ENTERPRISE + FULL SSOT, Revit-grade. Παίρνεις εσύ τις professional αποφάσεις, ζητάς έγκριση plan.

---

## ΜΕΡΟΣ Α — ΤΙ ΕΓΙΝΕ (ολοκληρωμένο, εκκρεμεί browser-verify + commit)

### A1. Slice 8b — «σοβάς δοκαριού σε ΜΙΑ μόνο όψη όταν μπαίνουν τοίχοι» → **ΛΥΘΗΚΕ** (diagnosed από Firestore)
- **Αιτία (από πραγματικά Firestore records):** οι born-from-grid τοίχοι είναι **`topBinding:'attached'`** (`attachTopToIds:[beam]`) = **στηρίγματα** που η κορυφή τους κουμπώνει στην **κάτω παρειά** του δοκαριού (z=2500, ΟΧΙ nominal `baseOffset+height`=3000). + ίδιο πλάτος (250) + ίδιος άξονας → οι **πλάγιες όψεις δοκαριού ΣΥΜΠΙΠΤΟΥΝ** με τις παρειές τοίχου (beam x=10.666/10.916 == wall outerEdge/innerEdge). Coincident faces → point-in-polygon ray-casting μετρά τη ΜΙΑ συμπίπτουσα παρειά «μέσα»(covered)/άλλη «έξω»(exposed) → ακριβώς **1 όψη** χάνει σοβά, συστηματικά.
- **FIX:** ο `wallsOverlappingBeamBand` (στο `structural-finish-scene.ts`) εξαιρεί τοίχους `topBinding==='attached'` (resolved top = beam underside ≤ κάτω παρειά → ποτέ obstacle· το δοκάρι είναι ολόκληρο από πάνω). Μη-attached full-height crossing walls παραμένουν obstacles (γνήσιο coverage).
- **Slice 8 (προηγηθέν, ΗΔΗ committed):** height-aware wall coverage (`wallsOverlappingBeamBand` vertical-overlap test) + `floorElevationMm` threaded 3D (`BimSceneLayer.syncBeams`→`beamToMesh`→`buildBeamFinishSkin`). Χρειάζεται για non-attached.
- 73/73 ADR-449 jest. Αφαιρέθηκε προσωρινό console diagnostic (λύθηκε από Firestore, δεν χρειάστηκε).

### A2. Slice 7-revert (ΗΔΗ committed στο af2938f2) — merged silhouette → **dormant**
- Η ενιαία silhouette έδινε σοβά μόνο σε union-boundary όψεις → σε ανοιχτή τοπολογία 1 όψη/δοκάρι. Έγινε **dormant** πίσω από `STRUCTURAL_SILHOUETTE_ENABLED=false` (`bim-scene-structural-finish-sync.ts`). Ενεργό path = **per-element (Slice 6)**: κάθε δοκάρι/κολόνα → δικό του skin (`columnToMesh`/`beamToMesh` `suppressFinishSkin=false`). Ο silhouette κώδικας + 10 jest κρατήθηκαν ζωντανά (flag-gated) για μελλοντικό **corner-join-only** slice.

### A3. Git status (ΑΚΡΙΒΩΣ)
- **ΗΔΗ COMMITTED** (από παράλληλο agent `git add -A`, commit `af2938f2 feat(dxf): ADR-452 cut-plane perf + ADR-449 finish skin`): `bim-scene-structural-finish-sync.ts` (silhouette dormant flag), `BimSceneLayer.ts` (beam suppress=false + floorElevationMm), `bim-scene-attach-syncs.ts` (column suppress=false), `bim-three-structural-converters.ts` (beamToMesh +floorElevationMm), `structural-finish-3d.ts` (buildBeamFinishSkin +floorElevationMm). ⚠️ Δεν τα commit-άρισα ΕΓΩ.
- **UNCOMMITTED — δικά μου, χρειάζονται commit (Giorgio):**
  - `src/subapps/dxf-viewer/bim/finishes/structural-finish-scene.ts` ← **το Slice 8b fix** (`wallsOverlappingBeamBand` attached-top exclusion + `BeamFinishSource` Pick += topElevation/depth/zOffset + `beamDepthBandMm`). ⚠️ έχει ΚΑΙ linter/user exports (MM_TO_M/EXTERIOR_EDGE_TOL_MM/toPt2 → `export`) — κράτα τα.
  - `src/subapps/dxf-viewer/bim/finishes/__tests__/structural-finish-scene-beam.test.ts` (height-aware + attached-top tests, 14 it).
  - `docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md` (changelog Slice 8/8b + status + §3.septies revert banner).
  - `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` = **gitignored** (local-only, δεν μπαίνει σε commit).
- ⚠️ ΑΛΛΑ uncommitted αρχεία στο tree (ADR-452: ThreeJsSceneManager/scene-render-frame/section-*/BimViewport3D, origin-object-diagnostic) = **ΑΛΛΟΥ agent — ΜΗΝ τα αγγίξεις/commit-άρεις**.
- 🔴 **Πριν commit:** browser-verify (hard-refresh) ότι τα δοκάρια έχουν σοβά **2 πλευρές** με τοίχους-στηρίγματα από κάναβο.

---

## ΜΕΡΟΣ Β — Η ΔΟΥΛΕΙΑ ΣΟΥ (νέο θέμα): συνέπεια ΕΝΩΣΕΩΝ σοβά δοκαριού↔κολόνας

**Πρόβλημα (Giorgio):** Στα σημεία όπου ενώνονται οι σοβάδες δοκαριών με κολόνες, **ΑΛΛΟΥ υπάρχει miter (φαλτσογωνιά), ΑΛΛΟΥ κάθετη κοπή** — ασυνεπές. Θέλουμε **συνεπή** μεταχείριση γωνίας σε όλες τις συμβολές.

**Γιατί συμβαίνει (αρχική ανάλυση — επιβεβαίωσέ τη):**
- Ο σοβάς είναι **per-element** (κάθε δοκάρι/κολόνα = ξεχωριστό mesh, Slice 6). Δεν υπάρχει ενιαίο outline στις συμβολές (η silhouette που θα το έλυνε είναι **dormant**, ΜΕΡΟΣ Α2).
- `computeMiteredOuter` (στο `bim-3d/converters/structural-finish-3d.ts`) κάνει miter **ΜΟΝΟ** ανάμεσα σε **διαδοχικές ακμές που μοιράζονται κορυφή ΜΕΣΑ στο ΙΔΙΟ outline** (π.χ. γωνίες κολόνας). Στο δοκάρι, τα 2 side faces ΔΕΝ μοιράζονται κορυφή (τα άκρα ⊥ αποκλείστηκαν από `includeEdge`) → είναι **open ends** → `chamferOpenOuterEnds` (45°, μόνο για `bimType==='beam'`). Η κολόνα: open ends = **square** (κάθετη κοπή).
- Στη συμβολή δοκαριού↔κολόνας, δύο **ξεχωριστά** meshes συναντιούνται: το chamfered (45°) άκρο δοκαριού + η square/mitered παρειά κολόνας. Ανάλογα τη γεωμετρία → άλλοτε μοιάζει miter, άλλοτε κάθετη κοπή → **ασυνέπεια**.

**Πιθανές κατευθύνσεις (αποφάσισε εσύ, Revit-grade, ζήτα έγκριση plan):**
1. **Corner-join-only silhouette** (το DEFER από Slice 7): ξανα-ενεργοποίησε τη silhouette **ΜΟΝΟ** για corner-fill σφήνες στις συμβολές (ΟΧΙ τις πλάγιες όψεις — αυτές μένουν per-element, αλλιώς διπλο-σοβάτισμα). `STRUCTURAL_SILHOUETTE_ENABLED` flag υπάρχει.
2. **Συνεπές per-element corner treatment** στις συμβολές: ενοποίησε miter/chamfer ώστε δοκάρι↔κολόνα να κλείνουν πάντα ίδια (π.χ. πάντα miter, ή πάντα 45°).
3. Άλλο, αν η Firestore διάγνωση δείξει κάτι διαφορετικό.

**ΜΕΘΟΔΟΣ ΠΟΥ ΔΟΥΛΕΨΕ (χρησιμοποίησέ την):** Firestore baseline + σταδιακή δημιουργία.
- Ο Giorgio έσβησε τις 3 collections → **baseline = 0/0/0** (επιβεβαιωμένο).
- Ο Giorgio θα δημιουργεί οντότητες από κάναβο σταδιακά· **εσύ διάβασε τα πραγματικά records** με τα Firestore MCP tools (`mcp__firestore__firestore_query` collection `floorplan_beams`/`floorplan_walls`/`floorplan_columns`).
- **Scope (από προηγούμενο baseline):** company `comp_9c7c1a50-…`, project `proj_1d45b55b-…`, floorplan `file_f6b1782f-…`, floor `flr_4e7868ba-…`. (Μπορεί να αλλάξει — επιβεβαίωσε από τα νέα records.)
- **ΜΑΘΗΜΑ:** μην μαντεύεις γεωμετρία — διάβασε τα records (params: startPoint/endPoint/width/depth/topElevation/zOffset/finish/**topBinding**/attachTopToIds· wall outerEdge/innerEdge/thickness). Η Firestore-first μέθοδος έλυσε ό,τι 4 γύροι υποθέσεων δεν έλυσαν.

---

## PHASE 1 RECOGNITION — διάβασε ΠΡΩΤΑ
1. `bim-3d/converters/structural-finish-3d.ts` — `computeMiteredOuter` (miter σε shared vertex· miter-limit ×4)· `chamferOpenOuterEnds` (45° beam open ends)· `buildFinishSkinFromFaces` (per-element πυρήνας· `chamferOpenEnds = bimType==='beam'`)· `buildBeamFinishSkin`/`buildColumnFinishSkin`.
2. `bim/finishes/structural-finish-scene.ts` — `computeBeamFinishFaces` (includeEdge κρατά 2 πλάγιες όψεις, αποκλείει άκρα ⊥)· `computeColumnFinishBands` (height-aware junction)· `wallsOverlappingBeamBand` (Slice 8/8b)· mutual obstacles (`crossObstaclePolygon` + `STRUCTURAL_JOIN_TOL_MM=10`).
3. `bim/finishes/structural-finish-resolver.ts` — `resolveStructuralFinishFaces` (exposed sub-edges + classify· `orientRing`· `includeEdge`· `holeRing`).
4. `bim/finishes/structural-finish-silhouette.ts` (dormant) + `bim-3d/scene/bim-scene-structural-finish-sync.ts` (`STRUCTURAL_SILHOUETTE_ENABLED`) — αν πας direction 1.
5. ADR `docs/centralized-systems/reference/adrs/ADR-449-structural-finish-skin.md` (§3.septies + changelog Slice 6/7/8/8b).
6. MEMORY `~/.claude/projects/C--Nestor-Pagonis/memory/project_adr449_structural_finish_skin.md` (πλήρες ιστορικό slices + μαθήματα).

## Tests
- `bim/finishes/__tests__/structural-finish-scene-beam.test.ts` (14) · `structural-finish-junction.test.ts` · `structural-finish-3d-beam.test.ts` · `structural-finish-3d.test.ts` (chamfer/miter units) · `structural-finish-silhouette.test.ts` (10).
- Τρέξε: `npx jest src/subapps/dxf-viewer/bim/finishes src/subapps/dxf-viewer/bim-3d/converters/__tests__/structural-finish` (73 jest).
- ΕΝΑ tsc τη φορά (N.17 — έλεγξε running tsc ΠΡΩΤΑ).

## ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
Ελληνικά. ΟΧΙ commit/push (Giorgio· N.(-1)). ΟΧΙ `git add -A`. ΟΧΙ `--no-verify`. git add ΜΟΝΟ δικά σου. MIXED files → μόνο δικές σου γραμμές. ΕΝΑ tsc τη φορά (N.17). N.7.1 (40γρ/func, 500γρ/file). Αν αγγίξεις DxfRenderer/renderer/composite (2D) → STAGE ADR-040. Firestore-first διάγνωση. Ζήτα έγκριση plan πριν γράψεις κώδικα (μάθημα [[feedback_confirm_repro_before_reimplementing]]).
