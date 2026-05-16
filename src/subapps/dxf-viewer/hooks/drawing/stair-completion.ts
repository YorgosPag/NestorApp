/**
 * ADR-358 Phase 5a + 6.5 — Pure builders for stair entity creation.
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
 * Phase 6.5 (Q26): when `codeProfile === 'ada'` the builder auto-applies the
 * ADA accessibility pacchetto coherent — handrails on both sides at code-min
 * height, top extension 305mm, bottom extension one-tread, contrast strip on
 * — unless the caller explicitly overrides. The auto-default keeps the
 * validator green out of the box for ADA stairs (Q26).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-358-dxf-stair-tool-google-level.md §5.1 §6.1 §3.6 §9.2 Q26
 */

import { Timestamp } from 'firebase/firestore';
import type { Point2D, Point3D } from '../../rendering/types/Types';
import type {
  StairCodeProfile,
  StairEntity,
  StairGeometry,
  StairNokSubType,
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

// ─── Scene units → mm scale (Phase 8 unit-aware builder hotfix) ──────────────

export type SceneUnits = 'mm' | 'cm' | 'm' | 'in' | 'ft';

/**
 * Multiplier applied to the mm defaults so the resulting `StairParams` are
 * expressed in the scene's coordinate units. DXF planning files are commonly
 * in millimeters (architectural drafting), but BIM/civil files reach the
 * scene in meters; without this conversion the stair geometry is rendered
 * ~1000× larger than the host floorplan (regression observed 2026-05-17).
 */
function mmToSceneUnits(units: SceneUnits): number {
  switch (units) {
    case 'mm': return 1;
    case 'cm': return 0.1;
    case 'm':  return 0.001;
    case 'in': return 1 / 25.4;
    case 'ft': return 1 / 304.8;
  }
}

/**
 * ADR-358 Phase 8 — heuristic scene-units detection from the scene bounds.
 *
 * Background: `dxf-scene-builder` hardcodes `SceneModel.units = 'mm'` even
 * when the source DXF carries `$INSUNITS = 6` (meters), so the stored field
 * is unreliable as a scale reference for newly drawn entities. Until the
 * builder is fixed to propagate the real unit (carryover, broader scope),
 * we infer the scale from the world-bounds diagonal of the loaded scene:
 *
 *   diagonal in meters     ≈ 10 – 200      (typical building footprint)
 *   diagonal in centimeters ≈ 1_000 – 20_000
 *   diagonal in millimeters ≈ 10_000 – 200_000
 *
 * The thresholds err on the safe side — pathological tiny scenes
 * (< 1 unit) and giant ones (> 5e5) fall back to `'mm'` to preserve the
 * historical default.
 */
export function detectSceneUnits(bounds: {
  min: { x: number; y: number };
  max: { x: number; y: number };
}): SceneUnits {
  const dx = bounds.max.x - bounds.min.x;
  const dy = bounds.max.y - bounds.min.y;
  const diagonal = Math.hypot(dx, dy);
  let detected: SceneUnits;
  if (!Number.isFinite(diagonal) || diagonal <= 0) detected = 'mm';
  else if (diagonal < 1) detected = 'mm';      // unknown / unitless → safe default
  else if (diagonal < 500) detected = 'm';     // 1 – 500 units ≈ meters
  else if (diagonal < 50_000) detected = 'cm'; // 500 – 50k units ≈ centimeters
  else detected = 'mm';                        // 50k+ ≈ millimeters
  // ADR-358 Phase 8 unit-aware builder — diagnostic log (temporary). Remove
  // once `dxf-scene-builder` is fixed to propagate the real $INSUNITS.
  // eslint-disable-next-line no-console
  console.info('[StairTool] detectSceneUnits', { dx, dy, diagonal, detected });
  return detected;
}

// ─── Param overrides accepted by builders ────────────────────────────────────

/**
 * Field overrides for `buildDefaultStairParams`. Dynamic Input supplies
 * rise/tread/width/stepCount; Phase 6.5 (Q26) adds `codeProfile` so callers
 * can trigger the ADA auto-default pacchetto, `nokSubType` for NOK κύρια vs
 * δευτερεύουσα, plus selective handrail / contrastStrip / occupancyLoad
 * overrides that survive the ADA auto-default.
 */
export interface StairParamOverrides {
  readonly rise?: number;
  readonly tread?: number;
  readonly width?: number;
  readonly stepCount?: number;
  readonly codeProfile?: StairCodeProfile;
  readonly nokSubType?: StairNokSubType;
  readonly handrails?: Partial<StairParams['handrails']>;
  readonly adaContrastStrip?: boolean;
  readonly occupancyLoad?: number;
}

// ─── ADA pacchetto coherent (Phase 6.5, Q26 / §3.6) ──────────────────────────

/** ADA top horizontal handrail extension (ICC A117.1 §505 — 12" = 305mm). */
const ADA_TOP_EXTENSION_MM = 305;
/** ADA handrail height — code-compliant midpoint of [864, 965] mm range. */
const ADA_HANDRAIL_HEIGHT_MM = 900;

function buildHandrails(
  codeProfile: StairCodeProfile,
  override: Partial<StairParams['handrails']> | undefined,
): StairParams['handrails'] {
  if (codeProfile === 'ada') {
    return {
      inner: override?.inner ?? true,
      outer: override?.outer ?? true,
      height: override?.height ?? ADA_HANDRAIL_HEIGHT_MM,
      topExtension: override?.topExtension ?? ADA_TOP_EXTENSION_MM,
      bottomExtension: override?.bottomExtension ?? 'one-tread',
    };
  }
  return {
    inner: override?.inner ?? true,
    outer: override?.outer ?? true,
    height: override?.height ?? DEFAULT_HANDRAIL_HEIGHT_MM,
    ...(override?.topExtension !== undefined ? { topExtension: override.topExtension } : {}),
    ...(override?.bottomExtension !== undefined
      ? { bottomExtension: override.bottomExtension }
      : {}),
  };
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
  sceneUnits: SceneUnits = 'mm',
): StairParams {
  const s = mmToSceneUnits(sceneUnits);
  // Dynamic Input overrides arrive already in the scene units the user typed
  // (panel labels reflect the current scene units), so they are NOT re-scaled
  // here. Only the mm-baked defaults need converting.
  const rise = overrides.rise ?? DEFAULT_RISE_MM * s;
  const tread = overrides.tread ?? DEFAULT_TREAD_MM * s;
  const width = overrides.width ?? DEFAULT_WIDTH_MM * s;
  // eslint-disable-next-line no-console
  console.info('[StairTool] buildDefaultStairParams', { sceneUnits, scale: s, rise, tread, width });
  const stepCount = overrides.stepCount ?? DEFAULT_STEP_COUNT;
  const codeProfile: StairCodeProfile = overrides.codeProfile ?? 'nok';
  const base3D: Point3D = { x: basePoint.x, y: basePoint.y, z: 0 };
  const variant: StairVariantParams = { kind: 'straight' };
  const adaContrastStrip =
    overrides.adaContrastStrip ?? (codeProfile === 'ada' ? true : false);
  const handrailsBuilt = buildHandrails(codeProfile, overrides.handrails);
  // Scale handrail height (always mm in `buildHandrails`) into scene units
  // when the caller did not explicitly override it.
  const handrailsScaled: StairParams['handrails'] = overrides.handrails?.height !== undefined
    ? handrailsBuilt
    : { ...handrailsBuilt, height: handrailsBuilt.height * s };
  return {
    basePoint: base3D,
    direction,
    rise,
    tread,
    nosing: DEFAULT_NOSING_MM * s,
    nosingSide: 'front',
    width,
    stepCount,
    totalRise: rise * stepCount,
    totalRun: tread * (stepCount - 1),
    pitch: Math.atan2(rise, tread) * RAD_TO_DEG,
    structureType: 'monolithic',
    riserType: 'closed',
    antiskidNosing: false,
    adaContrastStrip,
    variant,
    walklineOffset: DEFAULT_WALKLINE_OFFSET_MM * s,
    handrails: handrailsScaled,
    upDirection: 'forward',
    treadNumberStart: 1,
    treadLabelDisplay: 'all',
    treadLabelRestartPerFlight: false,
    codeProfile,
    nokSubType: overrides.nokSubType ?? (codeProfile === 'nok' ? 'main' : undefined),
    ...(overrides.occupancyLoad !== undefined
      ? { occupancyLoad: overrides.occupancyLoad }
      : {}),
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
