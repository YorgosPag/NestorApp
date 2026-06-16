# HANDOFF — Ruler units ΔΕΝ αλλάζουν (πιθανό 3ο διπλότυπο) + BIM entity-count στις κάρτες + Θ3 sorting

**Ημερομηνία:** 2026-06-16
**Συντάκτης:** Opus 4.8 (συνεδρία «Display-MEASUREMENT SSoT ενοποίηση»)
**Στόχος νέας συνεδρίας:** Να κλείσουν 2 ανοιχτά bugs που βρήκε ο Giorgio σε browser-verify, **FULL ENTERPRISE + FULL SSoT (Revit-grade)**.

> ⚠️ **ΓΛΩΣΣΑ:** Απαντάς ΠΑΝΤΑ Ελληνικά.
> ⚠️ **COMMIT/PUSH:** Τα κάνει ο **Giorgio**, ΟΧΙ εσύ (N.(-1)). ΠΟΤΕ `git add -A` — μόνο τα δικά σου αρχεία.
> ⚠️ **SHARED WORKING TREE:** Δουλεύει κι άλλος agent (cursor-lag/snap + ADR-459/460/461). **ΜΗΝ αγγίξεις** χωρίς λόγο: `ADR-040*`, `LayerCanvas.tsx`, `systems/cursor/snap-scheduler.ts`, ADR-459/460/461 αρχεία.
> ⚠️ **MODEL (N.14):** δήλωσε μοντέλο & περίμενε «ok».
> ⚠️ **TSC (N.17):** ΕΝΑ tsc τη φορά — έλεγξε ότι δεν τρέχει άλλος.
> ⚠️ **SSoT (Giorgio αυστηρός):** ΠΡΙΝ γράψεις ΟΠΟΙΟΝΔΗΠΟΤΕ formatter/counter → grep για υπάρχον SSoT. ΜΗΝ δημιουργήσεις διπλότυπο. Αν υπάρχει SSoT → χρησιμοποίησέ το/επέκτεινέ το.

---

## 🎯 ΤΑ 2 ΑΝΟΙΧΤΑ BUGS (ΚΥΡΙΑ ΔΟΥΛΕΙΑ)

### BUG A — Οι μονάδες στους ΧΑΡΑΚΕΣ (rulers) ΔΕΝ αλλάζουν με τον status-bar selector (cm/m/mm)

**Συμπτώματα (Giorgio):** Ο status-bar dropdown λέει «m», αλλά οι χάρακες δείχνουν χιλιοστά. Άλλαξα τον `canvas-v2/layer-canvas/layer-grid-ruler-renderer.ts` (X & Y ticks → `formatCoordinateForDisplay`) ΑΛΛΑ **ΑΚΟΜΑ δεν αλλάζουν**.

**🔑 ΚΡΙΣΙΜΟ ΣΤΟΙΧΕΙΟ ΔΙΑΓΝΩΣΗΣ:** Στο ΙΔΙΟ build, το **status-bar coordinate readout** (`ui/toolbar/ToolbarCoordinatesDisplay.tsx`, React) **ΑΛΛΑΞΕ σωστά** σε «X: 9,8046, Y: 2,0098 m» (δικός μου `formatCoordinateForDisplay`, hot-reloaded). Άρα ο κώδικάς μου ΤΡΕΧΕΙ — αλλά ο **ορατός ruler ΔΕΝ είναι ο renderer που άλλαξα**, ή είναι σε cached layer που δεν ξαναζωγραφίζεται.

**ΥΠΟΘΕΣΗ (Giorgio το υποψιάζεται, σωστά): υπάρχει ΤΡΙΤΟΣ διπλότυπος ruler renderer.** Μέχρι τώρα ξέρουμε **ΔΥΟ**:
1. `systems/rulers-grid/` (RulersGridSystem + `ruler-calculations.ts`) → wired στο SSoT από ΠΡΟΗΓΟΥΜΕΝΗ συνεδρία (`formatLengthMm`). **Άγνωστο αν είναι ο ορατός.**
2. `canvas-v2/layer-canvas/layer-grid-ruler-renderer.ts` (`renderRulers`, καλείται από `LayerRenderer.ts:42/200/270`) → **εγώ το συνέδεσα** αυτή τη συνεδρία (X/Y `toFixed(0)`→`formatCoordinateForDisplay`, unit→`currentDisplayUnitLabel()`). ⚠️ shared-tree.

**ΚΑΤΕΥΘΥΝΣΗ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ (Firestore/runtime-first, μην μαντέψεις):**
1. **Βρες ΠΟΙΟΣ renderer ζωγραφίζει ΠΡΑΓΜΑΤΙΚΑ τους ορατούς χάρακες.** Βάλε προσωρινό `console.trace`/μοναδικό marker σε κάθε candidate renderer ή σβήσε προσωρινά τον καθένα και δες ποιος εξαφανίζεται. Candidates να ψάξεις:
   - `systems/rulers-grid/` → υπάρχει `RulerRenderer`/canvas εκεί; (grep `RulerRenderer`, `drawRuler`, `renderRuler`)
   - `debug/CalibrationGridRenderer.ts` (γράφει coords — debug· ίσως ενεργό)
   - `LayerRenderer.ts:301` → `rulerDebugOverlay` / `RulerDebugOverlay`
   - Μήπως ο ruler είναι σε **cached bitmap layer** που το `markAllCanvasDirty()` ΔΕΝ invalidate-άρει (γι' αυτό δεν live-redraw-άρει). Ψάξε για ruler bitmap cache.
2. **Όταν βρεις τον ΕΝΑ ορατό:** σύνδεσέ τον στο display-measurement SSoT (`formatCoordinateForDisplay`/`currentDisplayUnitLabel` από `config/display-length-format`). **FULL SSoT:** αν υπάρχουν 3 ruler renderers, αυτό είναι το πραγματικό πρόβλημα — ιδανικά ΕΝΑΣ renderer (ή ΕΝΑ shared tick-label formatter). Συζήτησε με Giorgio αν θες να ενοποιήσεις τους ruler renderers (μεγάλο) ή απλά να συνδέσεις τον ορατό (μικρό).
3. **Live redraw:** ο selector (`useDisplayUnit.setDisplayUnit`) καλεί `markAllCanvasDirty()`. Επιβεβαίωσε ότι αυτό ξαναζωγραφίζει τον ruler layer· αν όχι, χρειάζεται explicit ruler invalidation στο `setDisplayUnit` (ή subscription στο `displayUnitState` όπως έκανα στο `ToolbarCoordinatesDisplay`).

**ΣΗΜΕΙΩΣΗ:** Η αλλαγή μου στο `layer-grid-ruler-renderer.ts` ίσως είναι σωστή αλλά σε λάθος/ανενεργό renderer. Αν αποδειχθεί ανενεργός, **κράτησέ την** (σωστή ούτως ή άλλως) αλλά βρες & σύνδεσε τον ενεργό.

### BUG B — Στις κάρτες επιπέδων (LevelListCard) το πλήθος οντοτήτων μετράει ΜΟΝΟ DXF, ΟΧΙ BIM

**Συμπτώματα (Giorgio):** Προσθέτω BIM οντότητες στον καμβά → το «πλήθος οντοτήτων» στην κάρτα του level ΔΕΝ αλλάζει. Αναγνωρίζει μόνο DXF entities.

**ΡΙΖΑ:** `ui/components/LevelPanel.tsx` → `entityCount = effectiveScene?.entities?.length || 0`. Το `scene.entities` = **μόνο DXF entities**. Τα **BIM entities ζουν αλλού** (πιθανόν `scene.bim` / `BimEntityStore` / ξεχωριστό store — ΨΑΞΕ ΤΟ).

**ΚΑΤΕΥΘΥΝΣΗ (FULL SSoT):**
1. Βρες πού ζουν τα BIM entities στο `SceneModel` (grep `scene.bim`, `bimEntities`, `BimEntityStore`, `useBimEntities`). Δες `types/scene.ts`.
2. Φτιάξε **ΕΝΑ SSoT resolver** `resolveLevelEntityCount(scene)` = DXF entities + BIM entities (μην μετράς inline σε 2 σημεία). Βάλ' το όπου ανήκει (π.χ. δίπλα στο SceneModel ή levels system).
3. Χρησιμοποίησέ το στο `LevelPanel` (αντί `scene.entities.length`). Πρόσεξε το **Θέμα 1 fix** που ήδη έβαλα (ενεργό level → live `scene` prop): το BIM count πρέπει να δουλεύει και για το ενεργό + τα φορτωμένα levels.
4. ⚠️ Το BIM count μπορεί να χρειάζεται reactive subscription (το BimEntityStore είναι zustand/store) ώστε η κάρτα να ανανεώνεται live όταν προστίθεται BIM entity.

### Θ3 (DEFER, ΟΧΙ display-units) — Σειρά σταθμών στο floating panel είναι μπερδεμένη
Το `LevelPanel` κάνει `levels.map` χωρίς sort· η σειρά = `Level.order` (σειρά δημιουργίας). Η σωστή φυσική σειρά (Θεμελίωση→Ισόγειο→1ος→2ος→Απόληξη) απαιτεί **ADR-461 floor-elevation/kind ordering** — το `Level` type ΔΕΝ έχει elevation/kind (ζουν στο floor satellite model, UNCOMMITTED δουλειά **άλλου agent**). **ΜΗΝ το αγγίξεις χωρίς συντονισμό** — ρίσκο σύγκρουσης. Πες στον Giorgio να το αναθέσει στον ADR-461 agent.

---

## ΜΕΡΟΣ 0 — ΤΙ ΟΛΟΚΛΗΡΩΘΗΚΕ ΑΥΤΗ ΤΗ ΣΥΝΕΔΡΙΑ (UNCOMMITTED, tsc clean δικά μου / 13+51 jest GREEN)

**Display-MEASUREMENT SSoT ΕΝΟΠΟΙΗΣΗ (Revit-grade, FULL SSoT)** — ADR-462 Phase 2 Unification. Έλυσε divergence (Properties «500.00 cm» τελεία vs dim-pills «500,00 cm» κόμμα· area/perimeter/coordinate τύπωναν raw mm χωρίς selector).

**Αρχιτεκτονική (ΜΑΘΕ ΤΗΝ — μην φτιάξεις διπλότυπο):**
- `config/units.ts` (pure primitives): `toDisplay`/`fromDisplay`/`formatDisplayValue` (parseable, **για editable inputs**) + NEW area/coord: `DISPLAY_AREA_LABELS`, `DEFAULT_AREA_PRECISION`, `DEFAULT_COORDINATE_PRECISION`, `toDisplayArea`.
- `config/display-length-format.ts` = **ΤΟ ΕΝΑ display SSoT** (store-aware, locale+label): `formatLengthForDisplay` / `formatAreaForDisplay` / `formatCoordinateForDisplay` / `formatLengthMm`(alias) / `currentDisplayUnitLabel`. Binding layer ΠΑΝΩ στο `FormatterRegistry` (delegate-άρει locale).
- `FormatterRegistry` (ADR-082) = generic locale engine· τα `formatArea`/`formatCoordinate`/`formatRadius`/`formatDiameter` του → `@deprecated` (dead, redirect στο SSoT).
- **Editable inputs μένουν parseable** (`formatDisplayValue`): QuickPropertiesMiniPanel, entity-property-schema, useDynamicInputRealtime. ΜΗΝ τα αλλάξεις σε locale.

**Migrated read-only callers** (length/area/coordinate): QuickPropertiesHoverPopover, hover edge/radius/text-labeling/render(area), guide-annotations, base-entity-rendering-helpers, Arc/Circle/Ellipse/Rectangle/Polyline/circle-text-utils, preview-entity-renderers, DynamicInputOverlay(multi-point), OverlayProperties, ToolbarCoordinatesDisplay (X/Y +live subscription).

**Browser-verify fixes (αυτή η συνεδρία):**
- `canvas-v2/layer-canvas/layer-grid-ruler-renderer.ts` → συνδέθηκε SSoT (⚠️ shared-tree, έγκριση Giorgio) — **αλλά ΔΕΝ έλυσε το BUG A** (πιθανόν ανενεργός renderer — βλ. πάνω).
- `ui/components/LevelPanel.tsx` → Θ1 «Κενό επίπεδο» badge: ενεργό level → live `scene` prop fallback (αλλά **BUG B** = BIM entities ακόμα δεν μετριούνται).

---

## ΜΕΡΟΣ 1 — git add (ΜΟΝΟ δικά μου· ο Giorgio κάνει commit). Working tree shared.
```
# Ενοποίηση (Slices 1-5)
src/subapps/dxf-viewer/config/units.ts
src/subapps/dxf-viewer/config/display-length-format.ts
src/subapps/dxf-viewer/config/__tests__/display-length-format.test.ts
src/subapps/dxf-viewer/systems/properties/QuickPropertiesHoverPopover.tsx
src/subapps/dxf-viewer/utils/hover/edge-utils.ts
src/subapps/dxf-viewer/utils/hover/radius-utils.ts
src/subapps/dxf-viewer/utils/hover/text-labeling-utils.ts
src/subapps/dxf-viewer/utils/hover/render-utils.ts
src/subapps/dxf-viewer/systems/guides/guide-annotations-renderer.ts
src/subapps/dxf-viewer/rendering/entities/base-entity-rendering-helpers.ts
src/subapps/dxf-viewer/rendering/entities/ArcRenderer.ts
src/subapps/dxf-viewer/rendering/entities/CircleRenderer.ts
src/subapps/dxf-viewer/rendering/entities/EllipseRenderer.ts
src/subapps/dxf-viewer/rendering/entities/RectangleRenderer.ts
src/subapps/dxf-viewer/rendering/entities/PolylineRenderer.ts
src/subapps/dxf-viewer/rendering/entities/shared/circle-text-utils.ts
src/subapps/dxf-viewer/rendering/entities/shared/distance-label-utils.ts
src/subapps/dxf-viewer/canvas-v2/preview-canvas/preview-entity-renderers.ts
src/subapps/dxf-viewer/systems/dynamic-input/components/DynamicInputOverlay.tsx
src/subapps/dxf-viewer/ui/OverlayProperties.tsx
src/subapps/dxf-viewer/ui/toolbar/ToolbarCoordinatesDisplay.tsx
# Follow-up SSoT deprecation
src/subapps/dxf-viewer/formatting/FormatterRegistry.ts
src/subapps/dxf-viewer/formatting/useFormatter.ts
src/subapps/dxf-viewer/formatting/index.ts
# Browser-verify fixes
src/subapps/dxf-viewer/canvas-v2/layer-canvas/layer-grid-ruler-renderer.ts   (⚠️ shared-tree)
src/subapps/dxf-viewer/ui/components/LevelPanel.tsx
# Docs
docs/centralized-systems/reference/adrs/ADR-462-canonical-mm-units.md
local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt   (⚠️ MIXED — μόνο τα δικά μου sub-items)
```
**ΠΡΟΣΟΧΗ:** το git status έχει & άλλα M από άλλον agent (ADR-459/460/461, dxf-import κ.λπ.). ΜΗΝ τα stage-άρεις.

## ΜΕΡΟΣ 2 — TSC / pre-existing
14 pre-existing tsc errors (ΟΧΙ δικά μου): `bim-3d/converters/*`, `BeamFromWallGhost`, `proposal-ghost-3d-builders`, `ProposalGhost3DMount`, `foundation-level`, `slab-grid-commit`, `useDxfSceneConversion`, `useFloors3DAggregator` (ADR-459/460/461 shared tree). Άστα. Τα δικά μου ήταν tsc clean (το τελευταίο tsc run διακόπηκε από Giorgio· ξανατρέξ' το για σιγουριά — ΕΝΑ τη φορά).

## ΜΕΡΟΣ 3 — BASELINE ΒΑΣΗΣ (test data)
- company `comp_9c7c1a50` · project `proj_0df5af7a` · building `bldg_b4d3cecb` · user `WKBWEg3DSfcdSbLNJfzGEW3vkct1`
- Levels: Επίπεδο 1 (default, χωρίς buildingId)· Κάτοψη Ορόφου «F»=Θεμελίωση (floorplanType:'floor', ΞΥΛΟΤΥΠΟΣ, έχει DXF)· Απόληξη Κλιμακοστασίου· 1ος Όροφος· Κάτοψη Ορόφου «Ισόγειο»· 2ος Όροφος (κενά).
- Firestore MCP διαθέσιμο (η collection ΔΕΝ είναι `dxf_viewer_levels` με field `projectId` — query επέστρεψε 0· βρες το σωστό collection/field).
- Reproduce BUG A: άλλαξε status-bar dropdown cm↔m↔mm → κοίτα αν οι χάρακες αλλάζουν. BUG B: πρόσθεσε BIM entity (π.χ. κολώνα) → κοίτα αν η κάρτα του level αλλάζει πλήθος.

## ΜΕΡΟΣ 4 — ΑΡΧΗ ΕΡΓΑΣΙΑΣ
PHASE 1 (recognition): πριν γράψεις, διάβασε `config/display-length-format.ts` (το SSoT) + βρες τον ΕΝΑ ορατό ruler renderer (BUG A) + το BIM entity store (BUG B). Plan Mode (~3-6 αρχεία/bug). Δήλωσε μοντέλο, περίμενε «ok».
