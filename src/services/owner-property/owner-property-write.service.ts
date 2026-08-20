/**
 * @fileoverview **Η ΠΥΛΗ ΓΡΑΦΗΣ ΤΗΣ ΠΡΟΣΦΟΡΑΣ** — η μόνη διαδρομή προς το `owner_properties`.
 * @related ADR-777 §7 (Α14 · Α20 · Α22) · §8.16 · CLAUDE.md N.6
 * @module services/owner-property/owner-property-write.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΙΑΚΟΜΙΣΤΗΣ, ΕΝΩ Η ΖΗΤΗΣΗ ΓΡΑΦΕΤΑΙ ΑΠΟ ΤΟΝ ΠΕΛΑΤΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η **Α9** γράφει με `setDoc` από τον πελάτη, και είναι σωστό: η ζήτηση **δεν έχει
 * δημόσια προβολή** — ό,τι φεύγει προς τρίτους είναι το **επίπεδο Γ**, που
 * παράγεται αλλού.
 *
 * Η **προσφορά έχει**. Και το `public_listings` δηλώνει `allow write: if false` για
 * **κάθε** πελάτη, με γραμμένο τον λόγο: *«ένα κακόβουλο έγγραφο θα το έβλεπαν
 * **ΟΛΟΙ**, και ο πελάτης δεν πρέπει ποτέ να αποφασίζει τι είναι δημόσιο για
 * λογαριασμό μας»*.
 *
 * 🔑 **Άρα η επιλογή δεν ήταν “πού είναι βολικό” αλλά “πού μπορεί να υπάρξει
 * εγγύηση”.** Αν ο πελάτης έγραφε το `owner_properties` και **μετά** καλούσε τον
 * διακομιστή για τη δημοσίευση, θα υπήρχε **παράθυρο** όπου το έγγραφο υπάρχει και η
 * προβολή όχι — και ο μόνος τρόπος να κλείσει θα ήταν να το θυμάται ο πελάτης. Με
 * **μία** πράξη διακομιστή, το *«κάθε καταχώρηση έχει συνεπή προβολή»* παύει να είναι
 * ελπίδα και γίνεται **ιδιότητα της διαδρομής γραφής**.
 *
 * ⚠️ Γι' αυτό ο κανόνας Firestore του `owner_properties` δίνει στον πελάτη
 * **ανάγνωση των δικών του** και **καμία** εγγραφή — ίδιο σχήμα με το `properties`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΙΑ ΠΡΑΓΜΑΤΑ ΠΟΥ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΚΑΝΕΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * 1. **`addDoc` / αυτόματη ταυτότητα — ΠΟΤΕ** (N.6, και το μπλοκάρει το pre-commit).
 *    Η ταυτότητα έρχεται από το `enterpriseIdService.generateOwnerPropertyId()`.
 * 2. **Διαγραφή — ΠΟΤΕ.** Η απόσυρση είναι `lifecycle: 'withdrawn'`, και η **δημόσια
 *    προβολή** σβήνεται ως **συνέπεια** (`projectableFromOwnerProperty` → καμία
 *    διάθεση → `buildPublicListing` → `null` → `delete`). Το ιστορικό του κατόχου
 *    μένει δικό του.
 * 3. **Αλλαγή `authorUserId` — ΠΟΤΕ.** Δεν υπάρχει διαδρομή που να το δέχεται: το
 *    {@link OwnerPropertyDraft} **δεν το περιέχει**, οπότε η αποτυχία είναι στη
 *    μεταγλώττιση και όχι στο δίκτυο.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import {
  placeKnowledgeFromOwnerProperty,
  projectableFromOwnerProperty,
} from '@/lib/owner-property/owner-property-projection';
import {
  writeListingProjection,
  type PublishOutcome,
} from '@/services/listings/publish-public-listing';
import {
  newOwnerProperty,
  type OwnerProperty,
  type OwnerPropertyAuthorship,
  type OwnerPropertyDraft,
  type OwnerPropertyLifecycle,
} from '@/types/owner-property';
import {
  ownerPropertyInvariantViolations,
  type OwnerPropertyInvariant,
} from '@/types/owner-property-invariants';
import {
  mandateInvariantViolations,
  type MandateInvariant,
} from '@/types/owner-property-mandate';

const logger = createModuleLogger('owner-property-write.service');

// =============================================================================
// 1. ΤΟ ΑΠΟΤΕΛΕΣΜΑ — ρητές καταστάσεις, ποτέ εξαίρεση ως ροή ελέγχου
// =============================================================================

/**
 * Τι έγινε.
 *
 * 🔑 **Τέσσερις καταστάσεις, και καμία δεν συμπτύσσεται.** Το `invalid` σημαίνει *«η
 * αγγελία σου λέει κάτι αντιφατικό»* — ο άνθρωπος μπορεί να το διορθώσει, και ξέρουμε
 * **ακριβώς ποιο** πεδίο (οι κωδικοί γίνονται κλειδιά i18n, N.11). Το `absent`
 * σημαίνει *«δεν υπάρχει **για σένα**»*. Το `failed` σημαίνει *«δεν φτάσαμε»* — δεν
 * έχει τι να διορθώσει. Ένα κοινό «κάτι πήγε στραβά» θα τον έστελνε να αλλάξει
 * κείμενο που ήταν ήδη σωστό.
 *
 * ⚠️ **Το `publish` ταξιδεύει ΜΑΖΙ με το `saved`, και δεν είναι διακοσμητικό.** Ο
 * γραφέας της προβολής **δεν πετά ποτέ** (*«η αποτυχία της δημόσιας προβολής δεν
 * επιτρέπεται να ακυρώσει την αποθήκευση του κατόχου»*), οπότε χωρίς αυτό το πεδίο
 * το «αποθηκεύτηκε» θα σήμαινε ταυτόχρονα *«είναι στον χάρτη»* και *«είναι στη βάση
 * αλλά όχι στον χάρτη»* — **δύο πολύ διαφορετικά πράγματα για τον ιδιοκτήτη**, και το
 * §8.16 δεσμεύτηκε ότι του τα λέμε.
 */
export type OwnerPropertyWriteResult =
  | { readonly kind: 'saved'; readonly property: OwnerProperty; readonly publish: PublishOutcome }
  | { readonly kind: 'invalid'; readonly violations: readonly OwnerPropertyInvariant[] }
  /**
   * 🔑 **Η ΕΝΤΟΛΗ ΑΠΟΡΡΙΠΤΕΤΑΙ ΞΕΧΩΡΙΣΤΑ ΑΠΟ ΤΟ ΑΚΙΝΗΤΟ (§8.33)**, και δεν είναι
   * λεπτολογία: το `invalid` λέει *«η **αγγελία** σου λέει κάτι αντιφατικό»* — λάθος
   * σε πεδίο που ο άνθρωπος βλέπει στη φόρμα του ακινήτου. Αυτό λέει *«η **εντολή**
   * σου δεν στέκει»* — άλλο μέρος της οθόνης, άλλα πεδία, άλλη διόρθωση. Ένας κοινός
   * κάδος θα έστελνε τον μεσίτη να ψάχνει το εμβαδόν επειδή έβαλε λήξη στο χθες.
   */
  | { readonly kind: 'invalid-mandate'; readonly violations: readonly MandateInvariant[] }
  | { readonly kind: 'absent' }
  | { readonly kind: 'failed'; readonly message: string };

// =============================================================================
// 2. Η ΔΗΜΟΣΙΕΥΣΗ — μία γραμμή, μοιρασμένη από τις τρεις πράξεις
// =============================================================================

/**
 * Ξαναγράφει (ή σβήνει) τη δημόσια προβολή **αυτής** της καταχώρησης.
 *
 * 🔑 **Καμία νέα μηχανή**: καλείται το **υπάρχον** {@link writeListingProjection},
 * που είναι ο ίδιος πυρήνας που εξυπηρετεί και τον επαγγελματία. Η **μόνη** διαφορά
 * είναι από πού έρχεται ο τόπος — και αυτό είναι ακριβώς η παράμετρος που ο πυρήνας
 * δέχεται.
 *
 * ⚠️ **Μία ανάγνωση ρολογιού**, περασμένη σε **τρία** σημεία: το `projectedAt` της
 * αγγελίας, το `locatedAt` της θέσης, και —από το §8.33— η κρίση **λήξης της
 * εντολής**. Οφείλουν να είναι **η ίδια** στιγμή· ένα δεύτερο `nowISO()` μέσα στον
 * κριτή θα έκανε το ίδιο πέρασμα να διαφωνεί με τον εαυτό του σε μια εντολή που λήγει
 * ακριβώς τώρα.
 */
async function republishOwnerListing(
  adminDb: AdminFirestore,
  property: OwnerProperty,
): Promise<PublishOutcome> {
  const at = nowISO();
  return writeListingProjection(
    adminDb,
    property.id,
    projectableFromOwnerProperty(property, at),
    placeKnowledgeFromOwnerProperty(property, at),
    at,
  );
}

/**
 * Αποθηκεύει το έγγραφο **και** ξαναγράφει την προβολή του. Η **μία** διατύπωση.
 *
 * ⚠️ **Η σειρά είναι συμβόλαιο: πρώτα η αλήθεια, μετά το παράγωγο.** Αν η προβολή
 * γραφόταν πρώτη και το έγγραφο αποτύγχανε, ο κόσμος θα έβλεπε αγγελία που **δεν
 * υπάρχει** — και κανείς δεν θα μπορούσε να τη διορθώσει, γιατί δεν θα υπήρχε
 * υποκείμενο να ξαναδιαβαστεί. Το ανάποδο («υπάρχει, δεν φαίνεται») είναι **γνωστά
 * εκκρεμές** και το διορθώνει η επανασύνθεση.
 */
async function persist(
  adminDb: AdminFirestore,
  property: OwnerProperty,
  mode: 'create' | 'overwrite',
): Promise<OwnerPropertyWriteResult> {
  const ref = adminDb.collection(COLLECTIONS.OWNER_PROPERTIES).doc(property.id);

  try {
    // 🔴 **`create()` στη γέννηση, `set()` στην ενημέρωση — ΠΟΤΕ `add`** (N.6).
    //
    // Η ταυτότητα έρχεται από τον **πελάτη** (χρειάζεται πριν το ανέβασμα των
    // αρχείων· δες `owner-property-draft-schema.ts`), άρα ένα `set()` στη δημιουργία
    // θα σήμαινε ότι ο πελάτης μπορεί να **γράψει πάνω σε υπάρχον** έγγραφο απλώς
    // στέλνοντας την ταυτότητά του. Το `create()` **πετά** αν υπάρχει — και η
    // απόρριψη είναι του Firestore, όχι ελέγχου που κάποιος πρέπει να θυμηθεί.
    //
    // ⚠️ Στην **ενημέρωση** ισχύει το αντίθετο: `set` ολόκληρου, ποτέ `update`. Μια
    // μερική ενημέρωση που άφηνε παλιό πεδίο ζωντανό θα έδινε έγγραφο **μείγμα δύο
    // καταστάσεων** — ίδιο σκεπτικό με τον γραφέα της προβολής. Και ο πλήρης όρος
    // συντίθεται από **γνωστά** μέρη: προσχέδιο + τα αμετάβλητα του υπάρχοντος.
    if (mode === 'create') {
      await ref.create(property);
    } else {
      await ref.set(property);
    }
  } catch (error) {
    return failure('Η αγγελία δεν αποθηκεύτηκε', property.id, error);
  }

  const publish = await republishOwnerListing(adminDb, property);
  return { kind: 'saved', property, publish };
}

// =============================================================================
// 3. ΔΗΜΙΟΥΡΓΙΑ
// =============================================================================

/**
 * **Νέα αγγελία ιδιοκτήτη.**
 *
 * 🔴 **Η εγκυρότητα κρίνεται ΕΔΩ, από την ΙΔΙΑ συνάρτηση που κρίνει η φόρμα**
 * ({@link ownerPropertyInvariantViolations}). Δεν είναι διπλός έλεγχος: είναι **ο
 * ίδιος** έλεγχος σε δύο σημεία, που είναι το ακριβώς αντίθετο από δύο ελέγχους. Η
 * φόρμα τον τρέχει για να **δείξει**· η πύλη γιατί **δεν εμπιστεύεται καμία φόρμα** —
 * και οι κανόνες Firestore δεν μπορούν να εκφράσουν «πώληση χωρίς τιμή».
 *
 * 🔑 **Καμία ουρά έγκρισης** (απόφαση Giorgio 2026-08-11): ό,τι περνά τα invariants
 * γεννιέται `lifecycle: 'listed'` και **δημοσιεύεται στην ίδια πράξη**. Το φράγμα
 * ποιότητας είναι **μηχανικό** — τιμή ανά διάθεση (Α22) + τα πεδία του §25.6 — και
 * όχι ανθρώπινο.
 */
export async function createOwnerProperty(
  adminDb: AdminFirestore,
  authorship: OwnerPropertyAuthorship,
  draft: OwnerPropertyDraft,
): Promise<OwnerPropertyWriteResult> {
  const violations = ownerPropertyInvariantViolations(draft);
  if (violations.length > 0) return { kind: 'invalid', violations };

  const mandateViolations = mandateInvariantViolations(authorship.mandate, nowISO());
  if (mandateViolations.length > 0) {
    return { kind: 'invalid-mandate', violations: mandateViolations };
  }

  return persist(adminDb, newOwnerProperty(draft, authorship), 'create');
}

// =============================================================================
// 4. ΕΠΕΞΕΡΓΑΣΙΑ ΚΑΙ ΚΥΚΛΟΣ ΖΩΗΣ
// =============================================================================

/**
 * Διαβάζει την καταχώρηση **και αποδεικνύει ότι είναι του αιτούντος**.
 *
 * 🔴 **«Δεν υπάρχει» και «δεν είναι δική σου» απαντώνται ΤΟ ΙΔΙΟ, επίτηδες.** Μια
 * ξεχωριστή άρνηση θα **επιβεβαίωνε** ότι η ταυτότητα υπάρχει — δηλαδή θα διέρρεε το
 * επίπεδο Β μέσω του κωδικού λάθους. Ίδιο συμβόλαιο με τη διαδρομή `demand/competition`
 * και με το `MyDemandLookup.absent` στον πελάτη.
 */
async function loadOwned(
  adminDb: AdminFirestore,
  ownerPropertyId: string,
  authorUserId: string,
): Promise<OwnerProperty | null> {
  const snapshot = await adminDb
    .collection(COLLECTIONS.OWNER_PROPERTIES)
    .doc(ownerPropertyId)
    .get();

  const property = snapshot.data() as OwnerProperty | undefined;
  if (property === undefined || property.authorUserId !== authorUserId) return null;
  return property;
}

/**
 * **Αλλαγή περιεχομένου** σε υπάρχουσα αγγελία.
 *
 * ⚠️ Δέχεται {@link OwnerPropertyDraft}, δηλαδή **μόνο** ό,τι συντάσσει ο άνθρωπος. Ο
 * κάτοχος, η ταυτότητα, ο κύκλος ζωής και ο χρόνος γέννησης **δεν είναι στον τύπο**,
 * άρα δεν μπορούν να σταλούν κατά λάθος — η ίδια άμυνα με τον κανόνα Firestore, αλλά
 * στη μεταγλώττιση.
 *
 * ⚠️ **`set` ολόκληρου, ποτέ `update`** — ίδιο σκεπτικό με τον γραφέα της προβολής:
 * μια μερική ενημέρωση που άφηνε παλιό πεδίο ζωντανό θα έδινε έγγραφο **μείγμα δύο
 * καταστάσεων**, και κανείς δεν θα μπορούσε να πει ποιων. Εδώ ο πλήρης όρος
 * συντίθεται από **γνωστά** μέρη: το προσχέδιο + τα αμετάβλητα του υπάρχοντος.
 */
export async function updateOwnerProperty(
  adminDb: AdminFirestore,
  ownerPropertyId: string,
  draft: OwnerPropertyDraft,
  authorUserId: string,
): Promise<OwnerPropertyWriteResult> {
  const violations = ownerPropertyInvariantViolations(draft);
  if (violations.length > 0) return { kind: 'invalid', violations };

  const existing = await loadOwned(adminDb, ownerPropertyId, authorUserId);
  if (existing === null) return { kind: 'absent' };

  return persist(adminDb, { ...existing, ...draft, updatedAt: nowISO() }, 'overwrite');
}

/**
 * **Απόσυρση / επαναφορά.**
 *
 * 🔑 **Η ίδια διαδρομή για τις δύο κατευθύνσεις**, γιατί είναι η **ίδια πράξη**:
 * αλλαγή κύκλου ζωής + επανασύνθεση προβολής. Δύο συναρτήσεις («απόσυρε» / «επανάφερε»)
 * θα ήταν δύο σώματα με ένα γράμμα διαφορά — και η δεύτερη θα ξεχνούσε την
 * επανασύνθεση την ημέρα που θα άλλαζε κάτι.
 *
 * ⚠️ **Τα invariants ΔΕΝ ξανακρίνονται εδώ, επίτηδες.** Η απόσυρση οφείλει να
 * λειτουργεί **ακόμη κι αν** η αγγελία έχει γίνει άκυρη στο μεταξύ (π.χ. μελλοντικός
 * κανόνας που δεν ίσχυε όταν γράφτηκε): μια πύλη που εμποδίζει τον άνθρωπο να
 * **αποσύρει** το ακίνητό του επειδή δεν του αρέσει η μορφή του, τον κλειδώνει έξω
 * από την **έξοδο**.
 */
export async function setOwnerPropertyLifecycle(
  adminDb: AdminFirestore,
  ownerPropertyId: string,
  lifecycle: OwnerPropertyLifecycle,
  authorUserId: string,
): Promise<OwnerPropertyWriteResult> {
  const existing = await loadOwned(adminDb, ownerPropertyId, authorUserId);
  if (existing === null) return { kind: 'absent' };

  return persist(adminDb, { ...existing, lifecycle, updatedAt: nowISO() }, 'overwrite');
}

// =============================================================================
// 5. ΑΣΤΟΧΙΑ — μία διατύπωση
// =============================================================================

function failure(
  what: string,
  ownerPropertyId: string,
  error: unknown,
): { readonly kind: 'failed'; readonly message: string } {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(what, { data: { ownerPropertyId }, error: message });
  return { kind: 'failed', message };
}
