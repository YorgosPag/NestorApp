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
 * ADR-583 — Annotation symbol grip kind (lightweight non-BIM point-glyph — north
 * arrow / section-mark / grid-bubble / elevation-mark / detail-callout /
 * revision-tag — NOT a BIM params entity). Mirror of `arc-*`: the glyph has an
 * intrinsic orientation so it gets a move cross AND a rotation handle; ADR-583 Φ3
 * («αύξηση λαβών», Giorgio 2026-07-09) ADDS 4 UNIFORM-scale corner resize handles:
 *   - `annotation-symbol-move`      → κεντρικό grip, 4-arrow MOVE glyph + directional
 *                                     prompt + whole-entity translate (`movesEntity` →
 *                                     `calculateMovedGeometry` case 'annotation-symbol').
 *   - `annotation-symbol-rotation`  → λαβή περιστροφής· commit μέσω της canonical
 *                                     `RotateEntityCommand` (pivot = θέση) → `rotateEntity`
 *                                     case 'annotation-symbol'. Ίδιο shared hot-grip flow
 *                                     με `arc-rotation` / `text-rotation`.
 *   - `annotation-symbol-corner-*`  → 4 γωνιακές λαβές (ne/nw/sw/se) UNIFORM scale του
 *                                     annotative `sizeMm` γύρω από το σημείο εισαγωγής
 *                                     (Revit/Figma annotative standard· κρατά αναλογία —
 *                                     fixed-aspect glyph). `type:'vertex'` → πάντα ορατές
 *                                     (single ΚΑΙ multi-select — λύνει το multi-select
 *                                     highlight bug). Render default 'square' glyph (absent
 *                                     from `grip-glyph-registry`). Commit/ghost μέσω του
 *                                     shared `applyAnnotationSymbolGripDrag` SCALE-FREE ratio.
 */
export type AnnotationSymbolGripKind =
  | 'annotation-symbol-move'
  | 'annotation-symbol-rotation'
  | 'annotation-symbol-corner-ne'
  | 'annotation-symbol-corner-nw'
  | 'annotation-symbol-corner-sw'
  | 'annotation-symbol-corner-se';

/**
 * ADR-583 Φ2.4 — Graphic scale-bar grip kind (dedicated non-BIM annotation, NOT a BIM
 * params entity). The bar has an intrinsic orientation AND a real-world span, so it gets
 * FIVE grips (mirror `arc-*` + dedicated span/height handles — Giorgio 2026-07-09 «έξυπνες
 * λαβές: 2 άκρα→μήκος, 1 πάνω→ύψος», Φ2 του «αύξηση λαβών»):
 *   - `scale-bar-move`         → κεντρικό grip στο μέσο του άξονα· 4-arrow MOVE glyph +
 *                                whole-entity translate (`movesEntity` → `calculateMovedGeometry`
 *                                case 'scale-bar' → μεταφορά του `position`).
 *   - `scale-bar-rotation`     → λαβή περιστροφής (κάθετο offset κάτω από το '0' tick)· γράφει
 *                                ΜΟΝΟ το `angleRad` (swept angle SSoT, `applyScaleBarGripDrag`).
 *   - `scale-bar-length`       → λαβή στο ΔΕΞΙ άκρο (παράγωγο `endPosition`)· το drag κρατά το
 *                                '0' tick σταθερό, ξαναϋπολογίζει `angleRad` + snapped `length`
 *                                (`deriveScaleBarAxis`, live 1-2-5)· το `endPosition` DERIVED.
 *   - `scale-bar-length-start` → λαβή στο ΑΡΙΣΤΕΡΟ άκρο (το '0' tick `position`)· το drag κρατά
 *                                το ΔΕΞΙ άκρο σταθερό, μετακινεί το `position` + ξαναϋπολογίζει
 *                                `angleRad`/`length` (ίδιο `deriveScaleBarAxis` SSoT, αντίστροφη
 *                                φορά). Τα δύο άκρα = συμμετρικά length handles.
 *   - `scale-bar-height`       → λαβή στο μέσο της ΠΑΝΩ ακμής· το drag αλλάζει ΜΟΝΟ το annotative
 *                                `barHeightMm` μέσω SCALE-FREE λόγου (newPerp/oldPerp ακυρώνει τον
 *                                drawingScale factor → κανένα store read στο drag). Type `'vertex'`
 *                                (STRUCTURAL) ώστε να επιβιώνει multi-select + grip-type toggles.
 * Και τα πέντε δρομολογούνται στο `commitScaleBarGripDrag` (PARAMETRIC_COMMIT_HANDLERS,
 * key `gripKind.on === 'scale-bar'`) που ξαναχτίζει μέσω `applyScaleBarGripDrag`.
 */
export type ScaleBarGripKind =
  | 'scale-bar-move'
  | 'scale-bar-rotation'
  | 'scale-bar-length'
  | 'scale-bar-length-start'
  | 'scale-bar-height';

/**
 * ADR-612 — Opening Info Tag grip kind (dedicated non-BIM annotation, SIBLING of
 * `scale-bar`, NOT a BIM params entity). The 120×80 (3:2-locked) box has an intrinsic
 * orientation AND a single sizing DOF, so it gets THREE grips (mirror `scale-bar-*`):
 *   - `opening-info-tag-move`     → κεντρικό grip στο CENTRE του κουτιού· 4-arrow MOVE glyph +
 *                                   whole-entity translate (`movesEntity` → μεταφορά του `position`).
 *   - `opening-info-tag-rotation` → λαβή περιστροφής (κάθετο offset πάνω από την ΠΑΝΩ ακμή)· γράφει
 *                                   ΜΟΝΟ το `angleRad` (swept-angle SSoT, `applyOpeningInfoTagGripDrag`).
 *   - `opening-info-tag-size`     → λαβή στην ΠΑΝΩ-ΔΕΞΙΑ γωνία· το drag ξαναϋπολογίζει το `widthMm`
 *                                   από το τοπικό `u` της γωνίας (κλειδωμένη αναλογία 3:2 → το ύψος
 *                                   παράγεται)· render default 'square' glyph.
 * Και τα τρία δρομολογούνται στο `commitOpeningInfoTagGripDrag` (PARAMETRIC_COMMIT_HANDLERS,
 * key `gripKind.on === 'opening-info-tag'`) που ξαναχτίζει μέσω `applyOpeningInfoTagGripDrag`.
 */
export type OpeningInfoTagGripKind =
  | 'opening-info-tag-move'
  | 'opening-info-tag-rotation'
  | 'opening-info-tag-size';

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
