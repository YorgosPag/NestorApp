import type { RFQ } from '../types/rfq';
import type { Quote } from '../types/quote';

export type SetupLockState = 'unlocked' | 'awardLocked' | 'poLocked';

/**
 * Derives the Setup tab lock state from RFQ + quotes.
 * poLocked not reachable until purchaseOrderId is added to the RFQ type.
 */
export function deriveSetupLockState(rfq: RFQ | null, quotes: Quote[]): SetupLockState {
  if (!rfq) return 'unlocked';
  if (rfq.winnerQuoteId) return 'awardLocked';
  // quotes param reserved for future: quotes.some(q => q.status === 'accepted')
  void quotes;
  return 'unlocked';
}
