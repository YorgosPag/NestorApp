/**
 * ADR-441 Slice GEN-SLAB — `buildFoundationMatSlabs` tests (εδαφόπλακα/MAT).
 *
 * Pure builder — reuse του `computeBuildingFootprint`. Καλύπτει: ΕΝΑ ενιαίο slab
 * kind='foundation' από τετράγωνο τοίχων, ΔΥΟ slabs σε αποσπασμένα κτίρια, μηδέν
 * footprint → ok:false no-footprint (όχι throw), και ότι ΔΕΝ φέρει guideBindings.
 */

import { buildFoundationMatSlabs } from '../slab-from-grid';
import type { WallForEnvelope } from '../../geometry/envelope-perimeter';
import type { Point3D } from '../../types/bim-base';
import type { WallParams } from '../../types/wall-types';

function wallParams(start: Point3D, end: Point3D, thickness = 200): WallParams {
  return {
    category: 'exterior',
    start,
    end,
    height: 3000,
    thickness,
    flip: false,
    sceneUnits: 'mm',
    baseBinding: 'storey-floor',
    topBinding: 'storey-ceiling',
    baseOffset: 0,
    topOffset: 0,
  };
}

function wall(id: string, start: Point3D, end: Point3D): WallForEnvelope {
  return { id, kind: 'straight', params: wallParams(start, end) };
}

/** Κλειστό τετράγωνο `size`×`size` με origin (ox,oy). 4 τοίχοι CCW. */
function square(prefix: string, ox: number, oy: number, size: number): WallForEnvelope[] {
  const q = (x: number, y: number): Point3D => ({ x: ox + x, y: oy + y, z: 0 });
  return [
    wall(`${prefix}1`, q(0, 0), q(size, 0)),
    wall(`${prefix}2`, q(size, 0), q(size, size)),
    wall(`${prefix}3`, q(size, size), q(0, size)),
    wall(`${prefix}4`, q(0, size), q(0, 0)),
  ];
}

describe('buildFoundationMatSlabs (εδαφόπλακα)', () => {
  it('τετράγωνο τοίχων → ΜΙΑ ενιαία πλάκα kind=foundation', () => {
    const result = buildFoundationMatSlabs(square('w', 0, 0, 8000), [], [], {}, '0', 'mm');
    expect(result.ok).toBe(true);
    expect(result.slabs).toHaveLength(1);
    expect(result.slabs[0].kind).toBe('foundation');
    expect(result.slabs[0].params.kind).toBe('foundation');
    // levelElevation default για foundation = 0 (ADR-369 §2.1).
    expect(result.slabs[0].params.levelElevation).toBe(0);
    // Δεν κρέμεται σε άξονα — μηδέν grid bindings.
    expect(result.slabs[0].guideBindings).toBeUndefined();
  });

  it('outline καλύπτει το αποτύπωμα (≥4 κορυφές, εντός των ορίων)', () => {
    const result = buildFoundationMatSlabs(square('w', 0, 0, 8000), [], [], {}, '0', 'mm');
    const verts = result.slabs[0].params.outline.vertices;
    expect(verts.length).toBeGreaterThanOrEqual(4);
    for (const v of verts) {
      // 8m τετράγωνο με 200mm τοίχους → outline εντός [-300, 8300].
      expect(v.x).toBeGreaterThanOrEqual(-300);
      expect(v.x).toBeLessThanOrEqual(8300);
      expect(v.y).toBeGreaterThanOrEqual(-300);
      expect(v.y).toBeLessThanOrEqual(8300);
    }
  });

  it('δύο αποσπασμένα κτίρια → ΔΥΟ ξεχωριστές εδαφόπλακες', () => {
    const buildings = [...square('a', 0, 0, 4000), ...square('b', 20000, 0, 4000)];
    const result = buildFoundationMatSlabs(buildings, [], [], {}, '0', 'mm');
    expect(result.slabs).toHaveLength(2);
    expect(result.slabs.every((s) => s.kind === 'foundation')).toBe(true);
  });

  it('μηδέν δομικά στοιχεία → ok:false no-footprint (όχι throw)', () => {
    const result = buildFoundationMatSlabs([], [], [], {}, '0', 'mm');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no-footprint');
    expect(result.slabs).toHaveLength(0);
  });

  it('thickness override περνά στα params', () => {
    const result = buildFoundationMatSlabs(square('w', 0, 0, 8000), [], [], { thickness: 500 }, '0', 'mm');
    expect(result.slabs[0].params.thickness).toBe(500);
  });
});
