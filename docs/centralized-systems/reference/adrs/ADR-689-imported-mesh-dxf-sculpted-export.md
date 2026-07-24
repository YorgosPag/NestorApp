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

## Changelog

- **2026-07-24 (Φ1)** — Εξαγωγή. Νέο `imported-mesh-faces.ts` + `awaitInFlightScenes` +
  `makeSolidFacesHatch` SSoT + `dxfMeshDetail` UI/i18n + `DxfFlattenContext` threading. Root cause: το
  footprint ήταν bbox, τα τρίγωνα ζούσαν μόνο στο `bimMeshCache`.
- **2026-07-24 (Φ2)** — Wireframe view style στα εισαγόμενα πλέγματα (full triangulation, όπως AutoCAD).
  Νέο `imported-mesh-wireframe.ts` → `attachImportedMeshWireframe`, wired στο `importedMeshToObject3D`.
  jest 3/3.
