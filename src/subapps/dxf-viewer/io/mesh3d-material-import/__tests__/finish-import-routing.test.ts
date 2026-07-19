/**
 * ADR-678 Φ1.1 — finish routing tests: το C4D υλικό πάνω στο merged σοβά-skin (synthetic id)
 * εφαρμόζεται ομοιόμορφα σε όλα τα μέλη της ζώνης, ανά κάθετη πλευρά, μέσω του ADR-449 command.
 */

import type { LevelsHookReturn } from '../../../systems/levels/useLevels';
import type { ImportedMaterial, ObjectMaterialAssignment } from '../obj-mtl-parse';
import {
  isFinishSkinName,
  finishTargetTypes,
  buildFinishImportCommands,
} from '../finish-import-routing';
import { buildKnownMaterialResolver } from '../known-import-materials';

/** Static-catalog resolver (wall-covering + δάπεδα)· κανένα library υλικό στα finish tests. */
const resolveKnownId = buildKnownMaterialResolver();

jest.mock('../../../systems/entity-creation/LevelSceneManagerAdapter', () => ({
  createLevelSceneManagerAdapter: (_g: unknown, _s: unknown, levelId: string) => ({ levelId }),
}));
jest.mock('../../../core/commands/entity-commands/SetFinishFaceOverrideCommand', () => ({
  SetFinishFaceOverrideCommand: class {
    constructor(
      public readonly entityId: string,
      public readonly faceKey: string,
      public readonly value: unknown,
      public readonly adapter: unknown,
    ) {}
  },
}));

const activeFinish = { enabled: true, thickness: 15, interiorMaterialId: 'mat-plaster-int', exteriorMaterialId: 'mat-plaster-ext' };
const rectFootprint = { footprint: { vertices: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }] } };

jest.mock('../../../bim-3d/scene/extract-bim3d-entities', () => ({
  extractBim3DEntities: () => ({
    columns: [{ id: 'col-1', params: { finish: activeFinish }, geometry: rectFootprint }],
    beams: [{ id: 'beam-1', params: { finish: activeFinish }, geometry: rectFootprint }],
    slabs: [{ id: 'slab-1', params: { finish: { ...activeFinish, enabled: false } }, geometry: rectFootprint }],
  }),
}));

function fakeLevels(): LevelsHookReturn {
  return {
    levels: [{ id: 'lvl-1', name: '' }],
    getLevelScene: () => ({ entities: [] }),
    setLevelScene: () => undefined,
  } as unknown as LevelsHookReturn;
}

const woodMtl: ReadonlyMap<string, ImportedMaterial> = new Map([
  ['road_wood', { name: 'road_wood', colorHex: '#a0522d', opacity: 1 }],
]);

function finishObj(objectName: string, materialName: string | null): ObjectMaterialAssignment {
  return { objectName, materialName };
}

describe('isFinishSkinName', () => {
  it('detects merged finish-skin objects by synthetic id', () => {
    expect(isFinishSkinName('Column_structural-finish-bldg1')).toBe(true);
    expect(isFinishSkinName('Isogeio_Column_structural-finish-hcol-bldg1')).toBe(true);
    expect(isFinishSkinName('Wall_w-42')).toBe(false);
    expect(isFinishSkinName('Column_col-7')).toBe(false);
  });
});

describe('finishTargetTypes', () => {
  it('narrows by horizontal zone, else all types (vertical / top-cap)', () => {
    expect(finishTargetTypes('X_structural-finish-hcol-b1')).toEqual(['column']);
    expect(finishTargetTypes('X_structural-finish-hbeam-b1')).toEqual(['beam']);
    expect(finishTargetTypes('X_structural-finish-hslab-b1')).toEqual(['slab']);
    expect(finishTargetTypes('X_structural-finish-b1')).toEqual(['column', 'beam', 'slab']);
    expect(finishTargetTypes('X_structural-finish-hup-b1')).toEqual(['column', 'beam', 'slab']);
  });
});

describe('buildFinishImportCommands', () => {
  it('paints every side of every active member of the zone (flat C4D colour)', () => {
    const { children, memberCount } = buildFinishImportCommands(
      fakeLevels(),
      [finishObj('Column_structural-finish-hcol-b1', 'road_wood')],
      woodMtl,
      resolveKnownId,
    );
    // hcol → μόνο κολόνες· 1 ενεργή κολόνα × 4 πλευρές = 4 commands.
    expect(memberCount).toBe(1);
    expect(children).toHaveLength(4);
    const c = children as unknown as Array<{ entityId: string; faceKey: string; value: unknown; adapter: unknown }>;
    expect(c.map((x) => x.faceKey)).toEqual(['side:0', 'side:1', 'side:2', 'side:3']);
    expect(c[0]).toMatchObject({ entityId: 'col-1', value: { colorOverride: '#a0522d' }, adapter: { levelId: 'lvl-1' } });
  });

  it('vertical silhouette hits every active type (column + beam), skips disabled finish (slab)', () => {
    const { children, memberCount } = buildFinishImportCommands(
      fakeLevels(),
      [finishObj('Column_structural-finish-b1', 'road_wood')],
      woodMtl,
      resolveKnownId,
    );
    // col-1 (4) + beam-1 (4) = 8· slab-1 έχει enabled:false → παραλείπεται.
    expect(memberCount).toBe(2);
    expect(children).toHaveLength(8);
  });

  it('maps a catalog material to { materialId + colorOverride } (BOQ + visible σοβάς)', () => {
    const { children } = buildFinishImportCommands(
      fakeLevels(),
      [finishObj('Column_structural-finish-hcol-b1', 'paint-red')],
      woodMtl,
      resolveKnownId,
    );
    const c = children as unknown as Array<{ value: unknown }>;
    // materialId → BOQ· colorOverride → ΟΡΑΤΟ χρώμα (ενοποιημένος material-color-registry).
    expect(c[0].value).toEqual({ materialId: 'paint-red', colorOverride: '#C0392B' });
  });

  it('no-ops when the finish material is unchanged Nestor DNA (ΡΙΖΑ 2)', () => {
    const { children, memberCount } = buildFinishImportCommands(
      fakeLevels(),
      [finishObj('Column_structural-finish-b1', 'mat-plaster-ext')],
      woodMtl,
      resolveKnownId,
    );
    expect(memberCount).toBe(0);
    expect(children).toHaveLength(0);
  });

  it('resolves a floor-finish catalog colour for the σοβάς (ADR-679 Φ2a — όχι μόνο wall-covering)', () => {
    const { children } = buildFinishImportCommands(
      fakeLevels(),
      [finishObj('Column_structural-finish-hcol-b1', 'floor-wood-oak')],
      woodMtl,
      resolveKnownId,
    );
    const c = children as unknown as Array<{ value: unknown }>;
    // floor-wood-oak → materialId (BOQ) + το hex του καταλόγου δαπέδου (ορατός σοβάς).
    expect(c[0].value).toEqual({ materialId: 'floor-wood-oak', colorOverride: '#C8A97E' });
  });

  it('no-ops when there are no finish-skin objects', () => {
    const { children, memberCount } = buildFinishImportCommands(fakeLevels(), [], woodMtl, resolveKnownId);
    expect(memberCount).toBe(0);
    expect(children).toHaveLength(0);
  });
});
