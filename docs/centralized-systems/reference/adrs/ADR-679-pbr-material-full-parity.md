# ADR-679 — PBR Material «Full Parity»: πλήρες σύστημα υλικών/υφών ανά όψη (C4D-grade)

**Status:** 🟢 Φ2a ΥΛΟΠΟΙΗΘΗΚΕ (import name→όλα τα υλικά + color registry)· 🟢 Φ5.1a ΥΛΟΠΟΙΗΘΗΚΕ (DAE writer texture-capable + πραγματικά UVs)· 🟢 Φ5.1b ΥΛΟΠΟΙΗΘΗΚΕ + **R15 GROUND-TRUTH ✅** (texture-byte bundling + headless prewarm· checker-cube `.dae`+`.zip` άνοιξε στον C4D R15.037 με σωστά χαρτογραφημένη υφή σε όλες τις όψεις)· 🟢 **Φ2b ΥΛΟΠΟΙΗΘΗΚΕ** (per-face PBR **render** — σώμα μέσω `resolveFaceMaterial`→`getMaterial3D` + faced-prism UVs· σοβάς `materialId` ήταν ήδη textured, καμία αλλαγή)· Φ2c εκκρεμεί· 🟢 **Φ5.2 ΥΛΟΠΟΙΗΘΗΚΕ + R15 GROUND-TRUTH ✅** (per-face texture export — ο COLLADA writer έγραφε ΗΔΗ per-group `<triangles material>`+`<instance_material>`· κολώνα με ΔΥΟ υφές σε ΔΥΟ όψεις άνοιξε στον R15 με κάθε όψη τη δική της υφή, 2026-07-21)· 🟡 **Φ4 COLLADA import** (C4D→Νέστωρ per-face· code+jest DONE, R15 ground-truth pending — λεπτομέρειες **ADR-678 Φ4**)
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
| **Φ5** | **COLLADA/DAE texture export (Νέστωρ→C4D R15) — FULL PARITY track.** Ground-truth correction (2026-07-21): ο R15 **DAE** importer **ΚΟΥΒΑΛΑ** textures (αποδεδειγμένο: native Aeron `.dae` με `library_images`+sampler), σε αντίθεση με το OBJ που ΔΕΝ διαβάζει υλικά. Άρα το DAE είναι ο textured δρόμος για R15. Sub-phases: **Φ5.1a** DAE writer texture-capable + πραγματικά UVs ✅· **Φ5.1b** texture-byte bundling (fetch από Storage → loose `textures/*` σε `.zip`) + headless prewarm ✅ (**SSOT correction: ΟΧΙ `fflate`** — reuse του υπάρχοντος zero-dep `zip-pack.ts` + `image-export-shared.fetch*` + `packageArtifacts`, ίδιο pattern με το DXF image-fill eTransmit· ένας packer, όπως οι μεγάλοι)· **Φ5.1c** ✅ (2026-07-21, R15 ground-truth bug-fix) **per-face export material-naming** — `resolveMaterialName` ονόμαζε ΚΑΘΕ per-face textured υλικό `mat_ffffff` (χρώμα-based name, αλλά `applyTextureSet` βάζει `color=0xffffff` σε ΟΛΑ τα textured PBR) → collapse σε ΕΝΑ material/texture (πέτρα κολόνας + ξύλο σκάλας ίδια υφή). Fix: name-by-texture-source-identity (`tex_<parentDir>_<fileStem>`) όταν per-face υλικό (matId=null) ΕΧΕΙ texture· διαφορετικές υφές → διαφορετικά ονόματα/αρχεία, ίδια υφή → dedup. **Ξεκλειδώνει/σχετίζεται με Φ5.2** — τα per-face υλικά τώρα εξάγονται με σωστές διακριτές ταυτότητες· **Φ5.2** ✅ (2026-07-21, R15 ground-truth) per-face texture export — **ΚΑΜΙΑ αλλαγή κώδικα χρειάστηκε**: ο COLLADA writer (`mesh3d-collada-geometry.ts` `buildGroupsXml`/`triangleGroups`) έγραφε ΗΔΗ per-group `<triangles material="sym_i">` + matching `<instance_material symbol="sym_i" target="#material_j">` μέσα σε ΕΝΑ `<bind_material><technique_common>` ανά mesh, με texture chain (`<surface>`/`<sampler2D>`/`<image>`) ανά υλικό. Μαζί με το Φ5.1c (διακριτά ονόματα ανά ταυτότητα υφής), μια κολώνα με διαφορετική υφή ανά όψη εξάγεται με σωστό per-primitive binding· ο C4D R15.037 δείχνει κάθε όψη με τη δική της υφή. Test-guard: `mesh3d-collada-writer.test.ts` («ΕΝΑ <triangles> + binding ανά group»)· **Φ5.3** per-triangle. | **Μεγάλο** |

**Σειρά:** Φ2a (γρήγορη νίκη, ξεκλειδώνει catalog/user materials στο round-trip) → Φ2b (η ουσία) → Φ2c (UX). **Full-parity export track (εντολή Giorgio 2026-07-21):** Φ5.1 (whole-element υφή export, R15-testable) → Φ2b/Φ3/Φ5.2 (per-face) → Φ5.3 (per-triangle) → import COLLADA parser (orchestrator).

## 6. Κανόνες / SSoT (μην αναπαράγεις)

- **ΜΗΝ** φτιάξεις νέο material type — επέκτεινε το `BimMaterial` (ADR-413).
- **ΜΗΝ** φτιάξεις νέο PBR builder — reuse `pbr-material-builder.ts` + `bim-texture-cache.ts`.
- **ΜΗΝ** φτιάξεις νέο per-face σύστημα — επέκτεινε ADR-539 (`FaceAppearance`) + ADR-449 (`FinishFaceOverride`).
- Round-trip = **name-based** πάντα (C4D R15 δεν στέλνει data — μόνο `usemtl <όνομα>`· βλ. ADR-678).
- N.8: το Φ2b είναι orchestrator-scale (materials + rendering + import) — ζήτα έγκριση mode πριν.

## 7. Changelog

- **2026-07-21 — Export material NAMING: by-identity πάνω από by-texture (ADR-678 Φ2 Βήμα 1).**
  Το Φ5.1c (κάτω) ονόμαζε τα per-face textured υλικά `tex_<texture-path>` — σωστό για C4D display/dedup,
  αλλά **αόρατο στο re-import** (δεν λύνεται σε Nestor id). Νέα προτεραιότητα στο `resolveMaterialName`
  (`mesh3d-materials.ts`): αν το per-face υλικό έχει σφραγισμένο `userData.nestorMaterialId` (θέτεται
  από `getFaceMaterial3D`) → όνομα = **το id** (`bmat_oak`)· το `tex_<...>` μένει fallback ΜΟΝΟ για
  materials χωρίς id. Το dedup (διαφορετική υφή → διαφορετικό αρχείο) διατηρείται, τώρα by-identity.
  **Δεν αλλάζει η δομή/υφές του `.dae`** — μόνο τα ονόματα υλικών (re-verify Φ5.2 στον R15). Πλήρες:
  **ADR-678 §6 (Φ2 Βήμα 1)**.
- **2026-07-21 — Φ4 COLLADA per-face IMPORT (C4D→Νέστωρ· code+jest DONE, R15 ground-truth pending).**
  Το import σκέλος του full round-trip. Νέος parser `dae-material-parse.ts` (mirror του writer) →
  ίδιο σχήμα με OBJ/glTF → **αυτούσιος** ο κοινός πυρήνας `applyImportedAppearance`. Ο writer γράφει
  πλέον τα faceKeys σε COLLADA `<extra>` (round-trip identity· ο R15 τα αγνοεί). SSoT boy-scout:
  `@/lib/xml/xml-dom` + `rgb-unit-hex` (μηδέν clone). **Πλήρεις λεπτομέρειες + roadmap: ADR-678 §5/§6
  (Φ4).** ⚠️ Εκκρεμεί R15 ground-truth (βάψε όψη στον C4D → re-import).
- **2026-07-21 — Φ5.2 ΕΠΙΚΥΡΩΘΗΚΕ (per-face texture export — R15 ground-truth, ΚΑΜΙΑ αλλαγή κώδικα).**
  Ερώτημα Φ5.2: ΕΝΑ στοιχείο με **διαφορετική υφή ανά όψη** εξάγεται με σωστό per-primitive binding ώστε ο
  C4D R15 να δείχνει κάθε όψη διαφορετικά; **Ground-truth (Giorgio, R15.037):** κολώνα βαμμένη με ΔΥΟ
  διαφορετικές υφές σε ΔΥΟ όψεις (Polygon Mode, realistic ON) → export → **κάθε όψη δείχνει τη δική της
  υφή στον R15 ✅**. **Κώδικας (source of truth, επιβεβαιωμένος με audit):** ο COLLADA writer ήταν ΗΔΗ
  per-group-aware — `export/core/mesh3d/mesh3d-collada-geometry.ts`: `triangleGroups()` χαρτογραφεί κάθε
  `geometry.group`→`materialIndex`· `buildGroupsXml()` γράφει ΕΝΑ `<triangles material="sym_i">` + ένα
  matching `<instance_material symbol="sym_i" target="#material_j"><bind_vertex_input semantic="UVSET0".../>`
  ανά group, όλα μέσα σε ΕΝΑ `<bind_material><technique_common>` ανά node. Ο texture chain
  (`<surface type="2D">`/`<sampler2D>`/`<image>`) γράφεται ανά υλικό στο `mesh3d-collada-writer.ts`
  (`effectElement`/`buildMaterialLibraries`). Μαζί με Φ5.1c (ονόματα ανά ταυτότητα υφής) → διακριτές υφές
  ανά όψη κουβαλιούνται σωστά. **Test-guard υπάρχει ήδη:** `mesh3d-collada-writer.test.ts` επιβεβαιώνει 2
  `<triangles>` + 2 `<instance_material>` + 2 `<bind_vertex_input>` για multi-material mesh με groups.
  **Αποτέλεσμα:** το Φ5.2 ήταν ήδη ολοκληρωμένο ως παρενέργεια του σωστά αρχιτεκτονημένου writer (per-group
  από τη σχεδίαση, όπως οι μεγάλοι)· χρειαζόταν μόνο το naming-fix του Φ5.1c για να μη γίνεται collapse.
  **Απομένει στο track:** **Φ5.3** per-triangle export, **Φ4** import COLLADA parser (name-based).
- **2026-07-21 — Φ5.1c BUG-FIX (export material-naming collapse, βρέθηκε μέσω C4D R15 ground-truth).**
  Μετά το per-face texture render in-app (Φ2b), το εξαγόμενο `.dae` **collapse-άρε ΟΛΕΣ** τις textured
  οντότητες σε **ΕΝΑ** material `mat_ffffff` με **ΜΙΑ** texture `textures/mat_ffffff.jpg` — πέτρινη κολόνα
  + ξύλινη σκάλα κ.λπ. έπαιρναν όλα την ΙΔΙΑ υφή. **Root cause:** `export/core/mesh3d/mesh3d-materials.ts`
  `resolveMaterialName` ονόμαζε per-face materials (`matId=null`) βάσει **ΧΡΩΜΑΤΟΣ** (`mat_<hex>`), αλλά το
  `applyTextureSet` επιβάλλει `color=0xffffff` σε ΚΑΘΕ textured PBR material (λευκή βάση ώστε το albedo
  να μην διπλο-βάφεται) → κάθε textured όψη → ίδιο όνομα `mat_ffffff` → dedup σε ΕΝΑ material + ΕΝΑ αρχείο
  texture. **Fix (conservative, ADR-679 Φ5):** το `resolveMaterialName`, για per-face material (`matId=null`)
  που ΕΧΕΙ texture, ονομάζεται πλέον βάσει της **ταυτότητας πηγής** της υφής — `tex_<parentDir>_<fileStem>`
  από το url path της υφής (χωρίς query, ώστε τα Storage signed-url tokens να μην το μεταβάλλουν), π.χ.
  `.../textures/stone/albedo.jpg` → `tex_stone_albedo`. Διαφορετικές υφές → διαφορετικά ονόματα/αρχεία
  (split)· ίδια υφή (shared singleton → ίδιο url) → dedup. Single-material meshes ΜΕ `matId` κρατούν το
  matId-based όνομά τους αναλλοίωτο· per-face **FLAT** paints κρατούν `mat_<hex>`. Νέος helper
  `textureIdentityToken`. Deterministic (χωρίς `Date`/random). **Αποτέλεσμα:** η εξαγωγή πλέον κουβαλά
  per-entity textures που ταιριάζουν με το in-app render, και ο texture bundler βγάζει ΕΝΑ αρχείο ανά
  διακριτή υφή. **Σχετίζεται/ξεκλειδώνει Φ5.2** (per-face texture export) — τα per-face υλικά εξάγονται
  πλέον με σωστές διακριτές ταυτότητες.
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
