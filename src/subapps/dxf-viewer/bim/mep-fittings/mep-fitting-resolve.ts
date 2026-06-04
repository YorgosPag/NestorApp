/**
 * ADR-408 Φ11 — resolve the desired pipe fittings for a scene (SSoT, pure).
 *
 * The top-level pure pipeline that ties Φ11 together (Revit "auto-place fittings"):
 *
 *   derivePipeJunctions(entities)            // endpoint coincidence → nodes
 *     → classifyJunction(junction)           // node topology → fitting kind
 *       → computeMepFittingGeometry(params)   // params → plan + bbox + BOQ
 *         → MepFittingDraft                   // params + geometry + validation
 *
 * The output is the **desired** set of fittings — what the scene's pipe network
 * *should* have. The host persistence layer diffs this against the persisted
 * fittings (by `junctionKey`) to create / update / delete, and assigns the
 * enterprise id (`generateMepFittingId`) — id generation is not pure, so drafts
 * carry no id.
 *
 * Deterministic & idempotent: junctions are sorted by key, drafts inherit that
 * order, and a junction's `key` is invariant to sub-tolerance jitter — so the same
 * scene always produces the same draft set (replay-safe diffing, stable tests).
 *
 * Pure: no store / Firestore / React / command.
 *
 * @see ../mep-systems/mep-pipe-junctions.ts — derivePipeJunctions
 * @see ./mep-fitting-classify.ts — classifyJunction
 * @see ../geometry/mep-fitting-geometry.ts — computeMepFittingGeometry
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ11
 */

import type { Entity } from '../../types/entities';
import type { SceneUnits } from '../../utils/scene-units';
import type {
  ElbowStyle,
  MepFittingDraft,
  MepFittingKind,
  MepFittingParams,
} from '../types/mep-fitting-types';
import { DEFAULT_ELBOW_STYLE, mepFittingIfcType } from '../types/mep-fitting-types';
import { makeBimValidation } from '../types/bim-base';
import { derivePipeJunctions } from '../mep-systems/mep-pipe-junctions';
import type { PipeJunction } from '../mep-systems/mep-pipe-junctions';
import { classifyJunction } from './mep-fitting-classify';
import type { FittingClassification } from './mep-fitting-classify';
import { computeMepFittingGeometry } from '../geometry/mep-fitting-geometry';

/** Options for `resolveDesiredFittings`. */
export interface ResolveFittingsOptions {
  /** DXF canvas unit, stored on params for geometry conversion. Defaults to 'mm'. */
  readonly sceneUnits?: SceneUnits;
  /** Elbow bend style applied to derived elbows. Defaults to `radiused`. */
  readonly defaultElbowStyle?: ElbowStyle;
}

/** Build the params for one classified junction. */
function buildParams(
  junction: PipeJunction,
  kind: MepFittingKind,
  classification: FittingClassification,
  opts: ResolveFittingsOptions,
): MepFittingParams {
  const elbowStyle =
    kind === 'elbow'
      ? classification.elbowStyle ?? opts.defaultElbowStyle ?? DEFAULT_ELBOW_STYLE
      : undefined;

  const base: MepFittingParams = {
    domain: 'pipe',
    kind,
    junctionKey: junction.key,
    position: junction.position,
    centerlineElevationMm: junction.centerlineElevationMm,
    incidents: junction.incidents,
    primaryDiameterMm: classification.primaryDiameterMm,
    sceneUnits: opts.sceneUnits ?? 'mm',
  };

  // Conditionally attach optional fields (exactOptionalPropertyTypes-safe).
  const withSecondary =
    classification.secondaryDiameterMm !== undefined
      ? { ...base, secondaryDiameterMm: classification.secondaryDiameterMm }
      : base;
  return elbowStyle !== undefined ? { ...withSecondary, elbowStyle } : withSecondary;
}

/** Build a draft from a classified junction. Returns null when the kind is null. */
function toDraft(junction: PipeJunction, opts: ResolveFittingsOptions): MepFittingDraft | null {
  const classification = classifyJunction(junction);
  if (classification.kind === null) return null;

  const params = buildParams(junction, classification.kind, classification, opts);
  return {
    params,
    geometry: computeMepFittingGeometry(params),
    validation: makeBimValidation(),
    ifcType: mepFittingIfcType('pipe'),
    kind: classification.kind,
  };
}

/**
 * Resolve the desired pipe fittings for the scene. Pure & deterministic — junction
 * order (sorted by key) carries through to the draft list, and unclassifiable
 * junctions (≥5 incidents) are skipped. The host diffs this set by `junctionKey`.
 */
export function resolveDesiredFittings(
  entities: readonly Entity[],
  opts: ResolveFittingsOptions = {},
): MepFittingDraft[] {
  return derivePipeJunctions(entities)
    .map((junction) => toDraft(junction, opts))
    .filter((draft): draft is MepFittingDraft => draft !== null);
}
