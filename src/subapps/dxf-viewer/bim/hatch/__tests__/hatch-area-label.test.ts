/**
 * ADR-649 — tests για τους pure builders της «Ετικέτας Εμβαδού Γραμμοσκίασης».
 */

// i18n mock: prefix «Εμβαδόν» + genitive μόνο για το grass (ελέγχει το fallback path).
jest.mock('@/i18n', () => ({
  i18n: {
    t: (key: string) => {
      const map: Record<string, string> = {
        'hatchAreaLabel.areaPrefix': 'Εμβαδόν',
        'hatchAreaLabel.materials.grass': 'γρασιδιού',
      };
      return map[key] ?? key;
    },
    exists: (key: string) => key === 'hatchAreaLabel.materials.grass',
  },
}));

import {
  buildHatchAreaLabelText,
  resolveHatchMaterialGenitive,
  resolveHatchLabelAnchor,
  buildHatchAreaLabelEntity,
} from '../hatch-area-label';
import type { HatchEntity } from '../../../types/entities';
import type { Point2D } from '../../../rendering/types/Types';

const SQUARE: Point2D[] = [
  { x: 0, y: 0 },
  { x: 1000, y: 0 },
  { x: 1000, y: 1000 },
  { x: 0, y: 1000 },
];

function makeHatch(patternName?: string): HatchEntity {
  return {
    id: 'htc_test',
    type: 'hatch',
    layerId: '',
    boundaryPaths: [SQUARE],
    ...(patternName ? { patternName } : {}),
  } as HatchEntity;
}

describe('resolveHatchMaterialGenitive', () => {
  it('επιστρέφει τη γενική για γνωστό pattern (GRASS → γρασιδιού)', () => {
    expect(resolveHatchMaterialGenitive('GRASS')).toBe('γρασιδιού');
  });
  it('επιστρέφει null για άγνωστο/λείπον pattern (fallback χωρίς υλικό)', () => {
    expect(resolveHatchMaterialGenitive('ANSI31')).toBeNull(); // δεν έχει genitive entry
    expect(resolveHatchMaterialGenitive(undefined)).toBeNull();
    expect(resolveHatchMaterialGenitive('NOT_A_PATTERN')).toBeNull();
  });
});

describe('buildHatchAreaLabelText', () => {
  it('με γνωστό υλικό → «Εμβαδόν γρασιδιού: …»', () => {
    const text = buildHatchAreaLabelText(makeHatch('GRASS'));
    expect(text.startsWith('Εμβαδόν γρασιδιού:')).toBe(true);
  });
  it('χωρίς υλικό → «Εμβαδόν: …»', () => {
    const text = buildHatchAreaLabelText(makeHatch());
    expect(text.startsWith('Εμβαδόν:')).toBe(true);
    expect(text).not.toContain('γρασιδιού');
  });
});

describe('resolveHatchLabelAnchor', () => {
  it('2ο κλικ ΜΕΣΑ στη γραμμοσκίαση → centroid', () => {
    const anchor = resolveHatchLabelAnchor(makeHatch(), { x: 500, y: 500 });
    expect(anchor.x).toBeCloseTo(500, 6);
    expect(anchor.y).toBeCloseTo(500, 6);
  });
  it('2ο κλικ ΕΞΩ από τη γραμμοσκίαση → σημείο του κλικ', () => {
    const anchor = resolveHatchLabelAnchor(makeHatch(), { x: 2000, y: 2000 });
    expect(anchor).toEqual({ x: 2000, y: 2000 });
  });
});

describe('buildHatchAreaLabelEntity', () => {
  it('χτίζει κανονικό TextEntity με id/textNode/θέση', () => {
    const entity = buildHatchAreaLabelEntity(makeHatch('GRASS'), { x: 500, y: 500 }, 'mm', 1);
    expect(entity.type).toBe('text');
    expect(entity.id).toBeTruthy();
    expect(entity.textNode).toBeDefined();
    expect(entity.text.startsWith('Εμβαδόν γρασιδιού:')).toBe(true);
    // κλικ μέσα → centroid της SQUARE
    expect(entity.position.x).toBeCloseTo(500, 6);
    expect(entity.position.y).toBeCloseTo(500, 6);
  });
});
