import 'server-only';

/**
 * @fileoverview **ΤΟ ΑΛΑΤΙ ΤΗΣ ΗΜΕΡΑΣ** — γιατί το σημάδι επισκέπτη δεν είναι PII (ADR-777 §8.72).
 * @related services/listings/listing-view-recorder.ts · lib/cron/jobs/listing-stats-rollup.job.ts
 * @module services/listings/listing-view-salt
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔒 ΤΟ ΜΟΤΙΒΟ PLAUSIBLE, ΚΑΙ ΓΙΑΤΙ ΟΧΙ ΣΤΑΘΕΡΟ ΜΥΣΤΙΚΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το σημάδι «μετρήθηκε σήμερα» είναι `sha256(αλάτι ‖ ημέρα ‖ ακίνητο ‖ IP ‖ UA)`. Με **σταθερό**
 * μυστικό (π.χ. μεταβλητή περιβάλλοντος), όποιος το αποκτούσε θα ξαναϋπολόγιζε το hash για κάθε
 * IP και θα έλεγε «αυτή η διεύθυνση είδε αυτό το σπίτι τις 12/09» — δηλαδή **ψευδωνύμιο**, όχι
 * ανωνυμία (GDPR αιτ. 26). Με **τυχαίο αλάτι ανά ημέρα που σβήνεται μετά από 2 μέρες**, ο
 * ξαναϋπολογισμός είναι **αδύνατος**, και για εμάς.
 * Πηγή: https://plausible.io/data-policy#how-we-count-unique-users-without-cookies
 *
 * 🔑 **Γέννηση με `create()`**: δύο διεργασίες που ζητούν ταυτόχρονα το αλάτι της ίδιας νέας
 * ημέρας — η μία κερδίζει, η άλλη διαβάζει το δικό της. Κανένα «δύο αλάτια για μία μέρα» (που θα
 * μετρούσε τον ίδιο άνθρωπο δύο φορές).
 */

import { randomBytes } from 'node:crypto';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AdminFirestore } from '@/lib/api/guarded-route';
import { isAlreadyExistsError } from '@/lib/firestore/firestore-already-exists';
import { LISTING_VIEW_TTL_DAYS, ephemeralExpiryOf } from '@/lib/listings/listing-stats';
import { enterpriseIdService } from '@/services/enterprise-id.service';

interface StoredSalt {
  readonly day: string;
  readonly salt: string;
}

/**
 * Λανθάνουσα μνήμη **ανά διεργασία** — ένα αλάτι ανά ημέρα, οπότε ποτέ πάνω από δύο εγγραφές.
 * Το αλάτι δεν αλλάζει ποτέ για μια ημέρα, άρα η μνήμη δεν μπορεί να «παλιώσει».
 */
const saltCache = new Map<string, string>();

function isStoredSalt(value: unknown, day: string): value is StoredSalt {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.day === day && typeof record.salt === 'string' && record.salt.length > 0;
}

async function readOrCreateSalt(adminDb: AdminFirestore, day: string): Promise<string> {
  const ref = adminDb
    .collection(COLLECTIONS.LISTING_VIEW_SALTS)
    .doc(enterpriseIdService.generateDeterministicListingViewSaltId(day));
  const fresh: StoredSalt = { day, salt: randomBytes(32).toString('hex') };
  try {
    await ref.create({ ...fresh, expiresAt: ephemeralExpiryOf(day, LISTING_VIEW_TTL_DAYS.salt) });
    return fresh.salt;
  } catch (error) {
    if (!isAlreadyExistsError(error)) throw error;
  }
  const existing = (await ref.get()).data();
  if (!isStoredSalt(existing, day)) throw new Error(`listing_view_salts: invalid stored salt for ${day}`);
  return existing.salt;
}

/** **Το αλάτι αυτής της ημέρας αγοράς** — από τη μνήμη, αλλιώς από τη βάση (το γεννά αν λείπει). */
export async function listingViewSaltOf(adminDb: AdminFirestore, day: string): Promise<string> {
  const cached = saltCache.get(day);
  if (cached !== undefined) return cached;
  const salt = await readOrCreateSalt(adminDb, day);
  saltCache.clear(); // μόνο η τρέχουσα ημέρα αξίζει μνήμη
  saltCache.set(day, salt);
  return salt;
}
