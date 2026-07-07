# ADR-394 — Fit to View to Selected Entities (Z key)

**Status**: 🟢 IMPLEMENTED 2026-05-28 (pending commit)
**Date**: 2026-05-28
**Category**: Canvas & Rendering / DXF Viewer — Tools & Keyboard
**Author**: Giorgio Pagonis + Claude (Opus 4.7)
**Related ADRs**: ADR-027 (Keyboard Shortcuts SSoT), ADR-040 (event-time reads, micro-leaf), ADR-043 (Zoom constants), ADR-374 (ZOOM Window tool), ADR-357 (command-line activation)

---

## 1. Context

`Home` (και `Shift+1`) κάνει **Fit to View όλου του σχεδίου** (zoom extents) — υπολογίζει το combined bbox όλων των entities και ταιριάζει το viewport. Δεν υπάρχει αντίστοιχη κίνηση για **zoom στα επιλεγμένα μόνο**.

Giorgio ζήτησε: όταν υπάρχει επιλογή (μία ή πολλές οντότητες — DXF, BIM, ή μεικτές), ένα πλήκτρο να κάνει Fit to View **μόνο στις επιλεγμένες**, με το `Home` να μένει ως fit-all.

---

## 2. Industry Reference

| Software | Fit-all | Fit-selection |
|----------|---------|---------------|
| **Blender** | Home (Frame All) | Numpad-`.` (Frame Selected) |
| **Maya** | A | F |
| **AutoCAD** | `Z` `E` (Zoom Extents) | `Z` `O` (Zoom Object) — `Z` = ZOOM command |
| **Revit** | ZF / ZE | (no default) |

**Convergence**: single-key frame-selection είναι standard. Επιλέχθηκε **`Z`** — αριστερή άκρη πληκτρολογίου (κοντά στο αριστερό χέρι) + ταυτίζεται με το AutoCAD `Z` = ZOOM alias.

---

## 3. Decision

Νέο shortcut **`Z` (no modifier) = Fit to View Selected**. Το `Home`/`Shift+1` (fit-all) μένει αμετάβλητο.

**Επίλυση σύγκρουσης με command-line (ADR-357)**: σε `select` tool, κάθε γράμμα/ψηφίο ανοίγει το command line (`CommandLineStore.show`). Άρα ο `Z` handler **πρέπει** να τρέχει **πριν** το command-line gate στο `useKeyboardShortcuts`. Guard: μόνο όταν `selectedEntityIds.length > 0`. Όταν **καμία** επιλογή → ο `Z` πέφτει μέσα στο command-line gate → ανοίγει command line με "Z" (διατηρείται το AutoCAD ZOOM entry point). Belt-and-suspenders.

**Αρχιτεκτονικά invariants:**

1. **SSoT bounds**: το combined bbox υπολογίζεται με `calculateCombinedEntityBounds()` που merge-άρει το υπάρχον `calculateEntityBounds()` (καλύπτει ήδη DXF + όλα τα BIM: wall/column/slab/beam/stair/opening/slab-opening). Καμία νέα geometry math.
2. **Selection SSoT**: τα BIM επιλέγονται ως `'dxf-entity'` (SelectionSystem `handleEntityClick`), άρα `getSelectedEntityIds()` επιστρέφει **και** DXF **και** BIM ids. Ένα selection path, χωρίς BIM-specific store.
3. **Event-time read (ADR-040)**: το bbox υπολογίζεται στο keypress, διαβάζοντας fresh `selectedEntityIds` + `currentScene` (το `currentScene` προστέθηκε στα effect deps ώστε ο listener να ξανα-δένεται όταν αλλάζει η σκηνή — όχι stale closure).
4. **Bounds→transform reuse**: το `useFitToView` ήδη κάνει `zoomSystem.zoomToFit(bounds, viewport)` + `setTransform()` με NaN guards. Ο νέος consumer ξαναχρησιμοποιεί αυτό το path 1:1.
5. **EventBus decoupling**: `useKeyboardShortcuts` → `EventBus.emit('canvas-fit-to-view-selected', { bounds })` → `useFitToView`. Ίδιο pattern με το `canvas-fit-to-view`.

---

## 4. Flow

```
keydown 'Z' (no modifier)
  └─ useKeyboardShortcuts (BEFORE command-line gate)
       ├─ selection empty?  → fall through → command line "Z" (AutoCAD ZOOM)
       └─ selection > 0:
            selectedSet = new Set(selectedEntityIds)        // DXF + BIM ids
            entities = currentScene.entities ∩ selectedSet
            bounds = calculateCombinedEntityBounds(entities) // SSoT merge
            EventBus.emit('canvas-fit-to-view-selected', { bounds })
                 └─ useFitToView.handleFitToViewSelected
                      zoomSystem.zoomToFit(bounds, viewport, false)
                      → NaN guard → setTransform(transform)
```

---

## 5. Files Changed

| File | Change |
|------|--------|
| `systems/events/EventBus.ts` | + event `'canvas-fit-to-view-selected'` `{ bounds: { min, max } }` |
| `config/keyboard-shortcuts.ts` | + `fitToViewSelected` (key `Z`, none, `zoom:fit-to-view-selected`, mode-aware) in `DXF_ZOOM_SHORTCUTS` |
| `systems/selection/shared/selection-duplicate-utils.ts` | + `calculateCombinedEntityBounds(entities)` SSoT helper |
| `hooks/useKeyboardShortcuts.ts` | + `Z` handler before command-line gate; `currentScene` added to effect deps; import helper |
| `hooks/canvas/useFitToView.ts` | + `handleFitToViewSelected` consumer (bounds→transform) |
| `i18n/locales/{el,en}/dxf-viewer.json` | + `shortcuts.zoom.fitToView` + `shortcuts.zoom.fitToViewSelected` (Boy Scout: `fitToView` ήταν missing) |
| `systems/selection/shared/__tests__/selection-combined-bounds.test.ts` | + unit tests for `calculateCombinedEntityBounds` |

---

## 6. Edge Cases

- **Empty selection** → fall through to command line (AutoCAD ZOOM). Καμία αλλαγή viewport.
- **Selection με entities χωρίς bounds** (π.χ. xline) → skip-άρονται· bbox από τα υπόλοιπα. Αν κανένα δεν δίνει bounds → no-op.
- **Ctrl+Z / Ctrl+Shift+Z** (undo/redo) → δεν ταιριάζουν (`modifier: 'none'` αποτυγχάνει όταν Ctrl πατημένο). Undo ασφαλές.
- **Single entity** → fit στο bbox του μόνου entity.
- **Mixed DXF + BIM** → ενιαίο bbox (ίδιο selection set, ίδιο `calculateEntityBounds` switch).

---

## 7. Testing

- `selection-combined-bounds.test.ts` — merge DXF, merge BIM (wall bbox projection), mixed, empty, all-null.
- Manual: select DXF only / BIM only / mixed / single / many → `Z` → fit· empty selection → `Z` → command line.

---

## Changelog

- **2026-05-28** — ADR-394 created + implemented. `Z` = Fit to View Selected (DXF + BIM + mixed). Home unchanged. SSoT `calculateCombinedEntityBounds`. Command-line precedence + empty-selection fallthrough. Opus 4.7.
- **2026-05-29** — Hotfix: `Z` δεν λειτουργούσε σε **ελληνικό keyboard layout**. `matchesShortcutDef` σύγκρινε `event.key.toUpperCase()` ('Ζ' U+0396) με Latin 'Z' (U+005A) → fail. Προστέθηκε layout-independent fallback μέσω `event.code === 'Key' + letter` (physical key, AutoCAD-style) για ΟΛΑ τα single Latin-letter shortcuts. 1 file (`config/keyboard-shortcuts.ts`). Opus 4.8.
- **2026-06-11** — Fix (root cause, Giorgio repro): **Z σε ΜΙΑ μεμονωμένη αξονική γραμμή δεν έκανε τίποτα.** Repro που το ξεκλείδωσε: 1 γραμμή→ΟΧΙ· 2 γραμμές / γραμμή+κύκλος / γραμμή+ορθογώνιο→OK. Αιτία: μια οριζόντια γραμμή έχει `boundsHeight=0`, μια κάθετη `boundsWidth=0` → χτυπούσαν τον guard `if (boundsWidth<=0 || boundsHeight<=0) return {success:false}` στο `FitToViewService` → καμία εστίαση. Μόλις συν-επιλεγόταν 2D σχήμα, τα combined bounds αποκτούσαν εμβαδόν → δούλευε. **ΔΙΠΛΟΤΥΠΟ (ο Giorgio το υποψιάστηκε):** ο ίδιος guard υπήρχε σε **2 μεθόδους** — `calculateFitToViewTransform` (scene-based) ΚΑΙ `calculateFitToViewFromBounds` (pure-bounds, **το μονοπάτι που φτάνει το Z**: `zoomToFit→calculateFitTransform→calculateFitToViewFromBounds`). Fix (1 file, 2 σημεία): degenerate άξονας δανείζεται την κυρίαρχη διάσταση (square fit γύρω από το midpoint)· true point (δύο άξονες 0) παραμένει rejected. +4 jest (`__tests__/FitToViewService-degenerate.test.ts`). ⚠️ Boy-Scout flag: το διπλό scale-math των 2 μεθόδων → SSoT unification (pending-ratchet). **ΜΑΘΗΜΑ:** το προηγ. fix (6 DXF bounds cases) ΔΕΝ ήταν η αιτία για τη γραμμή — η `line` ήταν ήδη υποστηριγμένη· υπέθεσα «θα δουλέψει» χωρίς repro. 🔴 browser-verify (1 αξονική γραμμή→Z) + commit. Opus 4.8.
- **2026-06-11** — Fix: το **Z (fit-to-selection)** δεν κάλυπτε όλους τους DXF τύπους. Ο selection-side `calculateEntityBounds` (`systems/selection/shared/selection-duplicate-utils.ts`) — που τροφοδοτεί ΚΑΙ το Z (`calculateCombinedEntityBounds`) ΚΑΙ το window/crossing marquee — απαριθμούσε μόνο line/circle/polyline/lwpolyline/arc/rect/text/mtext + BIM. Οι DXF τύποι **ellipse / spline / point / dimension / xline / ray** έπεφταν στο `default → null` → επιλογή τους + Z (ή marquee) δεν έκανε τίποτα. (Z σε BIM + κοινά DXF δούλευε ήδη.) Fix (1 file): explicit cases για τους 6 τύπους που κάνουν delegate στο πλήρες hit-test SSoT `BoundsCalculator.calculateEntityBounds` (`rendering/hitTesting/Bounds.ts`) — ίδιος calculator με ό,τι είναι click-selectable, μηδέν νέα bounds math. Explicit allow-list (όχι catch-all default) ώστε genuinely unsupported τύποι (insert/hatch/solid) να μένουν σιωπηλοί — αποφυγή console-noise από το `Unknown entity type` warn. +5 jest (`__tests__/calculate-entity-bounds-dxf.test.ts`). Το πλήκτρο **F** στο 2D αφέθηκε ως έχει (Giorgio: «δεν χρειάζεται να κάνει κάτι»· σήμερα no-op). 🔴 browser-verify (επίλεξε DXF ellipse/spline/dimension → Z) + commit. Opus 4.8.
- **2026-06-11** — Fix: το **Home / Shift+1 (fit-ALL)** κεντράριζε **μόνο DXF γεωμετρία**, αγνοώντας ΟΛΕΣ τις BIM οντότητες (τοίχοι/κολώνες/δοκοί/θεμελιώσεις/πλάκες/MEP). Root cause: `createBoundsFromDxfScene` (`systems/zoom/utils/bounds.ts`) έκανε `switch(entity.type)` μόνο σε DXF primitives (line/circle/arc/polyline/text) → κάθε BIM entity έπεφτε εκτός switch → μηδέν συνεισφορά στα bounds. (Το `Z` = fit-to-**selection** δεν επηρεαζόταν — παίρνει έτοιμα bounds από `calculateCombinedEntityBounds`.) Fix (1 file): προστέθηκε `default:` case που προβάλλει το `geometry.bbox` κάθε BIM entity μέσω του SSoT `calculateBimEntity2DBounds` (`bim/utils/bim-bounds.ts`). +4 jest (`__tests__/bounds-bim.test.ts`). ⚠️ Boy-Scout flag (N.0.2): 3 παράλληλοι entity-bounds calculators (zoom/selection/hit-test) — υποψήφιο SSoT unification (pending-ratchet). 🔴 browser-verify (Home με BIM στη σκηνή) + commit. Opus 4.8.
- **2026-07-07** — Fix (root cause, Giorgio repro): το **Z δεν έκανε τίποτα όταν ήταν επιλεγμένο ένα (ή μόνο) κείμενο**, και σε 2η repro **«το φέρνει πιο κοντά αλλά ΔΕΝ κάνει fit to window»**. Αιτία (ADR-557 «οι converters πρέπει να καθρεφτίζουν»): το `case 'text'/'mtext'` στο selection-side `calculateEntityBounds` (`systems/selection/shared/selection-duplicate-utils.ts` — τροφοδοτεί ΚΑΙ το Z μέσω `calculateCombinedEntityBounds` ΚΑΙ το window/crossing marquee) διάβαζε το **legacy flat `entity.text`** + flat `height`. Τα κείμενα του εργαλείου Κειμένου (`CreateTextCommand`) κρατούν περιεχόμενο/ύψος **ΜΟΝΟ** στο `textNode` (DxfTextNode AST) → `entity.text === undefined` → `return null` → `if (bounds)` guard fail → σιωπηλό no-op. (1η προσπάθεια με char-count heuristic ξεμπλόκαρε το no-op αλλά το box **δεν ταίριαζε** με τα σχεδιασμένα glyphs → το fit «υποεκτιμούσε» → not fit-to-window.) **Τελικό fix (1 file, GOL+SSoT):** το bounds πλέον χρησιμοποιεί το **ΙΔΙΟ visual-box SSoT** που εκπέμπουν 2D grips/hover/hit-test — `projectSceneTextToDxf` (`bim/text/project-scene-text.ts`, ADR-557 scene→DxfText SSoT) → `resolveTextBox` (`bim/text/text-box.ts`, metrics-accurate glyph advance + cap-height extent + attachment/rotation) → 4 world corners (`RECT_CORNERS`/`rectCornerWorld`, `bim/grips/rect-frame.ts`) → `calculateVerticesBounds`. Έτσι το Z πλαισιώνει **ΑΚΡΙΒΩΣ** τα σχεδιασμένα γράμματα (καμία heuristic). Καλύπτει text/mtext, multiline, rotation, MTEXT width-frame vs TEXT widthFactor. Ξεκλειδώνει **και** το marquee σε in-app κείμενα. +7 jest (`selection-combined-bounds.test.ts`, parity με το grip box· σύνολο 13 pass· 74 pass στα selection+text-box suites). ⚠️ Boy-Scout flag (N.0.2): ο selection-bounds calculator ενοποιήθηκε πλέον με το text-box SSoT — μένουν οι zoom/scene bounds ως υποψήφια unification (pending-ratchet). 🔴 browser-verify (in-app κείμενο → Z → γεμίζει την οθόνη) + commit. Opus 4.8.
