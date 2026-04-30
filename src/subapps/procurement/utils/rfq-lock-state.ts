import type { RFQ } from '../types/rfq';
import { RFQ_LIFECYCLE_LOCKED_STATUSES } from '../types/rfq';
import type { Quote } from '../types/quote';

export type SetupLockState = 'unlocked' | 'awardLocked' | 'poLocked' | 'lifecycleLocked';

/**
 * Derives the Setup tab lock state from RFQ + quotes.
 * lifecycleLocked = closed | cancelled | archived (ADR-335 read-only enforcement).
 * poLocked not reachable until purchaseOrderId is added to the RFQ type.
 */
export function deriveSetupLockState(rfq: RFQ | null, quotes: Quote[]): SetupLockState {
  if (!rfq) return 'unlocked';
  if (RFQ_LIFECYCLE_LOCKED_STATUSES.has(rfq.status)) return 'lifecycleLocked';
  if (rfq.winnerQuoteId) return 'awardLocked';
  void quotes;
  return 'unlocked';
}
