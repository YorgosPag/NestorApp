# HANDOFF — ΣΤΕΓΗ Φ2: straight-skeleton (1-κλικ σύνθετη/τετράρριχτη auto)

**Ημερομηνία:** 2026-06-23 · **Γλώσσα απαντήσεων στον Giorgio: ΕΛΛΗΝΙΚΑ (ΠΑΝΤΑ).**
**Μοντέλο:** Opus (βαρύς γεωμετρικός αλγόριθμος, cross-cutting).
**Working tree: ΜΟΙΡΑΖΕΤΑΙ με άλλον agent → stage ΜΟΝΟ δικές σου γραμμές. COMMIT τον κάνει ο Giorgio (N.(-1)/N.16), ΟΧΙ εσύ.**
**FULL ENTERPRISE + FULL SSOT, όπως/καλύτερα από Revit. ΠΡΙΝ κώδικα → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep cross-domain, §4).**

---

## 0. Πλαίσιο — πρόγραμμα «Στέγη ως ζωντανός οργανισμός» (ADR-417 + ADR-487)

4-φασικό πρόγραμμα που επέλεξε ο Giorgio. **Το Φ1 ΟΛΟΚΛΗΡΩΘΗΚΕ** (αυτή η συνεδρία· βλ. §1). Σειρά λόγω εξαρτήσεων:

| Φ | Τίτλος | Domain | Κατάσταση |
|---|--------|--------|-----------|
| **Φ1** | Per-edge numeric κλίση (ribbon «Κλίση ανά νερό») | roof ribbon | ✅ **DONE (UNCOMMITTED)** |
| **Φ2** | **1-κλικ straight-skeleton** (σύνθετη/concave auto) | roof geometry | 🟡 **ΑΥΤΗ Η ΣΥΝΕΔΡΙΑ** |
| **Φ3** | Drainage organism (ροές + EN 12056-3 λούκια/υδρορροές + auto-plug MEP) | roof + MEP | ⬜ μελλοντική |
| **Φ4** | Φορτία χιονιού/ανέμου ανά νερό (EN 1991-1-3/1-4 → structural organism) | roof + structural | ⬜ μελλοντική |

ADR vision: `docs/centralized-systems/reference/adrs/ADR-487-living-structural-organism-vision.md`.
Κύριος ADR στέγης: `docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md` (διάβασέ τον — §9 changelog έχει ΟΛΟ το ιστορικό Φ1/Φ2a/γείσο).

---

## 1. ΤΙ ΕΓΙΝΕ ΣΤΟ Φ1 (per-edge κλίση) — UNCOMMITTED, ο Giorgio θα κάνει commit

Ribbon panel **«Κλίση ανά νερό»** σε selected στέγη: dropdown «Ακμή» (με compass labels «Ακμή N · Βόρεια/Ανατ./Νότ./Δυτ.») + live cyan highlight στον καμβά + per-edge «ορίζει κλίση;» / «κλίση ακμής» / «προεξοχή ακμής». Το `RoofEdgeSlope[]` model ΥΠΗΡΧΕ ήδη — προστέθηκε μόνο UI/bridge/highlight.

**FULL SSoT reuse:** `roof-slope-units` · `polygon-azimuth-utils` (εξήγαγα ΕΝΑ SSoT `edgeOutwardAzimuthDeg` — delegate ΚΑΙ ο thermal `nearestEdgeOutwardAzimuthDeg`) · `HoverStore` pattern (selection store) · `renderOptions` redraw path · `UI_COLORS_BASE.EDIT_EDGE_HIGHLIGHT` token · υπάρχον `UpdateRoofParamsCommand`.

**3 ΚΡΥΦΑ BUGS που βρέθηκαν+διορθώθηκαν στο browser-verify (ΣΗΜΑΝΤΙΚΑ — μπορεί να σε αφορούν):**
1. **🐛 Η στέγη ΕΞΑΦΑΝΙΖΟΤΑΝ σε reload** — **έλειπε ΕΝΤΕΛΩΣ το Firestore rule `floorplan_roofs`** (`firestore.rules`)· default-deny απέρριπτε ΟΛΑ τα roof writes (μόνο η στέγη, όχι slab/column). FIX: προστέθηκε rule (mirror `floorplan_slabs`). **✅ ΗΔΗ DEPLOYED** (`firebase deploy --only firestore:rules`, 2026-06-22). Indexes ήδη υπήρχαν.
2. **🐛 dropdown «Ακμή» = αριθμητικό πεδίο αντί dropdown** — το `isNumericOptionList` (ribbon-combobox-numeric.ts) κάνει editable numeric input όποιο combobox έχει καθαρά αριθμητικά option values. Τα edge index values «0/1/2» το ενεργοποιούσαν. FIX: `numericInput: { editable: false }` στο select command.
3. **🐛 «Κλίση/Προεξοχή ακμής» απληκτρολόγητα** — κενά options → `isNumericOptionList([])=false` → read-only Select χωρίς στοιχεία. FIX: slope `numericInput:{editable:true,allowDecimal:true,min:0}`, overhang reuse `OVERHANG_MM_OPTIONS`.
   - + dropdown sync: ο bridge τώρα `useSelectedRoofEdge()` subscribe (re-render) + default-select ακμή 0 σε επιλογή στέγης (Revit «πρώτη ακμή»).

**Tests:** `roof-edge-param.test.ts` 16/16 + 46 roof regression + 8 azimuth = GREEN. **Temp debug logs: ΑΦΑΙΡΕΘΗΚΑΝ (commit-ready).**

**🔴 ΕΚΚΡΕΜΟΤΗΤΕΣ Φ1 (πες στον Giorgio):**
- **Browser-verify ονομάτων Β/Α/Ν/Δ** — συμφωνούν με τις πραγματικές πλευρές; Αν ΟΧΙ → μικρό Y-axis fix στο `roofEdgeCompass`/`directionAzimuthDeg` (η convention είναι +Y=Βορράς· ο canvas μπορεί να είναι Y-down). **ΔΕΝ επιβεβαιώθηκε ακόμα.**
- **tsc** (N.17 — full έκανε OOM· targeted ή ts-jest).
- **Commit (Giorgio):** `firestore.rules` + `bim/roofs/{roof-edge-selection-store.ts[NEW], useRoofEdgeSelection.ts[NEW]}` + `bim/renderers/RoofRenderer.ts` + `bim/geometry/shared/polygon-azimuth-utils.ts` + `ui/ribbon/hooks/bridge/{roof-edge-param.ts[NEW], roof-command-keys.ts, __tests__/roof-edge-param.test.ts[NEW]}` + `ui/ribbon/hooks/{useRibbonRoofBridge.ts, useRibbonCommands.ts[HOT — 2 guards]}` + `ui/ribbon/data/contextual-roof-tab.ts` + `canvas-v2/dxf-canvas/dxf-types.ts` + `components/dxf-layout/canvas-layer-stack-leaves.tsx` + `config/color-config.ts` + i18n el+en + ADR-417. ⚠️ CHECK 6B/6D (RoofRenderer + canvas-leaf)→stage ADR-040+ADR-417. ⚠️ shared tree (useRibbonCommands HOT)→stage ΜΟΝΟ δικές σου γραμμές.

Memory: `reference_roof_per_edge_slope_ux.md`.

---

## 2. Ο ΣΤΟΧΟΣ ΤΟΥ Φ2 — straight-skeleton (concave/σύνθετα footprints)

Σήμερα η μηχανή παράγει **flat / mono-pitch / gable** + **hip για ΚΥΡΤΑ (convex) footprints** (ο `solveLowerEnvelope` — N-plane lower envelope, Φ2a 2026-06-05). **ΛΕΙΠΕΙ:** σωστή τετράρριχτη/σύνθετη για **ΜΗ-ΚΥΡΤΑ (concave) footprints** (σχήματα L/T/U) — εκεί το lower-envelope αφήνει λάθος valleys/κενά. Το **straight skeleton** (Aichholzer) είναι η Revit-correct γενίκευση: από footprint + per-edge κλίσεις → πλήρες σύνολο **faces (νερά) + ridges/hips/valleys** για ΟΠΟΙΟΔΗΠΟΤΕ simple polygon.

**Τι θέλει ο Giorgio (Revit «Roof by Footprint» 1-κλικ):** διαλέγω footprint + ομοιόμορφη κλίση → η στέγη «λύνεται» αυτόματα σε σύνθετη τετράρριχτη με σωστά λούκια στις εσωτερικές γωνίες (concave vertices = valleys).

---

## 3. ΠΩΣ ΚΟΥΜΠΩΝΕΙ (τι ΥΠΑΡΧΕΙ — επαλήθευσέ το με grep, §4)

- `bim/geometry/roof-geometry.ts` — `computeRoofGeometry(params)` orchestrator: 0 planes→flat, 1→mono, ≥2→`solveLowerEnvelope`. **ΕΔΩ μπαίνει το skeleton branch** (concave → straight-skeleton αντί lower-envelope). + `applyRoofShapePreset(outline, shape, slope, unit)`.
- `bim/geometry/roof-lower-envelope.ts` — `solveLowerEnvelope` (convex N-plane) + `EavePlane`/`resolveEavePlanes`/`eaveDistance`/`inwardNormal`/`windingSign`/`clipByHalfPlane`/`roofZmm`/`makeFace`. **REUSE ό,τι μπορείς** (plane resolution, z-eval, face building). Το skeleton αντικαθιστά ΜΟΝΟ το «πώς κόβονται τα faces» για concave.
- `bim/geometry/roof-slope-units.ts` — deg↔ratio SSoT (reuse).
- `bim/types/roof-types.ts` — `RoofFace {outline,slopeRatio,projectedAreaM2,grossAreaM2}`, `RoofRidgeLine {a,b,kind:'ridge'|'hip'|'valley'|'eave'}`, `RoofGeometry {faces,ridges,...,shape,ridgeHeightMm}`, `RoofShape='flat'|'mono-pitch'|'gable'|'hip'|'complex'`.
- 2D render: `bim/renderers/RoofRenderer.ts` (faces+ridges+eave· ΗΔΗ καταναλώνει `geometry.ridges` generic → νέα valleys/hips ρέουν αυτόματα). ⚠️ ADR-040 CHECK 6B/6D.
- 3D: `bim-3d/converters/roof-to-three.ts` (per-DNA-layer solids + `addRidgeCaps` rounded caps για ridge+hip· **valley caps;** δες αν χρειάζεται). `roof-ridge-cap.ts`, `roof-eave-detail.ts`.
- Per-edge κλίσεις (Φ1) → το skeleton πρέπει να σέβεται **per-edge `RoofEdgeSlope.slope`** (όχι μόνο uniform· weighted straight skeleton). MVP: uniform πρώτα, μετά per-edge.

---

## 4. ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT — ΓΡΕΠ ΠΡΙΝ ΓΡΑΨΕΙΣ ΟΤΙΔΗΠΟΤΕ (το μάθημα Φ1/Φ5c)

**Ο Giorgio θα ρωτήσει σκληρά: «υπάρχει ήδη; διπλότυπο; θα το έκανε έτσι η Google;». Κάνε ΠΡΑΓΜΑΤΙΚΟ grep cross-domain ΠΡΙΝ:**
1. `grep -ri "straight.skeleton\|medial.axis\|polygon.offset\|polygonOffset\|skeleton\|miter.*offset\|insetPolygon\|offsetPolygon" src/subapps/dxf-viewer/` — μήπως υπάρχει ΗΔΗ offset/skeleton (π.χ. `polygon-dilate.ts`, eave miter `roof-eave-detail.ts` έχει `lineIntersect`/offset-rings, `polygon-utils`).
2. `grep -ri "lineIntersect\|segmentIntersect\|bisector\|angleBisector" src/subapps/dxf-viewer/bim/geometry/` — bisector/intersection helpers (το skeleton τα χρειάζεται· μην ξαναγράψεις).
3. `grep -ri "isPolygonCCW\|polygonArea\|polygonBbox\|pointInPolygon\|convex\|isConvex" src/subapps/dxf-viewer/bim/geometry/shared/` — polygon primitives (reuse `polygon-utils.ts`).
4. Διάβασε ΟΛΟ το `roof-lower-envelope.ts` — πιθανόν να επεκτείνεται/γενικεύεται αντί για νέο αρχείο.
5. **Cross-domain** (όχι μόνο roof): grep σε `bim/finishes/` (silhouette miter — `computeMiteredOuter`), `bim/structural/` (analytical geometry), `rendering/entities/shared/geometry-utils.ts`. Γωνιακά bisectors/offsets ζουν συχνά εκεί.

**Αν βρεις offset/bisector/intersection SSoT → REUSE. Αν όχι → φτιάξε το centralized (όχι roof-private αν είναι generic γεωμετρία).**

---

## 5. ΠΡΟΤΕΙΝΟΜΕΝΟ PLAN Φ2 (μετά το audit — προσαρμόσέ το)

1. **Recognition (Plan Mode, ADR-driven):** διάβασε ADR-417 §9 (Φ2a lower-envelope) + roof-geometry.ts + roof-lower-envelope.ts + roof-types.ts. Κατάλαβε γιατί το lower-envelope αποτυγχάνει σε concave (δες αν υπάρχει ήδη guard/fallback).
2. **NEW `bim/geometry/roof-straight-skeleton.ts`** (pure SSoT· Aichholzer straight skeleton): footprint (CCW) + per-edge inward speed (από κλίση) → skeleton nodes/arcs → faces ανά edge + ridge/hip/valley classification (concave vertex → valley· convex → hip· οριζόντιο μεταξύ ισοϋψών → ridge). Reuse bisector/intersection/winding από §4.
3. **Wire στο `computeRoofGeometry`:** concave footprint (ή `shape==='complex'`/hip με concave) → straight-skeleton· convex → κράτα lower-envelope (ή ενοποίησε αν το skeleton τα καλύπτει ΟΛΑ — προτίμησε ΕΝΑ engine αν είναι robust). `applyRoofShapePreset('hip')` → delegate.
4. **`RoofShape` classification:** concave + hip → `'complex'` (ήδη υπάρχει στο union).
5. **Tests:** `roof-straight-skeleton.test.ts` — L-shape (valley στην εσωτερική γωνία), T/U-shape, convex rect (== lower-envelope parity), triangle (πυραμίδα). + regression `roof-geometry.test.ts`.
6. **3D verify:** valley caps στο `roof-to-three` (αν λείπουν).
7. ADR-417 §9 changelog + ΕΚΚΡΕΜΟΤΗΤΕΣ + adr-index + MEMORY (N.15).

**⚠️ Δύσκολος αλγόριθμος** — βιβλιογραφία: Aichholzer & Aurenhammer «Straight Skeletons for General Polygonal Figures». Ξεκίνα uniform-speed (όλες οι ακμές ίδια κλίση), μετά weighted (per-edge κλίση Φ1).

---

## 6. ΚΑΝΟΝΕΣ (ΠΑΝΤΑ)
- **FULL ENTERPRISE + FULL SSOT, Revit-grade.** ΠΡΑΓΜΑΤΙΚΟ grep audit ΠΡΙΝ κώδικα (§4). Μηδέν διπλότυπα — reuse ή centralize.
- **N.17:** ΕΝΑ tsc τη φορά (έλεγξε process ΠΡΙΝ· full κάνει OOM → targeted + ts-jest).
- **N.(-1)/N.16:** COMMIT/PUSH μόνο ο Giorgio. Shared tree → stage ΜΟΝΟ δικές σου γραμμές.
- **N.11:** i18n el+en πρώτα. **N.2/N.3:** μηδέν `any`/inline styles. **N.7.1:** ≤500 γρ/αρχείο, ≤40 γρ/function.
- **ADR-040:** RoofRenderer/roof-to-three = canvas/3D → CHECK 6B/6D, stage ADR.
- Recognition (Plan Mode) + απάντα τις σκληρές ναι/όχι του Giorgio με grep evidence.
