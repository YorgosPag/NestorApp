/**
 * ⚓ ADR-929 Φ5.3γ — από τις δεμένες διαστάσεις σε αναφορές βαθμονόμησης, πάνω στη **γνωστή αλήθεια** του σπιτιού 6 × 4 m
 * (`fusion-fixture.ts`, 1 px = 20 mm). Η σύντηξη τρέχει πραγματικά (καμία ψεύτικη `FusedDimension`): ό,τι κλειδώνεται εδώ
 * είναι η αλυσίδα σύντηξη → αναφορές → ένας επιλυτής.
 */

import { describe, expect, it } from '@jest/globals';
import { fusePlan } from '../plan-fusion';
import { planScaleReferences } from '../scale-references';
import { IDENTITY_HOMOGRAPHY } from '@/lib/geometry/homography';
import { solveCalibration } from '../../../../floorplan-background/geometry/calibration-solve';
import type { RasterPlacement } from '../../../../floorplan-background/geometry/raster-scene-mapping';
import { PX_PER_MM, fusionInput, houseDimensions, houseSegments, reading } from './fusion-fixture';

const TRUE_MM_PER_PX = 1 / PX_PER_MM;
const IDENTITY = { originalToAligned: IDENTITY_HOMOGRAPHY, alignedToOriginal: IDENTITY_HOMOGRAPHY };
const read = (r: ReturnType<typeof reading>) => ({ status: 'read' as const, reading: r });
const PLACEMENT: RasterPlacement = {
  naturalBounds: { width: 500, height: 400 },
  transform: { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1, rotation: 0 },
};

function fused(overrides: Parameters<typeof houseDimensions>[0] = {}) {
  const { texts, dimensions } = houseDimensions(overrides);
  return fusePlan(fusionInput({ segments: houseSegments(), reading: read(reading({ texts, dimensions })) }));
}

describe('planScaleReferences — οι αναφορές μετρούν ό,τι γράφει η διάσταση', () => {
  const set = planScaleReferences(fused(), IDENTITY);

  it('κάθε συνεπής διάσταση γίνεται αναφορά· καμία δεν χάνεται σιωπηλά', () => {
    const fusion = fused();
    const consistent = fusion.dimensions.filter((d) => d.status === 'consistent').length;
    expect(set.used.length).toBe(consistent);
    expect(set.used.length + set.rejected.length).toBe(fusion.dimensions.length);
    expect(set.used.length).toBeGreaterThanOrEqual(2);
  });

  it('η απόσταση των άκρων (px) × αληθινή κλίμακα ≈ η γραμμένη τιμή (μισό pixel)', () => {
    for (const r of set.used) {
      const gapPx = Math.hypot(r.b.x - r.a.x, r.b.y - r.a.y);
      expect(Math.abs(gapPx * TRUE_MM_PER_PX - r.valueMm)).toBeLessThanOrEqual(TRUE_MM_PER_PX / 2);
    }
  });

  it('ο ΕΝΑΣ επιλυτής πάνω στις αναφορές ανακτά την αληθινή κλίμακα (±0,2%)', () => {
    const [first, ...rest] = set.used.map((r) => ({ a: r.a, b: r.b, lengthMm: r.valueMm }));
    const result = solveCalibration({ placement: PLACEMENT, references: [first, ...rest], sceneUnits: 'mm', alignToAxis: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Math.abs(result.solution.mmPerPixelX / TRUE_MM_PER_PX - 1)).toBeLessThan(0.002);
    expect(Math.abs(result.solution.mmPerPixelY / TRUE_MM_PER_PX - 1)).toBeLessThan(0.002);
  });

  it('ντετερμινιστικό: ίδια σύντηξη ⇒ ίδιες αναφορές με την ίδια σειρά', () => {
    expect(planScaleReferences(fused(), IDENTITY)).toEqual(set);
  });
});

describe('planScaleReferences — όσες μένουν έξω, μένουν με λόγο', () => {
  it('🔴 λάθος γραμμένη τιμή («2.90» αντί 3.325) ⇒ απορρίπτεται ως σύγκρουση, με το w του Baarda', () => {
    const set = planScaleReferences(fused({ 't-west': { raw: '2.90', valueMm: 2900 } }), IDENTITY);
    const west = set.rejected.find((r) => r.textId === 't-west');
    expect(west?.reason).toBe('conflict');
    expect(west?.w).not.toBeNull();
    expect(set.used.some((r) => r.textId === 't-west')).toBe(false);
  });

  it('χωρίς ανάγνωση ⇒ καμία αναφορά, καμία απόρριψη', () => {
    const fusion = fusePlan(fusionInput({ segments: houseSegments(), reading: null }));
    expect(planScaleReferences(fusion, IDENTITY)).toEqual({ used: [], rejected: [] });
  });
});
