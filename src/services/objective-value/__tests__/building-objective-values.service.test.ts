/**
 * ADR-898 Φ4 — ο πίνακας του εργολάβου στον server: η ΙΔΙΑ προβολή με την αγγελία (πραγματική), μία ζώνη και μία
 * γνώση τόπου ανά κτίριο (όχι ανά μονάδα), η απόκρυψη δεν κρύβει από τον κατασκευαστή, σύνολο μόνο όταν είναι αληθινό.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import type { ValueZoneVerdict } from '@/lib/market/value-zone-at-point';
import type { BuildingUnitObjectiveValue } from '@/lib/objective-value/building-objective-value';
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

/** Χώροι ανά συλλογή — όσοι έχουν `buildingId` του κτιρίου επιστρέφονται και από το ερώτημα. */
interface FakeSpaces {
  readonly parking_spots?: Record<string, Doc>;
  readonly storage_units?: Record<string, Doc>;
}

const docsOf = (docs: Record<string, Doc>) => ({ docs: Object.entries(docs).map(([id, data]) => ({ id, data: () => data })) });

/**
 * Ψεύτικη βάση: το κτίριο ως έγγραφο, οι μονάδες ως αποτέλεσμα του `buildingId ==` στα `properties`, οι χώροι ανά
 * συλλογή (ερώτημα κατά κτίριο **και** ανάγνωση κατά ταυτότητα, για τους συνδεδεμένους χωρίς κτίριο).
 */
function fakeDb(building: Doc, units: Record<string, Doc>, spaces: FakeSpaces = {}, otherBuildings: Record<string, Doc> = {}) {
  const spacesOf = (name: string): Record<string, Doc> => (name === 'parking_spots' || name === 'storage_units' ? (spaces[name] ?? {}) : {});
  const docsNamed = (name: string) => (name === 'properties' ? units : spacesOf(name));
  const buildingOf = (id: string) => (id === 'bld_1' ? building : otherBuildings[id]);
  const db = {
    collection: (name: string) => ({
      doc: (id: string) => ({ get: async () => ({ data: () => (name === 'buildings' ? buildingOf(id) : spacesOf(name)[id]) }) }),
      // Ισότητα σε ΕΝΑ πεδίο — ό,τι ρωτά ο αναγνώστης (`buildingId` · `projectId`).
      where: (field: string, _op: string, value: unknown) => ({
        get: async () => docsOf(Object.fromEntries(Object.entries(docsNamed(name)).filter(([, data]) => data[field] === value))),
      }),
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
    expect(result.rows.map((row) => row.name)).toEqual(['Α1', 'Γ1']);
    const values = result.rows.map((row) =>
      row.value.kind === 'evaluated' && row.value.bounds.kind === 'exact' ? row.value.bounds.result.value : null,
    );
    expect(values.every((value) => value !== null && value > 0)).toBe(true);
    expect(result.total).toEqual({ kind: 'exact', value: (values[0] ?? 0) + (values[1] ?? 0), items: 2 });
  });

  it('η απόκρυψη αφορά το ΚΟΙΝΟ: κρυμμένη μονάδα υπολογίζεται κανονικά για τον εργολάβο', async () => {
    phases = [{ legalStage: 'electricity', status: 'completed' }];
    const hidden = apartment(1, 'Α1', { objectiveValueDeclarations: { frontage: 'single', display: 'hidden' } });
    const result = await readBuildingObjectiveValues(fakeDb(building, { u1: hidden }), 'bld_1', TODAY);
    expect(result.rows[0]?.value).toMatchObject({ kind: 'evaluated', bounds: { kind: 'exact' } });
  });

  it('στάδιο άγνωστο ⇒ «τι λείπει» ανά μονάδα και ΚΑΝΕΝΑ σύνολο · κατάστημα δεν μετρά ως εκκρεμές', async () => {
    const units = { u1: apartment(1, 'Α1'), s1: { name: 'Κ1', type: 'shop', floor: 0, buildingId: 'bld_1', areas: { gross: 50 } } };
    const result = await readBuildingObjectiveValues(fakeDb({ projectId: 'prj_1' }, units), 'bld_1', TODAY);
    expect(result.stage).toEqual({ source: 'unknown' });
    expect(result.rows.find((row) => row.id === 'u1')?.value).toMatchObject({
      bounds: { kind: 'unresolved', result: { missing: ['completion'] } },
    });
    expect(result.rows.find((row) => row.id === 's1')?.value).toEqual({ kind: 'unsupported', reason: 'type' });
    expect(result.total).toEqual({ kind: 'incomplete', pending: 1, items: 1 });
  });
});

describe('readBuildingObjectiveValues — παρακολουθήματα (§19)', () => {
  const building = { projectId: 'prj_1', objectiveValueFacts: { permitDate: '2025-03-01' } };
  const linked = (...spaceIds: string[]) => ({
    linkedSpaces: spaceIds.map((spaceId) => ({ spaceId, spaceType: 'parking', quantity: 1, inclusion: 'included' })),
  });
  const exactOf = (value: BuildingUnitObjectiveValue) => (value.kind === 'evaluated' && value.bounds.kind === 'exact' ? value.bounds.result.value : 0);

  beforeEach(() => {
    phases = [{ legalStage: 'electricity', status: 'completed' }];
  });

  it('κάθε χώρος ΜΙΑ γραμμή, με τον κάτοχό του · σύνολο = μονάδες + χώροι, ΧΩΡΙΣ διπλομέτρηση', async () => {
    const units = { u1: apartment(1, 'Α1', linked('p1')) };
    const spaces = { parking_spots: { p1: { number: 'Π-1', buildingId: 'bld_1', locationZone: 'pilotis', area: 12, status: 'active' } } };
    const result = await readBuildingObjectiveValues(fakeDb(building, units, spaces), 'bld_1', TODAY);
    expect(result.rows.map((row) => [row.id, row.kind, row.space?.ownerUnitId ?? null])).toEqual([
      ['u1', 'unit', null],
      ['p1', 'parking', 'u1'],
    ]);
    const [unitValue, spaceValue] = result.rows.map((row) => exactOf(row.value));
    expect(spaceValue).toBe(3600);
    expect(result.total).toEqual({ kind: 'exact', value: (unitValue ?? 0) + 3600, items: 2 });
  });

  it('συνδεδεμένος χωρίς κτίριο ΜΕΤΡΑ · με ΑΛΛΟ κτίριο = ΑΝΑΦΟΡΑ χωρίς ποσό, εκτός συνόλου · ο κάδος πουθενά (§20)', async () => {
    const units = { u1: apartment(1, 'Α1', linked('free', 'other', 'trashedLinked')) };
    const spaces = {
      parking_spots: {
        free: { number: 'Π-Ε', locationZone: 'open_space', area: 12 },
        other: { number: 'Π-5', buildingId: 'bld_2', locationZone: 'pilotis', area: 12 },
        trashed: { number: 'Π-Κ', buildingId: 'bld_1', locationZone: 'pilotis', area: 12, status: 'deleted' },
        trashedLinked: { number: 'Π-Δ', buildingId: 'bld_2', locationZone: 'pilotis', area: 12, status: 'deleted' },
      },
    };
    const db = fakeDb(building, units, spaces, { bld_2: { code: 'Β', name: 'Κτίριο Β' } });
    const result = await readBuildingObjectiveValues(db, 'bld_1', TODAY);
    expect(result.rows.map((row) => row.id).sort()).toEqual(['free', 'u1']);
    expect(result.references).toEqual([
      { id: 'other', kind: 'parking', name: 'Π-5', ownerUnitId: 'u1', ownerUnitName: 'Α1', locatedIn: { buildingId: 'bld_2', label: 'Β — Κτίριο Β' } },
    ]);
    expect(result.total).toMatchObject({ items: 2 });
  });

  it('χώρος ΕΔΩ με μονάδα ΑΛΛΟΥ κτιρίου του έργου ⇒ μετρά εδώ, με τον κάτοχό του — όχι «χωρίς μονάδα» (§20)', async () => {
    const units = { a3: { ...apartment(3, 'Α3', linked('p5')), buildingId: 'bld_A' } };
    const spaces = { parking_spots: { p5: { number: 'Π-5', buildingId: 'bld_1', locationZone: 'pilotis', area: 12 } } };
    const db = fakeDb(building, units, spaces, { bld_A: { name: 'Κτίριο Α' } });
    const result = await readBuildingObjectiveValues(db, 'bld_1', TODAY);
    expect(result.rows.map((row) => [row.id, row.space?.ownerUnitId, row.space?.ownerUnitName, row.space?.ownerElsewhere])).toEqual([
      ['p5', 'a3', 'Α3', { buildingId: 'bld_A', label: 'Κτίριο Α' }],
    ]);
    expect(result.references).toEqual([]);
    expect(result.total).toEqual({ kind: 'exact', value: 3600, items: 1 });
  });

  it('η ΑΝΤΙΣΤΡΟΦΗ πλευρά: στο κτίριο της μονάδας ο ίδιος χώρος είναι αναφορά — ΜΙΑ μέτρηση στο έργο (§20)', async () => {
    const units = { a3: { ...apartment(3, 'Α3', linked('p5')), buildingId: 'bld_A' } };
    const spaces = { parking_spots: { p5: { number: 'Π-5', buildingId: 'bld_1', locationZone: 'pilotis', area: 12 } } };
    const asA = fakeDb({ ...building }, units, spaces, { bld_A: building });
    // Το κτίριο Α: η μονάδα του είναι γραμμή, η Π-5 (στο bld_1) ΜΟΝΟ αναφορά.
    const ofA = await readBuildingObjectiveValues(asA, 'bld_A', TODAY);
    expect(ofA.rows.map((row) => row.id)).toEqual(['a3']);
    expect(ofA.references.map((reference) => [reference.id, reference.locatedIn.buildingId])).toEqual([['p5', 'bld_1']]);
  });

  it('αποθήκες υπογείου χωρίς είσοδο ⇒ ΜΙΑ ερώτηση του κτιρίου με το πλήθος τους', async () => {
    const spaces = {
      storage_units: {
        a1: { name: 'Α1', buildingId: 'bld_1', floor: '-1', area: 8 },
        a2: { name: 'Α2', buildingId: 'bld_1', floor: '-1', area: 6 },
      },
    };
    const result = await readBuildingObjectiveValues(fakeDb(building, {}, spaces), 'bld_1', TODAY);
    expect(result.questions).toEqual([{ fact: 'basementStorageEntrance', items: 2 }]);
    expect(result.total).toMatchObject({ kind: 'incomplete', pending: 2, items: 2 });
  });
});
