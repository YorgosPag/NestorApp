import 'server-only';

/**
 * @fileoverview **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΩΝ ΠΡΟΒΟΛΩΝ ΑΓΓΕΛΙΑΣ** (ADR-777 §8.72).
 * @related lib/listings/listing-stats.ts (ο ορισμός) · services/listings/listing-view-salt.ts ·
 *   app/api/public-listings/[listingId]/view/route.ts (ο μόνος καλών)
 * @module services/listings/listing-view-recorder
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΣΕΙΡΑ ΕΙΝΑΙ ΑΠΟ ΤΟ ΦΘΗΝΟ ΣΤΟ ΑΚΡΙΒΟ — ΚΑΙ ΚΑΘΕ ΒΗΜΑ ΜΠΟΡΕΙ ΝΑ ΣΤΑΜΑΤΗΣΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | # | Ερώτηση | Κόστος | «Όχι» ⇒ |
 * |---|---|---|---|
 * | 1 | Είναι στην αγορά; (`public_listings/{id}` υπάρχει) | 1 ανάγνωση | `not-listed` — σκουπίδια-ταυτότητες δεν γεννούν έγγραφα |
 * | 2 | Είναι ο θεματοφύλακας; (μόνο αν υπάρχει ταυτότητα) | 1 ανάγνωση | `own-listing` |
 * | 3 | Μετρήθηκε ήδη σήμερα; (`create()` σημαδιού) | 1 εγγραφή | `duplicate` |
 *
 * 🔴 **ΤΟ ΒΗΜΑ 3 ΕΙΝΑΙ ΑΤΟΜΙΚΟ ΜΕ ΤΗΝ ΑΥΞΗΣΗ**: σημάδι και shard σε **ένα** batch. Αν το σημάδι
 * υπάρχει, το batch αποτυγχάνει **ολόκληρο** ⇒ καμία αύξηση. Δύο ταυτόχρονα αιτήματα του ίδιου
 * ανθρώπου ⇒ ακριβώς **μία** προβολή. Κανένα read-then-write, καμία συναλλαγή.
 *
 * 🔑 **Ο κριτής του «είσαι ο κάτοχος;» είναι ο ΕΝΑΣ** — `mayAdminister(custody, actor)`, ο ίδιος που
 * απαντά `contact-own-target` στην πρώτη επαφή (CHECK 3.56). Ο Zillow μετρά τον κάτοχο· εμείς όχι.
 */

import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AdminFirestore } from '@/lib/api/guarded-route';
import { isAlreadyExistsError } from '@/lib/firestore/firestore-already-exists';
import {
  LISTING_VIEW_SHARD_COUNT,
  LISTING_VIEW_TTL_DAYS,
  ephemeralExpiryOf,
  marketDayOf,
} from '@/lib/listings/listing-stats';
import { mayAdminister, type ListingActor } from '@/lib/owner-property/listing-custody';
import { createModuleLogger } from '@/lib/telemetry';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { resolveListing } from '@/services/listings/listing-resolver';
import { listingViewSaltOf } from '@/services/listings/listing-view-salt';

const logger = createModuleLogger('listing-view-recorder');

export interface ListingViewInput {
  /** Η ταυτότητα της δημόσιας αγγελίας — **ίδια** με του ακινήτου (ADR-777 Α3). */
  readonly listingId: string;
  readonly ip: string;
  readonly userAgent: string;
  /** Ο συνδεδεμένος θεατής, ή `null` για ανώνυμο. */
  readonly viewer: ListingActor | null;
  readonly nowMs: number;
}

/** Τι έγινε — για τα tests και τα logs· ο καλών **δεν** το αποκαλύπτει στο σύρμα. */
export type ListingViewOutcome = 'counted' | 'duplicate' | 'not-listed' | 'own-listing' | 'unavailable';

/** `sha256(αλάτι ‖ ημέρα ‖ ακίνητο ‖ IP ‖ UA)` — το ακίνητο μέσα ώστε τα σημάδια να μη συνδέονται. */
export function visitorDayHash(salt: string, day: string, propertyId: string, ip: string, userAgent: string): string {
  return createHash('sha256').update([salt, day, propertyId, ip, userAgent].join('\u0000')).digest('hex');
}

async function isOnMarket(adminDb: AdminFirestore, listingId: string): Promise<boolean> {
  const snapshot = await adminDb.collection(COLLECTIONS.PUBLIC_LISTINGS).doc(listingId).get();
  return snapshot.exists;
}

/** `true` μόνο αν **αποδείχτηκε** ότι ο θεατής διαχειρίζεται την αγγελία. Βλάβη ⇒ `null`. */
async function isCustodian(
  adminDb: AdminFirestore, listingId: string, viewer: ListingActor, nowMs: number,
): Promise<boolean | null> {
  const resolved = await resolveListing(adminDb, listingId, new Date(nowMs).toISOString());
  if (resolved === null) return null;
  return resolved !== 'absent' && mayAdminister(resolved.custody, viewer);
}

/** Σημάδι + αύξηση, **ατομικά**. `false` ⇔ το σημάδι υπήρχε ήδη. */
async function markAndCount(adminDb: AdminFirestore, listingId: string, day: string, hash: string): Promise<boolean> {
  const shard = Math.floor(Math.random() * LISTING_VIEW_SHARD_COUNT);
  const markRef = adminDb
    .collection(COLLECTIONS.LISTING_VIEW_MARKS)
    .doc(enterpriseIdService.generateDeterministicListingViewMarkId(hash));
  const shardRef = adminDb
    .collection(COLLECTIONS.LISTING_VIEW_SHARDS)
    .doc(enterpriseIdService.generateDeterministicListingViewShardId(listingId, day, shard));

  const batch = adminDb.batch();
  batch.create(markRef, { day, expiresAt: ephemeralExpiryOf(day, LISTING_VIEW_TTL_DAYS.mark) });
  batch.set(shardRef, {
    propertyId: listingId,
    day,
    shard,
    views: FieldValue.increment(1),
    expiresAt: ephemeralExpiryOf(day, LISTING_VIEW_TTL_DAYS.shard),
  }, { merge: true });
  try {
    await batch.commit();
    return true;
  } catch (error) {
    if (isAlreadyExistsError(error)) return false;
    throw error;
  }
}

async function judgeAndRecord(adminDb: AdminFirestore, input: ListingViewInput): Promise<ListingViewOutcome> {
  if (!(await isOnMarket(adminDb, input.listingId))) return 'not-listed';
  if (input.viewer !== null) {
    const custodian = await isCustodian(adminDb, input.listingId, input.viewer, input.nowMs);
    if (custodian === null) return 'unavailable';
    if (custodian) return 'own-listing';
  }
  const day = marketDayOf(input.nowMs);
  const salt = await listingViewSaltOf(adminDb, day);
  const hash = visitorDayHash(salt, day, input.listingId, input.ip, input.userAgent);
  return (await markAndCount(adminDb, input.listingId, day, hash)) ? 'counted' : 'duplicate';
}

/**
 * **Κατάγραψε μία προβολή** — αν είναι προβολή. Δεν πετά ποτέ: η βλάβη γίνεται `unavailable` και
 * γράφεται στο log, γιατί ο μετρητής **δεν επιτρέπεται** να σπάσει τη σελίδα της αγγελίας.
 */
export async function recordListingView(adminDb: AdminFirestore, input: ListingViewInput): Promise<ListingViewOutcome> {
  try {
    return await judgeAndRecord(adminDb, input);
  } catch (error) {
    logger.error('[LISTING-VIEW] Η καταγραφή απέτυχε — η προβολή χάθηκε, η σελίδα όχι', {
      listingId: input.listingId,
      error: error instanceof Error ? error.message : String(error),
    });
    return 'unavailable';
  }
}
