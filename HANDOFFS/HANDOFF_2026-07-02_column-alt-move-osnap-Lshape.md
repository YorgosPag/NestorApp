# HANDOFF — ALT-move κολόνας OSNAP (Σχήμα Γ) δεν έλκει στη γειτονική

**Ημ/νία:** 2026-07-02 · **ADR:** ADR-363 Φ1G.5 · **Branch:** main (UNCOMMITTED)

## Πρόβλημα (Giorgio)
ALT + σύρσιμο λαβής **Γ-κολόνας** κοντά σε άλλη κολόνα → ΔΕΝ εμφανίζονται σημάδια έλξης
(OSNAP), δεν έλκονται τα άκρα στη σταθερή κολόνα.

## Τι ΕΓΙΝΕ ήδη (2 πραγματικά bugs λύθηκαν — ΚΡΑΤΑ ΤΑ)
1. **ALT detection** (`bim/columns/column-corner-snap.ts`): νέα παρ. `altMove` στο
   `findColumnGripCornerSnap` → αγνοεί παραμετρικό kind, τρέχει καθαρό translate
   (`applyColumnGripDrag('column-center')`), bypass του `isColumnCornerSnapGrip`.
   ΓΙΑΤΙ: το `column-center` grip ΔΕΝ εκπέμπεται (declutter, `column-grips.ts:162`),
   ALT+drag ξεκινά πάντα από `column-poly-vertex-*`/rotation → πριν έβγαινε null.
2. **`mouse-handler-move.ts` + `mouse-handler-up.ts`**: διαβάζουν `GripAltMoveStore.getActive()`,
   τρέχουν την projection & στο ALT για κάθε kind, περνούν το flag (ghost≡commit).
3. **`systems/cursor/corner-projection-snap.ts`** ← ΚΡΙΣΙΜΟ: `findBestCornerProjection`
   απορρίπτει σιωπηλά snaps (grid/guide) μέσω `isSnapMarkerVisible(toSnapIndicatorView(result))`.
   ΓΙΑΤΙ: το grid είναι πανταχού παρόν+σιωπηλό → έδινε ψεύτικο «SNAP» χωρίς marker/έλξη.
   Ωφελεί ΚΑΙ wall (ADR-371) & column resize. Tests: `corner-projection-snap.test.ts` 7/7.

## ΡΙΖΑ που ΜΕΝΕΙ (αποδεδειγμένη με runtime logs)
Για **Σχήμα Γ (L-shape/polygon)** η projection χρησιμοποιεί μόνο τις **4 γωνίες bounding-box**
(`getColumnCornerWorldPointsFromParams` → filter nw/ne/se/sw στο `column-corner-anchors.ts`).
Στο Γ: 1 bbox-γωνία είναι «φάντασμα» (εσοχή, κενό) + οι bbox-γωνίες ≠ ορατές κορυφές.
→ Όταν ο χρήστης ευθυγραμμίζει ΠΡΑΓΜΑΤΙΚΗ κορυφή του Γ, καμία bbox-γωνία δεν πέφτει στη
σταθερή → `perCorner` logs έδειξαν ΜΟΝΟ `grid@...` + `bim_corner@(self stale pos)` — ΠΟΤΕ
τη σταθερή κολόνα. (Η σταθερή ΕΙΝΑΙ indexed· απλώς οι 4 λάθος σημεία δεν τη φτάνουν.)

## FIX που ΜΕΝΕΙ (ακριβές)
Στο `bim/columns/column-corner-snap.ts` → `projectColumn`: αντί
`getColumnCornerWorldPointsFromParams(proposed)` (4 bbox), χρησιμοποίησε τις **πραγματικές
κορυφές footprint**:
```ts
import { computeColumnGeometry } from '<column geometry SSoT>'; // βλ. column-poly-vertex-grips.ts:279
const corners = computeColumnGeometry(proposed).footprint.vertices; // world Point2D[]
```
- Πηγή/precedent: `column-poly-vertex-grips.ts:279`
  `entity.geometry?.footprint?.vertices ?? computeColumnGeometry(entity.params).footprint.vertices`.
- Για rectangular: footprint.vertices = 4 πραγματικές γωνίες → μηδέν regression.
- Πρόσεξε units/performance (καλείται ανά frame· ήδη cached στα grips).
- Ενημέρωσε τα υπάρχοντα tests `column-corner-snap.test.ts` (τα rect περνούν ίδια·
  πρόσθεσε 1 L-shape test όπου μια πραγματική κορυφή κουμπώνει).

## ΚΑΘΑΡΙΣΜΟΣ πριν commit (temp diagnostics — REMOVE ΟΛΑ)
Ψάξε `__DBG_COLSNAP` / `COLSNAP` και σβήσε:
- `systems/cursor/mouse-handler-move.ts`: module-load banner (`v3 LOADED`) + top-of-callback log.
- `hooks/grips/grip-mouse-handlers.ts`: `[COLSNAP down-entry]` + `[COLSNAP down]`.
- `bim/columns/column-corner-snap.ts`: `[COLSNAP proj]` block.

## Μετά το fix
- Tests: `npx jest corner-projection column-corner-snap wall-face-corner` (πρέπει GREEN).
- ADR-363 changelog: υπάρχει ήδη entry §Φ1G.5 (πρόσθεσε το L-shape vertices fix + grid-rejection).
- Browser-verify: ALT+σύρε Γ-κολόνα, ορατή κορυφή σε σταθερή → ┘ marker + έλξη. ΟΧΙ σε κενό/grid.
- Commit ΜΟΝΟ με εντολή Giorgio (N.-1).

## Boy-Scout (ξεχωριστό)
`hooks/useGripMovement.ts` (~470 γρ.) = ΝΕΚΡΟΣ κώδικας (κανείς δεν το καλεί· ζωντανό μόνο
`useUnifiedGripInteraction`). Διαγραφή + καθάρισμα barrel `hooks/index.ts` σε δικό του commit.
