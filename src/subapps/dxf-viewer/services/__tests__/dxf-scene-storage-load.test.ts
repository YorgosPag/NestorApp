/**
 * ADR-913 §2 — η φόρτωση σκηνής λέει ΓΙΑΤΙ δεν βρήκε σκηνή: άδειο αρχείο ≠ ορφανό ≠ αδιάβαστο.
 *
 * ΤΟ ΣΕΝΑΡΙΟ ΤΗΣ ΖΗΜΙΑΣ (2026-11-15, `file_2b45ad70`): `.scene.json` με `entities: []` ⇒ `null` ⇒ ο loader του
 * επιπέδου έκανε latch «ορφανό» ⇒ το auto-save κλειστό για όλη τη συνεδρία ⇒ καμία γραμμή δεν σωζόταν ποτέ.
 * Εδώ κλειδώνεται ότι: (α) μόνο αποδεδειγμένα άδειος δίσκος δίνει `empty`, (β) σφάλμα ή άκυρο περιεχόμενο δίνει
 * `unreadable` — ΠΟΤΕ `empty` (αλλιώς baseline 0 πάνω από γεωμετρία που απλώς δεν κατέβηκε, ADR-714).
 */

const mockGetBytes = jest.fn();
const mockGetById = jest.fn();

jest.mock('../../../../lib/firebase', () => ({ storage: {} }));
jest.mock('firebase/storage', () => ({
  ref: jest.fn((_storage: unknown, path: string) => ({ path })),
  getBytes: (...args: unknown[]) => mockGetBytes(...args),
}));
jest.mock('@/services/firestore/firestore-query.service', () => ({
  firestoreQueryService: { getById: (...args: unknown[]) => mockGetById(...args) },
}));

import pako from 'pako';
import { inspectSceneJson, parseAndValidateScene } from '../dxf-scene-json';
import { loadFromStorageImpl, loadSceneFromStorageWithReason } from '../dxf-scene-storage-load';

const BASE = 'companies/c/entities/floor/flr_1/domains/construction/categories/floorplans/files/file_1';
const SCENE = `${BASE}.scene.json`;
const RAW = `${BASE}.dxf`;
const PROCESSED = `${BASE}.processed.json`;

const LINE = { id: 'e1', type: 'line', layer: '0', start: { x: 0, y: 0 }, end: { x: 1, y: 0 } };
const enc = (value: unknown): ArrayBuffer => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
};
const EMPTY_SCENE = enc({ entities: [], layersById: { '0': { id: '0', name: '0' } } });
const FULL_SCENE = enc({ entities: [LINE], layersById: {} });

const notFound = () => Object.assign(new Error('missing'), { code: 'storage/object-not-found' });
const denied = () => Object.assign(new Error('denied'), { code: 'storage/unauthorized' });

/** Το Storage ως χάρτης path → bytes | σφάλμα· ό,τι λείπει = object-not-found. */
function storageWith(objects: Record<string, ArrayBuffer | Error>): void {
  mockGetBytes.mockImplementation(async (r: { path: string }) => {
    const hit = objects[r.path];
    if (hit === undefined) throw notFound();
    if (hit instanceof Error) throw hit;
    return hit;
  });
}

const record = (extra: Record<string, unknown> = {}) => ({
  id: 'file_1',
  originalFilename: '2ος Όροφος.dxf',
  storagePath: RAW,
  companyId: 'comp_1',
  entityType: 'floor',
  entityId: 'flr_1',
  ...extra,
});

beforeEach(() => {
  mockGetBytes.mockReset();
  mockGetById.mockReset();
});

describe('inspectSceneJson — άδεια ≠ άκυρη', () => {
  it('γεμάτη ⇒ scene', () => {
    expect(inspectSceneJson(JSON.stringify({ entities: [LINE] })).kind).toBe('scene');
  });
  it('`entities: []` ⇒ empty', () => {
    expect(inspectSceneJson(JSON.stringify({ entities: [] }))).toEqual({ kind: 'empty' });
  });
  it.each([
    ['κακό JSON', '{not json'],
    ['placeholder {}', '{}'],
    ['entities όχι πίνακας', JSON.stringify({ entities: 'x' })],
    ['πίνακας στη ρίζα', '[]'],
    ['null', 'null'],
  ])('%s ⇒ invalid', (_label, text) => {
    expect(inspectSceneJson(text)).toEqual({ kind: 'invalid' });
  });
  it('το parseAndValidateScene κρατά τη σημασία του: άδεια ⇒ null', () => {
    expect(parseAndValidateScene(JSON.stringify({ entities: [] }))).toBeNull();
    expect(parseAndValidateScene(JSON.stringify({ entities: [LINE] }))?.entities).toHaveLength(1);
  });
});

describe('loadSceneFromStorageWithReason — ο λόγος της απουσίας', () => {
  it('λείπει το FileRecord ⇒ no-record', async () => {
    mockGetById.mockResolvedValue(null);
    expect(await loadSceneFromStorageWithReason('file_1')).toEqual({ kind: 'absent', reason: 'no-record' });
  });

  it('FileRecord χωρίς πηγή σκηνής ⇒ no-source', async () => {
    mockGetById.mockResolvedValue(record({ storagePath: undefined }));
    expect(await loadSceneFromStorageWithReason('file_1')).toEqual({ kind: 'absent', reason: 'no-source' });
  });

  it('`.scene.json` με `entities: []` (η ζημιά) ⇒ empty, με το FileRecord του ορόφου', async () => {
    mockGetById.mockResolvedValue(record());
    storageWith({ [SCENE]: EMPTY_SCENE });
    const result = await loadSceneFromStorageWithReason('file_1');
    expect(result).toMatchObject({
      kind: 'absent',
      reason: 'empty',
      file: { id: 'file_1', fileName: '2ος Όροφος.dxf', storagePath: RAW, entityType: 'floor', entityId: 'flr_1', retired: false },
    });
  });

  it('καμία σκηνή σε καμία βαθμίδα (γεννημένο, δεν σώθηκε ακόμη) ⇒ empty', async () => {
    mockGetById.mockResolvedValue(record());
    storageWith({});
    expect(await loadSceneFromStorageWithReason('file_1')).toMatchObject({ kind: 'absent', reason: 'empty' });
  });

  it('σφάλμα δικτύου/δικαιωμάτων σε ΜΙΑ βαθμίδα ⇒ unreadable, ποτέ empty', async () => {
    mockGetById.mockResolvedValue(record({ processedData: { processedDataPath: PROCESSED } }));
    storageWith({ [SCENE]: EMPTY_SCENE, [PROCESSED]: denied() });
    expect(await loadSceneFromStorageWithReason('file_1')).toMatchObject({ kind: 'absent', reason: 'unreadable' });
  });

  it('άκυρο περιεχόμενο σε βαθμίδα (π.χ. το ωμό .dxf) ⇒ unreadable', async () => {
    mockGetById.mockResolvedValue(record());
    const corrupt = new TextEncoder().encode('0\nSECTION\n2\nENTITIES');
    storageWith({ [RAW]: corrupt.buffer.slice(0) as ArrayBuffer });
    expect(await loadSceneFromStorageWithReason('file_1')).toMatchObject({ kind: 'absent', reason: 'unreadable' });
  });

  it('άδειο `.scene.json` αλλά γεμάτο processed (gzip) ⇒ loaded από τη βαθμίδα 2', async () => {
    mockGetById.mockResolvedValue(record({ processedData: { processedDataPath: PROCESSED } }));
    const gz = pako.gzip(JSON.stringify({ entities: [LINE] }));
    storageWith({ [SCENE]: EMPTY_SCENE, [PROCESSED]: gz.buffer.slice(gz.byteOffset, gz.byteOffset + gz.byteLength) as ArrayBuffer });
    const result = await loadSceneFromStorageWithReason('file_1');
    expect(result.kind).toBe('loaded');
    if (result.kind === 'loaded') {
      expect(result.record.scene.entities).toHaveLength(1);
      expect(result.record).not.toHaveProperty('retired');
    }
  });

  it('αποσυρμένο (κάδος) ⇒ το `file.retired` το λέει', async () => {
    mockGetById.mockResolvedValue(record({ lifecycleState: 'trashed' }));
    storageWith({ [SCENE]: EMPTY_SCENE });
    expect(await loadSceneFromStorageWithReason('file_1')).toMatchObject({ reason: 'empty', file: { retired: true } });
  });

  it('η ανάγνωση του FileRecord πετά ⇒ unreadable (ποτέ throw)', async () => {
    mockGetById.mockRejectedValue(new Error('boom'));
    expect(await loadSceneFromStorageWithReason('file_1')).toEqual({ kind: 'absent', reason: 'unreadable' });
  });
});

describe('loadFromStorageImpl — σταθερή σημασία για τους καλούντες του loadFileV2', () => {
  it('γεμάτη ⇒ record· άδεια ⇒ null', async () => {
    mockGetById.mockResolvedValue(record());
    storageWith({ [SCENE]: FULL_SCENE });
    expect((await loadFromStorageImpl('file_1'))?.scene.entities).toHaveLength(1);
    storageWith({ [SCENE]: EMPTY_SCENE });
    expect(await loadFromStorageImpl('file_1')).toBeNull();
  });
});
