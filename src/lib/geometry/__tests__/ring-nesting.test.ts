/**
 * ADR-920 §14.12 Β2 — δακτύλιοι χωρίς ιεραρχία → πολύγωνα με τις τρύπες τους (κανόνας even–odd ως βάθος).
 *
 * Κάθε προσδοκία βγαίνει από το ΣΧΗΜΑ (ποιος περιέχει ποιον, εμβαδά), όχι από τη συνάρτηση: τετράγωνα γνωστής πλευράς.
 */

import { pointInPolygon, shoelaceArea, type PlanarPoint } from '../planar-polygon';
import { nestRings, type NestedPolygon } from '../ring-nesting';

/** Τετράγωνο με κέντρο (cx, cy) και μισή πλευρά `half`, αριστερόστροφα ή δεξιόστροφα. */
function square(cx: number, cy: number, half: number, clockwise = false): PlanarPoint[] {
  const ccw = [
    { x: cx - half, y: cy - half }, { x: cx + half, y: cy - half },
    { x: cx + half, y: cy + half }, { x: cx - half, y: cy + half },
  ];
  return clockwise ? ccw.reverse() : ccw;
}

/** Γεμίζει το σημείο; — ο ορισμός του πολυγώνου με τρύπες, ανεξάρτητα από το πώς χτίστηκε. */
function fills(polygons: readonly NestedPolygon[], point: PlanarPoint): boolean {
  return polygons.some((p) => pointInPolygon(point, p.outer) && !p.holes.some((hole) => pointInPolygon(point, hole)));
}

describe('nestRings', () => {
  it('ένας δακτύλιος ⇒ ένα πολύγωνο χωρίς τρύπες, αριστερόστροφο όποια φορά κι αν είχε', () => {
    for (const clockwise of [false, true]) {
      const [only, ...rest] = nestRings([square(0, 0, 10, clockwise)]);
      expect(rest).toHaveLength(0);
      expect(only.holes).toHaveLength(0);
      expect(shoelaceArea(only.outer)).toBeCloseTo(400, 9);
    }
  });

  it('δακτύλιος μέσα σε δακτύλιο ⇒ τρύπα ΤΟΥ, δεξιόστροφη — όποια σειρά κι αν ήρθαν', () => {
    for (const rings of [[square(0, 0, 10), square(0, 0, 3)], [square(0, 0, 3), square(0, 0, 10)]]) {
      const polygons = nestRings(rings);
      expect(polygons).toHaveLength(1);
      expect(shoelaceArea(polygons[0].outer)).toBeCloseTo(400, 9);
      expect(polygons[0].holes).toHaveLength(1);
      expect(shoelaceArea(polygons[0].holes[0])).toBeCloseTo(-36, 9);
    }
  });

  it('δύο ξένα νησιά ⇒ δύο πολύγωνα — ποτέ το δεύτερο ως τρύπα του πρώτου', () => {
    const polygons = nestRings([square(0, 0, 10), square(50, 0, 4)]);
    expect(polygons).toHaveLength(2);
    expect(polygons.every((p) => p.holes.length === 0)).toBe(true);
    expect(fills(polygons, { x: 50, y: 0 })).toBe(true);
  });

  it('νησί μέσα σε τρύπα ⇒ δικό του πολύγωνο (βάθος 2), και η τρύπα μένει στον εξωτερικό', () => {
    const polygons = nestRings([square(0, 0, 10), square(0, 0, 6), square(0, 0, 2)]);
    expect(polygons).toHaveLength(2);
    const areas = polygons.map((p) => shoelaceArea(p.outer)).sort((a, b) => a - b);
    expect(areas[0]).toBeCloseTo(16, 9);
    expect(areas[1]).toBeCloseTo(400, 9);
    // even–odd, σημείο προς σημείο: γέμισμα στο δαχτυλίδι, κενό στην τρύπα, γέμισμα στο νησί.
    expect(fills(polygons, { x: 8, y: 0 })).toBe(true);
    expect(fills(polygons, { x: 4, y: 0 })).toBe(false);
    expect(fills(polygons, { x: 0, y: 0 })).toBe(true);
  });

  it('δύο τρύπες στον ίδιο δακτύλιο ⇒ και οι δύο σε ΑΥΤΟΝ, όχι η μία στην άλλη', () => {
    const polygons = nestRings([square(0, 0, 10), square(-5, 0, 2), square(5, 0, 2)]);
    expect(polygons).toHaveLength(1);
    expect(polygons[0].holes).toHaveLength(2);
  });

  it('τρύπα που ακουμπά το περίγραμμα σε ΚΟΡΥΦΗ μένει τρύπα (το σημείο ελέγχου δεν είναι κορυφή)', () => {
    // Ρόμβος με μία κορυφή πάνω στην κορυφή (10, 10) του τετραγώνου.
    const touching = [{ x: 10, y: 10 }, { x: 4, y: 8 }, { x: 2, y: 2 }, { x: 8, y: 4 }];
    const polygons = nestRings([square(0, 0, 10), touching]);
    expect(polygons).toHaveLength(1);
    expect(polygons[0].holes).toHaveLength(1);
  });

  it('εκφυλισμένοι δακτύλιοι (λιγότερες από τρεις κορυφές, μηδενικό εμβαδόν) δεν γίνονται πολύγωνα', () => {
    const line = [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }];
    expect(nestRings([[{ x: 0, y: 0 }, { x: 1, y: 1 }], line])).toEqual([]);
    expect(nestRings([])).toEqual([]);
  });
});
