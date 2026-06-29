# ADR-550: Unified Entity Render Contract — ΕΝΑ συμβόλαιο οντότητας, N backends (2D/3D)

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟢 Φ0+Φ2+Φ3+Φ4 IMPLEMENTED (UNCOMMITTED) — Φ1 άνευ αντικειμένου |
| **Date** | 2026-06-29 |
| **Last Updated** | 2026-06-29 |
| **Category** | Canvas & Rendering |
| **Location** | `src/subapps/dxf-viewer/` (`rendering/`, `bim/renderers/`, `bim-3d/converters/`, `bim/geometry/shared/`) |
| **Author** | Claude (σχεδιασμός κατόπιν εντολής Giorgio) |
| **Related ADRs** | **ADR-549** (census — το «before»), ADR-040 (2D perf), ADR-366 (3D viewer), ADR-527 (SceneManager SSoT δεδομένων), ADR-535/542/545 (ήδη-ενοποιημένα overlays = proof-of-pattern), ADR-539 (faced-prism geometry) |

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
- **Ghost:** ΔΕΝ μπήκε στο contract — κανένα introspectable live dispatcher (2D per-family, 3D ενιαίο overlay)· μη-ελεγχόμενο πεδίο θα σάπιζε. Μελλοντικό Φ.
- Παραδοτέα (NEW): `rendering/contract/entity-render-contract.ts`, `bim-3d/scene/bim-scene-point-contracts.ts`. (MOD): `entity-render-surfaces.ts` (derived), `BimSceneLayer.ts` (loop, −11 μέθοδοι), `bim-scene-point-syncs.ts` (export types), coverage test (+5 asserts).

### Φ3 — Coverage guarantee ✅ IMPLEMENTED (2026-06-29)
- Jest: το δηλωτικό μητρώο δένεται με τα ζωντανά dispatchers — 2D `EntityRendererComposite.getSupportedEntityTypes()`, 3D `BIM_3D_CONVERTER_TYPES`. Symmetry: κάθε BIM type (εκτός ρητών 2D-only) έχει ΚΑΙ 2D ΚΑΙ 3D.
- Λύνει το finding #3 του ADR-549 (οντότητα που φαίνεται 2D αλλά όχι 3D).
- Παραδοτέο: `rendering/contract/__tests__/entity-render-coverage.test.ts` (7 tests GREEN).

### Φ4 — Cleanup ✅ IMPLEMENTED (2026-06-29)
- **Διαγράφηκε** το orphan `rendering/entities/StairRenderer.ts` (re-export shim, κανένα call-site· canonical = `bim/renderers/StairRenderer.ts`).
- **Τεκμηριώθηκαν** οι 4 off-composite renderers (βλ. ADR-549 §4.2): `OpeningTag` = sub-renderer μέσα στο `OpeningRenderer`· `Envelope` = overlay `EnvelopeOverlay.tsx`· `MepWire` = function `drawCircuitWires` στο `HomeRunWiresOverlay.tsx`· `FloorplanSymbol` = πιθανό dormant Φ1 (εκκρεμεί επιβεβαίωση).

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
**Φ0+Φ2+Φ3+Φ4 υλοποιήθηκαν (2026-06-29).** Φ0/Φ3/Φ4 μηδέν ρίσκο. Φ2 αγγίζει `BimSceneLayer` (render-critical, ADR-366) → **απαιτείται browser-verify** των 11 point-entity οικογενειών πριν θεωρηθεί κλειστό. Επόμενο προαιρετικό: ghost capability στο contract όταν προκύψει bindable seam.

---

## Changelog

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

**Verify:** jest 12/12 contract (7 Φ3 + 5 Φ2) GREEN· 108/108 scene GREEN· single tsc (N.17). **Browser-verify εκκρεμεί** (Option B αγγίζει render path· opaque depth-sort → insertion order αδιάφορο, αλλά οπτική επιβεβαίωση των 11 families απαιτείται). Commit → εντολή Giorgio (stage ADR-366 + ADR-550 για CHECK 6B/6D).
