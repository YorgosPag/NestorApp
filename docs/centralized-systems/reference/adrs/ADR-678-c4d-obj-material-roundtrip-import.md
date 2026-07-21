# ADR-678 — C4D → Νέστωρ round-trip: εισαγωγή υλικών/χρωμάτων από OBJ+MTL

**Status:** 🟡 IN PROGRESS (Φ1 + Φ1.1 + **Φ3 glTF per-face** done· Φ2 textures + Φ3 OBJ/per-building-plaster TODO)
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
| **Φ2** | Textures (`map_Kd` εικόνες → BIM texture registry, UV) | ⬜ TODO |
| **Φ3** | **Per-face round-trip μέσω glTF** (named array-material primitives → `FaceKey`, ζωντανό ΚΑΙ σε επαναλαμβανόμενο γύρο συνεργασίας) — **OBJ παραμένει per-object dominant** (stock `OBJExporter` δεν είναι group-aware, §3) | 🟢 **DONE (glTF)** |
| **Φ3.1α** | **Per-face OBJ export**: δικός μας group-aware OBJ writer (`mesh3d-obj-writer.ts`) — ΕΝΑ `o <object>` με **πολλά `usemtl` blocks** (ένα ανά `geometry.group`, σειρά = `buildFacedIndex`), όπως Blender/C4D. Single-material = byte-identical με stock. | 🟢 **DONE (export)** |
| **Φ3.1β** | **Per-face OBJ re-import**: το OBJ **δεν** κουβαλά την αρίθμηση όψεων όπως το glTF (`userData.faceKeyByMaterialIndex`)· μόνο όνομα υλικού + σειρά επιβιώνουν στο C4D. Blocked σε **πραγματικό C4D-round-tripped OBJ** για μέτρηση αν το C4D διατηρεί τη σειρά όψεων (order-based) ή χρειάζεται geometry-based αντιστοίχιση («ground-truth ΠΡΙΝ parser»). | ⬜ TODO (evidence-first) |
| **Φ3.1γ** | per-building/per-side σοβάς (πέρα από το ομοιόμορφο-ζώνης της Φ1.1) | ⬜ TODO |
| **Φ3.1 (COLLADA)** | **Per-face COLLADA `.dae` export** — το ΜΟΝΟ εγγράψιμο format που ο C4D **R15 διαβάζει ΜΕ χρώματα** (ο R15 OBJ importer δεν διαβάζει υλικά, μετρημένο). Δικός μας 1.4.1 writer, per-group `<triangles>` + `<bind_material>` + `<bind_vertex_input>` (native C4D δομή, Φ3.1δ). Βλ. ADR-668 changelog 2026-07-21. | ✅ **DONE — ΕΠΙΒΕΒΑΙΩΜΕΝΟ στον R15** (per-face χρώμα κολώνας ορατό, ground-truth Giorgio 2026-07-21) |

## 6. Changelog

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
