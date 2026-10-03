/**
 * Tests — Floor Naming SSoT (ADR-369 §9 Q9) — Phase A1
 */

import {
  generateAutoShortName,
  inferKindFromNumber,
  isFloorKind,
  isBuildingStorey,
  countBuildingStoreys,
  FLOOR_KIND_VALUES,
  SPECIAL_LEVEL_KINDS,
  type FloorKind,
  isAboveGround,
} from '../floor-naming';
import { canonicalFloorLongName } from '@/lib/floor/floor-label-bundle';

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

  // ─── canonicalFloorLongName (Greek canonical) ───────────────────────────────

  describe('canonicalFloorLongName — fixed labels', () => {
    it('foundation → "Θεμελίωση"', () => {
      expect(canonicalFloorLongName('foundation', 0)).toBe('Θεμελίωση');
    });

    it('roof → "Δώμα"', () => {
      expect(canonicalFloorLongName('roof', 0)).toBe('Δώμα');
    });

    it('ground → "Ισόγειο"', () => {
      expect(canonicalFloorLongName('ground', 0)).toBe('Ισόγειο');
    });
  });

  describe('canonicalFloorLongName — standard ordinals 1-50', () => {
    it.each(Array.from({ length: 50 }, (_, i) => i + 1))(
      'floor %i → "%iος Όροφος"',
      (n) => {
        expect(canonicalFloorLongName('standard', n)).toBe(`${n}ος Όροφος`);
      },
    );
  });

  describe('canonicalFloorLongName — basement', () => {
    it('-1 → "Υπόγειο"', () => {
      expect(canonicalFloorLongName('basement', -1)).toBe('Υπόγειο');
    });

    it('-2 → "2ο Υπόγειο"', () => {
      expect(canonicalFloorLongName('basement', -2)).toBe('2ο Υπόγειο');
    });

    it('-5 → "5ο Υπόγειο"', () => {
      expect(canonicalFloorLongName('basement', -5)).toBe('5ο Υπόγειο');
    });

    it('0 fallback → "Υπόγειο" (level 1)', () => {
      expect(canonicalFloorLongName('basement', 0)).toBe('Υπόγειο');
    });
  });

  describe('canonicalFloorLongName — mezzanine', () => {
    it('1 → "Μεσοπάτωμα"', () => {
      expect(canonicalFloorLongName('mezzanine', 1)).toBe('Μεσοπάτωμα');
    });

    it('2 → "2ο Μεσοπάτωμα"', () => {
      expect(canonicalFloorLongName('mezzanine', 2)).toBe('2ο Μεσοπάτωμα');
    });

    it('0 fallback → "Μεσοπάτωμα"', () => {
      expect(canonicalFloorLongName('mezzanine', 0)).toBe('Μεσοπάτωμα');
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

  // ─── ADR-461 special levels ─────────────────────────────────────────────────

  describe('stair-penthouse kind', () => {
    it('is a recognised FloorKind with Greek auto-names', () => {
      expect(isFloorKind('stair-penthouse')).toBe(true);
      expect(generateAutoShortName('stair-penthouse', 3)).toBe('SP');
      expect(canonicalFloorLongName('stair-penthouse', 3)).toBe('Απόληξη Κλιμακοστασίου');
    });
  });

  describe('isBuildingStorey', () => {
    it('counts ground/basement/standard/mezzanine as storeys', () => {
      expect(isBuildingStorey('ground')).toBe(true);
      expect(isBuildingStorey('basement')).toBe(true);
      expect(isBuildingStorey('standard')).toBe(true);
      expect(isBuildingStorey('mezzanine')).toBe(true);
    });

    it.each(SPECIAL_LEVEL_KINDS)('excludes special level "%s"', (kind: FloorKind) => {
      expect(isBuildingStorey(kind)).toBe(false);
    });
  });

  describe('countBuildingStoreys', () => {
    it('counts only counted storeys (special levels excluded)', () => {
      const floors = [
        { kind: 'foundation' as const },
        { kind: 'ground' as const },
        { kind: 'standard' as const },
        { kind: 'standard' as const },
        { kind: 'stair-penthouse' as const },
      ];
      expect(countBuildingStoreys(floors)).toBe(3);
    });

    it('treats floors without a kind as storeys (back-compat)', () => {
      expect(countBuildingStoreys([{}, {}, { kind: 'roof' as const }])).toBe(2);
    });
  });

  // ─── ADR-903 — ελληνικά είδη στάθμης ──────────────────────────────────────

  describe('ADR-903 kinds (semi-basement · raised-ground · pilotis · attic)', () => {
    it.each<[FloorKind, string]>([
      ['semi-basement', 'SB'],
      ['raised-ground', 'RG'],
      ['pilotis', 'PL'],
      ['attic', 'AT'],
    ])('%s ⇒ short code %s', (kind, code) => {
      expect(isFloorKind(kind)).toBe(true);
      expect(generateAutoShortName(kind, 0)).toBe(code);
    });

    it('πυλωτή + σοφίτα ΔΕΝ μετρούν («Πυλωτή + 4 όροφοι»)· ημιυπόγειο + υπερυψωμένο μετρούν', () => {
      expect(isBuildingStorey('pilotis')).toBe(false);
      expect(isBuildingStorey('attic')).toBe(false);
      expect(isBuildingStorey('semi-basement')).toBe(true);
      expect(isBuildingStorey('raised-ground')).toBe(true);
    });

    it('isAboveGround (IFC AboveGround): μόνο θεμελίωση/υπόγειο/ημιυπόγειο κάτω από το έδαφος', () => {
      const below = FLOOR_KIND_VALUES.filter((kind) => !isAboveGround(kind));
      expect([...below].sort()).toEqual(['basement', 'foundation', 'semi-basement']);
    });
  });
});

