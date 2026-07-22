# ADR-550: Unified Entity Render Contract — ΕΝΑ συμβόλαιο οντότητας, N backends (2D/3D)

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟢 Φ0+Φ2+Φ3+Φ4+Φ-Ghost+Φ-Preview2D+Φ-Ghost3D+Φ-Preview2D-B IMPLEMENTED (UNCOMMITTED) — Φ1 άνευ αντικειμένου |
| **Date** | 2026-06-29 |
| **Last Updated** | 2026-06-29 |
| **Category** | Canvas & Rendering |
| **Location** | `src/subapps/dxf-viewer/` (`rendering/`, `bim/renderers/`, `bim-3d/converters/`, `bim/geometry/shared/`) |
| **Author** | Claude (σχεδιασμός κατόπιν εντολής Giorgio) |
| **Related ADRs** | **ADR-549** (census — το «before»), ADR-040 (2D perf), ADR-366 (3D viewer), ADR-527 (SceneManager SSoT δεδομένων), ADR-535/542/545 (ήδη-ενοποιημένα overlays = proof-of-pattern), ADR-537 (κεντρικοποίηση 3D ghosts — ο Φ-Ghost seam), ADR-539 (faced-prism geometry) |

---

## Summary

Το ADR-549 κατέγραψε **2 pipelines** και **~57 entity-level μηχανισμούς** rendering. Το κύριο εύρημα: η εφαρμογή έχει ήδη **ΕΝΑ data model SSoT** (ADR-527), **ΕΝΑ 2D dispatch** (`EntityRendererComposite`) **και** — όπως αποδείχθηκε στην υλοποίηση (2026-06-29, βλ. Changelog) — **ΕΝΑ geometry SSoT ανά οντότητα** (`bim/geometry/{entity}-geometry.ts`, cached στο `entity.geometry`, διαβασμένο και από 2D και από 3D). Αυτό που **πραγματικά λείπει** είναι **κανένα ενιαίο entity contract / registry** που να εγγυάται ότι κάθε οντότητα ξέρει να εμφανίζεται 2D + 3D + ghost + grips.

> ⚠️ **Διόρθωση (2026-06-29):** Η αρχική σύλληψη αυτού του ADR υπέθετε **διπλό geometry** (2D & 3D να υπολογίζουν ανεξάρτητα). Η εξερεύνηση το **διέψευσε** — το geometry είναι ήδη SSoT (βλ. Changelog «pivot»). Το πραγματικό κενό είναι το **dispatch/registration fragmentation**, όχι το geometry.

Αυτό το ADR σχεδιάζει το **Unified Entity Render Contract**: ΕΝΑ συμβόλαιο ανά οντότητα (`draw2D` / `build3D` / `getGrips` / `ghost` / `geometry`), πάνω από το **υπάρχον** geometry SSoT. **Δεν** ενοποιεί τα backends — Canvas2D και Three παραμένουν δύο (όπως σε κάθε σοβαρό CAD).

**Πρότυπο:** AutoCAD `worldDraw()/viewportDraw()` (ένα entity, N contexts) + Revit «element → geometry → N view representations». Στρατηγική: **strangler-fig / adapter** — τυλίγουμε τους υπάρχοντες ~57 renderers σε ΕΝΑ contract, **δεν** τους ξαναγράφουμε.

---

## Context — γιατί όχι «ένας μηχανισμός για όλα»

Η αρχική σκέψη («ενοποίηση όλων σε έναν μοναδικό») είναι **σωστή στην πρόθεση** (SSoT, λιγότερος διπλασιασμός) αλλά **λάθος στο γράμμα**:

- Ο 2D καμβάς είναι **raster CPU API** (`CanvasRenderingContext2D`)· ο 3D είναι **GPU mesh API** (WebGL/Three). Θεμελιωδώς διαφορετικά — δεν υπάρχει ένα `draw()` και για τα δύο.
- **Κανένας μεγάλος δεν τα ενοποιεί:** AutoCAD = 2D wireframe vs 3D regen· Revit = plan/3D/section views· Cinema 4D = viewport OpenGL vs Redshift production. Όλοι κρατούν **N render backends**.

Το σωστό μοτίβο (και των τριών):
```
ΕΝΑ data model (SSoT)  →  ΕΝΑ geometry layer  →  N render backends
        ✅ ADR-527             ✅ ΥΠΑΡΧΕΙ ΗΔΗ          ✅ 2 (μένουν 2)
```
Και τα τρία layers υπάρχουν ήδη. **Αυτό που λείπει** είναι το **contract/registry** πάνω τους — όχι το geometry.

### Σημερινός πόνος (από ADR-549 §4 + εξερεύνηση 2026-06-29)
1. **Διάσπαρτα entity-type unions** (`bim-to-atoe-mapping.ts`, `types/base-entity.ts`, 24+ Kind unions) — κανένα canonical «renderable entity registry».
2. **Ανεξάρτητα dispatch χωρίς εγγύηση συμμετρίας** — 2D `EntityRendererComposite` (introspectable map) vs 3D `BimSceneLayer.sync*()` (imperative loops). Νέα οντότητα = εγγραφή σε **2-3 ξεχωριστά σημεία· εύκολο να ξεχαστεί το ένα → οντότητα που φαίνεται 2D αλλά όχι 3D.
3. Orphan/off-dispatch: διπλό `StairRenderer`, 4 BIM renderers εκτός composite.

> ✅ **ΟΧΙ πρόβλημα (διαψεύστηκε):** το geometry **δεν** είναι διπλό. Κάθε entity έχει `bim/geometry/{entity}-geometry.ts` (`computeColumnGeometry`/`computeBeamGeometry`/`computeSlabGeometry`) που υπολογίζει το geometry μία φορά, cached στο `entity.geometry.footprint.vertices`· ο 2D renderer (αμιγώς drawing) και ο 3D converter διαβάζουν το **ίδιο** field.

---

## Decision — το Contract

### Το συμβόλαιο (concept, όχι τελικό API)
```ts
interface EntityRenderContract<E> {
  readonly type: RenderableEntityType;        // canonical key (ΕΝΑ union SSoT)
  geometry(entity: E, ctx): EntityGeometry;   // ← υπολογίζεται ΜΙΑ φορά
  draw2D(g: EntityGeometry, ctx2d): void;     // Canvas2D backend
  build3D(g: EntityGeometry, scene): Object3D; // Three backend
  getGrips(entity: E): GripInfo[];            // ✅ ήδη ενιαίο (UnifiedGripRenderer)
  ghost(g: EntityGeometry): GhostSpec;        // preview (2D + 3D seams)
}
```

**Αρχές (μη διαπραγματεύσιμες):**
- `geometry()` = η ΜΙΑ πηγή· `draw2D`/`build3D` **καταναλώνουν**, δεν ξανα-υπολογίζουν.
- Τα δύο backends **μένουν δύο**. Καμία συγχώνευση Canvas2D ↔ Three.
- **Adapter, όχι rewrite:** οι υπάρχοντες renderers/converters γίνονται οι υλοποιήσεις πίσω από το contract. Μηδέν big-bang.
- Κάθε φάση **ανεξάρτητα shippable**, μηδέν regression, browser-verify πριν την επόμενη.

---

## Roadmap (φάσεις — έγκριση ανά φάση)

### Φ0 — Canonical `RenderableEntityType` registry (foundation) ✅ IMPLEMENTED (2026-06-29)
- ΕΝΑ const-array SSoT των renderable types (DXF + BIM), additive δίπλα στα διάσπαρτα unions.
- **Καμία αλλαγή συμπεριφοράς** — type consolidation + compile-time bridge (`RenderableEntityType ⊆ EntityType`).
- Παραδοτέο: `rendering/contract/renderable-entity-type.ts`.

### Φ1 — ~~Geometry SSoT~~ → ΗΔΗ ΛΥΜΕΝΟ (άνευ αντικειμένου)
- **Διαψεύστηκε (2026-06-29):** το geometry **δεν** είναι διπλό. Κάθε entity έχει ήδη `bim/geometry/{entity}-geometry.ts` (`compute*Geometry`), cached στο `entity.geometry`, διαβασμένο από 2D **και** 3D. Δεν υπάρχει τίποτα να εξαχθεί.
- Συνέπεια: το «πραγματικό κέρδος» μετατοπίζεται στο **contract/coverage** (Φ2/Φ3), όχι στο geometry.

### Φ2 — Entity contract registry + point auto-wiring ✅ IMPLEMENTED (2026-06-29)
- **Διόρθωση σχεδιασμού (audit):** το «παχύ» contract με ενιαία εκτελέσιμη `build3D(entity)` **ΑΠΟΡΡΙΦΘΗΚΕ** — θα ήταν rewrite. Η 3D πλευρά (`BimSceneLayer.syncFloorEntities`) είναι ετερογενής (cross-entity host-join σε batch). Οι μεγάλοι το ίδιο: AutoCAD `worldDraw` per-element αλλά Revit regen (join resolution) **δεν** εκτίθεται per-element.
- **Realized = δηλωτικό contract registry** (`entity-render-contract.ts`): ΕΝΑ `EntityRenderContract` ανά renderable type — `{ d2, d3, d3Builder: 'point'|'bespoke'|'none' }`. Απορροφά το `entity-render-surfaces.ts` (τώρα derived view). Invariant: `d3Builder !== 'none'` ⟺ `d3`.
- **Auto-wiring (Option B):** οι 11 ομοιόμορφες point-entity 3D factories (foundation/panel/manifold/radiator/boiler/water-heater/railing/roof/floor-finish/underfloor/furniture) δηλώνονται ΜΙΑ φορά σε executable registry (`bim-scene-point-contracts.ts`)· ο `BimSceneLayer` τις επαναλαμβάνει με ΕΝΑ loop αντί 11 χειροκίνητων `sync*()` μεθόδων (διαγράφηκαν). Adapter: ίδιος `syncPointEntities` SSoT, ίδιες factory κλήσεις.
- **Bespoke (10):** wall/opening/slab/slab-opening/column/beam/stair/mep-fixture/mep-segment/mep-fitting μένουν ρητά (host context) — δηλωμένα `d3Builder:'bespoke'`.
- **Ghost:** ΔΕΝ μπήκε στο contract στο Φ2 — κανένα introspectable live dispatcher (2D per-family, 3D ενιαίο overlay)· μη-ελεγχόμενο πεδίο θα σάπιζε. **Υλοποιήθηκε αργότερα ως Φ-Ghost** (3D placement ghost only — βλ. παρακάτω), αφού φτιάχτηκε ο introspectable seam.
- Παραδοτέα (NEW): `rendering/contract/entity-render-contract.ts`, `bim-3d/scene/bim-scene-point-contracts.ts`. (MOD): `entity-render-surfaces.ts` (derived), `BimSceneLayer.ts` (loop, −11 μέθοδοι), `bim-scene-point-syncs.ts` (export types), coverage test (+5 asserts).

### Φ3 — Coverage guarantee ✅ IMPLEMENTED (2026-06-29)
- Jest: το δηλωτικό μητρώο δένεται με τα ζωντανά dispatchers — 2D `EntityRendererComposite.getSupportedEntityTypes()`, 3D `BIM_3D_CONVERTER_TYPES`. Symmetry: κάθε BIM type (εκτός ρητών 2D-only) έχει ΚΑΙ 2D ΚΑΙ 3D.
- Λύνει το finding #3 του ADR-549 (οντότητα που φαίνεται 2D αλλά όχι 3D).
- Παραδοτέο: `rendering/contract/__tests__/entity-render-coverage.test.ts` (7 tests GREEN).

### Φ4 — Cleanup ✅ IMPLEMENTED (2026-06-29)
- **Διαγράφηκε** το orphan `rendering/entities/StairRenderer.ts` (re-export shim, κανένα call-site· canonical = `bim/renderers/StairRenderer.ts`).
- **Τεκμηριώθηκαν** οι 4 off-composite renderers (βλ. ADR-549 §4.2): `OpeningTag` = sub-renderer μέσα στο `OpeningRenderer`· `Envelope` = overlay `EnvelopeOverlay.tsx`· `MepWire` = function `drawCircuitWires` στο `HomeRunWiresOverlay.tsx`· `FloorplanSymbol` = πιθανό dormant Φ1 (εκκρεμεί επιβεβαίωση).

### Φ-Ghost — Ghost capability στο contract (3D placement ghost) ✅ IMPLEMENTED (2026-06-29)
- **SSoT audit (2 Explore agents):** το ghost dispatch ΗΤΑΝ κατακερματισμένο, χωρίς introspectable seam. **3D:** 11 per-family κλάσεις (`*PlacementGhost`), single switchboard, κανένα type-keyed registry. **2D:** triply-scattered (generator if-chain σε `DrawingTool` + wysiwyg-BIM + 9 bespoke Canvas2D renderers) — **όχι** introspectable.
- **Απόφαση (Giorgio):** «κεντρικοποίηση τώρα». Δημιουργήθηκε genuine introspectable type-keyed registry για το **3D placement ghost** (όπου υπάρχει bindable seam) + δηλωτικό πεδίο `placementGhost3D` + coverage binding — mirror του Φ2. Το **2D ghost μένει ρητά εκτός** (δεν υπάρχει introspectable 2D seam· ένα 2D πεδίο θα σάπιζε — ακριβώς ο λόγος που το Φ2 το άφησε έξω).
- **Adapter, ΟΧΙ rewrite:** το `PLACEMENT_GHOST_3D_FACTORIES` είναι factory-per-key (`satisfies Record<GhostBimType, …>` → completeness + concrete return type ανά key, no `any`). Τα 11 placement hooks instantiate-άρουν ΜΕΣΩ του registry (`new XxxPlacementGhost(scene)` → `FACTORIES.<type>(scene)`, one-line swap) → το μητρώο είναι **ζωντανό** (production-used)· νέο ghost εκτός registry δεν συνδέεται (κλείνει το orphan gap). Μηδέν αλλαγή build/update logic.
- **Coverage binding (3 asserts):** invariant `placementGhost3D ⟹ d3`· no-drift `PLACEMENT_GHOST_3D_TYPES === GHOST_BUILT_TYPES`· liveness `new THREE.Scene()` → κάθε factory `toBeInstanceOf(Cls)` + `dispose()` (no-lie, no-orphan).
- Παραδοτέα (NEW): `bim-3d/placement/placement-ghost-3d-contracts.ts`. (MOD): `entity-render-contract.ts` (`+placementGhost3D`, `+GHOST_BUILT_TYPES`, shorthand 2ο param, doc comment)· 11 hooks (one-line swap)· coverage test (+1 describe / 3 asserts).
- **Σημείωση:** μόνο instantiation seam άλλαξε — η συμπεριφορά του ghost είναι αμετάβλητη· browser-verify προαιρετικό (regression-safe).

---

## Non-goals (τι ΔΕΝ κάνουμε)
- ❌ **Δεν** ενοποιούμε Canvas2D + Three σε ένα backend.
- ❌ **Δεν** ξαναγράφουμε τους 57 renderers (adapter pattern).
- ❌ **Δεν** κάνουμε big-bang — κάθε φάση/οικογένεια ανεξάρτητα.
- ❌ **Δεν** πειράζουμε τα ήδη-ενιαία overlays (grips/crosshair/snap/HUD — ADR-535/542/545)· είναι το **proof** ότι το pattern δουλεύει, τα αφήνουμε.

## Risks
- **Registry drift** — το δηλωτικό μητρώο (`entity-render-surfaces.ts`) μπορεί να αποκλίνει από τα πραγματικά dispatchers. **Μετριασμένο** από το Φ3 coverage test (σπάει σε ασυμφωνία).
- **3D introspection συντήρηση** — το `BIM_3D_CONVERTER_TYPES` ενημερώνεται χειροκίνητα όταν αλλάζει το `BimSceneLayer.sync*()`. Το test το δένει με το μητρώο, αλλά όχι με τους ίδιους τους loops (imperative) — μελλοντικό Φ2 μπορεί να το κάνει introspectable.

---

## Σύσταση εκκίνησης
**Φ0+Φ2+Φ3+Φ4+Φ-Ghost υλοποιήθηκαν (2026-06-29).** Φ0/Φ3/Φ4 μηδέν ρίσκο. Φ2 αγγίζει `BimSceneLayer` (render-critical, ADR-366) → **απαιτείται browser-verify** των 11 point-entity οικογενειών πριν θεωρηθεί κλειστό. Φ-Ghost = regression-safe (μόνο instantiation seam, browser-verify προαιρετικό). Επόμενο προαιρετικό: 2D ghost binding αν/όταν κεντρικοποιηθεί ο 2D dispatch (3 μηχανισμοί → 1 introspectable seam).

---

## Changelog

### 2026-07-22 — Φ-Ghost3D hotfix: «λευκό φάντασμα» στη μετακίνηση σκάλας = translucent accumulation (UNCOMMITTED)
**Πλαίσιο (Giorgio, screenshots 2026-07-22):** στην 3D προβολή, κατά τη **μετακίνηση σκάλας με το gizmo** εμφανιζόταν μια **μεγάλη ΑΔΙΑΦΑΝΗΣ λευκή** επιφάνεια σε σχήμα σκάλας — **transient** σε ΟΛΟ το drag (pointer-down στα βελάκια → pointer-up).

**Ground truth (isolate από Giorgio — καθοριστικό):** (α) **ΜΕΝΕΙ και με ΣΒΗΣΤΟ το Επίπεδο Τομής** → **ΔΕΝ** είναι section (η πρώτη υπόθεση «section cut-cap / unclipped ghost» ήταν **λάθος στόχος**). (β) υπάρχει **μόνο** όσο κρατά το drag → είναι το **move-preview ghost** (Φ-Ghost3D).

**Ρίζα (σωστή):** το «original μένει φάντασμα» ghost (`edit-original-ghost.ts` → `PlacementGhostOverlay`) κλωνοποιεί τα meshes και τα δείχνει με **ημιδιαφανές `MeshBasicMaterial` (`opacity 0.45, depthWrite:false, transparent:true`)**. Μια σκάλα είναι **πολυεπίπεδο** στερεό (πολλά πατήματα/ρίχτια/μηρός στοιβαγμένα κατά μήκος της ακτίνας θέασης). Στο transparent back-to-front render **όλες** οι όψεις blend-άρουν διαδοχικά → η αδιαφάνεια **αθροίζεται** και φτάνει ~αδιαφανές **λευκό**. Αυτό είναι **τεκμηριωμένο failure mode** — το ίδιο το `post-fx-overlay-pass.ts` το γράφει: *«translucent fragments accumulate to white»*. Convex ghosts (column/wall/segment = 1-2 layers) δεν το δείχνουν· η σκάλα είναι η χειρότερη περίπτωση. **`depthWrite:true` ΔΕΝ το λύνει** (το transparent queue ταξινομεί back-to-front → αθροίζει έτσι κι αλλιώς).

**Απόφαση/υλοποίηση — order-independent (depth-primed) ghost για το edit path (scoped, μηδέν επίπτωση στα placement ghosts):**
- NEW option `PlacementGhostOverlay(..., orderIndependent)`. Όταν `true`, το ghost render-άρεται **λείο translucent** (opacity 0.45, όπως το 2D) με **depth-prime σε ΕΝΑ `renderer.render(root)`**: (1) ανά mesh προστίθεται **depth-prime twin** (`colorWrite:false, depthWrite:true`, OPAQUE queue → three το σχεδιάζει ΠΡΩΤΟ) που γράφει το **κοντινότερο** βάθος του ghost· (2) το colour material έχει **`depthFunc: EqualDepth`** (TRANSPARENT queue) → blend-άρει **μόνο** όπου το βάθος ισούται με το primed → **κάθε pixel βάφεται ΜΙΑ φορά** → μηδέν άθροιση, **χωρίς κουκίδες** (απορρίφθηκε το ενδιάμεσο `alphaHash`/screen-door — Giorgio «όλο κουκίδες»), σωστό occlusion. Οι twins μοιράζονται geometry (borrowed → δεν disposed). Default `false` → convex placement ghosts κρατούν το φθηνό single-material blend (καμία αλλαγή).
- `EditOriginalGhost` περνά `orderIndependent: true` (το edited entity μπορεί να είναι σκάλα = χειρότερη περίπτωση).

**Συμπληρωματικό (latent fix, ΚΡΑΤΗΘΗΚΕ — ΔΕΝ ήταν το λευκό):** τα mid-drag preview objects (ghost + resize/dependent/wire/pipe/fitting) έπαιρναν `clippingPlanes = null` → **υπό ενεργή τομή** θα ζωγραφίζονταν άκοπα πάνω από την κοπή (ορατό μόλις το ghost γίνει σωστά translucent). Reuse του `SectionSceneController.reapplyClipPlanesUnder` (ADR-665) μέσω νέας λεπτής `ThreeJsSceneManager.reapplySectionClip(root)`, wired στο `Bim3DEditLivePreview` (optional `reapplyClip`, εφαρμογή σε ghost.show + όλα τα apply*). Big-player parity (Revit/ArchiCAD: drag-preview σέβεται το section). Idempotent + subtree-scoped (σέβεται ADR-452 fast-path).

**Αρχεία:** `placement-ghost-overlay.ts`, `edit-original-ghost.ts` (accumulation fix) · `ThreeJsSceneManager.ts`, `use-bim3d-edit-interaction.ts`, `bim3d-edit-live-preview.ts` (section-clip, complementary) · +tests `placement-ghost-overlay.test.ts`, `bim3d-edit-live-preview.test.ts`.

**Verify:** 50 jest GREEN — `placement-ghost-overlay` (+2: orderIndependent depth-prime twins + depthFunc EQUAL, default blend/no-twins unchanged), `bim3d-edit-live-preview` (+4: reapplyClip σε ghost/resize/dependent-wire-pipe-fitting + no-callback safety), `create-placement-ghost` + `edit-original-ghost` regression. tsc SKIP (N.17). ⚠️ CHECK 6D → stage **ADR-550**. 🔴 PENDING: **browser-verify** (3D move σκάλας → **λείο** translucent ghost, ΟΧΙ λευκό blob ΟΥΤΕ κουκίδες· έλεγχος και υπό ενεργή τομή ότι το ghost κόβεται στην κοπή) + commit (Giorgio).

**Ιστορικό αστοχιών (ίδια συνεδρία, διαφάνεια):** (1η) υπόθεση «unclipped ghost υπό section» → section-clip fix· **λάθος στόχος** (το λευκό μένει και χωρίς τομή — Giorgio isolate). Ο section-clip κρατήθηκε ως έγκυρο latent fix. (2η) `alphaHash` για anti-accumulation → **κουκίδες** χωρίς TAA (Giorgio). (Τελικό) depth-prime → λείο. Μάθημα: το isolate test (§3 handoff) έπρεπε να προηγηθεί ΚΑΘΕ υπόθεσης.

### 2026-07-06 — follow-up: αφαίρεση orphaned `visual-regression.test.ts` (triage)
Το Φ2 (`f15395aa`) διέγραψε σκόπιμα τα `test/setupCanvas.ts` + `test/setupTests.ts` («legacy, broken, unused», @napi-rs/canvas override), αλλά το `src/subapps/dxf-viewer/__tests__/visual-regression.test.ts` έμεινε ορφανό με dangling import `../test/setupCanvas` → «Cannot find module» (η σουίτα δεν έτρεχε καν). Δεν είναι moved-file: ο πραγματικός pixel-diff μηχανισμός έχει φύγει και το jsdom δεν παράγει πραγματικά pixels. **Big-player πρακτική (Autodesk/Maxon/Figma/Chromium):** το πραγματικό visual-regression ζει σε **browser/Playwright screenshot-diff** (βλ. `e2e/bim-3d-visual-regression.spec.ts` + `visual-bim-3d` project παραπάνω), όχι σε jest+jsdom+napi· κανείς δεν κρατά zombie test με import διαγραμμένου module. **Απόφαση:** διαγραφή του orphaned suite (το jsdom sanity coverage καλύπτεται ήδη από το ζωντανό `visual-regression-basic.test.ts` — PASS). Boy-scout note: τα deps `@napi-rs/canvas`/`pixelmatch`/`pngjs` γίνονται πλέον removable (ξεχωριστό cleanup).

### 2026-07-05 — Φ-Preview2D hotfix: wrapped sub-entity SSoT (crash «Cannot read properties of undefined») (UNCOMMITTED)
**Πλαίσιο (Giorgio):** runtime crash κατά το **grip/Move ghost preview** πλάκας/ανοίγματος:
`TypeError: Cannot read properties of undefined (reading 'kind')` στο `buildEntityModelFromDxf`
(`dxf-renderer-entity-model.ts:105`, `const s = entity.slabEntity; … s.kind`) ← `drawRealEntityPreview` ← `drawMemberBodyGhostWithJoinMiter`. Επίσης δεύτερο, ανεξάρτητο crash στο ίδιο slab-drag: `Cannot read properties of undefined (reading 'polygon')` στο `getSlabCornerWorldPoints` (ambient alignment tracking).

**Ρίζα (crash #1 — wrapping mismatch, ΟΧΙ optional-chaining bug):** το preview pipeline (`useGripGhostPreview` + `useMovePreview`) τρέχει `applyEntityPreview` πάνω στο **flat** scene entity (διαβάζει `.params`/`.geometry` στο top level για slab/opening) και το επιστρέφει **flat**. Όμως **5 variants** (`slab`/`slab-opening`/`opening`/`stair`/`dimension`) κρατούν το payload σε **nested sub-entity field** (`slabEntity` κλπ), που το `buildEntityModelFromDxf` κάνει dereference **χωρίς guard**. Στο committed path το wrapping γίνεται από το `convertEntity` (`dxf-scene-entity-converter`)· το preview path το **παρέκαμπτε** → `undefined.kind`. (Το `stair` δεν έσκαγε γιατί το `applyEntityPreview` το ξανα-τυλίγει μόνο του — pre-existing ασυνέπεια.)

**Απόφαση/υλοποίηση — ΜΙΑ SSoT για το sub-entity wrapping (μηδέν διπλότυπο):**
- **NEW SSoT** `DXF_WRAPPED_SUBENTITY_FIELD` + `dxfSubEntityPayload()` στο `canvas-v2/dxf-canvas/dxf-types.ts` (δίπλα στα interface definitions που ορίζουν το σχήμα = η πηγή αλήθειας). ΕΝΑ σημείο ορίζει «ποιος wrapped τύπος τυλίγεται σε ποιο field».
- **Κεντρικοποίηση προϋπάρχοντος implicit διπλότυπου (εντολή Giorgio):** το `convertEntity` (5 wrapped cases) ξαναγράφτηκε να χρησιμοποιεί το `dxfSubEntityPayload()` (behavior-preserving· αφαιρέθηκαν 5 πλέον-αχρησιμοποίητα type imports).
- **Preview boundary:** το `drawRealEntityPreview` (κοινό chokepoint grip **+** Move) normalize-άρει το transformed entity μέσω `toWrappedPreviewEntity()` που διαβάζει την **ΙΔΙΑ** SSoT — no-op για direct entities (wall/beam/column/…) και για ήδη-wrapped (stair). Το `transformed` στα hooks μένει flat (οι υπόλοιποι consumers — clearance dims κλπ — δεν επηρεάζονται).

**Ρίζα (crash #2 — derived-cache χωρίς guard):** το `getSlabCornerWorldPoints` (SSoT slab corners, ADR-370 §5.3) διάβαζε `slab.geometry.polygon.vertices` **unguarded**, ενώ τα αδέλφια polygon members (slab-opening/roof/thermal) διαβάζουν `params.X?.vertices` **guarded**. Το `geometry` είναι **derived** και λείπει transiently (freshly-loaded slab πριν το `reconcileLoadedSceneBim`). **Fix:** geometry-preferred με fallback στο persisted `params.outline` (identical CCW ring — `SlabGeometry.polygon` = re-export του `outline`) + guard. Μηδέν νέα SSoT (source-over-derived pattern).

**Verify:** jest GREEN — `draw-real-entity-preview` (10, +slab/opening/dimension wrap + direct no-op + stair no-double-wrap), `slab-corner-anchors` (9, +geometry-absent fallback), `useDxfSceneConversion` (18, converter regression). tsc SKIP (N.17). ⚠️ CHECK 6D → stage **ADR-550**. 🔴 PENDING: browser-verify (σύρσιμο λαβής πλάκας/ανοίγματος → ghost χωρίς crash) + commit (Giorgio).
> Άσχετο pre-existing failing test (ΟΧΙ από αυτή τη δουλειά): `apply-entity-preview-text` (MTEXT move/resize) — δεν αγγίχτηκε.

### 2026-06-29 — Φ-Ghost3D (3D «original μένει φάντασμα») + Φ-Preview2D-B (Stretch/Scale/Rotate real renderer) (UNCOMMITTED)
**Πλαίσιο (Giorgio):** (Α) στην 3D προβολή, κατά το rigid move/rotate, το αντικείμενο **εξαφανιζόταν** από την αρχική θέση (έμεναν μόνο οι 2D λαβές) αντί να μένει **dimmed φάντασμα** όπως στον 2D καμβά — σε **οποιαδήποτε** όψη (top/perspective). (Β) τα ribbon εργαλεία Stretch/Scale/Rotate κρατούσαν δικό τους **simplified ghost** (το «Out of scope» της προηγούμενης εγγραφής).

**Ρίζα (Α):** στο `bim3d-edit-live-preview.ts` το rigid move μετακινεί τα **ΙΔΙΑ** τα meshes του entity (real, ghost≡commit) → τίποτα δεν μένει στην αρχή. (Όχι τα `o.visible=false`, που αφορούν resize/followers.)

**Απόφαση/υλοποίηση — ΜΙΑ πολιτική «original=φάντασμα, moving=real» 2D+3D (μηδέν νέο pipeline/διπλότυπο):**
- **Κοινή πολιτική alpha:** NEW `rendering/ghost/ghost-policy.ts` → `GHOST_ALPHA = 0.45` (ένωσε **2 σκόρπια `0.45`**: 2D `GHOST_DEFAULTS.alpha` + 3D `PlacementGhostOverlay` default). 2D Canvas + 3D WebGL = χωριστά backends, **ΜΙΑ** UX policy (Revit/C4D pattern).
- **Part A (3D):** NEW `bim-3d/animation/edit-original-ghost.ts` (`EditOriginalGhost`, pure THREE) — παγώνει **clone** των captured meshes στην αρχική pose ως translucent ghost ενώ τα πραγματικά ακολουθούν τον κέρσορα. **Reuse `PlacementGhostOverlay` (ADR-537)** για unlit material + post-FX overlay (AO-immune, anti-mustard) + non-pickable· πρόσθεσα option **`borrowedGeometry`** (+`hasObject` getter) ώστε το teardown να **μην** κάνει dispose την geometry που το clone **μοιράζεται** με το ζωντανό entity. Χρώμα ghost = το **πραγματικό χρώμα του mesh** (`material.color`, ακριβές on-screen· fallback cyan). Wire: `commit`/`reset`→clear, νέο `dispose()` (στο teardown του `use-bim3d-edit-interaction`). **ΟΛΑ τα μονοπάτια edit** αφήνουν ghost = πλήρες 2D parity: **`captureTransform`** (gizmo rigid move/rotate — το original δεν κρύβεται, μετακινείται real + frozen ghost clone) **ΚΑΙ** **`captureResize`** (grip reshape / center-move / endpoint / tilt, ADR-535 — το original κρύβεται από `applyResize`, ο frozen ghost clone μένει στη θέση, ο rebuilt real δείχνει τη νέα μορφή). Η **διόρθωση** προήλθε από repro Giorgio: η κίνηση με **λαβή** (grip) περνά από `captureResize`, οπότε το αρχικό «εξαφανιζόταν + έμεναν μόνο οι λαβές» — η αρχική απόφαση «μόνο move/rotate» ήταν λάθος. View-agnostic (material, όχι projection). *Followers (attached walls / wires / pipes / fittings) μένουν προς το παρόν hidden+rebuilt (flagged follow-up).*
- **Part B (2D Stretch/Scale/Rotate):** τα 3 hooks περνούν στο **ίδιο `drawRealEntityPreview`** (= move/grip). Transform **preview ≡ commit by construction**: Scale→`scaleEntity` (=`ScaleEntityCommand`), Rotate→`calculateBimRotatedGeometry ?? rotateEntity` (=`RotateEntityCommand.computeUpdates`), Stretch→`translateEntityByAnchor`/`applyVertexDisplacement` (commit SSoT). **Διαγράφηκαν 3 τοπικές `drawGhostEntity`** (silhouette διπλότυπα).
- **Original dimming (επέκταση `movePreviewActive`, ADR-049 — όχι νέος μηχανισμός):** Shell `CanvasLayerStack` OR-άρει το prop-driven Rotate (`awaiting-angle`)· leaf `canvas-layer-stack-leaves` self-subscribes τα store-driven Scale (`scale_input`)/Stretch (`displacement`) — CHECK 6C: **μηδέν** `useSyncExternalStore` σε Shell/orchestrator (μόνο στο leaf).
- **Κεντρικοποίηση διπλότυπου (Boy-Scout, εντολή Giorgio):** NEW SSoT `hooks/tools/useLevelLayersById.ts` — ένωσε **6** αντίγραφα του `layersById` getter (3 νέα + προϋπάρχοντα `useMovePreview`/`useGripGhostPreview`) σε ΜΙΑ πηγή (αδελφός του `useBimPreviewRenderer`).

**Verify:** 37 jest (placement-ghost-overlay +borrowedGeometry/hasObject, νέο edit-original-ghost, bim3d-edit-live-preview +ghost) GREEN· tsc SKIP (N.17). ⚠️ CHECK 6B/6C/6D → stage **ADR-040 + 537 + 550 + 049**. 🔴 PENDING: browser-verify (3D move **top + perspective** → original=ghost ορατό σε κάθε όψη· 2D Stretch/Scale/Rotate real + dimmed origin) + commit (Giorgio).

### 2026-06-29 — Φ-Preview2D: WYSIWYG moving-copy preview μέσω του ΕΝΟΣ renderer (UNCOMMITTED)
**Πλαίσιο (Giorgio):** κατά το grip-reshape/move ο χρήστης έβλεπε **απλοποιημένο περίγραμμα** (silhouette stroke) αντί της πραγματικής μορφής. Ρίζα: **δεύτερο, φτωχότερο 2D pipeline** (`rendering/ghost/draw-ghost-entity.ts`) παράλληλο με τον πραγματικό `EntityRendererComposite`.

**Απόφαση/υλοποίηση (το ίδιο contract, 2D preview facet):** το moving copy ζωγραφίζεται πλέον από τον **ΙΔΙΟ** πραγματικό renderer που ήδη χρησιμοποιούσαν τα **placement** previews (`BimPreviewRenderer` → composite), όχι από ξεχωριστό ghost path. Καθολικό για όλους τους τύπους (ο composite κάνει dispatch). Το πρωτότυπο στην αρχική θέση μένει dimmed ghost (inverted-ghost, ADR-049/040).

**SSoT (μηδέν νέο pipeline, μηδέν διπλότυπο):**
- NEW thin `rendering/ghost/draw-real-entity-preview.ts` → `drawRealEntityPreview(bimPreview, transformed, layersById, t, vp)` = κοινός glue για useGripGhostPreview + useMovePreview (ΕΝΑ render path, δεν αποκλίνουν).
- NEW `canvas-v2/dxf-canvas/dxf-renderer-style-resolve.ts` → **εξαγωγή** του πρώην **private** `DxfRenderer.resolveStyleForRender` (+`applyIsolateAlpha`) σε exported `resolveEntityRenderStyle(entity, layersById?)`. Τώρα committed-canvas **και** preview μοιράζονται ΕΝΑΝ resolver → ByLayer/ACI/TrueColor byte-identical. `DxfRenderer` = one-line delegate (call-sites αμετάβλητα).
- NEW `hooks/tools/useBimPreviewRenderer.ts` → κοινό lazy `BimPreviewRenderer`-per-ctx (ref-holder boilerplate ΜΙΑ φορά αντί copy-paste στα 2 hooks).
- Reuse: `buildEntityModelFromDxf` (committed path), `EntityRendererComposite`, `BimPreviewRenderer` (placement previews), `compute*Geometry`.
- `apply-entity-preview.ts`: recompute geometry για slab/slab-opening/roof/floor-finish (διάβαζαν μόνο `params` → ο real renderer διαβάζει `.geometry`). Reuse των υπαρχόντων `computeSlabGeometry/computeSlabOpeningGeometry/computeRoofGeometry/computeFloorFinishGeometry`.
- **Cleanup:** διαγραφή του dead `rendering/ghost/ghost-solid-color.ts` (+test) — το `resolveGhostSolidColor` (inverted-ghost interim) superseded από τον real renderer.
- `draw-real-entity-preview` deep-imported (όχι από το ghost barrel) ώστε ο barrel να μη σέρνει τον βαρύ composite.

**Out of scope (Φ2 follow-up, flagged):** τα ribbon Stretch/Scale/Rotate hooks (`useStretchPreview`/`useScalePreview`/`useRotationPreview`) διατηρούν δικό τους simplified ghost — pre-existing, να περάσουν από το ίδιο `drawRealEntityPreview` σε επόμενο pass.

**Verify:** 60 jest (νέο `draw-real-entity-preview.test.ts` + 59 ghost/preview/dxf-canvas regression) GREEN· tsc καθαρό στα touched αρχεία (project OOM στα 8GB λόγω άλλων uncommitted agent errors — όχι δικά μου). ⚠️ CHECK 6B/6D → stage ADR-040+049+550. 🔴 PENDING: browser-verify (wall reshape → πλήρες πάχος+γέμισμα+hatch ακολουθεί κέρσορα· roof perf· raw DXF ByLayer χρώμα· MOVE multi-select) + commit.

### 2026-06-29 — Αρχικό roadmap (DRAFT/PROPOSED)
**Πλαίσιο:** Μετά το census (ADR-549), ερώτηση Giorgio «μπορούμε να ενοποιήσουμε όλους τους μηχανισμούς σε έναν;». Απάντηση: όχι ένας μηχανισμός (κανείς μεγάλος δεν το κάνει), αλλά ΕΝΑ entity contract + κοινό geometry SSoT (AutoCAD/Revit pattern).

**Απόφαση:** Unified Entity Render Contract σε 5 φάσεις (Φ0 foundation → Φ1 geometry SSoT → Φ2 contract/adapter → Φ3 coverage ratchet → Φ4 cleanup), strangler-fig/adapter, μηδέν backend merge, μηδέν big-bang.

**Status:** PROPOSED — αναμονή έγκρισης Giorgio για εκκίνηση Φ0+Φ1-pilot. Καμία γραμμή κώδικα μέχρι τότε.

### 2026-06-29 — Pivot + Φ0/Φ3 IMPLEMENTED (UNCOMMITTED)
**Εύρημα (2 ανεξάρτητοι agents + ανάγνωση dispatch):** η υπόθεση «διπλό geometry» **διαψεύστηκε**. Το geometry είναι ήδη SSoT ανά οντότητα (`compute*Geometry`, cached, κοινό 2D/3D). Άρα **Φ1 = άνευ αντικειμένου**.

**Pivot (έγκριση Giorgio):** εκκίνηση από το πραγματικό κενό → **Φ0** (canonical type) + **Φ3** (coverage test), μηδέν ρίσκο.

**Files (NEW):**
- `rendering/contract/renderable-entity-type.ts` — `RENDERABLE_ENTITY_TYPES` (17 DXF + 24 BIM) + compile-time bridge προς `EntityType`.
- `rendering/contract/entity-render-surfaces.ts` — δηλωτικό μητρώο `d2`/`d3` ανά type + `BIM_2D_ONLY_TYPES` (wall-covering / thermal-space / space-separator).
- `bim-3d/scene/bim-3d-renderable-types.ts` — `BIM_3D_CONVERTER_TYPES` (21 types, SSoT των `BimSceneLayer.sync*()`).
- `rendering/contract/__tests__/entity-render-coverage.test.ts` — 7 tests GREEN.

**Verify:** jest 7/7 GREEN· tsc καθαρό (compile-time bridge + Record completeness). Καμία αλλαγή render συμπεριφοράς → χωρίς browser-verify. Commit → εντολή Giorgio.

### 2026-06-29 — Φ4 Cleanup IMPLEMENTED (UNCOMMITTED)
**Διαγραφή:** `rendering/entities/StairRenderer.ts` (orphan re-export shim, ADR-363 Φ0.5· grep επιβεβαίωσε μηδέν call-site· canonical = `bim/renderers/StairRenderer.ts`). Μειώνει dead-code (CHECK 3.22).

**Τεκμηρίωση (ADR-549 §4.2):** οι 4 off-composite renderers δεν είναι «λείπει renderer» — είναι σκόπιμα διαφορετικοί μηχανισμοί: `OpeningTagRenderer` (sub-renderer στο `OpeningRenderer`), `EnvelopeRenderer` (`EnvelopeOverlay.tsx`), `MepWireRenderer` (`drawCircuitWires` → `HomeRunWiresOverlay.tsx`), `FloorplanSymbolRenderer` (πιθανό dormant ADR-415 Φ1).

**Εκκρεμές:** επιβεβαίωση αν το `FloorplanSymbolRenderer` έχει ενεργό call-site (αλλιώς dead-code υποψήφιο).

### 2026-06-29 — Φ2 Contract Registry + Point Auto-wiring IMPLEMENTED (UNCOMMITTED)
**SSoT audit (grep):** κανένας υπάρχων contract/registry/`worldDraw` μηχανισμός πέρα από τα Φ0/Φ3 δηλωτικά. 2D = ήδη ομοιόμορφο `EntityRendererComposite` map. 3D = ετερογενές imperative `syncFloorEntities` (11 ομοιόμορφες point families μέσω `syncPointEntities` + 10 bespoke host-context syncs).

**Απόφαση (Giorgio, Option B):** το «παχύ» `build3D(entity)` απορρίφθηκε (rewrite). Realized: δηλωτικό `EntityRenderContract` registry + auto-wiring **μόνο** του ομοιόμορφου point υποσυνόλου.

**Files (NEW):**
- `rendering/contract/entity-render-contract.ts` — `ENTITY_RENDER_CONTRACTS` (`{d2,d3,d3Builder}`), `POINT_BUILT_TYPES`, `BESPOKE_BUILT_TYPES`, `surfacesOf()`. Invariant `d3Builder!=='none' ⟺ d3`.
- `bim-3d/scene/bim-scene-point-contracts.ts` — `POINT_ENTITY_CONTRACTS` (11 entries, typed `pointContract` registrar, closure-erased `run`), `POINT_CONTRACT_TYPES`.

**Files (MOD):**
- `rendering/contract/entity-render-surfaces.ts` → `ENTITY_RENDER_SURFACES` derived από το contract (ΕΝΑ source).
- `bim-3d/scene/BimSceneLayer.ts` → ΕΝΑ loop `for (const c of POINT_ENTITY_CONTRACTS) c.run(...)`· **−11** thin private μέθοδοι + τα 11 αχρησιμοποίητα factory imports. Bespoke calls αμετάβλητα.
- `bim-3d/scene/bim-scene-point-syncs.ts` → export `ResolveEntity`/`PointMeshFactory` types για reuse.
- `__tests__/entity-render-coverage.test.ts` → +5 asserts (invariant, derived parity, point declaration↔execution binding, point∪bespoke===live 3D, ξένα σύνολα).

**Verify:** jest 12/12 contract (7 Φ3 + 5 Φ2) GREEN· 108/108 scene GREEN· single tsc (N.17). Commit → εντολή Giorgio (stage ADR-366 + ADR-550 για CHECK 6B/6D). **COMMITTED** `f15395aa`.

### 2026-06-29 — Φ2 Browser-verify DONE (golden-image 3D harness, big-player practice)
**Πρακτική μεγάλων παικτών (Autodesk/Maxon):** επαλήθευση 3D rendering = **golden-image regression** σε headless render harness (offscreen render deterministic σκηνής, pixel-diff vs baseline). Επεκτάθηκε **το ίδιο pattern** με το υπάρχον 2D `dxf-canvas` harness (full SSoT, όχι νέος μηχανισμός).

**Files (NEW, reusable infra, UNCOMMITTED):**
- `src/app/test-harness/bim-3d/page.tsx` + `Bim3DHarness.tsx` — mount του ΠΡΑΓΜΑΤΙΚΟΥ `BimViewport3D` με `bimEntities` prop (externalEntitiesMode, ADR-371) μέσα σε `AuthProvider`+`UnifiedProviders` (Grip/Snap/ProjectHierarchy)· χωρίς Firebase/auth/Firestore. Dev-only (404 σε prod). Imperative handle `window.__bim3dTest` (isReady/frame/capture) μέσω `getActiveSceneManager()`.
- `bim-3d/__fixtures__/point-entities-scene-fixture.ts` — 11 point-entity families με έγκυρη `compute*Geometry`.
- `e2e/bim-3d-visual-regression.spec.ts` + `visual-bim-3d` Playwright project (WebGL/swiftshader headless). Συγκρίνει το **GL framebuffer capture** (`captureFrameDataURL` = forced render + readPixels) — ντετερμινιστικό υπό swiftshader, παρακάμπτει το `preserveDrawingBuffer:false` DOM-screenshot πρόβλημα.

**Αποτέλεσμα:** golden δείχνει **και τις 11 οικογένειες ως 3D solids** (στέγη/δάπεδο/ενδοδαπέδιο/πίνακας/πέδιλο/καλοριφέρ/λέβητα/θερμοσίφωνα/κιγκλίδωμα/συλλέκτη/έπιπλο). Επιβεβαιώθηκε `groupChildren:11, meshes:43` (registry loop = ίδιο dispatch με τις 11 διαγραμμένες μεθόδους → μηδέν regression). Test PASS deterministic (χωρίς --update-snapshots).

**Bug fix στο fixture (όχι production):** ο `floorFinishToMesh` κάνει default `sceneUnits ?? 'm'` (μοναδικός· οι άλλοι default `'mm'`)· το mm footprint ερμηνευόταν ως meters → 3 km plate που εκτόξευε το scene bbox → κάμερα 13 km μακριά → όλα μικροσκοπικά. Pin `sceneUnits:'mm'` στο floor-finish fixture entity.

### 2026-06-29 — Φ-Ghost: Ghost capability (3D placement ghost) IMPLEMENTED (UNCOMMITTED)
**SSoT audit (2 Explore agents, grep):** το ghost dispatch δεν είχε introspectable seam. **3D** = 11 per-family `*PlacementGhost` κλάσεις (column/wall/beam/furniture/electrical-panel/mep-fixture/mep-segment/mep-manifold/mep-radiator/mep-boiler/mep-water-heater), single switchboard `use-bim3d-placement-and-pick-hooks.ts`, κανένα type-keyed registry. **2D** = triply-scattered (generator if-chain + wysiwyg-BIM + 9 bespoke Canvas2D renderers), όχι introspectable. Επιβεβαίωσε το σχόλιο του Φ2 («ghost θα σάπιζε χωρίς bindable seam»).

**Απόφαση (Giorgio «κεντρικοποίηση τώρα»):** φτιάχνεται ο seam → contract binding. Εύρος = **3D placement ghost only**· το 2D μένει εκτός (κανένα introspectable 2D seam — προσθήκη θα ήταν το «πεδίο που σαπίζει»).

**Files (NEW):**
- `bim-3d/placement/placement-ghost-3d-contracts.ts` — `PLACEMENT_GHOST_3D_FACTORIES` (factory-per-key, `satisfies Record<GhostBimType, (scene)=>PlacementGhost3D>` → completeness + concrete return type ανά key), `PLACEMENT_GHOST_3D_TYPES`, `PlacementGhost3D` interface (μόνο `dispose` — ο beam δεν έχει `setVisible`).

**Files (MOD):**
- `rendering/contract/entity-render-contract.ts` — `+readonly placementGhost3D: boolean` (invariant ghost ⟹ d3)· `point()`/`bespoke()` 2ο optional param `ghost3D`· 11 types `true`· `+GHOST_BUILT_TYPES`· ενημ. doc comment (ghost τώρα modeled, 2D εκτός με λόγο).
- 10× `bim-3d/placement/use-bim3d-*-placement.ts` + `bim-3d/viewport/use-bim3d-beam-from-wall-pick.ts` — one-line swap `new XxxPlacementGhost(scene)` → `PLACEMENT_GHOST_3D_FACTORIES.<type>(scene)` (adapter· concrete type διατηρείται· hook tests αμετάβλητα — Jest absolute-path mock propagation).
- `rendering/contract/__tests__/entity-render-coverage.test.ts` — +1 describe / 3 asserts (invariant, no-drift, liveness instanceof+dispose).

**Verify:** jest 15/15 contract (+3 Φ-Ghost) GREEN· 127/127 placement+beam GREEN (μηδέν αλλαγή test)· single tsc (N.17) καθαρό στα Φ-Ghost αρχεία. Regression-safe (μόνο instantiation seam). Commit → εντολή Giorgio (stage ADR-040 + ADR-366 + ADR-550 + ADR-537 για CHECK 6B/6D).
