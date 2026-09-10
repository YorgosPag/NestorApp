/**
 * @fileoverview **ΕΝΑ ΕΡΩΤΗΜΑ, ΤΡΕΙΣ ΒΑΘΜΙΔΕΣ** — ADR-332 D27 Β13.
 * @related lib/geocoding/overpass-housenumber.ts · lib/geo/osm/overpass-client.ts
 *
 * 🔴 Ως τις 2026-09-10 οι τρεις βαθμίδες ήταν **τρία διαδοχικά αιτήματα** — ο διάλογος συρσίματος
 * μετρήθηκε στα 24–38″. Εδώ φυλάγεται ότι γίνεται **ένα** αίτημα **και** ότι η σειρά των βαθμίδων
 * (ίδια οδός → κοντά → πλησιέστερος) έμεινε ίδια. Mock μόνο στο σύνορο του μεταφορέα.
 */

jest.mock('@/lib/geo/osm/overpass-client', () => ({
  ...jest.requireActual('@/lib/geo/osm/overpass-client'),
  runOverpassQuery: jest.fn(),
}));

import { runOverpassQuery, type OverpassElement } from '@/lib/geo/osm/overpass-client';
import { createDeadline } from '@/lib/async-utils';
import { findNearestHouseNumber } from '../overpass-housenumber';

/** Η πόρτα της Σαμοθράκης 16 — το σημείο αφής. */
const DROP = { lat: 40.6642462, lng: 22.8975146 };
const METRES_PER_DEGREE_LAT = 111_320;

/** Στοιχείο OSM με αριθμό, `metres` βόρεια του σημείου αφής. */
function numbered(id: number, metres: number, housenumber: string, street?: string): OverpassElement {
  return {
    type: 'node',
    id,
    lat: DROP.lat + metres / METRES_PER_DEGREE_LAT,
    lon: DROP.lng,
    tags: { 'addr:housenumber': housenumber, ...(street ? { 'addr:street': street } : {}) },
  };
}

function answer(...elements: OverpassElement[]): void {
  jest.mocked(runOverpassQuery).mockResolvedValue(elements);
}

beforeEach(() => {
  jest.mocked(runOverpassQuery).mockReset();
});

describe('Β13 — ΕΝΑ αίτημα αντί για τρία', () => {
  it('🔴 μία κλήση, ακτίνα 120 μ., ΧΩΡΙΣ φίλτρο οδού (το φίλτρο γίνεται στη μνήμη)', async () => {
    answer();

    await findNearestHouseNumber(DROP.lat, DROP.lng, 'Σαμοθράκης');

    expect(runOverpassQuery).toHaveBeenCalledTimes(1);
    const query = jest.mocked(runOverpassQuery).mock.calls[0]![0];
    expect(query).toContain('around:120');
    expect(query).not.toContain('addr:street');
  });

  it('η προθεσμία φτάνει στον μεταφορέα — και το `[timeout:N]` του Overpass είναι το ΥΠΟΛΟΙΠΟ της', async () => {
    answer();
    const deadline = createDeadline(2_500);

    await findNearestHouseNumber(DROP.lat, DROP.lng, 'Σαμοθράκης', { deadline });
    deadline.dispose();

    const [query, options] = jest.mocked(runOverpassQuery).mock.calls[0]!;
    expect(options).toEqual({ deadline });
    expect(query).toMatch(/\[timeout:[12]\]/);
  });
});

describe('Οι τρεις βαθμίδες — ΙΔΙΑ σειρά με τα τρία παλιά αιτήματα', () => {
  it('1 — ίδια οδός μέσα στα 60 μ. ΝΙΚΑ ακόμα κι αν άλλος αριθμός είναι πλησιέστερος', async () => {
    answer(numbered(1, 20, '9'), numbered(2, 50, '16', 'Σαμοθράκης'));
    expect(await findNearestHouseNumber(DROP.lat, DROP.lng, 'Σαμοθράκης')).toBe('16');
  });

  it('2 — καμία ίδια οδός στα 60 μ. ⇒ ο πλησιέστερος μέσα στα 60 μ. (τα κτίρια του OSM συχνά δεν έχουν οδό)', async () => {
    answer(numbered(1, 40, '9'), numbered(2, 90, '16', 'Σαμοθράκης'));
    expect(await findNearestHouseNumber(DROP.lat, DROP.lng, 'Σαμοθράκης')).toBe('9');
  });

  it('3 — τίποτα στα 60 μ. ⇒ ο πλησιέστερος απ\' όλους', async () => {
    answer(numbered(1, 110, '22'), numbered(2, 80, '18'));
    expect(await findNearestHouseNumber(DROP.lat, DROP.lng, 'Σαμοθράκης')).toBe('18');
  });

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ: χωρίς οδό ⇒ δεν υπάρχει βαθμίδα 1 — ο πλησιέστερος στα 60 μ.', async () => {
    answer(numbered(1, 50, '16', 'Σαμοθράκης'), numbered(2, 30, '9'));
    expect(await findNearestHouseNumber(DROP.lat, DROP.lng, undefined)).toBe('9');
  });

  it('ΠΑΡΟΝΟΜΑΣΤΗΣ: κανένα στοιχείο (ή ο πάροχος δεν απάντησε) ⇒ `null` — ο άνθρωπος κρατά τον αριθμό του', async () => {
    answer();
    expect(await findNearestHouseNumber(DROP.lat, DROP.lng, 'Σαμοθράκης')).toBeNull();
  });
});
