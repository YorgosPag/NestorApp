# ADR-413 — PBR Texture Maps for Parametric BIM 3D

| Field | Value |
|---|---|
| Status | 🟢 **VERTICAL SLICE DONE** (2026-06-03, Opus orchestrator — εγκεκριμένο Plan Mode). Optional **PBR texture maps** (albedo/normal/roughness/AO) στα **parametric** δομικά υλικά (τοίχοι/κολώνες/δοκάρια/πλάκες/σκάλες) — όχι μόνο flat color. World-meter UV tiling· hybrid asset source (public demo ↔ Firebase Storage `bim-texture-library`)· **per-DNA-layer** wall sub-solids (κάθε layer δικό του υλικό/texture)· View-tab «realistic materials» toggle (default ON). Textures CC0 (Poly Haven) / CC-BY με attribution per ADR-409. Graceful flat fallback μέχρι να ανέβουν textures. tsc 0· tests PASS. 🔴 Εκκρεμεί browser verify + Giorgio texture upload (Storage) + commit. |
| Date | 2026-06-03 |
| Owner | Giorgio / Claude (Opus orchestrator) |
| Related | **ADR-363** (δομικά υλικά / steel — το placeholder «Phase 6.x θα προσθέσει texture maps» που εκπληρώνει αυτό το ADR)· **ADR-366** (MaterialCatalog3D / SPEC-3D-003)· **ADR-411** (bim-mesh-library — το async-preload→version-bump-resync pattern που αντιγράφεται)· **ADR-409 §(B-θετικό) / §(D)** (CC0/CC-BY licensing για content — Poly Haven CC0 textures)· **ADR-401/404** (wall geometry / DNA layers)· **ADR-040** (canvas micro-leaf — δεν αγγίζεται· καθαρά 3D)· ADR-017/210/294 (enterprise IDs N.6 — δεν εφαρμόζεται, μηδέν νέο collection) |

---

## Context — γιατί υπάρχει αυτό το ADR

Το `MaterialCatalog3D` (ADR-366 / SPEC-3D-003) απέδιδε **μόνο flat color** — κάθε `materialId`
(από τα WallDna layers) και κάθε element type γινόταν ένα `THREE.MeshStandardMaterial` με σκέτο
`color`. Στον κώδικα υπήρχε ρητό placeholder:

> `ADR-363 Phase 6.x will extend with texture maps.`

Παράλληλα:

- **Τα GLB meshes** (ADR-410/411 — έπιπλα, φωτιστικά) **ήδη** κουβαλούν ενσωματωμένα PBR maps μέσα
  στο glTF· εκεί δεν λείπει τίποτα.
- **Το κενό** είναι αποκλειστικά στις **παραμετρικές extruded επιφάνειες** — τοίχοι, κολώνες,
  δοκάρια, πλάκες, σκάλες — που γεννιούνται procedurally από geometry, χωρίς ενσωματωμένο υλικό.
  Αυτές έδειχναν επίπεδες χρωματιστές, όχι ρεαλιστικές (μπετόν, τούβλο, ξύλο, σοβάς).
- Επιπλέον, τα **Wall DNA layers** (πολυστρωματικός τοίχος: core + μόνωση + επένδυση) αγνοούνταν
  τελείως στο 3D: ο τοίχος έβγαινε ως **ένα** mesh με **μόνο** το core material — η πληροφορία
  στρώσεων υπήρχε στο 2D αλλά «χανόταν» στην τρισδιάστατη αναπαράσταση.

### Πώς το λύνουν οι μεγάλοι (industry convergence)

| Παίκτης | Μηχανισμός |
|---|---|
| **Revit** | «Appearance assets» (Autodesk Material Library) με generic/PBR maps· world-space UV («Texture Alignment» σε real units)· πολυστρωματικός τοίχος → κάθε **layer** δική του απόδοση/υλικό στο cut + 3D. |
| **ArchiCAD** | Surfaces με texture + «Size/Fit» σε μέτρα· composite walls με per-skin υλικά. |
| **glTF / three.js** | `MeshStandardMaterial` με `map`/`normalMap`/`roughnessMap`/`aoMap` + `texture.repeat`/`wrapS=wrapT=RepeatWrapping`. |

**Κοινός παρονομαστής:** (α) PBR maps πάνω σε world-meter UV tiling (όχι UV-stretched), και
(β) per-layer απόδοση για πολυστρωματικά δομικά στοιχεία.

---

## Decision

### Δ1 — Optional PBR maps στα parametric υλικά (MaterialCatalog3D extension)

Κάθε parametric `MeshStandardMaterial` αποκτά **optional** texture set: `albedo` (`map`),
`normal` (`normalMap`), `roughness` (`roughnessMap`), `ambient occlusion` (`aoMap`). Το mapping
`materialId → texture slug` ζει σε **registry SSoT** (`bim-texture-registry`). Αν δεν υπάρχει
slug ή δεν έχει φορτώσει ακόμα το set → **graceful flat fallback** (το υπάρχον `color`-only υλικό,
μηδέν regression).

### Δ2 — World-meter UV tiling (physically-sized, όχι stretched)

Το tiling υπολογίζεται σε **πραγματικά μέτρα**: `repeat = worldSizeM / tileSizeM` ανά άξονα
(default `tileSizeM = 1`). `wrapS = wrapT = RepeatWrapping`. Ένα texture «μπετόν 1m» επαναλαμβάνεται
σωστά σε τοίχο 4×3m — δεν παραμορφώνεται με το μέγεθος του στοιχείου. Η λογική ζει σε helper SSoT
(`bim-uv-helpers`) — κανείς renderer δεν γράφει raw `texture.repeat`.

### Δ3 — Hybrid / switchable asset source (public demo ↔ Firebase Storage)

Ο **source** των textures είναι εναλλάξιμος σε **ένα** σημείο (`texture-source`):
- **public demo** assets (bundled / public CDN) για άμεση οπτική επαλήθευση χωρίς upload,
- **Firebase Storage** `bim-texture-library/<materialId>/<map>.{jpg,png}` (production) μόλις ο Giorgio
  ανεβάσει full-res CC0 sets.

`storage.rules`: recursive `match /bim-texture-library/{path=**}` (read=authenticated,
write=super-admin) — mirror του `bim-mesh-library` κανόνα (ADR-411 Δ2).

### Δ4 — Per-DNA-layer wall sub-solids (πολυστρωματικός τοίχος στο 3D)

Στο `wallToMesh`, αντί για **ένα** mesh με το core material, ο τοίχος εκτείνεται σε **πολλαπλά
sub-solids** — **ένα ανά DNA layer** — με offset της footprint polyline κατά το πάχος κάθε layer
μέσω του υπάρχοντος **`offsetPolyline` SSoT**. Κάθε sub-solid παίρνει το **δικό του** υλικό/texture
(`getMaterial3D(layer.materialId)`). Έτσι core + μόνωση + επένδυση φαίνονται ξεχωριστά στο 3D,
όπως στο Revit composite wall. Single-layer τοίχοι → ένα solid (μηδέν regression).

### Δ5 — View-tab «realistic materials» toggle (default ON)

Master switch στο View tab (mirror του `colorBySystem` toggle, ADR-408 Φ7): flag
`realisticMaterials` στο `bim-render-settings` SSoT (default **ON**). OFF → όλα τα parametric
υλικά πέφτουν στο flat-color path (γρήγορο preview / χαμηλό VRAM). Idempotent persist· το flag
re-export-άρεται ώστε όλα τα material gates να το διαβάζουν δωρεάν.

### Δ6 — Async-preload → version-bump → resync (mirror bim-mesh-cache)

Τα texture sets φορτώνονται **async** (`bim-texture-cache`, `TextureLoader`, in-flight de-dup,
`Map<slug, LoadedTextureSet>`). Cache miss → flat fallback **τώρα** + fire-and-forget `preload`·
on-load → generic version bump → `BimViewport3D` resync → το flat υλικό αντικαθίσταται από το
textured. Είναι **ακριβώς** το pattern του `bim-mesh-cache` (ADR-411 Δ5) — ένα SSoT signal, μηδέν
blocking στο πρώτο frame.

### Δ7 — Licensing (per ADR-409)

Textures = **CC0** (Poly Haven — ρητά «redistribute… in a product you sell», zero attribution).
**CC-BY 4.0** επιτρέπεται **με attribution** (ADR-409 §B-θετικό για content). Structural facts/IFC
παραμένουν εκτός scope (textures = καθαρά visual layer).

---

## Architecture — νέα modules + extensions

### Νέα αρχεία (SSoT)

| Νέο αρχείο | Ρόλος |
|---|---|
| `bim/materials/bim-texture-registry.ts` | **Registry SSoT** — `textureSlugForKey(materialId \| elementKey)` → texture slug (ή `null`→flat). Το ΜΟΝΟ σημείο που χαρτογραφεί υλικά→texture sets. |
| `bim-3d/materials/texture-source.ts` | **Source switch SSoT** — public-demo URL ↔ Firebase Storage `bim-texture-library/<slug>/<map>`. Αλλάζει το hosting σε **ένα** σημείο. |
| `bim-3d/materials/bim-texture-cache.ts` | Async `TextureLoader` + `Map<slug, LoadedTextureSet>` (albedo/normal/roughness/ao) + in-flight de-dup. `preloadTextureSet(slug)` (fire-and-forget)· `getTextureSet(slug)` (sync). On-load → version bump (Δ6). |
| `bim-3d/converters/bim-uv-helpers.ts` | World-meter UV SSoT — `repeat = worldSizeM / tileSizeM`, `RepeatWrapping`. Κανείς δεν γράφει raw `texture.repeat`. |

### Extensions σε υπάρχοντα

| Αρχείο | Επέκταση |
|---|---|
| `bim-3d/materials/MaterialCatalog3D.ts` | `buildMat`/`getMaterial3D`/`getMaterialForType3D` → optional texture set (map/normalMap/roughnessMap/aoMap) μέσω registry+cache· gate στο `realisticMaterials` flag· flat fallback. |
| `bim-3d/.../wallToMesh` | Per-DNA-layer sub-solids μέσω `offsetPolyline` SSoT (Δ4)· κάθε layer δικό του υλικό. |
| `bim-3d/stores/Bim3DEntitiesStore.ts` | Generic `textureAssetVersion`-style bump → resync (Δ6, mirror `meshAssetVersion`). |
| `state/bim-render-settings-store.ts` + `config/bim-render-settings-types.ts` | `realisticMaterials` flag (default ON) + `setRealisticMaterials` idempotent persist (Δ5). |
| `ui/ribbon/data/view-tab-visual-styles.ts` (+ toggle widget) | View-tab «realistic materials» κουμπί (mirror `ColorBySystemToggle`). |
| `storage.rules` | recursive `bim-texture-library/{path=**}` (read=auth, write=super-admin). |
| i18n `el` + `en` | `bimRealisticMaterials.*` keys (πρώτα στα locale JSON, N.11). |

### Patterns

- **Async-preload→version-bump→resync** = αντιγραφή του `bim-mesh-cache` (ADR-411) — δοκιμασμένο,
  μη-blocking.
- **Graceful flat fallback** = όσο λείπουν textures, ο χρήστης βλέπει το παλιό flat-color (μηδέν
  «σπασμένο» frame, μηδέν regression).
- **Καθαρά 3D** — κανένα canvas micro-leaf αρχείο (ADR-040) δεν αγγίζεται· **όχι** CHECK 6B/6D staging.

---

## Συμμόρφωση με project rules

- **N.0.2 (anti-duplication):** το UV/cache/version-bump pattern επαναχρησιμοποιεί το mesh-library
  blueprint· `offsetPolyline` είναι ήδη SSoT (per-layer walls)· μηδέν copy-paste.
- **N.5 (license):** `three.js`/`TextureLoader` = MIT (ήδη dependency)· textures = CC0 (Poly Haven) /
  CC-BY με attribution (ADR-409).
- **N.6 (enterprise IDs):** **δεν εφαρμόζεται** — μηδέν νέο Firestore collection (textures = Storage assets).
- **N.7.1 (file size):** όλα τα νέα αρχεία < 500 γρ· functions < 40 γρ.
- **N.11 (i18n):** toggle label → `el` **και** `en` JSON πρώτα.
- **ADR-040:** δεν αγγίζεται (3D-only) → **όχι** staging.

---

## Phases

| Φάση | Περιεχόμενο | Status |
|---|---|---|
| **Φ1** | **Vertical slice (αυτό το ADR):** foundation (4 νέα modules Δ1-Δ3/Δ6) + per-DNA-layer walls (Δ4) + **όλα** τα structural elements (wall/column/beam/slab/stair) με optional PBR + View-tab toggle (Δ5) + hybrid assets (Δ3) + graceful flat fallback. | 🟢 DONE 2026-06-03· 🔴 browser verify + Storage upload |

### Deferred (επόμενες φάσεις)

- **2D per-layer section/plan bands** — οι DNA layers φαίνονται per-layer στο 3D, αλλά η 2D
  τομή/κάτοψη ακόμα ζωγραφίζει core-only bands (αντιστοίχιση 2D↔3D layers).
- **Full-res Storage migration** — μετάβαση από public-demo textures σε ανεβασμένα full-res CC0 sets
  στο `bim-texture-library` (περιμένει Giorgio upload).
- **Material-library `BimMaterial`→texture link** — σύνδεση του υπάρχοντος material catalog record με
  texture slug (αντί registry-only mapping).
- **Per-layer openings edge-cases** — επαλήθευση ότι τα ανοίγματα (πόρτες/παράθυρα) κόβουν σωστά
  **όλα** τα per-layer sub-solids (όχι μόνο το core), με tilt (ADR-404) + attach clip (ADR-401).

---

## Consequences

- ✅ Παραμετρικά δομικά στοιχεία «σαν Revit»: ρεαλιστικά PBR υλικά (μπετόν/τούβλο/ξύλο/σοβάς) σε
  physically-sized UV tiling.
- ✅ Πολυστρωματικός τοίχος ορατός per-layer στο 3D (core + μόνωση + επένδυση).
- ✅ Full back-compat: χωρίς registry slug ή με toggle OFF → flat-color path αμετάβλητο.
- ✅ Ένα source-switch SSoT → public demo τώρα, full-res Storage μόλις ανέβει· μηδέν code change.
- ⚠️ Textures upload (Giorgio) + browser verify εκκρεμούν πριν το production look.
- ⚠️ Deferred items (2D bands, openings per-layer edge-cases) — βλ. πίνακα.

---

## Sources

- **ADR-363** (δομικά υλικά — το «Phase 6.x texture maps» placeholder).
- **ADR-366** (MaterialCatalog3D / SPEC-3D-003).
- **ADR-411** (bim-mesh-library — async-preload→version-bump→resync pattern).
- **ADR-409 §(B-θετικό) / §(D)** (Poly Haven CC0 textures, CC-BY με attribution).
- **three.js** `0.170.0` — MIT· `TextureLoader`, `MeshStandardMaterial` (`map`/`normalMap`/`roughnessMap`/`aoMap`), `RepeatWrapping`.
- **Poly Haven** textures — CC0 1.0 (`polyhaven.com/license`).

---

## Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| v1.5 | 2026-06-12 | Claude (Opus 4.8) | **SUBSUMED by ADR-446 (3D Visual Styles Manager).** Ο standalone `realisticMaterials` per-view boolean + το «Ρεαλιστικά Υλικά» ribbon toggle ΕΝΟΠΟΙΗΘΗΚΑΝ στον νέο `visualStyle` preset (FACES axis: `realistic` ⟺ textured PBR). Το `realisticMaterials` τώρα = **derived** `faceMode === 'realistic'` στο `resolveBimSettings` (back-compat για roof relief/`getRoofTileMaterial3D`)· το `RealisticMaterialsToggle.tsx` διαγράφηκε· `setRealisticMaterials` = legacy alias του `setVisualStyle`. ΜΗΔΕΝ συμπεριφορική αλλαγή στο default (realistic-edges). Βλ. ADR-446. |
| v1.4 | 2026-06-05 | Claude (Opus 4.8) | **+§2D APPEARANCE Phase 3 — user-upload 3D PBR υφών ανά υλικό που RENDER-ΑΡΟΝΤΑΙ (Revit «Appearance asset → Image» per-map slots, εγκεκριμένο Plan Mode).** Λύνει το αρχιτεκτονικό χάσμα: τα `bmat_*` materialIds **καταρρέανε** σε concrete στο `resolveMaterialKey` → τοίχος με DNA layer `bmat_*` εμφανιζόταν ΩΣ concrete στο 3D. Τώρα ο χρήστης ανεβάζει albedo (**υποχρεωτικό**)/normal/roughness/ao + `tileSizeM` (Revit «Sample Size») ανά `bim_materials` doc, που render-άρονται στους τοίχους. **ΑΠΟΦΑΣΕΙΣ Giorgio (Revit-true, FULL ENTERPRISE+SSOT):** εμβέλεια=μόνο `bmat_` (presets=built-in)· τοίχος μόνο (Phase 3)· 4 slots· tileSize user-input default 1m· company-scoped storage· ΕΝΑ appearance (swatch πέφτει στο albedo αν λείπει thumbnail)· dispose on change/delete. **NEW (6):** `bim-3d/materials/user-material-registry.ts` (reactive SSoT registry id→{def-by-category, textures}· per-material texture cache· stale-load guard· **teardown dispose** GPU textures on change/delete· REUSE `bumpTextureAssetVersion` resync)· `bim-3d/materials/pbr-texture-config.ts` (shared `configurePbrTexture` SSoT — Boy-Scout extract από `bim-texture-cache`)· `bim/services/bim-material-texture-upload.service.ts` (per-map upload, ≤8MB soft/10MB hard, typed `MaterialTextureUploadError`)· `app/UserMaterialRegistryHost.tsx` (always-on feeder, mirror RoofPersistenceHost, mounted DxfViewerTopBar)· `ui/panels/materials/MaterialPbrTexturesSection.tsx` + `hooks/useMaterialPbrTextureUpload.ts` (4-slot UI + staged/immediate lifecycle). **MODIFIED:** `bim-material-types.ts` (`PbrMaterialTextures` + `BimMaterial.pbrTextures` + Save/Update)· `MaterialLibraryService` (`pbrTextures ?? null`)· `material-catalog-defs.ts` (NEW `getCategoryMaterialDef` category→def SSoT)· `MaterialCatalog3D.ts` (`getMaterial3D` routes `bmat_`→`resolveUserMaterial`· version-aware cache· dispose)· `bim-texture-cache.ts` (uses shared `configurePbrTexture`)· `storage-path.ts` (NEW `buildBimMaterialTextureMapPath`)· `MaterialSwatch.tsx` (+`albedoUrl` prop: thumbnail→albedo→slug→flat)· `MaterialEditorDialog`/`MaterialsLibraryPanel`/`WallDnaEditor` (wiring). **Storage:** νέο rule `companies/{cid}/bim-material-textures/{materialId}/{file}` (company-scoped image/* ≤10MB) + `STORAGE_RULES_PENDING` (CHECK 3.19). i18n el+en `textures3d.*`. **ΜΗΔΕΝ** `firestore.rules`/`indexes`/`enterprise-id`/`audit-tracked-fields`. 19 νέα tests (upload 8 + registry 7 + catalog precedence 4) PASS + 26 regression PASS. `Bim3DEntitiesStore` ΑΝΕΠΑΦΟ (reuse bump) → **όχι** ADR-040 staging. ⚠️ shared tree με MEP agent (git add specific). 🔴 browser verify + commit + `firebase deploy --only storage` (Giorgio). |
| v1.3 | 2026-06-05 | Claude (Opus 4.8) | **+§2D APPEARANCE Phase 2 — user-upload μικρογραφίας υλικού (Revit «Appearance asset → image», εγκεκριμένο Plan Mode).** Ο χρήστης ανεβάζει δική του εικόνα ανά `bim_materials` doc, αποθηκευμένη σε **ΕΝΑ κεντρικό σημείο κλειδωμένο με `materialId`** (το ίδιο το doc — `thumbnailUrl` field). Όταν υπάρχει → **υπερισχύει** του Phase-1 albedo fallback παντού όπου υπάρχει `BimMaterial` doc (card + WallDnaEditor library options). DNA presets (`mat-*`) = built-in appearance → μένουν albedo (Revit-true «Duplicate-to-edit» μελλοντικά). **NEW (3):** `bim/services/bim-material-thumbnail-upload.service.ts` (mirror `hdri-upload.service` — `validateMaterialThumbnailFile` png/jpg/jpeg/webp ≤2MB + `uploadMaterialThumbnail` keyed by materialId, typed `MaterialThumbnailUploadError`)· +2 test suites (upload-service 8 + MaterialSwatch override 3). **MODIFIED:** `bim-material-types.ts` (`BimMaterial.thumbnailUrl: string\|null` + `SaveBimMaterialInput?` + `UpdateBimMaterialPatch` string\|null για αφαίρεση)· `MaterialLibraryService.saveMaterial` (`thumbnailUrl ?? null`· update κρατά `null` μέσω `stripUndefined`)· `storage-path.ts` (NEW `buildBimMaterialThumbnailPath` company-scoped SSoT)· `MaterialSwatch.tsx` (νέο `thumbnailUrl?` prop WINS πριν τον albedo resolver)· `MaterialEditorDialog.tsx` (ενότητα «Μικρογραφία»: edit=άμεσο upload, create=staged→upload-after-save seamless, race-safe graceful degradation)· `MaterialsLibraryPanel.tsx` (panel orchestrates create-upload + card swatch)· `WallDnaEditor.tsx` (library `bmat_` swatches). **Storage:** νέο rule `companies/{cid}/bim-material-thumbnails/{file}` (company-scoped, image/* ≤5MB) + δήλωση στο `STORAGE_RULES_PENDING` (CHECK 3.19). **ΜΗΔΕΝ** αλλαγή `firestore.rules` (no hasOnly allowlist) / `firestore.indexes.json` / `enterprise-id` (bmat υπάρχει) / `audit-tracked-fields` (bim_materials μη-audited). 35/35 tests PASS, tsc 0 δικά μου (1 pre-existing mesh-to-object3d:124). Καθαρά 2D/UI/Storage → **όχι** ADR-040. 🔴 browser verify + commit (Giorgio). |
| v1.2 | 2026-06-05 | Claude (Opus 4.8) | **+§2D APPEARANCE — μικρογραφίες υλικού στα material dropdowns (Revit material-browser swatch, Phase 1, εγκεκριμένο Plan Mode).** Το swatch ΕΙΝΑΙ το ίδιο PBR `albedo.jpg` που ζωγραφίζει το 3D (zero νέο asset, SSoT: chip == render). **NEW (3):** `bim/materials/material-catalog-defs.ts` (pure SSoT — `MATERIAL_DEFS` + `resolveMaterialKey` + `getMaterialFlatColorHex`, **εξαγωγή** από `MaterialCatalog3D` ώστε το 2D UI να μην φορτώνει three.js)· `bim/materials/material-thumbnail-resolver.ts` (`slugForMaterialId` [ίδιο resolution με το 3D] + `slugForMaterialCategory` [library `bmat_*` → category slug] + reactive `materialThumbnailStore` albedo-URL-by-slug μέσω `resolveTextureUrl`, δουλεύει public **και** storage· Phase-2-ready για user-upload override)· `ui/components/shared/MaterialSwatch.tsx` (κοινό component: img albedo + data-driven flat-colour chip fallback). **Refactor (Boy-Scout/SSoT):** `MaterialCatalog3D.ts` importάρει από το νέο pure defs (αφαίρεση τοπικών `MAT_DEFS`/`resolveKey`· συμπεριφορά identical). **Consumers:** `SlabDnaEditor` (πλάκα/στέγη Radix SelectItem+trigger)· `MaterialsLibraryPanel` (MaterialCard category swatch)· `WallDnaEditor` (**native `<select>`→Radix** ADR-001 migration + library/preset/custom groups + swatch). +2 test suites (35 tests) `bim/materials/__tests__/`, regression MaterialCatalog3D-system-tint + wall-material-catalog PASS, tsc 0 δικά μου. Καθαρά UI/2D → **όχι** ADR-040 staging. Deferred Phase 2: user-upload UI + `BimMaterial.thumbnailUrl` field + Storage path. 🔴 browser verify + commit (Giorgio). |
| v1.1 | 2026-06-04 | Claude (Opus 4.8) | **+`setBoxWorldUvs` (per-face world-meter UV) στο `bim-uv-helpers.ts`.** Το `setPlanarWorldUvs` προβάλλει όλες τις όψεις σε έναν άξονα → στις κάθετες όψεις box η υφή τεντώνεται σε λωρίδες. Το νέο helper επιλέγει το ζεύγος world-axes ανά όψη βάσει normal (±X→z,y · ±Y→x,z · ±Z→x,y), ώστε κάθε όψη να τιλάρει physically όπως οι ExtrudeGeometry auto-UVs του 3D. Χρήστης: «Edit Type» preview band boxes (ADR-414 §(f)) — η υφή ταιριάζει πλέον με τη σκηνή. +4 tests `__tests__/bim-uv-helpers.test.ts`, tsc 0. |
| v1.0 | 2026-06-03 | Claude (Opus orchestrator) | **Αρχική σύνταξη + Φ1 VERTICAL SLICE υλοποιημένη (εγκεκριμένο Plan Mode).** NEW modules: `bim/materials/bim-texture-registry.ts` (slug registry SSoT, Δ1)· `bim-3d/materials/texture-source.ts` (public↔Storage switch, Δ3)· `bim-3d/materials/bim-texture-cache.ts` (async TextureLoader + de-dup + version-bump, Δ6)· `bim-3d/converters/bim-uv-helpers.ts` (world-meter UV tiling `repeat=worldSizeM/tileSizeM`, Δ2). **Extensions:** `MaterialCatalog3D.ts` (optional albedo/normal/roughness/AO + `realisticMaterials` gate + flat fallback)· `wallToMesh` per-DNA-layer sub-solids μέσω `offsetPolyline` SSoT (Δ4)· `Bim3DEntitiesStore` texture version-bump resync· `bim-render-settings-store`/`-types` `realisticMaterials` flag default ON (Δ5)· View-tab toggle (mirror `ColorBySystemToggle`)· `storage.rules` `bim-texture-library/{path=**}` recursive· i18n el+en. Textures CC0 (Poly Haven) / CC-BY με attribution (ADR-409, Δ7). Hybrid assets (public demo τώρα ↔ full-res Storage μετά). Graceful flat fallback. Καθαρά 3D → **όχι** ADR-040 staging. tsc 0· tests PASS. 🔴 browser verify + Giorgio texture upload + commit. Next-free ADR ήταν 413 (μετά ADR-412 family-types). Deferred: 2D per-layer section/plan bands, full-res Storage migration, material-library `BimMaterial`→texture link, per-layer openings edge-cases verification. |
