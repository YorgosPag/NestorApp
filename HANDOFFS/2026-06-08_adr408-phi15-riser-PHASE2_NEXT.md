# 🚿 HANDOFF — ADR-408 Φ15 Phase-2: Risers (cross-floor σύμβολο + height/floor UI)

> **Σύνταξη:** Opus 4.8, 2026-06-08. Το Φ15 **v1 (engine + tool)** υλοποιήθηκε & επαληθεύτηκε (tsc 0 / 837 jest PASS), **pending commit** (κάνει ο Giorgio).
> **Ρόλος επόμενου agent:** ολοκλήρωση των ΔΥΟ deferred κομματιών του riser. Quality: **FULL ENTERPRISE + FULL SSOT, Revit-grade** (ρητή εντολή Giorgio «όπως οι μεγάλοι παίχτες / Revit»).

---

## ⚠️ ΚΡΙΣΙΜΟΙ ΚΑΝΟΝΕΣ (αμετάβλητοι)
- **SHARED working tree** με codex agents (μόλις μπήκε ADR-422 thermal-space σε `ribbon-contextual-config.ts`/`canvas-click-types.ts`/`home-tab-draw.ts`/`CanvasSection.tsx`). `git add` **ΜΟΝΟ δικά σου** αρχεία, **ΠΟΤΕ** `git add -A`. Προσοχή σε merge των shared.
- **ΟΧΙ commit / ΟΧΙ push** (N.(-1)). Ελληνικά απαντήσεις (LANGUAGE RULE).
- **STAGE ADR-040** (CHECK 6B/6D) όταν αγγίξεις canvas overlay/renderer/CanvasSection. **ΜΗΝ** `adr-index.md` (shared).
- **N.17:** ΠΡΙΝ `tsc` έλεγξε ότι δεν τρέχει άλλος (codex). ΕΝΑ tsc τη φορά: `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object Name -eq node.exe | ForEach-Object CommandLine" | grep "tsc --noEmit"`.
- **N.8 Orchestrator-level** (~12-15 αρχεία 2 domains: ribbon/bridge + cross-floor 2D). Ξεκίνα recognition· οι αρχιτεκτονικές αποφάσεις είναι ΗΔΗ κλειδωμένες (κάτω) → ΟΧΙ νέο AskUserQuestion εκτός αν προκύψει κάτι.

---

## 1) ΤΙ ΕΧΕΙ ΓΙΝΕΙ (Φ15 v1 — engine + tool, pending commit)

**Locked αρχιτεκτονική (Giorgio AskUserQuestion 2026-06-08):** extend `mep-segment` (zero fork — ο κατακόρυφος σωλήνας ΕΙΝΑΙ Pipe) · ΜΙΑ οντότητα base-floor (span μέσω absolute datum-relative z) · placement = base/top όροφος · 2D σύμβολο σε ΚΑΘΕ όροφο που διαπερνά.

**Engine (DONE):**
- `bim/types/mep-segment-types.ts`: NEW `isSegmentVertical(params)` (plan `< RISER_MAX_PLAN_MM=50` && rise `> RISER_MIN_RISE_MM=100`), `riserDirection(params)` ('up'/'down'), consts `DEFAULT_RISER_HEIGHT_MM=3000`, `DEFAULT_RISER_DIAMETER_MM=100`. Reuse `derivePlanLengthMm`+`resolveSegmentEndpointElevationsMm`.
- NEW `bim/mep-segments/mep-riser-symbol.ts`: `buildRiserSymbol(centreScreen, RISER_SYMBOL_RADIUS_PX=9, direction)` → `{cx,cy,r, strokes}` (κύκλος + σταυρός + up/down βέλος, **screen-space**). **REUSE το ίδιο για το Phase-2 overlay.**
- `bim/renderers/MepSegmentRenderer.ts`: vertical → `renderRiser()` (glyph αντί degenerate γραμμής) ΠΡΙΝ το `verts<3` guard· drainage καφέ· hitTest vertical = distance-to-XY (tolerance×3)· Boy-Scout `resolveSegmentColors()` extract. **STAGED ADR-040.**
- `bim/geometry/mep-segment-geometry.ts` **2 SSoT fixes (N.0.1):** (1) `validateMepSegmentParams` μετρά **3D length** (`hypot(plan, Δz)`) αντί plan-length — αλλιώς το riser απορριπτόταν «too short». (2) `buildOutlineRect` degenerate-XY guard (coincident XY → `offsetPolyline` έβγαζε NaN· τώρα square footprint, ο σωλήνας end-on).
- 3D cross-floor + auto-fittings (tee/elbow): **ΔΩΡΕΑΝ** (το `mepSegmentToMesh` + `derivePipeJunctions` είναι ήδη 3D-aware· absolute z).

**Tool (DONE, reachable):**
- NEW `hooks/drawing/useMepRiserTool.ts`: 1-click, χτίζει vertical mep-segment μέσω `completeMepSegmentFromTwoClicks(xy, xy, lvl, 'pipe', {classification:'sanitary-drainage', diameter}, su, 0, heightMm)` (base **0=datum**, top=heightMm). State `{phase, heightMm, diameterMm}` + `setHeight/setDiameter`.
- NEW `ui/ribbon/hooks/bridge/mep-riser-tool-bridge-store.ts`: handle `{isActive, heightMm, diameterMm, setHeight, setDiameter}` — **ΕΤΟΙΜΟ, publish-άρεται από το tool, ΑΛΛΑ κανείς δεν το διαβάζει ακόμη** (το Phase-2 bridge θα το διαβάσει).
- Wiring: `tool-definitions.ts` + `ui/toolbar/types.ts` (`'mep-drain-riser'`), `useSpecialTools-placement-tools.ts` (instance+lifecycle+`PlacementToolsReturn`), `useSpecialTools.ts` (re-export), `canvas-click-types.ts` (`mepRiserTool?` param), `useCanvasClickHandler.ts` (destructure+routing branch), `CanvasSection.tsx` (destructure+pass — **STAGED ADR-040**), `home-tab-draw.ts` (Αποχέτευση → «Κατακόρυφη Στήλη»), i18n el+en (`tools.mepRiser.statusPosition`, `ribbon.commands.bim.mepDrainRiser.*`).
- Test: NEW `bim/mep-segments/__tests__/mep-riser.test.ts` (837 jest PASS συνολικά).

**Elevation convention (ΚΡΙΣΙΜΟ):** segment `startPoint.z`/`endPoint.z` = **datum-relative mm** (όχι floor-relative). 3D world Y = `z*0.001 + buildingBaseElevationM`. Για όροφο: `datum-relative mm = resolveFloorDatumRelativeElevationMm(floor.elevation_m, datumM)` όπου `datumM = resolveBuildingDatumElevationM(floors)` (`bim-3d/scene/floor-stack-elevation.ts`).

---

## 2) 🎯 PHASE-2 TASK A — Height/floor «Έως όροφο» UI (Revit base/top constraint)

**Στόχος:** contextual tab όταν το riser tool είναι active → ο χρήστης διαλέγει **«Από όροφο» (default current) → «Έως όροφο»** + διάμετρο· το riser χτίζεται με σωστά datum-relative base/top.

**Βήματα:**
1. **Επέκτεινε `useMepRiserTool` + bridge-store** να φέρουν **`baseElevationMm`** (όχι μόνο height): το onCanvasClick να χρησιμοποιεί `baseElevationMm` αντί για σταθερό `0`, και `topElevationMm` αντί `heightMm`. (Ή κράτα height αλλά πρόσθεσε base.) Πρόσθεσε `setSpanMm(baseMm, topMm)` στο handle.
2. **NEW `ui/ribbon/hooks/bridge/mep-riser-command-keys.ts`**: `MEP_RISER_RIBBON_KEYS = { params: { toFloor, diameter } }` + number/string guards (mirror `mep-fixture-library-command-keys.ts`).
3. **NEW `ui/ribbon/data/contextual-mep-riser-tab.ts`**: trigger `'mep-riser-tool-active'`· combobox «Έως όροφο» (options **dynamic** — έρχονται από το bridge `getComboboxState`, mirror πώς το fixture library επιστρέφει options) + «Διάμετρος» (static DN). Mirror `contextual-mep-fixture-library-tab.ts`.
4. **NEW `ui/ribbon/hooks/useRibbonMepRiserBridge.ts`** (tool-active bridge, mirror `useRibbonMepFixtureLibraryBridge`):
   - Floors: `useLevelsOptional()` → `levels.find(l=>l.id===currentLevelId)` → `buildingId`/`floorId`· `useFloorsByBuilding(buildingId)` → ordered floors (+`elevation` m)· `datumM=resolveBuildingDatumElevationM(floors)`.
   - `getComboboxState('toFloor')` → `{ value: currentTopFloorId, options: floorsAboveCurrent.map(f=>({value:f.id, labelKey: f.name literal})) }`.
   - `onComboboxChange('toFloor', floorId)` → `baseMm=resolveFloorDatumRelativeElevationMm(currentFloor.elevation, datumM)`, `topMm=resolveFloorDatumRelativeElevationMm(selFloor.elevation, datumM)` → `mepRiserToolBridgeStore.get()?.setSpanMm(baseMm, topMm)`. `onComboboxChange('diameter', v)` → `setDiameter`.
5. **Composer wiring `ui/ribbon/hooks/useRibbonCommands.ts`**: import guards + `RibbonMepRiserBridge` type + prop + destructure + 2 dispatch branches (`onComboboxChange`/`getComboboxState`) + 2 dep arrays (mirror `mepFixtureLibraryBridge` lines ~84/134/173/261-264/304). **+ ΒΡΕΣ το call-site που construct-άρει τα bridges** (grep `useRibbonMepFixtureLibraryBridge(` → ίδιο αρχείο construct-άρει· πρόσθεσε `const mepRiserBridge = useRibbonMepRiserBridge(...)` + πέρασέ το).
6. **`app/ribbon-contextual-config.ts`** (⚠️ shared — codex μόλις πρόσθεσε thermal-space· merge προσεκτικά): register `CONTEXTUAL_MEP_RISER_TAB` στο `RIBBON_CONTEXTUAL_TABS` + στο `useActiveContextualTrigger`: `if (activeTool === 'mep-drain-riser') return MEP_RISER_CONTEXTUAL_TRIGGER;`.
7. **i18n el+en**: `ribbon.tabs.mepRiser`, `ribbon.panels.mepRiser`, `ribbon.commands.mepRiser.{toFloor,diameter}` (parity, N.11).

---

## 3) 🎯 PHASE-2 TASK B — Cross-floor «riser through» 2D σύμβολο (Revit-full)

**Στόχος:** στον ενεργό όροφο, ζωγράφισε derived riser σύμβολο (up/down βέλη) για κάθε στήλη **άλλου ορόφου** που το z-range της διαπερνά το current floor FFL. Single source = οι base-floor risers· τα υπόλοιπα derived (zero duplicate persistence).

**Βήματα:**
1. **NEW `bim/mep-segments/derive-risers-through-floor.ts`** (pure): `(buildingVerticalSegments: MepSegmentEntity[], currentFloorElevMm) → {centreXY, direction}[]` για risers όπου `min(startZ,endZ) <= currentFloorElevMm <= max(...)` ΚΑΙ ο όροφος δεν είναι ο owner (αλλιώς διπλό με τον native renderer). Reuse `isSegmentVertical`/`resolveSegmentEndpointElevationsMm`/`riserDirection`.
2. **NEW read-only overlay leaf** (mirror `FloorUnderlayOverlay` + `useFloors2DUnderlay`, ADR-399 Phase D): για τον ενεργό όροφο, source όλων των ορόφων scenes (reuse `useFloors2DUnderlay` cross-floor sourcing· **αν flagged**, extract `useBuildingFloorScenes` — βλ. pending-ratchet ADR-399 dedup flag), φίλτραρε `mep-segment` + `isSegmentVertical`, τρέξε `derive-risers-through-floor`, ζωγράφισε `buildRiserSymbol(worldToScreen(centreXY), …)` (screen-space, **REUSE το v1 symbol SSoT**). **STAGE ADR-040** (micro-leaf, zero high-freq subscription).
3. **Mount** όπου mount-άρει το `FloorUnderlayOverlay` (canvas overlay stack).

---

## 4) CRITICAL SSoT REUSE
- `buildRiserSymbol` + `RISER_SYMBOL_RADIUS_PX` (`mep-riser-symbol.ts`) — ΚΑΙ Task B.
- `isSegmentVertical`/`riserDirection`/`resolveSegmentEndpointElevationsMm` (`mep-segment-types.ts`).
- `useFloorsByBuilding` (`components/properties/shared/useFloorsByBuilding.ts`) + `resolveBuildingDatumElevationM`/`resolveFloorDatumRelativeElevationMm` (`bim-3d/scene/floor-stack-elevation.ts`) + `useLevelsOptional` — elevations (Task A).
- `FloorUnderlayOverlay` + `useFloors2DUnderlay` (ADR-399 Phase D) — πρότυπο cross-floor 2D (Task B).
- `useRibbonMepFixtureLibraryBridge` + `contextual-mep-fixture-library-tab.ts` + `mep-fixture-library-command-keys.ts` — πρότυπα tool-active bridge/tab/keys (Task A).
- `mepRiserToolBridgeStore` (ΕΤΟΙΜΟ) — Task A reader.

## 5) ΕΛΕΓΧΟΙ
- N.17 → `npx tsc --noEmit 2>&1 | rg "riser|mep-segment|ribbon|overlay"` → 0 δικά σου (αγνόησε pre-existing `mesh-to-object3d:124` + codex `DeleteEntityCommand` 'roof').
- jest `bim/mep-segments` + νέα tests (derive-risers-through-floor pure logic).
- **Browser (Giorgio):** «Κατακόρυφη Στήλη» → «Έως όροφο: 3ος» → κλικ → (α) σωστό span 2D/3D (β) στους ορόφους 1-2 derived σύμβολο με βέλος up (γ) οριζόντιος drain→riser auto tee.

## 6) TRACKERS @ commit (N.15)
ADR-408 changelog (Φ15 Phase-2) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory · update `pending-ratchet-work.md` (αφαίρεσε τα Φ15 (a)/(b) flags όταν γίνουν). **ΟΧΙ adr-index.** Flags που μένουν: vent stack, DN sizing (DFU), outfall terminal, BOQ/ΗΛΜ.

## 7) Σχετικές μνήμες
`project_adr408_phi14_drainage` (master αποχέτευσης), `project_adr408_mep_connectors_systems`, `project_adr408_phiA_per_endpoint_z` (per-endpoint z + 3D junctions), `project_adr236_multi_level`/ADR-399 (cross-floor + datum).

---

## 📌 ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ ΕΠΟΜΕΝΟΥ AGENT (νέα session, Opus)
1. Διάβασε αυτό + grep τα v1 αρχεία (§1) για να δεις το τρέχον state.
2. **Plan Mode** σύντομο (οι αποφάσεις είναι locked)· verify ότι το v1 είναι ακόμη στο tree (shared).
3. Υλοποίησε **Task A** (height/floor UI) πρώτα (αυτόνομο, μικρότερο), μετά **Task B** (cross-floor overlay).
4. Έλεγχοι §5 → ανάφερε (ΟΧΙ commit). Trackers §6 ετοιμάζεις.
