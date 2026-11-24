/**
 * ADR-920 Β6.4 — η γεωμετρία 3Δ του στιγμιοτύπου (χωρίς three).
 *
 * Άξονες: X = ανατολή, −Z = βορράς, Y = (υψόμετρο − min) × υπερβολή. Τα τοιχώματα κρίνονται πάνω σε επιφάνεια ΜΕ
 * ΤΡΥΠΑ (`frameSnapshot`), εκεί όπου η φορά ενός δακτυλίου δεν λέει ποια πλευρά είναι «έξω».
 */

import { writeTerrainElevationColor } from '@/lib/terrain/elevation-ramp';
import { tinBoundaryEdges } from '@/lib/terrain/tin-boundary-loops';

import type { ListingTerrainSnapshot } from '../listing-terrain-types';
import { buildTerrain3dGeometry, type Terrain3dGeometry } from '../terrain-3d-geometry';
import { meshTriangles } from '../terrain-map-regions';
import { REAL_PLANE, frameSnapshot, squareSnapshot, syntheticSnapshot } from './fixtures/terrain-3d-fixtures';

type Vec3 = [number, number, number];

function geometryOf(snapshot: ListingTerrainSnapshot, verticalExaggeration = 1): Terrain3dGeometry {
  const result = buildTerrain3dGeometry(snapshot, { verticalExaggeration });
  if (!result.ok) throw new Error(result.reason);
  return result.geometry;
}

const vertex = (positions: Float32Array, i: number): Vec3 => [positions[3 * i], positions[3 * i + 1], positions[3 * i + 2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function triangleNormal(positions: Float32Array, indices: Uint32Array, t: number): Vec3 {
  const [a, b, c] = [vertex(positions, indices[3 * t]), vertex(positions, indices[3 * t + 1]), vertex(positions, indices[3 * t + 2])];
  return cross(sub(b, a), sub(c, a));
}

describe('buildTerrain3dGeometry — επιφάνεια', () => {
  it('βορράς = −Z, ανατολή = +X, ύψος πάνω από το ελάχιστο', () => {
    const g = geometryOf(squareSnapshot());
    expect(vertex(g.surface.positions, 2)).toEqual([1, 1, -1]); // (x=1, y=1 βόρεια, z=101 = min+1)
    expect(vertex(g.surface.positions, 0)).toEqual([-1, 0, 1]);
  });

  it('κάθε τρίγωνο της επιφάνειας κοιτά προς τα πάνω (+Y)', () => {
    const g = geometryOf(REAL_PLANE());
    for (let t = 0; t < g.surface.indices.length / 3; t++) {
      expect(triangleNormal(g.surface.positions, g.surface.indices, t)[1]).toBeGreaterThan(0);
    }
  });

  it('χρώμα στο min / max = τα άκρα της ΜΙΑΣ υψομετρικής κλίμακας', () => {
    const g = geometryOf(squareSnapshot());
    const low = [0, 0, 0];
    const high = [0, 0, 0];
    writeTerrainElevationColor(low, 0, 0);
    writeTerrainElevationColor(high, 0, 1);
    expect(Array.from(g.surface.colors.slice(0, 3))).toEqual(Array.from(Float32Array.from(low)));
    expect(Array.from(g.surface.colors.slice(3, 6))).toEqual(Array.from(Float32Array.from(high)));
  });
});

describe('buildTerrain3dGeometry — κάθετη υπερβολή', () => {
  it('αλλάζει ΜΟΝΟ το Y: X και Z ίδια, Y × 3, βάση ίδια', () => {
    const one = geometryOf(REAL_PLANE(), 1);
    const three = geometryOf(REAL_PLANE(), 3);
    for (let i = 0; i < one.surface.positions.length; i += 3) {
      expect(three.surface.positions[i]).toBe(one.surface.positions[i]);
      expect(three.surface.positions[i + 2]).toBe(one.surface.positions[i + 2]);
      expect(three.surface.positions[i + 1]).toBeCloseTo(one.surface.positions[i + 1] * 3, 4);
    }
    expect(three.bounds.baseY).toBe(one.bounds.baseY);
    expect(three.bounds.topY).toBeCloseTo(one.bounds.topY * 3, 9);
  });

  it.each([0, 1.5, 4, Number.NaN])('υπερβολή %p εκτός συνόλου ⇒ άρνηση, όχι σιωπηλό κλάδεμα', (factor) => {
    expect(buildTerrain3dGeometry(REAL_PLANE(), { verticalExaggeration: factor })).toEqual({ ok: false, reason: 'unknown-exaggeration' });
  });
});

describe('buildTerrain3dGeometry — όγκος εδάφους (τοιχώματα + πάτος)', () => {
  it('τρίγωνα τοιχωμάτων = 2 × ακμές συνόρου, και πάτος = τα τρίγωνα της επιφάνειας (επιφάνεια με τρύπα)', () => {
    const snapshot = frameSnapshot();
    const edges = tinBoundaryEdges(meshTriangles(snapshot.mesh)).length;
    expect(edges).toBe(8);
    const surfaceTriangles = snapshot.mesh.triangles.length / 3;
    expect(geometryOf(snapshot).soil.indices.length / 3).toBe(2 * edges + surfaceTriangles);
  });

  it('κάθε τοίχωμα κοιτά ΕΞΩ από το στερεό — και στην εσωτερική τρύπα', () => {
    const snapshot = frameSnapshot();
    const g = geometryOf(snapshot);
    const triangles = meshTriangles(snapshot.mesh);
    const edges = tinBoundaryEdges(triangles);
    edges.forEach(([a, b], e) => {
      const owner = triangles.find((tri) => tri.includes(a) && tri.includes(b));
      if (!owner) throw new Error('boundary edge without a triangle');
      const centroid = owner.map((i) => vertex(g.surface.positions, i)).reduce((s, p) => [s[0] + p[0] / 3, s[1] + p[1] / 3, s[2] + p[2] / 3], [0, 0, 0] as Vec3);
      const mid = vertex(g.surface.positions, a).map((v, k) => (v + vertex(g.surface.positions, b)[k]) / 2) as Vec3;
      const away: Vec3 = [mid[0] - centroid[0], 0, mid[2] - centroid[2]];
      for (const t of [2 * e, 2 * e + 1]) {
        expect(dot(triangleNormal(g.soil.positions, g.soil.indices, t), away)).toBeGreaterThan(0);
      }
    });
  });

  it('ο πάτος κοιτά προς τα κάτω και βρίσκεται κάτω από το ελάχιστο', () => {
    const snapshot = frameSnapshot();
    const g = geometryOf(snapshot);
    const wallTriangles = 2 * tinBoundaryEdges(meshTriangles(snapshot.mesh)).length;
    for (let t = wallTriangles; t < g.soil.indices.length / 3; t++) {
      expect(triangleNormal(g.soil.positions, g.soil.indices, t)[1]).toBeLessThan(0);
      expect(g.soil.positions[3 * g.soil.indices[3 * t] + 1]).toBe(g.bounds.baseY);
    }
    expect(g.bounds.baseY).toBeLessThan(0);
  });

  it('βάθος βάσης = 5 % της μεγαλύτερης διάστασης (οικόπεδο 100 m ⇒ 5 m), με κατώφλι 1 m', () => {
    const big = syntheticSnapshot([-50, -50, 10, 50, -50, 10, 50, 50, 12, -50, 50, 12], [0, 1, 2, 0, 2, 3]);
    expect(geometryOf(big).bounds.baseY).toBeCloseTo(-5, 9);
    expect(geometryOf(squareSnapshot()).bounds.baseY).toBe(-1);
  });
});

describe('buildTerrain3dGeometry — ισοϋψείς', () => {
  const contour = (closed: boolean, major: boolean) => ({
    levelM: 100.5, major, closed, points: [-1, -1, 1, -1, 1, 1, -1, 1],
  });

  it('Y = (levelM − min) × υπερβολή, πάνω στο TIN (χωρίς ανύψωση)', () => {
    const snapshot = { ...squareSnapshot(), contours: [contour(false, true)] };
    const g = geometryOf(snapshot, 2);
    for (let i = 1; i < g.contours.major.length; i += 3) expect(g.contours.major[i]).toBeCloseTo(1, 9);
  });

  it('κλειστή γραμμή 4 σημείων = 4 τμήματα · ανοιχτή = 3 · κύριες και δευτερεύουσες χωριστά', () => {
    const snapshot = { ...squareSnapshot(), contours: [contour(true, true), contour(false, false)] };
    const g = geometryOf(snapshot);
    expect(g.contours.major.length / 6).toBe(4);
    expect(g.contours.minor.length / 6).toBe(3);
  });

  it('οι ισοϋψείς του αληθινού στιγμιοτύπου βγαίνουν στον βορρά = −Z', () => {
    const snapshot = REAL_PLANE();
    const g = geometryOf(snapshot);
    const first = snapshot.contours.find((c) => c.major) ?? snapshot.contours[0];
    const target = first.major ? g.contours.major : g.contours.minor;
    expect(target[0]).toBeCloseTo(first.points[0], 4);
    expect(target[2]).toBeCloseTo(-first.points[1], 4);
  });
});

describe('buildTerrain3dGeometry — περίγραμμα οικοπέδου ντυμένο στο έδαφος (ADR-920 §14.11 Π7 · Ζ5)', () => {
  const withOutline = (ring: number[]): ListingTerrainSnapshot =>
    ({ ...REAL_PLANE(), plotOutline: { ring, areaM2: 100, coverage: 'covered', coveredFraction: 1 } });

  it('χωρίς περίγραμμα ⇒ κανένα τμήμα', () => {
    expect(geometryOf(REAL_PLANE()).plotOutline.length).toBe(0);
  });

  it('κάθε σημείο πατά στο έδαφος: Y = ύψος της επιφάνειας εκεί × υπερβολή (επίπεδο 10 % προς ανατολή)', () => {
    const g = geometryOf(withOutline([-5, -5, 5, -5, 5, 5, -5, 5]), 2);
    expect(g.plotOutline.length).toBeGreaterThan(0);
    expect(g.plotOutline.length % 6).toBe(0);
    for (let i = 0; i < g.plotOutline.length; i += 3) {
      const [x, y, z] = [g.plotOutline[i], g.plotOutline[i + 1], g.plotOutline[i + 2]];
      expect(y).toBeCloseTo(0.1 * (x + 10) * 2, 4);
      expect(Math.max(Math.abs(x), Math.abs(z))).toBeCloseTo(5, 4);
    }
  });

  it('κλείνει: το τελευταίο σημείο είναι το πρώτο', () => {
    const p = geometryOf(withOutline([-5, -5, 5, -5, 5, 5, -5, 5])).plotOutline;
    expect([p[p.length - 3], p[p.length - 2], p[p.length - 1]]).toEqual([p[0], p[1], p[2]]);
  });

  it('ό,τι πέφτει έξω από το ανάγλυφο ΔΕΝ σχεδιάζεται — κανένα επινοημένο υψόμετρο', () => {
    const p = geometryOf(withOutline([0, -5, 30, -5, 30, 5, 0, 5])).plotOutline;
    expect(p.length).toBeGreaterThan(0);
    for (let i = 0; i < p.length; i += 3) expect(p[i]).toBeLessThanOrEqual(10 + 1e-6);
  });
});
