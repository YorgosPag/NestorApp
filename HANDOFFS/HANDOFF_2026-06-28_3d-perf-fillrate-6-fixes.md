# HANDOFF 2026-06-28 — 3D perf: fill-rate + per-frame churn (6 διορθώσεις, UNCOMMITTED)

**Πλαίσιο:** Ο Giorgio κυνηγά μήνες «βαρύ 3D (και λίγο 2D)». Browser-verified **fill-rate-bound**
(μικρό παράθυρο→ομαλό, zoom→βαρύ, σκηνή **546 τρίγωνα**, cores=4, pixelRatio=0.8). Επιβεβαιώθηκε
επίσης ότι μέρος του «βάρους» στο dev ήταν React dev-runtime (createTask/GC ~86% στο trace) — ΟΧΙ
production. Production (Netcup `nestorconstruct.gr`) καλύτερο αλλά **ακόμα βαρύ** → πραγματικό
fill-rate υπόλοιπο. **Πολλοί agents δουλεύουν παράλληλα** (claude/codex1/codex2).

> ⚠️ Ο μετρητής FPS ΗΤΑΝ ΣΠΑΣΜΕΝΟΣ (μετρούσε setInterval 250ms→~4fps ψεύτικα). Άλλος agent τον
> διόρθωσε (`bim-3d/performance/PerformanceCollector.ts` → real RAF fps). **Αγνόησε παλιές ενδείξεις FPS.**

---

## ✅ 6 ΔΙΟΡΘΩΣΕΙΣ — όλες UNCOMMITTED, tsc-clean, περιμένουν browser-verify + commit (Giorgio)

| # | Τι | Αρχεία | Tests |
|---|----|--------|-------|
| 1 | **DXF underlay idempotent `sync()`** — ξανα-ανέβαζε ΟΛΕΣ τις CanvasTextures στη GPU ανά resync (texSubImage2D **3.4s** στο trace). Guard: skip rebuild όταν drawn-entities+layersById+units αμετάβλητα. **✅ TRACE-VERIFIED** (upload→0.1%). | NEW `bim-3d/converters/dxf-overlay-sync-guard.ts`, MOD `DxfToThreeConverter.ts` | 17 |
| 2 | **BVH per-pick walk skip** — `ensureBoundsTrees` έκανε `traverse()` ΟΛΗΣ σκηνής ανά pick (20×/s). Per-root WeakSet «clean» + `markBvhDirty()` στα 2 BIM sync sites. | MOD `systems/raycaster/bvh-setup.ts`, `scene/scene-manager-actions.ts` | 6 |
| 3 | **Snap overlays subscription granularity** — `useSyncExternalStore` σε ΟΛΟ το marker → re-render σε position-only. Crosshair→boolean on/off· snap-indicator→glyph-key. | NEW `viewport/snap/snap-3d-glyph-key.ts`, MOD `BimCrosshairOverlay3D.tsx`, `BimSnapIndicatorOverlay3D.tsx` | 7 |
| 4 | **Section caps γκρι στο hover-sweep** — με ενεργό axis-cut, `renderAxisCutCap` έκανε 2×(1+N) πλήρη renders/frame (**20%** στο trace) σε κάθε hover. Pointer-motion → γκρι `'fast'`, refine-on-settle. | NEW `systems/pointer-activity.ts`, MOD `bim3d-pointer-scheduler.ts`, `section-scene-controller.ts` | 4 |
| 5 | **`preserveDrawingBuffer:false`** στον κύριο renderer — ανάγκαζε full-framebuffer copy/frame (κλιμακώνεται με μέγεθος παραθύρου = ΤΟ ΣΥΜΠΤΩΜΑ). Captures καλύφθηκαν on-demand. | MOD `scene/scene-setup.ts`, `ThreeJsSceneManager.ts` (`captureFrameDataURL`), `performance/performance-snapshot-service.ts` | — |
| 6 | **Ενοποίηση offscreen renderer** (SSoT) — MP4Exporter + print capture-3d είχαν ΤΑΥΤΟΣΗΜΟ `new WebGLRenderer({...})` → ΕΝΑΣ `createOffscreenCaptureRenderer()`. Μηδέν οπτική αλλαγή. | MOD `scene-setup.ts`, `animation/MP4Exporter.ts`, `print/capture/capture-3d.ts` | — |

**ADR:** όλα τεκμηριωμένα σε `ADR-040` changelog (5 entries, CHECK 6B/6D → stage ADR-040 με τα code).
**tsc:** #1-#5 exit 0 (verified). #6 verifying (type-trivial). **jest:** 38 πράσινα (#1-#4).

---

## 🔑 ΚΡΙΣΙΜΗ ΓΝΩΣΗ ΓΙΑ ΤΗΝ ΕΠΟΜΕΝΗ SESSION

- **SSAO/idle escalation είναι OPT-IN** (`useViewMode3DStore.autoPreviewEnabled`, default OFF — `scene-idle-handlers.ts:25`). Άρα ο default hover/orbit path = `ssaoModulator.renderRaster()`, ΟΧΙ SSAO composer. **Μην κυνηγήσεις SSAO** εκτός αν ο χρήστης το άναψε.
- **Render είναι dirty-gated** (`ThreeJsSceneManager.tick` μόνο όταν `isSceneDirty()`). Hover → `markSceneDirty` σε κάθε αλλαγή hoverId → συχνά frames.
- **Path-tracer final save** είναι ασφαλές χωρίς preserveDrawingBuffer: το capture γίνεται ΣΥΓΧΡΟΝΑ μέσα στο `PathTracerRenderer.renderSample` (γρ.88-91 → onComplete → toBlob, ίδιο task).
- **Άλλος agent ήδη έκανε** στο `scene-setup.ts`: antialias `true→false`, PCFSoft→PCF, σκιές 2048→1024. + `QualityModulator`/`PerformanceCollector` (FPS fix) = ΑΛΛΟΥ agent λωρίδα — **ΠΡΟΣΟΧΗ collision** σε αυτά τα αρχεία.

## 🔴 ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ (προτεραιότητα)
1. **Hard reload + δοκιμή 3D** (όλες οι αλλαγές uncommitted → θέλουν reload). Αυτό είναι το ΜΕΓΑΛΟ τεστ: feel orbit/zoom/hover.
2. **Commit** (Giorgio· stage τα ~13 code/test + ADR-040). N.(-1): ΟΧΙ commit χωρίς εντολή.
3. Αν ΑΚΟΜΑ βαρύ μετά reload: επόμενοι ύποπτοι = **shadow PCF sampling** (disable shadows κατά την κίνηση, reuse `pointer-activity`) + **DXF overlay overdraw** (`renderPostFxOverlays` transparent blending/frame).
4. (Low-pri) SSoT: registry ratchet για `new WebGLRenderer` εκτός factories· MP4/capture-3d capture-flow helper.

## Πηγές
ADR-040 (perf SSoT, 5 νέα changelog entries 2026-06-28) · ADR-366 §B.5 (3D viewer) · ADR-452/455 (section).
Memory: [[feedback_giorgio_ssot_audit_before_new_mechanism]] · [[reference_3d_cursor_lag_decoupling]].
