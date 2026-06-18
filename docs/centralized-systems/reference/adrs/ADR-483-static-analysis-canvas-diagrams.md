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
- ✅ **ΕΝΤΟΣ (Slice 4):** διάγραμμα ροπής δοκαριών + toggle (default OFF) + ετικέτες ακραίων + i18n el+en + jest (5 GREEN).
- ✅ **ΕΝΤΟΣ (Slice 4b):** selector M/V/N (canonical select)· ζώνες εφελκυσμού/θλίψης στο διάγραμμα ροπής· βέλη ομοιόμορφου φορτίου (UDL)· caution σε αστάθεια. (Βλ. §9.)
- 🔜 **DEFER:** κολόνες σε 3Δ/τομή· envelope/combination selector· point loads/self-weight βέλη.
- ❌ **ΕΚΤΟΣ:** solver (read-only)· 3Δ diagrams· σεισμός T4· καμία επαναφορά kPa (ADR-474). Utilization overlay = ξεχωριστό **ADR-485** (Slice 4c).

## 9. Slice 4b — «πλούσιο» διάγραμμα (M/V/N selector + ζώνες T/C + βέλη φορτίου)

Επέκταση των ίδιων αρχείων Slice 4 (μηδέν re-write), Robot/SAP2000-grade ανάγνωση φορέα:

1. **Selector Μ/V/N** (`diagramComponent` στο view-store + NEW `ui/ribbon/components/DiagramComponentSelect.tsx`, canonical `@/components/ui/select` ADR-001): ένα εντατικό μέγεθος κάθε φορά (Robot-style). Χρώματα **Μ κόκκινο / V πράσινο / N μπλε**, default Μ. Το geometry module ήδη υποστήριζε `'shear'|'axial'`.
2. **Ζώνες εφελκυσμού/θλίψης** (`member-diagram-draw.ts` `fillSignedRibbon` + `drawTensionZoneLabels`): το γέμισμα ροπής χωρίζεται στα **zero-crossings** — θετική (sagging) → θερμό/εφελκ. κάτω ίνα, αρνητική (hogging) → ψυχρό/εφελκ. άνω ίνα + ετικέτες. Μόνο για ροπή· V/N κρατούν μονόχρωμο γέμισμα.
3. **Βέλη φορτίων** (NEW pure αδελφό του draw `member-load-arrows.ts`): σειρά κάτω-βελών UDL + ετικέτα `… kN/m` πάνω από κάθε δοκάρι. Πηγή = `buildBeamSectionContext(beam).designLineLoadKnM` (ULS UDL, ADR-472)· mapping μέλος→entity μέσω `member.id === entityId` (ADR-480, 1:1).
4. **Caution** (`reliable` flag στο `MemberDiagramSet` = `!result.unstable`): αστάθεια → όλα τα διαγράμματα **αμπέρ διακεκομμένα χωρίς γέμισμα** (Robot «unreliable results»).

**Reuse:** geometry/draw/overlay/view-store Slice 4· `section-context.designLineLoadKnM`· `VisualStyleSelect` (selector πρότυπο)· `canvas-pill`. **NEW:** `member-load-arrows.ts`, `DiagramComponentSelect.tsx`. **MOD:** view-store (+`diagramComponent`/`showUtilization`), geometry (+`reliable`), draw (+T/C split/caution/zone-labels), overlay (per-component style+unit, load arrows, caution), ribbon data/panel, i18n.

### Slice 4b+ — Robot/SAP εμπλουτισμοί διαγράμματος (Giorgio req)
Επιπλέον πληροφορίες όπως στους «μεγάλους» (Robot/SAP2000/ETABS), χωρίς να πνίγουν το διάγραμμα:
5. **Τιμές στα άκρα μέλους (M_i / M_j)** — `drawDiagramEndValues` (pills στις στάθμες f=0/1)· το span-max pill (`drawDiagramExtremum`) δείχνεται **μόνο όταν είναι εσωτερικό** (dedup με τα end pills). Κρίσιμο για ροπές στήριξης σε συνεχείς δοκούς.
6. **Σύμβολα στηρίξεων** — NEW pure `support-glyphs.ts` (`drawSupportGlyph`: άρθρωση=κενό τρίγωνο+έδαφος / πάκτωση=γεμάτο+hatch)· ο overlay προβάλλει τους δεσμευμένους κόμβους (`model.supports`+`nodes.position`, μέτρα×toCanvasFromMeters).
7. **Ετικέτα συνδυασμού** — `combinationKind` εκτεθειμένο στο `MemberDiagramSet`· caption HUD πάνω-αριστερά «Συνδυασμός: {kind}» (i18n ICU).
8. **Σημεία μηδενισμού (M=0)** — `drawInflectionMarkers` (λευκός κύκλος στον άξονα σε κάθε αλλαγή προσήμου· διακοπή ράβδων). Για όλα τα μεγέθη (zero του σχεδιαζόμενου).

### Changelog (Slice 4b / 4b+)
- **2026-06-18 (Opus, UNCOMMITTED):** Slice 4b. NEW `member-load-arrows.ts` (+jest), `DiagramComponentSelect.tsx`. MOD `analysis-diagram-view-store` (+diagramComponent +showUtilization), `member-diagram-geometry` (+reliable), `member-diagram-draw` (T/C sign-split fill + caution dashed + tension zone labels), `StructuralDiagramOverlay` (component style/unit map, load arrows, caution), `view-tab-bim-settings`/`RibbonPanel`, i18n el/en. browser-verify fix: tension zone labels αγκύρωση στον άξονα + οριζόντια μετατόπιση (δεν συμπίπτουν με value pill).
- **2026-06-18 (Opus, UNCOMMITTED) — Slice 4b+:** end values M_i/M_j (+interior-only span max) · NEW `support-glyphs.ts` · combination caption (`combinationKind` στο geometry + i18n `combinationCaption`) · inflection markers M=0.
- **2026-06-18 (Opus, UNCOMMITTED) — browser-verify ✅ (Giorgio, ΟΛΑ OK):** (α) **T/C calibration** swap — sagging=ΑΡΝΗΤΙΚΟ σε αυτόν τον solver (βλ. §«Calibration» πάνω): αρνητική→κόκκινο/εφελκ.κάτω, θετική→μπλε/εφελκ.άνω· `drawTensionZoneLabels` → explicit `(posLabel,posColor,negLabel,negColor)`. (β) **Βέλη φορτίου** από **ανάκτηση q=`|d²M/dx²|`** (`recoverUdlKnM`→`path.appliedUdlKnM`) αντί scene tributary (κενό→αόρατα)· αφαιρέθηκε ο `loadByEntityId`/scene reader. (γ) **Σύμβολα στηρίξεων** 7→11px + λευκό halo (ήταν αόρατα). (δ) `drawDiagramExtremum`→εσωτερική ακραία (ροπή ανοίγματος). (ε) M=0 markers μεγαλύτερα (+`appliedUdlKnM` jest). **14 diagram jest GREEN.** 🔴 tsc(Giorgio) + commit.

## 7. Validation
- `member-diagram-geometry.test.ts` (5 GREEN): δοκάρια-μόνο (κολόνες excluded)· `f=xM/L`· μέτρα→canvas· ακραία στάθμη + global max-abs· skip singular· empty model no-throw.
- 🔴 **Εκκρεμεί:** tsc (Giorgio, N.17) + browser-verify (πλαίσιο → «Ανάλυση» → toggle «Διαγράμματα Μ/V/N» ON → καμπύλες ροπής πάνω στα δοκάρια, σταθερό ύψος σε zoom, pill στη μέγιστη ροπή) + commit.

## 8. Changelog
- **2026-06-18 (Opus, UNCOMMITTED):** Αρχική υλοποίηση Slice 4. NEW: member-diagram-geometry.ts (+test), member-diagram-draw.ts, StructuralDiagramOverlay.tsx, analysis-diagram-view-store.ts, ShowAnalysisDiagramsToggle.tsx. MOD: view-tab-bim-settings.ts, RibbonPanel.tsx, canvas-layer-stack-2d-overlays-leaf.tsx, i18n el/en dxf-viewer-shell.json.
- **2026-06-18 (Opus, UNCOMMITTED) — browser-verify fix #1:** Η αρχική κλίμακα ήταν σταθερό pixel ύψος (60px) → το διάγραμμα άλλαζε αναλογία με το zoom (Giorgio το εντόπισε). Διορθώθηκε σε **model-space**: NEW `referenceLengthCanvas` (μέσο μήκος μέλους) στο geometry· overlay pxScale = (referenceLengthCanvas·0.35 / globalMaxAbs) · transform.scale → κλιμάκωση μαζί με το μοντέλο (Robot-grade). 5 jest GREEN.
- **2026-06-18 (Opus, UNCOMMITTED) — browser-verify fix #2:** Η καμπύλη φαινόταν σπασμένη (polyline 9 σταθμών). NEW `buildSmoothThrough` (midpoint quadratic-bezier) στο `member-diagram-draw` → ομαλή καμπύλη + γέμισμα, περνά ακριβώς από τα άκρα, εξομαλύνει τα ενδιάμεσα· **μηδέν αλλαγή στις σταθμές του solver** (read-only). Pure draw-layer.
