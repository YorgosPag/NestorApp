# ADR-411 — BIM Mesh Library (entity-agnostic CC0 mesh assets)

| Field | Value |
|---|---|
| Status | 🟢 **VERTICAL SLICE DONE** (2026-06-03, Opus 4.8 — εγκεκριμένο Plan Mode). Γενίκευση του furniture mesh-subsystem (ADR-410) σε **entity-agnostic «BIM mesh library»** + opt-in mesh αναπαράσταση για τα **φωτιστικά** (ADR-406 mep-fixture). 1 CC0 κρεμαστό φωτιστικό end-to-end: mesh 3D (anchor top, κρέμεται από οροφή) + auto 2D σιλουέτα/top-edges + drawing-tool picker με thumbnails. tsc 0· 90/90 mesh+furniture+mep-fixture tests PASS. Assets live στο `bim-mesh-library/` (pagonis-87766). 🔴 Εκκρεμεί browser verify + commit (Giorgio). |
| Date | 2026-06-03 |
| Owner | Giorgio / Claude (Opus 4.8) |
| Related | **ADR-410** (CC0 furniture mesh-import — **το πρότυπο που γενικεύεται**, πρώτος consumer)· **ADR-406** (point-based mep-fixture — δεύτερος consumer, mesh opt-in)· **ADR-409 §D.1** (CC0 legality)· ADR-405 (discipline)· ADR-040 (canvas micro-leaf)· ADR-017/210/294 (enterprise IDs N.6) |

---

## Context — γιατί υπάρχει αυτό το ADR

Το ADR-410 έχτισε το **πρώτο** mesh-based BIM στοιχείο (έπιπλα) — και μαζί ένα ολόκληρο
mesh-import subsystem (async glTF cache, Storage URL resolver, αυτόματη 2D σιλουέτα από το
3D mesh, thumbnail picker). Το subsystem σχεδιάστηκε εξ αρχής **γενικεύσιμο**.

Ο Giorgio ζήτησε τα **φωτιστικά** να αποκτήσουν την ΙΔΙΑ μεταχείριση: πραγματικό CC0 mesh στο 3D
(αντί για το παραμετρικό «κουτί» family-symbol), αυτόματη 2D κάτοψη (σιλουέτα + εσωτερικές γραμμές
«top view») και βιβλιοθήκη με picker (thumbnails).

> **Αρχιτεκτονική απόφαση (Giorgio, «όπως οι μεγάλοι παίκτες, full enterprise + full SSOT»):**
> **ΓΕΝΙΚΕΥΣΕ** το furniture mesh-subsystem σε ένα **entity-agnostic** subsystem και κάνε **και**
> τα έπιπλα **και** τα φωτιστικά καταναλωτές του — **ΜΗΝ** αντιγράψεις το pipeline (N.0.2).

### Πώς το λύνουν οι μεγάλοι (industry convergence)

| Παίκτης | Μηχανισμός |
|---|---|
| **Revit** | **Content library** οργανωμένη ιεραρχικά ανά κατηγορία (Furniture, Lighting Fixtures, …). Ένα loadable-family σύστημα· κάθε family = geometry + 2D symbol + parameters, ανεξαρτήτως κατηγορίας. |
| **ArchiCAD** | Object library (GDL / imported), κοινός μηχανισμός για όλα τα αντικείμενα· 2D symbol + 3D model. |
| **IFC** | Geometry representation κοινή· η κατηγορία ορίζεται από το IFC class (`IfcFurniture`, `IfcLightFixture`, …). |

**Κοινός παρονομαστής:** **ΕΝΑΣ** μηχανισμός φόρτωσης/αναπαράστασης mesh assets, **παραμετρικός ανά
κατηγορία** — όχι ξεχωριστό pipeline ανά τύπο επίπλου/φωτιστικού.

---

## Decision

### Δ1 — Ένα entity-agnostic mesh-library subsystem (κώδικας SSoT)

Όλη η «μηχανή» mesh (URL resolution, async cache, σιλουέτα/edges, thumbnails, 3D converter,
2D σιλουέτα-draw) ζει σε **ένα** subsystem, παραμετρικό ανά **κατηγορία** (`bimCategory`).
Τα έπιπλα (ADR-410) και τα φωτιστικά (ADR-406) είναι **thin consumers** — μηδέν διπλασιασμός.

| Νέο αρχείο | Ρόλος |
|---|---|
| `bim-3d/library/bim-mesh-library/bim-mesh-url-resolver.ts` | `resolveMeshUrl(category, assetId)` → Storage download URL· in-flight de-dup. ΜΟΝΟ εδώ αλλάζει το hosting (CDN/bundle/signed). |
| `bim-3d/library/bim-mesh-library/bim-mesh-cache.ts` | Generic GLTFLoader + `Map<"category/assetId", THREE.Group>` (Option A) + σιλουέτα + top-edges cache. `preload(category, assetId)` (async, fire-and-forget)· `getInstance(category, assetId)` (sync clone)· `getSilhouette`/`getTopEdges`. Cache miss → consumer ζωγραφίζει bbox placeholder· on-load → generic `bumpMeshAssetVersion()` (3D resync) + `markAllCanvasDirty()` (2D repaint). |
| `bim-3d/library/bim-mesh-library/bim-mesh-thumbnail-cache.ts` | Generic preview resolver — `preload(category, assetId)` / `get` / `use()` (useSyncExternalStore). Picker dropdown thumbnails. |
| `bim/mesh-library/mesh-silhouette.ts` | **Μετακόμιση** του `furniture-silhouette.ts` — pure geometry (project tris→raster→Moore trace→Douglas-Peucker + `computeTopEdges`). Ήδη 100% entity-agnostic. |
| `bim-3d/converters/mesh-to-object3d.ts` | Generic units-safe converter (πρότυπο `panelToMesh`, **ΟΧΙ** buggy `fixtureToMesh`). Cache hit → clone+place· miss → bbox placeholder + preload. **`verticalAnchor: 'base' \| 'top'`** (έπιπλο=base στο πάτωμα· φωτιστικό=top κρέμεται από οροφή). |
| `bim/renderers/mesh-silhouette-draw.ts` | Shared 2D draw helper: σιλουέτα (fill+outline) + top-edges, με generic plan transform (`position`/`rotationDeg`/`sceneUnits`) + παλέτα παραμετρική. Κοινό furniture + fixture. |

### Δ2 — Storage layout «σαν Revit content library» (ιεραρχικό ανά κατηγορία)

```
bim-mesh-library/<bimCategory>/<assetId>.glb
bim-mesh-library/<bimCategory>/thumbnails/<assetId>.png
```

- `<bimCategory>` = το BimCategory string (`furniture`, `light-fixture`, …).
- Τα 4 live furniture assets **μεταναστεύουν** από το flat `furniture-library/` στο
  `bim-mesh-library/furniture/` (copy με διατήρηση download token — uncommitted batch).
- `storage.rules`: **ένας** recursive κανόνας `match /bim-mesh-library/{path=**}` (read=authenticated,
  write=super-admin) — καλύπτει όλες τις κατηγορίες + thumbnails subfolder.

### Δ3 — mep-fixture: opt-in mesh μέσω optional `assetId` (full back-compat)

Το `MepFixtureParams` αποκτά optional `assetId?` + `scaleOverride?`:
- **`assetId` υπάρχει** → mesh αναπαράσταση: 3D mesh (generic cache, `anchor:'top'`) + 2D σιλουέτα/top-edges.
- **`assetId` λείπει** → υπάρχον parametric family-symbol (2D) + extruded solid (3D). **Μηδέν regression**
  στα ήδη τοποθετημένα φωτιστικά / στα parametric tests.

Το φωτιστικό **δεν** προσθέτει νέο `EntityType` (είναι ήδη πλήρως registered παντού: `Bounds.ts`,
canvas-v2 dxf-pipeline, `EntityRendererComposite`, hit-test) → τα 2D registration gotchas του ADR-410
**δεν** ξανα-ισχύουν. Η αλλαγή είναι **renderer-internal branch** + **3D converter dispatch** + picker.

### Δ4 — Picker = drawing-tool (choose-before-place, mirror furniture)

Contextual tab όταν το mep-fixture tool είναι ενεργό → διαλέγεις CC0 μοντέλο (thumbnails) πριν το κλικ.
Το υπάρχον selected-entity editor tab (ADR-406 v0.7, parametric ιδιότητες) **μένει** για τα parametric
φωτιστικά. Asset-swap σε ήδη τοποθετημένο φωτιστικό = deferred.

### Δ5 — Generic resync signal

Ένας **κοινός** `meshAssetVersion` counter (αντικαθιστά το furniture-specific `furnitureAssetVersion`):
όταν φορτώσει ΟΠΟΙΟΔΗΠΟΤΕ mesh (έπιπλο ή φωτιστικό), bump → `BimViewport3D` resync → placeholder
αντικαθίσταται από το πραγματικό mesh. Ένα SSoT signal, όχι per-entity counters.

---

## Συμμόρφωση με project rules

- **N.0.2 (anti-duplication):** μηδέν copy-paste του furniture pipeline· furniture **refactor-άρεται**
  πάνω στο generic SSoT (full SSOT, αίτημα Giorgio).
- **N.5 (license):** three.js/GLTFLoader/SkeletonUtils = MIT (ήδη dependency)· assets = CC0 (Poly Haven).
- **N.6 (enterprise IDs):** το mep-fixture χρησιμοποιεί ήδη `generateMepFixtureId` (`mepfix_*`, setDoc).
- **N.11 (i18n):** όλα τα labels (catalog, picker) → `el` **και** `en` JSON πρώτα.
- **ADR-040 (canvas perf):** `MepFixtureRenderer`/`FurnitureRenderer` = micro-leaves (ZERO subscriptions)·
  `BimSceneLayer` αγγίζεται → **STAGE ADR-040** (CHECK 6B/6D).
- **N.7.1 (file size):** όλα τα νέα αρχεία < 500 γρ· functions < 40 γρ.

---

## Consequences

- ✅ **Ένα** mesh-library SSoT εξυπηρετεί ≥2 entity types· νέα mesh κατηγορία (sanitary, εξοπλισμός) =
  μόνο catalog + assets + 1 converter dispatch, μηδέν νέα υποδομή.
- ✅ Φωτιστικά «σαν Revit»: πραγματικό CC0 mesh + αυτόματη ρεαλιστική 2D κάτοψη + βιβλιοθήκη με thumbnails.
- ✅ Full back-compat: parametric φωτιστικά χωρίς `assetId` δουλεύουν αμετάβλητα.
- ⚠️ Migration των 4 live furniture assets στο νέο Storage tree (αναστρέψιμο copy).
- ⚠️ Re-verify του furniture (browser-verified slice) μετά το SSoT refactor.
- ⚠️ **Deferred:** asset-swap σε τοποθετημένο φωτιστικό, batch asset pipeline, draco/meshopt, πολλά kinds
  φωτιστικών, host-attach.

---

## Sources

- **ADR-410** (furniture mesh-import — όλο το πρότυπο, changelog v1.0→v1.6).
- **ADR-406** (point-based mep-fixture — ο δεύτερος consumer).
- **Poly Haven API**: `api.polyhaven.com/assets?type=models&categories=lighting`.
- **three.js** `0.170.0` — MIT· `GLTFLoader`/`SkeletonUtils` σε `examples/jsm`.

---

## Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| v1.4 | 2026-06-08 | Claude (Opus 4.8) | **+2 επιπλέον CC-BY μοντέλα ντουζιέρας (shower mesh library επέκταση).** Ο Giorgio έστειλε 6 Sketchfab links· license-check ΠΡΙΝ (Sketchfab API `/v3/models/<uid>`): **2 CC-BY downloadable** ✅ (`shower_tray_01` Ivan.Ivanov 1254×1254×300mm· `shower_tray_02` marcin_malcherek FREE 900×900×45mm slim), **4 απορρίφθηκαν** (3× «Standard» license μη-redistributable/μη-downloadable: FrancescoMilanese/madMIX Radaway[+2.3M faces, εμπορική μάρκα]/HQ3DMOD· 1× χωρίς άδεια Artistar3D). Download via Sketchfab API token (`/download`→`glb` signed URL)· μέτρηση bbox+units (three node, real meters ✅)· upload `bim-mesh-library/sanitary/shower_tray_0{1,2}.glb` (gcloud). NEW catalog entries (ακριβείς μετρημένες dims) + i18n el/en (`showerTray01/02`) + **Credits αυτόματο** (asset-credits παράγει από `SANITARY_MESH_CATALOG[].source`→μηδέν χειροκίνητο). Picker «3Δ Όψη» auto-shows (options derived SSoT): *Παραμετρικό · Heliona Cabin · Ivan tray · marcin slim tray*. 9/9 tests PASS (catalog+credits)· tsc 0 (data-only). ΕΚΤΟΣ ADR-040. 🔴 browser-verify + commit (Giorgio). ⚠️ minor follow-up: picker δείχνει ΟΛΑ τα sanitary presets ανεξ. kind (bridge guards on select)· σήμερα όλα=shower→OK. |
| v1.3 | 2026-06-08 | Claude (Opus 4.8) | **2D-symbol polish ντουζιέρας (3 ζητήματα, Plan Mode) — ενοποιημένη SSoT λύση.** **(#1 footprint mismatch)** ο picker (`useRibbonMepFixtureBridge` assetId branch) υιοθετεί το authored footprint του preset: `width=widthMm`, `length=depthMm`, `shape='rectangular'` → selection box/grips/hit-test/σιφόνι ευθυγραμμίζονται με το mesh (clear=κρατά footprint, χωρίς revert). **Catalog dims μετρήθηκαν ακριβώς από το glb (gcloud download + three Box3 σε node): X=1304/Y=2263/Z=1049 mm (όχι κατά προσέγγιση 1300/1050/2260)· local origin off-centre X +347mm→το recenter (#2) το διορθώνει.** **(#2 origin offset)** NEW pure `bim-3d/library/bim-mesh-library/mesh-footprint-recentre.ts` (`recentreMeshFootprint`): wrapper Group με X/Z bbox-center στο local origin (Y ανέπαφο=anchor). Το `bim-mesh-cache.preload` recenter ΠΡΙΝ το cache → **ίδιο template** σε 3D (`getInstance`) ΚΑΙ 2D (`computeTopSilhouette/Edges`) → αδύνατο desync. **(#3 top-view detail)** ο `MepFixtureRenderer` δείχνει την **πλήρη πραγματική mesh κάτοψη** — εξωτερικό περίγραμμα **ΣΥΝ** τις εσωτερικές feature edges (πόρτα/βρύση/λεκάνη) για όλα τα mesh fixtures· τα #1+#2 τις κάνουν ευθυγραμμισμένες/σωστού μεγέθους. **+proactive preload-on-miss:** αν ο assetId υπάρχει αλλά η silhouette δεν είναι cached (π.χ. δεν φορτώθηκε ποτέ 3D viewport), ο renderer καλεί `bimMeshCache.preload` (idempotent fire-and-forget→repaint on load) ώστε η κάτοψη να εμφανίζεται ΠΑΝΤΑ στο 2D. ⚠️ ΜΑΘΗΜΑΤΑ (2 iterations Giorgio): (a) 1η προσπάθεια αντικατέστησε silhouette με σχηματικό authored σύμβολο→«δεν φαίνεται top-view»→ρεαλιστική κάτοψη· (b) 2η έδειχνε μόνο περίγραμμα (`edges:null`)→«θέλω και τις λεπτομέρειες»→πλήρες silhouette+edges. NEW test `mesh-footprint-recentre.test.ts` (6) + bridge tests (3)· 33/33 PASS· tsc 0. ΕΚΤΟΣ ADR-040. 🔴 browser-verify 2D + commit (Giorgio). |
| v1.2 | 2026-06-08 | Claude (Opus 4.8) | **+Sanitary mesh category + shower mesh override (Δρόμος A, Plan Mode) — ✅ 3D BROWSER-VERIFIED.** NEW `bim/mep-fixtures/sanitary-fixture-mesh-catalog.ts` (**«Shower Cabin» by Heliona, CC-BY**, sketchfab e2c6a8dd· already real-world meters ~1.3×1.05×2.26m → μηδέν scale norm· uploaded `bim-mesh-library/sanitary/shower_realistic_01.glb` 5.3MB στο pagonis-87766.firebasestorage.app via `gcloud storage cp`). Ο `mep-fixture-to-mesh.ts` **γενικεύτηκε**: routing ανά kind μέσω **NEW SSoT `resolveFixtureMeshCategory(kind)`** (στο mep-fixture-types.ts) → sanitary=category `'sanitary'`+anchor `base`· light=`'top'`· λοιπά=null→parametric. Το `shower` mep-fixture κρατά connector DN50· `assetId` opt-in → 3D glTF + 2D silhouette (**μηδέν schema change** — assetId/scaleOverride υπήρχαν από v1.1). **Picker «3Δ Όψη»** (Παραμετρικό↔presets, SELECT_CLEAR_VALUE sentinel, kind-guard). **2D silhouette bugfix:** ο `MepFixtureRenderer` ψάχνε hardcoded `'light-fixture'` → σκέτο «Χ»· τώρα `resolveFixtureMeshCategory` (κοινό με converter, DRY). i18n el+en. NEW tests (5+5)· 84/84 mep-fixture PASS· tsc 0. ΕΚΤΟΣ ADR-040. **🔴 PENDING: 2D-symbol polish** (handoff `HANDOFFS/2026-06-08_adr411-shower-cabin-2D-polish_NEXT.md`): (1) footprint 900×900 vs mesh 1300×1050 mismatch, (2) mesh origin off-center→silhouette offset, (3) auto top-edges ανοιχτά. + browser-verify 2D + commit (Giorgio). |
| v1.1 | 2026-06-03 | Claude (Opus 4.8) | **VERTICAL SLICE υλοποιήθηκε.** NEW generic subsystem: `bim-3d/library/bim-mesh-library/{bim-mesh-url-resolver,bim-mesh-cache,bim-mesh-thumbnail-cache}.ts`, `bim/mesh-library/mesh-silhouette.ts` (μετακόμιση από furniture), `bim-3d/converters/mesh-to-object3d.ts` (anchor base/top, bbox-based), `bim/renderers/mesh-silhouette-draw.ts` (shared 2D). **furniture refactor (full SSOT, μηδέν duplication):** διαγράφηκαν `furniture-gltf-{cache,library}`, `furniture-thumbnail-cache`, `bim/furniture/furniture-silhouette`· `furniture-to-three` + `FurnitureRenderer` + `useRibbonFurnitureBridge` → thin consumers· `Bim3DEntitiesStore` `furnitureAssetVersion`→`meshAssetVersion` (Δ5). **mep-fixture opt-in:** `MepFixtureParams.assetId?`+`scaleOverride?` (+Zod)· NEW `light-fixture-catalog.ts` (1 CC0 pendant)· NEW `mep-fixture-to-mesh.ts` (anchor top)· `syncFixtures` mesh-branch· `MepFixtureRenderer` silhouette-branch· **picker** NEW `mep-fixture-library-command-keys.ts`+`contextual-mep-fixture-library-tab.ts`+`useRibbonMepFixtureLibraryBridge.ts` + tool/tool-bridge-store `assetId`/`setAssetId` + wiring (ribbon-contextual-config `activeTool==='mep-fixture'`, useDxfBimBridges, useRibbonCommands, useDxfViewerRibbon). i18n el+en. **Assets (pagonis-87766):** `bim-mesh-library/light-fixture/pendant_lamp_01.glb`+thumbnail (Poly Haven `modern_ceiling_lamp_01` 1k, gltf-transform pack)· 4 furniture migrated `furniture-library/`→`bim-mesh-library/furniture/`· storage.rules `bim-mesh-library/{path=**}` recursive (deployed). 3 NEW test suites (mesh-to-object3d anchor, mep-fixture-to-mesh, relocated mesh-silhouette)· tsc 0· 90/90 PASS. STAGE ADR-040 (CHECK 6B BimSceneLayer / 6D renderers). 🔴 browser verify + commit (Giorgio). |
| v1.0 | 2026-06-03 | Claude (Opus 4.8) | **Αρχική σύνταξη (PROPOSED, εγκεκριμένο Plan Mode).** Γενίκευση furniture mesh-subsystem → entity-agnostic `bim-mesh-library` (Δ1)· ιεραρχικό Storage `bim-mesh-library/<category>/` σαν Revit content library (Δ2)· mep-fixture opt-in mesh via `assetId?` με full back-compat (Δ3)· drawing-tool picker mirror furniture (Δ4)· κοινό `meshAssetVersion` resync signal (Δ5). Vertical slice = 1 CC0 κρεμαστό φωτιστικό end-to-end. 🔴 As-built changelog μετά την υλοποίηση. |
