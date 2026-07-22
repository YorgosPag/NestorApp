/**
 * ADR-683 Φ3 — unmatched κόμβος `.glb` → `ImportedMeshEntity` (κατάσταση D του §5).
 *
 * Το πιο εύθραυστο σημείο εδώ είναι η **αντιστοίχιση αξόνων**: το glTF είναι Y-up, η κάτοψη X/Y.
 * Λάθος εκεί δεν σπάει τίποτα — απλώς τα κάγκελα εμφανίζονται ξαπλωμένα, και κανείς δεν καταλαβαίνει
 * γιατί. Γι' αυτό ελέγχεται με ασύμμετρες διαστάσεις (2×0.1×1), όπου κάθε μπέρδεμα φαίνεται.
 */

import { buildImportedMeshEntity, buildImportedMeshEntities, type ImportedMeshSource } from '../build-imported-mesh-entity';
import type { GeometrySignature } from '../../../../io/mesh3d-roundtrip/geometry-hash';
import type { MeshSolidMeasure } from '../../../../io/mesh3d-roundtrip/mesh-solid-measure';

jest.mock('@/services/enterprise-id.service', () => ({
  __esModule: true,
  generateImportedMeshId: (() => {
    let n = 0;
    return () => `imesh_test_${++n}`;
  })(),
}));

/**
 * Κάγκελο: 2m πλάτος × 0.1m βάθος × 1m ύψος — κάθε άξονας διακριτός.
 *
 * ⚠️ Το `Vec3M` είναι **tuple** `[x, y, z]`. Αυτό το fixture έγραφε αρχικά `{x,y,z}` και, επειδή
 * το `src/subapps/dxf-viewer/**` εξαιρείται από το root `tsconfig.json`, ο tsc δεν το είδε ποτέ:
 * ο κώδικας διάβαζε `sizeM.x` → `undefined` → `NaN` → **κάθε πραγματικός κόμβος απορριπτόταν**
 * ως εκφυλισμένος, ενώ τα tests έμεναν πράσινα (το fixture είχε το ίδιο λάθος με τον κώδικα).
 * **Κράτα τα tuples** — είναι ο μόνος τρόπος αυτά τα tests να μιλούν για την πραγματικότητα.
 */
const signature: GeometrySignature = {
  vertexCount: 100,
  triangleCount: 50,
  sizeM: [2, 1, 0.1],
  centroidM: [1, 0.5, 0.05],
  areaM2: 4,
};

/**
 * Κάγκελο = **ανοιχτό** πλέγμα → κανένας αξιόπιστος όγκος (ADR-683 §10.2). Το `null` εδώ δεν είναι
 * «δεν μετρήθηκε» αλλά «η γεωμετρία δεν στηρίζει την ερώτηση» — και είναι η συνήθης περίπτωση για
 * ό,τι στέλνει ένας συνεργάτης από DCC.
 */
const openSolid: MeshSolidMeasure = { isWatertight: false, volumeM3: null };

const source: ImportedMeshSource = {
  uploadId: 'imesh_upload',
  storagePath: 'projects/p1/imported-meshes/imesh_upload.glb',
  sourceFileName: 'Ισόγειο.glb',
  nodeName: 'Rail_01',
  signature,
  solid: openSolid,
  position: { x: 10, y: 20, z: 0 },
  sceneUnits: 'mm',
  layerId: 'lyr_1',
  floorId: 'floor_1',
};

describe('buildImportedMeshParams — αντιστοίχιση αξόνων glTF(Y-up) → κάτοψη', () => {
  it('width←x, depth←z, height←y (σε mm)', () => {
    const e = buildImportedMeshEntity(source);
    expect(e).not.toBeNull();
    expect(e!.params.measuredWidthMm).toBeCloseTo(2000);
    expect(e!.params.measuredDepthMm).toBeCloseTo(100);
    expect(e!.params.measuredHeightMm).toBeCloseTo(1000);
  });

  it('το ίχνος στην κάτοψη είναι 2000×100 — ΟΧΙ ξαπλωμένο', () => {
    const e = buildImportedMeshEntity(source)!;
    const vs = e.geometry.footprint.vertices;
    const w = Math.max(...vs.map((v) => v.x)) - Math.min(...vs.map((v) => v.x));
    const d = Math.max(...vs.map((v) => v.y)) - Math.min(...vs.map((v) => v.y));
    expect(w).toBeCloseTo(2000);
    expect(d).toBeCloseTo(100);
  });

  it('δεν «διορθώνει» προσανατολισμό — ο συνεργάτης τον έδωσε στη γεωμετρία', () => {
    expect(buildImportedMeshEntity(source)!.params.rotationDeg).toBe(0);
  });
});

describe('buildImportedMeshEntity', () => {
  it('κρατά τον δείκτη πηγής ώστε το πλέγμα να ξαναβρίσκεται μετά το reload', () => {
    const e = buildImportedMeshEntity(source)!;
    expect(e.params.uploadId).toBe('imesh_upload');
    expect(e.params.nodeName).toBe('Rail_01');
    expect(e.params.storagePath).toBe(source.storagePath);
    expect(e.params.sourceFileName).toBe('Ισόγειο.glb');
  });

  it('ονομάζει την οντότητα με το όνομα του κόμβου (γέφυρα με το toast των unmatched)', () => {
    expect(buildImportedMeshEntity(source)!.name).toBe('Rail_01');
  });

  it('είναι IfcBuildingElementProxy — ΠΟΤΕ IfcRailing, όσο κι αν λέγεται Rail_01 (§3)', () => {
    expect(buildImportedMeshEntity(source)!.ifcType).toBe('IfcBuildingElementProxy');
  });

  it('παίρνει enterprise id (N.6) — ποτέ αυθαίρετο', () => {
    expect(buildImportedMeshEntity(source)!.id).toMatch(/^imesh_/);
  });

  it('απορρίπτει εκφυλισμένο κόμβο αντί να τον εισάγει σιωπηλά', () => {
    const flat: ImportedMeshSource = {
      ...source,
      signature: { ...signature, sizeM: [2, 1, 0] },
    };
    expect(buildImportedMeshEntity(flat)).toBeNull();
  });
});

describe('buildImportedMeshParams — unitScaleFactor (ADR-683 §units)', () => {
  // Κλειστό κέλυφος ώστε να ελεγχθεί και ο όγκος (·f³). areaM2 = 4 (·f²).
  const closedSolid: MeshSolidMeasure = { isWatertight: true, volumeM3: 0.2 };

  it('ίντσες (f=0.0254): dims ×f, area ×f², volume ×f³', () => {
    const inches: ImportedMeshSource = { ...source, solid: closedSolid, unitScaleFactor: 0.0254 };
    const e = buildImportedMeshEntity(inches)!;
    // sizeM = [2, 1, 0.1] «μέτρα-εξ-υποθέσεως» → width←x, depth←z, height←y, ×0.0254 ×1000 mm.
    expect(e.params.measuredWidthMm).toBeCloseTo(2 * 0.0254 * 1000, 4);   // 50.8
    expect(e.params.measuredDepthMm).toBeCloseTo(0.1 * 0.0254 * 1000, 4); // 2.54
    expect(e.params.measuredHeightMm).toBeCloseTo(1 * 0.0254 * 1000, 4);  // 25.4
    expect(e.params.measuredSurfaceAreaM2).toBeCloseTo(4 * 0.0254 ** 2, 9);
    expect(e.params.measuredVolumeM3).toBeCloseTo(0.2 * 0.0254 ** 3, 12);
  });

  it('απών factor → 1 (καμία αλλαγή, back-compat με σωστά glTF)', () => {
    const e = buildImportedMeshEntity({ ...source, solid: closedSolid })!;
    expect(e.params.measuredWidthMm).toBeCloseTo(2000);
    expect(e.params.measuredSurfaceAreaM2).toBeCloseTo(4);
    expect(e.params.measuredVolumeM3).toBeCloseTo(0.2);
  });

  it('όγκος null παραμένει null ανεξαρτήτως factor (ανοιχτό πλέγμα)', () => {
    // factor 0.0254 κρατά τις διαστάσεις πάνω από το MIN (βάθος 0.1m → 2.54mm)· εδώ ελέγχουμε τον όγκο.
    const e = buildImportedMeshEntity({ ...source, unitScaleFactor: 0.0254 })!;
    expect(e.params.measuredVolumeM3).toBeNull();
  });
});

describe('buildImportedMeshEntities', () => {
  it('χτίζει τα καλά και ΑΝΑΦΕΡΕΙ τα παραλειφθέντα (καμία σιωπηλή απώλεια)', () => {
    const good = { ...source, nodeName: 'Rail_01' };
    const bad: ImportedMeshSource = {
      ...source,
      nodeName: 'Empty_Node',
      signature: { ...signature, sizeM: [0, 0, 0] },
    };
    const { entities, skipped } = buildImportedMeshEntities([good, bad]);
    expect(entities).toHaveLength(1);
    expect(entities[0].params.nodeName).toBe('Rail_01');
    expect(skipped).toEqual(['Empty_Node']);
  });

  it('όλοι οι κόμβοι μιας εισαγωγής μοιράζονται uploadId (linked-model ταυτότητα)', () => {
    const { entities } = buildImportedMeshEntities([
      { ...source, nodeName: 'Rail_01' },
      { ...source, nodeName: 'Rail_02' },
    ]);
    expect(entities).toHaveLength(2);
    expect(new Set(entities.map((e) => e.params.uploadId)).size).toBe(1);
    // ...αλλά ξεχωριστή ταυτότητα ανά αντικείμενο.
    expect(new Set(entities.map((e) => e.id)).size).toBe(2);
  });
});
