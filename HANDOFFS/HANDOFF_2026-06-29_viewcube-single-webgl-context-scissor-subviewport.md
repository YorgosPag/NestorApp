# HANDOFF — ViewCube: εξάλειψη 2ου WebGL context (scissored sub-viewport)

**Date:** 2026-06-29
**Επόμενο βήμα:** ADR-551 §5.2 **#6** — ο ViewCube να σταματήσει να έχει **δικό του WebGLRenderer** (2ο GPU context) και να γίνει **scissored sub-viewport του main renderer** (πρακτική μεγάλων: Three.js `webgl_multiple_views` / editor· ΕΝΑ context).
**Model:** Opus (αρχιτεκτονικό· render-loop + post-FX αλληλεπίδραση).
**Commit:** ΜΟΝΟ ο Giorgio. **Working tree μοιράζεται με άλλον agent** → ΠΟΤΕ `git add -A`, stage μόνο συγκεκριμένα αρχεία.

---

## 0. ΞΕΚΙΝΑ ΕΤΣΙ (κανόνες Giorgio)
1. **PLAN MODE πρώτα.** Καμία γραμμή κώδικα πριν εγκριθεί plan.
2. **ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep)** πριν γράψεις: ψάξε αν υπάρχει ήδη αντίστοιχος μηχανισμός (scissor/sub-viewport/gizmo-pass) ώστε να τον **επαναχρησιμοποιήσεις** — όχι διπλότυπα. (Ήδη επιβεβαιώθηκε: **κανένα** `setScissor/setScissorTest` στο `bim-3d/` — βλ. §3.)
3. **Big-player doctrine:** υλοποίησε όπως **Revit / Maxon Cinema 4D / Autodesk APS(Forge) Viewer / Three.js editor**. FULL ENTERPRISE + FULL SSOT. **ΑΝ** οι μεγάλοι ΔΕΝ προτείνουν την εξάλειψη του 2ου context (π.χ. το APS κρατά ξεχωριστό gizmo renderer για απομόνωση), τότε **ακολούθησε τη δική τους πρακτική** και **τεκμηρίωσε** γιατί κρατάμε το ξεχωριστό context αντί να το επιβάλεις. → δες §5 «escape hatch».
4. **GOL** (N.7.2 checklist + δήλωση στο τέλος) + όρια 500 γρ./αρχείο, 40 γρ./συνάρτηση.
5. **N.17:** ΕΝΑ tsc τη φορά — έλεγξε για running tsc πριν τρέξεις.

---

## 1. Τι έγινε ΗΔΗ (context)
- **ADR-551** (census καμβάδων/viewports) committed. Εντόπισε 6 ευκαιρίες ενοποίησης· το **#6** είναι αυτό εδώ.
- **Ενοποίηση #1** (7 analytical overlays → 1 dispatch canvas, **ADR-552**) + **fix του `src/subapps/dxf-viewer/jest.config.ts`** (thin extension του root) + διαγραφή legacy setup files → **COMMITTED από Giorgio**.
- Το subapp jest config πλέον δουλεύει: `cd src/subapps/dxf-viewer && npx jest <pattern>` (κληρονομεί @swc/jest + ESM + root jest.setup.js).

---

## 2. Τρέχουσα αρχιτεκτονική ViewCube (τι θα αγγίξεις)

**Αρχεία** (`bim-3d/viewport/view-cube/`):
- `view-cube.ts` — `createViewCube(opts): ViewCubeEngine`. **Εδώ ζει το 2ο WebGL context.**
  - γρ.76-92: `const canvas = document.createElement('canvas')` (DOM, `position:absolute; top:12px; right:12px; z-index:20`, 160×160, `pointerEvents:'auto'`, `data-testid="dxf-view-cube"`) + `const miniRenderer = new THREE.WebGLRenderer({ canvas, alpha:true, antialias:true })` ← **ο 2ος renderer**.
  - γρ.94-130+: δική του `scene` + `miniCam` (`OrthographicCamera`) + lights + cube/compass/home/roll/faceNav meshes (από `view-cube-mesh.ts`, `view-cube-overlay.ts`).
  - `ViewCubeEngine.sync(cam,target)` — ευθυγραμμίζει το cube με την main camera **και** κάνει `miniRenderer.render(scene, miniCam)`.
  - Mouse/hit-test handlers δένονται **πάνω στο δικό του `canvas`** (raycast στο mini canvas space) → face/edge/corner/compass/home/roll/drag.
  - `dispose()` καθαρίζει renderer+canvas+listeners.
- `view-cube-mesh.ts` (cube/compass/home meshes + face textures = offscreen CanvasTexture), `view-cube-overlay.ts` (roll/faceNav sprites), `view-cube-highlight.ts` (hover χρώματα), `view-cube-context-menu.tsx` (React, right-click). **Όλα αυτά ΕΠΑΝΑΧΡΗΣΙΜΟΠΟΙΟΥΝΤΑΙ ως έχουν** — αλλάζει ΜΟΝΟ ο τρόπος render+hit-test, όχι η geometry.

**Κλήση ανά frame:** `bim-3d/scene/scene-render-frame.ts` → `renderSceneFrame(ctx)` (γρ.40) → γρ.60 `viewCube.sync(...)`. Το `ctx` έχει ήδη `viewport`, `viewCube`, animationManager, ssaoModulator κ.ά.
**Main renderer:** `bim-3d/scene/scene-setup.ts` → `createBimRenderer()` (`new THREE.WebGLRenderer({antialias,alpha,stencil,...})` → `container.appendChild(renderer.domElement)`).
**Mount/lifecycle:** `bim-3d/viewport/BimViewport3D.tsx` + `ThreeJsSceneManager` (κρατά `viewCube` engine, καλεί sync στο tick).

---

## 3. SSoT audit μέχρι τώρα (επιβεβαίωσέ το & επέκτεινέ το)
- **Κανένα** `setScissor / setScissorTest` σε όλο το `bim-3d/` → ο sub-viewport μηχανισμός **δεν υπάρχει**· θα τον φτιάξεις, αλλά **reuse**: τον **main renderer** (από `createBimRenderer`/`ThreeJsSceneManager`) + την **υπάρχουσα ViewCube scene/miniCam/meshes** (μη ξαναγράψεις geometry).
- Μόνο άλλο `setViewport` = `engine.setViewport({...})` στο `animation/bim3d-edit-drag-snap.ts` — **camera viewport abstraction, ΑΣΧΕΤΟ** με WebGL scissor.
- Offscreen renderers που **ΔΕΝ** πειράζεις: `createOffscreenCaptureRenderer` (export), `WallTypePreviewRenderer`/`SlabTypePreviewRenderer` (thumbnails), `PathTracerRenderer` (reuse main).

---

## 4. Στόχος υλοποίησης (scissor sub-viewport — Three.js multiple-views pattern)
Μετά το main scene render, στο **ίδιο** renderer, render-άρε τη ViewCube scene σε γωνία:
```
const r = mainRenderer; const dpr = r.getPixelRatio();
const s = 160, m = 12; const x = W - s - m, y = m;   // top-right (σε CSS px· πρόσεξε y-flip: WebGL origin κάτω-αριστερά)
r.clearDepth();
r.setScissorTest(true);
r.setViewport(x*dpr, y*dpr, s*dpr, s*dpr);
r.setScissor (x*dpr, y*dpr, s*dpr, s*dpr);
r.render(viewCubeScene, miniCam);
r.setScissorTest(false);
r.setViewport(0,0,Wpx,Hpx);                          // reset σε full
```
**ΔΥΟ δύσκολα σημεία — λύσε τα στο plan:**
1. **Hit-test remap:** τα mouse handlers ήταν στο δικό του canvas. Τώρα τα pointer events έρχονται στο **main canvas** → πρέπει να φιλτράρεις όσα πέφτουν μέσα στο corner rect και να κάνεις raycast με `miniCam` σε **τοπικές** συντεταγμένες (offset + y-flip). Όλη η λογική face/edge/corner/compass/home/roll/drag/right-click πρέπει να δουλεύει ίδια.
2. **Αλληλεπίδραση με post-FX/SSAO/SelectionOutline/PathTracer/section-stencil:** ο main render περνά από composer (SSAO) + post-fx-overlay-pass + SelectionOutlinePass. Το scissor pass πρέπει να γίνεται **μετά** όλα αυτά, στο τελικό framebuffer, **χωρίς** να το επηρεάζει το AO/outline (ο ViewCube πρέπει να είναι «AO-immune», όπως ο post-fx-overlay-pass — δες το ως πρότυπο). Πρόσεξε `autoClear`, depth, και ότι ο composer μπορεί να render-άρει σε render target (όχι default framebuffer).

**Επανάχρηση κατά το pattern:** δες `bim-3d/scene/post-fx-overlay-pass.ts` (AO-immune forward pass πάνω από τον composer) — είναι το πιο κοντινό υπάρχον πρότυπο «extra pass μετά το main render». Πιθανώς ο ViewCube γίνεται ένα παρόμοιο τελικό pass.

---

## 5. Big-player verification + escape hatch (κανόνας Giorgio)
Στο plan **τεκμηρίωσε** σύντομα τι κάνουν οι μεγάλοι:
- **Three.js editor / `webgl_multiple_views`** → scissor sub-viewport, ΕΝΑ context. ✅ υπέρ εξάλειψης.
- **Autodesk APS (Forge) Viewer** → ιστορικά ξεχωριστός μικρός renderer/overlay για το ViewCube (απομόνωση από το main pipeline).
- **Revit / Cinema 4D** → native (όχι WebGL)· το gizmo ζωγραφίζεται μέσα στο ίδιο viewport.
**Απόφαση:** αν το scissor-sub-viewport είναι ασφαλές με το post-FX pipeline → υλοποίησέ το (ΕΝΑ context = big-player web πρακτική). **ΑΝ** η αλληλεπίδραση με composer/SSAO/outline το κάνει εύθραυστο/υποδεέστερο (π.χ. APS-style διατηρεί ξεχωριστό για λόγο), τότε **κράτα το 2ο context** και **τεκμηρίωσε στο ADR** γιατί (big-player practice), αντί να επιβάλεις χειρότερη λύση. Ο Giorgio το ενέκρινε ρητά.

---

## 6. Constraints / checklist
- **ADR-040 CHECK 6B/6D:** `scene-render-frame.ts` + `ThreeJsSceneManager.ts` είναι micro-leaf/canvas-critical → αν τα αγγίξεις, **stage ADR-040** + νέο **ADR-553** (επιβεβαίωσε next-free: `ls docs/centralized-systems/reference/adrs | grep -oE 'ADR-[0-9]+' | sort -t- -k2 -n | tail` — **shared tree**, μπορεί άλλος agent να πήρε 553).
- **Νέο ADR-553** «ViewCube single WebGL context (scissor sub-viewport)» + εγγραφή στο `adr-index.md` (2 πίνακες) + ενημέρωση **ADR-551 §5.2 #6** (→ IMPLEMENTED ή «kept separate, τεκμηριωμένο»).
- **Tests (GOL):** unit για το pure κομμάτι (π.χ. corner-rect/hit-test remap math: world→corner-local + y-flip + «είναι μέσα στο rect;»). Browser-verify: ViewCube ζωγραφίζεται top-right, hover/click face/edge/corner/compass/home/roll/drag/right-click δουλεύουν, μηδέν regression στο main render (AO/outline/section/path-tracer), DevTools → **ΕΝΑ** WebGL context (αν επιλεγεί εξάλειψη).
- **N.17:** ένα tsc· **commit:** Giorgio· **stage** μόνο συγκεκριμένα αρχεία (shared tree).

## 7. Διάβασε πρώτα (με σειρά)
1. `docs/centralized-systems/reference/adrs/ADR-551-canvas-viewport-census-2d-3d.md` §2 + §5.2 #6
2. `bim-3d/viewport/view-cube/view-cube.ts` (όλο)
3. `bim-3d/scene/scene-render-frame.ts` (renderSceneFrame) + `bim-3d/scene/scene-setup.ts` (createBimRenderer)
4. `bim-3d/scene/post-fx-overlay-pass.ts` (πρότυπο extra-pass μετά τον composer)
5. `bim-3d/scene/ThreeJsSceneManager.ts` (tick + viewCube lifecycle) + `bim-3d/viewport/BimViewport3D.tsx`

**Deliverable:** ADR-553 + υλοποίηση (scissor sub-viewport) **Ή** τεκμηριωμένη απόφαση διατήρησης 2ου context κατά big-player πρακτική. Plan Mode → έγκριση → υλοποίηση → ADR → (commit: Giorgio).
