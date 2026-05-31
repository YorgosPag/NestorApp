/**
 * ADR-396 v2 Φ6a — wall-param-helpers ETICS envelopeFunction read/patch tests.
 *
 * Ο τοίχος δρομολογεί το override μέσω των helpers (όχι inline όπως column/beam),
 * οπότε επιβεβαιώνουμε εδώ το read auto↔undefined + patch set/clear/no-op.
 */

import type { WallParams } from '../../../../../bim/types/wall-types';
import { WALL_RIBBON_KEYS } from '../wall-command-keys';
import { readWallStringField, patchWallStringParam } from '../wall-param-helpers';

const envKey = WALL_RIBBON_KEYS.stringParams.envelopeFunction;

// Ελάχιστο WallParams — οι helpers διαβάζουν μόνο category/flip/material/envelopeFunction.
function makeParams(envelopeFunction?: 'exterior' | 'interior'): WallParams {
  return { category: 'exterior', envelopeFunction } as unknown as WallParams;
}

describe('wall-param-helpers — envelopeFunction read', () => {
  it('undefined → auto sentinel', () => {
    expect(readWallStringField(envKey, makeParams(undefined))).toBe('auto');
  });

  it('ρητή τιμή → η ίδια', () => {
    expect(readWallStringField(envKey, makeParams('exterior'))).toBe('exterior');
    expect(readWallStringField(envKey, makeParams('interior'))).toBe('interior');
  });
});

describe('wall-param-helpers — envelopeFunction patch', () => {
  it("set 'interior'", () => {
    const next = patchWallStringParam(makeParams(undefined), envKey, 'interior');
    expect(next?.envelopeFunction).toBe('interior');
  });

  it("'auto' clears the field (undefined)", () => {
    const next = patchWallStringParam(makeParams('exterior'), envKey, 'auto');
    expect(next).not.toBeNull();
    expect(next?.envelopeFunction).toBeUndefined();
  });

  it('invalid value → null (no-op)', () => {
    expect(patchWallStringParam(makeParams(undefined), envKey, 'bogus')).toBeNull();
  });
});
