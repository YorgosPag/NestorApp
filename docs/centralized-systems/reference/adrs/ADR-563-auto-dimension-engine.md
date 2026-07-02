# ADR-563 — Auto-Dimension Engine (αυτόματη περιμετρική διαστασιολόγηση κάτοψης)

- **Status:** 🟢 Φ1 (perimeter) + Φ2 (BIM associativity) IMPLEMENTED — UNCOMMITTED
- **Date:** 2026-07-02
- **Domain:** DXF Viewer → Dimensions
- **Σχετικά:** ADR-362 (Enterprise Dimension System — core), ADR-397 / ADR-511
  (batch entity commit / CompoundCommand undo), ADR-049 (grid-snap SSoT),
  ADR-436 / ADR-363 (BIM 2D bounds SSoT), ADR-010 (bounds union SSoT)

---

## Context

Το DXF Viewer είχε πλήρες **χειροκίνητο** dimension system (ADR-362: 14 τύποι,
styles, associativity, DXF export) αλλά **καμία αυτόματη διαστασιολόγηση** — ο
χρήστης έπρεπε να διαστασιολογήσει κάθε τοίχο/κολόνα/πέδιλο ένα-ένα με κλικ.

Ζητούμενο (Giorgio): με **μία ενέργεια**, αυτόματη τοποθέτηση διαστάσεων
περιμετρικά μιας ολοκληρωμένης κάτοψης — «όπως οι μεγάλοι».

**Έρευνα των μεγάλων (συγκλίνον μοτίβο):**
- **ArchiCAD** *Automatic Exterior Dimensioning*: επιλογή τοίχων → dialog (overall /
  structures / openings / composite reference outer-vs-core faces / «place on 4
  sides of bounding box» / distance between lines) → τοποθέτηση.
- **Revit** aligned auto-dim: options bar *Wall faces / Wall centerlines / Center of
  core*, *Entire Wall*, Options → *Openings (centers/widths) / Intersecting Walls /
  Intersecting Grids*.
- **AutoCAD** *QDIM*: επιλογή αντικειμένων → arrangement mode *Continuous / Baseline /
  Staggered / Ordinate*.

Κοινός πυρήνας: **selection-driven → reference basis → πολλαπλές παράλληλες
αλυσίδες ανά πλευρά → associative έξοδος**. Οι αρχιτεκτονικές κατόψεις χρησιμοποιούν
**3 σειρές ανά πλευρά**: (1) ανοίγματα/επιμέρους, (2) άξονες/τοίχος↔τοίχος, (3) ολική.

**Αποφάσεις:** 3 σειρές · **περιμετρικό πρώτα** (εσωτερικό = Φ2) · **έξυπνη βάση
αναφοράς** (δομικά→άξονες/κέντρα, τοίχοι→όψεις, ανοίγματα→κέντρα) · **ArchiCAD-style
dialog** με options πριν την τοποθέτηση.

---

## Decision

Νέο **orchestration layer** πάνω στο υπάρχον dimension SSoT — καμία επανεγγραφή του
πυρήνα παραγωγής/render/export διαστάσεων. Παράγει **αληθινά `LinearDimensionEntity`**
που περνούν από ΟΛΟ το υπάρχον pipeline (render, grips, edit, DXF export).

### Αρχιτεκτονική — pure engine (systems/dimensions/auto/)

Pipeline 3 σταδίων, καθένα pure (no React/store/Firestore), SRP ≤500 LOC:

1. **`auto-dimension-reference-extraction.ts`** — `extractReferencePoints(elements, options, overall)`
   → `ReferencePoint[]` (scalar coords ανά μετρούμενο άξονα, ανά side/tier).
   - **Έξυπνη βάση:** detail tier → όψεις/άκρα (walls→faces, structural→element extent),
     openings→κέντρο· axes tier → κέντρα (structural grid). `referenceBasis: 'axes'`
     συμπτύσσει το detail σε κέντρα· `'faces'` σε άκρα.
   - Reuse `calculateBimEntity2DBounds` (bim/utils — bbox→2D SSoT) + type guards
     (`isWallEntity`/`isColumnEntity`/`isFoundationEntity`/`isBeamEntity`/`isOpeningEntity`).
2. **`auto-dimension-chain-planner.ts`** — `planChains(refPoints, overall, options)` →
   `PlannedSegment[]`. Ομαδοποίηση ανά (side, tier), dedup near-coincident coords
   (**reuse `snapToGrid` ADR-049**, 1mm), ταξινόμηση, ένα segment ανά διαδοχικό ζεύγος,
   fixed outward offset ανά tier (detail 0· axes +DIMDLI· overall +2·DIMDLI).
3. **`auto-dimension-entity-factory.ts`** — `buildAutoDimensionEntities(segments, ctx)` →
   `LinearDimensionEntity[]`. `id` από **`generateDimensionId()` (N.6)**, `styleId` από
   active style, `associations` ανά anchored defPoint, optional sanity via
   `buildDimensionGeometry` (drop degenerate).
4. **`auto-dimension-engine.ts`** — `runAutoDimension(elements, options, ctx)` = extract →
   plan → factory· `computeOverallBounds` reuse **`unionBounds` (ADR-010)**.
5. **`auto-dimension-types.ts`** — `AutoDimensionOptions`, `AUTO_DIMENSION_DEFAULTS`,
   `ReferencePoint`, `PlannedSegment`, side/tier helpers.

### Commit (undoable batch)

- **`bim/scene/add-dimensions-to-scene.ts`** (mirror `add-column-to-scene.ts`) →
  `appendEntitiesToScene(accessor, dims, 'dim-auto', 'Αυτόματη διαστασιολόγηση')`.
  Reuse ADR-397/511: **1 Ctrl+Z** αναιρεί όλο το batch, κάθε dim εκπέμπει
  `drawing:entity-created` (persistence), και το ήδη-mounted `useDimAssociationObserver`
  πιάνει το batch για host→dim tracking.

### UI (ArchiCAD-style)

- **`ui/dimensions/AutoDimensionDialogStore.ts`** + **`AutoDimensionDialog.tsx`** — options
  panel (3 tiers, reference basis, openings, 4 sides, distance) → confirm.
- **`ui/ribbon/hooks/bridge/auto-dim-command-keys.ts`** (mirror `wall-command-keys.ts`) —
  `isAutoDimActionKey('auto-dimension')` → ανοίγει το dialog store· wired στο
  `routeRibbonAction` ΠΡΙΝ το generic `wrappedHandleAction`.
- Ribbon button «Αυτόματη Διαστασιολόγηση» στα dimension panels (home + contextual).
- Confirm: source = `SelectedEntitiesStore.count()>0 ? επιλεγμένα : όλη η κάτοψη`.

---

## Associativity — Φ2 (BIM-aware, ΥΛΟΠΟΙΗΘΗΚΕ)

Το `recomputeAssociatedDefPoint` (ADR-362 J3) καταλάβαινε **μόνο** line/polyline/
circle/arc. Η Φ2 πρόσθεσε **νέο associationType `'bimExtent'`** (+ `bimAnchor: { axis,
edge }` στο `DimensionAssociation`) και ένα **axis-aware branch** στον resolver:

- Κάθε anchored defPoint (extOrigin) των auto-dims αποθηκεύεται ως `bimExtent` με
  `axis` (X για N/S, Y για E/W) + `edge` (`min`/`max`/`center` του host bbox).
- Στο host geometry change ο resolver διαβάζει το **τρέχον** `calculateBimEntity2DBounds`
  (ίδιο SSoT με την extraction → preview≡commit≡recompute), παίρνει `edge` στον `axis`,
  και **διατηρεί την κάθετη συνιστώσα** (η baseline της προέκτασης μένει, το μετρούμενο
  coordinate ακολουθεί). Άρα: μετακίνηση τοίχου/κολόνας/πεδίλου → οι διαστάσεις **ακολουθούν**.
- Το point-based contract του service για primitives (line/circle/arc) **δεν αλλάζει** —
  το `bimExtent` είναι ξεχωριστό case· 54/54 dim-association tests πράσινα (μηδέν regression).
- **Delete** host → orphan (defPoint preserved, `orphanCount++`) όπως πριν.

**Περιορισμός:** το bbox είναι axis-aligned· σε **περιστροφή** host η προσκόλληση ακολουθεί
το bbox extent (όχι την πραγματική λοξή παρειά) — αποδεκτό για translation (η κύρια χρήση).

## Εσωτερική διαστασιολόγηση — Φ2

Το Φ1 καλύπτει **περιμετρική** (bounding-box, 4 πλευρές). Οι εσωτερικές αλυσίδες
αξόνων (grid lines μεταξύ εσωτερικών κολόνων/τοίχων) μπαίνουν ως Φ2 στο **ίδιο engine**
(νέο side-independent «interior axis» stage), χωρίς αλλαγή του factory/commit.

---

## Consequences

- ✅ Μηδέν διπλότυπο: reuse dimension entity/style/geometry/commit/id SSoT.
- ✅ Google-level undo (batch = 1 step), persistence, edit/grips/DXF export δωρεάν.
- ✅ Pure engine → πλήρως unit-tested (30 jest: extraction/planner/factory/engine + bimExtent recompute).
- ✅ Associativity-follow στο move (Φ2, `bimExtent`).
- ⚠️ Εσωτερική διαστασιολόγηση = Φ3.

## Verification

- **Jest:** `npx jest src/subapps/dxf-viewer/systems/dimensions/auto` → 23/23 GREEN.
- **Browser:** κάτοψη με τοίχους+κολόνες+πέδιλα → κουμπί → dialog → confirm → 3 σειρές
  και στις 4 πλευρές· 1 Ctrl+Z αναιρεί όλες· επιλογή υποσυνόλου → μόνο αυτό.

## Changelog

- **2026-07-02** — Φ1 (perimeter) implemented: pure engine (5 αρχεία) + batch commit
  wrapper + dialog + ribbon/command wiring + 23 jest.
- **2026-07-02** — Φ2 (BIM associativity) implemented: νέο `bimExtent` associationType
  (+`bimAnchor`) στο `types/dimension.ts` + axis-aware branch στο `dim-association-service.ts`
  (reuse `calculateBimEntity2DBounds`)· engine emits `edge`/`axis`. Auto-dims ακολουθούν
  τον host στο move. 30 auto jest + 54 dim-association jest (μηδέν regression). Εσωτερική
  διαστασιολόγηση = Φ3 (PROPOSED).
