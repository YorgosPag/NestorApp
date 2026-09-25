/**
 * ADR-888 — η σχεδιασμένη περιοχή της ζήτησης με ΠΟΛΛΑ σχήματα.
 *
 * Άγκυρες: (1) ΕΝΩΣΗ, ποτέ even-odd · (2) ο ΙΔΙΟΣ κριτής με τον χάρτη · (3) όρια = όρια του URL ·
 * (4) παλιά έγγραφα `outline` διαβάζονται.
 */

import { demandAreaInvariants, demandPlaceForStorage, isPointInDemandArea, withAreaShapes } from '../demand-area';
import { readStoredDemand } from '../property-demand-from-document';
import { areaRelation } from '@/lib/geo/geo-area';
import { MAX_DRAWN_SHAPES, drawnAreaFromShapes } from '@/lib/listings/listing-drawn-area';
import { demandInvariantViolations } from '@/types/property-demand';
import type { GeoOutline } from '@/types/geo/coordinates';
import { demand } from './demand-fixtures';

/** Τετράγωνο γύρω από (lat, lng) με πλευρά `d` μοίρες. */
function square(lat: number, lng: number, d = 0.02): GeoOutline {
  return [
    { lat, lng },
    { lat, lng: lng + d },
    { lat: lat + d, lng: lng + d },
    { lat: lat + d, lng },
  ];
}

const A = square(40.63, 22.93);
const B = square(40.64, 22.94); // επικαλύπτει το A
const FAR = square(40.8, 23.2);

describe('isPointInDemandArea — ένωση σχημάτων', () => {
  it('σημείο μέσα σε ΔΥΟ επικαλυπτόμενα σχήματα είναι ΜΕΣΑ (όχι even-odd)', () => {
    expect(isPointInDemandArea({ lat: 40.645, lng: 22.945 }, [A, B])).toBe(true);
  });

  it('σημείο μόνο στο δεύτερο σχήμα είναι μέσα', () => {
    expect(isPointInDemandArea({ lat: 40.81, lng: 23.21 }, [A, FAR])).toBe(true);
  });

  it('σημείο ανάμεσα στα σχήματα είναι έξω', () => {
    expect(isPointInDemandArea({ lat: 40.7, lng: 23.1 }, [A, FAR])).toBe(false);
  });

  it('συμφωνεί με τον κριτή του χάρτη (`areaRelation` πάνω στο `GeoDrawnArea`)', () => {
    const drawn = drawnAreaFromShapes([A, FAR]);
    if (drawn === null) throw new Error('έγκυρα σχήματα');
    for (const point of [
      { lat: 40.64, lng: 22.94 },
      { lat: 40.81, lng: 23.21 },
      { lat: 40.7, lng: 23.1 },
    ]) {
      const map = areaRelation({ center: point, radiusKm: 0 }, drawn) !== 'disjoint';
      expect(isPointInDemandArea(point, [A, FAR])).toBe(map);
    }
  });
});

describe('demandAreaInvariants — τα όρια του χάρτη', () => {
  it('κενό → area-empty', () => {
    expect(demandAreaInvariants([])).toEqual(['area-empty']);
  });

  it('σχήμα με 2 κορυφές → outline-degenerate', () => {
    expect(demandAreaInvariants([A, A.slice(0, 2)])).toEqual(['outline-degenerate']);
  });

  it('περισσότερα από MAX_DRAWN_SHAPES → area-too-many', () => {
    const many = Array.from({ length: MAX_DRAWN_SHAPES + 1 }, (_, i) => square(40 + i * 0.05, 22));
    expect(demandAreaInvariants(many)).toContain('area-too-many');
  });

  it('πάρα πολλές κορυφές για το URL → area-too-large', () => {
    const ring: GeoOutline = Array.from({ length: 600 }, (_, i) => ({
      lat: 40.6 + 0.05 * Math.sin((i / 600) * 2 * Math.PI) + (i % 7) * 1e-4,
      lng: 22.9 + 0.05 * Math.cos((i / 600) * 2 * Math.PI) + (i % 5) * 1e-4,
    }));
    expect(demandAreaInvariants([ring])).toContain('area-too-large');
  });

  it('έγκυρα σχήματα → κανένα', () => {
    expect(demandAreaInvariants([A, FAR])).toEqual([]);
    expect(demandInvariantViolations(demand({ place: { kind: 'area', shapes: [A, FAR] } }))).toEqual([]);
  });
});

/** Υπάρχει πίνακας ΑΜΕΣΑ μέσα σε πίνακα, οπουδήποτε στο δέντρο; (ο κανόνας του Firestore) */
function hasNestedArray(value: unknown, insideArray = false): boolean {
  if (Array.isArray(value)) return insideArray || value.some((item) => hasNestedArray(item, true));
  if (typeof value === 'object' && value !== null) return Object.values(value).some((v) => hasNestedArray(v, false));
  return false;
}

describe('🔴 σύνορο αποθήκευσης — το Firestore ΔΕΝ δέχεται πίνακα-σε-πίνακα (βρέθηκε ζωντανά)', () => {
  it('η μορφή εγγράφου δεν έχει πίνακα μέσα σε πίνακα', () => {
    const place = { kind: 'area', shapes: [A, FAR] } as const;
    expect(hasNestedArray(place)).toBe(true); // η μνήμη ΘΑ απορριπτόταν
    expect(hasNestedArray(demandPlaceForStorage(place))).toBe(false);
  });

  it('round-trip: μνήμη → έγγραφο → μνήμη = ίδιο', () => {
    const place = { kind: 'area', shapes: [A, FAR] } as const;
    expect(withAreaShapes(demandPlaceForStorage(place))).toEqual(place);
  });

  it('άλλες μορφές τόπου δεν αγγίζονται', () => {
    const near = { kind: 'near', center: { lat: 1, lng: 2 }, radiusKm: 1 } as const;
    expect(demandPlaceForStorage(near)).toBe(near);
  });
});

describe('ανάγνωση-με-ανοχή — παλιά έγγραφα `outline`', () => {
  it('`{kind:area, outline}` → `{kind:area, shapes:[outline]}`', () => {
    expect(withAreaShapes({ kind: 'area', outline: A })).toEqual({ kind: 'area', shapes: [A] });
  });

  it('σχήματα ήδη στη μνήμη μένουν ίδια· άλλες μορφές περνούν αυτούσιες', () => {
    expect(withAreaShapes({ kind: 'area', shapes: [A] })).toEqual({ kind: 'area', shapes: [A] });
    const near = { kind: 'near', center: { lat: 1, lng: 2 }, radiusKm: 1 };
    expect(withAreaShapes(near)).toBe(near);
  });

  it('το σύνορο ανάγνωσης δίνει πάντα `shapes`', () => {
    const { id: _id, ...stored } = demand();
    const legacy = readStoredDemand({ ...stored, place: { kind: 'area', outline: A } }, 'dmnd_1');
    const current = readStoredDemand({ ...stored, place: { kind: 'area', shapes: [{ ring: A }] } }, 'dmnd_2');
    for (const read of [legacy, current]) {
      expect(read?.kind).toBe('complete');
      if (read?.kind !== 'complete') return;
      expect(read.demand.place).toEqual({ kind: 'area', shapes: [A] });
    }
  });
});
