# ADR-658 — Εργαλείο «Μολύβι» (Freehand Sketch): drag-to-draw τεθλασμένη/καμπύλη

- **Status:** ✅ IMPLEMENTED (M1+M2+M3 — όλες οι αποφάσεις D1–D6)
- **Ημερομηνία:** 2026-07-15
- **Κατηγορία:** DXF Viewer / Drawing Tools
- **Συντάκτης:** Claude (Opus 4.8) κατόπιν εντολής Giorgio
- **Σχετικά:** ADR-040 (canvas perf / micro-leaf), ADR-031/057 (Command pattern + undo), ADR-056 (completion styles), ADR-261 (execution mode)

---

## 1. Πλαίσιο (Context)

Σήμερα ο DXF Viewer έχει **μόνο** polyline με διαδοχικά κλικ (`useUnifiedDrawing` →
`addPoint`/`finishPolyline`). ΔΕΝ υπάρχει **freehand** (drag-to-draw): πάτα → σύρε → άφησε →
βγαίνει καμπύλη/τεθλασμένη. Ο χρήστης το ζητά ρητά σε ποιότητα Revit / ArchiCAD / CINEMA 4D /
Figma-level, με **FULL ENTERPRISE + FULL SSOT**.

### 1.1 Πρακτική μεγάλων παικτών (research)

| Εργαλείο | Freehand pattern |
|---|---|
| **AutoCAD `SKETCH`** | Δειγματοληψία ανά «record increment» (απόσταση). Μεταβλητή **`SKPOLY`**: 0=μεμονωμένες γραμμές, 1=**polyline**, 2=**spline**. |
| **ArchiCAD** | Polyline tool → geometry method «Freehand/Draw» → δειγματοληψία cursor → polyline. |
| **CINEMA 4D (MAXON)** | Sketch/Spline Pen → freehand stroke → **spline με smoothing**. |
| **Figma / Illustrator** | Pencil tool: δειγματοληψία → **Ramer–Douglas–Peucker simplification** + bezier smoothing. Παράμετρος **fidelity/smoothness** (slider). Auto-close αν αφήσεις κοντά στην αρχή. |
| **Revit** | ΔΕΝ έχει πραγματικό freehand — μόνο click-based. (→ δεν είναι το πρότυπο εδώ.) |

**Κοινός παρονομαστής:** `pointerdown → sample on pointermove (κατώφλι απόστασης) → RDP simplify →
emit polyline ή fitted spline → pointerup finish`, με παράμετρο **fidelity/tolerance** και
προαιρετικό **auto-close**.

---

## 2. Αποφάσεις (Decisions — εγκεκριμένες από Giorgio 2026-07-15)

| # | Θέμα | Απόφαση | Πρότυπο μεγάλου παίκτη |
|---|---|---|---|
| D1 | **Έξοδος** | **ΚΑΙ** τεθλασμένη (`PolylineEntity`) **ΚΑΙ** καμπύλη (`SplineEntity`) | AutoCAD `SKPOLY` (polyline/spline) |
| D2 | **Επιλογή τύπου** | Ένα κουμπί **«Μολύβι»** με **dropdown 2 επιλογών**: Τεθλασμένη / Καμπύλη | Πρότυπο dropdown κύκλου/τόξου (υπάρχον) |
| D3 | **Fidelity** | **Slider** στο ribbon («Πιστότητα/Εξομάλυνση») → οδηγεί το RDP `tolerance` | Figma pencil fidelity slider |
| D4 | **Snap** | Object snap (**endpoint + midpoint**) ενεργό **μόνο στο πρώτο & τελευταίο** σημείο· ελεύθερο στη μέση του stroke | AutoCAD snap μόνο στα άκρα |
| D5 | **Closed** | **Auto-close** όταν το τελευταίο σημείο πέσει κοντά στην αρχή (< κατώφλι), με «near-close» οπτική ένδειξη | Figma/Illustrator/ArchiCAD |
| D6 | **Όνομα/Tab** | **«Μολύβι»** (Pencil), εικονίδιο μολυβιού, στο **Home → Draw** group δίπλα στο Polyline | Figma «Pencil» |

---

## 3. Αρχιτεκτονική (SSOT — τι ΞΑΝΑΧΡΗΣΙΜΟΠΟΙΕΙΤΑΙ, τι ΧΤΙΖΕΤΑΙ)

> ⚠️ **Διόρθωση handoff (SSoT audit 2026-07-15):** Το handoff έλεγε «RDP δεν υπάρχει — φτιάξε νέο
> `systems/geometry/simplify-polyline.ts`». **ΛΑΘΟΣ.** Υπάρχει ήδη `simplifyPolyline(points, tolerance)`
> (Ramer–Douglas–Peucker, unit-tested) στο `rendering/entities/shared/geometry-polyline-utils.ts:167`.
> → **ΞΑΝΑΧΡΗΣΙΜΟΠΟΙΕΙΤΑΙ, ΔΕΝ δημιουργείται διπλότυπο** (N.18).

### 3.1 Επαναχρήση (SSoT — ΜΗΝ κλωνοποιηθεί)

| Ρόλος | SSoT αρχείο |
|---|---|
| RDP simplification | `rendering/entities/shared/geometry-polyline-utils.ts` → `simplifyPolyline()` |
| Continuous pointer FSM (πρότυπο) | `systems/lasso/LassoFreehandStore.ts` (start/add/finish/cancel + near-close) |
| Wiring seam (down/move/up) | `hooks/canvas/useCanvasContainerHandlers.ts` (γρ.143/201 + pointermove effect γρ.~120) |
| Entity creation + undo (SSoT) | `hooks/drawing/completeEntity.ts` → `completeEntity()` → `CreateEntityCommand` → global CommandHistory |
| Entity builder από σημεία | `hooks/drawing/drawing-entity-builders.ts` (`case 'polyline'`) |
| Live preview ghost | `hooks/drawing/drawing-preview-generator.ts` → `makeRubberBandPolyline()` |
| Snap read (event-time) | `systems/cursor/ImmediateSnapStore.ts` → `getImmediateSnap()` + `applySnap` |
| Tool registry | `systems/tools/tool-definitions.ts` (`TOOL_DEFINITIONS`, `TOOL_CREATES_ENTITY`) |
| ToolType union (σωστό) | `ui/toolbar/types.ts:30` (⚠️ ΟΧΙ το stale `types/index.ts`) |
| Ribbon draw group | `ui/ribbon/data/home-tab-draw.ts` (`draw.polyline` γρ.48) |
| Spline tessellation/render | `geometry-spline-utils` (υπάρχον — ο renderer χειρίζεται ήδη `SplineEntity`) |

### 3.2 Νέο (πρέπει να χτιστεί)

1. **`ToolType`** τιμή `'sketch'` → entry σε `TOOL_DEFINITIONS` + `TOOL_CREATES_ENTITY` (→ `'polyline'`
   ή `'spline'` ανάλογα με το mode).
2. **`systems/sketch/SketchFreehandStore.ts`** — FSM κατ' εικόνα του `LassoFreehandStore` (down/move/
   finish/cancel, throttle απόστασης, near-close, output-mode `'polyline'|'spline'`). Αν προκύψει
   κοινό με το lasso → εξαγωγή SSoT helper (N.18 jscpd έλεγχος).
3. **Finish wiring** στο drawing layer (mirror `finishPolyline`): reads points → `simplifyPolyline` →
   optional snap άκρων (D4) → optional close (D5) → build entity → **`completeEntity()`**.
4. **`SplineEntity` builder** (D1): `{ type:'spline', controlPoints: simplified, degree:3, closed }`.
   Επέκταση `drawing-entity-builders.ts` με `case 'sketch'` (mode-aware).
5. **Live-freehand preview** — variant του `makeRubberBandPolyline` για συνεχώς αυξανόμενο πυκνό array
   (μέσω του preview-generator SSoT).
6. **Ribbon button** «Μολύβι» + dropdown (Τεθλασμένη/Καμπύλη) + **fidelity slider** widget.
7. **i18n keys** (el + en) — labels/tooltip (N.11, ΟΧΙ hardcoded).
8. **jest** — `simplify-polyline` ήδη tested· νέα tests για SketchFreehandStore FSM + entity builder.

### 3.3 Ροή (pipeline)

```
pointerdown (tool==='sketch')
   → SketchFreehandStore.startAt(world)   [+ snap endpoint/midpoint στο 1ο σημείο — D4]
pointermove (throttle ≥3px)
   → SketchFreehandStore.addPoint(world)  [near-close detection — D5]
   → live preview ghost (raw stroke)
pointerup
   → pts = store.getPoints()
   → pts = simplifyPolyline(pts, tolerance=fidelity)   [D3]
   → [snap τελευταίου — D4] · [if nearClose → closed=true — D5]
   → entity = mode==='polyline' ? PolylineEntity : SplineEntity   [D1]
   → completeEntity(entity, {...})   [undoable, atomic — SSoT]
   → store.cancel()
Esc → store.cancel()
```

---

## 4. Perf / ADR-040 συμμόρφωση

- `SketchFreehandStore` = module-level pub/sub, **zero React state** (όπως `LassoFreehandStore`).
- Preview subscriber = **micro-leaf** (mirror `LassoFreehandPreviewSubscriber`), ο μόνος συνδρομητής.
- `useCanvasContainerHandlers` διαβάζει transform/world **event-time** μέσω getters (ΟΧΙ snapshot).
- Καμία νέα συνδρομή σε high-freq store από orchestrators (CanvasSection/CanvasLayerStack).

---

## 5. Execution mode (ADR-261)

5+ αρχεία, 2+ domains (tools/drawing + ribbon/UI + geometry) → **Plan Mode** (επιλογή Giorgio).
Υλοποίηση μετά την έγκριση του πλάνου.

---

## 6. Milestones

- **M1 — Polyline MVP:** ToolType `'sketch'` + store + finish→`completeEntity` (polyline) + preview +
  ribbon button (χωρίς dropdown/slider ακόμη). Drag-to-draw δουλεύει, undoable.
- **M2 — Fidelity slider (D3)** + snap άκρων (D4) + auto-close (D5).
- **M3 — «Καμπύλη» output (D1/D2) ✅:** mode-aware `case 'sketch'` → smoothDisplay polyline (ADR-650
  fitted-curve, reuse· ΟΧΙ raw SplineEntity — δεν αποδίδεται στο canvas-v2) + dropdown «Τύπος»
  (sketch-output-store, ένα bridge/δύο keys).

---

## 7. Ανοιχτά / follow-ups

- Bezier smoothing του spline (πέρα από RDP control points) — προαιρετικό follow-up.
- Default τιμή fidelity tolerance (screen-space vs world-space) — κλειδώνεται στο M2.

---

## 8. Changelog

- **2026-07-15** — Δημιουργία (PROPOSED). Αποφάσεις D1–D6 εγκεκριμένες από Giorgio. SSoT audit
  διόρθωσε το handoff (το RDP `simplifyPolyline` υπάρχει ήδη — δεν δημιουργείται διπλότυπο).
- **2026-07-15 — M1 IMPLEMENTED** (drag-to-draw polyline, undoable). Νέα αρχεία:
  - `systems/freehand/createFreehandTraceStore.ts` — **SSoT factory** για freehand pointer-trace
    stores (FSM start/add/finish/cancel, zero React state). Ο lasso store μπορεί να μεταναστεύσει
    πάνω του (N.18 follow-up).
  - `systems/freehand/pointer-trace-throttle.ts` — `passesTraceThrottle` (screen-space throttle SSoT).
  - `systems/sketch/SketchFreehandStore.ts` — thin adapter που εκπέμπει `sketch:freehand-complete`.
  - `hooks/drawing/useSketchFreehandCommit.ts` — commit host: event → `simplifyPolyline` (fidelity σε
    screen px / transform.scale) → `createEntityFromTool('sketch')` → `completeEntity()` (SSoT undo).
  - `components/dxf-layout/SketchFreehandPreviewSubscriber.tsx` — micro-leaf live-stroke preview (ADR-040).
  - `components/dxf-layout/freehand-preview-projection.ts` — **SSoT** world→screen projection, κοινό
    lasso + sketch (jscpd έπιασε sibling clone στα preview leaves → εξαγωγή· ο lasso subscriber
    refactored να το χρησιμοποιεί).
  - `systems/sketch/__tests__/sketch-freehand-store.test.ts` — 9 tests (FSM factory + throttle + emit), PASS.
  - Επεκτάσεις: `ToolType`/`DrawingTool` (+`'sketch'`), `TOOL_DEFINITIONS`/`TOOL_CREATES_ENTITY`
    (`sketch`→`polyline`), `drawing-event-map` (event), `drawing-entity-builders` (`case 'sketch'`
    fall-through στο polyline — μηδέν duplication), `useCanvasContainerHandlers` (down/move/up wiring
    στο ίδιο seam με το lasso), `useDxfViewerState` (cancel-on-tool-switch), `DxfViewerContent`
    (mount commit host), ribbon `home-tab-draw` + `RibbonButtonIcon` (Pencil) + i18n el/en.
  - **Εκκρεμεί (M2/M3):** fidelity slider (D3), snap άκρων+μέση (D4), auto-close (D5), spline dropdown (D1/D2).
- **2026-07-15 — M2 IMPLEMENTED** (fidelity D3 · endpoint snap D4 · auto-close D5).
  - **D3 fidelity** — αντί για slider (δεν υπάρχει slider widget στο ribbon), υλοποιήθηκε ως
    **contextual tab «Μολύβι» + editable combobox «Πιστότητα»** με 4 επίπεδα (Ακριβές/Ισορροπημένο/
    Ομαλό/Πολύ ομαλό → RDP tolerance 0.5/2/5/10 screen px), enterprise-consistent με το ribbon
    vocabulary (μοτίβο xline mode). Νέα: `systems/sketch/sketch-fidelity-store.ts` (persisted SSoT),
    `useRibbonSketchFidelityBridge`, `bridge/sketch-fidelity-command-keys.ts`, `contextual-sketch-tab.ts`.
    Wiring: `resolve-tool-active-trigger` (['sketch']→tab), `ribbon-contextual-config`,
    `useRibbonCommands(-types/-dispatch)`, `useDxfViewerRibbon`, i18n el/en (tab/panel/combobox + 4 levels).
    Ο commit host διαβάζει `getSketchFidelityPx()` αντί για σταθερά.
  - **D4 endpoint snap** — το πρώτο & τελευταίο σημείο κουμπώνει στο ενεργό OSNAP (endpoint/midpoint)
    μέσω `getImmediateSnap()` (snap τρέχει γιατί `isDrawingTool('sketch')`)· η μέση μένει freehand.
    `readSnappedWorld()` helper στο `useCanvasContainerHandlers` (mousedown seed + mouseup endpoint).
  - **D5 auto-close** — release κοντά στην αρχή (< 20px, ≥ 3 pts) → `closed:true` polygon. Το factory
    απέκτησε `nearClose` slice + `onFinish(points, nearClose)`· ο commit host θέτει `entity.closed`.
    Preview subscriber δείχνει ring + κλείσιμο. `freehandScreenGeometry` SSoT εξήχθη (jscpd de-dup με lasso).
  - jest 23/23 GREEN (factory nearClose/closed + fidelity store + ribbon dispatch counts). jscpd:diff καθαρό.
  - **Fix (i18n reachability):** τα `tools.sketch.fidelity.*` μπήκαν αρχικά στο `dxf-viewer.json` →
    dropdown έδειχνε raw keys. Ο runtime resolver (`namespace-compat.ts`) ανακατευθύνει το root `tools`
    του ns `dxf-viewer` στο **`dxf-viewer-shell.json`** → μεταφέρθηκαν εκεί (el+en), αφαιρέθηκε το νεκρό
    αντίγραφο. Βλ. memory `reference_i18n_tools_root_remaps_to_shell`.
- **2026-07-15 — M3 IMPLEMENTED** (spline output D1 · type dropdown D2). Ολοκληρώνει τις αποφάσεις.
  - **D1 «Καμπύλη» output** — το «Μολύβι» βγάζει πλέον **ΚΑΙ** ομαλή καμπύλη. **⚠️ Code-is-truth
    διόρθωση (N.0.1):** η καμπύλη ΔΕΝ είναι raw `SplineEntity` — ο ενεργός canvas-v2 render path
    (`buildEntityModelFromDxf` → `DxfEntityUnion`) **δεν** περιλαμβάνει `spline` (spline = import-only,
    tessellated σε polyline· `default: never` το κλειδώνει). Μια raw `SplineEntity` στη σκηνή έπεφτε
    στο `default` → **δεν αποδιδόταν** (bug που ανέφερε ο Giorgio: η καμπύλη δεν εμφανιζόταν). Αντ' αυτού
    η «Καμπύλη» είναι **`PolylineEntity` με `smoothDisplay:true`** (ADR-650): ο `PolylineRenderer`
    στρώνει Catmull-Rom fitted curve μέσα από τα σημεία (AutoCAD spline-fit / Civil 3D contour
    smoothing) — το fidelity ελέγχει πυκνότητα CV, ΟΧΙ ίσιωμα. **Πλήρες SSoT reuse**: μηδέν νέα
    render/hit-test/grip/export/undo plumbing (όλα μένουν στο polyline path, όπως οι ισοϋψείς).
    Ο `drawing-entity-builders.ts` `case 'sketch'` έγινε **mode-aware** (διαβάζει το output-type SSoT,
    mirror του xline mode read)· «Τεθλασμένη» = plain polyline (fall-through, μηδέν duplication).
    Ο commit host θέτει `closed` (D5) — και τα δύο outputs είναι polylines.
  - **D2 type dropdown** — 2ο combobox «Τύπος» (Τεθλασμένη/Καμπύλη) στο contextual tab «Μολύβι»,
    ΠΡΙΝ το «Πιστότητα» (AutoCAD-style: ξεχωριστά panels, ένα concept το καθένα). Νέο store
    `systems/sketch/sketch-output-store.ts` (persisted SSoT, sibling του fidelity store — jscpd:diff
    καθαρό, ΟΧΙ clone). Ο **υπάρχων** `useRibbonSketchFidelityBridge` επεκτάθηκε να χειρίζεται **και**
    το `sketch:outputType` key (ένα bridge, δύο keys) → **μηδέν** νέο dispatch wiring: το route
    `isSketchRibbonKey` καλύπτει ήδη και τα δύο. Command-keys: `+outputType:'sketch:outputType'`.
  - **i18n** (el+en, στο **`dxf-viewer-shell.json`** — root `tools` remap): `tools.sketch.outputType.
    {polyline,spline}`, `ribbon.panels.sketchType`, `ribbon.commands.sketchTypeSelector`.
  - **TOOL_CREATES_ENTITY['sketch'] παραμένει `'polyline'`** (static back-link hint· η spline είναι
    runtime commit choice) → coverage test άθικτο.
  - **Grip fix (Giorgio 2026-07-15):** επιλέγοντας την «Καμπύλη» οι λαβές δεν ταυτίζονταν με την
    καμπύλη — τα **edge-midpoint grips** κάθονταν στο μέσο της ευθείας χορδής (εκτός της ομαλής
    καμπύλης). Fix: για smoothDisplay polyline **καταργούνται** τα edge grips (fit-point/vertex grips
    μόνο — πάνω στην καμπύλη, AutoCAD spline UX)· τα vertices περνά η Catmull-Rom → επάνω τους.
    Συμμετρικά σε **αμφότερα** τα grip paths (paint `PolylineRenderer.getGrips` + interaction
    `buildPolylineGrips`) + smoothDisplay-aware `polylineMoveRotateStartIndex(…, hasEdgeGrips)` ώστε
    οι move/rotate δείκτες να μένουν σε συγχρονισμό (paint ≡ hit-test). Ισχύει και για τις ισοϋψείς
    (ADR-650) — ήταν λανθασμένο και εκεί. Βλ. memory `reference_spline_entity_not_renderable_use_smoothdisplay`.
  - **Handles-on-curve (Giorgio 2026-07-15):** ο σταυρός MOVE + το σημάδι ROTATION έπεφταν στη
    μεγαλύτερη ευθεία **χορδή** (εκτός καμπύλης). Για smoothDisplay, το `getPolylineMoveRotateGrips`
    δέχεται `smoothDisplay` flag και **προβάλλει** και τις δύο λαβές στο fitted curve
    (`buildSmoothedDisplayPath` + `closestPointOnPolyline`, reuse `getNearestPointOnLine` primitive —
    μηδέν νέα projection math, N.18). Ίδιος υπολογισμός σε paint + interaction → paint ≡ hit-test.
  - jest: sketch-freehand-store.test.ts 19/19 + grip-computation-polyline-arc (+«Καμπύλη» no-edge-grips)
    + polyline-grips + grip-computation-coverage GREEN. dispatch 36 routes + tool-creates-entity
    coverage GREEN. `jscpd:diff` καθαρό.
