/**
 * ADR-426 Slice 2 / ADR-606 — Water-supply commit **builder** (pure).
 *
 * Thin binding over `createMepNetworkCommitBuilder` (ADR-606): each `ProposedSegment` →
 * a round **pipe** (`domain: 'pipe'`) carrying `{ classification, diameter }` on the
 * segment, and one `MepSystem` per network on the shared pipe-network params. The whole
 * network runs flat at the source outlet's elevation ("Connect To"). Fittings are
 * inserted by the auto-reconciler once segments land — not here.
 *
 * @see ../../shared/create-mep-network-commit-builder.ts — the parametric single source
 */

import {
  createMepNetworkCommitBuilder,
  flatPressurisedPipeConfig,
  type MepNetworkCommitPlan,
  type ResolveMepSystemName,
} from '../../shared/create-mep-network-commit-builder';
import type { ProposedNetwork } from '../water-design-types';

/** The concrete entities a water-supply accept transaction will create. */
export type WaterSupplyCommitPlan = MepNetworkCommitPlan;
/** Resolves a water system display name (i18n lives in the caller). */
export type ResolveSystemName = ResolveMepSystemName<ProposedNetwork>;

/** Build the full water-supply commit plan for a reviewed proposal. Pure. */
export const buildWaterSupplyCommit = createMepNetworkCommitBuilder(
  flatPressurisedPipeConfig<ProposedNetwork, ProposedNetwork['segments'][number]>(),
);
