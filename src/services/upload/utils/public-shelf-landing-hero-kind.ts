/**
 * @fileoverview 🖼️ **Η ΤΕΤΑΡΤΗ ΓΡΑΜΜΗ ΤΟΥ ΡΑΦΙΟΥ — ΟΙ ΕΙΚΟΝΕΣ ΗΡΩΑ** (ADR-881 §4.2).
 * @related ADR-881 · ADR-841 §7 Α21 · services/upload/utils/public-shelf-kinds
 * @module services/upload/utils/public-shelf-landing-hero-kind
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ — ΕΞΑΓΩΓΗ, ΟΧΙ ΤΡΙΜΜΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `public-shelf-kinds.ts` μετρούσε **460** γραμμές· η γραμμή με το σκεπτικό της θα το έφερνε
 * στο όριο των 500 (N.7.1) — τρίτη φορά που το όριο **αποκαλύπτει** ευθύνη. Ο πίνακας
 * {@link PUBLIC_SHELF_KINDS} την **εισάγει**, άρα κάθε άγκυρα «για ΚΑΘΕ γραμμή» τη βλέπει.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΥΠΟΚΕΙΜΕΝΟ ΕΙΝΑΙ Η **ΕΚΔΟΣΗ**, ΟΧΙ Η ΣΕΛΙΔΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο γραφέας κάνει το πρόθεμα **ακριβώς ίσο** με το επιθυμητό σύνολο — **σβήνει ό,τι περισσεύει**.
 * Με υποκείμενο τη σελίδα (`landing-heroes/home/`), κάθε νέα έκδοση θα έσβηνε τα bytes της
 * προηγούμενης: η επαναφορά θα ήθελε re-encode, και ένα URL σε cache θα έδειχνε 404. Με υποκείμενο
 * την **έκδοση** (`landing-heroes/<lhrev>/`), κάθε πρόθεμα γράφεται **μία** φορά και δεν ξαναγγίζεται
 * ⇒ επαναφορά = μετακίνηση δείκτη, στιγμιαία.
 */

import type { LandingHeroMaterial } from '@/lib/landing/landing-hero-vocabulary';
import { isLandingHeroRevisionId } from '@/lib/landing/landing-hero-vocabulary';

import { FRAMING_AS_GIVEN } from './public-shelf-encoding';
import type { RasterShelfKind } from './public-shelf-kinds';

/** Η ρίζα των εικόνων ήρωα στον δημόσιο κάδο — ονομάζει *τι* δημοσιεύεται. */
export const PUBLIC_SHELF_LANDING_HERO_ROOT = 'landing-heroes';

/**
 * Αποδεκτό υποκείμενο: **μόνο** ταυτότητα έκδοσης (`lhrev_*`). Το μοτίβο της αποκλείει ήδη `/`,
 * `.` και κενό ⇒ καμία δραπέτευση από το πρόθεμα (ίδιοι όροι με τον κοινό πυρήνα των φρουρών).
 */
export function isPublicShelfLandingHeroId(value: string): boolean {
  return isLandingHeroRevisionId(value);
}

/**
 * 🏆 **Η ΓΡΑΜΜΗ.**
 * - **Πλάτη**: ο ήρωας είναι `sizes="100vw"`. 640 (κινητό 1×) · 1280 (κινητό 3× ≈ 1170, ταμπλέτα 2×)
 *   · 1920 (οθόνη 1×) · 2560 (laptop 2×). Ίδιο ανώτατο με τη γκαλερί αγγελίας.
 * - **q82 `photo`**: ίδια συνταγή με τις φωτογραφίες — είναι φωτογραφία, όχι σήμα.
 * - **Πλαισίωμα αυτούσιο**: ποτέ τρίμμα — ένας ομοιόμορφος ουρανός στην κορυφή θα διαβαζόταν «χαρτί».
 * - **Εστίαση**: **ΔΕΝ** εντοπίζεται. Ο ήρωας έχει σύνθεση ορισμένη εκ των προτέρων (θέμα δεξιά)· ο
 *   ανιχνευτής φωτογραφιών ακινήτων έδωσε λάθος σημείο στη δοκιμή (ADR-881 §8.6) — και μια ανάλυση που
 *   δεν χρησιμοποιείται είναι CPU χωρίς λόγο. Προεπιλογή: `LANDING_HERO_DEFAULT_FOCAL_POINT`.
 */
export const LANDING_HERO_SHELF: RasterShelfKind<LandingHeroMaterial> = {
  root: PUBLIC_SHELF_LANDING_HERO_ROOT,
  acceptsSubject: isPublicShelfLandingHeroId,
  encoding: { kind: 'raster', widths: [640, 1280, 1920, 2560], quality: 82, preset: 'photo' },
  framingOf: () => FRAMING_AS_GIVEN,
  detectsFocalPoint: () => false,
};
