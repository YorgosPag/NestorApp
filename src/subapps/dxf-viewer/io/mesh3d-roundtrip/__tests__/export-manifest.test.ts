/**
 * ADR-683 §7 — sidecar manifest (`.nestor.json`).
 *
 * Το manifest είναι το ΜΟΝΟ κανάλι που κουβαλά «πώς ήταν η γεωμετρία όταν έφυγε». Αν σπάσει ο
 * κύκλος γράψε→διάβασε, ο reconciler χάνει τη διάκριση A/C **σιωπηλά** — γι' αυτό τα tests
 * κλειδώνουν και τις δύο κατευθύνσεις, καθώς και το fail-closed σε άγνωστο σχήμα.
 */

import * as THREE from 'three';
import {
  buildExportManifest,
  serialiseManifest,
  parseExportManifest,
  indexManifestByMeshName,
  indexManifestMaterials,
  manifestFingerprint,
  NESTOR_MANIFEST_SCHEMA,
} from '../export-manifest';
import { compareGeometry, computeGeometryFingerprint } from '../geometry-hash';

const OPTIONS = {
  exportedAt: '2026-07-20T10:43:50.000Z',
  projectName: 'Katoikia',
  buildingId: 'bld-1',
  unit: 'centimeters',
} as const;

function namedMesh(name: string, userData: Record<string, string>): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 3, 1), new THREE.MeshStandardMaterial());
  mesh.name = name;
  mesh.userData = userData;
  return mesh;
}

function sceneWithWall(): THREE.Group {
  const root = new THREE.Group();
  root.add(namedMesh('Isogeio_Wall_w-42', { bimId: 'w-42', bimType: 'wall', levelId: 'lvl-1' }));
  return root;
}

describe('buildExportManifest', () => {
  it('carries the identity SSoT — bimId/bimType/levelId από το userData, όχι reverse-parse ονόματος', () => {
    const [entity] = buildExportManifest(sceneWithWall(), OPTIONS).entities;

    expect(entity.meshName).toBe('Isogeio_Wall_w-42');
    expect(entity.bimId).toBe('w-42');
    expect(entity.bimType).toBe('wall');
    expect(entity.levelId).toBe('lvl-1');
  });

  it('records a geometry fingerprint per mesh — χωρίς αυτό δεν υπάρχει διάκριση A/C', () => {
    const [entity] = buildExportManifest(sceneWithWall(), OPTIONS).entities;

    expect(entity.geometryHash).not.toBeNull();
    expect(entity.geometry?.sizeM[1]).toBeCloseTo(3, 6);
  });

  it('stamps the schema + the FILE unit (τα fingerprints μένουν πάντα σε μέτρα)', () => {
    const manifest = buildExportManifest(sceneWithWall(), OPTIONS);

    expect(manifest.schema).toBe(NESTOR_MANIFEST_SCHEMA);
    expect(manifest.unit).toBe('centimeters');
    expect(manifest.buildingId).toBe('bld-1');
    expect(manifest.exportedAt).toBe(OPTIONS.exportedAt);
  });

  it('lists EVERY exported mesh — το πλήρες σύνολο είναι που δίνει την κατάσταση E (MISSING)', () => {
    const root = sceneWithWall();
    root.add(namedMesh('Isogeio_Column_c-7', { bimId: 'c-7', bimType: 'column' }));

    expect(buildExportManifest(root, OPTIONS).entities.map((e) => e.bimId)).toEqual(['w-42', 'c-7']);
  });
});

describe('serialise → parse round-trip', () => {
  it('survives the trip to disk and back, fingerprint included', () => {
    const original = buildExportManifest(sceneWithWall(), OPTIONS);
    const parsed = parseExportManifest(serialiseManifest(original));

    expect(parsed).not.toBeNull();
    expect(parsed?.entities[0]).toEqual(original.entities[0]);
  });

  it('the returned fingerprint compares `identical` against the live mesh — ο πυρήνας της κατάστασης A', () => {
    const parsed = parseExportManifest(serialiseManifest(buildExportManifest(sceneWithWall(), OPTIONS)));
    const live = computeGeometryFingerprint(sceneWithWall().children[0] as THREE.Mesh);

    expect(compareGeometry(manifestFingerprint(parsed!.entities[0]), live)).toBe('identical');
  });

  it('fails closed on a foreign/corrupt file — ποτέ reconcile σε μισοδιαβασμένα δεδομένα', () => {
    expect(parseExportManifest('not json at all')).toBeNull();
    expect(parseExportManifest('{"schema":"something-else/9","entities":[]}')).toBeNull();
    expect(parseExportManifest('{"schema":"nestor-export/1"}')).toBeNull();
  });

  it('drops malformed entities instead of poisoning the whole manifest', () => {
    const text = JSON.stringify({
      schema: NESTOR_MANIFEST_SCHEMA,
      entities: [{ meshName: 'Wall_w-1' }, { bimId: 'no-mesh-name' }],
    });

    expect(parseExportManifest(text)?.entities.map((e) => e.meshName)).toEqual(['Wall_w-1']);
  });
});

describe('indexManifestByMeshName', () => {
  it('keys on the SAME name the returned file reports — άμεσο join, μηδέν δεύτερη σημασιολογία', () => {
    const index = indexManifestByMeshName(buildExportManifest(sceneWithWall(), OPTIONS));

    expect(index.get('Isogeio_Wall_w-42')?.bimId).toBe('w-42');
  });

  it('skips unnamed meshes — δεν υπάρχει κλειδί να ταιριάξει', () => {
    const root = new THREE.Group();
    root.add(namedMesh('', { bimId: 'x-1' }));

    expect(indexManifestByMeshName(buildExportManifest(root, OPTIONS)).size).toBe(0);
  });
});

describe('material baseline (ADR-683 §7, Break C)', () => {
  it('serialises the per-material baseline colour map (name → sRGB hex)', () => {
    const baseline = new Map([['mat-concrete-c25', '#808080'], ['mat_a1b2c3', '#a1b2c3']]);
    const manifest = buildExportManifest(sceneWithWall(), { ...OPTIONS, materialBaseline: baseline });

    expect(manifest.materials).toEqual({ 'mat-concrete-c25': '#808080', 'mat_a1b2c3': '#a1b2c3' });
  });

  it('defaults to an empty map when no baseline is supplied', () => {
    expect(buildExportManifest(sceneWithWall(), OPTIONS).materials).toEqual({});
  });

  it('survives serialise → parse and indexes back to a Map', () => {
    const baseline = new Map([['mat-concrete-c25', '#808080']]);
    const parsed = parseExportManifest(
      serialiseManifest(buildExportManifest(sceneWithWall(), { ...OPTIONS, materialBaseline: baseline })),
    );

    expect(parsed?.materials).toEqual({ 'mat-concrete-c25': '#808080' });
    expect(indexManifestMaterials(parsed!).get('mat-concrete-c25')).toBe('#808080');
  });

  it('parses a legacy manifest (no `materials` field) as an empty map — backward compatible', () => {
    const text = JSON.stringify({ schema: NESTOR_MANIFEST_SCHEMA, entities: [] });
    const parsed = parseExportManifest(text);

    expect(parsed?.materials).toEqual({});
    expect(indexManifestMaterials(parsed!).size).toBe(0);
  });

  it('drops non-string material entries (fail-closed)', () => {
    const text = JSON.stringify({
      schema: NESTOR_MANIFEST_SCHEMA,
      entities: [],
      materials: { 'mat-ok': '#123456', 'mat-bad': 42, 'mat-null': null },
    });

    expect(parseExportManifest(text)?.materials).toEqual({ 'mat-ok': '#123456' });
  });
});

describe('materialsByFace (ADR-678 Φ2 — per-entity + per-face baseline)', () => {
  function named(name: string): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial();
    m.name = name;
    return m;
  }

  function meshWith(
    name: string,
    material: THREE.Material | THREE.Material[],
    userData: Record<string, unknown> = {},
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
    mesh.name = name;
    mesh.userData = { bimId: 'x-1', bimType: 'wall', ...userData };
    return mesh;
  }

  function faceMapOf(mesh: THREE.Mesh): Readonly<Record<string, string>> | undefined {
    const root = new THREE.Group();
    root.add(mesh);
    return buildExportManifest(root, OPTIONS).entities[0].materialsByFace;
  }

  it('single-material mesh → { "*": cleanName }', () => {
    expect(faceMapOf(meshWith('Wall_w-1', named('mat-concrete-c25')))).toEqual({
      '*': 'mat-concrete-c25',
    });
  });

  it('per-face array → { faceKey: name } στη σειρά του faceKeyByMaterialIndex', () => {
    const mesh = meshWith('Wall_w-2', [named('mat-brick'), named('mat_a1b2c3'), named('mat-plaster')], {
      faceKeyByMaterialIndex: ['top', 'bottom', 'side:0'],
    });

    expect(faceMapOf(mesh)).toEqual({
      top: 'mat-brick',
      bottom: 'mat_a1b2c3',
      'side:0': 'mat-plaster',
    });
  });

  it('array χωρίς faceKeyByMaterialIndex → fallback key `side:i`', () => {
    const mesh = meshWith('Wall_w-3', [named('mat-a'), named('mat-b')]);

    expect(faceMapOf(mesh)).toEqual({ 'side:0': 'mat-a', 'side:1': 'mat-b' });
  });

  it('strips το `HIDDEN_` prefix — OBJ κρυμμένο υλικό καταρρέει στο καθαρό όνομα', () => {
    expect(faceMapOf(meshWith('Wall_w-4', named('HIDDEN_mat-concrete-c25')))).toEqual({
      '*': 'mat-concrete-c25',
    });
  });

  it('παραλείπει όψεις με κενό όνομα υλικού', () => {
    const mesh = meshWith('Wall_w-5', [named('mat-a'), named('')], {
      faceKeyByMaterialIndex: ['top', 'bottom'],
    });

    expect(faceMapOf(mesh)).toEqual({ top: 'mat-a' });
  });

  it('κανένα όνομα υλικού → `undefined` (χωρίς άδειο object στο JSON)', () => {
    expect(faceMapOf(meshWith('Wall_w-6', named('')))).toBeUndefined();
  });

  it('επιβιώνει serialise → parse', () => {
    const mesh = meshWith('Wall_w-7', [named('mat-brick'), named('mat-plaster')], {
      faceKeyByMaterialIndex: ['top', 'bottom'],
    });
    const root = new THREE.Group();
    root.add(mesh);
    const parsed = parseExportManifest(serialiseManifest(buildExportManifest(root, OPTIONS)));

    expect(parsed?.entities[0].materialsByFace).toEqual({ top: 'mat-brick', bottom: 'mat-plaster' });
  });

  it('παλιό manifest (χωρίς πεδίο) → parse δίνει undefined (fail-closed, μηδέν regression)', () => {
    const text = JSON.stringify({
      schema: NESTOR_MANIFEST_SCHEMA,
      entities: [{ meshName: 'Wall_w-1' }],
    });

    expect(parseExportManifest(text)?.entities[0].materialsByFace).toBeUndefined();
  });

  it('drops non-string face entries (fail-closed) και άδειο map → undefined', () => {
    const text = JSON.stringify({
      schema: NESTOR_MANIFEST_SCHEMA,
      entities: [
        { meshName: 'A', materialsByFace: { top: 'mat-ok', bottom: 42, side: null } },
        { meshName: 'B', materialsByFace: { top: 7 } },
        { meshName: 'C', materialsByFace: 'not-an-object' },
      ],
    });
    const parsed = parseExportManifest(text);

    expect(parsed?.entities[0].materialsByFace).toEqual({ top: 'mat-ok' });
    expect(parsed?.entities[1].materialsByFace).toBeUndefined();
    expect(parsed?.entities[2].materialsByFace).toBeUndefined();
  });
});

describe('manifestFingerprint', () => {
  it('returns null when the export could not fingerprint the mesh (κενή γεωμετρία)', () => {
    const root = new THREE.Group();
    const empty = new THREE.Mesh(new THREE.BufferGeometry());
    empty.name = 'Wall_w-1';
    root.add(empty);

    const [entity] = buildExportManifest(root, OPTIONS).entities;

    expect(entity.geometryHash).toBeNull();
    expect(manifestFingerprint(entity)).toBeNull();
  });
});
