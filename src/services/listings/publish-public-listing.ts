/**
 * @fileoverview **Ο ΓΡΑΦΕΑΣ ΤΗΣ ΠΡΟΒΟΛΗΣ** — διακομιστής μόνο, idempotent, αυτοϊάσιμος.
 * @related ADR-777 §7 (Α1 · Α3 · Α5) · services/listings/public-listing-projection.ts
 * @module services/listings/publish-public-listing
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΣΥΜΒΟΛΑΙΟ, ΣΕ ΤΡΕΙΣ ΓΡΑΜΜΕΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   δημοσιεύεται  ⇒ `set()` ολόκληρου του εγγράφου  (ίδια είσοδος ⇒ ίδιο έγγραφο)
 *   δεν δημοσιεύεται ⇒ `delete()`                    (η απόσυρση ΣΥΜΒΑΙΝΕΙ)
 *   ταυτότητα     = το ίδιο το `propertyId`          (καμία νέα γεννήτρια)
 *
 * 🔑 **`set()` και ποτέ `update()`.** Η προβολή είναι **παράγωγο**: αν μια μερική
 * ενημέρωση άφηνε παλιό πεδίο ζωντανό, το δημόσιο έγγραφο θα ήταν μείγμα δύο
 * καταστάσεων — και κανείς δεν θα μπορούσε να πει ποιων. Το ολικό `set` κάνει την
 * επανασύνθεση **ταυτόσημη** με την πρώτη σύνθεση, που είναι και ο ορισμός του
 * idempotent (ίδιο ιδίωμα με το `floorUnitsAggregation`).
 *
 * ⚠️ **Ο κύκλος ζωής της ΘΕΣΗΣ ζει αλλού από το ακίνητο** (Α1): αλλάζει στο **έργο**.
 * Γι' αυτό εκτίθεται και το {@link republishListingsForProject} — αλλιώς μια διόρθωση
 * διεύθυνσης θα άφηνε **κάθε** αγγελία του έργου με παλιά θέση, σιωπηλά.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';
import { nowISO } from '@/lib/date-local';
import {
  buildPublicListing,
  addressToPositionCandidate,
  type ProjectableProperty,
  type PlaceKnowledge,
  type ListingPositionCandidate,
  type AddressLike,
} from './public-listing-projection';

const logger = createModuleLogger('publish-public-listing');

/** Τι έκανε ο γραφέας — ρητά, ώστε η επανασύνθεση να μπορεί να **μετρήσει**. */
export type PublishOutcome = 'published' | 'withdrawn' | 'failed';

/**
 * Μαζεύει ό,τι ξέρουμε για τον τόπο ενός ακινήτου, **ανεβαίνοντας την αλυσίδα της Α1**:
 * ακίνητο → κτίριο → έργο.
 *
 * ⚠️ **Διαβάζει με Admin SDK επίτηδες.** Ο ανώνυμος επισκέπτης **δεν** έχει —και δεν
 * πρέπει να αποκτήσει— πρόσβαση στα `buildings`/`projects`. Η ανάλυση γίνεται εδώ
 * **μία φορά**, και ό,τι φτάνει στον κόσμο είναι μόνο το **αποτέλεσμα**.
 */
export async function collectPlaceKnowledge(
  adminDb: AdminFirestore,
  property: { buildingId?: string | null; projectId?: string | null },
  locatedAt: string
): Promise<PlaceKnowledge> {
  const projectId = await resolveProjectId(adminDb, property);
  if (!projectId) return { candidates: [] };

  const snap = await adminDb.collection(COLLECTIONS.PROJECTS).doc(projectId).get();
  if (!snap.exists) return { candidates: [] };

  const addresses = (snap.data()?.addresses ?? []) as AddressLike[];
  const candidates = addresses
    .map((address) => addressToPositionCandidate(address, locatedAt))
    .filter((c): c is ListingPositionCandidate => c !== null);

  return { candidates };
}

/** Το έργο του ακινήτου — απευθείας, ή μέσω του κτιρίου του. */
async function resolveProjectId(
  adminDb: AdminFirestore,
  property: { buildingId?: string | null; projectId?: string | null }
): Promise<string | null> {
  if (property.projectId) return property.projectId;
  if (!property.buildingId) return null;

  const building = await adminDb.collection(COLLECTIONS.BUILDINGS).doc(property.buildingId).get();
  return building.exists ? ((building.data()?.projectId as string | undefined) ?? null) : null;
}

/**
 * Ξαναγράφει (ή σβήνει) την προβολή **ενός** ακινήτου.
 *
 * 🔑 **Δεν πετά ποτέ.** Η αποτυχία της δημόσιας προβολής **δεν** επιτρέπεται να
 * ακυρώσει την αποθήκευση του κατόχου: εκείνος έκανε τη δουλειά του. Επιστρέφει
 * `'failed'` **ονομαστικά** ώστε ο καλών να το καταγράψει και η επανασύνθεση να το
 * διορθώσει — που είναι η διαφορά ανάμεσα σε «*σιωπηλά μπαγιάτικο*» και «*γνωστά
 * εκκρεμές*».
 */
export async function republishListing(
  adminDb: AdminFirestore,
  propertyId: string,
  property: ProjectableProperty & { buildingId?: string | null; projectId?: string | null }
): Promise<PublishOutcome> {
  const now = nowISO();
  const ref = adminDb.collection(COLLECTIONS.PUBLIC_LISTINGS).doc(propertyId);

  try {
    const place = await collectPlaceKnowledge(adminDb, property, now);
    const listing = buildPublicListing({ ...property, id: propertyId }, place, now);

    if (!listing) {
      await ref.delete();
      return 'withdrawn';
    }

    await ref.set(listing);
    return 'published';
  } catch (error) {
    logger.error('Η προβολή δεν ενημερώθηκε — η αγγελία μένει ΜΠΑΓΙΑΤΙΚΗ μέχρι την επανασύνθεση', {
      propertyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return 'failed';
  }
}

/**
 * Ξαναγράφει τις προβολές **όλων** των ακινήτων ενός έργου.
 *
 * Η θέση ζει στο **έργο** (Α1): μια διόρθωση διεύθυνσης εκεί αλλάζει το σχήμα στον
 * χάρτη για **κάθε** αγγελία του — και χωρίς αυτό, καμία δεν θα το μάθαινε.
 */
export async function republishListingsForProject(
  adminDb: AdminFirestore,
  projectId: string
): Promise<Record<PublishOutcome, number>> {
  // tenant-scope-exempt: το `projectId` ΕΙΝΑΙ όριο μισθωτή — ένα έργο ανήκει σε
  // ακριβώς μία εταιρεία, οπότε το φίλτρο δεν είναι ευρύτερο από ένα `companyId`,
  // είναι στενότερο. Επιπλέον τρέχει με Admin SDK ως **επανασύνθεση παραγώγου**: ο
  // καλών έχει ήδη αποδείξει δικαίωμα στο έργο, και η έξοδος είναι η δημόσια προβολή,
  // που εξ ορισμού δεν κουβαλά ταυτότητα πελάτη (`types/public-listing.ts`).
  const snap = await adminDb
    .collection(COLLECTIONS.PROPERTIES)
    .where('projectId', '==', projectId)
    .get();

  const tally: Record<PublishOutcome, number> = { published: 0, withdrawn: 0, failed: 0 };

  for (const doc of snap.docs) {
    const outcome = await republishListing(
      adminDb,
      doc.id,
      doc.data() as ProjectableProperty & { buildingId?: string | null; projectId?: string | null }
    );
    tally[outcome] += 1;
  }

  logger.info('Επανασύνθεση προβολών έργου', { projectId, ...tally });
  return tally;
}
