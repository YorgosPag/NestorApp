/**
 * @fileoverview **ΑΠΟ ΤΑ ΠΛΑΙΣΙΑ ΠΡΟΣΩΠΩΝ ΣΤΟΥΣ ΚΥΚΛΟΥΣ ΤΗΣ ΣΦΑΙΡΑΣ** (ADR-884 Φ2ζ ζ4) — καθαρή γεωμετρία.
 *
 * - **Π** — πλαίσιο → κύκλος: κέντρο στην κατεύθυνση του κέντρου του πλαισίου (από **άλλο** δρόμο: `directionToCubeFace`),
 *   ακτίνα που σκεπάζει **κάθε** γωνία, με επικάλυψη όψης (uv εκτός [0,1]) σωστά.
 * - **Π** (ραφή/πόλος) — ίδια λογική στη ραφή ±π και στην πάνω όψη.
 * - **Ε** — περιγεγραμμένος κύκλος: περιέχει **κάθε** σημείο και των δύο (ανεξάρτητη δειγματοληψία), και δεν είναι σπάταλος.
 * - **Δ** — διπλά: το ίδιο πρόσωπο από δύο όψεις ⇒ ένα· γειτονικά πρόσωπα ⇒ δύο.
 * - **Χ** — «καλύπτεται ήδη» · χωρητικότητα: συγχώνευση ως το όριο, ποτέ πάνω από 45°, κορεσμός με τους μεγαλύτερους.
 */

import { TOUR_FACE_RADIUS_MARGIN, TOUR_REDACTION_MAX_RADIUS_RAD, TOUR_REDACTION_MIN_RADIUS_RAD } from '@/constants/spatial-tour-vocabulary';

import { cubeFaceUvToDirection, directionToCubeFace, directionToYawPitch, yawPitchToDirection } from '../../viewer/tour-cube-faces';
import { faceUvOfPixel } from '../equirect-to-cube';
import { distinctFaces, enclosingRegion, faceOnSphereOf, fitRegions, isCoveredBy, type FaceRaster } from '../tour-face-regions';
import { angularDistance } from '../tour-redaction-mask';

const region = (yawRad: number, pitchRad: number, radiusRad: number) => ({ yawRad, pitchRad, radiusRad });
const dist = (a: { yawRad: number; pitchRad: number }, b: { yawRad: number; pitchRad: number }) =>
  angularDistance(a.yawRad, a.pitchRad, b.yawRad, b.pitchRad);

/** Το pixel μιας απόδοσης όπου πέφτει μια κατεύθυνση — από το **αντίστροφο** δρόμο (όψη + uv), όχι από τον κώδικα υπό έλεγχο. */
function pixelOf(raster: FaceRaster, yaw: number, pitch: number): { x: number; y: number } {
  const { face, u, v } = directionToCubeFace(yawPitchToDirection(yaw, pitch));
  expect(face).toBe(raster.face);
  const span = 1 + 2 * raster.overscan;
  return { x: ((u + raster.overscan) / span) * raster.size, y: ((1 + raster.overscan - v) / span) * raster.size };
}

describe('Π — πλαίσιο όψης → κύκλος στη σφαίρα', () => {
  it.each([
    ['κέντρο εμπρός, χωρίς επικάλυψη', { face: 'front', size: 512, overscan: 0 }, 0, 0],
    ['εμπρός, με επικάλυψη 0,1', { face: 'front', size: 512, overscan: 0.1 }, 0.3, -0.2],
    ['πίσω όψη, πάνω στη ραφή ±π', { face: 'back', size: 640, overscan: 0.1 }, Math.PI - 0.01, 0.1],
    ['πάνω όψη, κοντά στον πόλο', { face: 'up', size: 256, overscan: 0.1 }, 1, 1.35],
  ] as const)('%s: το κέντρο πέφτει στο πρόσωπο, η ακτίνα σκεπάζει ΚΑΘΕ γωνία (× περιθώριο)', (_, raster, yaw, pitch) => {
    const centre = pixelOf(raster, yaw, pitch);
    const box = { x: centre.x - 20, y: centre.y - 25, w: 40, h: 50, score: 0.9 };
    const circle = faceOnSphereOf(raster, box);
    expect(dist(circle, { yawRad: yaw, pitchRad: pitch })).toBeLessThan(1e-9);
    const corners = [[box.x, box.y], [box.x + box.w, box.y], [box.x, box.y + box.h], [box.x + box.w, box.y + box.h]];
    const reach = Math.max(...corners.map(([x, y]) => {
      const { u, v } = faceUvOfPixel(x, y, raster.size, raster.overscan);
      const d = directionToYawPitch(cubeFaceUvToDirection(raster.face, u, v));
      return dist(circle, { yawRad: d.yaw, pitchRad: d.pitch });
    }));
    expect(circle.radiusRad).toBeCloseTo(reach * TOUR_FACE_RADIUS_MARGIN, 9);
    expect(circle.score).toBe(0.9);
  });

  it('σύσφιξη: τεράστιο πλαίσιο ⇒ ποτέ πάνω από 45° · μικροσκοπικό ⇒ ποτέ κάτω από το ελάχιστο', () => {
    const raster = { face: 'front', size: 512, overscan: 0.1 } as const;
    expect(faceOnSphereOf(raster, { x: -50, y: -50, w: 612, h: 612, score: 1 }).radiusRad).toBe(TOUR_REDACTION_MAX_RADIUS_RAD);
    expect(faceOnSphereOf(raster, { x: 256, y: 256, w: 0.01, h: 0.01, score: 1 }).radiusRad).toBe(TOUR_REDACTION_MIN_RADIUS_RAD);
  });
});

describe('Ε — περιγεγραμμένος κύκλος', () => {
  /** Δείγματα **πάνω στο όριο** ενός κύκλου — ανεξάρτητα από τον τύπο του περιγεγραμμένου. */
  function rim(c: { yawRad: number; pitchRad: number; radiusRad: number }): { yawRad: number; pitchRad: number }[] {
    const centre = yawPitchToDirection(c.yawRad, c.pitchRad);
    const helper = Math.abs(centre.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
    const cross = (a: typeof centre, b: typeof centre) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
    const e1 = cross(centre, helper);
    const n1 = Math.hypot(e1.x, e1.y, e1.z);
    const u = { x: e1.x / n1, y: e1.y / n1, z: e1.z / n1 };
    const w = cross(centre, u);
    return Array.from({ length: 64 }, (_, k) => {
      const t = (2 * Math.PI * k) / 64;
      const [cr, sr] = [Math.cos(c.radiusRad), Math.sin(c.radiusRad)];
      const d = { x: cr * centre.x + sr * (Math.cos(t) * u.x + Math.sin(t) * w.x), y: cr * centre.y + sr * (Math.cos(t) * u.y + Math.sin(t) * w.y), z: cr * centre.z + sr * (Math.cos(t) * u.z + Math.sin(t) * w.z) };
      const yp = directionToYawPitch(d);
      return { yawRad: yp.yaw, pitchRad: yp.pitch };
    });
  }

  it.each([
    ['δύο ξένοι στον ισημερινό', region(0, 0, 0.1), region(0.5, 0, 0.2)],
    ['πάνω στη ραφή ±π', region(Math.PI - 0.05, 0.2, 0.05), region(-Math.PI + 0.1, 0.1, 0.08)],
    ['κοντά στον πόλο', region(0, 1.4, 0.1), region(2, 1.3, 0.1)],
  ])('%s: περιέχει κάθε σημείο και των δύο, με ακτίνα (d + r₁ + r₂)/2', (_, a, b) => {
    const merged = enclosingRegion(a, b);
    for (const p of [...rim(a), ...rim(b)]) expect(dist(merged, p)).toBeLessThanOrEqual(merged.radiusRad + 1e-9);
    expect(merged.radiusRad).toBeCloseTo((dist(a, b) + a.radiusRad + b.radiusRad) / 2, 9);
  });

  it('ο ένας μέσα στον άλλο ⇒ ο μεγάλος αυτούσιος', () => {
    const big = region(0, 0, 0.5);
    expect(enclosingRegion(big, region(0.1, 0, 0.1))).toBe(big);
    expect(enclosingRegion(region(0.1, 0, 0.1), big)).toBe(big);
  });
});

describe('Δ — ένα πρόσωπο, μία φορά', () => {
  it('το ίδιο πρόσωπο από δύο όψεις/κλίμακες ⇒ ΕΝΑΣ κύκλος που τα σκεπάζει και τα δύο · κρατά τον μεγαλύτερο βαθμό', () => {
    const faces = distinctFaces([{ ...region(0.7854, 0, 0.05), score: 0.7 }, { ...region(0.79, 0.003, 0.06), score: 0.9 }]);
    expect(faces).toHaveLength(1);
    expect(faces[0].score).toBe(0.9);
    expect(isCoveredBy(region(0.7854, 0, 0.05), faces)).toBe(true);
    expect(isCoveredBy(region(0.79, 0.003, 0.06), faces)).toBe(true);
  });

  it('γειτονικά πρόσωπα (απόσταση ≈ μία ακτίνα) ⇒ δύο κύκλοι', () => {
    expect(distinctFaces([{ ...region(0, 0, 0.05), score: 0.9 }, { ...region(0.05, 0, 0.05), score: 0.8 }])).toHaveLength(2);
  });
});

describe('Χ — κάλυψη και χωρητικότητα', () => {
  it('«καλύπτεται» μόνο όταν χωρά ΟΛΟΚΛΗΡΟΣ', () => {
    expect(isCoveredBy(region(0.1, 0, 0.1), [region(0, 0, 0.25)])).toBe(true);
    expect(isCoveredBy(region(0.1, 0, 0.2), [region(0, 0, 0.25)])).toBe(false);
    expect(isCoveredBy(region(0, 0, 0.1), [])).toBe(false);
  });

  it('χωρούν ⇒ αυτούσιοι, κανένας κορεσμός', () => {
    const list = [region(0, 0, 0.1), region(1, 0, 0.1)];
    expect(fitRegions(list, 2)).toEqual({ regions: list, saturated: false });
  });

  it('πάνω από το όριο ⇒ ενώνονται πρώτα οι ΚΟΝΤΙΝΟΤΕΡΟΙ · κάθε αρχικός μένει σκεπασμένος', () => {
    const list = [region(0, 0, 0.05), region(0.12, 0, 0.05), region(2, 0, 0.05)];
    const fitted = fitRegions(list, 2);
    expect(fitted.saturated).toBe(false);
    expect(fitted.regions).toHaveLength(2);
    for (const r of list) expect(isCoveredBy(r, fitted.regions.map((f) => ({ ...f, radiusRad: f.radiusRad + 1e-9 })))).toBe(true);
    expect(fitted.regions.find((f) => Math.abs(f.yawRad - 2) < 1e-9)).toEqual(region(2, 0, 0.05));
  });

  it('ποτέ ένωση πάνω από 45° · δεν χωρούν ⇒ κορεσμός με τους ΜΕΓΑΛΥΤΕΡΟΥΣ', () => {
    const list = [region(0, 0, 0.1), region(2.1, 0, 0.3), region(-2.1, 0, 0.2)];
    const fitted = fitRegions(list, 2);
    expect(fitted.saturated).toBe(true);
    expect(fitted.regions.map((r) => r.radiusRad)).toEqual([0.3, 0.2]);
    expect(fitRegions(list, 0)).toEqual({ regions: [], saturated: true });
  });
});
