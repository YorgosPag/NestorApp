/**
 * 📐 **ΤΙ ΚΑΤΕΒΑΙΝΕΙ ΓΙΑ ΜΙΑ ΕΙΚΟΝΑ ΤΑΥΤΟΤΗΤΑΣ** — όσα pixels ζωγραφίζει το κουτί, όχι όλο το αρχείο (ADR-190 §Display).
 *
 * Μετρημένο 2026-10-18: το λογότυπο επαφής είναι το **πρωτότυπο** JPEG 1600×1137 / **163,6 KB**, για πλακίδιο 40px.
 * Πλέγμα 100 επαφών = ~16 MB για εικόνες που ζωγραφίζονται στα 40px.
 *
 * Η λύση είναι αυτή της Google (`=s96-c` του People API), του GitHub (`?s=40`) και της Idealista: **resize κατά
 * τη ζήτηση** με μόνιμη cache, όχι προκαθορισμένα παράγωγα στο ανέβασμα (Slack). Ο λόγος είναι μετρήσιμος: τα
 * παράγωγα κλειδώνουν τα μεγέθη **πριν** τα ξέρεις και θέλουν backfill για ό,τι υπάρχει ήδη, ενώ εδώ κάθε
 * υπάρχουσα εικόνα παίρνει μικρογραφία από την πρώτη μέρα. Ο μηχανισμός είναι ο optimizer του Next (sharp,
 * `output: 'standalone'` στον Netcup) μέσω του **δημόσιου** `getImageProps`: AVIF/WebP κατά το `Accept`, και
 * `srcset` 1x/2x ώστε η οθόνη Retina να πάρει 96px και η απλή 48px — ποτέ 1600.
 *
 * ⚠️ Μόνο ο **δικός μας** κάδος (`remote-image-sources.json`, ίδια πηγή με το `next.config.js`). Οτιδήποτε άλλο
 * (`data:`, `blob:` προεπισκόπησης, ξένος host) περνά **αυτούσιο** — ο optimizer θα απαντούσε 400.
 * ⚠️ Το ADR-881 απορρίπτει τον optimizer για τα **παράγωγα ραφιού** (είναι ήδη WebP ανά πλάτος ⇒ διπλή
 * κωδικοποίηση). Εδώ η πηγή είναι το πρωτότυπο και η έξοδος ≤128px: η ίδια ερώτηση, αντίθετη απάντηση.
 *
 * @module lib/media/identity-image-source
 */

import { getImageProps } from 'next/image';

import remoteImageSources from '@/config/remote-image-sources.json';

export interface IdentityImageSource {
  readonly src: string;
  readonly srcSet?: string;
}

const STORAGE_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

/** Δρομολογείται αυτό το URL από τον optimizer; Ίδιο κριτήριο με το `images.remotePatterns`. */
export function isOptimizableImageUrl(url: string): boolean {
  if (!STORAGE_BUCKET) return false;
  const { protocol, hostname, pathnamePrefix } = remoteImageSources.firebaseStorage;
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === `${protocol}:` &&
      parsed.hostname === hostname &&
      parsed.pathname.startsWith(pathnamePrefix.replace('{bucket}', STORAGE_BUCKET))
    );
  } catch {
    return false;
  }
}

/**
 * Η πηγή για κουτί `cssPx`×`cssPx`: `src` (1x) + `srcSet` (1x/2x) μέσω του optimizer, ή το URL αυτούσιο.
 * Τετράγωνο γιατί το κουτί είναι τετράγωνο· το `object-fit` αποφασίζει περικοπή ή όχι, όχι το αίτημα.
 */
export function identityImageSource(url: string, cssPx: number): IdentityImageSource {
  if (!isOptimizableImageUrl(url)) return { src: url };
  const { props } = getImageProps({ src: url, alt: '', width: cssPx, height: cssPx });
  return { src: props.src, srcSet: props.srcSet };
}
