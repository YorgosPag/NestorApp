/**
 * ADR-433 Slice 2 / ADR-606 — Fire-protection (sprinkler) commit **builder** (pure).
 *
 * Thin binding over `createMepNetworkCommitBuilder` (ADR-606): each `ProposedSegment` →
 * a round **pipe** (`domain: 'pipe'`) carrying `{ classification: 'fire-sprinkler',
 * diameter }` on the segment, and one `MepSystem` (Revit "System Type" Fire Protection)
 * per network on the SAME existing pipe-network params the water/heating networks use.
 * The whole network runs flat at the riser outlet's elevation ("Connect To"). Fittings
 * are inserted by the auto-reconciler once segments land — not here.
 *
 * @see ../../shared/create-mep-network-commit-builder.ts — the parametric single source
 * @see ./../design-fire.ts (producer of the proposal)
 */

import {
  createMepNetworkCommitBuilder,
  flatPressurisedPipeConfig,
  type MepNetworkCommitPlan,
  type ResolveMepSystemName,
} from '../../shared/create-mep-network-commit-builder';
import type { ProposedNetwork } from '../fire-design-types';

/** The concrete entities a fire accept transaction will create. */
export type FireCommitPlan = MepNetworkCommitPlan;
/** Resolves a fire system display name (i18n lives in the caller). */
export type ResolveSystemName = ResolveMepSystemName<ProposedNetwork>;

/** Build the full fire-protection commit plan for a reviewed proposal. Pure. */
export const buildFireCommit = createMepNetworkCommitBuilder(
  flatPressurisedPipeConfig<ProposedNetwork, ProposedNetwork['segments'][number]>(),
);
