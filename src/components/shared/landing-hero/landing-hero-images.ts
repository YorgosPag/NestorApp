/**
 * @fileoverview **Οι ΕΝΣΩΜΑΤΩΜΕΝΕΣ εικόνες των ηρώων** — το δίχτυ ασφαλείας κάθε σελίδας
 * (ADR-777 §8.79 · §8.81 · §8.82 · ADR-881 §4.3).
 * @module components/shared/landing-hero/landing-hero-images
 *
 * 🔴 **ΑΠΟ ΤΟ ADR-881 ΑΥΤΟΣ Ο ΠΙΝΑΚΑΣ ΔΕΝ ΕΙΝΑΙ Η ΑΛΗΘΕΙΑ — ΕΙΝΑΙ Η ΠΡΟΕΠΙΛΟΓΗ.** Οι εικόνες που
 *    ανεβάζει ο πάροχος από το `/admin/landing-heroes` ζουν στο `settings/landing_heroes` και στο
 *    δημόσιο ράφι. Ο πίνακας αποδίδεται **μόνο** για σελίδα χωρίς δημοσιευμένη έκδοση **και** σε
 *    κάθε αποτυχία ανάγνωσης (Firestore κάτω, build χωρίς credentials) — ώστε η αρχική σελίδα να
 *    μην είναι ποτέ χωρίς εικόνα. ⇒ Μην τον αλλάζεις για να «ανεβάσεις» εικόνα· χρησιμοποίησε το εργαλείο.
 *
 * 🖼️ **Προδιαγραφή, κοινή για όλες:** 2:1, θέμα στο **δεξί** τρίτο, ήρεμο το αριστερό, **καθόλου**
 *    κείμενο. JPG mozjpeg q86 — το `next/image` παράγει AVIF/WebP σε κάθε `deviceSizes`. Οι
 *    διαστάσεις είναι **μετρημένες** (2026-09-24), όχι δηλωμένες.
 *
 * ⚠️ **Το `.gitignore` έχει `*.jpg`** (στιγμιότυπα οθόνης) — το `!public/**\/*.jpg` το αναιρεί.
 *    Κάθε νέο αρχείο: `git check-ignore -v <διαδρομή>` (§8.79.5).
 * ⚠️ **Νέο περιεχόμενο ⇒ ΝΕΟ όνομα αρχείου**, ποτέ αντικατάσταση στην ίδια διαδρομή: browser και
 *    image optimizer κρατούν cache ανά URL (μετρημένο 24/09, §8.81.7). Οι εκδόσεις του εργαλείου
 *    το έχουν δωρεάν (content-addressed ράφι).
 *
 * 🔑 **Κάθε γραμμή κουβαλά το `page` της**: ο καταναλωτής περνά `LANDING_HERO_IMAGES.x` στον ήρωα όπως
 *    πάντα, και ο ήρωας ρωτά τον provider αν η σελίδα έχει δημοσιευμένη έκδοση (`useLandingHeroImage`).
 *
 * 🎯 **`focalPoint` αντί για το παλιό `focus: 'center' | 'lower'`** (ADR-881 §4.4): το ίδιο
 *    λεξιλόγιο με το ADR-880, και στους **δύο** άξονες. Οι τιμές αναπαράγουν **ακριβώς** ό,τι
 *    αποδιδόταν: `center` = `object-right` = `{x:1, y:0.5}` · `lower` = `object-[100%_85%]`.
 */

import {
  LANDING_HERO_DEFAULT_FOCAL_POINT,
  type LandingHeroFallback,
  type LandingHeroPage,
} from '@/lib/landing/landing-hero-vocabulary';

/** Ίδιο μέγεθος για όλα τα ενσωματωμένα αρχεία — μετρημένο (2026-09-24). */
const BUILTIN_SIZE = { width: 1774, height: 887 } as const;

export const LANDING_HERO_IMAGES = {
  /** Ο κόμβος — `/`. */
  home: {
    page: 'home',
    day: { src: '/images/landing/hero-day.jpg', ...BUILTIN_SIZE },
    dusk: { src: '/images/landing/hero-dusk.jpg', ...BUILTIN_SIZE },
    focalPoint: LANDING_HERO_DEFAULT_FOCAL_POINT,
  },
  /** Η ακτίνα των επαγγελματιών — `/pro`. Τα σχέδια ζουν χαμηλά στο κάδρο (§8.81.6). */
  pros: {
    page: 'pros',
    day: { src: '/images/landing/pros-day.jpg', ...BUILTIN_SIZE },
    dusk: { src: '/images/landing/pros-dusk.jpg', ...BUILTIN_SIZE },
    focalPoint: { x: 1, y: 0.85 },
  },
  /** Η ακτίνα της βραχυχρόνιας μίσθωσης — `/stay`. */
  stay: {
    page: 'stay',
    day: { src: '/images/landing/stay-cyclades-day.jpg', ...BUILTIN_SIZE },
    dusk: { src: '/images/landing/stay-cyclades-dusk.jpg', ...BUILTIN_SIZE },
    focalPoint: LANDING_HERO_DEFAULT_FOCAL_POINT,
  },
} as const satisfies Record<LandingHeroPage, LandingHeroFallback>;
