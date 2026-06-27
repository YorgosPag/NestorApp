# ADR-541: Smooth 3D/2D Navigation Baseline (27 Ιουν 2026)

| Metadata | Value |
|----------|-------|
| **Status** | ✅ APPROVED — REFERENCE / BASELINE |
| **Date** | 2026-06-27 |
| **Category** | Performance / DXF Viewer — Navigation |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Git baseline commit** | `b2d7b8500e5b5e57fa2ade6b42d39a32078cff2b` (`b2d7b850`) |
| **Git tag** | `smooth-3d-baseline-2026-06-27` |

---

## §1 Σκοπός — γιατί υπάρχει αυτό το ADR

Μετά από έναν χρόνο εξέλιξης, η **περιστροφή / μετακίνηση (pan/orbit) / zoom** τόσο στον **τρισδιάστατο (3D)**
όσο και στον **δισδιάστατο (2D)** καμβά του DXF/BIM viewer είναι πλέον **ομαλή — 60fps, χωρίς κολλήματα**.

Αυτό το ADR είναι **φωτογραφία της σημερινής λειτουργικής κατάστασης (27 Ιουν 2026)**. Λειτουργεί ως:

1. **Regression guide** — αν στο μέλλον η κίνηση χαλάσει, εδώ βρίσκεις *ποια αρχεία/παράμετροι* ευθύνονται
   για την ομαλότητα, ώστε να εντοπίσεις γρήγορα τι άλλαξε.
2. **Git baseline** — η σημερινή κατάσταση είναι «κλειδωμένη» στο commit `b2d7b850` + tag
   `smooth-3d-baseline-2026-06-27`, ανακτήσιμη/συγκρίσιμη από το GitHub οποτεδήποτε, **χωρίς απώλεια**
   μεταγενέστερης δουλειάς (βλ. §7 Runbook).

> **Κανόνας:** CODE = SOURCE OF TRUTH. Όλες οι γραμμές/τιμές παρακάτω επαληθεύτηκαν στον κώδικα του `b2d7b850`.
> Αν αργότερα ο κώδικας διαφέρει, ο κώδικας υπερισχύει — ενημέρωσε αυτό το ADR.

---

## §2 3D Navigation — κρίσιμα αρχεία & παράμετροι

Root: `src/subapps/dxf-viewer/bim-3d/`

| Αρχείο | Ρόλος | Κρίσιμα σημεία |
|--------|-------|----------------|
| `viewport/BimViewport3D.tsx` | React mount της 3D σκηνής + εγγραφή στον master RAF | `UnifiedFrameScheduler.register('bim-3d-scene', …)` με `isDirty: () => managerRef.current?.isSceneDirty()` (on-demand render)· `ResizeObserver` για container |
| `viewport/viewport-camera.ts` | **SSoT κάμερας** (PerspectiveCamera + OrthographicCamera + OrbitControls + tumble) | γρ.84 `enableDamping = true`· γρ.85 **`dampingFactor = 0.25`** (smooth inertia σε wheel/pan)· γρ.86 `zoomToCursor = true`· γρ.88 **`enableRotate = false`** (η περιστροφή ΔΕΝ γίνεται από OrbitControls — γίνεται μέσω tumble/orbit-around-pivot)· γρ.89-90 `minDistance/maxDistance`· `update()` per-frame = `controls.update() + tumble.update() + animation.tick()` |
| `viewport/viewport-constants.ts` | SSoT όλων των παραμέτρων κάμερας | `DEFAULT_PERSPECTIVE_FOV = 50`· `PERSP_MIN_DISTANCE = 0.12m` / `PERSP_MAX_DISTANCE = 500m`· `ZOOM_WHEEL_BASE = 0.95`· `ZOOM_WHEEL_SENSITIVITY = 0.01`· `ZOOM_SURFACE_MARGIN = 0.12m`· `TUMBLE_BASE_SPEED = 0.005 rad/px`· speed modifiers `FAST = 2.0` / `PRECISE = 0.5`· `PAN_ANIMATION_DURATION_MS = 150`· `FRAME_SCENE_DURATION_MS = 500` |
| `viewport/orbit-around-pivot.ts` | Pure rigid **turntable orbit** (yaw περί world-up + pitch περί camera-right, pole-free) | `orbitCameraAroundPivot(...)` — το picked point ΜΕΝΕΙ στη θέση του στην οθόνη (χωρίς jump)· mutate position/quaternion/target in-place |
| `viewport/tumble-rotation.ts` | Alt+drag orbit controller (χρησιμοποιεί το orbit-around-pivot SSoT) | `DRAG_THRESHOLD_SQ = 9` (3px)· **`update()` = no-op → ΚΑΜΙΑ inertia στην περιστροφή** (σκόπιμο: rigid αρχιτεκτονικό orbit) |
| `viewport/viewport-zoom-surface.ts` | Revit surface-anchored wheel zoom (ποτέ punch-through) | `wheelZoomFactor(deltaY, base=0.95, sensitivity=0.01, zoomSpeed)` = γεωμετρικό βήμα `base^(-deltaY·sensitivity·zoomSpeed)` |
| `viewport/viewport-animation.ts` + `viewport/easing-functions.ts` | Camera animation engine, **non-RAF** (ticked από το main RAF) | `easeInOutCubic` default· lerp position/target/zoom |
| `scene/scene-render-frame.ts` | Per-frame dispatch | `viewport.update()` + `animationManager.tick()` + idle detection· επιλογή render path: **raster (navigating)** → **SSAO (idle > 800ms)** → PathTracer (final) |
| `scene/scene-setup.ts` | Three.js renderer bootstrap | γρ.80 `WebGLRenderer({ antialias, alpha, stencil })`· γρ.81 **`setPixelRatio(min(devicePixelRatio, 2))`** (cap 2× για performance)· γρ.84-85 `shadowMap` PCFSoft, mapSize 2048² |
| `scene/ThreeJsSceneManager.ts` | Lifecycle manager | `onInteractionStart/End()` flag `isInteracting` + mark dirty· scheduler registration |
| `lighting/idle-detector.ts` | Idle FSM (settles quality) | threshold `DXF_TIMING.gesture.CAMERA_IDLE = 800ms`· `notifyActive()` / `notifyIdle()` |
| `lighting/ssao-modulator.ts` | SSAO ↔ raster ↔ pathtracer switching | `SSAO_TRANSITION_MS = 300`· navigating → direct raster (φθηνό)· idle → πλήρες SSAO + post-FX |

**Κλειδί ομαλότητας 3D:** η περιστροφή είναι **rigid (χωρίς inertia)** μέσω tumble/orbit-around-pivot (`enableRotate=false`
στο OrbitControls)· το damping 0.25 αφορά ΜΟΝΟ wheel/pan deceleration. Κατά τη ναυσιπλοΐα τρέχει φθηνός raster
και το ακριβό SSAO/PathTracer ενεργοποιείται ΜΟΝΟ όταν η κάμερα ηρεμήσει (>800ms). pixelRatio cap στο 2×.

---

## §3 2D Navigation — ADR-040 micro-leaf architecture

Root: `src/subapps/dxf-viewer/`. Κεντρικό ADR: **ADR-040 (Preview Canvas Performance)**.

| Αρχείο | Ρόλος | Κρίσιμα σημεία |
|--------|-------|----------------|
| `systems/cursor/ImmediateTransformStore.ts` | **Zero-React transform SSoT** (pan/zoom) | `getImmediateTransform()` (synchronous read, μηδέν lag)· `updateImmediateTransform(t)` (mark `TRANSFORM_CANVAS_IDS` dirty + notify)· `useTransformValue()` (leaf-only subscriber) |
| `systems/cursor/ImmediatePositionStore.ts` | Zero-React cursor SSoT (3 κανάλια) + pan lock | `registerDirectRender` (zero-lag crosshair μέσα στο mousemove)· `setRealtimeWorld`/`getRealtimeWorldCursor` (60fps ghost, imperative)· `startPanLock/updatePanTransform/endPanLock` |
| `systems/hover/HoverStore.ts` | Zero-React hover SSoT | subscriber ΜΟΝΟ στο `DxfCanvasSubscriber` leaf, όχι στον orchestrator |
| `components/dxf-layout/CanvasSection.tsx` | **Orchestrator** | **CHECK 6C: ΑΠΑΓΟΡΕΥΕΤΑΙ `useSyncExternalStore`**· διαβάζει transform via `getImmediateTransform()` σε event-time, όχι ως subscription |
| `components/dxf-layout/CanvasLayerStackTransformBridge.tsx` | **Μοναδικός transform subscriber** στο path Section→Shell (ADR-040 Φ XXII.A) | ο ΜΟΝΟΣ `useTransformValue()`· περνά fresh `transform` prop |
| `components/dxf-layout/CanvasLayerStack.tsx` | Shell | `React.memo`· **NO `useSyncExternalStore`**· περνά props στα leaves |
| `components/dxf-layout/canvas-layer-stack-leaves.tsx` | **Micro-leaves — οι ΜΟΝΟΙ subscribers** | κάθε leaf 1 subscription (`SnapIndicatorSubscriber`, `DraftLayerSubscriber`, `DxfCanvasSubscriber`) |
| `canvas-v2/dxf-canvas/dxf-bitmap-cache.ts` | **Bitmap cache** (AutoCAD dual-buffer) — το «FPS fix» | cache key = scene-ref + scale/offset + viewport + dpr + BIM settings. **ΑΠΟΚΛΕΙΕΙ ρητά** `hoveredEntityId` / `selectedEntityIds` / `gripInteractionState` / `dragPreview` (γρ.9-19)· αλλιώς ~60Hz invalidation → full N-entity rebuild → FPS 1 |
| `canvas-v2/dxf-canvas/dxf-canvas-renderer.ts` | RAF render callback | `getImmediateTransform()` σε paint-time· cache `blit()` (normal state) + O(1) single-entity overlay (hover/selection/grip) |
| `systems/cursor/snap-scheduler.ts` | **Snap decoupling** | το βαρύ `runSnapDetection()` (1-5ms) τρέχει σε RAF slot, ΟΧΙ στον mousemove handler → crosshair ποτέ blocked |
| `hooks/canvas/useViewportManager.ts` | **Write point** όλων των pan/zoom | `setTransform` → `transformRef` + `updateImmediateTransform()` + ResizeObserver |

**Κλειδί ομαλότητας 2D:** ο orchestrator (CanvasSection) **δεν είναι subscriber** — δεν ξανα-renderάρει στο
pan/zoom/hover. Η μοναδική transform subscription απομονώνεται στο Bridge. Το normal-state των entities ψήνεται
μία φορά (bitmap cache) και γίνεται blit κάθε frame· hover/selection είναι O(1) overlays. Το snap τρέχει
αποσυνδεδεμένο σε RAF slot.

---

## §4 Κοινός RAF & timing

| Αρχείο | Ρόλος | Κρίσιμα σημεία |
|--------|-------|----------------|
| `rendering/core/UnifiedFrameScheduler.ts` | **Ένα RAF loop** για όλη την εφαρμογή (Autodesk/Adobe pattern· ADR-030 / ADR-119) | priority queue (CRITICAL→BACKGROUND)· dirty-check on-demand (render μόνο όταν `isDirty()`)· `FRAME_TIME_60FPS ≈ 16.67ms`· canvas sync group (layer+dxf marked dirty μαζί)· FPS tracking |
| `config/dxf-timing.ts` | SSoT timing (ADR-516) | `frame.THROTTLE_60 = 16ms`· `gesture.WHEEL_IDLE = 220ms`· `gesture.CAMERA_IDLE = 800ms`· animation FAST/DEFAULT/SLOW = 150/300/500 |
| `hooks/raf-coalesced-throttle.ts` | No-drop leading+trailing throttle | leading edge άμεσο· εντός window park latest + flush σε επόμενο rAF (ποτέ drop) |

**Κλειδί:** ΕΝΑ `requestAnimationFrame` για 3D scene + 2D canvases + overlays. Render μόνο σε dirty frames
(on-demand), όχι συνεχόμενο loop → CPU/GPU ησυχάζουν όταν δεν υπάρχει κίνηση.

---

## §5 Cardinal rules — τι ΔΕΝ πρέπει να σπάσει

Αυτοί οι κανόνες (επιβεβλημένοι και από pre-commit CHECK 6B/6C/6D — βλ. CLAUDE.md DXF section) είναι η αιτία
της ομαλότητας. Παραβίαση = re-renders 60fps ή stale data ή FPS 1:

1. **Orchestrator ≠ subscriber.** `CanvasSection.tsx` / `CanvasLayerStack.tsx` ΔΕΝ καλούν `useSyncExternalStore`
   (CHECK 6C blocking). Οι subscriptions ζουν στα leaves.
2. **Event handlers διαβάζουν getters** (`getImmediateTransform()`), όχι snapshot values (γίνονται stale όταν ο
   orchestrator skip-άρει re-render).
3. **Bitmap cache key ΑΠΟΚΛΕΙΕΙ** `hoveredEntityId` / `selectedEntityIds` / `gripInteractionState` — αλλιώς 60fps
   full-scene rebuild → FPS 1.
4. **3D περιστροφή = rigid, χωρίς inertia** (`tumble-rotation.update()` = no-op, `enableRotate=false` στο
   OrbitControls). Το damping 0.25 αφορά μόνο wheel/pan.
5. **Snap decoupled** σε RAF slot — ποτέ μέσα στον mousemove handler.
6. **Ένα RAF** (UnifiedFrameScheduler) — όχι παράλληλα `requestAnimationFrame` loops (ADR-119).
7. **pixelRatio cap 2×** + on-demand render (`isDirty`) — μην render-άρεις κάθε frame χωρίς λόγο.
8. **Όταν αγγίζεις performance-critical αρχείο** (παραπάνω) → stage ADR-040 (CHECK 6B) ή κάποιο ADR (CHECK 6D).

---

## §6 Σχετικά ADR

- **ADR-040** — Preview Canvas Performance (micro-leaf subscriber pattern, bitmap cache) — *κεντρικό για 2D*.
- **ADR-030** — Unified Frame Scheduler.
- **ADR-119** — RAF Consolidation to UnifiedFrameScheduler.
- **ADR-366** — 3D BIM Viewer & Photorealistic Rendering — *κεντρικό για 3D*.
- **ADR-046** — Single Coordinate Transform· **ADR-043** — Zoom Constants· **ADR-094** — Device Pixel Ratio.
- **ADR-516** — Timing SSoT (`dxf-timing.ts`).

---

## §7 GitHub Restore / Revert Runbook

> Όλες οι εντολές με Windows git path: `"C:\Program Files\Git\cmd\git.exe"`.
> Baseline: commit `b2d7b850`, tag `smooth-3d-baseline-2026-06-27`.

**ΑΡΧΗ ΑΣΦΑΛΕΙΑΣ:** Στο Git **κανένα commit δεν χάνεται**. Όλες οι παρακάτω ενέργειες είναι μη-καταστροφικές —
η μελλοντική δουλειά διατηρείται πάντα. **ΠΟΤΕ** `git reset --hard` στο `main`.

**Α. Μελέτη της σημερινής (27 Ιουν) κατάστασης — read-only, καμία απώλεια:**
```
git fetch --tags
git checkout smooth-3d-baseline-2026-06-27      # detached HEAD — μόνο για μελέτη/δοκιμή
git checkout main                                # επιστροφή στο «σήμερα» (π.χ. 15 Ιουλ)
```

**Β. Τι άλλαξε στα κρίσιμα αρχεία navigation από τότε:**
```
git diff smooth-3d-baseline-2026-06-27..main -- src/subapps/dxf-viewer/bim-3d/viewport \
  src/subapps/dxf-viewer/rendering/core src/subapps/dxf-viewer/systems/cursor \
  src/subapps/dxf-viewer/canvas-v2/dxf-canvas
```

**Γ. Επιλεκτική επαναφορά ΜΟΝΟ ενός/μερικών αρχείων στη σημερινή έκδοση (κρατάς όλη την υπόλοιπη δουλειά):**
```
git checkout smooth-3d-baseline-2026-06-27 -- src/subapps/dxf-viewer/bim-3d/viewport/viewport-camera.ts
# έλεγχος στον browser, μετά commit ως κανονική αλλαγή μπροστά στο main
```

**Δ. Αναίρεση συγκεκριμένου «κακού» commit (γραμμικό history, χωρίς reset):**
```
git revert <bad-commit-hash>     # νέο commit που αναιρεί το κακό — τίποτα δεν χάνεται
```

**Ε. Πλήρης μελέτη σε ξεχωριστό κλαδί (αν θες να δουλέψεις πάνω στο baseline χωρίς να πειράξεις το main):**
```
git switch -c investigate-smooth-baseline smooth-3d-baseline-2026-06-27
# δουλειά/δοκιμές· το main μένει ανέπαφο· επιστροφή με  git switch main
```

**ΣΤ. Όταν τα γνωστά (§2/§3) αρχεία είναι ΑΜΕΤΑΒΛΗΤΑ αλλά υπάρχει regression — ψάξε όλο το repo:**

Το tag αποθηκεύει **ΟΛΟΚΛΗΡΟ** το repository στη σημερινή κατάσταση (κάθε αρχείο + `package.json`/εκδόσεις
βιβλιοθηκών), όχι μόνο τη λίστα του §2/§3. Αν τα γνωστά αρχεία δεν άλλαξαν, ο ένοχος είναι αλλού (shared util,
store, config, αναβάθμιση dependency π.χ. three.js). Εντόπισέ τον:
```
# 1. ΟΛΑ όσα άλλαξαν από το baseline (κρυφοί ένοχοι: shared utils/stores/configs/deps)
git diff smooth-3d-baseline-2026-06-27..main --stat

# 2. Δες τη ΣΗΜΕΡΙΝΗ έκδοση ΟΠΟΙΟΥΔΗΠΟΤΕ αρχείου (όχι μόνο της λίστας)
git show smooth-3d-baseline-2026-06-27:<path/σε/οποιοδήποτε/αρχείο>

# 3. Αυτόματος εντοπισμός του ΑΚΡΙΒΟΥΣ commit που εισήγαγε το regression
git bisect start
git bisect bad main                              # σήμερα = χαλασμένο
git bisect good smooth-3d-baseline-2026-06-27    # baseline = ομαλό
#   …το git δίνει ενδιάμεσα commits· δοκίμασε στον browser, σήμανε good/bad…
git bisect reset                                 # τέλος
```
Έτσι ο πράκτορας δεν περιορίζεται στη λίστα §2/§3 — έχει «καλό σημείο» αναφοράς για **όλη** την εφαρμογή.

**Σενάριο (το ερώτημα του Giorgio):** Στις 15 Ιουλ προκύπτει κόλλημα στην περιστροφή →
(1) `git diff` (Β) για τα §2/§3 αρχεία· αν αμετάβλητα → full-repo `--stat` + `git bisect` (ΣΤ) →
(2) εντόπισε την υποψήφια αλλαγή/commit → (3) είτε `revert` (Δ) είτε επιλεκτικό `checkout -- file` (Γ) →
(4) `git checkout main` για επιστροφή μπροστά. Καμία απώλεια δουλειάς σε κανένα βήμα.

---

## §8 Changelog

- **2026-06-27** — Δημιουργία baseline ADR. Καταγραφή 3D (§2) + 2D (§3) + κοινού RAF (§4) navigation
  αρχιτεκτονικής στο commit `b2d7b850`. Git tag `smooth-3d-baseline-2026-06-27` + GitHub restore/revert runbook (§7).
  Όλες οι γραμμές/τιμές επαληθεύτηκαν στον κώδικα (spot-check: viewport-camera.ts γρ.84-90, scene-setup.ts γρ.80-85,
  dxf-bitmap-cache.ts γρ.9-59).
- **2026-06-27** — Προσθήκη §7.ΣΤ «Όταν τα γνωστά αρχεία είναι αμετάβλητα»: full-repo `git diff --stat`,
  `git show <tag>:<file>`, `git bisect` — ώστε ο μελλοντικός πράκτορας να ψάχνει όλο το repo (όχι μόνο τη λίστα §2/§3).
