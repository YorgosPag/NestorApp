/**
 * ADR-431 — Stage 3 Sizing (weak): structured-cabling channel length check (SSoT, pluggable).
 *
 * Each formed channel already carries its cable category from the grouping rule (Cat6 /
 * Cat6A). This stage adds the **permanent-link length** verification — the defining
 * structured-cabling constraint (ISO/IEC 11801 / TIA-568): a horizontal channel must not
 * exceed **90 m** (the 100 m channel less the patch/equipment cords). The home-run length
 * is the shared daisy-chain (the same `daisyChainLengthM` the strong voltage drop uses,
 * the topology the renderer draws), so the advisory matches the drawn home run.
 *
 * Advisory only (like the strong voltage-drop readout): an exceeded length is flagged,
 * never a hard block. Pure — no store / React / Date / Math.random.
 *
 * @see ./circuit-grouping-core.ts (the shared `daisyChainLengthM` home-run length)
 * @see ./electrical-sizing.ts (the strong voltage-drop counterpart / template)
 */

import type { Point2D } from '../../../rendering/types/Types';
import { daisyChainLengthM } from './circuit-grouping-core';
import type { WeakCableType } from './electrical-weak-design-types';
import type { WeakCircuitGroup } from './electrical-weak-grouping';

/** A pluggable weak sizing standard: the structured-cabling permanent-link length limit. */
export interface WeakSizingStandard {
  readonly id: string;
  /** Max permanent-link channel length (m) — ISO/IEC 11801 horizontal = 90 m. */
  readonly maxChannelLengthM: number;
}

/** The pilot weak sizing standard (ISO/IEC 11801 — 90 m permanent link). */
export const ISO11801_SIZING_STANDARD: WeakSizingStandard = {
  id: 'ISO11801/channel-90m',
  maxChannelLengthM: 90,
};

/** The result of sizing one channel (cable category + the length check). */
export interface WeakChannelSizing {
  readonly cableType: WeakCableType;
  readonly channelLengthM: number;
  readonly channelLengthExceeded: boolean;
}

/**
 * Size one weak channel: the cable category comes from its grouping rule; the channel
 * length is the home-run daisy-chain to the farthest outlet, checked against the
 * standard's 90 m permanent-link limit.
 */
export function sizeWeakChannel(
  group: WeakCircuitGroup,
  source: Point2D,
  sceneToM: number,
  standard: WeakSizingStandard,
): WeakChannelSizing {
  const channelLengthM = daisyChainLengthM(source, group.points, sceneToM);
  return {
    cableType: group.rule.cableType,
    channelLengthM,
    channelLengthExceeded: channelLengthM > standard.maxChannelLengthM,
  };
}
