# HANDOFF — ADR-549 3D cursor «swim»: profile σχεδόν τέλειωσε, λείπει το scheduler per-system breakdown

**Ημ/νία:** 2026-06-29 · **ADR:** 549 (NEW) · **Model:** Opus 4.8
**Working tree:** UNCOMMITTED diag changes (όλα revertible) + ADR-549. SHARED tree με άλλον agent → μικρά edits.

---

## 0. TL;DR — τι αποδείχθηκε (browser-measured, ΟΧΙ εικασία)

1. **Το 3D scene render ΔΕΝ είναι ο ένοχος** σε καθαρό sweep. `window.__bim3dPerf.dump()`: σε κάποια runs
   `renders=0`, σε άλλα 7-44 (5-7/s, avg ~25ms dev). Ο on-demand μηχανισμός (`isSceneDirtyFromState`)
   δουλεύει. → **διαψεύστηκε η αρχική bisection «render=ένοχος»** (αφορούσε άλλο σενάριο).
2. **`cursor.totalLag` ~63-69ms σταθερά, `cursor.inputLatency` ~2ms** (από υπάρχον `mouse-perf`, flag
   `dxf-perf-trace`). Δηλ. input ΟΚ, **paint καθυστερεί** ~60ms. Chrome violations: `UnifiedFrameScheduler.ts:186
   'rAF' handler took 50-135ms` (επανειλημμένα) + `overlay-raf.ts:41 took 143ms` (μία φορά, situational).
3. **Finding 4 (επιβεβαιωμένο 3 runs):** `useBim3DWireWaypointInteraction.useEffect.onMove` καλεί
   `manager.markSceneDirty()` σε **ΚΑΘΕ** pointermove (×205, ×42, ×136) — armed όποτε `is3D && tool==='select'`
   (προεπιλογή), ακόμα κι όταν `getActiveContext()===null` (καμία ενεργή MEP γραμμή, γρ.201) ή χωρίς αλλαγή
   hover/insert (γρ.209/216). **Spurious dirty = καθαρό bug.** Αρχείο:
   `bim-3d/animation/use-bim3d-wire-waypoint-interaction-3d.ts`.
4. **Finding 3 (αρχιτεκτονικό, root candidate):** `overlay-raf.ts::useRafWhile` ξεκινάει **ξεχωριστό rAF
   loop ΑΝΑ overlay** (7 overlays) + το master rAF του scheduler. **Παραβιάζει το «single master rAF» SSoT**
   (ADR-040 / `scene-dirty-state.ts:8`). Big players (Forge/iModel.js/Three.js Editor) → ΕΝΑ master rAF.
   ΣΗΜ: στα plain-sweep runs τα overlays μετρήθηκαν ΦΘΗΝΑ (crosshair avg ~1ms, count ~28/6s = ΟΧΙ κάθε
   frame· occasional spike 29-46ms). Άρα όχι ο κύριος ένοχος εδώ, αλλά πρέπει να ενοποιηθούν.

## 0.1 ⚠️ ΤΟ ΜΟΝΟ ΠΟΥ ΛΕΙΠΕΙ: scheduler per-system breakdown
`scheduler frames=0` σε ΟΛΑ τα runs. **Αιτία:** ο Giorgio τρέχει **dev** (`npm run dev`, Turbopack/HMR —
φαίνεται `Fast Refresh` / `react-dom-client.development.js` στα logs). Στο dev:
- το `UnifiedFrameScheduler` φορτώνεται ως **ΔΙΠΛΟ module** → diag-side `onFrame` έπεφτε σε dead instance.
- FIX που έγινε: το `onFrame` subscription μεταφέρθηκε στο `BimViewport3D` (δίπλα στο `register('bim-3d-scene')`
  = το running instance). **ΑΛΛΑ** το Fast Refresh **δεν ξανα-mountαρε** το BimViewport3D → ο νέος κώδικας
  δεν έτρεξε → πάλι `frames=0`.

**➡️ ΠΡΩΤΟ ΒΗΜΑ ΕΠΟΜΕΝΗΣ ΣΥΝΕΔΡΙΑΣ: πάρε το breakdown με ΕΝΑ από:**
- **(προτιμότερο) PROD run:** `pnpm run build && pnpm run start` (port 3000). Λύνει ΟΛΑ (module-dup,
  remount, dev inflation ~86%). Real numbers.
- **ή dev με ΣΙΓΟΥΡΟ remount:** restart dev server + hard reload (Ctrl+Shift+R) + **toggle 2D↔3D** (ώστε να
  ξανατρέξει το `[effectiveVisible]` effect του BimViewport3D → να γίνει το onFrame subscription).

Test snippet (3D ανοιχτό, εργαλείο «Επιλογή», σάρωσε 6s):
```js
localStorage.setItem('dxf-trace-dirty','1');
window.__bim3dPerf.reset();
console.log('🟢 ΣΑΡΩΣΕ 6s...');
setTimeout(() => window.__bim3dPerf.dump(), 6000);
```
Περίμενε `scheduler frames>0` + πίνακα «scheduler systems». **Ύποπτοι (4 registered systems σε 3D):**
`bim-3d-scene`, `bim3d-pointer-pick`, `bim-3d-column-diagrams` (LOW), `bim-3d-clash-markers` (LOW).
Τα 2 overlays (`ColumnDiagram3DOverlay`/`ClashMarkers3DOverlay`) είναι καλοί ύποπτοι για το 50-135ms.

---

## 1. UNCOMMITTED αρχεία (όλα 🔬 ADR-549 Phase 0, REVERTIBLE με `git restore`)
- **NEW** `docs/centralized-systems/reference/adrs/ADR-549-3d-cursor-swim-render-loop.md` (+ 2 entries στο `adr-index.md`)
- **NEW** `src/subapps/dxf-viewer/bim-3d/scene/bim3d-perf-diag.ts` — `window.__bim3dPerf` (renders/dirty-reason/
  markDirty-callers/overlay-draws/scheduler-systems· `reset()`/`dump()`· eager attach)
- `bim-3d/scene/ThreeJsSceneManager.ts` — import + tick render timing/sample + `markSceneDirty` trace (γρ.46, ~277, ~293)
- `bim-3d/viewport/overlay-raf.ts` — optional `diagLabel` + draw timing στο `useRafWhile`
- 7 overlays (`diagLabel` arg): `BimCrosshairOverlay3D`, `snap/BimSnapIndicatorOverlay3D`, `grips/DxfHoverGlowOverlay2D`,
  `grips/BimGripOverlay2D`, `placement/BimPlacementOverlay2D`, `wall-hud/WallHudOverlay3D`, `tracking/Tracking3DOverlay`
- `bim-3d/viewport/BimViewport3D.tsx` — import + `configure({collectMetrics:true})` + `onFrame(recordSchedulerFrame)` + cleanup unsub

Διαθέσιμα flags: `dxf-no-render`, `dxf-no-shadows` (HEAD), `dxf-trace-dirty` (NEW), `dxf-perf-trace` (mouse-perf).

---

## 2. PHASE 1 — FIX (μετά το breakdown· ιεραρχία)
1. **Spurious dirty (Finding 4):** `onMove` του wire-waypoint να ΜΗΝ μαρκάρει dirty όταν τίποτα δεν άλλαξε
   (idempotent: dirty μόνο σε πραγματική αλλαγή hover-index/insert-marker/handles-visibility), ή να μην είναι
   armed χωρίς ενεργό circuit. **SSoT audit:** μήπως κι άλλοι `select`-armed hooks κάνουν το ίδιο (grep
   `markSceneDirty` σε `bim-3d/**` mousemove handlers).
2. **Scheduler long task:** ό,τι δείξει το breakdown (πιθανόν `bim-3d-column-diagrams`/`clash-markers` που
   render-άρουν per-frame) → on-demand dirty-gating, όχι κάθε frame.
3. **Finding 3 (big-player):** ενοποίηση των 7 overlay rAF στον ΕΝΑ `UnifiedFrameScheduler` (crosshair=CRITICAL)
   + on-demand occlusion (`GripDepthOccluder` όχι κάθε frame).

## 3. ΚΑΝΟΝΕΣ
- Big-player doctrine (Revit/Cinema4D) + FULL SSOT· **SSOT audit (grep) ΠΡΙΝ κώδικα**, reuse, μηδέν διπλότυπα.
- **PROFILE ΠΡΙΝ FIX** (η bisection ήδη μας ξεγέλασε 1 φορά).
- COMMIT/PUSH τα κάνει ο GIORGIO. Ποτέ `--no-verify`, ποτέ `git add -A`.
- **Dev = ψέματα (~86% inflation)** → prod-build για absolute ms· dev OK μόνο για relative breakdown/counts.
- ADR-040 CHECK 6B: `UnifiedFrameScheduler.ts` micro-leaf critical — **ΔΕΝ** το άγγιξα (χρησιμοποίησα το
  υπάρχον `onFrame`/`configure` API). Αν το Phase 1 το αγγίξει → stage ADR-040. Τα υπόλοιπα → ADR-366 §B.5 + ADR-549.
- N.17: ΕΝΑ tsc τη φορά.
