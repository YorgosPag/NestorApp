# ADR-550: Unified Entity Render Contract — ΕΝΑ συμβόλαιο οντότητας, N backends (2D/3D)

| Πεδίο | Τιμή |
|---|---|
| **Status** | ✏️ DRAFT / PROPOSED — roadmap, καμία γραμμή κώδικα χωρίς έγκριση φάσης |
| **Date** | 2026-06-29 |
| **Last Updated** | 2026-06-29 |
| **Category** | Canvas & Rendering |
| **Location** | `src/subapps/dxf-viewer/` (`rendering/`, `bim/renderers/`, `bim-3d/converters/`, `bim/geometry/shared/`) |
| **Author** | Claude (σχεδιασμός κατόπιν εντολής Giorgio) |
| **Related ADRs** | **ADR-549** (census — το «before»), ADR-040 (2D perf), ADR-366 (3D viewer), ADR-527 (SceneManager SSoT δεδομένων), ADR-535/542/545 (ήδη-ενοποιημένα overlays = proof-of-pattern), ADR-539 (faced-prism geometry) |

---

## Summary

Το ADR-549 κατέγραψε **2 pipelines** και **~57 entity-level μηχανισμούς** rendering. Το κύριο εύρημα: η εφαρμογή έχει ήδη **ΕΝΑ data model SSoT** (ADR-527) και **ΕΝΑ 2D dispatch** (`EntityRendererComposite`), αλλά **διπλό geometry** (το 2D και το 3D υπολογίζουν γεωμετρία ανεξάρτητα) και **κανένα ενιαίο entity contract** που να εγγυάται ότι κάθε οντότητα ξέρει να εμφανίζεται 2D + 3D + ghost + grips.

Αυτό το ADR σχεδιάζει το **Unified Entity Render Contract**: ΕΝΑ συμβόλαιο ανά οντότητα (`draw2D` / `build3D` / `getGrips` / `ghost` / `geometry`), με **κοινό geometry SSoT** που τρώνε και τα δύο backends. **Δεν** ενοποιεί τα backends — Canvas2D και Three παραμένουν δύο (όπως σε κάθε σοβαρό CAD).

**Πρότυπο:** AutoCAD `worldDraw()/viewportDraw()` (ένα entity, N contexts) + Revit «element → geometry → N view representations». Στρατηγική: **strangler-fig / adapter** — τυλίγουμε τους υπάρχοντες ~57 renderers σε ΕΝΑ contract, **δεν** τους ξαναγράφουμε.

---

## Context — γιατί όχι «ένας μηχανισμός για όλα»

Η αρχική σκέψη («ενοποίηση όλων σε έναν μοναδικό») είναι **σωστή στην πρόθεση** (SSoT, λιγότερος διπλασιασμός) αλλά **λάθος στο γράμμα**:

- Ο 2D καμβάς είναι **raster CPU API** (`CanvasRenderingContext2D`)· ο 3D είναι **GPU mesh API** (WebGL/Three). Θεμελιωδώς διαφορετικά — δεν υπάρχει ένα `draw()` και για τα δύο.
- **Κανένας μεγάλος δεν τα ενοποιεί:** AutoCAD = 2D wireframe vs 3D regen· Revit = plan/3D/section views· Cinema 4D = viewport OpenGL vs Redshift production. Όλοι κρατούν **N render backends**.

Το σωστό μοτίβο (και των τριών):
```
ΕΝΑ data model (SSoT)  →  ΕΝΑ geometry layer  →  N render backends
        ✅ ADR-527             ⚠️ ΛΕΙΠΕΙ              ✅ 2 (μένουν 2)
```
Η εφαρμογή έχει το πρώτο, της λείπει το δεύτερο. **Αυτό** είναι το πραγματικό κέρδος — όχι η συγχώνευση backends.

### Σημερινός πόνος (από ADR-549 §4)
1. Διπλό geometry: π.χ. το footprint κολόνας υπολογίζεται στον `ColumnRenderer` (2D) **και** στο `bim-three-structural-converters` (3D) — δύο πηγές, κίνδυνος drift.
2. Διάσπαρτα entity-type unions (`bim-to-atoe-mapping.ts`, `types/base-entity.ts`) — κανένα canonical «renderable entity registry».
3. Νέα οντότητα = εγγραφή σε **2-3 ξεχωριστά σημεία** (2D composite + 3D actions + ghost). Εύκολο να ξεχαστεί το ένα → οντότητα που φαίνεται 2D αλλά όχι 3D.
4. Orphan/off-dispatch: διπλό `StairRenderer`, 4 BIM renderers εκτός composite.

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

### Φ0 — Canonical `RenderableEntityType` registry (foundation)
- ΕΝΑ union SSoT των renderable types (ένωση DXF + BIM), αντικαθιστά τα διάσπαρτα unions.
- **Καμία αλλαγή συμπεριφοράς** — μόνο type consolidation + re-export από τα παλιά σημεία.
- Παραδοτέο: `rendering/contract/renderable-entity-type.ts` + type test.

### Φ1 — Geometry SSoT (το πραγματικό κέρδος) 🎯
- Εξαγωγή του geometry-compute ανά οικογένεια σε `bim/geometry/shared/` (υπάρχει ήδη ο φάκελος: `polygon-utils`, `footprint-face-frame`, `building-footprint`).
- 2D renderer **και** 3D converter καλούν την ΙΔΙΑ `geometry()` — ξεκινώντας από 1 οικογένεια pilot (προτείνω **κολόνα**: έχει ήδη grip-parity SSoT, χαμηλό ρίσκο).
- Boy-Scout: όπου βρεθεί διπλό footprint/solid → centralize.
- Παραδοτέο ανά οικογένεια· browser-verify (2D κάτοψη ≡ 3D mesh footprint) πριν την επόμενη.

### Φ2 — Entity contract + adapter registry
- ΕΝΑ `EntityContractRegistry` που κρατά `EntityRenderContract` ανά type.
- Οι υπάρχοντες renderers γίνονται adapters (wrap, όχι rewrite): `EntityRendererComposite` και `scene-manager-actions` **διαβάζουν** από το registry.
- Νέα οντότητα = **ένα** registration object → αυτόματα 2D + 3D + ghost + grips.

### Φ3 — Coverage guarantee (ratchet)
- Type-level + jest: κάθε `RenderableEntityType` **πρέπει** να έχει `draw2D` + `build3D` + `ghost` + `getGrips`. Build σπάει αν λείπει.
- Λύνει το finding #3 του ADR-549 (οντότητα που φαίνεται 2D αλλά όχι 3D).
- Πιθανό SSoT registry module στο `.ssot-registry.json`.

### Φ4 — Cleanup
- Dead-code έλεγχος & διαγραφή orphan `rendering/entities/StairRenderer.ts`.
- Τεκμηρίωση/ένταξη των 4 off-composite renderers (`OpeningTag`, `FloorplanSymbol`, `MepWire`, `Envelope`) ως ρητά scene-level passes.

---

## Non-goals (τι ΔΕΝ κάνουμε)
- ❌ **Δεν** ενοποιούμε Canvas2D + Three σε ένα backend.
- ❌ **Δεν** ξαναγράφουμε τους 57 renderers (adapter pattern).
- ❌ **Δεν** κάνουμε big-bang — κάθε φάση/οικογένεια ανεξάρτητα.
- ❌ **Δεν** πειράζουμε τα ήδη-ενιαία overlays (grips/crosshair/snap/HUD — ADR-535/542/545)· είναι το **proof** ότι το pattern δουλεύει, τα αφήνουμε.

## Risks
- **Geometry parity drift** κατά τη Φ1 (το 2D footprint μπορεί να διαφέρει οριακά από το 3D solid base). Μετριασμός: pilot σε 1 οικογένεια + browser-verify + golden test.
- **Performance:** το `geometry()` δεν πρέπει να καλείται 60fps στο hot path — caching όπως το `dxf-bitmap-cache` (ADR-040). Να μετρηθεί στη Φ1.

---

## Σύσταση εκκίνησης
Ξεκινάμε από **Φ0 + Φ1-pilot (κολόνα)** — μικρό, μετρήσιμο, αποδεικνύει το geometry SSoT χωρίς ρίσκο. Αν το όφελος επιβεβαιωθεί στον browser, προχωράμε φάση-φάση.

---

## Changelog

### 2026-06-29 — Αρχικό roadmap (DRAFT/PROPOSED)
**Πλαίσιο:** Μετά το census (ADR-549), ερώτηση Giorgio «μπορούμε να ενοποιήσουμε όλους τους μηχανισμούς σε έναν;». Απάντηση: όχι ένας μηχανισμός (κανείς μεγάλος δεν το κάνει), αλλά ΕΝΑ entity contract + κοινό geometry SSoT (AutoCAD/Revit pattern).

**Απόφαση:** Unified Entity Render Contract σε 5 φάσεις (Φ0 foundation → Φ1 geometry SSoT → Φ2 contract/adapter → Φ3 coverage ratchet → Φ4 cleanup), strangler-fig/adapter, μηδέν backend merge, μηδέν big-bang.

**Status:** PROPOSED — αναμονή έγκρισης Giorgio για εκκίνηση Φ0+Φ1-pilot. Καμία γραμμή κώδικα μέχρι τότε.
