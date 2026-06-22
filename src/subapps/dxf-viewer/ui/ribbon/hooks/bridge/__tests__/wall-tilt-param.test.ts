/**
 * ADR-404 Phase 5b — tests για τον κεκλιμένο τοίχο στο ribbon (`wall-tilt-param`).
 *
 * Επαληθεύει την αμφίδρομη μετάφραση signed `tilt.angle` (1-DOF SSoT) ↔ UI
 * {enabled, side(left/right), magnitude(0..80)}: ότι το πρόσημο = πλευρά, το
 * μέγεθος διατηρεί το πρόσημο, η αλλαγή πλευράς διατηρεί το μέγεθος, και το
 * on/off φτιάχνει/καθαρίζει το tilt. Selected-entity path (μηδέν store dependency).
 */

import type { WallEntity, WallParams } from '../../../../../bim/types/wall-types';
import { WALL_RIBBON_KEYS } from '../wall-command-keys';
import {
  resolveWallTiltComboboxState,
  applyWallTiltComboboxChange,
  TILT_ENABLED_ON,
  TILT_ENABLED_OFF,
  TILT_SIDE_LEFT,
  TILT_SIDE_RIGHT,
} from '../wall-tilt-param';

const ENABLED = WALL_RIBBON_KEYS.tilt.enabled;
const SIDE = WALL_RIBBON_KEYS.tilt.side;
const ANGLE = WALL_RIBBON_KEYS.tilt.angle;

/** Minimal wall — οι resolvers διαβάζουν μόνο `params.tilt` + spread. */
function wallWithTilt(tilt: WallParams['tilt']): WallEntity {
  return { params: { tilt } as WallParams } as unknown as WallEntity;
}

/** Capture του `next.tilt` που γράφεται μέσω dispatchParams. */
function capturePatch(wall: WallEntity, commandKey: string, value: string): WallParams['tilt'] {
  let captured: WallParams['tilt'] = wall.params.tilt;
  applyWallTiltComboboxChange(commandKey, value, wall, (_w, next) => {
    captured = next.tilt;
  });
  return captured;
}

describe('wall-tilt-param — read (signed → UI)', () => {
  it('enabled = off όταν δεν υπάρχει tilt ή γωνία 0', () => {
    expect(resolveWallTiltComboboxState(ENABLED, wallWithTilt(undefined))?.value).toBe(TILT_ENABLED_OFF);
    expect(resolveWallTiltComboboxState(ENABLED, wallWithTilt({ angle: 0 }))?.value).toBe(TILT_ENABLED_OFF);
  });

  it('enabled = on όταν γωνία ≠ 0 (θετική ή αρνητική)', () => {
    expect(resolveWallTiltComboboxState(ENABLED, wallWithTilt({ angle: 15 }))?.value).toBe(TILT_ENABLED_ON);
    expect(resolveWallTiltComboboxState(ENABLED, wallWithTilt({ angle: -15 }))?.value).toBe(TILT_ENABLED_ON);
  });

  it('side = left για θετική, right για αρνητική γωνία', () => {
    expect(resolveWallTiltComboboxState(SIDE, wallWithTilt({ angle: 15 }))?.value).toBe(TILT_SIDE_LEFT);
    expect(resolveWallTiltComboboxState(SIDE, wallWithTilt({ angle: -15 }))?.value).toBe(TILT_SIDE_RIGHT);
    expect(resolveWallTiltComboboxState(SIDE, wallWithTilt(undefined))?.value).toBe(TILT_SIDE_LEFT);
  });

  it('angle = μέγεθος (abs, στρογγυλεμένο)', () => {
    expect(resolveWallTiltComboboxState(ANGLE, wallWithTilt({ angle: -22.4 }))?.value).toBe('22');
    expect(resolveWallTiltComboboxState(ANGLE, wallWithTilt(undefined))?.value).toBe('0');
  });
});

describe('wall-tilt-param — write (UI → signed)', () => {
  it('enabled on → tilt {angle:0}· off → undefined', () => {
    expect(capturePatch(wallWithTilt(undefined), ENABLED, TILT_ENABLED_ON)).toEqual({ angle: 0 });
    expect(capturePatch(wallWithTilt({ angle: 30 }), ENABLED, TILT_ENABLED_OFF)).toBeUndefined();
  });

  it('enabled on διατηρεί υπάρχουσα κλίση', () => {
    expect(capturePatch(wallWithTilt({ angle: -20 }), ENABLED, TILT_ENABLED_ON)).toEqual({ angle: -20 });
  });

  it('side right → αρνητικό πρόσημο, ίδιο μέγεθος', () => {
    expect(capturePatch(wallWithTilt({ angle: 25 }), SIDE, TILT_SIDE_RIGHT)).toEqual({ angle: -25 });
    expect(capturePatch(wallWithTilt({ angle: -25 }), SIDE, TILT_SIDE_LEFT)).toEqual({ angle: 25 });
  });

  it('angle (μέγεθος) διατηρεί το πρόσημο της πλευράς', () => {
    expect(capturePatch(wallWithTilt({ angle: -10 }), ANGLE, '35')).toEqual({ angle: -35 });
    expect(capturePatch(wallWithTilt({ angle: 10 }), ANGLE, '35')).toEqual({ angle: 35 });
  });

  it('angle clamp στο 80', () => {
    expect(capturePatch(wallWithTilt({ angle: 5 }), ANGLE, '120')).toEqual({ angle: 80 });
  });

  it('άκυρη τιμή → no-op (καμία αλλαγή)', () => {
    expect(capturePatch(wallWithTilt({ angle: 12 }), SIDE, 'garbage')).toEqual({ angle: 12 });
    expect(capturePatch(wallWithTilt({ angle: 12 }), ANGLE, 'NaN')).toEqual({ angle: 12 });
  });
});
