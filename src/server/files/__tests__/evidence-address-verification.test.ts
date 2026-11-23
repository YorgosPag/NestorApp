/**
 * ADR-950 §8.2 — επαλήθευση διεύθυνσης ως συνόλου. Ο χάρτης (Nominatim · Overpass) είναι ψεύτικος· ελέγχεται η
 * **απόφαση**: πότε `confirmed`, πότε `corrected` (δύο αποδείξεις + μοναδικότητα), πότε τίποτα.
 */

import type { GeocodeVerdict } from '@/app/api/geocoding/geocoding-engine';
import type { GeocodingApiResponse, ResolvedAddressFields } from '@/lib/geocoding/geocoding-types';
import type { OverpassElement } from '@/lib/geo/osm/overpass-client';

const geocodeWithVerdict = jest.fn<Promise<GeocodeVerdict>, [Record<string, unknown>]>();
const runOverpassQuery = jest.fn<Promise<readonly OverpassElement[]>, [string]>();

jest.mock('@/app/api/geocoding/geocoding-engine', () => ({ geocodeWithVerdict: (q: Record<string, unknown>) => geocodeWithVerdict(q) }));
jest.mock('@/app/api/geocoding/nominatim-pacer', () => ({ inBackgroundGeocodingLane: <T,>(work: () => Promise<T>) => work() }));
jest.mock('@/lib/geo/osm/overpass-client', () => ({
  overpassQuerySeconds: () => 25,
  runOverpassQuery: (query: string) => runOverpassQuery(query),
}));

import { verifyEvidenceAddress } from '@/server/files/evidence-address-verification';

const READING = { street: 'Σαμοφράκης', number: '16', postalCode: '56334', city: 'Κορδελιό' };

function hit(fields: ResolvedAddressFields): GeocodeVerdict {
  const result: Pick<GeocodingApiResponse, 'lat' | 'lng' | 'resolvedFields'> = { lat: 40.67, lng: 22.89, resolvedFields: fields };
  return { kind: 'hit', result: result as GeocodingApiResponse };
}

const POSTCODE_ONLY = hit({ postalCode: '56334', city: 'Κορδελιό', county: 'Περιφερειακή Ενότητα Θεσσαλονίκης' });
const SAMOTHRAKIS = hit({ street: 'Σαμοθράκης', postalCode: '56334', city: 'Κορδελιό', county: 'Περιφερειακή Ενότητα Θεσσαλονίκης' });
const street = (name: string): OverpassElement => ({ type: 'way', id: name.length, tags: { name } });

beforeEach(() => {
  geocodeWithVerdict.mockReset();
  runOverpassQuery.mockReset();
});

it('η οδός βρίσκεται όπως διαβάστηκε ⇒ `confirmed`, χωρίς Overpass', async () => {
  geocodeWithVerdict.mockResolvedValueOnce(hit({ street: 'Σαμοφράκης', postalCode: '56334' }));
  await expect(verifyEvidenceAddress(READING)).resolves.toMatchObject({ verdict: 'confirmed' });
  expect(runOverpassQuery).not.toHaveBeenCalled();
});

it('Σαμοφράκης ⇒ μοναδική υπαρκτή Σαμοθράκης + επιβεβαίωση ⇒ `corrected`, με τους τόπους', async () => {
  geocodeWithVerdict.mockResolvedValueOnce(POSTCODE_ONLY).mockResolvedValueOnce(SAMOTHRAKIS);
  runOverpassQuery.mockResolvedValueOnce([street('Σαμοθράκης'), street('Εγνατίας'), street('Κορδελιού')]);
  const verdict = await verifyEvidenceAddress(READING);
  expect(verdict).toMatchObject({ verdict: 'corrected', correctedStreet: 'Σαμοθράκης' });
  expect(verdict.places).toContain('Περιφερειακή Ενότητα Θεσσαλονίκης');
  expect(geocodeWithVerdict).toHaveBeenLastCalledWith(expect.objectContaining({ street: 'Σαμοθράκης', postalCode: '56334' }));
});

it('δύο υποψήφιες που μοιάζουν ⇒ καμία επιλογή ⇒ `unverified`', async () => {
  geocodeWithVerdict.mockResolvedValueOnce(POSTCODE_ONLY);
  runOverpassQuery.mockResolvedValueOnce([street('Σαμοθράκης'), street('Σαμοθρακης')]);
  // Ίδιο όνομα με άλλη γραφή ⇒ το `Set` κρατά δύο διαφορετικές συμβολοσειρές ⇒ δύο υποψήφιες.
  await expect(verifyEvidenceAddress(READING)).resolves.toMatchObject({ verdict: 'unverified' });
});

it('η υποψήφια δεν επιβεβαιώνεται από τον γεωκωδικοποιητή ⇒ `unverified`', async () => {
  geocodeWithVerdict.mockResolvedValueOnce(POSTCODE_ONLY).mockResolvedValueOnce({ kind: 'absent' });
  runOverpassQuery.mockResolvedValueOnce([street('Σαμοθράκης')]);
  await expect(verifyEvidenceAddress(READING)).resolves.toMatchObject({ verdict: 'unverified' });
});

it('ο χάρτης δεν απαντά ⇒ `unavailable` (καμία κρίση)', async () => {
  geocodeWithVerdict.mockResolvedValueOnce({ kind: 'unavailable' });
  await expect(verifyEvidenceAddress(READING)).resolves.toMatchObject({ verdict: 'unavailable' });
});

it('εξαίρεση ⇒ `unavailable`, ποτέ ρίψη (η ανάγνωση δεν χάνεται)', async () => {
  geocodeWithVerdict.mockRejectedValueOnce(new Error('boom'));
  await expect(verifyEvidenceAddress(READING)).resolves.toMatchObject({ verdict: 'unavailable' });
});
