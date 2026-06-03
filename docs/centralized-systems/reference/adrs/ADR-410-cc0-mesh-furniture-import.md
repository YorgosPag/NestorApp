# ADR-410 — Εισαγωγή CC0 επίπλων ως mesh-based BIM στοιχείο (mesh-import subsystem)

| Field | Value |
|---|---|
| Status | 🟢 **VERTICAL SLICE DONE** (2026-06-03, Opus 4.8 — εγκεκριμένο Plan Mode). Μία καρέκλα end-to-end: home-tab tool → 2D placement (footprint+glyph) → 3D mesh (Firebase Storage content-library + `FurnitureGltfCache`, bbox placeholder σε miss) → persist (Firestore + `furn_*` enterprise-id + entity-audit) → ΑΤΟΕ BOQ (pcs) → IFC `IfcFurniture` → discipline `interior` (πρώτος καταναλωτής). 23 νέα tests PASS, tsc 0. 🔴 Εκκρεμεί: upload 1 .glb στο Storage + browser verify + commit (Giorgio). **Deferred:** contextual properties tab (editing panel), live-cursor 2D ghost, batch pipeline, πολλά kinds, grips. |
| Date | 2026-06-03 |
| Owner | Giorgio / Claude (Opus 4.8) |
| Related | **ADR-409 §D.1** (CC0 mesh + δικά μας δεδομένα — νομικό θεμέλιο)· **ADR-406** (point-based MEP fixture — πλησιέστερο πρότυπο entity pipeline)· ADR-405 (discipline taxonomy — `interior` discipline)· ADR-407 (railings — units-safe 3D pattern)· ADR-040 (canvas micro-leaf renderer)· ADR-017/210/294 (enterprise IDs N.6) |

---

## Context — γιατί υπάρχει αυτό το ADR

Το ADR-409 §D.1 κατοχύρωσε νομικά τον δρόμο **«CC0 σχήμα + δικά μας δεδομένα»**: παίρνουμε ένα
public-domain 3D μοντέλο (geometry χωρίς καμία δέσμευση) και του προσθέτουμε **εμείς** το BIM
επίπεδο (properties, IFC classification, ΑΤΟΕ BOQ) → εμείς γινόμαστε ο δημιουργός του BIM
αντικειμένου → 100% καθαρό για εμπορική αναδιανομή.

Ο Giorgio θέλει να ξεκινήσει η υλοποίηση αυτού του δρόμου με **έπιπλα από το Poly Haven**
(verified καθολικά CC0 — ADR-409 §B-θετικό, 3-vote). Τα έπιπλα είναι **fixed-shape** στοιχεία
(δεν «τεντώνουν» παραμετρικά) → ιδανικά για mesh-based αναπαράσταση, σε αντίθεση με τα structural
(δοκάρι/κολώνα/κάγκελο) που μένουν parametric (ADR-409 §D.2).

### 🚨 Η κρίσιμη αρχιτεκτονική πραγματικότητα (Explore recon 2026-06-03)

> Το σημερινό 3D pipeline είναι **100% parametric/procedural**. **ΔΕΝ υπάρχει κανένας
> `GLTFLoader` πουθενά** στο codebase (το `floorplan-background` φορτώνει 2D raster/PDF, άσχετο).
> Η φόρτωση **εξωτερικού mesh** είναι **εντελώς νέα δυνατότητα** — αυτό είναι το πραγματικό
> αρχιτεκτονικό βάρος του ADR-410, όχι το entity boilerplate (το οποίο είναι 1:1 mirror του ADR-406).

### Πώς το λύνουν οι μεγάλοι (industry convergence)

| Παίκτης | Μηχανισμός |
|---|---|
| **Revit** | Loadable furniture families (RFA). Geometry + parameters σε ένα αρχείο, τοποθέτηση σε work-plane / floor. |
| **ArchiCAD** | GDL / imported objects (3DS, OBJ, IFC). 2D symbol (footprint) + 3D model. |
| **SketchUp / 3D Warehouse** | Imported components, free placement. |
| **IFC** | `IfcFurniture` (IFC4 ADD2, subtype του `IfcFurnishingElement`). |

**Κοινός παρονομαστής:** σταθερό σχήμα, free placement σε δάπεδο, 2D footprint symbol + 3D mesh,
discipline = interior/furnishing.

---

## Decision — η πολιτική σε 5 αποφάσεις

Νέο **generic mesh-based BIM entity** (`type: 'furniture'`) με `kind` discriminator
(`'chair'` πρώτο· επεκτείνεται σε `'sofa' | 'table' | 'cabinet' | 'bed' | …` **χωρίς νέο
EntityType**). Η geometry του 3D προέρχεται από CC0 glTF mesh μέσω **async cache**· το 2D
από authored footprint (δεν φορτώνει το glTF).

Παρακάτω κλείνουν οι **6 ανοιχτές αποφάσεις** του handoff.

---

### Απόφαση 1 — async glTF: **Option A — `FurnitureGltfCache` (pre-load + sync read + bbox placeholder)** ✅

**Πρόβλημα:** το `BimSceneLayer.syncFloorEntities()` είναι **σύγχρονο** — δεν μπορεί να καλέσει
async `GLTFLoader.loadAsync()` μέσα στο loop χωρίς να σπάσει το ενιαίο visibility/floor/building
filter chain.

**Απόφαση (Option A):**
- **SSoT:** `FurnitureGltfCache` — `Map<assetId, THREE.Group>` (cloned per instance μέσω
  `SkeletonUtils.clone` / `.clone(true)`), ίδιο μοτίβο με το υπάρχον `TextureLoader` + cache.
- **Pre-load (async, εκτός sync loop):** στο placement (όταν διαλέγεις έπιπλο από catalog) +
  στο hydration (όταν φορτώνεται όροφος με υπάρχοντα furniture entities) → `cache.preload(assetId)`.
- **Sync read στο loop:** `syncFurniture()` διαβάζει **σύγχρονα** `cache.get(assetId)`.
  - **Cache hit** → clone + placement transform → mesh.
  - **Cache miss** (ακόμη φορτώνει) → **bounding-box placeholder** (`THREE.BoxGeometry`
    widthMm×depthMm×heightMm από catalog defaults) μέχρι να φορτώσει· `onLoad` → `requestResync()`.
- Το placeholder **σέβεται** ολόκληρο το visibility/floor/discipline filter chain (το mesh
  ζει στο ίδιο group με τα υπόλοιπα entities).

**Γιατί όχι Option B** (πάντα bbox στο loop, πραγματικό glTF σε ξεχωριστό group εκτός loop):
σπάει το ενιαίο visibility filter — το glTF group θα έπρεπε να συγχρονίζεται χειροκίνητα με
floor/building/discipline toggles → duplicate state, race conditions. **Απορρίπτεται.**

---

### Απόφαση 2 — διανομή assets: **Firebase Storage (lazy-load), ΟΧΙ bundle στο repo** ✅

| Κριτήριο | Bundle στο repo | **Firebase Storage** ✅ |
|---|---|---|
| Build size | μεγαλώνει (binary στο git) | καθαρό build |
| Offline | ναι | runtime fetch (acceptable — ήδη online app) |
| Υποδομή | καμία | **υπάρχει ήδη** (`storage.rules` company-scoped, `storage_upload_file`/`storage_get_signed_url`) |
| Lazy-load | όχι | ναι (φόρτωση μόνο όσων χρησιμοποιούνται) |

**Απόφαση:** Firebase Storage. Path: `furniture-library/<assetId>.glb` (shared library bucket,
read-all για authenticated users). Τα CC0 mesh «ανήκουν» στο app μετά το enrichment (ADR-409 §D.1)
→ νόμιμα τα φιλοξενούμε εμείς. Το `FurnitureGltfCache` φορτώνει μέσω signed URL / public read.

> ⚠️ **storage.rules:** χρειάζεται νέος κανόνας read για το `furniture-library/` path
> (read = authenticated, write = super-admin only). Μπαίνει στο vertical slice.

---

### Απόφαση 3 — asset pipeline / decimation: **build-time `.glb` + manual «hero» decimation, ξεκινώντας με λίγα** ✅

ADR-409 §D caveat: το manual enrichment ανά αντικείμενο **κοστίζει** → οικονομικό μόνο για
επιλεγμένα «hero» items, όχι μαζικά χιλιάδες. Πολλά CC0 είναι high-poly.

**Pipeline (offline / one-time per hero asset):**
1. Κατέβασμα glTF από Poly Haven (`api.polyhaven.com/files/<AssetName>`, 1k/2k variant).
2. **Decimation/optimization** (αν χρειάζεται) με `gltf-transform` CLI ή Blender → target
   < ~30k triangles για realtime, draco/meshopt compression optional.
3. Export σε **`.glb`** (binary, compact, single-file — προτιμητέο για three.js loading).
4. Upload στο Firebase Storage + δημιουργία catalog entry (`furniture-catalog.ts`) με
   authored metadata (footprint, default dimensions, ΑΤΟΕ code, IFC type).

**Απόφαση:** ξεκινάμε **χειροκίνητα** για λίγα hero items (1 στο vertical slice). Build-time
batch script (`tools/furniture-pipeline/`) γράφεται **αργότερα** όταν δικαιολογηθεί ο όγκος —
**ΔΕΝ** μπαίνει στο vertical slice (YAGNI).

> Νέο npm tooling (`gltf-transform`) = έλεγχος άδειας πριν install (N.5). Το `gltf-transform`
> είναι **MIT** — επιβεβαίωση στο vertical slice αν χρειαστεί· για 1 hero asset αρκεί manual
> Blender export, καμία νέα dependency.

---

### Απόφαση 4 — scale / transform model ✅

- glTF spec → geometry σε **μέτρα**. Το mesh **δεν** ξανα-κλιμακώνεται· μόνο το **placement
  transform** μπαίνει σε scene units.
- **Persisted transform** (στο `FurnitureEntity`): `position {x, y}` σε scene units +
  `rotationDeg` (περιστροφή γύρω από κατακόρυφο άξονα) + `mountingElevationMm` (ύψος βάσης) +
  optional `scaleOverride` (default 1).
- **Units-safe (ΚΡΙΣΙΜΟ):** χρησιμοποίησε το πρότυπο **`panelToMesh`/`railingToMesh`/`StairToThree`**
  (×`sceneUnitsToMeters`), **ΟΧΙ** το buggy `fixtureToMesh` (καταναλώνει footprint unscaled →
  σωστό μόνο σε meter scenes). Το glTF mesh είναι ήδη σε μέτρα → **μόνο το placement transform**
  (position) θέλει `× sceneToM`.
- **2D ghost** = footprint rectangle από `widthMm × depthMm` (catalog defaults) — **χωρίς** να
  φορτωθεί το glTF (γρήγορο, deterministic).
- **3D ghost** = το πραγματικό mesh (αν είναι ήδη στο cache) ή bbox placeholder (cache miss).

---

### Απόφαση 5 — bounding-box / footprint source: **catalog defaults (authored), με glTF bbox ως validation** ✅

- **Πηγή αλήθειας:** **authored catalog defaults** (`furniture-catalog.ts`) ανά asset
  (`widthMm`, `depthMm`, `heightMm`). Διαθέσιμα **χωρίς** φόρτωση glTF → 2D footprint + bbox
  placeholder λειτουργούν instant.
- **glTF bbox at load** = προαιρετικό **validation/refine** (warning αν αποκλίνει σημαντικά από
  τα authored defaults) — δεν είναι η primary πηγή (αποφεύγει async dependency στο 2D).

---

### Απόφαση 6 — `GLTFLoader` license & version ✅

- **three.js = `0.170.0`** (επιβεβαιώθηκε από `package.json`, ήδη dependency). License = **MIT** ✅.
- `GLTFLoader` ζει στο `three/examples/jsm/loaders/GLTFLoader.js` — **MIT**, μέρος του three.js
  repo, **καμία νέα dependency**, κανένα νέο license risk.
- `SkeletonUtils` (`three/examples/jsm/utils/SkeletonUtils.js`) για deep-clone group ανά instance
  — επίσης MIT.
- Bundle impact: ο `GLTFLoader` είναι tree-shakeable· φορτώνεται μόνο στο 3D viewport path.

---

## Αρχιτεκτονικός χάρτης — σημεία που αγγίζει το νέο `furniture` entity

> Self-contained αντίγραφο από το handoff RECOGNITION (Explore recon 2026-06-03) ώστε το ADR να
> στέκει μόνο του. **Πρότυπο 1:1 = ADR-406 mep-fixture** (point-based, contextual tab, 2D footprint,
> 3D converter, persistence, BOQ/IFC).

| Area | Αρχείο | Σημεία |
|---|---|---|
| EntityType union | `types/base-entity.ts` | πρόσθεσε `'furniture'` |
| Entity union + guard | `types/entities.ts` | union· `isBimEntity` |
| BimCategory + styles | `config/bim-object-styles.ts` | union· array· `DEFAULT_OBJECT_STYLES` |
| Discipline | `bim/discipline/bim-discipline.ts` | `DISCIPLINE_BY_CATEGORY` → `furniture: 'interior'` (το `interior` discipline υπάρχει αλλά **ΚΕΝΟ** — furniture = ο **πρώτος καταναλωτής** του) |
| 2D renderer | `rendering/core/EntityRendererComposite.ts` | `this.renderers.set('furniture', …)` — extend `BaseEntityRenderer` (render/getGrips/hitTest). **ADR-040: ZERO subscriptions, `getState()` at draw time.** Πρότυπο: `MepFixtureRenderer`/`ElectricalPanelRenderer` (footprint + symbol) |
| 3D entity store slice | `bim-3d/stores/Bim3DEntitiesStore.ts` | `furnitures: readonly FurnitureEntity[]` + `EMPTY_BIM_ENTITIES` |
| 3D scene dispatch | `bim-3d/scene/BimSceneLayer.ts` | νέο `syncFurniture()` (πρότυπο `syncFixtures`/`syncPanels`) — **Option A cache read** |
| **Units-safe** | `utils/scene-units.ts` | `sceneUnitsToMeters` — πρότυπο `panelToMesh`/`railingToMesh`, **ΟΧΙ** `fixtureToMesh` |
| **GLTFLoader (ΝΕΟ)** | δεν υπάρχει | `bim-3d/converters/furniture-gltf-loader.ts` + `FurnitureGltfCache` |
| Firestore collection | `config/firestore-collections.ts` | `FLOORPLAN_FURNITURE: … \|\| 'floorplan_furniture'` |
| Enterprise ID | `services/enterprise-id-convenience.ts` + `enterprise-id.service.ts` | `generateFurnitureId` + prefix `furn_*` (**N.6 — setDoc, ΟΧΙ addDoc**) |
| ΑΤΟΕ BOQ | `bim/config/bim-to-atoe-mapping.ts` | `BimEntityType`· `BIM_TO_ATOE_MAPPING`· `resolveAtoeMapping`· `deriveAtoeQuantity` — furniture → unit `'pcs'`, qty = 1 |
| IFC type | `bim/types/ifc-entity-mixin.ts` | union· array· Zod — πρόσθεσε **`'IfcFurniture'`** (IFC4 ADD2) |
| Catalog + Ribbon | νέο `bim/furniture/furniture-catalog.ts` (πρότυπο `bim/columns/section-catalog.ts`)· ribbon (πρότυπο `contextual-mep-fixture-tab.ts`)· placement `useFurnitureTool.ts` (FSM πρότυπο `useMepFixtureTool.ts`) + `bim-3d/placement/use-bim3d-furniture-placement.ts` |
| **Asset hosting (ΝΕΟ)** | `storage.rules` | νέος read κανόνας `furniture-library/<assetId>.glb` |

---

## Συμμόρφωση με project rules

- **N.6 (enterprise IDs):** `generateFurnitureId` → prefix `furn_*`, `setDoc` με ID, **ΠΟΤΕ** `addDoc`.
- **N.11 (i18n):** όλα τα labels (catalog names, ribbon, BOQ) → i18n keys σε `el` **και** `en`
  JSON **πρώτα** — μηδέν hardcoded strings.
- **N.5 (license):** three.js/GLTFLoader = MIT ✅ (ήδη dependency). Αν χρειαστεί `gltf-transform`
  → MIT (verify πριν install).
- **ADR-040 (canvas perf):** ο `FurnitureRenderer` = micro-leaf, ZERO store subscriptions,
  `getState()` at draw time. **CHECK 6D** → stage ADR-040 μαζί.
- **N.7.1 (file size):** όλα τα νέα αρχεία < 500 γρ· functions < 40 γρ.

---

## 🎯 ΠΡΟΤΕΙΝΟΜΕΝΟ VERTICAL SLICE (1 έπιπλο end-to-end — αναμονή έγκρισης)

**Έπιπλο:** μία **απλή καρέκλα** (π.χ. Poly Haven `WoodenChair_01` ή ισοδύναμο low-ish-poly
seating asset — επιβεβαίωση poly count στο placement). `kind: 'chair'`, discipline `interior`.

**Scope (end-to-end, mirror ADR-406):**
1. EntityType `'furniture'` + `FurnitureEntity` type + Zod schema + guard.
2. BimCategory `'furniture'` + object styles + discipline `interior` (πρώτος καταναλωτής).
3. `furniture-catalog.ts` με **1 entry** (chair): assetId, footprint defaults, ΑΤΟΕ, IFC.
4. **`furniture-gltf-loader.ts` + `FurnitureGltfCache`** (Option A) — η καρδιά του ADR.
5. Placement tool (2D click + 3D raycast) → 2D ghost (footprint) / 3D ghost (mesh).
6. 2D `FurnitureRenderer` (footprint + label, ADR-040 leaf).
7. 3D `syncFurniture()` + units-safe `furnitureToMesh` (cache read + bbox placeholder).
8. Persistence (Firestore `floorplan_furniture` + `generateFurnitureId` + entity audit).
9. ΑΤΟΕ BOQ (pcs, qty 1) + IFC `IfcFurniture`.
10. 1 asset uploaded στο Firebase Storage + storage.rules read κανόνας.
11. Tests (mirror ADR-406 test suite) + tsc clean.

**Εκτίμηση:** ~12-15 αρχεία, 3-4 domains, 1 νέα capability (glTF loading). **N.8 → Plan Mode**
(όχι orchestrator, αρκεί το vertical-slice scope).

**Deferred (μετά το slice):** batch asset pipeline script, πολλαπλά kinds (sofa/table/cabinet),
host-attach, grip UX (move/rotate παριτι — mirror ADR-406 v0.8 entity-agnostic hot-grips),
property panel, material override.

---

## Open Questions / Εκκρεμή

1. **Poly Haven asset επιλογή:** ποιο ακριβώς seating asset (poly count, footprint) — επιβεβαίωση
   στο vertical slice μέσω API.
2. **Storage path layout:** `furniture-library/<assetId>.glb` flat vs `furniture-library/<kind>/<assetId>.glb`
   — flat για το slice, ιεραρχικό αν μεγαλώσει.
3. **Draco/meshopt compression:** χρειάζεται; (decoder bundle κόστος vs μέγεθος asset) — eval όταν
   υπάρχουν πολλά assets, ΟΧΙ στο slice.
4. **2D symbol vs footprint:** authored 2D symbol (όπως family symbol φωτιστικού) ή απλό footprint
   rectangle + label; → footprint για το slice, authored symbols αργότερα.

---

## Sources

- **ADR-409** §B-θετικό (Poly Haven CC0, 3-vote verified) + §D.1 (CC0 mesh + δικά μας δεδομένα) +
  §Open Questions #4 (CC0 app-ready).
- **Poly Haven API** (confirmed 2026-06-03): `api.polyhaven.com/assets?type=models&categories=furniture`
  → 78 furniture + 32 seating· `api.polyhaven.com/files/<AssetName>` (glTF 4k/2k/1k, glb, blend, usd, fbx).
- **three.js** `0.170.0` (`package.json`) — MIT· `GLTFLoader`/`SkeletonUtils` σε `examples/jsm`.
- **Πρότυπο entity:** ADR-406 (point-based mep-fixture) — πλησιέστερο mirror.
- **IFC:** `IfcFurniture` (IFC4 ADD2, subtype `IfcFurnishingElement`).

---

## Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| v1.8 | 2026-06-03 | Claude (Opus 4.8) | **🪑→🛋️ Νέο `kind: 'table'` + 4 μοντέρνα CC0 τραπέζια (Giorgio: «μοντέρνα τραπέζια, όχι ρούστικ»).** Επέκταση καταλόγου επίπλων με 4 contemporary Poly Haven CC0 meshes: `coffee_table_round_01` (1301×1301×491), `modern_coffee_table_01` (600×1202×390), `modern_coffee_table_02` (1199×1200×369), `side_table_01` (550×450×551) — dims από πραγματικό POSITION-accessor bbox. Pipeline ίδιο (download 1k gltf → gltf-transform pack `.glb` → upload `gs://…/bim-mesh-library/furniture/<id>.glb` token+content-type + thumbnails `…/thumbnails/<id>.png`). **Κώδικας = μόνο 6 αρχεία δεδομένων/τύπων:** `FurnitureKind |= 'table'` (`furniture-types.ts`), `FurnitureKindSchema = z.enum(['chair','table'])` (`furniture.schemas.ts`), `FURNITURE_MAPPING.table` ΑΤΟΕ pcs (`bim-to-atoe-mapping.ts`), +4 catalog entries (`furniture-catalog.ts`), +4 i18n labels el+en. Picker/2D σιλουέτα/3D mesh (anchor `base` → στο πάτωμα)/persistence/BOQ προκύπτουν ΑΥΤΟΜΑΤΑ από το SSoT array (ADR-411 entity-agnostic mesh library). 23/23 furniture tests PASS, tsc 0 (δικά μου). 🔴 browser verify + commit (Giorgio). ⚠️ pre-existing tsc error άλλου agent: `mesh-to-object3d.ts:124` (`matId: string` vs union στο `getElementMaterial3D`, committed de57f9d5) — ΟΧΙ regression. |
| v1.7 | 2026-06-03 | Claude (Opus 4.8) | **♻️ Γενίκευση σε ADR-411 `bim-mesh-library` (full SSOT).** Το furniture mesh-subsystem έγινε entity-agnostic και τα έπιπλα είναι πλέον **thin consumers**: διαγράφηκαν `bim-3d/library/furniture-gltf-{cache,library}.ts`, `furniture-thumbnail-cache.ts`, `bim/furniture/furniture-silhouette.ts` (μετακόμισε σε `bim/mesh-library/mesh-silhouette.ts`)· `furniture-to-three` → delegate στο `mesh-to-object3d`· `FurnitureRenderer` + `useRibbonFurnitureBridge` → shared `mesh-silhouette-draw` / `bimMeshThumbnailStore`· `Bim3DEntitiesStore.furnitureAssetVersion`→`meshAssetVersion`. Storage: τα 4 CC0 .glb+thumbnails μετανάστευσαν `furniture-library/`→`bim-mesh-library/furniture/`. Συμπεριφορά αμετάβλητη (29/29 furniture+mesh tests PASS, tsc 0). Βλ. **ADR-411**. |
| v1.6 | 2026-06-03 | Claude (Opus 4.8) | **✏️ 2D top-view detail lines + picker trigger sizing fix (Giorgio).** (1) Το 2D αποτύπωμα είχε μόνο εξωτερικό περίγραμμα → προσθήκη **εσωτερικών γραμμών «όπως από κατακόρυφα πάνω»**: NEW `computeTopEdges` στο `furniture-silhouette.ts` (THREE.EdgesGeometry crease/boundary edges @30° → project plan (x,-z) → segments σε plan-meters· filter <6mm· cap 6000). Cache στο `FurnitureGltfCache` (+`getTopEdges`)· `FurnitureRenderer.drawTopEdges` (shared `planToWorld` mapper ώστε edges+silhouette ευθυγραμμισμένα· λεπτή/ανοιχτή γραμμή). 6 silhouette+edges tests. (2) **Picker trigger sizing:** η CSS `.dxf-ribbon-combobox-trigger` επιβάλλει `height:24px` → μόνο `min-height` το μεγαλώνει· σταθεροποίηση trigger thumbnail-box σε `min-h-20` (~80px) + 64px thumbnail· dropdown items 64px object-contain. `RibbonCombobox` render `<img>` σε trigger+items (Tailwind, ΟΧΙ inline-style). tsc 0. 🔴 browser verify detail lines. |
| v1.5 | 2026-06-03 | Claude (Opus 4.8) | **🖼️ Thumbnails στο picker dropdown («σαν Revit», Giorgio: ΝΑΙ).** 4 CC0 preview thumbnails (Poly Haven `cdn.polyhaven.com/asset_img/thumbs/<name>.png` → upload `gs://…/furniture-library/thumbnails/<id>.png` token+image/png, **self-hosted** §D.1). NEW `bim-3d/library/furniture-thumbnail-cache.ts` (async getDownloadURL resolver + useSyncExternalStore `use()` για ribbon re-render + `preloadAll()`). `useRibbonFurnitureBridge`: subscribe thumb-store, `preloadAll()` on tool-active (useEffect), getComboboxState(assetId) επιστρέφει **dynamic options με `imageUrl`** (overrides static). `RibbonComboboxOption.imageUrl?` + `RibbonCombobox` render `<img>` (Tailwind, ΟΧΙ inline-style N.3). **storage.rules fix:** `{assetFile}`→`{assetFile=**}` recursive (αλλιώς thumbnails/ = default-deny)· redeployed. tsc 0, 27 tests. 🔴 browser verify. |
| v1.4 | 2026-06-03 | Claude (Opus 4.8) | **📚 Βιβλιοθήκη καρεκλών + UI picker (Giorgio: «(Α)+(Β) πλήρης βιβλιοθήκη με επιλογή»).** (Α) Περιεχόμενο: 3 ακόμη CC0 καρέκλες Poly Haven (`dining_chair_02`, `painted_wooden_chair_01`, `plastic_monobloc_chair_01`) — download 1k gltf → gltf-transform pack `.glb` → upload `gs://…/furniture-library/<id>.glb` (token+content-type)· catalog dims από πραγματικό POSITION-accessor bbox· +3 catalog entries +6 i18n labels. **Καμία αλλαγή κώδικα pipeline — προσθήκη = μόνο δεδομένα (catalog entry + .glb + label)· αυτόματη 2D σιλουέτα/3D/persistence/BOQ.** (Β) UI picker (tool-active contextual tab, πρότυπο column drawing-branch): NEW `furniture-command-keys.ts` (+assetId/rotation/scale), `contextual-furniture-tab.ts` (panel «Βιβλιοθήκη» catalog-combobox GENERATED από FURNITURE_CATALOG SSoT + panel «Τοποθέτηση» rotation/scale), `useRibbonFurnitureBridge.ts` (drawing-mode: διαβάζει `furnitureToolBridgeStore`, assetId→setAssetId, rotation/scale→setParamOverrides). Wiring: ribbon-contextual-config (tab+`activeTool==='furniture'` trigger), useRibbonCommands (4 routing points), useDxfBimBridges + useDxfViewerRibbon (assembly). tsc 0. 🔴 browser verify picker. ❌ deferred: thumbnails στο dropdown, selection-mode edit (μόνο placement-mode picker τώρα). |
| v1.3 | 2026-06-03 | Claude (Opus 4.8) | **🪑 2D bounds-fix + auto top-view silhouette (Giorgio: «αντιπροσωπευτικό αποτύπωμα ανά έπιπλο»).** (1) Browser: 2D footprint δεν φαινόταν — `BoundsCalculator` (`rendering/hitTesting/Bounds.ts`) δεν είχε `furniture` case → null bounds → cull. Fix: furniture στο `calculateBimEntityBounds` group (projects `geometry.bbox`). **ΜΑΘΗΜΑ: νέο 2D BIM entity θέλει ΚΑΙ Bounds.ts case** (αλλιώς αόρατο + σπασμένο hit-test). (2) Αντικατάσταση του γενικού «τετράγωνο+Χ» glyph με **πραγματική σιλουέτα κάτοψης ανά asset**: NEW `bim/furniture/furniture-silhouette.ts` (pure geometry, ΟΧΙ GL render-to-texture → deterministic+testable): project mesh triangles→plan, barycentric raster σε binary grid, Moore-neighbour boundary trace, Douglas–Peucker simplify → outline σε plan-meters. Υπολογίζεται ΜΙΑ φορά στο glTF load, cache `Map<assetId,SilPoint[]>` στο `FurnitureGltfCache` (+`getSilhouette`), `markAllCanvasDirty()` για άμεσο 2D repaint (ο canvas δεν κάνει subscribe στο entities store). `FurnitureRenderer` σχεδιάζει τη σιλουέτα (meters→mm→scene-units, rotate+translate στο position)· fallback στο authored rectangle+glyph μέχρι να φορτώσει. 5 silhouette tests. ✅ browser-verified (3D καρέκλα + 2D σιλουέτα). tsc 0. |
| v1.2 | 2026-06-03 | Claude (Opus 4.8) | **🐛 2D-render fix + Firestore deploy.** (1) Browser bug: έπιπλο φαινόταν ΜΟΝΟ στο 3D, ΟΧΙ στο 2D — root cause = το **canvas-v2 DXF pipeline** έχει δικό του entity-type σύστημα (`DxfEntityUnion`) ξεχωριστό από το `EntityRendererComposite`· το `furniture` έλειπε από `dxf-types.ts` (union+`DxfFurniture`), `dxf-scene-entity-converter.ts` (inbound scene→Dxf· **εδώ τα entities «πέφτονταν» σιωπηλά**), `dxf-renderer-entity-model.ts` (outbound Dxf→Entity). **ΜΑΘΗΜΑ: νέο BIM 2D entity θέλει registration ΚΑΙ στο canvas-v2 dxf-pipeline, όχι μόνο στο EntityRendererComposite** (το σχόλιο στο converter το προειδοποιούσε ρητά). 4 αρχεία MOD, tsc 0. (2) **Firestore deploy** στο pagonis-87766: `firestore.indexes.json` (+2 furniture composite indexes companyId+projectId+floorplanId & projectId+floorplanId), `firestore.rules` (NEW match `/floorplan_furniture/` company-scoped owner/admin), `storage.rules` (NEW `/furniture-library/` auth-read super-admin-write) — ΟΛΑ released live. |
| v1.1 | 2026-06-03 | Claude (Opus 4.8) | **VERTICAL SLICE υλοποιήθηκε** (μετά από έγκριση Plan Mode). NEW: `furniture-types.ts`/`.schemas.ts`, `bim/furniture/{furniture-geometry,furniture-catalog,add-furniture-to-scene,furniture-firestore-service,furniture-audit-client}.ts`, `bim/renderers/FurnitureRenderer.ts` (ADR-040 leaf), `services/factories/furniture.factory.ts`, `bim-3d/library/{furniture-gltf-library,furniture-gltf-cache}.ts` (Option A), `bim-3d/converters/furniture-to-three.ts` (units-safe panel pattern), `bim-3d/placement/{FurniturePlacementGhost,use-bim3d-furniture-placement}.ts`, `hooks/drawing/{furniture-completion,useFurnitureTool}.ts`, `hooks/data/useFurniturePersistence.ts`, `app/FurniturePersistenceHost.tsx`, `ui/ribbon/hooks/bridge/furniture-tool-bridge-store.ts`, 4 test suites (23 tests). MOD registrations: base-entity/bim-base EntityType, entities union+`isFurnitureEntity`, bim-object-styles (BimCategory+arrays+styles), bim-discipline (`furniture`→`interior` + MODEL_DISCIPLINES), EntityRendererComposite, firestore-collections (`FLOORPLAN_FURNITURE`), enterprise-id (prefix `furn`+generator), bim-to-atoe (`furniture`→pcs), ifc-entity-mixin (`IfcFurniture`), Bim3DEntitiesStore (slice+`furnitureAssetVersion`), BimSceneLayer (`syncFurnitures`), bim3d-resync, MaterialCatalog3D (`elem-furniture`), storage.rules (`furniture-library/` read), ToolType+home-tab button (Armchair icon)+tool-definitions, useSpecialTools/useCanvasClickHandler/CanvasSection wiring, BimViewport3D placement, dxf-export map, boq sourceEntityType, audit-tracked-fields, i18n el+en (19 keys). tsc 0, 23 furniture tests PASS. **Deferred:** contextual properties tab, live 2D ghost, batch asset pipeline, multi-kind, grips, host-attach. 🔴 Storage upload + browser verify + commit pending. |
| v1.0 | 2026-06-03 | Claude (Opus 4.8) | **Αρχική σύνταξη (PROPOSED).** Mesh-import subsystem για fixed-shape CC0 BIM έπιπλα (δρόμος ADR-409 §D.1). Έκλεισαν οι 6 ανοιχτές αποφάσεις του handoff: (1) **Option A** `FurnitureGltfCache` async pre-load + sync read + bbox placeholder· (2) **Firebase Storage** lazy-load (όχι bundle)· (3) build-time `.glb` + manual hero decimation, ξεκινώντας λίγα (YAGNI batch script)· (4) transform = position scene-units + rotationDeg + mountingElevationMm + scaleOverride, units-safe `panelToMesh` pattern· (5) footprint από authored catalog defaults (glTF bbox = validation)· (6) `GLTFLoader` = three.js 0.170.0 MIT, καμία νέα dependency. Αρχιτεκτονικός χάρτης (12 touchpoints, πρότυπο ADR-406). **Vertical slice πρόταση: 1 καρέκλα end-to-end** (~12-15 αρχεία, Plan Mode). 🔴 **Αναμονή έγκρισης Giorgio πριν από κώδικα.** |
