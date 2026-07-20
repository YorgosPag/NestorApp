/**
 * ADR-683 Φ2-UI — **ολόκληρη η αλυσίδα glTF χωρίς τον loader**: σκηνή three (όπως θα την έδινε ο
 * `GLTFLoader`) → `collectGltfObjects` + `collectGltfMaterials` → ο κοινός πυρήνας
 * `applyImportedAppearance` → commands.
 *
 * Ο λόγος που δοκιμάζεται έτσι και όχι μέσω `importGltfAppearance`: το μόνο που προσθέτει ο
 * wrapper είναι το `parseGltfScene` (δηλαδή ο `GLTFLoader`, τρίτου μέρους) και το `charset`. Το
 * δεύτερο είναι ακριβώς αυτό που δοκιμάζεται εδώ ρητά — και είναι το πιο ύπουλο σημείο αστοχίας
 * όλου του μονοπατιού (λάθος charset ⇒ μηδέν ταιριάσματα, σιωπηλά).
 */

import * as THREE from 'three';
import type { LevelsHookReturn } from '../../../systems/levels/useLevels';
import { collectGltfObjects, collectGltfMaterials } from '../gltf-scene-parse';
import { applyImportedAppearance } from '../../mesh3d-material-import/import-c4d-materials';
import { buildKnownMaterialResolver } from '../../mesh3d-material-import/known-import-materials';

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

/** Ένα mesh όπως θα το γύριζε ο συνεργάτης: όνομα ταυτότητας + βαμμένο υλικό. */
function paintedMesh(name: string, materialName: string, hex: number): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({ color: hex });
  material.name = materialName;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  mesh.name = name;
  return mesh;
}

/** Επιστρεφόμενη σκηνή με **ελληνικό** όνομα ορόφου — το glTF το επιτρέπει (UTF-8). */
function returnedScene(): THREE.Group {
  const root = new THREE.Group();
  root.add(paintedMesh('Ισόγειο_Wall_w-42', 'paint-red', 0xc0392b));
  root.add(paintedMesh('Ισόγειο_Column_col-7', 'MyCustomBlue', 0x1a334d));
  root.add(paintedMesh('Rail_01', 'Aluminium', 0xaaaaaa));
  return root;
}

function fakeLevels(): LevelsHookReturn {
  return {
    levels: [{ id: 'lvl-1', name: 'Ισόγειο' }],
    getLevelScene: () => ({ entities: [] }),
    setLevelScene: () => undefined,
  } as unknown as LevelsHookReturn;
}

function importScene(root: THREE.Object3D, charset: 'unicode' | 'latin') {
  return applyImportedAppearance(
    fakeLevels(),
    { objects: collectGltfObjects(root), materials: collectGltfMaterials(root), charset },
    resolveKnownId,
  );
}

describe('glTF appearance import (ADR-683 Φ2-UI)', () => {
  beforeEach(() => { mockCapture.executed = null; });

  it('βάφει τα ίδια BIM στοιχεία μέσω του ΚΟΙΝΟΥ πυρήνα — μηδέν δεύτερο μονοπάτι ανά format', () => {
    const result = importScene(returnedScene(), 'unicode');

    expect(result.objectCount).toBe(3);
    expect(result.matchedCount).toBe(2);
    expect(result.appliedCount).toBe(2);
    expect(result.unmatched).toEqual(['Rail_01']);

    const children = (mockCapture.executed as { children: Array<Record<string, unknown>> }).children;
    // Γνωστό υλικό καταλόγου → materialId (χρώμα κεντρικά)· ξένο C4D υλικό → flat χρώμα.
    expect(children[0]).toMatchObject({
      entityId: 'w-42', faceKey: '*', value: { materialId: 'paint-red' }, adapter: { levelId: 'lvl-1' },
    });
    expect(children[1]).toMatchObject({
      entityId: 'col-7', faceKey: '*', value: { colorHex: '#1a334d' }, adapter: { levelId: 'lvl-1' },
    });
  });

  it('το χρώμα έρχεται από το ΑΡΧΕΙΟ, όχι από hex μέσα στο όνομα (δεν υπάρχει .mtl στο glTF)', () => {
    // Το `MyCustomBlue` δεν είναι ούτε γνωστό υλικό ούτε hex-όνομα. Αν δεν συλλέγαμε τα υλικά
    // του glTF, το `resolveImportAppearance` θα γύριζε null και το χρώμα θα χανόταν σιωπηλά.
    importScene(returnedScene(), 'unicode');

    const children = (mockCapture.executed as { children: Array<Record<string, unknown>> }).children;
    expect(children[1].value).toEqual({ colorHex: '#1a334d' });
  });

  it('ΑΠΑΙΤΕΙ charset unicode — με latin (OBJ) κανένα ελληνικό όνομα ορόφου δεν ταιριάζει', () => {
    // `Ισόγειο_Wall_w-42` vs το latin που θα παρήγαγε το export: `Isogeio_Wall_w-42`.
    const result = importScene(returnedScene(), 'latin');

    expect(result.matchedCount).toBe(0);
    expect(mockCapture.executed).toBeNull();
  });

  it('αμετάβλητο DNA του Νέστορα → no-op (ΡΙΖΑ 2 ADR-678), ίδια συμπεριφορά με το OBJ', () => {
    const root = new THREE.Group();
    root.add(paintedMesh('Ισόγειο_Wall_w-42', 'mat-concrete-c25', 0x808080));

    const result = importScene(root, 'unicode');

    expect(result.matchedCount).toBe(1);
    expect(result.appliedCount).toBe(0);
    expect(mockCapture.executed).toBeNull();
  });
});
