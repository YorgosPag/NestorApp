# HANDOFF — Auto-Dimension Φ4 · Feature Α (διαδραστική γραμμή τομής)

**Ημ/νία:** 2026-07-02
**Feature:** Αυτόματη διαστασιολόγηση κάτοψης (DXF Viewer) — **ADR-563**
**Κατάσταση:** Φ1+Φ2+Φ3 + **Φ4-Δ** (interior witness) + **Φ4-Β** (aligned skewed) **ΥΛΟΠΟΙΗΘΗΚΑΝ,
UNCOMMITTED**. **Γ (collision avoidance) ΠΑΡΑΚΑΜΦΘΗΚΕ** (βλ. §2). **Επόμενο & ΤΕΛΕΥΤΑΙΟ = Α.**

> ⚠️ **Το working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent.** Άγγιξε **ΜΟΝΟ** αρχεία του Auto-Dimension
> (+ `autoDimension.*` i18n keys). **Ο Giorgio κάνει commit/push — ΟΧΙ ο agent.**

---

## 0. Κανόνες συνεδρίας (ΑΠΑΡΑΒΑΤΟΙ)
- 🌐 **Απάντα ΠΑΝΤΑ στα Ελληνικά.**
- 🏢 **Enterprise + FULL SSoT.** «Όπως οι μεγάλοι» (**Revit / Maxon Cinema 4D / Figma-level**).
  Θέλουμε full-enterprise + full-SSoT· **ΑΛΛΑ** αν οι μεγάλοι δεν προτείνουν κάτι, ακολουθούμε
  **την πρακτική των μεγάλων** — **δεν εφευρίσκουμε δική μας**.
- 🔎 **ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ γράψεις ΟΠΟΙΟΝΔΗΠΟΤΕ κώδικα** — reuse, **ΜΗΔΕΝ διπλότυπα**.
- 🔬 **Ερεύνησε ξανά (WebSearch)** τι κάνουν οι μεγάλοι για interactive cut-line dimensioning.
- 📐 **Plan Mode** (ADR-driven). Στο clarify: **ξεκίνα με συγκεκριμένο ASCII/αριθμητικό παράδειγμα**.
- ❌ **ΜΗΝ τρέξεις `tsc`** (N.17). ✅ **jest επιτρέπεται** (`npx jest "…/dimensions/auto" "dim-association"`).
- ❌ **ΜΗΝ commit / push** (N.(-1)). Στο τέλος: update ADR-563 + jest + πρότεινε browser-verify+commit.

---

## 1. Τι υπάρχει ήδη (ΚΑΝ' ΤΟ REUSE — ΜΗΝ ΤΟ ΞΑΝΑΓΡΑΨΕΙΣ)

**Pure engine** — `src/subapps/dxf-viewer/systems/dimensions/auto/`:
- `auto-dimension-types.ts` — `AutoDimensionOptions`, `AUTO_DIMENSION_DEFAULTS`,
  **`PlannedSegment { axis:'x'|'y'; dimensionType?:'linear'|'aligned'; defPoints:[3]; rotation; source1?; source2? }`**.
- `auto-dimension-reference-extraction.ts` — **exported reuse:** `classifyElement(e)`,
  `detailCoordsFor(cls,proj,basis)`, `projectBoundsOntoAxis(bounds, measuresX)`, `AxisProjection`,
  `ElementClass`. + `calculateBimEntity2DBounds` (`bim/utils/bim-bounds.ts`).
- `auto-dimension-chain-planner.ts` — `planChains` (περιμετρικό). **exported reuse:**
  `dedupSorted(points)` (→ `snapToGrid` ADR-049), **`quantizeCoord(coord)`** (Φ4-Δ), `CoordSource`.
- `auto-dimension-interior-planner.ts` — **(Φ3+Φ4-Δ)** `planInteriorChains(elements,options,overall)`
  → 2 ορθογώνιες αλυσίδες μέσα από **centroid**, με **Gap-to-Element witness** (near-face perp).
  **← Το Α είναι ουσιαστικά αυτό, αλλά με γραμμή τομής που ΤΡΑΒΑΕΙ Ο ΧΡΗΣΤΗΣ αντί auto-centroid.**
- `auto-dimension-aligned-planner.ts` — **(Φ4-Β, ΝΕΟ)** `planAlignedChains(elements,options)` →
  aligned dim ανά **λοξό** τοίχο/δοκό, κατά μήκος του άξονά του. Reuse `unitAxis`
  (`bim/walls/wall-grip-math.ts`), `beamAxisSceneFrame` (`bim/beams/beam-axis-scene-frame.ts`),
  `perpUnit`/`project2D` (`bim/grips/grip-math.ts`). **← Το Α θα κάνει reuse τη ΛΟΓΙΚΗ aligned:
  προβολή στοιχείων σε ΑΥΘΑΙΡΕΤΟ άξονα (τη γραμμή τομής) + `buildAlignedGeometry`.**
- `auto-dimension-entity-factory.ts` — `buildAutoDimensionEntities(segments,ctx)` →
  `AutoDimensionEntity[]` (`LinearDimensionEntity | AlignedDimensionEntity`). `dimensionType:'aligned'`
  → aligned entity (χωρίς rotation/associations). associations = **`bimExtent`** (διαβάζει `seg.axis`).
- `auto-dimension-engine.ts` — `runAutoDimension` = extract→planChains+planInteriorChains(αν interior)
  +planAlignedChains(αν alignedSkewed)→factory. `computeOverallBounds` reuse `unionBounds`.
- `run-auto-dimension-flow.ts` — dialog→engine→**`addDimensionsToScene`**.

**Commit/scene:** `bim/scene/add-dimensions-to-scene.ts` → `appendEntitiesToScene(...,'dim-auto',...)`
= **1 undoable batch** + persistence + associativity observer αυτόματα. **← ΤΟ Α ΚΑΤΑΛΗΓΕΙ ΕΔΩ.**

**Geometry builder (reuse ως έχει):** `builders/linear-aligned-builder.ts` —
`buildAlignedGeometry` (dim line **∥** extOrigin1→extOrigin2· witness DIMEXO/DIMEXE). Ήδη dispatched
από `buildDimensionGeometry` (`'aligned'`), render μέσω `kind:'linear'` (DimensionRenderer). **Μηδέν
αλλαγή σε renderer/geometry.**

**Associativity:** `systems/dimensions/dim-association-service.ts` branch `bimExtent` — **μόνο x/y**.
Λοξός/vector άξονας ΔΕΝ υποστηρίζεται (κοινό αρχείο, shared tree — **εκτός scope**).

**Tests (πράσινα, 96):** `npx jest "src/subapps/dxf-viewer/systems/dimensions/auto" "dim-association"`.

---

## 2. Γιατί παρακάμφθηκε το Γ (collision avoidance)
Web research έδειξε ότι οι μεγάλοι **ΔΕΝ** μετακινούν αυτόματα τη *γραμμή* διάστασης σε «καθαρή ζώνη»
(δεν υπάρχει τέτοιο auto feature). Ό,τι κάνουν αυτόματα = **text-overlap handling** (ο αριθμός
πετάγεται έξω/leader) — που ζει στον **κοινό** renderer (shared tree, εκτός scope). Ο Giorgio επέλεξε
**«προσπέρνα το Γ → πήγαινε Α»**. Το πραγματικό πρόβλημα του Γ (πού μπαίνει η εσωτερική γραμμή) το λύνει
ακριβώς το **Α** (ο χρήστης τραβά τη γραμμή). Text-overlap = μελλοντικό ξεχωριστό βήμα σε shared renderer.

---

## 3. Feature Α — Διαδραστική γραμμή τομής (interactive cut-line dimension)

**Τι θέλουμε (πρακτική μεγάλων — ArchiCAD «Interior Dimensioning»):** ο χρήστης **τραβά μια γραμμή**
(2 κλικ, cut line) πάνω στην κάτοψη· **ό,τι τη διασχίζει** (κολόνες/τοίχοι/ανοίγματα) διαστασιολογείται
σε **μία αλυσίδα κατά μήκος της γραμμής**. Live preview όσο σέρνει· commit με το 2ο κλικ/Enter.

**ΠΡΩΤΑ SSoT AUDIT (grep — ΥΠΟΧΡΕΩΤΙΚΟ, υπάρχει πολλή υποδομή):**
- **Interactive tool pattern:** `grep` → `ToolStateStore`, `activeTool`, `use-wall-tool-lifecycle.ts`,
  `useColumnTool`, `mouse-handler-up` (κεντρικό `findSnapPoint` στο mouse-up — ο τοίχος/κολόνα το
  παίρνει δωρεάν), drawing **preview/ghost** generators, `RadialCommandRing` (dynamic input).
  → **Reuse** two-click line-draw + preview pipeline· **ΜΗΝ** γράψεις νέο tool/preview/snap.
- **Snap:** κεντρικό `findSnapPoint` (mouse-handler-up) — τα endpoints της γραμμής κουμπώνουν δωρεάν.
- **«Τι διασχίζει η γραμμή»:** `grep` intersection utils → `segmentAabbHit`
  (`systems/coordination/clash-narrow-phase.ts`), `lineIntersectsRectangle`
  (`systems/selection/universal-marquee-geometry.ts`), `boundsIntersect`. → **Reuse**, ΜΗΝ γράψεις
  νέο segment∩bbox.
- **Προβολή στοιχείων στη γραμμή + αλυσίδα:** **reuse** τη **λογική** του `planInteriorChains` /
  `planAlignedChains` — αλλά με **αυθαίρετο άξονα** = η γραμμή τομής (unit dir της). Πρόβαλε το κέντρο
  (ή παρειές) κάθε στοιχείου που τέμνεται πάνω στον άξονα της γραμμής → **`dedupSorted`** (quantize) →
  διαδοχικά ζεύγη → **aligned** segments (dim line ∥ γραμμή τομής) με **`buildAlignedGeometry`**.
- **Commit:** **reuse** `buildAutoDimensionEntities` (→ `dimensionType:'aligned'`) + `addDimensionsToScene`
  (undoable batch). **Ίδιο pipeline με Φ3/Φ4-Β.**

**Πιθανή δομή (επιβεβαίωσε στο audit):**
- Νέο pure `auto-dimension-cutline-planner.ts`: `planCutLineChain(elements, cutStart, cutEnd, options)`
  → `PlannedSegment[]` (aligned, κατά μήκος cut line). Γενίκευση του interior planner σε **διάνυσμα
  άξονα** (project onto arbitrary axis αντί X/Y). **Reuse** `classifyElement`/`projectBoundsOntoAxis`
  (ή νέα projection σε vessel-axis — ΑΝ δεν υπάρχει ήδη· grep `projectPolygonOnAxis`,
  `polygon-axis-projection.ts`, `projectPointOnAxis`).
- Νέο tool hook (activeTool='auto-dim-cutline' ή παρόμοιο) + wiring σε ribbon
  (`ui/ribbon/data/home-tab-dimensions.ts`) + keyboard. Live preview = reuse ghost/preview SSoT.
- **Associativity:** ίδιος περιορισμός με Φ4-Β (λοξός άξονας → non-associative, ή μόνο αν άξονας ~x/y).
  Μην αγγίξεις το κοινό `dim-association-service` (shared tree).

**Verify:** τραβάς γραμμή σε κάτοψη → live preview αλυσίδας → commit· 1 Ctrl+Z αναιρεί· jest για
`planCutLineChain` (projection/dedup/aligned)· browser.

---

## 4. Τι ΝΑ ΜΗΝ κάνεις
- ❌ Μην ξαναγράψεις engine/factory/dialog/geometry-builder/tool/preview/snap/intersection — **reuse**.
- ❌ Μην αγγίξεις κοινό `dim-association-service` / renderer (shared tree, άλλος agent).
- ❌ Μην commit/push. ❌ Μην τρέξεις tsc. ❌ Μόνο αρχεία Auto-Dimension (+ `autoDimension.*` i18n).

## 5. Verification (γενικό)
- `npx jest "src/subapps/dxf-viewer/systems/dimensions/auto" "dim-association"`.
- Update `ADR-563` (section «Φ4-Α» + changelog) στο ίδιο commit-set. Πρότεινε browser-verify+commit.
