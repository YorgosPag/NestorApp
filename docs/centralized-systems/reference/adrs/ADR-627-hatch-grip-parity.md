# ADR-627 — Γραμμοσκίαση (hatch): move/rotate λαβές + length/angle HUD + alignment traces + τόξα φοράς (parity με το περίγραμμα εμβαδού)

- **Status**: ✅ IMPLEMENTED · ✅ BROWSER-VERIFIED (Giorgio 2026-07-10) · ⏳ UNCOMMITTED (commit → Giorgio)
- **Category**: DXF Viewer — Canvas & Rendering / Grips
- **Related**: ADR-561 (move/rotate grips σε primitives — polyline/circle/arc/rectangle),
  ADR-507 (hatch creation system — boundaryPaths, vertex/edge/gradient grips),
  ADR-397 (BIM grip glyph SSoT — MOVE 4-arrow / ROTATION curved),
  ADR-188 (RotateEntityCommand / rotateEntity), ADR-508 (§line-hud / §polygon-hud — λευκές ενδείξεις),
  ADR-537/561/508 (grip-drag alignment/HUD selection SSoT 2D↔3D), ADR-587 Φ5/Φ7 (introspectable seams),
  ADR-040 (preview-canvas perf — micro-leaf, καμία high-freq subscription)

## Context

Το «περίγραμμα εμβαδού» (ribbon → Αρχική → «Εμβαδό») είναι στην πράξη ένα **closed `polyline`**
(measurement). Μέσω του ADR-561 έχει ήδη: vertex + edge-midpoint λαβές **ΚΑΙ** σταυρό μετακίνησης
+ σημάδι περιστροφής, length/angle HUD κατά το drag, κίτρινα alignment traces (Polar ON) και
κόκκινα/πράσινα τόξα φοράς στην περιστροφή.

Η **γραμμοσκίαση** (`type:'hatch'`, γεωμετρία σε `boundaryPaths: Point2D[][]`, `boundaryPaths[0]`
= εξωτερικό όριο) είχε ΜΟΝΟ vertex + edge-midpoint + gradient λαβές (ADR-507). Ζητούμενο
(Giorgio 2026-07-10): να αποκτήσει **ΑΚΡΙΒΩΣ** την ίδια συμπεριφορά λαβών + drag-feedback με το
περίγραμμα εμβαδού — **επαναχρησιμοποιώντας** τα ίδια SSoT, ΟΧΙ νέο μηχανισμό.

## Κρίσιμο εύρημα (SSoT audit, grep-verified)

Το μεγαλύτερο μέρος της μηχανικής είναι ήδη **entity-agnostic** — δωρεάν μόλις αρματωθεί το
`hatch-rotation` grip-kind:

| Μηχανισμός | Πύλη | Χρειάστηκε hatch; |
|-----------|------|------------------|
| 🔴 κόκκινο glyph (temperature) | `(entityId, gripIndex)` identity (`grip-temperature.ts`) | ΟΧΙ (δωρεάν) |
| ⊙ pivot-pick FSM | grip-kind (`HOT_GRIP_OP_REGISTRY`) | ΝΑΙ — 1 εγγραφή |
| τόξα φοράς (κόκκινο/πράσινο) | `dp.rotatePivot/anchorPos/rotateSweepDeg + isDirArcOn()` | ΟΧΙ (δωρεάν) |
| length/angle HUD toggle | μέσα στον shared painter (`isLengthAngleHudVisible()`) | ΟΧΙ (δωρεάν) |
| whole-entity **move** geometry | `calculateMovedGeometry` case 'hatch' | ήδη υπήρχε |
| whole-entity **rotate** geometry | `rotateEntity` case 'hatch' | ΝΑΙ — ήταν test-pinned no-op |

## Απόφαση — reuse, μηδέν διπλότυπο

### 1. Placement λαβών (θέση ΙΔΙΑ με το area)
- Εξαγωγή του **placement SSoT** `resolveMoveRotateHandleWorld(vertices, closed) → {move, rotation}`
  στο `systems/polyline/polyline-grips.ts` (rect-box parity / longest-segment ¼-points / degenerate).
  Το `getPolylineMoveRotateGrips` το χρησιμοποιεί — μηδέν αλλαγή συμπεριφοράς.
- Νέο `bim/hatch/hatch-move-rotate-grips.ts` → `getHatchMoveRotateGrips(entityId, outerRing, startIndex)`
  καλεί το **ΙΔΙΟ** placement SSoT στο `boundaryPaths[0]` (closed=true), ταγκάρει `hatch-move`/`hatch-rotation`.
  Έτσι «όλα ΙΔΙΑ με το περίγραμμα εμβαδού»· διαφέρει ΜΟΝΟ το grip-kind tagging (N.18 — το κοινό
  helper αποτρέπει τον structural δίδυμο).

### 2. Grip kinds + emission (render ≡ interaction)
- `hooks/grip-kinds.ts` → `HatchGripKind` += `'hatch-move' | 'hatch-rotation'`.
- `bim/hatch/hatch-grips.ts` → consts `HATCH_MOVE_KIND`/`HATCH_ROTATION_KIND` + `isHatchMoveKind`/`isHatchRotationKind`.
- Emission και στα δύο μονοπάτια, **appended LAST** (μετά τα gradient grips, ώστε οι υπάρχοντες
  indices να μένουν σταθεροί): `hooks/grip-computation-producers.ts` (`buildHatchGrips`, interaction)
  + `rendering/entities/HatchRenderer.ts` (`getGrips`, render). Ο running index περνά πλέον από
  το `pushHatchGradientGrips` (interaction) και ο renderer προχωράει το `gi` και όταν κρύβει active
  gradient grip → οι δύο πλευρές μένουν 1-προς-1.
- Glyph: `bim/grips/grip-glyph-registry.ts` += `'hatch-move':'move'`, `'hatch-rotation':'rotation'`.

### 3. Rotation geometry + commit + ghost
- `utils/rotation-math.ts` `ROTATE_HANDLERS` += `hatch` (rotate boundaryPaths + seedPoints + patternOrigin
  + advance patternAngle/gradient.angleDeg). Ξεκλειδώνει **ΚΑΙ** το toolbar Rotate tool. Coverage test
  ενημερώθηκε (hatch → golden set).
- `hooks/grips/wall-hot-grip-fsm.ts` `HOT_GRIP_OP_REGISTRY` += `'hatch-rotation':'rotate'` (αρματώνει
  κόκκινο glyph + pivot-pick + τόξα φοράς — δωρεάν downstream).
- `commitHatchGripDrag` (`grip-parametric-footprint-commits.ts`): επειδή το parametric dispatch
  δρομολογεί ΚΑΘΕ `on:'hatch'` grip εδώ πρώτα, χειρίζεται εσωτερικά:
  - `hatch-rotation` → shared `resolveRotation` + canonical `RotateEntityCommand` (pivot = hot-grip
    centre ή `hatchBoundsCenter`), mirror του `commitPolylineRotationGripDrag`.
  - `hatch-move` → shared **`commitWholeEntityMove`** (έγινε export· whole-entity translate + Ctrl-copy).
- Ghost: `rendering/ghost/apply-entity-preview.ts` (μέσα στο hatch branch) — `hatch-rotation` ⇒ shared
  `rotationGhost` (→ `rotateEntity` case 'hatch', preview ≡ commit)· `hatch-move` ⇒ `calculateMovedGeometry`.

### 4. Length/angle HUD + alignment traces (κοινό 2D↔3D SSoT)
- `systems/grip/grip-drag-alignment-role.ts`: `GripAlignmentEntityView` += `boundaryPaths`,
  `GripAlignmentRole` += `hatchGripKind`. `resolveGripAlignmentAnchors` += hatch branch (decode
  ring/vertex από το kind, reuse `getPolylineGripAlignmentAnchors` στο ring, closed=true). Νέο
  `resolveHatchHudSegments` (decode + reuse `getPolylineVertexIncidentSegments` ανά ring).
- Adapters: `grip-ghost-preview-overlay-helpers.ts` (2D traces) + `gripInfoToAlignmentRole` (3D) →
  `hatchGripKind`. `grip-ghost-preview-hud-helpers.ts` (2D HUD) → hatch branch που μετρά πάνω στο
  reshaped `transformed.boundaryPaths` ghost (WYSIWYG, `specLabel=''`).

## Συνέπειες

- **ΘΕΤΙΚΟ**: πλήρες parity hatch ↔ area μέσω των ΙΔΙΩΝ SSoT (placement, rotate, HUD, alignment, arcs).
  Το `rotateEntity` case 'hatch' ωφελεί ΚΑΙ το Rotate tool / Array (ήδη είχε boundaryPaths transform).
- **ΠΡΟΣΟΧΗ**: το `commitHatchGripDrag` είναι πλέον ο single entry για ΟΛΑ τα hatch grips (vertex/edge/
  gradient/move/rotation) — τα move/rotation ελέγχονται ΠΡΙΝ τη boundary-reshape διαδρομή.
- Indices: τα move/rotation handles μπαίνουν LAST → καμία μετατόπιση υπαρχόντων vertex/edge/gradient indices.

### 5. Reference-axis alignment κατά την περιστροφή (Giorgio 2026-07-10)

Όταν ορίζεις κέντρο περιστροφής σε hatch, η διακεκομμένη «οδηγός» (reference baseline) ξεκινά
ευθυγραμμισμένη με ευθύγραμμη ακμή του ορίου, μέσω νέου `hatchReferenceAnchor` στο ΚΟΙΝΟ SSoT
`bim/grips/rotate-reference-axis.ts` (sibling του `polylineReferenceAnchor`) — ΜΙΑ αλλαγή που
καλύπτει **και** τη live διακεκομμένη (`advanceHotGripPick` seed) **και** το commit (`commitFreeRotate`),
αφού και τα δύο διαβάζουν το `resolveRotateReferenceAnchor(entity, pivot)`. Προτεραιότητα:
(1) οποιαδήποτε **οριζόντια** ακμή → world +X (ταυτίζεται όταν το pivot κάθεται σε οριζόντια ακμή)·
(2) αλλιώς η ακμή που το pivot ακουμπά στο άκρο της → ταύτιση με αυτήν· (3) αλλιώς η ΜΕΓΑΛΥΤΕΡΗ ακμή
(polyline parity). Κατεύθυνση προς το σώμα μέσω του κοινού `anchorTowardBody`.

## Changelog

- **2026-07-10** — Δημιουργία. Feature 1-5 (grips/glyph/rotate-math/FSM/commit/ghost/HUD/alignment)
  IMPLEMENTED, UNCOMMITTED. Εκκρεμεί browser-verify Giorgio + commit (τον κάνει ο Giorgio).
- **2026-07-10** — §5 reference-axis alignment: η διακεκομμένη οδηγός περιστροφής του hatch
  ευθυγραμμίζεται με ευθύγραμμη ακμή (οριζόντια κατά προτίμηση) μέσω `hatchReferenceAnchor`
  (`rotate-reference-axis.ts`). +5 jest (rotate-reference-axis.test.ts, 33 GREEN)· jscpd καθαρό.
- **2026-07-10** — ✅ **BROWSER-VERIFIED από Giorgio** («τώρα λειτουργεί σωστά»): move/rotate λαβές +
  HUD + alignment + τόξα φοράς + reference-axis alignment. Εκκρεμεί μόνο commit (τον κάνει ο Giorgio).
