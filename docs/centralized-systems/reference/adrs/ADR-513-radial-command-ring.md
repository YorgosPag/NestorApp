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

## §line-parity — Γενίκευση tool-agnostic + ΓΡΑΜΜΗ (Μήκος / Γωνία / Τύπος γραμμής) — 2026-06-30

**Εντολή Giorgio:** «Μελέτησε ΠΟΛΥ καλά τη δυναμική εισαγωγή του τοίχου και εφάρμοσέ την στις
ΓΡΑΜΜΕΣ» — 3 πεδία: **Μήκος / Γωνία / Τύπος γραμμής** (όχι πάχος/ύψος). UI = **το ΙΔΙΟ Δαχτυλίδι**
(parity, απόφαση Giorgio «FULL PARITY»). Ο «τύπος» = **DXF linetype** → **drop-down** (επιλογή, όχι αριθμός).

**SSoT audit (grep 2026-06-30):** Μήκος/Γωνία της γραμμής **κλείδωναν ήδη** (`applyLengthAngleLock`,
gate `line|wall` στο preview)· ο linetype **είχε ήδη** SSoT (`QuickStyleStore.linetypeName` +
`LinetypeRegistry` + ribbon `useRibbonLineToolBridge`). Έλειπαν μόνο: (α) **γενίκευση** του ring από
wall-specific σε **config-driven**, (β) **κενό commit**: το lock της γραμμής εφαρμοζόταν στο preview
αλλά **όχι στο click-commit** (`onDrawingPoint`) — ο τοίχος το κάνει (`useWallTool:347`), η γραμμή **όχι**.

### Decision (§line-parity)
1. **Tool-agnostic ring (`RingConfig`):** το `RadialCommandRing` οδηγείται πλέον από ένα `RingConfig`
   (`ring-config.ts`) — ποια πεδία, σε ποια **θέση** (`RingWedgePosition`), `seed`/`commitNumeric`/
   `commitSelect`/`isLocked`/`options`. **Ένα** component για τοίχο **και** γραμμή· μηδέν branch ανά εργαλείο.
   - `radial-ring-logic.ts`: NEW `WEDGE_POSITION_ANGLES` + `wedgePositionAtAngle` (position-based)· το παλιό
     wall-keyed `WEDGE_ANGLES`/`wedgeAtAngle` **παράγεται** από αυτά (back-compat, μηδέν διπλότυπο).
   - **Κοινοί builders** `lengthRingField`/`angleRingField` (lock στο ΙΔΙΟ `DynamicInputLockStore`) — reuse
     από τοίχο **και** γραμμή.
   - `wall-ring-config.ts` (Μήκος/Γωνία/**Πάχος/Ύψος**) + `line-ring-config.ts` (Μήκος/Γωνία/**Τύπος**).
2. **Πεδίο `select` (Τύπος):** νέο `kind:'select'` στο `RingFieldDef` → το popup είναι **drop-down λίστα**
   (`<ul role="listbox">`) αντί numeric input· `options()` = ByLayer + live `LinetypeRegistry` (8 ISO + custom)·
   `commitSelect` → `setQuickStyleLinetype` (**ΙΔΙΟ** SSoT με το ribbon dropdown).
3. **Commit lock της γραμμής (preview≡commit):** `onDrawingPoint` εφαρμόζει `applyLengthAngleLock(finalPoint,
   lastRef)` **ΠΡΙΝ** το flush face-snap (`resolveLineCommitPoint`), ΑΚΡΙΒΩΣ όπως το preview
   (`drawing-hover-handler:268` → `updatePreview` → `generateLinePreview`). No-op όταν δεν υπάρχει lock.
4. **Mount:** `DynamicInputSubscriber` δείχνει το ring της γραμμής όταν `activeTool==='line'` & υπάρχει
   1ο σημείο (awaiting 2ο), αλλιώς μένει το DOM overlay (εισαγωγή σημείου αρχής). Ο τοίχος παίρνει
   `config={WALL_RING_CONFIG}`, η γραμμή `config={LINE_RING_CONFIG}`· `startKey` περνά ως prop (re-init).

→ **FULL PARITY**: ίδια μηχανική NavWheel/deadzone/popup· μόνη διαφορά = το πεδίο «Τύπος» είναι drop-down.
**Μηδέν νέο store/parser/lock/overrides μηχανισμός.** 227 jest GREEN (158 dynamic-input + νέα config + ring).

## §grip-parity — ΕΠΕΚΤΑΣΗ ΑΚΡΟΥ ΓΡΑΜΜΗΣ (grip-drag) — 2026-07-05
Giorgio: «το ΙΔΙΟ σύστημα, μία και μοναδική πηγή αλήθειας» και όταν **σέρνω το άκρο μιας γραμμής**.
Χειρονομία = **press-drag (Revit-style)**: πατάς τη λαβή, σέρνεις, πληκτρολογείς Μήκος/Γωνία, **αφήνεις = commit**.

**SSoT audit (grep):** το δαχτυλίδι είναι ήδη tool-agnostic (`RadialCommandRing` + κοινοί builders
`lengthRingField`/`angleRingField` → `DynamicInputLockStore`) και το lock geometry SSoT
(`applyLengthAngleLock`) εφαρμόζεται ήδη σε preview+commit της σχεδίασης. Το grip-drag άκρου
**δεν** χρησιμοποιούσε τίποτα από αυτά. → Reuse, μηδέν fork.

**Δύο decoupled μισά, επικοινωνία ΜΟΝΟ μέσω `DynamicInputLockStore` (όπως η σχεδίαση):**
1. **Γεωμετρία (preview≡commit):** ΕΝΑΣ pure helper `grip-endpoint-lock.ts`
   (`resolveLineEndpointLockedDelta`) — σταθερό άκρο από `getLineGripAlignmentAnchors` +
   `applyLengthAngleLock` → locked delta. Καλείται από **δύο** seams: `useGripGhostPreview` (ghost)
   & `grip-mouseup-handler` (StretchEntityCommand commit). No-op όταν δεν υπάρχει lock → μηδέν regression.
   Στο commit νικά ΚΑΙ το ADR-501 arm-click ΚΑΙ τα ortho/step constraints (ρητή είσοδος = τελική γεωμετρία).
2. **UI (lock-only ring):** νέο thin `grip-linear-ring-config.ts` (Μήκος/Γωνία, ΙΔΙΟΙ builders· ΟΧΙ
   «Τύπος» — αυτό είναι draw-default `QuickStyleStore`, λάθος για επεξεργασία υπάρχουσας γραμμής).
   Το `RadialCommandRing` πήρε prop **`placementMode`**: `'canvas-click'` (default, σχεδίαση — synthetic
   click + mouseup intercept) vs **`'lock-only'`** (grip — ΚΑΝΕΝΑ synthetic click / mouseup intercept·
   input μόνο μέσω heads-up πληκτρολογίου· `onDeactivate` ξεκλειδώνει στο unmount = τέλος drag).
   Mount από το ΙΔΙΟ leaf (`DynamicInputSubscriber`) σε νέο branch, οδηγούμενο από reactive
   `GripDragStore` (νέο low-freq pub/sub `subscribeActiveDragGrip` + predicate `isLineEndpointDragInfo`).

→ **FULL PARITY** στα γεωμετρικά (Μήκος/Γωνία), press-drag Revit-style. Μηδέν νέο store/lock/parser
(μόνο pub/sub στο υπάρχον `GripDragStore` + prop στο υπάρχον ring). Scope: line endpoint· ο helper
γενικεύεται εύκολα σε polyline/wall άκρα. 251 jest GREEN (240 dynamic-input+line + 11 νέα).

### §grip-parity-hotgrip — χειρονομία **click-move-click** = ο ΜΗΧΑΝΙΣΜΟΣ ΤΟΥ ΤΟΙΧΟΥ (2026-07-05, Giorgio)
Το press-drag κρατά το κουμπί πατημένο → οι φέτες **δεν γίνονται κλικ**. Giorgio ρητά: «πανομοιότυπη
λειτουργία με τον **ΤΟΙΧΟ** — χρησιμοποίησε τον κώδικα της Δυναμικής Εισαγωγής του τοίχου που ήδη δουλεύει».
Άρα η επέκταση άκρου χρησιμοποιεί **ΤΟΝ ΙΔΙΟ** `placementMode='canvas-click'` ring με τον τοίχο/γραμμή —
όχι το εύθραυστο `lock-only` (που είχε race στο release). Χειρονομία: ΚΛΙΚ λαβή (αφήνεις) → άκρο ακολουθεί
κέρσορα (κουμπί πάνω) → ΚΛΙΚ φέτα «Μήκος»/«Γωνία» → πληκτρολογείς → **Enter** (κλείδωμα + synthetic canvas
click = commit) **ή** ΚΛΙΚ έξω από τον τροχό = commit στον κέρσορα. Πανομοιότυπο με τον τοίχο.

**Καθρέφτισμα υπαρχόντων, ΜΗΔΕΝ νέο FSM/commit/ring-mode:**
- **FSM:** το endpoint reshape είναι λειτουργικά πανομοιότυπο με το `'corner'` op του `wall-hot-grip-fsm`
  (grabbed grip = anchor, terminal `tracking`). Νέο op **`'endpoint-stretch'`** στο ίδιο FSM
  (`initialHotGripStep`→`tracking`· `advanceHotGripStep` default = terminal). **ΧΩΡΙΣ arm-release**
  (`awaitingFirstRelease=false`): ο canvas-click τροχός μπλοκάρει ΟΛΑ τα inside events (όπως στον τοίχο)
  άρα δεν υπάρχει release να «οπλίσει»· το release του grab-click → `'stay'` (moved=false), το ΠΡΩΤΟ moved
  κλικ (synthetic Enter ή έξω-κλικ) → commit. Καθρέφτης του τοίχου (1ο κλικ = τοποθέτηση, χωρίς hot-grip arm).
- **Είσοδος:** bespoke (το endpoint grip 0/1 δεν έχει kind → απών από `HOT_GRIP_OP_REGISTRY`): νέος pure
  `line-endpoint-hotgrip.ts` (`resolveLineEndpointHotGrip`, mirror `ctrl-endpoint-rotate-copy`) + caller-gate
  `cadToggleState.isDynInputOn()`. Δυναμική Εισαγωγή **OFF** → press-drag (μηδέν regression).
- **Ring:** ΙΔΙΟ `RadialCommandRing` + `placementMode='canvas-click'` (μηδέν αλλαγή στο component — ο ΙΔΙΟΣ
  μηχανισμός του τοίχου: inside events blocked, Enter→`placeAtCursor` synthetic canvas click, έξω-κλικ περνά).
  Mount οδηγείται από `isLineEndpointDragInfo(activeDragGrip)` (gripIndex 0/1, lineGripKind null).
- **Commit:** το synthetic/έξω canvas click κάνει terminal commit του hot-grip· short-circuit στο
  `grip-mouseup-handler` καλεί το **ίδιο** `resolveLineEndpointCommitLock` → το πληκτρολογημένο μήκος/γωνία
  υπερισχύει της θέσης του synthetic click (ΙΔΙΟ idiom με τον τοίχο). No-op/null για corner/move.
- **Preview:** `buildDxfDragPreview` ήδη χειρίζεται `phase==='hotGrip'`· `resolveLineEndpointLockedDelta`
  στο `useGripGhostPreview` τρέχει ήδη ανεξαρτήτως phase → preview≡commit.
- **ESC:** γενικό `ESC_PRIORITY.HOT_GRIP_OP` ακυρώνει κάθε `phase==='hotGrip'` → `resetToIdle` (unmount + unlock).

**🐛 Root-cause fix (εντοπίστηκε με runtime diagnostics, Giorgio browser console):** το `mouseup` πάνω σε φέτα
είχε `target = popup` → ο window-capture interceptor το άφηνε να περάσει (ώστε να δουλεύει το input), ΑΛΛΑ το
popup είναι DOM-παιδί του καμβά/container → το event **ανέβαινε (bubbled)** στον `handleContainerMouseUp` →
έκανε **commit** το hot-grip (terminal) → ο τροχός ξε-mountάρονταν κι έκλεινε το πεδίο στην ΠΡΩΤΗ πληκτρολόγηση
(«κάτι το κατέπινε»). Fix: `onMouseDown/onMouseUp/onClick → e.stopPropagation()` στο popup `<div>` του
`RadialCommandRing`, ώστε η αλληλεπίδραση με το πεδίο να μη φτάνει ΠΟΤΕ στους canvas grip handlers (το input
κρατά focus/keydown/change). Ο τοίχος δεν το εκδήλωνε γιατί δεν κάνει commit σε σκέτο bubbled mouseup.

→ 363 jest GREEN (grips+dynamic-input+line), 0 regression. Το `lock-only` mode μένει στο component αλλά δεν το
χρησιμοποιεί πλέον κανείς (vestigial — υποψήφιο για μελλοντικό cleanup). Parity note: στο live-ghost το
`hotGrip===true` περνά ως `movesWhole` (όπως όλα τα corner hot-grips)· χωρίς lock/ORTHO/Shift = identity = resize.

## Consequences
- **+** Η γενίκευση tool-agnostic άνοιξε δρόμο για δοκάρι/κολώνα/πλάκα = απλώς νέο `RingConfig`.
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

**§line-parity (2026-06-30):**
**NEW:** `systems/dynamic-input/ring-config.ts` (+test), `systems/dynamic-input/wall-ring-config.ts`,
`systems/dynamic-input/line-ring-config.ts` (+test).
**MOD:** `systems/dynamic-input/radial-ring-logic.ts` (position primitives + test),
`systems/dynamic-input/components/RadialCommandRing.tsx` (config-driven + select popup),
`components/dxf-layout/DynamicInputSubscriber.tsx` (line branch + config/startKey props),
`hooks/drawing/useDrawingHandlers.ts` (commit lock της γραμμής), `bim/walls/wall-preview-store.ts`
(public `subscribe`), `bim-3d/viewport/DynamicInput3DLeaf.tsx` (config/startKey props),
`systems/constraints/cad-toggle-state.ts` + `hooks/common/useCadToggles.ts` (Dyn shared-store bugfix),
`i18n/locales/{el,en}/dxf-viewer-shell.json` (`tools.ring.*`).

**§grip-parity (2026-07-05):**
**NEW:** `systems/dynamic-input/grip-endpoint-lock.ts` (+test), `systems/dynamic-input/grip-linear-ring-config.ts` (+test).
**MOD:** `systems/dynamic-input/components/RadialCommandRing.tsx` (`placementMode` + `onDeactivate`),
`components/dxf-layout/DynamicInputSubscriber.tsx` (grip-endpoint branch), `systems/cursor/GripDragStore.ts`
(low-freq pub/sub `subscribeActiveDragGrip` + `isLineEndpointDragInfo`), `hooks/tools/useGripGhostPreview.ts`
(ghost lock seam), `hooks/grips/grip-mouseup-handler.ts` (commit lock seam + arm/constraint bypass),
`i18n/locales/{el,en}/dxf-viewer-shell.json` (`tools.ring.endpointLabel`).
**STAGE:** ADR-040 (CHECK 6B/6D — DynamicInputSubscriber leaf + cursor store touch).

**§grip-parity-hotgrip (2026-07-05):**
**NEW:** `hooks/grips/line-endpoint-hotgrip.ts` (+test — `resolveLineEndpointHotGrip` entry resolver).
**MOD:** `hooks/grips/wall-hot-grip-fsm.ts` (op `'endpoint-stretch'` + `initialHotGripStep`),
`hooks/grips/grip-mouse-handlers.ts` (bespoke hot-grip entry, `awaitingFirstRelease=false`, gate
`cadToggleState.isDynInputOn()`), `hooks/grips/grip-mouseup-handler.ts` (hot-grip commit lock + POLAR
parity mirror), `hooks/grips/__tests__/wall-hot-grip-fsm.test.ts` (endpoint-stretch cases),
`components/dxf-layout/DynamicInputSubscriber.tsx` (grip ring → `placementMode='canvas-click'` = ο ΙΔΙΟΣ
μηχανισμός του τοίχου), `systems/dynamic-input/components/RadialCommandRing.tsx` (🐛 popup `<div>`
`stopPropagation` — κόβει το bubbling του popup mouseup στους canvas grip handlers).
**STAGE:** ADR-513 (this doc). 363 jest GREEN.

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
- **2026-06-30 (§line-parity)** — Γενίκευση tool-agnostic (`RingConfig`) + **ΓΡΑΜΜΗ** (Μήκος/Γωνία/**Τύπος
  γραμμής** drop-down). NEW `ring-config.ts` (κοινοί builders Μήκους/Γωνίας + `combineSubscribers`) +
  `wall-ring-config.ts` + `line-ring-config.ts`· `radial-ring-logic.ts` NEW `WEDGE_POSITION_ANGLES`/
  `wedgePositionAtAngle` (το wall-keyed `WEDGE_ANGLES` παράγεται από αυτά)· `RadialCommandRing` → config-driven
  + `kind:'select'` popup (drop-down linetype). **Commit lock της γραμμής** στο `onDrawingPoint` (ΠΡΙΝ το flush
  face-snap, mirror preview) → preview≡commit. Τύπος = ΙΔΙΟ `QuickStyleStore` SSoT με το ribbon. 227 jest GREEN.
- **2026-07-05 (§grip-parity)** — Το ΙΔΙΟ δαχτυλίδι στην **ΕΠΕΚΤΑΣΗ ΑΚΡΟΥ ΓΡΑΜΜΗΣ** (press-drag Revit-style,
  lock-only). NEW `grip-endpoint-lock.ts` (`resolveLineEndpointLockedDelta` — ΕΝΑΣ SSoT helper preview≡commit
  πάνω στο `applyLengthAngleLock` + `getLineGripAlignmentAnchors`) + `grip-linear-ring-config.ts` (Μήκος/Γωνία,
  κοινοί builders, ΟΧΙ «Τύπος»). `RadialCommandRing` NEW prop `placementMode='lock-only'` (μηδέν synthetic
  click / mouseup intercept) + `onDeactivate` (unlock στο unmount). `GripDragStore` NEW low-freq pub/sub
  (`subscribeActiveDragGrip`) + predicate `isLineEndpointDragInfo`. Seams: `useGripGhostPreview` (ghost) +
  `grip-mouseup-handler` (commit· νικά arm-click + ortho/step). Μηδέν νέο store/lock/fork. 251 jest GREEN.
  🔴 ΕΚΚΡΕΜΕΙ: browser-verify + commit (Giorgio). Shared tree με agent ADR-508 §line-hud (μόνο τα δικά μου αρχεία).
- **2026-07-05 (§grip-parity-hotgrip)** — Giorgio ρητά: «πανομοιότυπη λειτουργία με τον ΤΟΙΧΟ — χρησιμοποίησε
  τον κώδικα Δυναμικής Εισαγωγής του τοίχου». Η χειρονομία της ΕΠΕΚΤΑΣΗΣ ΑΚΡΟΥ άλλαξε **press-drag →
  click-move-click** (AutoCAD hot-grip) όταν Δυναμική Εισαγωγή ON, με τον **ΙΔΙΟ `placementMode='canvas-click'`
  ring** του τοίχου/γραμμής (ΟΧΙ το εύθραυστο lock-only). ΜΗΔΕΝ νέο FSM/commit/ring-mode: νέο op
  `'endpoint-stretch'` στο κοινό `wall-hot-grip-fsm` (καθρέφτης του `'corner'`, terminal `tracking`, **χωρίς
  arm** — `awaitingFirstRelease=false`, όπως ο τοίχος)· bespoke entry via νέο pure `line-endpoint-hotgrip.ts`
  (mirror `ctrl-endpoint-rotate-copy`) + gate `cadToggleState.isDynInputOn()` (OFF → press-drag, μηδέν
  regression). Commit = synthetic canvas click (Enter) ή έξω-κλικ → hot-grip terminal → `resolveLineEndpointCommitLock`
  (+ POLAR parity mirror). 🐛 Root-cause (runtime diagnostics στον browser): το mouseup της φέτας είχε
  `target=popup` → περνούσε τον interceptor αλλά **bubbled** στον `handleContainerMouseUp` → commit → έκλεινε
  το πεδίο στην 1η πληκτρολόγηση («κάτι το κατέπινε»). Fix: `stopPropagation` στο popup `<div>` του
  `RadialCommandRing`. Το lock-only mode έμεινε vestigial. 363 jest GREEN. 🔴 ΕΚΚΡΕΜΕΙ: browser-verify + commit.
- **2026-06-30 (§line-parity — SSoT audit follow-up, Giorgio)** — Εντοπίστηκε & διορθώθηκε διπλότυπο
  που είχα φτιάξει: η απαρίθμηση «ByLayer + registry linetypes» υπήρχε ΗΔΗ στο ribbon
  (`useRibbonLineToolBridge.buildLinetypeOptions`) και την ξανάγραψα στο `line-ring-config`. **FIX:** NEW
  SSoT `listSelectableLinetypeNames()` + `BYLAYER_LINETYPE` στο `LinetypeRegistry`· **και** το ribbon **και**
  το radial-ring το χρησιμοποιούν (καθένα maps στη δική του option-shape). Επίσης NEW `ringStartKey()`
  (ring-config) → ενοποίησε το `${x},${y}` re-init idiom στους 3 caller (2D τοίχος/γραμμή + 3D). +2 jest.
  (Boy-Scout flag: το inline `unsubs.forEach(u=>u())` υπάρχει σε ~5 hooks σε ΔΙΑΦΟΡΕΤΙΚΟ shape από το
  `combineSubscribers` — δεν είναι καθαρό reuse target· → pending, όχι τώρα.)
- **2026-06-30 (§line-parity — always-on)** — Giorgio: «πριν το 1ο κλικ εμφανίζεται το ΠΑΛΙΟ (DOM
  overlay)· θέλω ΠΑΝΤΑ το δαχτυλίδι — το παλιό καταργείται για τη γραμμή». `DynamicInputSubscriber`:
  η γραμμή πλέον επιστρέφει **πάντα** `RadialCommandRing` (αφαιρέθηκε το `tempPoints.length>=1` gate)·
  πριν το 1ο κλικ → `startKey='line-pending'` (ring χωρίς anchor)· μετά → anchor. Κλικ ΕΞΩ από τον
  τροχό τοποθετεί σημείο (αρχή & τέλος, ίδιο idiom με τον τοίχο)· δεν πέφτει ΠΟΤΕ στο DOM
  `DynamicInputSystem` όταν tool='line'. (Τα άλλα εργαλεία κρατούν προς το παρόν το DOM overlay.)
- **2026-06-30 (bugfix — Dyn toggle multi-instance)** — Giorgio: «το toggle Δυναμική Εισαγωγή δεν
  ενεργοποιείται». Root: το `dynInput` (αντίθετα με ortho/polar) ΔΕΝ ήταν στο shared `cadToggleState` →
  το κουμπί (instance `CadStatusBar`) πρασίνιζε αλλά ο consumer (instance `DynamicInputSubscriber`) δεν το
  έβλεπε (μόνο μέσω Firestore echo, που δεν προλαβαίνει/δεν υπάρχει unauthenticated). Λανθάνον bug που
  αποκαλύφθηκε από το default-OFF (2026-05-27). FIX (ΙΔΙΟ pattern ortho/polar): `cadToggleState` NEW
  `setDynInput`/`isDynInputOn`· `useCadToggles` διαβάζει μέσω `useSyncExternalStore`, writers push sync +
  Firestore hydration. `cad-toggle-state.ts`, `useCadToggles.ts` (+2 jest, 9/9 GREEN). 🔴 browser-verify.
- **2026-07-05 (§direct-distance-entry + beam-parity)** — AutoCAD «direct distance entry» (heads-up) +
  **Enter τοποθετεί σημείο** + **parity δοκού** (orchestrator: 2 παράλληλοι subagents ring/beam, disjoint files).
  **(1) Heads-up** (`RadialCommandRing`): με το δαχτυλίδι ενεργό & κανένα popup ανοιχτό, ένα ψηφίο/`.`/`,`/`-`
  ανοίγει **αυτόματα** το «Μήκος» seeded με το πλήκτρο (NEW pure `isHeadsUpNumericKey` + `isEditableTarget`
  guard) — δεν χρειάζεται πια κλικ στο wedge. Tab: Μήκος→Γωνία (κλειδώνει μήκος χωρίς τοποθέτηση).
  **(2) Enter → place** (tool-agnostic): numeric-popup Enter → lock + NEW `placeAtCursor` = synthetic
  `mousedown→mouseup` (button 0) στον καμβά στις client συντεταγμένες κέρσορα → το ενεργό εργαλείο τοποθετεί
  το endpoint μέσω του ΚΑΝΟΝΙΚΟΥ click pipeline (`mouse-handler-up`), με `applyLengthAngleLock` να περιορίζει
  (preview≡commit)· `placingRef` bypass στον window interceptor. Το **Μήκος = one-shot** (NEW
  `RingFieldDef.clearOnPlace` → `unlockLength` μετά την τοποθέτηση· η Γωνία επιμένει, polar-like). ⚠️ behavior
  change: το wedge-Enter πλέον ΚΑΙ τοποθετεί (πριν μόνο κλείδωνε) — AutoCAD-consistent.
  **(3) Δοκός parity**: NEW `beam-ring-config.ts` (Μήκος/Γωνία κοινοί builders + Πλάτος/Ύψος overrides μέσω
  `beamToolBridgeStore.setParamOverrides`)· `isBeamAwaitingEnd` gate (`beam-preview-store`) + mount στο
  `DynamicInputSubscriber`· `applyLengthAngleLock` σε beam preview (`drawing-hover-handler` +`'beam'`·
  `beam-preview-helpers` skip face-snap όταν `isLengthAngleLockActive`) & commit (`useBeamTool` awaitingEnd,
  precedence mirror τοίχου). Κόμμα/τελεία/math = reuse `evalExpr` (μηδέν νέος parser). Γραμμή+Τοίχος (2D+3D)
  κληρονομούν heads-up αυτόματα (shared component). jest: ring 180/180, beam 30/30 + 504 hooks/beams GREEN.
  tsc SKIP (N.17). CHECK 6D (preview handler) → co-staged ADR-040/ADR-363. ⚠️ 3D beam ring εκτός scope
  (`DynamicInput3DLeaf` = wall-only). 🔴 browser-verify (Γραμμή → 1ο κλικ → σταθεροποίηση → `2,5` → Enter →
  σημείο στα 2,5m κατά κέρσορα· parity τοίχος+δοκός) + commit (Giorgio).
