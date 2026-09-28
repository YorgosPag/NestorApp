/**
 * ADR-884 Φ2στ-γ Γ2 · §4.14 σημείο 5 — μεγέθυνση της κάτοψης = στενότερο `viewBox`, σύμβολα σταθερά στην οθόνη.
 */

import {
  PLAN_VIEW_FIT, PLAN_ZOOM_LIMITS, clientToPlan, panPlanBy, planMetresPerPixel, planUnitsPerPixel,
  planViewBox, stepPlanZoom, zoomPlanAt, zoomPlanTo,
} from '../tour-plan-zoom';
import type { PlanFrame } from '../tour-viewer-plan';

/** Κάτοψη 20 m × 10 m, αρχή στο (0, 0). */
const FRAME: PlanFrame = { minX: 0, minY: 0, width: 20, height: 10 };
/** Κάρτα 400 × 200 px ⇒ 20 px ανά μέτρο στο 1×, χωρίς περιθώρια `meet`. */
const RECT = { left: 100, top: 50, width: 400, height: 200 };

describe('tour-plan-zoom — viewBox', () => {
  it('1× = όλο το κάδρο', () => {
    expect(planViewBox(FRAME, PLAN_VIEW_FIT)).toEqual(FRAME);
  });

  it('2× γύρω από το κέντρο = το μισό πλάτος, κεντραρισμένο', () => {
    expect(planViewBox(FRAME, { zoom: 2, centre: null })).toEqual({ minX: 5, minY: 2.5, width: 10, height: 5 });
  });

  it('ζουμ εκτός ορίων κόβεται (1×–5×)', () => {
    expect(planViewBox(FRAME, { zoom: 50, centre: null }).width).toBeCloseTo(FRAME.width / PLAN_ZOOM_LIMITS.max);
    expect(planViewBox(FRAME, { zoom: 0.1, centre: null })).toEqual(FRAME);
  });

  it('το κέντρο δεν οδηγεί ποτέ το παράθυρο έξω από την κάτοψη', () => {
    expect(planViewBox(FRAME, { zoom: 2, centre: { x: -100, y: 100 } })).toEqual({ minX: 0, minY: 5, width: 10, height: 5 });
    const box = planViewBox(FRAME, { zoom: 2, centre: { x: 1000, y: -1000 } });
    expect(box.minX + box.width).toBeCloseTo(FRAME.width);
    expect(box.minY).toBeCloseTo(0);
  });

  it('σύμβολο 6 px = 6 px σε ΚΑΘΕ ζουμ και σε ΚΑΘΕ επιφάνεια (κάρτα ή ανάπτυξη)', () => {
    for (const surface of [{ width: 400, height: 200 }, { width: 1800, height: 900 }, { width: 300, height: 400 }]) {
      for (const zoom of [1, 2, 3.5, 5]) {
        const box = planViewBox(FRAME, { zoom, centre: null });
        const metres = 6 * planMetresPerPixel(box, surface);
        expect(metres / planUnitsPerPixel(box, { left: 0, top: 0, ...surface })).toBeCloseTo(6);
      }
    }
  });

  it('χωρίς μέτρηση (SSR · jsdom): σαν επιφάνεια του ιστορικού πλάτους της στήλης', () => {
    expect(planMetresPerPixel(FRAME, { width: 0, height: 0 })).toBeCloseTo(FRAME.width / 400);
  });
});

describe('tour-plan-zoom — ζουμ γύρω από σημείο', () => {
  it('το σημείο κάτω από τον δείκτη ΜΕΝΕΙ κάτω από τον δείκτη', () => {
    const view = { zoom: 1.5, centre: { x: 9, y: 4 } };
    const client = { x: 100 + 300, y: 50 + 60 };
    const before = clientToPlan(planViewBox(FRAME, view), RECT, client.x, client.y);
    const next = zoomPlanAt(FRAME, view, 3, before);
    const after = clientToPlan(planViewBox(FRAME, next), RECT, client.x, client.y);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
    expect(next.zoom).toBe(3);
  });

  it('επιστροφή στο 1× ⇒ ολόκληρη η κάτοψη (όχι «κολλημένο» κέντρο)', () => {
    expect(zoomPlanAt(FRAME, { zoom: 3, centre: { x: 2, y: 2 } }, 0.5, { x: 2, y: 2 })).toBe(PLAN_VIEW_FIT);
  });

  it('ρυθμιστικό/κουμπιά: γύρω από το κέντρο του παραθύρου · βήμα ×1,5', () => {
    const view = { zoom: 2, centre: { x: 12, y: 6 } };
    const box = planViewBox(FRAME, zoomPlanTo(FRAME, view, 4));
    expect(box.minX + box.width / 2).toBeCloseTo(12);
    expect(stepPlanZoom(FRAME, view, 1).zoom).toBeCloseTo(3);
    expect(stepPlanZoom(FRAME, { zoom: 4, centre: null }, 1).zoom).toBe(5);
  });
});

describe('tour-plan-zoom — σύρσιμο και συντεταγμένες', () => {
  it('ο κόσμος ακολουθεί το δάχτυλο: σύρσιμο δεξιά ⇒ το κέντρο πάει αριστερά', () => {
    const next = panPlanBy(FRAME, { zoom: 2, centre: { x: 10, y: 5 } }, { x: 2, y: 1 });
    expect(next.centre).toEqual({ x: 8, y: 4 });
  });

  it('clientToPlan — αντιστρέφει το `xMidYMid meet` (κεντραρισμένο, με περιθώρια)', () => {
    const tall = { left: 0, top: 0, width: 400, height: 400 };
    // 20 m στα 400 px ⇒ 20 px/m · ύψος 10 m = 200 px ⇒ 100 px περιθώριο πάνω
    expect(clientToPlan(FRAME, tall, 200, 200)).toEqual({ x: 10, y: 5 });
    expect(clientToPlan(FRAME, tall, 0, 100)).toEqual({ x: 0, y: 0 });
    expect(clientToPlan(FRAME, { left: 0, top: 0, width: 0, height: 0 }, 5, 5)).toEqual({ x: 10, y: 5 });
  });
});
