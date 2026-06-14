/**
 * ADR-363/449 — Free per-corner reshape ΤΗΣ ΣΤΑΤΙΚΗΣ ΔΙΑΤΟΜΗΣ (PHASE 1: L-shape).
 *
 * Ο Giorgio θέλει λαβή σε ΚΑΘΕ γωνία της κολόνας ώστε να αναμορφώνει ελεύθερα τη
 * **στατική διατομή** (πυρήνα)· ο σοβάς ακολουθεί. Verifies:
 *   - `getColumnGrips` σε L-shape → rotation + ΜΙΑ λαβή ανά κορυφή του rendered
 *     footprint (ΟΧΙ width/depth/arm grips· kind `column-poly-vertex-${i}`).
 *   - drag γωνίας → η διατομή γίνεται **`composite`** (custom profile), η συρόμενη
 *     κορυφή ακολουθεί τον cursor, οι υπόλοιπες μένουν στη θέση τους (WYSIWYG).
 *   - zero delta → originalParams referentially (no-op, ΔΕΝ μετατρέπεται).
 *   - ο σοβάς (ADR-449 silhouette) **re-derives** από το νέο composite footprint.
 */

import { applyColumnGripDrag, getColumnGrips } from '../column-grips';
import { polyVertexHandlePosition } from '../column-poly-vertex-grips';
import { computeColumnGeometry } from '../../geometry/column-geometry';
import { buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';
import { computeStructuralFinishSilhouette } from '../../finishes/structural-finish-scene-silhouette';
import { pointInPolygon } from '../../geometry/shared/polygon-utils';
import type { ColumnEntity, ColumnParams } from '../../types/column-types';

function makeLshape(): ColumnEntity {
  const params: ColumnParams = {
    ...buildDefaultColumnParams({ x: 0, y: 0 }, 'L-shape'),
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    anchor: 'center',
    width: 400,
    depth: 400,
    sceneUnits: 'mm',
  };
  return {
    id: 'col_L',
    type: 'column',
    kind: params.kind,
    layerId: '0',
    params,
    geometry: computeColumnGeometry(params),
    validation: undefined as never,
    visible: true,
  } as unknown as ColumnEntity;
}

describe('column free per-corner reshape — emission (L-shape)', () => {
  it('L-shape → rotation + ΜΙΑ λαβή/κορυφή + ΜΙΑ λαβή/μέσο-πλευράς', () => {
    const ent = makeLshape();
    const verts = ent.geometry.footprint.vertices;
    const grips = getColumnGrips(ent);
    expect(grips[0].columnGripKind).toBe('column-rotation');
    expect(grips.slice(1).map((g) => g.columnGripKind)).toEqual([
      ...verts.map((_, i) => `column-poly-vertex-${i}`),
      ...verts.map((_, i) => `column-poly-edge-${i}`),
    ]);
  });

  it('οι edge-λαβές κάθονται στο μέσο κάθε πλευράς του footprint', () => {
    const ent = makeLshape();
    const verts = ent.geometry.footprint.vertices;
    const grips = getColumnGrips(ent);
    const edgeGrips = grips.filter((g) => g.columnGripKind?.startsWith('column-poly-edge-'));
    expect(edgeGrips).toHaveLength(verts.length);
    edgeGrips.forEach((g, i) => {
      const w = verts[(i + 1) % verts.length];
      expect(g.position.x).toBeCloseTo((verts[i].x + w.x) / 2, 6);
      expect(g.position.y).toBeCloseTo((verts[i].y + w.y) / 2, 6);
    });
  });

  it('αντικαθιστά τα παραμετρικά grips (ΟΧΙ width/depth/arm) στο free mode', () => {
    const kinds = getColumnGrips(makeLshape()).map((g) => g.columnGripKind);
    expect(kinds).not.toContain('column-width');
    expect(kinds).not.toContain('column-depth');
    expect(kinds).not.toContain('column-arm-length');
    expect(kinds).not.toContain('column-arm-width');
    expect(kinds).not.toContain('column-center'); // ADR-363 Φ1G.5 Slice 2
  });

  it('θέση corner-λαβής = world κορυφή του rendered footprint', () => {
    const ent = makeLshape();
    const grips = getColumnGrips(ent);
    ent.geometry.footprint.vertices.forEach((v, i) => {
      expect(grips[1 + i].position).toEqual({ x: v.x, y: v.y });
    });
  });

  it('η λαβή περιστροφής κάθεται σε ΕΣΩΤΕΡΙΚΟ σημείο της διατομής (ΟΧΙ στην εγκοπή)', () => {
    const ent = makeLshape();
    const rot = getColumnGrips(ent).find((g) => g.columnGripKind === 'column-rotation');
    const poly3 = ent.geometry.footprint.vertices.map((v) => ({ x: v.x, y: v.y, z: 0 }));
    expect(rot).toBeDefined();
    expect(pointInPolygon(rot!.position, poly3)).toBe(true);
  });
});

describe('column free per-corner reshape — drag → composite (WYSIWYG)', () => {
  it('σύρσιμο γωνίας μετατρέπει σε composite με ΙΔΙΟ πλήθος κορυφών', () => {
    const ent = makeLshape();
    const moved = applyColumnGripDrag('column-poly-vertex-0', {
      originalParams: ent.params,
      delta: { x: 50, y: 50 },
    });
    expect(moved.kind).toBe('composite');
    expect(moved.composite?.polygon.length).toBe(ent.geometry.footprint.vertices.length);
  });

  it('η συρόμενη κορυφή ακολουθεί τον cursor· οι υπόλοιπες μένουν στη θέση τους', () => {
    const ent = makeLshape();
    const orig = ent.geometry.footprint.vertices;
    // Κίνηση της κορυφής 0 ΠΡΟΣ ΤΑ ΜΕΣΑ (προς το κέντρο) → το bbox μένει σταθερό
    // (οι αντιδιαμετρικές κορυφές L κρατούν τα ίδια min/max) → position σταθερό.
    const dir = { x: -Math.sign(orig[0].x) * 50, y: -Math.sign(orig[0].y) * 50 };
    const moved = applyColumnGripDrag('column-poly-vertex-0', {
      originalParams: ent.params,
      delta: dir,
    });
    expect(polyVertexHandlePosition(moved, 0).x).toBeCloseTo(orig[0].x + dir.x, 3);
    expect(polyVertexHandlePosition(moved, 0).y).toBeCloseTo(orig[0].y + dir.y, 3);
    for (let i = 1; i < orig.length; i++) {
      expect(polyVertexHandlePosition(moved, i).x).toBeCloseTo(orig[i].x, 3);
      expect(polyVertexHandlePosition(moved, i).y).toBeCloseTo(orig[i].y, 3);
    }
  });

  it('zero delta → originalParams referentially (ΔΕΝ μετατρέπεται σε composite)', () => {
    const ent = makeLshape();
    const r = applyColumnGripDrag('column-poly-vertex-0', {
      originalParams: ent.params,
      delta: { x: 0, y: 0 },
    });
    expect(r).toBe(ent.params);
    expect(r.kind).toBe('L-shape');
  });
});

describe('column free per-EDGE move — όλη η πλευρά μετακινείται', () => {
  it('σύρσιμο μέσου πλευράς → composite· οι 2 κορυφές της ακμής ακολουθούν, οι υπόλοιπες μένουν', () => {
    const ent = makeLshape();
    const orig = ent.geometry.footprint.vertices;
    // Edge 0 = κορυφές 0,1 (κάτω πλευρά). Κίνηση προς τα μέσα (κάθετα) → bbox παραμένει έγκυρο.
    const dir = { x: 0, y: -Math.sign(orig[0].y) * 40 };
    const moved = applyColumnGripDrag('column-poly-edge-0', { originalParams: ent.params, delta: dir });
    expect(moved.kind).toBe('composite');
    expect(moved.composite?.polygon.length).toBe(orig.length);

    const mv = computeColumnGeometry(moved).footprint.vertices;
    // Οι δύο κορυφές της ακμής 0 ακολουθούν το delta.
    expect(mv[0].x).toBeCloseTo(orig[0].x + dir.x, 3);
    expect(mv[0].y).toBeCloseTo(orig[0].y + dir.y, 3);
    expect(mv[1].x).toBeCloseTo(orig[1].x + dir.x, 3);
    expect(mv[1].y).toBeCloseTo(orig[1].y + dir.y, 3);
    // Οι υπόλοιπες κορυφές μένουν στη θέση τους (WYSIWYG).
    for (let i = 2; i < orig.length; i++) {
      expect(mv[i].x).toBeCloseTo(orig[i].x, 3);
      expect(mv[i].y).toBeCloseTo(orig[i].y, 3);
    }
  });

  it('zero delta σε edge → originalParams referentially', () => {
    const ent = makeLshape();
    const r = applyColumnGripDrag('column-poly-edge-2', { originalParams: ent.params, delta: { x: 0, y: 0 } });
    expect(r).toBe(ent.params);
  });
});

describe('column free per-corner reshape — σοβάς ακολουθεί (ADR-449)', () => {
  it('reshaped composite footprint → silhouette παράγει finish faces από το νέο σχήμα', () => {
    const ent = makeLshape();
    const moved = applyColumnGripDrag('column-poly-vertex-0', {
      originalParams: ent.params,
      delta: { x: -120, y: -120 }, // επεκτείνει τη γωνία προς τα έξω
    });
    const movedGeom = computeColumnGeometry(moved);
    const bands = computeStructuralFinishSilhouette(
      [{
        params: {
          finish: { enabled: true, interiorMaterialId: 'mat-plaster-int', exteriorMaterialId: 'mat-plaster-ext', thickness: 15 },
          sceneUnits: 'mm',
          baseOffset: 0,
          height: 3000,
        },
        geometry: { footprint: { vertices: movedGeom.footprint.vertices } },
      }],
      [],
      [],
      0,
    );
    expect(bands.length).toBeGreaterThan(0);
    expect(bands[0].faces.segments.length).toBeGreaterThan(0);
  });
});
