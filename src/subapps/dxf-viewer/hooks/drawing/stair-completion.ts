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
  StairMultiStoryConfig,
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
const DEFAULT_TREAD_LABEL_HEIGHT_MM = 80;
const RAD_TO_DEG = 180 / Math.PI;

// ─── Scene units → mm scale (Phase 8 unit-aware builder) ────────────────────
//
// Canonical SceneUnits type + helpers live in `utils/scene-units.ts`. This
// module re-exports the type for back-compat with callers that imported it
// from here, and imports the conversion table for the builder below.

import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';
export type { SceneUnits };

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

/**
 * ADR-358 Phase 9 — Floor link input for the default-builder. When supplied
 * AND the floor exposes a numeric `height` (meters), the builder auto-seeds
 * `multiStoryConfig` with `storyHeight = height * 1000` (mm) and
 * `linkedToFloor = true`. Absence of either input keeps `multiStoryConfig`
 * unset (current Phase 7a behavior) so existing callers see no change.
 *
 * Field naming mirrors `FloorMetadata` from `useFloorMetadata`: `floorId`
 * identifies the source (round-trippable to the link source if needed
 * downstream), `name` is used by the ribbon badge.
 */
export interface StairFloorLinkInput {
  readonly floorId: string;
  readonly name: string;
  /** Meters. */
  readonly height: number | null;
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
  floorLink: StairFloorLinkInput | null = null,
): StairParams {
  const s = mmToSceneUnits(sceneUnits);
  // Dynamic Input overrides arrive already in the scene units the user typed
  // (panel labels reflect the current scene units), so they are NOT re-scaled
  // here. Only the mm-baked defaults need converting.
  const rise = overrides.rise ?? DEFAULT_RISE_MM * s;
  const tread = overrides.tread ?? DEFAULT_TREAD_MM * s;
  const width = overrides.width ?? DEFAULT_WIDTH_MM * s;
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
  // ADR-358 Phase 9 — Q17 floor link auto-init. Floor height is stored in
  // meters; storyHeight stays in mm to preserve back-compat with Phase 7a
  // ribbon presets (DEFAULT_STORY_HEIGHT_MM = 2700) and the multiStoryConfig
  // contract documented on `StairMultiStoryConfig.storyHeight`. linkedToFloor
  // is set to `true` here; the bridge flips it to `false` on manual edits.
  const multiStoryConfig: StairMultiStoryConfig | undefined =
    floorLink && typeof floorLink.height === 'number' && floorLink.height > 0
      ? {
          topLevel: floorLink.floorId,
          storyHeight: floorLink.height * 1000,
          storyCount: 1,
          linkedToFloor: true,
        }
      : undefined;
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
    // Default tread label height ≈ readable size (80 mm scaled to scene units).
    treadLabelHeight: DEFAULT_TREAD_LABEL_HEIGHT_MM * s,
    codeProfile,
    nokSubType: overrides.nokSubType ?? (codeProfile === 'nok' ? 'main' : undefined),
    ...(overrides.occupancyLoad !== undefined
      ? { occupancyLoad: overrides.occupancyLoad }
      : {}),
    ...(multiStoryConfig ? { multiStoryConfig } : {}),
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
  levelId: string,
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
    levelId,
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
