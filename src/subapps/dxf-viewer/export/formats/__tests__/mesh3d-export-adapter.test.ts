/**
 * ADR-668 — 3Δ mesh export adapter (OBJ + glTF).
 *
 * Γιατί ΑΥΤΑ τα tests: κάθε ένα καρφώνει μια ρίζα ενός πραγματικού bug που ανέφερε ο Giorgio
 * («στο C4D το βλέπω σαν μία ενιαία οντότητα» / «η κλίμακα δεν είναι σωστή») ή μια απόφαση που
 * το format ΔΕΝ μπορεί να επιβάλει μόνο του (μονάδα, υλικά, κρυμμένα).
 *
 * Headless: ο `BimSceneLayer` θέλει μόνο `new THREE.Scene()` — μηδέν renderer/DOM/WebGL (ίδιο
 * μοτίβο με τα υπάρχοντα `BimSceneLayer-*.test.ts`). Το `buildMesh3dScene` mock-άρεται εδώ:
 * ο στόχος είναι το συμβόλαιο του adapter (ονόματα/κλίμακα/υλικά/artifacts), όχι η BIM
 * γεωμετρία — αυτή έχει τα δικά της suites.
 */

import * as THREE from 'three';

jest.mock('../../core/mesh3d/build-mesh3d-scene', () => ({
  buildMesh3dScene: jest.fn(),
}));

import { buildMesh3dScene } from '../../core/mesh3d/build-mesh3d-scene';
import { exportFloorsToMesh3d } from '../mesh3d-export-adapter';
import type { ResolvedExportFloor } from '../../core/export-floor-scope';
import type { ExportDeps } from '../../types';
import type { Level } from '../../../systems/levels/config';

const mockedBuild = buildMesh3dScene as jest.MockedFunction<typeof buildMesh3dScene>;

const DEPS: ExportDeps = {
  levelScenes: [],
  activeLevelId: 'lvl-1',
  projectName: 'Katoikia',
  dateStr: '2026-07-17',
};

function makeFloor(id: string, name: string): ResolvedExportFloor {
  return {
    level: { id, name, order: 0 } as Level,
    scene: { entities: [] } as unknown as ResolvedExportFloor['scene'],
    layerPrefix: '',
  };
}

/** A mesh carrying the same `userData` identity the real BIM converters stamp. */
function makeMesh(userData: Record<string, string>): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xff0000 }),
  );
  mesh.userData = userData;
  return mesh;
}

function mockScene(meshes: THREE.Mesh[], hiddenEntityIds: string[] = []): THREE.Object3D {
  const root = new THREE.Group();
  for (const m of meshes) root.add(m);
  mockedBuild.mockReturnValue({
    root,
    meshCount: meshes.length,
    hiddenEntityIds: new Set(hiddenEntityIds),
    warnings: [],
  });
  return root;
}

const OBJ_OPTS = {
  format: 'obj', baseName: 'Katoikia', unit: 'centimeters', filenamePart: '',
  prefixMeshesWithFloor: false,
} as const;

/** jsdom's Blob has no `.text()` — fall back to FileReader rather than stringifying it. */
async function readText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

beforeEach(() => jest.clearAllMocks());

// ── Το bug «μία ενιαία οντότητα» ────────────────────────────────────────────

describe('mesh naming', () => {
  it('names every mesh — the OBJExporter writes `o <name>`, and BIM converters set none', async () => {
    mockScene([
      makeMesh({ bimType: 'wall', bimId: 'w-42' }),
      makeMesh({ bimType: 'column', bimId: 'c-7' }),
    ]);
    const out = await exportFloorsToMesh3d([makeFloor('lvl-1', 'Ισόγειο')], DEPS, OBJ_OPTS);
    const obj = await readText(out.artifacts[0].blob);

    expect(obj).toContain('o Wall_w-42');
    expect(obj).toContain('o Column_c-7');
  });

  it('disambiguates duplicate names — a wall with openings splits into several meshes', async () => {
    mockScene([
      makeMesh({ bimType: 'wall', bimId: 'w-42' }),
      makeMesh({ bimType: 'wall', bimId: 'w-42' }),
    ]);
    const out = await exportFloorsToMesh3d([makeFloor('lvl-1', 'Ισόγειο')], DEPS, OBJ_OPTS);
    const obj = await readText(out.artifacts[0].blob);

    expect(obj).toContain('o Wall_w-42\n');
    expect(obj).toContain('o Wall_w-42_2');
  });

  it('prefixes each mesh with ITS OWN storey when floors share one file (all-single)', async () => {
    mockScene([
      makeMesh({ bimType: 'wall', bimId: 'w-1', levelId: 'lvl-1' }),
      makeMesh({ bimType: 'wall', bimId: 'w-2', levelId: 'lvl-2' }),
    ]);
    const out = await exportFloorsToMesh3d(
      [makeFloor('lvl-1', 'Ισόγειο'), makeFloor('lvl-2', 'Α Όροφος')],
      DEPS,
      { ...OBJ_OPTS, prefixMeshesWithFloor: true },
    );
    const obj = await readText(out.artifacts[0].blob);

    expect(obj).toContain('o Isogeio_Wall_w-1');
    expect(obj).toContain('o A_Orofos_Wall_w-2');
  });
});

// ── Ελληνικά ανά format (απόφαση Giorgio 2026-07-17) ────────────────────────

describe('name charset per format', () => {
  it('transliterates Greek storey names for OBJ — C4D R15 reads bytes as latin-1', async () => {
    mockScene([makeMesh({ bimType: 'wall', bimId: 'w-1', levelId: 'lvl-1' })]);
    const out = await exportFloorsToMesh3d([makeFloor('lvl-1', 'Υπόγειο')], DEPS, {
      ...OBJ_OPTS, prefixMeshesWithFloor: true,
    });
    const obj = await readText(out.artifacts[0].blob);

    expect(obj).toContain('o Ypogeio_Wall_w-1');
    expect(obj).not.toContain('Υπόγειο');
  });

  it('keeps Greek storey names for glTF — the spec mandates UTF-8', async () => {
    const root = mockScene([makeMesh({ bimType: 'wall', bimId: 'w-1', levelId: 'lvl-1' })]);
    await exportFloorsToMesh3d([makeFloor('lvl-1', 'Υπόγειο')], DEPS, {
      format: 'gltf', baseName: 'Katoikia', unit: 'meters', filenamePart: '',
      prefixMeshesWithFloor: true,
    });

    expect(root.children[0].name).toBe('Υπόγειο_Wall_w-1');
  });
});

// ── Το bug «η κλίμακα δεν είναι σωστή» ──────────────────────────────────────

describe('export unit', () => {
  it('scales OBJ metres → centimetres, so C4D opens it at Scale 1 (not 100× small)', async () => {
    const root = mockScene([makeMesh({ bimType: 'wall', bimId: 'w-1' })]);
    await exportFloorsToMesh3d([makeFloor('lvl-1', 'Ισόγειο')], DEPS, OBJ_OPTS);

    expect(root.scale.x).toBe(100);
  });

  it('leaves glTF untouched — spec-locked to metres', async () => {
    const root = mockScene([makeMesh({ bimType: 'wall', bimId: 'w-1' })]);
    await exportFloorsToMesh3d([makeFloor('lvl-1', 'Ισόγειο')], DEPS, {
      format: 'gltf', baseName: 'Katoikia', unit: 'centimeters', filenamePart: '',
      prefixMeshesWithFloor: false,
    });

    expect(root.scale.x).toBe(1);
  });
});

// ── Υλικά: ο three δεν γράφει ΠΟΤΕ .mtl ─────────────────────────────────────

describe('materials (.mtl)', () => {
  it('emits an .obj + .mtl pair, with the .obj referencing the .mtl by name', async () => {
    mockScene([makeMesh({ bimType: 'wall', bimId: 'w-1', matId: 'mat-concrete-c25' })]);
    const out = await exportFloorsToMesh3d([makeFloor('lvl-1', 'Ισόγειο')], DEPS, OBJ_OPTS);

    expect(out.artifacts.map((a) => a.filename)).toEqual(['Katoikia.obj', 'Katoikia.mtl']);
    const obj = await readText(out.artifacts[0].blob);
    expect(obj.startsWith('mtllib Katoikia.mtl')).toBe(true);
  });

  it('writes one `newmtl` per material id', async () => {
    mockScene([
      makeMesh({ bimType: 'wall', bimId: 'w-1', matId: 'mat-concrete-c25' }),
      makeMesh({ bimType: 'wall', bimId: 'w-2', matId: 'mat-concrete-c25' }),
      makeMesh({ bimType: 'column', bimId: 'c-1', matId: 'mat-steel' }),
    ]);
    const out = await exportFloorsToMesh3d([makeFloor('lvl-1', 'Ισόγειο')], DEPS, OBJ_OPTS);
    const mtl = await readText(out.artifacts[1].blob);

    expect(mtl).toContain('newmtl mat-concrete-c25');
    expect(mtl).toContain('newmtl mat-steel');
    expect(mtl.match(/newmtl /g)).toHaveLength(2);
  });

  it('glTF carries its materials natively — no .mtl sidecar', async () => {
    mockScene([makeMesh({ bimType: 'wall', bimId: 'w-1', matId: 'mat-steel' })]);
    const out = await exportFloorsToMesh3d([makeFloor('lvl-1', 'Ισόγειο')], DEPS, {
      format: 'gltf', baseName: 'Katoikia', unit: 'meters', filenamePart: '',
      prefixMeshesWithFloor: false,
    });

    expect(out.artifacts).toHaveLength(1);
    expect(out.artifacts[0].filename).toBe('Katoikia.glb');
  });
});

// ── Κρυμμένα: εξάγονται ΟΛΑ, σημαδεμένα (απόφαση Giorgio 2026-07-17) ────────

describe('hidden entities', () => {
  it('marks view-hidden meshes by name so the user can re-hide them in C4D', async () => {
    mockScene(
      [
        makeMesh({ bimType: 'wall', bimId: 'w-1' }),
        makeMesh({ bimType: 'joint-reinforcement', bimId: 'r-9' }),
      ],
      ['r-9'],
    );
    const out = await exportFloorsToMesh3d([makeFloor('lvl-1', 'Ισόγειο')], DEPS, OBJ_OPTS);
    const obj = await readText(out.artifacts[0].blob);

    expect(obj).toContain('o HIDDEN_JointReinforcement_r-9');
    expect(obj).toContain('o Wall_w-1');
  });

  it('gives hidden meshes their own fully transparent material, keeping their real colour', async () => {
    mockScene([makeMesh({ bimType: 'wall', bimId: 'w-1', matId: 'mat-steel' })], ['w-1']);
    const out = await exportFloorsToMesh3d([makeFloor('lvl-1', 'Ισόγειο')], DEPS, OBJ_OPTS);
    const mtl = await readText(out.artifacts[1].blob);

    expect(mtl).toContain('newmtl HIDDEN_mat-steel');
    expect(mtl).toContain('d 0.000000');
    // Kd survives → raising `d` in C4D brings it back correctly coloured.
    expect(mtl).toContain('Kd 1.000000 0.000000 0.000000');
  });

  it('marks hidden meshes in glTF too — by name only (no visibility flag exists)', async () => {
    const root = mockScene([makeMesh({ bimType: 'wall', bimId: 'w-1' })], ['w-1']);
    await exportFloorsToMesh3d([makeFloor('lvl-1', 'Ισόγειο')], DEPS, {
      format: 'gltf', baseName: 'Katoikia', unit: 'meters', filenamePart: '',
      prefixMeshesWithFloor: false,
    });

    expect(root.children[0].name).toBe('HIDDEN_Wall_w-1');
  });
});

// ── Άδειο μοντέλο ───────────────────────────────────────────────────────────

describe('empty model', () => {
  it('produces no artifacts (never an empty file) and forwards the warning', async () => {
    mockedBuild.mockReturnValue({
      root: new THREE.Group(),
      meshCount: 0,
      hiddenEntityIds: new Set(),
      warnings: ['Δεν βρέθηκε καμία 3Δ οντότητα στους επιλεγμένους ορόφους.'],
    });
    const out = await exportFloorsToMesh3d([makeFloor('lvl-1', 'Ισόγειο')], DEPS, OBJ_OPTS);

    expect(out.artifacts).toHaveLength(0);
    expect(out.warnings).toHaveLength(1);
  });
});
