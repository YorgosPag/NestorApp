/**
 * ADR-479 Slice 2b — user-vs-sync guard του κεντρικού recompute subscriber.
 *
 * @see ../useStructuralSettingsRecompute.ts
 */

import { shouldRecomputeOnSettingsChange } from '../useStructuralSettingsRecompute';

describe('shouldRecomputeOnSettingsChange', () => {
  it('user setter (lastLocalMutationAt 0→Date.now) → recompute', () => {
    expect(shouldRecomputeOnSettingsChange({ lastLocalMutationAt: 1000 }, { lastLocalMutationAt: 0 })).toBe(
      true,
    );
  });

  it('διαδοχικά user edits (διαφορετικά timestamps) → recompute', () => {
    expect(
      shouldRecomputeOnSettingsChange({ lastLocalMutationAt: 2000 }, { lastLocalMutationAt: 1000 }),
    ).toBe(true);
  });

  it('loadForBuilding / server-sync (→0) ΜΕΤΑ από user edit → ΟΧΙ recompute', () => {
    expect(
      shouldRecomputeOnSettingsChange({ lastLocalMutationAt: 0 }, { lastLocalMutationAt: 1500 }),
    ).toBe(false);
  });

  it('initial load (0→0) → ΟΧΙ recompute', () => {
    expect(shouldRecomputeOnSettingsChange({ lastLocalMutationAt: 0 }, { lastLocalMutationAt: 0 })).toBe(
      false,
    );
  });

  it('no-op tick (ίδιο timestamp) → ΟΧΙ recompute (idempotent guard)', () => {
    expect(
      shouldRecomputeOnSettingsChange({ lastLocalMutationAt: 1000 }, { lastLocalMutationAt: 1000 }),
    ).toBe(false);
  });
});
