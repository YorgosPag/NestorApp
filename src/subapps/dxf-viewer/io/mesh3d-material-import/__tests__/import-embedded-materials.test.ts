/**
 * import-embedded-materials — ADR-691 §4.1/§7 test anchors. DI (μηδέν Firebase): τα deps είναι
 * `jest.fn()`/χειρόγραφα stubs, όπως το `dae-texture-import.test.ts` για το `importForeignTextures`.
 */

import { importEmbeddedMeshMaterials } from '../import-embedded-materials';
import type { ForeignTextureImporterDeps } from '../import-foreign-textures';
import type { KnownMaterialResolver } from '../known-import-materials';
import type {
  BimMaterial,
  SaveBimMaterialInput,
  UpdateBimMaterialPatch,
} from '../../../bim/types/bim-material-types';
import type { EmbeddedGltfMaterial } from '../../mesh3d-roundtrip/glb-embedded-materials';

function embeddedMaterial(overrides: { readonly index: number } & Partial<EmbeddedGltfMaterial>): EmbeddedGltfMaterial {
  return {
    index: overrides.index,
    name: overrides.name ?? null,
    colorHex: overrides.colorHex ?? '#ffffff',
    opacity: overrides.opacity ?? 1,
    metalness: overrides.metalness ?? 1,
    roughness: overrides.roughness ?? 1,
    albedo: overrides.albedo ?? null,
  };
}

function fakeMaterial(id: string): BimMaterial {
  return {
    id, scope: 'company', nameEl: id, nameEn: id, category: 'other',
    density: null, defaultThickness: null, fireRating: 'none', atoeCategory: 'OIK-77.01',
    atoeArticle: null, defaultUnitCost: null, defaultUnit: 'm2', brand: null, brandModel: null,
    notes: null, thumbnailUrl: null, pbrTextures: null,
    builtin: false, companyId: 'co-1', projectId: null,
    createdBy: 'u', createdAt: {} as never, updatedBy: 'u', updatedAt: {} as never,
  };
}

interface Spy {
  readonly saved: SaveBimMaterialInput[];
  readonly uploads: string[];
  /** ADR-691 Φ3 — τα patches του `updateMaterial` (υφή → `pbrTextures`, μέσο χρώμα → `appearance`). */
  readonly patched: { readonly id: string; readonly patch: UpdateBimMaterialPatch }[];
}

interface DepsOptions {
  readonly hashByFileName?: Record<string, string>;
  readonly failNameEl?: string;
}

/** Χειρόγραφο (μη-jest.fn) DI stub — mirror του pattern του `dae-texture-import.test.ts`. */
function makeDeps(options: DepsOptions = {}): { readonly deps: ForeignTextureImporterDeps; readonly spy: Spy } {
  const spy: Spy = { saved: [], uploads: [], patched: [] };
  let n = 0;
  const deps: ForeignTextureImporterDeps = {
    existingMaterials: [],
    saveMaterial: async (input) => {
      if (options.failNameEl && input.nameEl === options.failNameEl) throw new Error('save boom');
      spy.saved.push(input);
      n += 1;
      return fakeMaterial(`bmat_${n}`);
    },
    updateMaterial: async (id, patch) => { spy.patched.push({ id, patch }); },
    uploadAlbedo: async (_file, materialId) => {
      spy.uploads.push(materialId);
      return `https://storage/${materialId}/albedo.jpg`;
    },
    hashFile: async (file) => options.hashByFileName?.[(file as File).name] ?? 'h-default',
    deleteMaterial: async () => { /* no-op */ },
  };
  return { deps, spy };
}

const resolveNothing: KnownMaterialResolver = () => null;

describe('importEmbeddedMeshMaterials (ADR-691 §4.1)', () => {
  it('Nestor DNA label (mat-*) → skip, μηδέν saveMaterial', async () => {
    const { deps, spy } = makeDeps();
    const materials = [embeddedMaterial({ index: 0, name: 'mat-concrete-c25' })];

    const out = await importEmbeddedMeshMaterials({
      materials, sourceLabel: 'model', resolveKnownId: resolveNothing, deps,
    });

    expect(spy.saved).toHaveLength(0);
    expect(out.idByIndex.size).toBe(0);
    expect(out.createdCount).toBe(0);
    expect(out.reusedCount).toBe(0);
  });

  it('γνωστό όνομα (resolveKnownId) → reuse: 0 saves, reusedCount=1, σωστό idByIndex', async () => {
    const { deps, spy } = makeDeps();
    const materials = [embeddedMaterial({ index: 0, name: 'Ξύλο Δρυς' })];
    const resolveKnownId: KnownMaterialResolver = (name) => (name === 'Ξύλο Δρυς' ? 'bmat_known' : null);

    const out = await importEmbeddedMeshMaterials({
      materials, sourceLabel: 'model', resolveKnownId, deps,
    });

    expect(spy.saved).toHaveLength(0);
    expect(out.reusedCount).toBe(1);
    expect(out.createdCount).toBe(0);
    expect(out.idByIndex.get(0)).toBe('bmat_known');
  });

  it('δύο textured υλικά με ίδια bytes (ίδιο filename/hash) → ΕΝΑ bmat_* (delegate dedup)', async () => {
    const { deps, spy } = makeDeps({ hashByFileName: { 'shared.jpg': 'hash-shared' } });
    const albedo = { bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg', fileName: 'shared.jpg' };
    const materials = [
      embeddedMaterial({ index: 0, name: 'Καρέκλα Α', albedo }),
      embeddedMaterial({ index: 1, name: 'Καρέκλα Β', albedo }),
    ];

    const out = await importEmbeddedMeshMaterials({
      materials, sourceLabel: 'model', resolveKnownId: resolveNothing, deps,
    });

    expect(spy.saved).toHaveLength(1); // ΕΝΑ πραγματικό bmat_*
    const idA = out.idByIndex.get(0);
    const idB = out.idByIndex.get(1);
    expect(idA).toBeDefined();
    expect(idA).toBe(idB);
    expect(out.createdCount).toBe(1);
    expect(out.reusedCount).toBe(1); // το 2ο μετράει ως reuse του ίδιου id
  });

  it('color-only υλικό → saveMaterial με σωστό appearance + scope company', async () => {
    const { deps, spy } = makeDeps();
    const materials = [
      embeddedMaterial({
        index: 0, name: 'Ξένο Χρώμα', colorHex: '#8b4513', metalness: 0.2, roughness: 0.6, opacity: 1,
      }),
    ];

    const out = await importEmbeddedMeshMaterials({
      materials, sourceLabel: 'model', resolveKnownId: resolveNothing, deps,
    });

    expect(spy.saved).toHaveLength(1);
    expect(spy.saved[0]).toMatchObject({
      scope: 'company',
      nameEl: 'Ξένο Χρώμα',
      category: 'other',
      atoeCategory: 'OIK-77.01',
      defaultUnit: 'm2',
      appearance: { baseColorHex: '#8b4513', metalness: 0.2, roughness: 0.6, opacity: 1 },
    });
    expect(out.createdCount).toBe(1);
    expect(out.idByIndex.get(0)).toBe('bmat_1');
  });

  it('ανώνυμο υλικό (name=null) → label = "<sourceLabel> <index+1>", ΔΕΝ χάνεται', async () => {
    const { deps, spy } = makeDeps();
    const materials = [embeddedMaterial({ index: 2, name: null })];

    const out = await importEmbeddedMeshMaterials({
      materials, sourceLabel: 'abricos_gerbera', resolveKnownId: resolveNothing, deps,
    });

    expect(spy.saved).toHaveLength(1);
    expect(spy.saved[0].nameEl).toBe('abricos_gerbera 3');
    expect(out.idByIndex.get(2)).toBe('bmat_1');
    expect(out.createdCount).toBe(1);
  });

  it('saveMaterial πετά για το 1ο color-only υλικό → το 2ο μπαίνει κανονικά, μηδέν throw', async () => {
    const { deps, spy } = makeDeps({ failNameEl: 'Broken' });
    const materials = [
      embeddedMaterial({ index: 0, name: 'Broken', colorHex: '#111111' }),
      embeddedMaterial({ index: 1, name: 'Ok', colorHex: '#222222' }),
    ];

    const out = await importEmbeddedMeshMaterials({
      materials, sourceLabel: 'model', resolveKnownId: resolveNothing, deps,
    });

    expect(spy.saved).toHaveLength(1);
    expect(spy.saved[0].nameEl).toBe('Ok');
    expect(out.idByIndex.has(0)).toBe(false); // το σπασμένο μένει άλυτο
    expect(out.idByIndex.get(1)).toBe('bmat_1');
    expect(out.createdCount).toBe(1);
  });

  it('κενή λίστα → κενό αποτέλεσμα, μηδέν κλήσεις στα deps', async () => {
    const saveMaterial = jest.fn();
    const resolveKnownId = jest.fn();
    const deps: ForeignTextureImporterDeps = {
      existingMaterials: [],
      saveMaterial,
      updateMaterial: jest.fn(),
      uploadAlbedo: jest.fn(),
      hashFile: jest.fn(),
      deleteMaterial: jest.fn(),
    };

    const out = await importEmbeddedMeshMaterials({
      materials: [], sourceLabel: 'model', resolveKnownId, deps,
    });

    expect(out).toEqual({ idByIndex: new Map(), createdCount: 0, reusedCount: 0 });
    expect(saveMaterial).not.toHaveBeenCalled();
    expect(resolveKnownId).not.toHaveBeenCalled();
  });
});

/**
 * ADR-691 Φ3 — ground truth 2026-07-24: τα textured υλικά έβγαιναν με `appearance: null` (το
 * `importForeignTextures` ξέρει μόνο από υφές) → η μπάρα «Υλικά όψης» έδειχνε **γκρι μπαλάκι**
 * αντί για το πορτοκαλί/πράσινο του μοντέλου. Και το χρώμα του ίδιου του αρχείου δεν βοηθά: ο C4D
 * γράφει `Color 204,204,204` και αφήνει το χρώμα στην υφή. Λύση (Revit/C4D): **μέσο χρώμα υφής**.
 */
describe('importEmbeddedMeshMaterials — appearance από τη μέση τιμή της υφής (Φ3)', () => {
  const texturedMaterial = embeddedMaterial({
    index: 0,
    name: 'Scene_Material3',
    colorHex: '#cccccc', // ό,τι γράφει ο C4D — άχρηστο ως «χρώμα υλικού»
    metalness: 0,
    roughness: 0.8,
    opacity: 1,
    albedo: { bytes: new Uint8Array([1, 2, 3]), mimeType: 'image/jpeg', fileName: 'abricos.jpg' },
  });

  it('νέο textured υλικό → updateMaterial με appearance = μέσο χρώμα υφής (ΟΧΙ το γκρι του αρχείου)', async () => {
    const { deps, spy } = makeDeps();

    await importEmbeddedMeshMaterials({
      materials: [texturedMaterial],
      sourceLabel: 'abricos_gerbera',
      resolveKnownId: resolveNothing,
      deps,
      averageColorOf: async () => '#e8934a',
    });

    const appearancePatch = spy.patched.find((p) => p.patch.appearance);
    expect(appearancePatch?.patch.appearance).toEqual({
      baseColorHex: '#e8934a',
      metalness: 0,
      roughness: 0.8,
      opacity: 1,
    });
  });

  it('χωρίς probe → καμία appearance (προ-Φ3 συμπεριφορά, μηδέν παλινδρόμηση)', async () => {
    const { deps, spy } = makeDeps();

    await importEmbeddedMeshMaterials({
      materials: [texturedMaterial], sourceLabel: 'model', resolveKnownId: resolveNothing, deps,
    });

    expect(spy.patched.some((p) => p.patch.appearance)).toBe(false);
  });

  it('επαναχρησιμοποιημένο υλικό → ΔΕΝ πατιέται το appearance που έβαλε ο χρήστης', async () => {
    const { deps, spy } = makeDeps();
    const resolveKnownId: KnownMaterialResolver = (name) =>
      (name === 'Scene_Material3' ? 'bmat_known' : null);

    await importEmbeddedMeshMaterials({
      materials: [texturedMaterial],
      sourceLabel: 'model',
      resolveKnownId,
      deps,
      averageColorOf: async () => '#e8934a',
    });

    expect(spy.patched).toHaveLength(0);
    expect(spy.saved).toHaveLength(0);
  });

  it('αποτυχία του probe → η υφή μένει ανεβασμένη, καμία εξαίρεση προς τα έξω', async () => {
    const { deps } = makeDeps();

    const out = await importEmbeddedMeshMaterials({
      materials: [texturedMaterial],
      sourceLabel: 'model',
      resolveKnownId: resolveNothing,
      deps,
      averageColorOf: async () => { throw new Error('decode boom'); },
    });

    expect(out.createdCount).toBe(1);
    expect(out.idByIndex.get(0)).toBe('bmat_1');
  });
});
