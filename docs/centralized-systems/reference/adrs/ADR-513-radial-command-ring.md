# ADR-513 — «Δαχτυλίδι Εντολών» (Radial Command Ring) — in-canvas dynamic input στη σχεδίαση τοίχου

**Status:** Accepted (uncommitted) — 2026-06-22
**Owners:** DXF Viewer / Dynamic Input · BIM drawing tools (τοίχος)
**Related:** ADR-357 (Dynamic Input system — η πηγή των πεδίων/lock), ADR-508 (wall ghost / §wall-hud / §opening-conflict), ADR-040 (overlay micro-leaf performance), ADR-363 (BIM wall FSM)

---

## Context

Ο Giorgio ζήτησε: κατά τη σχεδίαση τοίχου να εμφανίζεται **κοντά στον κέρσορα** ένα ραδιακό
«δαχτυλίδι εντολών» (αισθητική σαν τον κύκλο/NavWheel της AutoCAD — **ΟΧΙ** η navigation
λειτουργία του) πάνω στο οποίο ο χρήστης πληκτρολογεί **άμεσα, χωρίς ribbon**, Μήκος / Γωνία /
Πάχος / Ύψος. TAB = επόμενο πεδίο, πληκτρολόγηση + Enter = κλείδωμα/εφαρμογή, ESC = κλείσιμο.

Το feature «πληκτρολογώ τιμές ενώ σχεδιάζω» = **Dynamic Input** και **υπάρχει ήδη** (ADR-357,
γραμμικό overlay). Άρα το ζητούμενο = **ραδιακή παραλλαγή** που reuse-άρει ΟΛΗ την υποδομή —
**μηδέν νέο input/parser/lock/overrides store** (εντολή Giorgio: FULL SSoT).

## Κεντρική παρατήρηση (SSoT audit, grep 2026-06-22)

Όλη η μηχανική υπήρχε ήδη — έλειπε μόνο **ραδιακό UI** και η **επέκταση του lock στον τοίχο**:

| Ανάγκη | Υπάρχον SSoT (reuse) |
|--------|----------------------|
| Πεδίο input (focus/parse/validation) | `DynamicInputField` (`'length' \| 'angle'`) |
| Math στην είσοδο (`1500+300`) | `evalExpr` (`numeric-expression.ts`) |
| Κλείδωμα μήκους/γωνίας | `DynamicInputLockStore` (`lockLength`/`lockAngle`) |
| Writer πάχους/ύψους | `wallToolBridgeStore.setParamOverrides` → `wallPreviewStore.overrides` |
| Live μήκος/γωνία (ίδιος υπολογισμός) | mirror `useDynamicInputRealtime` / `buildWallHudMeta` |
| Mount (gated leaf, ADR-040) | `DynamicInputSubscriber` |

**Κενό #1:** το length/angle lock constraint (ADR-357 Φ13 G14) εφαρμοζόταν **μόνο στο preview** και
**μόνο για `activeTool==='line'`**. Για WYSIWYG στον τοίχο χρειαζόταν (α) επέκταση σε `'wall'` και
(β) εφαρμογή **και στο click-commit** (αλλιώς το κλικ commit-άρει μη-περιορισμένο σημείο).

**Κενό #2:** δεν υπήρχε radial/pie/marking-menu component (νέο UI).

## Decision

### 1. SSoT lock helper (νέο, εξαγωγή) — `systems/dynamic-input/length-angle-lock.ts`
`applyLengthAngleLock(point, ref)`: pure, διαβάζει `DynamicInputLockStore`, no-op όταν δεν υπάρχει
lock. **Ένας** owner του περιορισμού, που χρησιμοποιούν **και** το preview **και** το commit:
- `drawing-hover-handler.ts` — αντικατέστησε το inline block· gate επεκτάθηκε `line | wall`.
- `useWallTool.ts` (awaitingEnd commit) — `commitStraightFromState(s, applyLengthAngleLock(point, s.startPoint))`.

→ **preview ≡ committed** (μηδέν regression όταν το ring δεν χρησιμοποιείται: no-op).

### 2. NavWheel UI με deadzone «δάχτυλο-σε-δαχτυλίδι» — `RadialCommandRing.tsx`
**Πιστή μηχανική του AutoCAD NavWheel** (απόφαση Giorgio, μετά από λεπτομερή περιγραφή):
- **Δύο ομόκεντροι κύκλοι:** εσωτερικός **ορατός** (`RING_INNER_R`, 4 πλήρεις pie-wedges **ΧΩΡΙΣ hub**,
  labels πάνω) + εξωτερικός **αόρατος** (`RING_OUTER_R`, deadzone). Ο κέρσορας κινείται **ελεύθερα** μέσα·
  το δαχτυλίδι **ΔΕΝ** ακολουθεί — σπρώχνεται ΜΟΝΟ όταν ο κέρσορας φτάσει στην περιφέρεια του εξωτερικού
  (`pushWheelCenter`: ο κέρσορας «κολλάει» στο `rOuter` και σύρει το κέντρο).
- **Ζώνες (`cursorZone`):** `inside` (≤rInner) → πλήκτρα **ορατά**, hover **φωτίζει** (`RING_OPACITY` 0.28
  → `RING_HOVER_OPACITY` 0.55) + cursor **βελάκι** (`CURSOR.DEFAULT`)· `annulus` (rInner..rOuter) → πλήκτρα
  **κρυφά** (δεν σπρώχνεται)· `outside` → push.
- **Διάταξη wedges:** Μήκος (πάνω 270°) · Γωνία (δεξιά 0°) · Πάχος (αριστερά 180°) · Ύψος (κάτω 90°)
  (`wedgeAtAngle` hit-test + `pieSectorPath` full sector).
- **Editing on-click (ΟΧΙ συνεχώς ορατά πεδία):** κλικ σε wedge → ανοίγει **μικρό διακριτικό input** (64px)
  → type+Enter → commit (Μήκος/Γωνία → `DynamicInputLockStore`· Πάχος/Ύψος → `setParamOverrides`) → κλείνει.
  Esc = close popup. Seed: Πάχος/Ύψος από overrides· Μήκος/Γωνία κενό (ο χρήστης τυπώνει ακριβή τιμή).
- **Commit τοίχου:** όλο το wheel = `pointer-events-none` εκτός από τα wedge-paths (`pointer-events-auto`)·
  το annulus/έξω **δεν έχει DOM** → το κλικ εκεί (2ο κλικ) περνά στον καμβά = commit.
- **Trigger** (απόφαση Giorgio): το wheel **παραμένει** όσο ο τοίχος είναι σε awaitingEnd.
- Pure γεωμετρία/deadzone εκτός React → `radial-ring-logic.ts` (`RING_INNER_R`/`RING_OUTER_R`/`RING_OPACITY`/
  `RING_HOVER_OPACITY`/`WEDGE_ANGLES`/`polarPoint`/`pieSectorPath`/`wedgeAtAngle`/`cursorZone`/`pushWheelCenter`
  + units) — fully unit-testable. Όλα tunable με μία σταθερά.

### 3. Mount (ADR-040) — `DynamicInputSubscriber.tsx` + `CanvasLayerStack.tsx`
Isolated micro-leaf: όταν `activeTool==='wall'` & `dynInput.on` & wall σε **awaitingEnd**
(`startPoint && !endPoint`, low-freq `useWallPreview`) → render `RadialCommandRing` **αντί** του
γραμμικού overlay (μηδέν διπλό UI). `getSceneUnits` getter (draw-time, mirror slabOpening ghost).

### 4. i18n (N.11) — `dxf-viewer-shell.json` (el+en)
`tools.wall.{ringLabel,ringLength,ringAngle,ringThickness,ringHeight}`.

## Consequences
- **+** Revit/AutoCAD-grade in-canvas editing του τοίχου, μηδέν διπλότυπο (lock/parser/overrides reuse).
- **+** Το lock constraint έγινε επιτέλους WYSIWYG (preview≡commit) και επεκτάσιμο σε άλλα 2-click μέλη.
- **−** Ο τοίχος είναι το 1ο target· δοκάρι/κολώνα/πλάκα = μελλοντικό (το ring UI είναι entity-aware
  μόνο στο commit-wiring → εύκολη γενίκευση).

## Files
**NEW:** `systems/dynamic-input/length-angle-lock.ts` (+test), `systems/dynamic-input/radial-ring-logic.ts`
(+test), `systems/dynamic-input/components/RadialCommandRing.tsx`, `systems/cursor/CrosshairSuppressionStore.ts`.
**MOD:** `hooks/drawing/drawing-hover-handler.ts`, `hooks/drawing/useWallTool.ts`,
`components/dxf-layout/DynamicInputSubscriber.tsx`, `components/dxf-layout/CanvasLayerStack.tsx`,
`canvas-v2/overlays/CrosshairOverlay.tsx`, `i18n/locales/{el,en}/dxf-viewer-shell.json`.
**STAGE:** ADR-040 (CHECK 6B/6D — overlay/leaf/CrosshairOverlay/cursor store).

## Sources (μελέτη AutoCAD NavWheel)
- About SteeringWheels — https://help.autodesk.com/cloudhelp/2020/ENU/AutoCAD-Core/files/GUID-0345448F-5C16-4566-90A7-A6D33A70F67F.htm
- SteeringWheels Settings Dialog — https://help.autodesk.com/cloudhelp/2019/ENU/AutoCAD-Core/files/GUID-D613FA7A-160C-475F-A83E-B788720C44D0.htm
- System vars `NAVSWHEELSIZEBIG` (default 1=Normal) · `NAVSWHEELOPACITYBIG` (default 50) · sizes Small 64 / Normal 128 / Large 256 px.

## Changelog
- **2026-06-22** — Αρχική υλοποίηση: **cross of 4 fields** (uncommitted).
- **2026-06-22 (redesign #1)** — wheel cursor-centered + annular wedges + hub, keyboard editing (απορρίφθηκε).
- **2026-06-22 (tweaks)** — (1) **Κρύψε το σταυρόνημα** όταν ο κέρσορας είναι πάνω στα πλήκτρα (zone inside):
  NEW `systems/cursor/CrosshairSuppressionStore.ts` (zero-React flag)· ο ring το γράφει, ο `CrosshairOverlay`
  το διαβάζει στο `applyTransform` + subscribe re-apply. (2) **Half-speed follow** όταν ο κέρσορας κινείται
  inside (Giorgio: «ταχύτητα 1 → δαχτυλίδι 1/2»): NEW `advanceWheelCenter` + `RING_INSIDE_FOLLOW_RATIO=0.5`
  (inside → 0.5×delta· annulus → ακίνητο· outside → push). 50 jest GREEN.
- **2026-06-22 (redesign #2)** — Μετά από λεπτομερή περιγραφή Giorgio: **deadzone «δάχτυλο-σε-δαχτυλίδι»**
  — 2 ομόκεντροι κύκλοι (εσωτ. ορατός + εξωτ. αόρατος), wheel ΔΕΝ ακολουθεί τον κέρσορα (push μόνο στο
  εξωτερικό όριο), **πλήρεις pie-wedges ΧΩΡΙΣ hub** + labels, hover→φωτίζει+βελάκι, annulus→κρυφά, **editing
  on-click με μικρό διακριτικό popup** (όχι συνεχώς ορατά πεδία), πιο διαφανή (0.28). tsc clean· 46 jest GREEN
  (deadzone push + cursor zones + cardinal wedges + pie-sector path). 🔴 ΕΚΚΡΕΜΕΙ: browser-verify + commit (Giorgio).
  DEFER: tune μεγέθη/διαφάνεια στον browser· length/angle popup seed από το ζωντανό HUD· επέκταση σε δοκάρι/κολώνα/πλάκα.
