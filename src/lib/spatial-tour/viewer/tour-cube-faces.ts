/**
 * @fileoverview **Η ΣΥΜΒΑΣΗ ΤΩΝ ΕΞΙ ΟΨΕΩΝ** — ποια κατεύθυνση δείχνει κάθε εικονοστοιχείο κάθε όψης του κύβου
 * (ADR-884 Φ1 · §4.8). Καθαρό.
 * @related `components/spatial-tour/viewer/tour-panorama-shader.ts` (η ΙΔΙΑ σύμβαση σε GLSL — δίδυμο που **οφείλει** να
 *   συμφωνεί· άγκυρα στο `tour-cube-faces.test.ts`) · ψήστης πλακιδίων της Φ2 (κόβει equirect → όψεις **με αυτές** τις
 *   συναρτήσεις) · `components/spatial-tour/viewer/demo/demo-panorama-source.ts` (εικονικές όψεις με τις ίδιες)
 * @module lib/spatial-tour/viewer/tour-cube-faces
 *
 * 📏 **Γιατί κύβος, όχι ένα equirect** (MDN WebGL best practices · Chromium): `MAX_TEXTURE_SIZE` 4096 σε ~99% των
 * συσκευών, και το Chrome Android το **κόβει** επίτηδες στο 4096 — ένα 8K πανόραμα ως μία υφή δεν χωρά. Έξι όψεις ≤2048
 * χωρούν παντού και είναι η βάση των πλακιδίων πολλαπλής ανάλυσης (Marzipano · Pannellum multires).
 *
 * 🧭 **Χώρος πανοράματος** (δεξιόστροφο σύστημα three.js): yaw 0 = κέντρο της εικόνας = `-Z` · δεξιά = `+X` · πάνω = `+Y`.
 * Κάθε όψη κοιτάζεται **από μέσα**, με `u` προς τα δεξιά και `v` προς τα πάνω του θεατή, και τα δύο στο `[0, 1]`
 * (`v = 1` = πάνω άκρη της εικόνας). Οι όψεις `up`/`down` έχουν την `front` προς τα κάτω/πάνω αντίστοιχα
 * (σύμβαση Pannellum/Marzipano `f r b l u d`).
 */

/** Σειρά όψεων — και σειρά αρχείων του tileset (Φ2). */
export const TOUR_CUBE_FACES = ['front', 'right', 'back', 'left', 'up', 'down'] as const;
export type TourCubeFace = (typeof TOUR_CUBE_FACES)[number];

export interface Direction3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Η κατεύθυνση (όχι μοναδιαία) που αντιστοιχεί στο `(u, v)` μιας όψης. */
export function cubeFaceUvToDirection(face: TourCubeFace, u: number, v: number): Direction3 {
  const a = 2 * u - 1;
  const b = 2 * v - 1;
  switch (face) {
    case 'front': return { x: a, y: b, z: -1 };
    case 'right': return { x: 1, y: b, z: a };
    case 'back': return { x: -a, y: b, z: 1 };
    case 'left': return { x: -1, y: b, z: -a };
    case 'up': return { x: a, y: 1, z: b };
    case 'down': return { x: a, y: -1, z: -b };
  }
}

/** Η όψη και το `(u, v)` όπου πέφτει μια κατεύθυνση — το αντίστροφο του `cubeFaceUvToDirection`. */
export function directionToCubeFace(d: Direction3): { readonly face: TourCubeFace; readonly u: number; readonly v: number } {
  const ax = Math.abs(d.x);
  const ay = Math.abs(d.y);
  const az = Math.abs(d.z);
  const uv = (face: TourCubeFace, a: number, b: number, m: number) => ({ face, u: (a / m + 1) / 2, v: (b / m + 1) / 2 });
  if (ax >= ay && ax >= az) return d.x > 0 ? uv('right', d.z, d.y, ax) : uv('left', -d.z, d.y, ax);
  if (ay >= az) return d.y > 0 ? uv('up', d.x, d.z, ay) : uv('down', d.x, -d.z, ay);
  return d.z < 0 ? uv('front', d.x, d.y, az) : uv('back', -d.x, d.y, az);
}

/** Η κατεύθυνση ενός yaw/κλίσης στον χώρο του πανοράματος — yaw 0 = `-Z`, δεξιόστροφα προς `+X`. */
export function yawPitchToDirection(yaw: number, pitch: number): Direction3 {
  const c = Math.cos(pitch);
  return { x: Math.sin(yaw) * c, y: Math.sin(pitch), z: -Math.cos(yaw) * c };
}

/**
 * Το yaw/κλίση μιας κατεύθυνσης (όχι απαραίτητα μοναδιαίας) — το αντίστροφο του `yawPitchToDirection`. Το χρειάζεται το
 * σύρσιμο βελακιού (Φ2δ): σημείο οθόνης → ακτίνα της κάμερας → yaw → διόπτευση. yaw στο `(-π, π]`.
 */
export function directionToYawPitch(d: Direction3): { readonly yaw: number; readonly pitch: number } {
  return { yaw: Math.atan2(d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) };
}
