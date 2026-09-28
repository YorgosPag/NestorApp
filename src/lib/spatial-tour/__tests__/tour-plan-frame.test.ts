/**
 * @fileoverview **ΤΟ ΠΛΑΙΣΙΟ ΤΗΣ ΚΑΤΟΨΗΣ** (ADR-884 Φ2στ-β · §4.13) — καθαρό.
 *
 * - **Φ** — pixel ⟷ μέτρα: πάνω-αριστερά = αρχή, «πάνω στην εικόνα» = βορράς (y θετικό προς τα πάνω).
 * - **Ξ** — ξανακλιμάκωση: η τελεία μένει στο **ίδιο pixel** όταν αλλάζει η κλίμακα.
 * - **Ο** — πρόταση προσανατολισμού από τα βελάκια: ένα βελάκι · δύο που συμφωνούν · δύο που διαφωνούν (διασπορά) ·
 *   κανένα γείτονας με θέση ⇒ `null`.
 */

import type { FloorPlanRecord, TourNode } from '@/types/spatial-tour';

import {
  activeFloorPlan,
  calibratedPlan,
  imagePixelToPlan,
  isOnPlan,
  planToImagePixel,
  rescalePoint,
  suggestHeading,
} from '../tour-plan-frame';
import { bearingBetween } from '../viewer/tour-viewer-bearing';

const L0 = { kind: 'local', ordinal: 0 } as const;
const IMAGE = { width: 1000, height: 500, contentHash: 'h' };
const PLAN: FloorPlanRecord = {
  source: 'engineer', state: 'active', fileId: 'f1', approvedBy: 'u', approvedAt: '2026-09-27T00:00:00.000Z',
  image: IMAGE, scale: { metresPerPixel: 0.02, calibratedBy: 'u', calibratedAt: '2026-09-27T00:00:00.000Z' },
};

describe('Φ — pixel ⟷ μέτρα', () => {
  it('pixel (100, 50) με 2 cm/px = 2 m ανατολικά, 1 m νότια της αρχής', () => {
    expect(imagePixelToPlan({ x: 100, y: 50 }, 0.02)).toEqual({ x: 2, y: -1, z: 0 });
    expect(planToImagePixel({ x: 2, y: -1, z: 0 }, 0.02)).toEqual({ x: 100, y: 50 });
  });

  it('ενεργή κάτοψη και βαθμονομημένη μόνο με εικόνα ΚΑΙ κλίμακα', () => {
    const superseded = { ...PLAN, state: 'superseded' as const, fileId: 'f0' };
    expect(activeFloorPlan({ floorPlans: [superseded, PLAN] })).toBe(PLAN);
    expect(calibratedPlan(PLAN)).toEqual({ image: IMAGE, metresPerPixel: 0.02 });
    expect(calibratedPlan({ ...PLAN, scale: null })).toBeNull();
    expect(calibratedPlan({ ...PLAN, image: null })).toBeNull();
  });

  it('πάνω στην κάτοψη: μέσα ναι, έξω όχι (ανοχή μισού pixel στην άκρη)', () => {
    const plan = calibratedPlan(PLAN);
    if (plan === null) throw new Error('βαθμονομημένη');
    expect(isOnPlan({ x: 10, y: -5, z: 0 }, plan)).toBe(true);
    expect(isOnPlan({ x: 20, y: -10, z: 0 }, plan)).toBe(true);
    expect(isOnPlan({ x: 20.1, y: -5, z: 0 }, plan)).toBe(false);
    expect(isOnPlan({ x: 5, y: 1, z: 0 }, plan)).toBe(false);
  });
});

describe('Ξ — ξανακλιμάκωση', () => {
  it('η τελεία μένει στο ίδιο pixel', () => {
    const before = imagePixelToPlan({ x: 300, y: 200 }, 0.02);
    const after = rescalePoint(before, 0.02, 0.025);
    expect(planToImagePixel(after, 0.025).x).toBeCloseTo(300);
    expect(planToImagePixel(after, 0.025).y).toBeCloseTo(200);
  });
});

describe('Ο — πρόταση προσανατολισμού', () => {
  const at = (id: string, x: number, y: number, links: TourNode['links'] = []): TourNode =>
    ({ id, levelKey: L0, position: { x, y, z: 0 }, links });

  it('ένα βελάκι: το heading που κάνει το βελάκι να δείχνει στον γείτονα', () => {
    // Β ακριβώς ανατολικά (διόπτευση π/2). Το βελάκι στη φωτογραφία κάθεται σε yaw 0,3 με heading 0 ⇒ heading = π/2 − 0,3.
    const a = at('a', 0, 0, [{ toNodeId: 'b', via: 'manual', bearingRad: 0.3 }]);
    const nodes = [a, at('b', 5, 0)];
    const suggestion = suggestHeading(a, 0, nodes);
    expect(suggestion?.headingRad).toBeCloseTo(Math.PI / 2 - 0.3);
    expect(suggestion?.samples).toBe(1);
    expect(suggestion?.spreadRad).toBeCloseTo(0);
    // Με την πρόταση, το ίδιο yaw δείχνει ακριβώς στη θέση του Β.
    const [from, to] = [a.position, nodes[1].position];
    if (from === null || to === null) throw new Error('με θέση');
    expect((suggestion?.headingRad ?? 0) + 0.3).toBeCloseTo(bearingBetween(from, to) ?? Number.NaN);
  });

  it('δύο βελάκια που συμφωνούν: μηδενική διασπορά', () => {
    // Αληθινό heading = 0,1. Β βόρεια (0), Γ δυτικά (3π/2) ⇒ yaw_B = −0,1 · yaw_Γ = 3π/2 − 0,1.
    const heading = 0.1;
    const a = at('a', 0, 0, [
      { toNodeId: 'b', via: 'manual', bearingRad: -heading },
      { toNodeId: 'c', via: 'manual', bearingRad: (3 * Math.PI) / 2 - heading },
    ]);
    const suggestion = suggestHeading(a, 0, [a, at('b', 0, 4), at('c', -4, 0)]);
    expect(suggestion?.headingRad).toBeCloseTo(heading);
    expect(suggestion?.samples).toBe(2);
    expect(suggestion?.spreadRad).toBeCloseTo(0);
  });

  it('περιτύλιξη: υποψήφιες 0,05 και 2π − 0,05 δίνουν μέσο 0 — όχι π (ο αριθμητικός μέσος θα έστελνε τον κώνο ανάποδα)', () => {
    const a = at('a', 0, 0, [
      { toNodeId: 'b', via: 'manual', bearingRad: -0.05 },
      { toNodeId: 'c', via: 'manual', bearingRad: Math.PI / 2 + 0.05 },
    ]);
    const suggestion = suggestHeading(a, 0, [a, at('b', 0, 4), at('c', 4, 0)]);
    expect(Math.min(suggestion?.headingRad ?? 9, 2 * Math.PI - (suggestion?.headingRad ?? 9))).toBeCloseTo(0);
    expect(suggestion?.spreadRad).toBeCloseTo(0.05);
  });

  it('δύο βελάκια που διαφωνούν: η διασπορά το λέει', () => {
    const a = at('a', 0, 0, [
      { toNodeId: 'b', via: 'manual', bearingRad: 0 },
      { toNodeId: 'c', via: 'manual', bearingRad: Math.PI / 2 + 0.4 },
    ]);
    const suggestion = suggestHeading(a, 0, [a, at('b', 0, 4), at('c', 4, 0)]);
    expect(suggestion?.spreadRad).toBeCloseTo(0.2);
  });

  it('κανένα βελάκι προς γείτονα με θέση ⇒ null (ποτέ μαντεψιά)', () => {
    const a = at('a', 0, 0, [{ toNodeId: 'b', via: 'manual', bearingRad: 1 }, { toNodeId: 'c', via: 'manual', bearingRad: null }]);
    const b: TourNode = { id: 'b', levelKey: L0, position: null, links: [] };
    expect(suggestHeading(a, 0, [a, b, at('c', 3, 3)])).toBeNull();
    expect(suggestHeading({ ...a, position: null }, 0, [a, at('b', 1, 1)])).toBeNull();
  });
});
