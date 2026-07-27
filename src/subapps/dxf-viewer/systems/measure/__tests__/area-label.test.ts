/**
 * ADR-649 / ADR-662 §12 — tests για τους pure builders της «Ετικέτας Εμβαδού».
 *
 * Καλύπτει **και τους δύο** τύπους με μετρήσιμο εμβαδόν μέσα από τον ΙΔΙΟ builder:
 * γραμμοσκίαση (επίπεδη → μία γραμμή) και τοπογραφική επιφάνεια (ανάγλυφη → δύο).
 * Αν κάποιος ξαναχωρίσει τη διαδρομή ανά τύπο, οι δύο ομάδες αποκλίνουν και σπάνε.
 */

// i18n mock: prefixes + genitive μόνο για το grass (ελέγχει το fallback path).
jest.mock('@/i18n', () => ({
  i18n: {
    t: (key: string) => {
      const map: Record<string, string> = {
        'areaLabel.areaPrefix': 'Εμβαδόν',
        'areaLabel.surfacePrefix': 'Επιφάνεια εδάφους',
        'areaLabel.materials.grass': 'γρασιδιού',
      };
      return map[key] ?? key;
    },
    exists: (key: string) => key === 'areaLabel.materials.grass',
  },
}));

// Το TIN store: η επιφάνεια δεν ζει στο entity (thin/derived, ADR-662) — ο builder τη
// ζητά από το `getTopoSurface`. Επίπεδο τετράγωνο 1000×1000 ⇒ 3D == 2D.
jest.mock('../../topography/topo-surface', () => ({
  getTopoSurface: () => ({
    positions: [[0, 0], [1000, 0], [1000, 1000], [0, 1000]],
    elevations: [0, 0, 0, 0],
    triangles: [[0, 1, 2], [0, 2, 3]],
  }),
}));

import {
  buildAreaLabelLines,
  resolveHatchMaterialGenitive,
  resolveAreaLabelAnchor,
  fitAreaLabelHeight,
  buildAreaLabelEntity,
} from '../area-label';
import type { Entity, HatchEntity } from '../../../types/entities';
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

function makeTopoSurface(): Entity {
  return {
    id: 'topo-surface-existing',
    type: 'topo-surface',
    layerId: '',
    surfaceId: 'existing',
    footprint: [SQUARE],
  } as unknown as Entity;
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

describe('buildAreaLabelLines — γραμμοσκίαση (επίπεδη ⇒ ΜΙΑ γραμμή)', () => {
  it('με γνωστό υλικό → «Εμβαδόν γρασιδιού: …»', () => {
    const lines = buildAreaLabelLines(makeHatch('GRASS'));
    expect(lines).toHaveLength(1);
    expect(lines[0].startsWith('Εμβαδόν γρασιδιού:')).toBe(true);
  });
  it('χωρίς υλικό → «Εμβαδόν: …»', () => {
    const lines = buildAreaLabelLines(makeHatch());
    expect(lines).toHaveLength(1);
    expect(lines[0].startsWith('Εμβαδόν:')).toBe(true);
    expect(lines[0]).not.toContain('γρασιδιού');
  });
});

describe('buildAreaLabelLines — τοπογραφική επιφάνεια (ανάγλυφη ⇒ ΔΥΟ γραμμές)', () => {
  it('προσθέτει τη γραμμή πραγματικής επιφάνειας, χωρίς υλικό', () => {
    const lines = buildAreaLabelLines(makeTopoSurface());
    expect(lines).toHaveLength(2);
    expect(lines[0].startsWith('Εμβαδόν:')).toBe(true);
    expect(lines[1].startsWith('Επιφάνεια εδάφους:')).toBe(true);
    expect(lines[0]).not.toContain('γρασιδιού'); // το έδαφος δεν έχει pattern υλικού
  });
});

describe('buildAreaLabelLines — οντότητα χωρίς εμβαδόν', () => {
  it('γραμμή → καμία γραμμή ετικέτας (και ο builder δεν φτιάχνει entity)', () => {
    const line = {
      id: 'l1', type: 'line', layerId: '', start: { x: 0, y: 0 }, end: { x: 10, y: 10 },
    } as unknown as Entity;
    expect(buildAreaLabelLines(line)).toHaveLength(0);
    expect(buildAreaLabelEntity(line, { x: 0, y: 0 })).toBeNull();
  });
});

describe('resolveAreaLabelAnchor', () => {
  it.each([
    ['γραμμοσκίαση', makeHatch()],
    ['τοπογραφική επιφάνεια', makeTopoSurface()],
  ])('2ο κλικ ΜΕΣΑ (%s) → centroid', (_label, entity) => {
    const anchor = resolveAreaLabelAnchor(entity as Entity, { x: 500, y: 500 });
    expect(anchor.x).toBeCloseTo(500, 6);
    expect(anchor.y).toBeCloseTo(500, 6);
  });

  it.each([
    ['γραμμοσκίαση', makeHatch()],
    ['τοπογραφική επιφάνεια', makeTopoSurface()],
  ])('2ο κλικ ΕΞΩ (%s) → σημείο του κλικ', (_label, entity) => {
    expect(resolveAreaLabelAnchor(entity as Entity, { x: 2000, y: 2000 })).toEqual({ x: 2000, y: 2000 });
  });
});

describe('fitAreaLabelHeight', () => {
  const ONE_LINE = ['Εμβαδόν: 1,00 m²'];

  it('κλιμακώνεται με το μέγεθος του σχήματος (μεγαλύτερο → μεγαλύτερο ύψος)', () => {
    const small = fitAreaLabelHeight(ONE_LINE, SQUARE); // 1000×1000
    const bigSquare: Point2D[] = SQUARE.map((p) => ({ x: p.x * 4, y: p.y * 4 })); // 4000×4000
    expect(fitAreaLabelHeight(ONE_LINE, bigSquare)).toBeCloseTo(small * 4, 6);
  });

  it('δεν ξεπερνά το 35% του ύψους του bbox', () => {
    // Πολύ κοντό κείμενο ώστε να δεσμεύει το byHeight cap.
    expect(fitAreaLabelHeight(['Α'], SQUARE)).toBeLessThanOrEqual(0.35 * 1000 + 1e-9);
  });

  it('δύο γραμμές χωράνε στον ΙΔΙΟ κατακόρυφο χώρο (ύψος ανά γραμμή ÷ 2)', () => {
    const one = fitAreaLabelHeight(['Α'], SQUARE);
    const two = fitAreaLabelHeight(['Α', 'Β'], SQUARE);
    expect(two).toBeCloseTo(one / 2, 6);
  });

  it('degenerate outer (<3 κορυφές) ή καμία γραμμή → fallback 1', () => {
    expect(fitAreaLabelHeight(ONE_LINE, [{ x: 0, y: 0 }])).toBe(1);
    expect(fitAreaLabelHeight([], SQUARE)).toBe(1);
  });
});

describe('buildAreaLabelEntity', () => {
  it('γραμμοσκίαση → TextEntity με id/textNode/θέση/fit-ύψος, ΜΙΑ παράγραφος', () => {
    const entity = buildAreaLabelEntity(makeHatch('GRASS'), { x: 500, y: 500 });
    expect(entity).not.toBeNull();
    expect(entity!.type).toBe('text');
    expect(entity!.id).toBeTruthy();
    expect(entity!.text.startsWith('Εμβαδόν γρασιδιού:')).toBe(true);
    expect(entity!.textNode!.paragraphs).toHaveLength(1);
    // κλικ μέσα → centroid της SQUARE
    expect(entity!.position.x).toBeCloseTo(500, 6);
    expect(entity!.position.y).toBeCloseTo(500, 6);
    const run = entity!.textNode!.paragraphs[0].runs[0];
    expect('style' in run && run.style.height > 0).toBe(true);
  });

  it('τοπογραφική επιφάνεια → ΔΥΟ παράγραφοι, το `text` τις ενώνει με newline', () => {
    const entity = buildAreaLabelEntity(makeTopoSurface(), { x: 500, y: 500 });
    expect(entity).not.toBeNull();
    expect(entity!.textNode!.paragraphs).toHaveLength(2);
    expect(entity!.text.split('\n')).toHaveLength(2);
    expect(entity!.text).toContain('Επιφάνεια εδάφους:');
  });
});
