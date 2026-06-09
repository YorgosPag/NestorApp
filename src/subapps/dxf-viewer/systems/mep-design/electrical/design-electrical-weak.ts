/**
 * ADR-431 — Electrical-WEAK (ασθενή) Auto-Design orchestrator (Slice 1, headless).
 *
 * The sibling of `design-electrical-strong.ts`, composing the SAME stages over the Stage 0
 * `RecognitionModel`, with the weak descriptor:
 *   Source resolve (comms-rack) → Demand (ports per outlet) → skip already-channelled
 *   → Grouping (shared bin-packer: split by service, group by zone, bin-pack under the
 *   port budget) → Sizing (90 m channel-length check) → `WeakNetworkProposal` of N
 *   channels — pure data, no canvas, no commit. NO phase balancing, NO segments (the home
 *   run is derived at render). A missing comms-rack is a warning, not an error.
 *
 * Non-destructive: outlets already wired to a weak channel are left untouched and counted,
 * so re-running never clobbers manual channels.
 *
 * @see ./design-electrical-strong.ts (the strong counterpart / structure template)
 * @see ./electrical-weak-discipline.ts (parameters: demand/grouping/sizing standards)
 */

import type { Entity } from '../../../types/entities';
import type { RecognitionModel } from '../../recognition/recognition-types';
import type { MepSystemEntity } from '../../../bim/types/mep-system-types';
import { isElectricalSystemParams } from '../../../bim/types/mep-system-types';
import { sceneUnitsToMeters, type SceneUnits } from '../../../utils/scene-units';
import { groupIntoCircuits } from './circuit-grouping-core';
import { resolveElectricalSource } from './electrical-source-resolve';
import { buildWeakDemandModel } from './electrical-weak-demand';
import { sizeWeakChannel } from './electrical-weak-sizing';
import {
  ELECTRICAL_WEAK_DISCIPLINE,
  type ElectricalWeakDiscipline,
} from './electrical-weak-discipline';
import {
  WEAK_SERVICE_CLASSIFICATION,
  type ProposedWeakChannel,
  type WeakNetworkProposal,
} from './electrical-weak-design-types';

/** `(entityId, connectorId)` member identity key. */
function memberKey(entityId: string, connectorId: string): string {
  return `${entityId}::${connectorId}`;
}

/** Set of member keys already wired to a WEAK (data/controls) channel. */
function channelledMembers(existingSystems: readonly MepSystemEntity[]): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const sys of existingSystems) {
    if (!isElectricalSystemParams(sys.params)) continue;
    const c = sys.params.systemClassification;
    if (c !== 'data' && c !== 'controls') continue;
    for (const m of sys.params.members) keys.add(memberKey(m.entityId, m.connectorId));
  }
  return keys;
}

/**
 * Design the electrical-weak channels for a recognized storey. Slice 1 is headless: returns
 * the proposal (no entities emitted, nothing persisted). `existingSystems` lets the engine
 * skip already-channelled outlets (non-destructive); `sceneUnits` feeds the channel length.
 */
export function designElectricalWeak(
  model: RecognitionModel,
  entities: readonly Entity[],
  existingSystems: readonly MepSystemEntity[],
  sceneUnits: SceneUnits,
  discipline: ElectricalWeakDiscipline = ELECTRICAL_WEAK_DISCIPLINE,
): WeakNetworkProposal {
  const warnings: string[] = [];
  const source = resolveElectricalSource(entities, discipline.sourceClassifications);
  if (!source) {
    warnings.push('no comms-rack recognized — no channels generated');
    return { channels: [], warnings, storeyId: model.storeyId, skippedAlreadyCircuited: 0 };
  }

  const allDemands = buildWeakDemandModel(model, discipline.demandStandard).demands;
  const channelled = channelledMembers(existingSystems);
  const fresh = allDemands.filter((d) => !channelled.has(memberKey(d.entityId, d.connectorId)));
  const skippedAlreadyCircuited = allDemands.length - fresh.length;
  if (fresh.length === 0) {
    warnings.push(`no un-channelled weak terminals (${skippedAlreadyCircuited} already wired)`);
    return { channels: [], warnings, storeyId: model.storeyId, skippedAlreadyCircuited };
  }

  const groups = groupIntoCircuits(fresh, discipline.groupingStandard);
  const sceneToM = sceneUnitsToMeters(sceneUnits);
  const channels: ProposedWeakChannel[] = groups.map((group, i) => {
    const sizing = sizeWeakChannel(group, source.point, sceneToM, discipline.sizingStandard);
    if (sizing.channelLengthExceeded) {
      warnings.push(
        `${group.service} channel ${i + 1}: length ${sizing.channelLengthM.toFixed(1)} m exceeds 90 m permanent-link limit`,
      );
    }
    return {
      service: group.service,
      classification: WEAK_SERVICE_CLASSIFICATION[group.service],
      sourceEntityId: source.entityId,
      sourceConnectorId: source.connectorId,
      members: group.members,
      memberCount: group.members.length,
      connectedPorts: group.connectedLoad,
      cableType: sizing.cableType,
      channelLengthM: sizing.channelLengthM,
      channelLengthExceeded: sizing.channelLengthExceeded,
      ...(group.spaceId ? { spaceId: group.spaceId } : {}),
    };
  });

  return { channels, warnings, storeyId: model.storeyId, skippedAlreadyCircuited };
}
