# HANDOFF — ADR-449 Structural Finish Skin (σοβάς), Slice 6: ΣΥΝΔΕΣΗ ΔΟΚΑΡΙΟΥ↔ΚΟΛΩΝΑΣ (no plaster at junction)

**Ημερομηνία:** 2026-06-13
**Από:** Opus session (Slice 5 + browser-fixes #1/#3) → **Προς:** νέα session
**Working tree:** SHARED με άλλον agent (ADR-448 Storey-Aware + ADR-441/401 framing). **Commit:** ΜΟΝΟ ο Giorgio (όχι ο agent). Ποτέ `git add -A`, ποτέ `--no-verify`. **Ελληνικά πάντα.**
**Quality bar:** **FULL ENTERPRISE + FULL SSOT, όπως Revit/big-player.** Παίρνεις εσύ τις professional αποφάσεις (Revit-grade), ζητάς μόνο έγκριση plan. **ΜΗ διπλασιάζεις — ΕΠΕΚΤΕΙΝΕ/ΓΕΝΙΚΕΥΣΕ υπάρχοντα SSoT.**

---

## ΜΕΡΟΣ Α — ΤΙ ΕΓΙΝΕ (Slice 5 + fixes, DONE + COMMITTED)

**Όλα committed** (μέχρι `a9b6f3b8 feat(dxf): ADR-449 finish-skin 3D converter follow-up`). Working tree καθαρό για ADR-449. 76/76 ADR-449 jest + tsc καθαρό.

### Slice 5 — toggle + ενεργοποίηση + per-element override (browser-verified)
- **Master view toggle «Σοβατισμένη Όψη»** = scalar `showFinishSkin` στο `config/bim-render-settings-types.ts` + `state/bim-render-settings-store.ts` (mirror `showHeatLoad`, **default ON**). UI `ui/ribbon/components/ShowFinishSkinToggle.tsx` (View tab, BIM Graphics panel).
- **SSoT gate** `bim/finishes/structural-finish-visibility.ts` `isStructuralFinishVisible()` (event-time getState) — διαβάζεται ΚΑΙ από 2D orchestrator (`DxfRenderer.render` → κενά Maps όταν OFF) ΚΑΙ 3D converter. Pure builders/leaves ανέγγιχτοι (ADR-040).
- **Factory ενεργοποίηση**: `createDefaultStructuralFinishSpec()` (enabled:true, mat-plaster-int/ext, 15mm) στο `structural-finish-types.ts`· `column-completion.ts` + `beam-completion.ts` το καλούν → κάθε νέο στοιχείο γεννιέται με σοβά.
- **Per-element override** (contextual ribbon, κοινό column+beam): `ui/ribbon/hooks/bridge/finish-param.ts` (options + generic `resolveFinishComboboxState`/`applyFinishComboboxChange` + pure `read/applyFinishParam`)· `{column,beam}-command-keys.ts` (`*_FINISH_KEYS`/`_KEY_TO_FIELD`/`is*FinishKey`)· bridges delegate· panel «Σοβάς» στα 2 contextual tabs. i18n `dxf-viewer-shell` (`ribbon.commands.finishSkin.*` + `ribbon.commands.finishEditor.*` + `ribbon.panels.{column,beam}FinishSkin`).
- **Semantics:** visibility-only — ο διακόπτης ελέγχει εμφάνιση 2D+3D· **το BOQ μετράει ΠΑΝΤΑ** όταν `finish.enabled` (Revit schedule = model, όχι view).

### Browser-fixes (Giorgio screenshots, DONE)
- **#3 σοβάς δοκαριού έβγαινε ΜΕΣΑ στο σώμα** → root cause: `buildOutlineRect` (beam-geometry) παράγει **CW** outline ενώ ο resolver υπέθετε CCW → `(dy,−dx)` έδειχνε μέσα. Fix: `ensureCCW` (shoelace signed-area) στον `structural-finish-resolver.ts` → ΕΝΑ σημείο, διορθώνει 2D+3D, κολόνα(no-op CCW)+δοκάρι(CW→reverse).
- **#1 γωνίες κολώνας ανοιχτές → μετά corner-fills έδειχναν επικάλυψη** → τελικό: **πραγματικό 45° miter** στο `bim-3d/converters/structural-finish-3d.ts` (`computeMiteredOuter` + `lineIntersect`): το εξωτερικό άκρο κάθε band επεκτείνεται/κόβεται στην τομή των offset ευθειών (convex→extend, reflex→trim, miter-limit×4). Ένα seam, μηδέν overlap/κενό, χωρίς ξεχωριστά corner meshes.
- **BOQ διπλομέτρηση (ανησυχία Giorgio): ΔΕΝ υφίσταται** — `interiorAreaM2/exteriorAreaM2 = Σ lengthM × heightM` ανά παρειά (ΑΤΟΕ m², κάθε παρειά μία φορά)· τα 3D miter/corner είναι **visual-only, εκτός BOQ**.

---

## ΜΕΡΟΣ Β — ΤΙ ΝΑ ΚΑΝΕΙΣ (Slice 6: beam↔column junction)

### Το πρόβλημα (Giorgio, screenshot 2026-06-13 123425)
**Στα σημεία που τα δοκάρια κολλάνε στις κολώνες, υπάρχει σοβάς — εκεί ΔΕΝ πρέπει να υπάρχει.** Το δοκάρι καρφώνεται (frames into) μέσα στην κολώνα → η διεπαφή είναι **εσωτερική/δομική σύνδεση**, ΟΧΙ σοβατισμένη όψη. Πρέπει να εξαιρεθεί ο σοβάς:
1. στην **παρειά της κολώνας** όπου ακουμπά το δοκάρι (πλάτος δοκαριού), ΚΑΙ
2. στο τμήμα της **πλάγιας όψης του δοκαριού** που είναι μέσα/πάνω στην κολώνα.

### Revit-grade λύση (FULL SSOT — ΕΠΕΚΤΕΙΝΕ τον υπάρχοντα μηχανισμό obstacles)
Ο pure resolver `resolveStructuralFinishFaces` **ΗΔΗ** δέχεται `obstacles: readonly Pt2[][]` (plan polygons) και αφαιρεί τα καλυμμένα διαστήματα κάθε ακμής (`coveredIntervals`/`exposedComplement`). Σήμερα ο scene adapter περνά **ΜΟΝΟ footprints τοίχων**. 

**Η λύση = MUTUAL STRUCTURAL OBSTACLES** (μηδέν νέα γεωμετρία — reuse coverage SSoT):
- Όταν resolve-άρεις **κολόνα** → πέρνα ΚΑΙ τα footprints των **δοκαριών** (που την αγγίζουν) ως obstacles → η παρειά κάτω από το δοκάρι κόβεται.
- Όταν resolve-άρεις **δοκάρι** → πέρνα ΚΑΙ τα footprints των **κολώνων** ως obstacles → το τμήμα της πλάγιας όψης μέσα στην κολώνα κόβεται.
- (Οι τοίχοι παραμένουν obstacles και για τα δύο, όπως τώρα.)

Αυτό ρέει **αυτόματα στο 2D + 3D + BOQ** (όλα διαβάζουν τον ίδιο resolver μέσω `computeColumnFinishFaces`/`computeBeamFinishFaces`) → η μείωση σοβά εμφανίζεται παντού + το BOQ μειώνεται σωστά (δεν μετράς την εμβυθισμένη διεπαφή).

### SSoT touchpoints (PHASE 1 RECOGNITION πρώτα — διάβασέ τα)
1. **`bim/finishes/structural-finish-resolver.ts`** — ΜΗΝ το αλλάξεις (το `obstacles` υπάρχει ήδη). `ensureCCW` + `coveredIntervals` έτοιμα.
2. **`bim/finishes/structural-finish-scene.ts`** — ΕΔΩ η κύρια δουλειά:
   - Γενίκευσε το `WallFinishObstacle` → δομικό obstacle (id + plan-polygon). Wall → `wallFootprintPolygon` (υπάρχει)· **beam → `beam.geometry.outline.vertices`**· **column → `column.geometry.footprint.vertices`**.
   - `computeColumnFinishFaces(column, footprint, height, walls)` → δέξου ΕΠΙΠΛΕΟΝ beams (obstacles)· filter-άρε self.
   - `computeBeamFinishFaces(beam, outline, depth, walls)` → δέξου ΕΠΙΠΛΕΟΝ columns (obstacles)· filter-άρε self.
   - `computeColumnFinishContribution(column, geometry, scene)` / `computeBeamFinishContribution(beam, scene)` — έχουν `scene` → βγάλε beams/columns από `scene.entities` (εύκολο).
3. **2D** `canvas-v2/dxf-canvas/dxf-renderer-frame-builders.ts`:
   - `buildFinishFacesByColumn(entities)` — μάζεψε ΚΑΙ beams (obstacles), πέρνα στο computeColumnFinishFaces.
   - `buildFinishFacesByBeam(entities)` — μάζεψε ΚΑΙ columns.
   - (lazy collection, μόνο όταν finish-active· DxfColumn/DxfBeam/DxfWall = direct entities χωρίς cast.)
4. **3D** `bim-3d/converters/structural-finish-3d.ts` (`buildColumnFinishSkin`/`buildBeamFinishSkin`) + **`bim-three-structural-converters.ts`** (`columnToMesh`/`beamToMesh`) + **`bim-3d/scene/BimSceneLayer.ts`**:
   - Σήμερα περνούν μόνο `walls` (από `entities.walls`). Χρειάζονται ΚΑΙ `entities.beams` (για κολόνες) / `entities.columns` (για δοκάρια).
   - ⚠️ **`bim-three-structural-converters.ts` + `BimSceneLayer.ts` = MIXED αρχεία με ADR-448/441** — άγγιξε **ΜΟΝΟ τις δικές σου γραμμές**, μην καθαρίσεις ξένες αλλαγές.
   - Αν αγγίξεις `DxfRenderer.ts`/renderer/composite → **STAGE ADR-040 changelog** (CHECK 6B/6D).
5. **BOQ** `hooks/data/column-boq-feed.ts` + `beam-boq-feed.ts` — καλούν τα contribution functions· αν αυτά βγάζουν beams/columns από `scene`, μηδέν αλλαγή εδώ.

### Λεπτές αποφάσεις (πάρε τις Revit-grade)
- **Self-exclusion:** το στοιχείο ΔΕΝ είναι obstacle στον εαυτό του (filter by id).
- **Tolerance/join gap:** αν τα στοιχεία δεν εφάπτονται ακριβώς (μικρό κενό), η coverage μπορεί να μην πιάσει τη διεπαφή. Σκέψου μικρή dilation/tolerance (Revit join tolerance) — ή βασίσου στο ότι born-bound framing (ADR-441) τα κάνει να εφάπτονται. Απόφαση δική σου.
- **Performance:** O(columns×beams) per frame στο 2D· lazy (μόνο finish-active). Για v1 ΟΚ· spatial index = DEFER αν χρειαστεί.
- **Διαγώνια/curved δοκάρια:** το outline polygon ως obstacle δουλεύει generic.

### Tests
- `structural-finish-scene` — κολόνα με δοκάρι-obstacle → η καλυμμένη παρειά εξαιρείται (segments/εμβαδό μειώνονται)· δοκάρι με κολόνα-obstacle → η πλάγια όψη κόβεται στη σύνδεση.
- 3D/2D index builders — passing του σωστού obstacle set.
- BOQ — μειωμένο εμβαδό στη σύνδεση (όχι διπλομέτρηση, όχι μέτρηση εμβυθισμένης διεπαφής).

### DEFER (μετά το Slice 6)
- Beam soffit (κάτω-όψη) από κορυφές τοίχων.
- Retroactive backfill παλιών persisted στοιχείων χωρίς `finish`.
- Attached/κεκλιμένες κορυφές κολόνας στο 3D skin (flat-path μόνο).
- ETICS-grade per-element exterior detection (πέρα από outer-ring proximity).

---

## ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
Ελληνικά. **ΟΧΙ commit/push (ο Giorgio).** **ΟΧΙ `git add -A`** (shared tree). ΟΧΙ `--no-verify`. **ΕΝΑ tsc τη φορά** (N.17 — έλεγξε running tsc πρώτα). N.7.1 (40 γρ./func, 500 γρ./file). N.11 (i18n keys ΠΡΩΤΑ — εδώ μάλλον δεν χρειάζονται νέα). ADR-driven (PHASE 1 RECOGNITION → plan → impl → ADR-449 §changelog + adr-index + ΕΚΚΡΕΜΟΤΗΤΕΣ + MEMORY στο ίδιο commit). **FULL ENTERPRISE + FULL SSOT — ΕΠΕΚΤΕΙΝΕ τον obstacle μηχανισμό, ΜΗ διπλασιάσεις.**

**Resume pointers:** ADR-449 (§3.quinquies + §5 Deferred «beam↔column junction» + §6 changelog) · MEMORY `project_adr449_structural_finish_skin.md` · committed μέχρι `a9b6f3b8`.
