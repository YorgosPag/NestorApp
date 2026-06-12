/**
 * ADR-441 Slice GEN-SLAB — `buildFoundationMatSlabs` tests (εδαφόπλακα/MAT).
 *
 * Pure builder — reuse του `computeBuildingFootprint`. Καλύπτει: ΕΝΑ ενιαίο slab
 * kind='foundation' από τετράγωνο τοίχων, ΔΥΟ slabs σε αποσπασμένα κτίρια, μηδέν
 * footprint → ok:false no-footprint (όχι throw), και ότι ΔΕΝ φέρει guideBindings.
 */

import { buildFoundationMatSlabs, buildSlabBaysFromGuides } from '../slab-from-grid';
import { type AxisGuideReader } from '../../foundations/foundation-from-grid';
import type { Guide } from '../../../systems/guides/guide-types';
import type { WallForEnvelope } from '../../geometry/envelope-perimeter';
import type { BeamForFootprint } from '../../geometry/building-footprint';
import type { ColumnForEnvelope } from '../../geometry/envelope-column-bridge';
import type { Point3D } from '../../types/bim-base';
import type { WallParams } from '../../types/wall-types';
import type { BeamParams } from '../../types/beam-types';
import type { ColumnParams } from '../../types/column-types';

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

  it('levelElevation override → η εδαφόπλακα κάθεται στη στάθμη θεμελίωσης (όχι 0)', () => {
    const result = buildFoundationMatSlabs(square('w', 0, 0, 8000), [], [], { levelElevation: -1000 }, '0', 'mm');
    expect(result.slabs[0].params.levelElevation).toBe(-1000);
  });
});

// ─── FLOOR / ROOF bays ────────────────────────────────────────────────────────

const guide = (id: string, axis: Guide['axis'], offset: number): Guide =>
  ({
    id, axis, offset, visible: true, label: null, style: null,
    locked: false, createdAt: '', parentId: null, groupId: null,
  } as Guide);

function reader(guides: readonly Guide[]): AxisGuideReader {
  return { getGuidesByAxis: (axis) => guides.filter((g) => g.axis === axis) };
}

/** Δοκάρι centerline start→end, πλάτος width (mm), flat. */
function beam(id: string, start: Point3D, end: Point3D, width = 300): BeamForFootprint {
  const params: BeamParams = {
    kind: 'straight',
    startPoint: start,
    endPoint: end,
    width,
    depth: 500,
    topElevation: 3000,
    sceneUnits: 'mm',
  } as BeamParams;
  return { id, params };
}

function column(id: string, x: number, y: number, size = 600): ColumnForEnvelope {
  return {
    id,
    params: {
      kind: 'rectangular',
      position: { x, y, z: 0 },
      anchor: 'center',
      width: size,
      depth: size,
      height: 3000,
      rotation: 0,
      sceneUnits: 'mm',
      baseBinding: 'storey-floor',
      topBinding: 'storey-ceiling',
      baseOffset: 0,
      topOffset: 0,
    } as ColumnParams,
  };
}

const X2 = [guide('x0', 'X', 0), guide('x1', 'X', 4000)];
const Y2 = [guide('y0', 'Y', 0), guide('y1', 'Y', 4000)];

function bbox(verts: readonly { x: number; y: number }[]) {
  return {
    minX: Math.min(...verts.map((v) => v.x)),
    maxX: Math.max(...verts.map((v) => v.x)),
    minY: Math.min(...verts.map((v) => v.y)),
    maxY: Math.max(...verts.map((v) => v.y)),
  };
}

describe('buildSlabBaysFromGuides (δάπεδα/οροφές per-φάτνωμα)', () => {
  it('3×3 κάναβος → 4 φατνώματα (μηδέν δοκάρια → πλήρη rects)', () => {
    const X3 = [...X2, guide('x2', 'X', 8000)];
    const Y3 = [...Y2, guide('y2', 'Y', 8000)];
    const result = buildSlabBaysFromGuides(reader([...X3, ...Y3]), [], [], {}, '0', 'mm');
    expect(result.ok).toBe(true);
    expect(result.slabs).toHaveLength(4);
    expect(result.slabs.every((s) => s.kind === 'floor')).toBe(true);
  });

  it('κάθε πλάκα είναι born-bound με 4 axis bindings', () => {
    const result = buildSlabBaysFromGuides(reader([...X2, ...Y2]), [], [], {}, '0', 'mm');
    expect(result.slabs).toHaveLength(1);
    const slots = (result.slabs[0].guideBindings ?? []).map((b) => b.slot).sort();
    expect(slots).toEqual(['end-x', 'end-y', 'start-x', 'start-y']);
  });

  it('kind=roof → πλάκες οροφής', () => {
    const result = buildSlabBaysFromGuides(reader([...X2, ...Y2]), [], [], { kind: 'roof' }, '0', 'mm');
    expect(result.slabs[0].kind).toBe('roof');
  });

  it('clip: δοκάρι στην κάτω παρειά → η πλάκα τραβιέται προς τα μέσα (inner face)', () => {
    // Δοκάρι centerline y=0 από x0..x1, width 300 → band y∈[-150,150]. Subtract →
    // η κάτω ακμή της πλάκας ανεβαίνει στο y≈150 (εσωτερική παρειά).
    const b = beam('b1', { x: 0, y: 0, z: 0 }, { x: 4000, y: 0, z: 0 }, 300);
    const result = buildSlabBaysFromGuides(reader([...X2, ...Y2]), [b], [], {}, '0', 'mm');
    expect(result.slabs).toHaveLength(1);
    const box = bbox(result.slabs[0].params.outline.vertices);
    expect(box.minY).toBeGreaterThan(140);
    expect(box.minY).toBeLessThan(160);
    // Η πάνω ακμή μένει στον άξονα (κανένα δοκάρι εκεί).
    expect(box.maxY).toBeCloseTo(4000, 0);
  });

  it('notch: κολώνα σε γωνία φατνώματος → η πλάκα κόβεται γύρω της (concave outline)', () => {
    const c = column('c1', 0, 0, 600); // 600×600 κεντραρισμένη στη γωνία (0,0)
    const result = buildSlabBaysFromGuides(reader([...X2, ...Y2]), [], [c], {}, '0', 'mm');
    expect(result.slabs).toHaveLength(1);
    // Notch γωνίας → περισσότερες από 4 κορυφές (concave).
    expect(result.slabs[0].params.outline.vertices.length).toBeGreaterThan(4);
  });

  it('<2 άξονες ανά διεύθυνση → ok:false insufficient-guides (όχι throw)', () => {
    const result = buildSlabBaysFromGuides(reader([guide('x0', 'X', 0), ...Y2]), [], [], {}, '0', 'mm');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('insufficient-guides');
  });
});
