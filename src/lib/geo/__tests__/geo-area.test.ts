/**
 * ΑΓΚΥΡΕΣ — **Η ΣΧΕΣΗ ΔΥΟ ΠΕΡΙΟΧΩΝ ΕΧΕΙ ΤΡΕΙΣ ΤΙΜΕΣ** (ADR-777 §8.63).
 *
 * ⚠️ **Κάθε ζεύγος σχημάτων δοκιμάζεται και στις τρεις σχέσεις.** Η μηχανή έχει
 * **τέσσερις** κλάδους (κύκλος→κύκλος, κύκλος→κουτί, κουτί→κύκλος, κουτί→κουτί), και
 * ένας κλάδος που δοκιμάζεται μόνο στο `disjoint` είναι κλάδος που μπορεί να
 * επιστρέφει `'within'` για τα πάντα χωρίς να κοκκινίσει τίποτα.
 */

import { areaRelation, areasOverlap, isBoundingBox } from '@/lib/geo/geo-area';
import type { GeoBoundingBox, GeoCircle } from '@/types/geo/coordinates';

/** Κέντρο Αθήνας — όλα τα δείγματα ζουν εδώ γύρω, σε κλίμακα πόλης. */
const ATHENS = { lat: 37.9838, lng: 23.7275 };

/** ~2,2 χλμ. πλάτος/ύψος γύρω από το κέντρο — τυπικό κάδρο χάρτη σε ζουμ γειτονιάς. */
const FRAME: GeoBoundingBox = {
  south: 37.974,
  west: 23.7155,
  north: 37.994,
  east: 23.7395,
};

/** Ορθογώνιο στη Θεσσαλονίκη — **σίγουρα** αλλού. */
const FAR_FRAME: GeoBoundingBox = { south: 40.6, west: 22.9, north: 40.68, east: 23.0 };

const circle = (radiusKm: number, center = ATHENS): GeoCircle => ({ center, radiusKm });

describe('isBoundingBox — η διάκριση των δύο σχημάτων', () => {
  it('ξεχωρίζει ορθογώνιο από κύκλο', () => {
    expect(isBoundingBox(FRAME)).toBe(true);
    expect(isBoundingBox(circle(1))).toBe(false);
  });
});

describe('κύκλος → κύκλος', () => {
  it('μικρός κύκλος μέσα σε μεγάλο = within', () => {
    expect(areaRelation(circle(0.2), circle(5))).toBe('within');
  });

  it('μακρινοί κύκλοι = disjoint', () => {
    expect(areaRelation(circle(1), circle(1, { lat: 40.64, lng: 22.94 }))).toBe('disjoint');
  });

  it('μεγάλος κύκλος γύρω από μικρό ερώτημα = intersects, ΟΧΙ within', () => {
    // 🔑 Η ασυμμετρία είναι το νόημα: «ξέρω μόνο την πόλη» δεν σημαίνει «είναι εδώ».
    expect(areaRelation(circle(10), circle(1))).toBe('intersects');
  });

  it('ΤΟ ΣΗΜΕΙΟ (ακτίνα 0) ΔΕΝ παίρνει ποτέ intersects — βεβαιότητα = δυαδική απάντηση', () => {
    expect(areaRelation(circle(0), circle(5))).toBe('within');
    expect(areaRelation(circle(0, { lat: 40.64, lng: 22.94 }), circle(5))).toBe('disjoint');
  });
});

describe('κύκλος → ορθογώνιο — Ο ΚΛΑΔΟΣ ΠΟΥ ΚΡΙΝΕΙ ΤΙΣ ΑΓΓΕΛΙΕΣ', () => {
  it('σημείο μέσα στο κάδρο = within', () => {
    expect(areaRelation(circle(0), FRAME)).toBe('within');
  });

  it('σημείο έξω από το κάδρο = disjoint', () => {
    expect(areaRelation(circle(0, { lat: 40.64, lng: 22.94 }), FRAME)).toBe('disjoint');
  });

  it('μικρή αβεβαιότητα που χωράει ολόκληρη = within', () => {
    // 250 m γύρω από το κέντρο ενός κάδρου ~2,2 χλμ. — χωράει άνετα.
    expect(areaRelation(circle(0.25), FRAME)).toBe('within');
  });

  it('🔴 ΤΟ ΕΛΑΤΤΩΜΑ ΤΟΥ §1: «μόνο πόλη» με το κέντρο ΜΕΣΑ ΔΕΝ είναι «μέσα»', () => {
    // Αυτή είναι η αγγελία που ο παλιός φιλτραριστής έκρινε ως σίγουρα εντός, επειδή
    // κοίταζε **μόνο** το σημείο. Η αβεβαιότητα των 10 χλμ. ξεχειλίζει από το κάδρο.
    expect(areaRelation(circle(10), FRAME)).toBe('intersects');
  });

  it('αβεβαιότητα που αγγίζει το κάδρο από ΕΞΩ = intersects', () => {
    // Κέντρο έξω από το κάδρο, αλλά ο κύκλος 5 χλμ. το τέμνει.
    expect(areaRelation(circle(5, { lat: 38.02, lng: 23.7275 }), FRAME)).toBe('intersects');
  });

  it('αβεβαιότητα που δεν φτάνει = disjoint', () => {
    expect(areaRelation(circle(1, { lat: 40.64, lng: 22.94 }), FRAME)).toBe('disjoint');
  });
});

describe('ορθογώνιο → κύκλος', () => {
  it('μικρό κάδρο μέσα σε πλατύ κύκλο = within', () => {
    expect(areaRelation(FRAME, circle(50))).toBe('within');
  });

  it('κάδρο που ο κύκλος τέμνει χωρίς να καλύπτει = intersects', () => {
    expect(areaRelation(FRAME, circle(1))).toBe('intersects');
  });

  it('κάδρο αλλού = disjoint', () => {
    expect(areaRelation(FAR_FRAME, circle(5))).toBe('disjoint');
  });
});

describe('ορθογώνιο → ορθογώνιο', () => {
  const inner: GeoBoundingBox = { south: 37.98, west: 23.72, north: 37.99, east: 23.735 };

  it('εσωτερικό κάδρο = within', () => {
    expect(areaRelation(inner, FRAME)).toBe('within');
  });

  it('κάδρο που ξεχειλίζει = intersects', () => {
    expect(areaRelation({ ...inner, north: 38.05 }, FRAME)).toBe('intersects');
  });

  it('κάδρο αλλού = disjoint', () => {
    expect(areaRelation(FAR_FRAME, FRAME)).toBe('disjoint');
  });

  it('ταυτόσημο κάδρο = within — το σύνορο μετρά ως μέσα', () => {
    expect(areaRelation(FRAME, FRAME)).toBe('within');
  });
});

describe('areasOverlap — το ΕΝΑ ερώτημα της ζήτησης', () => {
  it('within και intersects θεωρούνται επικάλυψη· disjoint όχι', () => {
    expect(areasOverlap(circle(0.25), FRAME)).toBe(true);
    expect(areasOverlap(circle(10), FRAME)).toBe(true);
    expect(areasOverlap(FAR_FRAME, FRAME)).toBe(false);
  });

  it('συμμετρικό για δύο κύκλους — συμβόλαιο της ομοιότητας ζήτησης', () => {
    const a = circle(10);
    const b = circle(10, { lat: 38.05, lng: 23.8 });
    expect(areasOverlap(a, b)).toBe(areasOverlap(b, a));
  });
});
