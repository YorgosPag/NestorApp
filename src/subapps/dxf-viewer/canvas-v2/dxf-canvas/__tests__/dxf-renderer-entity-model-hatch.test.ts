/**
 * ADR-507 Φ2/Φ5 — hatch passthrough μέσα από `buildEntityModelFromDxf`.
 *
 * Το `base` αυτού του converter προωθεί ΜΟΝΟ το resolved `lineweight` (px)· τα
 * AutoCAD hatch fields πρέπει να αντιγραφούν ρητά στο hatch case, αλλιώς χάνονται
 * πριν φτάσουν στον HatchRenderer (το ίδιο trap που είχε κρύψει το gradient).
 * Regression guard: `lineweightMm` (Φ2 LWT) + `gradient` (Φ5) επιβιώνουν.
 */

import { buildEntityModelFromDxf } from '../dxf-renderer-entity-model';
import type { DxfEntityUnion } from '../dxf-types';
import type { HatchEntity } from '../../../types/entities';

const RESOLVED = { colorHex: '#ffffff', lineWidthPx: 1, alpha: 1 };

function makeHatch(extra: Partial<DxfEntityUnion>): DxfEntityUnion {
  return {
    id: 'hatch_1',
    type: 'hatch',
    visible: true,
    boundaryPaths: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]],
    fillType: 'predefined',
    ...extra,
  } as unknown as DxfEntityUnion;
}

describe('buildEntityModelFromDxf — hatch passthrough', () => {
  it('διατηρεί το lineweightMm (Φ2 AutoCAD LWT)', () => {
    const model = buildEntityModelFromDxf(makeHatch({ lineweightMm: 0.5 } as Partial<DxfEntityUnion>), false, RESOLVED);
    expect((model as unknown as HatchEntity).lineweightMm).toBe(0.5);
  });

  it('διατηρεί το gradient (Φ5)', () => {
    const gradient = { kind: 'linear', angleDeg: 0, colors: ['#ff0000', '#0000ff'] };
    const model = buildEntityModelFromDxf(
      makeHatch({ fillType: 'gradient', gradient } as Partial<DxfEntityUnion>), false, RESOLVED,
    );
    expect((model as unknown as HatchEntity).gradient).toEqual(gradient);
  });

  it('lineweightMm absent → undefined (όχι σφάλμα, fallback στον renderer)', () => {
    const model = buildEntityModelFromDxf(makeHatch({}), false, RESOLVED);
    expect((model as unknown as HatchEntity).lineweightMm).toBeUndefined();
  });

  it('διατηρεί το backgroundColor (Φ5b.6 AutoCAD DXF 63· Τέκτων raster_bgcolor)', () => {
    const model = buildEntityModelFromDxf(
      makeHatch({ fillType: 'user-defined', backgroundColor: '#FFFFFF' } as Partial<DxfEntityUnion>), false, RESOLVED,
    );
    expect((model as unknown as HatchEntity).backgroundColor).toBe('#FFFFFF');
  });

  it('backgroundColor absent → undefined (όχι σφάλμα· ο renderer παραλείπει το φόντο)', () => {
    const model = buildEntityModelFromDxf(makeHatch({}), false, RESOLVED);
    expect((model as unknown as HatchEntity).backgroundColor).toBeUndefined();
  });

  it('διατηρεί το patternSpace (Φ5b.6 raster screen-space)', () => {
    const model = buildEntityModelFromDxf(
      makeHatch({ fillType: 'user-defined', patternSpace: 'screen' } as Partial<DxfEntityUnion>), false, RESOLVED,
    );
    expect((model as unknown as HatchEntity).patternSpace).toBe('screen');
  });
});
