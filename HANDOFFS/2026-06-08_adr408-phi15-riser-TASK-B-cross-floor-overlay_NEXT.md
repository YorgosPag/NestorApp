# 🚿 HANDOFF — ADR-408 Φ15 Task B: Cross-floor «riser through» 2D σύμβολο (Revit-full)

> **Σύνταξη:** Opus 4.8, 2026-06-08. **Task A (height/floor «Έως όροφο» UI) DONE & COMMITTED** (`5ece033d` code+el-locale + `cfdd0614` en-locale· tsc 0 / 55-55 mep-segments jest). Μένει **Task B** = το «ζευγάρι» που ολοκληρώνει το riser.
> **Ρόλος σου:** υλοποίησε το Task B **FULL ENTERPRISE + FULL SSOT, Revit-grade** (ρητή εντολή Giorgio «όπως οι μεγάλοι παίχτες / Revit»). Οι αρχιτεκτονικές αποφάσεις είναι **κλειδωμένες** παρακάτω → ΟΧΙ νέο AskUserQuestion εκτός αν προκύψει κάτι ουσιαστικό.

---

## ⚠️ ΚΡΙΣΙΜΟΙ ΚΑΝΟΝΕΣ (αμετάβλητοι)
- **SHARED working tree** με codex agents (thermal-space ADR-422 + mep-segment Φ8 #2b ενεργά). `git add` **ΜΟΝΟ δικά σου** αρχεία, **ΠΟΤΕ** `git add -A`. Προσοχή σε merge των shared (`CanvasLayerStack.tsx` ίσως co-edited).
- **ΟΧΙ commit / ΟΧΙ push** — **commit τα κάνει ΜΟΝΟ ο Giorgio** (N.(-1)). Εσύ: υλοποίηση + έλεγχοι + ανάφερε.
- **Ελληνικά** όλες οι απαντήσεις (LANGUAGE RULE).
- **STAGE ADR-040** (CHECK 6B/6D) — το Task B **αγγίζει canvas overlay** (νέο leaf + `CanvasLayerStack.tsx` mount). Διάβασε `docs/centralized-systems/reference/adrs/ADR-040-preview-canvas-performance.md` ΠΡΙΝ + stage το στο commit-set. **ΜΗΝ** `adr-index.md` (shared).
- **N.17 — ΕΝΑ tsc τη φορά:** ΠΡΙΝ `tsc` έλεγξε ότι δεν τρέχει άλλος (codex):
  `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object -Property CommandLine -Like '*tsc*' | Select-Object ProcessId"` (κενό = ελεύθερο). Ο Bash tool = POSIX bash → χρησιμοποίησε `grep`, ΟΧΙ `Select-String`.
- **N.8:** ~4-6 αρχεία, 1 domain (cross-floor 2D overlay) → **Plan Mode** (όχι orchestrator). Recognition πρώτα.

---

## 1) ΤΙ ΕΧΕΙ ΓΙΝΕΙ (Φ15 v1 + Task A — όλα committed/intact)

**Locked αρχιτεκτονική Φ15 (Giorgio):** η κατακόρυφη στήλη ΕΙΝΑΙ vertical `mep-segment` (zero fork) · ΜΙΑ οντότητα στον base-floor (span μέσω absolute datum-relative z) · 2D σύμβολο σε ΚΑΘΕ διαπερνώμενο όροφο.

- **Engine (v1):** `isSegmentVertical(params)`/`riserDirection(params)` (`bim/types/mep-segment-types.ts`· plan<`RISER_MAX_PLAN_MM=50` && rise>`RISER_MIN_RISE_MM=100`)· `resolveSegmentEndpointElevationsMm(params)` (`bim/mep-segments/...` ή `mep-segment-types` — γ' z ανά άκρο, datum-relative mm).
- **2D glyph SSoT (v1):** `buildRiserSymbol(centreScreen, RISER_SYMBOL_RADIUS_PX=9, direction)` (`bim/mep-segments/mep-riser-symbol.ts`) → `{cx, cy, r, strokes}` **screen-space** (κύκλος `ctx.arc(cx,cy,r)` + inner-cross + up/down βέλος). **REUSE ΑΥΤΟ στο Task B — μηδέν νέο glyph.**
- **Owner-floor render (v1):** `MepSegmentRenderer.renderRiser()` ζωγραφίζει το glyph για risers **του ενεργού** ορόφου (πριν το `verts<3` guard). **STAGED ADR-040.**
- **Task A (committed):** contextual tab «Κατακόρυφη Στήλη» base=τρέχων όροφος / «Έως όροφο»=top / DN. tool `'mep-drain-riser'`.

**Elevation convention (ΚΡΙΣΙΜΟ):** segment `startPoint.z`/`endPoint.z` = **datum-relative mm**. Floor → datum-relative: `resolveFloorDatumRelativeElevationMm(floor.elevation, datumM)` όπου `datumM = resolveBuildingDatumElevationM(floors)` (`bim-3d/scene/floor-stack-elevation.ts`). 3D world Y = `z·0.001 + buildingBaseElevationM`.

---

## 2) 🎯 TASK B — Cross-floor «riser through» (Revit-true)

**Στόχος:** στον **ενεργό** όροφο, ζωγράφισε derived riser σύμβολο (κύκλος + up/down βέλος) για κάθε στήλη **άλλου ορόφου** της οποίας το z-range διαπερνά το current floor FFL. Single source = οι base-floor risers· τα υπόλοιπα **derived** (zero duplicate persistence, Revit «cut plane» annotation).

**Revit semantics:** μια στήλη που περνά από έναν όροφο φαίνεται εκεί ως μικρός κύκλος με βέλος (up αν συνεχίζει προς τα πάνω, down αν κατεβαίνει). Χωρίς αυτό, ο μηχανικός δεν βλέπει ότι περνά στήλη από το επίπεδό του.

### 🔒 Κλειδωμένες αρχιτεκτονικές αποφάσεις
1. **Πηγή = raw `SceneModel` BIM entities, ΟΧΙ converted DxfScene.** Το `useFloors2DUnderlay` (`hooks/data/useFloors2DUnderlay.ts`) επιστρέφει `convertSceneToDxf(model)` → **χάνει** τα mep-segment z/params. Το Task B χρειάζεται τα ωμά `model.entities` (mep-segment + z) **πριν** το convert.
2. **Boy-Scout extraction (N.0.2) — `useBuildingFloorScenes`:** το cross-floor sourcing (visited→`getLevelScene(levelId)` · unvisited file-linked→one-shot `DxfFirestoreService.loadFileV2(sceneFileId)` cached σε state, + SSoT visibility `floorVisibilityModes==='hide'`) ζει **inline** στο `useFloors2DUnderlay`. **Εξάγαγέ το** σε NEW `hooks/data/useBuildingFloorScenes.ts` που επιστρέφει `{ levelId, floorId, model: SceneModel }[]` (ωμά, **πριν** convert). Μετά: (α) refactor `useFloors2DUnderlay` να το καταναλώνει + `convertSceneToDxf` (zero behaviour change· τα tests `useFloors2DUnderlay.test.ts` πρέπει να μένουν πράσινα), (β) ο νέος riser overlay το καταναλώνει + φιλτράρει BIM mep-segments. **ΕΝΑ SSoT για cross-floor sourcing, δύο consumers.** (Αυτό είναι το flag στο `pending-ratchet` «extract useBuildingFloorScenes».)
3. **Glyph draw SSoT — `drawRiserSymbol(ctx, symbol, color)`:** το draw (arc + κάθε stroke `moveTo/lineTo`) ζει σήμερα inline στο `MepSegmentRenderer.renderRiser`. **Εξάγαγέ το** σε helper (στο `mep-riser-symbol.ts` ή δίπλα) → καλείται και από `renderRiser` (owner) και από το Task-B overlay → **ταυτόσημο** σύμβολο, μηδέν drift. (Αν το `renderRiser` έχει color/lineweight specifics, πέρασέ τα ως param.)
4. **Overlay = custom screen-space leaf (mirror `RegionPerimeterPreviewOverlay.tsx`), ΟΧΙ full-scene DxfRenderer.** Canvas leaf με `{transform, viewport}` props, `pointer-events-none`, mount στο `CanvasLayerStack.tsx` (όπου mount-άρει το `FloorUnderlayOverlay`). Projection world→screen: **`CoordinateTransforms.worldToScreen(worldPoint, transform, viewport)`** (`rendering/core/CoordinateTransforms`). ADR-040 micro-leaf: subscribe ΜΟΝΟ εδώ (zero high-freq store), repaint σε scene/transform/viewport.
5. **Activation/scope:** ενεργό σε **`mode==='2d'`** (any `floor3DScope` — μια στήλη που περνά φαίνεται ΚΑΙ όταν βλέπεις μόνο τον τρέχοντα όροφο, ΟΧΙ μόνο σε «all floors»). Cross-floor sourcing μέσω `useBuildingFloorScenes` (lazy `loadFileV2` cached — ίδιο κόστος με underlay). Αν θες perf-gate, σημείωσέ το· default = always-on σε 2D.

### Βήματα
1. **NEW `hooks/data/useBuildingFloorScenes.ts`** (Boy-Scout extract, §απόφαση 2) → refactor `useFloors2DUnderlay` να το consume-άρει.
2. **NEW `bim/mep-segments/derive-risers-through-floor.ts`** (pure): `(buildingVerticalSegments: MepSegmentEntity[], currentFloorElevMm: number) → { centreXY: Point2D, direction: 'up'|'down' }[]` για risers όπου `min(startZ,endZ) <= currentFloorElevMm <= max(startZ,endZ)` **ΚΑΙ** ο όροφος δεν είναι ο owner (αλλιώς διπλό με `renderRiser`). Reuse `isSegmentVertical`/`resolveSegmentEndpointElevationsMm`/`riserDirection`. + NEW test (boundary FFL, owner-exclusion, up/down, non-vertical skip).
3. **NEW glyph draw helper** (§απόφαση 3) + wire στο `MepSegmentRenderer.renderRiser` (Boy-Scout, owner ΑΜΕΤΑΒΛΗΤΟ visual).
4. **NEW overlay leaf** `components/dxf-layout/RiserThroughOverlay.tsx` (mirror `RegionPerimeterPreviewOverlay`): φιλτράρει τα `useBuildingFloorScenes` σε vertical mep-segments, τρέχει `derive-risers-through-floor` ανά floor model (currentFloorElevMm = datum-relative του ενεργού), `worldToScreen(centreXY)` → `drawRiserSymbol`. **STAGE ADR-040.**
5. **Mount** στο `CanvasLayerStack.tsx` δίπλα στο `<FloorUnderlayOverlay transform viewport />` (πέρασε τα ίδια `transform`/`viewport`). **STAGE ADR-040.**

---

## 3) CRITICAL SSoT REUSE (ακριβή paths)
- `buildRiserSymbol` + `RISER_SYMBOL_RADIUS_PX` — `bim/mep-segments/mep-riser-symbol.ts` (+ NEW `drawRiserSymbol` εδώ).
- `isSegmentVertical`/`riserDirection`/`resolveSegmentEndpointElevationsMm` — `bim/types/mep-segment-types.ts`.
- `resolveBuildingDatumElevationM`/`resolveFloorDatumRelativeElevationMm` — `bim-3d/scene/floor-stack-elevation.ts`.
- Cross-floor SceneModel sourcing — **inline σήμερα** στο `hooks/data/useFloors2DUnderlay.ts` → extract σε NEW `useBuildingFloorScenes.ts`.
- Overlay leaf πρότυπο (custom screen-space glyph) — `components/dxf-layout/RegionPerimeterPreviewOverlay.tsx`.
- world→screen — `CoordinateTransforms.worldToScreen(p, transform, viewport)` (`rendering/core/CoordinateTransforms`).
- Mount site — `components/dxf-layout/CanvasLayerStack.tsx` (όπου `FloorUnderlayOverlay`).
- `useLevelsOptional` (`systems/levels/useLevels.ts`) — current level → buildingId/floorId.

---

## 4) ΕΛΕΓΧΟΙ (§5)
- **N.17** → `npx tsc --noEmit 2>&1 | grep -iE "riser|mep-segment|overlay|underlay|building-floor-scenes|CanvasLayerStack"` → 0 δικά σου (αγνόησε pre-existing `mesh-to-object3d:124` + codex WIP).
- **jest:** `npx jest src/subapps/dxf-viewer/bim/mep-segments` + `useFloors2DUnderlay` (πρέπει να μένει πράσινο μετά το extract) + νέο `derive-risers-through-floor` test.
- **Browser (Giorgio):** «Κατακόρυφη Στήλη» → «Έως όροφο: 3ος» → κλικ στον 0/1 → (α) στους ενδιάμεσους ορόφους 1-2 εμφανίζεται derived κύκλος+βέλος **up**· (β) στον owner ΔΕΝ διπλασιάζεται· (γ) pan/zoom → σταθερό μέγεθος glyph· (δ) selection/persistence ανέπαφα (overlay = `pointer-events-none`).

## 5) TRACKERS @ commit (N.15 — ο Giorgio committαρει)
- `docs/.../ADR-408-mep-connectors-and-systems.md` changelog (Φ15 Task B) **+ ADR-040 changelog** (νέο overlay leaf).
- `.claude-rules/pending-ratchet-work.md` — αφαίρεσε το flag **Φ15 (a)** «cross-floor riser through» + το «extract useBuildingFloorScenes» dedup σημείωμα όταν γίνει.
- `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (group ADR-408 Φ15) + memory `project_adr408_phi15_riser.md` + MEMORY.md pointer.
- **ΜΗΝ** `adr-index.md` (shared). Flags που μένουν Φ15: (c) vent stack / DN sizing (DFU) / outfall terminal / BOQ-ΗΛΜ, (d) browser verify.

## 6) Σχετικές μνήμες
`project_adr408_phi15_riser` (master riser), `project_adr408_phi14_drainage` (αποχέτευση), `project_adr236_multi_level`/ADR-399 (cross-floor + datum), `project_adr408_phiA_per_endpoint_z` (per-endpoint z).

---

## 📌 ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ (νέα session, Opus)
1. Διάβασε αυτό + `mep-riser-symbol.ts` / `useFloors2DUnderlay.ts` / `RegionPerimeterPreviewOverlay.tsx` / `MepSegmentRenderer.renderRiser` / ADR-040 → state check (shared tree).
2. **Plan Mode** σύντομο (αποφάσεις locked).
3. Υλοποίησε: extract `useBuildingFloorScenes` → `derive-risers-through-floor` → `drawRiserSymbol` extract → `RiserThroughOverlay` leaf → mount.
4. Έλεγχοι §4 → ανάφερε (ΟΧΙ commit). Trackers §5 ετοιμάζεις.
