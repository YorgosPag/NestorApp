/**
 * @fileoverview **Οι προεπιλογές της αλυσίδας μεταναστεύσεων, ως κριτές μορφής.**
 * @module lib/listings/public-listing-shape-judges
 * @related ./public-listing-schema.ts · ./public-listing-migrations-02-10.ts · ./public-listing-migrations-11-20.ts
 */

import { z } from 'zod';

import { LISTED_TOUR_VISIBILITIES } from '@/constants/spatial-tour-vocabulary';
import type { ListedAt } from '@/types/public-listing';
import { readStayPetPolicy } from '@/lib/offers/stay-pet-policy';
import type { StoredListingDocument } from './public-listing-schema-types';

// ============================================================================
// ΟΙ ΠΡΟΕΠΙΛΟΓΕΣ, ΩΣ ΚΡΙΤΕΣ ΜΟΡΦΗΣ
// ============================================================================

/**
 * 🔑 **`.catch()` και όχι `??`** — η διαφορά είναι μετρήσιμη. Το `??` δέχεται
 * ό,τι δεν είναι `null`/`undefined`, άρα ένα `legality: "ναι"` γραμμένο από
 * σφάλμα θα περνούσε αυτούσιο και θα έσκαγε **στο ίδιο `.map`**. Το `.catch()`
 * ρωτά **μορφή** και πέφτει στην προεπιλογή όταν η απάντηση δεν στέκει.
 *
 * ⚠️ **Ο έλεγχος είναι ΡΗΧΟΣ, και είναι απόφαση.** Κρίνεται ότι το πεδίο είναι
 * *πίνακας από αντικείμενα*, όχι ότι κάθε σήμα είναι έγκυρο `LegalitySignal` — μια
 * βαθιά ένωση εδώ θα ήταν ο καθρέφτης που η κεφαλίδα απορρίπτει. Το βαθύ ερώτημα
 * το απαντά ο **γραφέας**, όπου ο μεταγλωττιστής μπορεί να το επιβάλει.
 */
export const legalityArray = z.array(z.object({}).passthrough()).catch([]);

/**
 * **Η συλλογή του κατόχου** — ίδιο ρηχό ιδίωμα με το {@link legalityArray}, ίδιος λόγος.
 *
 * 🔑 **Κενός πίνακας ΕΙΝΑΙ η σωστή απάντηση**: ένα έγγραφο γραμμένο πριν υπάρξει η
 * ερώτηση *«ποιες φωτογραφίες δημοσιεύω;»* δεν έχει **άγνωστη** συλλογή — **δεν του
 * τέθηκε** το ερώτημα. Και η απάντηση συμπίπτει με την αλήθεια της **opt-in** επιλογής
 * (ADR-841 §7 Α2.7): κανείς δεν είχε διαλέξει τίποτα, άρα ο κόσμος έβλεπε **τίποτα**.
 */
export const galleryArray = z.array(z.object({}).passthrough()).catch([]);

/**
 * **Οι κατόψεις** — ίδιο **ρηχό** ιδίωμα με το {@link galleryArray}, ίδιος ακριβώς λόγος
 * (ADR-841 §7 Α17).
 *
 * ⚠️ **Κρίνεται μόνο ότι είναι *πίνακας από αντικείμενα*** — **όχι** ότι κάθε στοιχείο
 * είναι έγκυρο `SourcedAttribute` με `provenance`/`value`/`at`. Το βαθύ σχήμα ανήκει στον
 * **γραφέα**, που το παράγει· εδώ κρίνεται μόνο ό,τι χρειάζεται ώστε η **ανάγνωση** να
 * μην πέσει. Ίδιο σκεπτικό γραμμένο ήδη στον κρίκο 5 για τα `legality`/`gallery`.
 */
export const floorplansArray = z.array(z.object({}).passthrough()).catch([]);

/**
 * **Τα τρισδιάστατα μοντέλα** — ίδιο **ρηχό** ιδίωμα με το {@link floorplansArray}
 * *(ADR-845 Φ4.1)*, και ίδιος ακριβώς λόγος.
 *
 * ⚠️ **Ξεχωριστή δήλωση παρότι το σχήμα είναι ταυτόσημο, ΚΑΙ ΕΙΝΑΙ ΣΚΟΠΙΜΟ.** Ένα κοινό
 * `const shallowArray` θα έδενε **τρία** πεδία σε **έναν** κριτή: την ημέρα που οι
 * κατόψεις χρειαστούν βαθύτερο έλεγχο *(και θα τον χρειαστούν — δες το `listedAtValue`
 * ακριβώς από κάτω, όπου η διαφορά **μέτρησε**)*, το μοντέλο θα τον κληρονομούσε χωρίς
 * να τον έχει ζητήσει κανείς. Το κόστος είναι **μία γραμμή**· το όφελος είναι ότι τα
 * πεδία μπορούν να αποκλίνουν **επειδή κάποιος το αποφάσισε**.
 */
export const modelsArray = z.array(z.object({}).passthrough()).catch([]);

/** ADR-907 §10 — **δικός του** κριτής, για τον λόγο που γράφεται ακριβώς από πάνω: τα πεδία αποκλίνουν με απόφαση. */
export const videosArray = z.array(z.object({}).passthrough()).catch([]);

/**
 * ADR-907 §11 — η κάτοψη ορόφου, **ρηχά** όπως τα αδέλφια της. Το βάθος (περίγραμμα, κατάσταση) το κρίνει ο αναγνώστης
 * της όψης (`readFloorPlateOutline` · `isFloorPlateState`), ανά μονάδα: μία χαλασμένη δεν ρίχνει τις άλλες.
 */
export const floorPlatesArray = z.array(z.object({}).passthrough()).catch([]);

/**
 * ADR-884 — η παρουσία περιήγησης, και εδώ ο έλεγχος είναι **ΒΑΘΥΣ** (όπως το `listedAtValue`): η `visibility` **είναι**
 * η πληροφορία, και ένα ρηχό `passthrough()` θα άφηνε ένα `{ visibility: 'link-only' }` να ανάψει σήμα για περιήγηση
 * που εξ ορισμού δεν φαίνεται στην αγγελία. Ό,τι δεν στέκει ⇒ `null` («καμία»).
 */
export const tourPresenceValue = z
  .object({ visibility: z.enum(LISTED_TOUR_VISIBILITIES) })
  .nullable()
  .catch(null);

/**
 * **Πότε μπήκε στην αγορά** (ADR-777 §8.61) — και εδώ ο έλεγχος είναι **ΒΑΘΥΣ**, σε
 * αντίθεση με τα τρία από πάνω. Ο λόγος είναι ότι η διαφορά **μετράει**: το `kind`
 * είναι η ίδια η ερώτηση *«ξέρουμε ή όχι;»*, και ένα ρηχό `passthrough()` θα άφηνε ένα
 * `{ kind: 'knwon' }` να περάσει ως γνωστή ημερομηνία **χωρίς** ημερομηνία.
 *
 * 🔑 **ΤΟ `.catch` ΕΙΝΑΙ Ο ΚΡΙΚΟΣ.** Κάθε έγγραφο γραμμένο πριν από σήμερα **δεν έχει**
 * το κλειδί, και η αλήθεια γι' αυτά είναι ακριβώς `'predates-record'`: ήταν ήδη στην
 * αγορά πριν αρχίσουμε να καταγράφουμε. ⛔ **Και ρητά ΔΕΝ μαντεύει από το
 * `projectedAt`** — ίδιο επιχείρημα με τον κρίκο 8 που αρνείται να μαντέψει κατόψεις
 * από το `gallery`: το `projectedAt` είναι ώρα **ανακατασκευής**, και μια
 * `rebuildAllPublicListings` το ισοπεδώνει σε ένα δευτερόλεπτο για όλα. Θα ήταν
 * **ψέμα που μοιάζει με πληροφορία**.
 *
 * 🔑 **Ιδιοδύναμο (Κ3)**: έγκυρη τιμή περνά **αυτούσια** — δεύτερη διέλευση δίνει το
 * ίδιο έγγραφο. Αυτό είναι που κάνει τη σφραγίδα **αμετάβλητη ακόμη και απέναντι στην
 * ίδια την αναβάθμιση**.
 */
const listedAtShape = z.union([
  z.object({ kind: z.literal('known'), at: z.string().trim().min(1) }),
  z.object({
    kind: z.literal('unknown'),
    reason: z.enum(['predates-record', 'not-recorded']),
  }),
]);

export const listedAtValue = listedAtShape.catch({ kind: 'unknown', reason: 'predates-record' });

/**
 * **Φέρει ήδη σφραγίδα αυτή η τιμή;** — `null` όταν **όχι**.
 *
 * 🔴 **ΙΔΙΟ ΣΧΗΜΑ, ΑΛΛΗ ΕΡΩΤΗΣΗ — και γι' αυτό ΔΕΝ είναι δεύτερος κριτής.** Ο κρίκος
 * ρωτά *«κάνε αυτό το αποθηκευμένο έγγραφο έγκυρο»* και πέφτει σε `'predates-record'`.
 * Η **σφραγίδα** ρωτά *«υπάρχει ήδη σφραγίδα εδώ;»*, και για εκείνη η **απουσία είναι
 * η απάντηση**: σημαίνει *«αυτή είναι η πρώτη δημοσίευση»*.
 *
 * ⚠️ Αν οι δύο μοιράζονταν το `.catch`, η σφραγίδα **δεν θα σφράγιζε ποτέ**: κάθε
 * ασφράγιστο ακίνητο θα «είχε ήδη» τιμή. Το κοινό είναι το **σχήμα**
 * ({@link listedAtShape}), όχι η προεπιλογή — που είναι ακριβώς η γραμμή όπου οι δύο
 * ερωτήσεις διαφέρουν.
 */
export function readListedAt(value: unknown): ListedAt | null {
  const parsed = listedAtShape.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Το `stay` λείπει ⇒ `null`, που σημαίνει **«δεν είναι κατάλυμα»** (ADR-835 §4.5). */
export const stayOrNull = z.object({}).passthrough().nullable().catch(null);

/** Ωμός αριθμός ή `null` — ποτέ `0` ως «άγνωστο» (κανόνας του σχήματος). */
export const numberOrNull = z.number().finite().nullable().catch(null);

/**
 * Το κουτί της αντιπαροχής ενός αποθηκευμένου εγγράφου (κρίκος 12) — το **`offerKinds`** αποφασίζει
 * αν υπάρχει, όπως και στην προβολή (`projectExchange`).
 */
export function storedExchangeOf(doc: StoredListingDocument): { landownerShare: number | null } | null {
  const kinds = Array.isArray(doc.offerKinds) ? doc.offerKinds : [];
  if (!kinds.includes('exchange')) return null;
  const box = typeof doc.exchange === 'object' && doc.exchange !== null
    ? (doc.exchange as Readonly<Record<string, unknown>>)
    : {};
  return { landownerShare: numberOrNull.parse(box.landownerShare ?? null) };
}

/**
 * Το κουτί διαμονής με την **πολιτική κατοικιδίων** (κρίκος 13). Χωρίς κουτί ⇒ `null`
 * («δεν είναι κατάλυμα»), όπως πριν· με κουτί, η πολιτική περνά από τον **ΕΝΑ** αναγνώστη.
 */
export function storedStayWithPets(doc: StoredListingDocument): Readonly<Record<string, unknown>> | null {
  const stay = stayOrNull.parse(doc.stay ?? null);
  if (stay === null) return null;
  return { ...stay, pets: readStayPetPolicy(stay.pets) };
}

/**
 * Συμβολοσειρά ή `null` — και **το κενό είναι `null`**, όχι `''`.
 *
 * 🔑 Η ταυτότητα είναι ή **γνωστή** ή **απούσα**· μια κενή συμβολοσειρά θα ήταν
 * **τρίτη κατάσταση** που κανείς καταναλωτής δεν ελέγχει — και το `agency_profiles/{''}`
 * δεν είναι έγκυρη διαδρομή εγγράφου.
 */
export const identityOrNull = z
  .string()
  .trim()
  .min(1)
  .nullable()
  .catch(null);

/**
 * **Τα βαθμωτά πεδία που άνοιξε η Φ3** (ADR-842). Δηλώνονται **μία** φορά και
 * τροφοδοτούν **και** το `adds` **και** το `apply` του κρίκου 5.
 *
 * 🔑 **Μία λίστα, δύο χρήσεις — επίτηδες.** Το `adds` είναι *«δηλωμένη πρόθεση, ΟΧΙ
 * αυθεντία»* και μια άγκυρα **εκτελεί** το `apply` για να επιβεβαιώσει ότι τα δύο
 * συμφωνούν. Με είκοσι τρία ονόματα, δύο χειρόγραφες λίστες θα απέκλιναν — και θα
 * απέκλιναν **σιωπηλά**, γιατί η άγκυρα θα έβλεπε ό,τι της λέει η πρώτη.
 */
export const PHASE3_SCALAR_KEYS = [
  'energyClass',
  'condition',
  'renovationYear',
  'bathrooms',
  'wc',
  'totalRooms',
  'levels',
  'balconies',
  'netAreaSqm',
  'balconyAreaSqm',
  'terraceAreaSqm',
  'gardenAreaSqm',
  'heatingType',
  'heatingFuel',
  'coolingType',
  'waterHeating',
  'windowFrames',
  'glazing',
] as const;

/** Τα **σύνολα** της Φ3 — προεπιλογή `null`, **ποτέ** `[]`. Δες τον κρίκο 5. */
export const PHASE3_SET_KEYS = [
  'flooring',
  'orientations',
  'interiorFeatures',
  'securityFeatures',
  'amenities',
] as const;

/**
 * Σύνολο ή `null` — **και το `null` είναι η προεπιλογή**, σε αντίθεση με τα
 * {@link legalityArray}/{@link galleryArray} που πέφτουν σε `[]`.
 *
 * ⚠️ **Η διαφορά ΔΕΝ είναι ασυνέπεια**: εκεί το κενό σημαίνει *«δεν τέθηκε το ερώτημα
 * και η οθόνη το ξέρει»* για πεδίο που **πάντα** υπάρχει· εδώ το `[]` είναι
 * **απάντηση ανθρώπου** («καμία παροχή») και το `null` είναι η απουσία της.
 */
export const vocabularySetOrNull = z.array(z.unknown()).nullable().catch(null);

/**
 * **Ο αριθμός επιπέδων ενός εγγράφου έκδοσης 5** — ωμός αριθμός, χωρίς προέλευση.
 * Δες τον κρίκο **6**.
 */
export const legacyLevelsNumber = z.number().finite().nullable().catch(null);

/**
 * Η **στιγμή προβολής** του εγγράφου — η μόνη ημερομηνία που κουβαλά ήδη κάθε
 * αποθηκευμένη αγγελία. Δες τον κρίκο **6** για το γιατί είναι η σωστή απάντηση στο
 * *«πότε το ξέραμε;»* μιας μετανάστευσης.
 */
export const projectedAtOrNull = z.string().trim().min(1).nullable().catch(null);

/**
 * **Γεγονός με προέλευση που υπάρχει ΗΔΗ** — ρηχός έλεγχος, ίδιο ιδίωμα με τα
 * {@link legalityArray}/{@link galleryArray}: κρίνεται ότι είναι *αντικείμενο με
 * `provenance`*, όχι ότι το σκέλος του είναι έγκυρο. Το βαθύ ερώτημα το απαντά ο
 * **γραφέας**, όπου ο μεταγλωττιστής μπορεί να το επιβάλει.
 *
 * 🔑 **Υπάρχει για την ΙΔΙΟΔΥΝΑΜΙΑ** (Κ3): δεύτερη διέλευση από τον κρίκο 6 δεν
 * επιτρέπεται να **καταστρέψει** ό,τι ο πρώτος έφτιαξε. Χωρίς αυτό, ένα ήδη
 * σχηματισμένο `levels` θα αποτύγχανε στον έλεγχο «είναι αριθμός;» και θα γινόταν
 * `null` — δηλαδή η αναβάθμιση θα **έτρωγε** το γεγονός που η ίδια παρήγαγε.
 */
export const alreadySourced = z.object({ provenance: z.string().min(1) }).passthrough().nullable();
