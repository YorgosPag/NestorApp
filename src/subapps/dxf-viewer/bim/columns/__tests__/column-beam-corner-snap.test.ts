/**
 * ADR-525 — L-κολόνα γεμίζει το γωνιακό κενό δύο κάθετων δοκαριών (corner-gap auto-junction).
 *
 * Επαληθεύει: (α) κορυφή = τομή εξωτ. παρειών· (β) σκέλη auto-sized = πάχη δοκαριών × αποστάσεις στα άκρα·
 * (γ) orientation-agnostic (4 διατάξεις)· (δ) gating (μη-κάθετα / <2 δοκάρια / cursor μακριά → null)·
 * (ε) preview ≡ commit: το `computeColumnGeometry` με τις παραγόμενες παραμέτρους βάζει την εξωτ. γωνία
 * ΑΚΡΙΒΩΣ στην τομή και τις παρειές στις παρειές των δοκαριών.
 */

import { resolveColumnBeamCornerSnap } from '../column-beam-corner-snap';
import { computeColumnGeometry } from '../../geometry/column-geometry';
import type { LinearMemberSnapTarget } from '../../framing/linear-member-face-snap';
import type { ColumnParams } from '../../types/column-types';
import type { Point2D } from '../../../rendering/types/Types';

/** Ορθογώνιο δοκάρι από axis-span + πάχος, axis-aligned. */
function beam(
  id: string,
  axisFrom: Point2D,
  axisTo: Point2D,
  thickness: number,
): LinearMemberSnapTarget {
  const dx = axisTo.x - axisFrom.x;
  const dy = axisTo.y - axisFrom.y;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const h = thickness / 2;
  return {
    id,
    axis: [axisFrom, axisTo],
    outline: [
      { x: axisFrom.x + h * nx, y: axisFrom.y + h * ny },
      { x: axisTo.x + h * nx, y: axisTo.y + h * ny },
      { x: axisTo.x - h * nx, y: axisTo.y - h * ny },
      { x: axisFrom.x - h * nx, y: axisFrom.y - h * ny },
    ],
  };
}

/** Δύο κάθετα δοκάρια — bottom-left gap (το canonical παράδειγμα του handoff). */
const VERTICAL = beam('b1', { x: 225, y: 500 }, { x: 225, y: 900 }, 250); // faces x=100/350, near end y=500
const HORIZONTAL = beam('b2', { x: 500, y: 225 }, { x: 900, y: 225 }, 300); // faces y=75/375, near end x=500
const GAP_CURSOR: Point2D = { x: 300, y: 287 }; // μέσα στο κενό (κοντά στον reflex κόμβο 350,375)

describe('resolveColumnBeamCornerSnap — corner-gap geometry', () => {
  it('τοποθετεί+διαστασιολογεί την L στο κενό δύο κάθετων δοκαριών', () => {
    const snap = resolveColumnBeamCornerSnap(GAP_CURSOR, [VERTICAL, HORIZONTAL], 'mm');
    expect(snap).not.toBeNull();
    // bbox κέντρο = (300, 287.5)· γωνία = 0 (axis-aligned)· flipY=false.
    expect(snap!.position.x).toBeCloseTo(300, 3);
    expect(snap!.position.y).toBeCloseTo(287.5, 3);
    expect(snap!.rotation).toBeCloseTo(0, 6);
    expect(snap!.sizing.flipY).toBe(false);
  });

  it('σκέλη auto-sized = πάχη δοκαριών × αποστάσεις στα άκρα', () => {
    const { sizing } = resolveColumnBeamCornerSnap(GAP_CURSOR, [VERTICAL, HORIZONTAL], 'mm')!;
    expect(sizing.widthMm).toBeCloseTo(400, 3); // οριζόντιο σκέλος: κορυφή x=100 → άκρο x=500
    expect(sizing.depthMm).toBeCloseTo(425, 3); // κατακόρυφο σκέλος: κορυφή y=75 → άκρο y=500
    expect(sizing.armLengthMm).toBeCloseTo(300, 3); // πάχος οριζόντιου δοκαριού
    expect(sizing.armWidthMm).toBeCloseTo(250, 3); // πάχος κατακόρυφου δοκαριού
  });

  it('οι 2 οδηγοί καταλήγουν στην ΙΔΙΑ κορυφή (τομή εξωτ. παρειών) = (100,75)', () => {
    const { guides } = resolveColumnBeamCornerSnap(GAP_CURSOR, [VERTICAL, HORIZONTAL], 'mm')!;
    expect(guides).toHaveLength(2);
    for (const g of guides) {
      expect(g.b.x).toBeCloseTo(100, 3);
      expect(g.b.y).toBeCloseTo(75, 3);
    }
  });

  it('preview ≡ commit: computeColumnGeometry βάζει την εξωτ. γωνία στην τομή + παρειές στις παρειές', () => {
    const snap = resolveColumnBeamCornerSnap(GAP_CURSOR, [VERTICAL, HORIZONTAL], 'mm')!;
    const params: ColumnParams = {
      kind: 'L-shape',
      position: { x: snap.position.x, y: snap.position.y, z: 0 },
      anchor: 'center',
      width: snap.sizing.widthMm,
      depth: snap.sizing.depthMm,
      height: 3000,
      rotation: snap.rotation,
      sceneUnits: 'mm',
      lshape: { armWidth: snap.sizing.armWidthMm, armLength: snap.sizing.armLengthMm, flipY: snap.sizing.flipY },
    } as ColumnParams;
    const { footprint, bbox } = computeColumnGeometry(params);
    // bbox: x∈[100,500], y∈[75,500] (ένωση των δύο σκελών = προεκτάσεις των δοκαριών).
    expect(bbox.min.x).toBeCloseTo(100, 2);
    expect(bbox.min.y).toBeCloseTo(75, 2);
    expect(bbox.max.x).toBeCloseTo(500, 2);
    expect(bbox.max.y).toBeCloseTo(500, 2);
    // η εξωτερική γωνία (min-x, min-y vertex) = η τομή (100,75).
    const corner = footprint.vertices.reduce((m, v) => (v.x + v.y < m.x + m.y ? v : m));
    expect(corner.x).toBeCloseTo(100, 2);
    expect(corner.y).toBeCloseTo(75, 2);
    // οι παρειές των σκελών ταυτίζονται με τις παρειές των δοκαριών (x=350 κάθετο, y=375 οριζόντιο).
    const xs = footprint.vertices.map((v) => v.x);
    const ys = footprint.vertices.map((v) => v.y);
    expect(xs).toContainEqual(expect.closeTo(350, 2));
    expect(ys).toContainEqual(expect.closeTo(375, 2));
  });
});

describe('resolveColumnBeamCornerSnap — orientation-agnostic (4 διατάξεις)', () => {
  // Όλες οι 4 γωνίες: η κορυφή = τομή των δύο εξωτ. παρειών, ανεξαρτήτως πλευράς του κενού.
  const cases: { name: string; v: LinearMemberSnapTarget; h: LinearMemberSnapTarget; cursor: Point2D; corner: Point2D }[] = [
    {
      name: 'bottom-left',
      v: beam('v', { x: 225, y: 500 }, { x: 225, y: 900 }, 250),
      h: beam('h', { x: 500, y: 225 }, { x: 900, y: 225 }, 300),
      cursor: { x: 300, y: 287 },
      corner: { x: 100, y: 75 },
    },
    {
      name: 'bottom-right',
      v: beam('v', { x: 775, y: 500 }, { x: 775, y: 900 }, 250), // faces x=650/900, near end y=500
      h: beam('h', { x: 100, y: 225 }, { x: 500, y: 225 }, 300), // faces y=75/375, near end x=500
      cursor: { x: 700, y: 287 },
      corner: { x: 900, y: 75 },
    },
    {
      name: 'top-left',
      v: beam('v', { x: 225, y: 100 }, { x: 225, y: 500 }, 250), // faces x=100/350, near end y=500
      h: beam('h', { x: 500, y: 775 }, { x: 900, y: 775 }, 300), // faces y=625/925, near end x=500
      cursor: { x: 300, y: 700 },
      corner: { x: 100, y: 925 },
    },
    {
      name: 'top-right',
      v: beam('v', { x: 775, y: 100 }, { x: 775, y: 500 }, 250), // faces x=650/900, near end y=500
      h: beam('h', { x: 100, y: 775 }, { x: 500, y: 775 }, 300), // faces y=625/925, near end x=500
      cursor: { x: 700, y: 700 },
      corner: { x: 900, y: 925 },
    },
  ];

  it.each(cases)('$name: κορυφή στην τομή των εξωτ. παρειών', ({ v, h, cursor, corner }) => {
    const snap = resolveColumnBeamCornerSnap(cursor, [v, h], 'mm');
    expect(snap).not.toBeNull();
    for (const g of snap!.guides) {
      expect(g.b.x).toBeCloseTo(corner.x, 2);
      expect(g.b.y).toBeCloseTo(corner.y, 2);
    }
    // η ίδια γωνία προκύπτει και από το committed footprint (preview ≡ commit).
    const params = {
      kind: 'L-shape', position: { x: snap!.position.x, y: snap!.position.y, z: 0 }, anchor: 'center',
      width: snap!.sizing.widthMm, depth: snap!.sizing.depthMm, height: 3000, rotation: snap!.rotation,
      sceneUnits: 'mm', lshape: { armWidth: snap!.sizing.armWidthMm, armLength: snap!.sizing.armLengthMm, flipY: snap!.sizing.flipY },
    } as ColumnParams;
    const verts = computeColumnGeometry(params).footprint.vertices;
    const onCorner = verts.some((vx) => Math.abs(vx.x - corner.x) < 0.5 && Math.abs(vx.y - corner.y) < 0.5);
    expect(onCorner).toBe(true);
  });
});

describe('resolveColumnBeamCornerSnap — gating (μηδέν false positive)', () => {
  it('< 2 δοκάρια → null', () => {
    expect(resolveColumnBeamCornerSnap(GAP_CURSOR, [VERTICAL], 'mm')).toBeNull();
    expect(resolveColumnBeamCornerSnap(GAP_CURSOR, [], 'mm')).toBeNull();
  });

  it('μη-κάθετα δοκάρια (παράλληλα) → null', () => {
    const parallel = beam('b3', { x: 1500, y: 500 }, { x: 1500, y: 900 }, 250);
    expect(resolveColumnBeamCornerSnap(GAP_CURSOR, [VERTICAL, parallel], 'mm')).toBeNull();
  });

  it('cursor μακριά από το κενό → null (εκτός capture)', () => {
    expect(resolveColumnBeamCornerSnap({ x: 5000, y: 5000 }, [VERTICAL, HORIZONTAL], 'mm')).toBeNull();
  });

  it('ντετερμινιστικό (preview ≡ commit: ίδια είσοδος → ίδιο αποτέλεσμα)', () => {
    const a = resolveColumnBeamCornerSnap(GAP_CURSOR, [VERTICAL, HORIZONTAL], 'mm');
    const b = resolveColumnBeamCornerSnap(GAP_CURSOR, [VERTICAL, HORIZONTAL], 'mm');
    expect(a).toEqual(b);
  });
});
