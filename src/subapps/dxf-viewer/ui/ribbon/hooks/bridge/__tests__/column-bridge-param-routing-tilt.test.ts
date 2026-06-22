/**
 * ADR-404 Φ5 — tests για το nested `tilt` routing του column ribbon bridge.
 *
 * Επαληθεύει ότι τα `tiltAngle`/`tiltDirection` δρομολογούνται στο `params.tilt`
 * και — κρίσιμο — ότι το `ColumnTilt` μένει ΠΛΗΡΕΣ (και τα δύο πεδία) όταν ο
 * χρήστης ορίζει μόνο γωνία ή μόνο φορά (default 0 στο απών).
 */

import type { ColumnParams } from '../../../../../bim/types/column-types';
import { COLUMN_RIBBON_KEYS } from '../column-command-keys';
import {
  NESTED_NUMBER_KEY_TO_PATH,
  isNestedNumberKey,
  patchNestedParams,
  readNestedValue,
} from '../column-bridge-param-routing';

// Minimal params — οι routing helpers διαβάζουν μόνο το `params.tilt` + spread.
const baseParams = { kind: 'rectangular' } as unknown as ColumnParams;

const ANGLE_KEY = COLUMN_RIBBON_KEYS.params.tiltAngle;
const DIR_KEY = COLUMN_RIBBON_KEYS.params.tiltDirection;

describe('column bridge param routing — tilt group', () => {
  it('tiltAngle / tiltDirection είναι nested keys', () => {
    expect(isNestedNumberKey(ANGLE_KEY)).toBe(true);
    expect(isNestedNumberKey(DIR_KEY)).toBe(true);
    expect(NESTED_NUMBER_KEY_TO_PATH[ANGLE_KEY]).toEqual({ group: 'tilt', field: 'angle', defaultValue: 0 });
    expect(NESTED_NUMBER_KEY_TO_PATH[DIR_KEY]).toEqual({ group: 'tilt', field: 'direction', defaultValue: 0 });
  });

  it('patch γωνίας σε flat κολώνα → tilt πλήρες {direction:0, angle}', () => {
    const next = patchNestedParams(baseParams, NESTED_NUMBER_KEY_TO_PATH[ANGLE_KEY], 15);
    expect(next.tilt).toEqual({ direction: 0, angle: 15 });
  });

  it('patch φοράς διατηρεί την υπάρχουσα γωνία (immutable merge)', () => {
    const withAngle = patchNestedParams(baseParams, NESTED_NUMBER_KEY_TO_PATH[ANGLE_KEY], 20);
    const withBoth = patchNestedParams(withAngle, NESTED_NUMBER_KEY_TO_PATH[DIR_KEY], 90);
    expect(withBoth.tilt).toEqual({ direction: 90, angle: 20 });
  });

  it('read επιστρέφει default 0 όταν απουσιάζει tilt', () => {
    expect(readNestedValue(baseParams, NESTED_NUMBER_KEY_TO_PATH[ANGLE_KEY])).toBe(0);
    expect(readNestedValue(baseParams, NESTED_NUMBER_KEY_TO_PATH[DIR_KEY])).toBe(0);
  });

  it('read επιστρέφει τις αποθηκευμένες τιμές tilt', () => {
    const tilted = { ...baseParams, tilt: { direction: 45, angle: 30 } } as ColumnParams;
    expect(readNestedValue(tilted, NESTED_NUMBER_KEY_TO_PATH[ANGLE_KEY])).toBe(30);
    expect(readNestedValue(tilted, NESTED_NUMBER_KEY_TO_PATH[DIR_KEY])).toBe(45);
  });
});
