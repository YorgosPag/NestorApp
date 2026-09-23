/**
 * @fileoverview **Η ΔΗΜΟΣΙΕΥΣΗ ΤΗΣ ΑΓΓΕΛΙΑΣ ΤΟΥ ΚΑΤΟΧΟΥ — μία γραμμή, δύο καλούντες.**
 * @related ADR-777 §8.33 · §8.16 · services/listings/publish-public-listing.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΕΙΝΑΙ ΔΙΚΟ ΤΟΥ ΑΡΧΕΙΟ (εξήχθη 2026-08-27)
 * ────────────────────────────────────────────────────────────────────────────
 * Η {@link republishOwnerProperty} έχει **δύο** καλούντες που **δεν επιτρέπεται να
 * αποκλίνουν** — η αποθήκευση (`owner-property-write.service.ts`) και η
 * **επανασύνθεση** (`/api/admin/rebuild-public-listings`). Το σχόλιό της το έλεγε
 * ήδη γραπτά· εδώ γίνεται **δομή**: η γραφή του εγγράφου και η δημοσίευση της
 * προβολής είναι **δύο ευθύνες**, και το CHECK 4 (532/500) έδειξε πού κόβονται.
 *
 * ⚠️ **ΤΟ ΣΥΜΒΟΛΑΙΟ ΤΗΣ ΣΕΙΡΑΣ ΜΕΝΕΙ ΣΤΟΝ ΚΑΛΟΥΝΤΑ**: *πρώτα η αλήθεια, μετά το
 * παράγωγο*. Αυτό το αρχείο γράφει **μόνο** το παράγωγο — δεν ξέρει, και δεν
 * επιτρέπεται να ξέρει, αν το έγγραφο αποθηκεύτηκε.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { createModuleLogger } from '@/lib/telemetry';
import { readPublicAgencyIdentity } from '@/services/company/company-public-name.reader';
import {
  placeKnowledgeFromOwnerProperty,
  projectableFromOwnerProperty,
} from '@/lib/owner-property/owner-property-projection';
import {
  reportProjectionFailure,
  writeListingProjection,
  type ListingProjectionResult,
  type PublishOutcome,
} from '@/services/listings/publish-public-listing';
import { thumbnailFromLead } from '@/lib/owner-property/owner-listing-thumbnail';
import type { PublicAgencyIdentity } from '@/types/public-listing';
import { readDossierMedia } from '@/services/property-dossier/dossier-media.reader';
import type { DossierMediaRead } from '@/services/property-dossier/dossier-media-publication';
import { isPubliclyListed } from '@/services/listings/public-listing-projection';
import { resolveListedAt } from '@/services/listings/listed-at-stamp';
import { resolvePriceHistory } from '@/services/listings/price-history-stamp';
import { marketPriceOf } from '@/lib/listings/price-history';
import type { OwnerProperty } from '@/types/owner-property';

const logger = createModuleLogger('owner-property-publication');

/** Ό,τι η δημοσίευση διαβάζει **έξω** από το έγγραφο της αγγελίας — τη στιγμή της γραφής. */
interface PublicationInputs {
  readonly agency: PublicAgencyIdentity;
  readonly dossierMedia: DossierMediaRead | null;
}

/**
 * 🔴 ADR-866 Φ1.3 — **Ο ΦΑΚΕΛΟΣ ΔΙΑΒΑΖΕΤΑΙ ΜΑΖΙ ΜΕ ΤΗΝ ΤΑΥΤΟΤΗΤΑ ΓΡΑΦΕΙΟΥ, ΜΕ ΤΟ ΙΔΙΟ ΣΥΜΒΟΛΑΙΟ**: αγγελία με φάκελο
 * δημοσιεύει τα **δηλωμένα** αρχεία του φακέλου. **Πετά** σε αποτυχία ⇒ ο καλών απαντά `failed`, **ποτέ** «κενή
 * βιτρίνα» (θα έσβηνε τις φωτογραφίες της αγγελίας σε μια παροδική βλάβη).
 */
async function readPublicationInputs(
  adminDb: AdminFirestore,
  property: OwnerProperty,
): Promise<PublicationInputs> {
  const [agency, dossierMedia] = await Promise.all([
    readPublicAgencyIdentity(adminDb, property.authorCompanyId),
    property.dossierId === undefined
      ? Promise.resolve(null)
      : readDossierMedia(adminDb, property.dossierId, property.authorUserId),
  ]);
  return { agency, dossierMedia };
}

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
): Promise<ListingProjectionResult> {
  const at = nowISO();

  // 🔑 **Η ταυτότητα διαβάζεται ΕΔΩ, τη στιγμή της δημοσίευσης** (§8.33) — μία ανάγνωση
  // εγγράφου ανά **γραφή**, όχι ανά ανάγνωση αγγελίας. Ο ιδιώτης δεν πληρώνει τίποτα:
  // το `authorCompanyId` του είναι `null` και ο αναγνώστης επιστρέφει αμέσως.
  //
  // ⚠️ **Απο-κανονικοποίηση, με τη συνέπειά της γραμμένη**: αν το γραφείο αλλάξει
  // επωνυμία, οι ήδη δημοσιευμένες αγγελίες του δείχνουν την **παλιά** μέχρι την
  // επόμενη επανασύνθεση. Είναι το ίδιο συμβόλαιο που έχει ήδη κάθε πεδίο αυτής της
  // προβολής (`title`, `commercialStatus`): η προβολή είναι **στιγμιότυπο**, και το
  // `projectedAt` λέει πότε τραβήχτηκε.
  //
  // ✅ **ΚΑΙ ΤΟ ΠΑΡΑΘΥΡΟ ΕΚΛΕΙΣΕ** (ADR-841 §7 Α1.6): η **μία** διαδρομή που
  //    μετονομάζει εταιρεία καλεί πλέον την {@link republishListingsForCompany}. Η
  //    σημείωση από πάνω μένει γιατί περιγράφει το **συμβόλαιο** — στιγμιότυπο, όχι
  //    ζωντανή σύνδεση· αυτό που άλλαξε είναι ότι κάποιος **σκανδαλίζει** τη
  //    διόρθωση αντί να την περιμένει.
  //
  // 🔑 **Η ταυτότητα ταξιδεύει ΜΑΖΙ με το όνομα** ώστε η επανασύνθεση να είναι
  //    **επισκευή** (ξαναρωτά την πηγή) και όχι δεύτερη μαντεψιά.
  //
  // 🔴 ADR-841 §7 Α22 — **Η ΑΝΑΓΝΩΣΗ ΜΠΟΡΕΙ ΠΛΕΟΝ ΝΑ ΠΕΤΑΞΕΙ**: όταν η βιτρίνα δεν διαβάζεται,
  //    δεν ξέρουμε **ποιο** όνομα ισχύει. Μετράει ως `failed` ⇒ η προηγούμενη προβολή μένει
  //    άθικτη — ίδιο συμβόλαιο με τον γραφέα του επαγγελματία, **μία** διατύπωση αποτυχίας.
  let inputs: PublicationInputs;
  try {
    inputs = await readPublicationInputs(adminDb, property);
  } catch (error) {
    return { outcome: reportProjectionFailure(property.id, error), lead: null, mapMark: null };
  }
  const projectable = projectableFromOwnerProperty(property, at, inputs.agency, inputs.dossierMedia);

  // 🔴 **Η ΣΦΡΑΓΙΔΑ ΕΙΣΟΔΟΥ ΣΤΗΝ ΑΓΟΡΑ** (ADR-777 §8.61) — **ίδια** πολιτική με τον
  //    επαγγελματία, **άλλη** διεύθυνση. Η απόφαση ζει μία φορά στο `listed-at-stamp`·
  //    εδώ δίνεται μόνο η συλλογή. Δύο αντίγραφα της πολιτικής θα ήταν ακριβώς η
  //    απόκλιση που η κεφαλίδα αυτού του αρχείου υπάρχει για να αποτρέψει.
  //
  // ⚠️ **Κρίνεται το ΠΡΟΒΑΛΛΟΜΕΝΟ σχήμα, όχι το ωμό έγγραφο**: ο ίδιος κριτής που θα
  //    αποφασίσει και τη δημοσίευση δύο γραμμές πιο κάτω. Ένα δεύτερο κριτήριο εδώ θα
  //    σφράγιζε ακίνητο που δεν δημοσιεύεται — δες `owner-property-projection.ts`, που
  //    ρωτά **ήδη** έτσι το ίδιο ερώτημα.
  const listed = isPubliclyListed(projectable);
  const [listedAt, priceHistory] = await Promise.all([
    listed
      ? resolveListedAt(adminDb, COLLECTIONS.OWNER_PROPERTIES, property.id, property.listedAt, at)
      : Promise.resolve(null),
    // 🔴 **ΤΟ ΙΣΤΟΡΙΚΟ ΤΙΜΗΣ** (ADR-777 §8.69) — **ίδια** πολιτική με τον επαγγελματία,
    //    **άλλη** διεύθυνση, ακριβώς όπως η σφραγίδα εισόδου από πάνω. Κρίνεται το
    //    **προβαλλόμενο** σχήμα, για τον ίδιο λόγο.
    resolvePriceHistory(
      adminDb, COLLECTIONS.OWNER_PROPERTIES, property.id, property.priceHistory,
      marketPriceOf(projectable, listed), at,
    ),
  ]);

  return writeListingProjection(
    adminDb,
    property.id,
    { ...projectable, listedAt, priceHistory },
    placeKnowledgeFromOwnerProperty(property, at),
    at,
  );
}

/**
 * **Γράφει το αποτύπωμα της δημοσίευσης πάνω στο ίδιο έγγραφο.**
 *
 * 🔑 **Δεύτερη γραφή, και είναι ΑΝΑΓΚΑΣΤΙΚΗ**: η έκβαση **δεν υπάρχει** τη στιγμή που
 * γράφεται το έγγραφο — προκύπτει από την προβολή, που τρέχει **μετά** (η σειρά
 * «πρώτα η αλήθεια, μετά το παράγωγο» είναι συμβόλαιο, δες τη {@link persist}). Είναι
 * μία μικρή `update` ανά **ανθρώπινη αποθήκευση**, όχι ανά ανάγνωση.
 *
 * ⚠️ **Δεν ρίχνει ΠΟΤΕ την αποθήκευση.** Ίδιο συμβόλαιο με τον γραφέα της προβολής:
 * η δουλειά του κατόχου έγινε. Αν αποτύχει και το αποτύπωμα, ο άνθρωπος **δεν χάνει
 * την πληροφορία** — το `publish` ταξιδεύει ούτως ή άλλως στο σώμα της απάντησης
 * (`_shared/respond.ts`). Χάνεται μόνο η **διαρκής** μνήμη, και αυτό είναι
 * αυστηρά λιγότερο κακό από μια αγγελία που δεν αποθηκεύτηκε.
 *
 * ⚠️ **`update`, ΟΧΙ `set`** — μοναδική εξαίρεση στον κανόνα «ολόκληρο, ποτέ μερικό»
 * αυτού του αρχείου, και ο λόγος είναι ότι εδώ **δεν συνθέτουμε έγγραφο**: γράφουμε
 * **ένα** πεδίο πάνω σε έγγραφο που μόλις γράφτηκε ολόκληρο, δύο γραμμές πιο πάνω.
 *
 * 🖼️ **Και η μικρογραφία ταξιδεύει ΜΕΣΑ στο ίδιο πεδίο** (ADR-777 §8.70): έκβαση και εικόνα
 * γράφονται στην **ίδια** `update`, άρα δεν μπορούν να αποκλίνουν. Το `lead` είναι ήδη `null`
 * σε απόσυρση/αποτυχία — εδώ απλώς αφαιρείται το `altKey` ({@link thumbnailFromLead}).
 */
async function stampPublication(
  adminDb: AdminFirestore,
  property: OwnerProperty,
  result: ListingProjectionResult,
): Promise<OwnerProperty> {
  // 🔑 Εικόνα ΚΑΙ σημάδι χάρτη στην ΙΔΙΑ `update` με την έκβαση (ADR-777 §8.70): δεν μπορούν
  //    να αποκλίνουν, και η απόσυρση τα μηδενίζει μαζί.
  const publication = {
    outcome: result.outcome,
    at: nowISO(),
    thumbnail: thumbnailFromLead(result.lead),
    mapMark: result.mapMark,
  };

  try {
    await adminDb
      .collection(COLLECTIONS.OWNER_PROPERTIES)
      .doc(property.id)
      .update({ publication });
  } catch (error) {
    logger.error('Το αποτύπωμα δημοσίευσης δεν γράφτηκε — η αγγελία ΑΠΟΘΗΚΕΥΤΗΚΕ κανονικά', {
      propertyId: property.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return property;
  }

  return { ...property, publication };
}

/**
 * **Ξαναγράφει τη δημόσια προβολή ΚΑΙ καταγράφει την έκβαση.** Η **μία** διατύπωση.
 *
 * 🔴 **ΕΔΩ ΤΗΡΕΙΤΑΙ Η ΥΠΟΣΧΕΣΗ ΠΟΥ ΚΑΝΕΙΣ ΔΕΝ ΤΗΡΟΥΣΕ.** Ο γραφέας της προβολής
 * δηλώνει γραπτά ότι επιστρέφει `'failed'` *«ονομαστικά ώστε ο καλών να το
 * **ΚΑΤΑΓΡΑΨΕΙ**»*. Μέχρι τις 2026-08-27 ο καλών **δεν** το κατέγραφε πουθενά: η
 * αποτυχία ζούσε μόνο σε γραμμή log, η οθόνη έλεγε «στον δημόσιο χάρτη» ενώ δεν ήταν,
 * και **καμία** ερώτηση δεν μπορούσε να βρει τι χρειάζεται επανασύνθεση.
 *
 * 🔑 **ΕΞΑΓΕΤΑΙ επειδή έχει ΔΥΟ καλούντες που δεν επιτρέπεται να αποκλίνουν**: η
 * αποθήκευση ({@link persist}) και η **επανασύνθεση** (`/api/admin/rebuild-public-listings`).
 * Αν η δεύτερη ξαναέγραφε την προβολή **χωρίς** να ενημερώσει το αποτύπωμα, μια
 * διορθωμένη αγγελία θα έμενε «εκκρεμής» στην οθόνη **για πάντα** — δηλαδή η θεραπεία
 * δεν θα έσβηνε το σύμπτωμα.
 */
export async function republishOwnerProperty(
  adminDb: AdminFirestore,
  property: OwnerProperty,
): Promise<{ readonly publish: PublishOutcome; readonly property: OwnerProperty }> {
  const result = await republishOwnerListing(adminDb, property);
  return { publish: result.outcome, property: await stampPublication(adminDb, property, result) };
}
