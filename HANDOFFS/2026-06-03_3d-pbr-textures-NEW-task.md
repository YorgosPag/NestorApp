# HANDOFF — ΝΕΟ TASK: 3D Φωτογραφικές (PBR) Υφές για Parametric BIM

**Ημερομηνία:** 2026-06-03
**Κατάσταση:** 🆕 ΝΕΟ TASK — **ΔΕΝ έχει γίνει recognition/plan/κώδικας ακόμα.** Πρώτο βήμα = Phase 1 RECOGNITION (N.0.1).
**Αίτημα Giorgio:** «ΝΑΙ» σε πλήρεις φωτογραφικές υφές 3D για τοίχους + στρώσεις (και κατ' επέκταση κολώνες/δοκάρια/πλάκες).
**⚠️ COMMIT:** ο **Giorgio** κάνει commit — ΟΧΙ ο agent (N.(-1)). Καμία push χωρίς ρητή εντολή.
**⚠️ SHARED WORKING TREE:** μοιράζεται με άλλον agent (ADR-408 Φ8 MEP segments, ADR-410/411 furniture/mesh, ADR-412 family types). Stage **ΜΟΝΟ** δικά σου αρχεία· ΜΗΝ αγγίξεις adr-index/furniture/mesh/MEP/family-types αρχεία άλλων.

---

## 1. ΤΟ ΑΙΤΗΜΑ
Οι BIM επιφάνειες στο 3D viewport να αποδίδονται με **φωτογραφικές PBR υφές** (texture maps: σκυρόδεμα, τούβλο, σοβάς, ξύλο, πλακάκι, πέτρα, μέταλλο), αντί για flat χρώματα. Αφορά **κυρίως τους τοίχους και τις στρώσεις DNA** (κάθε στρώση = δικό της υλικό → δική της υφή), αλλά το ίδιο pattern επεκτείνεται σε κολώνες/δοκάρια/πλάκες/σκάλες.

## 2. ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ (από προκαταρκτικό grep — επιβεβαίωσε στο recognition)
- **3D materials:** `src/subapps/dxf-viewer/bim-3d/materials/MaterialCatalog3D.ts` → `MeshStandardMaterial` με **μόνο** `{color, roughness, metalness}` ανά key (`mat-concrete`/`mat-plaster`/`mat-brick`/`mat-stone`/`mat-tile`/`mat-wood`/`mat-glass`/`mat-metal` + `elem-*` για column/beam/slab/stair/envelope/mep). **ΚΑΝΕΝΑ texture map.** Ρητό σχόλιο στο αρχείο: *«ADR-363 Phase 6.x will extend with texture maps»* → αυτό είναι ΑΚΡΙΒΩΣ το task.
- **Per-layer materialId:** `WallDnaLayer.materialId` (`bim/types/wall-dna-types.ts`) + preset catalog `bim/walls/wall-material-catalog.ts` (19 slugs: `mat-concrete-c20/c25/c30`, `mat-brick-masonry`, `mat-stone-masonry`, `mat-eps`, `mat-plaster-int/ext`, `mat-tile`, `mat-marble`, `mat-aluminum-cladding`…). **🔴 RECOGNITION:** βρες πώς (ή ΑΝ) το specific `materialId` της στρώσης (π.χ. `mat-plaster-int`) χαρτογραφείται στο generic MaterialCatalog3D key (`mat-plaster`). Αυτό το mapping είναι το σημείο επέκτασης.
- **Mesh entities ΗΔΗ έχουν textures:** τα GLB έπιπλα/φωτιστικά (ADR-410/411) φέρνουν **embedded PBR textures** μέσω GLTFLoader (`mesh-to-object3d.ts`). Άρα η three.js υφή-υποδομή **δουλεύει ήδη** — το κενό είναι ΜΟΝΟ οι **parametric** επιφάνειες (extruded walls/slabs/columns) που περνούν από MaterialCatalog3D.
- **Library type:** `bim/types/bim-material-types.ts` `BimMaterial` — έχει density/fire/cost/ΑΤΟΕ, **ΟΧΙ** texture/color/map πεδία. Αν θες οι υφές να είναι «ανά υλικό βιβλιοθήκης», θα χρειαστεί πεδίο εδώ.
- **Storage infra:** Firebase Storage content-library (GLB assets ADR-410/411, `storage.rules` `bim-mesh-library/{path=**}` DEPLOYED pagonis-87766). Texture assets μπαίνουν παρόμοια (π.χ. νέο `bim-texture-library/` path).
- **three.js 0.170.0** (MIT) — `TextureLoader`/`MeshStandardMaterial.map/normalMap/roughnessMap/aoMap` διαθέσιμα, καμία νέα dependency.
- **Licensing:** ADR-409 (BIM library licensing policy) — **Poly Haven = CC0** (έχει έτοιμα PBR texture sets concrete/brick/plaster/wood/tile/stone). CC-BY επίσης επιτρεπτό (attribution).

## 3. ΠΙΘΑΝΟ SCOPE (να οριστικοποιηθεί στο plan — μην το θεωρήσεις δεδομένο)
1. **MaterialCatalog3D επέκταση:** optional `map`/`normalMap`/`roughnessMap`/`aoMap` ανά material key + `TextureLoader` + texture cache (mirror του `bim-mesh-cache` pattern, async pre-load + sync read).
2. **UV mapping (το πιο δύσκολο):** οι parametric geometries (extruded BufferGeometry) χρειάζονται σωστά UVs + **world-space tiling/repeat** ώστε ένα τούβλο να έχει ρεαλιστικό φυσικό μέγεθος ανεξάρτητα από το εμβαδό της επιφάνειας (`texture.wrapS/T = RepeatWrapping`, repeat από διαστάσεις σε μέτρα). Έλεγξε αν οι converters (`BimToThreeConverter`, wall/slab/column extrude) παράγουν UVs.
3. **Texture assets:** Poly Haven CC0 sets → Firebase Storage (`bim-texture-library/`?) + `storage.rules`.
4. **Mapping στρώσεων:** `WallDnaLayer.materialId`/`BimMaterial` → texture set (πεδίο `textureId` ή χάρτης slug→set).
5. **Performance + toggle:** πιθανό View toggle «Ρεαλιστικά υλικά» (textured vs flat) για FPS· mipmaps + anisotropy· texture memory.
6. **Επέκταση σε column/beam/slab/stair** (elem-* materials) με τον ίδιο μηχανισμό.

## 4. ADR
- Το σχόλιο δείχνει **ADR-363 Phase 6.x**. ΑΛΛΑ το task είναι cross-cutting (materials + UV + storage + licensing + UI) → **σκέψου νέο ADR** (επόμενο sequential — έλεγξε `adr-index.md` για το επόμενο ελεύθερο νούμερο· ΑΠΟΦΥΓΕ 145). Απόφαση στο recognition: επέκταση ADR-363 Φ6 vs νέο ADR.
- Δες ΟΠΩΣΔΗΠΟΤΕ: ADR-363 (BIM drawing mode, §6 materials/3D), ADR-366 (3D scene/SPEC-3D-003), ADR-409 (licensing), ADR-410/411 (mesh+texture infra precedent).

## 5. N.8 — Execution mode
Σαφώς **orchestrator-tier** (materials catalog + UV math + storage + assets + UI toggle + licensing, 2+ domains, πολλά αρχεία). **ΡΩΤΑ τον Giorgio** πριν τρέξεις orchestrator (~2.5-3.5× tokens) — ή Plan Mode. ΜΗΝ ξεκινήσεις χωρίς έγκριση mode.

## 6. ΚΑΝΟΝΕΣ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
- **Γλώσσα:** Ελληνικά πάντα.
- **NO commit / NO push / NO git add** χωρίς ρητή εντολή (N.(-1)). Commit = Giorgio.
- **SHARED tree:** stage μόνο δικά σου αρχεία· ΜΗΝ αγγίξεις adr-index/furniture/mesh/MEP/family-types άλλων.
- **N.14 model:** δήλωσε μοντέλο & περίμενε «ok» πριν μη-τετριμμένη υλοποίηση.
- **N.0.1:** RECOGNITION πρώτα — διάβασε MaterialCatalog3D + converters (UVs) + wall-material-catalog + mesh-to-object3d (πώς τα GLB φέρνουν textures) ΠΡΙΝ γράψεις γραμμή.
- **Licensing (N.5/ADR-409):** μόνο CC0/CC-BY/MIT/permissive textures· κανένα νέο npm χωρίς license check.

## 7. ΣΧΕΤΙΚΟ ΕΚΚΡΕΜΕΣ (μην μπερδευτείς)
- **ADR-412 Φ5** (family types) μόλις ολοκληρώθηκε — pending commit + 🔴 browser verify από Giorgio. Άσχετο με τις υφές· μην το αγγίξεις. Βλ. `HANDOFFS/2026-06-03_adr412-phase5-DONE_verify-phase6-NEXT.md`.
