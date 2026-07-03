# HANDOFF — Καμπύλος τοίχος: Revit-grade «Draw Options Bar» για arc draw-variants

**Ημ/νία:** 2026-07-03
**ADR:** ADR-565 (§11 υλοποίηση Φ1, §12 big-player UX research) · ADR-363 (wall drawing)
**Status:** Φ1 (arc wall, 3-σημείων) IMPLEMENTED **UNCOMMITTED** & GREEN → επόμενο = **Φ1.x options bar**
**Μοντέλο:** Opus (αρχιτεκτονική/cross-cutting, N.14)
**⚠️ COMMIT:** Ο **Giorgio** κάνει commit — **ΕΣΥ ΠΟΤΕ** (N.-1). **Shared working tree με άλλον agent.**

---

## 0. ΤΙ ΝΑ ΚΑΝΕΙΣ ΠΡΩΤΑ (μη το προσπεράσεις)

1. **Διάβασε** `docs/centralized-systems/reference/adrs/ADR-565-curved-circular-structural-bim-elements.md` (ΟΛΟ — §11 = τι υπάρχει ήδη, §12 = big-player απόφαση).
2. **N.8 → Plan Mode** πρώτα (5+ αρχεία, 2 domains: ribbon UI + drawing FSM). ΟΧΙ κώδικας πριν το plan.
3. **ΥΠΟΧΡΕΩΤΙΚΟ SSoT AUDIT (grep) ΠΡΙΝ γράψεις γραμμή** — §3 παρακάτω. Reuse, μη δημιουργείς διπλότυπα.
4. **ΜΗΝ αγγίξεις** αρχεία άλλου agent στο shared tree: `snapping/engines/*`, `hooks/drawing/useColumnTool.ts`, `systems/dimensions/builders/radial-*`, `snapping/shared/snap-visibility.ts`. ΔΕΝ είναι δικά μας.

---

## 1. Ο ΣΤΟΧΟΣ (τι θέλει ο Giorgio)

Revit-grade **«Draw Options Bar»**: όταν το εργαλείο τοίχου είναι σε κατάσταση **καμπύλος (τόξο)**, εμφανίζεται μπάρα επιλογών (contextual, στο ribbon) με **4 arc draw-variants**. Όλα παράγουν το ΙΔΙΟ canonical `WallParams.arc` (DXF bulge) — αλλάζει μόνο ο ΤΡΟΠΟΣ εισαγωγής:

| Variant | Ροή σχεδίασης | Παράγει bulge από |
|---|---|---|
| **3 σημείων** (default — ΥΠΑΡΧΕΙ ΗΔΗ) | αρχή → τέλος → σημείο-στο-τόξο | `bulgeFrom3Points` ✅ έτοιμο |
| **Κέντρο–άκρα** | κέντρο → αρχή(ακτίνα) → τέλος(γωνία) | NEW helper (reuse `arcFromCenterStartEnd`) → bulge |
| **Αρχή–τέλος–ακτίνα** | αρχή → τέλος → πληκτρολόγηση R | `bulgeFromRadius` ✅ έτοιμο (+ dynamic-input R) |
| **Εφαπτομενικό** | συνέχεια εφαπτομενική σε προηγ. τοίχο/τμήμα | NEW (tangent dir του προηγ. → bulge) |

**Big-player practice (ADR-565 §12, ΤΗΡΗΣΕ ΤΟ):** ΕΝΑ εργαλείο με sub-modes σε **on-screen options bar** (Revit Draw gallery / Figma Pen modes), **ΟΧΙ πλήκτρο ανά variant**. Δομικός τοίχος = **κυκλικό τόξο** (ΟΧΙ Bézier — ο Revit δεν έχει καν spline για τοίχους· το Bézier `curveControl` είναι **deprecated**, legacy render μόνο).

---

## 2. ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ ΝΑ ΚΑΝΕΙΣ REUSE (μη ξαναγράψεις)

**Arc/curve math SSoT (μηδέν νέο arc math):**
- `bim/walls/wall-arc-descriptor.ts` — `bulgeFrom3Points(s,m,e)`, **`bulgeFromRadius(s,e,Rmm,side,major?,sceneUnits)`** (ΕΤΟΙΜΟ για «αρχή-τέλος-ακτίνα»!), `arcCurveFromBulge`.
- `bim/geometry/shared/curve-tessellation.ts` — `tessellateArcAxis`, `adaptiveArcSegDeg`.
- `rendering/entities/shared/geometry-arc-utils.ts` — **`arcFromCenterStartEnd`** (για «κέντρο-άκρα»!), `arcFromStartCenterEnd`, `arcFrom3Points`, `arcFromMovedEndpoint`.
- `rendering/entities/shared/geometry-circle-utils.ts` — `circleFrom2PointsAndRadius`, `circleFrom3Points`, `circleFromChordAndSagitta`.
- `rendering/entities/shared/geometry-bulge-utils.ts` — `bulgeApexPoint`/`bulgeFromApexPoint`, `bulgeToArc`, `bulgeToPolyline`.

**Drawing FSM / preview (επέκτεινε, μην ξαναχτίσεις):**
- `hooks/drawing/useWallTool.ts` + `wall-tool-types.ts` — `WallToolState`/`WallToolPhase` (`awaitingStart→awaitingEnd→awaitingCurveControl`). Το 3-σημείων ΤΡΕΧΕΙ. Νέα variants = νέες φάσεις/state στο ΙΔΙΟ FSM.
- `hooks/drawing/use-wall-commit.ts` — `commitCurvedFromState` (3-point→bulge). Πρόσθεσε commit paths ανά variant, ΟΛΑ → `buildWallEntity(...,'curved',...)` με `arc`.
- `bim/walls/wall-preview-store.ts` (`arcEndPoint`) + `use-wall-preview-sync.ts` + `wall-preview-helpers.ts` (`makeWallArcGhost`) — live arc preview. Επέκτεινε για τα νέα variants (π.χ. `arcCenterPoint`, `arcRadiusMm`).
- `hooks/drawing/wall-tool-status-text.ts` + locales `tools.wall.*` — status prompts ανά variant (NEW i18n keys, N.11).
- Dynamic-input για «πληκτρολόγηση R»: `systems/dynamic-input/*`, `length-angle-lock` — reuse για αριθμητική εισαγωγή ακτίνας.

**Ribbon UI (το «options bar» — ΕΔΩ είναι το κύριο νέο):**
- `ui/ribbon/data/structural-tab.ts` — το wall toolBtn (`struct-wall-single`, key 'W'). **Split-button precedent:** «wallsFromGrid» = `splitBtn` + `actionVariant(...)` (Εσωτερικά/Κεντρικά/Εξωτερικά) — ΙΔΙΟ pattern για arc-variants dropdown.
- `ui/ribbon/data/contextual-wall-tab.ts` — contextual tab τοίχου (εμφανίζεται σε context). **Πιθανό σπίτι για την options bar.**
- `ui/ribbon/components/RibbonWall*Widget.tsx` (π.χ. `RibbonWallJoinWidget`, `RibbonWallDimensionWidget`) — pattern για contextual ribbon widget. Μίμησέ το για ένα `RibbonWallArcVariantWidget`.
- `ui/ribbon/hooks/useRibbonWallBridge.ts` — bridge onAction για wall· εδώ συνδέεις το `wall.actions.arcVariant:<variant>`.
- **Precedent «sub-mode μέσα σε εργαλείο»:** το opening tool κάνει door/window μέσω `EventBus.emit('bim:set-opening-kind',{kind})` + `bim:set-wall-kind` για τον τοίχο. Κάνε `bim:set-wall-arc-variant` (νέο event, ΕΝΑ SSoT).

**Keyboard (μην πολλαπλασιάσεις):** το `W→2` μένει ο μόνος curved entry. Τα variants = options bar, ΟΧΙ chords (§12).

---

## 3. SSoT AUDIT — GREP ΠΡΙΝ ΚΩΔΙΚΑ (ΥΠΟΧΡΕΩΤΙΚΟ, Giorgio order)

Τρέξε ΟΛΑ, βρες τι υπάρχει, reuse:

```
# Ribbon options-bar / sub-mode UI precedents
grep -rn "actionVariant\|splitBtn\|RibbonSplitDropdown\|set-opening-kind\|set-wall-kind" src/subapps/dxf-viewer/ui/ribbon
grep -rn "options.?bar\|OptionsBar\|drawMode\|draw-mode\|sub.?mode" src/subapps/dxf-viewer

# Arc-from-center / tangent helpers (μη ξαναγράψεις)
grep -rn "arcFromCenterStartEnd\|tangent\|Tangent\|arcFromMovedEndpoint" src/subapps/dxf-viewer/rendering src/subapps/dxf-viewer/bim
grep -rn "circleFrom2PointsAndRadius\|circleFromChordAndSagitta" src/subapps/dxf-viewer

# Dynamic-input αριθμητικής εισαγωγής (για «πληκτρολόγηση R»)
grep -rn "length-angle-lock\|dynamic-input\|DynamicInput\|applyLengthAngleLock" src/subapps/dxf-viewer

# Wall FSM / preview points να επεκτείνεις (όχι νέα stores)
grep -rn "arcEndPoint\|awaitingCurveControl\|commitCurvedFromState\|makeWallArcGhost" src/subapps/dxf-viewer
```

**Κανόνας:** αν υπάρχει helper → reuse. Αν όχι → φτιάξε ΕΝΑ SSoT (π.χ. `bim/walls/wall-arc-descriptor.ts` για `bulgeFromCenterStartEnd` / `bulgeFromTangent`). ΜΗΝ αντιγράψεις arc math.

---

## 4. ΚΑΤΑΣΤΑΣΗ Φ1 (τι είναι ήδη έτοιμο & UNCOMMITTED — μη το ξανακάνεις)

Arc wall 3-σημείων: πλήρες (draw/preview/commit/2D/3D/BOQ/apex-grip). **1515/1515 jest GREEN** (walls+geometry). Αρχεία Φ1 (δικά μας, για staging από Giorgio):
- **NEW:** `bim/geometry/shared/curve-tessellation.ts`(+test), `bim/walls/wall-arc-descriptor.ts`(+test), `bim/geometry/__tests__/wall-geometry-arc.test.ts`
- **MOD:** `wall-types.ts`, `wall.schemas.ts`, `wall-geometry.ts`, `beam-geometry.ts`, `use-wall-commit.ts`, `wall-preview-store.ts`, `use-wall-preview-sync.ts`, `wall-preview-helpers.ts`, `wall-grips.ts`, `wall-grip-transforms.ts`, `grip-kinds.ts`, `wall-tool-status-text.ts`, `config/tolerance-config.ts`, `config/keyboard-shortcuts.ts`, `hooks/useDxfToolbarShortcuts.ts`, `useWallTool.test.tsx`, `i18n/locales/el|en/dxf-viewer-shell.json`, `ADR-363`, `ADR-565`

> ⚠️ Στο `git status` υπάρχουν ΚΑΙ modified άλλου agent (snapping/engines, useColumnTool, radial-*) — **ΔΕΝ είναι δικά μας**, μην τα stage-άρεις.

---

## 5. CONSTRAINTS / DoD

- **N.-1:** ΟΧΙ commit/push (ο Giorgio). **Shared tree** — άγγιξε ΜΟΝΟ wall/ribbon-arc αρχεία.
- **N.11:** ΟΛΑ τα νέα UI strings → locale keys (el+en), μηδέν hardcoded.
- **N.7.1:** αρχεία ≤500 γρ, functions ≤40. `wall-preview-helpers.ts` ήδη ~435 — πρόσεχε.
- **N.17:** ΟΧΙ `tsc` — μόνο jest (colocated `__tests__`).
- **ADR-040 (CHECK 6B/6D):** αν αγγίξεις render/canvas αρχείο → stage ADR-040. Το options-bar είναι κυρίως ribbon UI (εκτός 6B/6D) — αλλά αν αγγίξεις preview/hover → stage ADR-363.
- **Preview ≡ commit:** κάθε variant ghost = ίδιο `buildWallEntity` με το commit.
- **Verify:** jest (νέα pure helpers ανά variant) + browser (κάθε variant → σωστό τόξο, zoom, 3D, BOQ=arc-length).
- **ADR:** ενημέρωσε ADR-565 §11/§12 + changelog + ADR-363.

---

## 6. ΠΡΟΤΕΙΝΟΜΕΝΗ ΣΕΙΡΑ (μικρά, testable slices)
1. Ribbon options-bar UI (variant selector) + `bim:set-wall-arc-variant` event + FSM state `arcVariant` (default '3-point' = σημερινή συμπεριφορά, μηδέν regression).
2. «Αρχή–τέλος–ακτίνα» (reuse `bulgeFromRadius` + dynamic-input R) — το πιο εύκολο, δείχνει το pattern.
3. «Κέντρο–άκρα» (NEW `bulgeFromCenterStartEnd` reuse `arcFromCenterStartEnd`).
4. «Εφαπτομενικό» (NEW `bulgeFromTangent` — tangent του προηγ. τμήματος).
5. i18n + tests + ADR + browser-verify ανά slice.
