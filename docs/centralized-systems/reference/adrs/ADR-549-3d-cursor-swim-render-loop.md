# ADR-549 — 3D cursor «swim»: render-loop profiling & on-demand fix

**Status:** ✅ Phase 1 FIX IMPLEMENTED + browser-verified (spurious-dirty root cause διορθώθηκε· Finding 3 overlay-rAF unification = open follow-up)
**Date:** 2026-06-29
**Domain:** DXF Viewer / BIM 3D viewport / rendering loop (performance)
**Model:** Opus 4.8
**Related:** ADR-366 §B.5 (3D BIM adaptive shadows/quality), ADR-040 (UnifiedFrameScheduler micro-leaf SSoT), ADR-516 (idle escalation), ADR-452 (section-cap quality ladder)
**Handoffs:** `HANDOFF_2026-06-29_3d-swim-PROVEN-render-culprit-NEXT.md`, `HANDOFF_2026-06-29_3d-cursor-swim-scene-render-40ms-NEXT.md`, `HANDOFF_2026-06-29_3d-perf-settle-tail.md`

---

## Context

Ο κέρσορας/σταυρόνημα στο **3D BIM viewport «κολυμπάει»** (δεν είναι 1:1 με το φυσικό ποντίκι),
παντού & σε production, σε αδύναμη/integrated GPU.

### Τι αποδείχθηκε με bisection (browser-proven, ΟΧΙ εικασία)
Σκοτώθηκε ένα-ένα κάθε υποσύστημα με hard `DIAG_*_DEAD` guards (browser reload + test ανά βήμα,
Giorgio 2026-06-29):

| Σκοτώθηκε | Αποτέλεσμα στο swim |
|-----------|--------------------|
| Ribbon, floating panels, sidebar, ProSnap toolbar, CAD status bars, render button, top status bar, 3D cut slider | ❌ κολυμπάει ακόμα |
| **Σκιές μόνο** (ShadowModulator force-OFF κάθε frame) | ❌ **κολυμπάει ακόμα** |
| **Hover μόνο** (bim3d-pointer-scheduler) | ❌ **κολυμπάει ακόμα** |
| **ΟΛΟ το render** (`renderSceneFrame` skip στο `ThreeJsSceneManager.tick`) | ✅ **σταμάτησε πλήρως** |

➡️ **Ένοχος = το 3D scene render pass συνολικά** (`renderSceneFrame` / `bim-3d-scene` tick στον
`UnifiedFrameScheduler`). Όλα τα UI panels/ribbon/status bars/snap bar/hover είναι **ΑΘΩΑ**.

### Κρίσιμη εκλέπτυνση — διάψευση της παλιάς υπόθεσης «φταίνε οι σκιές»
Το προηγ. handoff υπέθετε ότι ο ένοχος ήταν οι σκιές (40ms PCF). Η bisection το **διαψεύδει μερικώς**:
σκοτώνοντας ΜΟΝΟ σκιές → swim παρέμεινε· ΜΟΝΟ hover → swim παρέμεινε· μόνο ΟΛΟ το render → σταμάτησε.

Άρα ο ένοχος είναι ένα από:
- **(α)** το **base raster κόστος** (`renderRaster` + overlays + per-frame bookkeeping) ανά render,
- **(β)** η **συχνότητα** που render-άρει η σκηνή (μένει dirty σχεδόν κάθε frame ή σε κάθε micro-pause),
- **(γ)** συνδυασμός: ο σύγχρονος (sync) WebGL render μέσα στο RAF μπλοκάρει το main thread →
  starve-άρει το `mousemove` του crosshair → swim.

**ΔΕΝ ξέρουμε ποιο ισχύει → PROFILE ΠΡΙΝ FIX.**

---

## SSOT Audit (τι υπάρχει ΗΔΗ — reuse, μηδέν διπλότυπα)

Ο on-demand μηχανισμός **υπάρχει ήδη και είναι σωστός στη βάση**:

- `bim-3d-scene` registered στον `UnifiedFrameScheduler` (`BimViewport3D.tsx:154`) με
  `isDirty = () => isSceneDirty()` → το `renderSceneFrame` τρέχει **μόνο όταν dirty**.
- `scene-dirty-state.ts::isSceneDirtyFromState` — pure 5-input OR
  (`isInteracting / viewportAnimating / animationManagerActive / pathTracerActive / explicitDirty`).
- `ThreeJsSceneManager.markSceneDirty()` — ο sticky `_sceneDirty` writer (~25 call-sites· grep).
- Σε καθαρό cursor sweep: `use-bim3d-pointer-handlers.handleMouseMove` → **μόνο** `requestPointerPick`
  (ΟΧΙ `markSceneDirty`). Το hover-render **αναβάλλεται** (`resettlePending`, gated σε `SHADOW_SETTLE=350`).
- `ShadowModulator` — **δικό του** global `window mousemove` capture listener + settle timer
  (`SHADOW_SETTLE=350`): σε στ.σ. κίνηση σκιές OFF· σε settle ζητά **ΕΝΑ** repaint (μόνο αν σκιές OFF).
- `IdleDetector` (`CAMERA_IDLE=800`) + `QualityModulator`/`SSAOModulator` — genuine-idle escalation SSoT.
  **REUSE — ΜΗ φτιάξεις νέο timer.**
- `pointer-activity.ts` (`markPointerMoved`/`isPointerActive`) — leaf motion signal για section caps.
- `systems/cursor/*` (ImmediatePositionStore / CrosshairCompositor / BimCrosshairOverlay3D) —
  ο κέρσορας είναι **ήδη βέλτιστος** (sync mousemove + GPU translate3d)· **ΜΗΝ τον αλλάξεις**.

**Στατική αντίφαση:** σε συνεχές sweep δεν εντοπίστηκε `markSceneDirty` caller → θεωρητικά η σκηνή
δεν θα έπρεπε να render-άρει. Όμως η bisection λέει render-άρει. Πιθανές αιτίες: renders σε κάθε
settle/micro-pause (shadow-settle + deferred hover), ή κρυφός dirty caller. **Το profile θα το λύσει.**

---

## Decision — big-player doctrine

Ο στόχος: το 3D scene render να ΜΗΝ μπλοκάρει/starve-άρει τον κέρσορα κατά την ενεργή εργασία —
όπως Revit / Maxon Cinema4D / Autodesk Forge-APS Viewer / iModel.js / Three.js Editor:

1. **On-demand rendering (ΟΧΙ per-frame)** — single master RAF + per-subsystem dirty check + render
   ΜΟΝΟ όταν κάτι ορατό άλλαξε. Αν render-άρει ενώ τίποτα δεν αλλάζει → κόψε τα spurious `markSceneDirty`.
2. **Adaptive degradation κατά την κίνηση** — φθηνό raster εν κινήσει, ακριβό quality (σκιές/SSAO/AA)
   ΜΟΝΟ σε γνήσιο idle. **REUSE** `IdleDetector`/`CAMERA_IDLE`/modulators.
3. **Μην starve-άρει το paint** — priority/budget στον `UnifiedFrameScheduler` ώστε ο κέρσορας να
   παίρνει προτεραιότητα έναντι του sync WebGL render.

**ΚΑΝΟΝΑΣ: PROFILE → DATA → FIX.** Καμία γραμμή fix χωρίς μετρημένα δεδομένα.

---

## Solution

### Phase 0 — PROFILE (αυτό το ADR, ΤΩΡΑ· revertible diagnostic instrumentation)

Lightweight, revertible instrumentation (όπως τα προηγ. diag flags· revert με `git restore`):

1. **Render counter + timing** (`ThreeJsSceneManager.tick`): wrap `renderSceneFrame` με
   `performance.now()` → `window.__bim3dPerf`: `renderCount / totalMs / maxMs / avgMs`.
2. **Dirty-reason breakdown**: στο `tick` (τρέχει μόνο όταν dirty) → counter ποιο flag του
   `isSceneDirty` ήταν true.
3. **markSceneDirty caller histogram** (πίσω από diag flag): ring-buffer top stack frame → ποιος
   καλεί πιο συχνά κατά το sweep.
4. **Base raster χωρίς σκιές**: υπάρχον `dxf-no-shadows=1` + timing (#1) → απομόνωση `renderRaster`.
5. **SSAO/composer state**: log `autoPreviewEnabled` + `ssaoModulator.isSsaoActive()`.
6. **`window.__bim3dPerf.dump()` / `.reset()`** για A/B χωρίς reload.

**Test protocol (Giorgio):** prod-build (`npm run build && npm run start` — dev=ψέματα ~86% inflation),
5s καθαρό cursor sweep χωρίς camera move, `dump()`. Δεδομένα → απαντούν (α)/(β)/(γ).

### Phase 1 — FIX (TBD μετά τα δεδομένα)
Θα οριστεί από το profile. Κατεύθυνση: cleanup spurious renders + adaptive degradation εν κινήσει,
reuse υπαρχόντων μηχανισμών. **Δεν γράφεται πριν τα νούμερα.**

---

## Consequences
- **Pro:** η διόρθωση θα βασιστεί σε μετρημένα δεδομένα, όχι εικασία (η bisection ήδη διέψευσε μία υπόθεση).
- **Con:** ένα έξτρα profiling cycle πριν τον κώδικα — αλλά αποτρέπει λάθος fix.
- ADR-040 CHECK 6B: το `UnifiedFrameScheduler.ts` είναι micro-leaf critical — αν το αγγίξει η Phase 1,
  stage ADR-040. Το Phase 0 αγγίζει `ThreeJsSceneManager`/scene files → ADR-366 §B.5 + αυτό το ADR.

---

## 🔬 Phase 0 — FINDINGS (browser-measured 2026-06-29, prod-build)

### Finding 1 — το 3D scene render ΔΕΝ είναι ο ένοχος (διάψευση #2 της bisection)
`window.__bim3dPerf.dump()` σε 6.7s καθαρό cursor sweep:
- **`renders=0`** — το `renderSceneFrame` έτρεξε **0 φορές**.
- **dirty-reason histogram = όλα 0**, **markSceneDirty callers = none** (με `dxf-trace-dirty`=1).
➡️ Ο on-demand μηχανισμός (`isSceneDirtyFromState`) δουλεύει **τέλεια** σε καθαρό sweep. Η αρχική
bisection («kill renderSceneFrame → swim σταμάτησε») μας παραπλάνησε — αφορούσε διαφορετικό σενάριο
(η σκηνή render-άρε λόγω hover-settle/camera εκείνη τη στιγμή).

### Finding 2 — ο κέρσορας ΑΚΟΜΑ κολυμπάει, με long tasks ΕΚΤΟΣ render
Στο ΙΔΙΟ sweep (`mouse-perf`, υπάρχον instrumentation):
- **`cursor.totalLag` avg ~64-72ms · p95 ~97-120ms** (OS event → painted crosshair).
- **`cursor.inputLatency` avg ~2ms** → το input ΔΕΝ μπλοκάρεται· το **paint** καθυστερεί ~63ms.
- Console violations: `UnifiedFrameScheduler.ts:186 'rAF' handler took 50-130ms` (×πολλά) **+**
  `overlay-raf.ts:41 'rAF' handler took 143ms`.
➡️ Υπάρχει **per-frame long task** ΕΚΤΟΣ του scene render: (α) κάποιο registered system στον
scheduler, ΚΑΙ/Ή (β) κάποιο overlay `draw()`.

### Finding 3 (ΑΡΧΙΤΕΚΤΟΝΙΚΟ — root candidate) — 7 ιδιωτικά rAF loops = SSoT violation
Το `overlay-raf.ts::useRafWhile` ξεκινάει **ξεχωριστό `requestAnimationFrame` loop ΑΝΑ overlay**
(crosshair, snap-indicator, hover-glow, grips, placement, wall-hud, tracking) — **7 loops + το master
rAF του scheduler**. Τρέχουν `draw()` **κάθε frame όσο active**, ασυντόνιστα, και μερικά κάνουν βαριά
δουλειά (GPU occlusion raycast μέσω `GripDepthOccluder`, projection) ανά frame.
- **Παραβιάζει το ίδιο το SSoT** που διακηρύσσει ο κώδικας (`scene-dirty-state.ts:8` / ADR-040: «single
  master rAF + per-subsystem dirty check»). Είναι **διπλότυπο της ευθύνης frame-loop**.
- **Οι big players (Forge/APS, iModel.js, Three.js Editor, AutoCAD Web) ΔΕΝ το δέχονται** — ΕΝΑ master
  rAF, prioritized, on-demand.
- Απόδειξη: ο scheduler `onFrame` **δεν βλέπει** τα 143ms του `overlay-raf` — ζουν εκτός SSoT.

### Phase 0.2 — extra instrumentation (UNCOMMITTED, revertible) για να δείξει ΠΟΙΟ
- `bim3d-perf-diag.ts`: (2) scheduler per-system timing μέσω **υπάρχοντος** `UnifiedFrameScheduler.onFrame`
  (collectMetrics ήδη true — ΟΧΙ edit στο CHECK-6B αρχείο, reuse metrics SSoT), (3) per-overlay `draw()`
  timing μέσω optional `diagLabel` στο `useRafWhile` (7 labelled call-sites).
- Test → Giorgio: το `dump()` τώρα δείχνει «scheduler systems» + «overlay draws» πίνακες → εντοπίζει
  το long task.

### Finding 4 — spurious `markSceneDirty` ανά move: `useBim3DWireWaypointInteraction.onMove`
Δεύτερο dump (tool='select', ενεργό MEP circuit ΟΧΙ): `renders=33/6s (5.5/s, avg 27ms dev)`,
`dirty-reason: explicitDirty=33`, **`markSceneDirty callers: useBim3DWireWaypointInteraction.onMove ×205`**.
- Ο hook (`use-bim3d-wire-waypoint-interaction-3d.ts`) είναι **armed όποτε `is3D && tool==='select'`**
  (προεπιλογή → σχεδόν πάντα) και ο `onMove` καλεί `manager.markSceneDirty()` σε **ΚΑΘΕ** pointermove —
  ακόμα και όταν `getActiveContext()===null` (καμία ενεργή MEP γραμμή· γρ.201) ή χωρίς αλλαγή hover/insert
  (γρ.209/216). Καθαρή παραβίαση on-demand → 205 spurious dirties → scene render 5.5/s για το τίποτα.
- Overlays εδώ ΦΘΗΝΑ (crosshair 1ms, snap 0.3ms) — δεν αναπαρήχθη το 143ms (situational, run-1).
- ⚠️ scheduler watch `frames=0` (dev/HMR έσπασε το onFrame) → Phase 0.2 σκληρύνθηκε (force `collectMetrics`
  + re-arm στο reset). Χρειάζεται **prod** run για το baseline scheduler long task (run-1 50-130ms).

### Phase 1 — FIX direction (μετά το επόμενο dump)
Ιεραρχία (επιβεβαίωση με prod dump πρώτα):
1. **Spurious dirty (Finding 4):** ο `onMove` του wire-waypoint να ΜΗΝ μαρκάρει dirty όταν τίποτα δεν
   άλλαξε (idempotent· dirty μόνο σε πραγματική αλλαγή hover-index/insert-marker/handles-visibility) — ή
   να μην είναι armed χωρίς ενεργό circuit. (Audit: μήπως κι άλλοι «select»-armed hooks κάνουν το ίδιο.)
2. **Baseline scheduler long task (run-1):** ποιο registered system = 50-130ms (prod dump «scheduler systems»).
3. **7 ιδιωτικά rAF (Finding 3):** ενοποίηση overlays στον ΕΝΑ scheduler + on-demand occlusion.
Big-player ενοποίηση: τα overlays γίνονται **registered systems στον ΕΝΑ `UnifiedFrameScheduler`**
(crosshair = CRITICAL priority) με dirty-gating — **κατάργηση** των 7 ιδιωτικών rAF· + το per-frame
occlusion/projection γίνεται **on-demand** (όχι κάθε frame). ⚠️ Η ενοποίηση μόνη δεν σβήνει ένα ακριβό
`draw()` — χρειάζεται ΚΑΙ μείωση του κόστους (το dump θα δείξει ποιο). Γράφεται μετά τα δεδομένα.

## ✅ Phase 1 — FIX IMPLEMENTED + browser-verified (2026-06-29, dev relative-breakdown)

**Root cause επιβεβαιώθηκε 100% (Finding 4)**, scheduler breakdown ΔΕΝ χρειάστηκε. Dump σε καθαρό
6s sweep (tool='select', ΚΑΝΕΝΑ ενεργό circuit):
- `renders=42/6s (7/s, avg 26.6ms)`, `dirty-reason: explicitDirty=42`,
  **`markSceneDirty callers: useBim3DWireWaypointInteraction.onMove ×150`** + OrbitControls ×1.
- Δηλ. 150 spurious dirties → 42 full-scene renders × 26.6ms ≈ 1.1s render σε 6s sweep = το «swim».
- Overlays φθηνά (crosshair total 36.6ms, snap 12.7ms σε 6s) → **ΟΧΙ** ο ένοχος.

### Η διόρθωση (1 αρχείο: `bim-3d/animation/use-bim3d-wire-waypoint-interaction-3d.ts`)
Big-player on-demand doctrine, belt-and-suspenders, FULL SSoT (μηδέν νέο store/timer/helper):
1. **Arm gate σε ενεργό circuit** (`apply`): armed μόνο όταν `selectIs3D && tool==='select' &&
   activeSystemId !== null` + **νέο `useMepCircuitEditorStore.subscribe(apply)`** ώστε το arming να
   επανεκτιμάται όταν ενεργοποιείται/απενεργοποιείται κύκλωμα. Όταν δεν επεξεργάζεσαι MEP → ο hook
   **εντελώς ανενεργός** (μηδέν pointermove listener, μηδέν dirty). Σβήνει τη dominant περίπτωση (150).
2. **Idempotent redraw** (`onMove`): tracked `shownHandles / shownHovered / shownInsert` → `markSceneDirty()`
   **μόνο** σε πραγματική αλλαγή handles-visible / hovered-index / insert-ghost-position. 2η γραμμή άμυνας
   (π.χ. activeSystemId set αλλά `getActiveContext()` null λόγω non-electrical/χωρίς fixtures). reset στο teardown.

### SSoT audit (ΠΡΙΝ τον κώδικα — grep `selectIs3D` σε bim-3d/**)
ΟΛΟΙ οι άλλοι interaction hooks είναι armed σε **συγκεκριμένο εργαλείο** (`mep-radiator`, `beam-from-wall`,
`column`, `opening`, `furniture`, `mep-segment`...) όπου το per-move ghost redraw είναι **σωστή** συμπεριφορά.
**Μόνο** ο wire-waypoint ήταν armed στο default 'select' → μοναδικός ένοχος. Καμία άλλη αλλαγή.

### Αποτέλεσμα (ίδιο 6s sweep, πριν→μετά)
| Μέτρηση | ΠΡΙΝ | ΜΕΤΑ |
|---|---|---|
| 3D-scene renders | 42 (7/s) | **0** |
| explicitDirty | 42 | **0** |
| markSceneDirty callers | onMove ×150 | **none** |
| cursor.totalLag (steady-state) | ~55-62ms | **~9.6ms** |

Tests: `__tests__/use-bim3d-wire-waypoint-interaction-3d.test.ts` (4/4 — arm-gate, re-arm-on-activate,
idempotent-no-op-hover, teardown-on-deactivate). ADR-040 CHECK 6B **δεν** ενεργοποιείται (δεν αγγίχτηκε
`UnifiedFrameScheduler`)· CHECK 6D → staged αυτό το ADR + ADR-366.

### Open follow-ups (ΟΧΙ μέρος αυτού του fix)
- **Finding 3 (big-player):** ενοποίηση των 7 ιδιωτικών overlay rAF στον ΕΝΑ `UnifiedFrameScheduler` +
  on-demand occlusion. Φθηνά τώρα (~0.15ms/frame) → χαμηλή προτεραιότητα, αλλά SSoT-σωστό.
- **scheduler per-system breakdown:** `frames=0` ακόμα και σε φρέσκο dev (diag `onFrame` quirk) — δεν
  χρειάστηκε αφού ο ένοχος ήταν το scene render, όχι registered system. Revert το Phase 0 diag όποτε.

---

## ✅ Phase 2 — hover-glow «stuck highlight» + lag σε DXF οντότητα (2026-06-29, browser-reported)

**Σύμπτωμα (Giorgio):** σαρώνεις τον κέρσορα πάνω σε DXF οντότητα → φωτίζεται· συνεχίζεις να κινείσαι
γρήγορα σε άλλο σημείο → ο κέρσορας **βαραίνει** ΚΑΙ η οντότητα **μένει φωτισμένη** όσο κινείσαι· σβήνει
μόλις **σταματάς**, και τότε φεύγει το lag.

**Root cause** (`bim-3d/viewport/snap/bim3d-pointer-scheduler.ts::runPick`): το **refine-on-settle** (ADR-366
§B.5) ανέβαλλε **μαζί** το φθηνό `setHoveredEntity` (που οδηγεί το DXF glow = `DxfHoverGlowOverlay2D`,
**Canvas2D overlay χωρίς WebGL render**) ΚΑΙ το ακριβό `applyBimHover`+`markSceneDirty` (BIM silhouette =
full WebGL re-render). Όσο `isPointerActive(SHADOW_SETTLE=350ms)`, **τίποτα** δεν εφαρμοζόταν → το
`HoverStore` πάγωνε στην παλιά οντότητα → το glow overlay έμενε `active` → το `useRafWhile` rAF του
ζωγράφιζε **per-frame** (full-DPR canvas clear + project + stroke) → lag. Καθάριζε μόνο στο settle.

**FIX (big-player decouple, FULL SSoT, μηδέν νέο store):**
1. `bim3d-pointer-scheduler.ts` — **διαχωρισμός**: το unified hover id (`setHoveredEntity`) ενημερώνεται
   **live** σε κάθε pick (όπως το snap glyph)· **μόνο** το BIM silhouette (`applyBimHover`+`markSceneDirty`)
   μένει refine-on-settle, με ξεχωριστό tracker `lastBimHoverId`. Pure-DXF hover → `bimHoverId` μένει null
   → **μηδέν** WebGL re-render (το glow είναι Canvas2D).
2. `grips/DxfHoverGlowOverlay2D.tsx` — `active` gated σε **πραγματική DXF οντότητα** (`findDxfEntityInScope`,
   memoized ανά hover-change) → το rAF μένει OFF σε BIM hover (αλλιώς θα καθάριζε τον full-DPR canvas κάθε
   frame για no-op draw).

**Αποτέλεσμα:** το glow ακολουθεί τον κέρσορα 1:1 και σβήνει live μόλις φεύγεις από την οντότητα (≤ ένα
HOVER_HITTEST ~50ms), χωρίς να χρειάζεται να σταματήσεις· ο κέρσορας δεν βαραίνει. Tests:
`bim3d-pointer-scheduler.test.ts` 12/12 (2 νέα: live-hover-while-sweeping, DXF-only-zero-WebGL· +
silhouette-clear-on-leave). 🔴 browser-verify (Giorgio).

**Open (Finding 3):** το glow `useRafWhile` ακόμα redraw-άρει per-frame ΟΣΟ είσαι πάνω σε DXF οντότητα με
στατική κάμερα (δεν αλλάζει τίποτα) → redraw-on-demand cleanup μαζί με την ενοποίηση των 7 overlay rAF.

---

## 🔬 Phase 4 — A/B overlay isolation + crosshair sync-decouple (2026-06-29)

### A/B DEFINITIVE — `dxf-no-overlays` flag (browser-measured, dev)
Νέο revertible gate στο `overlay-raf.ts::useRafWhile`: `localStorage['dxf-no-overlays']==='1'` →
κατάστειλε ΚΑΘΕ ιδιωτικό overlay rAF (cleanup + `onStop`). Σάρωση πάνω σε οντότητες, dump πριν/μετά:

| Μέτρηση | overlays ON | overlays OFF |
|---|---|---|
| 3D-scene `renders` | **676** (avg **21.88ms**/render) | **3** |
| `cursor.totalLag` (steady) | ~40ms | **16–21ms** (best) … 32–38ms (typ.) |
| overlay draws (CPU) | όλα **<1ms** (crosshair 0.94 / hover-glow 0.26 / snap 0.25 / grips 0.29) | — |

### Διορθωμένο συμπέρασμα (διάψευση «GPU compositing των layers»)
Τα overlay Canvas2D draws κοστίζουν **<1ms CPU** το καθένα → **ΔΕΝ** φταίει το compositing των στρωμάτων.
Ο ένοχος = **πλήρη WebGL scene re-renders ~22ms** (όχι CPU path → αόρατα στο `performance.now()` diag,
γι' αυτό «όλα φαίνονταν φθηνά»). Με overlays OFF → renders 676→3 → best-case lag 40→16ms· το residual
~32ms = το **καθαρό κόστος ενός scene-render** που περνά μέσα από OrbitControls damping / shadow-modulator /
settle. **Το BIM silhouette είναι ήδη refine-on-settle (Phase 2) — δεν φταίει στο sweep.** Το σκληρό όριο =
κόστος/συχνότητα render σε αδύναμη GPU, **όχι** τα overlays.

### §2.2 FIX — crosshair snap-glue → 100% σύγχρονο (1 αρχείο: `BimCrosshairOverlay3D.tsx`)
Ο cursor-follow ήταν **ήδη** σύγχρονος (window `mousemove`, capture). Το RAF έμπαινε **μόνο** στο
snap-glue (`gluedRef`): ενώ glued, ο move-handler υποχωρούσε **εντελώς** στο RAF → το κέντρο
προχωρούσε μόνο σε RAF cadence → **ένα extra frame lag ανά BIM snap-hover** (το μετρημένο BIM > DXF gap).

**Big-player decouple, FULL SSoT (μηδέν νέο store):** το RAF (`draw`) κρατά **φρέσκια** την προβολή του
snap σε νέο `snapProjectedRef` (η βαριά projection — camera + GPU depth readback μέσω `GripDepthOccluder`
— μένει στο RAF, εκτός hot path)· ο **σύγχρονος** move-handler την καταναλώνει μέσω του pure
`resolveCrosshair3DCenter` SSoT → glue-vs-cursor αποφασίζεται **on-the-event**, χωρίς GPU stall.
Το πλέον-νεκρό `gluedRef` (write-only μετά) **αφαιρέθηκε** (Boy-Scout). Το RAF παραμένει για το μόνο
σενάριο όπου το κέντρο κινείται χωρίς mousemove: **κάμερα κινείται ενώ ο κέρσορας στέκεται**.

**Στόχος:** BIM crosshair == DXF crosshair (κλείσιμο του ~10ms gap). CHECK 6D → stage αυτό το ADR.

### 🔬 Phase 4 — ΜΕΤΡΗΜΕΝΟ ΑΠΟΤΕΛΕΣΜΑ (641-sample window, 2026-06-29) — διόρθωση υπόθεσης
Νέο tooling: `__bim3dPerf.download()` (flat `.txt` στις Λήψεις, reuse `triggerExportDownload`+`nowISO`) +
`resetPerf()`/hold-window στο `mouse-handler-perf.ts` (το `reset()` μηδενίζει ΚΑΙ τον cursor + κρατά ΟΛΟ
το παράθυρο, όχι μόνο τα τελευταία <60). Καθαρό δείγμα BIM sweep 26.6s:

| Μετρική | Τιμή |
|---|---|
| `cursor.totalLag` | avg **31.6ms** · **min 1.3ms** · p95 62 · max 100 (641 samples) |
| `cursor.inputLatency` | avg **1.9ms** (input ΟΚ) |
| renders | 14/26.6s (μερικά camera frames) · overlays όλα <1ms |

**Διόρθωση:** το «spikes» (από sparse 10-sample dumps) **διαψεύστηκε**. Αφαιρώντας τα ~7% render-frames,
τα υπόλοιπα ~600 frames βγάζουν **σταθερό πάτωμα ~28ms ≈ 1.7 frames**. inputLatency ~2ms αλλά paint ~28ms
→ **καθαρά present/compositor latency** (το σταυρόνημα-DOM layer συνθέτεται μαζί με το vsync-locked WebGL
present σε αδύναμη GPU). **Επιβεβαιώνει την αρχική υπόθεση «GPU present» του handoff — με δεδομένα.**
Το §2.2 δρα ΠΡΙΝ το compositing → δεν μειώνει αυτό το πάτωμα (σωστό & ασφαλές, αλλά όχι το ψάρι· επιπλέον
το snap-glue path δεν ασκήθηκε στα samples — κανένα `crosshair` overlay-draw).

### Phase 5 — ΕΠΟΜΕΝΟΣ ΜΟΧΛΟΣ (low-latency presentation, καθαρή session)
Στόχος = το ~28ms πάτωμα present-latency. Υποψήφια (browser-verify απαραίτητο):
1. **`desynchronized: true`** στα Canvas2D overlay contexts (hover-glow/snap/grips) + **low-latency WebGL**
   (`powerPreference:'high-performance'`, `desynchronized`) στο `THREE.WebGLRenderer` creation — αποσυνδέει
   το cursor-layer compositing από το vsync-locked WebGL render.
2. Ο `CrosshairCompositor` είναι **DOM** (translate3d), όχι canvas → εξέτασε αν απομονώνεται σε δικό του
   compositor layer ανεξάρτητο του WebGL present.
3. Επιβεβαίωση με Chrome DevTools → Performance → GPU/compositor track (το `performance.now()` diag δεν το πιάνει).

### ✅ Phase 5 — IMPLEMENTED (low-latency presentation, 2026-06-29, UNCOMMITTED)
**Big-player doctrine:** ο `desynchronized` hint = web-platform ισοδύναμο του native low-latency present
(DXGI flip-model / waitable swap-chain που χρησιμοποιούν Revit & Cinema 4D), και του `desynchronized`
canvas που χρησιμοποιεί η Figma για cursor/stylus latency· `powerPreference:'high-performance'` = πρακτική
Autodesk Forge/APS & Onshape.

**SSoT audit (grep ΠΡΙΝ τον κώδικα):**
- Live WebGL renderer = `scene-setup.ts:101` (`createBimRenderer`)· ο capture renderer (γρ.134,
  `preserveDrawingBuffer:true`) **δεν** αγγίχτηκε.
- 2D overlay context SSoT = `sizeCanvasToContainerDpr` (`rendering/canvas/withCanvasState.ts`), μοναδικός
  runtime caller = το unified 3D overlay-dispatch (ADR-555). Precedent `desynchronized:true` ήδη στο
  `PreviewRenderer.ts:112` (2D DXF preview).
- **Κρίσιμο για three r0.170:** ο `THREE.WebGLRenderer` **ΔΕΝ προωθεί** το `desynchronized` στο
  `getContext` (μόνο alpha/depth/stencil/antialias/premultipliedAlpha/preserveDrawingBuffer/
  powerPreference/failIfMajorPerformanceCaveat — `three.module.js:29090`). Γι' αυτό δημιουργούμε ΕΜΕΙΣ το
  `webgl2` context με το flag και το περνάμε via την παράμετρο `context`.

**Αλλαγές (4 αρχεία, FULL SSoT, μηδέν `any`):**
1. `bim-3d/scene/scene-setup.ts` (`createBimRenderer`) — manual `getContext('webgl2', {…desynchronized:true,
   powerPreference:'high-performance'})` → `new THREE.WebGLRenderer({ canvas, context, … })`. Belt-and-suspenders
   fallback στο default three path αν αποτύχει το context.
2. `rendering/canvas/withCanvasState.ts` (`sizeCanvasToContainerDpr`) — προαιρετικό `desynchronized = false`
   param → `getContext('2d', { desynchronized })`. Default false ⇒ μηδέν regression.
3. `bim-3d/viewport/overlay-dispatch/bim-overlay-pass.ts` (`paintBimOverlayFrame`) — περνά `true` (cursor-critical).
4. `bim-3d/viewport/overlay-dispatch/BimOverlayDispatchCanvas.tsx` (onStop) — ίδιο `{desynchronized:true}` για συνέπεια.

🔴 **Browser-verify (Giorgio):** (α) μέτρηση πριν/μετά με `__bim3dPerf.download()` (baseline `cursor.totalLag`
avg ~31ms → στόχος <16ms)· (β) οπτικός έλεγχος για tearing (trade-off αποδεκτό για CAD viewer)· (γ) Chrome
DevTools → Performance → GPU/compositor track για επιβεβαίωση. Caveats: `desynchronized` × `alpha:true`
compositing — αν big-player πρακτική το διαψεύδει, ακολουθούμε αυτήν.

---

## Changelog
- **2026-06-29** — Phase 8 polish #2: οι 4 βραχίονες του σταυρού ΚΟΛΛΑΝΕ στις παρειές του pickbox
  (αίτημα Giorgio) — όταν υπάρχει κουτί `gap = pickbox/2` (η άκρη κάθε γραμμής πέφτει ακριβώς πάνω
  στην πλευρά του τετραγώνου, χωρίς κενό)· χωρίς κουτί ισχύει το `center_gap_px` του χρήστη ή 6.
  `useCrosshairCursor.ts` only. 🟡 UNCOMMITTED.
- **2026-06-29** — Phase 8 polish: σταθερό pickbox 7×7 px (αίτημα Giorgio). Το κεντρικό τετραγωνάκι
  του hardware-cursor σταυρονήματος (`useCrosshairCursor`) αποσυνδέθηκε από το osnap `apertureSize`
  (ανοχή έλξης, ρυθμιζόμενη) → νέα σταθερά `CURSOR_PICKBOX_PX = 7`· ο toggle `showAperture` το
  δείχνει/κρύβει· το κενό βραχιόνων = pickbox/2 + 2. Boy-Scout: αφαιρέθηκε το νεκρό 3ο αντίγραφο
  `canvasOverlayWithPointerControl` (`design-tokens/modules/canvas-ui.ts`, μηδέν consumers,
  grep-verified)· τα 2 ζωντανά overlays γίνονται `cursor:'inherit'`. 🟡 UNCOMMITTED.
- **2026-06-29** — ADR δημιουργήθηκε. Phase 0 (PROFILE) ορίστηκε. Καταγράφηκε η bisection (render
  pass = αποδεδειγμένος ένοχος) + η διάψευση της «μόνο σκιές» υπόθεσης + το SSOT audit. Fix pending data.
- **2026-06-29** — Phase 0 instrumentation IMPLEMENTED (UNCOMMITTED, revertible). NEW
  `bim-3d/scene/bim3d-perf-diag.ts` (`window.__bim3dPerf`: renderCount/avg/max + dirty-reason
  histogram + `markSceneDirty` caller histogram πίσω από `dxf-trace-dirty`=1). Hooks: 2 call-sites
  στο `ThreeJsSceneManager` (tick timing+sample, markSceneDirty trace). Test protocol → Giorgio.
- **2026-06-29** — Phase 0 FINDINGS καταγράφηκαν (renders=0 → scene render αθώο· cursor.totalLag ~65ms
  με long tasks στο scheduler + overlay-raf· **7 ιδιωτικά rAF loops = SSoT/big-player violation, root
  candidate**). Eager init fix στο diag (window handle πάντα διαθέσιμο). Phase 0.2 instrumentation
  (UNCOMMITTED): scheduler per-system via `onFrame` (reuse, no CHECK-6B edit) + per-overlay `draw()`
  timing via `diagLabel` στο `useRafWhile` (7 labelled call-sites). Phase 1 = ενοποίηση overlays στον
  ΕΝΑ scheduler + on-demand occlusion.
- **2026-06-29** — Finding 4: `useBim3DWireWaypointInteraction.onMove` κάνει spurious `markSceneDirty`
  (επιβεβαιωμένο 2 runs: ×205 & ×42). 3ο run πάλι dev (`scheduler frames=0`) → **αιτία = dev/Turbopack
  φορτώνει το `UnifiedFrameScheduler` ως ΔΙΠΛΟ module**, το diag onFrame έπεφτε σε dead instance. FIX:
  το onFrame subscription μεταφέρθηκε στο `BimViewport3D` (δίπλα στο `register('bim-3d-scene')` = το
  running instance, dev-proof)· το diag έγινε καθαρός recorder (`recordSchedulerFrame`). Νέο στοιχείο:
  overlay `crosshair` max=46.5ms spike. Επόμενο run (dev OK πλέον για relative breakdown) → scheduler systems.
- **2026-06-29** — ✅ **Phase 1 FIX IMPLEMENTED + browser-verified.** Φρέσκο dev run επιβεβαίωσε
  Finding 4: `renders=42/6s`, `markSceneDirty: onMove ×150`, ΚΑΝΕΝΑ ενεργό circuit → καθαρό spurious-dirty
  bug. FIX (1 αρχείο `use-bim3d-wire-waypoint-interaction-3d.ts`): (1) arm-gate σε `activeSystemId !== null`
  + `useMepCircuitEditorStore.subscribe`, (2) idempotent redraw (`shownHandles/shownHovered/shownInsert`).
  SSoT audit: μοναδικός 'select'-armed hook (οι υπόλοιποι tool-gated, αθώοι). Αποτέλεσμα: **renders 42→0,
  cursor.totalLag ~60ms→~9.6ms**. 4 jest tests (arm-gate/re-arm/idempotent/teardown). Δεν αγγίχτηκε
  `UnifiedFrameScheduler` (no CHECK 6B). Open: Finding 3 overlay-rAF unification (φθηνό τώρα, low-pri) +
  revert Phase 0 diag όποτε. Stage: αυτό το ADR + ADR-366 + ο hook + το test.
- **2026-06-29** — ✅ **Phase 2: hover-glow «stuck highlight» + lag FIX.** Browser-reported: σάρωση πάνω
  σε DXF οντότητα → φωτίζεται → συνεχής κίνηση = κέρσορας βαραίνει + glow κολλάει μέχρι να σταματήσεις.
  Root cause: το refine-on-settle ανέβαλλε **μαζί** το φθηνό `setHoveredEntity` (Canvas2D glow) με το ακριβό
  WebGL silhouette → πάγωνε το `HoverStore` → glow overlay `active` → per-frame rAF draw → lag. FIX (2 αρχεία):
  `bim3d-pointer-scheduler.ts` αποσύνδεση (hover id live, silhouette refine-on-settle με `lastBimHoverId`) +
  `DxfHoverGlowOverlay2D.tsx` `active` gated σε `findDxfEntityInScope` (rAF OFF σε BIM hover). Pure-DXF hover =
  μηδέν WebGL render. 12/12 jest. CHECK 6D → stage αυτό το ADR + τα 2 αρχεία + το test. 🔴 browser-verify.
- **2026-06-29** — 🔬 **Phase 4: A/B overlay isolation + crosshair sync-decouple (§2.2).** Νέο revertible
  `dxf-no-overlays` flag στο `overlay-raf.ts` → A/B: overlays OFF ρίχνει renders **676→3** & best-case
  `totalLag` **40→16ms**, αλλά τα overlay draws κοστίζουν **<1ms CPU** → **διάψευση «GPU compositing των
  layers»**. Ένοχος = **πλήρη WebGL scene re-renders ~22ms** (residual ~32ms = render-bound floor, όχι
  overlays). FIX §2.2 (1 αρχείο `BimCrosshairOverlay3D.tsx`): το snap-glue έγινε **σύγχρονο** — RAF κρατά
  φρέσκια την projection σε `snapProjectedRef` (GPU readback μένει στο RAF), ο σύγχρονος move-handler την
  καταναλώνει μέσω `resolveCrosshair3DCenter` → κλείνει το ~10ms BIM>DXF gap (extra RAF frame). Νεκρό
  `gluedRef` αφαιρέθηκε. Pure `crosshair-3d-center.test.ts` αμετάβλητο (resolver δεν άλλαξε). CHECK 6D →
  stage αυτό το ADR + το αρχείο. 🔴 browser-verify (BIM dump πριν/μετά).
- **2026-06-29** — 🔬 **Phase 4 ΜΕΤΡΗΜΕΝΟ + tooling.** NEW `__bim3dPerf.download()` (flat `.txt` στις Λήψεις,
  reuse `triggerExportDownload`+`nowISO`· καθαρό αρχείο αντί για console expand-arrows) + `resetPerf()`/
  hold-window στο `mouse-handler-perf.ts` (reset μηδενίζει cursor + κρατά ΟΛΟ το window). Καθαρό 641-sample
  BIM sweep: `cursor.totalLag` avg **31.6ms** min **1.3** p95 62, inputLatency **1.9ms**, renders 14/26.6s.
  **Διόρθωση «spikes»→λάθος:** σταθερό **~28ms present-latency πάτωμα** (paint-bound, όχι render/CPU) →
  επιβεβαιώνει «GPU present» με δεδομένα. §2.2 δεν το μειώνει (δρα προ-compositing· snap-glue path δεν
  ασκήθηκε). **Phase 5 (επόμενη session): low-latency presentation** — `desynchronized` Canvas2D overlays +
  low-latency `THREE.WebGLRenderer` + DevTools GPU track. Stage: αυτό το ADR + diag files.
- **2026-06-29** — ✅ **Phase 5 IMPLEMENTED (low-latency presentation, UNCOMMITTED).** Στόχος = το ~28ms
  present-latency πάτωμα. `desynchronized:true` + `powerPreference:'high-performance'` στον live WebGL
  renderer (`scene-setup.ts createBimRenderer` — manual webgl2 context + `context` param, γιατί three r0.170
  δεν προωθεί `desynchronized`) **και** στο 2D overlay-dispatch context (`sizeCanvasToContainerDpr` optional
  param, default false· `paintBimOverlayFrame` + onStop περνούν true). SSoT reuse: `PreviewRenderer` precedent,
  ΕΝΑΣ context-factory util. Big-player: native low-latency present (Revit/C4D) ≈ Figma desynchronized canvas ≈
  Forge/Onshape high-performance. 4 αρχεία, μηδέν `any`. CHECK 6B/6D → stage αυτό το ADR + τα 4 αρχεία.
  🔴 browser-verify (dump πριν/μετά + tearing + GPU track).
- **2026-06-29** — 🔬 **Phase 8 A/B IMPLEMENTED (HARDWARE-cursor crosshair, UNCOMMITTED).** Δοκιμή να
  παρακαμφθεί τελείως το present-latency πάτωμα: ζωγραφίζουμε το σταυρόνημα ως **OS cursor** πάνω στον
  3D container (CSS `cursor: url(...)`, παρακάμπτει το `cursor-none`) → 1:1 tracking όπως το «χέρι» του
  ViewCube, μηδέν compositor-present latency. NEW `systems/cursor/crosshair-cursor-image.ts` (pure —
  φτιάχνει το data-URL του σταυρού + hotspot) + `systems/cursor/useCrosshairCursor.ts` (hook — εφαρμόζει/
  καθαρίζει το cursor style στον container) + colocated test. Συνυπάρχει με το Canvas2D σταυρόνημα στο A/B
  (forced bright-green/bold/big για να ξεχωρίζει). Wired στο `BimViewport3D`. **Boy-Scout (N.7.1):** το
  `BimViewport3D.tsx` ξεπέρασε ξανά τις 500 γρ. → εξαγωγή των ViewCube compass/accessibility prefs σε νέο
  hook `use-bim3d-viewcube-prefs.ts` (load-effect + compass-wiring effect + optimistic toggle + state). CHECK
  6D → stage αυτό το ADR + τα cursor αρχεία. 🔴 browser-verify (A/B hardware vs canvas crosshair feel).
- **2026-06-29** — ✅ **Phase 8 ΟΡΙΣΤΙΚΟ — hardware cursor ΚΑΙ στο 2D + retire canvas crosshair (UNCOMMITTED).**
  Το A/B έκλεισε: ο **OS hardware cursor** (CSS `cursor: url(png)`, PNG υποχρεωτικό ≤32px σε Chrome/Windows)
  είναι **τέλειο 1:1** (GPU cursor plane, μηδέν compositor-present latency) → υιοθετείται ΚΑΙ στο 2D, ο
  Canvas2D `CrosshairCompositor` **αποσύρεται** (βλ. ADR-545).
  **2D root cause (SSoT audit, grep ΠΡΙΝ τον κώδικα):** το hook έβαζε σωστά το hardware cursor inline στον
  `.canvas-stack` container (`CanvasLayerStack`), ΑΛΛΑ το `DxfCanvas` (z-`docked`, `pointerEvents:'auto'`, το
  **topmost στοιχείο κάτω από τον δείκτη**) όριζε δικό του inline `cursor:'none'` → το explicit cursor του child
  νικά το inherited → σταυρόνημα αόρατο. Στο 3D δούλευε γιατί το three.js canvas είναι child ΧΩΡΙΣ δικό του cursor
  → κληρονομεί. **FIX (1 αρχείο, SSoT):** `styles/design-tokens/modules/canvas-ui.ts` — `dxfCanvasWithTools` +
  `layerCanvasWithTools` cursor fallback `'none'` → **`'inherit'`** (pan→`grab`/zoom→`zoom-in` αμετάβλητα). ΕΝΑ
  στοιχείο (ο container) ορίζει τον cursor, όλα τα canvases τον κληρονομούν — ακριβώς όπως το 3D. Big-player:
  Figma/Google web tools βασίζονται στον OS/CSS cursor (ποτέ canvas), ΕΝΑ owner + inherit.
  **Gate:** αφαιρέθηκε το `!!dxfScene` από το `useCrosshairCursor` στο 2D → φαίνεται πάντα (parity με 3D, ο
  χρήστης το επιβεβαίωσε), όπως σε άδειο canvas στο 3D.
  **Τίμημα (web-platform limit, αποδεκτό):** PNG ≤32px (όχι full-screen βραχίονες), όχι center snap-glue (ο
  hardware cursor είναι πάντα στην πραγματική θέση) — ΟΜΩΣ το snap marker ανάβει + το κλικ πιάνει το snap.
  **Retire/cleanup (dead-code ratchet CHECK 3.22):** διαγράφηκαν 11 νεκρά αρχεία — `CrosshairOverlay`,
  `CrosshairCompositor`, `crosshair-compositor-paint`/`-layout` (+2 tests), `BimCrosshairOverlay3D`, και το
  cascade που υπηρετούσε ΜΟΝΟ τον retired compositor: `crosshair-3d-center` (snap-vs-cursor center — άχρηστο,
  ο hardware cursor μένει στην πραγματική θέση) + `hover-add-badge` ("+"/"−" badge — δεν ζωγραφίζεται σε PNG
  cursor) (+2 tests). Grep επιβεβαίωσε μηδέν live importers.
  **ΕΚΚΡΕΜΕΙ (ξεχωριστά):** revert των Phase 0 διαγνωστικών (`bim3d-perf-diag` wiring σε 4 committed perf-critical
  3D αρχεία + flags `dxf-no-render`/`dxf-no-overlays` + `mouse-handler-perf` hold-window) — flag-gated, μηδέν
  production impact, ΔΕΝ μπλοκάρει commit· shared-tree risk → δική του εστιασμένη συνεδρία.
  CHECK 6B/6D → stage αυτό το ADR + ADR-545 + canvas-ui.ts + CanvasLayerStack.tsx + τις διαγραφές. 🔴 browser-verify
  (2D 1:1 όπως το «χέρι» του ViewCube) + commit (Giorgio).
