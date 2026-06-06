/**
 * ADR-419 «Κολώνα σε περιοχή (4 γραμμές)» — DetectedRectangle → ColumnEntity.
 *
 * Επαληθεύει ότι ο SSoT adapter `buildColumnFillingRect` παράγει τις ΙΔΙΕΣ
 * παραμετρικές κολώνες με το «Τοιχίο από περίγραμμα» (ίδιος πυρήνας
 * `rectColumnPlacement` + `completeColumnFromClick`), και ότι η ΙΔΙΑ
 * region-detection SSoT των τοίχων («4 γραμμές») τροφοδοτεί end-to-end τον
 * builder της κολώνας — δηλαδή ο χρήστης φτιάχνει κολώνες ΑΚΡΙΒΩΣ όπως φτιάχνει
 * «Τοίχο σε περιοχή».
 *
 * @see ../column-from-faces.ts (buildColumnFillingRect)
 * @see ../../walls/wall-in-region.ts (region-detection SSoT, shared)
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { LineEntity } from '../../../types/entities';
import { buildColumnFillingRect } from '../column-from-faces';
import {
  extractLineSegments,
  findRectanglesFromSegments,
  type DetectedRectangle,
} from '../../walls/wall-in-region';

const SU = 'mm' as const;
const LEVEL = '0';
const TOL = 5;

/** Άξονο-παράλληλο DetectedRectangle από width×height με κάτω-αριστερά γωνία (ox,oy). */
function rect(width: number, height: number, ox = 0, oy = 0): DetectedRectangle {
  const polygon: [Point2D, Point2D, Point2D, Point2D] = [
    { x: ox, y: oy },
    { x: ox + width, y: oy },
    { x: ox + width, y: oy + height },
    { x: ox, y: oy + height },
  ];
  const longSide = Math.max(width, height);
  const shortSide = Math.min(width, height);
  return { polygon, longSide, shortSide, area: width * height };
}

function line(id: string, a: Point2D, b: Point2D): LineEntity {
  return { id, type: 'line', layerId: 'lyr', start: a, end: b } as LineEntity;
}

describe('buildColumnFillingRect — DetectedRectangle → ColumnEntity', () => {
  it('χαμηλό aspect (1000×800) → rectangular, width=longSide, depth=shortSide', () => {
    const entity = buildColumnFillingRect(rect(1000, 800), LEVEL, SU);
    expect(entity).not.toBeNull();
    expect(entity!.type).toBe('column');
    expect(entity!.params.kind).toBe('rectangular');
    expect(entity!.params.width).toBeCloseTo(1000, 3);
    expect(entity!.params.depth).toBeCloseTo(800, 3);
  });

  it('μακρόστενο (2000×300, aspect ≥ 4) → shear-wall', () => {
    const entity = buildColumnFillingRect(rect(2000, 300), LEVEL, SU);
    expect(entity).not.toBeNull();
    expect(entity!.params.kind).toBe('shear-wall');
    expect(entity!.params.width).toBeCloseTo(2000, 3);
    expect(entity!.params.depth).toBeCloseTo(300, 3);
  });

  it('η κολώνα τοποθετείται στο κέντρο του ορθογωνίου', () => {
    const entity = buildColumnFillingRect(rect(1000, 800, 200, 100), LEVEL, SU);
    expect(entity).not.toBeNull();
    expect(entity!.params.position.x).toBeCloseTo(700, 3); // 200 + 1000/2
    expect(entity!.params.position.y).toBeCloseTo(500, 3); // 100 + 800/2
  });
});

describe('column-in-region — ΙΔΙΑ region-detection SSoT με τον τοίχο (4 γραμμές)', () => {
  it('4 γραμμές που σχηματίζουν ορθογώνιο → ΜΙΑ κολώνα που το γεμίζει', () => {
    // Ίδια ανίχνευση με το «Τοίχος σε περιοχή»: 4 ευθύγραμμα τμήματα → ορθογώνιο.
    const segs = extractLineSegments([
      line('a', { x: 0, y: 0 }, { x: 1200, y: 0 }),
      line('b', { x: 1200, y: 0 }, { x: 1200, y: 600 }),
      line('c', { x: 1200, y: 600 }, { x: 0, y: 600 }),
      line('d', { x: 0, y: 600 }, { x: 0, y: 0 }),
    ]);
    const rects = findRectanglesFromSegments(segs, TOL);
    expect(rects.length).toBeGreaterThan(0);

    const entity = buildColumnFillingRect(rects[0], LEVEL, SU);
    expect(entity).not.toBeNull();
    expect(entity!.type).toBe('column');
    expect(entity!.params.width).toBeCloseTo(1200, 1);
    expect(entity!.params.depth).toBeCloseTo(600, 1);
  });
});
