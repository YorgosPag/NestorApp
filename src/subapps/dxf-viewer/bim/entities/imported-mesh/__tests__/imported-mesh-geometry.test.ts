/**
 * ADR-683 Φ3 — γεωμετρία + επικύρωση εισαγόμενου πλέγματος.
 *
 * Το κρίσιμο που κατοχυρώνεται εδώ: το ίχνος υπολογίζεται **χωρίς φορτωμένο glTF** (από τις
 * μετρημένες διαστάσεις), αλλιώς κάθε reload θα άφηνε τα εισαγόμενα άκλικα μέχρι να κατέβει το
 * αρχείο· και ότι το `validate` κόβει ό,τι δεν έχει έγκυρο δείκτη πηγής.
 */

import {
  computeImportedMeshGeometry,
  validateImportedMeshParams,
} from '../imported-mesh-geometry';
import {
  importedMeshAssetId,
  parseImportedMeshAssetId,
  type ImportedMeshParams,
} from '../imported-mesh-types';

const baseParams: ImportedMeshParams = {
  kind: 'imported',
  uploadId: 'imesh_abc',
  nodeName: 'Rail_01',
  storagePath: 'projects/p1/imported-meshes/imesh_abc.glb',
  sourceFileName: 'Ισόγειο.glb',
  position: { x: 100, y: 200, z: 0 },
  rotationDeg: 0,
  measuredWidthMm: 2000,
  measuredDepthMm: 100,
  measuredHeightMm: 1000,
  mountingElevationMm: 0,
  sceneUnits: 'mm',
};

describe('computeImportedMeshGeometry', () => {
  it('χτίζει κεντραρισμένο ορθογώνιο ίχνος από τις ΜΕΤΡΗΜΕΝΕΣ διαστάσεις', () => {
    const g = computeImportedMeshGeometry(baseParams);
    expect(g.footprint.vertices).toHaveLength(4);
    // Κεντραρισμένο στο position: ±width/2, ±depth/2 (sceneUnits 'mm' → factor 1).
    const xs = g.footprint.vertices.map((v) => v.x).sort((a, b) => a - b);
    const ys = g.footprint.vertices.map((v) => v.y).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(100 - 1000);
    expect(xs[3]).toBeCloseTo(100 + 1000);
    expect(ys[0]).toBeCloseTo(200 - 50);
    expect(ys[3]).toBeCloseTo(200 + 50);
    expect(g.height).toBe(1000);
  });

  it('η περιστροφή γυρίζει το ίχνος αλλά ΔΙΑΤΗΡΕΙ το εμβαδόν (μετασχηματισμός, όχι παραμόρφωση)', () => {
    const straight = computeImportedMeshGeometry(baseParams);
    // Το εμβαδόν είναι αναλλοίωτο σε ΚΑΘΕ γωνία — αυτό ακριβώς σημαίνει «μετασχηματισμός».
    for (const deg of [37, 90, 180, -45]) {
      expect(computeImportedMeshGeometry({ ...baseParams, rotationDeg: deg }).area)
        .toBeCloseTo(straight.area, 6);
    }
    // Στις 90° το AABB εναλλάσσει πλάτος↔βάθος (2000×100 → 100×2000).
    const quarter = computeImportedMeshGeometry({ ...baseParams, rotationDeg: 90 });
    const span = (b: { min: { x: number; y: number }; max: { x: number; y: number } }) => ({
      w: b.max.x - b.min.x,
      h: b.max.y - b.min.y,
    });
    expect(span(quarter.bbox).w).toBeCloseTo(span(straight.bbox).h, 6);
    expect(span(quarter.bbox).h).toBeCloseTo(span(straight.bbox).w, 6);
  });

  it('το ίχνος δεν εξαρτάται από φορτωμένο πλέγμα (δουλεύει αμέσως μετά το reload)', () => {
    // Καμία αναφορά σε bimMeshCache/three — καθαρή συνάρτηση παραμέτρων.
    expect(() => computeImportedMeshGeometry(baseParams)).not.toThrow();
    expect(computeImportedMeshGeometry(baseParams).footprint.vertices.length).toBe(4);
  });
});

describe('validateImportedMeshParams', () => {
  it('δέχεται έγκυρες παραμέτρους', () => {
    expect(validateImportedMeshParams(baseParams).hardErrors).toEqual([]);
  });

  it('απορρίπτει χαμένο δείκτη πηγής (το πλέγμα δεν θα βρισκόταν ΠΟΤΕ)', () => {
    for (const patch of [{ uploadId: '' }, { nodeName: '' }, { storagePath: '' }]) {
      const r = validateImportedMeshParams({ ...baseParams, ...patch });
      expect(r.hardErrors).toContain('importedMesh.validation.hardErrors.missingSource');
    }
  });

  it('απορρίπτει εκφυλισμένο/κενό κόμβο', () => {
    expect(
      validateImportedMeshParams({ ...baseParams, measuredWidthMm: 0 }).hardErrors,
    ).toContain('importedMesh.validation.hardErrors.nonPositiveDimension');
    expect(
      validateImportedMeshParams({ ...baseParams, measuredHeightMm: NaN }).hardErrors,
    ).toContain('importedMesh.validation.hardErrors.nonPositiveDimension');
  });

  it('ΔΕΝ κρίνει «λογικό» μέγεθος — ο συνεργάτης το σχεδίασε, εμείς το σεβόμαστε (§3)', () => {
    const huge = validateImportedMeshParams({ ...baseParams, measuredWidthMm: 500_000 });
    expect(huge.hardErrors).toEqual([]);
  });
});

describe('assetId round-trip (κλειδί bundle)', () => {
  it('χτίζει και ξαναδιαβάζει `<uploadId>#<nodeName>`', () => {
    const id = importedMeshAssetId('imesh_abc', 'Rail_01');
    expect(id).toBe('imesh_abc#Rail_01');
    expect(parseImportedMeshAssetId(id)).toEqual({ uploadId: 'imesh_abc', nodeName: 'Rail_01' });
  });

  it('διατηρεί ονόματα κόμβων που περιέχουν `#` (σπάει στο ΠΡΩΤΟ διαχωριστικό)', () => {
    const id = importedMeshAssetId('imesh_abc', 'Rail#2');
    expect(parseImportedMeshAssetId(id)).toEqual({ uploadId: 'imesh_abc', nodeName: 'Rail#2' });
  });

  it('επιστρέφει null για μη-bundle id', () => {
    expect(parseImportedMeshAssetId('plain-asset')).toBeNull();
    expect(parseImportedMeshAssetId('#leading')).toBeNull();
    expect(parseImportedMeshAssetId('trailing#')).toBeNull();
  });
});
