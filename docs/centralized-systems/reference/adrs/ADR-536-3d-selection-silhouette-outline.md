# ADR-536 — Cinema 4D / Revit-style selection **silhouette outline** στο BIM 3D viewport

**Status:** ✅ APPROVED (browser-verified) · **Date:** 2026-06-26 · **Domain:** DXF Viewer — 3D Rendering / Selection
**Supersedes (mechanism only):** ADR-366 A.1 (emissive highlight) · **Render-loop governance:** ADR-040
**Related performance:** ADR-452 (section cap tiering), ADR-535 (grip motion-hide)

---

## Context / Problem

Όταν επιλέγεται οντότητα στο BIM 3D, ο `BimSelectionHighlighter` **κλωνοποιούσε το material**
κάθε mesh και έβαζε **emissive σε ΟΛΟ το σώμα** → «βάφεται όλο το αντικείμενο» (άσχημο).
Ζητήθηκε **Cinema 4D / Revit**: να φωτίζεται **ΜΟΝΟ το εξωτερικό περίγραμμα (silhouette)** με
**πορτοκαλί** γραμμή, **χωρίς** αλλαγή στο material, ορατό **και κατά το orbit** (κάθε render path).

## Decision — **mask + dilate** (όχι OutlinePass)

Η σιλουέτα φτιάχνεται με την τεχνική που χρησιμοποιούν τα real-time engines (Unreal/Unity/Blender,
stencil/mask outline). Ανά frame με επιλογή, στο `SelectionOutlinePass.renderOverlayToScreen()`:
1. **Render ΜΟΝΟ τα επιλεγμένα meshes** (solid white, depth-less, double-sided) σε ένα mask RT —
   λίγα αντικείμενα, **όχι** όλη η σκηνή, **όχι** depth re-render, **όχι** blur.
2. **Ένα fullscreen dilate pass** (`ShaderMaterial`): κάθε «έξω» pixel εντός `uRadius` από τη
   μάσκα γίνεται **σταθερού πλάτους πορτοκαλί γραμμή**. Το χρώμα είναι **uniform** (όχι το RGB της
   σκηνής) → η γραμμή είναι **πάντα ίδιο πορτοκαλί**, ανεξάρτητα από το τι υπάρχει πίσω της.
   Σύνθεση με premultiplied "over" blend (`One / 1-SrcAlpha`).

### Γιατί ΟΧΙ OutlinePass (απορρίφθηκε μετά από δοκιμή)
Η αρχική υλοποίηση χρησιμοποιούσε `three/addons/postprocessing/OutlinePass`. Πρόβλημα: **re-render
ΟΛΗΣ της σκηνής (depth) + 2 blur passes κάθε frame** → αργό σε full-res (lag στο αδύναμο GPU),
θορυβώδες σε half-res, και το `edgeThickness` δεν είχε ορατό αποτέλεσμα (half-res threshold).
Το mask+dilate είναι **και φθηνότερο** (μόνο τα επιλεγμένα) **και crisp** (full-res, ακριβές πλάτος px).

### Χρώμα (SSoT)
`BIM_SELECTION_OUTLINE_COLOR_THREE = 0xffaa16` (RGB 255,170,22, πορτοκαλί). Τα **sRGB bytes
περνούν RAW** στον shader (`OUTLINE_COLOR_SRGB` Vector3): ένα raw `ShaderMaterial` ΔΕΝ εφαρμόζει
sRGB output transfer, και το `THREE.Color` θα μετέτρεπε σε linear → και τα δύο θα σκούραιναν/
ξεθώριαζαν το χρώμα. Mirror token-pattern του `accessibility/bim-a11y-color-tokens.ts`.

## Render-path coverage (όλα τα interactive paths, ίδια εμφάνιση)
Το overlay καλείται **ΜΕΤΑ** το render της σκηνής, σε κάθε non-pathTracer frame, μέσω
`SSAOModulator.renderOutlineOverlayToScreen()` (στο `scene-render-frame.ts`):
- **raster** (navigation), **SSAO-idle** (composer), **section-cut stencil** — και στους τρεις
  το overlay συντίθεται πάνω στο τελικό καρέ (το mask RT/dilate δεν εξαρτάται από τον path).
- Το outline **ΔΕΝ** είναι composer pass (το composer RT δεν έχει stencil + ο section τον παρακάμπτει).
- **Out of scope:** path-tracer (final-render mode).

**Composite entity** (πυρήνας+σοβάς+οπλισμός ίδιο bimId): όλα τα matching meshes μπαίνουν μαζί →
ΕΝΑ ενιαίο εξωτερικό silhouette (ο οπλισμός μέσα occluded). Σωστό.

## Files

**NEW**
- `bim-3d/systems/selection/selection-outline-tokens.ts` — SSoT χρώμα (`0xffaa16` + CSS).
- `bim-3d/systems/selection/SelectionOutlinePass.ts` — mask+dilate: `_maskMaterial` (white),
  `_maskRT`, dilate `ShaderMaterial` (constant-colour, premultiplied over)· `setSelected`/
  `hasSelection`/`selectedObjects`/`setCamera`/`renderOverlayToScreen(renderer)`/`dispose`.
- `__tests__/SelectionOutlinePass.test.ts` + ξαναγραμμένο `__tests__/BimSelectionHighlighter.test.ts`.

**MODIFY**
- `BimSelectionHighlighter.ts` — emissive/material-clone **αφαιρέθηκε**· συλλέγει τα matching meshes
  ανά bimId → `outlinePass.setSelected(meshes)`. Constructor `(group, outlinePass)`. API `onSelect/onClear` ίδιο.
- `ssao-modulator.ts` — κρατά το `outlinePass` (όχι στο composer)· `renderOutlineOverlayToScreen()`
  (sync camera + delegate)· dispose.
- `scene-render-frame.ts` — μετά το dispatch: `if (!pathTracer.isActive) renderOutlineOverlayToScreen()`.
- `scene-rendering-subsystems.ts` — δημιουργεί `SelectionOutlinePass`, το περνά στον `SSAOModulator`.
- `ThreeJsSceneManager.ts` — instantiate `BimSelectionHighlighter(group, outlinePass)` μετά τα subsystems.

## Verification
- **jest (ts-jest):** GREEN (`SelectionOutlinePass` + `BimSelectionHighlighter` + `bim-selection-actions`).
- **N.17:** όχι full tsc (OOM) — ts-jest + static check.
- **Browser (Giorgio):** ✅ επιβεβαιωμένο — πορτοκαλί silhouette, σώμα αναλλοίωτο, ορατό σε όλους τους paths.

## ADR-040 compliance
Καμία `useSyncExternalStore`/subscription σε orchestrator· κανένα νέο RAF. Το overlay καλείται μέσα
στο υπάρχον render frame. Αγγίζεται `scene-render-frame.ts` → stage ADR-040 μαζί (CHECK 6B/6D).

## Changelog
- **2026-06-26 v1** — emissive whole-body → silhouette. Αρχικά με OutlinePass-σε-composer.
- **2026-06-26 v2** — **Pivot σε mask+dilate** (OutlinePass = αργό/θορυβώδες). Constant-colour shader,
  premultiplied over, full-res, ακριβές πλάτος px. ✅ Browser-verified (Giorgio: «πολύ όμορφο»).
- **2026-06-26 v3** — Χρώμα → πορτοκαλί `#FFAA16` (RGB 255,170,22). **COMMITTED** (ddec50b0).
- **2026-06-26 v4** — Δοκιμάστηκαν & **απορρίφθηκαν** (έκαναν χειρότερα perf/look): hidden-edge
  dotted layer + refine-on-idle στο ίδιο το outline. Reverted· το outline μένει το committed v3.
  Η performance λύθηκε αλλού: ADR-452 (γκρι section caps στην κίνηση) + ADR-535 (κρύψιμο grips στην κίνηση).
