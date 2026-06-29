# HANDOFF — 3D gizmo-drag lag: GPU back-pressure → adaptive-quality on interaction

**Date:** 2026-06-29
**Domain:** DXF Viewer / BIM 3D viewport — interaction performance
**Related ADRs:** ADR-516 (timing/latency SSoT), ADR-366 §B.5 (adaptive shadows/SSAO refine-on-idle), ADR-549 (3d cursor latency), ADR-402 (gizmo editing), ADR-040 (render-gating SSoT)
**Status:** Root cause for the REMAINING lag identified & measured. Phase-1 fixes DONE (uncommitted). Phase-2 (the real 1:1) NOT started — this handoff specifies it.

---

## 1. Πρόβλημα (Giorgio's report)

Στο `http://localhost:3000/dxf/viewer`, όταν μετακινείς οντότητα BIM σύροντας έναν **άξονα του gizmo** στην 3D προβολή, η οντότητα **ακολουθεί τον κέρσορα με ορατό lag** — «σέρνεται» και φτάνει στη θέση **αφού** σταματήσει ο κέρσορας.

**Απαίτηση:** ο OS hardware cursor μένει 0ms (CSS `cursor`, ADR-549 Phase 8 — **μην τον αγγίξεις**), και η οντότητα να τον ακολουθεί **1:1**. Big-player επίπεδο (Revit / Cinema 4D / Figma).

## 2. Διαγνωστική αλυσίδα (ΜΕΤΡΗΜΕΝΗ στον browser — μην επαναλάβεις τις λάθος υποθέσεις)

Δοκιμάστηκαν & **ΑΠΟΡΡΙΦΘΗΚΑΝ** ως κύρια αιτία (όλα με console diagnostics):
- ❌ Input prediction / latency-compensation (28ms present latency) — υπαρκτό αλλά **αμελητέο** (prediction ahead ~4-19px).
- ❌ Render-on-input (RAF wait) — **επιδείνωνε** (σύγχρονο render μπλόκαρε το thread → αραίωνε events).

**ΠΡΑΓΜΑΤΙΚΗ ρίζα (μετρημένη, throttled console diagnostics στο `tick`/`renderSceneFrame`/`renderRaster`):**
1. Το `renderSceneFrame` διαλέγει quality-path από `isInteracting`: true → φθηνό raster (SSAO+shadows OFF ~3ms)· false → πλήρες refine-on-idle SSAO+shadow composer (**30-108ms σε αδύναμη GPU**). Το `isInteracting` το άναβαν **μόνο** τα OrbitControls (camera). Ένα gizmo/grip drag κάνει `setControlsEnabled(false)` → flag έμενε **false** → η σκηνή πλήρωνε idle-refine SSAO **κάθε frame ενώ έσερνες**. → **ΔΙΟΡΘΩΘΗΚΕ** (βλ. §3).
2. Μετά το #1: `[DIAG-RASTER]` έδειξε `sceneRender: 1.1ms ↔ 50ms`, `postFxOverlays: 0.7ms ↔ 31ms`, outline silhouette spikes **έως 88ms** — **ακραία διακύμανση = GPU BACK-PRESSURE**. Το πραγματικό GPU work είναι μικρό· το CPU μπλοκάρει περιμένοντας το **κορεσμένο GPU** (αδύναμο hardware + **DXF κάτοψη φορτωμένη = χιλιάδες line segments** που ζωγραφίζονται κάθε frame). Outline off κατά interacting → **ΔΙΟΡΘΩΘΗΚΕ** το spike. **Το base GPU back-pressure ΜΕΝΕΙ — αυτό είναι το Phase-2.**

**Hardware (Giorgio):** `devicePixelRatio = 0.8`, canvas ~1275×941 (μικρό buffer → ΟΧΙ fill-rate· το πρόβλημα είναι throughput/queue στα 60fps). Αδύναμο PC (βλ. CLAUDE.md N.17).

## 3. Τι ΔΙΟΡΘΩΘΗΚΕ ήδη (UNCOMMITTED — commit κάνει ο Giorgio)

| Αρχείο | Αλλαγή |
|---|---|
| `bim-3d/scene/ThreeJsSceneManager.ts` | NEW `setInteracting(active)` — θέτει `isInteracting` + markSceneDirty (το render-gating SSoT για non-camera drags). |
| `bim-3d/animation/bim3d-edit-interaction-handlers.ts` | gizmo+grip drag begin → `setInteracting(true)`· up/cancel → `setInteracting(false)`. + input-prediction wiring (visual-only, raw commit). + `pointerPredictor` στο `EditInteractionCtx`. |
| `bim-3d/animation/use-bim3d-edit-interaction.ts` | `createPointerPredictor(DXF_TIMING.prediction)` instance στο ctx. |
| `bim-3d/scene/scene-render-frame.ts` | **outline silhouette OFF κατά `interacting`** (`&& !interacting`) — αφαιρεί τα 88ms spikes. |
| `bim-3d/gizmo/pointer-prediction.ts` (NEW) | pure predictor (EMA velocity × horizon, clamp, decay-to-zero). Δευτερεύον — `DXF_TIMING.prediction.ENABLED` toggle. |
| `bim-3d/gizmo/__tests__/pointer-prediction.test.ts` (NEW) | 6/6 GREEN. |
| `config/dxf-timing.ts` | NEW `DXF_TIMING.prediction` group (SSoT). |
| `docs/.../ADR-516-timing-latency-ssot.md` | changelog (πλήρες ταξίδι + ρίζα). |

**Όλα τα console diagnostics ΑΦΑΙΡΕΘΗΚΑΝ. tsc 0 (touched files), jest 6/6.** Το `ssao-modulator.ts` επανήλθε στο αρχικό (μόνο diagnostics μπήκαν/βγήκαν).

⚠️ **Shared working tree με άλλον agent.** Στην αρχή της session ήταν modified (από Phase 8, ΟΧΙ δικά μου): `BimViewport3D.tsx`, `BimViewport3DCanvasOverlays.tsx`, `CanvasLayerStack.tsx`, `useCrosshairCursor.ts`. **Μην τα αγγίξεις/commitάρεις.** Stage ΜΟΝΟ τα 8 αρχεία του §3.

## 4. Phase-2 — ΤΟ ΠΡΑΓΜΑΤΙΚΟ 1:1 (big-player adaptive quality on interaction)

Στόχος: όταν `isInteracting` (gizmo/grip drag **ή** camera drag), ρίξε δραστικά το GPU work/frame ώστε το GPU να προλαβαίνει στα 60fps· επανέφερε πλήρη ποιότητα στο rest. Αυτό κάνουν **Revit "fast display mode" / Fusion 360 / Cinema 4D interactive redraw / Figma**: interaction = lower-fidelity, settle = full refine.

Δύο μοχλοί (κατά σειρά πιθανού κέρδους):
- **(α) Resolution scaling** κατά interaction — `renderer.setPixelRatio(scaled)` (π.χ. 0.5×) + resize composer/SSAO/passes, upscale στο present. Big-player standard για GPU-bound.
- **(β) DXF overlay hide/simplify** κατά interaction — η DXF κάτοψη (χιλιάδες lines) ζωγραφίζεται κάθε frame· κρύψ' την ή simplify κατά το drag.

## 5. 🔴 SSoT AUDIT — ΥΠΑΡΧΟΝ pattern ΝΑ ΕΠΕΚΤΑΘΕΙ (μην φτιάξεις νέο μηχανισμό!)

**Το adaptive-quality-on-interaction pattern ΥΠΑΡΧΕΙ ΗΔΗ.** Grep πρώτα — μην διπλασιάσεις:

- **`bim-3d/scene/scene-idle-handlers.ts`** = ο SSoT των active/idle transitions. Καλεί ΗΔΗ `qualityModulator.onCameraActive()/onCameraIdle()` + `ssaoModulator.onCameraActive()/onCameraIdle()`.
- **`bim-3d/lighting/quality-modulator.ts`** = ΗΔΗ adaptive quality (`onCameraActive/onCameraIdle` → shadow map 2048/r4 ⇄ moving 1024/r0.5). **ΕΔΩ προσθέτεις resolution-scale** (ή sibling modulator που καλείται από το ίδιο SSoT).
- **`bim-3d/lighting/idle-detector.ts`** + `notifyActive/notifyIdle` (threshold) → καλεί τα `onActive/onIdle` callbacks. Το `renderSceneFrame` το τροφοδοτεί από `isInteracting`.
- **Σύνδεση που ΗΔΗ ισχύει:** το Phase-1 `setInteracting(true)` (gizmo drag) → `isInteracting=true` → `idleDetector.notifyActive()` → `onActive` → `qualityModulator.onCameraActive()` + `ssaoModulator.onCameraActive()`. **Άρα ό,τι προσθέσεις στο active/idle SSoT ενεργοποιείται ΑΥΤΟΜΑΤΑ και για gizmo drag ΚΑΙ για camera drag.** Αυτό είναι το καθαρό σημείο επέκτασης.
- **Resolution SSoT:** `bim-3d/scene/scene-manager-resize.ts` → `applyDevicePixelRatioSync` / `applyViewportResize` (`SceneResizeDeps`)· `bim-3d/scene/scene-setup.ts` → `bimPixelRatio()` (`min(devicePixelRatio, 2)`) + `getRendererViewportSize`. Χρησιμοποίησέ τα — μην γράψεις νέο resize.
- **DXF overlay object:** grep `runSyncDxfOverlay` / `DxfToThreeConverter` / `dxfOverlay` στο `scene-manager-sync.ts` + `ThreeJsSceneManager.ts` για το group που κρύβεις.

## 6. Constraints (CLAUDE.md)

- **Γλώσσα:** απάντα στον Giorgio **ΕΛΛΗΝΙΚΑ** πάντα.
- **Commit/push:** ΜΟΝΟ ο Giorgio. Ποτέ εσύ (N.-1). Ποτέ `--no-verify`.
- **SSoT audit ΠΡΙΝ κώδικα:** grep για υπάρχοντα (βλ. §5). Reuse, όχι διπλότυπα. Big-player practice· full enterprise + full SSoT.
- **Shared working tree:** stage μόνο δικά σου αρχεία. Μην `git add -A`.
- **ADR-040 CHECK 6B/6D:** `scene-render-frame.ts`/`ThreeJsSceneManager.ts`/cursor files = performance-critical → stage ADR (ADR-516/040) στο ίδιο commit.
- **N.17:** ΕΝΑ tsc τη φορά (έλεγξε process πριν). Μικρές αλλαγές → skip tsc.
- **N.7.1:** files <500 γρ., functions <40 γρ.

## 7. Verification

- Browser: `localhost:3000/dxf/viewer` → επίλεξε BIM οντότητα → σύρε άξονα gizmo **γρήγορα** με DXF κάτοψη φορτωμένη → η οντότητα συμπίπτει 1:1 με τον OS cursor, μηδέν «σέρσιμο».
- Επανέφερε προσωρινά τα throttled console diagnostics (μοτίβο: `[DIAG-RASTER] sceneRender:X postFxOverlays:Y` στο `ssao-modulator.renderRaster`) για να επιβεβαιώσεις ότι το frame-cost έπεσε & σταθεροποιήθηκε (όχι 1↔50ms διακύμανση). **Αφαίρεσέ τα πριν παραδώσεις.**
- Στο rest: full SSAO + shadows + outline + full resolution επανέρχονται (crisp frame).
- jest: `npx jest pointer-prediction` (6/6). tsc 0.
