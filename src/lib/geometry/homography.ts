/**
 * @fileoverview **Η ΟΜΟΓΡΑΦΙΑ ΤΟΥ ΕΠΙΠΕΔΟΥ** (SSoT): τύπος, τετράγωνο → τετράπλευρο, εφαρμογή, αντιστροφή, σύνθεση,
 * τετράπλευρο → τετράπλευρο, αφινικό → ομογραφία. Καθαρή αριθμητική, τρέχει σε πελάτη, Worker και διακομιστή.
 * @module lib/geometry/homography
 * @related `css-homography.ts` (η **CSS** προβολή της, `matrix3d`) · `affine-2x3.ts` (η ειδική αφινική περίπτωση) ·
 *   `raster/raster-warp.ts` (η αναδειγμάτιση εικόνας πάνω της, ADR-929 Φ1)
 *
 * 🔑 **Γιατί χωριστά από το `css-homography`**: εκεί γεννήθηκε για να «απλώσει» στοιχείο DOM στο πάτωμα του πανοράματος
 *   (ADR-884 §4.14). Η ευθυγράμμιση κάτοψης (ADR-929 Δ3) χρειάζεται την **ίδια** ομογραφία και επιπλέον αντίστροφο και
 *   σύνθεση, για να γυρίζει κάθε εύρημα στα **αρχικά** pixel. Δεύτερη γραφή του ίδιου τύπου θα έκανε τα δύο να αποκλίνουν.
 * 📐 Κλειστή μορφή του Heckbert («Fundamentals of Texture Mapping and Image Warping», 1989, §2.2.3) για τετράγωνο →
 *   τετράπλευρο· τετράπλευρο → τετράπλευρο = σύνθεση με τον αντίστροφο (ο ίδιος, §2.2.4). Κανένα γενικό σύστημα 8×8.
 * ⚠️ **`null` αντί για `NaN`**: εκφυλισμός (τρεις γωνίες σε ευθεία, μηδενική ορίζουσα) γυρίζει `null` και ο καλών αποφασίζει.
 */

import type { Affine2x3 } from './affine-2x3';

export interface PlanePoint {
  readonly x: number;
  readonly y: number;
}

/** Οι τέσσερις γωνίες: πάνω-αριστερά · πάνω-δεξιά · κάτω-δεξιά · κάτω-αριστερά. */
export type Quad = readonly [PlanePoint, PlanePoint, PlanePoint, PlanePoint];

/** `(u, v) ↦ ((a·u + b·v + c) / w, (d·u + e·v + f) / w)` με `w = g·u + h·v + 1`. */
export interface Homography {
  readonly a: number; readonly b: number; readonly c: number;
  readonly d: number; readonly e: number; readonly f: number;
  readonly g: number; readonly h: number;
}

export const IDENTITY_HOMOGRAPHY: Homography = { a: 1, b: 0, c: 0, d: 0, e: 1, f: 0, g: 0, h: 0 };

const DEGENERATE = 1e-12;

/** Η ομογραφία του μοναδιαίου τετραγώνου στο `quad` — `null` όταν το τετράπλευρο εκφυλίζεται (τρεις γωνίες σε ευθεία). */
export function unitSquareToQuad(quad: Quad): Homography | null {
  const [p0, p1, p2, p3] = quad;
  const sx = p0.x - p1.x + p2.x - p3.x;
  const sy = p0.y - p1.y + p2.y - p3.y;
  if (Math.abs(sx) < DEGENERATE && Math.abs(sy) < DEGENERATE) {
    return { a: p1.x - p0.x, b: p2.x - p1.x, c: p0.x, d: p1.y - p0.y, e: p2.y - p1.y, f: p0.y, g: 0, h: 0 };
  }
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const den = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(den) < DEGENERATE) return null;
  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;
  return {
    a: p1.x - p0.x + g * p1.x, b: p3.x - p0.x + h * p3.x, c: p0.x,
    d: p1.y - p0.y + g * p1.y, e: p3.y - p0.y + h * p3.y, f: p0.y,
    g, h,
  };
}

/** Εφαρμογή σε σημείο `(u, v)`. */
export function applyHomography(m: Homography, u: number, v: number): PlanePoint {
  const w = m.g * u + m.h * v + 1;
  return { x: (m.a * u + m.b * v + m.c) / w, y: (m.d * u + m.e * v + m.f) / w };
}

/** Κανονικοποίηση ενός πλήρους 3×3 (γραμμή-γραμμή) ώστε το κάτω-δεξιά στοιχείο να είναι 1 — `null` αν είναι ~0. */
function normalized(m: readonly number[]): Homography | null {
  const scale = Math.max(...m.map(Math.abs));
  const i = m[8];
  if (!Number.isFinite(i) || !(scale > 0) || Math.abs(i) <= DEGENERATE * scale) return null;
  return { a: m[0] / i, b: m[1] / i, c: m[2] / i, d: m[3] / i, e: m[4] / i, f: m[5] / i, g: m[6] / i, h: m[7] / i };
}

const full = (m: Homography): readonly number[] => [m.a, m.b, m.c, m.d, m.e, m.f, m.g, m.h, 1];

/**
 * Αντίστροφη ομογραφία (προσαρτημένος πίνακας ÷ ορίζουσα), ή `null` όταν ο πίνακας είναι εκφυλισμένος ή ο αντίστροφος
 * στέλνει την αρχή στο άπειρο (η κανονικοποίηση με κάτω-δεξιά 1 δεν ορίζεται).
 */
export function invertHomography(m: Homography): Homography | null {
  const { a, b, c, d, e, f, g, h } = m;
  const adj = [
    e - f * h, c * h - b, b * f - c * e,
    f * g - d, a - c * g, c * d - a * f,
    d * h - e * g, b * g - a * h, a * e - b * d,
  ];
  const det = a * adj[0] + b * adj[3] + c * adj[6];
  const scale = Math.max(Math.abs(a), Math.abs(b), Math.abs(d), Math.abs(e), 1e-300);
  if (!Number.isFinite(det) || Math.abs(det) <= DEGENERATE * scale * scale) return null;
  return normalized(adj);
}

/** `compose(m2, m1)` εφαρμόζει πρώτα το `m1` και μετά το `m2` (ίδια σύμβαση με το `composeAffine`). */
export function composeHomography(m2: Homography, m1: Homography): Homography | null {
  const x = full(m2);
  const y = full(m1);
  const out: number[] = [];
  for (let r = 0; r < 3; r++) {
    for (let col = 0; col < 3; col++) {
      out.push(x[r * 3] * y[col] + x[r * 3 + 1] * y[3 + col] + x[r * 3 + 2] * y[6 + col]);
    }
  }
  return normalized(out);
}

/** Η ομογραφία που στέλνει κάθε γωνία του `from` στην αντίστοιχη του `to` — `null` σε εκφυλισμένο τετράπλευρο. */
export function quadToQuad(from: Quad, to: Quad): Homography | null {
  const fromUnit = unitSquareToQuad(from);
  const toUnit = unitSquareToQuad(to);
  if (fromUnit === null || toUnit === null) return null;
  const unitFromQuad = invertHomography(fromUnit);
  return unitFromQuad === null ? null : composeHomography(toUnit, unitFromQuad);
}

/** Ο αφινικός πίνακας (σημασιολογία `ctx.transform`) ως ομογραφία με `g = h = 0`. */
export function homographyFromAffine(m: Affine2x3): Homography {
  return { a: m.a, b: m.c, c: m.e, d: m.b, e: m.d, f: m.f, g: 0, h: 0 };
}

/** Το ορθογώνιο `[0, w] × [0, h]` ως τετράπλευρο, με τη σειρά γωνιών του {@link Quad}. */
export function rectQuad(width: number, height: number): Quad {
  return [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }];
}
