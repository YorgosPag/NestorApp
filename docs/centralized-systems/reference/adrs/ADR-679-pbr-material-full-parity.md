# ADR-679 — PBR Material «Full Parity»: πλήρες σύστημα υλικών/υφών ανά όψη (C4D-grade)

**Status:** 🟢 Φ2a ΥΛΟΠΟΙΗΘΗΚΕ (import name→όλα τα υλικά + color registry)· 🟢 Φ5.1a ΥΛΟΠΟΙΗΘΗΚΕ (DAE writer texture-capable + πραγματικά UVs)· 🟢 Φ5.1b ΥΛΟΠΟΙΗΘΗΚΕ + **R15 GROUND-TRUTH ✅** (texture-byte bundling + headless prewarm· checker-cube `.dae`+`.zip` άνοιξε στον C4D R15.037 με σωστά χαρτογραφημένη υφή σε όλες τις όψεις)· 🟢 **Φ2b ΥΛΟΠΟΙΗΘΗΚΕ** (per-face PBR **render** — σώμα μέσω `resolveFaceMaterial`→`getMaterial3D` + faced-prism UVs· σοβάς `materialId` ήταν ήδη textured, καμία αλλαγή)· Φ2c εκκρεμεί· **Φ5.2 (per-face texture export) ξεκλειδώθηκε**
**Date:** 2026-07-21
**Owner:** Giorgio
**Σχετικά:** ADR-413 (BimMaterial library + PBR textures) · ADR-539 (per-face appearance) · ADR-449 (structural finish) · ADR-678 (C4D↔Νέστωρ round-trip) · ADR-511 (wall-covering catalog)

---

## 1. Η επιθυμία (Giorgio 2026-07-19)

Full material parity με το C4D: «ό,τι χρώματα, υφές και υλικά βάζω, να τα βλέπω στον Νέστωρ». Ο χρήστης
θέλει να κάνει διπλό κλικ σε ένα υλικό και να ανοίγει **πλήρες πάνελ ρυθμίσεων** (όπως ο C4D Material
Editor), και το υλικό (με την **υφή** του) να αποδίδεται σε **οποιαδήποτε όψη** (σώμα ΚΑΙ σοβά).

## 2. Απόφαση αρχιτεκτονικής: PBR, ΟΧΙ κατά-γράμμα C4D R15

**PBR (Physically-Based Rendering), το industry standard** (Revit / Twinmotion / Enscape / glTF / νέο C4D)
— ΟΧΙ αντιγραφή των 13 legacy καναλιών του C4D **R15 (2013)** (Luminance/Fog/Glow/Environment/Displacement
= άχρηστα σε αρχιτεκτονική). Giorgio ενέκρινε PBR 2026-07-19.

**Κανάλια-στόχος (BIM-relevant):** Base Color + Texture (albedo) · Roughness · Metalness · Normal/Bump ·
Opacity/Transparency · (προαιρετικά) Emission. Δίνουν ~95% του οπτικού αποτελέσματος και ταξιδεύουν
καθαρά σε glTF **και** C4D.

## 3. Τι ΥΠΑΡΧΕΙ ήδη (ground truth 2026-07-19 — ΔΙΑΒΑΣΕ ΠΡΙΝ ΧΤΙΣΕΙΣ)

Ο Νέστωρ έχει **μεγάλο** μέρος της μηχανής — το όραμα είναι κυρίως **ΣΥΝΔΕΣΗ**, όχι from-scratch:

| Κομμάτι | Πού | Τι δίνει |
|---------|-----|----------|
| **BimMaterial library** (ADR-413) | `bim/types/bim-material-types.ts`, `bim/services/MaterialLibraryService.ts` | Πλήρες material def (id, name, category, ATOE/κόστος, **PbrMaterialTextures**) |
| **PBR texture set** | `PbrMaterialTextures` (ADR-413): `albedoUrl/normalUrl/roughnessUrl/aoUrl/tileSizeM` | Revit «Appearance asset» — albedo υποχρεωτικό, υπόλοιπα optional |
| **Texture registry + upload** | `bim/materials/bim-texture-registry.ts`, `bim/services/bim-material-texture-upload.service.ts`, `ui/panels/materials/hooks/useMaterialPbrTextureUpload.ts` | Ανέβασμα/αποθήκευση υφών |
| **PBR render** | `bim-3d/materials/pbr-material-builder.ts`, `bim-3d/materials/bim-texture-cache.ts`, `user-material-registry.ts` (`getUserMaterialTextureSet`) | THREE PBR materials από texture set |
| **Face-material palette UI** | «Υλικά όψης» (Σώμα/Σοβάς) — swatches wall-covering | Ήδη ζωντανό στο LevelPanel |

## 4. Το ΚΕΝΟ (γιατί οι υφές δεν φαίνονται ανά όψη σήμερα)

**Το per-face «βάψιμο» (ADR-539) είναι FLAT-COLOUR-ONLY.** Το `resolveFaceMaterial`
(`bim-3d/materials/face-appearance-material.ts`) παίρνει `FaceAppearance` → `faceAppearanceColorHex` →
`MeshStandardMaterial({ color })`. **Καμία υφή/normal/roughness ανά όψη.** Ο σοβάς (ADR-449) το ίδιο:
`FinishFaceOverride` έχει μόνο `materialId`/`colorOverride`/`thickness` — το ορατό χρώμα βγαίνει ΜΟΝΟ από
`colorOverride` (βλ. ADR-678 Φ1.1-c). Άρα ακόμη κι αν ένα materialId δείχνει σε textured BimMaterial, η
όψη αποδίδεται flat.

**Το κλειδί του project:** επέκταση του per-face appearance (σώμα ΚΑΙ σοβάς) ώστε να δείχνει σε **πλήρες
BimMaterial** (PBR texture set) και να το **render-άρει** μέσω του υπάρχοντος `pbr-material-builder`.

## 5. Phased roadmap

| Φάση | Περιεχόμενο | Μέγεθος |
|------|-------------|---------|
| **Φ2a** ✅ | **Import name→όλα τα υλικά.** `resolveImportAppearance` (ADR-678) αναγνωρίζει user materials (`bmat_*`, by id ή ανθρώπινο όνομα) + wall-covering + δάπεδα (όχι μόνο wall-covering) μέσω injected `KnownMaterialResolver` (ο button τον τροφοδοτεί με `useMaterialLibrary`). Name-based, όπως Revit/IFC. **+** ενοποιημένος `material-color-registry` λύνει το χρώμα ΚΑΘΕ id σε 3D/2D/σοβά. | Μικρό |
| **Φ2b** ✅ | **Per-face PBR (η καρδιά) — ΥΛΟΠΟΙΗΘΗΚΕ (render, όχι export).** `resolveFaceMaterial` (ADR-539) έγινε thin delegate: `colorHex`→flat (νικά)· `materialId`→**reuse** `getMaterial3D` (ήδη texture-aware μέσω `pbr-material-builder`+`bim-texture-cache`+`user-material-registry`) σε DoubleSide variant· χωρίς override→base. `buildFacedPrism` απέκτησε UVs (τα faced solids είχαν μηδέν). **Finding:** ο σοβάς (`FinishFaceOverride.materialId`, ADR-449) ήταν ΗΔΗ textured μέσω `getMaterial3D` — καμία αλλαγή χρειάστηκε εκεί· μόνο το `colorOverride` μένει flat by design (visual-only hex). Ξεκλειδώνει Φ5.2 (export). | Μικρό (2 αρχεία κώδικα) |
| **Φ2c** | **Material editor UI (C4D-parity).** Διπλό κλικ σε swatch → πάνελ PBR (Base Color/Texture upload, Roughness, Metalness, Normal, Opacity). Reuse `useMaterialPbrTextureUpload`. Εμφανές «όνομα για C4D». | Μεσαίο |
| **Φ3** | glTF PBR round-trip (το glTF ΕΧΕΙ πραγματικά PBR + textures — αντίθετα από το OBJ/R15). Προαιρετικό. | Μεσαίο |
| **Φ5** | **COLLADA/DAE texture export (Νέστωρ→C4D R15) — FULL PARITY track.** Ground-truth correction (2026-07-21): ο R15 **DAE** importer **ΚΟΥΒΑΛΑ** textures (αποδεδειγμένο: native Aeron `.dae` με `library_images`+sampler), σε αντίθεση με το OBJ που ΔΕΝ διαβάζει υλικά. Άρα το DAE είναι ο textured δρόμος για R15. Sub-phases: **Φ5.1a** DAE writer texture-capable + πραγματικά UVs ✅· **Φ5.1b** texture-byte bundling (fetch από Storage → loose `textures/*` σε `.zip`) + headless prewarm ✅ (**SSOT correction: ΟΧΙ `fflate`** — reuse του υπάρχοντος zero-dep `zip-pack.ts` + `image-export-shared.fetch*` + `packageArtifacts`, ίδιο pattern με το DXF image-fill eTransmit· ένας packer, όπως οι μεγάλοι)· **Φ5.2** per-face texture export (εξαρτάται Φ2b)· **Φ5.3** per-triangle. | **Μεγάλο** |

**Σειρά:** Φ2a (γρήγορη νίκη, ξεκλειδώνει catalog/user materials στο round-trip) → Φ2b (η ουσία) → Φ2c (UX). **Full-parity export track (εντολή Giorgio 2026-07-21):** Φ5.1 (whole-element υφή export, R15-testable) → Φ2b/Φ3/Φ5.2 (per-face) → Φ5.3 (per-triangle) → import COLLADA parser (orchestrator).

## 6. Κανόνες / SSoT (μην αναπαράγεις)

- **ΜΗΝ** φτιάξεις νέο material type — επέκτεινε το `BimMaterial` (ADR-413).
- **ΜΗΝ** φτιάξεις νέο PBR builder — reuse `pbr-material-builder.ts` + `bim-texture-cache.ts`.
- **ΜΗΝ** φτιάξεις νέο per-face σύστημα — επέκτεινε ADR-539 (`FaceAppearance`) + ADR-449 (`FinishFaceOverride`).
- Round-trip = **name-based** πάντα (C4D R15 δεν στέλνει data — μόνο `usemtl <όνομα>`· βλ. ADR-678).
- N.8: το Φ2b είναι orchestrator-scale (materials + rendering + import) — ζήτα έγκριση mode πριν.

## 7. Changelog

- **2026-07-21 — Φ2b ΥΛΟΠΟΙΗΘΗΚΕ (per-face PBR render· σώμα + finding σοβά).** Το κενό (§4): το per-face
  «βάψιμο» (ADR-539) ήταν FLAT-COLOUR-ONLY — όψη με `materialId` που δείχνει σε textured `BimMaterial`
  απέδιδε flat χρώμα, όχι υφή. **Fix (2 αλλαγές κώδικα, ZERO νέο type/builder/system, N.5/N.12 SSoT reuse):**
  1. `bim-3d/materials/face-appearance-material.ts::resolveFaceMaterial` έγινε **thin delegate**: `colorHex` →
     `getFaceColorMaterial3D(hex)` (flat matte DoubleSide, cached ανά hex, **νικά** το `materialId` — κρατά
     τη 2D/3D χρωματική συμφωνία)· `materialId` (χωρίς `colorHex`) → **gated**: ΜΟΝΟ βιβλιοθήκης `bmat_*`
     υλικό με ανεβασμένο albedo ΚΑΙ realistic-materials ON → `getFaceMaterial3D(materialId)` = **reuse** του
     ήδη texture-aware `getMaterial3D` (preload→resync ήδη wired) σε DoubleSide variant (ορατά τοιχώματα
     τρύπας)· wall-covering (ADR-511)/δάπεδο (ADR-419) ids, οποιοδήποτε id με realistic OFF ή χωρίς
     ανεβασμένη υφή, ΚΑΙ χωρίς override → **ΑΜΕΤΑΒΛΗΤΟ** legacy flat-colour path (`faceAppearanceColorHex`:
     colorHex wins, αλλιώς materialId→catalog color). Gate = αποτροπή regression: χωρίς αυτό το
     `getMaterial3D('paint-red')` θα έπεφτε στο `resolveMaterialKey` default `mat-concrete` → wall-covering
     όψη βαμμένη σαν σκυρόδεμα.
  2. `bim-3d/materials/MaterialCatalog3D.ts` +`getFaceMaterial3D`/`getFaceColorMaterial3D` (+ `FACE_DOUBLE_SIDED`
     WeakMap, κλειδί = source material instance → auto-invalidate στο texture resync swap· + `FACE_COLOR_CACHE`
     Map, disposed στο `disposeMaterialCatalog3D`). **Side-fix (προϋπάρχον leak):** το παλιό
     `resolveFaceMaterial` έχτιζε fresh **uncached** material ανά βαμμένη όψη σε κάθε scene rebuild
     (`BimSceneLayer.clearGroup` disposes μόνο geometry, ποτέ materials).
  3. `bim-3d/converters/bim-three-faced-prism.ts::buildFacedPrism` καλεί `setBoxWorldUvs(flat)` μετά το
     `computeVertexNormals()` — τα faced solids (slab/column/beam/foundation/wall) είχαν **ΜΗΔΕΝ uv/uv2** →
     καμία υφή δεν μπορούσε να αποδοθεί πάνω τους. Το roof είχε ήδη UVs.
  **Finding (καμία αλλαγή χρειάστηκε):** ο σοβάς (ADR-449) ήταν **ΗΔΗ** textured — το `structural-finish-3d.ts`
  καλεί `getMaterial3D(materialId)` για το `materialId` του finish· μόνο το `colorOverride` μένει flat by
  design (visual-only hex contract). Άρα ADR-449 δεν χρειάστηκε κώδικα, μόνο changelog note.
  **UI slice (ολοκληρώνει Φ2b end-to-end — data model + render + UI):** το `PolygonMaterialPanel.tsx`
  (Σώμα layer) δίνει πλέον **ΤΡΙΑ** swatch groups (Cinema 4D Material Manager parity): (1) textured
  catalog PBR υλικά — νέο `FACE_TEXTURE_MATERIAL_IDS` = brick/stone/wood/tile/concrete/metal/plaster/
  roof-tile, (2) τα `bmat_*` βιβλιοθήκης υλικά του χρήστη (μέσω **reuse** `useMaterialLibrary`), (3) τα
  υπάρχοντα wall-covering flat paints (διατηρούνται). Catalog+library swatches δείχνουν πραγματική
  υφή-thumbnail μέσω **reuse** `<MaterialSwatch>`. Drag-drop + click-apply αναλλοίωτα (ίδιο
  `FaceAppearance.materialId` path). Νέο pure helper `bim-3d/ui/polygon-material-swatches.ts`
  (`FACE_TEXTURE_MATERIAL_IDS` + `buildLibraryMaterialSwatches`). i18n: `constructionMaterials.mat-brick`/
  `mat-stone` (el+en, dxf-viewer-shell). **Gate extension:** `MaterialCatalog3D.hasFaceTexture` επεκτάθηκε
  — επιστρέφει true ΚΑΙ για catalog `mat-*`/`elem-*` id με texture slug (`textureSlugForKey(resolveMaterialKey(id))`),
  πέρα από `bmat_*` με albedo· ξένα wall-covering/finish paint ids (όχι `mat-`/`elem-`) παραμένουν
  εκτός → flat colour (καμία `mat-concrete` πτώση). Reuse (μηδέν διπλότυπο): `MaterialSwatch`,
  `useMaterialLibrary`, `constructionMaterialLabelKey`, `MATERIAL_TEXTURE_MAP`. Αποτέλεσμα: όψη βαμμένη
  με textured catalog ή library υλικό δείχνει πλέον την υφή της σε 3D (realistic ON).
  **Reuse (ΜΗΔΕΝ διπλότυπο, §6):** κανένα νέο material type (επεκτείνει `BimMaterial`/`FaceAppearance`), κανένα
  νέο PBR builder (`pbr-material-builder`+`bim-texture-cache`+`user-material-registry` μέσω `getMaterial3D`),
  κανένα νέο per-face σύστημα (επεκτείνει ADR-539). N.7.1 (≤500/≤40) τηρήθηκε, DoubleSide διατηρήθηκε (hole
  walls), ΟΧΙ tsc (N.17). **Scope:** per-face texture **render** στην εφαρμογή (3D σώμα + σοβάς μέσω
  `materialId`) — **ΟΧΙ ακόμη export** (Φ5.2, τώρα ξεκλειδωμένο αφού ο DAE writer Φ5.1 ήδη ξέρει textures).
  Detail cross-ref: **ADR-539 changelog (Φ4d)**.
- **2026-07-21 — Φ5.1b ΥΛΟΠΟΙΗΘΗΚΕ (texture-byte bundling + headless prewarm).** Εντολή Giorgio:
  «όπως οι μεγάλοι + FULL SSOT». **SSOT audit (grep όλο το `src/`) ΠΡΙΝ κώδικα → διόρθωση πλάνου:**
  το handoff πρότεινε νέο dep `fflate`, αλλά υπάρχει ήδη **zero-dependency zip SSOT** — άρα το fflate
  θα ήταν διπλότυπο (N.5/N.12/N.18· οι μεγάλοι DCC δεν κουβαλούν δεύτερο packer). **Reuse (μηδέν νέο dep):**
  `export/core/zip-pack.ts` (STORED zip) + `image-export-shared.ts` (fetch-with-timeout, το ΙΔΙΟ που
  κατεβάζει DXF image-fill rasters, ADR-643) + `export-service.packageArtifacts` (zip delivery). Ίδιο
  pattern με το AutoCAD eTransmit. **Αλλαγές:**
  (1) **Awaitable prewarm drains** (additive, μη-breaking) — `inFlight: Map<slug/id, Promise>` +
  `awaitInFlightTextureSets()` / `awaitInFlightUserMaterialTextures()` στα `bim-texture-cache.ts` +
  `user-material-registry.ts`. Τα preload* παρέμειναν fire-and-forget· απλώς κρατούν πλέον το promise
  για drain (δεν υπήρχε awaitable πουθενά — μετρημένο).
  (2) **`mesh3d-texture-prewarm.ts` (ΝΕΟ)** — `buildTexturedMesh3dScene`: double-build **gated**. build#1
  πυροδοτεί ως side-effect τα cold preloads (η ίδια resolution logic = μηδέν διπλότυπη «ποια υφή θέλει
  αυτό το υλικό») → await στα δύο drains → αν κάτι φόρτωσε, build#2 (cache-hit) δίνει `.map`· αλλιώς
  build#1 τελικό (**μηδέν σπατάλη**). **ΧΩΡΙΣ mutation του render-settings store** (N.7.2): σέβεται το
  live `realisticMaterials` toggle — OFF ⇒ κανένα preload ⇒ single build. (Explicit «Εξαγωγή υφών»
  διακόπτης = follow-up με δικό του UI+i18n.)
  (3) **`mesh3d-texture-bundle.ts` (ΝΕΟ)** — `bundleTextureArtifacts`: dedup ανά `map.fileName` → fetch
  κάθε `map.url` (νέο κοινό `fetchArtifactWithTimeout`, explicit filename = το `.dae` `init_from`) →
  `ExportArtifact[]`. url null / flat → skip· fetch fail → ASCII warning (`texture-bundle:fetch-failed`),
  ποτέ throw.
  (4) **Wiring** `mesh3d-export-adapter.ts`: το **dae** path χτίζεται με `buildTexturedMesh3dScene` +
  bundling artifacts (obj/gltf κρατούν τον sync builder — surgical scope, μηδέν αλλαγή κόστους τους).
  Με ≥1 texture artifact, το `packageArtifacts` παράγει `.zip` (`.zae`-style)· χωρίς υφές, ιστορικό
  `.dae`+manifest ζεύγος. **R15 GROUND-TRUTH ✅ (2026-07-21):** hermetic checker-cube (φτιαγμένο από τον
  πραγματικό `serialiseCollada` + `buildStoredZipBytes`) άνοιξε στον C4D **R15.037** με το κόκκινο/λευκό καρό
  σωστά χαρτογραφημένο σε ΟΛΕΣ τις όψεις → η δομή `.dae` (library_images + surface/sampler + textured
  diffuse + `bind_vertex_input UVSET0`) + το relative-path zip bundling επικυρώθηκαν στην πραγματική
  πλατφόρμα-στόχο. **7 νέα tests** (bundle 4 + prewarm gate 3), 95 mesh3d+formats πράσινα,
  bim-3d materials tests πράσινα, `jscpd:diff` καθαρό, ≤500/≤40 ✅, ΟΧΙ tsc (N.17). Execution: **orchestrator**
  (Phase 1 = 3 παράλληλοι read-only investigation agents για το prewarm contract· coupled edits σε ελεγχόμενη
  σειρά λόγω shared working tree). **Επόμενο:** ground-truth στον R15 (textured `BimMaterial`, realistic ON →
  `.zip` → υφή στην όψη). Φ2b/Φ5.2 = per-face υφή.
- **2026-07-21 — Φ5.1a ΥΛΟΠΟΙΗΘΗΚΕ (DAE writer texture-capable + πραγματικά UVs).** Εντολή Giorgio:
  **FULL PARITY** χρωμάτων/υλικών/υφών, ανά όψη & ανά τρίγωνο, αμφίδρομα Νέστωρ↔C4D. Ground-truth
  correction: ο R15 **DAE** importer κουβαλά textures (native Aeron `.dae`: `library_images` →
  `<surface>`/`<sampler2D>` newparams → `<diffuse><texture texcoord="UVSET0">`), άρα το DAE (όχι το OBJ)
  είναι ο textured δρόμος. **Αλλαγές (χειρουργικά, δικά μας paths):**
  (1) `ExportMaterialEntry` + optional `map: ExportTextureRef {fileName, url}`· `assignExportMaterials`
  εξάγει το `.map` του THREE υλικού (typed, όχι `any`· url από `texture.image.src`/`userData.url`,
  relative `textures/<matId>.<ext>`).
  (2) `mesh3d-collada-geometry.ts`: γράφει **πραγματικά** `geometry.attributes.uv` στο TEXCOORD source
  (αντί για το placeholder `(0,0)`)· fallback `(0,0)` μόνο όταν λείπει uv (το `<bind_vertex_input>`
  παραμένει — R15 requirement, ADR-678 Φ3.1δ).
  (3) `mesh3d-collada-writer.ts`: `<library_images>` + textured `<effect>` (surface→sampler→texture
  diffuse, native C4D δομή) όταν το υλικό έχει `map`· αλλιώς flat `<diffuse><color>`.
  **Scope:** whole-element υλικά (per-face υφή = Φ2b/Φ5.2, per-triangle = Φ5.3). **13 collada + 4
  materials νέα/ενημ. tests ✅** (88 mesh3d+formats συνολικά), `jscpd:diff` καθαρό, ≤500/≤40 ✅,
  ΟΧΙ tsc (N.17). **Επόμενο (Φ5.1b, πριν R15-visible):** byte-bundling — fetch των .jpg από Storage
  URL → loose files σε `.zip` (`fflate` MIT). Βλ. ADR-678/668.
- **2026-07-19** — Δημιουργία ADR. Απόφαση PBR (όχι legacy C4D R15). Ground-truth της υπάρχουσας μηχανής
  (ADR-413 library + PBR textures + upload + builder ΥΠΑΡΧΟΥΝ· το κενό = per-face flat-colour-only).
  Phased plan Φ2a→Φ2b→Φ2c. Καμία υλοποίηση ακόμα.
- **2026-07-19 — Φ2a ΥΛΟΠΟΙΗΘΗΚΕ.** Δύο μέρη, full SSoT/enterprise, μηδέν διπλότυπα (jscpd καθαρό):
  1. **Ενοποιημένος color registry** (`bim/materials/material-color-registry.ts`, ΝΕΟ): επεκτάσιμος
     provider-registry `getMaterialColorById(id)` — wall-covering (ADR-511) + δάπεδα (ADR-419)
     στατικά· τα library `bmat_*` υλικά δηλώνονται από το `bim-3d/materials/user-material-registry`
     μέσω `registerMaterialColorProvider` (late registration → μηδέν ανοδική εξάρτηση bim/utils→bim-3d,
     καμία κυκλική). Ο ADR-539 `face-appearance-color` + ο σοβάς (`finish-import-routing`) διαβάζουν
     πλέον ΤΟΝ ΙΔΙΟ registry αντί για wall-covering-only (σκοτώθηκε το διπλό `CATALOG_COLOR`). **Άρα
     όψη/σοβάς βαμμένα με δάπεδο ή δικό σου υλικό δείχνουν ΤΟ χρώμα τους, όχι γκρι.** Χρώμα δικού
     υλικού = flat κατά κατηγορία (`getCategoryMaterialDef` → `trueColorToHex`)· υφές = Φ2b.
     Procedural (`proc:*`, ADR-653) ΕΚΤΟΣ by design (2D hatch generator, ποτέ `FaceAppearance.materialId`).
  2. **Import name→όλα τα υλικά** (`io/mesh3d-material-import/known-import-materials.ts`, ΝΕΟ):
     `buildKnownMaterialResolver(userMaterials)` → «όνομα → id» για wall-covering+δάπεδα (by id) και
     library υλικά (by id ΚΑΙ `nameEl`/`nameEn`). **id-first** σε σύγκρουση (Giorgio). Injected στο
     `resolveImportAppearance` + `buildFinishImportCommands` (pure/sync core)· ο `C4dMaterialImportButton`
     τον χτίζει από `useMaterialLibrary` + `useAuth` scope. Tests: +2 νέα suites, ενημέρωση 3 υπαρχόντων
     (44 πράσινα στο import + 8 registry). `MaterialLibraryService` reused (μηδέν νέο service).
