/**
 * Plain-DXF-primitive grip-kind discriminator unions — extracted from
 * `grip-kinds.ts` (SRP / Google file-size standard N.7.1). These tag the
 * parametric handles emitted by `computeDxfEntityGrips` for the plain geometric
 * primitives (polyline / circle / arc / line) — none of which is a BIM params
 * entity. Re-exported from `grip-kinds.ts` for backward compatibility, so
 * existing `import { LineGripKind } from '../grip-kinds'` call-sites keep working.
 */

/**
 * ADR-510 Φ3c — Polyline multifunctional grip kind (plain DXF polyline, NOT a
 * BIM params entity). Tags each grip emitted by `computeDxfEntityGrips` (case
 * 'polyline') so the context menu (`buildPolylineOpsSection`) and the commit
 * pipeline (`commitPolylineBulgeGripDrag`) can branch by grip role:
 *   - `polyline-vertex-N`           → outline vertex N. Menu: Add / Remove /
 *                                     Convert-to-Arc (outgoing segment N).
 *   - `polyline-segment-midpoint-N` → midpoint of STRAIGHT segment N (chord
 *                                     midpoint). Menu: Add / Convert-to-Arc.
 *   - `polyline-arc-midpoint-N`     → apex of ARC segment N (`bulgeApexPoint`).
 *                                     Menu: Convert-to-Line. Drag = live bulge
 *                                     curvature (`bulgeFromApexPoint`).
 * Segment index N = AutoCAD outgoing-segment semantics (`bulges[N]` spans
 * `vertices[N] → vertices[N+1]`, closed: `bulges[n-1]` spans n-1 → 0).
 */
export type PolylineGripKind =
  | `polyline-vertex-${number}`
  | `polyline-segment-midpoint-${number}`
  | `polyline-arc-midpoint-${number}`
  // ADR-561 — whole-polyline handles (parity με τον τοίχο / line): σταυρός
  // μετακίνησης (4-arrow glyph + per-arm directional prompt + whole-entity
  // translate) και σημάδι περιστροφής (curved glyph + RotateEntityCommand).
  // Για ΟΡΘΟΓΩΝΙΟ (polyline 4 κορυφών, closed, ορθές γωνίες) τα δύο handles
  // τοποθετούνται με rect-box parity (oriented) — βλ. `polyline-grips.ts`.
  | 'polyline-move'
  | 'polyline-rotation';

/**
 * ADR-561 — Circle grip kind (plain DXF `circle` primitive, NOT a BIM params
 * entity). Ο κύκλος είναι γεωμετρικά συμμετρικός → ΜΟΝΟ σταυρός μετακίνησης
 * (parity με την κυκλική κολόνα ADR-519 που ΔΕΝ έχει λαβή περιστροφής). Το
 * κεντρικό grip παίρνει το 4-arrow MOVE glyph + per-arm directional move-by-value
 * + whole-entity translate — ίδιο pipeline με `wall-midpoint` / `line-move`.
 * Τα 4 quadrant grips (resize ακτίνας) μένουν untagged (default 'square').
 */
export type CircleGripKind = 'circle-move';

/**
 * ADR-561 — Arc grip kind (plain DXF `arc` primitive). Το τόξο έχει εγγενή
 * προσανατολισμό (start/end angle) → ΚΑΙ σταυρός ΚΑΙ περιστροφή:
 *   - `arc-move`     → κεντρικό grip, 4-arrow MOVE glyph + directional prompt +
 *                      whole-entity translate.
 *   - `arc-rotation` → λαβή περιστροφής (midway κάτω από το κέντρο, μέσω
 *                      `rotationHandleMidwayOffset`)· commit μέσω της canonical
 *                      `RotateEntityCommand` (pivot = κέντρο), όπως `line-rotation`.
 * start/end/mid grips μένουν untagged (standard reshape).
 */
export type ArcGripKind = 'arc-move' | 'arc-rotation';

/**
 * ADR-363 Slice F/G.5 — Line grip kinds (plain DXF `line` primitive, NOT a BIM
 * params entity). Tag the parametric handles emitted by `computeDxfEntityGrips`
 * (case 'line') so they opt into the SHARED hot-grip flows (glyph + directional /
 * rotate) — full parity with `wall-rotation` / `wall-midpoint`. The line's endpoint
 * (0/1) + plain midpoint-MOVE (2) grips stay untagged (standard stretch / whole-move
 * path); only the rotation + ¼-west move handles carry a kind.
 *
 *   - `line-rotation` (Slice F) → rotate the whole line about its midpoint (or a
 *     picked centre). Commit routes through `commitLineGripDrag()` + the canonical
 *     `RotateEntityCommand` (NOT a bespoke transform); preview rotates start/end
 *     via the shared `rotateAxisPointsAboutPivot` SSoT (mirror `rotateWall`).
 *   - `line-move` (Slice G.5) → the 4-arrow MOVE cross at ¼ axis length WEST of the
 *     centre (mirror of the ¼-east rotation handle). Reuses the ENTIRE wall move
 *     pipeline: `'move'` glyph (registry) + 3-click hot-grip move + per-arm
 *     directional click→distance prompt (ADR-397 Φ2) + whole-entity translate
 *     (`movesEntity`). NO new mechanism — only the kind + ¼-west position are added.
 */
export type LineGripKind = 'line-rotation' | 'line-move';

/**
 * ADR-583 — Annotation symbol grip kind (lightweight non-BIM North arrow, NOT a
 * BIM params entity). Mirror of `arc-*`: the glyph has an intrinsic orientation
 * so it gets BOTH a move cross AND a rotation handle, but NO resize (fixed aspect,
 * D5 — μέγεθος αλλάζει από το contextual tab):
 *   - `annotation-symbol-move`     → κεντρικό grip, 4-arrow MOVE glyph + directional
 *                                    prompt + whole-entity translate (`movesEntity` →
 *                                    `calculateMovedGeometry` case 'annotation-symbol').
 *   - `annotation-symbol-rotation` → λαβή περιστροφής· commit μέσω της canonical
 *                                    `RotateEntityCommand` (pivot = θέση) → `rotateEntity`
 *                                    case 'annotation-symbol'. Ίδιο shared hot-grip flow
 *                                    με `arc-rotation` / `text-rotation`.
 */
export type AnnotationSymbolGripKind = 'annotation-symbol-move' | 'annotation-symbol-rotation';

/**
 * ADR-575 §8 — GROUP gizmo grip kind (composite `type:'group'` container, ΟΧΙ
 * BIM params entity). Το επιλεγμένο group εμφανίζει ΕΝΑ κοινό βελάκι στο κέντρο του
 * bounding box (Revit / Cinema 4D gizmo), αντί per-member λαβές:
 *   - `group-move`     → κεντρικός σταυρός μετακίνησης (4-arrow MOVE glyph + hot-grip
 *                        move + whole-group translate μέσω `calculateMovedGeometry`
 *                        case 'group' → recurse στα members).
 *   - `group-rotation` → λαβή περιστροφής (midway κάτω από το κέντρο, μέσω
 *                        `rotationHandleMidwayOffset`)· commit μέσω της canonical
 *                        `RotateEntityCommand` (pivot = κέντρο bbox) → `rotateEntity`
 *                        case 'group' → recurse. Ίδιο shared hot-grip flow με
 *                        `line-rotation` / `arc-rotation` / `text-rotation`.
 * ΜΗΔΕΝ νέα glyph math / rotation engine / group transform — όλα REUSE.
 */
export type GroupGripKind = 'group-move' | 'group-rotation';
