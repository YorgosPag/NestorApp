# HANDOFF — Grip-Move ↔ Body-Drag Alignment Parity + Remove Move Pill — 2026-07-04

## 🎯 ΤΙ ΘΑ ΚΑΝΕΙΣ
Ο Giorgio θέλει **μία και μοναδική πηγή αλήθειας για τις ενδείξεις μετακίνησης** οντότητας DXF.
Όταν μετακινεί μια οντότητα (π.χ. γραμμή):
- **πιάνοντας το ΣΩΜΑ** (body-drag) → βλέπει τα κοινά ίχνη ευθυγράμμισης ✅ (σωστό σήμερα)
- **πιάνοντας την ΚΕΝΤΡΙΚΗ ΛΑΒΗ** (midpoint / move grip) → βλέπει «λευκή πινακίδα με μαύρα γράμματα»
  (`drawDimPill`) αντί για τα ίχνη ❌ (λάθος)

**Ζητούμενο:** και οι δύο ροές να δείχνουν ΤΑ ΙΔΙΑ ίχνη ευθυγράμμισης (single source of truth, μηδέν
διπλότυπο). **ΑΠΟΦΑΣΗ GIORGIO: καμία πινακίδα πουθενά** — αφαίρεση της `drawDimPill` ΚΑΙ από τις ΔΥΟ ροές.

## 🔍 ΡΙΖΑ (ΕΠΙΒΕΒΑΙΩΜΕΝΗ — evidence-based, μην την ξανα-ψάξεις)
Και οι δύο ροές μοιράζονται τον **ΙΔΙΟ** εγκέφαλο (`resolveActionAlignmentTracking`) και την ΙΔΙΑ πινακίδα
(`drawDimPill`). Η **μόνη** διαφορά = **πού λύνεται το tracking**:

| Ροή | Resolve | Αρχείο | Αποτέλεσμα |
|---|---|---|---|
| **Body-drag** ✅ | ΤΟΠΙΚΑ in-draw ανά frame | `hooks/tools/useEntityBodyDragPreview.ts:114` | Ίχνη σταθερά (WYSIWYG) |
| **Grip midpoint** ❌ | cross-tick `GripAlignmentTrackingStore` (mouse-move → draw) | `hooks/tools/useGripGhostPreview.ts:301,325` | **Timing-skew → ίχνη «χάνονται» → πέφτει στην πινακίδα** |

- Το **ADR-560/572 διόρθωσε ήδη ΑΚΡΙΒΩΣ αυτό** για το body-drag (μετακίνησε το resolve μέσα στο draw· δες
  σχόλιο `useEntityBodyDragPreview.ts:109-113` «*ΜΗΔΕΝ εξάρτηση από το cross-tick store — τέλος του
  timing-skew όπου τα ίχνη «χάνονταν»*»). Το grip-drag έμεινε πίσω. **Δεν είναι νέο σύστημα — είναι το ίδιο
  fix που λείπει από τη μία ροή.**
- Population OK (ΔΕΝ είναι κενό anchors): το midpoint grip στήνει `dragAnchor`+`gripIndex` στο
  `grip-mouse-handlers.ts:290-302` → `getLineGripAlignmentAnchors(2, null, line, dragAnchor)` επιστρέφει
  `[dragAnchor]` (`systems/line/line-grips.ts:144-155`). Άρα το store ΜΠΟΡΕΙ να γεμίσει — απλώς χάνεται στο skew.

## 📋 ΣΧΕΔΙΟ ΥΛΟΠΟΙΗΣΗΣ

### A) Grip-translate → local in-draw resolve (mirror body-drag)
Στο `useGripGhostPreview.ts` (draw callback), για **line translate grip** (`isLineEntity` + `dp.movesEntity`):
λύσε `resolveActionAlignmentTracking` **ΤΟΠΙΚΑ μέσα στο draw** (ίδιο μοτίβο με `useEntityBodyDragPreview.ts:114`),
με anchors από το υπάρχον `getLineGripAlignmentAnchors(dp.gripIndex, dp.lineGripKind, line, anchor)` — αντί για
`getGripAlignmentTracking()` store-read (γρ. 325). Paint με το ΙΔΙΟ `paintGripAlignmentTracking`.
- **WYSIWYG parity (ΚΡΙΣΙΜΟ):** το ghost delta έρχεται από το point-override στο mouse-move
  (`applyGripDragAlignmentTracking`, `systems/cursor/grip-drag-alignment-tracking.ts:51-67`). **ΜΗΝ αφαιρέσεις**
  το point-override (τρέφει τη γεωμετρία). Απλώς το paint μετακινείται σε local resolve. Επιβεβαίωσε ότι
  το in-draw resolved point == το mouse-move resolved point (ίδιο input → ίδιο output· ο resolver είναι pure).
  Δέχεται double-resolve όπως ΚΑΙ το body-drag (δες ADR-572 §"body-drag mixed pattern" — αποδεκτό).
- Το `getGripAlignmentTracking` store παραμένει σε χρήση για **dimension grips** (`useDimGripGhostPreview.ts:42`)
  → ΜΗΝ πειράξεις τη dimension ροή.

### B) Αφαίρεση πινακίδας από ΑΜΦΟΤΕΡΕΣ τις ροές (εντολή Giorgio: «καμία πινακίδα πουθενά»)
1. `useGripGhostPreview.ts:285-316` — αφαίρεσε το `isTranslate` block που ζωγραφίζει `drawDimPill` (γρ. 315) +
   το ⟂/∥ ortho readout (γρ. 306-314). **ΚΡΑΤΑ** το hot-grip rubber-band `drawDashedSegment` (γρ. 271-283) —
   είναι άλλη ένδειξη (γραμμή-λάστιχο), όχι πινακίδα.
2. `useEntityBodyDragPreview.ts:129-138` — αφαίρεσε το `else if (!clearanceDims) { … drawDimPill … }` (γρ. 133-138).
   Κράτα το `if (tracking) paintGripAlignmentTracking(...)`.

### C) Boy-Scout: dead-code μετά την αφαίρεση (dead-code ratchet CHECK 3.22)
- Το `drawMoveReadoutLeader` (`grip-ghost-preview-draw-helpers.ts:89-104`) πιθανόν μένει ΧΩΡΙΣ consumer μετά το (B)
  → **grep πρώτα**· αν είναι πλέον unused, αφαίρεσέ το + το `OVERLAY_LINE_COLORS.moveLeader` token
  (`canvas-v2/preview-canvas/overlay-line-style.ts`) που πρόσθεσα στο ADR-572 Γ1 (αλλιώς dead code).
- `formatMoveDistance`, `moveReadoutMid`, `drawDimPill`, `getMoveOrthoAxis` — grep αν μένουν unused σε αυτά τα
  αρχεία μετά την αφαίρεση· καθάρισε imports (μπορεί να χρησιμοποιούνται & αλλού — ΕΛΕΓΞΕ, μη σβήσεις τυφλά).
- ⚠️ Το `useMovePreview.ts` (2-click MOVE tool) ίσως ΕΠΙΣΗΣ ζωγραφίζει πινακίδα — **grep `drawDimPill` σε ΟΛΟ το
  dxf-viewer** και ρώτα τον Giorgio αν θέλει να φύγει κι από εκεί (πιθανότατα ναι, για πλήρη συνέπεια).

## 🔑 ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
1. **SSoT / μηδέν διπλότυπα** — mirror ΑΚΡΙΒΩΣ το body-drag· μην φτιάξεις παράλληλο resolve/paint. ΕΝΑ μοτίβο.
2. **ADR-040 CHECK 6B/6D** — `useGripGhostPreview.ts` + `useEntityBodyDragPreview.ts` είναι hot-path preview draw
   → **stage ADR** (ADR-560 ή ADR-363) μαζί με τον κώδικα, αλλιώς μπλοκάρει το pre-commit. Κράτα το draw callback
   thin· μηδέν νέο `useSyncExternalStore`.
3. **ΟΧΙ `tsc`/typecheck (N.17)** — jest μόνο.
4. **Ελληνικά πάντα.**

## ⚠️ ΚΑΤΑΣΤΑΣΗ WORKING TREE (ΔΙΑΒΑΣΕ — multi-agent + uncommitted)
- Η προηγούμενη δουλειά **ADR-572 (Alignment Traces SSoT — Γ1/Γ2/Γ3)** είναι **UNCOMMITTED** στο working tree
  (ο Giorgio ΔΕΝ έχει κάνει ακόμη commit). Αγγίζει ΚΑΙ αρχεία αυτού του task:
  `useGripGhostPreview.ts` (όχι ακόμη — μόνο τα helpers), `grip-ghost-preview-draw-helpers.ts` (Γ1 leader SSoT),
  `overlay-line-style.ts` (Γ1 `moveLeader` token), `drawing-hover-overlays.ts` κ.ά.
- Αρχεία ADR-572 (uncommitted): `distance-label-utils.ts`, `dim-alignment-tracking.ts`*, `rotation-tracking-overlay.ts`,
  `polar-utils.ts`(+test), `drawing-hover-handler.ts`*, `drawing-hover-overlays.ts`, `use-bim3d-wall-placement.ts`,
  `overlay-line-style.ts`, `grip-ghost-preview-draw-helpers.ts`, `ADR-572-alignment-traces-ssot-audit.md`, `adr-index.md`.
  (* = entangled με δουλειά άλλου agent — ADR-562 / PERF trace).
- **ΠΟΤΕ** `git add -A` / bulk reset/checkout. Μόνο `git add <specific>` + `git diff --cached` verify.
- **COMMIT/PUSH ΤΑ ΚΑΝΕΙ Ο GIORGIO** — εσύ ετοιμάζεις & σταματάς.

## ✅ VERIFICATION (πριν πεις «έτοιμο»)
- **jest:** `hooks/dimensions/__tests__/dim-alignment-tracking-tolerance`, `systems/cursor/__tests__/body-drag-alignment-tracking`,
  `hooks/tools/__tests__/rotation-tracking-overlay`, `hooks/dimensions/__tests__/useDimensionGrips-alignment-anchors`,
  `systems/line/__tests__/line-grips`, `systems/constraints/__tests__/polar-utils` → GREEN.
  (Ίσως χρειαστεί νέο/ενημερωμένο assert ότι grip-translate paint == body-drag paint path.)
- **browser:** επίλεξε γραμμή → πιάσε ΚΕΝΤΡΙΚΗ λαβή → μετακίνησε: **ίδια ίχνη με το body-drag, ΜΗΔΕΝ πινακίδα**.
  Σύγκρινε side-by-side με body-drag (πιάσε σώμα).

## 📚 ΚΛΕΙΔΙΑ-ΑΡΧΕΙΑ
- `hooks/tools/useGripGhostPreview.ts` (grip draw callback — target A+B)
- `hooks/tools/useEntityBodyDragPreview.ts` (reference μοτίβο + target B)
- `systems/cursor/grip-drag-alignment-tracking.ts` (point-override — ΜΗΝ αφαιρέσεις το override)
- `hooks/tools/grip-ghost-preview-draw-helpers.ts` (`drawMoveReadoutLeader`/`drawDashedSegment`)
- `systems/line/line-grips.ts` (`getLineGripAlignmentAnchors` — anchors SSoT)
- `hooks/dimensions/dim-alignment-tracking.ts` (`resolveActionAlignmentTracking`/`paintGripAlignmentTracking`)
- ADR: `docs/centralized-systems/reference/adrs/ADR-560*` + `ADR-363*` (move-indication SSoT) — update Phase 3.
