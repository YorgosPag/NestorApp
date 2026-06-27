# HANDOFF — 3D Viewport Crosshair / Cursor: full 2D parity (Revit / Cinema 4D grade)

**Date:** 2026-06-27
**Status of THIS task:** NOT STARTED (next session implements it)
**Quality bar:** FULL ENTERPRISE + FULL SSOT. Revit / Maxon (Cinema 4D) grade. Zero duplicates.
**⚠️ SHARED WORKING TREE** — another agent works in this repo simultaneously. Do **targeted** git ops only (`git add <specific files>`), **NEVER** `git add -A`, **NEVER** commit/push (Giorgio commits). One `tsc` at a time (N.17).

---

## 🎯 THE TASK

Add a **CAD crosshair to the 3D BIM viewport** (`BimViewport3D`) with **full parity to the 2D canvas crosshair**: tracks the cursor, shows the «+/−» add-badge next to it, and **jumps («κουμπώνει») to the active snap point** when OSNAP is on — exactly like the 2D canvas. Today the 3D viewport has **only the OS arrow cursor** (no crosshair). Giorgio's words: «ο κέρσορας 2D/3D δεν είναι ενιαίος, πιθανό διπλότυπο, όχι μία πηγή αλήθειας» — so the goal is **ONE crosshair SSoT shared by 2D and 3D**, not a parallel 3D copy.

### 🚨 MANDATORY FIRST STEP — REAL SSoT AUDIT (grep) BEFORE ANY CODE
Giorgio's explicit order: **grep the codebase first** to find existing crosshair/cursor code and **REUSE** it. Do NOT write a new parallel crosshair. Suggested greps:
- `grep -rn "CrosshairOverlay\|crosshair-compositor-layout\|registerDirectRender\|ImmediatePositionStore" src/subapps/dxf-viewer/`
- `grep -rn "getImmediatePosition\|setImmediatePosition\|getCursorSettings\|subscribeToCursorSettings" src/subapps/dxf-viewer/`
- `grep -rln "Crosshair\|crosshair" src/subapps/dxf-viewer/` (full inventory)
- Confirm whether the 2D `CrosshairOverlay` can be MOUNTED in 3D as-is (driven by a 3D-fed cursor position) vs. needing a thin adapter. **Prefer reuse over a new component.**

---

## 📍 SSoT MAP (already audited this session — VERIFY with fresh grep, then reuse)

### 2D crosshair (the SSoT to reuse)
- **`canvas-v2/overlays/CrosshairOverlay.tsx`** — the CAD crosshair. Compositor pattern (ADR-040): one promoted layer moved by `translate3d`. Driven by:
  - **`systems/cursor/ImmediatePositionStore.ts`** — cursor position SSoT. `registerDirectRender(cb)` → cb called synchronously by the 2D mouse handler with the (snapped) **screen** position. `getImmediatePosition()` reads it. This is the value the crosshair follows. **In 2D the fed position is ALREADY snapped → the crosshair visually «jumps» to the snap point. This is the parity mechanism.**
  - **`systems/cursor/config` `getCursorSettings` / `subscribeToCursorSettings`** — colours/size/gap/line-style.
  - **`systems/hover/HoverStore` + `systems/hover/hover-add-badge.ts resolveHoverBadge`** — the «+/−» add-badge decision (ALREADY shared 2D+3D, ADR-538).
  - **`systems/cursor/ImmediateSnapStore` `getFullSnapResult/subscribeSnapResult`** — drives the aperture (centre-square) hide when a snap marker is visible (`isSnapMarkerVisible`).
  - Layout helpers: **`canvas-v2/overlays/crosshair-compositor-layout.ts`** (`computeArmLength`, `computeSegmentBoxes`, `computeCenterGap`, `computeBadgeOffset`, `toAreaLocal`, `isWithinArea`, `translate3d`, `segmentBackground`). Uses `rulerMargins` (2D rulers) — for 3D pass `{left:0, top:0, bottom:0}`.

### 3D viewport (where to mount + how 3D overlays already work)
- **`bim-3d/viewport/BimViewport3D.tsx`** — root `<div className="absolute inset-0 z-50 cursor-default" onMouseMove={handleMouseMove} …>` (~line 365). All 3D overlays mount here as `absolute inset-0` siblings (canvas-local coords). Crosshair mounts here too. Note `cursor-default` (OS arrow still shows — decide whether to hide it via `cursor-none` when the CAD crosshair is on, like CAD apps).
- **`bim-3d/viewport/use-bim3d-pointer-handlers.ts`** — `handleMouseMove` (canvas pointer move). Already computes the 3D snap each move via `computeSnap3DHover` → writes `Snap3DOverlayStore`. **This is where you feed the 3D cursor screen position** into the shared cursor store (e.g. call the ImmediatePositionStore setter with canvas-local screen px; when a snap is active, feed the snapped point's projected screen px so the crosshair jumps — mirror 2D).
- **`bim-3d/viewport/snap/BimSnapIndicatorOverlay3D.tsx`** — the EXACT pattern to mirror for any RAF/projection overlay: `useRafWhile`, `useCameraMotionGate`, `makeGripPlanToCanvas(camera, canvas, elevFor)` projection, `GripDepthOccluder` occlusion, wrapper `transform = translate(px)`. Reuse these, don't reinvent.
- **`bim-3d/stores/Snap3DOverlayStore.ts`** — `{ view, elevMm }` snap marker (low-freq zustand + RAF read).
- **Projection SSoT**: `bim-3d/grips/grip-3d-screen-project.ts makeGripPlanToCanvas` (plan-mm → canvas-local px) + `bim-3d/viewport/coordinate-transforms.ts` (`dxfPlanToWorld`, `worldToDxfPlan`, `worldToScreen`).
- **Ray∩floor-plane SSoT**: `bim-3d/grips/grip-plane-projection.ts intersectRayHorizontalPlane(origin, dir, planeWorldY)` — if you want the crosshair to ride the **floor/drawing plane** (like 2D plan space) instead of the OS cursor screen point. `dxf-3d-floor-scope.ts getDxfFloorScope()` gives `floorElevationMm`.

### Already-fixed sibling (do NOT duplicate, learn from it)
- **`bim-3d/viewport/HoverAddBadge3D.tsx`** — the «+/−» badge. THIS SESSION fixed it: was `position:fixed`+`clientX/Y` (broke under transformed ancestors → flew far). Now `position:absolute` + **canvas-local** (`badge.parentElement.getBoundingClientRect()`). The crosshair work should **subsume this badge into the unified crosshair** if reusing `CrosshairOverlay` (which already renders the badge) — then DELETE `HoverAddBadge3D` to avoid two badge code paths. (Confirm before deleting; it's the shared-tree.)

---

## 🧠 RECOMMENDED APPROACH (validate via the SSoT audit first)

**Option A (preferred — true SSoT, zero new crosshair code):** Mount the existing **`CrosshairOverlay`** inside `BimViewport3D` with `rulerMargins={{left:0,top:0,bottom:0}}`. Drive its position by feeding the 3D cursor screen position into `ImmediatePositionStore` from `use-bim3d-pointer-handlers.handleMouseMove` (canvas-local screen px; snapped px when a snap is active, raw otherwise — mirror exactly what the 2D mouse handler feeds). Reuse the same cursor settings, badge (HoverStore), and aperture-hide. Then remove `HoverAddBadge3D` (its badge now comes from the crosshair). **Risk to clear in the audit:** `ImmediatePositionStore` is the 2D cursor SSoT — confirm only one viewport (2D XOR 3D) is mounted at a time so there's no cross-talk (the inactive viewport's handler doesn't fire). If they can coexist, gate by active viewport.

**Option B (if A couples 2D/3D unsafely):** A thin `BimCrosshairOverlay3D` that REUSES the `crosshair-compositor-layout` helpers + `getCursorSettings` + `resolveHoverBadge` + the snap store, positioned canvas-local (mirror `BimSnapIndicatorOverlay3D`). Still reuses every helper SSoT — only the mount/host differs. Document why A was rejected.

Decide A vs B **after** the grep audit. Whichever: the crosshair must (1) follow the cursor, (2) show the add-badge, (3) jump to the snap point, (4) reuse cursor settings/colours, (5) add ZERO duplicate geometry/badge logic.

### ADR
Likely extend **ADR-538** (hover badge / cursor parity) or a new **ADR-544** (next free after ADR-543) for «unified 2D/3D crosshair SSoT». Check `docs/centralized-systems/reference/adrs/` for the highest number first. Stage the ADR + ADR-040 (overlay perf) per CHECK 6B/6D when touching the listed perf-critical files.

---

## ✅ ALREADY DONE THIS SESSION (uncommitted, GREEN tsc/jest) — context, do NOT redo

All under **ADR-543**. Giorgio commits (targeted, shared tree). Files:

**A) Coincident-endpoint co-move (articulated joint, 2D+3D)** — drag the shared grip of two selected lines → both coincident endpoints move in ONE undo:
- NEW `systems/stretch/coincident-endpoint-comove.ts` (+ `__tests__/coincident-endpoint-comove.test.ts`, 13/13)
- `hooks/grips/grip-commit-adapters.ts` (the ONE shared 2D+3D commit seam — adds partner moves)
- `bim-3d/animation/use-bim3d-dxf-edit-interaction.ts` (3D seats grips for 2 lines)
- `bim-3d/stores/Grip3DOverlayStore.ts` (`dxfGhostEntityId` → `dxfGhostEntityIds[]`)
- `bim-3d/viewport/grips/BimGripOverlay2D.tsx` (3D partner ghost paint)
- `hooks/tools/useGripGhostPreview.ts` (2D partner ghost paint)

**B) 3D DXF multi-select (SSoT parity with 2D)** — click adds (PICKADD=1), Shift toggles, 2nd pick no longer deselects 1st:
- NEW `systems/selection/resolve-dxf-entity-click.ts` (+ `__tests__/resolve-dxf-entity-click.test.ts`, 5/5)
- `systems/selection/SelectionSystem.tsx` (2D `handleEntityClick` now calls the shared decision)
- `bim-3d/viewport/use-bim3d-pointer-handlers.ts` (3D DXF pick: guard `clearSelection` + shared decision)

**C) 3D hover «+» add-badge position fix:**
- `bim-3d/viewport/HoverAddBadge3D.tsx` (`fixed`→`absolute` canvas-local)

`tsc --noEmit` exit 0 for all touched files. Plan file: `C:\Users\user\.claude\plans\snuggly-snacking-pumpkin.md`.

---

## 🔴 PENDING INVESTIGATION (separate from the crosshair task)

**2D partner-ghost preview not rendering.** The co-move COMMIT works in 2D (both lines move, one undo) AND the 3D partner ghost preview works. But in the **2D canvas**, during the drag, only the dragged line's ghost shows — the **partner line's live ghost does not appear** (`drawComovePartnerGhosts` in `hooks/tools/useGripGhostPreview.ts`). Root cause unknown despite exhaustive static analysis: the 2D helper is logically identical to the working 3D one (`paintPartnerGhosts` in `BimGripOverlay2D.tsx`), inputs verified equal (2D selection has both ids — commit proves it; `getEntity` from level scene resolves both). A temporary `console.warn` diagnostic was added and then REMOVED. Re-investigate with a runtime probe (the user can read the browser console) — likely a subtle store/getEntity/coordinate detail, NOT architecture. Low priority (cosmetic; commit is correct).

---

## 📏 CONSTRAINTS / RULES
- Respond to Giorgio in **Greek** (CLAUDE.md language rule).
- FULL SSoT: grep first, reuse, no duplicates (N.0, N.12, Boy-Scout N.0.2).
- No `any` / `as any` / `@ts-ignore`; no inline styles; semantic HTML; ≤500 lines/file, ≤40 lines/function (N.7.1).
- i18n for any user-facing string (N.11) — crosshair is visual, likely none.
- ADR-040: orchestrators must NOT subscribe to high-freq stores; overlays are leaves; event-time reads via getters. Stage ADR-040 + the crosshair ADR (CHECK 6B/6D) when touching perf-critical files.
- **Shared tree**: targeted `git add` only; **Giorgio commits/pushes** (N.-1). Never `--no-verify` (N.-1.1).
- One `tsc` at a time — check for a running `tsc` first (N.17).
- Browser-verify before declaring done (no rulers in 3D; crosshair must track cursor + jump to snap + show badge).
