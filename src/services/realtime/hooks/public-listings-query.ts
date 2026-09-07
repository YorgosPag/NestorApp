/**
 * @fileoverview ΤΟ ΣΧΕΔΙΟ ΑΝΑΓΝΩΣΗΣ → **ΕΝΑ** ερώτημα Firestore, και η τίμια καταμέτρηση.
 * @related ADR-777 §8.65 · lib/listings/listing-geo-query.ts · CHECK 3.10 · 3.15 · 3.35
 * @module services/realtime/hooks/public-listings-query
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 **ΕΝΑ** ΕΡΩΤΗΜΑ, ΟΧΙ 4-9 — ΕΥΡΗ ΣΕ ΠΟΛΛΑ ΠΕΔΙΑ ΑΝΤΙ ΓΙΑ GEOHASH
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Δες το `lib/listings/listing-geo-query.ts` για τη **μετρημένη** σύγκριση (geohash:
 * 5,4× περιττά έγγραφα · εύρη σε πολλά πεδία: 1,3×). Εδώ ζει μόνο η **μετάφραση** του
 * σχεδίου σε περιορισμούς της βιβλιοθήκης.
 *
 * 🔴 **ΚΑΙ Η ΣΥΝΕΠΕΙΑ ΓΙΑ ΤΟ ΖΩΝΤΑΝΟ ΕΙΝΑΙ ΤΟ ΜΙΣΟ ΠΡΟΪΟΝ**: με geohash η ζωντανή
 * παρακολούθηση θα σήμαινε **4-9 ακροατές που αλλάζουν σε κάθε σύρσιμο**, δηλαδή
 * πολυτέλεια που κανείς από τους μεγάλους δεν δίνει. Με **ένα** ερώτημα, ένας ακροατής
 * — και το «η νέα αγγελία εμφανίζεται μόνη της» γίνεται εφικτό.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ ΤΟ ΣΥΝΘΕΤΟ ΕΥΡΕΤΗΡΙΟ ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΟ (CHECK 3.15)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Δύο πεδία σε εύρος ⇒ σύνθετο ευρετήριο στο `firestore.indexes.json`. Χωρίς αυτό το
 * ερώτημα **αποτυγχάνει σε χρόνο εκτέλεσης** με σύνδεσμο δημιουργίας στην κονσόλα —
 * δηλαδή η οθόνη μένει άδεια στην παραγωγή ενώ ο emulator είναι χαρούμενος.
 */

import {
  collection,
  getCountFromServer,
  limit,
  query,
  where,
} from 'firebase/firestore';
import type { DocumentData, Query, QueryConstraint } from 'firebase/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { db } from '@/lib/firebase';
import {
  countIsExactFor,
  listingCountBox,
  listingReadPlan,
  LISTING_POINT_FIELD,
  LISTING_READ_CAP,
  type ListingReadPlan,
} from '@/lib/listings/listing-geo-query';
import { createModuleLogger } from '@/lib/telemetry';
import type { GeoArea, GeoBoundingBox } from '@/types/geo/coordinates';

const logger = createModuleLogger('public-listings-query');

/**
 * Τα τέσσερα εύρη ενός ορθογωνίου.
 *
 * ⚠️ **Η σειρά των περιορισμών εδώ ΔΕΝ είναι η σειρά του ευρετηρίου** — το Firestore
 * τους ταξινομεί μόνο του. Η σειρά που μετράει είναι γραμμένη στο
 * `firestore.indexes.json`, και ο λόγος της είναι εκεί.
 */
function boxConstraints(box: GeoBoundingBox): readonly QueryConstraint[] {
  return [
    where(LISTING_POINT_FIELD.lat, '>=', box.south),
    where(LISTING_POINT_FIELD.lat, '<=', box.north),
    where(LISTING_POINT_FIELD.lng, '>=', box.west),
    where(LISTING_POINT_FIELD.lng, '<=', box.east),
  ];
}

/**
 * Το σχέδιο → περιορισμοί, **χωρίς** το όριο.
 *
 * 🔑 Χωριστά από το `limit`, γιατί η **καταμέτρηση** χρειάζεται τους ίδιους
 * περιορισμούς **χωρίς** αυτό. Δύο αντίγραφα των τεσσάρων `where` θα ήταν δύο
 * ευκαιρίες να μετρήσουμε άλλη ερώτηση από αυτή που δείξαμε.
 */
function planConstraints(plan: ListingReadPlan): readonly QueryConstraint[] {
  return plan.kind === 'everywhere' ? [] : boxConstraints(plan.box);
}

/**
 * **Το ερώτημα της οθόνης 2** — περιοχή (αν υπάρχει) + το πάντοτε παρόν όριο.
 *
 * tenant-scope-exempt: `public_listings` είναι δηλωμένη `published-projection` στο
 * `services/firestore/tenant-config.ts` — κλειστό σχήμα **ΧΩΡΙΣ ταυτότητα πελάτη**,
 * γραμμένο μόνο από τον διακομιστή. Ο κανόνας `read: if true` επιτρέπει ρητά την
 * αφιλτράριστη λίστα· τα φίλτρα εδώ είναι **γεωγραφικά**, δηλαδή **στενότερα** από ό,τι
 * ήδη επιτρέπεται (άγκυρα: `public-listings.rules.test.ts`).
 *
 * ⚠️ **Ζητάμε ΕΝΑ ΠΑΡΑΠΑΝΩ από το όριο, επίτηδες.** Είναι ο μόνος τρόπος να ξέρουμε
 * *«υπάρχουν κι άλλες;»* **χωρίς** δεύτερο ερώτημα: αν γυρίσουν `CAP + 1`, κόπηκε. Ένα
 * σκέτο `limit(CAP)` που γυρίζει ακριβώς `CAP` είναι **αμφίσημο** — και η αμφισημία θα
 * γινόταν οθόνη που άλλοτε λέει «ζουμάρετε» και άλλοτε όχι, στα ίδια δεδομένα.
 */
export function publicListingsQuery(near: GeoArea | null): Query<DocumentData> {
  return query(
    collection(db, COLLECTIONS.PUBLIC_LISTINGS),
    ...planConstraints(listingReadPlan(near)),
    limit(LISTING_READ_CAP + 1)
  );
}

/**
 * **Πόσες αγγελίες υπάρχουν πραγματικά εκεί** — ή `null` όταν δεν μπορεί να ειπωθεί.
 *
 * 🔴 **Το ερώτημα καταμέτρησης ΔΕΝ είναι το ερώτημα ανάγνωσης**, και η διαφορά είναι
 * όλη η ειλικρίνεια: η ανάγνωση τρέχει σε **διευρυμένο** ορθογώνιο *(ώστε να μη χαθεί
 * η «τρίτη κατηγορία»)*, η καταμέτρηση στο **αδιεύρυντο** *(ώστε ο αριθμός να απαντά
 * στην ερώτηση που έκανε ο άνθρωπος)*. Μετρημένο στο διευρυμένο, ο μετρητής θα ήταν
 * πάλι *«συνεπής και ψεύτης»* — το ακριβές εύρημα του §8.62.
 *
 * ⚠️ **Επιστρέφει `null` αντί να μαντέψει.** Για **κύκλο** το περιγεγραμμένο ορθογώνιο
 * είναι έως 21,5% μεγαλύτερο· ένας ακριβής αριθμός εκεί θα ήταν ψεύτικος με τρία ψηφία.
 *
 * ⚠️ **Η αποτυχία δεν είναι σφάλμα οθόνης.** Η καταμέτρηση είναι **επιπλέον** γνώση:
 * αν δεν έρθει, η οθόνη λέει *«περισσότερες από όσες δείχνουμε»* — που είναι ήδη
 * αληθές. Ένα `throw` εδώ θα αντάλλασσε μια πλήρη λίστα με μια κόκκινη οθόνη.
 */
export async function countPublicListings(near: GeoArea | null): Promise<number | null> {
  if (!countIsExactFor(near)) return null;

  const constraints = near === null ? [] : boxConstraints(listingCountBox(near));

  try {
    const snapshot = await getCountFromServer(
      query(collection(db, COLLECTIONS.PUBLIC_LISTINGS), ...constraints)
    );
    return snapshot.data().count;
  } catch (err) {
    logger.warn('Δεν μετρήθηκε το σύνολο των αγγελιών της περιοχής', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
