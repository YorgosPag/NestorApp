/**
 * ADR-408 Φ10 — derive pipe networks from physical connectivity (SSoT, pure).
 *
 * A plumbing run is a **physical** network: two pipe segments belong to the same
 * system when their endpoints touch (Revit auto-creates a Piping System from the
 * connected graph). This is the inverse of the electrical circuit, which is a
 * **logical** selection (panel + chosen fixtures). Here membership is geometry:
 * walk the segment endpoints, union segments whose endpoints coincide (within a
 * small tolerance), and emit one network draft per connected component.
 *
 * Pure: no store / Firestore / React / command. Returns the data a
 * `CreateMepSystemCommand` needs (via `buildDefaultPipeNetworkParams`); the
 * ribbon bridge turns each draft into an undoable command. Mirrors
 * `mep-circuit-from-selection.ts`, but the grouping key is topology, not selection.
 *
 * Scope: **pipe** segments only (plumbing). Duct (air) grouping is a separate
 * future system — ducts carry no `PlumbingSystemClassification`.
 *
 * @see ./mep-circuit-from-selection.ts — the electrical (logical) counterpart
 * @see ../types/mep-system-types.ts — buildDefaultPipeNetworkParams
 * @see ../mep-segments/mep-segment-connectors.ts — endpoint connector ids
 * @see docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md §Φ10
 */

import type { Entity } from '../../types/entities';
import { isMepSegmentEntity } from '../../types/entities';
import type { MepSegmentEntity } from '../types/mep-segment-types';
import type { MepSystemMember } from '../types/mep-system-types';
import type { PlumbingSystemClassification } from '../types/mep-connector-types';
import {
  SEGMENT_START_CONNECTOR_ID,
  SEGMENT_END_CONNECTOR_ID,
} from '../types/mep-connector-types';
import { mmToSceneUnits, type SceneUnits } from '../../utils/scene-units';

/**
 * Fallback proximity (scene units) for a scene with no segments to read units
 * from. Real derivations use the UNIT-AWARE `resolvePipeJoinTolerance` instead.
 */
export const DEFAULT_PIPE_JOIN_TOLERANCE = 1;

/**
 * Physical proximity (mm) under which two pipe endpoints count as connected.
 * ~half a small DN50 pipe — tight enough that a short run's own two ends never
 * merge into one junction, loose enough to absorb snap/float jitter.
 */
export const PIPE_JOIN_TOLERANCE_MM = 25;

/** Scene-unit scale of the pipe network — read from the first `mep-segment`. */
function sceneUnitsFromSegments(entities: readonly Entity[]): SceneUnits {
  for (const e of entities) {
    if (isMepSegmentEntity(e) && e.params.sceneUnits) return e.params.sceneUnits;
  }
  return 'mm';
}

/**
 * Unit-aware join tolerance (scene units): the 25mm physical threshold expressed
 * in the scene's OWN units. Critical — a raw `1`-unit tolerance is 1 METRE in a
 * metre scene, which merged a short pipe's two endpoints into one junction
 * (spurious cross/tee) and collapsed distinct nodes onto one quantized
 * `junctionKey` (un-deletable orphan fittings). The mm-based value scales
 * correctly across mm / cm / m scenes. (ADR-408 Φ11 hotfix.)
 */
export function resolvePipeJoinTolerance(entities: readonly Entity[]): number {
  return PIPE_JOIN_TOLERANCE_MM * mmToSceneUnits(sceneUnitsFromSegments(entities));
}

/**
 * Default classification for a freshly derived network — a just-drawn pipe
 * carries no hydraulic sub-type, so we assume domestic cold water; the user
 * re-classifies via the circuit-management UI (Φ5/Φ6 reuse).
 */
export const DEFAULT_DERIVED_PIPE_CLASSIFICATION: PlumbingSystemClassification =
  'domestic-cold-water';

/** One connected pipe network resolved from the scene topology. */
export interface PipeNetworkDraft {
  /** Hydraulic sub-type (default cold-water until the user classifies). */
  readonly systemClassification: PlumbingSystemClassification;
  /** Deterministic root: the lexicographically-smallest segment's start connector. */
  readonly sourceEntityId: string;
  readonly sourceConnectorId: string;
  /** Every endpoint connector of every segment in the component (membership truth). */
  readonly members: readonly MepSystemMember[];
  /** The segment ids forming this component (sorted, for naming / dedupe). */
  readonly segmentIds: readonly string[];
}

interface Endpoint {
  readonly x: number;
  readonly y: number;
}

function endpointsOf(seg: MepSegmentEntity): readonly Endpoint[] {
  return [
    { x: seg.params.startPoint.x, y: seg.params.startPoint.y },
    { x: seg.params.endPoint.x, y: seg.params.endPoint.y },
  ];
}

function touches(a: MepSegmentEntity, b: MepSegmentEntity, tol: number): boolean {
  const tol2 = tol * tol;
  for (const pa of endpointsOf(a)) {
    for (const pb of endpointsOf(b)) {
      const dx = pa.x - pb.x;
      const dy = pa.y - pb.y;
      if (dx * dx + dy * dy <= tol2) return true;
    }
  }
  return false;
}

/** Union-find root with path compression. */
function find(parent: number[], i: number): number {
  let root = i;
  while (parent[root] !== root) root = parent[root]!;
  while (parent[i] !== root) {
    const next = parent[i]!;
    parent[i] = root;
    i = next;
  }
  return root;
}

/**
 * Group connected **pipe** segments into network drafts. Pure & deterministic:
 * segments are processed in id order, members and components are sorted, so the
 * same scene always yields the same drafts (stable for undo/redo + tests).
 *
 * A lone segment forms a single-segment network (it is still a valid run). Duct
 * segments are ignored (no plumbing classification).
 */
export function derivePipeNetworks(
  entities: readonly Entity[],
  tolerance?: number,
  defaultClassification: PlumbingSystemClassification = DEFAULT_DERIVED_PIPE_CLASSIFICATION,
): PipeNetworkDraft[] {
  const tol = tolerance ?? resolvePipeJoinTolerance(entities);
  const segments = entities
    .filter(isMepSegmentEntity)
    .filter((s) => s.params.domain === 'pipe')
    .sort((a, b) => a.id.localeCompare(b.id));

  if (segments.length === 0) return [];

  // Union segments whose endpoints touch.
  const parent = segments.map((_, i) => i);
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      if (touches(segments[i]!, segments[j]!, tol)) {
        parent[find(parent, j)] = find(parent, i);
      }
    }
  }

  // Bucket segment indices by component root.
  const components = new Map<number, MepSegmentEntity[]>();
  for (let i = 0; i < segments.length; i++) {
    const root = find(parent, i);
    const bucket = components.get(root) ?? [];
    bucket.push(segments[i]!);
    components.set(root, bucket);
  }

  const drafts: PipeNetworkDraft[] = [];
  for (const bucket of components.values()) {
    const sorted = bucket.slice().sort((a, b) => a.id.localeCompare(b.id));
    const members: MepSystemMember[] = sorted.flatMap((seg) => [
      { entityId: seg.id, connectorId: SEGMENT_START_CONNECTOR_ID },
      { entityId: seg.id, connectorId: SEGMENT_END_CONNECTOR_ID },
    ]);
    const root = sorted[0]!;
    drafts.push({
      systemClassification: defaultClassification,
      sourceEntityId: root.id,
      sourceConnectorId: SEGMENT_START_CONNECTOR_ID,
      members,
      segmentIds: sorted.map((s) => s.id),
    });
  }

  return drafts;
}
