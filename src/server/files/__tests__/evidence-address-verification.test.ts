/**
 * ADR-950 §8.2 · §8.13 — επαλήθευση διεύθυνσης ως συνόλου. Ο χάρτης (Nominatim · αρχείο OSM · Overpass) είναι ψεύτικος·
 * ελέγχεται η **απόφαση**: πότε `confirmed`, πότε `corrected` (δύο αποδείξεις + μοναδικότητα), πότε τίποτα — και ότι
 * «δεν απάντησε κανείς» είναι `unavailable`, ποτέ `unverified`.
 */

import type { GeocodeVerdict } from '@/app/api/geocoding/geocoding-engine';
import type { GeocodingApiResponse, ResolvedAddressFields } from '@/lib/geocoding/geocoding-types';
import type { ArchiveStreetNames } from '@/lib/geo/osm/osm-archive';
import type { OverpassElement } from '@/lib/geo/osm/overpass-client';

type OverpassOutcome = { readonly ok: true; readonly elements: readonly OverpassElement[] } | { readonly ok: false; readonly reason: 'unavailable' };

const geocodeWithVerdict = jest.fn<Promise<GeocodeVerdict>, [Record<string, unknown>]>();
const findArchiveStreetNamesNear = jest.fn<Promise<ArchiveStreetNames>, [{ lat: number; lng: number }]>();
const runOverpassQueryStrict = jest.fn<Promise<OverpassOutcome>, [string]>();

jest.mock('@/app/api/geocoding/geocoding-engine', () => ({ geocodeWithVerdict: (q: Record<string, unknown>) => geocodeWithVerdict(q) }));
jest.mock('@/app/api/geocoding/nominatim-pacer', () => ({ inBackgroundGeocodingLane: <T,>(work: () => Promise<T>) => work() }));
jest.mock('@/lib/geo/osm/osm-archive', () => ({
  findArchiveStreetNamesNear: (point: { lat: number; lng: number }) => findArchiveStreetNamesNear(point),
}));
jest.mock('@/lib/geo/osm/overpass-client', () => ({
  overpassQuerySeconds: () => 25,
  runOverpassQueryStrict: (query: string) => runOverpassQueryStrict(query),
}));

import { verifyEvidenceAddress } from '@/server/files/evidence-address-verification';

const READING = { street: 'Σαμοφράκης', number: '16', postalCode: '56334', city: 'Κορδελιό' };

function hit(fields: ResolvedAddressFields): GeocodeVerdict {
  const result: Pick<GeocodingApiResponse, 'lat' | 'lng' | 'resolvedFields'> = { lat: 40.67, lng: 22.89, resolvedFields: fields };
  return { kind: 'hit', result: result as GeocodingApiResponse };
}

const POSTCODE_ONLY = hit({ postalCode: '56334', city: 'Κορδελιό', county: 'Περιφερειακή Ενότητα Θεσσαλονίκης' });
const SAMOTHRAKIS = hit({ street: 'Σαμοθράκης', postalCode: '56334', city: 'Κορδελιό', county: 'Περιφερειακή Ενότητα Θεσσαλονίκης' });
const archive = (...names: string[]): ArchiveStreetNames => ({ kind: 'ok', names });
const ARCHIVE_DOWN: ArchiveStreetNames = { kind: 'unavailable' };
const overpass = (...names: string[]): OverpassOutcome => ({ ok: true, elements: names.map((name, id) => ({ type: 'way', id, tags: { name } })) });
const OVERPASS_DOWN: OverpassOutcome = { ok: false, reason: 'unavailable' };

beforeEach(() => {
  geocodeWithVerdict.mockReset();
  findArchiveStreetNamesNear.mockReset();
  runOverpassQueryStrict.mockReset();
});

it('η οδός βρίσκεται όπως διαβάστηκε ⇒ `confirmed`, χωρίς αναζήτηση ονομάτων', async () => {
  geocodeWithVerdict.mockResolvedValueOnce(hit({ street: 'Σαμοφράκης', postalCode: '56334' }));
  await expect(verifyEvidenceAddress(READING)).resolves.toMatchObject({ verdict: 'confirmed' });
  expect(findArchiveStreetNamesNear).not.toHaveBeenCalled();
  expect(runOverpassQueryStrict).not.toHaveBeenCalled();
});

it('Σαμοφράκης ⇒ υπαρκτή Σαμοθράκης από το ΑΡΧΕΙΟ + επιβεβαίωση ⇒ `corrected`, χωρίς Overpass', async () => {
  geocodeWithVerdict.mockResolvedValueOnce(POSTCODE_ONLY).mockResolvedValueOnce(SAMOTHRAKIS);
  findArchiveStreetNamesNear.mockResolvedValueOnce(archive('Σαμοθράκης', 'Εγνατίας', 'Κορδελιού'));
  const verdict = await verifyEvidenceAddress(READING);
  expect(verdict).toMatchObject({ verdict: 'corrected', correctedStreet: 'Σαμοθράκης' });
  expect(verdict.places).toContain('Περιφερειακή Ενότητα Θεσσαλονίκης');
  expect(geocodeWithVerdict).toHaveBeenLastCalledWith(expect.objectContaining({ street: 'Σαμοθράκης', postalCode: '56334' }));
  expect(runOverpassQueryStrict).not.toHaveBeenCalled();
});

it('ΣΑΜΟΓΡΑΦΗΣ (γράμματα κρυμμένα από υπογραφή) ⇒ `corrected` σε Σαμοθράκης — ζωντανός έλεγχος 2026-11-24', async () => {
  geocodeWithVerdict.mockResolvedValueOnce(POSTCODE_ONLY).mockResolvedValueOnce(SAMOTHRAKIS);
  findArchiveStreetNamesNear.mockResolvedValueOnce(archive('Σαμοθράκης', 'Εγνατίας', 'Κορδελιού'));
  await expect(verifyEvidenceAddress({ ...READING, street: 'ΣΑΜΟΓΡΑΦΗΣ' }))
    .resolves.toMatchObject({ verdict: 'corrected', correctedStreet: 'Σαμοθράκης' });
});

it('το αρχείο δεν απαντά ⇒ ρωτά τον Overpass (εφεδρεία)', async () => {
  geocodeWithVerdict.mockResolvedValueOnce(POSTCODE_ONLY).mockResolvedValueOnce(SAMOTHRAKIS);
  findArchiveStreetNamesNear.mockResolvedValueOnce(ARCHIVE_DOWN);
  runOverpassQueryStrict.mockResolvedValueOnce(overpass('Σαμοθράκης'));
  await expect(verifyEvidenceAddress(READING)).resolves.toMatchObject({ verdict: 'corrected', correctedStreet: 'Σαμοθράκης' });
});

it('ΚΑΝΕΝΑ από τα δύο δεν απαντά ⇒ `unavailable`, ΠΟΤΕ «δεν υπάρχει» — ζωντανός έλεγχος 2026-11-24', async () => {
  geocodeWithVerdict.mockResolvedValueOnce(POSTCODE_ONLY);
  findArchiveStreetNamesNear.mockResolvedValueOnce(ARCHIVE_DOWN);
  runOverpassQueryStrict.mockResolvedValueOnce(OVERPASS_DOWN);
  await expect(verifyEvidenceAddress(READING)).resolves.toMatchObject({ verdict: 'unavailable' });
});

it('το αρχείο απάντησε χωρίς υποψήφια και ο Overpass πεσμένος ⇒ `unverified` (υπάρχει απάντηση)', async () => {
  geocodeWithVerdict.mockResolvedValueOnce(POSTCODE_ONLY);
  findArchiveStreetNamesNear.mockResolvedValueOnce(archive('Εγνατίας', 'Κορδελιού'));
  runOverpassQueryStrict.mockResolvedValueOnce(OVERPASS_DOWN);
  await expect(verifyEvidenceAddress(READING)).resolves.toMatchObject({ verdict: 'unverified' });
});

it('ισοπαλία δύο διαφορετικών υπαρκτών οδών ⇒ καμία επιλογή ⇒ `unverified`', async () => {
  geocodeWithVerdict.mockResolvedValueOnce(POSTCODE_ONLY);
  findArchiveStreetNamesNear.mockResolvedValueOnce(archive('Σαμοθράκης', 'Σαμοθράκια'));
  runOverpassQueryStrict.mockResolvedValueOnce(overpass('Σαμοθράκης', 'Σαμοθράκια'));
  await expect(verifyEvidenceAddress({ ...READING, street: 'Σαμοθράκ' })).resolves.toMatchObject({ verdict: 'unverified' });
});

it('η υποψήφια δεν επιβεβαιώνεται από τον γεωκωδικοποιητή ⇒ `unverified`', async () => {
  geocodeWithVerdict.mockResolvedValueOnce(POSTCODE_ONLY).mockResolvedValueOnce({ kind: 'absent' });
  findArchiveStreetNamesNear.mockResolvedValueOnce(archive('Σαμοθράκης'));
  await expect(verifyEvidenceAddress(READING)).resolves.toMatchObject({ verdict: 'unverified' });
});

it('ο γεωκωδικοποιητής δεν απαντά ⇒ `unavailable` (καμία κρίση)', async () => {
  geocodeWithVerdict.mockResolvedValueOnce({ kind: 'unavailable' });
  await expect(verifyEvidenceAddress(READING)).resolves.toMatchObject({ verdict: 'unavailable' });
});

it('εξαίρεση ⇒ `unavailable`, ποτέ ρίψη (η ανάγνωση δεν χάνεται)', async () => {
  geocodeWithVerdict.mockRejectedValueOnce(new Error('boom'));
  await expect(verifyEvidenceAddress(READING)).resolves.toMatchObject({ verdict: 'unavailable' });
});
