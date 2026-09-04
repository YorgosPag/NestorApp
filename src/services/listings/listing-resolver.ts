import 'server-only';

/**
 * @fileoverview **Ο ΕΝΑΣ ΕΠΙΛΥΤΗΣ ΑΓΓΕΛΙΑΣ** — *«δώσε μου αυτή την ταυτότητα, όποιας
 * οικογένειας κι αν είναι»*.
 * @related ADR-843 §10.16 · lib/listings/listing-families.ts · lib/owner-property/listing-custody.ts
 * @module services/listings/listing-resolver
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΘΕΡΑΠΕΥΕΙ — ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ «ΔΕΥΤΕΡΟΣ ΚΡΙΤΗΣ»
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κριτής της πρώτης επαφής ρωτούσε **μόνο** το `owner_properties` (§10.15). Η
 * θεραπεία **δεν** είναι «πρόσθεσε κι ένα `if` για το `properties`»: αυτό θα ήταν
 * **δεύτερο** σημείο που ξέρει τι είναι οικογένεια, και το επόμενο ερώτημα
 * *(«ποιες είναι δικές μου;»)* θα το ξανάγραφε τρίτη φορά.
 *
 * 🔑 **Εδώ ζει ΜΙΑ ερώτηση με ΤΡΕΙΣ απαντήσεις**, και οι τρεις υπήρχαν ήδη:
 *
 * | Ερώτηση | ΟΙΚΟΓΕΝΕΙΑ Α *(γραφείο)* | ΟΙΚΟΓΕΝΕΙΑ Β *(ιδιώτης)* |
 * |---|---|---|
 * | «σε ποιον **χώρο** ζει;» | `custodyOf` ← `companyId` | `custodyOf` ← `authorCompanyId` |
 * | «τι **ξέρουμε για τον τόπο**;» | `collectPlaceKnowledge` *(ανεβαίνει την Α1)* | `placeKnowledgeFromOwnerProperty` *(η δήλωσή του)* |
 * | «είναι **στην αγορά**;» | `buildPublicListing` | `buildPublicListing` |
 *
 * ⛔ **ΚΑΜΙΑ ΓΡΑΜΜΗ ΚΡΙΣΗΣ ΔΕΝ ΓΡΑΦΤΗΚΕ ΕΔΩ.** Το αρχείο είναι **δρομολογητής**: δεν
 * αποφασίζει «είναι δημόσιο;» *(το λέει το `isPubliclyListed`, **μία** φορά, μέσα στο
 * `buildPublicListing`)*, δεν αποφασίζει «είναι δικό σου;» *(το λέει το
 * `mayAdminister`, CHECK 3.56)*. Αν βρεθείς να γράφεις εδώ `lifecycle !== …` ή
 * `companyId === …`, η απάντηση **υπάρχει ήδη** αλλού.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΕΙΣ ΑΠΑΝΤΗΣΕΙΣ, ΠΟΤΕ ΔΥΟ — ΤΟ ΤΡΙΠΤΥΧΟ ΠΟΥ ΚΛΗΡΟΝΟΜΕΙΤΑΙ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * `null` = **βλάβη** *(δεν μάθαμε)* · `'absent'` = **δεν υπάρχει** · αλλιώς η αγγελία.
 * Είναι το ίδιο τρίπτυχο που ο φρουρός τηρούσε ήδη για το `owner_properties` — και ο
 * λόγος του είναι μετρημένος (N.12): ένα `null` που σκεπάζει και τα δύο λέει στον
 * άνθρωπο *«δεν υπάρχει»* κάθε φορά που πέφτει η Firestore.
 *
 * ⚠️ **Και το `'absent'` καλύπτει ΚΑΙ την άγνωστη οικογένεια**, επίτηδες: ταυτότητα
 * χωρίς αναγνωρίσιμο πρόθεμα **δεν είναι αγγελία**, και το να απαντούσε «βλάβη» θα
 * έστελνε τον άνθρωπο να ξαναπροσπαθήσει για κάτι που δεν πρόκειται ποτέ να υπάρξει.
 *
 * **Layering**: server — Admin SDK ως **όρισμα**, ποτέ singleton· καμία ανάγνωση ρολογιού.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import type { ListingMatchFacts } from '@/lib/demand/demand-match-vocabulary';
import {
  familyOfListingId,
  LISTING_FAMILY,
  type ListingFamily,
} from '@/lib/listings/listing-families';
import { custodyOf, type ListingCustody } from '@/lib/owner-property/listing-custody';
import {
  placeKnowledgeFromOwnerProperty,
  projectableFromOwnerProperty,
} from '@/lib/owner-property/owner-property-projection';
import { createModuleLogger } from '@/lib/telemetry';
import {
  buildPublicListing,
  type PlaceKnowledge,
  type ProjectableProperty,
} from '@/services/listings/public-listing-projection';
import {
  collectPlaceKnowledge,
  type ListingSourceProperty,
} from '@/services/listings/publish-public-listing';
import type { OwnerProperty } from '@/types/owner-property';

const logger = createModuleLogger('listing-resolver');

// =============================================================================
// 1. ΤΟ ΣΥΜΒΟΛΑΙΟ
// =============================================================================

/**
 * **Η αγγελία, λυμένη** — ό,τι χρειάζεται ο κριτής, και **τίποτε άλλο**.
 *
 * ⚠️ **Το `facts: null` ΔΕΝ σημαίνει «δεν υπάρχει»** — σημαίνει *«υπάρχει, αλλά δεν
 * έχει καμία ζωντανή διάθεση στην αγορά»*. Οι δύο καταστάσεις οδηγούν σε **άλλη**
 * άρνηση (`target-absent` ⇄ `target-not-live`), και ο άνθρωπος αξίζει τη σωστή.
 */
export interface ResolvedListing {
  readonly family: ListingFamily;
  /** **Ποιος τη διαχειρίζεται** — ο παραλήπτης κάθε πράξης προς αυτήν. */
  readonly custody: ListingCustody;
  /** Τα γεγονότα που κρίνει το «γιατί ταιριάζει», ή `null` αν δεν είναι στην αγορά. */
  readonly facts: ListingMatchFacts | null;
}

/** Δες το τρίπτυχο στην κεφαλίδα: **βλάβη ≠ απουσία**. */
export type ListingResolution = ResolvedListing | 'absent' | null;

/**
 * Το έγγραφο `properties/{id}` **όσο το χρειάζεται ο επιλυτής**.
 *
 * 🔑 **Ο γραφέας δηλώνει ήδη τα τρία πεδία ιεραρχίας** ({@link ListingSourceProperty}:
 * `buildingId` · `projectId` · `companyId`) — δεν ξαναγράφονται. Λείπει **ένα**, γιατί
 * ο γραφέας δεν το χρειάζεται ποτέ: το `createdBy`, *«η υπογραφή στην καρτέλα»*
 * (ADR-777 §8.23), που είναι το **δεύτερο** πεδίο του `custodyOf`.
 *
 * ⚠️ **Και περνιέται ΑΛΗΘΙΝΟ, όχι ως `''`.** Σήμερα το `custodyOf` το **αγνοεί** όταν
 * υπάρχει εταιρεία, άρα ένα κενό «θα δούλευε» — και θα ήταν ακριβώς ο **αδρανής
 * φρουρός** του ADR-749: την ημέρα που η οικογένεια Α αποκτήσει προσωπική
 * θεματοφυλακή, ο κριτής θα απαντούσε με **φάντασμα** αντί με άνθρωπο.
 */
type AgencyListingDocument = ListingSourceProperty & {
  readonly createdBy?: string | null;
};

/**
 * Ό,τι ξέρει μια οικογένεια για τον εαυτό της, **εκτελέσιμο**.
 *
 * 🔑 Ο τύπος επιστροφής είναι ο **ίδιος** και για τις δύο — αυτό είναι ολόκληρο το
 * νόημα: ο καλών **δεν μαθαίνει ποτέ** σε ποια οικογένεια μίλησε.
 */
type ListingFamilyReader = (
  adminDb: AdminFirestore,
  listingId: string,
  raw: Record<string, unknown>,
  nowISO: string,
) => Promise<ResolvedListing | null>;

// =============================================================================
// 2. Η ΔΗΜΟΣΙΑ ΠΟΡΤΑ
// =============================================================================

/**
 * **Λύσε αυτή την ταυτότητα αγγελίας** — μία ανάγνωση, καμία γνώση οικογένειας στον καλούντα.
 *
 * 🏆 **Το πρόθεμα δρομολογεί ΠΡΙΝ τη βάση** (πρότυπο Stripe, δες `listing-families.ts`):
 * ταυτότητα που δεν ανήκει σε καμία οικογένεια απορρίπτεται **χωρίς κόστος**.
 */
export async function resolveListing(
  adminDb: AdminFirestore,
  listingId: string,
  nowISO: string,
): Promise<ListingResolution> {
  const family = familyOfListingId(listingId);
  if (family === null) return 'absent';

  try {
    const snapshot = await adminDb
      .collection(LISTING_FAMILY[family].collection)
      .doc(listingId)
      .get();

    if (!snapshot.exists) return 'absent';

    return await LISTING_FAMILY_READERS[family](
      adminDb,
      listingId,
      snapshot.data() as Record<string, unknown>,
      nowISO,
    );
  } catch (error) {
    logger.error('[LISTING-RESOLVER] Η ανάγνωση της αγγελίας απέτυχε — άγνωστο, όχι κενό', {
      listingId,
      family,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// =============================================================================
// 3. ΟΙ ΑΝΑΓΝΩΣΤΕΣ — ένας ανά οικογένεια, κανένας παραπάνω
// =============================================================================

/**
 * 🔴 **ΕΔΩ ΕΙΝΑΙ Ο ΦΡΟΥΡΟΣ ΤΗΣ ΤΡΙΤΗΣ ΟΙΚΟΓΕΝΕΙΑΣ.**
 *
 * `Record<ListingFamily, …>`: μια νέα τιμή στο `LISTING_FAMILIES` κάνει αυτό τον
 * πίνακα **ελλιπή**, και ο μεταγλωττιστής σταματά. Δηλαδή το *«ξέχασαν να ρωτήσουν
 * τη δεύτερη»* του §10.15 γίνεται **σφάλμα μεταγλώττισης**, όχι σιωπηλή άρνηση.
 */
const LISTING_FAMILY_READERS: Record<ListingFamily, ListingFamilyReader> = {
  agency: readAgencyListing,
  owner: readOwnerListing,
};

/**
 * **Ο ΕΠΑΓΓΕΛΜΑΤΙΑΣ** — `properties/{prop_*}`, ο τόπος **ανεβαίνοντας την αλυσίδα Α1**.
 *
 * ⚠️ **Ούτε ταυτότητα γραφείου ούτε φωτογραφίες λύνονται εδώ**, και είναι σκόπιμο: ο
 * κριτής ρωτά *«είναι στην αγορά, και γιατί ταιριάζει;»* — και **καμία** από τις δύο
 * απαντήσεις δεν διαβάζει ούτε το `agency` ούτε το `publishedMedia`. Δύο επιπλέον
 * αναγνώσεις ανά πάτημα κουμπιού, για πεδία που κανείς δεν κοιτά, θα ήταν κόστος
 * χωρίς αγοραστή. *(Ο **γραφέας** της προβολής τα λύνει — εκεί τα βλέπει ο κόσμος.)*
 */
async function readAgencyListing(
  adminDb: AdminFirestore,
  listingId: string,
  raw: Record<string, unknown>,
  nowISO: string,
): Promise<ResolvedListing | null> {
  const property = raw as AgencyListingDocument;

  const custody = agencyCustodyOf(listingId, property);
  if (custody === null) return null;

  const place = await collectPlaceKnowledge(adminDb, property, nowISO);
  return {
    family: 'agency',
    custody,
    facts: factsOf({ ...property, id: listingId }, place, nowISO),
  };
}

/** **Ο ΙΔΙΩΤΗΣ** — `owner_properties/{ownp_*}`· ο τόπος του **είναι η δήλωσή του**. */
async function readOwnerListing(
  _adminDb: AdminFirestore,
  listingId: string,
  raw: Record<string, unknown>,
  nowISO: string,
): Promise<ResolvedListing | null> {
  const property = { ...(raw as OwnerProperty), id: listingId };
  const place = placeKnowledgeFromOwnerProperty(property, nowISO);

  return {
    family: 'owner',
    custody: custodyOf(property),
    facts: factsOf(projectableFromOwnerProperty(property, nowISO), place, nowISO),
  };
}

// =============================================================================
// 4. ΟΙ ΔΥΟ ΜΕΤΑΦΡΑΣΕΙΣ — και **μόνο** μεταφράσεις
// =============================================================================

/**
 * **Η θεματοφυλακή μιας αγγελίας γραφείου.**
 *
 * 🔑 **Ο κριτής δεν ξαναγράφεται — μεταφράζονται τα ΟΝΟΜΑΤΑ των πεδίων.** Το
 * `custodyOf` δέχεται **δομικό** τύπο (`authorUserId` + `authorCompanyId`), και η
 * οικογένεια Α λέει το ίδιο πράγμα με άλλα ονόματα: `companyId` *(ποιανού είναι)* +
 * `createdBy` *(ποιος το πληκτρολόγησε)*. Ένα δεύτερο `mayAdminister` εδώ θα ήταν η
 * **τέταρτη** αυθεντία εξουσιοδότησης του έργου (CHECK 3.56).
 *
 * 🔴 **`null` ΟΤΑΝ ΛΕΙΠΕΙ ΕΤΑΙΡΕΙΑ — ΚΑΙ ΕΙΝΑΙ ΒΛΑΒΗ, ΟΧΙ ΑΠΟΥΣΙΑ.** Το `companyId`
 * είναι το **πεδίο απομόνωσης** του `properties`: το γράφει το `createEntity` από το
 * auth context και οι κανόνες Firestore το κρατούν αμετάβλητο. Έγγραφο **χωρίς**
 * αυτό δεν είναι «αγγελία κανενός» — είναι έγγραφο για το οποίο **δεν μπορούμε να
 * πούμε σε ποιον θα έφτανε το μήνυμα**. Το να πέσουμε σε προσωπική θεματοφυλακή μέσω
 * `createdBy` θα ήταν **εικασία που δρομολογεί προσωπικά δεδομένα**.
 *
 * ⚠️ Και δεν είναι αδρανής φρουρός *(ADR-749, «606 αδρανείς»)*: ο τύπος δηλώνει το
 * `companyId` **προαιρετικό**, άρα η περίπτωση είναι υπαρκτή στο σχήμα.
 */
function agencyCustodyOf(
  listingId: string,
  property: AgencyListingDocument,
): ListingCustody | null {
  const companyId = property.companyId ?? null;

  if (companyId === null || companyId.length === 0) {
    logger.error('[LISTING-RESOLVER] Αγγελία γραφείου χωρίς εταιρεία — δεν ξέρουμε παραλήπτη', {
      listingId,
    });
    return null;
  }

  return custodyOf({ authorUserId: property.createdBy ?? '', authorCompanyId: companyId });
}

/**
 * **Τα γεγονότα του «γιατί ταιριάζει», ή `null` αν δεν είναι στην αγορά.**
 *
 * 🔑 **Ο ΕΝΑΣ κριτής δημοσίευσης, για **αμφότερες** τις οικογένειες**: το
 * `buildPublicListing` επιστρέφει `null` για ό,τι δεν έχει ζωντανή διάθεση
 * *(απόσυρση · πουλημένο · ληγμένη ή εκκρεμής εντολή)*. Ένα δικό μας κριτήριο εδώ θα
 * ήταν **δεύτερο**, και το `public-listing-projection.ts` προειδοποιεί ρητά ότι τα
 * δύο θα διαφωνούσαν **ακριβώς στην αντιπαροχή**.
 *
 * 🔶 **Τα δύο δηλωμένα κενά ταξιδεύουν ΑΝΟΙΧΤΑ** (`availability` · `proximityMetres`):
 * δεν αντλούνται σήμερα και **δεν** γεμίζονται με εικασία — ένα εμπόδιο **άγνοιας**
 * είναι δικό μας χρέος, όχι αστοχία της αγγελίας.
 */
function factsOf(
  property: ProjectableProperty,
  place: PlaceKnowledge,
  nowISO: string,
): ListingMatchFacts | null {
  const listing = buildPublicListing(property, place, nowISO);
  if (listing === null) return null;

  return { listing, place: place.ref, availability: null, proximityMetres: {} };
}
