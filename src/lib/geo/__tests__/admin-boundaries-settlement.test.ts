/**
 * @fileoverview ADR-883 §5.10 — το όριο ενός **οικισμού** = το όριο του γονέα του, με την ταυτότητα
 * του οικισμού (αλλιώς ο κριτής το απορρίπτει ως «άλλης περιοχής») και την πινέζα του.
 */

import { adminBoundarySource } from '../admin-boundaries';
import { ADMIN_AREA_INDEX_FILE } from '../admin-area-index-file';
import { adminBoundaryPath } from '../admin-boundary-file';

const COMMUNITY = 'community:07090602';
const DORKADA = 'settlement:0709060202';
const ASSIROS = 'settlement:0709060203';

const FILES: Record<string, unknown> = {
  [`/${ADMIN_AREA_INDEX_FILE}`]: {
    data: [
      [COMMUNITY, 'Τοπική Κοινότητα Καρτερών', 7, null],
      [DORKADA, 'Δορκάδα', 8, COMMUNITY],
      [ASSIROS, 'Άσσηρος', 8, COMMUNITY],
    ],
  },
  [adminBoundaryPath(COMMUNITY)]: {
    id: COMMUNITY,
    level: 7,
    bbox: [23.0, 40.8, 23.2, 41.0],
    toleranceM: 10,
    geometry: { type: 'MultiPolygon', coordinates: [[[[23.0, 40.8], [23.2, 40.8], [23.2, 41.0], [23.0, 41.0], [23.0, 40.8]]]] },
    places: { [DORKADA]: [23.1032, 40.8866] },
  },
};

const fetchMock = jest.fn(async (url: string) => ({ json: async () => FILES[url] ?? '<!doctype html>' }));

beforeAll(() => {
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('adminBoundarySource — οικισμός', () => {
  it('🔑 όριο της κοινότητας, με ταυτότητα ΤΟΥ ΟΙΚΙΣΜΟΥ και πινέζα στη θέση του', async () => {
    const source = adminBoundarySource(DORKADA);
    await source.load();
    const boundary = source.peek();
    expect(boundary?.region.adminId).toBe(DORKADA);
    expect(boundary?.region.bbox).toEqual({ west: 23.0, south: 40.8, east: 23.2, north: 41.0 });
    expect(boundary?.place).toEqual({ adminId: DORKADA, point: { lng: 23.1032, lat: 40.8866 } });
  });

  it('το αρχείο του ορίου κατεβαίνει ΜΙΑ φορά — ο οικισμός και η κοινότητα μοιράζονται το ίδιο', async () => {
    // Η Δορκάδα φόρτωσε ήδη το όριο στο προηγούμενο test: η κοινότητα δεν ξαναρωτά το δίκτυο.
    await adminBoundarySource(COMMUNITY).load();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(adminBoundarySource(COMMUNITY).peek()?.geometry).toBe(adminBoundarySource(DORKADA).peek()?.geometry);
  });

  it('οικισμός χωρίς επαληθευμένη θέση ⇒ το όριο χωρίς πινέζα (ποτέ εικασία)', async () => {
    const source = adminBoundarySource(ASSIROS);
    await source.load();
    expect(source.peek()?.place).toBeNull();
    expect(source.peek()?.region.adminId).toBe(ASSIROS);
  });

  it('η κοινότητα ΔΕΝ φορά πινέζα — ζητήθηκε η περιοχή, όχι χωριό της', async () => {
    const source = adminBoundarySource(COMMUNITY);
    await source.load();
    expect(source.peek()?.place).toBeNull();
    expect(source.peek()?.places.size).toBe(1);
  });

  it('άγνωστος οικισμός ⇒ «δεν ξέρω» (`null`), ποτέ κενό όριο', async () => {
    const source = adminBoundarySource('settlement:9999999999');
    await source.load();
    expect(source.peek()).toBeNull();
  });
});
