# HANDOFF — 3D cursor «swim»: ΑΠΟΔΕΔΕΙΓΜΕΝΟΣ ένοχος = το 3D scene render pass (bisection)

**Ημ/νία:** 2026-06-29 · **ADR:** 366 §B.5 (3D BIM viewer rendering) · **Model:** Opus 4.8
**Working tree:** ΚΑΘΑΡΟ (HEAD) — όλες οι διαγνωστικές αλλαγές έγιναν revert με `git restore`.

---

## 0. TL;DR — τι ξέρουμε με ΒΕΒΑΙΟΤΗΤΑ (όχι εικασία, browser-proven)

Ο κέρσορας/σταυρόνημα στο **3D BIM viewport «κολυμπάει»** (δεν είναι 1:1), παντού & σε production.

Με **bisection απομόνωσης** (σκοτώσαμε ένα-ένα τα συστήματα με hard `DIAG_*_DEAD` guards, browser reload + test σε κάθε βήμα) ο Giorgio επιβεβαίωσε:

| # | Τι σκοτώσαμε | Αποτέλεσμα στο swim |
|---|-------------|---------------------|
| 1 | Ribbon (RibbonRoot + ContextualTabScope) | ❌ κολυμπάει ακόμα |
| 2 | Σκιές (ShadowModulator force-OFF κάθε frame) | ❌ **κολυμπάει ακόμα** |
| 3 | Floating panels (2D) | ❌ κολυμπάει ακόμα |
| 4 | Sidebar panel (Επίπεδα/Ρυθμίσεις DXF/Ιδιότητες/Διαστάσεις/Υλικά/BIM 3D) | ❌ κολυμπάει ακόμα |
| 5 | ProSnapToolbar (popover) | ❌ κολυμπάει ακόμα |
| 6 | Κάτω CAD status bar (OSNAP/SNAP/ΟΡΘΟ/POLAR/LTSCALE…) | ❌ κολυμπάει ακόμα |
| 7 | Render button «✦ Δημιουργία» | ❌ κολυμπάει ακόμα |
| 8 | Top status bar (live X,Y συντεταγμένες) | ❌ κολυμπάει ακόμα |
| 9 | 3D slider τομών (CutPlaneSlider3DLeaf) | ❌ κολυμπάει ακόμα |
| 10 | **Hover highlight + φωτισμοί οντοτήτων** (bim3d-pointer-scheduler) | ❌ **κολυμπάει ακόμα** |
| 11 | **ΟΛΟ το 3D render** (`renderSceneFrame` skip στο `ThreeJsSceneManager.tick`) | ✅ **ΣΤΑΜΑΤΗΣΕ ΠΛΗΡΩΣ** |

### 🎯 ΣΥΜΠΕΡΑΣΜΑ (αποδεδειγμένο)
**Ένοχος = το 3D scene render pass (`renderSceneFrame` / `bim-3d-scene` tick στον `UnifiedFrameScheduler`).** Όλα τα UI panels / ribbon / status bars / snap bar / hover είναι **ΑΘΩΑ**. Το lag εξαφανίστηκε ΜΟΝΟ όταν σταμάτησε εντελώς το render.

### ⚠️ ΚΡΙΣΙΜΗ ΕΚΛΕΠΤΥΝΣΗ (αλλάζει την αρχική υπόθεση του προηγ. handoff)
Το προηγούμενο handoff υπέθετε ότι ο ένοχος είναι οι **σκιές (40ms PCF)**. **Η bisection το ΔΙΑΨΕΥΔΕΙ μερικώς:**
- Σκοτώνοντας **ΜΟΝΟ τις σκιές** (#2) → swim **ΠΑΡΕΜΕΙΝΕ**.
- Σκοτώνοντας **ΜΟΝΟ το hover** (#10) → swim **ΠΑΡΕΜΕΙΝΕ**.
- Μόνο σκοτώνοντας **ΟΛΟΚΛΗΡΟ το `renderSceneFrame`** (#11) → swim **σταμάτησε**.

➡️ Άρα ο ένοχος **ΔΕΝ είναι μόνο οι σκιές ούτε μόνο το hover-render**. Είναι το **render pass συνολικά** — είτε (α) το **base raster render κόστος** (`ssaoModulator.renderRaster()` + overlays + per-frame bookkeeping στο `renderSceneFrame`), είτε (β) **πόσο ΣΥΧΝΑ** καλείται (η σκηνή μένει dirty σχεδόν κάθε frame κατά το σάρωμα), είτε (γ) και τα δύο. Ο σύγχρονος (sync) render μέσα στο RAF μπλοκάρει το main thread → starve-άρει το paint/mousemove → swim.

**➡️ ΠΡΩΤΗ ΔΟΥΛΕΙΑ ΤΗΣ ΕΠΟΜΕΝΗΣ ΣΥΝΕΔΡΙΑΣ: PROFILE — να αποδειχθεί ΠΟΙΟ από τα (α)/(β)/(γ) ισχύει, ΠΡΙΝ γραφτεί fix.** Μη γράψεις fix με βάση εικασία.

---

## 1. ΤΙ ΥΠΑΡΧΕΙ ΗΔΗ ΣΤΟ HEAD (διαγνωστικά εργαλεία — committed)

Διαθέσιμα localStorage flags (no-op σε production), για A/B χωρίς κώδικα:
```js
localStorage.setItem('dxf-no-render','1')    // skip ΟΛΟ το 3D scene tick (ThreeJsSceneManager.tick)
localStorage.setItem('dxf-no-shadows','1')   // σκιές OFF (scene-render-frame)
// cleanup:
['dxf-no-render','dxf-no-shadows'].forEach(k=>localStorage.removeItem(k))
```
**ΠΡΟΣΟΧΗ — ΕΓΙΝΑΝ REVERT (ΔΕΝ υπάρχουν πια στο HEAD):**
- `dxf-no-pick` flag (ήταν uncommitted στο `bim3d-pointer-scheduler.ts`).
- Per-system **`frame.<id>` instrumentation** στον `UnifiedFrameScheduler.ts` (ήταν uncommitted· **αυτό** είχε δώσει το αρχικό 40ms νούμερο). **Αν χρειαστείς ξανά per-system/per-phase timing → πρέπει να το ξανα-προσθέσεις** (είναι ADR-040 critical file — δες §4).

---

## 2. ΤΟ ΕΠΟΜΕΝΟ ΒΗΜΑ — η πραγματική διόρθωση (big-player doctrine)

**Στόχος:** το 3D scene render να ΜΗΝ μπλοκάρει/starve-άρει τον κέρσορα κατά την ενεργή εργασία — όπως οι μεγάλοι παίκτες (Revit / Maxon Cinema4D / Autodesk Forge-APS Viewer / iModel.js / Three.js Editor).

### 2.0 ΠΡΩΤΑ — PROFILE (πριν κώδικα)
Απάντησε με δεδομένα (ξανα-πρόσθεσε ελαφρύ instrumentation ή χρησιμοποίησε τα flags):
1. **Πόσο συχνά** καλείται το `renderSceneFrame` σε ένα ΚΑΘΑΡΟ cursor sweep (χωρίς camera move); Κάθε frame; → τότε η σκηνή μένει dirty συνεχώς → βρες ΠΟΙΟΣ καλεί `markSceneDirty` (ή ποιο flag στο `isSceneDirtyFromState` μένει true: `isInteracting` / `viewportAnimating` / `animationManagerActive` / `pathTracerActive` / `explicitDirty`).
2. **Πόσο κοστίζει** το base raster (`renderRaster`) ΧΩΡΙΣ σκιές; (`dxf-no-shadows`=1 + μέτρα). Αν είναι ακόμα >16ms σε 546 τρίγωνα → παθολογικό fullscreen fill-rate (texture/overlay/SSAO composer) → SSOT audit στο render body.
3. Είναι ενεργό το **SSAO composer**; `useViewMode3DStore.getState().autoPreviewEnabled` — αν `true`, τρέχει FBO round-trip κάθε frame.

### 2.1 Κατευθύνσεις διόρθωσης (big-player, ιεραρχία — επιβεβαίωσε με profile πρώτα)
1. **On-demand rendering (ΟΧΙ per-frame).** Industry convergence (Forge/APS, iModel.js, Three.js Editor, AutoCAD Web): single master RAF + per-subsystem dirty check + render ΜΟΝΟ όταν κάτι άλλαξε. Αν η σκηνή render-άρει κάθε frame κατά το σάρωμα ενώ τίποτα ορατό δεν αλλάζει → εκεί είναι το bug. Κόψε τα spurious `markSceneDirty` / σταμάτησε το animating-flag που μένει κολλημένο.
2. **Adaptive degradation κατά την κίνηση** (Revit Ambient Shadows OFF στην πλοήγηση· Forge "navigation downscale"): φθηνό raster εν κινήσει, ακριβό quality (σκιές/SSAO/AA) ΜΟΝΟ σε γνήσιο idle (υπάρχει ήδη `IdleDetector` + `DXF_TIMING.gesture.CAMERA_IDLE=800` — **REUSE, ΜΗ φτιάξεις νέο timer**), με ΑΚΥΡΩΣΗ pending refine αν ξαναρχίσει κίνηση.
3. **Μην starve-άρει το paint:** ο σύγχρονος render μέσα στο RAF + ο pointer-pick + ο compositor μοιράζονται το main thread. Εξέτασε priority/budget στον `UnifiedFrameScheduler` ώστε ο κέρσορας να παίρνει προτεραιότητα.

### 2.2 SSOT AUDIT ΠΡΙΝ ΚΩΔΙΚΑ (grep — ΥΠΟΧΡΕΩΤΙΚΟ, reuse, μηδέν διπλότυπα)
- `bim-3d/scene/scene-render-frame.ts` — το render body (raster vs SSAO composer vs section caps). **Εδώ αποφασίζεται τι κοστίζει.**
- `bim-3d/scene/ThreeJsSceneManager.ts` — `tick()` / `isSceneDirty()` / `markSceneDirty()` + **όλοι οι ~20 callers του `markSceneDirty`** (γιατί render-άρει· grep `markSceneDirty`).
- `bim-3d/scene/scene-dirty-state.ts` — `isSceneDirtyFromState` (pure dirty predicate, 5-input OR).
- `bim-3d/lighting/idle-detector.ts` + `DXF_TIMING.gesture.CAMERA_IDLE=800` — **υπάρχει ήδη** genuine-idle SSoT· REUSE.
- `bim-3d/lighting/{shadow,ssao,quality}-modulator.ts` — οι ΥΠΑΡΧΟΝΤΕΣ modulators (ON↔OFF, soft↔sharp, composer).
- `bim-3d/scene/scene-idle-handlers.ts` — `onIdle`/`onActive` (πού μπαίνει το escalation/degrade· SSAO gated πίσω από `autoPreviewEnabled`).
- `rendering/core/UnifiedFrameScheduler.ts` — RAF orchestrator (⚠️ ADR-040 critical — §4).
- `bim-3d/viewport/snap/bim3d-pointer-scheduler.ts` — τι κάνει dirty κατά το hover/sweep (`runPick` → `markSceneDirty`).
- `systems/cursor/*` (ImmediatePositionStore / ImmediateTransformStore / CrosshairCompositor) — ο κέρσορας/compositor είναι **ήδη βέλτιστος** (sync mousemove + GPU translate3d)· ΜΗΝ τον αλλάξεις.

---

## 3. ΚΑΝΟΝΕΣ (ΥΠΟΧΡΕΩΤΙΚΟΙ)
- **Big-player doctrine:** Revit / Maxon Cinema4D. **FULL ENTERPRISE + FULL SSOT.** Αν οι big players δεν το προτείνουν → ακολούθησε τη δική τους πρακτική.
- **SSOT AUDIT ΠΡΙΝ ΚΩΔΙΚΑ (grep)** για υπάρχοντα μηχανισμό → reuse, **ΜΗΔΕΝ διπλότυπα** (§2.2).
- **PROFILE ΠΡΙΝ FIX** — μη γράψεις κώδικα με εικασία· η bisection διέψευσε την «μόνο σκιές» υπόθεση.
- **COMMIT/PUSH τα κάνει ο GIORGIO**, όχι ο agent. Ποτέ `--no-verify`, ποτέ `git add -A`.
- **Working tree SHARED με άλλον agent** → μικρά focused edits.
- **N.17:** ΕΝΑ tsc τη φορά (στου Giorgio κάνει OOM — type-safety μέσω ts-jest + inspection).
- **ADR-040 CHECK 6B/6D:** το `UnifiedFrameScheduler.ts` ΕΙΝΑΙ micro-leaf critical → αν το αγγίξεις, **stage ADR-040**. Τα υπόλοιπα `bim-3d/*` πάνε με **ADR-366 §B.5**. Τα drawing/snap files (`bim3d-pointer-scheduler` κ.λπ.) → CHECK 6D, stage ADR.
- **Dev = ψέματα για perf** (~86% inflation). Μέτρα με per-system breakdown ή prod-build (`npm run build && npm run start`).
- N.14 model: **Opus** (cross-cutting render-loop/quality αρχιτεκτονική).

---

## 4. ΣΧΕΤΙΚΑ HANDOFFS (ιστορικό/δεδομένα)
- `HANDOFF_2026-06-29_3d-cursor-swim-scene-render-40ms-NEXT.md` — το αρχικό 40ms data + diag flags (η «μόνο σκιές» υπόθεση εκλεπτύνθηκε εδώ).
- `HANDOFF_2026-06-29_3d-perf-settle-tail.md` — settle-tail context.
