# ADR-398 — Column placement snap (corner projection + beam-axis snap + ghost coloring)

**Status:** 🟢 Column→Beam axis snap + ghost coloring DONE — UNCOMMITTED 2026-06-19 · 🔴 browser-verify + commit
**Date:** 2026-06-19 · **Γλώσσα:** Ελληνικά
**Σχετικά:** ADR-363 (column drawing tool / FSM + anchor ghosts), ADR-370/371/378 (BIM corner-snap system), ADR-040 (preview-canvas perf — cursor-lag Φ11 decoupled snap-scheduler), ADR-441 (column-on-grid host-on-snap)

> ⚠️ **Architecture-critical (CHECK 6D):** αγγίζει `systems/cursor/*` (snap-scheduler, mouse handlers) + ghost preview. Κάθε αλλαγή εδώ απαιτεί staged ADR/doc.

---

## 1. Πλαίσιο

Το column tool (ADR-363, freehand single-click) ζωγραφίζει ghost κάτω από το σταυρόνημα και τοποθετεί κολώνα στο κλικ. Το snap κατά την τοποθέτηση τρέχει σε **2 σημεία** (mirror): τον decoupled `snap-scheduler` (move → ghost/indicator, ADR-040 Φ11) και τον `mouse-handler-up` (click → commit point). Προϋπήρχε το **Column Body Corner Projection Snap** (η would-be κολώνα προβάλλει τις γωνίες της σε στόχους· `findColumnDrawCornerSnap`).

## 2. Πρόβλημα (Giorgio 2026-06-19)

Όταν ο χρήστης τρέχει «Κολώνα» και περνά το σταυρόνημα **πάνω από δοκάρι**, θέλει:
1. Οπτική ένδειξη ότι κλικ εκεί θα τοποθετήσει την κολώνα **πάνω στο δοκάρι**.
2. Η κολώνα να τοποθετείται **στον άξονα** του δοκαριού — **κέντρο κολώνας ≡ κέντρο άξονα δοκαριού**.

## 3. Απόφαση

### 3.1 Beam-axis snap (κέντρο κολώνας ≡ άξονας δοκαριού)
NEW pure SSoT `bim/columns/column-placement-snap-context.ts`:
- `findColumnBeamAxisSnap(worldPos, beams)` — κάθετη προβολή του cursor στον άξονα (`startPoint→endPoint`, clamped στο segment)· υποψήφιο όταν κάθετη απόσταση ≤ `halfWidth · 1.5` (ο cursor «πάνω στο σώμα»· width-based ⇒ **transform-independent**)· νικά το μικρότερο κάθετο. Reuse `projectPointOnAxis` (SSoT προβολής).
- `resolveColumnPlacementContext(worldPos, entities)` → `beam` (snap point + beamId) | `overlap` (μέσα σε footprint κολώνας, reuse `isPointInPolygon`) | `neutral`. **Δοκάρι πάντα νικά** (η ρητή «hover→place» πρόθεση).

Wiring (mirror του corner-snap, ΕΝΑ SSoT σε 2 paths):
- **Move** (`snap-scheduler.runSnapDetection`): column active → `resolveColumnPlacementContext`· `beam` ⇒ `setImmediateSnap` στο σημείο του άξονα (+ beamId) και short-circuit του corner/center snap. `mouse-handler-move` τροφοδοτεί `getEntities`.
- **Commit** (`mouse-handler-up`): column active → beam-axis νικά → `worldPoint = beam point`.
- **Center enforcement** (`useColumnTool.commitColumnFromState`): όταν ghost status = `beam` → anchor **`'center'`** ανεξάρτητα από τον επιλεγμένο anchor ⇒ κέντρο κολώνας ≡ άξονας δοκού.

### 3.2 Ghost coloring (σημασιολογικό feedback στο ghost, ΟΧΙ στην υποκείμενη οντότητα)
Ο χρωματισμός γίνεται στο **ghost** (η προσοχή είναι εκεί· Revit/AutoCAD pattern· δεν αγγίζει τον select-gated entity-hover renderer):
- 🟢 **πράσινο** = πάνω σε δοκάρι (έγκυρος snap στόχος)
- 🔴 **κόκκινο** = πάνω σε υπάρχουσα κολώνα (σύγκρουση/επικάλυψη — τοποθετείται ακόμη, προειδοποίηση)
- ⚪ **default (χρώμα τύπου)** = ελεύθερη τοποθέτηση

NEW zero-React store `systems/cursor/ColumnPlacementGhostStatusStore.ts` (mirror `ImmediateSnapStore`): ο scheduler γράφει το status· το `useColumnGhostPreview` το διαβάζει **imperatively μέσα στο RAF** (zero subscription, ADR-040) και περνά `statusColor` στον `ColumnAnchorGhostRenderer` (νέο optional override, `resolveGhostStatusColor`).

## 4. Συνέπειες
- ✅ Καθαρή «hover→place» εμπειρία· η κολώνα κουμπώνει στον άξονα του δοκαριού (κέντρο ≡ άξονας).
- ✅ ADR-040-safe: μηδέν νέο React subscription· stores zero-React· width-based tol (transform-independent).
- ✅ SSoT: ΕΝΑ context resolver καταναλώνεται και από move και από commit (μηδέν διπλή λογική, mirror corner-snap).
- ✅ Μηδέν regression: το beam-axis είναι additive· χωρίς δοκάρι κάτω από τον cursor όλα μένουν ως πριν.
- ⚠️ Το beam-axis snap τρέχει εντός του υπάρχοντος snap gate (`snapEnabled`)· με snap απενεργοποιημένο δεν εφαρμόζεται (consistent με τα άλλα snaps).

## 5. Tests
`bim/columns/__tests__/column-placement-snap-context.test.ts` — 9 GREEN: προβολή στον άξονα· clamp στο segment· capture width-based· nearest beam· precedence (beam > overlap > neutral).

## 6. Changelog
- **2026-06-19 (UNCOMMITTED)** — NEW `column-placement-snap-context.ts` (`findColumnBeamAxisSnap` + `resolveColumnPlacementContext`) + NEW `ColumnPlacementGhostStatusStore.ts` + ghost coloring (`ColumnAnchorGhostRenderer.statusColor` + `resolveGhostStatusColor`) + wiring move (`snap-scheduler` + `mouse-handler-move.getEntities`) + commit (`mouse-handler-up`) + center-anchor enforcement (`useColumnTool`). 9 jest GREEN. 🔴 tsc(Giorgio) + browser-verify + commit.
- _(retroactive)_ Column Body Corner Projection Snap (`findColumnDrawCornerSnap`, ADR-040 Φ11 scheduler + up-handler) — η would-be κολώνα προβάλλει τις γωνίες της σε στόχους· sibling του beam-axis snap, ίδιο 2-paths pattern.
