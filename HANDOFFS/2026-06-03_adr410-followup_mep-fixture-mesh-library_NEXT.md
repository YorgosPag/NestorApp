# HANDOFF — CC0 mesh treatment για ΦΩΤΙΣΤΙΚΑ (mep-fixture), όπως τα έπιπλα (ADR-410)

**Ημερομηνία:** 2026-06-03
**Τύπος:** RECOGNITION → ADR/Plan → (έγκριση) → υλοποίηση. ΟΧΙ τυφλό coding.
**Σχετικά ADR:** **ADR-410** (CC0 furniture mesh-import — ΜΟΛΙΣ ΟΛΟΚΛΗΡΩΘΗΚΕ, το πρότυπο) · **ADR-406** (point-based mep-fixture/φωτιστικό — υπάρχον, parametric) · ADR-405 (discipline) · ADR-040 (canvas micro-leaf) · ADR-409 §D.1 (CC0 legality).
**Μοντέλο:** Opus 4.8 (αρχιτεκτονική/cross-cutting).

---

## 🎯 ΤΙ ΘΑ ΚΑΝΕΙΣ

Ο Giorgio θέλει τα **φωτιστικά** να αποκτήσουν την ΙΔΙΑ μεταχείριση που μόλις φτιάξαμε για τα **έπιπλα** (ADR-410):
- Πραγματικό **CC0 mesh** (Poly Haven) στο 3D (αντί για το τωρινό παραμετρικό «κουτί» family-symbol).
- **2D κάτοψη με αυτόματη σιλουέτα + εσωτερικές γραμμές λεπτομέρειας** («top view» — seat/back/legs ισοδύναμο για φωτιστικά: σχήμα + ανακλαστήρας/λάμπα).
- **Βιβλιοθήκη** φωτιστικών με **picker (dropdown με thumbnails)** στο contextual ribbon tab.

> Ο μηχανισμός των επίπλων είναι ΣΧΕΔΙΑΣΜΕΝΟΣ να γενικεύεται. **Η κύρια αρχιτεκτονική απόφαση** (κλείσ' την στο ADR/plan): **ΓΕΝΙΚΕΥΣΕ** το furniture mesh-subsystem σε entity-agnostic «BIM mesh library» και κάνε τα mep-fixtures καταναλωτές — **ΜΗΝ** αντιγράψεις όλο το pipeline (N.0.2 anti-duplication).

---

## ✅ ΤΟ ΠΡΟΤΥΠΟ ΠΟΥ ΗΔΗ ΔΟΥΛΕΥΕΙ (ADR-410 furniture) — αντίγραψε/γενίκευσε ΑΠΟ ΕΔΩ

Όλα κάτω από `src/subapps/dxf-viewer/` εκτός αν αλλιώς.

**Mesh subsystem (το «καύσιμο» — γενίκευσέ το):**
- `bim-3d/library/furniture-gltf-library.ts` — Storage URL resolver (`furniture-library/<assetId>.glb` → `getDownloadURL`, in-flight dedup).
- `bim-3d/library/furniture-gltf-cache.ts` — **Option A**: `Map<assetId, THREE.Group>` + `preload()` (async) + `get()`/`getInstance()` (sync clone) + bbox placeholder σε miss → `bumpFurnitureAssetVersion()` (3D resync) + `markAllCanvasDirty()` (2D). Κρατά ΚΑΙ silhouette + topEdges + (μέσω thumbnail-cache) previews.
- `bim/furniture/furniture-silhouette.ts` — **pure geometry, ΟΧΙ GL**: `computeTopSilhouette` (project tris→raster grid→Moore boundary trace→Douglas-Peucker) + `computeTopEdges` (THREE.EdgesGeometry @30°→project plan→segments). Επιστρέφουν plan-meters relative to origin (three world x,z → plan x=worldX, y=-worldZ).
- `bim-3d/converters/furniture-to-three.ts` — `furnitureToObject3D` (cache hit→clone+place· miss→bbox placeholder). **Units-safe `panelToMesh` pattern** (×`sceneUnitsToMeters` ΜΟΝΟ στο placement· glTF=μέτρα· ΟΧΙ buggy `fixtureToMesh`).
- `bim-3d/library/furniture-thumbnail-cache.ts` — async resolve `furniture-library/thumbnails/<id>.png` + `useSyncExternalStore use()` (ribbon re-render) + `preloadAll()`.

**Entity + 2D:**
- `bim/types/furniture-types.ts` + `furniture.schemas.ts` (Zod) — `assetId`, `position`, `rotationDeg`, `widthMm/depthMm/heightMm`, `mountingElevationMm`, `scaleOverride?`.
- `bim/furniture/furniture-geometry.ts` (footprint rectangle), `furniture-catalog.ts` (SSoT: id/kind/labelKey/dims/atoeCode — options & thumbnails GENERATED από εδώ).
- `bim/renderers/FurnitureRenderer.ts` — ADR-040 leaf· σχεδιάζει σιλουέτα(fill+outline) **+ `drawTopEdges`** (κοινό `planToWorld` mapper)· fallback rectangle+glyph μέχρι load.
- `services/factories/furniture.factory.ts`, `hooks/drawing/{furniture-completion,useFurnitureTool}.ts`, `bim-3d/placement/{FurniturePlacementGhost,use-bim3d-furniture-placement}.ts`.

**Persistence/3D wiring:** `bim/furniture/furniture-firestore-service.ts`, `furniture-audit-client.ts`, `hooks/data/useFurniturePersistence.ts`, `app/FurniturePersistenceHost.tsx`, `bim-3d/stores/Bim3DEntitiesStore.ts` (`furnitures` slice + `furnitureAssetVersion`), `bim-3d/scene/BimSceneLayer.ts` (`syncFurnitures`), `bim3d-resync.ts`.

**Picker (το UI πρότυπο):**
- `ui/ribbon/data/contextual-furniture-tab.ts` — tool-active contextual tab· panel «Κατάλογος» (catalog combobox GENERATED από `FURNITURE_CATALOG`) + «Γεωμετρία» (rotation/scale).
- `ui/ribbon/hooks/useRibbonFurnitureBridge.ts` — drawing-mode bridge (διαβάζει `furnitureToolBridgeStore`· assetId→setAssetId· rotation/scale→setParamOverrides)· **dynamic options με `imageUrl`** (thumbnails).
- `ui/ribbon/hooks/bridge/{furniture-command-keys,furniture-tool-bridge-store}.ts`.
- `RibbonComboboxOption.imageUrl?` (`ui/ribbon/types/ribbon-types.ts`) + `RibbonCombobox.tsx` (render `<img>` σε trigger+items, Tailwind, ΟΧΙ inline-style).
- Wiring: `app/ribbon-contextual-config.ts` (tab + `activeTool==='furniture'` trigger), `ui/ribbon/hooks/useRibbonCommands.ts` (4 routing points), `app/useDxfBimBridges.ts` + `app/useDxfViewerRibbon.ts` (assembly).

---

## 🚨 ΛΑΘΗ/GOTCHAS ΠΟΥ ΜΑΣ ΧΤΥΠΗΣΑΝ (νέο 2D BIM entity θέλει ΟΛΑ αυτά — αλλιώς αόρατο/σπασμένο)

1. **`rendering/hitTesting/Bounds.ts`** — βάλε το νέο type στο `calculateBimEntityBounds` group. Αλλιώς null bounds → **cull (αόρατο 2D)** + σπασμένο hit-test (console: «Unknown entity type»).
2. **canvas-v2 DXF pipeline** (ξεχωριστό από EntityRendererComposite!): `canvas-v2/dxf-canvas/dxf-types.ts` (union + `DxfXxx` interface + `DxfEntityUnion`), `hooks/canvas/dxf-scene-entity-converter.ts` (inbound scene→Dxf· **εδώ πέφτονται σιωπηλά** αν λείπει case), `canvas-v2/dxf-canvas/dxf-renderer-entity-model.ts` (outbound Dxf→Entity). [Τα mep-fixtures ΗΔΗ είναι εδώ — δες αν θες αλλαγή.]
3. **`storage.rules`** — recursive wildcard `match /<lib>/{file=**}` (αλλιώς thumbnails/ subfolder = default-deny). **Deploy** μετά.
4. **CSS combobox**: `.dxf-ribbon-combobox-trigger` έχει `height:24px` → ΜΟΝΟ `min-h-*` το μεγαλώνει (όχι `h-auto`). Το trigger thumbnail-box στο furniture = `min-h-20`.
5. `EntityRendererComposite.ts` (2D renderer registry), `tool-definitions.ts`, `dxf-export.types.ts` (total Record), `audit-tracked-fields.ts`, `boq.ts sourceEntityType` — όλα total/registry, θέλουν το νέο type.

---

## 🏗️ ASSET PIPELINE (πώς ανέβασα τα CC0 — επανάλαβέ το για φωτιστικά)

Poly Haven lights: `https://api.polyhaven.com/assets?type=models&categories=lighting` (επιβεβαίωσε category) → `https://api.polyhaven.com/files/<AssetName>` (1k gltf + .bin + textures).
1. Κατέβασμα 1k gltf+bin+textures (διατήρησε `textures/` δομή· node `fetch`).
2. **Pack σε single `.glb`**: `npx --yes @gltf-transform/cli@latest copy <in>.gltf <id>.glb` (MIT, χωρίς αλλαγή package.json).
3. **Upload** (gsutil ΣΠΑΣΜΕΝΟ — Python 3.13· χρησιμοποίησε `gcloud storage`):
   `gcloud storage cp <id>.glb "gs://pagonis-87766.firebasestorage.app/<lib>/<id>.glb" --content-type="model/gltf-binary" --custom-metadata="firebaseStorageDownloadTokens=$(node -e "console.log(require('crypto').randomUUID())")"`
   (το **download token** στο metadata είναι ΑΠΑΡΑΙΤΗΤΟ για να δουλέψει το `getDownloadURL`).
4. **Thumbnails**: `https://cdn.polyhaven.com/asset_img/thumbs/<AssetName>.png?width=256&height=256` → upload `<lib>/thumbnails/<id>.png` (content-type `image/png` + token).
5. Catalog dims: διάβασε POSITION-accessor `min/max` από το gltf → widthMm/depthMm/heightMm.

Project = **`pagonis-87766`** (= `NEXT_PUBLIC_FIREBASE_PROJECT_ID`· δεν υπάρχει `.firebaserc` → πάντα `--project pagonis-87766`). Bucket = `pagonis-87766.firebasestorage.app` (από `.env.local`, υπερισχύει).

---

## 🔧 ΥΠΑΡΧΟΝ mep-fixture (ADR-406) — τι θα μεταμορφώσεις

- Parametric: `bim/types/mep-fixture-types.ts` (`kind:'light-fixture'`, `shape` rect/circular, width/length). 2D = `MepFixtureRenderer` + `buildFixtureSymbol` (luminaire «X»). 3D = `fixtureToMesh` (**buggy units**). Tool `useMepFixtureTool`. Tab `contextual-mep-fixture-tab.ts`. Persist `useMepFixturePersistence` + `floorplan_mep_fixtures`. Discipline `electrical`.
- **Πρόταση υλοποίησης (κλείσ' τη στο plan):** πρόσθεσε optional `assetId` στο `MepFixtureParams`· όταν υπάρχει → mesh-based render (κοινό generalized cache/silhouette/edges/converter) + 2D σιλουέτα/top-edges· όταν λείπει → υπάρχον parametric symbol (back-compat). Picker «Βιβλιοθήκη Φωτιστικών» στο υπάρχον mep-fixture contextual tab (νέο panel catalog combobox με thumbnails, mirror furniture).
- Discipline ΦΩΤΙΣΤΙΚΩΝ = `electrical` (ΟΧΙ interior) — οι κατηγορίες/visibility μένουν.

---

## ⚠️ ΚΡΙΣΙΜΟ ΠΛΑΙΣΙΟ (ΜΗΝ το αγνοήσεις)
- 🌐 **Ελληνικά πάντα.**
- 🚫 **COMMIT/PUSH κάνει ΜΟΝΟ ο Giorgio.** Ποτέ εσύ. Ποτέ `--no-verify`. (N.(-1))
- 🌳 **SHARED working tree με άλλον agent.** `git add` **ΜΟΝΟ** συγκεκριμένα δικά σου αρχεία· **ΠΟΤΕ** `git add -A`. (Στο tree υπάρχει WIP άλλου agent: MEP-wire `mep-wire-routing`, `bim3d-wire-preview-rebuild`, `use-bim3d-wire-waypoint-interaction-3d`, `bim-subcategories`, `bim-render-settings-store`, `RibbonPanel`, `view-tab-bim-settings`, ADR-377/408 docs — ΜΗΝ τα πειράξεις.)
- 📦 **ΟΛΟ το ADR-410 furniture είναι UNCOMMITTED** (ο Giorgio θα κάνει commit). Τα CC0 `.glb` (4 καρέκλες) + thumbnails + firestore indexes/rules + storage.rules είναι **ΗΔΗ LIVE** στο `pagonis-87766` (ανεξάρτητα από git). Temp folders `.furn-lib`/`.furn-thumbs` = προς διαγραφή (untracked).
- 🏛️ **N.0.1 ADR-driven + N.8:** cross-cutting → RECOGNITION → ADR/Plan → **έγκριση Giorgio** → code. Generalize, μην duplicate (N.0.2).
- 🆔 N.6 enterprise IDs· 🌍 N.11 i18n el+en ΠΡΩΤΑ· ADR-040 micro-leaf (stage ADR-040 αν αγγίξεις BimSceneLayer/renderers — CHECK 6B/6D).
- 🔬 Tests: `npx jest "furniture"` πρότυπο (silhouette/geometry/completion/converter). `npx tsc --noEmit` καθαρό.

---

## 📎 ΠΡΩΤΑ ΒΗΜΑΤΑ (νέα συνεδρία)
1. Διάβασε **ADR-410** doc (changelog v1.0→v1.6 = όλη η ιστορία furniture) + **ADR-406**.
2. RECOGNITION: χαρτογράφησε τι από το furniture mesh-subsystem γενικεύεται (cache/library/silhouette/edges/thumbnail/picker/RibbonCombobox image).
3. Πρότεινε στον Giorgio: **γενίκευση σε entity-agnostic mesh-library** (π.χ. NEW ADR-411 ή §generalization στο ADR-410) + plan για mep-fixture opt-in via `assetId`. Vertical slice = **1 φωτιστικό CC0 end-to-end**.
4. ΣΤΑΜΑΤΑ για έγκριση πριν κώδικα (N.8).
- Memory: `~/.claude/projects/C--Nestor-Pagonis/memory/project_adr410_cc0_furniture_import.md` (πλήρες state + μαθήματα).
