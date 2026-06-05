# HANDOFF — Phase 3: User-upload 3D PBR υφές ανά υλικό (πλήρες Revit «Appearance asset» που RENDER-ΑΡΕΤΑΙ)

**Ημερομηνία:** 2026-06-05 · **Μοντέλο:** Opus 4.8 · **Mode:** Plan Mode (ή Orchestrator — δες N.8 παρακάτω)

> **ΓΛΩΣΣΑ:** Ο Giorgio γράφει & διαβάζει Ελληνικά. ΑΠΑΝΤΑΣ ΠΑΝΤΑ ΣΤΑ ΕΛΛΗΝΙΚΑ.
> **ΠΟΙΟΤΗΤΑ:** «όπως οι μεγάλοι, Revit» — FULL ENTERPRISE + FULL SSOT. Μηδέν `any`/`as any`/`@ts-ignore`, μηδέν hardcoded strings (i18n SSoT), μηδέν duplicate, αρχεία ≤500 / συναρτήσεις ≤40 γραμμές.
> **COMMIT:** Τα commit τα κάνει **ΜΟΝΟ ο Giorgio** (N.(-1)). Ο agent ΔΕΝ κάνει commit/push.
> **⚠️ SHARED WORKING TREE** με τον ADR-408 MEP agent — git add ΜΟΝΟ specific, ΜΗΝ αγγίξεις adr-index, ΜΗΝ committ-άρεις MEP αρχεία.
> **N.6 ENTERPRISE IDs:** κάθε Storage upload + Firestore write με enterprise id.

---

## 🎯 ΤΙ ΘΑ ΚΑΝΕΙΣ

Ο χρήστης ανεβάζει **δικές του PBR υφές (albedo/normal/roughness/ao)** ανά υλικό (`bim_materials` doc), που **RENDER-ΑΡΟΝΤΑΙ στην 3D προβολή** — όχι μόνο 2D thumbnail (αυτό έγινε στο Phase 2). Πλήρες Revit «Appearance asset → Generic/Image» με per-map slots.

**Διαφορά από Phase 2 (ΟΛΟΚΛΗΡΩΜΕΝΟ):** Το Phase 2 πρόσθεσε `BimMaterial.thumbnailUrl` = **2D εικόνα** στα dropdowns/κάρτα (chip). **ΔΕΝ** αγγίζει το 3D render. Το Phase 3 κάνει το υλικό να φαίνεται με τις υφές του **στους τοίχους/κολώνες/πλάκες** στο 3D viewport.

**ΞΕΚΙΝΑ ΜΕ RECOGNITION (N.0.1):** διάβασε τα αρχεία στον «ΤΕΧΝΙΚΟ ΧΑΡΤΗ» → πρότεινε execution-mode (N.8) + μοντέλο (N.14) → **ρώτησε τον Giorgio με AskUserQuestion τις OPEN DECISIONS** ΠΡΙΝ γράψεις κώδικα.

---

## 🗺️ ΤΕΧΝΙΚΟΣ ΧΑΡΤΗΣ (verified 2026-06-05 — Explore agent + reads)

### Α) Το 3D PBR pipeline (ΠΩΣ φτάνει υφή στο mesh σήμερα)

1. **Registry/slug** — `src/subapps/dxf-viewer/bim/materials/bim-texture-registry.ts`
   - `type PbrTextureSlug` = 7 slugs: `concrete|brick|plaster|wood|tile|stone|metal`.
   - `TEXTURE_SET_DEFS: Record<slug, {slug, tileSizeM, hasNormal, hasRoughness, hasAo, license}>` — όλα CC0, tileSizeM σε μέτρα (concrete=2, brick=1, tile=0.6…).
   - `MATERIAL_TEXTURE_MAP: Record<string, slug>` — key (`mat-concrete`, `elem-column`…) → slug.
   - `textureSlugForKey(key): slug | null` = `MATERIAL_TEXTURE_MAP[key] ?? null`.

2. **Source resolver** — `bim-3d/materials/texture-source.ts`
   - `resolveTextureUrl(slug, map): Promise<string|null>` — public `/textures/<slug>/<map>.jpg` ή storage `bim-texture-library/<slug>/<map>.jpg` (switch SSoT `setTextureSourceMode`). In-flight dedup. Error → null.
   - `type TextureMap = 'albedo'|'normal'|'roughness'|'ao'`.

3. **Texture cache** — `bim-3d/materials/bim-texture-cache.ts`
   - `preloadTextureSet(slug)` — async load albedo+(normal/roughness/ao) → `sets.set(slug, LoadedTextureSet)` → **`bumpTextureAssetVersion()`**. Idempotent. `configureTexture`: RepeatWrapping, `repeat=1/tileSizeM`, anisotropy=8, albedo=SRGB.
   - `getTextureSet(slug): LoadedTextureSet | null` (sync read).
   - **Singletons ανά slug+map** (ποτέ clone per mesh).

4. **3D catalog** — `bim-3d/materials/MaterialCatalog3D.ts` (διάβασέ το ΟΛΟ — εδώ είναι το extension point)
   - `getMaterial3D(materialId): MeshStandardMaterial` → `resolveTexturedMaterial(resolveMaterialKey(materialId))`.
   - `getElementMaterial3D(type)` → `resolveTexturedMaterial('elem-'+type)`.
   - **`resolveTexturedMaterial(key)`** (γρ. 80): (1) `!realisticMaterials` → flat· (2) `textureSlugForKey(key)` null → flat· (3) `getTextureSet(slug)` null → `preloadTextureSet(slug)`+flat· (4) loaded → cache `${key}::tex` → `buildTexturedMaterial`.
   - `buildTexturedMaterial(key, set)`: clone flat + `mat.map/normalMap/roughnessMap/aoMap` + `needsUpdate`.
   - Flat color: `MATERIAL_DEFS[key] ?? MATERIAL_DEFS['mat-concrete']`.

5. **UV** — `bim-3d/converters/bim-uv-helpers.ts`: `ensureWorldUvs(geo)` (copy uv→uv2 ή planar) / `setPlanarWorldUvs` / `setBoxWorldUvs`. **1 UV unit = 1 metre**, repeat=1/tileSizeM → physical tiling.

6. **Mesh conversion** — `bim-3d/converters/BimToThreeConverter.ts`:
   - **Wall:** per-DNA-layer → `getMaterial3D(layer.materialId)` (το `materialId` DNA φτάνει ΕΔΩ· βλ. `wall-layer-geometry.ts splitPieceByLayers`). ΑΥΤΟ είναι το κλειδί: ένα DNA layer μπορεί να έχει `materialId='bmat_abc'`.
   - **Column/Beam/Slab:** `getElementMaterial3D('column'/'beam'/'slab')` — το per-instance `params.material` πάει ΜΟΝΟ σε `userData` (ΟΧΙ στο material!). ⚠️ Άρα κολώνα/δοκάρι/πλάκα δεν παίρνουν per-instance material σήμερα — μόνο ο τοίχος (per-layer) + σκάλα (`stair-material-resolver.ts`).

7. **Resync** — `bim-3d/stores/Bim3DEntitiesStore.ts` (`textureAssetVersion` + `bumpTextureAssetVersion`) + hook `use-bim3d-vg-resync.ts` (subscribe → `resyncBimScene` → `getMaterial3D` ξανακαλείται → textured). **REUSE — έτοιμο: όταν φορτώσει η υφή κάνεις bump → η σκηνή ξαναχτίζεται.**

8. **Toggle** — `state/bim-render-settings-store.ts`: `realisticMaterials` (default ON). Το catalog το διαβάζει sync στο `resolveTexturedMaterial`.

9. **storage.rules** — `bim-texture-library/{=**}`: read=auth, **write/delete=super-admin** (shared CC0 catalog). ⚠️ ΟΧΙ για user upload → χρειάζεται ΝΕΟ company-scoped path.

### Β) Το `bim_materials` doc (Phase 2 SSoT — εδώ ζουν τα νέα texture fields)
- `bim/types/bim-material-types.ts` — `BimMaterial` (έχει ήδη `thumbnailUrl: string|null` από Phase 2)· `SaveBimMaterialInput`/`UpdateBimMaterialPatch`.
- `bim/services/MaterialLibraryService.ts` — `saveMaterial`/`updateMaterial` (setDoc merge, `stripUndefined`).
- `bim/services/bim-material-thumbnail-upload.service.ts` (Phase 2) — **ΠΡΟΤΥΠΟ upload** για mirror (validate→buildPath→uploadBytes→getDownloadURL).
- `src/services/upload/utils/storage-path.ts` — `buildBimMaterialThumbnailPath` (Phase 2)· πρόσθεσε `buildBimMaterialTextureMapPath`.
- UI: `ui/panels/materials/MaterialEditorDialog.tsx` + `MaterialEditorSections.tsx` (Phase 2 ThumbnailSection — πρόσθεσε δίπλα PBR maps section).

---

## 🚨 ΤΟ ΚΡΙΣΙΜΟ ΑΡΧΙΤΕΚΤΟΝΙΚΟ ΧΑΣΜΑ (διάβασέ το ΠΡΟΣΕΚΤΙΚΑ)

**Σήμερα τα `bmat_*` materialIds ΧΑΝΟΝΤΑΙ:** `resolveMaterialKey('bmat_abc')` → δεν κάνει match `mat-*`/`elem-*` prefix → επιστρέφει default `'mat-concrete'`. Δηλαδή ένας τοίχος με DNA layer `materialId='bmat_abc'` εμφανίζεται **ΩΣ concrete** (χρώμα + υφή) στο 3D. Το `bmat_` id φτάνει μόνο στο 2D UI (WallDnaEditor picker + Phase-2 swatch), ΟΧΙ στο `getMaterial3D`.

**Συνέπεια:** Για να αποκτήσει ένα `bmat_` material δικές του 3D υφές, χρειάζεται:
1. Το `bmat_` id να **ΜΗΝ** καταρρέει στο `resolveMaterialKey` — να περνά ως-έχει στο catalog.
2. Το 3D catalog να αποκτήσει **πρόσβαση στα `bim_materials` docs** (σήμερα είναι pure, μηδέν Firestore). Χρειάζεται **reactive «user material registry»** (id → `{flatColorHex, pbrTextures, tileSizeM}`) που τροφοδοτείται από τη subscription του `useMaterialLibrary`/`MaterialLibraryService` και το catalog το διαβάζει (SSoT· mirror του `bim-texture-cache` reactive pattern).
3. Flat color για `bmat_` χωρίς υφές: από το `category` του doc (reuse `getMaterialFlatColorHex`/`slugForMaterialCategory` Phase 1).

**Αυτό είναι το «meat» του Phase 3** — η σύνδεση 3D-catalog ↔ bim_materials docs.

---

## 🧭 ΠΡΟΤΕΙΝΟΜΕΝΗ ΑΡΧΙΤΕΚΤΟΝΙΚΗ (επικύρωσε με Giorgio)

1. **`BimMaterial.pbrTextures?`** (bim-material-types.ts):
   ```ts
   readonly pbrTextures: {
     readonly albedoUrl: string | null;
     readonly normalUrl: string | null;
     readonly roughnessUrl: string | null;
     readonly aoUrl: string | null;
     readonly tileSizeM: number;        // π.χ. 1.0 default
   } | null;
   ```
   (Firestore-safe: null ή πλήρες object· mirror Phase-2 conditional spread.)

2. **Storage path (company-scoped, ΟΧΙ bim-texture-library):**
   `companies/<companyId>/bim-material-textures/<materialId>/<map>.jpg` (map ∈ albedo/normal/roughness/ao). Νέο `buildBimMaterialTextureMapPath` στο storage-path.ts.

3. **Upload service** `bim/services/bim-material-texture-upload.service.ts` (mirror Phase-2 thumbnail service): validate (jpg/png/webp, ~5-10MB ανά map), upload ανά map, return URLs. Typed error codes.

4. **Reactive user-material registry** `bim-3d/materials/user-material-registry.ts` (SSoT· mirror `bim-texture-cache` store):
   - Δέχεται τα loaded `bim_materials` (από `MaterialLibraryService.subscribeMaterials` — ΗΔΗ υπάρχει subscription στο `useMaterialLibrary`· χρειάζεται ένα always-on host να το τροφοδοτεί, mirror `RoofPersistenceHost`/material library panel).
   - `getUserMaterialAppearance(materialId): {flatColorHex, pbrTextures} | null`.
   - Per-material texture cache (load albedo/normal/roughness/ao από τα URLs → `LoadedTextureSet`) → `bumpTextureAssetVersion()` (REUSE resync).

5. **`resolveMaterialKey` / `MaterialCatalog3D` extension:**
   - `getMaterial3D(materialId)`: αν `materialId.startsWith('bmat_')` → νέο μονοπάτι `resolveUserMaterial(materialId)` (ΟΧΙ `resolveMaterialKey` collapse).
   - `resolveUserMaterial(id)`: (1) `!realisticMaterials` → flat από registry color· (2) registry pbrTextures null → flat color (category)· (3) textures not loaded → preload + flat· (4) loaded → textured `MeshStandardMaterial` (tileSizeM από doc). Cache key `id::tex`.
   - REUSE `buildTexturedMaterial` pattern + `ensureWorldUvs` (ήδη καλείται στη γεωμετρία τοίχου).

6. **Upload UI** στο `MaterialEditorSections.tsx`: νέα ενότητα «Υφές 3D (PBR)» με 4 slots (albedo/normal/roughness/ao) + tileSizeM input + preview. Mirror Phase-2 ThumbnailSection. edit=άμεσο upload, create=staged→upload-after-save (Phase-2 pattern).

7. **storage.rules:** νέο rule `companies/{cid}/bim-material-textures/{materialId}/{file}` (company-scoped image/*, ≤10MB) + δήλωση `STORAGE_RULES_PENDING` στο `tests/storage-rules/_registry/coverage-manifest.ts` (**CHECK 3.19 zero-tol**).

8. **i18n** `bim-materials.json` (el+en): keys για textures3d.* (albedo/normal/roughness/ao/tileSize/upload/remove/errors).

9. **Tests:** upload-service validation + registry resolution + `resolveUserMaterial` precedence (textures wins / flat fallback / toggle off).

---

## ❓ OPEN DESIGN DECISIONS (ρώτησε Giorgio με AskUserQuestion ΠΡΙΝ κώδικα)

1. **Εμβέλεια override:** Μόνο `bmat_` library υλικά αποκτούν 3D υφές, **ή** και τα DNA presets (`mat-concrete-c25`) μπορούν να γίνουν override per-company; (Revit-true = presets είναι built-in → «Duplicate to edit». Συνιστώ: μόνο `bmat_` τώρα.)
2. **Maps που υποστηρίζονται:** Και τα 4 (albedo/normal/roughness/ao) ξεχωριστά slots, **ή** μόνο albedo (απλό single-image, derive τα υπόλοιπα flat); (Revit = ξεχωριστά slots· συνιστώ 4 slots με μόνο albedo υποχρεωτικό.)
3. **tileSizeM:** User-input πεδίο (φυσικό μέγεθος tile σε μέτρα), **ή** fixed default (π.χ. 1m); (Revit έχει «Sample Size»· συνιστώ user-input με default 1m.)
4. **Storage scope:** company-scoped `companies/<cid>/bim-material-textures/` (συνιστώ, tenant isolation) **ή** project-scoped;
5. **Per-instance vs per-material για κολώνες/δοκάρια/πλάκες:** Σήμερα ΜΟΝΟ ο τοίχος (per-DNA-layer) + σκάλα παίρνουν per-material υφή· κολώνα/δοκάρι/πλάκα χρησιμοποιούν `getElementMaterial3D` (αγνοούν το `params.material`). Να επεκταθεί ώστε κι αυτά να παίρνουν `getMaterial3D(params.material)` όταν είναι `bmat_`; (Μεγαλύτερη εμβέλεια — BimToThreeConverter αλλαγές. Συνιστώ: ξεκίνα με τοίχο, επέκταση αν θες.)
6. **2D↔3D ενοποίηση:** Όταν ένα υλικό έχει `pbrTextures.albedoUrl`, να γίνεται ΚΑΙ το Phase-2 2D swatch (αντί για ξεχωριστό `thumbnailUrl`); (Revit = ένα appearance· συνιστώ: αν λείπει thumbnailUrl, ο swatch πέφτει στο albedoUrl.)
7. **Memory/teardown:** per-material textures = δυναμικά (όχι 7 fixed slugs). Χρειάζεται dispose όταν αλλάζει/διαγράφεται υλικό (αποφυγή GPU leak). Πώς; (registry dispose on material delete/update.)

---

## 📊 N.8 EXECUTION MODE — εκτίμηση
~14-18 αρχεία σε **3-4 domains** (3D materials/cache/registry · upload service+storage · BimToThreeConverter wiring · UI dialog · rules · i18n · tests). **2+ domains & 5+ αρχεία → ΡΩΤΑ Giorgio: Orchestrator vs Plan Mode.** Η δουλειά έχει ένα μη-τετριμμένο νέο subsystem (user-material-registry + 3D-catalog↔Firestore σύνδεση) → ίσως Orchestrator. Μοντέλο: **Opus 4.8** (cross-cutting + 3D + security rules).

---

## ✅ ΤΙ ΟΛΟΚΛΗΡΩΘΗΚΕ ΗΔΗ — Phase 2 (committed από Giorgio; storage rule DEPLOYED 2026-06-05)
2D thumbnail upload ανά υλικό (`BimMaterial.thumbnailUrl`, swatch override στα dropdowns/κάρτα). storage rule `companies/{cid}/bim-material-thumbnails/{file}` **LIVE** (deployed). ADR-413 v1.3.
**Αρχεία Phase 2 (αναφορά για mirror):**
```
NEW: bim/services/bim-material-thumbnail-upload.service.ts (+ test)
     ui/components/shared/__tests__/MaterialSwatch.test.tsx
     ui/panels/materials/MaterialEditorSections.tsx (split)
MOD: bim/types/bim-material-types.ts · bim/services/MaterialLibraryService.ts
     src/services/upload/utils/storage-path.ts · ui/components/shared/MaterialSwatch.tsx
     ui/panels/materials/MaterialEditorDialog.tsx · MaterialsLibraryPanel.tsx
     ui/wall-advanced-panel/sections/WallDnaEditor.tsx
     storage.rules · tests/storage-rules/_registry/coverage-manifest.ts
     i18n el+en bim-materials.json (thumbnail.*)
```

---

## ⚠️ SHARED WORKING TREE — ΚΑΝΟΝΕΣ
- **ΠΟΤΕ `git add -A`.** git add ΜΟΝΟ τα δικά σου αρχεία, επιλεκτικά.
- **ΜΗΝ αγγίξεις** `adr-index.md` (άλλος agent).
- **ΜΗΝ committ-άρεις MEP αρχεία** (`mep-*`, `grip-parametric-*`). Το Phase 3 αγγίζει `storage.rules`/`coverage-manifest`/`BimToThreeConverter`/`Bim3DEntitiesStore` (co-edited) → συντονισμός, git add ΜΟΝΟ specific.
- **Commit: ο Giorgio** (N.(-1)). Μετά: ADR-413 v1.4 + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory `project_adr413_material_swatches.md` (N.15).
- **⚠️ ADR-040:** `Bim3DEntitiesStore`/`BimSceneLayer`/`bim3d-resync` είναι ADR-040 περιοχή → αν τα αγγίξεις, STAGE το ADR-040 (CHECK 6B/6D).

## 🧪 TESTS / TSC
- Pre-existing (ΑΓΝΟΗΣΕ): `mesh-to-object3d.ts:124` (ADR-411).
- `npx tsc --noEmit` background. Tests: upload-service + registry + resolveUserMaterial.

## 📚 ΑΝΑΦΟΡΕΣ
- ADR-413 §2D (v1.3) · Phase-2 memory `project_adr413_material_swatches.md` · `project_adr413_pbr_textures.md`
- 3D pipeline: `MaterialCatalog3D.ts` · `bim-texture-cache.ts` · `texture-source.ts` · `bim-texture-registry.ts` · `bim-uv-helpers.ts` · `BimToThreeConverter.ts` · `use-bim3d-vg-resync.ts`
- Upload πρότυπο: `bim-material-thumbnail-upload.service.ts` (Phase 2)
- N.6 (enterprise IDs) · N.11 (i18n) · N.15 (tracker) · CHECK 3.19 (storage rules coverage)
