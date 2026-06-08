/**
 * ADR-422 L6 — tests για τα ΚΕΝΑΚ όρια κελύφους (kenak-envelope-limits).
 * jest globals (describe/it/expect) — ΟΧΙ vitest import.
 *
 * Επιβεβαιώνει: το mapping `(kind, condition, zone) → U_max` ανά στοιχείο/ζώνη,
 * το gate εξωτ. κελύφους (γειτονικά/μη-θερμαινόμενα → null), και το soft predicate.
 */

import {
  getKenakMaxU,
  isAboveKenakBoundaryUMax,
  KENAK_MAX_U_ROOF,
  KENAK_MAX_U_FLOOR_GROUND,
  KENAK_MAX_U_OPENING,
} from '../kenak-envelope-limits';
import { KENAK_MAX_U_WALL } from '../../kenak-thermal-config';

describe('getKenakMaxU', () => {
  it('maps external-air walls/openings/roof to per-zone U_max', () => {
    expect(getKenakMaxU('wall', 'external-air', 'B')).toBe(KENAK_MAX_U_WALL.B);
    expect(getKenakMaxU('window', 'external-air', 'B')).toBe(KENAK_MAX_U_OPENING.B);
    expect(getKenakMaxU('door', 'external-air', 'B')).toBe(KENAK_MAX_U_OPENING.B);
    expect(getKenakMaxU('roof', 'external-air', 'B')).toBe(KENAK_MAX_U_ROOF.B);
  });

  it('maps ground floor to the floor-ground limit', () => {
    expect(getKenakMaxU('floor', 'ground', 'C')).toBe(KENAK_MAX_U_FLOOR_GROUND.C);
  });

  it('gates out boundaries that are not part of the external envelope', () => {
    // γειτονικός θερμαινόμενος / μη-θερμαινόμενος → εκτός ΚΕΝΑΚ
    expect(getKenakMaxU('wall', 'adjacent-heated', 'B')).toBeNull();
    expect(getKenakMaxU('wall', 'unheated', 'B')).toBeNull();
    // δάπεδο/οροφή προς εξωτ. αέρα που δεν χαρτογραφείται ρητά → null (ασφαλές skip)
    expect(getKenakMaxU('floor', 'external-air', 'B')).toBeNull();
    expect(getKenakMaxU('ceiling', 'external-air', 'B')).toBeNull();
    // δάπεδο όχι σε επαφή με έδαφος → null
    expect(getKenakMaxU('floor', 'adjacent-heated', 'B')).toBeNull();
  });

  it('returns stricter limits for colder zones (D ≤ A)', () => {
    expect(KENAK_MAX_U_ROOF.D).toBeLessThan(KENAK_MAX_U_ROOF.A);
    expect(KENAK_MAX_U_OPENING.D).toBeLessThan(KENAK_MAX_U_OPENING.A);
    expect(KENAK_MAX_U_FLOOR_GROUND.D).toBeLessThan(KENAK_MAX_U_FLOOR_GROUND.A);
  });
});

describe('isAboveKenakBoundaryUMax', () => {
  it('flags only U strictly above the limit (soft, inclusive at the limit)', () => {
    expect(isAboveKenakBoundaryUMax(0.6, 0.45)).toBe(true);
    expect(isAboveKenakBoundaryUMax(0.45, 0.45)).toBe(false); // ίσο ⇒ συμμορφούμενο
    expect(isAboveKenakBoundaryUMax(0.3, 0.45)).toBe(false);
  });
});
