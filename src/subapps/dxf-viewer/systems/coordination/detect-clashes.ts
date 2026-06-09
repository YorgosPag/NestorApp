/**
 * ADR-435 — clash-detection orchestrator (Slice 0).
 *
 * Pipeline: normalise every scene `Entity` → {@link ClashEntity} (metres) → broad-phase
 * grid → legit-connection filter → narrow-phase exact tests → {@link ClashReport}.
 * Pure & deterministic (no Date/random) so the report is stable and snapshot-testable;
 * the caller (ribbon bridge) stamps wall-clock + drives the transient store.
 *
 * v1 narrow-phase scope (handoff-locked): only pairs that involve a MEP **segment**
 *   - segment ↔ segment      → exact capsule distance (hard + clearance)
 *   - segment ↔ everything    → capsule vs the other's AABB (hard only)
 * Structural↔structural and equipment↔equipment are intentionally not tested in v1.
 *
 * @see ./entity-world-aabb.ts ./broad-phase.ts ./clash-narrow-phase.ts ./clash-rules.ts
 */

import type { Entity } from '../../types/entities';
import type { MepSystemEntity } from '../../bim/types/mep-system-types';
import type { SceneUnits } from '../../utils/scene-units';
import type { Clash, ClashEntity, ClashReport, ClashRule } from './clash-types';
import { entityWorldAABB } from './entity-world-aabb';
import { broadPhasePairs } from './broad-phase';
import { shouldSkipPair } from './clash-pair-filter';
import { closestDistanceBetweenSegments, segmentAabbHit } from './clash-narrow-phase';
import { DEFAULT_CLEARANCE_RULES, hardSeverity, maxClearanceM } from './clash-rules';

const M_TO_MM = 1000;

export interface DetectClashesInput {
  readonly entities: readonly Entity[];
  /** Active-storey MepSystems — for legit-connection filtering (member + source). */
  readonly systems: readonly MepSystemEntity[];
  readonly sceneUnits: SceneUnits;
  /** Override the clearance rule set (defaults to {@link DEFAULT_CLEARANCE_RULES}). */
  readonly clearanceRules?: readonly ClashRule[];
}

/** Map every entity id → the set of MepSystem ids it belongs to (member or source). */
function buildMembershipMap(systems: readonly MepSystemEntity[]): ReadonlyMap<string, string[]> {
  const map = new Map<string, string[]>();
  const add = (entityId: string, systemId: string): void => {
    const cur = map.get(entityId);
    if (cur) cur.push(systemId);
    else map.set(entityId, [systemId]);
  };
  for (const sys of systems) {
    add(sys.params.sourceEntityId, sys.id);
    for (const m of sys.params.members) add(m.entityId, sys.id);
  }
  return map;
}

/** Capsule↔capsule (both MEP segments): hard if touching, else first matching clearance. */
function evaluateSegmentSegment(a: ClashEntity, b: ClashEntity, rules: readonly ClashRule[]): Clash | null {
  if (!a.capsule || !b.capsule) return null;
  const { distM, point } = closestDistanceBetweenSegments(a.capsule.a, a.capsule.b, b.capsule.a, b.capsule.b);
  const contactM = a.capsule.radiusM + b.capsule.radiusM;
  if (distM <= contactM) {
    return makeClash(a, b, 'hard', hardSeverity(a.kind, b.kind), point, (distM - contactM) * M_TO_MM, 'hard-default');
  }
  for (const rule of rules) {
    if (rule.type !== 'clearance' || rule.clearanceMm === undefined || !rule.applies(a, b)) continue;
    if (distM <= contactM + rule.clearanceMm * 0.001) {
      return makeClash(a, b, 'clearance', rule.severity, point, (distM - contactM) * M_TO_MM, rule.id);
    }
  }
  return null;
}

/** Capsule↔AABB (segment vs structural/equipment/fitting): hard only in v1. */
function evaluateSegmentBox(seg: ClashEntity, box: ClashEntity): Clash | null {
  if (!seg.capsule) return null;
  const hit = segmentAabbHit(seg.capsule.a, seg.capsule.b, box.aabb, seg.capsule.radiusM);
  if (!hit) return null;
  return makeClash(seg, box, 'hard', hardSeverity(seg.kind, box.kind), hit.point, 0, 'hard-default');
}

function makeClash(
  a: ClashEntity, b: ClashEntity, type: Clash['type'], severity: Clash['severity'],
  point: Clash['point'], separationMm: number, ruleId: string,
): Clash {
  return { id: `${a.id}__${b.id}__${ruleId}`, aId: a.id, bId: b.id, aKind: a.kind, bKind: b.kind, type, severity, point, separationMm, ruleId };
}

/** Dispatch a candidate pair to the right narrow-phase test (v1 = segment-centric). */
function evaluatePair(a: ClashEntity, b: ClashEntity, rules: readonly ClashRule[]): Clash | null {
  const aSeg = a.kind === 'mep-segment';
  const bSeg = b.kind === 'mep-segment';
  if (aSeg && bSeg) return evaluateSegmentSegment(a, b, rules);
  if (aSeg) return evaluateSegmentBox(a, b);
  if (bSeg) return evaluateSegmentBox(b, a);
  return null; // neither is a segment → not tested in v1
}

/** Run a full detection pass over a storey's entities + systems. */
export function detectClashes(input: DetectClashesInput): ClashReport {
  const membership = buildMembershipMap(input.systems);
  const clashEntities: ClashEntity[] = [];
  // Normalise each entity ONCE. The level scene can contain the same id twice (e.g. a
  // fitting referenced by two runs); without this guard those duplicates produce
  // identical clash pairs → inflated counts + non-unique `Clash.id`.
  const seenIds = new Set<string>();
  for (const e of input.entities) {
    if (seenIds.has(e.id)) continue;
    seenIds.add(e.id);
    const ce = entityWorldAABB(e, input.sceneUnits, membership.get(e.id) ?? []);
    if (ce) clashEntities.push(ce);
  }

  const rules = input.clearanceRules ?? DEFAULT_CLEARANCE_RULES;
  const broad = broadPhasePairs(clashEntities, maxClearanceM(rules));

  const clashes: Clash[] = [];
  let testedPairs = 0;
  for (const [i, j] of broad.pairs) {
    const a = clashEntities[i];
    const b = clashEntities[j];
    if (shouldSkipPair(a, b)) continue;
    if (a.kind !== 'mep-segment' && b.kind !== 'mep-segment') continue;
    testedPairs++;
    const clash = evaluatePair(a, b, rules);
    if (clash) clashes.push(clash);
  }

  return { clashes, scannedEntities: clashEntities.length, candidatePairs: broad.pairs.length, testedPairs };
}
