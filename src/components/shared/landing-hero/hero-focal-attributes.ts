/**
 * @fileoverview **Σημείο εστίασης → χαρακτηριστικά του `<img>` του ήρωα** (ADR-881 §4.4).
 * @related landing-hero-focal.module.css · lib/listings/photo-focal-point
 * @module components/shared/landing-hero/hero-focal-attributes
 *
 * 🔑 Το σημείο (`{x,y} ∈ [0,1]`) κβαντίζεται σε βήμα {@link HERO_FOCAL_STEP}% ανά άξονα και γίνεται
 *    `data-fx`/`data-fy` — το CSS Module ορίζει ακριβώς αυτές τις τιμές. Σφάλμα ≤ 2,5% της
 *    υπερχείλισης: αόρατο στον ήρωα.
 */

import type { PhotoFocalPoint } from '@/lib/listings/photo-focal-point';

/** Το βήμα κβάντισης σε ποσοστιαίες μονάδες — το CSS Module έχει ακριβώς τα πολλαπλάσιά του. */
export const HERO_FOCAL_STEP = 5;

export interface HeroFocalAttributes {
  readonly 'data-fx': string;
  readonly 'data-fy': string;
}

function quantised(fraction: number): number {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0.5));
  return Math.round((clamped * 100) / HERO_FOCAL_STEP) * HERO_FOCAL_STEP;
}

export function heroFocalAttributes(point: PhotoFocalPoint): HeroFocalAttributes {
  return { 'data-fx': String(quantised(point.x)), 'data-fy': String(quantised(point.y)) };
}

/**
 * Το σημείο **όπως θα το αποδώσει** ο ήρωας (κβαντισμένο) — για την προσομοίωση και τη μέτρηση
 * αναγνωσιμότητας, ώστε να κρίνουν ακριβώς το κάδρο που θα δει ο επισκέπτης.
 */
export function renderedFocalPoint(point: PhotoFocalPoint): PhotoFocalPoint {
  return { x: quantised(point.x) / 100, y: quantised(point.y) / 100 };
}
