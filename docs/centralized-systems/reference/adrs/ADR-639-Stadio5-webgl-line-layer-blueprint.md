# ADR-639 Στάδιο 5 — WebGL Line Layer · Synthesized Implementation Blueprint

> **Provenance / πώς προέκυψε αυτό το αρχείο.** Το blueprint είναι το τελικό παραδοτέο του
> multi-agent workflow `adr639-webgl-line-layer-design` (run `wf_e3f346d9-5b7`): 6 read-only
> deep-readers χαρτογράφησαν τα integration points → 3 ανεξάρτητοι architects (endgame-purist /
> incremental-safe / perf-adversary) → 1 judge σύνθεση. Ο 10ος agent (judge) **ολοκλήρωσε τη
> σύνθεση αλλά πάγωσε το VS Code την ώρα που εξέπεμπε το structured output** (τα literal `<`/`>`
> έσπαγαν το tool-call XML). Το πλήρες περιεχόμενο ανακτήθηκε από το payload της προσπάθειας και
> ξαναγράφτηκε εδώ καθαρά — **κανένα δεδομένο δεν χάθηκε**. Το ένα από τα 6 survey-areas
> (`layer-stack`) είχε γυρίσει κενό· το κάλυψα με άμεση ανάγνωση του `CanvasLayerStack.tsx`
> (βλ. §11 «Insertion point»).
>
> **Κατάσταση: DESIGN ONLY — καμία γραμμή κώδικα.** Ακολουθεί ADR-driven Phase 1: έγκριση Giorgio
> πριν την υλοποίηση (N.8, render-critical/ADR-040, shared working tree). Χάρτης: `ADR-639`.

---

## Summary

Το Στάδιο 5 προσθέτει **ΕΝΑ** νέο WebGL line layer (three.js r0.170, ήδη dependency) που κάνει
GPU-batch το solid, non-interactive LINE/POLYLINE bulk (~209k από 215k entities = 97% του 42MB
permit DXF) σε **persistent `LineSegments2` buffers** χτισμένα **μία φορά ανά scene identity**.
Το pan/zoom ενημερώνει **ΜΟΝΟ** τα τέσσερα ortho bounds μιας `OrthographicCamera` (από το
`ImmediateTransformStore`) — **μηδέν buffer re-upload** — δίνοντας 60fps συνεχή πλοήγηση όπως
Figma / AutoCAD web / Cinema4D / Revit.

Ό,τι άλλο (arcs, circles, splines, hatch, text, dimensions, dashed/width-band lines, και κάθε
selected/hovered/grip/frozen line) **μένει στο υπάρχον Canvas2D `DxfRenderer` + bitmap cache**.

- **Spine** = incremental-safe path: ένα shippable phase, gated πίσω από threshold μεγάλης σκηνής,
  **ένα** κοινό predicate `isWebglOwnedLine()` που τρώνε ΚΑΙ ο buffer builder (include) ΚΑΙ το
  batch loop του `DxfRenderer` (suppress) → ποτέ gap, ποτέ double-draw· πλήρες Canvas2D fallback.
- **Grafted από endgame-purist:** persistent buffers + camera-matrix-only design,
  `ColorManagement.enabled=false` sRGB parity, per-(width,alpha)-bucket meshes με per-vertex colour.
- **Grafted από perf-adversary** (η LOD/draw-call/memory ανάλυσή του είναι η ισχυρότερη):
  sort-by-length + per-frame binary-search `instanceCount` LOD (zero extra upload, zoom-robust —
  προτιμήθηκε έναντι του coarse-buffer-swap που πρότειναν οι άλλοι δύο), ~48 B/segment ≈ 10.3 MB,
  ≤16 draw calls, chunked/yielding build.

Καθρεφτίζει verbatim το shipped `BimViewport3D` hybrid (pure imperative manager + thin React leaf
+ `UnifiedFrameScheduler` + unregister-before-dispose). Σέβεται και τους 4 ADR-040 cardinal rules
και τα CHECK 6B/6C/6D. Παραδίδεται ως blueprint· ο Giorgio κάνει commit (ADR-040 + ADR-639 staged
στο ΙΔΙΟ commit).

---

## Architecture — Ordered implementation checklist

Ένας implementer, top-to-bottom. **N.17: όχι tsc/typecheck — jest only.**

- **STEP 0 — Pre-flight (SSoT/anti-dup, N.0/N.18).** `grep` το fat-line precedent
  `bim-3d/edges/bim-3d-edge-overlay-builder.ts:150-198` και `bim-3d/scene/scene-setup.ts:95-140`
  ΠΡΙΝ γράψεις οποιοδήποτε `LineMaterial`/renderer setup. Σχεδίασε να **εξάγεις** τα κοινά
  fat-line-material + webgl2-context helpers, όχι να τα κλωνοποιήσεις (`npm run jscpd:diff` πριν το «done»).
- **STEP 1 — Config threshold (no logic).** `WEBGL_LINE_LAYER_MIN_ENTITIES` στο
  `config/dxf-import-thresholds.ts` (gate: engage μόνο σε μεγάλες σκηνές, π.χ. >50k line entities).
- **STEP 2 — Shared ownership predicate SSoT.** Νέο `canvas-v2/webgl-lines/is-webgl-owned-line.ts`:
  `isWebglOwnedLine(entity, resolvedStyle, layerState)` → TRUE iff `(type==='line'` OR `'polyline'`
  χωρίς bulges ΚΑΙ χωρίς start/end/constant widths) AND visible AND layer-not-frozen AND resolved
  linetype solid AND κενό dash pattern AND `meta.measurement!==true`. Καθρεφτίζει ΑΚΡΙΒΩΣ τα
  exclusions του `DxfRenderer.ts:157-185`. **Αυτό το predicate είναι το correctness invariant.**
- **STEP 3 — Renderer + camera setup.** Νέο `canvas-v2/webgl-lines/webgl-line-renderer-setup.ts`:
  `createWebglLineRenderer(canvas)` mirror του `scene-setup.ts:95-140` — manual
  `canvas.getContext('webgl2',{antialias, alpha, premultipliedAlpha:true, preserveDrawingBuffer:false,
  powerPreference:'high-performance', desynchronized:true, failIfMajorPerformanceCaveat:false})` →
  `new THREE.WebGLRenderer({canvas, context, ...})` με belt-and-suspenders fallback σε THREE-built
  context· force `THREE.ColorManagement.enabled=false` + `renderer.outputColorSpace` (per-vertex sRGB
  1:1 με Canvas2D hex)· shared `min(devicePixelRatio,2)` clamp μέσω `getDevicePixelRatio()`
  (`systems/cursor/utils.ts:85`)· `setClearColor` transparent (alpha 0).
- **STEP 4 — Ortho camera math.** Νέο `canvas-v2/webgl-lines/webgl-line-ortho-camera.ts`: pure
  `computeOrthoBounds(transform, cssViewport)` με **imported** `COORDINATE_LAYOUT.MARGINS`
  (`CoordinateTransforms.ts:22-31`, ΟΧΙ hardcoded 30). Επιστρέφει
  `{left:-(30+offsetX)/scale, right:(W-30-offsetX)/scale, bottom:-(30+offsetY)/scale, top:(H-30-offsetY)/scale}`,
  `near/far=-1/1`. `applyToCamera(cam,bounds)` → set bounds → `cam.updateProjectionMatrix()`. Guard
  `W===0||H===0` → skip tick (mirror `dxf-canvas-renderer.ts:145`). **ΟΧΙ extra Y-flip** (η CAD
  Y-inversion και η GL clip-space flip αλληλοεξουδετερώνονται — verified vs `worldToScreen`).
- **STEP 5 — Buffer builder.** Νέο `canvas-v2/webgl-lines/webgl-line-buffer-builder.ts`: pure
  `scene → Map<bucketKey,{positions,colors,worldLengths: Float32Array}>`. Iterate `scene.entities`
  ΜΙΑ φορά· filter με `isWebglOwnedLine`· resolve colour/lineWidthPx/alpha ΜΙΑ φορά/entity μέσω
  `resolveEntityRenderStyle` (`dxf-renderer-style-resolve.ts:75-144` — το ΙΔΙΟ SSoT με το Canvas2D
  batch key, `DxfRenderer.ts:169-179`)· LINE→1 segment, open POLYLINE(n)→n-1, closed→n· tessellate
  residual bulge μέσω shared `expandPolyline/bulgeToPolyline` (`PolylineRenderer.ts:60-87`). Pack
  via `LineSegmentsGeometry.setPositions` + `setColors` (`vertexColors:true`), raw sRGB [0..1].
  Bucket by (quantized lineWidthPx, quantized alpha) → ένα `LineSegments2`/bucket, colour per-vertex·
  cap buckets ≤16, surplus → predicate false → Canvas2D. Μέσα σε κάθε bucket **sort DESC by world
  length** + store `worldLengths` (LOD input). Build loop yields κάθε ~20k segments (chunk) ώστε το
  one-time style-resolve pass να μη «κολλάει» (ADR-639 Στάδιο 4 alignment).
- **STEP 6 — LOD.** Νέο `canvas-v2/webgl-lines/webgl-line-lod.ts`: pure
  `computeInstanceCount(sortedWorldLengths, scale, cutoffPx, deviceCap?)`. Επειδή είναι sorted DESC,
  binary-search το πρώτο index όπου `worldLen*scale < cutoffPx` → `geometry.instanceCount = index`
  (O(log n), **ZERO re-upload**). `cutoffPx = 1.0` idle, ~2-3 σε active pan/zoom
  (IdleDetector/QualityModulator precedent, `ThreeJsSceneManager.ts:9-10`)· optional hard deviceCap
  σε interaction. **Προτιμήθηκε** έναντι coarse-buffer-swap: μηδέν extra GPU memory, zoom-robust, τα
  δομικά μακρύτερα lines επιβιώνουν πάντα.
- **STEP 7 — Module store + dispose.** Νέο `canvas-v2/webgl-lines/webgl-line-layer-store.ts`:
  module-level `isWebglLineLayerActive()` getter + `subscribe` + `setActive` (gate / context-loss /
  feature flag)· on change `markSystemsDirty(['dxf-canvas'])`· exports το `'webgl-line-canvas'`
  system-id. Νέο `webgl-line-dispose.ts`: `disposeWebglLineResources(deps)` — geometry.dispose (+
  resolution-store unsubscribe) → material.dispose → renderer.dispose → remove canvas from DOM
  (mirror `scene-dispose.ts:54-80`).
- **STEP 8 — Content-invalidation SSoT.** Νέο `canvas-v2/webgl-lines/webgl-line-content-invalidation.ts`:
  `subscribeContentInvalidation(cb)` κεντρικοποιεί τα low-freq subscriptions που ήδη οδηγούν το
  `useDxfCanvasCacheInvalidation` — LayerStore visible/frozen/colour, isolate-effects, bim dxfImport
  projectionColor/projectionLineweightMm, print-colour-policy, drawingScale/annotationScale,
  LWDISPLAY. Κοινό ώστε η rebuild list να μην διπλασιάζεται (N.18).
- **STEP 9 — Imperative manager (no React).** Νέο `canvas-v2/webgl-lines/WebglLineLayerManager.ts`:
  clone του `ThreeJsSceneManager`. Owns webgl2 ctx + renderer + Scene + `OrthographicCamera` +
  bucketed `LineSegments2` meshes· constructor appends δικό του `<canvas>` στο container div (mirror
  `scene-setup.ts:154`)· `disposed` guard στην κορυφή κάθε public method (mirror
  `ThreeJsSceneManager.ts:105`). API: `setScene(scene)`, `invalidate()`, `resize(w,h)`,
  `syncDevicePixelRatio()`, `tick()` [reads `getImmediateTransform()` (`ImmediateTransformStore.ts:52`)
  + live viewport ref → `computeOrthoBounds`→`applyToCamera` → `computeInstanceCount`/bucket →
  `renderer.render`], `isDirty()`, `markDirty()`, context-lost/restored, `dispose()`. Κράτα το <500
  γραμμές delegating στα STEP 3-8 helpers.
- **STEP 10 — Thin React leaf.** Νέο `components/dxf-layout/canvas-layer-stack-webgl-line-leaf.tsx`:
  `WebglLineLayerSubscriber = React.memo` (mirror `DxfCanvasSubscriber`, `canvas-layer-stack-leaves.tsx:214`).
  Renders ΕΝΑ bare positioned `<div ref>`· mount effect `new()`s τον manager, registers ΕΝΑ
  `registerRenderCallback('webgl-line-canvas','WebGL Lines',RENDER_PRIORITIES.NORMAL,tick,isDirty)`
  (`frame-scheduler-api.ts:26`), ResizeObserver→`manager.resize`, `subscribeDevicePixelRatio`→
  `manager.syncDevicePixelRatio`, `useLevelScene` (low-freq)→`manager.setScene` σε scene-ref change,
  `subscribeContentInvalidation`→`manager.invalidate`. Διαβάζει transform **ΜΟΝΟ** imperatively μέσα
  στο scheduler tick — **ZERO high-freq `useSyncExternalStore`**. Cleanup: **UNREGISTER πρώτα**, μετά
  `manager.dispose()` (mirror `BimViewport3D.tsx:207-213`). Re-export από το leaves barrel.
- **STEP 11 — Mount in the shell.** Edit `components/dxf-layout/CanvasLayerStack.tsx`: insert
  `<WebglLineLayerSubscriber scene={dxfScene} sceneLevelId={levelManager.currentLevelId}
  transform={transform} viewport={viewport} containerRef={containerRef} className="…z μεταξύ 0 και 10…"/>`
  **αμέσως ΠΡΙΝ** το `{showDxfCanvas && <DxfCanvasSubscriber …/>}` block (σήμερα line 322) ώστε να
  κάθεται ΠΑΝΩ από GridUnderlay/Floorplan/DraftLayer (z0) και ΚΑΤΩ από DxfCanvas (z10, line 357).
  Pure JSX add — **κανένα `useSyncExternalStore`** (CHECK 6C). Αν το `PANEL_LAYOUT` δεν έχει z-tier
  μεταξύ 0 και 10, πρόσθεσε ένα token (config file).
- **STEP 12 — DxfRenderer suppression.** Edit `DxfRenderer.ts` LINE batch loop (148-203) + plain-
  polyline path: όταν `isWebglLineLayerActive()`, για entities που ταιριάζουν `isWebglOwnedLine`
  πρόσθεσε το id στο `batchedIds` και `continue` ΧΩΡΙΣ stroke (GPU owns them)· dashed/non-owned/
  width-band + κάθε selected/hovered/grip line μένουν στο Canvas2D batch + `renderSingleEntity`
  overlay (`DxfRenderer.ts:252-296`) ΑΜΕΤΑΒΛΗΤΑ. Inactive branch = byte-for-byte σημερινός κώδικας.
  Thread το capability flag μέσω `dxf-canvas-renderer.ts` paramsRef.
- **STEP 13 — Transform dirty wiring.** Edit `systems/cursor/ImmediateTransformStore.ts:26` —
  πρόσθεσε `'webgl-line-canvas'` στο `TRANSFORM_CANVAS_IDS` ώστε κάθε pan / wheel-zoom-without-mousemove
  να marks το layer forceDirty μέσω του ΙΔΙΟΥ `markSystemsDirty` SSoT (line 40). One-line change. Το
  layer ΠΟΤΕ δεν γράφει το store (sole writers stay `useViewportManager.setTransform` +
  `CanvasContext.setTransform`).
- **STEP 14 — Tests (jest, N.17-safe).** 4 `__tests__` (ortho-camera parity, owned-predicate matrix,
  buffer-builder, LOD) — βλ. Test Plan.
- **STEP 15 — ADR updates (ΙΔΙΟ commit, CHECK 6B/6C/6D).** Append το changelog entry (κάτω) στο
  ADR-040 + πρόσθεσε τα νέα webgl-lines αρχεία στο Performance-critical-files table· ADR-639 Στάδιο 5
  DONE entry. **Ρώτα τον Giorgio (N.14)** αν θα μπουν τα νέα αρχεία στο CHECK 6B pre-commit regex +
  CLAUDE.md table — **ΜΗΝ** επεξεργαστείς σιωπηλά το hook (N.-1).

---

## Transform strategy (pixel-identity)

Pixel-exact `OrthographicCamera` derived DIRECTLY από `CoordinateTransforms.worldToScreen`
(`:100-103`): `screenX = MARGINS.left + wx*scale + offsetX`;
`screenY = (H - MARGINS.top) - wy*scale - offsetY`, με `MARGINS.left=MARGINS.top=30` **imported** από
`COORDINATE_LAYOUT.MARGINS` (`:22-31`), `H = viewport.height` σε CSS px (DPR-independent). **Resolved
disagreement:** απορρίπτεται το `camera.zoom/.position` mapping ενός architect (μπλέκει με THREE
conventions)· χρησιμοποιείται το closed-form ortho-bounds στο οποίο συνέκλιναν και τα 3 blueprints.

Ανά dirty tick: read `t=getImmediateTransform()` (`ImmediateTransformStore.ts:52`, event-time getter,
ΠΟΤΕ React snapshot) + live CSS-px viewport ref (mirror `dxf-canvas-renderer.ts:144`), recompute:

```
left'   = -(30 + offsetX)/scale
right'  =  (W - 30 - offsetX)/scale
bottom' = -(30 + offsetY)/scale
top'    =  (H - 30 - offsetY)/scale
near/far = -1/1   (flat 2D)
```

World vertices packed at `(wx,wy,0)`· camera at origin looking `-Z`, up `+Y`. Set bounds →
`cam.updateProjectionMatrix()` — **αυτό είναι ΟΛΟ το per-pan/zoom CPU κόστος** (4 divides + matrix +
≤16 draws), μηδέν buffer touch.

**Y-flip:** ο `screenY` αφαιρεί το `offsetY` (θετικό offsetY μετακινεί το σχέδιο ΠΑΝΩ, `:99`), και
world-Y-up + NDC-Y-up αυξάνουν και τα δύο προς τα πάνω → τα δύο flips **αλληλοακυρώνονται** — **ΜΗΝ**
προσθέσεις extra flip (θα κατοπτρίσει την εικόνα). Verified bit-parity με `worldToScreen`.

**DPR:** `W,H` είναι ΠΑΝΤΑ CSS px (το ίδιο Viewport object) — ΠΟΤΕ `canvas.width/height`. Το dpr τρέφει
ΜΟΝΟ `renderer.setPixelRatio(min(devicePixelRatio,2))` + `setSize(W,H)`, `LineMaterial.resolution.set(W*dpr,H*dpr)`,
`linewidth=lineWidthPx*dpr`. **Το να μπει το dpr στο ortho matrix = το κλασικό HiDPI-shrink bug —
ρητά αποφεύγεται.** Guard `W===0||H===0` → skip tick. Wheel-zoom-without-mousemove καλύπτεται από το
`'webgl-line-canvas'` στο `TRANSFORM_CANVAS_IDS`.

---

## Buffer strategy

PERSISTENT buffers built **ΜΙΑ φορά ανά scene identity** (reference equality, mirror
`entityMap=useMemo([scene])` στο `dxf-canvas-renderer.ts:109-112`) μέσω του three fat-line stack
`LineSegmentsGeometry.setPositions/setColors` + `LineMaterial{vertexColors:true}` + `LineSegments2` —
το ΙΔΙΟ r170 idiom που ήδη έγινε ship στο `bim-3d-edge-overlay-builder.ts:150-198` (extract shared
material helper, **ΜΗΝ** clone — N.18).

**Packing:** iterate `scene.entities` μία φορά· keep όσα περνούν `isWebglOwnedLine`· resolve
colour/lineWidthPx/alpha ΜΙΑ φορά/entity σε BUILD time μέσω `resolveEntityRenderStyle` (`:75-144` — το
exact SSoT του Canvas2D batch key) ώστε GPU και Canvas2D να μην αποκλίνουν ποτέ. LINE→1, open
POLYLINE(n)→n-1, closed→n· residual bulges → shared `expandPolyline` (`PolylineRenderer.ts:60-87`).
Positions Float32Array + parallel colour Float32Array (raw sRGB [0..1], ColorManagement off).

**Bucketing (per-width χωρίς per-colour draw calls):** `LineMaterial.linewidth+opacity` είναι single
uniforms → group by (quantized lineWidthPx, quantized alpha) → ένα `LineSegments2`/bucket, colour
per-vertex. Τα permit files έχουν ~1-4 distinct BYLAYER lineweights → **≤16 draw calls για όλα τα
215k segments**. Strict SUBSET του υπάρχοντος CPU batch key με το colour lifted σε per-vertex. Cap
≤16· surplus width → predicate false → Canvas2D.

**Memory:** fat-line interleaved instanceStart/End = 6 floats/seg + instanceColorStart/End = 6
floats/seg ≈ **48 B/segment ≈ ~10.3 MB GPU** για 215k segments — trivial. Ένα upload, μετά camera-only
για πάντα. **Καμία** memory-driven chunking του typed array· chunk ΜΟΝΟ το BUILD loop (~20k
segments/yield).

**Rebuild triggers** = strict SUBSET του bitmap `CacheKey` (`dxf-bitmap-cache.ts:39-59`) με
`transform.scale/offsetX/offsetY` **ΑΦΑΙΡΕΜΕΝΑ** (το όλο νόημα του Στάδιο 5): scene ref identity· και
imperatively μέσω `subscribeContentInvalidation` (LayerStore visible/frozen/colour, isolate alpha,
dxfImport projectionColor/projectionLineweightMm, print-colour-policy, drawing/annotationScale,
LWDISPLAY). **ΠΟΤΕ** στο buffer ή στο key: scale/offset (camera only), viewport w/h (camera +
resolution + setSize only), hoveredEntityId/selectedEntityIds/gripInteractionState/dragPreview
(ADR-040 rule 3 — το FPS-1 incident που τεκμηριώνει το `dxf-bitmap-cache.ts:16`). Interactive lines
ΜΕΝΟΥΝ στο GPU buffer και **overpainted** από το Canvas2D `renderSingleEntity` overlay στο z10 canvas
από πάνω — μηδέν GPU churn σε hover/select.

**Μένει Canvas2D** (predicate false): arcs/circles/ellipses/splines, hatch fills, text, dimensions,
points, inserts/blocks, bulged ή width-band polylines, dashed lines (LineMaterial dash = world-units,
Canvas2D dash = screen-px → αδύνατη parity· dash-shader = follow-up), surplus-width buckets, και κάθε
selected/hovered/grip/frozen line. **Scene identity = reference equality** — in-place mutation
σιωπηλά skip-άρει rebuild (ίδιο contract με το bitmap cache· τεκμηριωμένο, δεν διορθώνεται εδώ).

---

## LOD strategy

Revit/Navisworks/Figma «drop detail while navigating» με **ZERO buffer re-upload**. **Resolved
disagreement:** δύο architects πρότειναν swap σε precomputed coarse buffer κατά το interaction· το
sort-by-length + per-frame binary-search `instanceCount` του perf-adversary είναι αυστηρά καλύτερο και
**επιλέγεται** — δεν χρειάζεται δεύτερο resident buffer (~10 MB), είναι zoom-robust (recompute από live
scale κάθε tick), και κρατά πάντα τα δομικά μακρύτερα (σημαντικότερα) lines.

- **Build-time:** μέσα σε κάθε (lineWidthPx,alpha) bucket, sort DESC by world length + pack σε αυτή τη
  σειρά· store sorted `worldLengths`.
- **Per-tick:** `cutoffPx = 1.0` idle, ~2-3 σε active pan/zoom (interaction flag από υπάρχον
  IdleDetector/QualityModulator). Επειδή sorted DESC, binary-search το πρώτο index όπου
  `worldLen*scale < cutoffPx` → `geometry.instanceCount = index` (χωρίς touch στο uploaded buffer).
  Όλα τα drawn ≥ cutoffPx· όλα τα dropped είναι sub-pixel (αόρατα ούτως ή άλλως). O(log n)/frame,
  zero upload. Optional device-tier hard cap σε interaction (π.χ. 60k σε weak iGPU), restored σε idle.

Off-screen segments clipped δωρεάν από το ortho projection — κανένα per-frame CPU cull στο GPU path.
Σε idle (cutoff=1px) ουσιαστικά όλη η on-screen geometry σχεδιάζεται → pixel-identical. Το LOD μπορεί
να ξεκινήσει «σβηστό» (cutoff=1 πάντα) και να ενεργοποιηθεί αφού επαληθευτεί το base layer — minimal
v1 risk. Ένα ≤16-draw-call `LineSegments2` των 215k segments είναι ήδη εντός GPU budget (Figma-class),
άρα το LOD είναι safety valve, όχι crutch.

---

## ADR-040 compliance

1. **Rule 1 (orchestrators subscription-free):** `CanvasSection.tsx` ΑΝΕΓΓΙΧΤΟ· `CanvasLayerStack.tsx`
   παίρνει ΜΟΝΟ ένα JSX mount με ZERO `useSyncExternalStore`. Όλα τα subscriptions στο leaf + τον pure
   manager. **PASS.**
2. **Rule 2 (event-time getters):** ο manager reads `getImmediateTransform()` imperatively μέσα στο
   scheduler tick + recompute bounds κάθε tick — ποτέ captured prop → δεν μπορεί να γίνει stale. **PASS.**
3. **Rule 3 (no interaction identity σε cache/buffer):** hover/select/grip/dragPreview ΠΟΤΕ στο buffer,
   στο rebuild key ή στο isDirty· interactive lines overpainted από Canvas2D overlay → 60fps
   hover/select re-uploads μηδέν bytes (αποφεύγει το FPS-1 regression). **PASS.**
4. **Rule 4 (≤1 canvas, ≤2 high-freq hooks):** 1 WebGL canvas, 0 high-freq `useSyncExternalStore`
   (transform μέσω tick getter)· scene/content/DPR = LOW-freq. **PASS.**
5. **Scheduler discipline:** `registerRenderCallback(... RENDER_PRIORITIES.NORMAL ...)` — ποτέ private
   rAF — και UNREGISTER πριν `dispose()` (mirror `BimViewport3D.tsx:207-213`). **PASS.**
6. **Transform SSoT:** προσθέτει `'webgl-line-canvas'` στο `TRANSFORM_CANVAS_IDS`· reads only. **PASS.**
7. **CHECK 6B/6C/6D:** τα touched micro-leaf/drawing αρχεία (`CanvasLayerStack`, `canvas-layer-stack-
   leaves/-types`, `DxfRenderer`, `dxf-canvas-renderer`, `ImmediateTransformStore`) → ADR-040 (+
   changelog + updated table) staged στο ΙΔΙΟ commit· ο shell edit είναι pure JSX (6C grep clean)·
   ADR-040 + ADR-639 markdown ικανοποιούν το 6D. **PASS.**
8. **Νέα file paths** ΔΕΝ ταιριάζουν αυτόματα το CHECK 6B regex — το αν θα μπουν στο 6B allowlist +
   CLAUDE.md table = **judgment call, ρώτα τον Giorgio (N.14)**, όχι σιωπηλό hook edit (N.-1).

**Google-level: YES** — proactive one-time build σε scene-identity lifecycle, idempotent
`invalidate()`, belt-and-suspenders Canvas2D fallback, single SSoT predicate, explicit leaf-owned GL
disposal.

---

## Fallback (belt-and-suspenders, N.7.2 #4)

Κάθε επίπεδο προσγειώνεται στο ΣΗΜΕΡΙΝΟ Canvas2D + bitmap-cache path με μηδέν behavior change, οδηγούμενο
από το single `isWebglLineLayerActive()` flag που ο `DxfRenderer` διαβάζει ως event-time getter:

1. **Large-scene gate:** false εκτός αν line count > `WEBGL_LINE_LAYER_MIN_ENTITIES`. Κάτω από
   threshold → empty div + `DxfRenderer` strokes όλα τα lines όπως σήμερα (byte-identical, μηδέν WebGL
   κόστος/ρίσκο, z-order fidelity για small/annotation-heavy files).
2. **WebGL unavailable at mount:** `createWebglLineRenderer` mirror του belt-and-suspenders του
   `createBimRenderer` (manual webgl2 → THREE-built → on failure) → active=false +
   `markSystemsDirty(['dxf-canvas'])`· Canvas2D strokes. Κανένα throw, κανένα gap.
3. **Runtime context loss:** `'webglcontextlost'` → active=false + markDirty + `preventDefault()`·
   `'webglcontextrestored'` → rebuild buckets (idempotent) + active=true + markDirty. Το flag διαβάζεται
   σε frame time (ποτέ stale) → glitch-free και προς τις δύο κατευθύνσεις.
4. **DPR-change χωρίς resize:** `subscribeDevicePixelRatio` → `syncDevicePixelRatio()` (setPixelRatio +
   setSize + material.linewidth + resolution)· κανένα geometry rebuild.
5. **Reduced-capability/low-memory:** force active=false μέσω store feature flag.

Επειδή το ownership είναι ένα shared predicate και ο inactive branch του `DxfRenderer` είναι κυριολεκτικά
ο σημερινός κώδικας, τα δύο paths **δεν μπορούν** ποτέ να αφήσουν line undrawn ή double-drawn.

---

## Test plan

- **`webgl-line-ortho-camera.test.ts`** (jest, N.17-safe): grid (scale ∈ {0.01,1,1000}, offsetX,
  offsetY, W, H, dpr ∈ {1,2}) → compose `computeOrthoBounds`→projection με standard NDC map και assert
  screen-px == `worldToScreen` εντός <1e-4 (proves pixel-identity + Y-flip cancellation)· + 0x0 case
  early return.
- **`webgl-line-owned-predicate.test.ts`**: TRUE μόνο για solid/visible-layer/non-selected/hovered/grip
  LINE + plain POLYLINE (open+closed)· FALSE για selected/hovered/frozen/dashed/non-solid/bulged/
  width-band/measurement + κάθε non-line type — cross-check exact `DxfRenderer.ts:157-185`.
- **`webgl-line-buffer-builder.test.ts`**: LINE→1, open(n)→n-1, closed→n· bulge tessellation parity·
  per-vertex colour == `resolveEntityRenderStyle` hex→[0..1] (ColorManagement off)· bucket count ==
  distinct (lineWidthPx,alpha) capped ≤16 με surplus routed out· DESC sort· rebuild-signature αλλάζει σε
  layer/isolate/dxfImport mutation αλλά ΟΧΙ σε hover/select/grip.
- **`webgl-line-lod.test.ts`**: sorted-DESC + varying `cutoffPx*scale` → `instanceCount` == count ≥
  cutoff (monotonic)· device cap clamps· idle restores.
- **rebuild-key discipline test**: το isDirty/rebuild set περιέχει scene ref + layer/isolate/print/
  dxfImport/scale/LWDISPLAY και **provably EXCLUDES** scale/offset/viewport/hover/selection/grip
  (regression guard για rule 3).
- **Manual/integration (Giorgio-run, weak PC, `/run` — ΟΧΙ agent-run):** load
  `Αδείας.Κάτοψη-ισογείου.dxf` (215k)· μέσω UnifiedPerformanceHud: (a) chunked build δεν παγώνει,
  (b) draw-call ≤16, (c) GPU bytes ~10 MB via `renderer.info`, (d) sustained fit+pan+wheel-zoom 60fps
  incl. wheel-zoom-without-mousemove world-lock, (e) per-frame tick CPU ~constant ανεξ. entity count.
- **verify HiDPI:** dpr=2 → WebGL lines align pixel-exactly με Canvas2D arcs/text/hatch· drag window
  μεταξύ monitors (DPR resync).
- **verify interaction:** hover + marquee-select κατά 60fps pan → highlight μέσω Canvas2D overlay με
  ZERO rebuild (instrument counter) + κανένα FPS drop· freeze/recolour layer → lines update· isolate → dim.
- **verify fallback:** force webgl2 failure + synthetic `WEBGL_lose_context` lost/restored → Canvas2D
  resumes, buffers rebuild clean.
- **verify dispose/leak:** mount→unmount + DXF reload ×10, watch `renderer.info`/about:gpu → κανένα
  monotonic GPU-memory growth.
- **N.18 anti-dup:** `npm run jscpd:diff` στα νέα `webgl-lines/*.ts` πριν το «done».
- **N.17:** ΟΧΙ tsc — jest only· ο Giorgio τρέχει typecheck + pre-commit σε commit time.

---

## Risks

1. **Painter-order deviation (accepted, gated):** το 2-layer hybrid βάζει ΟΛΑ τα GPU lines κάτω από ΟΛΑ
   τα Canvas2D entities. Opaque hatch/solid fill θα κρύψει line που επικαλύπτει. **Mitigation:** gate
   πίσω από `WEBGL_LINE_LAYER_MIN_ENTITIES`· permit files 97% lines με σπάνια overlaps· τεκμηρίωσε ως
   accepted consequence στο ADR-639.
2. **Colour management:** three r152+ enables sRGB by default → gamma-shift. **Πρέπει**
   `ColorManagement.enabled=false` + raw sRGB [0..1] + consistent `outputColorSpace`.
3. **Anti-aliasing:** fat-line AA vs Canvas2D 1px stroke — marginal σε sub-pixel edges. Match butt caps +
   `linewidth*dpr`. Accepted minor deviation.
4. **Dashed pixel-identity αδύνατη** (world-unit vs screen-px) → dashed μένουν Canvas2D. Cost: λιγότερο
   offload σε dashed-heavy files (acceptable).
5. **Fat-line vertex load σε weak iGPU** (215k instances ≈ 1.3M vertex invocations/frame). Mitigation:
   LOD cap + device budget· last-resort 1px `GL_LINES` για hairlines (χάνει HiDPI width parity).
6. **Bucket explosion** αν pathological file έχει πολλά distinct lineweights. Mitigation: quantize σε
   standard classes, cap ≤16, surplus → Canvas2D.
7. **GPU memory ~10.3 MB** (single buffer set — no coarse-buffer duplication). Dispose σε κάθε DXF
   reload/level switch.
8. **In-place scene mutation:** rebuild = reference equality· mutation in place → σιωπηλό skip.
   Pre-existing pipeline contract· document, μη διορθώσεις εδώ.
9. **Painter-order coupling:** η parity εξαρτάται από το ότι ο `DxfRenderer` ήδη σχεδιάζει το solid-line
   batch πρώτο (bottom)· αν αλλάξει το ordering, σπάει — το shared predicate + ortho-parity test
   πιάνουν divergence.
10. **Shared working tree με άλλους agents:** deliver blueprint only· στην υλοποίηση explicit
    pathspecs, ΠΟΤΕ `git add -A`/blind checkout (multi-agent safety).
11. **jscpd clone ratchet (CHECK 3.28):** το renderer/material/dispose setup μοιάζει δομικά με
    `bim-3d-edge-overlay-builder.ts` + `scene-setup.ts` — extract shared helpers ή `jscpd:diff` πριν done.
12. **`LineMaterial.resolution`** πρέπει να ακολουθεί το shared viewport SSoT (όχι per-canvas
    getBoundingClientRect) αλλιώς width misrenders σε resize.
13. **CHECK 6B regex + CLAUDE.md table** = judgment call, ρώτα Giorgio (N.14), όχι silent hook edit.

---

## Big-player alignment

- **Persistent GPU buffers + camera-matrix-only pan/zoom** = Figma / Cinema4D: geometry tessellated +
  uploaded μία φορά, navigation mutates μόνο projection. Ο OrthographicCamera-bounds-per-tick +
  `updateProjectionMatrix` με zero buffer touch είναι ακριβώς αυτό — το κυριολεκτικό αντίστροφο του
  σημερινού per-frame Path2D rebuild.
- **Constant screen-px lineweight via fat-line width buckets** = AutoCAD web / LWDISPLAY: lineweight =
  fixed device-px class ανεξ. zoom, GPU-batched σε ≤16 draw calls.
- **Per-vertex colour σε ένα geometry** (`setColors` + `vertexColors`) = big-player «one mesh, many
  colours, one draw call».
- **Interaction-gated LOD** (sort-by-length + binary-search instanceCount) = Revit/Navisworks «drop
  detail while orbiting» + Figma sub-pixel culling — zero-cost γιατί είναι απλά instance count.
- **Hybrid GPU-bulk + Canvas2D-for-complex-and-interactive** = tiered strategy AutoCAD web / Onshape,
  mirror του shipped `BimViewport3D` (WebGL scene + Canvas2D overlay).
- **On-demand dirty-gated rendering** μέσω του single `UnifiedFrameScheduler` (ποτέ private rAF) =
  professional CAD «coalesce όλη τη viewport δουλειά σε ένα present»· `desynchronized:true` +
  `powerPreference:high-performance` → pointer-to-pixel latency parity. Explicit
  `webglcontextlost/restored` + Canvas2D fallback = production-grade robustness (AutoCAD web / Figma).

---

## Insertion point (survey gap `layer-stack`, filled by direct read of `CanvasLayerStack.tsx`)

Το ένα από τα 6 survey-areas είχε γυρίσει κενό placeholder· χαρτογραφήθηκε άμεσα. Current z-order stack
μέσα στο `.canvas-stack` div:

| Layer | z | αρχείο |
|---|---|---|
| GridUnderlayCanvas | z0 | `:293` |
| FloorplanBackgroundCanvas | z0 | `:300` |
| FloorUnderlayOverlay | — | `:310` |
| DraftLayerSubscriber (LayerCanvas) | z0 | `:311` |
| **← εδώ μπαίνει το `WebglLineLayerSubscriber` (νέο z-tier μεταξύ 0 και 10)** | z~5 | νέο, πριν το `:322` |
| **DxfCanvasSubscriber** (main Canvas2D, όλα τα non-bulk + detail + selection/hover) | z10 | `:322-359` |
| PreviewCanvas + mounts (ghosts) | — | `:360-392` |
| SnapIndicator / GroupSelection / GroupGizmo / RulerCornerBox / 2D overlays | z20/z30 | `:395+` |

Ο shell (`CanvasLayerStack`) είναι **ADR-040 Shell — MUST NOT `useSyncExternalStore` (CHECK 6C)**· το
mount είναι pure JSX add. Το νέο WebGL canvas κάθεται **κάτω** από τον z10 DxfCanvas ώστε το detail +
selection/hover overlay να ζωγραφίζεται από πάνω (σωστό painter order: bulk lines bottom, detail on top).
