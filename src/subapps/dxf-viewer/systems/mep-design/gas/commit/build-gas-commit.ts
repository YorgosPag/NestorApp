/**
 * ADR-431 Slice 2 / ADR-606 — Gas (fuel) commit **builder** (pure).
 *
 * Thin binding over `createMepNetworkCommitBuilder` (ADR-606): each `ProposedFuelSegment`
 * → a round **fuel** run (`domain: 'fuel'`, override `{ sectionKind: 'round', diameter }`
 * — classification lives on the system, not the fuel segment), and one `MepSystem` per
 * network on the fuel-network params seeded with the SSoT palette colour. The whole
 * network runs flat at the source outlet's elevation ("Connect To"). Fittings are inserted
 * by the auto-reconciler once segments land — not here.
 *
 * @see ../../shared/create-mep-network-commit-builder.ts — the parametric single source
 */

import { buildDefaultFuelNetworkParams } from '../../../../bim/types/mep-system-types';
import { fuelClassificationDefaultColor } from '../../../../bim/mep-systems/mep-system-color';
import {
  createMepNetworkCommitBuilder,
  flatNetworkElevations,
  roundDiameterOverride,
  type MepNetworkCommitPlan,
  type ResolveMepSystemName,
} from '../../shared/create-mep-network-commit-builder';
import type { ProposedFuelNetwork } from '../gas-design-types';

/** The concrete entities a gas accept transaction will create. */
export type GasCommitPlan = MepNetworkCommitPlan;
/** Resolves a gas system display name (i18n lives in the caller). */
export type ResolveSystemName = ResolveMepSystemName<ProposedFuelNetwork>;

/** Build the full gas commit plan for a reviewed proposal. Pure. */
export const buildGasCommit = createMepNetworkCommitBuilder<
  ProposedFuelNetwork,
  ProposedFuelNetwork['segments'][number]
>({
  domain: 'fuel',
  buildSegmentOverride: roundDiameterOverride,
  resolveSegmentElevations: flatNetworkElevations,
  buildSystemParams: (network, index, members, resolveName) =>
    buildDefaultFuelNetworkParams(
      resolveName(network, index),
      network.classification,
      network.sourceEntityId,
      network.sourceConnectorId,
      members,
      fuelClassificationDefaultColor(network.classification),
    ),
});
