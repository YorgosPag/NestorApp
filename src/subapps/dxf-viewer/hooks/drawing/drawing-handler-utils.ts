import type { ToolType } from '../../ui/toolbar/types';
import { toolStateStore } from '../../stores/ToolStateStore';
import type { Entity } from '../../types/entities';
import type { DetectableEntity } from '../../systems/dimensions/dim-smart-detector';
import { getHoveredEntity } from '../../systems/hover/HoverStore';
import { isDimLineRefPhase } from '../dimensions/dim-skip-snap';
import { ExtendedSnapType, isVisibleSnapMode } from '../../snapping/extended-types';
import { findHostsAtPoint } from '../../systems/dimensions/dim-intersection-host-finder';
import { applyPolar, type PolarSnapResult } from '../../systems/constraints/polar-utils';
import { polarTrackingStore } from '../../systems/constraints/polar-tracking-store';
import { applyAlongAxisStepSnap } from '../../bim/grips/grip-step-quantize';
import { SnapOverrideOrchestrator } from '../../snapping/overrides/SnapOverrideOrchestrator';
import { TrackingPointStore } from '../../systems/tracking/TrackingPointStore';
// ADR-508 §line-cyan / ADR-060 — commit-time «line family» flush + κάθετο κλείδωμα (κοινός εγκέφαλος με το preview).
import { getImmediateSnap } from '../../systems/cursor/ImmediateSnapStore';
import { applyLengthAngleLock } from '../../systems/dynamic-input/length-angle-lock';
import { resolveLineCommitPoint } from './line-preview-helpers';
import { resolvePerpendicularAxisLock, projectOntoPerpendicularAxis } from './line-perpendicular-preview-helpers';
import { perpendicularAxisLockStore } from '../../bim/placement/perpendicular-axis-lock-store';
import type { SceneUnits } from '../../utils/scene-units';
// ADR-562 Φ9 / ADR-357 — dim-creation alignment traces (commit parity with the hover preview).
import { resolveDimAlignmentTracking } from '../dimensions/dim-alignment-tracking';
import { dimensionCreateStore } from '../../stores/DimensionCreateStore';
// ADR-357 Phase 4 / 2026-07-04 — generic-drawing commit-point alignment (acquired ⊕ ambient ⊕
// segment-base clean-corner + adaptive quantize), the SAME SSoT the hover preview reads.
import { resolveAlignmentTracking } from '../../systems/tracking/resolve-alignment-tracking';
import { ambientAlignmentConfigStore } from '../../systems/tracking/ambient-alignment-config-store';

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
 * ADR-362 Phase D1 / ADR-562 Φ9 — resolve a dim-tool commit click: snap + entity-under-cursor
 * (via `resolveDimPickContext`) THEN apply the SAME alignment override the hover preview showed
 * (WYSIWYG), skipped on the free dim-line offset pick (`isDimLineRefPhase`) exactly like OSNAP +
 * the hover path. Extracted from `useDrawingHandlers.onDrawingPoint` (SSoT, keeps the hook under
 * the file-size budget N.7.1).
 */
export function resolveDimCommitPoint(
  p: Pt,
  args: {
    applySnap: (pt: Pt) => Pt;
    findSnapPoint: Parameters<typeof resolveDimPickContext>[2];
    sceneEntities: ReadonlyArray<Entity> | undefined;
    scale: number;
    polarEnabled: boolean;
    ambientEnabled: boolean;
  },
): {
  alignedSnapped: Pt;
  hoveredEntity: DetectableEntity | undefined;
  snapMode: ExtendedSnapType | undefined;
  secondEntity: DetectableEntity | undefined;
} {
  const { snapped, hoveredEntity, snapMode, secondEntity } = resolveDimPickContext(
    p, args.applySnap, args.findSnapPoint, args.sceneEntities,
  );
  let alignedSnapped = snapped;
  if (!isDimLineRefPhase()) {
    const refPoints = dimensionCreateStore.get().clicks.map((c) => c.world);
    const composed = resolveDimAlignmentTracking(snapped, refPoints, {
      scale: args.scale,
      polarEnabled: args.polarEnabled,
      sceneEntities: args.ambientEnabled ? (args.sceneEntities ?? null) : null,
    });
    if (composed) alignedSnapped = composed.point;
  }
  return { alignedSnapped, hoveredEntity, snapMode, secondEntity };
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

/**
 * ADR-357 Phase 7 — M2P (mid-between-2-points) override click. First click stores the
 * reference (returns without committing); second click commits the midpoint like a normal
 * point (dispatches the legacy `canvas-click` for the Dynamic Input phase hook when the
 * entity did not complete, clears the preview + tracking memory, and fires the B36 measure
 * callback). Extracted from `useDrawingHandlers.onDrawingPoint` (SSoT, keeps the hook under
 * the file-size budget). `commitPoint` returns true when the entity completed.
 */
export function commitM2PClick(opts: {
  seed: Pt;
  applySnap: (pt: Pt) => Pt;
  commitPoint: (pt: Pt) => boolean;
  clearPreview: () => void;
  tempPoints: ReadonlyArray<Pt>;
  activeTool: ToolType;
  onMeasurementComplete?: (points: ReadonlyArray<Pt>, tool: ToolType) => void;
}): void {
  const midPoint = SnapOverrideOrchestrator.advanceM2P(opts.applySnap(opts.seed));
  if (!midPoint) return; // first M2P click — waiting for second
  SnapOverrideOrchestrator.clearOverride();
  const completed = opts.commitPoint(midPoint);
  if (!completed) {
    window.dispatchEvent(new CustomEvent('canvas-click', { detail: { worldPoint: midPoint } }));
    return;
  }
  opts.clearPreview();
  TrackingPointStore.clearAll();
  if (opts.onMeasurementComplete && MEASURE_TOOLS_FOR_GUIDES.has(opts.activeTool)) {
    opts.onMeasurementComplete([...opts.tempPoints, midPoint], opts.activeTool);
  }
}

/**
 * SSoT commit-time transform για την «οικογένεια γραμμής» (`line` + `line-perpendicular`), κοινή με το
 * preview (`drawing-hover-handler`) → **preview ≡ commit by construction**. Ζει εδώ (όχι inline στο
 * `useDrawingHandlers`) ώστε το hook να μένει κάτω από το όριο N.7.1.
 *
 *  · **Κλικ 1** (`tempPointsLength === 0`): flush/κάθετο κούμπωμα στην παρειά. «Πραγματική κορυφή νικάει» —
 *    ενεργό ΟΡΑΤΟ OSNAP παρακάμπτει το flush (η αρχή μένει ακριβώς στη γωνία). Για `line` → `resolveLineCommitPoint`.
 *    Για `line-perpendicular` → καταγράφει τον κάθετο άξονα (`perpendicularAxisLockStore.set`) + βάση = flush foot.
 *  · **Κλικ 2** (`line-perpendicular`, `tempPointsLength === 1`): προβολή στον κλειδωμένο κάθετο άξονα + typed
 *    length (Radial Command Ring), μετά `reset()` του lock (καταναλώθηκε).
 *  · **No-op** για κάθε άλλο εργαλείο (επιστρέφει `point` αυτούσιο).
 */
export function resolveLineFamilyCommitPoint(
  activeTool: ToolType,
  point: Pt,
  tempPointsLength: number,
  lastRef: Pt | undefined,
  sceneUnits: SceneUnits,
): Pt {
  // ADR-508 §polyline-parity (Giorgio 2026-07-07) — η «πολυγραμμή» μπαίνει στην ΙΔΙΑ commit-λογική με
  // τη γραμμή (γενικός κλάδος πιο κάτω): flush/κάθετο κούμπωμα στο 1ο κλικ + length/angle lock στα
  // επόμενα → preview ≡ commit με το νέο ghost/κυανές/HUD του ενεργού segment. (ΟΧΙ perpendicular κλάδος.)
  if (activeTool !== 'line' && activeTool !== 'line-perpendicular' && activeTool !== 'polyline') return point;

  // ── «Κάθετη γραμμή» — πλήρως χωριστός κλάδος (το flush/κάθετο κλείδωμα είναι ο ΠΥΡΗΝΑΣ του εργαλείου,
  //    ΔΕΝ μπλοκάρεται από «κορυφή νικάει»: αλλιώς όταν το snap κουμπώνει στο σώμα/κορυφή δεν θα κλείδωνε
  //    ποτέ ο κάθετος άξονας). ──────────────────────────────────────────────────────────────────────
  if (activeTool === 'line-perpendicular') {
    if (tempPointsLength === 0) {
      // Κλικ 1: κατέγραψε τον κάθετο άξονα (`faceFrame.perpDir`) + βάση = flush foot στην παρειά.
      const lock = resolvePerpendicularAxisLock(point, sceneUnits);
      if (lock) { perpendicularAxisLockStore.set(lock); return lock.base; }
      perpendicularAxisLockStore.reset(); // καμία παρειά κοντά → ελεύθερη γραμμή (χωρίς κάθετο κλείδωμα)
      return point;
    }
    // Κλικ 2: προβολή στον κλειδωμένο κάθετο άξονα + typed length (Radial Command Ring), μετά consume.
    const lock = perpendicularAxisLockStore.get();
    let finalPoint = lock ? projectOntoPerpendicularAxis(point, lock) : point;
    finalPoint = applyLengthAngleLock(finalPoint, lastRef ?? lock?.base ?? null);
    perpendicularAxisLockStore.reset();
    return finalPoint;
  }

  // ── Απλή γραμμή (`line`) — αμετάβλητη λογική (relocated από το useDrawingHandlers). ──
  let finalPoint = point;
  // length/angle lock (Δαχτυλίδι Εντολών) ΠΡΙΝ το flush — ίδιο με το preview (WYSIWYG).
  if (lastRef) finalPoint = applyLengthAngleLock(finalPoint, lastRef);
  // Κλικ 1: flush στην παρειά, εκτός αν κλειδώνει ΟΡΑΤΟ OSNAP (πραγματική κορυφή νικάει).
  if (tempPointsLength === 0) {
    const lockedSnap = getImmediateSnap();
    const visibleOsnap = !!lockedSnap?.found && isVisibleSnapMode(lockedSnap.mode);
    if (!visibleOsnap) finalPoint = resolveLineCommitPoint(finalPoint, sceneUnits);
  }
  return finalPoint;
}

/**
 * SSoT commit-point resolver for the GENERIC drawing path (`useDrawingHandlers.onDrawingPoint`).
 * Promotes the snapped point to the committed point through the SAME pipeline as the preview:
 * (1) alignment tracking — acquired ⊕ ambient ⊕ segment-base clean-corner + adaptive quantize
 * (via `resolveAlignmentTracking`), then (2) the line-family flush / length-angle lock
 * (`resolveLineFamilyCommitPoint`). Keeps `useDrawingHandlers` under the N.7.1 size limit and
 * guarantees clicked point ≡ locked ghost (WYSIWYG). `sceneEntities` is only consulted when
 * ambient alignment is enabled (mirrors the preview gate).
 */
export function resolveCommittedDrawingPoint(
  snappedPoint: Pt,
  opts: {
    scale: number;
    polar: boolean;
    ortho: boolean;
    sceneEntities: readonly Entity[] | undefined;
    segmentBase: Pt | undefined;
    activeTool: ToolType;
    tempPointsLength: number;
    sceneUnits: SceneUnits;
  },
): Pt {
  let finalPoint = snappedPoint;
  const ambientOn = ambientAlignmentConfigStore.getSnapshot().enabled;
  const committedTracking = resolveAlignmentTracking(snappedPoint, {
    scale: opts.scale,
    polarEnabled: opts.polar && !opts.ortho,
    sceneEntities: ambientOn ? (opts.sceneEntities ?? null) : null,
    segmentBase: opts.segmentBase ?? null,
  });
  if (committedTracking) finalPoint = committedTracking.point;
  return resolveLineFamilyCommitPoint(
    opts.activeTool, finalPoint, opts.tempPointsLength, opts.segmentBase, opts.sceneUnits,
  );
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
