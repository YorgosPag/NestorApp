/**
 * ADR-889 Φ5 — ο κριτής «σε ποια ζώνη αντικειμενικής αξίας πέφτει η θέση;».
 *
 * Κανόνας ΠΟΛ.1149/1994: η κυκλική ζώνη είναι η απάντηση· τα μέτωπα μόνο υπό όρο πρόσοψης, και μόνο όσα θα άλλαζαν
 * το αποτέλεσμα (ακριβότερα). Ποτέ ψευδής ακρίβεια.
 */

import type { GeoOutline, GeoPoint, GeoPolyline } from '@/types/geo/coordinates';
import type { PlacePosition } from '@/types/geo/public-place';

import { valueZoneAtPoint, valueZonePointOf } from '../value-zone-at-point';
import type { ValueFront, ValueZone, ValueZoneArea } from '../value-zone-file';

/** ~111 m ανά 0,001° πλάτους — αρκετά κοντά για τα μέτρα αυτών των tests. */
const ORIGIN = { lat: 37.98, lng: 23.73 };
const DEG_PER_M = 1 / 111_320;

function offset(metresNorth: number, metresEast: number): GeoPoint {
  return { lat: ORIGIN.lat + metresNorth * DEG_PER_M, lng: ORIGIN.lng + (metresEast * DEG_PER_M) / Math.cos((ORIGIN.lat * Math.PI) / 180) };
}

function square(south: number, west: number, size: number): GeoOutline {
  return [offset(south, west), offset(south, west + size), offset(south + size, west + size), offset(south + size, west)];
}

function zone(id: number, price: number, ring: GeoOutline): ValueZone {
  const lats = ring.map((p) => p.lat);
  const lngs = ring.map((p) => p.lng);
  return {
    id, name: `Z${id}`, price, validFrom: '2022-01-01',
    bbox: { south: Math.min(...lats), north: Math.max(...lats), west: Math.min(...lngs), east: Math.max(...lngs) },
    geometry: { type: 'MultiPolygon', coordinates: [[[...ring, ring[0]].map((p) => [p.lng, p.lat])]] },
    rings: [ring],
  };
}

function front(id: number, price: number, street: string, line: GeoPolyline): ValueFront {
  const lats = line.map((p) => p.lat);
  const lngs = line.map((p) => p.lng);
  return {
    id, name: `F${id}`, price, validFrom: '2025-01-01', street,
    bbox: { south: Math.min(...lats), north: Math.max(...lats), west: Math.min(...lngs), east: Math.max(...lngs) },
    geometry: { type: 'MultiLineString', coordinates: [line.map((p) => [p.lng, p.lat])] },
    lines: [line],
  };
}

/** Δύο γειτονικά τετράγωνα 100 m (Α φθηνό, Β ακριβό) και δύο μέτωπα κατά μήκος του νότιου ορίου του Α. */
const AREA: ValueZoneArea = {
  id: 'municipal_unit:x',
  bbox: { south: 0, north: 90, west: 0, east: 90 },
  toleranceM: 2,
  zones: [zone(1, 2000, square(0, 0, 100)), zone(2, 3000, square(0, 100, 100))],
  fronts: [
    front(10, 5000, 'ΛΕΩΦΟΡΟΣ', [offset(0, 0), offset(0, 100)]),
    front(11, 1500, 'ΣΤΕΝΟ', [offset(0, 0), offset(0, 100)]),
  ],
};

const HERE = offset(20, 50);

describe('valueZonePointOf — ποτέ ψευδής ακρίβεια', () => {
  const at = (extra: Partial<PlacePosition>): PlacePosition =>
    ({ kind: 'known', provenance: 'geocoded', accuracy: 'exact', point: HERE, locatedAt: '2026-09-28', ...extra }) as PlacePosition;

  it('διεύθυνση (exact) ή πινέζα ανθρώπου ⇒ σημείο', () => {
    expect(valueZonePointOf(at({}))).toEqual(HERE);
    expect(valueZonePointOf({ kind: 'known', provenance: 'manual', point: HERE, locatedAt: '2026-09-28' } as PlacePosition)).toEqual(HERE);
  });

  it('approximate / center / άγνωστη ⇒ null (άλλο τετράγωνο = άλλη ζώνη)', () => {
    expect(valueZonePointOf(at({ accuracy: 'approximate' } as Partial<PlacePosition>))).toBeNull();
    expect(valueZonePointOf(at({ accuracy: 'center' } as Partial<PlacePosition>))).toBeNull();
    expect(valueZonePointOf({ kind: 'unknown' })).toBeNull();
  });
});

describe('valueZoneAtPoint', () => {
  it('η κυκλική ζώνη που περιέχει το σημείο', () => {
    const verdict = valueZoneAtPoint(HERE, [AREA]);
    expect(verdict.kind === 'ready' && verdict.zone).toEqual({ id: 1, name: 'Z1', price: 2000, validFrom: '2022-01-01' });
  });

  it('μέτωπα: μόνο τα ΑΚΡΙΒΟΤΕΡΑ, εντός εμβέλειας, υπό όρο', () => {
    const verdict = valueZoneAtPoint(HERE, [AREA]);
    if (verdict.kind !== 'ready') throw new Error(verdict.kind);
    expect(verdict.fronts.map((item) => [item.street, item.price])).toEqual([['ΛΕΩΦΟΡΟΣ', 5000]]);
    expect(verdict.fronts[0].distanceM).toBe(20);
    const farAway = valueZoneAtPoint(offset(80, 50), [AREA]);
    expect(farAway.kind === 'ready' && farAway.fronts).toEqual([]);
  });

  it('δίπλα στο όριο των δύο ζωνών ⇒ nearEdge', () => {
    const verdict = valueZoneAtPoint(offset(50, 99), [AREA]);
    expect(verdict.kind === 'ready' && verdict.nearEdge).toBe(true);
    expect(valueZoneAtPoint(offset(50, 50), [AREA]).kind === 'ready' && valueZoneAtPoint(offset(50, 50), [AREA])).toEqual(
      expect.objectContaining({ nearEdge: false }),
    );
  });

  it('εκτός κάθε ζώνης ⇒ outside (γεγονός)· αρχεία που δεν διαβάστηκαν ⇒ unavailable (ποτέ «εκτός»)', () => {
    expect(valueZoneAtPoint(offset(500, 500), [AREA])).toEqual({ kind: 'outside' });
    expect(valueZoneAtPoint(HERE, null)).toEqual({ kind: 'unavailable' });
  });

  it('λίγο έξω από τη ζώνη αλλά εντός ανοχής ⇒ η πλησιέστερη', () => {
    const verdict = valueZoneAtPoint(offset(-1, 50), [AREA]);
    expect(verdict.kind === 'ready' && verdict.zone.id).toBe(1);
  });
});
