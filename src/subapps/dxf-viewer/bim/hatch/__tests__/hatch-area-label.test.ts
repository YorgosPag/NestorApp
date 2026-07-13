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
  fitHatchLabelHeight,
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

describe('fitHatchLabelHeight', () => {
  it('κλιμακώνεται με το μέγεθος της γραμμοσκίασης (μεγαλύτερη hatch → μεγαλύτερο ύψος)', () => {
    const small = fitHatchLabelHeight('Εμβαδόν: 1,00 m²', SQUARE); // 1000×1000
    const bigSquare: Point2D[] = SQUARE.map((p) => ({ x: p.x * 4, y: p.y * 4 })); // 4000×4000
    const big = fitHatchLabelHeight('Εμβαδόν: 1,00 m²', bigSquare);
    expect(big).toBeCloseTo(small * 4, 6);
  });
  it('δεν ξεπερνά το 35% του ύψους του bbox', () => {
    // Πολύ κοντό κείμενο ώστε να δεσμεύει το byHeight cap.
    expect(fitHatchLabelHeight('Α', SQUARE)).toBeLessThanOrEqual(0.35 * 1000 + 1e-9);
  });
  it('degenerate outer (<3 κορυφές) → fallback 1', () => {
    expect(fitHatchLabelHeight('x', [{ x: 0, y: 0 }])).toBe(1);
  });
});

describe('buildHatchAreaLabelEntity', () => {
  it('χτίζει κανονικό TextEntity με id/textNode/θέση/fit-ύψος', () => {
    const entity = buildHatchAreaLabelEntity(makeHatch('GRASS'), { x: 500, y: 500 });
    expect(entity.type).toBe('text');
    expect(entity.id).toBeTruthy();
    expect(entity.textNode).toBeDefined();
    expect(entity.text.startsWith('Εμβαδόν γρασιδιού:')).toBe(true);
    // κλικ μέσα → centroid της SQUARE
    expect(entity.position.x).toBeCloseTo(500, 6);
    expect(entity.position.y).toBeCloseTo(500, 6);
    // fit-to-hatch: το ύψος του run είναι θετικό και εντός της γραμμοσκίασης (≤350).
    const runHeight = entity.textNode!.paragraphs[0].runs[0];
    expect('style' in runHeight && runHeight.style.height > 0).toBe(true);
  });
});
