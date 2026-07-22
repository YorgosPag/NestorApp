# ADR-680 — Εφήμερο «Μέτρημα Απόστασης» (tape measure / DIST) στον DXF Viewer Editor

**Status:** Accepted · **Date:** 2026-07-19 · **Owner:** DXF Viewer / Measure
**Related:** ADR-040 (micro-leaf), ADR-357 (status bar), ADR-340 (public-gallery ephemeral measure),
ADR-618 (bim3d placement SSoT), ADR-542 (3D OSNAP glyph), ADR-544 (3D placement parity)

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

## 6. Επέκταση 3D (BIM Viewport) — ίδιο κουμπί, αληθινή 3D μέτρηση

Το **ίδιο** κουμπί «ΜΕΤΡΗΣΗ» δουλεύει και στον 3D καμβά (Revit/ArchiCAD/Cinema-4D measure): μετράς
αποστάσεις πάνω σε DXF + BIM + MEP + κάθε ορατή οντότητα, σε **αληθινό 3D χώρο** (ύψος υποστυλώματος,
διαγώνιος — όχι μόνο κάτοψη). Παραμένει **εφήμερο** (μηδέν entity/DB).

**Αρχιτεκτονική απόφαση — unified SSoT + dual resolvers:** ο **ΕΝΑΣ** store/readout γενικεύτηκε σε 3D
αντί για δεύτερο μηχανισμό. Το `DistPoint = {x, y, z?}` (scene units): 2D = ειδική περίπτωση `z=0`
(πλήρως backward-compatible)· `computeDistReadout` = 3D `hypot(dx,dy,dz)` (dz⇒0). Δύο resolvers
ζωγραφικής (2D SVG leaf διαβάζει x,y· 3D scene overlay διαβάζει x,y,z).

| Layer | Αρχείο | Ρόλος |
|---|---|---|
| Store/readout (γενίκευση) | `systems/measure/dist-ephemeral-store.ts` + `dist-readout.ts` | `DistPoint` με προαιρετικό `z`· 3D μήκος. Κοινός SSoT 2D+3D. |
| 3D overlay (resolver) | `bim-3d/measure/Dist3DOverlay.ts` | Πραγματική 3D `LineSegments` + `Points` + label `Sprite`s, **always-on-top** (`depthTest:false`, `renderOrder` 1998–2000), σταθερό on-screen μέγεθος (`getPixelWorldSize`), labels μέσω SSoT `createLabelTexture` (cached), scene→world μέσω `dxfPlanToWorld`. Καθαρή Three.js, μηδέν React. |
| 3D click bridge | `bim-3d/measure/use-bim3d-dist-measure.ts` | Mirror του `use-bim3d-column-placement`: `usePlacementInteractionEffect({tools:['dist']})` (ADR-618). Κλικ → `raycastWorldPointOrPlane` (ΕΠΙΦΑΝΕΙΑ→floor→camera-plane) → OSNAP `resolvePlacementSnapWithView` (κάτοψη x,y, κρατά z επιφάνειας) → scene-unit `DistPoint` → `addDistPoint`. `subscribeDist` re-render για Enter/Backspace/Esc. |
| Mount | `bim-3d/viewport/use-bim3d-placement-and-pick-hooks.ts` | Μία γραμμή, δίπλα στα placement hooks. |
| Click guard | `bim-3d/viewport/use-bim3d-pointer-handlers.ts` | Early-return `activeTool==='dist'` (mirror 2D PRIORITY 0.35) → το κλικ-μέτρημα δεν αγγίζει selection/pivot. |

**Πληκτρολόγιο = mode-agnostic (μηδέν duplication):** Enter/Backspace/double-click/Escape/finish/undo/
clear χειρίζονται **ήδη** από τον `DistMeasureOverlayLeaf` (window listeners + escape-bus), που μένει
mounted όσο `activeTool==='dist'` ανεξαρτήτως 2D/3D, πάνω στον **κοινό** store. Ο 3D overlay τα
αντικατοπτρίζει μέσω `subscribeDist`. Το `activeTool` επιβιώνει το 2D↔3D toggle (ανεξάρτητα stores).

**Perf (ADR-040):** ο 3D bridge δεν κάνει `useSyncExternalStore` (store reads at event time)· ο overlay
είναι imperative (`markSceneDirty` μετά από κάθε mutation, label textures cached ανά κείμενο).

## Changelog
| Date | Change |
|------|--------|
| 2026-07-19 | Αρχική υλοποίηση (Opus 4.8, GOL+SSOT, Plan-approved). 5 νέα αρχεία + 6 μονόγραμμα anchors. category `'editing'` για αποφυγή measurement auto-start. ESC = clear-in-mode / exit-on-empty. |
| 2026-07-22 | **Επέκταση 3D** (Opus 4.8, GOL+SSOT, Plan-approved). Γενίκευση store/readout σε `DistPoint {x,y,z?}` (2D=z0, backward-compatible) → αληθινή 3D μέτρηση. Νέα: `bim-3d/measure/Dist3DOverlay.ts` (always-on-top 3D line + labels) + `use-bim3d-dist-measure.ts` (click bridge, mirror column placement). Κοινός store → πληκτρολόγιο/Esc δωρεάν/mode-agnostic. Guard στον 3D pointer handler. |
