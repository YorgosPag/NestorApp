import type { ToolType } from '../../ui/toolbar/types';
import { toolStateStore } from '../../stores/ToolStateStore';
import type { Entity } from '../../types/entities';
import type { DetectableEntity } from '../../systems/dimensions/dim-smart-detector';
import { getHoveredEntity } from '../../systems/hover/HoverStore';
import { isDimLineRefPhase } from '../dimensions/dim-skip-snap';
import { ExtendedSnapType } from '../../snapping/extended-types';
import { findHostsAtPoint } from '../../systems/dimensions/dim-intersection-host-finder';
import { applyPolar, type PolarSnapResult } from '../../systems/constraints/polar-utils';
import { polarTrackingStore } from '../../systems/constraints/polar-tracking-store';
import { applyAlongAxisStepSnap } from '../../bim/grips/grip-step-quantize';

/** Snap modes whose snapped point lies ON a single host curve (host recoverable). */
const POINT_ON_CURVE_SNAPS = new Set<ExtendedSnapType>([
  ExtendedSnapType.ENDPOINT,
  ExtendedSnapType.MIDPOINT,
  ExtendedSnapType.NEAREST,
  ExtendedSnapType.PERPENDICULAR,
  ExtendedSnapType.QUADRANT,
]);

type Pt = { x: number; y: number };

export function handleToolCompletion(tool: ToolType, forceSelect: boolean = false): void {
  toolStateStore.handleToolCompletion(tool, forceSelect);
}

/**
 * B36 (ADR-189): Measurement tools that support "Create Guides" prompt via
 * the dedicated `onMeasurementComplete` callback (raw point list, no entity).
 * Re-exported so the B39 entity→guide listener can skip these tools and
 * avoid raising a second notification on the same completion.
 */
export const MEASURE_TOOLS_FOR_GUIDES = new Set<string>([
  'measure-distance', 'measure-distance-continuous', 'measure-angle',
]);

/**
 * ADR-362 hotfix (2026-05-19): resolve the snapped point + entity-under-cursor for a
 * dim-tool click. AutoCAD pattern — the dim-line-offset pick (3rd click) skips OSNAP so
 * preview & commit match; otherwise snap normally and read the body via the hit-test SSoT
 * (HoverStore), falling back to snap.entityId when the click landed on an OSNAP point.
 */
export function resolveDimPickContext(
  p: Pt,
  applySnap: (pt: Pt) => Pt,
  findSnapPoint:
    | ((x: number, y: number) => { entityId?: string; activeMode?: string | null } | null | undefined)
    | undefined,
  sceneEntities: ReadonlyArray<Entity> | undefined,
): {
  snapped: Pt;
  hoveredEntity: DetectableEntity | undefined;
  snapMode: ExtendedSnapType | undefined;
  secondEntity: DetectableEntity | undefined;
} {
  const skipSnap = isDimLineRefPhase();
  const snapped = skipSnap ? p : applySnap(p);
  const snapResult = skipSnap ? undefined : findSnapPoint?.(p.x, p.y);
  const hoveredId = skipSnap ? undefined : (getHoveredEntity() ?? snapResult?.entityId);
  let hoveredEntity: DetectableEntity | undefined = hoveredId
    ? (sceneEntities?.find((e) => e.id === hoveredId) as DetectableEntity | undefined)
    : undefined;

  // ADR-362 Phase J3 (gap #2) — capture the active snap mode + host(s).
  const snapMode = normalizeSnapMode(snapResult?.activeMode);
  let secondEntity: DetectableEntity | undefined;

  if (!skipSnap && snapMode === ExtendedSnapType.INTERSECTION) {
    // Resolve BOTH crossing hosts geometrically — the entity-under-cursor
    // hit-test (HoverStore) often returns nothing at an intersection, which
    // previously dropped the whole association even though both curves are
    // known. Keep `hoveredEntity` if it's a real host; else take the nearest.
    const hosts = findHostsAtPoint(snapped, sceneEntities, 2);
    if (!hoveredEntity || !hosts.some((h) => h.id === hoveredEntity!.id)) {
      hoveredEntity = hosts[0] ?? hoveredEntity;
    }
    secondEntity = hosts.find((h) => h.id !== hoveredEntity?.id);
  } else if (!skipSnap && !hoveredEntity && snapMode && POINT_ON_CURVE_SNAPS.has(snapMode)) {
    // Single-host point snap (endpoint / midpoint / nearest / …) whose host the
    // hit-test missed — recover it so the parametric-nearest anchor is captured.
    hoveredEntity = findHostsAtPoint(snapped, sceneEntities, 1)[0];
  }

  return { snapped, hoveredEntity, snapMode, secondEntity };
}

/** Map a raw snap `activeMode` string onto the `ExtendedSnapType` enum (or undefined). */
function normalizeSnapMode(mode: string | null | undefined): ExtendedSnapType | undefined {
  if (!mode) return undefined;
  return Object.values(ExtendedSnapType).includes(mode as ExtendedSnapType)
    ? (mode as ExtendedSnapType)
    : undefined;
}

/**
 * Tools that finish a multi-point operation on double-click (continuous polyline /
 * polygon / hatch / measurement families + best-fit circle). SSoT for the
 * `onDrawingDoubleClick` routing so the hook stays a thin wrapper.
 */
const DOUBLE_CLICK_FINISH_TOOLS = new Set<string>([
  'polyline', 'polygon', 'hatch', 'measure-area', 'measure-angle',
  'measure-angle-measuregeom', 'measure-distance-continuous', 'circle-best-fit',
]);

/**
 * Double-click "finish" for continuous tools. Overlay completion takes priority; then
 * `measure-distance-continuous` (ADR-053) just stops drawing (entities are auto-created
 * every 2 points), while the standard DXF polyline family commits the finished entity.
 * Extracted from `useDrawingHandlers` (SSoT, keeps the hook under the file-size budget).
 */
export function performDoubleClickFinish(
  activeTool: ToolType,
  ops: {
    finishPolyline: () => object | null | undefined;
    onEntityCreated: (entity: Entity) => void;
    cancelDrawing: () => void;
    clearPreview: () => void;
  },
): void {
  if (!DOUBLE_CLICK_FINISH_TOOLS.has(activeTool)) return;

  // Check for overlay completion callback first.
  const { toolStyleStore } = require('../../stores/ToolStyleStore');
  if (toolStyleStore.triggerOverlayCompletion()) return;

  // ADR-053 FIX (2026-01-30): measure-distance-continuous auto-creates entities every
  // 2 points, so "finish" just means stop drawing — no entity creation needed.
  if (activeTool === 'measure-distance-continuous') {
    ops.cancelDrawing();
    ops.clearPreview();
    handleToolCompletion(activeTool);
    return;
  }

  // Standard DXF polyline completion (polyline, polygon, measure-area, measure-angle).
  const newEntity = ops.finishPolyline();
  if (newEntity && 'type' in newEntity && typeof newEntity.type === 'string') {
    ops.onEntityCreated(newEntity as Entity);
  }
  handleToolCompletion(activeTool);
}

/** AutoCAD-style hard ortho: projects point onto H or V axis from referencePoint */
export function hardOrtho(point: Pt, ref: Pt): Pt {
  const dx = point.x - ref.x;
  const dy = point.y - ref.y;
  return Math.abs(dx) >= Math.abs(dy)
    ? { x: point.x, y: ref.y }
    : { x: ref.x, y: point.y };
}

/**
 * SSoT world-polar snap config (increment + additional angles + 3° tolerance), read
 * LIVE from the polar-tracking store. ONE place owns the config that the preview
 * (`drawing-hover-handler`) AND both commit paths (`useDrawingHandlers.onDrawingPoint`
 * generic + `bim-ortho-reference.applyBimDrawingConstraint` BIM) feed into `applyPolar`
 * — it used to be copy-pasted ~4×.
 */
export function worldPolarSnapConfig(): {
  incrementAngle: number;
  additionalAngles: readonly number[];
  angleTolerance: number;
} {
  return {
    incrementAngle: polarTrackingStore.incrementAngle,
    additionalAngles: polarTrackingStore.additionalAngles,
    angleTolerance: 3,
  };
}

/** Result of {@link resolveOrthoPolarStep} — the constrained point plus the pre-step
 *  value and the polar result (for the tracking-line overlay). */
export interface OrthoPolarStepResult {
  /** Point after the ORTHO/POLAR direction lock, BEFORE the fixed step grid — for
   *  consumers that need the un-stepped value (e.g. snap-override / from / m2p). */
  readonly constrained: Pt;
  /** `constrained` after the fixed SNAP-MODE (F9 + Q) step grid — the value to commit/preview. */
  readonly stepped: Pt;
  /** Non-null when POLAR produced the lock (the overlay tracking line reads it), else null. */
  readonly polarResult: PolarSnapResult | null;
}

/**
 * SSoT for the drawing **ORTHO (F8) → POLAR (F10) → fixed-step (F9 + Q)** constraint
 * chain relative to `ref`. ORTHO and POLAR are mutually exclusive (enforced by
 * `useCadToggles`). Used by the preview (`drawing-hover-handler`) AND both commit
 * paths (generic `onDrawingPoint` + BIM `applyBimDrawingConstraint`) so the rubber-band
 * equals the committed geometry (WYSIWYG) — one constraint pipeline, zero duplication.
 *
 * Does NOT include the wall face-relative magnet (`resolveWallFaceRelativePolar`): that
 * is wall-only, needs `worldPerPixel`, and owns its own zoom-adaptive step — the caller
 * applies it BEFORE this and skips this when it fires.
 */
export function resolveOrthoPolarStep(
  point: Pt,
  ref: Pt,
  opts: { ortho: boolean; polar: boolean },
): OrthoPolarStepResult {
  if (opts.ortho) {
    const constrained = hardOrtho(point, ref);
    return { constrained, stepped: applyAlongAxisStepSnap(constrained, ref), polarResult: null };
  }
  if (opts.polar) {
    const polarResult = applyPolar(point, ref, worldPolarSnapConfig());
    return { constrained: polarResult.point, stepped: applyAlongAxisStepSnap(polarResult.point, ref), polarResult };
  }
  return { constrained: point, stepped: applyAlongAxisStepSnap(point, ref), polarResult: null };
}
