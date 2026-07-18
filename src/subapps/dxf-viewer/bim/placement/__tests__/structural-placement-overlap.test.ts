/**
 * ADR-567 — SSoT «καμία δομική οντότητα πάνω σε υπάρχουσα» overlap guard.
 *
 * Η γεωμετρική σημασιολογία (ένωση=allow / επικάλυψη=block) δοκιμάζεται με ορθογώνια
 * footprints κολόνας — ένα rectangle μοντελοποιεί κάθε συμπαγές δομικό footprint.
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { Entity } from '../../../types/entities';
import {
  STRUCTURAL_OVERLAP_TYPES,
  DEFAULT_OVERLAP_RATIO_THRESHOLD,
  structuralFootprintOf,
  findStructuralOverlap,
  structuralCollisionGroupOf,
} from '../structural-placement-overlap';

/** Άξονο-ευθυγραμμισμένο ορθογώνιο footprint (κέντρο cx,cy · πλάτος w · ύψος h). */
function rect(cx: number, cy: number, w: number, h: number): Point2D[] {
  const hw = w / 2;
  const hh = h / 2;
  return [
    { x: cx - hw, y: cy - hh },
    { x: cx + hw, y: cy - hh },
    { x: cx + hw, y: cy + hh },
    { x: cx - hw, y: cy + hh },
  ];
}

/** Ελάχιστη ColumnEntity (μόνο ό,τι διαβάζει το `structuralFootprintOf`). */
function columnRect(id: string, cx: number, cy: number, w: number, h: number): Entity {
  return {
    id,
    type: 'column',
    geometry: { footprint: { vertices: rect(cx, cy, w, h).map((p) => ({ ...p, z: 0 })) } },
  } as unknown as Entity;
}

/** Ελάχιστη SlabEntity (geometry.polygon.vertices). */
function slabRect(id: string, cx: number, cy: number, w: number, h: number): Entity {
  return {
    id,
    type: 'slab',
    geometry: { polygon: { vertices: rect(cx, cy, w, h).map((p) => ({ ...p, z: 0 })) } },
  } as unknown as Entity;
}

/** Ελάχιστη FoundationEntity (geometry.footprint.vertices). */
function foundationRect(id: string, cx: number, cy: number, w: number, h: number): Entity {
  return {
    id,
    type: 'foundation',
    geometry: { footprint: { vertices: rect(cx, cy, w, h).map((p) => ({ ...p, z: 0 })) } },
  } as unknown as Entity;
}

describe('structural-placement-overlap · type set', () => {
  it('περιλαμβάνει τις συμπαγείς δομικές, ΟΧΙ host-child/thin', () => {
    for (const t of ['wall', 'column', 'beam', 'slab', 'foundation']) {
      expect(STRUCTURAL_OVERLAP_TYPES.has(t as Entity['type'])).toBe(true);
    }
    for (const t of ['opening', 'slab-opening', 'stair', 'railing', 'roof', 'furniture']) {
      expect(STRUCTURAL_OVERLAP_TYPES.has(t as Entity['type'])).toBe(false);
    }
  });
});

describe('structuralFootprintOf · dispatch', () => {
  it('column → geometry.footprint.vertices', () => {
    expect(structuralFootprintOf(columnRect('c', 0, 0, 100, 100))).toHaveLength(4);
  });
  it('slab → geometry.polygon.vertices', () => {
    const slab = {
      id: 's', type: 'slab',
      geometry: { polygon: { vertices: rect(0, 0, 100, 100).map((p) => ({ ...p, z: 0 })) } },
    } as unknown as Entity;
    expect(structuralFootprintOf(slab)).toHaveLength(4);
  });
  it('foundation → geometry.footprint.vertices', () => {
    const found = {
      id: 'f', type: 'foundation',
      geometry: { footprint: { vertices: rect(0, 0, 100, 100).map((p) => ({ ...p, z: 0 })) } },
    } as unknown as Entity;
    expect(structuralFootprintOf(found)).toHaveLength(4);
  });
  it('opening (host-child) → null', () => {
    expect(structuralFootprintOf({ id: 'o', type: 'opening' } as unknown as Entity)).toBeNull();
  });
  it('<3 κορυφές → null', () => {
    const bad = { id: 'c', type: 'column', geometry: { footprint: { vertices: [{ x: 0, y: 0, z: 0 }] } } } as unknown as Entity;
    expect(structuralFootprintOf(bad)).toBeNull();
  });
});

describe('findStructuralOverlap · block/allow', () => {
  it('πλήρες διπλότυπο (ratio ~1) → BLOCK', () => {
    const hit = findStructuralOverlap(rect(0, 0, 100, 100), [columnRect('a', 0, 0, 100, 100)]);
    expect(hit?.blockedById).toBe('a');
    expect(hit?.ratio).toBeCloseTo(1, 5);
  });

  it('μερική 50% επικάλυψη → BLOCK', () => {
    const hit = findStructuralOverlap(rect(0, 0, 100, 100), [columnRect('a', 50, 0, 100, 100)]);
    expect(hit?.blockedById).toBe('a');
    expect(hit?.ratio).toBeCloseTo(0.5, 5);
  });

  it('κοινή παρειά (touch, area 0) → ALLOW', () => {
    // candidate x:-50..50 · existing x:50..150 → μοιράζονται μόνο την ακμή x=50
    expect(findStructuralOverlap(rect(0, 0, 100, 100), [columnRect('a', 100, 0, 100, 100)])).toBeNull();
  });

  it('μικρή γωνιακή επικάλυψη (1% < 25%) → ALLOW', () => {
    // επικάλυψη 10×10=100 / min 10000 = 1%
    expect(findStructuralOverlap(rect(0, 0, 100, 100), [columnRect('a', 90, 90, 100, 100)])).toBeNull();
  });

  it('διασταύρωση λεπτών μελών (+) → ALLOW (ratio ~6.7%)', () => {
    // «τοίχος» 300×20 οριζόντιος τέμνει «τοίχο» 20×300 κάθετο → 20×20=400 / 6000 = 6.7%
    const horizontal = rect(0, 0, 300, 20);
    const vertical = columnRect('v', 0, 0, 20, 300);
    expect(findStructuralOverlap(horizontal, [vertical])).toBeNull();
  });

  it('διασταύρωση με χαμηλότερο κατώφλι (5%) → BLOCK', () => {
    const horizontal = rect(0, 0, 300, 20);
    const vertical = columnRect('v', 0, 0, 20, 300);
    const hit = findStructuralOverlap(horizontal, [vertical], { ratioThreshold: 0.05 });
    expect(hit?.blockedById).toBe('v');
  });

  it('excludeIds (self) → ALLOW ακόμη & σε πλήρη επικάλυψη', () => {
    const self = columnRect('self', 0, 0, 100, 100);
    expect(findStructuralOverlap(rect(0, 0, 100, 100), [self], { excludeIds: new Set(['self']) })).toBeNull();
  });

  it('επικαλυπτόμενο opening (host-child) → ALLOW (εκτός type set)', () => {
    const opening = { id: 'o', type: 'opening' } as unknown as Entity;
    expect(findStructuralOverlap(rect(0, 0, 100, 100), [opening])).toBeNull();
  });

  it('πρώτο-hit wins όταν πολλά μπλοκάρουν', () => {
    const existing = [columnRect('first', 0, 0, 100, 100), columnRect('second', 0, 0, 100, 100)];
    expect(findStructuralOverlap(rect(0, 0, 100, 100), existing)?.blockedById).toBe('first');
  });

  it('εκφυλισμένο candidate (<3 κορυφές) → ALLOW', () => {
    expect(findStructuralOverlap([{ x: 0, y: 0 }, { x: 1, y: 1 }], [columnRect('a', 0, 0, 100, 100)])).toBeNull();
  });
});

describe('structuralCollisionGroupOf', () => {
  it('τοίχος & κολόνα → ΞΕΧΩΡΙΣΤΕΣ ομάδες (Giorgio 2026-07-18 §wall-column)', () => {
    expect(structuralCollisionGroupOf('wall')).toBe('wall');
    expect(structuralCollisionGroupOf('column')).toBe('column');
  });
  it('δοκάρι/πλάκα/θεμέλιο → ξεχωριστές ομάδες', () => {
    expect(structuralCollisionGroupOf('beam')).toBe('beam');
    expect(structuralCollisionGroupOf('slab')).toBe('slab');
    expect(structuralCollisionGroupOf('foundation')).toBe('foundation');
  });
  it('μη-δομικός τύπος → null', () => {
    expect(structuralCollisionGroupOf('opening' as Entity['type'])).toBeNull();
    expect(structuralCollisionGroupOf('furniture' as Entity['type'])).toBeNull();
  });
});

describe('findStructuralOverlap · collision groups (ADR-567 Φ1b)', () => {
  const existingColumn = columnRect('col', 0, 0, 200, 200);

  it('«Δοκάρι από τοίχο»: δοκάρι πλήρως πάνω σε τοίχο/κολόνα → ALLOW (διαφορετική ομάδα)', () => {
    // Το δοκάρι κάθεται στην κορυφή (διαφορετικό Z) — δεν συγκρούεται με το κατακόρυφο μέλος.
    expect(findStructuralOverlap(rect(0, 0, 200, 200), [existingColumn], { candidateType: 'beam' })).toBeNull();
  });

  it('πλάκα πάνω σε κολόνα/τοίχο → ALLOW (διαφορετική ομάδα)', () => {
    expect(findStructuralOverlap(rect(0, 0, 200, 200), [existingColumn], { candidateType: 'slab' })).toBeNull();
  });

  it('τοίχος ΠΑΝΩ/ΑΝΑΜΕΣΑ σε κολόνα → ALLOW (ξεχωριστή ομάδα· Giorgio §wall-column)', () => {
    // Ο τοίχος που πλαισιώνει/ενώνεται σε κολόνα (Revit — κολόνα ενσωματώνεται στον τοίχο) δεν μπλοκάρεται,
    // ακόμη κι όταν το άκρο του καλύπτει πλήρως το μικρό footprint της κολόνας. ΑΥΤΟ ήταν το bug (2026-07-18).
    expect(findStructuralOverlap(rect(0, 0, 200, 200), [existingColumn], { candidateType: 'wall' })).toBeNull();
  });

  it('κολόνα ΠΑΝΩ σε κολόνα → BLOCK (ίδια ομάδα)', () => {
    expect(findStructuralOverlap(rect(0, 0, 200, 200), [existingColumn], { candidateType: 'column' })?.blockedById).toBe('col');
  });

  it('δοκάρι πάνω σε δοκάρι-γείτονα (ίδια ομάδα) → BLOCK', () => {
    // Το slab είναι δική του ομάδα· πλάκα πάνω σε πλάκα μπλοκάρεται.
    const existingSlab = slabRect('sl', 0, 0, 200, 200);
    expect(findStructuralOverlap(rect(0, 0, 200, 200), [existingSlab], { candidateType: 'slab' })?.blockedById).toBe('sl');
  });

  it('πέδιλο πάνω σε πέδιλο → BLOCK· δοκάρι πάνω σε πέδιλο → ALLOW', () => {
    const existingFoundation = foundationRect('fnd', 0, 0, 200, 200);
    expect(findStructuralOverlap(rect(0, 0, 200, 200), [existingFoundation], { candidateType: 'foundation' })?.blockedById).toBe('fnd');
    expect(findStructuralOverlap(rect(0, 0, 200, 200), [existingFoundation], { candidateType: 'beam' })).toBeNull();
  });

  it('χωρίς candidateType → legacy (ελέγχονται όλες οι δομικές)', () => {
    expect(findStructuralOverlap(rect(0, 0, 200, 200), [existingColumn])?.blockedById).toBe('col');
  });
});

describe('DEFAULT_OVERLAP_RATIO_THRESHOLD', () => {
  it('είναι 25%', () => {
    expect(DEFAULT_OVERLAP_RATIO_THRESHOLD).toBe(0.25);
  });
});
