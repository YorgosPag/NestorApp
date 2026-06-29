# ADR-557: Text / MText λαβές με ΠΛΗΡΗ parity ορθογώνιου τοίχου/κολόνας (SSoT)

| Πεδίο | Τιμή |
|---|---|
| **Status** | 🟢 Slices 1-5 IMPLEMENTED (UNCOMMITTED) — browser-verified 2D + 3D grips (Giorgio 2026-06-30) |
| **Date** | 2026-06-30 |
| **Last Updated** | 2026-06-30 |
| **Category** | Canvas & Rendering / Grips |
| **Location** | `src/subapps/dxf-viewer/` (`bim/text/`, `hooks/grips/`, `rendering/{entities,ghost}/`, `core/commands/text/`) |
| **Author** | Claude (κατόπιν εντολής Giorgio) |
| **Related ADRs** | **ADR-363** (rect-grip-engine + column adapter = το πρότυπο), ADR-436 (pad adapter), ADR-397 (glyph registry SSoT), ADR-507 §8 (`MergeableUpdateCommand`), ADR-040 (preview canvas), ADR-537 (3D raw-dxf grips), ADR-530 (glyph text render), ADR-108 (text-metrics ratios) |

---

## Summary

Όταν επιλέγεις **ορθογώνιο τοίχο/κολόνα** → 8 λαβές (4 γωνίες + 4 μέσα-πλευράς) + 1 move + 1 rotation. Ο Giorgio ζήτησε **τον ΙΔΙΟ ΑΚΡΙΒΩΣ κώδικα** στα **ΚΕΙΜΕΝΑ** (TEXT + MTEXT): ίδιες λαβές, ίδιο resize/move/rotate, **μία πηγή αλήθειας, όχι διπλότυπο**.

Λύση: ΝΕΟ entity-agnostic adapter `bim/text/text-grips.ts` που **καλεί** τον κοινό πυρήνα `rect-grip-engine`/`rect-frame` (ίδιος κώδικας με τοίχο/κολόνα/πέδιλο), αντικαθιστώντας την παλιά μονή «position grip» του κειμένου. Εκπέμπει **10 grips** και στα 3 paths (2D interaction, 2D visual render, 3D viewport) + live ghost (preview ≡ commit) + minimal commit (`UpdateTextTransformCommand`).

- **MTEXT**: πλάτος = το πραγματικό `MTextEntity.width`.
- **TEXT (απλό)**: πλάτος = ΝΕΟ `widthFactor` (AutoCAD TEXT X-scale) + οριζόντιο `ctx.scale(widthFactor,1)` στον renderer.

---

## Context — δύο κρίσιμα ευρήματα audit (το αρχικό πλάνο τα έχασε)

### 1. ΔΥΟ ξεχωριστά grip συστήματα (όχι ένα)
Το αρχικό πλάνο υπέθεσε ότι το emission ζει μόνο στο `computeDxfEntityGrips` (`hooks/grip-computation.ts`). Στην πραγματικότητα:

| Σύστημα | Συνάρτηση | Τι τροφοδοτεί |
|---|---|---|
| Interaction (hit-test) + **3D render** | `computeDxfEntityGrips` → `getTextGrips` | `GripRegistryPublisher`→`AllGripsStore`· `grip-3d-dxf-raw-grips` |
| **2D VISUAL render** (ζωγραφική τετραγώνων) | `BaseEntityRenderer.getGrips()` **per-entity** | `renderGrips`→`PhaseManager.renderPhaseGrips` |

Αν αλλάξεις μόνο το πρώτο, το 3D δείχνει 10 λαβές αλλά ο 2D καμβάς δείχνει την παλιά **1**. **Και τα δύο** πρέπει να επιστρέφουν το ίδιο grip set → και τα δύο καλούν `getTextGrips`. (Mirror `ColumnRenderer.getGrips` → `getColumnGrips`.)

### 2. Λάθος σύμβαση άγκυρας bbox (`entity-bounds.ts`)
Το αρχικό πλάνο §7 παρέπεμψε στο `entity-bounds.ts` που τοποθετεί `position` = **πάνω-αριστερά** (box προς τα **κάτω**, `minY = position.y − h`). Η **πραγματική** τοποθέτηση κειμένου της εφαρμογής (επιβεβαιωμένη από τον 3D text converter `dxf-text-3d.ts`: *«baseline-left, matching the 2D anchor + getEntityBBox lower-left corner»*, `mesh.center = position + (w/2, +h/2)`) είναι `position` = **κάτω-αριστερά**, box προς τα **ΠΑΝΩ**. Η λάθος σύμβαση έβαζε τις λαβές **κάτω από** το κείμενο (ίδια λάθος θέση 2D **και** 3D, αφού κοινό `getTextGrips`). Διόρθωση: `textToRectFrame` centre = `position + R(θ)·(w/2, +h/2)`.

---

## Decision — αρχιτεκτονική (μηδέν διπλότυπο)

**Κοινός πυρήνας (reuse, ΟΧΙ αντιγραφή math):** `bim/grips/rect-frame.ts` + `rect-grip-engine.ts` (opposite-corner/edge fixed) — ο ίδιος που χρησιμοποιούν τοίχος/κολόνα/πέδιλο.

**ΝΕΟ adapter `bim/text/text-grips.ts`** (πρότυπο: `column-rect-adapter.ts`):
- `textToRectFrame(dxfText)` — `position` (κάτω-αριστερά) + `widthFactor`/`width` + `rotation` → centroid `RectFrame`. Defensive: `resolveBoxHeight` (fallback 2.5) + `naturalTextWidth` ανέχεται undefined `text` (pure, δεν σκάει).
- `getTextGrips(entity)` — 10 `GripInfo` (mirror `rectColumnGrips`): center MOVE (0) + rotation (1) + 4 edges (2,3,8,9) + 4 corners (4..7). Rotation handle = `rotationHandleMidwayOffset` (ίδια πολιτική με κολόνα).
- `applyTextGripDrag(kind, {entity,delta,currentPos?,ortho?,pivot?})` → `TextTransformPatch {position?,rotation?,height?,width?,widthFactor?}`. ΕΝΑ pure transform· pivot περιστροφής = bbox-centre + re-home `position` (Figma-like).

**Διάκριση MTEXT vs TEXT:** `width != null` ⇒ MTEXT (patch `width`)· αλλιώς TEXT (patch `widthFactor`). Ο converter (`dxf-text-entity-converter.ts`) κουβαλά `width` μόνο σε MTEXT, `widthFactor` μόνο σε TEXT.

**Commit:** ΝΕΟ minimal `UpdateTextTransformCommand` (extends `MergeableUpdateCommand`) που γράφει **top-level** πεδία (`position/rotation/height/fontSize/width|widthFactor`) — ΟΧΙ το `UpdateTextGeometryCommand` (κενά: γράφει `textNode.rotation` ενώ ο renderer διαβάζει flat `rotation`· αγνοεί `width` χωρίς `columns`). Drag-merge → ένα undo.

**Glyph render (TEXT X-scale):** `TextRenderer` προσθέτει **μόνο** οριζόντιο `ctx.scale(widthFactor,1)` γύρω από το text origin, ΜΕΤΑ την υπάρχουσα rotation (μηδέν αλλαγή rotation/zoom math)· `widthFactor === 1` → byte-identical legacy path. `scaleText` (toolbar Scale) τιμά `widthFactor *= |sx|` (Boy-Scout consistency με `scaleMText`).

**Glyph icons:** `grip-glyph-registry` → `text-move`='move', `text-rotation`='rotation' (4-βέλη / καμπύλο βέλος, ίδιο SSoT με κολόνα).

### ΧΩΡΙΣ mirror grip (δεν ζητήθηκε).

---

## Files (Slices)

- **Slice 1 (foundation):** `grip-kinds.ts` (`TextGripKind`), `grip-types.ts`, `grip-computation-types.ts`, `useGripMovement.ts`, `dxf-types.ts` (`DxfText.width?/widthFactor?`), `entities.ts` (`TextEntity.widthFactor?`), ΝΕΟ `bim/text/text-grips.ts` + tests.
- **Slice 2 (emission):** `dxf-text-entity-converter.ts` (carry width/widthFactor), `grip-computation.ts` (`case 'text'` → `getTextGrips`).
- **Slice 3 (commit+ghost):** ΝΕΟ `UpdateTextTransformCommand.ts`, ΝΕΟ `grip-parametric-text-commits.ts` (+re-export), `grip-commit-adapters.ts` (dispatch), `grip-projections.ts`, `grip-drag-preview-transform.ts`, `apply-entity-preview.ts`, `entity-preview-types.ts`, `unified-grip-types.ts`, `grip-registry.ts` (forward `textGripKind`).
- **Slice 4 (2D render parity + widthFactor):** `TextRenderer.getGrips` (10 grips, mirror Column) + horizontal `widthFactor` scale + hitTest width, `grip-glyph-registry.ts`, `entity-bounds.ts`, `scale-entity-transform.ts`.
- **Slice 5:** αυτό το ADR.

**Tests:** `bim/text/__tests__/text-grips.test.ts` (geometry/resize/rotation/round-trip), `hooks/__tests__/grip-computation-text.test.ts` (emission=10).

---

## Boy-Scout / γνωστά εκκρεμή
- `text-engine/interaction/TextGripGeometry.ts` + `TextGripHandler.ts` = ασύνδετο παλιό σύστημα (4 γωνίες+move+rotation+mirror, δική του math). **Μερικώς αντικαθιστούμενο** — να αποσυρθεί όταν επιβεβαιωθεί zero-usage.
- `TextRenderer.hitTest` + `entity-bounds.ts` κρατούν ακόμα τη **down** σύμβαση Y (η διόρθωση μπήκε μόνο στις λαβές). Αν το κίτρινο πλαίσιο επιλογής φανεί μετατοπισμένο vs λαβές → ενοποίηση σε lower-left σε επόμενο γύρο (επηρεάζει selection/zoom/snap → ξεχωριστή απόφαση).

---

## Changelog
- **2026-06-30** — Slices 1-5 υλοποιήθηκαν (UNCOMMITTED). Browser-verified: 10 λαβές σωστά τοποθετημένες 2D + 3D (Giorgio). Renumber ADR-551→**557** (collision με census ADR στο shared tree). Εκκρεμεί commit (Giorgio).
