/**
 * ADR-363 Phase 4 — Pure builders για column entity creation.
 *
 * SSoT:
 *   - IDs via `generateColumnId()` (N.6 enterprise-id).
 *   - Geometry via `computeColumnGeometry()` — pure function.
 *   - Validation via `validateColumnParams()` — hardErrors block creation.
 *   - Types via `bim/types/column-types.ts`.
 *
 * Single-click flow:
 *   - User picks Column tool → kind preselected (default 'rectangular').
 *   - Click on canvas → `buildDefaultColumnParams(clickPoint, kind, overrides)`
 *     resolves position + width + depth + height + anchor (defaults +
 *     ribbon overrides).
 *   - `buildColumnEntity()` validates + builds entity.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D } from '../../bim/types/bim-base';
import {
  DEFAULT_COLUMN_DEPTH_MM,
  DEFAULT_COLUMN_HEIGHT_MM,
  DEFAULT_COLUMN_ROTATION_DEG,
  DEFAULT_COLUMN_WIDTH_MM,
  DEFAULT_I_FLANGE_WIDTH_MM,
  DEFAULT_I_SECTION_DEPTH_MM,
  DEFAULT_SHEAR_WALL_LENGTH_MM,
  DEFAULT_SHEAR_WALL_THICKNESS_MM,
  type ColumnAnchor,
  type ColumnCompositeParams,
  type ColumnEntity,
  type ColumnIShapeParams,
  type ColumnKind,
  type ColumnLshapeParams,
  type ColumnParams,
  type ColumnPolygonParams,
  type ColumnTilt,
  type ColumnTshapeParams,
  type ColumnUshapeParams,
} from '../../bim/types/column-types';
import { computeColumnGeometry } from '../../bim/geometry/column-geometry';
import { buildColumnHeadReferences, type HeadReferenceLines } from '../../bim/columns/column-reference-lines';
import { validateColumnParams } from '../../bim/validators/column-validator';
import {
  DEFAULT_COLUMN_BASE_BINDING,
  DEFAULT_COLUMN_TOP_BINDING,
} from '../../bim/types/bim-binding';
import { createColumn } from '@/services/factories/column.factory';
import type { SceneUnits } from '../../utils/scene-units';
import type { GuideBinding } from '../../bim/hosting/guide-binding-types';
import type { AxisGuideReader } from '../../bim/foundations/foundation-from-grid';
import { resolveAxisBindings } from '../../bim/hosting/resolve-axis-bindings';
import { resolveStoreyHeightMm } from '../../systems/levels/storey-creation-defaults';
import { createDefaultStructuralFinishSpec, type StructuralFinishSpec } from '../../bim/finishes/structural-finish-types';

export type { SceneUnits };

// ─── Param overrides accepted by the builder ─────────────────────────────────

/**
 * Field overrides για `buildDefaultColumnParams`. Ribbon (contextual column
 * tab) supplies kind / anchor / width / depth / height / rotation /
 * material. Variant geometry overrides (`lshape`, `tshape`, `polygon`,
 * `ishape`) propagated.
 */
export interface ColumnParamOverrides {
  readonly kind?: ColumnKind;
  readonly anchor?: ColumnAnchor;
  /** mm. Width / διάμετρος αν circular / circumscribed Ø αν polygon. */
  readonly width?: number;
  /** mm. Αγνοείται αν circular ή polygon. */
  readonly depth?: number;
  /** mm. */
  readonly height?: number;
  /**
   * mm. Στάθμη βάσης σχετικά με το `baseBinding` (default 0 = storey-floor). ADR-441
   * GEN-COL: αρνητικό → η βάση κατεβαίνει στη θεμελίωση (στατική συνέχεια κολώνας).
   */
  readonly baseOffset?: number;
  /** Μοίρες CCW. Αγνοείται αν circular. */
  readonly rotation?: number;
  readonly material?: string;
  readonly lshape?: ColumnLshapeParams;
  readonly tshape?: ColumnTshapeParams;
  /** ADR-363 Phase 8 — regular N-gon sides override. */
  readonly polygon?: ColumnPolygonParams;
  /** ADR-363 Phase 8 — I-shape flange/web thickness override. */
  readonly ishape?: ColumnIShapeParams;
  /**
   * ADR-363 Phase 2/3 «από περίγραμμα» — U-shape (Π) override. Polygon-backed
   * όταν δοθεί `polygon` (LOCAL mm, bbox-centered) → ακριβές SSoT διατομής.
   */
  readonly ushape?: ColumnUshapeParams;
  /**
   * ADR-363 Phase 2/3 «από περίγραμμα» — composite (αυθαίρετη σύνθετη διατομή)
   * override. ΠΑΝΤΑ polygon-backed (LOCAL mm, bbox-centered, CCW).
   */
  readonly composite?: ColumnCompositeParams;
  /** ADR-363 Phase 8E — catalog profile ID persisted with the column. */
  readonly catalogProfile?: string;
  /**
   * ADR-404 Phase 5 — 3Δ κλίση (raking column). Από 2-κλικ placement (βάση→κορυφή,
   * `resolveTopLeanTilt`) ή αριθμητικά πεδία ribbon. Absent / `angle===0` = κατακόρυφη.
   */
  readonly tilt?: ColumnTilt;
  /**
   * ADR-449 — override του σοβά (finish skin). Absent → default σοβάς (enabled, κανονικές κολόνες).
   */
  readonly finish?: StructuralFinishSpec;
  /**
   * ADR-499 — AUTO διαστασιολόγηση on/off. Absent → AUTO (ο auto-sizer μπορεί να αλλάξει `width`/`depth`).
   * `false` = locked (ρητή διάσταση χρήστη → user wins). **ADR-398 §3.17:** η υιοθέτηση σχεδιασμένου
   * ορθογωνίου DXF το θέτει `false` ώστε η διατομή να μένει ΑΚΡΙΒΩΣ όση σχεδιάστηκε (ο auto-sizer δεν
   * την «φουσκώνει» στο ελάχιστο επαρκές λόγω λυγηρότητας/οπλισμού).
   */
  readonly autoSized?: boolean;
}

/**
 * Kind-specific defaults για width/depth. Shear walls + I-shapes start με
 * realistic structural defaults (2m×20cm wall / IPE-300 b×h) αντί για
 * τα generic 400×400 RC column defaults.
 */
export function getKindDimensionDefaults(kind: ColumnKind): { width: number; depth: number } {
  switch (kind) {
    case 'shear-wall':
      return { width: DEFAULT_SHEAR_WALL_LENGTH_MM, depth: DEFAULT_SHEAR_WALL_THICKNESS_MM };
    case 'I-shape':
      return { width: DEFAULT_I_FLANGE_WIDTH_MM, depth: DEFAULT_I_SECTION_DEPTH_MM };
    default:
      return { width: DEFAULT_COLUMN_WIDTH_MM, depth: DEFAULT_COLUMN_DEPTH_MM };
  }
}

/**
 * ADR-523 — οι reference lines της κεφαλής του ενεργού column ghost από `kind` + `overrides`,
 * με τα ΙΔΙΑ width/depth defaults που θα έβγαζε το commit (`getKindDimensionDefaults` SSoT). Καλείται
 * ταυτόσημα από preview ΚΑΙ commit ώστε ο multi-reference snap να είναι preview ≡ commit by construction.
 * `null` για kind χωρίς reference lines (ο tier αδρανής). Pure (delegate στο `buildColumnHeadReferences`).
 */
export function resolveColumnHeadReferences(
  kind: ColumnKind,
  overrides: ColumnParamOverrides,
  sceneUnits: SceneUnits,
): HeadReferenceLines | null {
  const dims = getKindDimensionDefaults(kind);
  return buildColumnHeadReferences(
    kind,
    overrides.width ?? dims.width,
    overrides.depth ?? dims.depth,
    overrides.tshape,
    overrides.lshape,
    sceneUnits,
  );
}

// ─── Defaults factory ────────────────────────────────────────────────────────

/**
 * Build `ColumnParams` από clicked point + optional overrides.
 *
 * Algorithm:
 *   1. Resolve kind (override → 'rectangular' default).
 *   2. Resolve anchor (override → 'center' default).
 *   3. Resolve width / depth / height / rotation (override → defaults).
 *   4. Lift 2D click point σε Point3D (z=0).
 */
export function buildDefaultColumnParams(
  clickPoint: Readonly<Point2D>,
  kindArg?: ColumnKind,
  overrides: ColumnParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): ColumnParams {
  const kind = overrides.kind ?? kindArg ?? 'rectangular';
  const dims = getKindDimensionDefaults(kind);
  const anchor: ColumnAnchor = overrides.anchor ?? 'center';
  const width = overrides.width ?? dims.width;
  const depth = overrides.depth ?? dims.depth;
  // ADR-448 Phase 2 — storey-aware default: override → active storey height → legacy const.
  const height = resolveStoreyHeightMm(overrides.height, DEFAULT_COLUMN_HEIGHT_MM);
  const rotation = overrides.rotation ?? DEFAULT_COLUMN_ROTATION_DEG;

  const position: Point3D = { x: clickPoint.x, y: clickPoint.y, z: 0 };

  const params: ColumnParams = {
    kind,
    position,
    anchor,
    width,
    depth,
    height,
    rotation,
    sceneUnits,
    baseBinding: DEFAULT_COLUMN_BASE_BINDING,
    topBinding: DEFAULT_COLUMN_TOP_BINDING,
    baseOffset: overrides.baseOffset ?? 0,
    topOffset: 0,
    // ADR-449 Slice 5 — κάθε νέα κολόνα γεννιέται με σοβά (enabled). Η ορατότητα
    // ελέγχεται view-level από το master toggle «Σοβατισμένη όψη» (showFinishSkin).
    finish: overrides.finish ?? createDefaultStructuralFinishSpec(),
    ...(overrides.material !== undefined ? { material: overrides.material } : {}),
    ...(overrides.lshape !== undefined ? { lshape: overrides.lshape } : {}),
    ...(overrides.tshape !== undefined ? { tshape: overrides.tshape } : {}),
    ...(overrides.polygon !== undefined ? { polygon: overrides.polygon } : {}),
    ...(overrides.ishape !== undefined ? { ishape: overrides.ishape } : {}),
    ...(overrides.ushape !== undefined ? { ushape: overrides.ushape } : {}),
    ...(overrides.composite !== undefined ? { composite: overrides.composite } : {}),
    ...(overrides.catalogProfile !== undefined ? { catalogProfile: overrides.catalogProfile } : {}),
    ...(overrides.tilt !== undefined ? { tilt: overrides.tilt } : {}),
    ...(overrides.autoSized !== undefined ? { autoSized: overrides.autoSized } : {}),
  };
  return params;
}

// ─── Entity builder ──────────────────────────────────────────────────────────

export type BuildColumnEntityResult =
  | { readonly ok: true; readonly entity: ColumnEntity }
  | { readonly ok: false; readonly hardErrors: readonly string[] };

/**
 * Build a `ColumnEntity` από `ColumnParams`. Geometry computed via SSoT
 * `computeColumnGeometry()`. Hard errors short-circuit creation.
 */
export function buildColumnEntity(
  params: Readonly<ColumnParams>,
  layerId: string,
  sceneUnits: SceneUnits = 'mm',
): BuildColumnEntityResult {
  const validation = validateColumnParams(params);
  if (validation.hardErrors.length > 0) {
    return { ok: false, hardErrors: validation.hardErrors };
  }
  const geometry = computeColumnGeometry(params);
  const entity: ColumnEntity = createColumn({
    params,
    geometry,
    layerId,
    visible: true,
    validation: validation.bimValidation,
  });
  return { ok: true, entity };
}

// ─── ADR-441 Slice COL — host-on-snap grid bindings ──────────────────────────

/**
 * Resolve τα grid bindings μιας κολώνας (Revit «Column → At Grids»): αν το `position`
 * πέφτει πάνω σε άξονα/τομή κανάβου → center-x/center-y bindings ώστε η κολώνα να
 * ακολουθεί όταν μετακινηθεί ο άξονας. Pure (ο `reader` injected) → unit-testable.
 * Άδειο array = ελεύθερη κολώνα (καμία αλλαγή vs σήμερα).
 */
export function resolveColumnGridBindings(
  position: Readonly<Point2D>,
  reader: AxisGuideReader,
  tol: number,
): GuideBinding[] {
  return resolveAxisBindings(
    [
      { axis: 'X', value: position.x, slot: 'center-x' },
      { axis: 'Y', value: position.y, slot: 'center-y' },
    ],
    reader,
    tol,
  );
}

// ─── Single-click completion helper ─────────────────────────────────────────

/**
 * High-level helper που bridges το column-tool FSM (Phase 4: single-click)
 * και το builder pipeline. Pure — no side effects.
 */
export function completeColumnFromClick(
  clickPoint: Readonly<Point2D>,
  layerId: string,
  kind?: ColumnKind,
  overrides: ColumnParamOverrides = {},
  sceneUnits: SceneUnits = 'mm',
): BuildColumnEntityResult {
  const params = buildDefaultColumnParams(clickPoint, kind, overrides, sceneUnits);
  return buildColumnEntity(params, layerId, sceneUnits);
}
