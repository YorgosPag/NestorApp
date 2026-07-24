# ADR-689 — Εξαγωγή εισαγόμενου πλέγματος στο DXF ως σμιλεμένη γεωμετρία (3DFACE)

**Status:** 🟢 IMPLEMENTED UNCOMMITTED (2026-07-24)
**Related:** ADR-505 §C (solid-fill 3DFACE), ADR-683 (imported-mesh collaboration roundtrip), ADR-411 (bim-mesh-library), ADR-679 Φ5.1b (headless texture prewarm — pattern του drain), ADR-587 (export coverage)

---

## 1. Πρόβλημα / Ζητούμενο (Giorgio 2026-07-24)

Ο Giorgio φόρτωσε ένα `.glb` (καρέκλα «KAREKLA-3»), το είδε **σμιλεμένο** στον 3Δ καμβά, το εξήγαγε
σε `.dxf` και το άνοιξε στο AutoCAD. Οι εισαγόμενες οντότητες βγήκαν **απλά ορθογώνια κουτιά**, όχι
η σμιλεμένη μορφή τους. Ρώτησε γιατί, και ζήτησε **να εξάγονται με σμιλεμένους όγκους** στο DXF.

Ground-truth (από το ίδιο το εξαγόμενο αρχείο): 8 KB, **7 `POLYLINE`**, μηδέν τρίγωνα.

---

## 2. Ευρήματα έρευνας (root cause)

- Στο `export/core/bim-to-dxf-primitives.ts` το `imported-mesh` (BIM entity) πέφτει στο γενικό
  "footprint" path → **μία κλειστή `lwpolyline`** από το `geometry.footprint`.
- Το `footprint` είναι **επίτηδες** το bounding-box ορθογώνιο (`computeCentredBoxFootprint` →
  `centred-box-footprint.ts`), εξωθημένο κατά το ύψος (DXF group-39 thickness) → wireframe **κουτί**.
- Τα ΠΡΑΓΜΑΤΙΚΑ τρίγωνα ζουν μόνο στο async `bimMeshCache` (φορτωμένο glTF) και τα βλέπουν μόνο οι
  2D/3D renderers — **ποτέ ο exporter**. Δεν υπήρχε ΚΑΜΙΑ διαδρομή που να γράφει `3DFACE`/`POLYFACE`
  για εισαγόμενα πλέγματα.

---

## 3. Απόφαση

Διακόπτης χρήστη στο παράθυρο εξαγωγής (απόφαση Giorgio: «κουμπάκι επιλογής», default σμιλεμένο):

- `dxfMeshDetail: 'mesh'` (**default**) → τα πραγματικά 3Δ τρίγωνα του πλέγματος ως DXF `3DFACE`.
- `dxfMeshDetail: 'bbox'` → το ιστορικό bounding-box (ελαφρύ· διαφυγή για πυκνά πλέγματα).

Ένα πυκνό πλέγμα βγάζει χιλιάδες `3DFACE` → βαρύτερο αρχείο (MB-κλίμακα). Αποδεκτό, ελεγχόμενο από τον
διακόπτη.

---

## 4. Υλοποίηση (SSoT reuse — μηδέν διπλή γεωμετρία)

- **Πρόσβαση τριγώνων**: `io/mesh3d-roundtrip/mesh-triangles.ts` (`readWorldPositions` +
  `forEachTriangle` + `triangleArea`) — ίδια world-space SSoT με όγκο/hash.
- **World placement**: `importedMeshToObject3D` (ADR-683/411) — ίδιο με το 3Δ view.
- **Carrier**: `makeSolidFacesHatch` (νέο κοινό SSoT στο `solid-fill-geometry.ts`) — solid HATCH με
  `dxfFaces`, που ο writer (`dxf-ascii-entity-dispatch`) εκπέμπει ως ΕΝΑ `3DFACE` ανά face. Ο overlay
  collector (finish/rebar) μεταφέρθηκε στο ΙΔΙΟ factory (κατάργηση του ιδιωτικού `SolidFillHatch`,
  αποφυγή sibling clone — N.18).
- **Νέο module**: `export/core/imported-mesh-faces.ts` — `buildImportedMeshFaceCarriers` (async
  pre-pass) + `buildImportedMeshFaceCarrier` (per-entity). Coordinate mapping (three world m → DXF
  `Fill3DCorner`): `x = worldX/sceneToM`, `y = -worldZ/sceneToM`, `zMm = worldY*1000`.
- **Async**: το πλέγμα φορτώνεται async· νέο `bimMeshCache.awaitInFlightScenes()` (καθρέφτης του
  `awaitInFlightTextureSets`, ADR-679) περιμένει τα in-flight glTF loads ΠΡΙΝ διαβαστούν τα τρίγωνα.
  Σε `error`/miss → `null` carrier → fallback στο bounding-box (belt-and-suspenders).
- **Threading**: `flattenSceneEntitiesForDxf` / `decomposeBimEntityToDxfPrimitives` δέχονται
  `DxfFlattenContext` (`meshDetail` + `meshFaceCarriersById`). Στο mesh mode το imported-mesh
  αντικαθίσταται από τους carriers· αλλιώς κρατά το bbox path. Ο pre-pass τρέχει ΜΙΑ φορά για όλους
  τους ορόφους στο `runDxfExport` (καλύπτει active/all-zip/all-single).
- **UI/i18n**: `dxfMeshDetail` select (DXF-gated) + `export.dxfMeshDetail` / `export.meshDetailModes.*`
  (el+en).

### Coverage (ADR-587)

`entity-export-coverage.ts` → `'imported-mesh': { dxf: 'decompose' }` **αμετάβλητο** (mesh→3DFACE είναι
πάλι «decompose σε primitives»). Τα capability anchors (missing set, count 31) δεν αλλάζουν.

---

## 5. Verification

- jest: `imported-mesh-faces` (carrier/mapping), `bim-to-dxf-primitives` (mesh-mode → carriers,
  bbox-mode → lwpolyline), writer round-trip (hatch+`dxfFaces` → `3DFACE`).
- Browser: KAREKLA-3.glb → Εξαγωγή ▸ DXF ▸ «Λεπτομερής μορφή» → AutoCAD (SE Isometric) = σμιλεμένη
  καρέκλα. «Απλό κουτί» → κουτί (regression parity).

---

## 6. Φ2 — Wireframe view style στα εισαγόμενα πλέγματα (2026-07-24)

**Ζητούμενο (Giorgio):** αφού η εξαγωγή βγήκε τέλεια, γιατί στο **Στυλ Προβολής → Συρμάτινο** του 3Δ
καμβά η καρέκλα μένει γεμάτη/χρωματιστή, ενώ στο AutoCAD φαίνονται όλα τα τριγωνάκια;

**Root cause:** το Wireframe (ADR-446) κρύβει επιφάνειες (`faceMode:'none'`) + βάζει ακμές, αλλά **μόνο**
για δομικά (μέσω `withFaceMode` + `attachEdgesProjection`). Τα εισαγόμενα πλέγματα έχουν ξεχωριστό δρόμο
υλικών (embedded PBR, ADR-683) που δεν περνά από κανένα → έμεναν shaded.

**Λύση (Giorgio: «Πλήρης, όπως AutoCAD»):** νέο `bim-3d/converters/imported-mesh-wireframe.ts` →
`attachImportedMeshWireframe(object)`, καλείται στο `importedMeshToObject3D` μετά τα υλικά. Στο
`faceMode:'none'`: (1) κρύβει τις επιφάνειες (exclusive `buildInvisibleFaceMaterial`, ADR-665-safe),
(2) προσθέτει `LineSegments(WireframeGeometry)` ανά child mesh = **κάθε τριγωνάκι** (full triangulation,
x-ray). Χρώμα ανά background (σκούρο→ανοιχτό γκρι / ανοιχτό→σχεδόν μαύρο). No-op στα άλλα styles (μηδέν
regression). Ξανατρέχει στο rebuild-on-`visualStyle` (`use-bim3d-vg-resync` block f)· export path
ανεπηρέαστο (ο collector διαβάζει `Mesh` geometry, αγνοεί τα `LineSegments`).

---

## 7. Φ3 — Barycentric GPU wireframe, single-pass (2026-07-24)

> ⚠️ **Η Φ2 αντικαταστάθηκε ΟΛΟΚΛΗΡΩΤΙΚΑ.** Το `imported-mesh-wireframe.ts` και το test του
> **διαγράφηκαν**. Ό,τι λέει η §6 είναι ιστορικό.

**Ζητούμενο (Giorgio):** τα τριγωνάκια φάνηκαν, **αλλά η πλοήγηση βάρυνε**. Ζήτησε state-of-the-art
«όπως οι μεγάλοι, και καλύτερα» — χωρίς εκπτώσεις, χωρίς όριο χρόνου.

### 7.1 Root cause της Φ2

Ο `bimMeshCache.getInstance` επιστρέφει `template.clone(true)`, και το three **δεν** κλωνοποιεί
γεωμετρίες — 40 καρέκλες δείχνουν στο ΙΔΙΟ buffer. Το `WireframeGeometry` όμως έχτιζε **νέο line
buffer + νέο draw call ανά instance ανά child mesh**. Επιπλέον το WebGL αγνοεί το
`LineBasicMaterial.linewidth` → aliased 1px, και φαίνονταν οι εσωτερικές διαγώνιες τριγωνοποίησης.

### 7.2 Απόφαση: βαρυκεντρικές συντεταγμένες στο fragment stage

Δίνοντας στις τρεις κορυφές κάθε τριγώνου τη βάση (1,0,0)/(0,1,0)/(0,0,1), το `min(b)` που
παρεμβάλλει η κάρτα **ΕΙΝΑΙ** η απόσταση του pixel από την πλησιέστερη ακμή. Άρα το wireframe
ζωγραφίζεται μέσα στο ίδιο pass των επιφανειών:

| | Φ2 | Φ3 |
|---|---|---|
| Buffers | 1 line buffer ανά instance ανά child | **1 attribute ανά asset** (memoised) |
| Draw calls | +1 ανά mesh | **−1 ανά mesh** (το mesh ΕΙΝΑΙ το wireframe) |
| Γραμμή | aliased 1px, μη ρυθμιζόμενη | anti-aliased, screen-space, ρυθμιζόμενη |
| Ακμές | κάθε τριγωνάκι | crease 30° ή πλήρης (επιλογή χρήστη) |
| Bytes/κορυφή | — | **4** (ένα packed float) |

### 7.3 Οι τρεις περιορισμοί που όρισαν την υλοποίηση (μετρημένοι)

1. **`MeshBasicMaterial` + `onBeforeCompile`, ΟΧΙ `ShaderMaterial`.** Το
   `section-clip-applicator.ts` δέχεται clipping planes μόνο σε built-in mesh materials (ADR-452
   allowlist)· ένα `ShaderMaterial` θα σταματούσε το Section Box να κόβει τα πλέγματα.
2. **Ρητό attribute, ΟΧΙ `gl_VertexID`.** three `0.170` τρέχει WebGL2 αλλά με πηγή GLSL ES 1.00.
   (Το `fwidth` δουλεύει: το WebGL2 ενεργοποιεί σιωπηρά το `OES_standard_derivatives` σε ESSL1.)
3. **`customProgramCacheKey` υποχρεωτικό.** Χωρίς αυτό το three θεωρεί δύο `MeshBasicMaterial` με
   ίδια defines ισοδύναμα και μπορεί να δώσει στο wire material το πρόγραμμα ενός ΑΛΛΟΥ basic
   material της σκηνής (π.χ. snap marker) — δηλαδή wireframe χωρίς τον κώδικα του wireframe.

### 7.4 Adaptive degradation — **ΔΕΝ έγινε, σκόπιμα**

Το SSoT audit βρήκε πλήρες σύστημα ήδη στη θέση του: `IdleDetector` → `QualityModulator` /
`SSAOModulator`, και `isInteracting` → `renderRaster()` που παρακάμπτει τον composer στην πλοήγηση.
Το barycentric wireframe έχει **μηδενικό** επιπλέον κόστος ανά frame, άρα δεν υπάρχει τίποτα να
υποβαθμιστεί. Δεύτερος μηχανισμός = διπλότυπο.

### 7.5 Εμβέλεια: ΟΛΑ τα πλέγματα (ο SSoT ανέβηκε ένα επίπεδο)

Η Φ2 κάλυπτε μόνο τα εισαγόμενα. Το audit έδειξε ότι **έπιπλα** (ADR-410) και **εξαρτήματα Η/Μ**
(ADR-406/408) περνούν από τον ΙΔΙΟ `meshToObject3D` και έμεναν κι αυτά γεμάτα στο Συρμάτινο — δύο
σιωπηλά bugs. Το `attachMeshWireframe` κλήθηκε στο `meshToObject3D::finalize`: **ένα call site**,
καμία οντότητα δεν μπορεί να ξεχαστεί.

### 7.6 «Κρυφή Γραμμή» δωρεάν, σε ΕΝΑ pass

Το `faceMode:'hidden-line'` αγνοούνταν εξίσου από τα πλέγματα. Ένα uniform (`uWireFillMode`) το
λύνει μέσα στο ίδιο material: `mix(λευκό, χρώμα ακμής, κάλυψη)` με `depthWrite` — αδιαφανείς
όψεις-occluder **μαζί** με τις ακμές τους, εκεί που η κλασική υλοποίηση θέλει δύο περάσματα.

### 7.7 Αρχεία

**Νέος φάκελος `bim-3d/wireframe/`** (SSoT):
- `mesh-wire-adjacency.ts` — δίεδρη γωνία → μάσκα ορατών ακμών ανά τρίγωνο (ίδιο κατώφλι 30° με το
  `EdgesGeometry` των δομικών· κβαντισμός κορυφών 1e-4 όπως το three).
- `mesh-wire-encoding.ts` — packing σε **ένα** float `aWireCode` (γωνία + μάσκα), η αναδιάταξη
  ακμή→βαρυκεντρική συνιστώσα (γίνεται στη CPU, όχι ανά pixel), και ο **JS καθρέφτης**
  `wireEdgeAlpha` του fragment υπολογισμού.
- `mesh-wire-geometry.ts` — `WeakMap` memo ανά πηγή × mode → ΕΝΑ παράγωγο ανά asset· μηδενική
  αντιγραφή attributes για non-indexed πηγή.
- `mesh-wire-shader.ts` — τα GLSL κομμάτια (σχόλια μόνο ASCII).
- `mesh-wire-material.ts` — αποκλειστικό `MeshBasicMaterial` ανά mesh (ADR-665 clipping), `toneMapped:false`.
- `attach-mesh-wireframe.ts` — η εφαρμογή + το `isMeshWireframeActive()` predicate.

**Νέο `bim-3d/edges/bim-edge-colors.ts`** (N.0.2 boy scout): το `#1a1a1a` ήταν copy-paste σε **τρία**
αρχεία· τώρα ζει σε ένα και τα τρία το διαβάζουν.

**Ρυθμίσεις** (πρότυπο ADR-687 Φ9, optional πεδία → **χωρίς** `BIM_SETTINGS_VERSION` bump):
`meshWireMode` (`feature` default / `full`) + `meshWireWidthPx` (1.0, clamped 0.5–4) στο
`bim-visual-style.ts` → `bim-render-settings-types.ts` → store → `use-bim3d-vg-resync` block (f).

**UI:** `MeshWireWidgets.tsx` («Ακμές Πλέγματος» Radix select + «Πάχος Ακμών» πάνω στο υπάρχον
`RibbonNumericFieldWidget`), στο View tab δίπλα στο «Στυλ Προβολής». i18n el+en.

### 7.8 Verification

jest **37/37** στο `bim-3d/wireframe/` + **774** regression σε converters/edges/materials. jscpd
καθαρό. Δεν τρέχει tsc (N.17). Το `face-material-catalog.test.ts` αποτυγχάνει **προϋπάρχοντα**
(ADR-687 Φ9: το τεστ περιμένει `transmission` ενώ το `glassQuality` default είναι `light`) — άσχετο
με τη Φ3, το `bim-3d/materials/` δεν αγγίχτηκε.

---

## Changelog

- **2026-07-24 (Φ3)** — Barycentric single-pass GPU wireframe. **Αντικαθιστά τη Φ2** (το
  `imported-mesh-wireframe.ts` + test διαγράφηκαν). Νέος φάκελος `bim-3d/wireframe/` (6 modules) +
  `bim-edge-colors.ts` SSoT. Εμβέλεια ανέβηκε στο `meshToObject3D` → καλύπτει και έπιπλα + Η/Μ (δύο
  σιωπηλά bugs). «Κρυφή Γραμμή» στα πλέγματα σε ένα pass. Νέοι άξονες `meshWireMode` /
  `meshWireWidthPx` + ribbon UI + i18n. Adaptive degradation ΔΕΝ έγινε — περιττό (§7.4).
  jest 37 νέα ✓, jscpd ✓.
- **2026-07-24 (Φ1)** — Εξαγωγή. Νέο `imported-mesh-faces.ts` + `awaitInFlightScenes` +
  `makeSolidFacesHatch` SSoT + `dxfMeshDetail` UI/i18n + `DxfFlattenContext` threading. Root cause: το
  footprint ήταν bbox, τα τρίγωνα ζούσαν μόνο στο `bimMeshCache`.
- **2026-07-24 (Φ2)** — Wireframe view style στα εισαγόμενα πλέγματα (full triangulation, όπως AutoCAD).
  Νέο `imported-mesh-wireframe.ts` → `attachImportedMeshWireframe`, wired στο `importedMeshToObject3D`.
  jest 3/3.
