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

## Changelog
- **2026-06-29** — ADR δημιουργήθηκε. Phase 0 (PROFILE) ορίστηκε. Καταγράφηκε η bisection (render
  pass = αποδεδειγμένος ένοχος) + η διάψευση της «μόνο σκιές» υπόθεσης + το SSOT audit. Fix pending data.
- **2026-06-29** — Phase 0 instrumentation IMPLEMENTED (UNCOMMITTED, revertible). NEW
  `bim-3d/scene/bim3d-perf-diag.ts` (`window.__bim3dPerf`: renderCount/avg/max + dirty-reason
  histogram + `markSceneDirty` caller histogram πίσω από `dxf-trace-dirty`=1). Hooks: 2 call-sites
  στο `ThreeJsSceneManager` (tick timing+sample, markSceneDirty trace). Test protocol → Giorgio.
