/**
 * ADR-432 Slice 2 / ADR-606 — HVAC (ventilation) commit **builder** (pure).
 *
 * Thin binding over `createMepNetworkCommitBuilder` (ADR-606): each `ProposedDuctSegment`
 * → a round **duct** run (`domain: 'duct'`, override `{ sectionKind: 'round', diameter }`
 * — a duct carries no classification; the system owns the air class), and one `MepSystem`
 * (Revit "System Type" Supply Air) per network on the duct-network params seeded with the
 * SSoT palette colour. The whole network runs flat at the AHU outlet's elevation
 * ("Connect To"). Fittings are inserted by the auto-reconciler once segments land — not here.
 *
 * @see ../../shared/create-mep-network-commit-builder.ts — the parametric single source
 */

import { buildDefaultDuctNetworkParams } from '../../../../bim/types/mep-system-types';
import { ductClassificationDefaultColor } from '../../../../bim/mep-systems/mep-system-color';
import {
  createMepNetworkCommitBuilder,
  flatNetworkElevations,
  roundDiameterOverride,
  type MepNetworkCommitPlan,
  type ResolveMepSystemName,
} from '../../shared/create-mep-network-commit-builder';
import type { ProposedDuctNetwork } from '../hvac-design-types';

/** The concrete entities an HVAC accept transaction will create. */
export type HvacCommitPlan = MepNetworkCommitPlan;
/** Resolves an HVAC system display name (i18n lives in the caller). */
export type ResolveSystemName = ResolveMepSystemName<ProposedDuctNetwork>;

/** Build the full HVAC commit plan for a reviewed proposal. Pure. */
export const buildHvacCommit = createMepNetworkCommitBuilder<
  ProposedDuctNetwork,
  ProposedDuctNetwork['segments'][number]
>({
  domain: 'duct',
  buildSegmentOverride: roundDiameterOverride,
  resolveSegmentElevations: flatNetworkElevations,
  buildSystemParams: (network, index, members, resolveName) =>
    buildDefaultDuctNetworkParams(
      resolveName(network, index),
      network.classification,
      network.sourceEntityId,
      network.sourceConnectorId,
      members,
      ductClassificationDefaultColor(network.classification),
    ),
});
