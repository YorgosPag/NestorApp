/**
 * ADR-678 Φ1 — orchestrator wiring test. Τεστάρει enumerate → match → resolve → group-by-level,
 * με mocked command layer (κανένα EventBus/persistence). Ο pure core τεστάρεται χωριστά.
 */

import type { LevelsHookReturn } from '../../../systems/levels/useLevels';
import { importC4dMaterials, applyImportedAppearance } from '../import-c4d-materials';
import { buildKnownMaterialResolver } from '../known-import-materials';
import type { ImportedMaterial } from '../obj-mtl-parse';

/** Static-catalog resolver (wall-covering paint-red κ.λπ.)· κανένα library υλικό εδώ. */
const resolveKnownId = buildKnownMaterialResolver();

const mockCapture = { executed: null as unknown };

jest.mock('../../../core/commands', () => ({
  getGlobalCommandHistory: () => ({ execute: (c: unknown) => { mockCapture.executed = c; } }),
}));
jest.mock('../../../core/commands/CompositeCommand', () => ({
  CompositeCommand: class { constructor(public readonly children: unknown[]) {} },
}));
jest.mock('../../../core/commands/entity-commands/SetFaceAppearanceCommand', () => ({
  SetFaceAppearanceCommand: class {
    constructor(
      public readonly entityId: string,
      public readonly faceKey: string,
      public readonly value: unknown,
      public readonly adapter: unknown,
    ) {}
  },
}));
jest.mock('../../../systems/entity-creation/LevelSceneManagerAdapter', () => ({
  createLevelSceneManagerAdapter: (_g: unknown, _s: unknown, levelId: string) => ({ levelId }),
}));
jest.mock('../../../bim-3d/scene/extract-bim3d-entities', () => ({
  extractBim3DEntities: () => ({
    walls: [{ id: 'w-42', type: 'wall' }],
    columns: [{ id: 'col-7', type: 'column' }],
  }),
}));

const MTL = `newmtl paint-red
Kd 0.752941 0.223529 0.168627
newmtl mat_myblue
Kd 0.100000 0.200000 0.300000
`;
const OBJ = `o Wall_w-42
usemtl paint-red
f 1 2 3
o Column_col-7
usemtl mat_myblue
f 4 5 6
o Cube_extra
usemtl mat_myblue
f 7 8 9
`;

function fakeLevels(): LevelsHookReturn {
  return {
    levels: [{ id: 'lvl-1', name: '' }],
    getLevelScene: () => ({ entities: [] }),
    setLevelScene: () => undefined,
  } as unknown as LevelsHookReturn;
}

describe('importC4dMaterials (orchestrator)', () => {
  beforeEach(() => { mockCapture.executed = null; });

  it('matches, resolves and applies per entity as a base override', () => {
    const result = importC4dMaterials(fakeLevels(), { objText: OBJ, mtlText: MTL }, resolveKnownId);

    expect(result.objectCount).toBe(3);
    expect(result.matchedCount).toBe(2);
    expect(result.appliedCount).toBe(2);
    expect(result.unmatched).toEqual(['Cube_extra']);

    const children = (mockCapture.executed as { children: Array<Record<string, unknown>> }).children;
    expect(children).toHaveLength(2);
    expect(children[0]).toMatchObject({
      entityId: 'w-42', faceKey: '*', value: { materialId: 'paint-red' }, adapter: { levelId: 'lvl-1' },
    });
    expect(children[1]).toMatchObject({
      entityId: 'col-7', faceKey: '*', value: { colorHex: '#1a334d' }, adapter: { levelId: 'lvl-1' },
    });
  });

  it('does nothing when no object matches', () => {
    const result = importC4dMaterials(fakeLevels(), {
      objText: 'o Nope_x\nusemtl paint-red\nf 1 2 3\n', mtlText: MTL,
    }, resolveKnownId);
    expect(result.appliedCount).toBe(0);
    expect(mockCapture.executed).toBeNull();
  });

  it('ADR-683 Break C — the manifest baseline reaches the body paint path (glTF)', () => {
    // ο συνεργάτης ξαναέβαψε το DNA υλικό του τοίχου, κρατώντας το όνομα — χωρίς baseline θα ήταν no-op.
    const materials: ReadonlyMap<string, ImportedMaterial> = new Map([
      ['mat-concrete-c25', { name: 'mat-concrete-c25', colorHex: '#cc2200', opacity: 1 }],
    ]);
    const result = applyImportedAppearance(
      fakeLevels(),
      {
        objects: [{ objectName: 'Wall_w-42', materialName: 'mat-concrete-c25' }],
        materials,
        charset: 'unicode',
        baseline: new Map([['mat-concrete-c25', '#808080']]),
      },
      resolveKnownId,
    );

    expect(result.appliedCount).toBe(1);
    expect(mockCapture.executed).toMatchObject({
      entityId: 'w-42', faceKey: '*', value: { colorHex: '#cc2200' },
    });
  });
});

/**
 * ADR-678 Φ3 — per-face materials (μόνο glTF μονοπάτι, `faceMaterials` στο `ObjectMaterialAssignment`).
 * `buildBodyFaceCommands` λύνει κάθε όψη ξεχωριστά με τον ίδιο pure `resolveImportAppearance`.
 */
describe('applyImportedAppearance — per-face materials (ADR-678 Φ3)', () => {
  beforeEach(() => { mockCapture.executed = null; });

  const mtlWithBlue = new Map<string, ImportedMaterial>([
    ['mat_myblue', { name: 'mat_myblue', colorHex: '#1a334d', opacity: 1 }],
  ]);

  it('emits ONE SetFaceAppearanceCommand per differently-painted face (non-uniform)', () => {
    const result = applyImportedAppearance(
      fakeLevels(),
      {
        objects: [{
          objectName: 'Wall_w-42',
          materialName: null,
          faceMaterials: new Map<string, string | null>([
            ['top', 'paint-red'],          // γνωστό catalog υλικό
            ['bottom', 'mat_myblue'],      // Kd χρώμα από το .mtl
            ['side', 'mat-concrete-c25'],  // αμετάβλητο DNA — καμία αλλαγή, κανένα command
          ]),
        }],
        materials: mtlWithBlue,
        charset: 'unicode',
      },
      resolveKnownId,
    );

    expect(result.matchedCount).toBe(1);
    expect(result.appliedCount).toBe(1);

    const children = (mockCapture.executed as { children: Array<Record<string, unknown>> }).children;
    expect(children).toHaveLength(2); // 'side' έμεινε αμετάβλητο — δεν παράγει command
    expect(children).toContainEqual(
      expect.objectContaining({ entityId: 'w-42', faceKey: 'top', value: { materialId: 'paint-red' } }),
    );
    expect(children).toContainEqual(
      expect.objectContaining({ entityId: 'w-42', faceKey: 'bottom', value: { colorHex: '#1a334d' } }),
    );
  });

  it('collapses per-face materials into ONE base "*" command when ALL faces got the same appearance', () => {
    const result = applyImportedAppearance(
      fakeLevels(),
      {
        objects: [{
          objectName: 'Wall_w-42',
          materialName: null,
          faceMaterials: new Map<string, string | null>([
            ['top', 'mat_myblue'],
            ['bottom', 'mat_myblue'],
            ['side', 'mat_myblue'],
          ]),
        }],
        materials: mtlWithBlue,
        charset: 'unicode',
      },
      resolveKnownId,
    );

    expect(result.appliedCount).toBe(1);
    // ΕΝΑ command (όχι CompositeCommand) — idempotent, ίδιο undo-shape με το ανά-στοιχείο βάψιμο
    expect(mockCapture.executed).toMatchObject({
      entityId: 'w-42', faceKey: '*', value: { colorHex: '#1a334d' },
    });
  });

  it('applies nothing when every face is an unchanged Nestor DNA material (no baseline repaint)', () => {
    const result = applyImportedAppearance(
      fakeLevels(),
      {
        objects: [{
          objectName: 'Wall_w-42',
          materialName: null,
          faceMaterials: new Map<string, string | null>([
            ['top', 'mat-concrete-c25'],
            ['bottom', 'mat-concrete-c25'],
          ]),
        }],
        materials: new Map(),
        charset: 'unicode',
      },
      resolveKnownId,
    );

    expect(result.matchedCount).toBe(1);
    expect(result.appliedCount).toBe(0);
    expect(mockCapture.executed).toBeNull();
  });

  it('back-compat: objects without faceMaterials still use the whole-element "*" path', () => {
    const result = applyImportedAppearance(
      fakeLevels(),
      {
        objects: [{ objectName: 'Wall_w-42', materialName: 'mat_myblue' }],
        materials: mtlWithBlue,
        charset: 'unicode',
      },
      resolveKnownId,
    );

    expect(result.appliedCount).toBe(1);
    expect(mockCapture.executed).toMatchObject({
      entityId: 'w-42', faceKey: '*', value: { colorHex: '#1a334d' },
    });
  });
});
