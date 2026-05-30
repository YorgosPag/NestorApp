/**
 * ADR-396 v2 Phase 3 — Tests για footprint-region-classifier.ts.
 *
 * Σενάρια: exterior ring, αίθριο (καμία πλάκα πάνω), κλειστό δωμάτιο (πλάκα πάνω),
 * Γ-shape μερική κάλυψη >50% / <50%, ανάμεικτες τρύπες, degenerate, custom
 * threshold, και ο elevation resolver `selectSlabsAboveFloor`. Repo = jest.
 */

import {
  classifyFootprintRegions,
  selectSlabsAboveFloor,
  type SlabRegionFootprint,
  type SlabForRegionCoverage,
} from '../footprint-region-classifier';
import type { BuildingFootprintResult, FootprintRing } from '../building-footprint';
import type { Point3D } from '../../types/bim-base';
import type { StoreyRef } from '../../utils/bim-floor-utils';
import { polygonArea } from '../shared/polygon-utils';

// ─── Builders ──────────────────────────────────────────────────────────────

const p = (x: number, y: number): Point3D => ({ x, y, z: 0 });

/** Ορθογώνιο ring [ox,oy] → [ox+w, oy+h] (CCW). */
function rect(ox: number, oy: number, w: number, h: number): Point3D[] {
  return [p(ox, oy), p(ox + w, oy), p(ox + w, oy + h), p(ox, oy + h)];
}

function ring(points: Point3D[], isHole: boolean): FootprintRing {
  return {
    points: { points, closed: true },
    edges: [],
    isHole,
    areaCanvas: polygonArea(points),
  };
}

function footprint(outer: FootprintRing[], holes: FootprintRing[]): BuildingFootprintResult {
  // Test builder: ένα component ανά outer· οι τρύπες προσαρτώνται στο 1ο outer
  // (τα σενάρια έχουν ≤1 outer). Ο classifier δουλεύει πλέον ανά component.
  const components = outer.map((o, i) => ({ outer: o, holes: i === 0 ? holes : [] }));
  return { components, outerRings: outer, holes };
}

const slab = (poly: Point3D[]): SlabRegionFootprint => ({ polygon: poly });

// ─── Στρ.1: εξώτατο όριο ─────────────────────────────────────────────────────

describe('classifyFootprintRegions — outer rings (Στρ.1) + hole-gate', () => {
  it('lone outer ΧΩΡΙΣ τρύπα (Π/μονός τοίχος) → open-structure, ΟΧΙ insulated', () => {
    const res = classifyFootprintRegions(footprint([ring(rect(0, 0, 1000, 1000), false)], []));
    expect(res.openStructures).toHaveLength(1);
    expect(res.openStructures[0].role).toBe('open-structure');
    expect(res.openStructures[0].insulated).toBe(false);
    expect(res.exterior).toHaveLength(0);
    expect(res.atria).toHaveLength(0);
    expect(res.interiorRooms).toHaveLength(0);
  });

  it('outer ΜΕ τρύπα (περικλείει χώρο) → exterior, insulated, coverageAbove 0', () => {
    const outer = ring(rect(0, 0, 3000, 3000), false);
    const hole = ring(rect(1000, 1000, 1000, 1000), true);
    const res = classifyFootprintRegions(footprint([outer], [hole]), []);
    expect(res.exterior).toHaveLength(1);
    expect(res.exterior[0].role).toBe('exterior');
    expect(res.exterior[0].insulated).toBe(true);
    expect(res.exterior[0].coverageAbove).toBe(0);
    expect(res.openStructures).toHaveLength(0);
  });

  it('κενό footprint → κενό result', () => {
    const res = classifyFootprintRegions(footprint([], []));
    expect(res.rings).toHaveLength(0);
    expect(res.exterior).toHaveLength(0);
    expect(res.openStructures).toHaveLength(0);
  });
});

// ─── Στρ.2: αίθριο vs δωμάτιο ────────────────────────────────────────────────

describe('classifyFootprintRegions — holes (Στρ.2)', () => {
  const outer = ring(rect(0, 0, 3000, 3000), false);
  const hole = ring(rect(1000, 1000, 1000, 1000), true); // 1m × 1m στο κέντρο
  // Μακρινή πλάκα: δεδομένα ΥΠΑΡΧΟΥΝ αλλά δεν καλύπτουν την τρύπα (coverage 0).
  const farSlab = slab(rect(100000, 100000, 1000, 1000));

  it('τρύπα με δεδομένα πλακών αλλά ΧΩΡΙΣ κάλυψη → αίθριο, insulated', () => {
    const res = classifyFootprintRegions(footprint([outer], [hole]), [farSlab]);
    expect(res.atria).toHaveLength(1);
    expect(res.atria[0].role).toBe('atrium');
    expect(res.atria[0].insulated).toBe(true);
    expect(res.atria[0].coverageAbove).toBe(0);
    expect(res.interiorRooms).toHaveLength(0);
  });

  it('ΚΕΝΑ δεδομένα slabsAbove → δωμάτιο (safe default Φ5B), ΟΧΙ μόνωση', () => {
    const res = classifyFootprintRegions(footprint([outer], [hole]), []);
    expect(res.interiorRooms).toHaveLength(1);
    expect(res.interiorRooms[0].role).toBe('interior-room');
    expect(res.interiorRooms[0].insulated).toBe(false);
    expect(res.atria).toHaveLength(0);
  });

  it('τρύπα πλήρως καλυμμένη από πλάκα → κλειστό δωμάτιο, όχι insulated', () => {
    const above = slab(rect(900, 900, 1200, 1200)); // σκεπάζει όλη την τρύπα
    const res = classifyFootprintRegions(footprint([outer], [hole]), [above]);
    expect(res.interiorRooms).toHaveLength(1);
    expect(res.interiorRooms[0].role).toBe('interior-room');
    expect(res.interiorRooms[0].insulated).toBe(false);
    expect(res.interiorRooms[0].coverageAbove).toBeCloseTo(1, 5);
    expect(res.atria).toHaveLength(0);
  });

  it('Γ-shape τρύπα ~70% καλυμμένη (>50%) → δωμάτιο', () => {
    // L-shaped hole: τετράγωνο 2×2 μείον κόψιμο 1×1 (πάνω-δεξιά) → εμβαδόν 3 m².
    const lHole = ring(
      [p(0, 0), p(2000, 0), p(2000, 1000), p(1000, 1000), p(1000, 2000), p(0, 2000)],
      true,
    );
    // πλάκα σκεπάζει y∈[0,1100]: κάτω strip 2×1 (2 m²) + λωρίδα 1×0.1 (0.1 m²)
    // = 2.1 m² από 3 → ~70%.
    const above = slab(rect(0, 0, 2000, 1100));
    const res = classifyFootprintRegions(footprint([ring(rect(-100, -100, 2300, 2300), false)], [lHole]), [above]);
    expect(res.interiorRooms).toHaveLength(1);
    expect(res.interiorRooms[0].coverageAbove).toBeGreaterThan(0.5);
  });

  it('τρύπα ~30% καλυμμένη (<50%) → αίθριο', () => {
    // πλάκα σκεπάζει 0.3 m² από 1 m² τρύπα.
    const above = slab(rect(1000, 1000, 1000, 300));
    const res = classifyFootprintRegions(footprint([outer], [hole]), [above]);
    expect(res.atria).toHaveLength(1);
    expect(res.atria[0].role).toBe('atrium');
    expect(res.atria[0].coverageAbove).toBeGreaterThan(0.25);
    expect(res.atria[0].coverageAbove).toBeLessThan(0.5);
  });

  it('ανάμεικτες τρύπες: μία καλυμμένη (δωμάτιο) + μία ανοιχτή (αίθριο)', () => {
    const room = ring(rect(200, 200, 600, 600), true);
    const atrium = ring(rect(2000, 2000, 600, 600), true);
    const above = slab(rect(100, 100, 800, 800)); // σκεπάζει μόνο το πρώτο
    const res = classifyFootprintRegions(footprint([outer], [room, atrium]), [above]);
    expect(res.interiorRooms).toHaveLength(1);
    expect(res.atria).toHaveLength(1);
    expect(res.rings).toHaveLength(3); // 1 outer + 2 holes
  });

  it('degenerate (μηδενικού εμβαδού) τρύπα → δωμάτιο (καμία μόνωση)', () => {
    const degenerate = ring([p(0, 0), p(1000, 0)], true); // 2 σημεία → area 0
    // farSlab: δεδομένα υπάρχουν (noSlabData=false) → η ταξινόμηση οφείλεται στο area 0.
    const res = classifyFootprintRegions(footprint([outer], [degenerate]), [farSlab]);
    expect(res.interiorRooms).toHaveLength(1);
    expect(res.interiorRooms[0].insulated).toBe(false);
    expect(res.atria).toHaveLength(0);
  });

  it('custom coverageThreshold: 30% κάλυψη με threshold 0.25 → δωμάτιο', () => {
    const above = slab(rect(1000, 1000, 1000, 300)); // ~30%
    const res = classifyFootprintRegions(footprint([outer], [hole]), [above], {
      coverageThreshold: 0.25,
    });
    expect(res.interiorRooms).toHaveLength(1);
  });
});

// ─── selectSlabsAboveFloor (elevation SSoT reuse) ────────────────────────────

describe('selectSlabsAboveFloor', () => {
  const floors: StoreyRef[] = [
    { id: 'f0', elevation: 0 },     // ισόγειο
    { id: 'f1', elevation: 3 },     // 1ος (top-face 3000mm)
    { id: 'f2', elevation: 6 },     // 2ος (top-face 6000mm)
  ];

  function coverageSlab(id: string, storeyId: string, poly: Point3D[]): SlabForRegionCoverage {
    return {
      floorId: storeyId,
      params: {
        storeyId,
        offsetFromStorey: 0,
        levelElevation: 0,
        thickness: 200,
        outline: { vertices: poly },
      },
    };
  }

  it('κρατά μόνο πλάκες πάνω από το τρέχον όριο (storey-linked, ADR-369)', () => {
    const slabs = [
      coverageSlab('s0', 'f0', rect(0, 0, 100, 100)),
      coverageSlab('s1', 'f1', rect(0, 0, 100, 100)),
      coverageSlab('s2', 'f2', rect(0, 0, 100, 100)),
    ];
    // currentFloorTop = ισόγειο top ~0 → πάνω = f1 + f2.
    const above = selectSlabsAboveFloor(slabs, floors, 0);
    expect(above).toHaveLength(2);
  });

  it('legacy levelElevation πλάκα (μη storey-linked) resolve-άρει σωστά', () => {
    const legacy: SlabForRegionCoverage = {
      params: {
        levelElevation: 6000, // απευθείας mm
        heightOffsetFromLevel: 0,
        thickness: 200,
        outline: { vertices: rect(0, 0, 100, 100) },
      },
    };
    const above = selectSlabsAboveFloor([legacy], floors, 3000);
    expect(above).toHaveLength(1);
    expect(above[0].polygon).toHaveLength(4);
  });

  it('πλάκα στο ίδιο επίπεδο (εντός snap) ΔΕΝ θεωρείται πάνω', () => {
    const same = coverageSlab('s1', 'f1', rect(0, 0, 100, 100)); // top 3000
    const above = selectSlabsAboveFloor([same], floors, 3000);
    expect(above).toHaveLength(0);
  });
});
