/**
 * ADR-652 M2 — cloud persistence: blob (de)serialisation, palette merge, lazy hydration.
 *
 * Τα τρία σημεία όπου μπορεί να «χαθεί» ένα block μεταξύ Storage και καμβά:
 *  1. blob roundtrip — ό,τι ανέβηκε πρέπει να ξαναγίνει ΤΟ ΙΔΙΟ `Entity[]`.
 *  2. palette merge — session + cloud σε μία λίστα, χωρίς διπλοεγγραφή ονόματος.
 *  3. hydration — cloud item → τοποθετήσιμος ορισμός στο ΙΔΙΟ registry (μία διαδρομή
 *     τοποθέτησης, καμία δεύτερη).
 */

// Το Storage IO είναι mocked ΟΛΟΚΛΗΡΟ (τα ESM exports δεν γίνονται spy): το hydration
// μας ενδιαφέρει ως συμπεριφορά — τι κάνει ΜΕ ό,τι επιστρέψει ο fetcher.
jest.mock('../block-geometry-storage', () => ({
  fetchBlockGeometry: jest.fn(),
}));

import type { Entity } from '../../../types/entities';
import type { BlockLibraryItem, InSessionBlockDef } from '../block-library-types';
import {
  BLOCK_GEOMETRY_BLOB_VERSION,
  parseBlockGeometryBlob,
  serializeBlockGeometry,
} from '../block-geometry-blob';
import { mergeBlockPaletteEntries } from '../block-palette-entries';
import { hydrateCloudBlockDef } from '../hydrate-cloud-block';
import { fetchBlockGeometry } from '../block-geometry-storage';
import {
  __resetSessionBlockLibraryForTests,
  getSessionBlockDef,
  upsertSessionBlockDef,
} from '../block-library-registry';

const mockFetchGeometry = fetchBlockGeometry as jest.MockedFunction<typeof fetchBlockGeometry>;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BOUNDS = { minX: 0, minY: 0, maxX: 600, maxY: 450 };

function member(id: string, selected = false): Entity {
  return {
    id,
    type: 'line',
    layerId: '0',
    start: { x: 0, y: 0 },
    end: { x: 600, y: 0 },
    visible: true,
    selected,
  } as unknown as Entity;
}

function sessionDef(name: string): InSessionBlockDef {
  return { name, localMembers: [member(`${name}-1`)], boundsMm: BOUNDS };
}

function cloudItem(id: string, name: string): BlockLibraryItem {
  return {
    id,
    scope: 'user',
    companyId: 'co_alpha',
    projectId: null,
    createdBy: 'usr_test',
    builtin: false,
    name,
    category: 'furniture',
    boundsMm: BOUNDS,
    geometryUrl: `https://storage.test/${id}.json`,
    provenance: { sourceType: 'user-import', importedAt: 1, importedBy: 'usr_test' },
    license: { type: 'unknown', redistributable: false },
  };
}

beforeEach(() => {
  __resetSessionBlockLibraryForTests();
  mockFetchGeometry.mockReset();
});

// ---------------------------------------------------------------------------
// 1. Geometry blob
// ---------------------------------------------------------------------------

describe('block geometry blob', () => {
  it('roundtrip: ό,τι σειριοποιήθηκε ξαναδιαβάζεται ίδιο', () => {
    const text = serializeBlockGeometry({
      name: 'CHAIR',
      boundsMm: BOUNDS,
      localMembers: [member('a'), member('b')],
    });

    const blob = parseBlockGeometryBlob(text);
    expect(blob).not.toBeNull();
    expect(blob!.version).toBe(BLOCK_GEOMETRY_BLOB_VERSION);
    expect(blob!.name).toBe('CHAIR');
    expect(blob!.boundsMm).toEqual(BOUNDS);
    expect(blob!.entities.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('δεν αποθηκεύει transient UI state (selected)', () => {
    const text = serializeBlockGeometry({
      name: 'CHAIR',
      boundsMm: BOUNDS,
      localMembers: [member('a', true)],
    });

    const blob = parseBlockGeometryBlob(text)!;
    expect((blob.entities[0] as unknown as { selected: boolean }).selected).toBe(false);
  });

  it('απορρίπτει σκουπίδια, άδεια γεωμετρία, άγνωστη έκδοση, ελλιπή bounds', () => {
    expect(parseBlockGeometryBlob('{ not json')).toBeNull();
    expect(parseBlockGeometryBlob('null')).toBeNull();
    expect(
      parseBlockGeometryBlob(
        JSON.stringify({ version: BLOCK_GEOMETRY_BLOB_VERSION, name: 'X', boundsMm: BOUNDS, entities: [] }),
      ),
    ).toBeNull();
    expect(
      parseBlockGeometryBlob(
        JSON.stringify({ version: 99, name: 'X', boundsMm: BOUNDS, entities: [member('a')] }),
      ),
    ).toBeNull();
    expect(
      parseBlockGeometryBlob(
        JSON.stringify({
          version: BLOCK_GEOMETRY_BLOB_VERSION,
          name: 'X',
          boundsMm: { minX: 0, minY: 0 },
          entities: [member('a')],
        }),
      ),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Palette merge
// ---------------------------------------------------------------------------

describe('mergeBlockPaletteEntries', () => {
  it('δείχνει session (αποθηκεύσιμα) πρώτα και μετά τη μόνιμη βιβλιοθήκη', () => {
    const entries = mergeBlockPaletteEntries(
      [sessionDef('TABLE')],
      [cloudItem('blklib_1', 'WC')],
    );

    expect(entries.map((e) => e.name)).toEqual(['TABLE', 'WC']);
    expect(entries[0]).toMatchObject({ source: 'session', canSave: true, key: 'session:TABLE' });
    expect(entries[1]).toMatchObject({ source: 'cloud', canSave: false, key: 'blklib_1' });
  });

  it('ίδιο όνομα σε import + βιβλιοθήκη → ΜΙΑ κάρτα (cloud· πρακτική AutoCAD: ένας ορισμός ανά όνομα)', () => {
    const entries = mergeBlockPaletteEntries(
      [sessionDef('CHAIR'), sessionDef('TABLE')],
      [cloudItem('blklib_1', 'CHAIR')],
    );

    expect(entries).toHaveLength(2);
    expect(entries.filter((e) => e.name === 'CHAIR')).toHaveLength(1);
    expect(entries.find((e) => e.name === 'CHAIR')).toMatchObject({
      source: 'cloud',
      canSave: false,
    });
  });

  it('η cloud κάρτα κουβαλά την άδεια (για το ταμπελάκι)', () => {
    const [entry] = mergeBlockPaletteEntries([], [cloudItem('blklib_1', 'WC')]);
    expect(entry.item?.license.type).toBe('unknown');
    expect(entry.item?.license.redistributable).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Lazy hydration
// ---------------------------------------------------------------------------

describe('hydrateCloudBlockDef', () => {
  it('κατεβάζει το blob και το κάνει τοποθετήσιμο ΣΤΟ ΙΔΙΟ registry', async () => {
    mockFetchGeometry.mockResolvedValue({
      version: BLOCK_GEOMETRY_BLOB_VERSION,
      name: 'WC',
      boundsMm: BOUNDS,
      entities: [member('m1'), member('m2')],
    });

    const def = await hydrateCloudBlockDef(cloudItem('blklib_1', 'WC'));

    expect(mockFetchGeometry).toHaveBeenCalledWith({ companyId: 'co_alpha', blockId: 'blklib_1' });
    expect(def?.localMembers).toHaveLength(2);
    // …και το tool το βρίσκει από το ΙΔΙΟ registry με ένα imported block.
    expect(getSessionBlockDef('WC')?.localMembers).toHaveLength(2);
  });

  it('idempotent: δεύτερη επιλογή δεν ξανακατεβάζει', async () => {
    upsertSessionBlockDef({ name: 'WC', localMembers: [member('m1')], boundsMm: BOUNDS });

    const def = await hydrateCloudBlockDef(cloudItem('blklib_1', 'WC'));

    expect(mockFetchGeometry).not.toHaveBeenCalled();
    expect(def?.localMembers).toHaveLength(1);
  });

  it('αποτυχία/άκυρο blob → null (το tool ΔΕΝ ενεργοποιείται)', async () => {
    mockFetchGeometry.mockResolvedValue(null);

    expect(await hydrateCloudBlockDef(cloudItem('blklib_1', 'WC'))).toBeNull();
    expect(getSessionBlockDef('WC')).toBeNull();
  });
});
