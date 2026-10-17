/**
 * ADR-915 §24 — ο δήμος του ακινήτου για το «Βρες επαγγελματία»: η σειρά των πηγών, «μόνο όσα θα δειχτούν», και
 * «δεν αποδεικνύεται» ⇒ `null`, ποτέ πτώση του μητρώου.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { readRegistryPropertyAreas } from '../registry-property-area.server';
import type { RegistryProperty } from '../registry-properties.server';
import type { PublicListing } from '@/types/public-listing';

const showcaseLocationArea = jest.fn();
jest.mock('@/services/places/showcase-location-area', () => ({
  showcaseLocationArea: (...args: unknown[]) => showcaseLocationArea(...args),
}));

const collectPlaceKnowledge = jest.fn();
jest.mock('@/services/listings/publish-public-listing', () => ({
  collectPlaceKnowledge: (...args: unknown[]) => collectPlaceKnowledge(...args),
}));

const DB = {} as AdminFirestore;
const NOW = new Date('2026-10-16T10:00:00Z');
const POINT = { lat: 40.63, lng: 22.94 };

function property(id: string, scope: RegistryProperty['scope'], extra: Partial<RegistryProperty> = {}): RegistryProperty {
  return {
    id, scope, name: null, declaredPoint: null, mandateClientContactIds: [], data: {},
    certificate: { kind: 'none' } as unknown as RegistryProperty['certificate'], ...extra,
  };
}

function listing(id: string, municipalityId: string | null): PublicListing {
  return { id, adminArea: municipalityId === null ? null : { municipalityId } } as unknown as PublicListing;
}

const KNOWN = { kind: 'known', provenance: 'manual', point: POINT, locatedAt: NOW.toISOString() };

beforeEach(() => {
  showcaseLocationArea.mockReset().mockResolvedValue({ area: { adminId: 'municipality:0701' } });
  collectPlaceKnowledge.mockReset().mockResolvedValue({ candidates: [KNOWN], ref: null });
});

describe('ADR-915 §24 — περιοχή ακινήτου', () => {
  it('αγγελία με δήμο ⇒ από την αγγελία, ΧΩΡΙΣ κριτή και χωρίς ανάγνωση', async () => {
    const areas = await readRegistryPropertyAreas(DB, {
      wanted: new Set(['p1']), subjects: new Map([['p1', property('p1', 'property')]]),
      listings: [listing('p1', 'municipality:0501')], now: NOW,
    });
    expect(areas.get('p1')).toBe('municipality:0501');
    expect(showcaseLocationArea).not.toHaveBeenCalled();
    expect(collectPlaceKnowledge).not.toHaveBeenCalled();
  });

  it('ιδιώτης ⇒ το δηλωμένο σημείο στον κριτή · εταιρεία ⇒ κτίριο → έργο → κριτής', async () => {
    const owner = property('ownp_1', 'owner-property', { declaredPoint: POINT });
    const company = property('p2', 'property', { data: { buildingId: 'b1', projectId: 'pr1' } });
    const areas = await readRegistryPropertyAreas(DB, {
      wanted: new Set(['ownp_1', 'p2']), subjects: new Map([['ownp_1', owner], ['p2', company]]), listings: [], now: NOW,
    });
    expect(areas.get('ownp_1')).toBe('municipality:0701');
    expect(areas.get('p2')).toBe('municipality:0701');
    expect(collectPlaceKnowledge).toHaveBeenCalledTimes(1);
    expect(collectPlaceKnowledge).toHaveBeenCalledWith(DB, { buildingId: 'b1', projectId: 'pr1' }, NOW.toISOString());
    expect(showcaseLocationArea.mock.calls).toEqual([[POINT], [POINT]]);
  });

  it('μόνο όσα θα δειχτούν — και κανένα που δεν είναι «του γραφείου»', async () => {
    const areas = await readRegistryPropertyAreas(DB, {
      wanted: new Set(['p1', 'foreign']), subjects: new Map([['p1', property('p1', 'property')], ['p9', property('p9', 'property')]]),
      listings: [], now: NOW,
    });
    expect([...areas.keys()]).toEqual(['p1']);
    expect(collectPlaceKnowledge).toHaveBeenCalledTimes(1);
  });

  it('ευρετήριο μη διαθέσιμο · καμία θέση · σφάλμα ⇒ `null`, ποτέ πτώση', async () => {
    showcaseLocationArea.mockResolvedValueOnce('unavailable');
    collectPlaceKnowledge.mockResolvedValueOnce({ candidates: [], ref: null }).mockRejectedValueOnce(new Error('boom'));
    showcaseLocationArea.mockImplementation(async (point: unknown) => (point === null ? { area: null } : 'unavailable'));
    const areas = await readRegistryPropertyAreas(DB, {
      wanted: new Set(['ownp_1', 'p2', 'p3']),
      subjects: new Map([
        ['ownp_1', property('ownp_1', 'owner-property', { declaredPoint: POINT })],
        ['p2', property('p2', 'property')],
        ['p3', property('p3', 'property')],
      ]),
      listings: [],
      now: NOW,
    });
    expect(Object.fromEntries(areas)).toEqual({ ownp_1: null, p2: null, p3: null });
  });
});
