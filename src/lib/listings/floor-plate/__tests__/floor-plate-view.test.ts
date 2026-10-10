/**
 * @fileoverview **Η όψη της κάτοψης ορόφου — ο κριτής και η γεωμετρία** (ADR-907 §11.9), εκτελεσμένα.
 *
 * ΟΨ-1 — `presentableFloorPlate`: ο ΕΝΑΣ κριτής καρτέλας και φύλλου. Μαντεμένο χωρίς έγκριση, εικόνα χωρίς διαστάσεις,
 *        μία χαλασμένη μονάδα, καμία ή δύο «αυτό το ακίνητο» ⇒ `null` (καμία καρτέλα με κενή σκηνή, ποτέ μισός όροφος).
 * ΟΨ-2 — `floorPlateShapes`: κλάσματα → **φυσικά pixels** (μη τετράγωνη εικόνα), ο αριθμός είναι η θέση στο έγγραφο και
 *        δεν μετακινείται όταν λείψει μονάδα, σύνδεσμος **μόνο** για γείτονα με αγγελία.
 * ΟΨ-3 — η ετικέτα πέφτει **μέσα** στο σχήμα και όταν το κεντροειδές πέφτει έξω (σχήμα Γ).
 * ΟΨ-4 — σειρά ζωγραφικής («αυτό το ακίνητο» τελευταίο) και γραμμές υπομνήματος (μόνο όσες καταστάσεις υπάρχουν).
 */

import { pointInPolygon } from '@/lib/geometry/planar-polygon';
import type { FloorPlateUnit, ListingFloorPlate } from '@/types/public-listing';

import { presentableFloorPlate } from '../floor-plate-publication';
import { floorPlateLegendStates, floorPlateShapes, inPaintOrder } from '../floor-plate-view';

const SQUARE = [0.1, 0.1, 0.4, 0.1, 0.4, 0.4, 0.1, 0.4];
const OTHER = [0.5, 0.1, 0.9, 0.1, 0.9, 0.4, 0.5, 0.4];
/** Σχήμα Γ: το κεντροειδές εμβαδού πέφτει στη γωνία που λείπει. */
const ELL = [0.1, 0.5, 0.9, 0.5, 0.9, 0.6, 0.2, 0.6, 0.2, 0.95, 0.1, 0.95];

const SELF: FloorPlateUnit = { outline: SQUARE, state: 'self' };
const FREE: FloorPlateUnit = { outline: OTHER, state: 'available', listingId: 'prop_2' };
const HELD: FloorPlateUnit = { outline: ELL, state: 'reserved' };

const IMAGE = { url: 'https://shelf/floor.webp', width: 2000, height: 1000, altKey: 'listing-detail:floorPlate.alt', sources: [] };

function plate(units: readonly unknown[], over: Record<string, unknown> = {}): ListingFloorPlate {
  return { provenance: 'declared', at: '2026-10-10T08:00:00.000Z', value: { image: IMAGE, units }, ...over } as unknown as ListingFloorPlate;
}

const listingOf = (...plates: ListingFloorPlate[]) => ({ floorPlates: plates });

describe('ΟΨ-1 presentableFloorPlate — ο ένας κριτής της όψης', () => {
  it('κάτοψη με αναγνώσιμες μονάδες και μία «αυτό το ακίνητο» παρουσιάζεται', () => {
    const shown = plate([SELF, FREE, HELD]);
    expect(presentableFloorPlate(listingOf(shown))).toBe(shown);
  });

  it('κενό κουτί ⇒ null', () => {
    expect(presentableFloorPlate(listingOf())).toBeNull();
  });

  it('🔴 μαντεμένη χωρίς έγκριση ανθρώπου ⇒ null· με έγκριση παρουσιάζεται', () => {
    expect(presentableFloorPlate(listingOf(plate([SELF, FREE], { provenance: 'inferred', confirmedAt: null })))).toBeNull();
    const approved = plate([SELF, FREE], { provenance: 'inferred', confirmedAt: '2026-10-10T09:00:00.000Z' });
    expect(presentableFloorPlate(listingOf(approved))).toBe(approved);
  });

  it('🔴 ΜΙΑ χαλασμένη μονάδα αρνείται ΟΛΟΚΛΗΡΟ τον όροφο — ποτέ μισός', () => {
    expect(presentableFloorPlate(listingOf(plate([SELF, { outline: [0.1, 0.2, 0.3], state: 'available' }])))).toBeNull();
    expect(presentableFloorPlate(listingOf(plate([SELF, { outline: OTHER, state: 'sold' }])))).toBeNull();
    expect(presentableFloorPlate(listingOf(plate([SELF, { outline: [0.5, 0.1, 1.2, 0.1, 0.9, 0.4], state: 'available' }])))).toBeNull();
  });

  it('🔴 καμία ή δύο «αυτό το ακίνητο» ⇒ null', () => {
    expect(presentableFloorPlate(listingOf(plate([FREE, HELD])))).toBeNull();
    expect(presentableFloorPlate(listingOf(plate([SELF, { ...FREE, state: 'self' }])))).toBeNull();
  });

  it('🔴 εικόνα χωρίς διεύθυνση ή χωρίς θετικές διαστάσεις ⇒ null (το viewBox δεν επινοείται)', () => {
    const withImage = (image: unknown) => plate([SELF, FREE], { value: { image, units: [SELF, FREE] } });
    expect(presentableFloorPlate(listingOf(withImage({ ...IMAGE, width: 0 })))).toBeNull();
    expect(presentableFloorPlate(listingOf(withImage({ ...IMAGE, height: Number.NaN })))).toBeNull();
    expect(presentableFloorPlate(listingOf(withImage({ ...IMAGE, url: '' })))).toBeNull();
    expect(presentableFloorPlate(listingOf(withImage(undefined)))).toBeNull();
    expect(presentableFloorPlate(listingOf(plate([], { value: null })))).toBeNull();
  });

  it('το όριο «μία ανά αγγελία» ισχύει και στην ανάγνωση: δεύτερη κάτοψη δεν σώζει άκυρη πρώτη', () => {
    expect(presentableFloorPlate(listingOf(plate([FREE]), plate([SELF, FREE])))).toBeNull();
  });
});

describe('ΟΨ-2 floorPlateShapes — κλάσματα σε φυσικά pixels', () => {
  const size = { width: 2000, height: 1000 };

  it('🔴 κάθε άξονας πολλαπλασιάζεται με τη ΔΙΚΗ του πλευρά (μη τετράγωνη εικόνα)', () => {
    const [shape] = floorPlateShapes([SELF], size);
    expect(shape.points).toBe('200,100 800,100 800,400 200,400');
  });

  it('ο αριθμός είναι η θέση στο έγγραφο, 1-based', () => {
    expect(floorPlateShapes([SELF, FREE, HELD], size).map((shape) => shape.number)).toEqual([1, 2, 3]);
  });

  it('🔴 μονάδα με άκυρο περίγραμμα παραλείπεται ΧΩΡΙΣ να μετακινηθεί ο αριθμός των επόμενων', () => {
    const broken = { outline: [0.1, 0.2], state: 'available' } as FloorPlateUnit;
    expect(floorPlateShapes([SELF, broken, HELD], size).map((shape) => shape.number)).toEqual([1, 3]);
  });

  it('🔴 σύνδεσμος ΜΟΝΟ για γείτονα με αγγελία — ποτέ για «αυτό το ακίνητο», ποτέ για κενή ταυτότητα', () => {
    const selfWithId: FloorPlateUnit = { ...SELF, listingId: 'prop_1' };
    const emptyId: FloorPlateUnit = { ...HELD, listingId: '' };
    expect(floorPlateShapes([selfWithId, FREE, emptyId], size).map((shape) => shape.listingId)).toEqual([null, 'prop_2', null]);
  });
});

describe('ΟΨ-3 η ετικέτα πέφτει μέσα στο σχήμα', () => {
  it('🔴 σχήμα Γ: ο αριθμός είναι ΜΕΣΑ στη μονάδα, με θετικό περιθώριο', () => {
    const size = { width: 1000, height: 1000 };
    const [shape] = floorPlateShapes([HELD], size);
    const ring = shape.points.split(' ').map((pair) => {
      const [x, y] = pair.split(',').map(Number);
      return { x, y };
    });
    expect(pointInPolygon(shape.label, ring)).toBe(true);
    expect(shape.clearance).toBeGreaterThan(0);
  });
});

describe('ΟΨ-4 σειρά ζωγραφικής και υπόμνημα', () => {
  const shapes = floorPlateShapes([SELF, FREE, HELD], { width: 2000, height: 1000 });

  it('🔴 «αυτό το ακίνητο» ζωγραφίζεται ΤΕΛΕΥΤΑΙΟ — οι αριθμοί δεν αλλάζουν', () => {
    expect(inPaintOrder(shapes).map((shape) => shape.number)).toEqual([2, 3, 1]);
    expect(shapes.map((shape) => shape.number)).toEqual([1, 2, 3]);
  });

  it('το υπόμνημα έχει μόνο όσες καταστάσεις υπάρχουν, με τη σειρά του λεξιλογίου', () => {
    expect(floorPlateLegendStates(shapes)).toEqual(['self', 'available', 'reserved']);
    expect(floorPlateLegendStates(floorPlateShapes([SELF], { width: 10, height: 10 }))).toEqual(['self']);
  });
});
