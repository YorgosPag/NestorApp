/**
 * ADR-650 M8β/Γ — auto-breakline candidates → 3Δ γραμμές.
 *
 * Δύο πράγματα ελέγχονται εδώ, και κανένα από τα δύο δεν το πιάνει ο compiler:
 *
 *   1. **Η κατάταξη σε κάδους.** Η εστιασμένη ΔΕΝ μένει και στον κάδο έγκρισής της· αν έμενε, θα
 *      σχεδιαζόταν δύο φορές και θα z-fight-αρε με τον εαυτό της. Και το `focusedId` πρέπει να
 *      φτάνει ΩΣ ΕΔΩ: αν το ρίξει κάποιο ενδιάμεσο επίπεδο, τα σχήματα βγαίνουν σωστά, το χρώμα
 *      είναι σωστό, κανένα test δεν κοκκινίζει — απλώς η έμφαση δεν εμφανίζεται ποτέ. Είναι
 *      ακριβώς η παγίδα που κατάπιε το `selected` του ⊙ στο M5α.2.
 *   2. **Το υψόμετρο είναι ΑΝΑ ΚΟΡΥΦΗ.** Μια γραμμή ασυνέχειας ανεβαίνει — σε αντίθεση με μια
 *      ισοϋψή. Ένα κοινό (σταθερό) υψόμετρο θα την ισοπέδωνε πάνω στο έδαφος και θα φαινόταν
 *      «σχεδόν σωστή», που είναι το χειρότερο είδος λάθους σε αποτύπωση.
 */

import { autoBreaklineCandidatesToGeometries } from '../auto-breakline-to-three';
import type { AutoBreaklineCandidate } from '../../../systems/topography/auto-breaklines/auto-breakline-types';
import type { WorldToDisplayProjector } from '../../../systems/geo-referencing/geo-transform';

/** Δύο κορυφές με ΔΙΑΦΟΡΕΤΙΚΟ z → ένα τμήμα (6 αριθμοί). */
function candidate(id: string, z0 = 0, z1 = 3_000): AutoBreaklineCandidate {
  return {
    id,
    vertices: [{ x: 0, y: 0, z: z0 }, { x: 2_000, y: 5_000, z: z1 }],
    closed: false,
    lengthMm: 5_385,
    avgFoldDeg: 40,
    edgeCount: 1,
  };
}

function positions(geometry: { getAttribute(name: string): { array: ArrayLike<number> } } | null): number[] {
  return geometry ? Array.from(geometry.getAttribute('position').array) : [];
}

/** Οι εστιασμένοι κάδοι είναι ωμά buffers (τροφή του fat-line pipeline), όχι geometries. */
function flat(buffer: Float32Array | null): number[] {
  return buffer ? Array.from(buffer) : [];
}

/** Ανοιχτή αλυσίδα από κορυφές σε κάτοψη (z=0), για τους ελέγχους των γωνιακών σημαδιών. */
function chain(id: string, plan: readonly (readonly [number, number])[]): AutoBreaklineCandidate {
  return {
    ...candidate(id),
    vertices: plan.map(([x, y]) => ({ x, y, z: 0 })),
    edgeCount: plan.length - 1,
  };
}

describe('autoBreaklineCandidatesToGeometries', () => {
  it('splits candidates by approval', () => {
    const result = autoBreaklineCandidatesToGeometries(
      [candidate('a'), candidate('b')], new Set(['a']), null,
    );
    expect(positions(result.approved)).toHaveLength(6);
    expect(positions(result.rejected)).toHaveLength(6);
    expect(result.focused).toBeNull();
    expect(result.focusedVertices).toBeNull();
  });

  it('moves the focused candidate OUT of its approval bucket (never drawn twice)', () => {
    const result = autoBreaklineCandidatesToGeometries(
      [candidate('a'), candidate('b')], new Set(['a', 'b']), 'a',
    );
    expect(positions(result.approved)).toHaveLength(6); // μόνο η «b»
    expect(flat(result.focused)).toHaveLength(6);       // μόνο η «a»
    expect(result.rejected).toBeNull();
  });

  it('focuses a REJECTED candidate too — έγκριση και εστίαση είναι ανεξάρτητες', () => {
    const result = autoBreaklineCandidatesToGeometries([candidate('a')], new Set(), 'a');
    expect(flat(result.focused)).toHaveLength(6);
    expect(result.rejected).toBeNull();
  });

  it('δίνει την εστιασμένη ως ΩΜΟ Float32Array — τροφή του LineSegmentsGeometry.setPositions', () => {
    // Αν ξαναγίνει BufferGeometry, ο layer θα το περάσει άθικτο και η fat line θα βγει άδεια:
    // το `setPositions` δέχεται πίνακα, όχι geometry — και δεν παραπονιέται, απλώς δεν σχεδιάζει.
    const result = autoBreaklineCandidatesToGeometries([candidate('a')], new Set(), 'a');
    expect(result.focused).toBeInstanceOf(Float32Array);
    expect(result.focusedVertices).toBeInstanceOf(Float32Array);
  });

  it('σημαδεύει ΜΟΝΟ τα άκρα σε ευθεία αλυσίδα — όχι κάθε κορυφή τριγωνοποίησης', () => {
    // Πέντε συνευθειακές κορυφές: οι τρεις ενδιάμεσες είναι αρθρώσεις του TIN, όχι γωνίες του
    // εδάφους. Πριν το v2 σχεδιάζονταν και οι πέντε (και δύο φορές η καθεμιά) — σε πραγματική
    // οριογραμμή 50+ κορυφών αυτό είναι ταινία θορύβου, όχι έμφαση.
    const straight = chain('a', [[0, 0], [1_000, 0], [2_000, 0], [3_000, 0], [4_000, 0]]);
    const result = autoBreaklineCandidatesToGeometries([straight], new Set(), 'a');
    expect(flat(result.focusedVertices)).toHaveLength(6);        // 2 άκρα × XYZ
    expect(flat(result.focused)).toHaveLength(4 * 6);            // 4 τμήματα × 2 κορυφές × XYZ
  });

  it('προσθέτει σημάδι εκεί που η αλυσίδα ΟΝΤΩΣ στρίβει', () => {
    const dogLeg = chain('a', [[0, 0], [1_000, 0], [2_000, 0], [2_000, 2_000], [2_000, 3_000]]);
    // Άκρα (0, 4) + η στροφή 90° στην κορυφή 2 — η κορυφή 1 και η 3 είναι ευθείες.
    // (east→x, elev→y, north→−z, μέτρα — ίδιος άξονας με τους υπόλοιπους ελέγχους παρακάτω.)
    expect(flat(autoBreaklineCandidatesToGeometries([dogLeg], new Set(), 'a').focusedVertices))
      .toEqual([0, 0, 0, 2, 0, 0, 2, 0, -3]);
  });

  it('carries a REAL elevation per vertex (east→x, elev→y, north→−z, metres)', () => {
    const result = autoBreaklineCandidatesToGeometries([candidate('a', 1_000, 4_000)], new Set(['a']), null);
    // κορυφή 0: (0mm, 0mm, 1000mm) · κορυφή 1: (2000mm, 5000mm, 4000mm)
    expect(positions(result.approved)).toEqual([0, 1, 0, 2, 4, -5]);
  });

  it('subtracts the project datum, so the line seats ON the building like the terrain mesh', () => {
    const result = autoBreaklineCandidatesToGeometries(
      [candidate('a', 106_000, 106_000)], new Set(['a']), null, { datumMm: 100_000 },
    );
    expect(positions(result.approved)[1]).toBeCloseTo(6, 9); // 106 μ − 100 μ datum
  });

  it('applies the geo projector before the axis swap', () => {
    const projector = {
      isIdentity: false,
      project: (x: number, y: number) => ({ x: x - 500_000_000, y: y - 4_200_000_000 }),
    } as WorldToDisplayProjector;
    const world = candidate('a');
    const shifted: AutoBreaklineCandidate = {
      ...world,
      vertices: world.vertices.map((v) => ({ ...v, x: v.x + 500_000_000, y: v.y + 4_200_000_000 })),
    };
    const result = autoBreaklineCandidatesToGeometries([shifted], new Set(['a']), null, { projector });
    expect(positions(result.approved)).toEqual(
      positions(autoBreaklineCandidatesToGeometries([world], new Set(['a']), null).approved),
    );
  });

  it('drops a segment with a non-finite end rather than drawing a line to the origin', () => {
    const broken: AutoBreaklineCandidate = {
      ...candidate('a'),
      vertices: [{ x: 0, y: 0, z: 0 }, { x: Number.NaN, y: 0, z: 0 }, { x: 3_000, y: 0, z: 0 }],
    };
    // Μένει ΜΟΝΟ το τμήμα που δεν αγγίζει το NaN — δηλαδή κανένα από τα δύο.
    expect(positions(autoBreaklineCandidatesToGeometries([broken], new Set(['a']), null).approved)).toHaveLength(0);
  });

  it('closes a ring (last → first) — a pond rim is not an open chain', () => {
    const ring: AutoBreaklineCandidate = {
      ...candidate('a'),
      closed: true,
      vertices: [{ x: 0, y: 0, z: 0 }, { x: 1_000, y: 0, z: 0 }, { x: 0, y: 1_000, z: 0 }],
    };
    expect(positions(autoBreaklineCandidatesToGeometries([ring], new Set(['a']), null).approved)).toHaveLength(18);
  });
});
