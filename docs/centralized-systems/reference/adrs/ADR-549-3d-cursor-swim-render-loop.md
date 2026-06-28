# ADR-549 — 3D cursor «swim»: render-loop profiling & on-demand fix

**Status:** 🔬 PROFILING (data pending — ΟΧΙ fix ακόμα)
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

## Changelog
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
