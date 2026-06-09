/**
 * ADR-431 — Electrical-WEAK (ασθενή) Auto-Design: types (SSoT).
 *
 * The weak-current discipline is the sibling of electrical-strong (ADR-430): identical
 * output model — N LOGICAL **channels** (`MepSystem`s), NOT physical segments; the home
 * run is derived at render from `source + members`. It differs only in:
 *   - source = comms-rack (out connector `'data'`), not the power panel,
 *   - "load" = ports (structured-cabling links), not VA,
 *   - sizing = channel length ≤ 90 m permanent link (ISO/IEC 11801), not voltage drop,
 *   - no phase balancing (a star topology homed at the rack, no 3-phase pole).
 *
 * So the engine produces a **`WeakNetworkProposal`** of N `ProposedWeakChannel`s, and
 * Slice 2's commit turns each into one geometry-less `MepSystem` (classification data /
 * controls), reusing the strong proposal-store / ghost / `CreateMepSystemCommand`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-431-electrical-weak-auto-design.md
 * @see ./electrical-design-types.ts (the electrical-strong counterpart / template)
 */

import type { ElectricalSystemClassification } from '../../../bim/types/mep-connector-types';
import type { MepSystemMember } from '../../../bim/types/mep-system-types';

/** The weak-current services auto-designed at v1 (data = structured cabling, controls = BMS/security). */
export type WeakCircuitService = 'data' | 'controls';

/** SSoT map weak service ↔ the electrical system classification its channel carries. */
export const WEAK_SERVICE_CLASSIFICATION: Readonly<
  Record<WeakCircuitService, ElectricalSystemClassification>
> = {
  data: 'data',
  controls: 'controls',
};

/** Structured-cabling cable category stamped on a channel (ISO/IEC 11801). */
export type WeakCableType = 'Cat6' | 'Cat6A';

/**
 * A proposed weak-current channel (a future `MepSystem`): a set of member outlets fed
 * from the comms-rack, with its grouped service, sized cable type and advisory channel
 * length. NO geometry — the home run is derived at render from `source + members`.
 */
export interface ProposedWeakChannel {
  readonly service: WeakCircuitService;
  readonly classification: ElectricalSystemClassification;
  /** The comms-rack that sources this channel (Revit "Communication Source"). */
  readonly sourceEntityId: string;
  readonly sourceConnectorId: string;
  /** Member outlet connectors `(entityId, connectorId)` — the channel membership truth. */
  readonly members: readonly MepSystemMember[];
  readonly memberCount: number;
  /** Σ of the members' ports — the connected port count (the bin-pack budget). */
  readonly connectedPorts: number;
  /** Structured-cabling cable category (Cat6 / Cat6A) from the grouping rule. */
  readonly cableType: WeakCableType;
  /** Advisory home-run channel length (m) to the worst member — checked against 90 m. */
  readonly channelLengthM: number;
  /** `true` when the channel length exceeds the permanent-link limit (advisory, not a block). */
  readonly channelLengthExceeded: boolean;
  /** The Stage-0 space this channel serves (for naming); absent ⇒ unzoned. */
  readonly spaceId?: string;
}

/** The Slice-1 deliverable: the proposed weak-current channels + honest warnings. */
export interface WeakNetworkProposal {
  readonly channels: readonly ProposedWeakChannel[];
  /** e.g. "no comms-rack recognized — no channels generated". */
  readonly warnings: readonly string[];
  readonly storeyId: string;
  /** Outlets left untouched because already wired to a channel (non-destructive). */
  readonly skippedAlreadyCircuited: number;
}
