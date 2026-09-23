/**
 * @jest-environment node
 *
 * @fileoverview 🗺️ **ΑΓΚΥΡΑ — ο αριθμός του ζουμ και η κλάση του καμβά λένε ΤΟ ΙΔΙΟ κουτί.** (ADR-777 §8.70 Φ2)
 * @related components/listing-map-snapshot/snapshot-frame.ts
 */

import { SNAPSHOT_VIEWPORT, STAGE_FRAME } from '../snapshot-frame';

describe('snapshot-frame', () => {
  it('η κλάση Tailwind έχει ΑΚΡΙΒΩΣ τις διαστάσεις του SNAPSHOT_VIEWPORT', () => {
    expect(STAGE_FRAME.split(' ').sort()).toEqual(
      [`h-[${SNAPSHOT_VIEWPORT.heightPx}px]`, `w-[${SNAPSHOT_VIEWPORT.widthPx}px]`].sort(),
    );
  });

  it('4:3, όπως το κουτί της κάρτας (`aspect-[4/3]`)', () => {
    expect(SNAPSHOT_VIEWPORT.widthPx / SNAPSHOT_VIEWPORT.heightPx).toBeCloseTo(4 / 3, 5);
  });
});
