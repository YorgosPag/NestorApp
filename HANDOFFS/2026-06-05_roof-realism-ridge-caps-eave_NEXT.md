# HANDOFF — Στέγη πλήρης αληθοφάνεια: κορφιάδες-που-ακολουθούν-κλίσεις + γείσο (overhang/fascia/soffit)

**Ημερομηνία:** 2026-06-05 · **Μοντέλο:** Opus 4.8 · **Mode:** Plan Mode (geometry feature)

> **ΓΛΩΣΣΑ:** Ο Giorgio γράφει & διαβάζει Ελληνικά. ΑΠΑΝΤΑΣ ΠΑΝΤΑ ΣΤΑ ΕΛΛΗΝΙΚΑ.
> **ΠΟΙΟΤΗΤΑ:** «όπως οι μεγάλοι, Revit» — FULL ENTERPRISE + FULL SSOT + ΠΛΗΡΗ ΑΛΗΘΟΦΑΝΕΙΑ. Μηδέν `any`/`as any`/`@ts-ignore`, μηδέν hardcoded strings (i18n SSoT), μηδέν duplicate, αρχεία ≤500 / συναρτήσεις ≤40 γραμμές.
> **COMMIT:** Τα commit τα κάνει **ΜΟΝΟ ο Giorgio** (N.(-1)). Ο agent ΔΕΝ κάνει commit/push.
> **⚠️ SHARED WORKING TREE** με άλλον agent (ADR-408 MEP) — `git add` ΜΟΝΟ specific δικά σου αρχεία, **ΠΟΤΕ `git add -A`**, ΜΗΝ αγγίξεις `adr-index.md`, ΜΗΝ committ-άρεις MEP αρχεία (`mep-*`, `grip-parametric-*`).

---

## 🎯 ΤΙ ΘΑ ΚΑΝΕΙΣ (2 features Revit-style roof detailing — ADR-417 §10 Φ2)

### Feature A — Κορφιάδες που ακολουθούν ΑΚΡΙΒΩΣ τις 2 κλίσεις (ridge/hip caps)
Σήμερα ο κορφιάς είναι **βυθισμένος ημικύλινδρος (dome)** κατά μήκος της ridge line — προσέγγιση, «αγκαλιάζει» αλλά ΔΕΝ κάθεται ακριβώς στις δύο κλίσεις. Revit-true: ο κορφιάς **δράπει πάνω από τα ΔΥΟ γειτονικά «νερά»** — οι δύο κάτω άκρες του κάθονται ΠΑΝΩ στις δύο κεκλιμένες επιφάνειες (σαν πραγματικό κεραμίδι κορυφής που καλύπτει τον αρμό).

### Feature B — Γείσο: overhang + fascia + soffit (eave detailing)
Σήμερα το περιμετρικό πάχος δείχνει τις **γυμνές στρώσεις** (per-layer bands). Revit-true finished: στα **eave edges** (χαμηλές ακμές) μπαίνει:
- **Overhang** — τα κεραμίδια προεξέχουν ~5–15cm πέρα από τον τοίχο/footprint.
- **Fascia** — κατακόρυφη μπάφα (σανίδα) στο μέτωπο του γείσου.
- **Soffit** — οριζόντια κάτω επένδυση κάτω από την προεξοχή.

**ΞΕΚΙΝΑ ΜΕ RECOGNITION (N.0.1):** διάβασε τα αρχεία στον «ΤΕΧΝΙΚΟ ΧΑΡΤΗ» → πρότεινε execution-mode (N.8) + μοντέλο (N.14) → **ρώτησε τον Giorgio με AskUserQuestion τις OPEN DECISIONS** ΠΡΙΝ γράψεις κώδικα.

---

## 🗺️ ΤΕΧΝΙΚΟΣ ΧΑΡΤΗΣ (verified 2026-06-05)

### Α) Ο roof 3D converter — `bim-3d/converters/roof-to-three.ts` (343 γραμμές· διάβασέ το ΟΛΟ)
Pure converter `RoofEntity → THREE.Group`. **UNITS-SAFE** (`toWorld(x,y,zMm,sceneToM)` = `(x*sceneToM, zMm*MM_TO_M, -y*sceneToM)`· canvas xy→m, mm z→m). Axis: DXF X=East,Y=North → world x=East, y=Up, z=−North.
- **`buildDepthPrism(face, topDepthMm, botDepthMm, sceneToM, base)`** — γενικός: ένα prism μεταξύ δύο vertical depths κάτω από την top surface (slope-parallel). `setBoxWorldUvs(flat)` + uv2.
- **`buildFaceLayerSolids(face, layers, ...)`** — σπάει το «νερό» σε **ένα sub-solid ΑΝΑ DNA στρώση** (top→bottom cumulative depth). ✅ DONE (per-layer realism).
- **`addFaceMeshes(group, face, ctx)`** — per-layer αν dna, αλλιώς monolithic single solid. Κάθε mesh `tagRoofMesh(mesh, roofId, materialId, levelId)` (όλα μοιράζονται `roof.id` → picking).
- **`buildRidgeCap(line, sceneToM, base)`** — ΣΗΜΕΡΙΝΟΣ κορφιάς: ημικυκλικός dome (semicircle profile, flat-down) swept κατά μήκος `line.a→line.b`, **βυθισμένος** κατά `RIDGE_CAP_SINK_M=0.05` (αλλιώς «πετάει»). `RIDGE_CAP_RADIUS_M=0.06`, `RIDGE_CAP_SEGMENTS=8`, υλικό `RIDGE_CAP_MATERIAL_ID='mat-roof-tile'`. **← Feature A ΑΝΤΙΚΑΘΙΣΤΑ/ΒΕΛΤΙΩΝΕΙ ΑΥΤΟ.**
- **`addRidgeCaps(group, ridges, ctx)`** — loop `geometry.ridges` filter `kind∈{ridge,hip}` → `buildRidgeCap`. eave/valley → χωρίς cap.
- **`roofToMesh(roof, levelId?, baseElevationM=0)`** — orchestrator: faces → addFaceMeshes· ridges → addRidgeCaps.
- Helpers: `packRingPositions`, `buildPrismIndex` (cap+sides), `packCapPositions`, `buildCapIndex`, `resolveRoofSurfaceMaterialId` (top DNA layer→params.material→null).

### Β) Το data model — `bim/types/roof-types.ts`
- **`RoofParams`**: `outline: Polygon3D`, `edges: readonly RoofEdgeSlope[]` (μία ανά κορυφή outline, length==vertices), `basePivotZ` (mm στάθμη γείσου/eave datum), `thickness` (== `dna.totalThickness`), **`dna?: SlabDna`** (στρώσεις top→bottom), `material?: string` (monolithic), `sceneUnits?`.
- **`RoofEdgeSlope`** (γρ. 77): `definesSlope: boolean` — **`definesSlope===false` ⇒ η ακμή είναι ΓΕΙΣΟ (eave, χαμηλό σημείο)**. ⭐ ΑΥΤΟ είναι το SSoT για Feature B (ποιες outline ακμές είναι eaves).
- **`RoofFace`** (γρ. 129): `outline: readonly Point3D[]` (κλειστό, z=κεκλιμένο mm), `slopeRatio` (rise/run), `projectedAreaM2`, `grossAreaM2`. Ολόκληρη η όψη σε ΕΝΑ επίπεδο.
- **`RoofRidgeLine`** (γρ. 141): `a`, `b` (Point3D canvas xy + mm z), **`kind: 'ridge'|'hip'|'valley'|'eave'`**.
- **`RoofGeometry`** (γρ. 152): `footprint`, `faces`, **`ridges: readonly RoofRidgeLine[]`**, `bbox`, areas, `shape: RoofShape` ('flat'|'mono-pitch'|'gable'|'hip'|'complex'), `ridgeHeightMm`.

### Γ) ⚠️ ΚΡΙΣΙΜΟ — Η μηχανή `bim/geometry/roof-geometry.ts` ΠΑΡΑΓΕΙ ΜΟΝΟ `kind:'ridge'`
`computeRoofGeometry(params)` γραμμή ~275 κάνει **μόνο** `ridges.push({a,b,kind:'ridge'})` (gable). **ΔΕΝ παράγει hip / valley / eave lines.** Συνέπειες:
- **Feature A (hips):** για hip roofs (Φ2 — σήμερα graceful flat fallback) δεν υπάρχουν hip lines → ο κορφιάς δεν θα τα πιάσει. Αν θες hip caps, η μηχανή πρέπει να παράγει `kind:'hip'`. Για gable (σημερινό σκόπιμο scope) το ridge αρκεί.
- **Feature B (eaves):** ΤΑ EAVE EDGES ΔΕΝ ΕΙΝΑΙ ΣΤΟ `ridges`. Παράγονται από **`params.edges[i].definesSlope===false`** → η αντίστοιχη ακμή `outline[i]→outline[i+1]` είναι eave. ⭐ Αυτό είναι το input για το γείσο.

### Δ) Materials / υφές (όλα DONE αυτή τη συνεδρία)
- **`mat-roof-tile`** (κεραμίδι, terracotta `0x9e4a2c`) → texture slug **`roof-tiles`** (Poly Haven CC0, `public/textures/roof-tiles/{albedo,normal,roughness,ao}.jpg` 2K). `elem-roof` element key. `mat-wood`→wood slug (battens/sarking). Defs: `bim/materials/material-catalog-defs.ts` (+ `getCategoryMaterialDef`). Map: `bim/materials/bim-texture-registry.ts`.
- **SSoT λίστα υλικών:** `bim/materials/construction-materials.ts` (`CONSTRUCTION_MATERIAL_IDS` + `isConstructionMaterialId` + `constructionMaterialLabelKey`). Καταναλώνεται από `SlabDnaEditor.tsx` + `EditRoofTypeDialog.tsx`. Friendly labels: i18n `constructionMaterials.*` (el+en, `dxf-viewer-shell.json`). **Για fascia/soffit material: πρόσθεσε στο catalog + ΑΥΤΗ τη λίστα (μην φτιάξεις νέα).**
- **UV SSoT:** `bim-3d/converters/bim-uv-helpers.ts` — `setBoxWorldUvs(geo)` (per-face world-axis) / `setPlanarWorldUvs` / `ensureWorldUvs`. World-meter UVs ⇒ `repeat=1/tileSizeM` physical tiling.
- Buildup SSoT: `bim/types/roof-buildup.ts` `createTiledRoofBuildup()` (top layer `mat-roof-tile`). Layer type: `bim/types/slab-dna-types.ts` `SlabDnaLayer` = `{id,name,thickness,materialId,zone}`.

---

## 🧭 ΠΡΟΤΕΙΝΟΜΕΝΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗ (επικύρωσε με Giorgio)

### Feature A — slope-following ridge cap
1. Για κάθε `RoofRidgeLine` (ridge), βρες τα **2 γειτονικά faces** (αυτά που μοιράζονται την ακμή a→b· match by shared edge endpoints στα `face.outline`).
2. Πάρε τα slope directions / normals των 2 faces στην ακμή.
3. Φτίαξε cap **profile που τα δύο κάτω άκρα του κάθονται ΠΑΝΩ στις 2 κλίσεις** (π.χ. ρηχό ανεστραμμένο-V ή rounded cap με τα tangent edges στις επιφάνειες). Sweep κατά μήκος a→b. Υλικό `mat-roof-tile`.
4. **SSoT:** κράτα το στον ίδιο `roof-to-three.ts` (ή νέο pure `roof-ridge-cap.ts` αν >40-line functions· πρόσεξε circular import με toWorld — κάνε export helper ή πέρασέ το).
5. Αν θες hips: η μηχανή `roof-geometry.ts` πρέπει να παράγει `kind:'hip'` (μεγαλύτερο task — ρώτησε αν είναι in-scope).

### Feature B — γείσο (overhang + fascia + soffit) ανά eave edge
1. Eave edges = `params.edges.filter(e => !e.definesSlope)` → οι αντίστοιχες `outline` ακμές.
2. **Overhang:** offset την eave ακμή προς τα ΕΞΩ (οριζόντιο outward normal) κατά `overhangM`, επέκτεινε το «νερό» (ή ξεχωριστή λωρίδα κεραμιδιού) — η top surface ακολουθεί την ίδια κλίση.
3. **Fascia:** κατακόρυφη quad κατά μήκος της (overhung) eave ακμής, ύψος = fascia depth. Υλικό configurable (default `mat-wood`).
4. **Soffit:** οριζόντια quad κάτω από την προεξοχή (από την fascia μέχρι τον τοίχο). Υλικό `mat-wood`/`mat-plaster`.
5. **SSoT:** νέο pure helper (π.χ. `roof-eave-detail.ts`) με world-meter UVs (`setBoxWorldUvs`). Reuse `toWorld` (export ή pass).

---

## ❓ OPEN DESIGN DECISIONS (ρώτησε Giorgio με AskUserQuestion ΠΡΙΝ κώδικα)
1. **Ridge cap σχήμα:** rounded (ημικυλινδρικό κεραμίδι) **ή** angular (ανεστραμμένο-V); Πλάτος (default ~12–25cm);
2. **Hips:** in-scope τώρα (απαιτεί `roof-geometry.ts` να παράγει `kind:'hip'`) **ή** μόνο gable ridge προς το παρόν;
3. **Overhang απόσταση:** σταθερή default (π.χ. 10cm) **ή** user param στο RoofParams/RoofType; (Revit = type param «Rafter Cut / Overhang».)
4. **Fascia/soffit υλικό:** σταθερό `mat-wood` **ή** configurable (πεδίο στο RoofType + dropdown);
5. **Fascia/soffit διαστάσεις:** σταθερές (fascia height ~20cm, soffit = overhang width) **ή** params;
6. **Persistence:** τα overhang/fascia params αποθηκεύονται στο `RoofParams`/`RoofTypeParams` (Firestore — χρειάζεται schema + audit-tracked-fields update) **ή** σταθερές σταθερές (μηδέν persistence);
7. **2D:** θα φαίνονται τα γείσα/κορφιάδες και στην κάτοψη (RoofRenderer) **ή** μόνο 3D;

---

## 📊 N.8 EXECUTION MODE — εκτίμηση
Feature A μόνο gable ridge: ~2–3 αρχεία (roof-to-three + test) → **Plan Mode**.
Feature A+B με hips + persistence: ~6–10 αρχεία (roof-to-three + roof-geometry engine + roof-types/schema + audit-tracked-fields + RoofRenderer 2D + tests + i18n) σε 2+ domains → **πιθανόν Orchestrator (ρώτα Giorgio)**. Μοντέλο: **Opus 4.8** (geometry + cross-cutting).

---

## ✅ ΤΙ ΟΛΟΚΛΗΡΩΘΗΚΕ ΗΔΗ ΑΥΤΗ ΤΗ ΣΥΝΕΔΡΙΑ (όλα UNCOMMITTED — ο Giorgio committ-άρει· tsc 0 πλην pre-existing `mesh-to-object3d.ts:124` ADR-411)

**ADR-413 §2D Phase 3 — user-upload 3D PBR υφές ανά υλικό** (✅ DONE, 19+26 tests PASS, storage rule DEPLOYED):
- NEW: `bim-3d/materials/user-material-registry.ts` (reactive SSoT registry· version-aware· stale-load guard· teardown dispose), `bim-3d/materials/pbr-texture-config.ts` (shared `configurePbrTexture` SSoT), `bim/services/bim-material-texture-upload.service.ts`, `app/UserMaterialRegistryHost.tsx` (always-on feeder, mounted DxfViewerTopBar), `ui/panels/materials/MaterialPbrTexturesSection.tsx`, `ui/panels/materials/hooks/useMaterialPbrTextureUpload.ts` + 3 test suites.
- MOD: `bim/types/bim-material-types.ts` (`PbrMaterialTextures`+`pbrTextures`), `bim/services/MaterialLibraryService.ts`, `bim-3d/materials/MaterialCatalog3D.ts` (`getMaterial3D` routes `bmat_`→`resolveUserMaterial`· version-aware `USER_TEX_CACHE`· dispose), `bim-3d/materials/bim-texture-cache.ts`, `services/upload/utils/storage-path.ts`, `ui/components/shared/MaterialSwatch.tsx` (+albedoUrl), `MaterialEditorDialog.tsx`, `MaterialEditorSections.tsx`, `MaterialsLibraryPanel.tsx`, `WallDnaEditor.tsx`, `storage.rules` (rule `companies/{cid}/bim-material-textures/{materialId}/{file}` **DEPLOYED**), `tests/storage-rules/_registry/coverage-manifest.ts`, i18n `bim-materials.json` el+en. ADR-413 v1.4.

**ADR-417 — Roof 3D material + CC0 κεραμίδι + per-layer + κορφιάδες (basic) + material-list SSoT** (✅ DONE 31 roof tests PASS):
- NEW: `bim/materials/construction-materials.ts`, `public/textures/roof-tiles/{albedo,normal,roughness,ao}.jpg`.
- MOD: `bim-3d/converters/roof-to-three.ts` (per-layer sub-solids + ridge caps + UVs + material resolution), `bim/types/roof-buildup.ts` (top layer `mat-roof-tile`· `mat-timber`→`mat-wood`), `bim/materials/material-catalog-defs.ts` (`mat-roof-tile`/`elem-roof`/`getCategoryMaterialDef`/`CATEGORY_FLAT_KEY` roofing→elem-roof), `bim/materials/bim-texture-registry.ts` (slug `roof-tiles`), `bim/materials/material-thumbnail-resolver.ts` (roofing→roof-tiles), `ui/ribbon/components/SlabDnaEditor.tsx` + `EditRoofTypeDialog.tsx` (SSoT λίστα), i18n `dxf-viewer-shell.json` el+en (`constructionMaterials.*`). ADR-417 changelog ενημερωμένο. tracker `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` ενημερωμένο.

**✅ BROWSER-VERIFIED από Giorgio:** στέγη με υφή κεραμιδιού + per-layer στρώσεις στο περιμετρικό. **🔧 Ο κορφιάς (basic dome) μόλις μικρύνθηκε+βυθίστηκε (radius 0.06, sink 0.05) — pending Giorgio re-verify.**

---

## ⚠️ SHARED WORKING TREE — ΚΑΝΟΝΕΣ
- **ΠΟΤΕ `git add -A`.** git add ΜΟΝΟ τα δικά σου αρχεία, επιλεκτικά.
- **ΜΗΝ αγγίξεις** `adr-index.md` (άλλος agent).
- **ΜΗΝ committ-άρεις MEP αρχεία** (`mep-*`, `grip-parametric-*`).
- **Commit: ο Giorgio** (N.(-1)). Μετά: ADR-417 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory (N.15).
- **ADR-040:** `roof-to-three.ts` είναι converter (ΟΧΙ micro-leaf)· `RoofRenderer` (2D) είναι CHECK 6D → αν το αγγίξεις (Feature B 2D), STAGE οποιοδήποτε ADR (ADR-417 αρκεί).

## 🧪 TESTS / TSC
- Pre-existing (ΑΓΝΟΗΣΕ): `mesh-to-object3d.ts:124` (ADR-411, param `matId: string`).
- `npx tsc --noEmit` (πάντα `| grep -v "mesh-to-object3d.ts(124"`). Tests: `npx jest "roof"`. Πρόσθεσε unit tests για τα νέα geometry helpers (ridge cap profile· eave detail).

## 📚 ΑΝΑΦΟΡΕΣ
- ADR-417 §10 (Φ2 detailing) · ADR-413 (PBR/υφές) · ADR-412 (family types)
- roof: `roof-to-three.ts` · `roof-types.ts` · `roof-geometry.ts` · `roof-buildup.ts` · `RoofRenderer` (2D) · `bim-uv-helpers.ts`
- materials SSoT: `construction-materials.ts` · `material-catalog-defs.ts` · `bim-texture-registry.ts`
- N.0.1 (ADR-driven) · N.0.2 (Boy-Scout SSoT) · N.6 (enterprise IDs) · N.11 (i18n) · N.15 (tracker)
