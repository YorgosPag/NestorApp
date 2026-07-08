/**
 * Structural-frame-element (beam / column / foundation) grip-kind discriminator
 * unions — extracted from `grip-kinds.ts` (SRP / Google file-size standard N.7.1).
 * Re-exported from `grip-kinds.ts` for backward compatibility, so existing
 * `import { ColumnGripKind } from '../grip-kinds'` call-sites keep working.
 */

/**
 * ADR-363 Phase 5.5a + 5.5b + 5.5c — Beam grip kind (parametric grip type).
 * Routes commit through `applyBeamGripDrag()` + `UpdateBeamParamsCommand`
 * instead of the standard `StretchEntityCommand` vertex path.
 *
 * Grips exposed by `BeamEntity` (`bim/beams/beam-grips.ts`):
 *   - `beam-start`    → translate axis start endpoint
 *   - `beam-end`      → translate axis end endpoint
 *   - `beam-midpoint` → translate whole beam (axis midpoint anchor, moves
 *                       startPoint + endPoint + curveControl όπου υπάρχει)
 *   - `beam-rotation` → rotate the whole beam (startPoint + endPoint +
 *                       curveControl) about a picked centre / the axis midpoint.
 *                       Curved ROTATION glyph + 6-click ROTATE→Reference hot-grip,
 *                       full wall parity (mirror `wall-rotation`). Anchor-relative
 *                       swept angle via the shared `rotateAxisPointsAboutPivot`
 *                       SSoT (NEVER raw cos/sin).
 *   - `beam-curve`    → move quadratic Bezier control point (curved kind only;
 *                       seeded από axis midpoint όταν undefined)
 *   - `beam-width`    → resize width perpendicular to axis (symmetric γύρω από
 *                       axis midpoint). Clamps στο `MIN_BEAM_WIDTH_MM`. Mirror
 *                       του `wall-thickness` pattern (Phase 1C).
 *   - `beam-depth`    → Phase 5.5c — out-of-plane (gravity axis) dimension
 *                       indicator. Handle stands στο axis midpoint κατά το
 *                       NEGATIVE perpendicular (αντίθετη πλευρά από το
 *                       width handle), με offset `width/2 + DEPTH_GRIP_OFFSET_MM`
 *                       ώστε να είναι ξεκάθαρα έξω από το footprint.
 *                       Dashed visual indicator + label "d=Xmm" στον renderer.
 *                       Symmetric drag projection × 2 → new depth, clamps
 *                       στο `MIN_BEAM_DEPTH_MM`. Δεν αλλάζει το footprint
 *                       (depth ζει στον z-axis), μόνο το `params.depth`.
 *                       ⚠️ ADR-363 (2026-06-11) — ΔΕΝ εκπέμπεται πλέον ως grip
 *                       (η ίσια δοκός απέκτησε τις 7 wall-parity λαβές μέσω του
 *                       κοινού `axis-box-grips` SSoT· το depth μένει στο Properties
 *                       / 3Δ, Revit plan behavior). Το transform παραμένει.
 *
 * ADR-363 (2026-06-11) — straight-beam 7-grip wall parity μέσω του κοινού
 * `axis-box-grips` SSoT (4 corners + width edge + length edge + rotation), ίδιος
 * κώδικας με τοίχο/πεδιλοδοκό. Local +X = axis (start→end), +Y = +perp:
 *   - `beam-corner-{start,end}-{pos,neg}` → 2-DOF corner (opposite corner fixed).
 *   - `beam-edge-length` → resize length along axis (END short edge, start fixed).
 *   - `beam-width` → reused ως το width-edge (perpendicular, opposite face fixed).
 *
 * Column-parity mid-edge completion (Giorgio 2026-06-20): the 2 OPPOSITE mid-edge
 * grips so all 4 faces carry a midpoint handle (mirror της κολόνας 4 μεσοπλευρικών):
 *   - `beam-width-far` → resize width on the −perp face (near face fixed).
 *   - `beam-edge-length-start` → resize length at the START short edge (end fixed).
 */
export type BeamGripKind =
  | 'beam-start'
  | 'beam-end'
  | 'beam-midpoint'
  | 'beam-rotation'
  | 'beam-curve'
  | 'beam-width'
  | 'beam-edge-length'
  | 'beam-width-far'
  | 'beam-edge-length-start'
  | 'beam-corner-start-pos'
  | 'beam-corner-start-neg'
  | 'beam-corner-end-pos'
  | 'beam-corner-end-neg'
  | 'beam-depth';

/**
 * ADR-363 Phase 4.5 + 4.5b + Phase 8C — Column grip kind (parametric grip type).
 * Routes commit through `applyColumnGripDrag()` + `UpdateColumnParamsCommand`
 * instead of the standard `StretchEntityCommand` vertex path.
 *
 * Base grips exposed by `ColumnEntity` (`bim/columns/column-grips.ts`):
 *   - `column-center`   → translate `position` (anchor stays)
 *   - `column-rotation` → rotate γύρω από `position` (non-circular only)
 *   - `column-width`    → resize width on the far edge from anchor (= diameter
 *                          για `circular` + `polygon` kinds)
 *   - `column-depth`    → resize depth on the far edge from anchor (skipped
 *                          για `circular` + `polygon` kinds — depth meaningless)
 *
 * Variant-specific grips (Phase 4.5b — L-shape / T-shape):
 *   - `column-arm-length`    → L-shape only (`params.lshape.armLength`,
 *                               Y-axis δευτερεύοντος βραχίονα). Asymmetric
 *                               edge handle στο inner-corner edge κατά τοπικό
 *                               +Y. Drag projection × 1.
 *   - `column-arm-width`     → L-shape only (`params.lshape.armWidth`,
 *                               πάχος δευτερεύοντος βραχίονα). Asymmetric
 *                               edge handle στο inner-corner edge κατά τοπικό
 *                               +X. Drag projection × 1.
 *   - `column-flange-length` → T-shape only (`params.tshape.flangeLength`,
 *                               X-axis πέλματος). Symmetric — handle στη
 *                               δεξιά πλευρά πέλματος. Drag projection × 2
 *                               (mirror του column-width symmetric pattern).
 *   - `column-web-thickness` → T-shape only (`params.tshape.webThickness`,
 *                               πάχος κορμού κατά X). Symmetric — handle
 *                               στη δεξιά πλευρά κορμού. Drag projection × 2.
 *
 * Variant-specific grips (Phase 8C — I-shape):
 *   - `column-i-flange-thickness` → I-shape only (`params.ishape.flangeThickness`,
 *                                    πάχος πέλματος tf). Asymmetric edge handle
 *                                    στο top-flange bottom-edge midpoint κατά
 *                                    τοπικό +Y. Drag projection × 1 (bottom
 *                                    flange mirrors automatically μέσω geometry).
 *   - `column-i-web-thickness`    → I-shape only (`params.ishape.webThickness`,
 *                                    πάχος κορμού tw). Symmetric — handle στη
 *                                    αριστερή πλευρά κορμού. Drag projection
 *                                    × 2 (web centered around vertical axis).
 *
 * Όλες οι νέες διαστάσεις clamp στο `MIN_COLUMN_DIMENSION_MM` (250 mm) — εκτός
 * των I-shape plate thicknesses που clamp στο `MIN_I_PLATE_THICKNESS_MM` (5 mm).
 * Όταν `params.lshape` / `params.tshape` / `params.ishape` undefined, ο handler
 * materializes defaults από `width/3 + depth/3` (L) ή `width + depth/3` (T) ή
 * `DEFAULT_I_FLANGE_THICKNESS_MM` / `DEFAULT_I_WEB_THICKNESS_MM` (I) — mirror
 * των `computeColumnGeometry` defaults — ώστε το επόμενο drag να ξεκινά από τα
 * ήδη υπολογισμένα values. Circular + shear-wall kinds δεν εκπέμπουν
 * variant-specific grips (shear-wall = rect parity).
 */
export type ColumnGripKind =
  | 'column-center'
  | 'column-rotation'
  | 'column-width'
  | 'column-depth'
  // ADR-363 Slice C — rectangular / shear-wall 2-DOF corners (opposite corner fixed),
  // shared `rect-grip-engine` SSoT (wall/foundation parity). Other kinds skip these.
  | 'column-corner-ne'
  | 'column-corner-nw'
  | 'column-corner-sw'
  | 'column-corner-se'
  // ADR-363 — rectangular / shear-wall edge-midpoint grips on the WEST + SOUTH
  // faces (Giorgio 2026-06-15: «λαβές και στις άλλες δύο πλευρές»). The EAST/NORTH
  // edges keep their `column-width` / `column-depth` kinds; these two add the
  // remaining faces so all 4 sides resize via the shared `rect-grip-engine`.
  | 'column-edge-w'
  | 'column-edge-s'
  | 'column-arm-length'
  | 'column-arm-width'
  | 'column-flange-length'
  | 'column-web-thickness'
  | 'column-i-flange-thickness'
  | 'column-i-web-thickness'
  // ADR-363 Phase 2b — manual parametric Π (U-shape χωρίς polygon) variant grips.
  | 'column-leg-thickness'
  | 'column-base-thickness'
  // ADR-363 Phase 2b — polygon-backed U-shape/composite per-vertex grips. The
  // vertex index is encoded in the kind string (mirror του `slab-vertex-${n}`
  // pattern) ώστε το dispatch να μη χρειάζεται ξεχωριστό index πεδίο.
  | `column-poly-vertex-${number}`
  // ADR-363/449 — free per-EDGE grip (μέσο πλευράς): σύρσιμο μετακινεί ΟΛΗ την
  // πλευρά (μετατοπίζει και τις 2 κορυφές της ακμής). Index = ακμή i (κορυφές i, i+1).
  | `column-poly-edge-${number}`;

/**
 * ADR-436 Slice 1b — Foundation (pad) grip kind (parametric grip type). Routes
 * commit through `applyFoundationGripDrag()` + `UpdateFoundationParamsCommand`
 * (mirror of `ColumnGripKind`). pad = **width × length** (ΟΧΙ width × depth).
 *
 * Grips exposed by `FoundationEntity` (`bim/foundations/foundation-grips.ts`):
 *   - `foundation-center`   → translate `position` (NOT emitted — Alt+drag MOVE
 *                              glyph, declutter mirror column Φ1G.5 Slice 2).
 *   - `foundation-rotation` → rotate γύρω από `position` (anchor invariant).
 *   - `foundation-width`    → resize `width` edge midpoint (opposite edge fixed, local X).
 *   - `foundation-length`   → resize `length` edge midpoint (opposite edge fixed, local Y).
 *   - `foundation-corner-{ne,nw,sw,se}` → 2-DOF corner resize (opposite corner fixed),
 *     shared `rect-grip-engine` SSoT (wall/column parity, ADR-436 Slice 1c).
 *
 * Νέες διαστάσεις clamp στο `MIN_FOUNDATION_DIMENSION_MM`.
 *
 * ADR-436 Slice 2 — line-based kinds (strip / tie-beam) grips (mirror `BeamGripKind`):
 *   - `foundation-start`    → translate axis start endpoint.
 *   - `foundation-end`      → translate axis end endpoint.
 *   - `foundation-line-width` → resize band `width` perpendicular to axis (reused ως
 *                              το width-edge του κοινού `axis-box-grips` SSoT).
 *
 * ADR-363/436 (2026-06-11) — strip / tie-beam 7-grip wall parity μέσω του κοινού
 * `axis-box-grips` SSoT (ίδιος κώδικας με τοίχο/δοκό). Local +X = axis (start→end),
 * +Y = +perp· `foundation-rotation` reused για την περιστροφή του line πεδίλου:
 *   - `foundation-corner-{start,end}-{pos,neg}` → 2-DOF corner (opposite corner fixed).
 *   - `foundation-line-length` → resize length along axis (END short edge, start fixed).
 */
export type FoundationGripKind =
  | 'foundation-center'
  | 'foundation-rotation'
  | 'foundation-width'
  | 'foundation-length'
  // ADR-517 — pad ↔ rect-column grip parity: the WEST + SOUTH edge-midpoints
  // (the «other two» faces), so all 4 mid-side grips are emitted (mirror
  // `column-edge-w` / `column-edge-s`).
  | 'foundation-edge-w'
  | 'foundation-edge-s'
  | 'foundation-corner-ne'
  | 'foundation-corner-nw'
  | 'foundation-corner-sw'
  | 'foundation-corner-se'
  | 'foundation-start'
  | 'foundation-end'
  | 'foundation-line-width'
  | 'foundation-line-length'
  | 'foundation-corner-start-pos'
  | 'foundation-corner-start-neg'
  | 'foundation-corner-end-pos'
  | 'foundation-corner-end-neg';
