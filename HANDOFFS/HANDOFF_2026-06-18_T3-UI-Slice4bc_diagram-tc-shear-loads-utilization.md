# HANDOFF — T3-UI Slices 4b + 4c: «Πλούσιο» διάγραμμα (ζώνες T/C + M/V/N selector + βέλη φορτίων) + Utilization overlay

**Ημ/νία:** 2026-06-18 · **Από:** Opus session (μόλις ολοκλήρωσε & browser-verified το **Slice 4** = διάγραμμα ροπής Μ στον καμβά, ADR-483) · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά.
**Τύπος:** 🔴 PLAN-FIRST. **SSoT AUDIT (GREP) ΥΠΟΧΡΕΩΤΙΚΟ ΠΡΙΝ ΚΩΔΙΚΑ.** ΜΗΝ γράψεις πριν εγκριθεί το plan.
**Roadmap:** «Δρόμος Α» (ορατότητα πριν τον σεισμό T4). Επεκτείνει το ορατό διάγραμμα Μ ώστε ο μηχανικός να *διαβάζει* τον φορέα όπως σε Robot/SAP2000/ETABS.

> ⚠️ **Shared working tree** με άλλον agent. **git add ΜΟΝΟ τα δικά σου, ΠΟΤΕ -A.**
> **commit = Giorgio (ΟΧΙ εσύ). tsc = Giorgio** (N.17 — ένα tsc τη φορά). **jest = τρέχει κανονικά.**
> **Full Enterprise + Full SSOT + Revit-grade (GOL).** ≤40γρ/func, ≤500γρ/file, μηδέν `any`/`as any`/`@ts-ignore`, μηδέν hardcoded strings (i18n el+en), μηδέν inline styles/div-soup, Select = `@/components/ui/select` (ADR-001).
> **Επόμενο ελεύθερο ADR = 484.** Slice 4b → επεκτείνει **ADR-483**. Slice 4c (utilization) → **NEW ADR-484** (distinct design-check concern, T5-flavored).

---

## 0. ΚΡΙΣΙΜΟ — ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ (UNCOMMITTED στο working tree — ΕΠΕΚΤΕΙΝΕ, ΜΗΝ ΞΑΝΑΓΡΑΨΕΙΣ)

Το **Slice 4 (ADR-483)** ολοκληρώθηκε & browser-verified σε αυτό το session (uncommitted, ο Giorgio θα κάνει commit). Τα παρακάτω αρχεία **υπάρχουν ήδη** — θα τα **επεκτείνεις**:

```
NEW (Slice 4 — υπάρχουν):
src/subapps/dxf-viewer/bim/structural/analytical/diagrams/member-diagram-geometry.ts   ← pure SSoT: buildMemberDiagramPaths(model,result,opts) → MemberDiagramSet {paths, globalMaxAbs, referenceLengthCanvas}. DiagramComponent='moment'|'shear'|'axial' (ΗΔΗ υποστηρίζει V/N!). MemberDiagramPath {memberId,iCanvas,jCanvas,samples:{f,value}[],extremum}. Φιλτράρει memberType==='beam'.
src/subapps/dxf-viewer/bim/structural/analytical/diagrams/member-diagram-draw.ts        ← pure canvas: drawMemberDiagram (smooth quad-bezier via buildSmoothThrough + ribbon fill + baseline) + drawDiagramExtremum (pill, reuse canvas-pill). DiagramDrawStyle {stroke,fill}.
src/subapps/dxf-viewer/bim/structural/analytical/diagrams/__tests__/member-diagram-geometry.test.ts  ← 5 jest GREEN
src/subapps/dxf-viewer/components/dxf-layout/StructuralDiagramOverlay.tsx                ← ADR-040 micro-leaf (mirror HeatLoadOverlay): subscribe AnalysisResultsStore+AnalyticalModelStore+useAnalysisDiagramViewStore+ViewMode3DStore. Model-space pxScale = (referenceLengthCanvas·0.35/globalMaxAbs)·transform.scale. component:'moment'.
src/subapps/dxf-viewer/state/analysis-diagram-view-store.ts                              ← transient zustand: showAnalysisDiagrams (default OFF). ΕΔΩ προσθέτεις diagramComponent + showUtilization.
src/subapps/dxf-viewer/ui/ribbon/components/ShowAnalysisDiagramsToggle.tsx               ← View tab toggle (mirror ShowPipeSizingToggle)
MOD (Slice 4 — υπάρχουν):
src/subapps/dxf-viewer/ui/ribbon/data/view-tab-bim-settings.ts                           ← ANALYSIS_DIAGRAMS_BUTTON στο BIM_GRAPHICS_PANEL
src/subapps/dxf-viewer/ui/ribbon/components/RibbonPanel.tsx                              ← branch 'show-analysis-diagrams-toggle'
src/subapps/dxf-viewer/components/dxf-layout/canvas-layer-stack-2d-overlays-leaf.tsx     ← <StructuralDiagramOverlay/> mount
src/i18n/locales/{el,en}/dxf-viewer-shell.json                                           ← ribbon.commands.analysisDiagrams.*
docs/centralized-systems/reference/adrs/ADR-483-static-analysis-canvas-diagrams.md
```
**Αρχές Slice 4 (κράτησέ τες):** engine read-only (μηδέν solver touch)· overlay = ADR-040 leaf σε low-freq stores· model-space κλίμακα (κλιμακώνεται με zoom)· μόνο **δοκάρια** σε κάτοψη (κολόνες=κατακόρυφες=σημείο→DEFER 3Δ/τομή).

---

## 1. 🔴 ΥΠΟΧΡΕΩΤΙΚΟ SSOT AUDIT (GREP) — ΤΡΕΞΕ ΟΛΑ ΠΡΙΝ ΓΡΑΨΕΙΣ. Παραδοτέο: πίνακας reuse vs new.

### 1.1 Δεδομένα διαγραμμάτων (ΕΤΟΙΜΑ — read-only)
```
src/subapps/dxf-viewer/bim/structural/analytical/solver/solver-types.ts          ← DiagramStation { xM, axialN, shearY, shearZ, torsion, momentY, momentZ } — V/N ΗΔΗ διαθέσιμα ανά σταθμή
src/subapps/dxf-viewer/bim/structural/analytical/solver/analysis-results-store.ts ← AnalysisResultsStore.get()/subscribe() (low-freq). AnalysisResult {combinations[], envelopeByMember, skippedMemberIds, unstable}
src/subapps/dxf-viewer/bim/structural/analytical/analytical-model-store.ts        ← AnalyticalModelStore (nodes με position{xM,yM,zM} σε ΜΕΤΡΑ, members {iNodeId,jNodeId,memberType,lengthM})
```

### 1.2 Πηγή ΦΟΡΤΙΟΥ για βέλη (Slice 4b-D) — ΕΠΙΒΕΒΑΙΩΜΕΝΗ
```
src/subapps/dxf-viewer/bim/structural/section-context.ts                          ← buildBeamSectionContext(beam).designLineLoadKnM = w_Ed (kN/m UDL, ADR-472) + resolveBeamDesignLoad(params,spanMm). ΑΥΤΗ είναι η πηγή για τα βέλη φορτίου.
src/subapps/dxf-viewer/bim/structural/analytical/solver/load-vector.ts            ← (εναλλακτικά) ο consistent load vector του solver — ΟΧΙ προτιμητέο για display, χρησιμοποίησε designLineLoadKnM
src/subapps/dxf-viewer/bim/structural/loads/member-load-geometry.ts               ← beamEndpointsM(b) (entity→meters) αν χρειαστείς γεωμετρία δοκαριού
grep -rn "appliedLoad\|resolveAppliedMemberLoad\|combineUls" src/subapps/dxf-viewer/bim/structural  ← πώς προκύπτει το φορτίο (G/Q → ULS)
```
- **Προσοχή:** πώς θα πάρει ο overlay τα beam entities του ενεργού ορόφου; → `useLevelsOptional().getLevelScene(currentLevelId)` (ο StructuralDiagramOverlay ΗΔΗ το κάνει για units· επέκτεινε για να διαβάσει τα beams). ΜΗΝ φτιάξεις νέο scene reader.

### 1.3 Πηγή UTILIZATION (Slice 4c) — ΕΠΙΒΕΒΑΙΩΜΕΝΗ (reuse, ΟΧΙ νέος M_Rd engine)
```
src/subapps/dxf-viewer/bim/structural/codes/suggest-reinforcement.ts              ← asRequired (As από M_Ed/N_Ed: asStrengthColumnMm2 κλπ) + asProvided (resolveBarSet count·barAreaMm2). utilization = As_req/As_prov.
src/subapps/dxf-viewer/bim/structural/sizing/member-sizing.ts                      ← member auto-sizing (ADR-475) — δες αν εκθέτει ratio/adequacy
grep -rn "asRequired\|asProvided\|asStrength\|barAreaMm2\|resolveBarSet" src/subapps/dxf-viewer/bim/structural/codes  ← όλα τα σημεία As
grep -rn "reinforcement" src/subapps/dxf-viewer/types/{column-types,beam-types}.ts  ← πού αποθηκεύεται ο παρεχόμενος οπλισμός στο entity (params.reinforcement)
grep -rni "adequa\|utilization\|utilisation\|ratio\|επαρκ\|demand.*capacity" src/subapps/dxf-viewer/bim/structural  ← μήπως ΥΠΑΡΧΕΙ ΗΔΗ per-member adequacy/ratio (αν ναι → reuse, ΜΗΝ ξαναϋπολογίσεις)
src/subapps/dxf-viewer/bim/structural/footing-design/footing-design-checks.ts     ← πρότυπο «design check» (πώς δομούνται οι έλεγχοι αντοχής)
```
- **Στόχος 4c:** per-member `utilizationRatio` (0..>1) από As_req/As_prov, ΧΩΡΙΣ νέο engine. Αν βρεις υπάρχοντα adequacy helper → χρησιμοποίησέ τον.

### 1.4 Πώς χρωματίζεται το ΣΩΜΑ μέλους (Slice 4c overlay — διαφορετικό από καμπύλη)
```
src/subapps/dxf-viewer/components/dxf-layout/HeatLoadOverlay.tsx                   ← ΤΟ ΠΡΟΤΥΠΟ: γεμίζει footprint χώρων με χρώμα (fillSpace + worldToScreen). Mirror του για fill των beam/column footprints ανά utilization.
grep -rn "footprint\|entity-bounds\|getEntityBounds\|vertices" src/subapps/dxf-viewer/bim --include=*.ts | grep -i beam  ← footprint/bounds δοκαριού-κολόνας για το fill
src/subapps/dxf-viewer/bim/config/bim-object-styles.ts + per-entity render-palette  ← structural colour identity (ADR-445) — μην συγκρουστείς
```
- **Απόφαση:** το utilization overlay = ΝΕΟ ADR-040 leaf (mirror HeatLoadOverlay) που βάφει το footprint κάθε μέλους πράσινο/πορτοκαλί/κόκκινο. ΟΧΙ μέσα στον DxfRenderer (κράτα το ως read-only overlay, ADR-040-safe).

### 1.5 Selector M/V/N + toggles (Slice 4b-C, 4c)
```
src/subapps/dxf-viewer/ui/ribbon/components/VisualStyleSelect.tsx                  ← ΠΡΟΤΥΠΟ canonical select (ADR-001 @/components/ui/select) — mirror για τον M/V/N selector
src/subapps/dxf-viewer/ui/ribbon/components/ShowPipeSizingToggle.tsx               ← πρότυπο toggle (utilization on/off)
src/subapps/dxf-viewer/ui/ribbon/data/view-tab-bim-settings.ts + RibbonPanel.tsx  ← registration pattern (widgetId branch)
```

### 1.6 ADR-040 (ΥΠΟΧΡΕΩΤΙΚΗ ΑΝΑΓΝΩΣΗ)
```
docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md     ← ΔΙΑΒΑΣΕ. overlay=leaf· low-freq subscribe ΟΚ· ΜΗΝ subscribe σε orchestrator (CHECK 6C)· δικό του canvas+pointer-events-none.
```
**Pre-commit CHECK 6B/6D:** αγγίζεις canvas αρχεία → **stage ADR-040 ΚΑΙ ADR-483/484** μαζί αλλιώς commit blocked.

---

## 2. ΣΤΟΧΟΣ — Revit/Robot-grade αποφάσεις (ΗΔΗ ΕΓΚΕΚΡΙΜΕΝΕΣ από Giorgio)

### Slice 4b — επεκτείνει ADR-483 (διάγραμμα)
1. **Ζώνες εφελκυσμού/θλίψης (TESE/COMPRESSE):** χώρισε το γέμισμα ροπής στα **zero-crossings**. Θετική ροπή (sagging) → εφελκ. **κάτω ίνα** (θερμό χρώμα, π.χ. κόκκινο) + ετικέτα· αρνητική (hogging) → εφελκ. **άνω ίνα** (ψυχρό, π.χ. μπλε) + ετικέτα. (Η θλιβόμενη = αντίθετη ίνα.) **Calibrate** τη σύμβαση sagging=tension-bottom στο impl (verify με την parabola: midspan κάτω).
2. **Selector Μ / V / N** (canonical `@/components/ui/select`): geometry ΗΔΗ υποστηρίζει `'shear'`/`'axial'`. Χρώματα **Μ κόκκινο / V πράσινο / N μπλε**. Default Μ. `diagramComponent` στο view-store. (Robot-style: ένα κάθε φορά — όχι ταυτόχρονα.)
3. **Βέλη φορτίων:** σειρά βελών προς τα κάτω (UDL) κατά μήκος δοκαριού + ετικέτα `… kN/m`. Πηγή `designLineLoadKnM`. Λεπτή ζώνη πάνω από το δοκάρι. (NEW pure `member-load-arrows.ts`.)
4. **Caution για αστάθεια:** αν `result.unstable` → όλα τα διαγράμματα **αμπέρ διακεκομμένα, χωρίς γέμισμα** (οπτικό «ύποπτα»). (`reliable` flag στο MemberDiagramSet.)

### Slice 4c — NEW ADR-484 (utilization overlay)
5. **Utilization overlay:** ΝΕΟ ADR-040 leaf που βάφει το **footprint κάθε μέλους** (δοκάρι **και** κολόνα — εδώ οι κολόνες ΕΧΟΥΝ νόημα, είναι fill όχι καμπύλη): **πράσινο ≤0,85 / πορτοκαλί 0,85–1,0 / κόκκινο >1,0**. `utilization = As_req/As_prov` (reuse suggest-reinforcement). Δικό του toggle «Επάρκεια/Utilization» (default OFF). Legend.

### ❌ ΕΚΤΟΣ
- solver/engine (read-only)· 3Δ diagrams· σεισμός T4· νέος M_Rd engine (χρησιμοποίησε As_req/As_prov)· καμία επαναφορά kPa (ADR-474).

---

## 3. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ — CLAUDE.md)
- **🚨 ADR-040 ΠΡΩΤΑ.** overlay=leaf, low-freq, δικό του canvas, pointer-events-none. Stage ADR-040 (CHECK 6B/6D).
- **Full Enterprise + Full SSOT, Revit-grade, GOL** + N.7.2 checklist + δήλωση `✅/⚠️/❌ Google-level` στο τέλος.
- **ADR-driven (N.0.1):** PHASE 1 SSoT audit → plan → έγκριση → code → PHASE 3 ADR-483(4b)/ADR-484(4c) + adr-index + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY.
- **N.8:** ~8-12 αρχεία, 1 domain (structural presentation). Plan Mode· αν μεγαλώσει → ενημέρωσε Giorgio.
- **PLAN-FIRST:** παρουσίασε plan, **περίμενε «προχώρα»** πριν κώδικα.
- **commit/tsc = Giorgio.** jest = τρέξε κανονικά. **Shared tree: git add ΜΟΝΟ δικά σου.** **Απάντα Ελληνικά.**

## 4. ΚΑΤΑΣΤΑΣΗ (UNCOMMITTED, verified)
- **Slice 4 (ADR-483):** διάγραμμα Μ στον καμβά — browser-verified από Giorgio (ορατό, zoom-stable model-space, smooth curve, pill τιμής, κολόνες χωρίς διάγραμμα=σωστό). Fixes εφαρμοσμένα: #1 model-space scaling, #2 smooth quad-bezier. 5 jest GREEN. **Ο Giorgio θα κάνει commit.**
- Τα diagram data (`DiagramStation[]` με M/V/N) + ο reinforcement engine (As_req/As_prov) είναι **έτοιμα** — εσύ σχεδιάζεις/χρωματίζεις.

## 5. ΑΡΧΗ ΣΧΕΔΙΑΣΗΣ (Revit way)
Robot/SAP2000/ETABS: diagrams M/V/N (selector) + ζώνες εφελκυσμού/θλίψης + load symbols = **πληροφοριακά**· το «πρόβλημα ναι/όχι» = **utilization coloring** (πράσινο→κόκκινο) σε ξεχωριστό layer. Καθαρός διαχωρισμός: engine (έτοιμος) ↔ presentation (η δουλειά σου). Μηδέν διπλότυπο: reuse geometry/draw Slice 4 + designLineLoadKnM + suggest-reinforcement + HeatLoadOverlay fill pattern + canonical select.
