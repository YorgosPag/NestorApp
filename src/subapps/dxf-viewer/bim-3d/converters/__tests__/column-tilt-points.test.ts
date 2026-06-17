/**
 * ADR-404 Bug A — `applyColumnTiltToPoints` SSoT (point-shear για InstancedMesh rebar).
 *
 * Επαληθεύει ότι ο κλωβός οπλισμού shear-άρεται με την ΙΔΙΑ μαθηματική (columnTiltShearAt)
 * όπως ο πυρήνας/σοβάς, ΚΑΙ ότι κοινά endpoints (spiral chains) shear-άρονται ΜΙΑ φορά
 * (dedup-by-reference) — το bug που θα διπλασίαζε το shear σε σπειροειδείς συνδετήρες.
 */

import * as THREE from 'three';
import { applyColumnTiltToPoints } from '../mesh-slope-shear';
import { buildDefaultColumnParams } from '../../../hooks/drawing/column-completion';
import type { ColumnParams } from '../../../bim/types/column-types';

function params(tilt?: { angle: number; direction: number }): ColumnParams {
  return { ...buildDefaultColumnParams({ x: 0, y: 0 }, 'rectangular'), ...(tilt ? { tilt } : {}) };
}

describe('applyColumnTiltToPoints (ADR-404 Bug A)', () => {
  it('shear +X ανάλογο του ύψους (direction 0, 45° → dx = height·tan45 = height)', () => {
    const base = new THREE.Vector3(0, 0, 0); // στη βάση → αμετάβλητο
    const top = new THREE.Vector3(0, 2, 0); // 2m πάνω → +2 σε X
    applyColumnTiltToPoints([base, top], params({ angle: 45, direction: 0 }), 0);
    expect(base.x).toBeCloseTo(0, 6);
    expect(top.x).toBeCloseTo(2, 6);
    expect(top.z).toBeCloseTo(0, 6);
  });

  it('baseY datum: ύψος-πάνω-από-βάση = p.y − baseY', () => {
    const v = new THREE.Vector3(0, 5, 0);
    applyColumnTiltToPoints([v], params({ angle: 45, direction: 0 }), 3); // height above base = 2
    expect(v.x).toBeCloseTo(2, 6);
  });

  it('DEDUP: κοινό endpoint (spiral chain) shear-άρεται ΜΙΑ φορά, όχι δύο', () => {
    const shared = new THREE.Vector3(0, 2, 0);
    // Το ίδιο reference εμφανίζεται 3 φορές (όπως seg[i].b === seg[i+1].a στο spiral).
    applyColumnTiltToPoints([shared, shared, shared], params({ angle: 45, direction: 0 }), 0);
    expect(shared.x).toBeCloseTo(2, 6); // 2, ΟΧΙ 6
  });

  it('flat fast-path: χωρίς tilt → no-op', () => {
    const v = new THREE.Vector3(1, 2, 3);
    applyColumnTiltToPoints([v], params(), 0);
    expect(v.x).toBeCloseTo(1, 6);
    expect(v.z).toBeCloseTo(3, 6);
  });
});
