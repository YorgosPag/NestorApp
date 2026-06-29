# HANDOFF — 3D wheel zoom: ενοποίηση fallback (κενό/DXF) με το BIM-surface dolly

**Ημ/νία:** 2026-06-29 · **ADR:** 363 (Revit surface-anchored zoom) + transform-config zoom SSoT · **Model:** Opus 4.8
**Working tree:** ⚠️ **ΜΟΙΡΑΖΕΤΑΙ με άλλον agent.** **COMMIT/PUSH τα κάνει ΜΟΝΟ ο Giorgio** — όχι ο agent.
Ποτέ `--no-verify`, ποτέ `git add -A` (μόνο specific files). Όλες οι παρακάτω αλλαγές είναι **UNCOMMITTED**.

---

## 0. ΤΙ ΘΕΛΕΙ Ο GIORGIO (doctrine)

Υλοποίηση **big-player level: Revit / Maxon Cinema 4D / Figma**. **FULL ENTERPRISE + FULL SSOT.** Αν οι
μεγάλοι παίχτες δεν προτείνουν κάτι → ακολουθούμε τη **δική τους πρακτική**. **ΠΡΙΝ ΓΡΑΨΕΙΣ ΚΩΔΙΚΑ: ΠΡΑΓΜΑΤΙΚΟ
SSoT AUDIT με grep** — βρες αν υπάρχει ήδη αντίστοιχος μηχανισμός για να τον REUSE, **μηδέν διπλότυπα**.
Απάντα **στα Ελληνικά**.

---

## 1. 🔴 Η ΔΟΥΛΕΙΑ ΣΟΥ — το πρόβλημα

Στο **3D viewport**, το wheel-zoom συμπεριφέρεται **διαφορετικά** ανάλογα με το τι είναι κάτω από τον κέρσορα:

| Κάτω από κέρσορα | hit; | Ποιο zoom τρέχει |
|---|---|---|
| **BIM επιφάνεια** | ✅ ναι | Revit surface-anchored dolly — **το ΕΝΟΠΟΙΗΜΕΝΟ exponential** (cursor-anchored, σταματά 120mm) |
| **Κενό (καμβάς)** | ❌ όχι | `return` → **OrbitControls default** zoomToCursor (άλλα μαθηματικά, ΔΕΝ χρησιμοποιεί το SSoT μας) |
| **DXF οντότητα** | ❌ όχι | DXF δεν είναι BIM mesh → κι αυτό «κενό» → ίδιο OrbitControls fallback |

**Ρίζα (επιβεβαιωμένη με grep):**
- `bim-3d/viewport/viewport-camera.ts` → `onSurfaceWheel` (~γρ.104):
  ```ts
  const hit = options.resolveSurfacePoint?.(e.clientX, e.clientY);
  if (!hit) return;   // ← miss → πέφτει στο OrbitControls default zoomToCursor (ΔΙΑΦΟΡΕΤΙΚΟ feel)
  ...
  const factor = wheelZoomFactor(e.deltaY, ZOOM_WHEEL_BASE, ZOOM_WHEEL_SENSITIVITY, controls.zoomSpeed);
  const pose = computeSurfaceZoomPose(activeCamera.position, controls.target, hit, factor, ZOOM_SURFACE_MARGIN, PERSP_MAX_DISTANCE);
  ```
- `bim-3d/scene/ThreeJsSceneManager.ts:124` → `resolveSurfacePoint` κάνει raycast **ΜΟΝΟ** στο `this.bimLayer.group`
  (BIM γεωμετρία). Άρα κενός καμβάς **ΚΑΙ** DXF οντότητες → **miss** → fallback path.

**Το fallback path σπάει την ενοποίηση** που μόλις φτιάξαμε (το `WHEEL_ZOOM_PER_NOTCH` SSoT οδηγεί BIM-surface
zoom 2D+3D, αλλά **όχι** το OrbitControls fallback).

---

## 2. 🎯 ΤΟ ΖΗΤΟΥΜΕΝΟ (big-player fix)

Όταν **δεν** υπάρχει BIM hit (κενό **ή** DXF), **ΜΗΝ** παραδίδεις στο OrbitControls. Αντί γι' αυτό:
αγκύρωσε σε ένα **νοητό επίπεδο** και τρέξε **το ΙΔΙΟ** exponential dolly (`wheelZoomFactor` + `computeSurfaceZoomPose`),
ώστε **κενό + DXF + BIM να νιώθουν ΙΔΙΑ**. Αυτό κάνει το **Revit** (zoom σε κενό = ίδιο dolly, αγκυρωμένο στο
target/work-plane· δεν αλλάζει «μηχανή» ανάλογα με το τι κοιτάς).

**Big-player αναφορά (επιβεβαίωσέ το με WebSearch αν χρειαστεί):** Revit/C4D/Figma → cursor-anchored zoom με
ΕΝΑ μοντέλο· σε κενό αγκυρώνουν σε work-plane / orbit-target plane, **όχι** σε διαφορετικό μηχανισμό.

### Πιθανή προσέγγιση (επιβεβαίωσε με SSoT audit ΠΡΙΝ γράψεις):
1. Σε miss → υπολόγισε σημείο αγκύρωσης = **τομή της ακτίνας κέρσορα με νοητό επίπεδο** (κάθετο στη ματιά,
   μέσα από το `controls.target`, **Ή** ground/work-plane z=floor). Τρέξε το ΙΔΙΟ `computeSurfaceZoomPose`.
2. **ΠΡΟΣΟΧΗ (flag):** το `ZOOM_SURFACE_MARGIN` (120mm stop) είναι για **πραγματικές** επιφάνειες — σε νοητό
   επίπεδο δεν θες «stop 120mm πριν το τίποτα». Δες αν χρειάζεται διαφορετικό clamp (π.χ. μόνο `PERSP_MAX_DISTANCE`
   / `PERSP_MIN_DISTANCE`) για το fallback, ώστε να ζουμάρει ομαλά στο κενό όπως Revit.
3. **DECISION (ρώτα Giorgio ή ακολούθησε big-player):** οι **DXF οντότητες** να (α) μπουν στο raycast set ώστε
   να αγκυρώνεις πάνω τους (σαν surfaces), ή (β) να αντιμετωπίζονται σαν το κενό → plane fallback; Big-player:
   το DXF underlay είναι επίπεδο → το work-plane fallback τις καλύπτει φυσικά. Πρότεινε & τεκμηρίωσε.

### SSoT audit ΠΡΙΝ τον κώδικα (grep — REUSE, ΜΗΝ διπλασιάζεις):
- `wheelZoomFactor`, `computeSurfaceZoomPose`, `computeSurfaceDolly` → `bim-3d/viewport/viewport-zoom-surface.ts` (pure, ήδη unit-tested 15/15).
- `raycastWorldPoint` → ο SSoT raycaster (χρησιμοποιείται από `resolveSurfacePoint` + `setOrbitPivotAt`).
- Ψάξε για **υπάρχον ray↔plane intersection helper** (π.χ. `THREE.Plane`/`raycaster.ray.intersectPlane`,
  ground-plane intersect, work-plane, `setOrbitPivotAt` line viewport-camera.ts:122 — πώς αγκυρώνει αυτό;).
  Αν υπάρχει → REUSE. Αν όχι → φτιάξε ΕΝΑ pure helper στο `viewport-zoom-surface.ts` (ίδιο home).
- Σταθερές: `WHEEL_ZOOM_PER_NOTCH` (config/transform-config.ts), `ZOOM_WHEEL_BASE/SENSITIVITY`,
  `ZOOM_SURFACE_MARGIN`, `PERSP_MIN/MAX_DISTANCE` (bim-3d/viewport/viewport-constants.ts).

**Εύρος:** 1-2 αρχεία (κυρίως `viewport-camera.ts onSurfaceWheel` + ίσως ένας pure helper στο `viewport-zoom-surface.ts`
+ test). ADR-363 changelog update (stage μαζί).

---

## 3. ΚΑΤΑΣΤΑΣΗ — ΟΛΕΣ ΟΙ UNCOMMITTED ΑΛΛΑΓΕΣ (έτοιμες για commit από Giorgio)

### A) Zoom AutoCAD-parity + 2D/3D feel-SSoT (αυτή η συνεδρία) — ✅ browser-verified από Giorgio
- **`config/transform-config.ts`** — NEW `WHEEL_ZOOM_PER_NOTCH = 1.20` (**ΤΟ ΕΝΑ knob** που οδηγεί 2D+3D) +
  `WHEEL_NOTCH_DELTA_PX = 100`. Παράγωγα `WHEEL_SENSITIVITY`/`CTRL_WHEEL_SENSITIVITY` + `WHEEL_MAX_DELTA = 300`.
  Κράτησε τα legacy `WHEEL_IN/OUT`/`CTRL_WHEEL_IN/OUT`/`BUTTON_*` (fallback/reference).
- **`systems/zoom/utils/calculations.ts`** — NEW pure `computeWheelZoomFactor(deltaY, ctrl)` (εκθετικό,
  magnitude-aware, clamped) + `wheelDeltaForFactor(factor, ctrl)` (αντίστροφο). Test: NEW
  `__tests__/wheel-zoom-factor.test.ts` (11/11).
- **`systems/zoom/ZoomManager.ts`** — `wheelZoom` → `computeWheelZoomFactor` (όχι πια sign-based 10%).
- **`canvas-v2/dxf-canvas/DxfCanvas.tsx`** — `zoomAtScreenPoint` → `wheelDeltaForFactor(factor)` (διόρθωσε
  latent bug: τα κουμπιά zoom έκαναν 10% αντί 20% λόγω ψεύτικου ±120).
- **`systems/cursor/useCentralizedMouseHandlers.ts`** — normalize `deltaMode`(lines/pages→px) + fallback μέσω helper.
- **`bim-3d/viewport/viewport-constants.ts`** — `ZOOM_WHEEL_SENSITIVITY` **ΠΑΡΑΓΩΓΟ** του `WHEEL_ZOOM_PER_NOTCH`
  (feel-parity 2D↔3D, μαθηματικά επιβεβαιωμένα: και τα δύο ×1.20 ανά εγκοπή). `ZOOM_SURFACE_MARGIN = 0.12`
  (δοκιμή 0.11 → punch-through, ΕΠΑΝΑΦΕΡΘΗΚΕ).
- Tests πράσινα: zoom 11/11 + 3D surface 15/15.

### B) Crosshair = OS hardware cursor Phase 8 (προηγ. συνεδρία, ίδια μέρα) — UNCOMMITTED
- **`styles/design-tokens/modules/canvas-ui.ts`** — `dxfCanvasWithTools`/`layerCanvasWithTools` cursor
  `'none'`→`'inherit'` (το DxfCanvas κληρονομεί τον hardware-cursor crosshair → εμφανίστηκε στο 2D).
  Διαγράφηκε το νεκρό `canvasOverlayWithPointerControl` (3ο διπλότυπο).
- **`components/dxf-layout/CanvasLayerStack.tsx`** — αφαιρέθηκε το `!!dxfScene` gate (parity με 3D).
- **`systems/cursor/useCrosshairCursor.ts`** — pickbox σταθερό **7px** (CSS), `gap = pickbox/2` (οι γραμμές
  του σταυρού **κολλάνε** στις παρειές του κουτιού). [DPR-robust δοκιμάστηκε & ΕΠΑΝΑΦΕΡΘΗΚΕ.]
- **11 νεκρά αρχεία διαγράφηκαν:** `CrosshairOverlay`, `CrosshairCompositor`, `crosshair-compositor-paint`/`-layout`
  (+2 tests), `BimCrosshairOverlay3D`, `crosshair-3d-center` (+test), `hover-add-badge` (+test).
- **ADRs:** ADR-549 Phase 8 changelog ✅, ADR-545 RETIRED ✅, ADR-556 verified ✅.
- Tests cursor 30/30.

### ⚠️ ΕΚΚΡΕΜΕΙ ΧΩΡΙΣΤΑ (Giorgio: «χωριστά αργότερα» — ΜΗΝ το μπλέξεις τώρα)
- **Revert Phase 0 διαγνωστικών:** `bim3d-perf-diag` wiring σε 4 **committed** perf-critical 3D αρχεία
  (`ThreeJsSceneManager`, `overlay-raf`, `bim3d-pointer-scheduler`, `BimViewport3D`) + flags
  `dxf-no-render`/`dxf-no-overlays` + `mouse-handler-perf` hold-window. Flag-gated, μηδέν production impact,
  ΔΕΝ μπλοκάρει commit. Δική του εστιασμένη συνεδρία.

---

## 4. ΚΑΝΟΝΕΣ / VERIFY
- **tsc (N.17):** ΕΝΑΣ tsc τη φορά — έλεγξε για running tsc άλλου agent **ΠΡΙΝ** τρέξεις
  (`Get-CimInstance Win32_Process ... *tsc*`). Αυτή τη συνεδρία ΔΕΝ έτρεξα tsc (2 tsc άλλου agent ζωντανά).
- Μετά από κάθε αλλαγή: **hard reload (Ctrl+Shift+R)** — οι αλλαγές είναι uncommitted.
- **COMMIT/PUSH μόνο Giorgio.** Stage specific files (όχι `git add -A`). CHECK 6B/6D: αν αγγίξεις canvas-drawing
  files → stage σχετικό ADR (το `viewport-camera.ts` → ADR-363).
- Big-player + FULL SSOT + grep audit ΠΡΙΝ τον κώδικα. Μηδέν διπλότυπα.
