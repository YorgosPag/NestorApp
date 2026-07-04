/**
 * ADR-362 Phase D1 — Build a `DimensionEntity` from creation-flow state.
 *
 * Pure mappers `clicks (+ cursor) → DimensionEntity`. Two call sites:
 *   - Preview (every cursor move) — `buildPreviewDimensionEntity` injects the
 *     current cursor as the next-to-be-placed point so the PreviewCanvas
 *     overlay shows a rubber-band dim.
 *   - Commit (status === 'commit-ready') — `buildCommittedDimensionEntity`
 *     uses only the collected clicks + materialises `DimensionAssociation`s
 *     (D11 data capture, snap intelligence ships in Phase J).
 *
 * Sentinels for preview-only fields (id / layerId) are local string constants;
 * the hook overwrites them with real enterprise IDs + the active layer id at
 * commit time.
 */

import type { Point2D } from '../../rendering/types/Types';
import type {
  AlignedDimensionEntity,
  Angular2LDimensionEntity,
  Angular3PDimensionEntity,
  DimensionAssociation,
  DimensionEntity,
  LinearDimensionEntity,
} from '../../types/dimension';
import type { LineEntity } from '../../types/entities';
import type { DimensionCreateState } from './dimension-create-state';
import {
  buildArcLength,
  buildDiameter,
  buildJoggedRadius,
  buildOrdinate,
  buildRadius,
} from './dimension-create-radial-builders';
import {
  buildBaseline,
  buildContinued,
} from './dimension-create-chained-builders';
import { buildEntityPickDimension } from './dimension-create-entity-pick-builder';
import { collectAssociations } from './dimension-create-association-builders';

const PREVIEW_ID_SENTINEL = '__dim_preview__';
const PREVIEW_LAYER_ID_SENTINEL = '__dim_preview_layer__';

// ──────────────────────────────────────────────────────────────────────────────
// Public entry points
// ──────────────────────────────────────────────────────────────────────────────

export function buildPreviewDimensionEntity(
  state: DimensionCreateState,
): DimensionEntity | null {
  if (!state.currentType || !state.styleId) return null;
  if (state.clicks.length === 0 && !state.cursorWorld) return null;
  // ADR-362 hotfix (2026-05-19): kill the green-flash window. After the final
  // click flips status to `commit-ready`, a microtask runs `runCommit` to
  // materialise the committed entity. Between that flip and the microtask,
  // any RAF tick (`dim-preview-persist` callback in `useDimToolRouting`) would
  // rebuild the preview from the now-3 stored clicks and paint a green
  // rubber-band on top of where the committed dim is about to appear. Returning
  // null here closes that window — the preview canvas stays cleared until the
  // commit microtask + next `start()` cycle restart the collection.
  if (state.status === 'commit-ready') return null;
  return buildFromState(state, {
    id: PREVIEW_ID_SENTINEL,
    layerId: PREVIEW_LAYER_ID_SENTINEL,
    includeCursor: true,
  });
}

export interface CommittedBuildResult {
  readonly entity: DimensionEntity;
  readonly associations: readonly DimensionAssociation[];
}

export function buildCommittedDimensionEntity(
  state: DimensionCreateState,
  realIds: { readonly id: string; readonly layerId: string },
): CommittedBuildResult | null {
  if (!state.currentType || !state.styleId) return null;
  if (state.status !== 'commit-ready') return null;
  const entity = buildFromState(state, {
    id: realIds.id,
    layerId: realIds.layerId,
    includeCursor: false,
  });
  if (!entity) return null;
  const associations = collectAssociations(state, entity);
  return {
    entity: associations.length > 0 ? { ...entity, associations } : entity,
    associations,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Dispatcher
// ──────────────────────────────────────────────────────────────────────────────

interface BuildOpts {
  readonly id: string;
  readonly layerId: string;
  readonly includeCursor: boolean;
}

function buildFromState(
  state: DimensionCreateState,
  opts: BuildOpts,
): DimensionEntity | null {
  // ADR-362 Phase N — pick-entity mode derives the whole dimension from click 1's
  // entity + the placement drag, regardless of the detector-resolved `currentType`.
  if (state.mode === 'entity') {
    return buildEntityPickDimension(state, opts);
  }
  switch (state.currentType) {
    case 'linear':
      return buildLinear(state, opts);
    case 'aligned':
      return buildAligned(state, opts);
    case 'angular2L':
      return buildAngular2L(state, opts);
    case 'angular3P':
      return buildAngular3P(state, opts);
    case 'radius':
      return buildRadius(state, opts);
    case 'diameter':
      return buildDiameter(state, opts);
    case 'arcLength':
      return buildArcLength(state, opts);
    case 'joggedRadius':
      return buildJoggedRadius(state, opts);
    case 'ordinate':
      return buildOrdinate(state, opts);
    case 'baseline':
      return buildBaseline(state, opts);
    case 'continued':
      return buildContinued(state, opts);
    default:
      return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Per-variant builders
// ──────────────────────────────────────────────────────────────────────────────

function buildLinear(state: DimensionCreateState, opts: BuildOpts): LinearDimensionEntity | null {
  const pts = collectPoints(state, opts, 3);
  if (pts.length < 2) return null;
  return {
    id: opts.id,
    type: 'dimension',
    dimensionType: 'linear',
    layerId: opts.layerId,
    styleId: state.styleId as string,
    defPoints: pts,
    rotation: 0,
  };
}

function buildAligned(state: DimensionCreateState, opts: BuildOpts): AlignedDimensionEntity | null {
  const pts = collectPoints(state, opts, 3);
  if (pts.length < 2) return null;
  return {
    id: opts.id,
    type: 'dimension',
    dimensionType: 'aligned',
    layerId: opts.layerId,
    styleId: state.styleId as string,
    defPoints: pts,
  };
}

function buildAngular2L(
  state: DimensionCreateState,
  opts: BuildOpts,
): Angular2LDimensionEntity | null {
  const lines = pickedLines(state);
  if (lines.length === 0) return null;
  const defPoints = buildAngular2LDefPoints(state, lines, opts);
  if (defPoints.length < 4) return null;
  return {
    id: opts.id,
    type: 'dimension',
    dimensionType: 'angular2L',
    layerId: opts.layerId,
    styleId: state.styleId as string,
    defPoints,
  };
}

function buildAngular3P(
  state: DimensionCreateState,
  opts: BuildOpts,
): Angular3PDimensionEntity | null {
  const pts = collectPoints(state, opts, 4);
  if (pts.length < 3) return null;
  return {
    id: opts.id,
    type: 'dimension',
    dimensionType: 'angular3P',
    layerId: opts.layerId,
    styleId: state.styleId as string,
    defPoints: pts,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Phase D2 builders live in `dimension-create-radial-builders.ts` (split for
// the 500-LOC SRP cap). Dispatcher delegates by `dimensionType` above.
// ──────────────────────────────────────────────────────────────────────────────

// ──────────────────────────────────────────────────────────────────────────────
// Point collection helpers
// ──────────────────────────────────────────────────────────────────────────────

/** Click-derived points + (optional) cursor, capped at `maxPoints`. */
function collectPoints(
  state: DimensionCreateState,
  opts: BuildOpts,
  maxPoints: number,
): readonly Point2D[] {
  const clicked = state.clicks.map((c) => c.world);
  const includeCursor =
    opts.includeCursor && state.cursorWorld !== null && clicked.length < maxPoints;
  const cursor = includeCursor ? [state.cursorWorld as Point2D] : [];
  return [...clicked, ...cursor].slice(0, maxPoints);
}

function pickedLines(state: DimensionCreateState): readonly LineEntity[] {
  const out: LineEntity[] = [];
  for (const click of state.clicks) {
    const e = click.pickedEntity;
    if (e && e.type === 'line') out.push(e);
    if (out.length === 2) break;
  }
  return out;
}

/**
 * Angular2L defPoints = [line1.start, line1.end, line2.start, line2.end, arcPoint].
 * Line2 may not yet be picked at click 1 → fall back to a degenerate placeholder
 * using the cursor so the preview still renders something sensible.
 */
function buildAngular2LDefPoints(
  state: DimensionCreateState,
  lines: readonly LineEntity[],
  opts: BuildOpts,
): readonly Point2D[] {
  const line1 = lines[0];
  const line2 = lines[1];
  const arcAnchor = pickAngular2LArcPoint(state, opts);

  const seg1: Point2D[] = [line1.start, line1.end];
  const seg2: Point2D[] = line2
    ? [line2.start, line2.end]
    : opts.includeCursor && state.cursorWorld
      ? [state.cursorWorld, state.cursorWorld]
      : [];
  if (seg2.length === 0) return [];
  return [...seg1, ...seg2, arcAnchor];
}

function pickAngular2LArcPoint(state: DimensionCreateState, opts: BuildOpts): Point2D {
  // 3rd click (after both lines) is the arc anchor.
  const explicit = state.clicks[2]?.world;
  if (explicit) return explicit;
  if (opts.includeCursor && state.cursorWorld) return state.cursorWorld;
  // Last resort during the brief window between click 2 and the first cursor
  // move: anchor on line1's midpoint so the preview builder doesn't crash.
  const first = state.clicks[0]?.pickedEntity;
  if (first && first.type === 'line') {
    return { x: (first.start.x + first.end.x) / 2, y: (first.start.y + first.end.y) / 2 };
  }
  return { x: 0, y: 0 };
}

// ──────────────────────────────────────────────────────────────────────────────
// D11 — associativity capture lives in `dimension-create-association-builders.ts`
// (split for the 500-LOC SRP cap). `collectAssociations` is imported above.
// ──────────────────────────────────────────────────────────────────────────────
