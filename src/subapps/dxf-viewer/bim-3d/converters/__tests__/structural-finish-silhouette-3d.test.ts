/**
 * ADR-449/534 Φ7 — buildStructuralSilhouetteSkin: unified welded δέρμα ανά ομοεπίπεδη όψη.
 *
 * Καλύπτει το ΚΡΙΣΙΜΟ ζητούμενο του Giorgio: μια συνεχής πρόσοψη με άνοιγμα δεν βγάζει πια
 * πολλά prisms με εσωτερικές ραφές, αλλά ΕΝΑ mesh (το άνοιγμα = τρύπα στο ίδιο δέρμα).
 */

import * as THREE from 'three';
import { buildStructuralSilhouetteSkin } from '../structural-finish-silhouette-3d';
import type { SilhouetteBand } from '../../../bim/finishes/structural-finish-silhouette';
import type { FinishFaceSegment } from '../../../bim/finishes/structural-finish-types';
import type { Pt2 } from '../../../bim/geometry/shared/segment-polygon-coverage';

const mkSeg = (a: Pt2, b: Pt2, extra: Partial<FinishFaceSegment> = {}): FinishFaceSegment => ({
  a, b, classification: 'exterior', materialId: 'mat-plaster-ext', thickness: 25,
  lengthM: Math.hypot(b.x - a.x, b.y - a.y), ...extra,
});
const mkBand = (segments: FinishFaceSegment[], zBottomMm: number, zTopMm: number): SilhouetteBand => ({
  faces: { segments, heightM: (zTopMm - zBottomMm) * 0.001, interiorAreaM2: 0, exteriorAreaM2: 0 },
  zBottomMm, zTopMm,
});
const xSeg = (x0: number, x1: number): FinishFaceSegment => mkSeg({ x: x0, y: 0 }, { x: x1, y: 0 });

describe('ADR-449/534 Φ7 — buildStructuralSilhouetteSkin (unified face weld)', () => {
  // Πρόσοψη 300mm, παράθυρο x[100,200] z[1000,2200], φάσα πλάκας z[3000,3150] — ΟΛΑ coplanar.
  const windowBands: SilhouetteBand[] = [
    mkBand([xSeg(0, 300)], 0, 1000),
    mkBand([xSeg(0, 100), xSeg(200, 300)], 1000, 2200),
    mkBand([xSeg(0, 300)], 2200, 3000),
    mkBand([xSeg(0, 300)], 3000, 3150),
  ];

  it('πρόσοψη με παράθυρο → ΕΝΑ mesh (όχι 4 prisms) — μηδέν εσωτερική ραφή', () => {
    const skin = buildStructuralSilhouetteSkin(windowBands, 'mm', 0)!;
    expect(skin).not.toBeNull();
    // Πριν το Φ7: 4 prisms (4 children). Μετά: 1 welded δέρμα (1 child).
    expect(skin.children).toHaveLength(1);
    expect(skin.children[0]).toBeInstanceOf(THREE.Mesh);
    expect(skin.userData['structuralFinish']).toBe(true);
  });

  it('το ενιαίο mesh καλύπτει όλη την όψη (0→3.15m ύψος) + tags σοβά', () => {
    const skin = buildStructuralSilhouetteSkin(windowBands, 'mm', 0)!;
    const mesh = skin.children[0] as THREE.Mesh;
    const box = new THREE.Box3().setFromObject(mesh);
    expect(box.min.y).toBeCloseTo(0, 3);
    expect(box.max.y).toBeCloseTo(3.15, 3); // φάσα → κορυφή 3150mm
    expect(mesh.userData['structuralFinish']).toBe(true);
    expect(mesh.userData['bimType']).toBe('column'); // silhouette skin = synthetic 'column'
  });

  it('το δέρμα είναι μη-pickable (derived διακόσμηση — το ray περνά στον πυρήνα)', () => {
    const skin = buildStructuralSilhouetteSkin(windowBands, 'mm', 0)!;
    const mesh = skin.children[0] as THREE.Mesh;
    const hits: THREE.Intersection[] = [];
    // NOOP raycast → καμία τομή προστίθεται.
    mesh.raycast(new THREE.Raycaster(new THREE.Vector3(0.15, 1.5, 5), new THREE.Vector3(0, 0, -1)), hits);
    expect(hits).toHaveLength(0);
  });

  it('CONTROL: συνεχής όψη χωρίς παράθυρο → 1 mesh (ίδιο)', () => {
    const clean: SilhouetteBand[] = [
      mkBand([xSeg(0, 300)], 0, 1500),
      mkBand([xSeg(0, 300)], 1500, 3000),
    ];
    const skin = buildStructuralSilhouetteSkin(clean, 'mm', 0)!;
    expect(skin.children).toHaveLength(1);
  });

  it('δύο κάθετες όψεις (Β + Δ, ΚΟΙΛΗ γωνία) → 2 meshes (πραγματικό όριο· ΚΑΝΕΝΑ miter wedge)', () => {
    const north = mkSeg({ x: 0, y: 50 }, { x: 50, y: 50 });
    const west = mkSeg({ x: 0, y: 0 }, { x: 0, y: 50 });
    const bands: SilhouetteBand[] = [
      mkBand([north, west], 0, 1500),
      mkBand([north, west], 1500, 3000),
    ];
    const skin = buildStructuralSilhouetteSkin(bands, 'mm', 0)!;
    // Γωνία = πραγματικό όριο (2 ξεχωριστά welded bodies, όχι weld). Αυτή είναι ΚΟΙΛΗ (concave) γωνία:
    // το mitered outer κόβεται ΠΡΟΣ ΤΑ ΜΕΣΑ (trim), δεν προεξέχει → ΚΑΝΕΝΑ miter wedge (τα wedges Φ7b
    // αφορούν ΚΥΡΤΕΣ εξωτερικές γωνίες, όπου ήταν το double-coverage). Βλ. corner-overlap-diag για κυρτή.
    expect(skin.children).toHaveLength(2);
  });

  it('baseElevation → κατακόρυφη θέση του δέρματος (bakes στο geometry, όχι position.y)', () => {
    const skin = buildStructuralSilhouetteSkin(windowBands, 'mm', 10)!;
    const box = new THREE.Box3().setFromObject(skin);
    expect(box.min.y).toBeCloseTo(10, 3);      // datum 10m
    expect(box.max.y).toBeCloseTo(13.15, 3);
  });

  it('κενά bands → null', () => {
    expect(buildStructuralSilhouetteSkin([], 'mm', 0)).toBeNull();
  });
});
