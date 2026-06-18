# HANDOFF — T3-UI Slice 4: Canvas overlay διαγραμμάτων M/V/N κατά μήκος μελών

**Ημ/νία:** 2026-06-18 · **Από:** Opus session (μόλις ολοκλήρωσε & commit-άρισε ADR-482 T3-UI + ADR-481 solver bugfix) · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά.
**Τύπος:** 🔴 PLAN-FIRST — UI/rendering slice πάνω σε έτοιμα data. **ΜΗΝ γράψεις κώδικα πριν εγκριθεί το plan.**
**Roadmap:** «Δρόμος Α» (ορατότητα πριν τον σεισμό T4). Κλείνει τον κύκλο T3-UI: τα M/V/N φαίνονται ήδη ως **αριθμοί** στα panels (ADR-482)· τώρα φαίνονται ως **διαγράμματα** στον καμβά (όπως Revit→Robot moment/shear diagrams).
Πηγές (αυτοτελείς): `docs/centralized-systems/reference/adrs/ADR-481-static-fem-solver.md` (engine + diagram data) + `ADR-482-static-analysis-ui-surface.md` (το UI surface που επεκτείνεις).

> ⚠️ **Shared working tree** με άλλους agents. **git add ΜΟΝΟ τα δικά σου, ΠΟΤΕ -A.**
> **commit/push = Giorgio. tsc = Giorgio** (N.17 — ένα tsc τη φορά). **jest = τρέχει κανονικά.**
> **Επόμενο ελεύθερο ADR = 483.** **Full Enterprise + Full SSoT + Revit-grade (GOL).**

---

## 0. TL;DR — τι φτιάχνεις

Τα δεδομένα διαγραμμάτων **υπάρχουν ήδη** στο store (ο solver τα παράγει). Λείπει η **οπτικοποίηση στον καμβά**: για κάθε φέρον μέλος (δοκάρι/κολόνα), σχεδίασε το διάγραμμα ροπών (M) — και προαιρετικά τέμνουσας (V)/αξονικής (N) — ως καμπύλη offset κάθετα στον άξονα του μέλους, με κλίμακα ανάλογη της τιμής. Toggle ορατότητας (default OFF). Όπως η Revit/Robot δείχνει τα διαγράμματα πάνω στο μοντέλο.

**🚨 ΚΡΙΣΙΜΟ:** Αυτό το slice ακουμπά τον **ADR-040 performance-critical canvas pipeline**. ΔΙΑΒΑΣΕ ΥΠΟΧΡΕΩΤΙΚΑ `docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md` ΠΡΙΝ γράψεις. Pre-commit CHECK 6B/6D μπλοκάρουν αλλαγές canvas αρχείων χωρίς staged ADR.

---

## 1. 🔴 ΠΡΩΤΟ ΒΗΜΑ — ΥΠΟΧΡΕΩΤΙΚΟ SSOT AUDIT (GREP) ΠΡΙΝ ΓΡΑΨΕΙΣ ΟΤΙΔΗΠΟΤΕ

Παραδοτέο στο plan: πίνακας «reuse vs new». Τρέξε ΟΛΑ + διάβασε ό,τι βρεις.

### 1.1 Τα data που καταναλώνεις (ΕΤΟΙΜΑ — read-only, ΜΗΝ πειράξεις τον solver)
```
src/subapps/dxf-viewer/bim/structural/analytical/solver/solver-types.ts          ← DiagramStation { xM, axialN, shearY, shearZ, torsion, momentY, momentZ } · MemberForceResult { memberId, diagram[] } · CombinationResult { memberForces[] }
src/subapps/dxf-viewer/bim/structural/analytical/solver/analysis-results-store.ts ← AnalysisResultsStore.get()/subscribe() (low-freq)
src/subapps/dxf-viewer/ui/structural-analysis/useEntityAnalysisForces.ts          ← ΤΟ ΠΡΟΤΥΠΟ reader hook (useSyncExternalStore στο store) — mirror-άρισέ το για diagram data
```
- `AnalysisResult.combinations[].memberForces[].diagram` = `DiagramStation[]` (9 σταθμές default, `xM` = απόσταση από άκρο i σε **μέτρα**). `memberId === entityId` (1:1, ADR-480). Διάλεξε συνδυασμό (ULS default) ή envelope.
- **Προσοχή μονάδες:** το `diagram.xM` + οι αναλυτικές θέσεις κόμβων είναι σε **μέτρα**· η 2Δ γεωμετρία entity (beam.startPoint/endPoint, column.position) σε **scene units (mm)**. Θα χρειαστείς mapping (δες §1.4).

### 1.2 ADR-040 canvas architecture (ΥΠΟΧΡΕΩΤΙΚΗ ΑΝΑΓΝΩΣΗ)
```
docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md     ← ΔΙΑΒΑΣΕ ΟΛΟ
src/subapps/dxf-viewer/components/dxf-layout/canvas-layer-stack-leaves.tsx         ← micro-leaves (ΕΔΩ μπαίνει νέο overlay leaf — οι ΜΟΝΟΙ subscribers high-freq stores)
src/subapps/dxf-viewer/components/dxf-layout/CanvasLayerStack.tsx                  ← shell (ΜΗΝ subscribe high-freq)
src/subapps/dxf-viewer/components/dxf-layout/CanvasSection.tsx                     ← orchestrator (ΜΗΝ useSyncExternalStore — CHECK 6C BLOCK)
grep -rn "useTransformValue\|getImmediateTransform" src/subapps/dxf-viewer/components/dxf-layout  ← πώς το leaf διαβάζει transform (world→screen)
```
- **Κανόνας ADR-040:** το overlay = **leaf subscriber**. `AnalysisResultsStore` είναι **low-freq** (γράφεται μόνο στο «Ανάλυση») → ασφαλές subscribe. ΜΗΝ subscribe το store σε orchestrator. Το transform (pan/zoom) διαβάζεται με το leaf pattern (`useTransformValue`), ΟΧΙ snapshot σε orchestrator.

### 1.3 Υπάρχον along-member / overlay rendering (reuse primitives)
```
src/subapps/dxf-viewer/bim/labels/bim-dim-labels.ts                               ← drawing primitives (pills/labels/lines) — πρότυπο για canvas draw helpers
grep -rni "ctx\.\(beginPath\|moveTo\|lineTo\|stroke\)" src/subapps/dxf-viewer/canvas-v2 --include=*.ts | grep -iv test | head  ← πώς σχεδιάζονται polylines στον καμβά
grep -rn "worldToScreen\|toScreen\|applyTransform" src/subapps/dxf-viewer/canvas-v2 src/subapps/dxf-viewer/rendering  ← world(mm)→screen mapping SSoT
grep -rni "overlay\|annotation\|measure" src/subapps/dxf-viewer/canvas-v2/dxf-canvas --include=*.ts | grep -iv test  ← υπάρχοντα overlay passes (π.χ. measurements) ως πρότυπο
```
- **Δεν υπάρχει** moment/shear diagram renderer σήμερα → νέο. Reuse τα draw primitives + το world→screen SSoT, ΜΗΝ εφεύρεις νέο transform.

### 1.4 Mapping analytical member → 2Δ screen polyline (το κρίσιμο σημείο)
```
src/subapps/dxf-viewer/bim/structural/analytical/analytical-model-builder.ts      ← πώς προκύπτουν node positions (μέτρα) ανά member (iNodeId/jNodeId)
src/subapps/dxf-viewer/bim/structural/loads/member-load-geometry.ts               ← beamEndpointsM / columnCenterM (entity→meters) — reuse για να βρεις τον άξονα μέλους
grep -rn "AnalyticalModelStore" src/subapps/dxf-viewer/bim/structural/analytical/analytical-model-store.ts  ← node positions (αν χρειαστείς γεωμετρία μέλους από το μοντέλο, ΟΧΙ από entity)
```
- **Απόφαση plan:** πάρε τον άξονα του μέλους είτε (α) από τα analytical node positions (μέτρα → mm) είτε (β) από την entity γεωμετρία (beamEndpointsM). Το διάγραμμα = polyline με σημεία `axis(xM) + n̂·(value·scale)` όπου `n̂` = κάθετο μοναδιαίο στον άξονα (στο επίπεδο σχεδίασης). Διάλεξε **κλίμακα** ώστε max τιμή → σταθερό pixel offset (auto-fit ανά scene).

### 1.5 Toggle ορατότητας (default OFF) — reuse view-options pattern
```
grep -rn "showReinforcement\|showStructural\|visualStyle" src/subapps/dxf-viewer/ui/ribbon src/subapps/dxf-viewer/state  ← πρότυπο toggle (mirror «Οπλισμός» switch ADR-463)
grep -rni "cadToggleState\|view.*toggle\|F-key" src/subapps/dxf-viewer/systems  ← πού ζουν τα view toggles
```
- Reuse το pattern toggle (π.χ. δίπλα στο «Οπλισμός»/«Στυλ Προβολής»): νέο `showAnalysisDiagrams` (default OFF). Όταν OFF → το leaf δεν σχεδιάζει (no-op, μηδέν cost).

**Παραδοτέο audit (γράψε στο plan):** πίνακας reuse vs new. Boy-Scout (N.0.2) αν βρεις duplicate draw/transform.

---

## 2. ΣΤΟΧΟΣ (scope — τι ΝΑΙ / τι ΟΧΙ)

### ✅ ΕΝΤΟΣ (πρότεινε slicing· μικρά βήματα)
1. **Νέο canvas overlay leaf** που διαβάζει `AnalysisResultsStore` (low-freq) + σχεδιάζει το διάγραμμα **ροπής M** κατά μήκος κάθε μέλους (polyline offset κάθετα, κλίμακα auto-fit, χρώμα ανά τύπο μεγέθους, hatching/γέμισμα προαιρετικό).
2. **Toggle** `showAnalysisDiagrams` (default OFF) — ribbon/view-option. OFF → no-op.
3. *(Προαιρετικά / επόμενο sub-slice)* εναλλαγή **M/V/N** (3 components) + ετικέτες ακραίων τιμών στις σταθμές.
4. i18n keys (N.11 el+en) για το toggle + τυχόν labels.

### ❌ ΕΚΤΟΣ
- Ο solver/engine (`bim/structural/analytical/solver/*`) — read-only, **μην τον πειράξεις**.
- 3Δ diagrams (αν το 2Δ είναι αρκετό για v1· 3Δ = επόμενο).
- Πλήρης φόρτιση/σεισμός (T4) — άλλο slice.
- Τα M/V/N παραμένουν **πληροφοριακά** (ΠΑΡΑΛΛΗΛΑ tributary ADR-467). **ΜΗΝ επαναφέρεις kPa** (ADR-474).

---

## 3. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ — CLAUDE.md)
- **🚨 ADR-040:** ΔΙΑΒΑΣΕ το ADR-040 ΠΡΙΝ· overlay = **leaf subscriber** (ΟΧΙ orchestrator subscribe)· bitmap cache key ΜΗΝ μολυνθεί· stage το ADR-040 αν αγγίξεις τα performance-critical αρχεία (CHECK 6B/6D BLOCK).
- **Full Enterprise + Full SSoT, Revit-grade, GOL.** ≤40 γρ/function, ≤500 γρ/code-file, μηδέν `any`/`as any`/`@ts-ignore`. Μηδέν hardcoded strings (N.11 — i18n el+en). Μηδέν inline styles / div-soup. Select = `@/components/ui/select` (ADR-001).
- **N.7.2 checklist** + δήλωση `✅/⚠️/❌ Google-level` στο τέλος.
- **ADR-driven (N.0.1):** PHASE 1 SSoT audit → plan. PHASE 3: **ADR-483** (canvas diagrams) + adr-index (2 πίνακες) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + MEMORY, ίδιο σύνολο/commit.
- **N.8 execution mode:** αξιολόγησε (πιθανώς Plan Mode — leaf + toggle + draw helper + i18n ≈ 4-6 αρχεία, 1 domain rendering). Αν μεγαλώσει → ενημέρωσε Giorgio.
- **PLAN MODE υποχρεωτικό** — παρουσίασε plan, **περίμενε «προχώρα»** πριν κώδικα.
- **commit/push = Giorgio. tsc = Giorgio** (N.17). **jest = τρέχει κανονικά.**
- **Shared tree:** git add **ΜΟΝΟ** δικά σου, ΠΟΤΕ `-A`. **Απάντα στα Ελληνικά πάντα.**

---

## 4. ΚΑΤΑΣΤΑΣΗ (committed πριν αυτό το slice)
- **ADR-482 (T3-UI):** κουμπί «Ανάλυση» + toast + read-only N/V/M/T readout σε column/beam panels + diagnostics surfacing. **Browser-verified, committed.**
- **ADR-481 (solver) + bugfix:** static FEM solver· διορθώθηκε false-singular (κατώφλι singular → physical stiffness scale). Portal επιλύεται, M/V/N σωστά (επαληθεύτηκε: δοκάρι V = κολόνα N = ισορροπία· M συνεχές στον κόμβο). **Committed.**
- **Engine data έτοιμα:** `MemberForceResult.diagram` (DiagramStation[]) γεμίζει σε κάθε «Ανάλυση» → εσύ απλώς το σχεδιάζεις.

## 5. ΑΡΧΗ ΣΧΕΔΙΑΣΗΣ (Revit way)
Revit/Robot: μετά την ανάλυση, διαγράμματα M/V/N πάνω στο μοντέλο, toggle-able, με κλίμακα & ετικέτες ακραίων. Καθαρός διαχωρισμός engine (έτοιμος) ↔ presentation (canvas overlay = η δουλειά σου). Μηδέν διπλότυπο: reuse store-reader pattern (ADR-482) + draw/transform SSoT + leaf architecture (ADR-040).
