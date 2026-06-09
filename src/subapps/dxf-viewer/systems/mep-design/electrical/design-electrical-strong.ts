/**
 * ADR-430 — Electrical-strong (ισχυρά) Auto-Design orchestrator (Slice 1, headless).
 *
 * Composes the stages over the Stage 0 `RecognitionModel`:
 *   Source resolve (panel) → Demand (VA per terminal) → skip already-circuited (non-destructive)
 *   → Grouping (the brain: split by service, group by zone, bin-pack under limits) → Phase
 *   balance (LPT) → Sizing (conductor/breaker + voltage drop) → `ElectricalNetworkProposal` of
 *   N circuits — pure data, no canvas, no commit. NO segments are produced (the wire is derived
 *   at render from each circuit's source + members). A missing panel is a warning, not an error.
 *
 * Non-destructive (Revit "auto-create circuits"): terminals already wired to a circuit are left
 * untouched and counted, so re-running never clobbers manual circuits.
 *
 * @see ../../recognition/index.ts (RecognitionModel input)
 * @see ./electrical-strong-discipline.ts (parameters: demand/grouping/sizing standards)
 * @see ../heating/design-heating.ts (the pipe-discipline orchestrator / structure template)
 */

import type { Entity } from '../../../types/entities';
import type { RecognitionModel } from '../../recognition/recognition-types';
import type { MepSystemEntity } from '../../../bim/types/mep-system-types';
import { isElectricalSystemParams } from '../../../bim/types/mep-system-types';
import { sceneUnitsToMeters, type SceneUnits } from '../../../utils/scene-units';
import {
  ELECTRICAL_SERVICE_CLASSIFICATION,
  type ElectricalNetworkProposal,
  type ProposedCircuit,
} from './electrical-design-types';
import {
  ELECTRICAL_STRONG_DISCIPLINE,
  type ElectricalStrongDiscipline,
} from './electrical-strong-discipline';
import { buildElectricalDemandModel } from './electrical-demand';
import { groupIntoCircuits, balancePhases } from './electrical-circuit-grouping';
import { sizeCircuit } from './electrical-sizing';
import { resolveElectricalPanelSource } from './electrical-source-resolve';

/** `(entityId, connectorId)` member identity key. */
function memberKey(entityId: string, connectorId: string): string {
  return `${entityId}::${connectorId}`;
}

/** Set of member keys already wired to an electrical circuit (Revit single-circuit rule). */
function circuitedMembers(existingSystems: readonly MepSystemEntity[]): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const sys of existingSystems) {
    if (!isElectricalSystemParams(sys.params)) continue;
    for (const m of sys.params.members) keys.add(memberKey(m.entityId, m.connectorId));
  }
  return keys;
}

/**
 * Design the electrical-strong circuits for a recognized storey. Slice 1 is headless: returns
 * the proposal (no entities emitted, nothing persisted). `existingSystems` lets the engine skip
 * already-circuited terminals (non-destructive); `sceneUnits` feeds the voltage-drop length.
 */
export function designElectricalStrong(
  model: RecognitionModel,
  entities: readonly Entity[],
  existingSystems: readonly MepSystemEntity[],
  sceneUnits: SceneUnits,
  discipline: ElectricalStrongDiscipline = ELECTRICAL_STRONG_DISCIPLINE,
): ElectricalNetworkProposal {
  const warnings: string[] = [];
  const source = resolveElectricalPanelSource(entities);
  if (!source) {
    warnings.push('no electrical panel recognized — no circuits generated');
    return { circuits: [], warnings, storeyId: model.storeyId, skippedAlreadyCircuited: 0 };
  }

  const allDemands = buildElectricalDemandModel(model, discipline.demandStandard).demands;
  const circuited = circuitedMembers(existingSystems);
  const fresh = allDemands.filter((d) => !circuited.has(memberKey(d.entityId, d.connectorId)));
  const skippedAlreadyCircuited = allDemands.length - fresh.length;
  if (fresh.length === 0) {
    warnings.push(
      `no un-circuited electrical terminals (${skippedAlreadyCircuited} already wired)`,
    );
    return { circuits: [], warnings, storeyId: model.storeyId, skippedAlreadyCircuited };
  }

  const groups = groupIntoCircuits(fresh, discipline.groupingStandard);
  const phases = balancePhases(groups, discipline.groupingStandard.phases);
  const sceneToM = sceneUnitsToMeters(sceneUnits);
  const circuits: ProposedCircuit[] = groups.map((group, i) => {
    const sizing = sizeCircuit(
      group,
      source.point,
      sceneToM,
      discipline.demandStandard.nominalVoltage,
      discipline.sizingStandard,
    );
    if (sizing.voltageDropExceeded) {
      warnings.push(
        `${group.service} circuit ${i + 1}: voltage drop ${sizing.voltageDropPercent.toFixed(1)}% exceeds limit`,
      );
    }
    return {
      service: group.service,
      classification: ELECTRICAL_SERVICE_CLASSIFICATION[group.service],
      sourceEntityId: source.entityId,
      sourceConnectorId: source.connectorId,
      members: group.members,
      memberCount: group.members.length,
      connectedLoadVa: group.connectedLoad,
      breakerAmp: sizing.breakerAmp,
      conductorMm2: sizing.conductorMm2,
      phase: phases[i],
      voltageDropPercent: sizing.voltageDropPercent,
      voltageDropExceeded: sizing.voltageDropExceeded,
      ...(group.spaceId ? { spaceId: group.spaceId } : {}),
    };
  });

  return { circuits, warnings, storeyId: model.storeyId, skippedAlreadyCircuited };
}
