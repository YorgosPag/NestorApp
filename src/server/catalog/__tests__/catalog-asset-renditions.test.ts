/**
 * @jest-environment node
 *
 * @fileoverview **Ο γραφέας αποδόσεων μέσου καταλόγου** (ADR-923 §5.10.3) — ψεύτικος κάδος, ψεύτικη εγγραφή, πραγματικό
 * `sharp` σε πραγματικά bytes (CMYK με προφίλ).
 *
 * Μεταλλάξεις που πρέπει να πιάσει:
 * - Ε1: αποδόσεις σε λάθος όνομα/χωρίς contentType/χωρίς έκδοση συνταγής ή γενιά · καταγραφή χωρίς τα μετρημένα.
 * - Ε2: ιδεμποτία — έκβαση της τρέχουσας συνταγής και γενιάς ξανακατεβάζει/ξαναγράφει.
 * - Ε3: έκβαση **παλιότερης** συνταγής ή **παλιότερης γενιάς** (το πρωτότυπο ξαναγράφτηκε) θεωρείται τρέχουσα.
 * - Ε4: «κακά bytes» / «πολύ μεγάλο» δεν καταγράφονται ως `failed` (ή κατεβαίνει 200+ MB για να το μάθουμε).
 * - Ε5: βλάβη υποδομής ή γενιά που χάθηκε στο μεταξύ καταγράφεται ως `failed` (καταδικάζει σωστή φωτογραφία).
 * - Ε6: δύο ταυτόχρονες κλήσεις κάνουν δύο φορές τη δουλειά.
 * - Ε7: η συνταγή αλλάζει χωρίς νέα έκδοση.
 */

jest.mock('server-only', () => ({}));

interface StoredObject { generation: string; size: number | null; bytes: Buffer }
const mockObjects = new Map<string, StoredObject>();
const mockSaves: Array<{ path: string; bytes: Buffer; options: Record<string, unknown> }> = [];
const mockReads: Array<{ path: string; generation: string }> = [];
let mockSaveFailure: Error | null = null;
let mockGenerationVanishes = false;

jest.mock('@/lib/storage/storage-object-stream', () => ({
  statStorageObject: async (path: string) => {
    const stored = mockObjects.get(path);
    return stored ? { kind: 'found', generation: stored.generation, contentType: 'image/jpeg', size: stored.size, dimensions: null } : { kind: 'absent' };
  },
  readStorageObjectGeneration: async (path: string, generation: string) => {
    mockReads.push({ path, generation });
    const stored = mockObjects.get(path);
    return !mockGenerationVanishes && stored?.generation === generation ? stored.bytes : null;
  },
}));

jest.mock('@/server/files/file-record-bucket', () => ({
  fileRecordBucket: () => ({
    file: (path: string) => ({
      save: async (bytes: Buffer, options: Record<string, unknown>) => {
        if (mockSaveFailure) throw mockSaveFailure;
        mockSaves.push({ path, bytes, options });
      },
    }),
  }),
}));

import type { Firestore } from 'firebase-admin/firestore';
import sharp from 'sharp';

import { CATALOG_RENDITION_RECIPE_VERSION, type CatalogRenditions } from '@/subapps/catalog/renditions/catalog-renditions';
import { CATALOG_ASSET_MAX_BYTES } from '@/subapps/catalog/vocabulary/asset-files';
import { CATALOG_RENDITION_SPECS, ensureCatalogAssetRenditions } from '../catalog-asset-renditions.server';

const DIR = 'companies/comp_1/entities/catalog_asset/casst_x/domains/catalog/categories/photos/files/';
const PATH = `${DIR}file_1.jpg`;
const GEN = '1730000000000001';
const updates: Array<{ collection: string; id: string; data: Record<string, unknown> }> = [];
const db = {
  collection: (collection: string) => ({
    doc: (id: string) => ({ update: async (data: Record<string, unknown>) => void updates.push({ collection, id, data }) }),
  }),
} as unknown as Firestore;

const target = (record: Record<string, unknown> = {}) => ({
  custody: 'company' as const,
  fileId: 'file_1',
  record: { storagePath: PATH, ...record },
});

const failedAt = (recipe: number, sourceGeneration: string): CatalogRenditions => ({
  status: 'failed', recipe, sourceGeneration, failure: 'undecodable', failedAt: 'x',
});

async function storeCmykJpeg(generation = GEN): Promise<void> {
  const bytes = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: { r: 200, g: 30, b: 40 } } })
    .toColourspace('cmyk').withIccProfile('cmyk').jpeg().toBuffer();
  mockObjects.set(PATH, { generation, size: bytes.length, bytes });
}

beforeEach(() => {
  mockObjects.clear();
  mockSaves.length = 0;
  mockReads.length = 0;
  updates.length = 0;
  mockSaveFailure = null;
  mockGenerationVanishes = false;
});

describe('ensureCatalogAssetRenditions', () => {
  it('🔴 Ε1 CMYK ⇒ web sRGB 2048 + εκτύπωση CMYK πλήρης, δίπλα στο πρωτότυπο, με συνταγή ΚΑΙ γενιά', async () => {
    await storeCmykJpeg();
    const state = await ensureCatalogAssetRenditions(db, target());

    expect(mockReads).toEqual([{ path: PATH, generation: GEN }]);
    expect(mockSaves.map((s) => s.path)).toEqual([`${DIR}file_1_catalog-web`, `${DIR}file_1_catalog-print`]);
    for (const save of mockSaves) {
      expect(save.options).toMatchObject({
        contentType: 'image/jpeg',
        resumable: false,
        metadata: {
          cacheControl: 'private, max-age=0',
          metadata: { derivedFrom: 'file_1', recipe: String(CATALOG_RENDITION_RECIPE_VERSION), sourceGeneration: GEN },
        },
      });
    }
    expect(state).toMatchObject({
      status: 'ready',
      recipe: CATALOG_RENDITION_RECIPE_VERSION,
      sourceGeneration: GEN,
      web: { width: 2048, height: 1365, contentType: 'image/jpeg', colour: { model: 'rgb' }, colourPreserved: false },
      print: { width: 3000, height: 2000, colour: { model: 'cmyk', profile: { name: 'Chemical proof' } }, colourPreserved: true },
    });
    const ready = state as Extract<CatalogRenditions, { status: 'ready' }>;
    expect(ready.web.sizeBytes).toBe(mockSaves[0].bytes.length);
    expect(updates).toEqual([{ collection: 'files', id: 'file_1', data: { catalogRenditions: state } }]);
  });

  it('🔴 Ε2 έκβαση της τρέχουσας συνταγής ΚΑΙ γενιάς ⇒ καμία λήψη, καμία γραφή', async () => {
    await storeCmykJpeg();
    const recorded = failedAt(CATALOG_RENDITION_RECIPE_VERSION, GEN);
    expect(await ensureCatalogAssetRenditions(db, target({ catalogRenditions: recorded }))).toBe(recorded);
    expect(mockReads).toEqual([]);
    expect(updates).toEqual([]);
  });

  it.each([
    ['παλιότερη συνταγή', failedAt(CATALOG_RENDITION_RECIPE_VERSION - 1, GEN)],
    ['το πρωτότυπο ξαναγράφτηκε (άλλη γενιά)', failedAt(CATALOG_RENDITION_RECIPE_VERSION, '1720000000000000')],
  ])('🔴 Ε3 %s ⇒ ξαναφτιάχνεται', async (_name, recorded) => {
    await storeCmykJpeg();
    const state = await ensureCatalogAssetRenditions(db, target({ catalogRenditions: recorded }));
    expect(state).toMatchObject({ status: 'ready', sourceGeneration: GEN });
    expect(mockSaves).toHaveLength(2);
  });

  it('🔴 Ε4 κακά bytes ⇒ `failed: undecodable` · πάνω από το όριο ⇒ `failed: tooLarge` ΧΩΡΙΣ λήψη', async () => {
    mockObjects.set(PATH, { generation: GEN, size: 12, bytes: Buffer.from('not an image') });
    expect(await ensureCatalogAssetRenditions(db, target())).toMatchObject({ status: 'failed', failure: 'undecodable', sourceGeneration: GEN });
    mockReads.length = 0;
    mockObjects.set(PATH, { generation: '2', size: CATALOG_ASSET_MAX_BYTES.image + 1, bytes: Buffer.alloc(1) });
    expect(await ensureCatalogAssetRenditions(db, target())).toMatchObject({ status: 'failed', failure: 'tooLarge' });
    expect(mockReads).toEqual([]);
    expect(mockSaves).toEqual([]);
  });

  it('🔴 Ε5 βλάβη αποθήκευσης / γενιά που χάθηκε στο μεταξύ ⇒ πετά, ΤΙΠΟΤΑ δεν καταγράφεται', async () => {
    await storeCmykJpeg();
    mockSaveFailure = Object.assign(new Error('503 backend'), { code: 503 });
    await expect(ensureCatalogAssetRenditions(db, target())).rejects.toThrow('503 backend');
    mockSaveFailure = null;
    mockGenerationVanishes = true;
    await expect(ensureCatalogAssetRenditions(db, target())).rejects.toThrow(/vanished/);
    expect(updates).toEqual([]);
  });

  it('🔴 Ε6 δύο ταυτόχρονες κλήσεις ⇒ ΜΙΑ λήψη, μία κωδικοποίηση', async () => {
    await storeCmykJpeg();
    const [a, b] = await Promise.all([ensureCatalogAssetRenditions(db, target()), ensureCatalogAssetRenditions(db, target())]);
    expect(a).toEqual(b);
    expect(mockReads).toHaveLength(1);
    expect(mockSaves).toHaveLength(2);
  });

  it('χωρίς μονοπάτι ή χωρίς αντικείμενο ⇒ null, καμία εργασία', async () => {
    expect(await ensureCatalogAssetRenditions(db, target({ storagePath: '  ' }))).toBeNull();
    expect(await ensureCatalogAssetRenditions(db, target())).toBeNull();
    expect(mockReads).toEqual([]);
    expect(updates).toEqual([]);
  });
});

describe('η συνταγή', () => {
  it('🔴 Ε7 η συνταγή είναι ΚΛΕΙΔΩΜΕΝΗ στην έκδοσή της — αλλαγή χωρίς νέα έκδοση = μπαγιάτικες αποδόσεις για πάντα', () => {
    // v2 (2026-10-26): CMYK χωρίς προφίλ ⇒ απόδοση εκτύπωσης χωρίς προφίλ (όχι το «Chemical proof» του sharp).
    expect({ version: CATALOG_RENDITION_RECIPE_VERSION, specs: CATALOG_RENDITION_SPECS }).toEqual({
      version: 2,
      specs: {
        web: { box: { fit: 'max-edge', px: 2048 }, colour: 'srgb', jpegQuality: 82, chromaSubsampling: '4:2:0' },
        print: { box: { fit: 'max-edge', px: 12000 }, colour: 'preserve', jpegQuality: 95, chromaSubsampling: '4:4:4' },
      },
    });
  });
});
