import 'server-only';

/**
 * @fileoverview **Ο ΕΝΑΣ ΓΡΑΦΕΑΣ ΤΗΣ ΑΠΟΘΗΚΕΥΣΗΣ** — «κράτα» · «άφησε» · «τι κράτησα» · «πόσοι κράτησαν».
 * @related ADR-777 §8.74 · types/saved-listing.ts · lib/listings/saved-listing.ts
 * @module services/listings/saved-listing.service
 *
 * 🔑 **Δύο ερωτήσεις πριν από κάθε αποθήκευση, από το φθηνό στο ακριβό:**
 * 1. *«είναι στην αγορά;»* — `public_listings/{id}` (ό,τι δεν βλέπει ο κόσμος δεν κρατιέται)·
 * 2. *«είναι δική σου;»* — ο **ΕΝΑΣ** κριτής θεματοφυλακής (`mayAdminister`, CHECK 3.56), ο ίδιος
 *    με την επεξεργασία και τις προβολές. Ο κάτοχος δεν «αγαπά» τη δική του αγγελία: θα φούσκωνε
 *    τη μετρική που βλέπει ο ίδιος. Βλάβη του κριτή ⇒ `unavailable`, **ποτέ** «αποθήκευσε για σιγουριά».
 *
 * 🔴 **Idempotent εκ κατασκευής**: ντετερμινιστική ταυτότητα (άνθρωπος, αγγελία) + `create()`. Δύο
 * ταυτόχρονα κλικ = **ένα** έγγραφο· το δεύτερο βρίσκει το πρώτο και απαντά «κρατημένη».
 */

import { COLLECTIONS, FIRESTORE_LIMITS } from '@/config/firestore-collections';
import type { AdminFirestore } from '@/lib/api/guarded-route';
import { chunkArray } from '@/lib/array-utils';
import { isAlreadyExistsError } from '@/lib/firestore/firestore-already-exists';
import { publicListingFromDocument } from '@/lib/listings/public-listing-from-document';
import { priceAtSaveOf, priceSinceSave, readSavedListing } from '@/lib/listings/saved-listing';
import { mayAdminister, type ListingActor } from '@/lib/owner-property/listing-custody';
import { createModuleLogger } from '@/lib/telemetry';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { resolveListing } from '@/services/listings/listing-resolver';
import type { PublicListing } from '@/types/public-listing';
import type { SaveRefusal, SavedListing, SavedListingRow } from '@/types/saved-listing';

const logger = createModuleLogger('saved-listing.service');

/**
 * **Πόσες αποθηκεύσεις διαβάζει η λίστα** — φράχτης ανάγνωσης, όχι όριο πράξης. Κανένας άνθρωπος
 * που ψάχνει σπίτι δεν κρατά 500 αγγελίες· αν γίνει, η λίστα το λέει (`truncated`), δεν σιωπά.
 */
export const SAVED_LISTINGS_READ_LIMIT = 500;

/** Τι απέγινε μια αποθήκευση. Ονομασμένο, ποτέ boolean. */
export type SaveOutcome = 'saved' | SaveRefusal | 'unavailable';

function savedListings(adminDb: AdminFirestore) {
  return adminDb.collection(COLLECTIONS.SAVED_LISTINGS);
}

function savedDocOf(adminDb: AdminFirestore, saverUserId: string, listingId: string) {
  return savedListings(adminDb).doc(enterpriseIdService.generateDeterministicSavedListingId(saverUserId, listingId));
}

async function readPublicListing(adminDb: AdminFirestore, listingId: string): Promise<PublicListing | null> {
  const snapshot = await adminDb.collection(COLLECTIONS.PUBLIC_LISTINGS).doc(listingId).get();
  return snapshot.exists ? publicListingFromDocument(snapshot.data(), snapshot.id) : null;
}

/** `true` μόνο αν **αποδείχτηκε** ότι ο δρων διαχειρίζεται την αγγελία. Βλάβη ⇒ `null`. */
async function isCustodian(adminDb: AdminFirestore, listingId: string, actor: ListingActor, nowMs: number): Promise<boolean | null> {
  const resolved = await resolveListing(adminDb, listingId, new Date(nowMs).toISOString());
  if (resolved === null) return null;
  return resolved !== 'absent' && mayAdminister(resolved.custody, actor);
}

async function createSaved(adminDb: AdminFirestore, actor: ListingActor, listing: PublicListing, nowMs: number): Promise<void> {
  const ref = savedDocOf(adminDb, actor.uid, listing.id);
  const saved: SavedListing = {
    id: ref.id,
    saverUserId: actor.uid,
    listingId: listing.id,
    savedAt: new Date(nowMs).toISOString(),
    priceAtSave: priceAtSaveOf(listing),
  };
  try {
    await ref.create(saved);
  } catch (error) {
    // Ήδη κρατημένη: η πρώτη αποθήκευση (και η τιμή της) μένει — το δεύτερο κλικ δεν την ξαναγράφει.
    if (!isAlreadyExistsError(error)) throw error;
  }
}

/** **Κράτα αυτή την αγγελία.** Idempotent· δεν πετά ποτέ. */
export async function saveListing(
  adminDb: AdminFirestore, actor: ListingActor, listingId: string, nowMs: number,
): Promise<SaveOutcome> {
  try {
    const listing = await readPublicListing(adminDb, listingId);
    if (listing === null) return 'not-in-market';
    const custodian = await isCustodian(adminDb, listingId, actor, nowMs);
    if (custodian === null) return 'unavailable';
    if (custodian) return 'own-listing';
    await createSaved(adminDb, actor, listing, nowMs);
    return 'saved';
  } catch (error) {
    logger.error('[SAVED-LISTING] Η αποθήκευση απέτυχε', { error: error instanceof Error ? error.message : String(error) });
    return 'unavailable';
  }
}

/**
 * **Άφησε αυτή την αγγελία.** Το έγγραφο **σβήνεται** (ελαχιστοποίηση δεδομένων) — idempotent: η
 * αφαίρεση ανύπαρκτης αποθήκευσης είναι επιτυχία. Δεν ρωτά «στην αγορά;»: ό,τι αποσύρθηκε
 * πρέπει να μπορεί να αφεθεί.
 */
export async function unsaveListing(adminDb: AdminFirestore, saverUserId: string, listingId: string): Promise<void> {
  await savedDocOf(adminDb, saverUserId, listingId).delete();
}

/** Οι αποθηκεύσεις **ενός** ανθρώπου, ωμές — νεότερη πρώτα. */
export async function readSavedListingsOf(
  adminDb: AdminFirestore, saverUserId: string,
): Promise<{ readonly saved: readonly SavedListing[]; readonly truncated: boolean }> {
  // Η συλλογή γράφεται ΡΗΤΑ στο ερώτημα: ο ελεγκτής δεικτών (CHECK 3.91) την αποδεικνύει στατικά.
  const snapshot = await adminDb
    .collection(COLLECTIONS.SAVED_LISTINGS)
    .where('saverUserId', '==', saverUserId)
    .limit(SAVED_LISTINGS_READ_LIMIT)
    .get();
  const saved = snapshot.docs.flatMap((doc) => {
    const row = readSavedListing(doc.data());
    return row === null ? [] : [row];
  });
  // Ταξινόμηση στη μνήμη: ισότητα ενός πεδίου ⇒ κανένας σύνθετος δείκτης (ίδιο με το `first_contacts`).
  saved.sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
  return { saved, truncated: snapshot.size >= SAVED_LISTINGS_READ_LIMIT };
}

function rowOf(saved: SavedListing, listing: PublicListing | null): SavedListingRow {
  if (listing === null) return { kind: 'withdrawn', listingId: saved.listingId, savedAt: saved.savedAt };
  return {
    kind: 'in-market',
    listingId: saved.listingId,
    savedAt: saved.savedAt,
    listing,
    priceSinceSave: priceSinceSave(saved.priceAtSave, priceAtSaveOf(listing)),
  };
}

/**
 * **Η λίστα «Αποθηκευμένα»** — η **τρέχουσα** δημόσια αγγελία κάθε αποθήκευσης, ή «εκτός αγοράς».
 * Μία `getAll`, ποτέ μία ανάγνωση ανά γραμμή.
 */
export async function readSavedListingRows(
  adminDb: AdminFirestore, saverUserId: string,
): Promise<{ readonly rows: readonly SavedListingRow[]; readonly truncated: boolean }> {
  const { saved, truncated } = await readSavedListingsOf(adminDb, saverUserId);
  if (saved.length === 0) return { rows: [], truncated };
  const listings = adminDb.collection(COLLECTIONS.PUBLIC_LISTINGS);
  const docs = await adminDb.getAll(...saved.map((entry) => listings.doc(entry.listingId)));
  const rows = saved.map((entry, index) => {
    const doc = docs[index];
    const listing = doc?.exists ? publicListingFromDocument(doc.data(), doc.id) : null;
    return rowOf(entry, listing);
  });
  return { rows, truncated };
}

/**
 * **Οι αποθηκεύσεις ΑΥΤΩΝ των αγγελιών** — για τα στατιστικά του κατόχου και για τον ειδοποιητή.
 * @returns `null` σε βλάβη: **άγνωστο ≠ μηδέν** (ίδιο συμβόλαιο με τις επαφές, §8.72).
 */
export async function readSavesOfListings(
  adminDb: AdminFirestore, listingIds: readonly string[],
): Promise<readonly SavedListing[] | null> {
  try {
    const saves: SavedListing[] = [];
    for (const chunk of chunkArray([...listingIds], FIRESTORE_LIMITS.IN_QUERY_MAX_ITEMS)) {
      // tenant-scope-exempt: ΓΟΝΕΑΣ, όχι απομόνωση — «πόσοι κράτησαν ΑΥΤΕΣ τις αγγελίες». Οι καλούντες
      // δίνουν ids ΗΔΗ φιλτραρισμένα: τα στατιστικά από τον `mayAdminister` (μόνο πλήθος επιστρέφεται),
      // ο ειδοποιητής από τις ζωντανές δημόσιες αγγελίες (ο παραλήπτης είναι ο ίδιος ο αποθηκεύων).
      const snapshot = await adminDb.collection(COLLECTIONS.SAVED_LISTINGS).where('listingId', 'in', chunk).get();
      for (const doc of snapshot.docs) {
        const saved = readSavedListing(doc.data());
        if (saved !== null) saves.push(saved);
      }
    }
    return saves;
  } catch (error) {
    logger.error('[SAVED-LISTING] Οι αποθηκεύσεις δεν διαβάστηκαν — άγνωστο, όχι μηδέν', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
