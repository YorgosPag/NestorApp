/**
 * ΑΓΚΥΡΕΣ — **ΑΠΟ ΤΗ ΓΡΑΜΜΗ ΤΟΥ ΔΑΧΤΥΛΟΥ ΣΕ ΣΧΗΜΑΤΑ** (ADR-885).
 *
 * Κάθε σχήμα που βγαίνει πρέπει να είναι **απλό** — αυτό είναι όλο το συμβόλαιο. Οι
 * χειρονομίες είναι ρεαλιστικές: πυκνή δειγματοληψία, οκτάρι, κόμπος στο κλείσιμο.
 */

import { strokeToShapes } from '@/lib/geo/geo-freehand';
import { geoOutlineAreaSqm, isSimpleGeoOutline } from '@/lib/geo/geo-ring';
import {
  drawnShapesFromStroke,
  drawnShapesUrlLength,
  MAX_DRAWN_URL_CHARS,
} from '@/lib/listings/listing-drawn-area';
import type { GeoOutline, GeoPoint } from '@/types/geo/coordinates';

const CENTER = { lat: 37.98, lng: 23.73 };
/** ~111 m ανά χιλιοστό της μοίρας πλάτους — αρκετά κοντά για σχήματα κλίμακας γειτονιάς. */
const DEG = 0.001;

/** Κύκλος σχεδιασμένος με 200 δείγματα και μικρό τρέμουλο — όπως τον τραβά ένα χέρι. */
function wobblyCircle(radius: number, samples = 200): GeoPoint[] {
  return Array.from({ length: samples }, (_, k) => {
    const angle = (2 * Math.PI * k) / samples;
    const wobble = 1 + 0.01 * Math.sin(angle * 17);
    return {
      lat: CENTER.lat + radius * wobble * Math.sin(angle),
      lng: CENTER.lng + radius * wobble * Math.cos(angle),
    };
  });
}

/** Οκτάρι (λημνίσκος): δύο βρόχοι που διασταυρώνονται στο κέντρο. */
function figureEight(size: number, samples = 240): GeoPoint[] {
  return Array.from({ length: samples }, (_, k) => {
    const t = (2 * Math.PI * k) / samples;
    return { lat: CENTER.lat + size * Math.sin(t) * Math.cos(t), lng: CENTER.lng + size * Math.sin(t) };
  });
}

const OPTIONS = { toleranceM: 15, minAreaSqm: 10 };

const allSimple = (shapes: readonly GeoOutline[]): boolean => shapes.every(isSimpleGeoOutline);

describe('strokeToShapes', () => {
  it('κύκλος με τρέμουλο ⇒ ΕΝΑ απλό σχήμα, πολύ λιγότερες κορυφές', () => {
    const shapes = strokeToShapes(wobblyCircle(10 * DEG), OPTIONS);
    expect(shapes).toHaveLength(1);
    expect(allSimple(shapes)).toBe(true);
    expect(shapes[0].length).toBeLessThan(60);
  });

  it('🔴 οκτάρι ⇒ ΔΥΟ απλά σχήματα (Idealista), όχι απόρριψη', () => {
    const shapes = strokeToShapes(figureEight(10 * DEG), OPTIONS);
    expect(shapes).toHaveLength(2);
    expect(allSimple(shapes)).toBe(true);
  });

  it('κόμπος στο κλείσιμο ⇒ ο μικροσκοπικός βρόχος πέφτει, το σχήμα μένει', () => {
    const stroke = wobblyCircle(10 * DEG);
    // Το δάχτυλο προσπερνά την αρχή και κάνει μια μικρή θηλιά πριν σηκωθεί.
    const tail = [
      { lat: CENTER.lat + 0.00002, lng: CENTER.lng + 10 * DEG + 0.00003 },
      { lat: CENTER.lat - 0.00002, lng: CENTER.lng + 10 * DEG + 0.00001 },
    ];
    const shapes = strokeToShapes([...stroke, ...tail], { toleranceM: 0.5, minAreaSqm: 10 });
    expect(shapes).toHaveLength(1);
    expect(allSimple(shapes)).toBe(true);
  });

  it('γραμμή χωρίς εμβαδόν (πάνω-κάτω) ⇒ κανένα σχήμα', () => {
    const line = Array.from({ length: 50 }, (_, k) => ({ lat: CENTER.lat + k * 0.0001, lng: CENTER.lng }));
    expect(strokeToShapes([...line, ...[...line].reverse()], OPTIONS)).toEqual([]);
  });

  it('η απλοποίηση δεν απομακρύνεται από τη γραμμή πάνω από την ανοχή (εμβαδόν ~ίδιο)', () => {
    const stroke = wobblyCircle(10 * DEG);
    const [shape] = strokeToShapes(stroke, OPTIONS);
    const ratio = geoOutlineAreaSqm(shape) / geoOutlineAreaSqm(stroke);
    expect(ratio).toBeGreaterThan(0.97);
    expect(ratio).toBeLessThan(1.01);
  });
});

describe('drawnShapesFromStroke — ο προϋπολογισμός του συνδέσμου', () => {
  it('χειρονομία που χωρά ⇒ σχήματα κβαντισμένα, έγκυρα', () => {
    const shapes = drawnShapesFromStroke(wobblyCircle(10 * DEG), 15, []);
    expect(shapes).toHaveLength(1);
    expect(drawnShapesUrlLength(shapes)).toBeLessThanOrEqual(MAX_DRAWN_URL_CHARS);
  });

  it('🔑 πολύπλοκη χειρονομία με μικρή ανοχή ⇒ απλοποιείται περισσότερο αντί να απορριφθεί', () => {
    const jagged = Array.from({ length: 3000 }, (_, k) => {
      const angle = (2 * Math.PI * k) / 3000;
      const r = 20 * DEG * (1 + 0.15 * Math.sin(angle * 97));
      return { lat: CENTER.lat + r * Math.sin(angle), lng: CENTER.lng + r * Math.cos(angle) };
    });
    const shapes = drawnShapesFromStroke(jagged, 0.5, []);
    expect(shapes.length).toBeGreaterThan(0);
    expect(drawnShapesUrlLength(shapes)).toBeLessThanOrEqual(MAX_DRAWN_URL_CHARS);
    expect(allSimple(shapes)).toBe(true);
  });

  it('χωρίς χώρο για άλλο σχήμα ⇒ κενό', () => {
    const one = drawnShapesFromStroke(wobblyCircle(5 * DEG), 15, []);
    const full = Array.from({ length: 8 }, () => one[0]);
    expect(drawnShapesFromStroke(wobblyCircle(10 * DEG), 15, full)).toEqual([]);
  });
});
