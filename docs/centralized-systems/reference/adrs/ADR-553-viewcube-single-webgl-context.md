# ADR-553 — ViewCube single WebGL context (scissored sub-viewport)

**Status:** 🟡 IMPLEMENTED (UNCOMMITTED)
**Date:** 2026-06-29
**Domain:** Canvas & Rendering / DXF Viewer / BIM 3D
**Implements:** ADR-551 §5.2 #6 (canvas/viewport census — consolidation opportunity #6)
**Related:** ADR-040 (micro-leaf render-loop), ADR-366 (3D BIM viewer), ADR-536/537 (post-FX overlay & selection-outline passes — the «extra AO-immune pass after main render» pattern)

---

## 1. Πρόβλημα

Το 3D BIM viewport σήκωνε **2 GPU WebGL contexts** (ADR-551 census, πίνακας §4):

1. **Main renderer** — `createBimRenderer()` (`bim-3d/scene/scene-setup.ts`), `THREE.WebGLRenderer({ antialias, alpha, stencil })`.
2. **ViewCube mini-renderer** — `bim-3d/viewport/view-cube/view-cube.ts` δημιουργούσε ΔΕΥΤΕΡΟ `new THREE.WebGLRenderer({ canvas })` πάνω σε δικό του 160×160 `<canvas>` (top-right, z-index:20), με δική του scene/`OrthographicCamera`/lights.

Ένα δεύτερο context σε ένα τόσο μικρό gizmo είναι σπατάλη GPU πόρων (διπλό context state, διπλό shader cache, browser context-limit pressure) και αποκλίνει από την πρακτική των μεγάλων web players.

## 2. Big-player verification

| Player | Πρακτική για nav-gizmo | Συμπέρασμα |
|--------|------------------------|-----------|
| **Three.js editor / `webgl_multiple_views`** | Scissored sub-viewports στο **ΕΝΑ** WebGL context (`setScissor`/`setScissorTest`/`setViewport`). | ✅ Υπέρ εξάλειψης. |
| **Autodesk APS (Forge) Viewer** | Ιστορικά ξεχωριστός μικρός overlay renderer για απομόνωση από το main post-FX pipeline. | ⚠️ Κρατά απομόνωση — αλλά εδώ η απομόνωση επιτυγχάνεται με **render order** (κάτω). |
| **Revit / Cinema 4D** | Native (όχι WebGL)· το gizmo ζωγραφίζεται μέσα στο ίδιο viewport. | ✅ Ένα target. |

**Απόφαση:** Εξάλειψη του 2ου context (web big-player πρακτική). Η απομόνωση που το APS πετυχαίνει με ξεχωριστό renderer επιτυγχάνεται εδώ **by construction**: ο cube ζωγραφίζεται **τελευταίος**, μετά από όλο το post-FX/SSAO/outline, στο τελικό framebuffer — όπως ακριβώς ο `renderOutlineOverlayToScreen` (ADR-536). Άρα είναι AO-immune χωρίς ξεχωριστό context. Escape-hatch (path-tracer): §6.

## 3. Λύση — δύο ρόλοι του παλιού canvas, διαχωρισμένοι

Ο παλιός ViewCube `<canvas>` έκανε **δύο** δουλειές:
- **(α) WebGL render** → ο 2ος context.
- **(β) DOM event capture** → pointerEvents:auto + `stopPropagation` πάνω σε z-index:20 element, που μπλοκάρει το OrbitControls (attached στο renderer canvas, sibling από κάτω).

Τους διαχωρίζουμε:

- **Κρατάμε το DOM element ως διάφανο HIT-LAYER** (καμία κλήση `getContext`/`WebGLRenderer` → **κανένα GPU context**). Όλη η λογική hit-test (`getBoundingClientRect` → raycaster με `miniCam` → face/edge/corner/compass/home/roll/drag/right-click) μένει **byte-identical**. Δεν χρειάστηκε καθόλου coordinate-remap.
- Διατηρεί `data-testid="dxf-view-cube"` — χρησιμοποιείται ως **anchor selector** (`config/panel-tokens.ts` `VIEW_CUBE`) και ως σταθερή θέση για floating panels. **Αμετάβλητο.**
- **Τα pixels** ζωγραφίζονται από τον **main renderer** σε scissored γωνία, στο τέλος του frame.
- Ο scissor rect **παράγεται από το bounding rect του hit-layer** σε σχέση με το main canvas → η θέση ορίζεται **μία φορά** (CSS του hit-layer)· zero duplication των `top:12px`/`160px` constants.

> **Σημ.:** Ένα `<canvas>` element χωρίς `getContext()` δεν δεσμεύει WebGL context. DevTools → ΕΝΑ context (από 2). Επιλέξαμε να μείνει `<canvas>` (όχι `<div>`) για ελάχιστο diff + διατήρηση testid/anchor.

## 4. Scissor math (`view-cube-scissor.ts`, pure + unit-tested)

WebGL viewport/scissor origin = **κάτω-αριστερά**· CSS rects = πάνω-αριστερά → Y-flip:

```
x = hitRect.left - canvasRect.left
y = canvasCssHeight - (hitRect.top - canvasRect.top) - hitRect.height   // flip
w = hitRect.width ; h = hitRect.height
```

Τιμές σε **CSS px** — ο Three.js πολλαπλασιάζει με `pixelRatio` εσωτερικά στα `setViewport`/`setScissor` (καμία προ-πολλαπλασίαση DPR). Επιστρέφει `null` σε degenerate rect (w/h ≤ 0 ή canvasHeight ≤ 0, π.χ. narrow viewport `display:none`). 5/5 jest (`__tests__/view-cube-scissor.test.ts`).

## 5. Render pass (`ViewCubeEngine.composite()`)

Καλείται στο **τέλος** του `renderSceneFrame` (`scene-render-frame.ts`), μετά το `ssaoModulator.renderOutlineOverlayToScreen()`:

```
save autoClear + renderTarget; setRenderTarget(null); autoClear = false;
setScissorTest(true); setScissor(x,y,w,h); setViewport(x,y,w,h);
clearDepth();                 // scissored → καθαρίζει ΜΟΝΟ τη γωνία (όχι color → η σκηνή φαίνεται πίσω)
render(scene, miniCam);
setScissorTest(false); restore full viewport + scissor + autoClear + renderTarget.
```

- **Color δεν καθαρίζεται** → η 3D σκηνή φαίνεται πίσω από τον (ημιδιάφανο) cube, ακριβώς όπως πριν με το stacked διάφανο canvas.
- **Depth καθαρίζεται scissored** → ο cube δεν occluded-άρεται από το scene depth της γωνίας.
- **MSAA**: ο main renderer είναι `antialias:true` → ο cube παίρνει MSAA (ίσο ή καλύτερο από πριν).
- Όλα τα scene render paths (raster / SSAO composer / section caps / path-tracer) τελειώνουν στο **screen (null) framebuffer** → ο `composite()` βρίσκει σταθερό τελικό target.
- **Hover repaints**: ο cube δεν έχει πια ανεξάρτητο render· `updateHover`/`mouseenter`/`mouseleave`/`setCompassVisible` καλούν `onRenderNeeded()` (→ `markSceneDirty()`) ώστε να τρέξει main frame. Big-player: single render loop + dirty-flag.

## 6. Risks / escape-hatch

- **Path-tracer (handoff risk #2):** ο `composite()` τρέχει **unconditional**, και σε path-trace frames. Ο path-tracer accumulate-άρει σε internal float targets και blit-άρει στο screen· το corner write μας γίνεται **μετά** το blit → δεν μολύνει accumulation. Το final-render output βγαίνει από path-tracer buffers/`toBlob` (όχι από το screen scissor) → δεν μολύνεται. **ΑΝ** browser-verify δείξει corruption → gate `if (!pathTracerRenderer.isActive) viewCube.composite()` (cube κρυφός σε path-trace preview = αποδεκτό) + update αυτού του §.
- **Section-cut stencil:** ο cube render είναι κανονικός (μηδέν stencil στα υλικά του)· ο Three.js ρυθμίζει stencil per-material. Browser-verify.
- **autoClear drift:** ο composer αφήνει `autoClear=false`, ο raster `true` → ο `composite()` κάνει save/restore, ανεξάρτητος της τιμής.

## 7. Αρχεία

| Αρχείο | Αλλαγή |
|--------|--------|
| `bim-3d/viewport/view-cube/view-cube-scissor.ts` | **ΝΕΟ** pure `computeViewCubeScissorRect` + types. |
| `bim-3d/viewport/view-cube/view-cube.ts` | Αφαίρεση `miniRenderer`· canvas → hit-layer· `sync()` no render· hover→`onRenderNeeded`· ΝΕΟ `composite()`· `setVisible` gate flag· `+ renderer, onRenderNeeded` στο `ViewCubeOptions`/`Engine`. |
| `bim-3d/scene/scene-render-frame.ts` | `viewCube.composite()` στο τέλος (ADR-040 CHECK 6B/6D). |
| `bim-3d/scene/scene-setup.ts` | `InitViewCubeDeps` + `renderer`/`onRenderNeeded` pass-through. |
| `bim-3d/scene/ThreeJsSceneManager.ts` | `initViewCube({ renderer: this.renderer, onRenderNeeded: markSceneDirty })` (ADR-040 CHECK 6B). |
| `bim-3d/viewport/view-cube/__tests__/view-cube-scissor.test.ts` | **ΝΕΟ** 5/5 jest. |

## 8. Census impact (ADR-551)

3D: **2 WebGL → 1 WebGL** (main renderer μόνο). ViewCube = 1 διάφανο DOM hit-layer (0 context) + scissored sub-viewport. Δες ADR-551 §2/§4/§5.2 #6.

## Changelog

- **2026-06-29** — Initial. Υλοποίηση ADR-551 §5.2 #6: εξάλειψη 2ου WebGL context· ViewCube → scissored sub-viewport του main renderer (Three.js `webgl_multiple_views` pattern). DOM hit-layer διατηρείται (hit-test byte-identical, zero remap). Pure `computeViewCubeScissorRect` 5/5 jest. UNCOMMITTED — εκκρεμεί browser-verify (path-tracer/section interaction + DevTools single-context check) + commit (Giorgio).
