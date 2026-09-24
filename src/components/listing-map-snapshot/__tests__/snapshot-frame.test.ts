/**
 * @jest-environment node
 *
 * @fileoverview 🗺️ **ΑΓΚΥΡΑ — ο αριθμός του ζουμ και η κλάση του καμβά λένε ΤΟ ΙΔΙΟ κουτί.** (ADR-777 §8.70 Φ2 · §8.80)
 * @related components/listing-map-snapshot/snapshot-frame.ts
 */

import { LISTING_CARD_ASPECT } from '@/components/search-results/listing-card-frame';

import { SNAPSHOT_VIEWPORT, STAGE_FRAME } from '../snapshot-frame';

describe('snapshot-frame', () => {
  it('η κλάση Tailwind έχει ΑΚΡΙΒΩΣ τις διαστάσεις του SNAPSHOT_VIEWPORT', () => {
    expect(STAGE_FRAME.split(' ').sort()).toEqual(
      [`h-[${SNAPSHOT_VIEWPORT.heightPx}px]`, `w-[${SNAPSHOT_VIEWPORT.widthPx}px]`].sort(),
    );
  });

  it('ο λόγος είναι ΤΟΥ ΠΛΑΙΣΙΟΥ ΤΗΣ ΚΑΡΤΑΣ — όχι δικός του αριθμός', () => {
    expect(SNAPSHOT_VIEWPORT.widthPx / SNAPSHOT_VIEWPORT.heightPx).toBeCloseTo(
      LISTING_CARD_ASPECT.w / LISTING_CARD_ASPECT.h,
      5,
    );
  });

  it('ακέραια pixel — ο καμβάς δεν έχει μισά', () => {
    expect(Number.isInteger(SNAPSHOT_VIEWPORT.widthPx)).toBe(true);
    expect(Number.isInteger(SNAPSHOT_VIEWPORT.heightPx)).toBe(true);
  });
});
