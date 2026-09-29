/**
 * ADR-884 Φ2στ-γ Γ3 · §12 Δ8.1–Δ8.2 — ανίχνευση χώρου με ένα κλικ, πάνω σε τεχνητές κατόψεις.
 */

import { pointInPolygon } from '@/lib/geometry/planar-polygon';

import { detectSpace } from '../space-detect';
import type { SpaceDetectInput, SpaceDetectResult } from '../space-detect-types';
import { FIXTURE_MPP, LEFT_ROOM_AREA_M2, planFixture, twoRoomPlan, type PlanFixture } from './plan-fixture';

type Found = Extract<SpaceDetectResult, { ok: true }>;

function detect(plan: PlanFixture, seedM: [number, number], extra: Partial<SpaceDetectInput> = {}): SpaceDetectResult {
  return detectSpace({
    raster: plan.raster, metresPerPixel: FIXTURE_MPP, seed: plan.px(...seedM), separations: [], otherStops: [], ...extra,
  });
}

function found(result: SpaceDetectResult): Found {
  if (!result.ok) throw new Error(`αναμενόταν χώρος, ήρθε άρνηση «${result.refusal}»`);
  return result;
}

const areaM2 = (r: Found): number => r.areaPx * FIXTURE_MPP * FIXTURE_MPP;
const inside = (r: Found, plan: PlanFixture, xM: number, yM: number): boolean => pointInPolygon(plan.px(xM, yM), r.outline);

describe('detectSpace — δωμάτιο με πόρτα', () => {
  it('πόρτα 0,9 m ⇒ ΚΛΕΙΣΤΟ δωμάτιο: ορθογώνιο 4 κορυφών, εμβαδόν ως την παρειά (±1%)', () => {
    const plan = twoRoomPlan(0.9);
    const r = found(detect(plan, [2, 4]));
    expect(r.orthogonal).toBe(true);
    expect(r.outline).toHaveLength(4);
    expect(areaM2(r)).toBeGreaterThan(LEFT_ROOM_AREA_M2 * 0.99);
    expect(areaM2(r)).toBeLessThan(LEFT_ROOM_AREA_M2 * 1.01);
    expect(inside(r, plan, 6, 4)).toBe(false); // το διπλανό δωμάτιο ΔΕΝ μπήκε από την πόρτα
  });

  it('ίδιο αποτέλεσμα όπου κι αν πατήσεις μέσα στο δωμάτιο — και πάνω σε κείμενο', () => {
    const plan = twoRoomPlan(0.9);
    plan.fill(1.5, 3.0, 3.5, 3.04); // «ΣΑΛΟΝΙ» — γραμμή 2 cm
    const a = found(detect(plan, [1, 1]));
    const b = found(detect(plan, [2.5, 3.02]));
    expect(areaM2(b)).toBeCloseTo(areaM2(a), 1);
    expect(b.outline).toHaveLength(4);
  });

  it('γραμμή επίπλου (2 cm) ΚΟΛΛΗΜΕΝΗ στον τοίχο δεν «σκίζει» το περίγραμμα', () => {
    const plan = twoRoomPlan(0.9);
    plan.fill(0.7, 5.0, 2.2, 5.04); // πάγκος 1,5 m από τον αριστερό τοίχο
    const r = found(detect(plan, [2, 3]));
    expect(r.outline).toHaveLength(4);
    expect(areaM2(r)).toBeGreaterThan(LEFT_ROOM_AREA_M2 * 0.99);
  });

  it('κλικ στο βάθος μιας ΚΟΓΧΗΣ: το δωμάτιο στο οποίο ανοίγει, όχι εκείνο πίσω από τον τοίχο της (πιο κοντά σε ευθεία)', () => {
    const plan = twoRoomPlan(0.9);
    plan.fill(4.4, 4.5, 4.6, 5.3, 255);  // η κόγχη ανοίγει στο αριστερό δωμάτιο…
    plan.fill(4.4, 4.4, 5.5, 4.5);       // …και μπαίνει 1 m στο δεξί (τοίχοι 10 cm)
    plan.fill(4.4, 5.3, 5.5, 5.4);
    plan.fill(5.4, 4.5, 5.5, 5.3);
    const r = found(detect(plan, [5.35, 4.9]));
    expect(inside(r, plan, 2, 4)).toBe(true);
    expect(inside(r, plan, 7, 3)).toBe(false);
  });

  it('κλικ ακριβώς δίπλα σε λεπτό μεσότοιχο παίρνει ΤΟ ΔΙΚΟ ΤΟΥ δωμάτιο, όχι το διπλανό', () => {
    const plan = twoRoomPlan(0.9);
    const r = found(detect(plan, [4.38, 5]));
    expect(inside(r, plan, 2, 4)).toBe(true);
    expect(inside(r, plan, 6, 4)).toBe(false);
  });
});

describe('detectSpace — ενιαίος χώρος (Δ8.2)', () => {
  it('άνοιγμα 2 m ⇒ ΕΝΑΣ χώρος και για τα δύο «δωμάτια»', () => {
    const plan = twoRoomPlan(2);
    const r = found(detect(plan, [2, 4]));
    expect(inside(r, plan, 6, 4)).toBe(true);
  });

  it('δύο σημεία λήψης στον ίδιο ενιαίο χώρο ⇒ πρόταση ΚΑΘΕΤΗΣ γραμμής στο άνοιγμα, πλάτος ≈ 2 m', () => {
    const plan = twoRoomPlan(2);
    // Το πλησιέστερο σημείο είναι 25 cm από τον τοίχο: ΔΕΝ είναι αυτό ο «λαιμός» — λαιμός είναι το άνοιγμα.
    const r = found(detect(plan, [2, 4], { otherStops: [plan.px(7.5, 5.5), plan.px(6.2, 0.95)] }));
    const s = r.separation;
    expect(s).not.toBeNull();
    expect(s?.otherStopIndex).toBe(1); // το ΠΛΗΣΙΕΣΤΕΡΟ
    const { a, b } = s!.segment;
    expect(Math.abs(a.x - b.x)).toBeLessThan(1);                 // κάθετη
    expect((a.x + b.x) / 2 * FIXTURE_MPP).toBeCloseTo(4.5, 0);    // μέσα στο άνοιγμα του μεσότοιχου
    expect(s!.widthPx * FIXTURE_MPP).toBeGreaterThan(1.9);
    expect(s!.widthPx * FIXTURE_MPP).toBeLessThan(2.2);
  });

  it('με την εγκεκριμένη γραμμή ο χώρος ΧΩΡΙΖΕΤΑΙ — και καμία νέα πρόταση', () => {
    const plan = twoRoomPlan(2);
    const other = plan.px(6, 4);
    const first = found(detect(plan, [2, 4], { otherStops: [other] }));
    const r = found(detect(plan, [2, 4], { otherStops: [other], separations: [first.separation!.segment] }));
    expect(inside(r, plan, 6, 4)).toBe(false);
    expect(r.separation).toBeNull();
    expect(areaM2(r)).toBeLessThan(LEFT_ROOM_AREA_M2 * 1.06);
  });
});

describe('detectSpace — αρνήσεις με όνομα', () => {
  it('χωρίς βαθμονόμηση · κλικ εκτός εικόνας', () => {
    const plan = twoRoomPlan(0.9);
    expect(detectSpace({ raster: plan.raster, metresPerPixel: 0, seed: plan.px(2, 4), separations: [], otherStops: [] }))
      .toEqual({ ok: false, refusal: 'uncalibrated' });
    expect(detect(plan, [-1, 4])).toEqual({ ok: false, refusal: 'seed-outside' });
  });

  it('ανοιχτός εξωτερικός τοίχος (3 m) ⇒ διαρροή, ΟΧΙ ψεύτικο περίγραμμα', () => {
    const plan = twoRoomPlan(0.9);
    plan.fill(1, 0.5, 4, 0.7, 255);
    expect(detect(plan, [2, 4])).toEqual({ ok: false, refusal: 'leak' });
  });

  it('κλικ βαθιά μέσα σε παχύ τοίχο ⇒ «πάνω σε τοίχο» · ντουλάπι 0,5 × 0,5 m ⇒ «πολύ μικρό»', () => {
    const plan = twoRoomPlan(0.9);
    plan.fill(1.5, 1.5, 3.5, 3.5);
    expect(detect(plan, [2.5, 2.5])).toEqual({ ok: false, refusal: 'seed-on-wall' });
    const closet = planFixture(3, 3);
    closet.fill(1, 1, 2, 1.25); closet.fill(1, 1.75, 2, 2); closet.fill(1, 1, 1.25, 2); closet.fill(1.75, 1, 2, 2);
    expect(detect(closet, [1.5, 1.5])).toEqual({ ok: false, refusal: 'too-small' });
  });

  it('κάτοψη σχεδιασμένη ΜΟΝΟ με λεπτές γραμμές (2 cm) ⇒ δεύτερη προσπάθεια χωρίς «άνοιγμα» — βρίσκει το δωμάτιο', () => {
    const plan = planFixture(6, 5);
    plan.fill(0.5, 0.5, 5.5, 0.52); plan.fill(0.5, 4.48, 5.5, 4.5);
    plan.fill(0.5, 0.5, 0.52, 4.5); plan.fill(5.48, 0.5, 5.5, 4.5);
    const r = found(detect(plan, [3, 2.5]));
    expect(areaM2(r)).toBeGreaterThan(4.9 * 3.9);
    expect(areaM2(r)).toBeLessThan(5.1 * 4.1);
  });
});
