/**
 * Tests — Floor Naming SSoT (ADR-369 §9 Q9) — Phase A1
 */

import {
  generateAutoShortName,
  generateAutoLongName,
  inferKindFromNumber,
  isFloorKind,
  FLOOR_KIND_VALUES,
  type FloorKind,
} from '../floor-naming';

describe('floor-naming', () => {
  // ─── generateAutoShortName ────────────────────────────────────────────────

  describe('generateAutoShortName', () => {
    it('foundation → "F"', () => {
      expect(generateAutoShortName('foundation', 0)).toBe('F');
      expect(generateAutoShortName('foundation', -10)).toBe('F'); // number ignored
    });

    it('roof → "R"', () => {
      expect(generateAutoShortName('roof', 0)).toBe('R');
      expect(generateAutoShortName('roof', 99)).toBe('R'); // number ignored
    });

    it('ground → "GF"', () => {
      expect(generateAutoShortName('ground', 0)).toBe('GF');
    });

    it('standard → "L{n}"', () => {
      for (let n = 1; n <= 50; n++) {
        expect(generateAutoShortName('standard', n)).toBe(`L${n}`);
      }
    });

    it('basement → "B{|n|}" with min 1', () => {
      expect(generateAutoShortName('basement', -1)).toBe('B1');
      expect(generateAutoShortName('basement', -2)).toBe('B2');
      expect(generateAutoShortName('basement', -5)).toBe('B5');
      expect(generateAutoShortName('basement', 0)).toBe('B1');
    });

    it('mezzanine → "M{n}" with min 1', () => {
      expect(generateAutoShortName('mezzanine', 1)).toBe('M1');
      expect(generateAutoShortName('mezzanine', 2)).toBe('M2');
      expect(generateAutoShortName('mezzanine', 0)).toBe('M1');
    });
  });

  // ─── generateAutoLongName (Greek canonical) ───────────────────────────────

  describe('generateAutoLongName — fixed labels', () => {
    it('foundation → "Θεμελίωση"', () => {
      expect(generateAutoLongName('foundation', 0)).toBe('Θεμελίωση');
    });

    it('roof → "Δώμα"', () => {
      expect(generateAutoLongName('roof', 0)).toBe('Δώμα');
    });

    it('ground → "Ισόγειο"', () => {
      expect(generateAutoLongName('ground', 0)).toBe('Ισόγειο');
    });
  });

  describe('generateAutoLongName — standard ordinals 1-50', () => {
    it.each(Array.from({ length: 50 }, (_, i) => i + 1))(
      'floor %i → "%iος Όροφος"',
      (n) => {
        expect(generateAutoLongName('standard', n)).toBe(`${n}ος Όροφος`);
      },
    );
  });

  describe('generateAutoLongName — basement', () => {
    it('-1 → "Υπόγειο"', () => {
      expect(generateAutoLongName('basement', -1)).toBe('Υπόγειο');
    });

    it('-2 → "2ο Υπόγειο"', () => {
      expect(generateAutoLongName('basement', -2)).toBe('2ο Υπόγειο');
    });

    it('-5 → "5ο Υπόγειο"', () => {
      expect(generateAutoLongName('basement', -5)).toBe('5ο Υπόγειο');
    });

    it('0 fallback → "Υπόγειο" (level 1)', () => {
      expect(generateAutoLongName('basement', 0)).toBe('Υπόγειο');
    });
  });

  describe('generateAutoLongName — mezzanine', () => {
    it('1 → "Μεσοπάτωμα"', () => {
      expect(generateAutoLongName('mezzanine', 1)).toBe('Μεσοπάτωμα');
    });

    it('2 → "2ο Μεσοπάτωμα"', () => {
      expect(generateAutoLongName('mezzanine', 2)).toBe('2ο Μεσοπάτωμα');
    });

    it('0 fallback → "Μεσοπάτωμα"', () => {
      expect(generateAutoLongName('mezzanine', 0)).toBe('Μεσοπάτωμα');
    });
  });

  // ─── inferKindFromNumber ──────────────────────────────────────────────────

  describe('inferKindFromNumber', () => {
    it('0 → "ground"', () => {
      expect(inferKindFromNumber(0)).toBe('ground');
    });

    it('positive → "standard"', () => {
      expect(inferKindFromNumber(1)).toBe('standard');
      expect(inferKindFromNumber(15)).toBe('standard');
    });

    it('negative → "basement"', () => {
      expect(inferKindFromNumber(-1)).toBe('basement');
      expect(inferKindFromNumber(-5)).toBe('basement');
    });
  });

  // ─── isFloorKind guard ────────────────────────────────────────────────────

  describe('isFloorKind', () => {
    it.each(FLOOR_KIND_VALUES)('accepts "%s"', (kind: FloorKind) => {
      expect(isFloorKind(kind)).toBe(true);
    });

    it('rejects unknown strings', () => {
      expect(isFloorKind('mezzo')).toBe(false);
      expect(isFloorKind('')).toBe(false);
      expect(isFloorKind('GROUND')).toBe(false); // case-sensitive
    });

    it('rejects non-strings', () => {
      expect(isFloorKind(0)).toBe(false);
      expect(isFloorKind(null)).toBe(false);
      expect(isFloorKind(undefined)).toBe(false);
      expect(isFloorKind({})).toBe(false);
    });
  });
});
