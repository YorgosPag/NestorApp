/**
 * @jest-environment node
 *
 * @fileoverview **ΤΙ ΔΕΙΧΝΕΙ Η ΚΑΤΟΨΗ ΓΙΑ ΤΟΥΣ ΧΩΡΟΥΣ** (ADR-884 Φ2στ-γ Γ3γ-1 · §12 Δ8.2–Δ8.5).
 *
 * Κάτοψη: Σαλόνι (0..6 × 0..4) και Κουζίνα (6..9 × 0..4) χωρισμένα με νοητή γραμμή στο x = 6 (ενιαίος χώρος) · Μπάνιο
 * (9,2..11 × 0..4) με **αληθινό** τοίχο 20 cm από την κουζίνα · Αποθήκη (0..2 × 4,2..6) χωρίς σημείο λήψης.
 */

import type { PlanarPoint } from '@/lib/geometry/planar-polygon';

import {
  declaredAreaDeviates,
  joinedSpaceIds,
  labelFits,
  planSpaces,
  spaceArea,
  spaceAt,
  spaceCoverage,
  spaceTouchesLine,
} from '../tour-space-view';
import type { TourViewerSeparation, TourViewerSpace } from '../tour-viewer-shapes';

const box = (x0: number, y0: number, x1: number, y1: number): PlanarPoint[] =>
  [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
const space = (id: string, points: PlanarPoint[], extra: Partial<TourViewerSpace> = {}): TourViewerSpace =>
  ({ id, points, source: 'detected', ...extra });

// Η ανίχνευση σταματά το περίγραμμα ~5 cm πριν τη νοητή γραμμή — ρεαλιστικό κενό, όχι κοινή ακμή.
const LIVING = space('living', box(0, 0, 5.95, 4));
const KITCHEN = space('kitchen', box(6.05, 0, 9, 4));
const BATH = space('bath', box(9.2, 0, 11, 4));
const STORE = space('store', box(0, 4.2, 2, 6), { room: { types: ['storage'], label: null, source: 'manual' } });
const SPACES = [LIVING, KITCHEN, BATH, STORE];
const LINE: TourViewerSeparation = { id: 'line', a: { x: 6, y: -0.1 }, b: { x: 6, y: 4.1 } };

describe('spaceAt — Δ8.3', () => {
  it('σημείο μέσα ⇒ ο χώρος του · σε τοίχο/έξω ⇒ κανένας (ποτέ «ο πλησιέστερος»)', () => {
    expect(spaceAt(SPACES, { x: 3, y: 2 })?.id).toBe('living');
    expect(spaceAt(SPACES, { x: 9.1, y: 2 })).toBeNull();
    expect(spaceAt(SPACES, { x: 20, y: 20 })).toBeNull();
  });
});

describe('γειτονία — Δ8.2 (παράγεται από τη νοητή γραμμή)', () => {
  it('σαλόνι και κουζίνα ακουμπούν τη γραμμή ⇒ ενιαίοι, και αμοιβαία', () => {
    expect(spaceTouchesLine(LIVING, LINE)).toBe(true);
    expect(spaceTouchesLine(KITCHEN, LINE)).toBe(true);
    expect([...joinedSpaceIds(SPACES, [LINE], 'living')]).toEqual(['kitchen']);
    expect([...joinedSpaceIds(SPACES, [LINE], 'kitchen')]).toEqual(['living']);
  });

  it('🔴 κοινός ΑΛΗΘΙΝΟΣ τοίχος (κουζίνα–μπάνιο) ⇒ ΟΧΙ γείτονες', () => {
    expect(joinedSpaceIds(SPACES, [LINE], 'bath').size).toBe(0);
    expect(joinedSpaceIds(SPACES, [LINE], 'kitchen').has('bath')).toBe(false);
  });

  it('χωρίς γραμμή ⇒ κανείς γείτονας (σβήνεις τη γραμμή, σβήνει η γειτονία)', () => {
    expect(joinedSpaceIds(SPACES, [], 'living').size).toBe(0);
  });

  it('γραμμή που ακουμπά μόνο στην άκρη της ⇒ δεν μετρά (κρίνει η πλειοψηφία κατά μήκος, όχι ένα δείγμα)', () => {
    // Ξεκινά ΠΑΝΩ στην ακμή του σαλονιού (το 1ο από τα 9 δείγματα είναι κοντά) και φεύγει 8 m έξω.
    const grazing: TourViewerSeparation = { id: 'g', a: { x: 5.95, y: 3.5 }, b: { x: 5.95, y: 12 } };
    expect(spaceTouchesLine(LIVING, grazing)).toBe(false);
  });

  it.each([
    [0.1, true],
    [0.14, true],
    [0.25, false],
    [0.5, false],
  ])('χώρος που τελειώνει %s m από τη γραμμή ⇒ ακουμπά: %s (ανοχή 15 cm — κάτω από ένα πάχος τοίχου)', (gap, touches) => {
    const east = space('east', box(6 + gap, 0, 9, 4));
    expect(spaceTouchesLine(east, LINE)).toBe(touches);
  });
});

describe('planSpaces — ο ρόλος κάθε χώρου', () => {
  const placed = [{ nodeId: 'n-living', point: { x: 3, y: 2 } }, { nodeId: 'n-kitchen', point: { x: 7.5, y: 2 } },
    { nodeId: 'n-bath', point: { x: 10, y: 2 } }];
  const tones = (current: string | null) =>
    Object.fromEntries(planSpaces(SPACES, [LINE], placed, current).map((s) => [s.space.id, s.tone]));

  it('στο σαλόνι ⇒ σαλόνι here, κουζίνα joined, μπάνιο idle, αποθήκη uncaptured', () => {
    expect(tones('n-living')).toEqual({ living: 'here', kitchen: 'joined', bath: 'idle', store: 'uncaptured' });
  });

  it('στο μπάνιο ⇒ κανένας ενιαίος γείτονας', () => {
    expect(tones('n-bath')).toEqual({ living: 'idle', kitchen: 'idle', bath: 'here', store: 'uncaptured' });
  });

  it('τρέχον σημείο εκτός κάθε χώρου / εκτός ορόφου ⇒ κανένα κίτρινο (Δ8.3)', () => {
    const outside = [...placed, { nodeId: 'n-hall', point: { x: 9.1, y: 2 } }];
    const t = Object.fromEntries(planSpaces(SPACES, [LINE], outside, 'n-hall').map((s) => [s.space.id, s.tone]));
    expect(Object.values(t)).not.toContain('here');
    expect(Object.values(tones('elsewhere'))).not.toContain('here');
  });

  it('τα σημεία μέσα σε κάθε χώρο, με τη σειρά τους', () => {
    const [living] = planSpaces(SPACES, [LINE], [...placed, { nodeId: 'n-living-2', point: { x: 1, y: 1 } }], null);
    expect(living.nodeIds).toEqual(['n-living', 'n-living-2']);
  });
});

describe('spaceArea — Δ8.4', () => {
  it('μετρημένο από τις κορυφές · δηλωμένο υπερισχύει με την πηγή του', () => {
    expect(spaceArea(KITCHEN)).toEqual({ kind: 'measured', areaM2: expect.closeTo(2.95 * 4, 9) });
    const declared = { ...KITCHEN, declaredArea: { areaM2: 12.4, source: 'engineer-study' as const } };
    expect(spaceArea(declared)).toEqual({ kind: 'declared', areaM2: 12.4, source: 'engineer-study' });
  });
});

describe('labelFits', () => {
  it('ύψος και πλάτος πρέπει να χωρούν· λιγότερες γραμμές χωρούν ευκολότερα', () => {
    expect(labelFits(1, ['Σαλόνι', '≈ 24 τ.μ.'], 0.2)).toBe(true);
    expect(labelFits(0.15, ['Σαλόνι', '≈ 24 τ.μ.'], 0.2)).toBe(false); // ύψος 0,48 > 2 × 0,15
    expect(labelFits(0.15, ['≈ 24 τ.μ.'], 0.2)).toBe(false);
    expect(labelFits(0.5, ['Ένα πολύ μεγάλο όνομα χώρου'], 0.2)).toBe(false); // πλάτος
  });
});

describe('πληρότητα — Δ8.3 (Γ3γ-2β)', () => {
  it('«Χώροι: 2 από 3 σημεία» — και ΠΟΙΟ λείπει, με τη σειρά του', () => {
    const placed = [
      { nodeId: 'p-living', point: { x: 3, y: 2 } },
      { nodeId: 'p-hall', point: { x: 9.1, y: 2 } }, // στον τοίχο κουζίνας–μπάνιου ⇒ κανένας χώρος
      { nodeId: 'p-bath', point: { x: 10, y: 2 } },
    ];
    expect(spaceCoverage(SPACES, placed)).toEqual({ covered: 2, total: 3, missing: ['p-hall'] });
  });

  it('όροφος χωρίς σημεία ⇒ 0 από 0, τίποτα δεν λείπει', () => {
    expect(spaceCoverage(SPACES, [])).toEqual({ covered: 0, total: 0, missing: [] });
  });
});

describe('φύλακας 15% — Δ8.4 · Δ9.4', () => {
  it('«δηλώσατε 20, η κάτοψη δείχνει ≈ 12» ⇒ ρωτά · 12,40 έναντι 12 ⇒ σιωπά', () => {
    expect(declaredAreaDeviates(20, 12)).toBe(true);
    expect(declaredAreaDeviates(12.4, 12)).toBe(false);
  });

  it('το όριο είναι ΑΥΣΤΗΡΑ πάνω από 15%, σχετικά με το ΜΕΤΡΗΜΕΝΟ (και προς τα κάτω)', () => {
    expect(declaredAreaDeviates(11.5, 10)).toBe(false); // 15% ακριβώς
    expect(declaredAreaDeviates(11.6, 10)).toBe(true);
    expect(declaredAreaDeviates(8.4, 10)).toBe(true);
    expect(declaredAreaDeviates(8.6, 10)).toBe(false);
  });

  it('χωρίς μετρημένο ⇒ ποτέ (δεν υπάρχει μέτρο σύγκρισης)', () => {
    expect(declaredAreaDeviates(20, 0)).toBe(false);
  });
});
