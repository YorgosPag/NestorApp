/**
 * ADR-746 — regression anchors για τον ΕΝΑ αναγνώστη σημείων ορισμού διάστασης.
 *
 * 🔴 Ο ΖΩΝΤΑΝΟΣ ΕΝΟΧΟΣ (2026-08-01):
 *   `TypeError: dim.defPoints is not iterable`
 *     at DxfBitmapCache.rebuild (dxf-bitmap-cache.ts:368)
 *   → το throw έπεφτε μέσα στο `try` του rebuild → `cacheKey = null` → **κάθε καρέ**
 *     ξαναέχτιζε το raster ΟΛΟΥ του σχεδίου και το ξαναπετούσε.
 *
 * Κάθε `it` εδώ είναι ένα σχήμα δεδομένων που **έφτασε πραγματικά** στο hot path και το έριξε,
 * ή που θα το ρίξει σιωπηλά (NaN). Αν κάποιο γίνει κόκκινο, η θωράκιση έχει υποχωρήσει.
 */

import { resolveDimDefPoints, dimDefPoints } from '../dimension-def-points';
import { getDimensionWorldBounds } from '../dimension-cull-bounds';
import type { DimensionEntity } from '../../../types/dimension';

/** Μια κανονική γραμμική διάσταση, όπως τη γράφουν οι builders. */
function linearDim(overrides: Partial<Record<string, unknown>> = {}): DimensionEntity {
  return {
    id: 'dim_1',
    type: 'dimension',
    dimensionType: 'linear',
    layerId: '0',
    styleId: '',
    rotation: 0,
    defPoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 50 }],
    ...overrides,
  } as unknown as DimensionEntity;
}

describe('resolveDimDefPoints — canonical', () => {
  it('επιστρέφει τα σημεία αυτούσια όταν το defPoints είναι έγκυρος πίνακας', () => {
    const r = resolveDimDefPoints(linearDim());
    expect(r.source).toBe('canonical');
    expect(r.points).toHaveLength(3);
    expect(r.dropped).toBe(0);
  });
});

describe('resolveDimDefPoints — ο ζωντανός ένοχος: defPoints που δεν είναι iterable', () => {
  // Αυτά ΑΚΡΙΒΩΣ τα σχήματα παρήγαγαν το `is not iterable`.
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['plain object (π.χ. array→map μετά από (de)serialization)', { 0: { x: 1, y: 2 } }],
    ['αριθμός', 3],
    ['string', 'defPoints'],
  ])('δεν πετάει με defPoints = %s → degenerate', (_label, value) => {
    const dim = linearDim({ defPoints: value });
    expect(() => resolveDimDefPoints(dim)).not.toThrow();
    expect(resolveDimDefPoints(dim).source).toBe('degenerate');
    expect(dimDefPoints(dim)).toEqual([]);
  });

  it('δεν πετάει ούτε με null/undefined οντότητα', () => {
    expect(resolveDimDefPoints(null).source).toBe('degenerate');
    expect(resolveDimDefPoints(undefined).points).toEqual([]);
  });
});

describe('resolveDimDefPoints — επισκευή Phase-A1 (ανώτερο από το «διάγραψέ το» του Revit)', () => {
  it('ανακατασκευάζει [o1, o2, dimLineRef] από τα @deprecated κάτοπτρα', () => {
    const legacy = linearDim({
      defPoints: undefined,
      startPoint: { x: 10, y: 10 },
      endPoint: { x: 60, y: 10 },
      textPosition: { x: 35, y: 30 },
    });
    const r = resolveDimDefPoints(legacy);
    expect(r.source).toBe('repaired-legacy');
    expect(r.points).toEqual([{ x: 10, y: 10 }, { x: 60, y: 10 }, { x: 35, y: 30 }]);
  });

  it('το textMidpoint υπερισχύει του @deprecated textPosition', () => {
    const legacy = linearDim({
      defPoints: [],
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 10, y: 0 },
      textMidpoint: { x: 5, y: 9 },
      textPosition: { x: 999, y: 999 },
    });
    expect(resolveDimDefPoints(legacy).points[2]).toEqual({ x: 5, y: 9 });
  });

  it('με μόνο τα δύο άκρα επιστρέφει 2 σημεία (τα bounds ζουν, η hit-geometry υποχωρεί καθαρά)', () => {
    const legacy = linearDim({
      defPoints: undefined,
      startPoint: { x: 0, y: 0 },
      endPoint: { x: 10, y: 0 },
    });
    const r = resolveDimDefPoints(legacy);
    expect(r.source).toBe('repaired-legacy');
    expect(r.points).toHaveLength(2);
  });

  it('χωρίς endPoint δεν υπάρχει τίποτα να σωθεί → degenerate', () => {
    const r = resolveDimDefPoints(linearDim({ defPoints: undefined, startPoint: { x: 0, y: 0 } }));
    expect(r.source).toBe('degenerate');
  });
});

describe('resolveDimDefPoints — δηλητηρίαση AABB (ADR-510 Φ5): χειρότερη από crash', () => {
  it.each([
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
  ])('απορρίπτει σημείο με %s και το μετράει', (_label, bad) => {
    const r = resolveDimDefPoints(linearDim({
      defPoints: [{ x: 0, y: 0 }, { x: bad, y: 0 }, { x: 10, y: 10 }],
    }));
    expect(r.points).toHaveLength(2);
    expect(r.dropped).toBe(1);
  });

  it('απορρίπτει μη-σημεία μέσα στον πίνακα χωρίς να πετάει', () => {
    const r = resolveDimDefPoints(linearDim({
      defPoints: [{ x: 0, y: 0 }, null, undefined, { x: 5 }, 'nope', { x: 10, y: 10 }],
    }));
    expect(r.points).toEqual([{ x: 0, y: 0 }, { x: 10, y: 10 }]);
    expect(r.dropped).toBe(4);
  });

  it('πίνακας ΜΟΝΟ με δηλητηριώδη σημεία πέφτει σε επισκευή, όχι σε NaN κουτί', () => {
    const r = resolveDimDefPoints(linearDim({
      defPoints: [{ x: NaN, y: NaN }],
      startPoint: { x: 1, y: 1 },
      endPoint: { x: 2, y: 2 },
    }));
    expect(r.source).toBe('repaired-legacy');
  });
});

describe('getDimensionWorldBounds — η υπόσχεση «Never throws» είναι πλέον αληθινή', () => {
  it('🔴 ο ζωντανός ένοχος: διάσταση χωρίς defPoints επιστρέφει null αντί να ρίξει το raster', () => {
    const broken = linearDim({ defPoints: undefined });
    expect(() => getDimensionWorldBounds(broken)).not.toThrow();
    expect(getDimensionWorldBounds(broken)).toBeNull();
  });

  it('μια διάσταση Phase-A1 γίνεται ΟΡΑΤΗ αντί να πέσει στο ±1e6 κουτί', () => {
    const legacy = linearDim({
      defPoints: undefined,
      startPoint: { x: 100, y: 200 },
      endPoint: { x: 300, y: 200 },
      textPosition: { x: 200, y: 250 },
    });
    const b = getDimensionWorldBounds(legacy);
    expect(b).not.toBeNull();
    expect(b!.minX).toBe(100);
    expect(b!.maxX).toBe(300);
  });

  it('ένα NaN textMidpoint δεν δηλητηριάζει το κουτί', () => {
    const b = getDimensionWorldBounds(linearDim({ textMidpoint: { x: NaN, y: 0 } }));
    expect(b).not.toBeNull();
    expect(Number.isFinite(b!.minX) && Number.isFinite(b!.maxY)).toBe(true);
  });
});
