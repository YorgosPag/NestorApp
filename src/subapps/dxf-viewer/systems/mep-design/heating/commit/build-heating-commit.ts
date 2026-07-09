/**
 * ADR-428 Slice 2 / ADR-606 — Heating (hydronic) commit **builder** (pure).
 *
 * Thin binding over `createMepNetworkCommitBuilder` (ADR-606): each `ProposedHeatingSegment`
 * → a round **pipe** (`domain: 'pipe'`) carrying `{ classification, diameter }`, and one
 * `MepSystem` per network (flow + return) on the shared pipe-network params. The whole
 * network runs flat at the source outlet's elevation ("Connect To"). Fittings are inserted
 * by the auto-reconciler once segments land — not here.
 *
 * @see ../../shared/create-mep-network-commit-builder.ts — the parametric single source
 */

import {
  createMepNetworkCommitBuilder,
  flatPressurisedPipeConfig,
  type MepNetworkCommitPlan,
  type ResolveMepSystemName,
} from '../../shared/create-mep-network-commit-builder';
import type { ProposedHeatingNetwork } from '../heating-design-types';

/** The concrete entities a heating accept transaction will create. */
export type HeatingCommitPlan = MepNetworkCommitPlan;
/** Resolves a heating system display name (i18n lives in the caller). */
export type ResolveHeatingSystemName = ResolveMepSystemName<ProposedHeatingNetwork>;

/** Build the full heating commit plan for a reviewed proposal. Pure. */
export const buildHeatingCommit = createMepNetworkCommitBuilder(
  flatPressurisedPipeConfig<ProposedHeatingNetwork, ProposedHeatingNetwork['segments'][number]>(),
);
