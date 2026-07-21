/**
 * ADR-678 Φ4 — COLLADA wrapper wiring test. Επιβεβαιώνει ότι το `.dae` parsing τροφοδοτεί τον κοινό
 * πυρήνα με `charset: 'unicode'` και ότι το per-face `faceMaterials` φτάνει ως SetFaceAppearanceCommand.
 * Ο pure parser + ο core τεστάρονται χωριστά· εδώ μόνο η σύνδεση wrapper→core.
 */

import * as THREE from 'three';
import type { LevelsHookReturn } from '../../../systems/levels/useLevels';
import {
  serialiseCollada,
  type ColladaExportOptions,
} from '../../../export/core/mesh3d/mesh3d-collada-writer';
import type { ExportMaterialEntry } from '../../../export/core/mesh3d/mesh3d-materials';
import { importColladaAppearance } from '../import-collada-appearance';
import { buildKnownMaterialResolver } from '../known-import-materials';

const CM: ColladaExportOptions = { unit: 'centimeters', createdIso: '2026-07-21T00:00:00.000Z' };
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
// ADR-678 Εύρημα A — «όλο το στοιχείο» = replace map `{ '*': … }` (καθαρίζει stale per-face).
jest.mock('../../../core/commands/entity-commands/SetEntityFaceAppearanceMapCommand', () => ({
  SetEntityFaceAppearanceMapCommand: class {
    constructor(
      public readonly entityId: string,
      public readonly value: unknown,
      public readonly adapter: unknown,
    ) {}
  },
}));
jest.mock('../../../systems/entity-creation/LevelSceneManagerAdapter', () => ({
  createLevelSceneManagerAdapter: (_g: unknown, _s: unknown, levelId: string) => ({ levelId }),
}));
jest.mock('../../../bim-3d/scene/extract-bim3d-entities', () => ({
  extractBim3DEntities: () => ({ columns: [{ id: 'col-7', type: 'column' }] }),
}));

function entry(name: string, hex: number): ExportMaterialEntry {
  return { name, color: new THREE.Color(hex), opacity: 1, transparent: false };
}

function named(name: string, color = 0x808080): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ color });
  m.name = name;
  return m;
}

function makeTriangleGeometry(triCount: number): THREE.BufferGeometry {
  const positions = new Float32Array(triCount * 9);
  for (let i = 0; i < positions.length; i += 1) positions[i] = (i % 7) * 0.5 - 1.5;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

function rootWith(mesh: THREE.Mesh): THREE.Group {
  const root = new THREE.Group();
  root.add(mesh);
  return root;
}

function fakeLevels(): LevelsHookReturn {
  return {
    levels: [{ id: 'lvl-1', name: '' }],
    getLevelScene: () => ({ entities: [] }),
    setLevelScene: () => undefined,
  } as unknown as LevelsHookReturn;
}

describe('importColladaAppearance', () => {
  beforeEach(() => { mockCapture.executed = null; });

  it('single-material: parse → match → known material → whole-element replace map', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), named('paint-red'));
    mesh.name = 'Column_col-7';
    const dae = serialiseCollada(rootWith(mesh), [entry('paint-red', 0xc0392b)], CM);

    const result = importColladaAppearance(fakeLevels(), dae, resolveKnownId);

    expect(result.matchedCount).toBe(1);
    expect(result.appliedCount).toBe(1);
    expect(mockCapture.executed).toMatchObject({
      entityId: 'col-7', value: { '*': { materialId: 'paint-red' } },
    });
  });

  it('per-face uniform: faceMaterials φτάνει και collapse-άρει σε ΕΝΑ whole-element replace map', () => {
    const geo = makeTriangleGeometry(4);
    geo.clearGroups();
    geo.addGroup(0, 6, 0);
    geo.addGroup(6, 6, 1);
    const mesh = new THREE.Mesh(geo, [named('paint-red'), named('paint-red')]);
    mesh.name = 'Column_col-7';
    mesh.userData['faceKeyByMaterialIndex'] = ['top', 'bottom'];
    const dae = serialiseCollada(rootWith(mesh), [entry('paint-red', 0xc0392b)], CM);

    const result = importColladaAppearance(fakeLevels(), dae, resolveKnownId);

    expect(result.appliedCount).toBe(1);
    expect(mockCapture.executed).toMatchObject({
      entityId: 'col-7', value: { '*': { materialId: 'paint-red' } },
    });
  });

  it('no match → καμία παρενέργεια', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), named('paint-red'));
    mesh.name = 'Column_nope';
    const dae = serialiseCollada(rootWith(mesh), [entry('paint-red', 0xc0392b)], CM);

    const result = importColladaAppearance(fakeLevels(), dae, resolveKnownId);

    expect(result.appliedCount).toBe(0);
    expect(mockCapture.executed).toBeNull();
  });
});
