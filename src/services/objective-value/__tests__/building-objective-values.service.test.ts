/**
 * ADR-898 Φ4 — ο πίνακας του εργολάβου στον server: η ΙΔΙΑ προβολή με την αγγελία (πραγματική), μία ζώνη και μία
 * γνώση τόπου ανά κτίριο (όχι ανά μονάδα), η απόκρυψη δεν κρύβει από τον κατασκευαστή, σύνολο μόνο όταν είναι αληθινό.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import type { ValueZoneVerdict } from '@/lib/market/value-zone-at-point';
import type { ConstructionPhase } from '@/types/building/construction';

jest.mock('server-only', () => ({}));

let phases: Pick<ConstructionPhase, 'legalStage' | 'status'>[] = [];
jest.mock('@/lib/api/construction-doc-mappers', () => ({ fetchConstructionPhases: async () => phases }));

const collectPlaceKnowledge = jest.fn(async () => ({ candidates: [], ref: null, buildingConstructionYear: null }));
jest.mock('@/services/listings/publish-public-listing', () => ({
  collectPlaceKnowledge: (...args: unknown[]) => collectPlaceKnowledge(...(args as [])),
}));

const ZONE: ValueZoneVerdict = { kind: 'ready', zone: { id: 'z1', name: 'Θ', price: 2000, validFrom: '2022-01-01' }, nearEdge: false, fronts: [] };
const readValueZoneAt = jest.fn(async () => ZONE);
jest.mock('@/services/market/value-zones.reader', () => ({ readValueZoneAt: (...args: unknown[]) => readValueZoneAt(...(args as [])) }));

const resolvePublicationFacts = jest.fn(async () => ({ adminArea: null, constructionYear: null }));
jest.mock('@/services/listings/listing-publication-facts', () => ({
  ...jest.requireActual('@/services/listings/listing-publication-facts'),
  resolvePublicationFacts: (...args: unknown[]) => resolvePublicationFacts(...(args as [])),
}));

import { readBuildingObjectiveValues } from '../building-objective-values.service';

const TODAY = '2026-10-02';

type Doc = Record<string, unknown>;

/** Ψεύτικη βάση: το κτίριο ως έγγραφο, οι μονάδες ως αποτέλεσμα του ερωτήματος `buildingId ==`. */
function fakeDb(building: Doc, units: Record<string, Doc>) {
  const db = {
    collection: (name: string) => ({
      doc: () => ({ get: async () => ({ data: () => (name === 'buildings' ? building : undefined) }) }),
      where: () => ({ get: async () => ({ docs: Object.entries(units).map(([id, data]) => ({ id, data: () => data })) }) }),
    }),
  };
  return db as unknown as AdminFirestore;
}

/** Διαμέρισμα με όσα ξέρει ένα ακίνητο γραφείου: όροφος, μικτό, θέρμανση, πρόσοψη (δήλωση). */
const apartment = (floor: number, name: string, extra: Doc = {}): Doc => ({
  name,
  type: 'apartment',
  floor,
  buildingId: 'bld_1',
  projectId: 'prj_1',
  areas: { gross: 90 },
  systemsOverride: { heatingType: 'central' },
  objectiveValueDeclarations: { frontage: 'single' },
  ...extra,
});

beforeEach(() => {
  phases = [];
  collectPlaceKnowledge.mockClear();
  readValueZoneAt.mockClear();
  resolvePublicationFacts.mockClear();
});

describe('readBuildingObjectiveValues', () => {
  const building = { projectId: 'prj_1', objectiveValueFacts: { permitDate: '2025-03-01' } };

  it('ΜΙΑ ζώνη · ΜΙΑ γνώση τόπου · ΕΝΑ σύνολο γεγονότων για Ν μονάδες στην ίδια θέση', async () => {
    phases = [{ legalStage: 'electricity', status: 'completed' }];
    const units = { u1: apartment(1, 'Α1'), u2: apartment(2, 'Β1'), u3: apartment(3, 'Γ1') };
    await readBuildingObjectiveValues(fakeDb(building, units), 'bld_1', TODAY);
    expect(readValueZoneAt).toHaveBeenCalledTimes(1);
    expect(collectPlaceKnowledge).toHaveBeenCalledTimes(1);
    expect(resolvePublicationFacts).toHaveBeenCalledTimes(1);
  });

  it('στάδιο από το χρονοδιάγραμμα · άδεια από το κτίριο ⇒ ποσό ανά μονάδα και ΑΛΗΘΙΝΟ σύνολο, κατά όροφο', async () => {
    phases = [{ legalStage: 'electricity', status: 'completed' }];
    // Γ' όροφος ⇒ ο νόμος ζητά ανελκυστήρα (άρθ. 3 §11β): χωρίς αυτόν θα έβγαιναν όρια, όχι ποσό.
    const units = { u2: apartment(3, 'Γ1', { propertyAmenities: ['elevator'] }), u1: apartment(1, 'Α1') };
    const result = await readBuildingObjectiveValues(fakeDb(building, units), 'bld_1', TODAY);
    expect(result.stage).toEqual({ source: 'schedule', stage: 'electricity' });
    expect(result.units.map((row) => row.name)).toEqual(['Α1', 'Γ1']);
    const values = result.units.map((row) =>
      row.value.kind === 'evaluated' && row.value.bounds.kind === 'exact' ? row.value.bounds.result.value : null,
    );
    expect(values.every((value) => value !== null && value > 0)).toBe(true);
    expect(result.total).toEqual({ kind: 'exact', value: (values[0] ?? 0) + (values[1] ?? 0), units: 2 });
  });

  it('η απόκρυψη αφορά το ΚΟΙΝΟ: κρυμμένη μονάδα υπολογίζεται κανονικά για τον εργολάβο', async () => {
    phases = [{ legalStage: 'electricity', status: 'completed' }];
    const hidden = apartment(1, 'Α1', { objectiveValueDeclarations: { frontage: 'single', display: 'hidden' } });
    const result = await readBuildingObjectiveValues(fakeDb(building, { u1: hidden }), 'bld_1', TODAY);
    expect(result.units[0]?.value).toMatchObject({ kind: 'evaluated', bounds: { kind: 'exact' } });
  });

  it('στάδιο άγνωστο ⇒ «τι λείπει» ανά μονάδα και ΚΑΝΕΝΑ σύνολο · κατάστημα δεν μετρά ως εκκρεμές', async () => {
    const units = { u1: apartment(1, 'Α1'), s1: { name: 'Κ1', type: 'shop', floor: 0, buildingId: 'bld_1', areas: { gross: 50 } } };
    const result = await readBuildingObjectiveValues(fakeDb({ projectId: 'prj_1' }, units), 'bld_1', TODAY);
    expect(result.stage).toEqual({ source: 'unknown' });
    expect(result.units.find((row) => row.id === 'u1')?.value).toMatchObject({
      bounds: { kind: 'unresolved', result: { missing: ['completion'] } },
    });
    expect(result.units.find((row) => row.id === 's1')?.value).toEqual({ kind: 'unsupported', reason: 'type' });
    expect(result.total).toEqual({ kind: 'incomplete', pending: 1, units: 1 });
  });
});
