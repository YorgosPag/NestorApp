/**
 * ADR-689 Φ3 — `computeTriangleEdgeMasks`: ποιες ακμές είναι «πραγματικές».
 *
 * Το κρίσιμο ερώτημα που απαντά αυτό το test: **κρύβεται η εσωτερική διαγώνιος τριγωνοποίησης;**
 * Αυτή είναι όλη η διαφορά ανάμεσα στη ματιά AutoCAD (κάθε τριγωνάκι) και στη ματιά
 * Revit/ArchiCAD/C4D (μόνο οι σχεδιαστικά υπαρκτές ακμές).
 */

import * as THREE from 'three';
import {
  computeTriangleEdgeMasks,
  EDGE_MASK_ALL,
  TRIANGLE_CORNERS,
} from '../mesh-wire-adjacency';
import { MESH_WIRE_FEATURE_ANGLE_DEG } from '../../../config/bim-visual-style';

/** Πόσα bits είναι αναμμένα (πόσες ακμές του τριγώνου δείχνονται). */
function popcount(mask: number): number {
  let n = 0;
  for (let i = 0; i < TRIANGLE_CORNERS; i++) if (mask & (1 << i)) n++;
  return n;
}

/** Οι non-indexed θέσεις μιας three γεωμετρίας. */
function positionsOf(geometry: THREE.BufferGeometry): Float32Array {
  const flat = geometry.getIndex() ? geometry.toNonIndexed() : geometry;
  return flat.getAttribute('position').array as Float32Array;
}

describe('computeTriangleEdgeMasks', () => {
  it('κύβος → κάθε τρίγωνο δείχνει 2 ακμές· η διαγώνιος κάθε έδρας κρύβεται', () => {
    const masks = computeTriangleEdgeMasks(
      positionsOf(new THREE.BoxGeometry(1, 1, 1)),
      MESH_WIRE_FEATURE_ANGLE_DEG,
    );

    // 6 έδρες × 2 τρίγωνα. Κάθε τρίγωνο έχει 2 περιμετρικές ακμές (90° crease) + 1 διαγώνιο (0°).
    expect(masks).toHaveLength(12);
    for (const mask of masks) expect(popcount(mask)).toBe(2);
    // Οι 12 ακμές του κύβου, μία φορά ανά τρίγωνο που τις αγγίζει = 24 αναμμένα bits.
    expect(masks.reduce((sum, m) => sum + popcount(m), 0)).toBe(24);
  });

  it('επίπεδο τετράγωνο (2 τρίγωνα) → 4 σύνορα ορατά, η διαγώνιος κρυφή', () => {
    // Δύο τρίγωνα που μοιράζονται τη διαγώνιο (0,0)-(1,1), εντελώς επίπεδα.
    const positions = new Float32Array([
      0, 0, 0, 1, 0, 0, 1, 1, 0,
      0, 0, 0, 1, 1, 0, 0, 1, 0,
    ]);

    const masks = computeTriangleEdgeMasks(positions, MESH_WIRE_FEATURE_ANGLE_DEG);

    expect(masks).toHaveLength(2);
    expect(popcount(masks[0]!)).toBe(2);
    expect(popcount(masks[1]!)).toBe(2);
  });

  it('τσάκιση 90° → η κοινή ακμή ΔΕΝ κρύβεται (δεν είναι διαγώνιος, είναι γωνία)', () => {
    // Δύο τρίγωνα κάθετα μεταξύ τους, με κοινή ακμή (0,0,0)-(1,0,0).
    const positions = new Float32Array([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      0, 0, 0, 0, 0, 1, 1, 0, 0,
    ]);

    const masks = computeTriangleEdgeMasks(positions, MESH_WIRE_FEATURE_ANGLE_DEG);

    expect(masks[0]).toBe(EDGE_MASK_ALL);
    expect(masks[1]).toBe(EDGE_MASK_ALL);
  });

  it('μονό τρίγωνο → και οι τρεις ακμές είναι σύνορα, άρα ορατές', () => {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);

    expect(computeTriangleEdgeMasks(positions, MESH_WIRE_FEATURE_ANGLE_DEG)[0]).toBe(EDGE_MASK_ALL);
  });

  it('το κατώφλι μετράει: ίδια ~10° τσάκιση κρύβεται στις 30° και φαίνεται στις 5°', () => {
    // Δύο τρίγωνα με κοινή τη διαγώνιο (0,0,0)-(1,1,0)· το ύψος 0.1247 δίνει δίεδρη γωνία ~10°.
    const positions = new Float32Array([
      0, 0, 0, 1, 0, 0, 1, 1, 0,
      0, 0, 0, 1, 1, 0, 0, 1, 0.1247,
    ]);

    // 10° < 30° → ήπια τσάκιση, σχεδιαστικά ασήμαντη → κρύβεται (2 από 3 ακμές μένουν).
    const coarse = computeTriangleEdgeMasks(positions, MESH_WIRE_FEATURE_ANGLE_DEG);
    expect(popcount(coarse[0]!)).toBe(2);
    // 10° > 5° → με αυστηρότερο κατώφλι η ίδια τσάκιση περνά ως ακμή.
    const fine = computeTriangleEdgeMasks(positions, 5);
    expect(fine[0]).toBe(EDGE_MASK_ALL);
  });

  it('κενή είσοδος → κενή έξοδος (καμία εξαίρεση)', () => {
    expect(computeTriangleEdgeMasks(new Float32Array([]), MESH_WIRE_FEATURE_ANGLE_DEG)).toHaveLength(0);
  });
});
