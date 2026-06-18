/**
 * 3D frame element stiffness — pure SSoT (ADR-481, T3 / S3).
 *
 * Στοιχειακό μητρώο δυσκαμψίας μέλους χωρικού πλαισίου (Euler-Bernoulli):
 * τοπικό 12×12 (αξονικό + στρέψη + 2 κάμψεις) + μετασχηματισμός τοπικού→ολικού
 * μέσω ορθοκανονικού τριάδου αξόνων από τα άκρα i→j.
 *
 * DOF ανά κόμβο (τοπικά & ολικά): [u_x, u_y, u_z, θ_x, θ_y, θ_z]. Στοιχείο = 12
 * DOF (i:0-5, j:6-11). Μονάδες: E,G σε kN/m²· A σε m²· I,J σε m⁴· L σε m.
 *
 * Pure — zero React/DOM/Firestore.
 *
 * @see ./member-section-properties.ts — E/A/I/J/G
 * @see ./dense-matrix.ts — matMul/transpose για k_global = Tᵀ·k_local·T
 * @see ./global-assembly.ts — ο καταναλωτής
 */

import { matMul, transpose, zeroMatrix, type Matrix, type MutableMatrix } from './dense-matrix';
import type { AnalyticalPoint3D } from '../analytical-model-types';
import type { MemberSectionProperties } from './member-section-properties';

/** DOF ανά κόμβο (3 μεταφορικοί + 3 στροφικοί). */
export const DOF_PER_NODE = 6;
/** DOF ανά στοιχείο (2 κόμβοι × 6). */
export const DOF_PER_ELEMENT = 2 * DOF_PER_NODE;

/** Διάνυσμα 3D (τοπικός άξονας). */
type Vec3 = readonly [number, number, number];

/** Πλήρες στοιχειακό αποτέλεσμα: τοπικό/ολικό μητρώο + μετασχηματισμός + μήκος. */
export interface ElementStiffness {
  readonly lengthM: number;
  readonly kLocal: Matrix;
  readonly kGlobal: Matrix;
  /** Μετασχηματισμός T (12×12): u_local = T·u_global. */
  readonly transform: Matrix;
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize(v: Vec3): Vec3 {
  const n = Math.hypot(v[0], v[1], v[2]);
  return n > 0 ? [v[0] / n, v[1] / n, v[2] / n] : [0, 0, 0];
}

/**
 * Ορθοκανονικός τριάδος αξόνων {ex, ey, ez} + μήκος. ex = άξονας i→j. Κατακόρυφο
 * μέλος (ex ≈ ±global-Z) → reference = global-X· αλλιώς reference = global-Z.
 * ey = ⊥ στο επίπεδο (ref, ex)· ez = ex×ey (δεξιόστροφο).
 */
function localAxes(pi: AnalyticalPoint3D, pj: AnalyticalPoint3D): { ex: Vec3; ey: Vec3; ez: Vec3; lengthM: number } {
  const dx = pj.xM - pi.xM, dy = pj.yM - pi.yM, dz = pj.zM - pi.zM;
  const lengthM = Math.hypot(dx, dy, dz);
  const ex = normalize([dx, dy, dz]);
  const up: Vec3 = Math.abs(ex[2]) > 0.999 ? [1, 0, 0] : [0, 0, 1];
  const ey = normalize(cross(up, ex));
  const ez = cross(ex, ey);
  return { ex, ey, ez, lengthM };
}

/** Block-diagonal 12×12 με τον 3×3 πίνακα στροφής R επαναλαμβανόμενο 4 φορές. */
function buildTransform(r: readonly Vec3[]): MutableMatrix {
  const t = zeroMatrix(DOF_PER_ELEMENT);
  for (let block = 0; block < 4; block++) {
    const o = block * 3;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) t[o + i][o + j] = r[i][j];
    }
  }
  return t;
}

/** Αξονικό: EA/L στους DOF u_x (0, 6). */
function fillAxial(k: MutableMatrix, ea_L: number): void {
  k[0][0] += ea_L; k[6][6] += ea_L; k[0][6] -= ea_L; k[6][0] -= ea_L;
}

/** Στρέψη: GJ/L στους DOF θ_x (3, 9). */
function fillTorsion(k: MutableMatrix, gj_L: number): void {
  k[3][3] += gj_L; k[9][9] += gj_L; k[3][9] -= gj_L; k[9][3] -= gj_L;
}

/** Κάμψη περί z (επίπεδο x-y): DOF u_y (1,7) & θ_z (5,11), ιδιότητα Iz. */
function fillBendingZ(k: MutableMatrix, ei: number, l: number): void {
  const a = 12 * ei / l ** 3, b = 6 * ei / l ** 2, c = 4 * ei / l, d = 2 * ei / l;
  const idx = [1, 5, 7, 11];
  const blk = [
    [a, b, -a, b], [b, c, -b, d], [-a, -b, a, -b], [b, d, -b, c],
  ];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) k[idx[i]][idx[j]] += blk[i][j];
}

/** Κάμψη περί y (επίπεδο x-z): DOF u_z (2,8) & θ_y (4,10), ιδιότητα Iy (αντίθετα πρόσημα coupling). */
function fillBendingY(k: MutableMatrix, ei: number, l: number): void {
  const a = 12 * ei / l ** 3, b = 6 * ei / l ** 2, c = 4 * ei / l, d = 2 * ei / l;
  const idx = [2, 4, 8, 10];
  const blk = [
    [a, -b, -a, -b], [-b, c, b, d], [-a, b, a, b], [-b, d, b, c],
  ];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) k[idx[i]][idx[j]] += blk[i][j];
}

/** Τοπικό 12×12 μητρώο δυσκαμψίας από ιδιότητες + μήκος. */
function localStiffness(props: MemberSectionProperties, l: number): MutableMatrix {
  const k = zeroMatrix(DOF_PER_ELEMENT);
  fillAxial(k, props.eKnm2 * props.areaM2 / l);
  fillTorsion(k, props.gKnm2 * props.jM4 / l);
  fillBendingZ(k, props.eKnm2 * props.izM4, l);
  fillBendingY(k, props.eKnm2 * props.iyM4, l);
  return k;
}

/**
 * Πλήρες στοιχειακό μητρώο: τοπικό k, μετασχηματισμός T, ολικό k_global = Tᵀ·k·T.
 * Επιστρέφει null για εκφυλισμένο (μηδενικό μήκος) μέλος.
 */
export function buildElementStiffness(
  pi: AnalyticalPoint3D,
  pj: AnalyticalPoint3D,
  props: MemberSectionProperties,
): ElementStiffness | null {
  const { ex, ey, ez, lengthM } = localAxes(pi, pj);
  if (lengthM <= 0) return null;
  const kLocal = localStiffness(props, lengthM);
  const transform = buildTransform([ex, ey, ez]);
  const kGlobal = matMul(matMul(transpose(transform), kLocal), transform);
  return { lengthM, kLocal, kGlobal, transform };
}
