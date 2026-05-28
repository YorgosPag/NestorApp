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
