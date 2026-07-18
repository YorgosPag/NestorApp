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
**SSoT centralization (Giorgio order — μηδέν διπλότυπα):** `grip-mouse-handlers.ts` NEW `beginHotGripSession(grip,
ctx, cfg)` = ΕΝΑΣ SSoT για το enter-hot-grip boilerplate (reset refs + phase + warm-clear), αντικαθιστά **3
πανομοιότυπα inline αντίγραφα** (registry-enter + Ctrl-endpoint + endpoint-stretch)· διόρθωσε ΚΑΙ ένα latent bug
(το copy-paste του endpoint-stretch είχε ξεχάσει το `BimRotateHotGripStore.clear()`). `grip-mouseup-handler.ts`
NEW `resolveEndpointCommitDelta` (lock ?? polar, ΙΔΙΑ προτεραιότητα) + `commitEndpointReshapeDelta` =
αντικαθιστούν **4 πανομοιότυπα** commit-and-reset short-circuits (press-drag + hot-grip × lock/polar).
**STAGE:** ADR-513 (this doc). 363 jest GREEN.

**§equal-slices (2026-07-06):** Giorgio: «το δαχτυλίδι να χωρίζεται σε ΤΟΣΕΣ ίσες φέτες όσες οι εντολές —
2→ημικύκλια, 3→3 ίσες φέτες». Η γεωμετρία των wedges έγινε **δυναμική & count-driven** (μηδέν σταθερή cardinal
θέση). ΕΝΑΣ SSoT στο `radial-ring-logic.ts`: `computeRingSlices(count)` (N ίσες φέτες, index 0 κεντραρισμένη
πάνω, δεξιόστροφα) + `sliceIndexAtAngle(deg, count)` (αντίστροφο). Το `RingFieldDef.position` (cardinal)
**καταργήθηκε** — η ΣΕΙΡΑ στο `RingConfig.fields` ορίζει τη φέτα. Αποτέλεσμα: τοίχος/δοκός (4)→cardinal (ίδια
όψη), γραμμή (3)→3×120°, grip endpoint (2)→2 ημικύκλια.
**MOD:** `systems/dynamic-input/radial-ring-logic.ts` (NEW `computeRingSlices`/`sliceIndexAtAngle`/`RING_TOP_DEG`·
αφαιρέθηκαν `WEDGE_POSITION_ANGLES`/`wedgePositionAtAngle`/`WEDGE_ANGLES`/`wedgeAtAngle`/`RingWedgePosition`),
`systems/dynamic-input/components/RadialCommandRing.tsx` (slices αντί fieldByPosition· hover/openWedge/anchor by index),
`ring-config.ts` (−`position` από `RingFieldDef`), `wall-/beam-/line-/grip-linear-ring-config.ts` (−`position`,
σειρά=φέτα), + 5 test αρχεία (radial-ring-logic + 4 config). 182 dynamic-input jest GREEN.

## §multi-field-lock — κλείδωμα ΠΟΛΛΩΝ πεδίων ΠΡΙΝ το commit (2026-07-06, Giorgio)
Giorgio: «θέλω να κλειδώνω ΠΟΛΛΑ πεδία ταυτόχρονα (Μήκος + Γωνία, ή Μήκος + Πάχος + Ύψος) ΠΡΙΝ οριστικοποιηθεί
η εντολή· σήμερα μόλις βάλω Μήκος + Enter γίνεται commit αμέσως, κι αν ανοίξω άλλο πεδίο χάνεται η προηγούμενη
τιμή». **Big-player parity (AutoCAD Dynamic Input / Revit temporary dimensions / Figma / Cinema-4D — συγκλίνουν):
`Tab` = κλείδωσε το τρέχον πεδίο + πήγαινε στο επόμενο ΧΩΡΙΣ commit· `Enter` = οριστικοποίησε ΟΛΑ μαζί.**

**SSoT audit (grep 2026-07-06):** ο μηχανισμός multi-lock ΥΠΗΡΧΕ ΗΔΗ — `DynamicInputLockStore` (dual
INDEPENDENT length+angle locks), `applyLengthAngleLock` (εφαρμόζει ΚΑΙ τα δύο, preview≡commit), `nextRingField`
(σειρά Tab). Το κενό ήταν καθαρά **UX-wiring** στο `RadialCommandRing.tsx`: (α) το Tab ήταν hardcoded μόνο
`length→angle`, (β) το άνοιγμα άλλης φέτας ΔΕΝ κλείδωνε πρώτα την τρέχουσα → «χανόταν» η τιμή. **Μηδέν νέο store/
geometry.**

### Decision (§multi-field-lock)
1. **Γενικός «επόμενο πεδίο» οδηγούμενος από το config** — NEW pure `nextFieldKeyInOrder(order, current, shift)`
   στο `radial-ring-logic.ts`: cycle σε **οποιαδήποτε** σειρά κλειδιών (καλύπτει `linetype`/`type` που ΔΕΝ είναι
   στο σταθερό `RING_TAB_ORDER`). Το `nextRingField` κάνει πλέον **delegate** σε αυτό (μηδέν διπλότυπο cycle-logic).
2. **Ένας shared lock helper** — NEW `lockOpenNumericRaw(raw)` στο component: `evalExpr` + `field.commitNumeric`
   + `pokeCanvas`, ΧΩΡΙΣ να κλείνει το popup. Τον μοιράζονται **Enter** (commit-all), **Tab** (lock-and-advance)
   και το **switch φέτας**. Ο `commitNumericOpen` (Enter) τον καλεί (μηδέν διπλότυπη λογική commit).
3. **Tab = lock-and-advance (γενικό)** — `onPopupKeyDown`: κλείδωσε το draft του τρέχοντος → `nextFieldKeyInOrder
   (config.fields.map(key), openField, shiftKey)` → άνοιξε το επόμενο (Shift+Tab ανάποδα). **Χωρίς** `placeAtCursor`.
4. **Lock-before-switch** — `openWedge` (mousedown-intercept): αν υπάρχει ανοιχτό αριθμητικό πεδίο, `lockOpen
   NumericRaw(inputRef.current.value)` **πριν** ανοίξει το νέο (διαβάζει το DOM ώστε να ΜΗΝ μπει `draft` dep στο
   window-intercept effect) → δεν χάνεται η τιμή.
5. **Enter αμετάβλητο** — commit τρέχον + `placeAtCursor`· τα ήδη κλειδωμένα (dual store + overrides) εφαρμόζονται
   ΟΛΑ μαζί μέσω `applyLengthAngleLock` / bridge overrides.
6. **Highlight (ήδη)** — `active = hovered || openField===key || field.isLocked()`: μετά από Tab-lock το wedge
   μένει φωτισμένο (store length/angle, overrides thickness/height, non-ByLayer linetype). Καμία αλλαγή.
7. **Boy-Scout** — ενοποιήθηκαν `openWedge`+`openNumericField` → ένα `openFieldForKey(key)` (numeric seed+focus /
   select dropdown), αφαίρεση 2 near-duplicates.

**MOD (§multi-field-lock):** `systems/dynamic-input/radial-ring-logic.ts` (NEW `nextFieldKeyInOrder` +
`nextRingField` delegate), `systems/dynamic-input/components/RadialCommandRing.tsx` (NEW `openFieldForKey`/
`lockOpenNumericRaw`· γενικό Tab· lock-before-switch· Enter reuse), `systems/dynamic-input/__tests__/
radial-ring-logic.test.ts` (+6 cases). 188 dynamic-input jest GREEN. 🔴 ΕΚΚΡΕΜΕΙ browser-verify + commit (Giorgio).

## §rotation-ring — single-slice «Γωνία» ring στην ΠΕΡΙΣΤΡΟΦΗ hot-grip (2026-07-06, Giorgio)
Giorgio: «όταν επιλέγω γραμμή → γλυφή περιστροφής (κόκκινη) → δηλώνω κέντρο → free-rotate φάντασμα με
κόκκινα/πράσινα τόξα, **με Δυναμική Εισαγωγή ON** θέλω να εμφανίζεται το «Δαχτυλίδι Εντολών» ως **ΕΝΑ
πλήκτρο (όλος ο δίσκος = 1 φέτα) «Γωνία»** για να πληκτρολογώ γωνία περιστροφής· Enter = οριστικοποίηση».
Ισχύει για **ΟΛΑ τα περιστρεφόμενα** (γραμμή/τοίχος/κολόνα/δοκός/τόξο/polyline).

**SSoT audit (grep 2026-07-06) — ΚΡΙΣΙΜΟ:** ο μηχανισμός typed rotation angle **ΥΠΑΡΧΕΙ ΗΔΗ** (ADR-397 Σ3):
το `typedAngleDeg` οδηγεί ΚΑΙ το ghost ΚΑΙ τα τόξα (`buildRotateReferencePreview`, `grip-projections.ts`)
ΚΑΙ το commit (`commitFreeRotate`→`commitTypedRotate` μέσω `rotateDeltaForAngleDeg` — η γωνία encode-άρεται
στο delta, **ΟΧΙ** override). Πηγή του `typedAngleDeg` = keyboard `DirectDistanceEntry` (`rotateDdeRef`) μέσα
στο `useUnifiedGripInteraction`. **Το κενό ήταν καθαρά γέφυρα ring→hook** (το ring ζει σε άλλο component tree,
`DynamicInputSubscriber`). **Μηδέν νέο sweep-override/lock geometry** — απορρίφθηκε ρητά η προσέγγιση override
στο `rotateAxisPointsAboutPivot`/`resolveSweptRotationDeg` (άλλαζε ghost αλλά ΟΧΙ `rotateSweepDeg` → τόξα ασύμφωνα).

### Decision (§rotation-ring)
1. **Bridge store (NEW)** — `systems/dynamic-input/rotation-ring-store.ts` (`RotationRingStore`, zero-React,
   ίδιο pattern με `DynamicInputLockStore`/`createExternalStore`). ΔΥΟ πεδία της ΙΔΙΑΣ συνεδρίας: `sessionActive`
   (rotate-free ενεργό → mount gate) + `lockedDeg` (πληκτρολογημένη γωνία, signed +CCW, **ΧΩΡΙΣ normalize** —
   parity με το `commitTypedRotate`). ΜΟΝΟ γέφυρα ring→hook, **ΟΧΙ geometry seam**.
2. **Config (NEW)** — `systems/dynamic-input/rotation-ring-config.ts` (`ROTATION_RING_CONFIG`): 1 numeric πεδίο
   «Γωνία» → `computeRingSlices(1)` = όλος ο δίσκος (μία φέτα). `commitNumeric(deg)→RotationRingStore.lock(deg)`·
   `clearOnPlace→clearAngle()`. Reuse του tool-agnostic `RingConfig`/`RadialCommandRing` (μηδέν νέο UI).
3. **Mount signal** — `RotationRingStore.beginSession()` μέσα στο `seedRotateFreeStep` (**ΕΝΑ** σημείο εισόδου στο
   rotate-free — κοινό για normal centre-pick + Ctrl-endpoint), `endSession()` σε `resetToIdle` / selection-change /
   `enterReferenceFromFree` («R» → reference). ΔΕΝ overloadάρεται το `BimRotateHotGripStore` (χωριστές ευθύνες).
4. **Feed στο ΥΠΑΡΧΟΝ typedAngleDeg** — `useUnifiedGripInteraction`: low-freq `useSyncExternalStore(RotationRingStore)`
   → `typedRotateDeg: typedRotate?.deg ?? ringLockedDeg` στο preview memo (ghost+τόξα)· στο `handleMouseUp` read
   **at event time** (`?? RotationRingStore.getLockedDeg()`). Το keyboard DDE **νικά** όταν υπάρχουν και τα δύο.
5. **Enter = commit μέσω ΤΟΥ ΙΔΙΟΥ path** — το ring σε `placementMode='canvas-click'`: Enter → `commitNumeric`
   (lock γωνία) → `placeAtCursor` (synthetic canvas mousedown+mouseup) → grip `runGripMouseUp` → `commitFreeRotate`
   (διαβάζει `typedRotateDeg` = ring-locked) → `commitTypedRotate`. **ΕΝΑ commit path** (ίδιο με το cursor-click).
   Το `hotGripMovedRef` είναι ήδη `true` (rotate-free: κάθε mousemove το σηκώνει)· τα synthetic events δεν το
   μηδενίζουν (mousedown 'consume') → το synthetic click κουμπώνει ως `'commit'`.
6. **Mount branch** — `DynamicInputSubscriber`: `dynInput.on && !is3D && rotateFreeActive && getSceneUnits` →
   `<RadialCommandRing config={ROTATION_RING_CONFIG} placementMode='canvas-click' …/>`. Ανεξάρτητο από το
   `interactive` gate (στο grip-drag το εργαλείο είναι 'select', όπως το §grip-parity-hotgrip branch).
7. **Reset** — `RotationRingStore.clearAngle()` στο dynInput-off effect (μηδέν stale γωνία στο ghost).
8. **i18n (N.11)** — `tools.ring.rotationAngle` («Γωνία»/«Angle») + `tools.ring.rotationLabel`
   («Δαχτυλίδι εντολών περιστροφής»/«Rotation command ring») σε el+en.

**NEW (§rotation-ring):** `systems/dynamic-input/rotation-ring-store.ts`, `systems/dynamic-input/rotation-ring-config.ts`,
`systems/dynamic-input/__tests__/rotation-ring-store.test.ts` (+7 cases), `.../rotation-ring-config.test.ts` (+6 cases).
**MOD:** `hooks/grips/grip-hotgrip-actions.ts` (beginSession/endSession), `hooks/grips/useUnifiedGripInteraction.ts`
(subscribe + feed preview/commit + endSession σε 2 resets), `components/dxf-layout/DynamicInputSubscriber.tsx`
(mount branch + clearAngle), `i18n/locales/{el,en}/dxf-viewer-shell.json`. 192 dynamic-input jest GREEN.
🔴 ΕΚΚΡΕΜΕΙ browser-verify + commit (Giorgio).

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
- **2026-07-06 (§equal-slices)** — Giorgio: «το δαχτυλίδι να χωρίζεται σε ΤΟΣΕΣ ίσες φέτες όσες οι εντολές
  — 2→ημικύκλια, 3→3 ίσες φέτες· ΚΕΝΤΡΙΚΟΠΟΙΗΜΕΝΟ». Η γεωμετρία wedge έγινε δυναμική & count-driven: ΕΝΑΣ
  SSoT `computeRingSlices(count)` + `sliceIndexAtAngle` στο `radial-ring-logic.ts`· καταργήθηκε το σταθερό
  cardinal (`WEDGE_POSITION_ANGLES`/`wedgePositionAtAngle`/`WEDGE_ANGLES`/`wedgeAtAngle`/`RingWedgePosition`)
  + το `RingFieldDef.position` (η ΣΕΙΡΑ στο config = η φέτα). Τοίχος/δοκός(4)→cardinal (ίδια όψη), γραμμή(3)→
  3×120°, grip endpoint(2)→2 ημικύκλια. 182 dynamic-input jest GREEN. 🔴 ΕΚΚΡΕΜΕΙ: browser-verify + commit.
- **2026-07-06 (§multi-field-lock)** — Giorgio: «κλείδωμα ΠΟΛΛΩΝ πεδίων (Μήκος+Γωνία, ή Μήκος+Πάχος+Ύψος)
  ΠΡΙΝ το commit — big-player level». Big-player audit (AutoCAD/Revit/Figma/C4D συγκλίνουν): **Tab = lock-and-
  advance χωρίς commit· Enter = commit-all**. SSoT audit: ο μηχανισμός (dual store + `applyLengthAngleLock` +
  σειρά) ΥΠΗΡΧΕ — κενό ήταν UX-wiring. FIX (μηδέν νέο store): NEW pure `nextFieldKeyInOrder` (config-driven cycle·
  `nextRingField` delegate)· NEW shared `lockOpenNumericRaw` (Enter/Tab/switch)· Tab γενικό μέσω σειράς config·
  **lock-before-switch** στο `openWedge` (δεν χάνεται η τιμή στο άνοιγμα άλλης φέτας)· Boy-Scout ενοποίηση
  `openWedge`+`openNumericField`→`openFieldForKey`. +6 jest → 188 dynamic-input GREEN. 🔴 ΕΚΚΡΕΜΕΙ: browser-verify + commit.
- **2026-07-06 (§multi-field-lock — stale-lock bugfix, Giorgio)** — «απενεργοποίησα τη Δυναμική Εισαγωγή και
  ξαναπάτησα την εντολή γραμμής, αλλά κράτησε τις τιμές — λάθος». Root: το `applyLengthAngleLock` είναι **ungated**
  (`useDrawingHandlers`/`useWallTool`/`useBeamTool` το διαβάζουν όποτε υπάρχει lock) ΚΑΙ το `DynamicInputLockStore`
  δεν καθαριζόταν ΠΟΤΕ όταν έσβηνε το toggle (μόνο grip `onDeactivate` + `clearOnPlace`) → stale length/angle locks
  «κόλλαγαν» στη νέα γραμμή με τη Δυν. Εισ. **OFF**. FIX (single owner): NEW effect στον `DynamicInputSubscriber`
  → `if (!dynInput.on) DynamicInputLockStore.unlock()` (idempotent). **MOD:** `components/dxf-layout/DynamicInput
  Subscriber.tsx`. 🔴 ΕΚΚΡΕΜΕΙ: browser-verify + commit.
- **2026-07-06 (§rotation-ring)** — Giorgio: «στο free-rotate (κέντρο δηλωμένο, τόξα) με Δυν.Εισ. ON, όλος ο
  δίσκος = **1 πλήκτρο «Γωνία»** για να πληκτρολογώ γωνία περιστροφής· Enter = οριστικοποίηση· για ΟΛΑ τα
  περιστρεφόμενα». SSoT audit: ο typed-angle μηχανισμός ΥΠΗΡΧΕ (ADR-397 Σ3 — `typedAngleDeg` οδηγεί ghost+τόξα+
  commit)· κενό = **γέφυρα ring→hook**. FIX (μηδέν νέο override/geometry): NEW `RotationRingStore` (bridge:
  sessionActive+lockedDeg) + `ROTATION_RING_CONFIG` (1 φέτα «Γωνία»)· `beginSession` στο `seedRotateFreeStep` /
  `endSession` σε reset/«R»/selection· ο hook τροφοδοτεί το ΙΔΙΟ `typedAngleDeg` (`typedRotate?.deg ?? ringLockedDeg`)
  σε preview+commit· Enter → synthetic canvas click → `commitFreeRotate`→`commitTypedRotate` (ΕΝΑ commit path).
  +13 jest → 192 dynamic-input GREEN. 🔴 ΕΚΚΡΕΜΕΙ: browser-verify + commit.
- **2026-07-06 (§rotation-ring — Enter-only typed commit, Giorgio console diagnostic)** — Ο Giorgio: «μόλις
  πατήσω το 4 (χωρίς Enter) κλειδώνει». Console diag (`[ROT-DIAG]`) απέδειξε: το ψηφίο μπαίνει σωστά (preview),
  αλλά ένα terminal `mouseup` οριστικοποιεί τη ΜΕΡΙΚΗ τιμή μέσω του παλιού «κλικ == Enter» της Σ3. **FIX:** το
  keyboard typed angle κλειδώνει **ΜΟΝΟ με Enter** — `handleMouseUp` στέλνει `keyboardAngleEntryActive` (true όσο
  πληκτρολογείς) → `commitFreeRotate` early-return· το `typedRotateDeg` (commit-on-click) = **ΜΟΝΟ** η ring-locked
  γωνία (`RotationRingStore.getLockedDeg()`). Έτσι keyboard=Enter-only, ring=το δικό του popup-Enter→synthetic
  click. Ισχύει Δυν.Εισ. ON/OFF. Λεπτομέρειες: **ADR-397 §15**. 1150 grip+dynamic-input jest GREEN. 🔴 browser-verify.
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
- **2026-07-08 (§override-fields SSoT — TIER C boy-scout, Opus 4.8)** — Το override-idiom «bridge-ή-preview
  reader + bridge writer + numeric `RingFieldDef` builder» ήταν αντιγραμμένο **byte-identical** στα
  `wall-ring-config.ts` (Πάχος/Ύψος) + `beam-ring-config.ts` (Πλάτος/Ύψος) — μόνη διαφορά: το ζεύγος stores,
  ο τύπος overrides, και η per-field seed resolver. Ενοποίηση σε ΕΝΑ generic **`createOverrideRingFields<TOverrides>(bridge, preview)`**
  στο `ring-config.ts` (canonical home, δίπλα στα `lengthRingField`/`angleRingField`) → επιστρέφει
  `currentOverrides`/`setOverride`/`numericOverrideField`. Wall/beam → thin (`numericOverrideField({key,labelKey,resolveSeedMm})`).
  Μηδέν αλλαγή συμπεριφοράς (public `WALL_RING_CONFIG`/`BEAM_RING_CONFIG` shape αμετάβλητο· `setOverride`
  merge-preserve idiom ταυτόσημο). **No-God-shell:** line/grip-linear/perpendicular/rotation ring-configs ΔΕΝ
  έχουν override idiom (grep-verified) → εξαιρέθηκαν. NEW `ring-config-override-fields.test.ts` **8 GREEN** +
  **22/22 regression** (beam-ring-config + ring-config). **jscpd CHECK 3.28 (diff) 0 new clones / 3 files.**
  Guard: jscpd 3.28 + review (όχι νέο registry pattern — mirror της rebar-2d TIER C απόφασης). ΟΧΙ CHECK 6D
  (config/builders, όχι canvas-drawing). ΟΧΙ tsc (N.17). 🔴 commit (Giorgio· shared tree — μόνο τα 3 δικά μου + test).
- **2026-07-10 (§rectangle — ΟΡΘΟΓΩΝΙΟ dynamic input, Opus 4.8)** — Επέκταση του «Δαχτυλιδιού Εντολών»
  στο εργαλείο «Ορθογώνιο» (AutoCAD-style): μετά το 1ο κλικ (corner1) → **Πλάτος [TAB] Ύψος [TAB] Γωνία
  κλίσης [ENTER]**, με το 2ο κλικ να ολοκληρώνει σεβόμενο τα ήδη κλειδωμένα (Απόφαση A: **locked νικά** —
  κλειδωμένη πλευρά = σταθερό μέγεθος + πρόσημο/τεταρτημόριο από cursor· μη-κλειδωμένη = προβολή cursor στους
  τοπικούς άξονες). Το ορθογώνιο = **3 ανεξάρτητα locks** (Πλάτος/Ύψος/Γωνία), όχι polar length+angle → NEW
  **`RectLockStore`** (zero-React, mirror `DynamicInputLockStore`) + NEW **`rect-lock.ts`** (`applyRectLock` /
  `buildRectangleCornersFromLock`, SSoT preview≡commit — mirror `applyLengthAngleLock`). NEW
  **`rectangle-ring-config.ts`** (`RECTANGLE_RING_CONFIG`). **FULL SSoT — μηδέν sibling clone:** τα length/angle
  builders γενικεύτηκαν σε injectable **`RingLockTarget`** (`sceneLengthRingField`/`degreeRingField` στο
  `ring-config.ts`) → line/wall (DynamicInputLockStore) ΚΑΙ rectangle (RectLockStore) μοιράζονται τον ίδιο
  builder· `lengthRingField`/`angleRingField` public shape αμετάβλητο. NEW `RingConfig.headsUpFieldKey?` (default
  `'length'`· ορθογώνιο → `'width'`) → το `RadialCommandRing` heads-up numeric typing έγινε tool-agnostic.
  Mount: NEW rectangle branch στο `DynamicInputSubscriber` (**always-on όσο activeTool==='rectangle'**, parity με
  τη γραμμή — ΟΧΙ `tempPoints.length>=1` gate· αλλιώς πριν το 1ο κλικ φλασάριζε το legacy `<DynamicInputSystem>`
  DOM overlay· `onDeactivate=unlockAll` + `RectLockStore.unlockAll()` στο dynInput-off effect). Builder: `drawing-entity-builders` case 'rectangle' →
  `buildRectangleCornersFromLock` (ΜΟΝΑΔΙΚΟ σημείο γέννησης corner2/rotation· preview≡commit αυτόματα μέσω
  generic `createEntity` fallback). Γωνία = **πλήρης περιστροφή** σε ΟΛΟ το pipeline → βλ. **ADR-620**
  (rotated-rectangle geometry). Κόμμα/τελεία/math = reuse `lengthDisplayToSceneLock`/`evalExpr`. jest: **rect-lock 9 +
  ring/heads-up/line/wall/beam regression GREEN** (106/107· 1 pre-existing fail = scale-bar/opening-info-tag
  coverage, άσχετο). **jscpd 3.28 (diff) 0 new clones / 12 files** (−3 rectVertices duplicates). CHECK 6B/6D →
  co-staged ADR-040 + ADR-620. ΟΧΙ tsc (N.17). 🔴 browser-verify (ΔΥΝ ON → Ορθογώνιο → 1ο κλικ → `5`[TAB]`3`[TAB]`30`[ENTER]
  → κεκλιμένο 5×3· + width-lock μόνο → 2ο κλικ) + commit (Giorgio).
- **2026-07-18 (§opening-width)** — **ΕΠΕΚΤΑΣΗ ΠΛΑΤΟΥΣ ΚΟΥΦΩΜΑΤΟΣ μέσω dynamic-input** (Giorgio: «πιάσε λαβή
  παρειάς → διακεκομμένη γραμμή-λάστιχο → πληκτρολόγησε απόσταση ή κλικ»). Parity με §grip-parity-hotgrip της
  γραμμής, για τις λαβές παρειάς `opening-corner-{ne,nw,sw,se}`. **Μηδέν νέο store/FSM/parser** — reuse
  `DynamicInputLockStore` (Μήκος, scene units, signed), op `'endpoint-stretch'` του `wall-hot-grip-fsm`, το
  dashed corner-hot-grip leader (`useGripGhostPreview`, `dp.hotGrip && !movesEntity`), και το `resizeJamb`
  (`opening-grips.ts`) που ήδη κρατά την απέναντι παρειά άγκυρα. **Μοντέλο:** πληκτρολογείς **μεταβολή/απόσταση**
  (όχι νέο συνολικό πλάτος)· μέγεθος = η τιμή, φορά = πλευρά κέρσορα ως προς τη λαβή («πράσινη γραμμή») κατά τον
  τοπικό άξονα τοίχου (rotation), αρνητικό αντιστρέφει. **ΔΥΝ-gated** (bespoke gate `resolveOpeningCornerHotGrip`,
  ΟΧΙ στο `HOT_GRIP_OP_REGISTRY`) → ΔΥΝ OFF = παλιό press-drag (μηδέν regression)· **wall-hosted μόνο** (self-hosted
  κρατά το box-grip flow ADR-615). **NEW (3):** `systems/dynamic-input/opening-width-lock.ts` (pure resolver two-seam,
  entity:`unknown`+narrow όπως το `grip-endpoint-lock`), `opening-width-ring-config.ts` (length-only, mirror
  `perpendicular-line-ring-config`), `hooks/grips/opening-corner-hotgrip.ts` (gate). **MOD (5):** `GripDragStore`
  (`openingCorner` flag + `isOpeningCornerDragInfo`), `grip-mouse-handlers` (hot-grip entry), `useGripGhostPreview`
  + `grip-mouseup-handler` (τα ΔΥΟ seams μέσω `resolveOpeningWidthLockedDelta` → preview≡commit· ο commit chain-άρεται
  στο `resolveEndpointCommitDelta`, μία συνάρτηση καλύπτει hot-grip+press-drag), `DynamicInputSubscriber` (mount).
  i18n: νέο `tools.ring.openingWidthLabel` el+en. **Tests:** `opening-width-lock` (8) + `opening-corner-hotgrip` (6)
  GREEN· grip-endpoint-lock/GripDragStore/line-endpoint-hotgrip regression **21/21 GREEN**. **CHECK 6D** (`cursor/`
  GripDragStore) → co-staged αυτό το ADR. ΟΧΙ tsc (N.17)· jscpd:diff πριν «done». 🔴 browser-verify (ΔΥΝ ON → επίλεξε
  κούφωμα → κλικ λαβή παρειάς → λάστιχο → `200`[ENTER] έξω=+200 / μέσα=−200 / `-100`=αντιστροφή / κλικ χωρίς τιμή =
  απόσταση· απέναντι παρειά σταθερή) + commit (Giorgio).

- **2026-07-18 (Opus 4.8) — §grip-parity: click-armed vertex/edge RESHAPE για arc/polyline (incl. ορθογώνιο).**
  Ζητούμενο (Giorgio): κλικ σε vertex λαβή → **κόκκινη** → ORTHO + κίνηση κέρσορα + πληκτρολόγηση τιμής →
  η κορυφή μετακινείται **ΚΑΤΑ** την τιμή (τραπέζιο)· edge-midpoint λαβή → όλη η πλευρά· κλικ χωρίς τιμή →
  κορυφή στο κλικ. **Επέκταση** του υπάρχοντος line-endpoint click-move-click (op `'endpoint-stretch'`) σε
  ΟΛΕΣ τις vertex λαβές — μηδέν νέος FSM/commit/ghost (τα δουλεύουν ήδη για `phase='hotGrip'`· ο commit
  `gripToVertexRefs`→`StretchEntityCommand` ξέρει arc/polyline vertex+edge· το κόκκινο = `phase∈{dragging,hotGrip}`).
  **Σημασιολογία = DISPLACEMENT (Model A):** κατεύθυνση ORTHO/POLAR + μέγεθος πληκτρολογούμενο μήκος (διορθώνει
  το ORTHO-composition κενό του line resolver, που αγνοούσε ORTHO). **Line endpoint αμετάβλητο** («set line
  length», δικό του gate/lock) → additive, μηδέν regression.
  **NEW (2):** `hooks/grips/vertex-reshape-hotgrip.ts` (`resolveVertexReshapeHotGrip` + SSoT eligibility
  `isVertexReshapeGrip`· mirror `line-endpoint-hotgrip`), `systems/dynamic-input/vertex-reshape-lock.ts`
  (`resolveVertexReshapeLockedDelta` = `resolveOrthoPolarStep` κατεύθυνση + `applyLengthAngleLock` rescale,
  two-seam SSoT). **MOD (5):** `grip-mouse-handlers` (entry, ΔΥΝ-gated), `GripDragStore` (`vertexReshape` flag +
  `isVertexReshapeDragInfo`), `DynamicInputSubscriber` (mount `GRIP_LINEAR_RING_CONFIG`), `useGripGhostPreview` +
  `grip-mouseup-handler` (τα ΔΥΟ seams μέσω του ΙΔΙΟΥ resolver → preview≡commit· commit chain στο
  `resolveEndpointCommitDelta`). Θεμέλιο: το rectangle-reshape ghost/commit fix (ADR-620, ίδια session).
  **Tests:** `vertex-reshape-hotgrip` (11) + `vertex-reshape-lock` (4, ORTHO+typed→displacement) GREEN·
  regression line-endpoint/opening-corner/grip-endpoint-lock/ctrl-rotate-copy **32/32 GREEN**. jscpd:diff 0 new.
  **CHECK 6B/6D** (`useGripGhostPreview` ghost + `cursor/GripDragStore`) → co-staged αυτό το ADR + ADR-040. ΟΧΙ
  tsc (N.17). 🔴 browser-verify (ΔΥΝ ON → ορθογώνιο → κλικ γωνία → κόκκινη → ORTHO + `500`[ENTER] = τραπέζιο·
  κλικ edge-midpoint → όλη η πλευρά· κλικ χωρίς τιμή = κορυφή στο κλικ· arc άκρο + polyline κορυφή· press-drag
  αμετάβλητο με ΔΥΝ OFF) + commit (Giorgio).
