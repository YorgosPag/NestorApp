# HANDOFF — Σχεδίαση τοίχου με ΜΙΑ πηγή αλήθειας 2D ↔ 3D (ADR-543)

**Ημερομηνία:** 2026-06-27
**Status:** Φάση 0 (ADR) + Φάση 1 (πυρήνας 3D drawing) + Φάση 2 (HUD overlay) + **Φάση 3 (COL/alignment traces 3D)** **ΥΛΟΠΟΙΗΘΗΚΑΝ — UNCOMMITTED**
**Tests:** Φάση 3: 18/18 GREEN (10 νέα: compose 6 + store 4· + 8 Φάση-1 με ενημερωμένο mock). Σύνολο νέων: 22+.
**⚠️ Working tree μοιράζεται με άλλον agent** (ο οποίος δουλεύει ADR-544 = το ΑΝΤΙΣΤΟΙΧΟ για ΚΟΛΩΝΑ).
**Commit:** ΜΟΝΟ ο Giorgio. Όχι ο agent (N.(-1)).

---

## 1. Τι ζητήθηκε
«Ο τοίχος να σχεδιάζεται στο 3D viewport με την ΙΔΙΑ ακριβώς εμπειρία/κώδικα όπως στο 2D —
COL γραμμές, ζωντανές διαστάσεις, σημάδια OSNAP, 2-κλικ — ΜΙΑ και μοναδική πηγή αλήθειας,
μηδέν διπλότυπα (Revit / Maxon Cinema 4D grade, full enterprise + full SSoT).»

## 2. Τι έγινε (όλα UNCOMMITTED)

**SSoT αρχή:** ο πυρήνας σχεδίασης τοίχου (FSM/builders/geometry/snap/commit/persistence) ήταν
ήδη καθαρός/κοινός. Το 3D προσθέτει ΜΟΝΟ γέφυρα-εισόδου + ghost + HUD overlay. Ίδιο μοτίβο με
3 υπάρχοντα precedents (κολώνα/MEP/δοκάρι: 3D κλικ → EventBus → ίδιο `onCanvasClick`).

### Φάση 0 — ADR
- `docs/centralized-systems/reference/adrs/ADR-543-wall-drawing-ssot-2d-3d.md` (πλήρες· trace 2D pipeline + SSoT πίνακας + γνωστή απόκλιση + εκκρεμότητες).
- `docs/centralized-systems/reference/adr-index.md` — εγγραφή ADR-543 (2 πίνακες). **Προσοχή:** άλλος agent πρόσθεσε ήδη ADR-544 — μην το πειράξεις.

### Φάση 1 — Πυρήνας 3D drawing
- **MOD** `src/subapps/dxf-viewer/systems/events/drawing-event-map-bim.ts` — νέο event `'bim:place-wall-3d': { point: Point2D }` (μετά το `bim:place-column-3d`).
- **MOD** `src/subapps/dxf-viewer/hooks/drawing/useWallTool.ts`:
  - import `EventBus`, `type SceneUnits`.
  - listener `EventBus.on('bim:place-wall-3d', ({point}) => onCanvasClickRef.current(point))` (mirror κολόνας, μετά το `finishPolyline`).
  - δημοσίευσε `getSceneUnits` (stable, ref-backed) στο bridge publish effect.
- **MOD** `src/subapps/dxf-viewer/ui/ribbon/hooks/bridge/wall-tool-bridge-store.ts` — πρόσθεσε `getSceneUnits(): SceneUnits` στο `WallToolBridgeHandle`.
- **NEW** `src/subapps/dxf-viewer/bim-3d/placement/use-bim3d-wall-placement.ts` — armed `activeTool==='wall' && selectIs3D`. raycast floor → `worldToPlanMm` → `resolvePlacementSnap` → ghost+marker+HUD· click (orbit-guard 5px) → `emit('bim:place-wall-3d')`. Floor-plane, **χωρίς per-click z**.
- **NEW** `src/subapps/dxf-viewer/bim-3d/placement/WallPlacementGhost.ts` — reuse `generateWallPreview` (2D ghost SSoT) + `wallToMesh` (committed-wall converter). Επιστρέφει `WallHudMeta` για το overlay.
- **MOD** `src/subapps/dxf-viewer/bim-3d/viewport/use-bim3d-placement-and-pick-hooks.ts` — register `useBim3DWallPlacement`.
- **NEW test** `bim-3d/placement/__tests__/use-bim3d-wall-placement.test.ts` (8 tests).

### Φάση 2 — HUD / ζωντανές διαστάσεις στο 3D
- **MOD** `src/subapps/dxf-viewer/canvas-v2/preview-canvas/wall-hud-paint.ts` — **projector seam**: νέο `WallHudProjector` + `paintWallHudCore(ctx, meta, specLabel, proj)` (η ΔΙΑΤΑΞΗ HUD ζει ΜΙΑ φορά). `paintWallHud` (2D) = thin adapter → **ΜΗΔΕΝ αλλαγή 2D συμπεριφοράς**. Νέο `paintProjectedAlignedDim` (projected dim line μέσω κοινών overlay SSoTs) για 3D.
- **NEW** `src/subapps/dxf-viewer/bim-3d/viewport/wall-hud/wall-3d-hud-store.ts` — non-reactive HUD payload (high-freq, ADR-040): `wall3DHudData` + `setWall3DHud`/`clearWall3DHud`.
- **NEW** `src/subapps/dxf-viewer/bim-3d/viewport/wall-hud/WallHudOverlay3D.tsx` — Canvas2D overlay (mirror `BimGripOverlay2D`): RAF + `useCameraMotionGate`, projection `makeGripPlanToCanvas`, καλεί τον ίδιο `paintWallHudCore`. Spec label = ίδιο key `tools.wall.hudSpec` (μηδέν νέο key).
- **MOD** `src/subapps/dxf-viewer/bim-3d/viewport/BimViewport3D.tsx` — mount `<WallHudOverlay3D managerRef={managerRef} />` (μετά το `BimSnapIndicatorOverlay3D`).
- **MOD** `use-bim3d-wall-placement.ts` — γράφει `setWall3DHud(hud, elev, units)` σε κάθε move· `clearWall3DHud()` σε leave/teardown.
- **NEW test** `canvas-v2/preview-canvas/__tests__/wall-hud-paint-projector.test.ts` (4 tests).

## 2β. Τι έγινε στη Φάση 3 (COL/alignment traces 3D — UNCOMMITTED)
**SSoT εύρημα:** ο ADR-544 agent είχε ήδη κάνει το `tracking-paint` projection-agnostic + τον `makePlacementOverlayProjector`, αλλά ΔΕΝ τροφοδοτούσε tracking στο 3D. Reuse ΟΛΗΣ της υποδομής.
- **NEW** `systems/tracking/ambient-tracking-compose.ts` — pure `composeTrackingSnap` (merge acquired+ambient → `resolveTrackingSnap` → adaptive quantize). ΕΝΑΣ tracking-εγκέφαλος 2D+3D.
- **MOD** `hooks/drawing/drawing-hover-handler.ts` — 2D refactored να καλεί `composeTrackingSnap` (zero behavior change· αφαιρέθηκαν τα inline `resolveTrackingSnap`/`adaptiveDistanceStep`/`quantizeAlongPath` imports).
- **MOD** `ui/ribbon/hooks/bridge/wall-tool-bridge-store.ts` + `hooks/drawing/useWallTool.ts` — δημοσίευση `getSceneEntities()` στο bridge (3D ambient = 2D ambient).
- **NEW** `bim-3d/viewport/tracking/tracking-3d-store.ts` — non-reactive payload (ADR-040, mirror `wall-3d-hud-store`).
- **NEW** `bim-3d/viewport/tracking/Tracking3DOverlay.tsx` — RAF overlay (mirror `WallHudOverlay3D`): `makePlacementOverlayProjector` + ΙΔΙΟΙ `paintAlignmentPaths`/`paintIntersections`/`paintTrackingMarkers`/`paintTooltip`.
- **MOD** `bim-3d/viewport/BimViewport3D.tsx` — mount `<Tracking3DOverlay>` (⚠️ αρχείο shared· άλλος agent πρόσθεσε ADR-545 crosshair — το mount μου διατηρήθηκε).
- **MOD** `bim-3d/placement/use-bim3d-wall-placement.ts` — `resolvePlacement` (κοινό onMove+onClick): OSNAP → ambient tracking (scene units, camera `scenePerPx`) → override scene point (ghost ≡ commit) + publish· clear σε miss/leave/teardown.
- **NEW tests** `ambient-tracking-compose.test.ts` (6) + `tracking-3d-store.test.ts` (4)· **MOD** `use-bim3d-wall-placement.test.ts` mock (camera.position.distanceTo + getPixelWorldSize + getSceneEntities).

## 3. Επόμενο βήμα (ΕΚΚΡΕΜΕΙ)
1. **🔴 BROWSER-VERIFY** (`http://localhost:3000/dxf/viewer`):
   - 2D: σχεδίασε τοίχο → **μηδέν regression** (ghost/HUD/COL traces/snap/commit ίδια — το tracking τρέχει τώρα μέσω `composeTrackingSnap`).
   - 3D: «Τοίχος» → κίνηση: **COL/alignment dashed γραμμές** (ambient, κουμπώνουν H/V σε κοντινά μέλη) + HUD + snap markers → 2ο κλικ commit + persist.
   - Επιβεβαίωση SSoT: ταυτόσημος committed τοίχος 2D vs 3D.
2. **Commit** (Giorgio): stage code + tests + **ADR-040 + ADR-543** (CHECK 6B/6D αγγίζεται `BimViewport3D.tsx`) + adr-index. **ΟΧΙ** `git add -A` (shared tree).

## 3β. Γνωστά (ΟΧΙ δικά μου)
- `useWallTool.test.tsx`: 8 pre-existing failures (committed drift — test περιμένει παλιό 3-click FSM). **Αποδείχθηκε** με HEAD-version run: ίδια 8 failures χωρίς καμία uncommitted αλλαγή. Εκτός scope.
- 3D tracking: μόνο **ambient** (auto)· manual hover-acquisition (1s) + polar (F8/F10) είναι follow-up (δεν υπάρχει 3D surface).

## 4. Κρίσιμο context / κίνδυνοι
- **Γνωστή απόκλιση (τεκμηριωμένη στο ADR §Consequences):** η 3D length-dim line ΔΕΝ είναι ISO-129 (arrowheads/extension lines) — αυτή η μηχανή (`renderPreviewDimension`) είναι θεμελιωδώς affine (uniform `transform.scale`) και δεν προβάλλεται σε perspective camera. Στο 3D = κοινή overlay dashed γραμμή (ίδιο χρώμα/αριθμός/format). Τα νούμερα/ετικέτες/διάταξη ΕΙΝΑΙ κοινά.
- **Untested glue:** η προβολή του overlay (toScreen/worldPerPixel scene→mm) δοκιμάζεται ΜΟΝΟ στο browser (τα pure parts καλύπτονται από jest). Αν οι διαστάσεις φαίνονται μετατοπισμένες, έλεγξε το `mmFactor = 1/mmToSceneUnits(sceneUnits)` + το `scenePerPx` στο `WallHudOverlay3D.tsx`.
- **N.17:** ΜΗΝ τρέξεις full tsc αν τρέχει άλλος agent (shared tree). Έγινε SKIP εδώ — επαλήθευση μέσω 22 jest.
- **Snap parity:** το 3D εφαρμόζει `resolvePlacementSnap` (OSNAP) ΠΡΙΝ το emit (ίδιο με κολόνα/MEP)· το FSM εφαρμόζει face-snap από πάνω (ίδιο με 2D). preview ≡ commit.

## 5. ΜΗΝ κάνεις
- ΜΗΝ commit/push (Giorgio το κάνει).
- ΜΗΝ `git add -A` (shared tree με ADR-544 agent).
- ΜΗΝ αλλάξεις την υπογραφή/συμπεριφορά του 2D `paintWallHud` (thin adapter — κρατά 2D αμετάβλητο).
- ΜΗΝ πειράξεις το ADR-544 (άλλος agent).
- ΜΗΝ δημιουργήσεις νέο i18n key για το spec label — υπάρχει `tools.wall.hudSpec`.
