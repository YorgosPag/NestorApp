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
  isPubliclyListed,
  type ProjectableProperty,
  type PlaceKnowledge,
  type ListingPositionCandidate,
} from './public-listing-projection';
import { resolveListedAt } from './listed-at-stamp';
import { resolvePriceHistory } from './price-history-stamp';
import { marketPriceOf } from '@/lib/listings/price-history';
import { withdrawListingShelves, writeWithShelf } from './publish-public-listing-shelf';
import { addressToPositionCandidate, type AddressLike } from './public-listing-position';
import type { PlaceRef } from '@/types/geo/public-place';
import type { ListingImage, PublicListing } from '@/types/public-listing';
import { listingLeadImage } from '@/lib/listings/listing-images';
import { listingMapMark, type ListingMapMark } from '@/lib/listings/listing-map-mark';
import {
  createAgencyIdentityResolver,
  type AgencyIdentityResolver,
} from '@/services/company/company-public-name.reader';
import {
  createAgencyMediaResolver,
  type AgencyMediaResolver,
} from './agency-media.reader';
import { agencyMediaDeclaration } from './agency-media-publication';
// ADR-846 Φ5δ — η **απόδειξη παρουσίας** ξαναχτίζεται όποτε αλλάζει η προσφορά.
import { refreshShowcasePresence } from '@/services/mandate/showcase-presence.service';

const logger = createModuleLogger('publish-public-listing');

/** Τι έκανε ο γραφέας — ρητά, ώστε η επανασύνθεση να μπορεί να **μετρήσει**. */
export type PublishOutcome = 'published' | 'withdrawn' | 'failed';

/**
 * **Η έκβαση ΚΑΙ η εικόνα που είδε ο κόσμος** — ό,τι επιστρέφει ο πυρήνας (ADR-777 §8.70).
 *
 * 🔑 Το `lead` υπάρχει **μόνο** για `published`: στο `withdrawn` το ράφι άδειασε (το URL θα
 * ήταν νεκρό), στο `failed` δεν ξέρουμε τι κάθεται στον κόσμο. Έτσι ο καλών **δεν μπορεί**
 * να δείξει εικόνα που δεν ισχύει.
 */
export interface ListingProjectionResult {
  readonly outcome: PublishOutcome;
  readonly lead: ListingImage | null;
  /**
   * **Το σημάδι που ζωγραφίζει ο δημόσιος χάρτης** (ADR-777 §8.70 Φάση 2) — ίδιο συμβόλαιο με το
   * `lead`: μόνο για `published`, από το έγγραφο που **γράφτηκε**. Σημάδι, όχι θέση, ώστε ο
   * καλών να **μην μπορεί** να δείξει ακριβέστερη θέση από όση βλέπει ο κόσμος.
   */
  readonly mapMark: ListingMapMark | null;
}

/**
 * **Το ωμό έγγραφο `properties/{id}` όσο το χρειάζεται ο γραφέας** — η προβολή, συν τα
 * πεδία που δεν ζουν σε αυτήν επειδή απαντούν σε ερωτήσεις **ιεραρχίας** ή **πρόθεσης**.
 *
 * 🔑 Τα `buildingId`/`projectId` λύνουν τον **τόπο**· το `companyId` λύνει το
 * **ποιος δημοσιεύει** (ADR-841 §7 Α1). Ζουν εδώ και όχι στο {@link ProjectableProperty}
 * γιατί η προβολή είναι **καθαρή**: δέχεται λυμένες απαντήσεις, δεν κρατά κλειδιά για
 * να τις βρει μόνη της.
 */
export type ListingSourceProperty = ProjectableProperty & {
  readonly buildingId?: string | null;
  readonly projectId?: string | null;
  /** Ο **ιδιοκτήτης** του ακινήτου, γραμμένος από το `createEntity` (ADR-238). */
  readonly companyId?: string | null;
  /**
   * **Η πράξη σειράς του γραφείου** — ταυτότητες `FileRecord.id`, στη δηλωμένη σειρά
   * (ADR-841 §7 Α14.7).
   *
   * 🔴 **ΖΕΙ ΕΔΩ ΚΑΙ ΟΧΙ ΣΤΗΝ ΠΡΟΒΟΛΗ, ΚΑΙ ΕΙΝΑΙ Ο ΛΟΓΟΣ ΠΟΥ ΕΠΙΒΙΩΝΕΙ**: το
   * `public_listings` **ξαναγράφεται ολόκληρο** σε κάθε επανασύνθεση (`set`, γρ. ~300
   * παρακάτω). Ανθρώπινη είσοδος μέσα σε προβολή είναι είσοδος που **σβήνεται** στο
   * επόμενο πέρασμα, χωρίς να το μάθει κανείς.
   *
   * ⚠️ **Ωμό `unknown`, επίτηδες**: το πεδίο έρχεται από έγγραφο του δίσκου και το
   * διαβάζει **αποκλειστικά** το `agencyMediaDeclaration`. Ένας τύπος `string[]` εδώ θα
   * ήταν **υπόσχεση που κανείς δεν επιβάλλει** — ακριβώς το σχήμα με το οποίο ένα
   * προαιρετικό πεδίο γίνεται σιωπηλά «μόνιμα σωστό» στα μάτια του μεταγλωττιστή.
   */
  readonly publishedMediaOrder?: unknown;
  /**
   * **Οι κατόψεις που το γραφείο ΟΝΟΜΑΣΕ για αυτή την αγγελία** — ταυτότητες
   * `FileRecord.id` (ADR-841 §7 Α17.7).
   *
   * 🔴 **ΕΙΝΑΙ ΣΚΕΛΟΣ ΣΥΜΜΕΤΟΧΗΣ, ΣΕ ΑΝΤΙΘΕΣΗ ΜΕ ΤΟ `publishedMediaOrder` ΑΠΟ ΠΑΝΩ** —
   * και γι' αυτό **προστίθεται** στους φρουρούς, ποτέ δεν τους αντικαθιστά: κάτοψη χωρίς
   * `classification: 'public'` δεν φεύγει **ούτε όταν δηλωθεί** *(Α17.7.4)*.
   *
   * ⚠️ **Ωμό `unknown`, ίδια πειθαρχία**: η ανάγνωση είναι **αποκλειστικά** το
   * `agencyMediaDeclaration`.
   */
  readonly publishedFloorplans?: unknown;
};

/**
 * Μαζεύει ό,τι ξέρουμε για τον τόπο ενός ακινήτου, **ανεβαίνοντας την αλυσίδα της Α1**:
 * ακίνητο → κτίριο → έργο.
 *
 * ⚠️ **Διαβάζει με Admin SDK επίτηδες.** Ο ανώνυμος επισκέπτης **δεν** έχει —και δεν
 * πρέπει να αποκτήσει— πρόσβαση στα `buildings`/`projects`. Η ανάλυση γίνεται εδώ
 * **μία φορά**, και ό,τι φτάνει στον κόσμο είναι μόνο το **αποτέλεσμα**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΔΥΟ ΕΡΩΤΗΣΕΙΣ, **ΕΝΑ** ΑΝΕΒΑΣΜΑ — και γι' αυτό ζουν στην ίδια συνάρτηση (Β3)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * *«**Πού** είναι;»* → οι διευθύνσεις του **έργου** (υποψήφιες θέσεις).
 * *«**Ποιο πράγμα** είναι;»* → ο δεσμός του **κτιρίου** προς το επίπεδο Α.
 *
 * Είναι διαφορετικές ερωτήσεις με **διαφορετική** απάντηση, αλλά η διαδρομή προς την
 * απάντηση είναι **η ίδια αλυσίδα**. Δύο ξεχωριστά ανεβάσματα θα διάβαζαν **δύο φορές**
 * το ίδιο έγγραφο κτιρίου — και, χειρότερα, θα μπορούσαν να **αποκλίνουν** στο ποιο
 * κτίριο θεωρούν «το» κτίριο του ακινήτου.
 *
 * 🔑 **Ο δεσμός ζει στο ΚΤΙΡΙΟ, όχι στο ακίνητο** (§14.4 κανόνας 4 · §21.6): το επίπεδο
 * Α είναι κοινό και **δεν κουβαλά ποτέ** ταυτότητα πελάτη, άρα ο δεσμός δείχνει **από
 * το Β προς το Α** και ποτέ αντίστροφα. Και είναι στο κτίριο επειδή **εκεί** είναι
 * αληθής: όλα τα διαμερίσματα ενός κτιρίου βρίσκονται στο **ίδιο** φυσικό κτίριο, και
 * μια δήλωση ανά ακίνητο θα ήταν N αντίγραφα του ίδιου γεγονότος (§14.5, «χωρίς
 * διπλότυπα»).
 *
 * ⚠️ **Το έγγραφο του κτιρίου διαβάζεται τώρα ΚΑΙ όταν το ακίνητο ξέρει το έργο του.**
 * Πριν τη Β3 το ανέβασμα σταματούσε στο `property.projectId`· αυτό αρκούσε για τη
 * **θέση**, αλλά ο **δεσμός** ζει ένα σκαλί πιο κάτω. Ένα επιπλέον read ανά ακίνητο με
 * `buildingId` είναι το **κόστος του να έχει διεύθυνση η μισή αγορά** — και δεν
 * πληρώνεται καθόλου για ακίνητα χωρίς κτίριο.
 *
 * 🔶 **Δηλωμένο όριο**: ακίνητο **χωρίς** `buildingId` δεν αποκτά δεσμό. Δεν
 * «κληρονομεί» από το έργο, γιατί ένα έργο μπορεί να έχει **πολλά** κτίρια σε
 * **διαφορετικές** γη — μια τέτοια κληρονομιά θα ήταν εικασία, ακριβώς αυτό που
 * απαγορεύει το §13.3.
 */
export async function collectPlaceKnowledge(
  adminDb: AdminFirestore,
  property: { buildingId?: string | null; projectId?: string | null },
  locatedAt: string
): Promise<PlaceKnowledge> {
  const building = await readBuildingDoc(adminDb, property.buildingId ?? null);
  const ref = building?.placeRef ?? null;

  const projectId = property.projectId ?? building?.projectId ?? null;
  if (!projectId) return { candidates: [], ref };

  const snap = await adminDb.collection(COLLECTIONS.PROJECTS).doc(projectId).get();
  if (!snap.exists) return { candidates: [], ref };

  const addresses = (snap.data()?.addresses ?? []) as AddressLike[];
  const candidates = addresses
    .map((address) => addressToPositionCandidate(address, locatedAt))
    .filter((c): c is ListingPositionCandidate => c !== null);

  return { candidates, ref };
}

/** Ό,τι χρειάζεται η αλυσίδα από το κτίριο — **δύο** πεδία, όχι ολόκληρο το έγγραφο. */
interface BuildingChainFacts {
  readonly projectId: string | null;
  readonly placeRef: PlaceRef | null;
}

/** Το έγγραφο του κτιρίου, **μία φορά** — ή `null` αν δεν υπάρχει κτίριο να ρωτηθεί. */
async function readBuildingDoc(
  adminDb: AdminFirestore,
  buildingId: string | null
): Promise<BuildingChainFacts | null> {
  if (!buildingId) return null;

  const snap = await adminDb.collection(COLLECTIONS.BUILDINGS).doc(buildingId).get();
  if (!snap.exists) return null;

  const data = snap.data() ?? {};
  return {
    projectId: (data.projectId as string | undefined) ?? null,
    placeRef: (data.placeRef as PlaceRef | undefined) ?? null,
  };
}

/**
 * Ξαναγράφει (ή σβήνει) την προβολή **ενός** ακινήτου.
 *
 * 🔑 **Δεν πετά ποτέ.** Η αποτυχία της δημόσιας προβολής **δεν** επιτρέπεται να
 * ακυρώσει την αποθήκευση του κατόχου: εκείνος έκανε τη δουλειά του. Επιστρέφει
 * `'failed'` **ονομαστικά** ώστε ο καλών να το καταγράψει και η επανασύνθεση να το
 * διορθώσει — που είναι η διαφορά ανάμεσα σε «*σιωπηλά μπαγιάτικο*» και «*γνωστά
 * εκκρεμές*».
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΚΛΗΣΗ ΠΟΥ ΕΛΕΙΠΕ (ADR-841 §7 Α1, 2026-09-01)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μέχρι σήμερα **κάθε** αγγελία έργου έγραφε `agencyName: null` και η οθόνη έλεγε
 * *«Από μεσιτικό γραφείο»* — χωρίς επωνυμία. **Δεν έλειπε μηχανή**: η είσοδος, η
 * μεταφορά, ο αναγνώστης και η οθόνη υπήρχαν και οι τέσσερις· απλώς **κανείς δεν
 * καλούσε τον αναγνώστη**. Ο γραφέας του **ιδιώτη** τον καλούσε ήδη σωστά
 * (`owner-property-publication.service.ts`) — εδώ γίνεται το ίδιο, στο **συμμετρικό**
 * σημείο.
 *
 * 🔑 **Ο επιλυτής είναι ΟΡΙΣΜΑ, για τον ΙΔΙΟ λόγο που το `projectedAt` είναι όρισμα**
 * του {@link writeListingProjection}: ένα πέρασμα οφείλει να μιλά για **μία** στιγμή
 * και **μία** εικόνα των εταιρειών. Ο βρόχος του έργου φτιάχνει **έναν** επιλυτή και
 * τον περνά ⇒ **μία** ανάγνωση, όχι N. Ο μεμονωμένος καλών δεν χρειάζεται να ξέρει
 * ότι υπάρχει: η προεπιλογή είναι επιλυτής **μιας χρήσης**.
 *
 * ⚠️ **`Promise.all` και όχι σειριακά**: ο τόπος, το γραφείο και **οι φωτογραφίες** είναι
 * **ανεξάρτητες** ερωτήσεις σε **διαφορετικά** έγγραφα. Σειριακά, η αγγελία θα πλήρωνε
 * τρεις πλήρεις γύρους δικτύου για δουλειά που γίνεται σε έναν.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΔΕΥΤΕΡΗ ΚΛΗΣΗ ΠΟΥ ΕΛΕΙΠΕ (ADR-841 §7 Α14, 2026-09-02) — **η ίδια κλάση**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μέχρι σήμερα **κάθε** αγγελία έργου έφτανε στο {@link writeListingProjection} χωρίς
 * `publishedMedia`, έπαιρνε το `?? []` της γρ. 280 και δημοσιευόταν **χωρίς καμία
 * εικόνα** — ενώ ο ιδιώτης είχε αποκτήσει συλλογή από τη **Φ3**. Ίδιο σχήμα με την
 * **Α1** ακριβώς από πάνω: **δεν έλειπε μηχανή** *(το πεδίο, το ράφι, ο καθαριστής και
 * η οθόνη υπήρχαν και τα τέσσερα)* — έλειπε **η κλήση**.
 *
 * 🔑 **Ο επιλυτής είναι ΟΡΙΣΜΑ**, για τον ίδιο λόγο με τον `resolveAgency`: ο βρόχος
 * κρατά τη δική του πολιτική κόστους, και ο γραφέας μένει μία μηχανή. ⛔ **Κανένα
 * δεύτερο ράφι, κανένας δεύτερος γραφέας** — γεμίζει το **υπάρχον** `publishedMedia`,
 * το ίδιο πεδίο που γεμίζει ο ιδιώτης από τη δική του πλευρά.
 *
 * ⚠️ **Ο ιδιοκτήτης διαβάζεται από το ΕΓΓΡΑΦΟ, ποτέ από τον καλούντα.** Το
 * `properties/{id}.companyId` το γράφει το `createEntity` από το **auth context**
 * (ADR-238) — είναι η ίδια αυθεντία που κρίνει και τα δικαιώματα. Ένα `companyId` που
 * θα ερχόταν από το σώμα ενός αιτήματος θα ήταν **ισχυρισμός του καλούντος**.
 */
export async function republishListing(
  adminDb: AdminFirestore,
  propertyId: string,
  property: ListingSourceProperty,
  resolveAgency: AgencyIdentityResolver = createAgencyIdentityResolver(adminDb),
  resolveMedia: AgencyMediaResolver = createAgencyMediaResolver(adminDb)
): Promise<PublishOutcome> {
  const now = nowISO();
  const listed = isPubliclyListed(property);

  try {
    const [place, agency, publishedMedia, listedAt, priceHistory] = await Promise.all([
      collectPlaceKnowledge(adminDb, property, now),
      resolveAgency(property.companyId),
      // 🔑 **Η δήλωση σειράς διαβάζεται ΕΔΩ, από το έγγραφο που ήδη κρατάμε** (Α14.7.2):
      //    το `properties/{id}` είναι **1:1** με την αγγελία και είναι **η είσοδος** αυτής
      //    της συνάρτησης ⇒ η πράξη του ανθρώπου φτάνει στον επιλυτή **χωρίς καμία
      //    επιπλέον ανάγνωση** και χωρίς να μπορεί να δει **άλλη** έκδοση του εγγράφου
      //    από αυτήν που δημοσιεύεται στο ίδιο πέρασμα.
      resolveMedia(propertyId, property.companyId, agencyMediaDeclaration(property)),
      // 🔴 **Η ΣΦΡΑΓΙΔΑ ΕΙΣΟΔΟΥ ΣΤΗΝ ΑΓΟΡΑ** (ADR-777 §8.61) — τέταρτη **ανεξάρτητη**
      //    ερώτηση, στο ίδιο πέρασμα και με τη **ίδια** στιγμή `now`.
      //
      // ⚠️ **Ζητείται ΜΟΝΟ για δημοσιεύσιμο ακίνητο**: το `isPubliclyListed` είναι ο
      //    **ένας** κριτής (καθαρή συνάρτηση, μηδέν κόστος), και τον ρωτά ούτως ή άλλως
      //    το `buildPublicListing` πιο κάτω. Χωρίς αυτή τη φύλαξη, ένα ακίνητο θα
      //    αποκτούσε ημερομηνία εισόδου **χωρίς ποτέ να μπει** στην αγορά.
      listed
        ? resolveListedAt(adminDb, COLLECTIONS.PROPERTIES, propertyId, property.listedAt, now)
        : Promise.resolve(null),
      // 🔴 **ΤΟ ΙΣΤΟΡΙΚΟ ΤΙΜΗΣ** (ADR-777 §8.69) — πέμπτη ανεξάρτητη ερώτηση, ίδια στιγμή.
      //    Ρωτιέται **και** για μη δημοσιεύσιμο ακίνητο: η απόσυρση είναι **γεγονός**
      //    («εκτός αγοράς») που κλείνει το διάστημα ισχύος της προηγούμενης τιμής.
      resolvePriceHistory(
        adminDb, COLLECTIONS.PROPERTIES, propertyId, property.priceHistory,
        marketPriceOf(property, listed), now
      ),
    ]);

    const { outcome } = await writeListingProjection(
      adminDb,
      propertyId,
      { ...property, agency, publishedMedia, listedAt, priceHistory },
      place,
      now
    );
    return outcome;
  } catch (error) {
    return reportProjectionFailure(propertyId, error);
  }
}

/**
 * **Ο ΠΥΡΗΝΑΣ: ακίνητο + ΗΔΗ ΛΥΜΕΝΟΣ τόπος → προβολή, ή διαγραφή.**
 *
 * 🔴 **Εξήχθη επειδή υπάρχουν ΔΥΟ πηγές και ΜΙΑ έξοδος** (ADR-777 Α14, 2026-08-11).
 * Ο επαγγελματίας γράφει σε `properties` και ο τόπος του λύνεται **ανεβαίνοντας την
 * αλυσίδα της Α1** (ακίνητο → κτίριο → έργο)· ο **ιδιώτης** γράφει σε
 * `owner_properties` και ο τόπος του είναι **η δική του δήλωση** — δεν υπάρχει
 * αλυσίδα να ανέβει.
 *
 * 🔑 **Η διαφορά είναι ΑΚΡΙΒΩΣ ΜΙΑ ΠΑΡΑΜΕΤΡΟΣ, και γι' αυτό η εξαγωγή είναι η σωστή
 * πράξη αντί για δεύτερο γραφέα**: το κριτήριο δημοσίευσης, η επίλυση θέσης με
 * `outranksForLocation`, το ολικό `set`, η διαγραφή-ως-απόσυρση και η λογιστική
 * αποτυχίας μένουν **ένα** πράγμα. Ένας δεύτερος γραφέας θα ήταν το σχήμα του
 * **ADR-749** στην πιο ακριβή του μορφή: δύο μηχανές που γράφουν στην **ίδια**
 * δημόσια συλλογή.
 *
 * ⚠️ **Δέχεται τη στιγμή ως όρισμα** αντί να καλέσει η ίδια `nowISO()`: το
 * `projectedAt` της αγγελίας και το `locatedAt` της υποψήφιας θέσης οφείλουν να είναι
 * **η ίδια** στιγμή. Δύο κλήσεις ρολογιού στο ίδιο πέρασμα παράγουν έγγραφο που λέει
 * ότι η θέση εντοπίστηκε **πριν** ή **μετά** την προβολή που την περιέχει.
 *
 * ⚠️ **Δεν πετά ποτέ** — ίδιο συμβόλαιο με τον καλούντα: η αποτυχία της δημόσιας
 * προβολής δεν ακυρώνει την αποθήκευση του κατόχου.
 */
export async function writeListingProjection(
  adminDb: AdminFirestore,
  listingId: string,
  property: ProjectableProperty,
  place: PlaceKnowledge,
  projectedAt: string
): Promise<ListingProjectionResult> {
  const ref = adminDb.collection(COLLECTIONS.PUBLIC_LISTINGS).doc(listingId);

  // ── ADR-846 Φ5δ — Η ΠΡΟΣΦΟΡΑ ΑΛΛΑΞΕ, ΑΡΑ ΑΛΛΑΞΕ ΚΑΙ Η ΑΠΟΔΕΙΞΗ ──────────────
  //
  // 🔑 **Γραμμένο ΜΙΑ φορά, καλείται και στις ΔΥΟ κατευθύνσεις.** Η απόσυρση αλλάζει το
  //    «πού έχει αποδεδειγμένα ακίνητο» **ακριβώς όσο** η δημοσίευση: γραφείο που
  //    ξεπούλησε το τελευταίο του ακίνητο στη Λάρισα **παύει** να έχει απόδειξη εκεί, και
  //    ένα `presence` που κρατά την παλιά περιοχή θα ήταν **ψευδής ισχυρισμός με
  //    ημερομηνία λήξης**. Δύο ξεχωριστές κλήσεις θα ήταν δύο ευκαιρίες να ξεχαστεί η μία.
  //
  // ⚠️ **Το `property.agency` επιβιώνει ΚΑΙ στην απόσυρση**: το `buildPublicListing`
  //    επιστρέφει `null` επειδή ο κύκλος ζωής δεν είναι πια «listed» — το **έγγραφο
  //    πηγής** που κρατά την ταυτότητα του γραφείου είναι ολόκληρο εδώ.
  const refreshPresence = (): Promise<void> =>
    refreshShowcasePresence(adminDb, property.agency?.id ?? '');

  try {
    const listing = buildPublicListing({ ...property, id: listingId }, place, projectedAt);

    if (!listing) {
      await ref.delete();
      // ── ADR-841 Α12.6 — Η ΑΠΟΣΥΡΣΗ ΣΥΜΒΑΙΝΕΙ ΚΑΙ ΣΤΑ BYTES ────────────────
      //
      // 🔴 **Χωρίς αυτή τη γραμμή το ράφι θα ήταν διαρροή που ΜΕΓΑΛΩΝΕΙ**: η αγγελία
      //    φεύγει από τον χάρτη, οι φωτογραφίες της μένουν δημόσια αναγνώσιμες για
      //    πάντα, και **κανείς δεν θα το μάθαινε** — δεν υπάρχει οθόνη που να τις
      //    δείχνει πια.
      //
      // 🔴 **ΚΑΙ ΑΠΟ ΤΗ Φ4.2β ΤΑ ΡΑΦΙΑ ΕΙΝΑΙ ΔΥΟ** (ADR-845). Ως τότε εδώ καλούνταν το
      //    `reconcileShelfSafely`, που άδειαζε **μόνο τις εικόνες** — δηλαδή κάθε
      //    δημοσιευμένο `.glb` θα **επιβίωνε την απόσυρση**, ακριβώς η διαρροή που η
      //    παράγραφος από πάνω υπάρχει για να αποτρέψει, μία γενιά αργότερα.
      //    ⇒ Η {@link withdrawListingShelves} **απαριθμεί τον πίνακα ειδών**: δεν υπάρχει
      //    δεύτερη γραμμή να ξεχαστεί, και τρίτο είδος καλύπτεται **αυτομάτως**.
      //
      // 🔑 **Κενό σύνολο, όχι «σβήσε τα»**: είναι η ίδια πράξη με το `set()` από
      //    κάτω, με άλλη τιμή. Ο γραφέας δεν έχει δύο συμπεριφορές — έχει **μία**,
      //    και η απόσυρση είναι η περίπτωσή της όπου το επιθυμητό σύνολο είναι ∅.
      //    Γι' αυτό η **επαναφορά** (`lifecycle: 'listed'` ξανά) δουλεύει χωρίς
      //    τίποτε επιπλέον: ξαναπερνά από εδώ με μη-κενό σύνολο.
        await withdrawListingShelves(listingId);
      await refreshPresence();
      return { outcome: 'withdrawn', lead: null, mapMark: null };
    }

    // ── ADR-839 — Η ΣΦΡΑΓΙΔΑ ΕΚΔΟΣΗΣ ────────────────────────────────────────
    //
    // 🔑 **Μπαίνει ΕΔΩ και όχι στην προβολή, επίτηδες.** Το `PublicListing` είναι
    //    το κλειστό σχήμα του §25.6 — *«ακριβώς τα 5 βασικά + 3 ειδικά, ΠΟΤΕ
    //    περισσότερα»* — και η έκδοση **δεν είναι περιεχόμενο αγγελίας**: κανείς
    //    επισκέπτης δεν τη διαβάζει. Είναι μεταδεδομένο **αποθήκευσης**, άρα
    //    ανήκει στη στιγμή της αποθήκευσης· διαφορετικά η επόμενη οθόνη θα
    //    ρωτούσε ευλόγως «τι κάνει μια έκδοση σχήματος μέσα στην κάρτα;».
    //
    // ⚠️ **Ο αναγνώστης τη διαβάζει μέσω `storedSchemaVersion`**, που απαντά `1`
    //    όταν λείπει — άρα κάθε έγγραφο γραμμένο πριν από σήμερα έχει ήδη σωστή
    //    απάντηση χωρίς να το αγγίξει κανείς.
    const written = await writeWithShelf(ref, listingId, listing, property.publishedMedia ?? []);
    await refreshPresence();

    // 🔑 Η κεντρική εικόνα από τον **ΕΝΑ** κριτή (`listingLeadImage`) πάνω σε ό,τι
    //    **γράφτηκε** — ποτέ δεύτερο κριτήριο, ποτέ ωμά ανεβάσματα (ADR-777 §8.70).
    return { outcome: 'published', lead: listingLeadImage(written), mapMark: listingMapMark(written.position) };
  } catch (error) {
    return { outcome: reportProjectionFailure(listingId, error), lead: null, mapMark: null };
  }
}

/**
 * Η **μία** διατύπωση της αποτυχίας — ώστε να μη γραφτεί σε κάθε γραφέα ξανά.
 *
 * ⚠️ **Εξάγεται** (ADR-841 §7 Α22) για τον γραφέα του **ιδιώτη**, που έχει πλέον κι αυτός
 * ανάγνωση ταυτότητας που **μπορεί να πετάξει**: δεύτερη διατύπωση εκεί θα ήταν ακριβώς
 * η επανάληψη που αυτή η συνάρτηση υπάρχει για να αποτρέψει.
 */
export function reportProjectionFailure(listingId: string, error: unknown): PublishOutcome {
  logger.error('Η προβολή δεν ενημερώθηκε — η αγγελία μένει ΜΠΑΓΙΑΤΙΚΗ μέχρι την επανασύνθεση', {
    propertyId: listingId,
    error: error instanceof Error ? error.message : String(error),
  });
  return 'failed';
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

  // 🔑 **ΕΝΑΣ επιλυτής για ΟΛΟ το πέρασμα** (ADR-841 §7 Α1): ένα έργο ανήκει σε
  //    **ακριβώς μία** εταιρεία — δες την εξαίρεση μισθωτή δύο γραμμές πιο πάνω — άρα
  //    N ακίνητα κάνουν **μία** ανάγνωση εταιρείας, όχι N ταυτόσημες.
  const resolveAgency = createAgencyIdentityResolver(adminDb);

  for (const doc of snap.docs) {
    const outcome = await republishListing(
      adminDb,
      doc.id,
      doc.data() as ListingSourceProperty,
      resolveAgency
    );
    tally[outcome] += 1;
  }

  logger.info('Επανασύνθεση προβολών έργου', { projectId, ...tally });
  return tally;
}
