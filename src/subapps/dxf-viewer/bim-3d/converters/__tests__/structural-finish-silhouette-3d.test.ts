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

  it('δύο κάθετες όψεις (Β + Δ) ΙΔΙΟΥ υλικού → 1 merged mesh (ADR-534 Φ7c: ένα συνεχές δέρμα)', () => {
    const north = mkSeg({ x: 0, y: 50 }, { x: 50, y: 50 });
    const west = mkSeg({ x: 0, y: 0 }, { x: 0, y: 50 });
    const bands: SilhouetteBand[] = [
      mkBand([north, west], 0, 1500),
      mkBand([north, west], 1500, 3000),
    ];
    const skin = buildStructuralSilhouetteSkin(bands, 'mm', 0)!;
    // Φ7c: όλες οι όψεις ΙΔΙΟΥ υλικού κάνουν merge σε ΕΝΑ mesh (το miter είναι ενσωματωμένο στο extrude,
    // όχι ξεχωριστά wedges) → μηδέν per-face κατακερματισμός στο OBJ export (Giorgio: «ένα συνεχές δέρμα»).
    expect(skin.children).toHaveLength(1);
  });

  it('ADR-534 Φ7c — L-γωνία: το outer corner φτάνει τη mitered κορυφή ΜΕΣΑ στο ενιαίο mesh (μηδέν wedge)', () => {
    // Ν όψη x[0,100] + Α όψη y[0,100] στο x=100, ίδιο υλικό → μοιράζονται τη γωνία (100,0).
    const south = mkSeg({ x: 0, y: 0 }, { x: 100, y: 0 });
    const east = mkSeg({ x: 100, y: 0 }, { x: 100, y: 100 });
    const skin = buildStructuralSilhouetteSkin([mkBand([south, east], 0, 3000)], 'mm', 0)!;
    expect(skin.children).toHaveLength(1); // ΕΝΑ merged mesh — ΟΧΙ ξεχωριστά wedge children
    const mesh = skin.children[0] as THREE.Mesh;
    const pos = mesh.geometry.getAttribute('position');
    const hasWorldVertex = (x: number, z: number): boolean => {
      for (let i = 0; i < pos.count; i++) {
        if (Math.abs(pos.getX(i) - x) <= 1e-4 && Math.abs(pos.getZ(i) - z) <= 1e-4) return true;
      }
      return false;
    };
    // outer mitered tip (125,-25)mm → world (0.125, *, 0.025)· core corner (100,0) → world (0.1, *, 0).
    expect(hasWorldVertex(0.125, 0.025)).toBe(true); // το miter είναι ΜΕΣΑ στο mesh
    expect(hasWorldVertex(0.1, 0)).toBe(true);       // το core corner ΔΕΝ μετακινήθηκε
    // Τίποτα πέρα από το miter tip → το body ΔΕΝ διπλο-επεκτείνεται (πρώην double-coverage).
    let maxX = -Infinity;
    for (let i = 0; i < pos.count; i++) maxX = Math.max(maxX, pos.getX(i));
    expect(maxX).toBeCloseTo(0.125, 4);
  });

  it('δύο υλικά (plaster-ext + gypsum) → 2 merged meshes (ένα ανά υλικό)', () => {
    const extWall = mkSeg({ x: 0, y: 0 }, { x: 3000, y: 0 });
    const gypWall = mkSeg({ x: 0, y: 2000 }, { x: 3000, y: 2000 }, { materialId: 'mat-gypsum-board' });
    const bands: SilhouetteBand[] = [mkBand([extWall, gypWall], 0, 3000)];
    const skin = buildStructuralSilhouetteSkin(bands, 'mm', 0)!;
    expect(skin.children).toHaveLength(2); // ένα merged mesh ανά υλικό
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

  it('ADR-449 §wall-plaster — ΚΑΘΕ όψη έχει outward-consistent winding (reflection matrix → όχι culled cap)', () => {
    // Root του z-fight σοβά↔τοίχου (Giorgio 2026-07-18): ο `faceProfileWorldMatrix` είναι ΑΝΑΚΛΑΣΗ
    // (det<0) για τη μία από κάθε ζεύγος αντικριστών όψεων → το `applyMatrix4` αναστρέφει το winding →
    // το outward cap γίνεται back-facing → ΚΟΒΕΤΑΙ (FrontSide) → φαίνεται το inner cap (coplanar με τον
    // πυρήνα) → z-fight. Ένα κλειστό ορθογώνιο δωματίου δίνει ΚΑΙ ΤΙΣ 4 φορές perp → σίγουρα ≥1 det<0.
    // Invariant: για ΚΑΘΕ τρίγωνο το geometric normal (από το winding) συμφωνεί με το stored normal (dot>0).
    const loop = [
      mkSeg({ x: 0, y: 0 }, { x: 1000, y: 0 }),
      mkSeg({ x: 1000, y: 0 }, { x: 1000, y: 1000 }),
      mkSeg({ x: 1000, y: 1000 }, { x: 0, y: 1000 }),
      mkSeg({ x: 0, y: 1000 }, { x: 0, y: 0 }),
    ];
    const skin = buildStructuralSilhouetteSkin([mkBand(loop, 0, 3000)], 'mm', 0)!;
    expect(skin).not.toBeNull();
    let triangles = 0;
    for (const child of skin.children) {
      const geo = (child as THREE.Mesh).geometry;
      const pos = geo.getAttribute('position');
      const nrm = geo.getAttribute('normal');
      for (let i = 0; i + 3 <= pos.count; i += 3) {
        const p0 = new THREE.Vector3().fromBufferAttribute(pos, i);
        const p1 = new THREE.Vector3().fromBufferAttribute(pos, i + 1);
        const p2 = new THREE.Vector3().fromBufferAttribute(pos, i + 2);
        const geoN = new THREE.Vector3().subVectors(p1, p0).cross(new THREE.Vector3().subVectors(p2, p0));
        if (geoN.lengthSq() < 1e-12) continue; // degenerate → skip
        const storedN = new THREE.Vector3().fromBufferAttribute(nrm, i)
          .add(new THREE.Vector3().fromBufferAttribute(nrm, i + 1))
          .add(new THREE.Vector3().fromBufferAttribute(nrm, i + 2));
        expect(geoN.dot(storedN)).toBeGreaterThan(0);
        triangles++;
      }
    }
    expect(triangles).toBeGreaterThan(0); // δίχτυ: όντως ελέγξαμε τρίγωνα
  });
});
