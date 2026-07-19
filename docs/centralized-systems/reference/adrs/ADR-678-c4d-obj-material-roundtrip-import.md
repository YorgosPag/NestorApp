# ADR-678 — C4D → Νέστωρ round-trip: εισαγωγή υλικών/χρωμάτων από OBJ+MTL

**Status:** 🟡 IN PROGRESS (Φ1 + Φ1.1 done· Φ2 textures TODO)
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
- **Ανά-όψη (per-polygon) = αναξιόπιστο.** Το export βγάζει ΕΝΑ `o` block ανά στοιχείο, χωρίς
  face-groups· το C4D τριγωνοποιεί/συγκολλά → δεν αντιστοιχίζεται στο δικό μας `FaceKey`.
  **Φ1 = μόνο ανά-στοιχείο (`BASE_FACE_KEY '*'`).**
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
| **Φ3** | Best-effort per-face (usemtl groups μέσα σε object → `FaceKey`) · per-building/per-side σοβάς | ⬜ TODO |

## 6. Changelog

- **2026-07-19** — Δημιουργία ADR. Ground-truth mapping export↔import. Φ1 pure core (parse/resolve/match)
  + orchestrator (`import-c4d-materials.ts`: enumerate all-floor entities → match → resolve → per-level
  `SetFaceAppearanceCommand` base `'*'` σε ΕΝΑ `CompositeCommand`). 14 jest tests πράσινα.
- **2026-07-19 (Φ1-UI)** — `C4dMaterialImportButton.tsx` (LevelPanel, κάτω από τον wizard): file picker
  `.obj/.mtl` → `importC4dMaterials` → toast «βάφτηκαν X / ταίριαξαν Y / Z χωρίς αντιστοίχιση». i18n
  keys `c4dMaterialImport.*` (el+en). Φ1 πλήρες end-to-end.
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
