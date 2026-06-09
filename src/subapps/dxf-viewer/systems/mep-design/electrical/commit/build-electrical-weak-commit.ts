/**
 * ADR-431 Slice 2 — Electrical-WEAK commit **builder** (pure).
 *
 * Turns a reviewed `WeakNetworkProposal` into the concrete channel entities the accept
 * transaction will create — WITHOUT touching the scene, history, React, or Firestore.
 * Like the strong builder there are NO segments: each `ProposedWeakChannel` becomes ONE
 * geometry-less `MepSystem` (a structured-cabling channel), and the home-run wire is
 * derived at render from its source + members. Unlike the strong builder it stamps NO
 * voltage / poles (a weak-current channel has none — those fields are optional).
 *
 * @see ../design-electrical-weak.ts (producer of the proposal)
 * @see ./build-electrical-commit.ts (the strong counterpart / template)
 */

import { generateMepSystemId } from '@/services/enterprise-id-convenience';
import type {
  MepElectricalSystemParams,
  MepSystemEntity,
} from '../../../../bim/types/mep-system-types';
import { ELECTRICAL_CLASSIFICATION_COLOR } from '../electrical-design-types';
import type { ProposedWeakChannel, WeakNetworkProposal } from '../electrical-weak-design-types';

/** The concrete entities an accept transaction will create — one MepSystem per channel. */
export interface WeakCommitPlan {
  readonly systemEntities: readonly MepSystemEntity[];
}

/** Resolves a channel display name (i18n lives in the caller — keep the builder pure). */
export type ResolveWeakChannelName = (channel: ProposedWeakChannel, index: number) => string;

/** Build one channel's `MepSystem` entity (geometry-less; members = its outlets). */
function buildChannelSystem(
  channel: ProposedWeakChannel,
  index: number,
  resolveName: ResolveWeakChannelName,
): MepSystemEntity {
  const params: MepElectricalSystemParams = {
    systemType: 'electrical-circuit',
    name: resolveName(channel, index),
    systemClassification: channel.classification,
    sourceEntityId: channel.sourceEntityId,
    sourceConnectorId: channel.sourceConnectorId,
    members: channel.members,
    color: ELECTRICAL_CLASSIFICATION_COLOR[channel.classification],
  };
  return { id: generateMepSystemId(), params };
}

/**
 * Build the full commit plan for a reviewed weak proposal. Pure — no side effects. One
 * MepSystem per proposed channel (no segments — wiring is derived at render).
 */
export function buildWeakCommit(
  proposal: WeakNetworkProposal,
  resolveName: ResolveWeakChannelName,
): WeakCommitPlan {
  const systemEntities = proposal.channels.map((channel, index) =>
    buildChannelSystem(channel, index, resolveName),
  );
  return { systemEntities };
}
