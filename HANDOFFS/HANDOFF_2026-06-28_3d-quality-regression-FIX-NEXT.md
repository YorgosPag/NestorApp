# HANDOFF 2026-06-28 — 🔴 3D ΠΑΛΙΝΔΡΟΜΗΣΗ ΠΟΙΟΤΗΤΑΣ (διόρθωση — επόμενο βήμα)

**ΚΑΤΑΣΤΑΣΗ:** Μετά από αλλαγές **3 πρακτόρων** (perf cleanup), η αίσθηση **ΧΕΙΡΟΤΕΡΕΨΕ ΔΡΑΜΑΤΙΚΑ**.
Όλα **UNCOMMITTED** σε **SHARED working tree**. Ο Giorgio κάνει commit, ΟΧΙ ο agent.
Δουτρίνα: **big-player (Revit / Maxon Cinema4D)**. Full enterprise + full SSoT· αν οι big players δεν το
προτείνουν, ακολούθησε τη δική τους πρακτική. **ΠΡΙΝ ΚΩΔΙΚΑ → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep)**, reuse, μηδέν διπλότυπα.

---

## 🔴 ΣΥΜΠΤΩΜΑΤΑ (λόγια Giorgio)
1. **2D→3D μετάβαση** (κουμπί) **πολύ αργή**.
2. **Ποιότητα 3D πολύ χαμηλή**, **χειρότερη στην περιστροφή**.
3. **Όταν σταματάω** pan/περιστροφή → **οι ακμές γίνονται πολύ χαμηλής ανάλυσης** (και ΜΕΝΟΥΝ έτσι).
4. **Κέρσορας αργεί & «κολυμπάει» ΚΑΙ στο 2D ΚΑΙ στο 3D**, **χειρότερα σε fullscreen / μεγάλη οθόνη**.

## 🎯 ΡΙΖΕΣ (υποθέσεις, χαρτογραφημένες σε αλλαγές πρακτόρων)

| Σύμπτωμα | Πιθανή ρίζα | Πού |
|---|---|---|
| #3 «ακμές χαμηλής ανάλυσης ΜΕΤΑ το stop» **(ΤΟ #1 BUG)** | ΝΕΟΣ **`ResolutionModulator`** ρίχνει `renderer.setPixelRatio(base×0.6)` στο **camera-active**, αλλά η **ΕΠΑΝΑΦΟΡΑ** (camera-idle) περνά μέσα από το **`autoPreviewEnabled` gate (default OFF)** → **ΔΕΝ επαναφέρει ποτέ** → μένει 0.6× μόνιμα. | `bim-3d/lighting/` (ResolutionModulator) + `scene/scene-idle-handlers.ts:~25` (`if(!autoPreviewEnabled)return;` ΠΡΙΝ τα modulators) |
| #2 «ποιότητα χαμηλή» μόνιμα | **`antialias:false`** (MSAA off) **χωρίς** FXAA/post-AA αντικατάσταση → μόνιμα τραχιές/aliased ακμές. Οι big players που κόβουν MSAA βάζουν **post-AA (FXAA/SMAA/TAA)**. | `scene/scene-setup.ts:createBimRenderer` |
| #2 «χειρότερη στην περιστροφή» | `ResolutionModulator` 0.6× + `QualityModulator` σκιές 1024/radius0.5 στην κίνηση (σωστή big-player τακτική **αν** επανέρχεται στο settle — βλ. #3). | idem |
| #1 «2D→3D αργή» | mount BimViewport3D + νέα subsystems (collectors, UnifiedPerformanceHudLeaf RAF, modulators) + ίσως i18n boot preloads. **Χρειάζεται production-build trace στο toggle** — όχι μάντεμα. | `viewport/BimViewport3D.tsx`, `scene/scene-rendering-subsystems.ts` |
| #4 «κέρσορας κολυμπάει 2D+3D, fullscreen χειρότερα» | fullscreen=μεγαλύτερο framebuffer→per-frame κόστος· πιθανώς **collectors/HUD RAF** (`Performance2DCollector`+`UnifiedPerformanceHudLeaf`) τρέχουν συνεχώς, ή το per-frame κόστος μπλοκάρει το main thread. | `performance/Performance2DCollector`, `components/dxf-layout/UnifiedPerformanceHudLeaf.tsx` |

> **ΚΛΕΙΔΙ:** Η υποβάθμιση-στην-κίνηση είναι **σωστή** big-player τακτική. Το BUG είναι ότι η **ΕΠΑΝΑΦΟΡΑ-στο-settle
> είναι ΚΛΕΙΔΩΜΕΝΗ πίσω από το `autoPreviewEnabled` (default OFF)**. Η υποβάθμιση είναι **performance** feature (πάντα ON)·
> ΔΕΝ πρέπει να μοιράζεται gate με το photorealism preview. **Ξεκόλλησε το restore από το autoPreview gate.**

## ✅ ΣΧΕΔΙΟ ΕΠΟΜΕΝΗΣ SESSION (SSoT-audit-first, big-player)
1. **SSoT AUDIT (grep ΠΡΩΤΑ):** `ResolutionModulator`, `QualityModulator`, `scene-idle-handlers`, `autoPreviewEnabled`,
   `setPixelRatio`, `IdleDetector`. Κατάλαβε ΑΚΡΙΒΩΣ πώς wire-άρονται active/idle πριν αγγίξεις κώδικα.
2. **FIX #3 (ρίζα):** το **restore της ανάλυσης/σκιών στο settle να τρέχει ΠΑΝΤΑ** (έξω από το `autoPreview` gate).
   Big players: full res/AA όταν idle, μειωμένα μόνο όσο κινείται. Επιβεβαίωσε ότι `setPixelRatio` επανέρχεται στο base.
3. **FIX #2:** πρόσθεσε **cheap post-AA (FXAA)** ως post-pass (ή re-enable AA στο idle) ώστε οι ακμές να μην είναι μόνιμα aliased
   τώρα που έφυγε το MSAA. (Big-player: post-AA όταν κόβεις MSAA.)
4. **#1 + #4:** πάρε **production-build trace** (ΟΧΙ dev — dev runtime = 86% θόρυβος) στο 2D→3D toggle + cursor move·
   εντόπισε αν collectors/HUD RAF τρέχουν συνεχώς· σταμάτα ό,τι περιττό.
5. Μην reverse-άρεις τις ΚΑΛΕΣ διορθώσεις (βλ. κάτω). Στόχευσε ΜΟΝΟ το regression.

---

## 📦 ΟΛΕΣ ΟΙ UNCOMMITTED ΑΛΛΑΓΕΣ (3 πράκτορες + εγώ) — μην τις χαλάσεις, στόχευσε το regression
**Agent A (ribbon/i18n):** ADR-547 retained-mode ribbon (RibbonFieldStore)· i18n preload `dxf-schedule`+`tool-hints` (`config.ts`,`lazy-config.ts`).
**Agent B (3D quality/FPS):** `scene-setup.ts` (antialias→false, PCFSoft→PCF, σκιές 2048→1024)· **ΝΕΟΣ `ResolutionModulator`** (setPixelRatio×0.6 στην κίνηση)· `QualityModulator` wiring στο `scene-rendering-subsystems.ts`+`scene-idle-handlers.ts`· **FPS metric fix** `PerformanceCollector.ts` (real RAF fps μέσω `UnifiedFrameScheduler.onFrame`)· `MaterialCatalog3D.ts`· scene-render-stats.
**Εγώ (this session, 6 fixes — ΟΛΑ ΚΑΛΑ, tsc-clean, 38 jest):**
1. DXF underlay idempotent `sync()` (`dxf-overlay-sync-guard.ts`+`DxfToThreeConverter.ts`) — ✅ trace-verified.
2. BVH per-pick walk skip (`bvh-setup.ts`+`scene-manager-actions.ts`).
3. Snap overlays subscription granularity (`snap-3d-glyph-key.ts`+2 overlays).
4. Section caps γκρι στο hover (`pointer-activity.ts`+`bim3d-pointer-scheduler.ts`+`section-scene-controller.ts`).
5. **`preserveDrawingBuffer:false`** (`scene-setup.ts`+`ThreeJsSceneManager.captureFrameDataURL`+`performance-snapshot-service.ts`).
6. Offscreen renderer SSoT (`createOffscreenCaptureRenderer` στο `scene-setup.ts` ← `MP4Exporter.ts`+`capture-3d.ts`).
→ Λεπτομέρειες: `HANDOFFS/HANDOFF_2026-06-28_3d-perf-fillrate-6-fixes.md` + ADR-040 (5 changelog entries).

## ⚠️ ΚΡΙΣΙΜΗ ΓΝΩΣΗ
- **SSAO/idle escalation = opt-in** (`autoPreviewEnabled` default OFF, `scene-idle-handlers.ts`). Default path = `renderRaster()`. **Το ίδιο gate μπλοκάρει το resolution-restore = το BUG #3.**
- **Render dirty-gated** (`ThreeJsSceneManager.tick` μόνο όταν `isSceneDirty()`).
- **Ο μετρητής FPS ΗΤΑΝ ΣΠΑΣΜΕΝΟΣ** (έδειχνε ~4 fps ψεύτικα)· διορθώθηκε (Agent B). **Μέτρα με production trace, όχι με το παλιό HUD.**
- **N.17:** ΕΝΑ tsc τη φορά (έλεγξε process). **CHECK 6B/6D:** αλλαγές σε scene-setup/ThreeJsSceneManager/render → stage **ADR-040**.
- **Big-player doctrine:** degrade-during-motion = ΝΑΙ· **always restore-on-idle** = ΝΑΙ· MSAA off → **βάλε FXAA**.

## 🔬 ΕΡΓΑΛΕΙΟ ΓΙΑ #4 (cursor lag) — μέτρησε ποντίκι↔σταυρόνημα phase (Giorgio idea, big-player = Chrome INP/Event Timing)
**Πριν διορθώσεις το cursor lag, ΜΕΤΡΗΣΕ το** (όχι μάντεμα). Το `event.timeStamp` κάθε `mousemove` = ώρα OS
(ίδιο ρολόι με `performance.now()`). NEW dev-only instrument (gated, π.χ. `?debugCursorLag=1`), στον ΙΔΙΟ
capture-phase window mousemove listener που οδηγεί το σταυρόνημα (`BimCrosshairOverlay3D` 3D / `CrosshairCompositor` 2D):
- **inputLatency** = `performance.now() − e.timeStamp` (event ouρά· μεγάλο ⇒ main thread μπλοκάρει = το lag).
- **totalLag** = `paintTime(RAF) − e.timeStamp` (OS→paint).
- **coalesced** = `e.getCoalescedEvents().length` (πολλά ⇒ σταυρόνημα «πηδάει»/κολυμπάει).
- **οπτικό:** debug dot στο raw `e.clientX/Y` δίπλα στο σταυρόνημα → δες απόκλιση.

**Ερμηνεία:** inputLatency μεγάλο → φταίει το βαρύ render (fill-rate/σκιές, main-thread busy)· inputLatency~0 αλλά
σταυρόνημα lag → φταίει το update path του σταυρονήματος (React/RAF/transform). **SSoT audit ΠΡΩΤΑ** (υπάρχει ήδη
`systems/cursor/` instrumentation; grep `ImmediatePositionStore`/`registerDirectRender` πριν φτιάξεις νέο).
> ⚠️ Άλλος agent ήδη πρόσθεσε στο `bim3d-pointer-scheduler.ts` guard «skip hover/snap pick WHILE camera interacting»
> (`manager.isCameraInteracting()`) + επανέφερε `antialias:true` στο `scene-setup.ts`. Λάβ' τα υπόψη (μη revert).

## Πηγές
`local_ΑΝΑΦΟΡΑ_5.txt` (1367 γρ., όλες οι αλλαγές 3 πρακτόρων) · ADR-040 (perf SSoT) · ADR-366 §B.5 (3D HUD/render) · ADR-452/455 (section).
Memory: [[feedback_giorgio_ssot_audit_before_new_mechanism]] · [[reference_3d_cursor_lag_decoupling]].
