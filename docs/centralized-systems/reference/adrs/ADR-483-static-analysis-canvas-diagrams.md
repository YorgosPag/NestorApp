# ADR-483 — Static Analysis Canvas Diagrams (T3-UI / Slice 4 — διαγράμματα Μ κατά μήκος μελών στον καμβά)

**Status:** 🟢 DONE (UNCOMMITTED 2026-06-18 Opus) · **Σχετικά:** ADR-481 (static FEM solver — το INPUT, `DiagramStation[]`), ADR-480 (analytical model — άξονας i→j σε μέτρα), ADR-482 (UI surface — M/V/N ως αριθμοί· εδώ ως διαγράμματα), ADR-040 (low-freq store reads, micro-leaf overlay), ADR-422 L1/L3 (πρότυπο read-only overlay + transient view-store), ADR-462 (canonical-mm), ADR-467 (tributary — ζει ΠΑΡΑΛΛΗΛΑ).
**Ημ/νία:** 2026-06-18 · **Γλώσσα:** Ελληνικά.
**Roadmap:** «Δρόμος Α» — κλείνει τον κύκλο T3-UI: τα M/V/N φαίνονται ήδη ως **αριθμοί** (ADR-482)· τώρα ως **διαγράμματα** στον καμβά (Revit→Robot moment diagrams), ΠΡΙΝ χτιστεί ο σεισμός (T4). Πηγή: `HANDOFFS/HANDOFF_2026-06-18_T3-UI-Slice4_canvas-mvn-diagrams.md`.

---

## 1. Context — γιατί

Ο T3 solver (ADR-481) γεμίζει `MemberForceResult.diagram` (`DiagramStation[]`, 9 σταθμές, `xM` = απόσταση από κόμβο i σε μέτρα) σε κάθε «Ανάλυση», αλλά **κανείς δεν τα σχεδιάζει**. Το ADR-482 έδειξε μόνο το envelope (max-abs) ως αριθμούς στα panels. Όπως Revit→Robot: μετά την ανάλυση, διαγράμματα M/V/N πάνω στο μοντέλο, toggle-able, με κλίμακα & ετικέτες ακραίων.

## 2. Decision — presentation overlay πάνω σε έτοιμα data, μηδέν solver touch

Read-only canvas overlay (ADR-040 micro-leaf) που, όταν είναι ON το toggle, σχεδιάζει για κάθε φέρον **δοκάρι** το διάγραμμα ροπών — καμπύλη offset κάθετα στον άξονα, auto-fit κλίμακα, ετικέτα ακραίας τιμής. Ο engine (`solver/*`, `analytical-model-*`) **δεν αγγίχθηκε** — μόνο καταναλώνεται read-only μέσω `AnalysisResultsStore` + `AnalyticalModelStore`.

### 🔑 Γεωμετρική απόφαση (Revit-grade): μόνο δοκάρια σε κάτοψη v1
Σε **κάτοψη** μόνο τα μέλη που κείνται στο επίπεδο σχεδίασης (δοκάρια) έχουν νόημα «κατά μήκος» διαγράμματος. Οι **κολόνες** είναι κατακόρυφες (σημείο σε plan) → τα M/V/N τους φαίνονται ως αριθμοί (ADR-482)· τα διαγράμματά τους ανήκουν σε 3Δ/τομή → **DEFER**. Το διάγραμμα ροπών δοκαριού σχεδιάζεται schematic offset κάθετα στον in-plane άξονα (όπως moment diagrams πάνω σε framing plan).

## 3. Αρχιτεκτονική

**Καθαρός διαχωρισμός pure-geometry ↔ presentation:**
- **NEW `bim/structural/analytical/diagrams/member-diagram-geometry.ts`** (pure SSoT, zero React/DOM): `buildMemberDiagramPaths(model, result, opts)` → ανά δοκάρι: άξονας i→j (canvas units) + στάθμες `{ f∈[0,1], value }` + ακραία στάθμη + `globalMaxAbs`. Επιλογή συνδυασμού = πρώτος μη-singular ULS (το envelope δεν κρατά διάγραμμα). Κυρίαρχος άξονας ροπής = max-abs(momentZ vs momentY) ανά μέλος. `f = xM/lengthM`. Μετατροπή μέτρα → canvas units μέσω `toCanvasFromMeters = 1/sceneUnitsToMeters(units)` (ίδια αρχή με ClashOverlay). Extensible σε `'shear'|'axial'`.
- **NEW `bim/structural/analytical/diagrams/member-diagram-draw.ts`** (pure canvas): `drawMemberDiagram` (γέμισμα ribbon + καμπύλη + baseline σε screen space, offset = `value·pxScale` στο screen-perpendicular) + `drawDiagramExtremum` (pill ετικέτα, reuse `canvas-pill` SSoT).
- **NEW `components/dxf-layout/StructuralDiagramOverlay.tsx`** (ADR-040 micro-leaf): subscribes ΜΟΝΟ εδώ — `useAnalysisDiagramViewStore` + `ViewMode3DStore` + `AnalysisResultsStore` + `AnalyticalModelStore` (όλα low-freq). Δικό του canvas + `pointer-events-none`. Mirror του `HeatLoadOverlay`. **Model-space κλίμακα (Revit/Robot)**: η μέγιστη ροπή → `DIAGRAM_HEIGHT_FRACTION` (35%) του μέσου μήκους μέλους σε canvas units, × `transform.scale` → screen px· έτσι το διάγραμμα κλιμακώνεται **μαζί** με το μοντέλο στο zoom (σταθερή αναλογία με το δοκάρι) — ΟΧΙ σταθερό pixel ύψος.
- **NEW `state/analysis-diagram-view-store.ts`** (transient, non-persisted — mirror `pipe-sizing-view-store`): `showAnalysisDiagrams` (default OFF). Ξεχωριστό store → μηδέν Firestore schema touch.
- **NEW `ui/ribbon/components/ShowAnalysisDiagramsToggle.tsx`**: toggle (View tab, δίπλα στα analytical overlays). Mirror `ShowPipeSizingToggle`.

**Wiring:** `view-tab-bim-settings.ts` (+`ANALYSIS_DIAGRAMS_BUTTON` στο `BIM_GRAPHICS_PANEL`), `RibbonPanel.tsx` (+branch `show-analysis-diagrams-toggle`), `canvas-layer-stack-2d-overlays-leaf.tsx` (+mount), i18n `ribbon.commands.analysisDiagrams.*` (el+en).

## 4. Reuse (μηδέν διπλότυπο — N.0.2)
`AnalysisResultsStore`/`AnalyticalModelStore` (read-only, ADR-481/480)· `CoordinateTransforms.worldToScreen` + `sceneUnitsToMeters` (transform SSoT)· `canvas-pill` (pill SSoT)· `HeatLoadOverlay`/`pipe-sizing-view-store`/`ShowPipeSizingToggle` (overlay+toggle πρότυπα)· `useSyncExternalStore` reader pattern (ADR-482).

## 5. ADR-040 συμμόρφωση
Overlay = leaf subscriber σε **low-freq** stores (γράφονται μόνο στην «Ανάλυση») → ασφαλές subscribe· ο shell `CanvasLayerStack` δεν αποκτά νέο subscription (CHECK 6C safe)· δικό του canvas + `pointer-events-none` → μηδέν επίδραση σε hit-test/selection/bitmap cache. Καμία αρχιτεκτονική αλλαγή στο ADR-040 — additive overlay κατά το documented pattern.

## 6. Scope
- ✅ **ΕΝΤΟΣ:** διάγραμμα ροπής δοκαριών + toggle (default OFF) + ετικέτες ακραίων + i18n el+en + jest (5 GREEN).
- 🔜 **DEFER:** εναλλαγή M/V/N (το geometry module ήδη το υποστηρίζει — λείπει μόνο UI selector)· κολόνες σε 3Δ/τομή· envelope/combination selector· χρώμα/στυλ ανά component.
- ❌ **ΕΚΤΟΣ:** solver (read-only)· 3Δ diagrams· σεισμός T4· καμία επαναφορά kPa (ADR-474).

## 7. Validation
- `member-diagram-geometry.test.ts` (5 GREEN): δοκάρια-μόνο (κολόνες excluded)· `f=xM/L`· μέτρα→canvas· ακραία στάθμη + global max-abs· skip singular· empty model no-throw.
- 🔴 **Εκκρεμεί:** tsc (Giorgio, N.17) + browser-verify (πλαίσιο → «Ανάλυση» → toggle «Διαγράμματα Μ/V/N» ON → καμπύλες ροπής πάνω στα δοκάρια, σταθερό ύψος σε zoom, pill στη μέγιστη ροπή) + commit.

## 8. Changelog
- **2026-06-18 (Opus, UNCOMMITTED):** Αρχική υλοποίηση Slice 4. NEW: member-diagram-geometry.ts (+test), member-diagram-draw.ts, StructuralDiagramOverlay.tsx, analysis-diagram-view-store.ts, ShowAnalysisDiagramsToggle.tsx. MOD: view-tab-bim-settings.ts, RibbonPanel.tsx, canvas-layer-stack-2d-overlays-leaf.tsx, i18n el/en dxf-viewer-shell.json.
- **2026-06-18 (Opus, UNCOMMITTED) — browser-verify fix #1:** Η αρχική κλίμακα ήταν σταθερό pixel ύψος (60px) → το διάγραμμα άλλαζε αναλογία με το zoom (Giorgio το εντόπισε). Διορθώθηκε σε **model-space**: NEW `referenceLengthCanvas` (μέσο μήκος μέλους) στο geometry· overlay pxScale = (referenceLengthCanvas·0.35 / globalMaxAbs) · transform.scale → κλιμάκωση μαζί με το μοντέλο (Robot-grade). 5 jest GREEN.
- **2026-06-18 (Opus, UNCOMMITTED) — browser-verify fix #2:** Η καμπύλη φαινόταν σπασμένη (polyline 9 σταθμών). NEW `buildSmoothThrough` (midpoint quadratic-bezier) στο `member-diagram-draw` → ομαλή καμπύλη + γέμισμα, περνά ακριβώς από τα άκρα, εξομαλύνει τα ενδιάμεσα· **μηδέν αλλαγή στις σταθμές του solver** (read-only). Pure draw-layer.
