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
import { gripKindOf } from '../../../hooks/grip-kinds';
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

function makeTshape(): ColumnEntity {
  const params: ColumnParams = {
    ...buildDefaultColumnParams({ x: 0, y: 0 }, 'T-shape'),
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    anchor: 'center',
    width: 600,
    depth: 600,
    sceneUnits: 'mm',
  };
  return {
    id: 'col_T',
    type: 'column',
    kind: params.kind,
    layerId: '0',
    params,
    geometry: computeColumnGeometry(params),
    validation: undefined as never,
    visible: true,
  } as unknown as ColumnEntity;
}

describe('column free per-corner reshape — emission (T-shape) [PHASE 2]', () => {
  it('T-shape → center MOVE + rotation + ΜΙΑ λαβή/κορυφή + ΜΙΑ λαβή/μέσο-πλευράς (ADR-520)', () => {
    const ent = makeTshape();
    const verts = ent.geometry.footprint.vertices;
    const grips = getColumnGrips(ent);
    expect(gripKindOf(grips[0], 'column')).toBe('column-center'); // ADR-520 — σταυρός μετακίνησης
    expect(gripKindOf(grips[1], 'column')).toBe('column-rotation');
    expect(grips.slice(2).map((g) => gripKindOf(g, 'column'))).toEqual([
      ...verts.map((_, i) => `column-poly-vertex-${i}`),
      ...verts.map((_, i) => `column-poly-edge-${i}`),
    ]);
  });

  it('αντικαθιστά τα παραμετρικά T-grips (ΟΧΙ width/depth/flange/web) στο free mode', () => {
    const kinds = getColumnGrips(makeTshape()).map((g) => gripKindOf(g, 'column'));
    expect(kinds).not.toContain('column-width');
    expect(kinds).not.toContain('column-depth');
    expect(kinds).not.toContain('column-flange-length');
    expect(kinds).not.toContain('column-web-thickness');
    expect(kinds).toContain('column-center'); // ADR-520 — ο σταυρός μετακίνησης εμφανίζεται πλέον
  });

  it('σύρσιμο γωνίας T → composite με ΙΔΙΟ πλήθος κορυφών (όπως Γ)', () => {
    const ent = makeTshape();
    const moved = applyColumnGripDrag('column-poly-vertex-0', {
      originalParams: ent.params,
      delta: { x: 40, y: 40 },
    });
    expect(moved.kind).toBe('composite');
    expect(moved.composite?.polygon.length).toBe(ent.geometry.footprint.vertices.length);
  });

  it('η λαβή περιστροφής κάθεται σε ΕΣΩΤΕΡΙΚΟ σημείο της διατομής T', () => {
    const ent = makeTshape();
    const rot = getColumnGrips(ent).find((g) => gripKindOf(g, 'column') === 'column-rotation');
    const poly3 = ent.geometry.footprint.vertices.map((v) => ({ x: v.x, y: v.y, z: 0 }));
    expect(rot).toBeDefined();
    expect(pointInPolygon(rot!.position, poly3)).toBe(true);
  });
});

describe('column free per-corner reshape — emission (L-shape)', () => {
  it('L-shape → center MOVE + rotation + ΜΙΑ λαβή/κορυφή + ΜΙΑ λαβή/μέσο-πλευράς (ADR-520)', () => {
    const ent = makeLshape();
    const verts = ent.geometry.footprint.vertices;
    const grips = getColumnGrips(ent);
    expect(gripKindOf(grips[0], 'column')).toBe('column-center'); // ADR-520 — σταυρός μετακίνησης
    expect(gripKindOf(grips[1], 'column')).toBe('column-rotation');
    expect(grips.slice(2).map((g) => gripKindOf(g, 'column'))).toEqual([
      ...verts.map((_, i) => `column-poly-vertex-${i}`),
      ...verts.map((_, i) => `column-poly-edge-${i}`),
    ]);
  });

  it('οι edge-λαβές κάθονται στο μέσο κάθε πλευράς του footprint', () => {
    const ent = makeLshape();
    const verts = ent.geometry.footprint.vertices;
    const grips = getColumnGrips(ent);
    const edgeGrips = grips.filter((g) => gripKindOf(g, 'column')?.startsWith('column-poly-edge-'));
    expect(edgeGrips).toHaveLength(verts.length);
    edgeGrips.forEach((g, i) => {
      const w = verts[(i + 1) % verts.length];
      expect(g.position.x).toBeCloseTo((verts[i].x + w.x) / 2, 6);
      expect(g.position.y).toBeCloseTo((verts[i].y + w.y) / 2, 6);
    });
  });

  it('αντικαθιστά τα παραμετρικά grips (ΟΧΙ width/depth/arm) στο free mode', () => {
    const kinds = getColumnGrips(makeLshape()).map((g) => gripKindOf(g, 'column'));
    expect(kinds).not.toContain('column-width');
    expect(kinds).not.toContain('column-depth');
    expect(kinds).not.toContain('column-arm-length');
    expect(kinds).not.toContain('column-arm-width');
    expect(kinds).toContain('column-center'); // ADR-520 — ο σταυρός μετακίνησης εμφανίζεται πλέον
  });

  it('θέση corner-λαβής = world κορυφή του rendered footprint', () => {
    const ent = makeLshape();
    const grips = getColumnGrips(ent);
    // ADR-520: grips = [center, rotation, vertex0, vertex1, …] → οι κορυφές ξεκινούν στον δείκτη 2.
    ent.geometry.footprint.vertices.forEach((v, i) => {
      expect(grips[2 + i].position).toEqual({ x: v.x, y: v.y });
    });
  });

  it('η λαβή περιστροφής κάθεται σε ΕΣΩΤΕΡΙΚΟ σημείο της διατομής (ΟΧΙ στην εγκοπή)', () => {
    const ent = makeLshape();
    const rot = getColumnGrips(ent).find((g) => gripKindOf(g, 'column') === 'column-rotation');
    const poly3 = ent.geometry.footprint.vertices.map((v) => ({ x: v.x, y: v.y, z: 0 }));
    expect(rot).toBeDefined();
    expect(pointInPolygon(rot!.position, poly3)).toBe(true);
  });
});

// ADR-520 — σταυρός μετακίνησης (4 αυτόνομα βελάκια) σε free-reshape / composite στήλες.
function makeComposite(): ColumnEntity {
  // Convex «κεκλιμένο ορθογώνιο» (mirror δύο συγχωνευμένων επικαλυπτόμενων στηλών) — LOCAL mm, CCW.
  const params: ColumnParams = {
    ...buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular'),
    kind: 'composite',
    composite: { polygon: [
      { x: -200, y: -480 }, { x: 200, y: -480 }, { x: 200, y: 480 }, { x: -200, y: 480 },
    ] },
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    anchor: 'center',
    width: 400,
    depth: 960,
    sceneUnits: 'mm',
  } as unknown as ColumnParams;
  return {
    id: 'col_C',
    type: 'column',
    kind: 'composite',
    layerId: '0',
    params,
    geometry: computeColumnGeometry(params),
    validation: undefined as never,
    visible: true,
  } as unknown as ColumnEntity;
}

describe('ADR-520 — center MOVE cross on free-reshape / composite columns', () => {
  it('composite εκπέμπει τον σταυρό μετακίνησης (column-center, movesEntity) ΜΕΣΑ στο σώμα', () => {
    const ent = makeComposite();
    const grips = getColumnGrips(ent);
    const center = grips.find((g) => gripKindOf(g, 'column') === 'column-center');
    expect(center).toBeDefined();
    expect(center!.type).toBe('center');
    expect(center!.movesEntity).toBe(true);
    const poly3 = ent.geometry.footprint.vertices.map((v) => ({ x: v.x, y: v.y, z: 0 }));
    expect(pointInPolygon(center!.position, poly3)).toBe(true);
  });

  it('ο σταυρός μετακίνησης ΔΕΝ συμπίπτει με τη λαβή περιστροφής (χωριστά σημεία)', () => {
    for (const ent of [makeComposite(), makeLshape(), makeTshape()]) {
      const grips = getColumnGrips(ent);
      const center = grips.find((g) => gripKindOf(g, 'column') === 'column-center')!;
      const rot = grips.find((g) => gripKindOf(g, 'column') === 'column-rotation')!;
      const dist = Math.hypot(center.position.x - rot.position.x, center.position.y - rot.position.y);
      expect(dist).toBeGreaterThan(1); // ξεχωριστά, όχι επικάλυψη
      // Και τα δύο μέσα στο σώμα (η περιστροφή φραγμένη από clearance).
      const poly3 = ent.geometry.footprint.vertices.map((v) => ({ x: v.x, y: v.y, z: 0 }));
      expect(pointInPolygon(center.position, poly3)).toBe(true);
      expect(pointInPolygon(rot.position, poly3)).toBe(true);
    }
  });

  it('click στον σταυρό (column-center) μετακινεί όλη τη στήλη (translate position)', () => {
    const ent = makeComposite();
    const moved = applyColumnGripDrag('column-center', {
      originalParams: ent.params,
      delta: { x: 120, y: -80 },
    });
    expect(moved.position.x).toBeCloseTo(ent.params.position.x + 120, 6);
    expect(moved.position.y).toBeCloseTo(ent.params.position.y - 80, 6);
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
