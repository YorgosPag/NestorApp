/**
 * @fileoverview **ΤΙ ΗΡΩΑ ΦΟΡΑ ΚΑΘΕ ΣΕΛΙΔΑ;** — η ανάγνωση των δημόσιων σελίδων (ADR-881 §4.3).
 * @related ADR-881 · landing-hero-store · components/shared/landing-hero/LandingHeroesProvider
 * @module services/landing-hero/landing-hero-reader
 *
 * 🔑 **Στον διακομιστή, ώστε το URL να είναι ΜΕΣΑ στο HTML** (LCP). Οι σελίδες είναι `'use client'`·
 *    η ανάγνωση γίνεται στο `(light)/layout.tsx` (server component) και ταξιδεύει με provider.
 *
 * 🔑 **`unstable_cache` με tag**: μία ανάγνωση Firestore για όλους τους επισκέπτες μέχρι την επόμενη
 *    δημοσίευση — η δημοσίευση καλεί `revalidateTag(LANDING_HEROES_CACHE_TAG)` ⇒ αλλαγή εικόνας
 *    **χωρίς deploy**. Το `revalidate` είναι μόνο δίχτυ, για την περίπτωση που μια ακύρωση χαθεί.
 *
 * 🛟 **Belt-and-suspenders**: κάθε αποτυχία (Firestore κάτω, build χωρίς credentials, χαλασμένο
 *    έγγραφο) ⇒ η **ενσωματωμένη** εικόνα της σελίδας. Η αρχική σελίδα δεν μένει ποτέ χωρίς ήρωα,
 *    και ποτέ δεν πέφτει εξαιτίας του.
 *
 * ⚠️ **Δεδομένα πλατφόρμας, όχι μισθωτή** — η μνήμη δεν έχει κλειδί χρήστη ή εταιρείας, και σωστά:
 *    κάθε επισκέπτης βλέπει τον ίδιο ήρωα (ADR-742 §7decies.2 αφορά μνήμες **με** μισθωτή).
 */

import 'server-only';

import { unstable_cache } from 'next/cache';

import { LANDING_HERO_IMAGES } from '@/components/shared/landing-hero/landing-hero-images';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { getErrorMessage } from '@/lib/error-utils';
import { resolveLandingHeroSet, revisionToHeroImage } from '@/lib/landing/landing-hero-document';
import type { LandingHeroImage, LandingHeroPage, LandingHeroSet } from '@/lib/landing/landing-hero-vocabulary';
import { createModuleLogger } from '@/lib/telemetry';

import { LANDING_HEROES_CACHE_TAG } from './landing-hero-cache-tag';
import { readLandingHeroPointersDoc, readLandingHeroRevisionDocs } from './landing-hero-store';

const logger = createModuleLogger('landing-hero-reader');

/** Δίχτυ για χαμένη ακύρωση — όχι ο μηχανισμός ενημέρωσης (αυτός είναι το tag). */
const LANDING_HEROES_REVALIDATE_SECONDS = 3600;

type PublishedHeroes = Partial<Record<LandingHeroPage, LandingHeroImage>>;

/** Δείκτης → ζωντανές εκδόσεις (μία `getAll`) → εικόνες ανά σελίδα. Ό,τι λείπει, απλώς λείπει. */
async function loadPublishedHeroes(): Promise<PublishedHeroes> {
  const db = getAdminFirestore();
  const pointers = await readLandingHeroPointersDoc(db);
  const ids = Object.values(pointers)
    .map((pointer) => pointer.publishedRevisionId)
    .filter((id): id is string => id !== null);
  const revisions = await readLandingHeroRevisionDocs(db, ids);

  const published: PublishedHeroes = {};
  for (const revision of revisions) {
    // 🔑 Η έκδοση μετρά ΜΟΝΟ αν είναι ο δείκτης **της δικής της** σελίδας.
    if (pointers[revision.page].publishedRevisionId === revision.id) {
      published[revision.page] = revisionToHeroImage(revision);
    }
  }
  return published;
}

const cachedPublishedHeroes = unstable_cache(loadPublishedHeroes, ['landing-heroes', 'v1'], {
  tags: [LANDING_HEROES_CACHE_TAG],
  revalidate: LANDING_HEROES_REVALIDATE_SECONDS,
});

/** **Η μία ανάγνωση** — πάντα πλήρης, ποτέ δεν πετά. */
export async function readLandingHeroes(): Promise<LandingHeroSet> {
  try {
    return resolveLandingHeroSet(await cachedPublishedHeroes(), LANDING_HERO_IMAGES);
  } catch (error) {
    logger.warn('Ανάγνωση ηρώων απέτυχε — ενσωματωμένες εικόνες', { error: getErrorMessage(error) });
    return LANDING_HERO_IMAGES;
  }
}
