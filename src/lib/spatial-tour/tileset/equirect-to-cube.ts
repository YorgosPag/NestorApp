/**
 * @fileoverview **EQUIRECT → ΜΙΑ ΟΨΗ ΤΟΥ ΚΥΒΟΥ** — κάθε εικονοστοιχείο της όψης ρωτά τη σύμβαση «ποια κατεύθυνση είμαι;» και
 * διαβάζει εκεί το πανόραμα (ADR-884 Φ2α · §4.9). Καθαρό, χωρίς `sharp` — δέχεται και επιστρέφει ωμά RGB.
 * @related `viewer/tour-cube-faces.ts` (**η** σύμβαση — κανένα δεύτερο switch όψεων εδώ) · `server/spatial-tour/tour-tileset-baker.ts`
 * @module lib/spatial-tour/tileset/equirect-to-cube
 *
 * 🧭 **Ο ίδιος χώρος με τον θεατή**: yaw 0 = `-Z` = **κέντρο** της εικόνας (`yawPitchToDirection`)· yaw θετικό = δεξιά =
 * προς τα δεξιά της εικόνας. Άρα `yaw = atan2(x, -z)`, `pitch = atan2(y, √(x²+z²))`. Η στήλη `i`/γραμμή `j` της όψης
 * είναι το **κέντρο** του εικονοστοιχείου, και η γραμμή 0 είναι η **πάνω** άκρη (`v = 1`).
 *
 * 🔍 **Διγραμμική δειγματοληψία** με αναδίπλωση στο μήκος (η ραφή 180° δεν αφήνει γραμμή) και σύσφιξη στο πλάτος (πόλοι).
 */

import { cubeFaceUvToDirection, type TourCubeFace } from '../viewer/tour-cube-faces';

/** Ωμή εικόνα: `channels` byte ανά εικονοστοιχείο, γραμμή-γραμμή από πάνω. */
export interface RawImage {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly channels: number;
}

/** Η θέση (σε εικονοστοιχεία, συνεχής) ενός yaw/pitch μέσα στο equirect. */
function equirectPixelOf(yaw: number, pitch: number, width: number, height: number): { readonly x: number; readonly y: number } {
  return { x: (yaw / (2 * Math.PI) + 0.5) * width - 0.5, y: (0.5 - pitch / Math.PI) * height - 0.5 };
}

function sampleBilinear(src: RawImage, x: number, y: number, out: Uint8Array, at: number): void {
  const { data, width, height, channels } = src;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const xa = ((x0 % width) + width) % width;
  const xb = (xa + 1) % width;
  const ya = Math.min(height - 1, Math.max(0, y0));
  const yb = Math.min(height - 1, Math.max(0, y0 + 1));
  const rowA = ya * width;
  const rowB = yb * width;
  for (let c = 0; c < 3; c++) {
    const top = data[(rowA + xa) * channels + c] * (1 - fx) + data[(rowA + xb) * channels + c] * fx;
    const bottom = data[(rowB + xa) * channels + c] * (1 - fx) + data[(rowB + xb) * channels + c] * fx;
    out[at + c] = Math.round(top * (1 - fy) + bottom * fy);
  }
}

/** Μία όψη πλευράς `size`, ωμό RGB (3 κανάλια). */
export function renderCubeFace(src: RawImage, face: TourCubeFace, size: number): RawImage {
  const out = new Uint8Array(size * size * 3);
  for (let j = 0; j < size; j++) {
    const v = 1 - (j + 0.5) / size;
    for (let i = 0; i < size; i++) {
      const d = cubeFaceUvToDirection(face, (i + 0.5) / size, v);
      const yaw = Math.atan2(d.x, -d.z);
      const pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      const p = equirectPixelOf(yaw, pitch, src.width, src.height);
      sampleBilinear(src, p.x, p.y, out, (j * size + i) * 3);
    }
  }
  return { data: out, width: size, height: size, channels: 3 };
}
