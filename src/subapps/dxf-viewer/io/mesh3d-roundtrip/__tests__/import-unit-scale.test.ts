/**
 * ADR-683 §units — `import-unit-scale`: η ρητή μονάδα εισαγωγής ενός glTF/GLB.
 *
 * Δύο πράγματα που ΠΡΕΠΕΙ να μείνουν αληθινά:
 *  1. Ο πίνακας factor **δεν** διπλασιάζεται — είναι ο ίδιος `sceneUnitsToMeters`. Αν κάποιος γράψει
 *     δεύτερο πίνακα που αποκλίνει, αυτό το test κοκκινίζει (αντιπαραβολή με το SSoT).
 *  2. Ένας μη-έγκυρος custom factor δεν εκφυλίζει σιωπηλά την εισαγωγή (πέφτει στο ουδέτερο 1).
 */

import { sceneUnitsToMeters } from '../../../utils/scene-units';
import {
  DEFAULT_IMPORT_UNIT,
  DEFAULT_UNIT_SCALE_FACTOR,
  IMPORT_UNIT_OPTIONS,
  resolveUnitScaleFactor,
  scaleWorldBoxByFactor,
  unitScaleFactor,
} from '../import-unit-scale';

describe('unitScaleFactor — αντανάκλαση του SSoT πίνακα (κανένας δεύτερος)', () => {
  it('κάθε μονάδα δίνει ΑΚΡΙΒΩΣ ό,τι ο sceneUnitsToMeters', () => {
    for (const unit of IMPORT_UNIT_OPTIONS) {
      expect(unitScaleFactor(unit)).toBe(sceneUnitsToMeters(unit));
    }
  });

  it('ίντσες → 0.0254 (44 «μέτρα-εξ-υποθέσεως» → 1.1176 πραγματικά)', () => {
    expect(unitScaleFactor('in')).toBeCloseTo(0.0254, 9);
    expect(44 * unitScaleFactor('in')).toBeCloseTo(1.1176, 6);
  });

  it('η προεπιλογή είναι μέτρα με ουδέτερο factor (σωστά αρχεία ανέγγιχτα)', () => {
    expect(DEFAULT_IMPORT_UNIT).toBe('m');
    expect(unitScaleFactor('m')).toBe(DEFAULT_UNIT_SCALE_FACTOR);
  });
});

describe('resolveUnitScaleFactor — γνωστή μονάδα ή custom', () => {
  it('γνωστή μονάδα → ο πίνακας', () => {
    expect(resolveUnitScaleFactor('mm', 999)).toBe(0.001);
    expect(resolveUnitScaleFactor('ft', 999)).toBeCloseTo(0.3048, 9);
  });

  it('custom → η ωμή τιμή του χρήστη', () => {
    expect(resolveUnitScaleFactor('custom', 2.5)).toBe(2.5);
  });

  it('μη-έγκυρος custom (0/αρνητικός/NaN) → ουδέτερο 1, όχι σιωπηλός εκφυλισμός', () => {
    expect(resolveUnitScaleFactor('custom', 0)).toBe(DEFAULT_UNIT_SCALE_FACTOR);
    expect(resolveUnitScaleFactor('custom', -3)).toBe(DEFAULT_UNIT_SCALE_FACTOR);
    expect(resolveUnitScaleFactor('custom', Number.NaN)).toBe(DEFAULT_UNIT_SCALE_FACTOR);
  });
});

describe('scaleWorldBoxByFactor — θέση ΚΑΙ έδρα κλιμακώνονται συνεπώς', () => {
  it('κέντρο και minY με τον ίδιο factor', () => {
    const scaled = scaleWorldBoxByFactor({ centre: { x: 44, y: 22, z: -10 }, minY: 2 }, 0.0254);
    expect(scaled.centre.x).toBeCloseTo(1.1176, 6);
    expect(scaled.centre.y).toBeCloseTo(0.5588, 6);
    expect(scaled.centre.z).toBeCloseTo(-0.254, 6);
    expect(scaled.minY).toBeCloseTo(0.0508, 6);
  });

  it('factor 1 = ταυτότητα (default μέτρα)', () => {
    const box = { centre: { x: 3, y: 5, z: 7 }, minY: 1 };
    expect(scaleWorldBoxByFactor(box, 1)).toEqual(box);
  });
});
