/**
 * ADR-363 Phase 4.5c.1 — Anchor ghost preview footprints (pure).
 *
 * Industry convention (Revit Column / ArchiCAD CO): όσο ο user σύρει το cursor
 * με ενεργό το column tool σε `awaitingPosition`, εμφανίζονται **9 ghost
 * footprints** (ένα ανά `ColumnAnchor`) στο cursor world position. Το active
 * anchor (`state.anchor`) highlightάρεται με kind-coloured outline + fill, τα
 * υπόλοιπα 8 σχεδιάζονται ως ημιδιαφανή outlines. Tab/Shift+Tab cycling →
 * αλλάζει μόνο το `isActive` flag — οι 9 footprints δεν επανυπολογίζονται
 * (το `position` παραμένει στον cursor).
 *
 * Για `kind === 'circular'`: anchor cycling N/A (πάντα 'center') — επιστρέφει
 * 1 entry μόνο.
 *
 * SSoT:
 *   - Geometry via `computeColumnGeometry()` (footprint pipeline).
 *   - Params via `buildDefaultColumnParams()` με `anchor` override per ghost.
 *   - Validation BYPASSED στο ghost path — το preview πρέπει να εμφανίζεται
 *     ακόμα κι αν τα defaults δεν περνούν `validateColumnParams` (e.g. width
 *     overridden σε <250mm). Τη validation την κάνει το commit.
 *
 * Pure module: zero React / DOM / Firestore / canvas deps. Mirror
 * `column-variant-grips.ts` pattern.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6 §6 Phase 4.5c.1
 */

import type { Point2D } from '../../rendering/types/Types';
import type { Point3D, Polygon3D } from '../types/bim-base';
import {
  ANCHOR_CYCLE_ORDER,
  DEFAULT_COLUMN_DEPTH_MM,
  DEFAULT_COLUMN_HEIGHT_MM,
  DEFAULT_COLUMN_ROTATION_DEG,
  DEFAULT_COLUMN_WIDTH_MM,
  type ColumnAnchor,
  type ColumnKind,
  type ColumnLshapeParams,
  type ColumnParams,
  type ColumnTshapeParams,
} from '../types/column-types';
import {
  DEFAULT_COLUMN_BASE_BINDING,
  DEFAULT_COLUMN_TOP_BINDING,
} from '../types/bim-binding';
import { computeColumnGeometry } from '../geometry/column-geometry';

/**
 * Ghost overrides — subset των ribbon-supplied overrides που επηρεάζουν τη
 * γεωμετρία του ghost preview. Mirror του `ColumnParamOverrides` (hooks/drawing/
 * column-completion.ts) ώστε το `bim/` layer να μην εξαρτάται από `hooks/`.
 */
export interface ColumnGhostOverrides {
  readonly width?: number;
  readonly depth?: number;
  readonly height?: number;
  readonly rotation?: number;
  readonly material?: string;
  readonly lshape?: ColumnLshapeParams;
  readonly tshape?: ColumnTshapeParams;
}

/**
 * Single ghost preview entry. `isActive=true` σημαίνει ότι το anchor αντιστοιχεί
 * στο `state.anchor` του column tool. Caller (renderer) χρωματίζει αναλόγως.
 */
export interface AnchorGhost {
  readonly anchor: ColumnAnchor;
  readonly isActive: boolean;
  readonly footprint: Polygon3D;
  /** Cursor world position (= το point που θα γίνει commit). Convenience for
   * anchor-marker rendering — ίδιο σε όλα τα entries του ίδιου frame. */
  readonly cursorPos: Readonly<Point2D>;
}

/**
 * Build ghost `ColumnParams` για συγκεκριμένο anchor override. Mirror του
 * `buildDefaultColumnParams` defaults (hooks/drawing/column-completion.ts)
 * αλλά self-contained στο `bim/` layer — δεν εξαρτάται από `hooks/`.
 */
function buildGhostParams(
  cursorPos: Readonly<Point2D>,
  kind: ColumnKind,
  anchorOverride: ColumnAnchor,
  overrides: ColumnGhostOverrides = {},
): ColumnParams {
  const position: Point3D = { x: cursorPos.x, y: cursorPos.y, z: 0 };
  const params: ColumnParams = {
    kind,
    position,
    anchor: anchorOverride,
    width: overrides.width ?? DEFAULT_COLUMN_WIDTH_MM,
    depth: overrides.depth ?? DEFAULT_COLUMN_DEPTH_MM,
    height: overrides.height ?? DEFAULT_COLUMN_HEIGHT_MM,
    rotation: overrides.rotation ?? DEFAULT_COLUMN_ROTATION_DEG,
    baseBinding: DEFAULT_COLUMN_BASE_BINDING,
    topBinding: DEFAULT_COLUMN_TOP_BINDING,
    baseOffset: 0,
    topOffset: 0,
    ...(overrides.material !== undefined ? { material: overrides.material } : {}),
    ...(overrides.lshape !== undefined ? { lshape: overrides.lshape } : {}),
    ...(overrides.tshape !== undefined ? { tshape: overrides.tshape } : {}),
  };
  return params;
}

/**
 * Compute όλα τα anchor ghost footprints για το τρέχον cursor position.
 *
 *   - rectangular / L-shape / T-shape → 9 ghosts (ANCHOR_CYCLE_ORDER).
 *   - circular → 1 ghost μόνο ('center'), isActive=true. Anchor cycling N/A.
 *
 * Active flag: `entry.anchor === activeAnchor`. Για circular: πάντα true.
 *
 * @param cursorPos cursor world position (mm).
 * @param kind active column kind από state.
 * @param activeAnchor τρέχον anchor από state — flag-mark only.
 * @param overrides ribbon overrides (width / depth / rotation / lshape / tshape).
 */
export function computeAnchorGhostFootprints(
  cursorPos: Readonly<Point2D>,
  kind: ColumnKind,
  activeAnchor: ColumnAnchor,
  overrides: ColumnGhostOverrides = {},
): readonly AnchorGhost[] {
  if (kind === 'circular') {
    const params = buildGhostParams(cursorPos, 'circular', 'center', overrides);
    const geometry = computeColumnGeometry(params);
    return [{
      anchor: 'center',
      isActive: true,
      footprint: geometry.footprint,
      cursorPos,
    }];
  }

  const ghosts: AnchorGhost[] = [];
  for (const anchor of ANCHOR_CYCLE_ORDER) {
    const params = buildGhostParams(cursorPos, kind, anchor, overrides);
    const geometry = computeColumnGeometry(params);
    ghosts.push({
      anchor,
      isActive: anchor === activeAnchor,
      footprint: geometry.footprint,
      cursorPos,
    });
  }
  return ghosts;
}
