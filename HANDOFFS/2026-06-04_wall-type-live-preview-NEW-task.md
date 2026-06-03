# HANDOFF — ΝΕΟ TASK: Live Preview Panel για Τύπο Τοίχου (3D τομή στρώσεων + υφές + αμφίδρομο highlight)

**Ημερομηνία:** 2026-06-04
**Κατάσταση:** 🆕 ΝΕΟ TASK — **ΔΕΝ έχει γίνει plan/κώδικας.** Πρώτο βήμα = Phase 1 RECOGNITION (N.0.1) → μετά Plan Mode.
**Αίτημα Giorgio:** «ΝΑΙ θέλω» — panel προεπισκόπησης **αριστερά** στο dialog «Επεξεργασία τύπου τοίχου», που δείχνει τον τοίχο σε **προοπτική** (πρόσοψη + πάνω όψη) με τις **στρώσεις σε τομή**, με **πραγματικές υφές**, **ζωντανή** ενημέρωση καθώς επεξεργάζεσαι το δεξί πάνελ, και **αμφίδρομο highlight** (επεξεργάζεσαι στρώση δεξιά → φωτίζεται η λωρίδα αριστερά, και αντίστροφα).
**⚠️ COMMIT:** ο **Giorgio** κάνει commit — ΟΧΙ ο agent (N.(-1)). Καμία push χωρίς ρητή εντολή.
**⚠️ SHARED WORKING TREE:** μοιράζεται με άλλον agent. Stage **ΜΟΝΟ** δικά σου αρχεία· ΜΗΝ αγγίξεις adr-index/furniture/mesh/MEP/family-types αρχεία άλλων.

---

## 1. ΤΟ ΑΙΤΗΜΑ (από σκίτσο Giorgio — screenshot `Στιγμιότυπο οθόνης 2026-06-04 005315.jpg`)
Στο dialog **«Επεξεργασία τύπου τοίχου»** (`EditWallTypeDialog.tsx`), το δεξί μέρος έχει ήδη τον editor στρώσεων (DNA). Ο Giorgio θέλει **αριστερά** ένα νέο **panel προεπισκόπησης**:
- Σχεδιάζει **κόκκινο περίγραμμα** = ένα κομμάτι τοίχου σε **προοπτική** (φαίνεται η πρόσοψη + η πάνω όψη, σαν κουτί 3/4).
- **Πράσινες γραμμές** = τα όρια των στρώσεων (όπως δηλώνονται στο δεξί πάνελ), ορατά στην πάνω όψη + στην άκρη (η τομή).
- Όταν αλλάζεις πάχος/υλικό/σειρά/πλήθος στρώσεων δεξιά → η προεπισκόπηση **ενημερώνεται δυναμικά**.
- Όταν επεξεργάζεσαι μια στρώση δεξιά → η αντίστοιχη λωρίδα αριστερά **φωτίζεται/περιγράφεται** (ο χρήστης ξέρει τι αγγίζει).
- **Αμφίδρομη** επικοινωνία αριστερά↔δεξιά.
- **ΝΑΙ στις πραγματικές υφές** στην προεπισκόπηση (όχι μόνο χρώματα).

## 2. ΓΙΑΤΙ ΕΙΝΑΙ ΕΦΙΚΤΟ — ΟΛΑ ΤΑ ΚΟΜΜΑΤΙΑ ΥΠΑΡΧΟΥΝ (μόλις φτιάχτηκαν στο ADR-413)
**🔴 ΚΡΙΣΙΜΟ context: το ADR-413 (PBR υφές) ΜΟΛΙΣ ΟΛΟΚΛΗΡΩΘΗΚΕ (2026-06-03, Φ1) — pending commit + browser verify.** Η νέα προεπισκόπηση «πατάει» πάνω του:
- **Γεωμετρία στρώσεων σε τομή** → `src/subapps/dxf-viewer/bim-3d/converters/wall-layer-geometry.ts` (NEW ADR-413): `splitPieceByLayers(piece, dna)` + `layerBoundaryFractions(dna)` + `isMultiLayerWall(dna)`. Pure math, καθαρά — δίνει ακριβώς τις «πράσινες λωρίδες».
- **Per-layer 3D build** → `bim-3d/converters/BimToThreeConverter.ts` `wallToMesh` (ADR-413): κάθε στρώση = δικό της textured mesh.
- **Πραγματικές υφές** → `bim-3d/materials/MaterialCatalog3D.ts` `getMaterial3D(materialId)` (texture-aware, gate `realisticMaterials`) + `bim-3d/materials/bim-texture-cache.ts` (`preloadTextureSet`/`getTextureSet`, async-load→`bumpTextureAssetVersion`→resync) + `bim/materials/bim-texture-registry.ts` (`MATERIAL_TEXTURE_MAP`, `textureSlugForKey`).
- **Ζωντανά δεδομένα** → ο editor ήδη δίνει το draft: `src/subapps/dxf-viewer/ui/wall-advanced-panel/sections/WallDnaEditor.tsx` δουλεύει καθαρά πάνω σε `{ dna, category, onChange }`. Η προεπισκόπηση διαβάζει το ΙΔΙΟ `dna` draft.
- **three.js 0.170.0** ήδη στο project (MIT, καμία νέα dep).
- **DNA types** → `bim/types/wall-dna-types.ts` (`WallDna`, `WallDnaLayer{thickness mm, materialId, side}`, σειρά list **κορυφή=εξωτερική όψη → κάτω=εσωτερική**, `getDefaultDnaForCategory`).

## 3. ΑΡΧΕΙΑ ΓΙΑ RECOGNITION (διάβασε ΠΡΙΝ γράψεις)
- `ui/ribbon/components/EditWallTypeDialog.tsx` — το dialog (ADR-412 Φ5) όπου μπαίνει το αριστερό preview· δες layout/πού θα κολλήσει το pane.
- `ui/wall-advanced-panel/sections/WallDnaEditor.tsx` — ο editor στρώσεων (εδώ μπαίνει το highlight state· `DnaLayerRow` = ανά στρώση).
- `ui/wall-advanced-panel/sections/WallDnaSection.tsx` — instance consumer (η προεπισκόπηση να είναι **κοινή** type-dialog + instance-panel).
- `bim-3d/converters/wall-layer-geometry.ts` + `BimToThreeConverter.ts` (wallToMesh) — πώς γεννιέται η per-layer γεωμετρία· **ΠΡΟΣΟΧΗ:** το `wallToMesh` θέλει `WallEntity` με `geometry` (outerEdge/innerEdge). Για preview χρειάζεσαι ένα **συνθετικό ευθύ stub** τοίχου από σκέτο `dna` (απλό ορθογώνιο footprint) — είτε σύνθεσε synthetic WallEntity, είτε φτιάξε απλό direct extrude των layer bands (πιθανό νέο SSoT helper, reuse `layerBoundaryFractions`).
- `bim-3d/materials/MaterialCatalog3D.ts` + `bim-texture-cache.ts` + `bim/materials/bim-texture-registry.ts` — υφές.
- **Ψάξε reusable mini three.js scene/manager** (π.χ. `ThreeJsSceneManager`, view-cube, GLB thumbnail patterns) — αν δεν υπάρχει standalone mini-renderer, φτιάξε ένα μικρό offscreen-ish scene με **σταθερή κάμερα 3/4** (μην μπλέξεις με το κύριο `BimViewport3D`/ADR-040 high-freq path).

## 4. ΠΡΟΤΕΙΝΟΜΕΝΗ ΠΡΟΣΕΓΓΙΣΗ (να οριστικοποιηθεί στο plan)
- **Επιλογή Α (προτεινόμενη, ταιριάζει στο σκίτσο):** mini-3D viewport — κοντό stub τοίχου (~1μ), σταθερή γωνία 3/4 (πρόσοψη+πάνω όψη), κάθε στρώση textured band, fixed camera, render-on-change + subscribe `textureAssetVersion` για texture swap. Highlight = κοινό `hovered/activeLayerId` (emissive/outline στη band).
- **Επιλογή Β (ελαφρύτερη):** 2D canvas τομή με texture swatches ανά λωρίδα — απλούστερο, λιγότερο «wow». Ο Giorgio έγειρε προς το προοπτικό (Α) — **ρώτησέ τον για επιβεβαίωση Α vs Β στο plan.**
- **Αμφίδρομο highlight:** νέο μικρό shared state (π.χ. `useWallPreviewHighlightStore` ή lift state στο dialog): hover/focus σε `DnaLayerRow` → set activeLayerId → η band λάμπει· κλικ σε band → scroll/focus τη σειρά.

## 5. ADR
- Πιθανό **νέο ADR** (επόμενο ελεύθερο — έλεγξε `adr-index.md`· τελευταίο ήταν **413**, άρα 414· ΑΠΟΦΥΓΕ 145) ή επέκταση ADR-363/412. Απόφαση στο recognition. ΜΗΝ αγγίξεις `adr-index.md` (shared) — άσε entry για συντονισμό.
- Σχετικά: ADR-413 (υφές — μόλις έγινε, δες memory `project_adr413_pbr_textures.md`), ADR-412 Φ5 (Edit Wall Type dialog — **pending verify, shared**), ADR-363 (wall DNA), ADR-366 (3D), ADR-040 (μην σπάσεις το high-freq canvas path — το preview είναι ΞΕΧΩΡΙΣΤΟ mini-scene).

## 6. N.8 — Execution mode
Μέτριο→μεγάλο (νέο component preview + mini three scene + highlight state + wiring σε 2 consumers + ίσως synthetic-wall helper + ADR). ~5-8 αρχεία. **Πιθανό Plan Mode ή Orchestrator.** ΡΩΤΑ τον Giorgio mode + δήλωσε μοντέλο (N.14) πριν γράψεις. Recognition (read-only) προηγείται πάντα.

## 7. ΚΑΝΟΝΕΣ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
- **Γλώσσα:** Ελληνικά πάντα.
- **NO commit / NO push / NO git add** χωρίς ρητή εντολή (N.(-1)). Commit = Giorgio.
- **SHARED tree:** stage μόνο δικά σου· ΜΗΝ αγγίξεις adr-index/MEP/furniture/family-types άλλων. Το `EditWallTypeDialog.tsx` + DNA editor είναι **ADR-412 περιοχή (shared, pending verify)** → άγγιξε μόνο όσο χρειάζεται για το preview, ανέφερε co-edits.
- **N.14 model:** δήλωσε μοντέλο & περίμενε «ok».
- **N.0.1:** RECOGNITION πρώτα.
- **Υφές/Licensing:** μόνο CC0/CC-BY (Poly Haven, ADR-409) — ισχύει ό,τι του ADR-413· καμία νέα dep.

## 8. ΣΧΕΤΙΚΑ ΕΚΚΡΕΜΗ (μην μπερδευτείς)
- **ADR-413 PBR υφές** = pending commit + 🔴 browser verify (default ON, demo υφές concrete/brick/plaster στο `public/textures`, high-res μέσω `tools/bim-textures/upload-textures.mjs` που τρέχει ο Giorgio). Η προεπισκόπηση ΕΞΑΡΤΑΤΑΙ απ' αυτό — αν δεν έχει γίνει commit ακόμα, ο κώδικας **υπάρχει στο working tree**.
- **ADR-412 Φ5** family types = pending verify· το dialog είναι κοινό. ΜΗΝ πειράξεις τη λογική family-types, μόνο πρόσθεσε το preview pane.
