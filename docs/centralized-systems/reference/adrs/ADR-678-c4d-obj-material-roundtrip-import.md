# ADR-678 — C4D → Νέστωρ round-trip: εισαγωγή υλικών/χρωμάτων από OBJ+MTL

**Status:** 🟡 IN PROGRESS (Φ1 + Φ1.1 + **Φ3 glTF per-face** + **Φ4 COLLADA `.dae` per-face import** [code+jest ✅, R15 ground-truth pending] done· Φ2 textures + Φ3 OBJ/per-building-plaster TODO)
**Date:** 2026-07-19
**Owner:** Giorgio
**Σχετικά:** ADR-668 (mesh3d export OBJ/GLTF) · ADR-539 (per-face appearance / Cinema 4D Polygon Mode) · ADR-511 (wall-covering material catalog SSoT)

---

## 1. Πρόβλημα (η επιθυμία του Giorgio)

Ο Νέστωρ **εξάγει** ήδη το 3Δ BIM μοντέλο σε `.obj`+`.mtl` (ADR-668). Ο Giorgio το ανοίγει σε
**Cinema 4D R15**, βάζει υλικά/χρώματα ανά στοιχείο, και θέλει να τα **ξαναδιαβάσει ο Νέστωρ** —
δηλαδή να «κατέβει» το βάψιμο του C4D πίσω στα ίδια BIM στοιχεία.

## 2. Τι επιβιώνει του round-trip (ground truth, μετρημένο 2026-07-19)

Το export (ADR-668) κουβαλά **δύο ανεξάρτητα κανάλια ταυτότητας** μέσα στο OBJ:

| Κανάλι | Πηγή export | Τι δίνει |
|--------|-------------|----------|
| **Όνομα object** `o <name>` | `mesh3d-naming.ts::buildMeshName` → `[HIDDEN_]<Όροφος>_<Κατηγορία>_<bimId>[_N]` | **ποιο** BIM στοιχείο (`bimId`) |
| **`usemtl <name>`** | `mesh3d-materials.ts::assignExportMaterials` → `matId` (π.χ. `mat-concrete-c25`) ή `mat_<hex>` | **ποιο υλικό** (+ `Kd` χρώμα στο `.mtl`) |

Το C4D **διατηρεί** object names + `usemtl` και ξανα-γράφει `.mtl` με `Kd`/`map_Kd` όταν εξάγεις OBJ.
→ Άρα το round-trip είναι εφικτό **name-based** (όπως Revit/ArchiCAD/IFC material mapping).

## 3. Όρια (100% ειλικρίνεια — γιατί ΔΕΝ είναι πλήρες)

- **Γεωμετρία ΔΕΝ ξαναδιαβάζεται ως BIM.** OBJ = τρίγωνα· χάνεται το parametric (τοίχος/κολόνα).
  Το round-trip είναι **αποκλειστικά για εμφάνιση** (υλικό/χρώμα), όχι σχήμα.
- **Ανά-όψη (per-polygon): αναξιόπιστο για OBJ, λυμένο για glTF (Φ3, 2026-07-21).** Το **OBJ**
  export βγάζει ΕΝΑ `o` block ανά στοιχείο, χωρίς face-groups· το C4D τριγωνοποιεί/συγκολλά → δεν
  αντιστοιχίζεται στο δικό μας `FaceKey`. **Το OBJ μονοπάτι παραμένει μόνο ανά-στοιχείο
  (`BASE_FACE_KEY '*'`)** — ο stock `OBJExporter` του three δεν είναι group-aware, άρα ένα multi-
  material mesh βγαίνει ως ένα `o` block με ένα `usemtl` (dominant), όχι πολλά. Το **glTF** μονοπάτι
  όμως **έχει** per-primitive ομαδοποίηση εγγενώς: ο `GLTFExporter` σπάει ένα multi-material mesh σε
  ένα primitive ανά `geometry.group`, ο `GLTFLoader` το επιστρέφει ως `THREE.Group` με ένα
  single-material child mesh ανά primitive, σε σταθερή σειρά, με το node-level `userData` (άρα και
  το `faceKeyByMaterialIndex`) ακέραιο. Πάνω σε αυτό λύθηκε το per-face round-trip **αποκλειστικά
  glTF** (§6 changelog 2026-07-21) — `assignExportMaterials` ονοματίζει πλέον ΚΑΙ τα array υλικά
  (`mat_<hex6>` ανά χρώμα), ο import χτίζει `faceMaterials` ανά θέση και εφαρμόζει per-face
  `SetFaceAppearanceCommand` (collapse σε `BASE_FACE_KEY '*'` όταν όλες οι όψεις ταιριάζουν).
- **Textures (`map_Kd` εικόνες) = Φ2.** Το σύστημα υλικών (ADR-539/511) ξέρει flat χρώματα +
  κατάλογο, όχι αυθαίρετες εικόνες με UV. Φ1: το `map_Kd` αγνοείται, κρατάμε `Kd` flat χρώμα.

## 4. Απόφαση αρχιτεκτονικής

**Ξεχωριστό εργαλείο «Εισαγωγή υλικών από C4D», ΟΧΙ ο wizard κάτοψης.** Ο wizard κάτοψης
(`FloorplanImportWizard`) **σβήνει τον όροφο** (`wipe-floor`) και ξαναχτίζει σκηνή από 2D σχέδιο —
θα κατέστρεφε το ίδιο το μοντέλο που θέλουμε να βάψουμε. Οι μεγάλοι (Revit «appearance», ArchiCAD
surface styles) κάνουν name-based material mapping μέσω αποκλειστικού interchange, ποτέ μέσω του
geometry-create flow.

### 4.1 SSoT reuse (μηδέν διπλότυπο)

| Βήμα | Επαναχρησιμοποιεί |
|------|-------------------|
| Ονοματοδοσία (name → bimId) | `mesh3d-naming.ts::buildMeshName` (ΤΟ ΙΔΙΟ που παράγει το export → μηδέν drift) |
| Ανάλυση υλικού → εμφάνιση | wall-covering catalog (`getWallCoveringMaterial`) + `FaceAppearance` union |
| Εφαρμογή | `apply-face-appearance.ts::applyFaceAppearanceToFaces` (ΕΝΑ CompositeCommand = ΕΝΑ undo) |
| Στόχος «όλο το στοιχείο» | `BASE_FACE_KEY '*'` (ADR-539 base material tag) |

### 4.2 Νέα modules (`io/mesh3d-material-import/`, mirror του `export/core/mesh3d/`)

- `obj-mtl-parse.ts` — **pure** parsers: `parseObjObjects(objText)` → `{objectName, materialName}[]`
  (dominant material ανά object = αυτό με τα περισσότερα faces)· `parseMtl(mtlText)` → `Map<name,{colorHex,opacity}>`.
- `resolve-import-appearance.ts` — `materialName` + MTL → `FaceAppearance` (catalog id → `{materialId}`,
  αλλιώς `Kd` → `{colorHex}`, αλλιώς `null`).
- `match-objects-to-entities.ts` — χτίζει `Map<exportName, bimId>` από τις ζωντανές οντότητες μέσω
  `buildMeshName` (forward map, όχι lossy reverse-parse)· επιστρέφει matched + unmatched report.
- `import-c4d-materials.ts` — orchestrator: parse → match → resolve → `applyFaceAppearanceToFaces`.

### 4.3 Φ1.1 — Σοβάς (finish) round-trip + skip αμετάβλητων

**Ground truth (μετρημένο 2026-07-19):** ο σοβάς ΔΕΝ εξάγεται ανά στοιχείο. Είναι το **ενιαίο
merged silhouette skin** του ADR-449 Slice 7 (`bim-scene-structural-finish-sync.ts`): ΕΝΑ welded
mesh ανά **κτίριο** ανά **ζώνη**, με **synthetic bimId** (`structural-finish[-hcol|-hbeam|-hslab|
-hup]-<buildingId>`, `bimType:'column'`). Η per-element/per-side ταυτότητα έχει χαθεί γεωμετρικά
(non-pickable by design, Slice X1). Άρα **δεν υπάρχει «γονέας»** να βρεθεί με name-match → τα σοβά
objects πέφτουν στα «χωρίς αντιστοίχιση» και το υλικό χάνεται (η ρίζα που είδε ο Giorgio).

**Απόφαση (Giorgio 2026-07-19): ομοιόμορφος σοβάς κτιρίου.** Το υλικό που βάφεται στο merged skin
εφαρμόζεται **ομοιόμορφα** σε ΟΛΑ τα μέλη της ζώνης (κολόνες/δοκάρια/πλάκες — οι τοίχοι έχουν δικό
σύστημα, ADR-447/511). Ταιριάζει με τη φιλοσοφία «ομοιόμορφο κέλυφος» του ADR-449 (η πρόσοψη = ΜΙΑ
συνεχής στρώση). **SSoT reuse:** ΤΟ ΙΔΙΟ `SetFinishFaceOverrideCommand` (PART B «Paint») ανά μέλος
ανά κάθετη πλευρά `side:i` — `{materialId}` για catalog id (οδηγεί ΚΑΙ BOQ), `{colorOverride}` για
flat C4D χρώμα (texture → flat `Kd`, μόνο οπτικό). Νέο module: `finish-import-routing.ts`.

**Skip αμετάβλητων (ΡΙΖΑ 2):** ένα `usemtl` είναι «αρχικό DNA του Νέστορα» όταν το όνομά του είναι
ό,τι ξανα-παράγει το export (`resolveMaterialName`): `mat-*` / `elem-*` matId, ή `mat_<hex6>`
fallback. Τέτοια → **no-op** (`resolveImportAppearance` → `null`) → μηδέν άχρηστο override σε
δεκάδες αμετάβλητα στοιχεία. Override μόνο σε ΞΕΝΑ (C4D-created) υλικά.

**Γνωστός περιορισμός (τίμια):** εφαρμογή ανά **τύπο** της ζώνης σε ΟΛΟΥΣ τους ορόφους — ΟΧΙ
building-scoped (το synthetic id κουβαλά buildingId αλλά το mapping entity→building θέλει τον πλήρη
SyncContext). Το single-building/single-user project το θέλει έτσι. Per-side/per-building = θα
απαιτούσε σπάσιμο του merged skin (regression του Slice 7) → **εκτός Φ1.1**.

## 5. Φασικό roadmap

| Φάση | Περιεχόμενο | Κατάσταση |
|------|-------------|-----------|
| **Φ1** | Ανά-στοιχείο χρώμα/υλικό: OBJ+MTL parse · name→bimId match · apply base `'*'` · pure core + orchestrator + 14 tests | 🟢 CORE DONE |
| **Φ1-UI** | Κουμπί «Εισαγωγή υλικών από C4D» (LevelPanel) + file picker (.obj/.mtl) + toast αποτελέσματος | 🟢 DONE |
| **Φ1.1** | Σοβάς round-trip (merged skin → ομοιόμορφος σοβάς μελών, ADR-449 command) + skip αμετάβλητων (`mat-*`/`elem-*`/`mat_<hex6>`) · +12 tests (26 σύνολο) | 🟢 DONE |
| **Φ2** | **Textures/υλικά round-trip (κοινή βιβλιοθήκη 🅱️ + ξένες υφές 🅰️).** 3 βήματα: **Βήμα 1** export round-trip identity (per-face υλικά ονομάζονται με το Nestor materialId αντί `tex_*`) · **Βήμα 2** import recognition catalog `mat-*` + per-entity baseline · **Βήμα 3 (🅰️)** texture upload (`<library_images>` → `uploadMaterialTextureMap` → νέο `bmat_*`). | 🟡 **Βήμα 1 code+jest DONE** (🅱️ `bmat_*`)· **Βήμα 2 code+jest DONE** (per-entity+per-face baseline, catalog swap detection, όλα τα formats wired — ground-truth PENDING)· **Βήμα 3 (🅰️) TODO** |
| **Φ3** | **Per-face round-trip μέσω glTF** (named array-material primitives → `FaceKey`, ζωντανό ΚΑΙ σε επαναλαμβανόμενο γύρο συνεργασίας) — **OBJ παραμένει per-object dominant** (stock `OBJExporter` δεν είναι group-aware, §3) | 🟢 **DONE (glTF)** |
| **Φ3.1α** | **Per-face OBJ export**: δικός μας group-aware OBJ writer (`mesh3d-obj-writer.ts`) — ΕΝΑ `o <object>` με **πολλά `usemtl` blocks** (ένα ανά `geometry.group`, σειρά = `buildFacedIndex`), όπως Blender/C4D. Single-material = byte-identical με stock. | 🟢 **DONE (export)** |
| **Φ3.1β** | **Per-face OBJ re-import**: το OBJ **δεν** κουβαλά την αρίθμηση όψεων όπως το glTF (`userData.faceKeyByMaterialIndex`)· μόνο όνομα υλικού + σειρά επιβιώνουν στο C4D. Blocked σε **πραγματικό C4D-round-tripped OBJ** για μέτρηση αν το C4D διατηρεί τη σειρά όψεων (order-based) ή χρειάζεται geometry-based αντιστοίχιση («ground-truth ΠΡΙΝ parser»). | ⬜ TODO (evidence-first) |
| **Φ3.1γ** | per-building/per-side σοβάς (πέρα από το ομοιόμορφο-ζώνης της Φ1.1) | ⬜ TODO |
| **Φ3.1 (COLLADA)** | **Per-face COLLADA `.dae` export** — το ΜΟΝΟ εγγράψιμο format που ο C4D **R15 διαβάζει ΜΕ χρώματα** (ο R15 OBJ importer δεν διαβάζει υλικά, μετρημένο). Δικός μας 1.4.1 writer, per-group `<triangles>` + `<bind_material>` + `<bind_vertex_input>` (native C4D δομή, Φ3.1δ). Βλ. ADR-668 changelog 2026-07-21. | ✅ **DONE — ΕΠΙΒΕΒΑΙΩΜΕΝΟ στον R15** (per-face χρώμα κολώνας ορατό, ground-truth Giorgio 2026-07-21) |
| **Φ4 (COLLADA import)** | **COLLADA `.dae` re-import** (C4D R15 → Νέστωρ). Νέος parser `dae-material-parse.ts` → `ObjectMaterialAssignment[]` (+`faceMaterials`) + `Map<name, ImportedMaterial>` → **αυτούσιος** ο κοινός πυρήνας (`applyImportedAppearance`, `charset:'unicode'`). Per-face **μόνο για δικό μας `.dae`** (faceKeys σε `<extra profile="NESTOR">` + `sym_i`)· **ξένος/C4D `.dae` → per-object dominant** (ο R15 exporter χάνει extras+symbols, βλ. changelog 2026-07-21 R15-GT). +wrapper + UI `.dae` branch. | 🟡 **per-object ΕΠΙΒΕΒΑΙΩΜΕΝΟ με R15 output** (42/42 objects διαβάζονται)· **per-face μέσω C4D = ΑΔΥΝΑΤΟ** (R15 χάνει face-identity)· **textured import = Φ2 TODO** |

## 6. Changelog

- **2026-07-21 (Φ2 Βήμα 2 — per-entity + per-face material baseline: catalog→catalog swap detection)** —
  **Ρίζα:** το `isUnchangedNestorMaterial(name)` (resolve-import-appearance) είναι **name-based regex** — κάθε
  `mat-*`/`elem-*` → «αμετάβλητο» → **short-circuit πριν καν κληθεί ο `resolveKnownId`**. Άρα ένας συνεργάτης
  που αλλάζει μια όψη από `mat-concrete-c25` → `mat-brick-masonry` (και τα δύο catalog DNA) περνά **αόρατος**.
  **Λύση (πρακτική μεγάλων — ground-truth ανά στοιχείο, όχι εικασία ονόματος):** το manifest κρατά πλέον ΑΝΑ
  ΣΤΟΙΧΕΙΟ + ΑΝΑ ΟΨΗ το εξαχθέν όνομα υλικού· το import συγκρίνει εισερχόμενο vs εξαχθέν όνομα ανά όψη.
  **Ενορχηστρώθηκε ως multi-agent workflow** (export ‖ import κατά frozen contract → adversarial verify).
  - **Export (schema, additive/backward-compat — μηδέν bump του `NESTOR_MANIFEST_SCHEMA`):** `ManifestEntity`
    αποκτά optional `materialsByFace?: Record<faceKey, cleanName>` (`'*'` = single/whole-object· αλλιώς
    `top`/`bottom`/`side:i`/…). `buildExportManifest` το γεμίζει ανά mesh (single → `{'*':name}`· array →
    per-`faceKeyByMaterialIndex[i]`). `parseEntity` fail-closed (μόνο string→string· παλιό manifest → undefined
    → global fallback, μηδέν regression).
  - **Import:** `resolveImportAppearance` νέα optional `exportedName` — αν υπάρχει per-entity baseline: `clean
    === exportedName` → αμετάβλητο (color repaint μόνο)· `clean !== exportedName` → **CHANGED** → `resolveKnownId`
    (χωρίς το global guard). `buildKnownMaterialResolver` αναγνωρίζει πλέον τα wall preset catalog ids
    (`WALL_MATERIAL_PRESET_IDS`: `mat-concrete-c20/c25/c30`, `mat-brick-masonry`, `mat-concrete-block`). Threading
    `materialBaselineByMesh` (key = meshName) μέσω `ImportedAppearanceInput` → `buildBodyFaceCommands`. Το «όλο
    το στοιχείο» replace (Εύρημα A) διατηρήθηκε ακέραιο.
  - **Wiring ΟΛΩΝ των formats (ο adversarial verifier έπιασε ότι το αρχικό fan-out κάλυψε μόνο OBJ):** το
    `materialBaselineByMesh` προωθείται πλέον και από τους `.dae` (`importColladaAppearance`) **και** glTF
    (`importGltfAppearance`) wrappers — το `.dae` είναι το **κύριο** per-face μονοπάτι του C4D round-trip, άρα
    ήταν απαραίτητο. Το button χτίζει το baseline (`readMaterialBaselineByMesh`) και για τα 3 payloads.
  - **SSoT (boy scout, full-SSOT standard):** ο `stripHiddenPrefix` κεντρικοποιήθηκε στο THREE-free
    `mesh3d-naming.ts` (πρώην inline σε `mesh3d-materials` + διπλότυπο στο pure import core) → ΕΝΑ ορισμός,
    reuse από export baseline/manifest + pure import, χωρίς να σέρνεται THREE στο import.
  - **Tests:** export-manifest (+9: materialsByFace populate/parse fail-closed/round-trip), resolve (+per-entity
    swap/same/foreign/repaint), known-materials (+catalog ids), import-c4d (+swap→{materialId}, same→no-op,
    no-baseline→regression guard, per-face selective), collada (+.dae swap production path end-to-end). **132/132
    πράσινα σε 16 suites, jscpd καθαρό, μηδέν `any`, ≤500/40.**
  - **⚠️ Ground-truth PENDING (Giorgio):** στον C4D R15 άλλαξε ΜΙΑ όψη σε **catalog** υλικό (π.χ. `mat-brick-masonry`),
    export **με** συνοδό `.nestor.json`, re-import `.dae` → η αλλαγή catalog πρέπει να «κατεβαίνει» (πριν ήταν αόρατη).
- **2026-07-21 (Εύρημα A — «βάψε όλο» = πραγματικά όλο: replace semantics καθαρίζει stale per-face)** —
  **Ground-truth (Giorgio, screenshot `2026-07-21 222359.jpg`):** έβαψε την κολώνα **ΟΛΗ ροζ** στον C4D →
  import → **3 όψεις ροζ, 1 όψη έμεινε ΞΥΛΟ**. **Ρίζα:** η κολώνα είχε ΗΔΗ persisted per-face override
  ξύλου (`faceAppearance['side:x']`). Το import έγραφε το base `'*'` με **merge-set** (`SetFaceAppearanceCommand`
  → `withFaceAppearance` κρατά τα υπόλοιπα κλειδιά) → ο cascade `resolveFaceMaterial`
  (`appearance[face] ?? appearance['*']`, ADR-539) έδινε προτεραιότητα στο per-face ξύλο → η όψη έμενε
  αβαφή. Δηλαδή το «βάψε όλο» **δεν** ήταν πραγματικά «όλο». **Fix (SSoT, reuse-only — μηδέν νέο command):**
  όταν βάφεται ΟΛΟ το στοιχείο (per-object / uniform collapse), γράφεται πλέον με **replace semantics**
  μέσω του υπάρχοντος `SetEntityFaceAppearanceMapCommand` (ADR-539 Φ4a) — αντικαθιστά ΟΛΟΚΛΗΡΟ το map
  με `{ '*': appearance }`, άρα καθαρίζει ταυτόχρονα κάθε προϋπάρχον per-face override.
  - Νέος pure helper **`entireElementFaceMap(value)`** στο `bim/types/face-appearance-types.ts` (SSoT
    ορισμός του «όλο το στοιχείο» ως map· `null → {}` = Revit «remove paint»). Κοινός για τα δύο μονοπάτια.
  - `io/mesh3d-material-import/import-c4d-materials.ts` `buildBodyFaceCommands` — και οι δύο base-branches
    (OBJ/C4D per-object `faces.size===0` **και** το uniform collapse των per-face) → `SetEntityFaceAppearanceMapCommand`.
  - **Boy-scout (ίδιο λανθάνον bug):** το ζωντανό «όλο το στοιχείο» του `PolygonMaterialPanel` έγραφε κι
    αυτό merge-set → route πλέον στο `applyEntityFaceAppearanceMap` + `entireElementFaceMap`. ΕΝΑ SSoT
    «όλο το στοιχείο» για file-import **και** live panel — μηδέν divergence.
  - Ο **per-face** (non-uniform) δρόμος μένει `SetFaceAppearanceCommand` (merge) — σωστό: περιγράφει
    συγκεκριμένες όψεις, δεν είναι «όλο».
  - **Tests:** ενημερώθηκαν 3 orchestrator suites (import-c4d / collada / gltf) → assert replace map
    `{ '*': … }` αντί merge-set `faceKey:'*'`. Το clearing/replace καλύπτεται ήδη στο
    `SetEntityFaceAppearanceMapCommand.test.ts` («faces outside value are dropped»). 50 tests πράσινα, jscpd καθαρό.
  - **✅ Ground-truth ΕΠΙΒΕΒΑΙΩΜΕΝΟ (Giorgio, 2026-07-21):** ξαναέβαψε την κολώνα ΟΛΗ ροζ στον C4D →
    import → **ΟΛΕΣ οι όψεις ροζ** (η όψη-ξύλο καθαρίστηκε σωστά). Το «βάψε όλο» είναι πλέον πραγματικά «όλο».
- **2026-07-21 (Φ4/Φ2 — R15 GROUND-TRUTH #2: duplicate material names, `Ισόγειο (22)`)** — Ο Giorgio
  έβαψε μια κολώνα **ροζ** στον C4D με νέο υλικό ονόματι `Mat`· re-import **βάφτηκε ΓΚΡΙ** (όχι ροζ).
  **Ρίζα:** ο C4D R15 επιτρέπει **duplicate material names** — το `.dae` είχε ΔΥΟ `<material name="Mat">`
  (ID1 γκρι `#cccccc`, ID3 ροζ `#ff80ff`). Ο parser χαρτογραφούσε **by name** → ο name-keyed πίνακας
  κρατούσε ΜΟΝΟ το πρώτο "Mat" (γκρι)· ο κόμβος της κολώνας (`target="#ID3"`) → name "Mat" → γκρι.
  **Fix (`dae-material-parse.ts` `parseMaterials`):** COLLADA binding γίνεται **by ID** (μοναδικό),
  όχι by name (πρακτική των μεγάλων). Σε σύγκρουση ονόματος με **διαφορετικό** flat χρώμα, το 2ο+ υλικό
  παίρνει μοναδικό όνομα `<name>#<id>` (π.χ. `Mat#ID3`) ώστε ο κόμβος να πάρει το ΔΙΚΟ του χρώμα. Ίδιο
  χρώμα/όνομα → κοινό όνομα (τα Nestor `bmat_*`/`mat-*` που dedup-άρουν νόμιμα δεν χαλάνε). Μετά το fix:
  κολώνα → `{colorHex:'#ff80ff'}` = **ροζ ✅** (επαληθευμένο στο πραγματικό αρχείο). +unit test (dup "Mat").
  ⚠️ Ισχύει για **flat χρώμα**· duplicate **textured** names (Βήμα 3) δεν καλύπτονται ακόμα.
- **2026-07-21 (Φ2 Βήμα 1 — EXPORT round-trip identity· η βάση για τα υλικά round-trip)** —
  **Ρίζα (μετρημένη από `Ισόγειο.nestor.json`):** το export ονόμαζε τα per-face textured υλικά
  `tex_<υφή>` (Φ5.1c), ΟΧΙ με το Nestor material id — άρα στο re-import το `tex_wood_albedo` δεν
  λυνόταν σε κανένα υλικό (`resolveKnownId`→null) → no-op. Το baseline έδειχνε ΟΛΑ τα textured
  `#ffffff` (λόγω `applyTextureSet`) → `detectRepaint` άχρηστο για υφές. **Χωρίς σταθερή ταυτότητα
  στο export, ΚΑΝΕΝΑ import υλικών δεν δουλεύει.** **Fix (2 σημεία, reuse-only):**
  - `bim-3d/materials/MaterialCatalog3D.ts` `getFaceMaterial3D` — σφραγίζει `userData.nestorMaterialId
    = materialId` στο (cached) per-face textured υλικό. Σταθερό ανά `bmat_*` (μοναδικό source→clone)·
    catalog `mat-*` που μοιράζονται texture key κρατούν το τελευταίο id (αποδεκτό — ίδια εμφάνιση·
    Βήμα 2 το ακριβοποιεί).
  - `export/core/mesh3d/mesh3d-materials.ts` `resolveMaterialName` — νέα προτεραιότητα #2: αν το
    per-face υλικό (`matId=null`) έχει σφραγισμένο `nestorMaterialId` → όνομα = **αυτό** (`bmat_oak`),
    πριν πέσει στο legacy `tex_<υφή>` fallback (#3, για materials χωρίς id). Το texture filename
    ακολουθεί (`textures/bmat_oak.jpg`). **Φ5.1c dedup διατηρείται** (διαφορετικά ids → διαφορετικά
    αρχεία), τώρα by-identity αντί by-texture-path.
  - **Αποτέλεσμα:** per-face `bmat_*` υλικό → export name `bmat_oak` → re-import
    `resolveImportAppearance('bmat_oak')` → `{materialId:'bmat_oak'}` (name-based, ήδη υποστηριζόμενο).
    Ξεκλειδώνει το 🅱️ round-trip **user materials**. Catalog `mat-*` (Βήμα 2) + ξένες υφές (Βήμα 3) TODO.
  - **Tests (65 πράσινα):** identity naming (`bmat_*` όχι `tex_*`, dedup, legacy fallback αμετάβλητο) +
    end-to-end round-trip (`assignExportMaterials`→`serialiseCollada`→`parseColladaScene`→resolve) +
    regression Φ5/collada/face-appearance. jscpd καθαρό.
  - **⚠️ Ground-truth PENDING (Giorgio):** (α) export → επιβεβαίωσε ότι τα ονόματα είναι `bmat_*`/`mat-*`
    (όχι `tex_*`)· (β) **regression Φ5.2**: οι υφές πρέπει να ΦΑΙΝΟΝΤΑΙ ακόμα στον R15 (τα ονόματα
    άλλαξαν, η δομή/υφές ίδιες)· (γ) 🅱️: ο συνεργάτης εφαρμόζει υπάρχον `bmat_*` σε ΟΛΟ στοιχείο → import.
- **2026-07-21 (Φ4 — R15 GROUND-TRUTH: πραγματικό C4D `.dae` output, `Ισόγειο-C4D-EXPORT.dae`)** —
  Ο Giorgio έβαψε στον C4D R15.037 και re-import — **δεν άλλαξε τίποτα**. Ανάλυση του πραγματικού
  αρχείου αποκάλυψε **δύο** πράγματα:
  - **🔴 Bug (διορθώθηκε):** ο native COLLADA exporter του C4D R15 γράφει **`symbol="Material1"`** για
    ΟΛΑ τα `<instance_material>` (ΟΧΙ το δικό μας `sym_i`) και **ενώνει** τα per-face groups σε ΕΝΑ
    `<triangles>` ανά geometry. Ο parser απαιτούσε `sym_i` → `symbolIndex` επέστρεφε `null` → **όλα** τα
    bindings απορρίπτονταν → `materialName: null` → no-op (0/42 objects). **Fix:** `nodeBindings`
    επιστρέφει πλέον ΚΑΙ `ordered` λίστα (dominant per-object, ανεξάρτητα symbol) ΚΑΙ `bySymbolIndex`
    (per-face μόνο όταν υπάρχουν `sym_i` + faceKeys). Μετά το fix: **42/42 objects** διαβάζονται σωστά.
  - **⚠️ Θεμελιώδη όρια (ΟΧΙ bug):** (α) **per-face round-trip μέσω C4D = αδύνατο** — ο R15 exporter
    πετά το `<extra profile="NESTOR">` ΚΑΙ ενώνει τα groups, άρα η ανά-όψη ταυτότητα χάνεται εντελώς
    (per-face δουλεύει ΜΟΝΟ όταν το `.dae` δεν πέρασε από C4D). (β) **Το `Trunk.1` του Giorgio ήταν
    ΥΦΗ** (`bamboo/Ξερό-bark-21.jpg`), όχι flat χρώμα· το import υλικών κατεβάζει **χρώματα + γνωστά
    library υλικά**, ΟΧΙ νέες υφές από τον δίσκο του συνεργάτη — αυτό είναι **Φ2 (textures import),
    ⬜ TODO**. Στο συγκεκριμένο αρχείο ΟΛΑ τα υλικά ήταν είτε DNA (`elem-*`/`mat-*` → σωστό no-op)
    είτε textured (`tex_*`, `Trunk.1` → Φ2), άρα κανένα «ξένο flat χρώμα» να κατέβει.
  - **Πρακτικό συμπέρασμα:** για να δει ο χρήστης βαφή να «κατεβαίνει» από C4D **σήμερα**, βάφει με
    **flat χρώμα** (όχι υφή) → εφαρμόζεται **per-object** (όλο το στοιχείο, αφού ο C4D ένωσε τις όψεις).
    Per-face + textures από C4D = μελλοντικές φάσεις (geometry-based matching / Φ2).
  - **Tests:** +C4D-style fixture (`symbol="Material1"`, ID targets, χωρίς `<extra>` → per-object). jscpd καθαρό.
- **2026-07-21 (Φ4 — COLLADA `.dae` per-face IMPORT)** — Το **import** σκέλος του full round-trip:
  ο Νέστωρ διαβάζει `.dae` που γύρισε ο συνεργάτης (C4D R15) και «κατεβάζει» χρώματα/υλικά **ανά όψη**
  στα ίδια BIM στοιχεία. **Λύνει το OBJ κενό (Φ3.1β):** εκεί το per-face re-import ήταν blocked γιατί
  το OBJ δεν κουβαλά την αρίθμηση όψεων· το COLLADA το κουβαλά πλέον σε `<extra><technique
  profile="NESTOR"><face_keys><k>…</k></face_keys>` (write-side: `mesh3d-collada-geometry.ts`, ο R15
  αγνοεί άγνωστα `<extra>` profiles → μηδέν regression). **Αρχιτεκτονική = mirror OBJ/glTF, μηδέν νέο
  downstream:**
  - **Parser** `io/mesh3d-material-import/dae-material-parse.ts` (pure, testable, native `DOMParser`):
    `<library_materials>`+`<library_effects>` → `Map<name, ImportedMaterial>` (flat `<diffuse><color>`
    sRGB → hex· textured `<diffuse><texture>` → skip, name-based· `<transparency>` → opacity)·
    `<library_visual_scenes>` `<node>` → objects· `<instance_material symbol="sym_i" target="#mat_j">`
    (index `i` από το `sym_i`, ΟΧΙ θέση) ζιπαρισμένο με τα `<extra>` faceKeys → `faceMaterials`. Node
    χωρίς `<extra>` → dominant per-object (legacy-safe). **Ίδιο σχήμα εξόδου** με `obj-mtl-parse` /
    `gltf-scene-parse` → ο κοινός πυρήνας (`applyImportedAppearance` → `matchObjectsToEntities` →
    `resolveImportAppearance` → `SetFaceAppearanceCommand`, ΕΝΑ undo) τρέχει **αυτούσιος**.
  - **Wrapper** `import-collada-appearance.ts` (λεπτός, `charset:'unicode'` — το `.dae` είναι UTF-8 XML,
    ίδιο με glTF· + optional `.nestor.json` baseline για repaint detection, όπως glTF).
  - **UI** `C4dMaterialImportButton.tsx`: +`.dae` στο accept + format branch (ΕΝΑ κουμπί, καμία νέα i18n).
  - **SSoT (boy scout, N.18):** εξήχθησαν δύο κοινά modules για να ΜΗΝ γίνουν structural clones —
    `@/lib/xml/xml-dom.ts` (generic parse+DOM helpers, ο Tekton reader refactor-ίστηκε να τα reuse) +
    `io/mesh3d-material-import/rgb-unit-hex.ts` (RGB 0..1 → hex, κοινό OBJ `Kd` + COLLADA `<color>`).
    `jscpd:diff` καθαρό.
  - **Round-trip identity:** τα αμετάβλητα textured υλικά (Φ5.1c `tex_*`) **δεν** είναι DNA/known →
    `resolveImportAppearance` → `null` (no-op, σωστό — η όψη κρατά την υφή της). Repaint/known/flat →
    override στη σωστή όψη.
  - **Tests (jest, 106 πράσινα):** `dae-material-parse.test.ts` (round-trip guard: `serialiseCollada`
    → `parseColladaScene`, per-face/textured/opacity/multi-node/escaping/errors)· wrapper wiring·
    `<extra>` write-side· `xml-dom` SSoT· regression Tekton + OBJ.
  - **⚠️ ΕΚΚΡΕΜΕΙ R15 ground-truth (Giorgio):** βάψε μια όψη στοιχείου στον C4D R15 → export `.dae` →
    re-import στον Νέστωρ → η όψη παίρνει το νέο χρώμα/υλικό. Μέχρι τότε το Φ4 είναι code+jest DONE, όχι
    πλήρως επιβεβαιωμένο end-to-end.

- **2026-07-21 (Φ3.1δ — COLLADA binding: αντιγραφή native C4D δομής)** — **Bug:** ο R15 φόρτωνε τα
  υλικά με σωστά χρώματα στο Material Manager αλλά άφηνε τη γεωμετρία **γκρι** — **ακόμα και single-
  material κύβος** (άρα ο R15 δεν εφάρμοζε **ΚΑΜΙΑ** ανάθεση, ούτε per-object). Αποκλείστηκε η διαφάνεια
  (καθαρό opaque = πάλι γκρι). **Ground-truth:** ο Giorgio εξήγαγε native `.dae` από τον ίδιο τον C4D
  R15.037 (`CINEMA4D 15.037 COLLADA Exporter`) → σύγκριση byte-δομικά με το δικό μας. **Ρίζα:** ο
  αυστηρός (FBX-SDK) importer του R15 τιμά το `bind_material` **ΜΟΝΟ** όταν κάθε `<instance_material>`
  κουβαλά `<bind_vertex_input>` προς **υπαρκτό UV set** — το spec-valid binding μας (χωρίς UV/
  bind_vertex_input) αγνοούνταν. **Fix (αντιγραφή native C4D):** (1) `<source>` UV `(0,0)` ανά geometry
  + `<input semantic="TEXCOORD" set="0" offset=last>` σε κάθε `<triangles>` + τρίτος ordinal `0` ανά
  κορυφή στο `<p>`· (2) `<bind_vertex_input semantic="UVSET0" input_semantic="TEXCOORD" input_set="0"/>`
  σε κάθε `<instance_material>`· (3) shader `<lambert>`→**`<blinn>`** + `sid="common"`→**`sid="COMMON"`**
  (όπως τα colored υλικά του native). Flat χρώμα ⇒ η τιμή UV αδιάφορη (ένα μοναδικό `(0,0)`, μηδέν
  παραμόρφωση). Αρχεία: `mesh3d-collada-geometry.ts`, `mesh3d-collada-writer.ts` + tests. **84
  mesh3d+formats tests ✅**, `jscpd:diff` **καθαρό**, ≤500/≤40 ✅. **✅ ΕΠΙΒΕΒΑΙΩΘΗΚΕ (ground-truth
  Giorgio, R15.037):** πραγματική εξαγωγή κολώνας με per-face χρώμα από τον Νέστωρ → **τα 2 χρώματα
  εμφανίζονται στις 2 όψεις της κολώνας μέσα στο C4D**. Το binding διαβάζεται σωστά. Bug closed.

- **2026-07-21 (Φ3.1 — COLLADA `.dae` export)** — **Κρίσιμο ground-truth: ο native OBJ importer του
  C4D R15 ΔΕΝ διαβάζει υλικά** (Preferences → Wavefront OBJ Import = μόνο Scale/Normals/Optimize· ούτε
  single red cube δεν βγήκε κόκκινο). Άρα ο group-aware OBJ writer (Φ3.1α) είναι **σωστός αλλά ανεπαρκής
  για R15**. Λύση: **νέο 3Δ format COLLADA 1.4.1** (`format: 'dae'`) — η τομή «γράφουμε» × «R15 με
  χρώματα» (FBX=κλειστό, 3DS=8.3, η three δεν έχει DAE exporter). Δικός μας writer
  (`mesh3d-collada-writer.ts` + `mesh3d-collada-geometry.ts`): per-face `<triangles material="sym_i">`
  ανά `geometry.group` + `<bind_material>` — **ίδιο group model με τον OBJ writer**. SSoT reuse:
  `assignExportMaterials`, `applyExportUnit`, `escapeXml`. Χρώμα **sRGB** (διορθώνει το linear bug του
  `.mtl`)· μονάδα ψημένη **ΚΑΙ** δηλωμένη στο `<unit>` (διπλή ασφάλεια R15)· `up_axis=Y_UP`. Wiring
  types/adapter/service/dialog/i18n(el+en). **84 mesh3d+formats tests ✅**, `jscpd:diff` **καθαρό**.
  **Πλήρες τεκμήριο στο ADR-668** (owner του 3Δ format-set). **Ground-truth e2e:** red cube `.dae` στο
  R15 → πρέπει καθαρό κόκκινο ανά όψη (στον Giorgio).

- **2026-07-21 (Φ3.1α — per-face OBJ export, group-aware writer)** — Ο **στόχος** του χρήστη είναι
  Cinema 4D **R15 (2013)** που ανοίγει **μόνο OBJ** (ο glTF importer μπήκε στο R2024)· άρα το per-face
  που έλυσε η Φ3 για glTF **δεν έφτανε** στο R15.
  - **Ρίζα (μετρημένο, `OBJExporter.js:~44-48`):** ο stock three `OBJExporter.parseMesh` διαβάζει
    **μόνο** `mesh.material.name` (μία γραμμή). Όταν το `mesh.material` είναι **array** (per-face,
    ADR-539) το `.name` είναι `undefined` ⇒ γράφει **κανένα** `usemtl` και **αγνοεί** τα
    `geometry.groups`. Ο βρόχος faces γράφει ΟΛΑ τα `f` σε ένα ενιαίο μπλοκ.
  - **Σχεδιαστική απόφαση (χρήστης):** «όπως οι μεγάλοι» — Blender/C4D/Maya γράφουν **ΕΝΑ `o`** με
    **πολλά `usemtl` blocks** (ένα ανά material group). Απορρίφθηκε το «pre-split σε single-material
    children» (θα έσπαγε το «ένα object = ένα στοιχείο» → μη-standard, μπελάς στην επιστροφή).
  - **Αρχεία (2):**
    1. `export/core/mesh3d/mesh3d-obj-writer.ts` (**νέο**) — `serialiseObjGroupAware`: ΕΝΑ `usemtl`
       ανά `geometry.group` πριν τα `f` του group, σειρά = `buildFacedIndex` (bottom, top, side:i,
       hole:h:k). Single-material = **byte-for-byte ίδιο** με stock (μηδέν regression). Χειρίζεται
       indexed + non-indexed, παγκόσμιοι δείκτες κορυφών όπως ο stock.
    2. `export/core/mesh3d/mesh3d-serialise.ts` — ο `serialiseObj` καλεί πλέον τον group-aware writer
       αντί για `new OBJExporter().parse()`.
  - **Tests:** `mesh3d-obj-writer.test.ts` (6 νέα: single-material parity με stock byte-for-byte ×2,
    per-group usemtl ×2, πραγματικό faced prism, ομοιόμορφη βαφή). Σύνολο mesh3d export/import/
    roundtrip: 609 πράσινα. `jscpd:diff` καθαρό.
  - **🔴 ΓΝΩΣΤΟ ΟΡΙΟ (Φ3.1β):** ο re-import per-face **δεν** υλοποιήθηκε. Το OBJ δεν έχει κανάλι για
    την αρίθμηση όψεων (το glTF την κουβαλά node-level)· μόνο όνομα υλικού + σειρά επιβιώνουν στο C4D,
    και **δεν έχουμε τεκμήριο** αν το C4D R15 διατηρεί τη σειρά όψεων στην επαν-εξαγωγή. Το order-based
    parsing θα ήταν **μαντεψιά** → αναβλήθηκε μέχρι μέτρηση σε πραγματικό C4D-round-tripped αρχείο
    («ground-truth ΠΡΙΝ parser»). Ο υπάρχων ανά-στοιχείο import (dominant/majority vote) **συνεχίζει
    αμετάβλητος** — μηδέν regression.
- **2026-07-21 (Φ3 — per-face material round-trip, ΜΟΝΟ glTF)** — Έλυσε το «🔴 ΓΝΩΣΤΟ ΟΡΙΟ» του
  ADR-683 §11 (2026-07-21): μόλις ένα στοιχείο αποκτούσε per-face appearance (ADR-539) γινόταν
  multi-material mesh· το `assignExportMaterials` έκανε **skip** τα multi-material → στην
  επαν-εξαγωγή τα per-face υλικά έβγαιναν **ανώνυμα** και εκτός baseline → ο **2ος** γύρος
  συνεργασίας έσπαγε (μετρημένο: 81 ανώνυμα κόκκινα + 1 named σοβάς). Ο 1ος γύρος (φρέσκο μοντέλο →
  βαφή → import) δούλευε ήδη πλήρως.
  - **Μετρημένη συμπεριφορά three (jest probe, τεκμήριο όχι υπόθεση):** ο `GLTFExporter` σπάει ένα
    multi-material mesh σε **ένα primitive ανά `geometry.group`**· ο `GLTFLoader` το επιστρέφει ως
    **`THREE.Group` με ένα single-material child mesh ανά primitive** (ΟΧΙ mesh με `material[]`).
    Το node-level `mesh.userData` (άρα και το `faceKeyByMaterialIndex`) **επιβιώνει ακέραιο** στο
    Group, στην αρχική σειρά· τα ονόματα υλικών επιβιώνουν verbatim· η αντιστοίχιση
    primitive↔child είναι 1:1 ντετερμινιστική. Per-primitive `extras` **δεν είναι εφικτά**
    (`geometry.userData` αντιγράφεται ίδιο σε όλα τα primitives) → η «διεύθυνση όψης» ταξιδεύει
    **μόνο** ως το node-level array + η θέση μέσα του.
  - **Αρχεία (5):**
    1. `export/core/mesh3d/mesh3d-materials.ts` — `assignExportMaterials` ονοματίζει πλέον **και**
       τα array υλικά, ανά στοιχείο, colour-based (`mat_<hex6>`), μέσω νέου `registerNamedMaterial`.
       glTF → named per-primitive υλικά. Το OBJ (stock `OBJExporter`, όχι group-aware) εξακολουθεί
       να παίρνει μόνο το dominant υλικό — τα ονόματα φτάνουν στο `.mtl`/baseline, όχι σε ψεύτικο
       per-face `usemtl`.
    2. `io/mesh3d-material-import/obj-mtl-parse.ts` — `ObjectMaterialAssignment` +=
       `faceMaterials?: ReadonlyMap<string, string|null>`.
    3. `io/mesh3d-material-import/match-objects-to-entities.ts` — `MatchedObject` += `faceMaterials?`.
    4. `io/mesh3d-roundtrip/gltf-scene-parse.ts` — `collectGltfObjects` αναγνωρίζει faced solid
       (Group-of-children ή single Mesh με `userData.faceKeyByMaterialIndex`), χτίζει `faceMaterials`
       (zip κατά θέση), fingerprint/solid από merged representative (reuse κεντρικού
       `mergeGeometries`), worldBox από node, skip των per-face children (δεν είναι ξεχωριστές
       οντότητες).
    5. `io/mesh3d-material-import/import-c4d-materials.ts` — `applyImportedAppearance` βγάζει
       per-face `SetFaceAppearanceCommand` ανά `FaceKey`· **collapse σε ΕΝΑ `BASE_FACE_KEY '*'`**
       όταν όλες οι όψεις βάφτηκαν το ίδιο (idempotent, μηδέν artificial per-face split όταν δεν
       χρειάζεται)· back-compat χωρίς `faceMaterials` (OBJ path, legacy manifests).
  - **SSoT:** η αρίθμηση όψεων μένει **ΕΝΑ** SSoT (`bim-three-faced-prism.ts::faceKeyByMaterialIndex`,
    node-level `userData`) — ταξιδεύει αυτούσια, **μηδέν** δεύτερος υπολογισμός στον import (το
    αρχικά σχεδιασμένο «extract ordering helper» **δεν χρειάστηκε**, γιατί το node-level array ήδη
    κουβαλά τη σειρά). Ο import readback ήταν ήδη έτοιμος για arrays (`collectGltfMaterials`
    iterate-άρει ήδη σε ADR-683 Φ2-UI).
  - **Tests:** 134 υπάρχοντα πράσινα + νέα Φ3 tests (gltf-scene-parse faced-solid parsing,
    assignExportMaterials array-naming, import-c4d-materials per-face + collapse).
  - **Γνωστό όριο (τίμια, νέο):** ένα προϋπάρχον 3-γραμμο idiom
    (`children.length === 1 ? children[0] : new CompositeCommand(children)`) υπάρχει τώρα και στο
    `import-c4d-materials.ts` **και** στο `bim-3d/ui/apply-face-appearance.ts` — **δεν** εξήχθη σε
    κοινό helper σε αυτή τη συνεδρία (το 2ο αρχείο είναι κοινό με άλλον πράκτορα ταυτόχρονα). Boy
    Scout on-touch υποψήφιο (N.0.2), όχι blocking.
  - **Ενημέρωση ADR-683 §11:** το «🔴 ΓΝΩΣΤΟ ΟΡΙΟ» εκείνης της καταχώρησης σημειώθηκε ΕΠΙΛΥΜΕΝΟ.

- **2026-07-19** — Δημιουργία ADR. Ground-truth mapping export↔import. Φ1 pure core (parse/resolve/match)
  + orchestrator (`import-c4d-materials.ts`: enumerate all-floor entities → match → resolve → per-level
  `SetFaceAppearanceCommand` base `'*'` σε ΕΝΑ `CompositeCommand`). 14 jest tests πράσινα.
- **2026-07-19 (Φ1-UI)** — `C4dMaterialImportButton.tsx` (LevelPanel, κάτω από τον wizard): file picker
  `.obj/.mtl` → `importC4dMaterials` → toast «βάφτηκαν X / ταίριαξαν Y / Z χωρίς αντιστοίχιση». i18n
  keys `c4dMaterialImport.*` (el+en). Φ1 πλήρες end-to-end.
- **2026-07-19 (Φ1.1-c, finish render fix)** — Live bug: το `paint-red` γραφόταν στον σοβά αλλά έμενε
  άβαφος. Ρίζα: ο finish silhouette color-resolver (`structural-finish-attribution.ts`) παίρνει το ορατό
  χρώμα ΜΟΝΟ από `faceOverride.colorOverride` — ΟΧΙ από `materialId` (ξέρει μόνο plaster/structural, όχι
  wall-covering catalog ids). Fix στο `appearanceToFinishOverride`: βάζει ΠΑΝΤΑ `colorOverride` (catalog
  id → hex από `listWallCoveringMaterials`, + `materialId` για BOQ· flat → hex). Test προσαρμοσμένο.
- **2026-07-19 (Φ1.1-b, C4D R15 ground truth)** — Μετρημένο σε πραγματικό export: ο OBJ exporter του
  **Cinema 4D R15** ΔΕΝ γράφει `.mtl` (οι Preferences → Wavefront OBJ Export έχουν ΜΟΝΟ «Scale» — καμία
  επιλογή materials). Γράφει `usemtl <όνομα>` αλλά μηδέν `mtllib`/`.mtl` → το flat `Kd` χρώμα δεν
  επιβιώνει. **Λύση name-based (Revit/IFC convention):** (α) όνομα υλικού = catalog id → χρώμα από τον
  κατάλογο· (β) όνομα υλικού = hex (`#8B4513` ή `8B4513`) → `hexColorFromName` το διαβάζει ως `colorHex`,
  χωρίς `.mtl`. Το `.mtl` `Kd` παραμένει πρώτο όταν υπάρχει (newer exporters). Βελτιωμένο warning
  (`noChanges`) όταν το αρχείο έχει objects αλλά μηδέν αλλαγή. +2 tests (28 σύνολο). Files:
  `resolve-import-appearance.ts` (`hexColorFromName`), `C4dMaterialImportButton.tsx`, i18n `noChanges`.
- **2026-07-19 (Φ1.1)** — Σοβάς round-trip + skip αμετάβλητων (§4.3). Ρίζα: ο σοβάς είναι merged
  building-skin με synthetic bimId → έπεφτε στα «χωρίς αντιστοίχιση». (1) Νέο `finish-import-routing.ts`
  (`isFinishSkinName` / `finishTargetTypes` / `buildFinishImportCommands`): τα `structural-finish-*`
  objects δρομολογούνται ξεχωριστά → ομοιόμορφο σοβά-override σε όλα τα μέλη της ζώνης (κολόνα/δοκάρι/
  πλάκα) ανά κάθετη πλευρά, μέσω του υπάρχοντος `SetFinishFaceOverrideCommand` (ADR-449 PART B, `{materialId}`
  ή `{colorOverride}`). (2) `resolveImportAppearance` → `null` για αμετάβλητο DNA (`isUnchangedNestorMaterial`:
  `mat-*`/`elem-*`/`mat_<hex6>`) → μηδέν άχρηστα overrides. Orchestrator: split body↔finish (τα σοβά-skins
  φεύγουν από τα unmatched), ΕΝΑ CompositeCommand (body + finish). Toast: `{applied} σώματα + {finish} μέλη
  σοβά`. +12 jest tests (26 σύνολο, πράσινα). Files: `finish-import-routing.ts` (νέο), `resolve-import-appearance.ts`,
  `import-c4d-materials.ts`, `C4dMaterialImportButton.tsx`, i18n `c4dMaterialImport.success` (el+en).
