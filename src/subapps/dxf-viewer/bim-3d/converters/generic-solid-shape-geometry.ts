/**
 * generic-solid-shape-geometry — `GenericSolidShape` → `THREE.BufferGeometry` (ADR-684 Φ2).
 *
 * Καθαρές συναρτήσεις: κάθε σχήμα → THREE geometry σε **μέτρα**, μαζί με `baseOffsetM` = πόσο πρέπει
 * να ανέβει το mesh ώστε η **βάση** του να πατά στο επίπεδο τοποθέτησης (οι THREE primitives είναι
 * κεντραρισμένες στην αρχή). Καμία γνώση placement/υλικού/tagging εδώ — αυτά ζουν στον converter.
 *
 * Μονάδες: όλες οι διαστάσεις εισόδου σε mm (SSoT), έξοδος σε μέτρα (THREE world).
 *
 * @see ./generic-solid-to-three — ο converter που τα τοποθετεί
 * @see ../../bim/entities/generic-solid/generic-solid-types — GenericSolidShape
 */

import * as THREE from 'three';
import type { GenericSolidShape } from '../../bim/entities/generic-solid/generic-solid-types';

const MM_TO_M = 0.001;

/** Ραδιακά τμήματα για στρογγυλά σχήματα (ισορροπία ποιότητας/κόστους). */
const RADIAL_SEGMENTS = 32;
const SPHERE_WIDTH_SEGMENTS = 24;
const SPHERE_HEIGHT_SEGMENTS = 16;
const TORUS_RADIAL_SEGMENTS = 16;
const TORUS_TUBULAR_SEGMENTS = 32;

/** Το αποτέλεσμα του builder — geometry + πόσο να ανέβει ώστε η βάση να πατά στο mounting plane. */
export interface GenericSolidShapeGeometry {
  readonly geometry: THREE.BufferGeometry;
  /** m. `mesh.position.y = mountingY + baseOffsetM` → βάση στο επίπεδο τοποθέτησης. */
  readonly baseOffsetM: number;
}

/** Χτίζει THREE geometry (μέτρα) για το σχήμα. Ο καλών κατέχει το dispose. */
export function buildGenericSolidShapeGeometry(shape: GenericSolidShape): GenericSolidShapeGeometry {
  switch (shape.kind) {
    case 'box': {
      const h = shape.heightMm * MM_TO_M;
      // THREE BoxGeometry(x=width, y=height, z=depth).
      return {
        geometry: new THREE.BoxGeometry(shape.widthMm * MM_TO_M, h, shape.depthMm * MM_TO_M),
        baseOffsetM: h / 2,
      };
    }
    case 'sphere': {
      const r = shape.radiusMm * MM_TO_M;
      return {
        geometry: new THREE.SphereGeometry(r, SPHERE_WIDTH_SEGMENTS, SPHERE_HEIGHT_SEGMENTS),
        baseOffsetM: r,
      };
    }
    case 'cylinder': {
      const h = shape.heightMm * MM_TO_M;
      const r = shape.radiusMm * MM_TO_M;
      return { geometry: new THREE.CylinderGeometry(r, r, h, RADIAL_SEGMENTS), baseOffsetM: h / 2 };
    }
    case 'cone': {
      const h = shape.heightMm * MM_TO_M;
      // CylinderGeometry(radiusTop, radiusBottom, …) — rTop=0 → πλήρης κώνος.
      return {
        geometry: new THREE.CylinderGeometry(
          shape.radiusTopMm * MM_TO_M,
          shape.radiusBottomMm * MM_TO_M,
          h,
          RADIAL_SEGMENTS,
        ),
        baseOffsetM: h / 2,
      };
    }
    case 'torus': {
      const tube = shape.tubeRadiusMm * MM_TO_M;
      const geometry = new THREE.TorusGeometry(
        shape.majorRadiusMm * MM_TO_M,
        tube,
        TORUS_RADIAL_SEGMENTS,
        TORUS_TUBULAR_SEGMENTS,
      );
      // TorusGeometry κείται στο XY (οπή κατά Z)· περιστροφή X ώστε να «ξαπλώσει» (οπή κατά Y).
      geometry.rotateX(Math.PI / 2);
      return { geometry, baseOffsetM: tube };
    }
    case 'pyramid': {
      const h = shape.heightMm * MM_TO_M;
      return {
        geometry: buildPyramidGeometry(shape.baseWidthMm * MM_TO_M, shape.baseDepthMm * MM_TO_M, h),
        baseOffsetM: h / 2,
      };
    }
    case 'disc': {
      const t = shape.thicknessMm * MM_TO_M;
      const r = shape.radiusMm * MM_TO_M;
      return { geometry: new THREE.CylinderGeometry(r, r, t, RADIAL_SEGMENTS), baseOffsetM: t / 2 };
    }
    case 'prism': {
      const h = shape.heightMm * MM_TO_M;
      const r = shape.radiusMm * MM_TO_M;
      return { geometry: new THREE.CylinderGeometry(r, r, h, shape.sides), baseOffsetM: h / 2 };
    }
  }
}

/**
 * Ορθογωνική πυραμίδα, κεντραρισμένη (βάση στο y=-h/2, κορυφή στο +h/2). Non-indexed ώστε το
 * `computeVertexNormals` να δώσει flat-shaded όψεις με σωστές (εξωστρεφείς) κανονικές.
 */
function buildPyramidGeometry(widthM: number, depthM: number, heightM: number): THREE.BufferGeometry {
  const hw = widthM / 2;
  const hd = depthM / 2;
  const hh = heightM / 2;
  const a: [number, number, number] = [-hw, -hh, -hd];
  const b: [number, number, number] = [hw, -hh, -hd];
  const c: [number, number, number] = [hw, -hh, hd];
  const d: [number, number, number] = [-hw, -hh, hd];
  const p: [number, number, number] = [0, hh, 0];
  // Εξωστρεφής περιέλιξη (βλ. τεκμηρίωση στο ADR-684): βάση κάτω, 4 τριγωνικές όψεις.
  const tris = [a, b, c, a, c, d, b, a, p, c, b, p, d, c, p, a, d, p];
  const positions = new Float32Array(tris.flat());
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}
