/**
 * ADR-430 Slice 2 — Electrical-strong commit **builder** (pure).
 *
 * Turns a reviewed `ElectricalNetworkProposal` into the concrete circuit entities the
 * accept transaction will create — WITHOUT touching the scene, the command history,
 * React, or Firestore. Unlike the pipe disciplines there are NO segments: each
 * `ProposedCircuit` becomes ONE geometry-less `MepSystem` (an electrical circuit, Revit
 * "Circuit"), and the home-run wire is derived at render from its source + members.
 *
 * Per circuit:
 *   - a `MepElectricalSystemParams` with the grouped classification (lighting / power),
 *     the panel source, the member terminal connectors, the nominal voltage / single pole,
 *     and the System colour (lighting amber / socket blue, the ghost's colour too).
 *   - a fresh enterprise `MepSystem` id (`mepsys_*`), minted here so create/undo/redo are
 *     id-stable AND the id matches the ghost wire path built at Generate.
 *
 * Keeping this pure makes the "Generate → accept" translation unit-testable in isolation;
 * the ribbon bridge wraps the systems in `CreateMepSystemCommand`s inside one
 * `CompoundCommand` (a single atomic undo).
 *
 * @see ../design-electrical-strong.ts (producer of the proposal)
 * @see ../../heating/commit/build-heating-commit.ts (the pipe counterpart / template)
 */

import { generateMepSystemId } from '@/services/enterprise-id-convenience';
import type {
  MepElectricalSystemParams,
  MepSystemEntity,
} from '../../../../bim/types/mep-system-types';
import {
  ELECTRICAL_CLASSIFICATION_COLOR,
  type ElectricalNetworkProposal,
  type ProposedCircuit,
} from '../electrical-design-types';

/** Nominal circuit voltage (V) stamped on each committed circuit (HD 384 single-phase). */
const NOMINAL_VOLTAGE = 230;

/** The concrete entities an accept transaction will create — one MepSystem per circuit. */
export interface ElectricalCommitPlan {
  readonly systemEntities: readonly MepSystemEntity[];
}

/** Resolves a circuit display name (i18n lives in the caller — keep the builder pure). */
export type ResolveElectricalCircuitName = (
  circuit: ProposedCircuit,
  index: number,
) => string;

/** Build one circuit's `MepSystem` entity (geometry-less; members = its terminals). */
function buildCircuitSystem(
  circuit: ProposedCircuit,
  index: number,
  resolveName: ResolveElectricalCircuitName,
): MepSystemEntity {
  const params: MepElectricalSystemParams = {
    systemType: 'electrical-circuit',
    name: resolveName(circuit, index),
    systemClassification: circuit.classification,
    sourceEntityId: circuit.sourceEntityId,
    sourceConnectorId: circuit.sourceConnectorId,
    members: circuit.members,
    ratedVoltage: NOMINAL_VOLTAGE,
    poles: 1,
    color: ELECTRICAL_CLASSIFICATION_COLOR[circuit.classification],
  };
  return { id: generateMepSystemId(), params };
}

/**
 * Build the full commit plan for a reviewed proposal. Pure — no side effects. One MepSystem
 * per proposed circuit (no segments — wiring is derived at render).
 */
export function buildElectricalCommit(
  proposal: ElectricalNetworkProposal,
  resolveName: ResolveElectricalCircuitName,
): ElectricalCommitPlan {
  const systemEntities = proposal.circuits.map((circuit, index) =>
    buildCircuitSystem(circuit, index, resolveName),
  );
  return { systemEntities };
}
