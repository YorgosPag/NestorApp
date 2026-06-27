# HANDOFF 2026-06-28 — 3D cursor lag: swim + click-INP

## ΚΑΤΑΣΤΑΣΗ ΣΥΝΟΛΙΚΑ
Πρόβλημα Giorgio: ο κέρσορας στον **3D BIM viewport** (`/dxf/viewer` → 3D) lag-άρει. Πάμε iteratively με profiles μέχρι να γίνει **εντελώς solid**. Τρεις γύροι έγιναν· **2 μέτωπα ανοιχτά**.

## ΤΙ ΕΧΕΙ ΓΙΝΕΙ

### ✅ COMMITTED (`16f8906f` perf(dxf): 3D raycaster BVH + pointer scheduler + scene-render-stats)
- **Φ1/Φ2/Φ3 (raycasting decoupling)** — NEW `raycastBimHitAndWorld` (ένα raycast), NEW `bim3d-pointer-scheduler.ts` (RAF slot, mirror 2D snap-scheduler), NEW `bvh-setup.ts` (three-mesh-bvh, ήδη dep). Αποτέλεσμα: 34/35 hover commits = 1-2ms. **ΔΕΝ ήταν αυτό το lag.**
- **React re-render storms fix (#1-#4)** — η ΠΡΑΓΜΑΤΙΚΗ ρίζα του freeze ήταν `CursorSystem` context fan-out → `CanvasSection` re-render 250 fibers/178ms. Fix: **split contexts** (`CursorActionsContext`+`CursorSettingsContext` σταθερά, `CursorSystem.tsx`+`useCursor.ts`) + status bars + `EntityContextMenuHost` memo + `DxfViewerDialogs` gate-at-mount 3 import modals + `ThermalEnvelopeHost` → `useUniversalSelectionStable`. **Επιβεβαιωμένο από 2ο React profile: ο CursorSystem cascade ΕΞΑΦΑΝΙΣΤΗΚΕ.**

### 🔴 UNCOMMITTED (4 files — swim fix, χρειάζεται commit μετά από test)
1. `src/subapps/dxf-viewer/bim-3d/viewport/snap/bim3d-pointer-scheduler.ts` — **markSceneDirty hover-gate**: `setHoveredEntity`/`applyBimHover`/`markSceneDirty` ΜΟΝΟ όταν αλλάζει το `lastHoverId` (πριν: full WebGL render κάθε 50ms ακόμα κι ακίνητο hover → «κολύμπημα»).
2. `src/subapps/dxf-viewer/bim-3d/stores/Snap3DOverlayStore.ts` — **setSnap dedup** (`snapMarkersEqual`): no-op όταν ίδιο snap/null → μηδέν crosshair re-renders σε ακίνητο/κενό.
3. `src/subapps/dxf-viewer/bim-3d/viewport/snap/__tests__/bim3d-pointer-scheduler.test.ts` — +1 test (render μόνο σε hover change). 7/7 GREEN.
4. `docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md` — changelog 2026-06-28 + 2026-06-28(b).

tsc 0 errors. **N.(-1): commit μόνο με ρητή εντολή Giorgio.**

## ΤΙ ΜΕΝΕΙ (2 μέτωπα)

### Μέτωπο Α — «Κολύμπημα» (mousemove, imperative)
- Status: swim fix (παραπάνω) **uncommitted, ΔΕΝ έχει δοκιμαστεί** από Giorgio.
- **ΕΠΟΜΕΝΟ ΒΗΜΑ:** Giorgio δοκιμάζει. Αν μείνει swim → ανάλυση του Chrome trace (κάτω). Εφεδρικοί ύποπτοι (όχι ακόμα διορθωμένοι): `getBoundingClientRect` per-move στο `toCanvasLocal` (`BimCrosshairOverlay3D.tsx`), `pickDxfEntityAcrossFloors` O(N) per-pick στο κενό.

### Μέτωπο Β — Κλικ παγώνει 1,7 δευτ. (INP, ΞΕΧΩΡΙΣΤΟ)
- Δεδομένα Web Vitals (Giorgio): **INP = 1744ms** (ελλ. «1.744 ms» = 1744· processing **1275ms** + presentation 468). INP μετράει **clicks**, ΟΧΙ mousemove → άσχετο με το swim.
- Υπόθεση (από agent audit, μη επιβεβαιωμένη): click-selection → `DxfViewerTopBar` re-render → **~25 persistence hosts** ο καθένας `currentScene.entities.find()` O(n) + `EntityContextMenu` O(n²) join-preview + ribbon rebuild, όλα στο ίδιο commit. Interactions στοχεύουν `canvas.dxf-canvas z-10` (2D canvas ακόμα mounted πίσω από 3D).
- **ΕΠΟΜΕΝΟ ΒΗΜΑ:** ανάλυση Chrome trace για το ποιο ακριβώς click handler κάνει τα 1275ms· μετά fix (πιθανώς: persistence hosts → leaf-subscribe selection αντί prop· EntityContextMenu lazy compute on-open).

## 🆕 ΝΕΟ ΑΡΧΕΙΟ ΠΡΟΣ ΑΝΑΛΥΣΗ
`C:\Users\user\Downloads\Trace-20260628T012423.json.gz` (8MB Chrome DevTools Performance trace). **ΔΕΝ αναλύθηκε** (context όριο). Είναι το σωστό εργαλείο και για το swim (imperative, RAF/paint/GPU) και για το click-1275ms. Ανάλυση: gunzip → JSON trace events (ph/ts/dur/name) → ψάξε long tasks κατά mousemove (swim) + το pointer interaction με ~1275ms (click). Πιθανό: GPU readback (`grip-3d-depth-occluder` readRenderTargetPixels) per-frame στο RAF crosshair, ή WebGL render, ή το selection commit.

## ΚΡΙΣΙΜΑ ΑΡΧΕΙΑ
- 3D pick/snap: `bim-3d/viewport/snap/bim3d-pointer-scheduler.ts`, `Snap3DOverlayStore.ts`, `bim-3d/viewport/BimCrosshairOverlay3D.tsx`, `bim-3d/viewport/snap/project-snap3d-marker.ts` (occlusion GPU readback!), `overlay-raf.ts`.
- Cursor context: `systems/cursor/CursorSystem.tsx`, `useCursor.ts`.
- Click/selection: `app/DxfViewerTopBar.tsx` (~25 persistence hosts + ribbon), `components/dxf-layout/EntityContextMenuHost.tsx` + `canvas-section-entity-menu.ts`, `hooks/useEntityJoin.ts` (O(n²) getJoinPreview).
- ADR: `ADR-040-preview-canvas-performance.md` (CHECK 6B/6D → stage σε κάθε commit αυτών).

## ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗΝ ξαναγγίξεις το raycasting/BVH (committed, δούλεψε — δεν ήταν το πρόβλημα).
- ΜΗΝ memoize-άρεις τα ribbon `ribbonCommands` (busts σε selection by-design ADR-532 B5· πραγματικό fix = leaf-split, ξεχωριστό refactor).
- ΜΗΝ κάνεις gate-at-mount το `EntityContextMenu` (ανοίγει imperative via ref → πρέπει να μένει mounted).
- ΜΗΝ commit/push χωρίς ρητή εντολή (N.(-1)). Stage ADR-040 μαζί (CHECK 6B/6D).
- ⚠️ Shared tree (πολλοί agents) — `git status` πριν από οτιδήποτε.

## MEMORY
`reference_3d_cursor_lag_decoupling.md` (auto-memory) — ενημερωμένο με fix 1/2/3.
