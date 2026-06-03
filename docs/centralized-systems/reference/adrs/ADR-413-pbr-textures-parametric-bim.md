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
| v1.0 | 2026-06-03 | Claude (Opus orchestrator) | **Αρχική σύνταξη + Φ1 VERTICAL SLICE υλοποιημένη (εγκεκριμένο Plan Mode).** NEW modules: `bim/materials/bim-texture-registry.ts` (slug registry SSoT, Δ1)· `bim-3d/materials/texture-source.ts` (public↔Storage switch, Δ3)· `bim-3d/materials/bim-texture-cache.ts` (async TextureLoader + de-dup + version-bump, Δ6)· `bim-3d/converters/bim-uv-helpers.ts` (world-meter UV tiling `repeat=worldSizeM/tileSizeM`, Δ2). **Extensions:** `MaterialCatalog3D.ts` (optional albedo/normal/roughness/AO + `realisticMaterials` gate + flat fallback)· `wallToMesh` per-DNA-layer sub-solids μέσω `offsetPolyline` SSoT (Δ4)· `Bim3DEntitiesStore` texture version-bump resync· `bim-render-settings-store`/`-types` `realisticMaterials` flag default ON (Δ5)· View-tab toggle (mirror `ColorBySystemToggle`)· `storage.rules` `bim-texture-library/{path=**}` recursive· i18n el+en. Textures CC0 (Poly Haven) / CC-BY με attribution (ADR-409, Δ7). Hybrid assets (public demo τώρα ↔ full-res Storage μετά). Graceful flat fallback. Καθαρά 3D → **όχι** ADR-040 staging. tsc 0· tests PASS. 🔴 browser verify + Giorgio texture upload + commit. Next-free ADR ήταν 413 (μετά ADR-412 family-types). Deferred: 2D per-layer section/plan bands, full-res Storage migration, material-library `BimMaterial`→texture link, per-layer openings edge-cases verification. |
