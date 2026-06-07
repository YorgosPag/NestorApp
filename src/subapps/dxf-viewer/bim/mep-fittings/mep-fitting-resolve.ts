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
import { isMepSegmentEntity } from '../../types/entities';
import type { SceneUnits } from '../../utils/scene-units';
import type {
  ElbowStyle,
  MepFittingDraft,
  MepFittingIncident,
  MepFittingKind,
  MepFittingParams,
} from '../types/mep-fitting-types';
import { DEFAULT_ELBOW_STYLE, incidentEntityId, mepFittingIfcType } from '../types/mep-fitting-types';
import type { PlumbingSystemClassification } from '../types/mep-connector-types';
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

/**
 * ADR-408 Φ14 — index `pipe segment id → its plumbing classification`, the input
 * for {@link resolveFittingClassification}. Pure: only `'pipe'` segments that carry
 * a defined `classification` are indexed (ducts + unclassified pipes are absent, so
 * their fittings inherit nothing). Built once per resolve.
 */
export function buildPipeClassificationIndex(
  entities: readonly Entity[],
): ReadonlyMap<string, PlumbingSystemClassification> {
  const index = new Map<string, PlumbingSystemClassification>();
  for (const e of entities) {
    if (isMepSegmentEntity(e) && e.params.domain === 'pipe' && e.params.classification) {
      index.set(e.id, e.params.classification);
    }
  }
  return index;
}

/**
 * ADR-408 Φ14 — the plumbing classification a fitting inherits from the pipes it
 * joins (Revit: "a fitting follows the system of its connectors"). Pure SSoT, the
 * point-based counterpart of how a segment carries its own `classification`.
 *
 * Looks up every NON-host incident pipe's classification from `index`. Drainage
 * wins in a mixed node — it is the only classification with its own V/G bucket
 * (`'drain-pipe'`), so a node touching any drainage run reads as drainage. Otherwise
 * (generic Revit-true inheritance) it takes the first classification present — all
 * non-drainage pipes meeting at one node share a system, so any of them is correct.
 * Returns `undefined` when no incident pipe is classified (a plain water-only node).
 */
export function resolveFittingClassification(
  incidents: readonly MepFittingIncident[],
  index: ReadonlyMap<string, PlumbingSystemClassification>,
): PlumbingSystemClassification | undefined {
  const classes = incidents
    .filter((i) => !i.host)
    .map((i) => index.get(incidentEntityId(i)))
    .filter((c): c is PlumbingSystemClassification => c !== undefined);
  if (classes.length === 0) return undefined;
  if (classes.includes('sanitary-drainage')) return 'sanitary-drainage';
  return classes[0];
}

/** Build the params for one classified junction. */
function buildParams(
  junction: PipeJunction,
  kind: MepFittingKind,
  classification: FittingClassification,
  opts: ResolveFittingsOptions,
  inheritedClassification: PlumbingSystemClassification | undefined,
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
  const withElbow =
    elbowStyle !== undefined ? { ...withSecondary, elbowStyle } : withSecondary;
  // The inherited classification is NEVER part of the junctionKey (idempotency
  // anchor) — only of the params, so re-classifying a pipe updates the persisted
  // fitting in place (one-time, no create/delete churn).
  return inheritedClassification !== undefined
    ? { ...withElbow, classification: inheritedClassification }
    : withElbow;
}

/** Build a draft from a classified junction. Returns null when the kind is null. */
function toDraft(
  junction: PipeJunction,
  opts: ResolveFittingsOptions,
  classByEntityId: ReadonlyMap<string, PlumbingSystemClassification>,
): MepFittingDraft | null {
  const classification = classifyJunction(junction);
  if (classification.kind === null) return null;

  const inheritedClassification = resolveFittingClassification(junction.incidents, classByEntityId);
  const params = buildParams(junction, classification.kind, classification, opts, inheritedClassification);
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
  // A fitting MUST share the pipe network's canvas-unit scale, else its plan
  // footprint is computed in the wrong unit (e.g. mm-square in a metre scene =
  // a giant box). Inherit `sceneUnits` from the first pipe segment unless the
  // caller overrides it.
  const effectiveOpts: ResolveFittingsOptions = {
    ...opts,
    sceneUnits: opts.sceneUnits ?? sceneUnitsFromSegments(entities),
  };
  // ADR-408 Φ14 — index pipe classifications once, so each fitting inherits the
  // classification of the pipes it joins (Revit "fitting follows its connectors").
  const classByEntityId = buildPipeClassificationIndex(entities);
  return derivePipeJunctions(entities)
    .map((junction) => toDraft(junction, effectiveOpts, classByEntityId))
    .filter((draft): draft is MepFittingDraft => draft !== null);
}

/** First pipe segment's `sceneUnits` — the network's canvas-unit scale. */
function sceneUnitsFromSegments(entities: readonly Entity[]): SceneUnits | undefined {
  for (const e of entities) {
    const candidate = e as { type?: string; params?: { domain?: string; sceneUnits?: SceneUnits } };
    if (candidate.type === 'mep-segment' && candidate.params?.domain === 'pipe' && candidate.params.sceneUnits) {
      return candidate.params.sceneUnits;
    }
  }
  return undefined;
}
