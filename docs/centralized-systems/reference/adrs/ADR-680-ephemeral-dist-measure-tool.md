# ADR-680 — Εφήμερο «Μέτρημα Απόστασης» (tape measure / DIST) στον DXF Viewer Editor

**Status:** Accepted · **Date:** 2026-07-19 · **Owner:** DXF Viewer / Measure
**Related:** ADR-040 (micro-leaf), ADR-357 (status bar), ADR-340 (public-gallery ephemeral measure)

---

## 1. Context

Ο editor (`/dxf/viewer`) είχε ήδη measurement tools (`measure-distance`, `measure-area`, …) που
**δημιουργούν μόνιμο scene entity** (`LineEntity{measurement:true}` → `completeEntity` →
`CreateEntityCommand`, undoable + optional Firestore). Ο Giorgio ζήτησε **εφήμερο** «μέτρημα στην
οθόνη» — μετράς αποστάσεις/διαδρομές με ζωντανή ένδειξη, **χωρίς entity, χωρίς εγγραφή στη βάση**,
που ένα reload το σβήνει (Revit/AutoCAD DIST/MEASUREGEOM). Κουμπί κάτω-αριστερά, δίπλα στη γραμμή
εντολών. Το πραγματικά εφήμερο μοντέλο υπήρχε μόνο στη δημόσια κάτοψη (`local-measurements-store.ts`,
ADR-340).

## 2. Decision

Νέο **πραγματικό tool `'dist'`** (μέσω `toolStateStore.selectTool('dist')`) που παίρνει ΔΩΡΕΑΝ
tool-exclusivity, crosshair και **OSNAP snap** (το `mouse-handler-up` snap-άρει το click point για
οποιοδήποτε tool πριν το `onCanvasClick`). Το «εφήμερο» εξασφαλίζεται με το ότι το tool **ΠΟΤΕ** δεν
περνά από `useUnifiedDrawing`/`completeEntity` — γράφει ΜΟΝΟ σε in-memory store.

**Κρίσιμη λεπτομέρεια:** το `'dist'` δηλώνεται με category **`'editing'` (ΟΧΙ `'measurement'`)**, γιατί
το `useCanvasEffects` κάνει auto-start το unified drawing pipeline για `isDrawingTool || isMeasurementTool`.
Με `'editing'` το auto-start το προσπερνά → κανένα drawing session, μηδέν entity.

Απορρίφθηκαν: (Β) self-contained overlay με δικό του click/snap (παράλληλος μηχανισμός, double-snap,
σύγκρουση με selection) · (Γ) de-persist του υπάρχοντος `measure-distance` (μολύνει persistent/undoable/
Firestore-capable κώδικα).

## 3. Architecture

| Layer | Αρχείο | Ρόλος |
|---|---|---|
| Store (SSoT) | `systems/measure/dist-ephemeral-store.ts` | In-memory `{active, committed, clearToken}` (πρότυπο `local-measurements-store`, `createExternalStore`). `addDistPoint`/`finishDistPath`/`undoLastDistPoint`/`clearDist`. **Ποτέ** scene/Firestore. |
| Util (pure) | `systems/measure/dist-readout.ts` | `computeDistReadout(points, sceneUnits)` → per-segment μήκη/mids/labels + ΣΥΝΟΛΟ, format μέσω SSoT `formatSceneLengthForDisplay`. |
| Live overlay | `components/dxf-layout/DistMeasureOverlayLeaf.tsx` | ADR-040 micro-leaf (outer subscribe μόνο σε `activeTool`· inner mount-άρεται όσο active → 60fps realtime-cursor sub confined). SVG polyline + rubber-band προς `getRealtimeWorldCursor()` + labels + ΣΥΝΟΛΟ. Projection: `CoordinateTransforms.worldToScreen`. |
| Κουμπί | `statusbar/DistMeasureButton.tsx` | Toggle `selectTool(active ? 'select' : 'dist')`, `useActiveTool()`, icon `Ruler`. |
| Click routing | `hooks/canvas/useCanvasClickHandler.ts` | PRIORITY 0.35: `if (activeTool==='dist') { addDistPoint(worldPoint); return; }` (worldPoint ήδη snapped· early-return → όχι drawing/grips). |
| Registry | `ui/toolbar/types.ts` (ToolType) + `systems/tools/tool-definitions.ts` | `'dist'`, category `'editing'`. **ΟΧΙ** στο `MEASUREMENT_TOOLS`/`TOOL_CREATES_ENTITY`. |
| Mount | `components/dxf-layout/CanvasLayerStack.tsx` | Ένα JSX leaf δίπλα στα preview leaves (pointer-events-none). |
| i18n | `dxf-viewer-panels.json` (el+en) | `cadDock.statusBar.distMeasure` / `.distMeasureDesc` / `.distTotal`. |

**Interaction:** κλικ → σημείο (snapped)· ζωντανό rubber-band + μήκος τμήματος + τρέχον ΣΥΝΟΛΟ (και-τα-δύο,
AutoCAD DIST)· **Enter**/double-click → κλείνει τη διαδρομή (μένει ζωγραφισμένη, ξεκινά νέα)· **Backspace**
→ αναίρεση σημείου· **Escape** → καθαρίζει τη μέτρηση ΜΕΝΟΝΤΑΣ σε mode (δεύτερο ESC σε κενό → έξοδος στο
`select`)· αλλαγή εργαλείου/toggle-off → auto-clear.

**Perf (ADR-040):** το Shell (`CanvasLayerStack`) δεν subscribe-άρει (CHECK 6C)· το `useSyncExternalStore`
ζει στο leaf· το 60fps cursor subscription mount-άρεται μόνο όσο το tool είναι ενεργό.

## 4. Tests
`systems/measure/__tests__/dist-ephemeral-store.test.ts` (8) + `dist-readout.test.ts` (3) — 11/11 πράσινα
(accumulation, dedupe double-click, finish/undo/clear, clearToken, notify semantics, 3-4-5 μήκη/ΣΥΝΟΛΟ).

## 5. Verification (browser-first)
`/dxf/viewer` → «ΜΕΤΡΗΣΗ» → κλικ 2 γωνίες: «Χ,ΧΧ μ» με snap· συνέχεια → διαδρομή + ΣΥΝΟΛΟ· Enter κλείνει·
ESC καθαρίζει· reload → φεύγει (καμία εγγραφή στη σκηνή/DB, καμία undo entry).

## Changelog
| Date | Change |
|------|--------|
| 2026-07-19 | Αρχική υλοποίηση (Opus 4.8, GOL+SSOT, Plan-approved). 5 νέα αρχεία + 6 μονόγραμμα anchors. category `'editing'` για αποφυγή measurement auto-start. ESC = clear-in-mode / exit-on-empty. |
