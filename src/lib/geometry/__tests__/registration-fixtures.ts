/**
 * Κοινά συνθετικά δεδομένα των tests καταγραφής (ADR-929 §6.9): κάτοψη, ραστεροποίηση με ΓΝΩΣΤΟ affine, μέτρο απόκλισης.
 * Ένα σημείο, ώστε `registration.test.ts` και `registration-acceptance.test.ts` να μη γίνουν δίδυμα.
 */

import { applyAffine, type Affine2x3, type AffinePoint } from '../affine-2x3';
import type { InkMask, RegistrationSegment } from '../registration/registration-types';

export const W = 420;
export const H = 340;

/** Κάτοψη: εξωτερικό περίγραμμα με διπλή γραμμή, εσωτερικοί τοίχοι, μία λοξή — αρκετή για να ορίζεται το affine. */
export function planSegments(origin: AffinePoint = { x: 0, y: 0 }): RegistrationSegment[] {
  const s = (ax: number, ay: number, bx: number, by: number): RegistrationSegment => ({
    a: { x: origin.x + ax, y: origin.y + ay },
    b: { x: origin.x + bx, y: origin.y + by },
  });
  return [
    s(0, 0, 150, 0), s(150, 0, 150, 110), s(150, 110, 0, 110), s(0, 110, 0, 0),
    s(6, 6, 144, 6), s(144, 6, 144, 104), s(144, 104, 6, 104), s(6, 104, 6, 6),
    s(70, 6, 70, 104), s(6, 55, 70, 55), s(100, 104, 144, 60),
  ];
}

export function rasterize(segments: readonly RegistrationSegment[], t: Affine2x3, widthPx: number): InkMask {
  const mask = new Uint8Array(W * H);
  for (const seg of segments) {
    const a = applyAffine(t, seg.a);
    const b = applyAffine(t, seg.b);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const k = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / len2));
        if (Math.hypot(px - (a.x + k * dx), py - (a.y + k * dy)) <= widthPx / 2) mask[y * W + x] = 1;
      }
    }
  }
  return { mask, width: W, height: H };
}

/** Μέγιστη απόκλιση (px) δύο μετασχηματισμών στα σημεία ελέγχου. */
export function maxDeviation(p: Affine2x3, q: Affine2x3, points: readonly AffinePoint[]): number {
  return Math.max(...points.map((pt) => {
    const u = applyAffine(p, pt);
    const v = applyAffine(q, pt);
    return Math.hypot(u.x - v.x, u.y - v.y);
  }));
}

export const TRUTH: Affine2x3 = { a: 2.4, b: 0.05, c: -0.03, d: 2.35, e: 30, f: 25 };
export const CORNERS: AffinePoint[] = [{ x: 0, y: 0 }, { x: 150, y: 0 }, { x: 150, y: 110 }, { x: 0, y: 110 }];
export const PERTURBED: Affine2x3 = { a: 2.45, b: 0.03, c: -0.01, d: 2.4, e: 35, f: 20 };
