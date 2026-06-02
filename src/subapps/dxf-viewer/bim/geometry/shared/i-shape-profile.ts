/**
 * Shared I-shape (double-T) cross-section profile — SSoT (ADR-363 Phase 8 + Φ2).
 *
 * Εξήχθη από `column-geometry.ts:buildIShapeLocal` (N.0.2 — boy-scout
 * centralization) ώστε ΚΑΙ η κολώνα (footprint = οριζόντια κάτοψη, extrude
 * κατακόρυφα) ΚΑΙ το δοκάρι (cross-section = κάθετη τομή, σάρωση κατά τον άξονα)
 * να χτίζουν το ίδιο 12-κορυφο προφίλ από ΕΝΑ σπίτι — μηδέν copy-paste.
 *
 *   - `width` (b)  = flange total width
 *   - `depth` (h)  = section depth
 *   - `flangeThickness` (tf) = πάχος πάνω/κάτω πέλματος
 *   - `webThickness`    (tw) = πάχος κεντρικού κορμού
 *
 * Οι διαστάσεις είναι σε mm· το `scale` (canvas-units-per-mm Ή MM_TO_M) μετατρέπει
 * στο χώρο εξόδου. Plate-thickness defaults/min = SSoT του `column-types`.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §5.6, §5.7
 */

import type { Point3D } from '../../types/bim-base';
import {
  DEFAULT_I_FLANGE_THICKNESS_MM,
  DEFAULT_I_WEB_THICKNESS_MM,
  MIN_I_PLATE_THICKNESS_MM,
} from '../../types/column-types';

/**
 * Shape-agnostic I-profile override (structurally compatible με
 * `ColumnIShapeParams` ΚΑΙ `BeamIShapeParams`).
 */
export interface IShapeProfileOverride {
  readonly flangeThickness?: number;
  readonly webThickness?: number;
  readonly flipY?: boolean;
}

/**
 * I-shape (double-T, steel IPE/HEA family) — 12-vertex CCW (math Y-up).
 *
 * Vertices traverse outer outline starting bottom-left of bottom flange,
 * going right along bottom, up the web, left along top, and back down.
 *
 * `flipY=true` reverses winding (parity με L/T mirror transform). Visually
 * symmetric για I, αλλά διατηρείται για transform-pipeline consistency.
 */
export function buildIShapeProfile(
  width: number,
  depth: number,
  s: number,
  override?: IShapeProfileOverride,
): Point3D[] {
  const tfMm = override?.flangeThickness ?? DEFAULT_I_FLANGE_THICKNESS_MM;
  const twMm = override?.webThickness ?? DEFAULT_I_WEB_THICKNESS_MM;
  const tfRaw = Math.max(MIN_I_PLATE_THICKNESS_MM, tfMm) * s;
  const twRaw = Math.max(MIN_I_PLATE_THICKNESS_MM, twMm) * s;
  const hb = (width * s) / 2;
  const hh = (depth * s) / 2;
  // Clamp tf ≤ h/2 (else flanges overlap) and tw ≤ b (else web exits flange).
  const tf = Math.min(tfRaw, hh);
  const halfWeb = Math.min(twRaw / 2, hb);
  const flipY = override?.flipY ?? false;
  const ys = flipY ? -1 : 1;
  const verts: Point3D[] = [
    { x: -hb,      y: ys * -hh,        z: 0 },  // v0  bottom flange BL
    { x:  hb,      y: ys * -hh,        z: 0 },  // v1  bottom flange BR
    { x:  hb,      y: ys * (-hh + tf), z: 0 },  // v2  top of BR corner
    { x:  halfWeb, y: ys * (-hh + tf), z: 0 },  // v3  web BR
    { x:  halfWeb, y: ys * ( hh - tf), z: 0 },  // v4  web TR
    { x:  hb,      y: ys * ( hh - tf), z: 0 },  // v5  bottom of TR corner
    { x:  hb,      y: ys *  hh,        z: 0 },  // v6  top flange TR
    { x: -hb,      y: ys *  hh,        z: 0 },  // v7  top flange TL
    { x: -hb,      y: ys * ( hh - tf), z: 0 },  // v8  bottom of TL corner
    { x: -halfWeb, y: ys * ( hh - tf), z: 0 },  // v9  web TL
    { x: -halfWeb, y: ys * (-hh + tf), z: 0 },  // v10 web BL
    { x: -hb,      y: ys * (-hh + tf), z: 0 },  // v11 top of BL corner
  ];
  return flipY ? [...verts].reverse() : verts;
}

/**
 * Πραγματικό εμβαδόν διατομής Ι (mm²) = 2·πέλματα + κορμός (μεταξύ πελμάτων).
 *   `A = 2·b·tf + (h − 2·tf)·tw`
 * Με τα ίδια clamps που εφαρμόζει το `buildIShapeProfile` (tf ≤ h/2, tw ≤ b)
 * ώστε το εμβαδόν να συμφωνεί με την πραγματική 12-κορυφη γεωμετρία. Τροφοδοτεί
 * το BOQ βάρος χάλυβα (kg = volume × ρ). Degenerate input → 0.
 */
export function iShapeCrossSectionAreaMm2(
  width: number,
  depth: number,
  flangeThickness?: number,
  webThickness?: number,
): number {
  const b = Math.max(0, width);
  const h = Math.max(0, depth);
  const tf = Math.min(Math.max(MIN_I_PLATE_THICKNESS_MM, flangeThickness ?? DEFAULT_I_FLANGE_THICKNESS_MM), h / 2);
  const tw = Math.min(Math.max(MIN_I_PLATE_THICKNESS_MM, webThickness ?? DEFAULT_I_WEB_THICKNESS_MM), b);
  const flanges = 2 * b * tf;
  const web = Math.max(0, h - 2 * tf) * tw;
  return flanges + web;
}
