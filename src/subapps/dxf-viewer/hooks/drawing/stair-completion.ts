/**
 * ADR-358 Phase 5a — Pure builders for stair entity creation.
 *
 * SSoT:
 *   - IDs via `generateStairId()` (N.6 enterprise-id, ADR-017/210/294).
 *   - Geometry via `computeStairGeometry()` (Phase 3a/3b/4a/4b/4c).
 *   - Types via `types/stair.ts` (Phase 1).
 *
 * Phase 5a default variant = `'straight'`. Other kinds become user-selectable
 * via the contextual ribbon tab landing Phase 7a — Phase 5a keeps the click
 * pipeline minimal and deterministic.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.1 §6.1
 */

import { Timestamp } from 'firebase/firestore';
import type { Point2D, Point3D } from '../../rendering/types/Types';
import type {
  StairEntity,
  StairGeometry,
  StairParams,
  StairValidationState,
  StairVariantParams,
} from '../../types/stair';
import { generateStairId } from '@/services/enterprise-id.service';
import { computeStairGeometry } from '../../systems/stairs/StairGeometryService';

// ─── Phase 5a defaults (industry-aligned, NOK κύρια per §5.10) ───────────────

const DEFAULT_RISE_MM = 175;
const DEFAULT_TREAD_MM = 280;
const DEFAULT_WIDTH_MM = 1200;
const DEFAULT_NOSING_MM = 20;
const DEFAULT_STEP_COUNT = 12;
const DEFAULT_HANDRAIL_HEIGHT_MM = 900;
const DEFAULT_WALKLINE_OFFSET_MM = 600;
const RAD_TO_DEG = 180 / Math.PI;

// ─── Param overrides accepted by builders ────────────────────────────────────

/**
 * Dynamic Input field overrides for `buildDefaultStairParams`. Other params
 * (variant kind, structureType, codeProfile, handrails) keep Phase 5a defaults.
 */
export interface StairParamOverrides {
  readonly rise?: number;
  readonly tread?: number;
  readonly width?: number;
  readonly stepCount?: number;
}

// ─── Defaults factory ────────────────────────────────────────────────────────

/**
 * Build a `StairParams` with Phase 5a defaults at a given basePoint/direction.
 * Overrides come from Dynamic Input fields (rise/tread/width/stepCount).
 *
 * Variant fixed to `'straight'` for Phase 5a; variant selection lands Phase 7a.
 */
export function buildDefaultStairParams(
  basePoint: Readonly<Point2D>,
  direction: number,
  overrides: StairParamOverrides = {},
): StairParams {
  const rise = overrides.rise ?? DEFAULT_RISE_MM;
  const tread = overrides.tread ?? DEFAULT_TREAD_MM;
  const width = overrides.width ?? DEFAULT_WIDTH_MM;
  const stepCount = overrides.stepCount ?? DEFAULT_STEP_COUNT;
  const base3D: Point3D = { x: basePoint.x, y: basePoint.y, z: 0 };
  const variant: StairVariantParams = { kind: 'straight' };
  return {
    basePoint: base3D,
    direction,
    rise,
    tread,
    nosing: DEFAULT_NOSING_MM,
    nosingSide: 'front',
    width,
    stepCount,
    totalRise: rise * stepCount,
    totalRun: tread * (stepCount - 1),
    pitch: Math.atan2(rise, tread) * RAD_TO_DEG,
    structureType: 'monolithic',
    riserType: 'closed',
    antiskidNosing: false,
    adaContrastStrip: false,
    variant,
    walklineOffset: DEFAULT_WALKLINE_OFFSET_MM,
    handrails: { inner: true, outer: true, height: DEFAULT_HANDRAIL_HEIGHT_MM },
    upDirection: 'forward',
    treadNumberStart: 1,
    treadLabelDisplay: 'all',
    treadLabelRestartPerFlight: false,
    codeProfile: 'nok',
    nokSubType: 'main',
  };
}

// ─── Entity builder ──────────────────────────────────────────────────────────

/**
 * Build a `StairEntity` from `StairParams`. Geometry is computed via the SSoT
 * `computeStairGeometry()` — Phase 5a NEVER duplicates that math here.
 *
 * Validation state is empty by default (Phase 6 wires `gate-stair-checker`).
 */
export function buildStairEntity(
  params: Readonly<StairParams>,
  layer: string,
): StairEntity {
  const geometry: StairGeometry = computeStairGeometry(params);
  const validation: StairValidationState = {
    hasCodeViolations: false,
    violationKeys: [],
    lastValidatedAt: Timestamp.now(),
  };
  return {
    id: generateStairId(),
    type: 'stair',
    kind: params.variant.kind,
    params,
    geometry,
    validation,
    layer,
    visible: true,
  };
}

// ─── Direction helper ────────────────────────────────────────────────────────

/**
 * Compute `direction` (deg, 0 = +X) from a click `basePoint → second point`.
 * Pure, side-effect free; used by `useStairTool` confirming step.
 */
export function directionFromPoints(
  basePoint: Readonly<Point2D>,
  secondPoint: Readonly<Point2D>,
): number {
  return Math.atan2(secondPoint.y - basePoint.y, secondPoint.x - basePoint.x) * RAD_TO_DEG;
}

// ─── Command history snapshot (undo/redo support) ────────────────────────────

/**
 * Snapshot captured at commit time for command-history (ADR-031). Phase 5a uses
 * the standard `CreateEntityCommand` pipeline via `completeEntity`, so this
 * structure is currently informational — useful for telemetry and for the
 * Phase 5b grip undo/redo entries that need access to the original `params`.
 */
export interface StairCommandHistoryEntry {
  readonly entityId: string;
  readonly kind: StairEntity['kind'];
  readonly params: StairParams;
  readonly createdAt: number;
}

export function buildStairCommandHistoryEntry(entity: StairEntity): StairCommandHistoryEntry {
  return {
    entityId: entity.id,
    kind: entity.kind,
    params: entity.params,
    createdAt: Date.now(),
  };
}
