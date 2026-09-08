/**
 * **Ο ΓΡΑΦΕΑΣ ΠΟΥ ΞΕΡΕΙ ΤΙ ΥΛΙΚΟ ΕΧΕΙ** — η συμφιλίωση **των δύο ραφιών** και η γραφή που
 * εξαρτάται από αυτήν, μαζί.
 *
 * 🔑 **ΓΙΑΤΙ ΕΦΥΓΕ ΑΠΟ ΤΟ `publish-public-listing.ts`** *(N.7.1)*: εκείνο το αρχείο απαντά
 * *«ποια ακίνητα ξαναγράφονται και με ποια σειρά;»* — αλληλουχία. Αυτό εδώ απαντά *«τι συμβαίνει
 * στα bytes όταν το `set` πέσει;»* — αντιστάθμιση.
 *
 * ⚠️ **Η σειρά «συμφιλίωση ΠΡΙΝ το `set`» ταξίδεψε αυτούσια** — δεν είναι στιλιστική: το κλειδί
 * κάθε δημοσιευμένου αντικειμένου είναι το sha256 των **παραγόμενων** bytes, άρα τα URL **δεν
 * υπάρχουν** πριν τρέξει η συμφιλίωση. Το σκεπτικό ζει στο {@link writeWithShelf}.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴🔴 Η Φ4.2β: **ΔΥΟ ΡΑΦΙΑ, ΕΝΑΣ ΕΝΟΡΧΗΣΤΡΩΤΗΣ, ΕΝΑ `set()`**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Από τη Φ4.2 μια αγγελία μπορεί να έχει **και** φωτογραφίες **και** μοντέλο, στο **ίδιο**
 * πρόθεμα. Στα **bytes** αυτό είναι ήδη ασφαλές και το **εκτελεί** η άγκυρα **Α-1ε** *(ο σβήστης
 * αγγίζει μόνο τη δική του κατάληξη)*.
 *
 * 🔴 **Ο ΚΙΝΔΥΝΟΣ ΗΤΑΝ ΑΛΛΟΥ, ΚΑΙ ΜΕΤΡΗΘΗΚΕ**: η **απόσυρση**. Ως τη Φ4.2α υπήρχε συνάρτηση
 * `reconcileShelfSafely(listingId, [])`, καλεσμένη από **δύο** σημεία — και **αδειάζε μόνο το
 * raster ράφι**. Με δημοσιευμένο μοντέλο, κάθε `.glb` θα **επιβίωνε την απόσυρση**, δημόσια
 * αναγνώσιμο, **για πάντα**, χωρίς καμία οθόνη να το δείχνει. Είναι **κατά γράμμα** η Α12.6:
 * *«διαρροή που ΜΕΓΑΛΩΝΕΙ, και κανείς δεν θα το μάθαινε»*.
 *
 * 🏆 **ΚΑΙ Η ΘΕΡΑΠΕΙΑ ΔΕΝ ΕΙΝΑΙ «ΝΑ ΜΗΝ ΞΕΧΑΣΤΕΙ Η ΔΕΥΤΕΡΗ ΓΡΑΜΜΗ» — ΕΙΝΑΙ ΝΑ ΜΗΝ ΥΠΑΡΧΕΙ
 * ΓΡΑΜΜΗ ΝΑ ΞΕΧΑΣΤΕΙ.** Η {@link withdrawListingShelves} **απαριθμεί** τα είδη της ρίζας από το
 * `PUBLIC_SHELF_KINDS` και αδειάζει **καθένα**. Νέο είδος στον πίνακα ⇒ καλύπτεται
 * **αυτομάτως**· νέο **είδος κωδικοποίησης** ⇒ **σπάει η μεταγλώττιση** μέχρι να απαντηθεί
 * *«πώς αδειάζει αυτό;»*. Η απόσυρση έπαψε να είναι λίστα κλήσεων και έγινε **παράγωγο του
 * λεξιλογίου** — ίδιο ιδίωμα με τις Α-1γ / Α-2.
 *
 * ⚠️ **ΚΑΙ ΤΟ ΕΓΓΡΑΦΟ ΓΡΑΦΕΤΑΙ ΜΙΑ ΦΟΡΑ.** Οι δύο αναφορές συντίθενται σε **ένα** `set()`. Ένα
 * δεύτερο `set`/`update` για τα μοντέλα θα άφηνε το δημόσιο έγγραφο **μείγμα δύο καταστάσεων**
 * — αυτό ακριβώς που το `public-shelf.service` γράφει ως λόγο ύπαρξης της συμφιλίωσης.
 */

import type { DocumentReference } from 'firebase-admin/firestore';
import { createModuleLogger } from '@/lib/telemetry';
import { PUBLIC_LISTING_SCHEMA_VERSION } from '@/lib/listings/public-listing-schema';
import { withPublishedGallery, type ProjectedShelfImage } from './public-listing-projection';
import {
  withPublishedModels,
  type ProjectedShelfModel,
} from './public-listing-model-projection';
import type { PublicListing } from '@/types/public-listing';
import type { ListingMaterial } from '@/lib/listings/listing-material';
import type { PublicShelfSource } from '@/services/upload/utils/storage-path-public-shelf';
import {
  LISTING_MODEL_SHELF,
  LISTING_SHELF,
  PUBLIC_SHELF_KINDS,
  PUBLIC_SHELF_LISTING_ROOT,
  type AnyPublicShelfKind,
  type ShelfEncoding,
} from '@/services/upload/utils/public-shelf-kinds';
import { reconcilePublicShelf, type PublicShelfImage } from './public-shelf.service';
import {
  reconcilePublicModelShelf,
  type PublishedShelfModel,
} from './public-shelf-model.service';

const logger = createModuleLogger('publish-public-listing-shelf');

/** Οι πηγές μιας αγγελίας, **χωρισμένες κατά ράφι** — δες {@link partitionListingSources}. */
interface ListingShelfSources {
  readonly raster: readonly PublicShelfSource<ListingMaterial>[];
  readonly model: readonly PublicShelfSource<ListingMaterial>[];
}

// ---------------------------------------------------------------------------
// Η ΔΙΑΜΕΡΙΣΗ — ένα πέρασμα, εξαντλητικό
// ---------------------------------------------------------------------------

/**
 * **Ο ΦΡΟΥΡΟΣ ΤΟΥ ΛΕΞΙΛΟΓΙΟΥ** — τοπικός και **με όνομα**, όπως όλοι οι αδελφοί του.
 *
 * ⚠️ Το ιδίωμα του σπιτιού είναι **ΤΟΠΙΚΟ + ΟΝΟΜΑΣΜΕΝΟ** *(μετρημένο στη Φ4.1: τέσσερις τέτοιοι,
 * **κανένας κεντρικός**)*. ⛔ **Μην γεννήσεις κεντρικό `assertNever`**: η αξία δεν είναι το
 * `throw`, είναι το **μήνυμα** — αυτό λέει *ποια* ερώτηση έμεινε αναπάντητη.
 */
function assertNeverShelfMaterial(material: never): never {
  throw new Error(
    `partitionListingSources: άγνωστο είδος υλικού — ${JSON.stringify(material)}. ` +
      'Νέα τιμή στο LISTING_MATERIAL_KINDS χωρίς απάντηση στο «σε ποιο ΡΑΦΙ ' +
      'δημοσιεύεται;» (ADR-845 Φ4.2β).',
  );
}

/**
 * 🏆 **ΣΕ ΠΟΙΟ ΡΑΦΙ ΚΑΘΕΤΑΙ ΚΑΘΕ ΠΗΓΗ** — **ΕΝΑ** πέρασμα, `switch`, καμία άρνηση.
 *
 * 🔴 **ΔΕΝ ΕΙΝΑΙ ΔΙΠΛΟΤΥΠΟ ΤΟΥ `withPublishedGallery`, ΚΑΙ Η ΔΙΑΚΡΙΣΗ ΕΙΝΑΙ ΠΡΑΓΜΑΤΙΚΗ**: εκείνο
 * ρωτά *«σε ποιο **ΚΟΥΤΙ** του δημόσιου εγγράφου κάθεται αυτό;»*, αυτό ρωτά *«σε ποιο **ΡΑΦΙ**
 * bytes δημοσιεύεται;»*. **Δύο** ερωτήσεις πάνω στο **ίδιο** λεξιλόγιο, και **και οι δύο**
 * εξαντλητικές — γιατί η τρίτη τιμή απέδειξε ότι ένα λεξιλόγιο που μεγαλώνει χρειάζεται
 * απάντηση σε **κάθε** σημείο που το διαβάζει.
 *
 * 🔑 **ΚΑΙ ΓΙ' ΑΥΤΟ Ο `case 'model'` ΤΟΥ `withPublishedGallery` ΜΕΝΕΙ `throw`, ΑΠΡΟΣΠΕΛΑΣΤΟΣ**:
 * αυτή η διαμέριση **δεν του στέλνει ποτέ** μοντέλο. Δεν είναι νεκρός κώδικας — είναι ο
 * **δεύτερος φρουρός**, ακριβώς όπως τον περιγράφει το ίδιο του το σχόλιο.
 *
 * ⛔ **ΠΟΤΕ δύο `filter` με άρνηση.** Δύο ανεξάρτητα κατηγορήματα μπορούν να αφήσουν **κενό**
 * *(καμία πηγή δεν πιάνεται)* **ή** να **διπλογράψουν** *(και τα δύο πιάνουν)*· ένας `switch`
 * δεν μπορεί ούτε το ένα ούτε το άλλο. Είναι η **μετρημένη** κλάση σφάλματος της Φ4.1.
 */
export function partitionListingSources(
  sources: readonly PublicShelfSource<ListingMaterial>[],
): ListingShelfSources {
  const raster: PublicShelfSource<ListingMaterial>[] = [];
  const model: PublicShelfSource<ListingMaterial>[] = [];

  for (const source of sources) {
    const material = source.material;

    switch (material.kind) {
      case 'photo':
      case 'floorplan':
        raster.push(source);
        break;

      case 'model':
        model.push(source);
        break;

      default:
        return assertNeverShelfMaterial(material);
    }
  }

  return { raster, model };
}

// ---------------------------------------------------------------------------
// Η ΑΠΟΣΥΡΣΗ — παράγωγο του πίνακα ειδών, ποτέ λίστα κλήσεων
// ---------------------------------------------------------------------------

/** Ο φρουρός που κάνει **αδύνατο** ένα τρίτο είδος bytes να μείνει χωρίς τρόπο αδειάσματος. */
function assertNeverShelfEncoding(encoding: never): never {
  throw new Error(
    `withdrawListingShelves: άγνωστο είδος κωδικοποίησης — ${JSON.stringify(encoding)}. ` +
      'Νέο σκέλος στο ShelfEncoding χωρίς απάντηση στο «πώς αδειάζει το ράφι του;» ' +
      '(ADR-845 Φ4.2β, άγκυρα Α-8).',
  );
}

/**
 * **Άδειασε το ράφι ΑΥΤΟΥ του είδους** — κενό σύνολο, δηλαδή η **ίδια** πράξη με άλλη τιμή.
 *
 * 🔑 **Δεν είναι «σβήσιμο», και η διάκριση κρατά το συμβόλαιο ενιαίο**: ο γραφέας κάθε είδους
 * έχει **μία** συμπεριφορά *(«κάνε το πρόθεμα ίσο με το επιθυμητό»)*, και η απόσυρση είναι η
 * περίπτωσή της όπου το επιθυμητό είναι **∅**. Γι' αυτό η **επαναφορά** δουλεύει χωρίς τίποτα
 * επιπλέον: ξαναπερνά από εδώ με μη-κενό σύνολο.
 *
 * ⚠️ **Ο ψήστης ΔΕΝ καλείται ποτέ σε αυτή τη διαδρομή**: με κενές πηγές, το κεφάλι του μοντέλου
 * κάνει σάρωση και διαγραφή — **καμία** ανάγνωση bytes, **κανένα** WASM.
 */
async function emptyShelfOfKind(kind: AnyPublicShelfKind, listingId: string): Promise<void> {
  // ⚠️ Η διάκριση γίνεται στην **ΚΩΔΙΚΟΠΟΙΗΣΗ**, ποτέ στη ρίζα — τα δύο είδη της αγγελίας
  //    μοιράζονται ρίζα *(άγκυρα Α-1δ)*. Και είναι `switch` πάνω σε **διακριτή ένωση**, ώστε
  //    το `default` να στενεύει σε `never`: ένα τρίτο σκέλος **δεν μεταγλωττίζεται**.
  const encoding: ShelfEncoding = kind.encoding;

  switch (encoding.kind) {
    case 'raster':
      await reconcilePublicShelf(kind, listingId, []);
      return;

    case 'model':
      await reconcilePublicModelShelf(kind, listingId, []);
      return;

    default:
      return assertNeverShelfEncoding(encoding);
  }
}

/**
 * 🏆 **ΑΔΕΙΑΣΕ ΚΑΘΕ ΡΑΦΙ ΑΥΤΗΣ ΤΗΣ ΑΓΓΕΛΙΑΣ** — η απόσυρση, ολόκληρη.
 *
 * 🔴 **Η ΛΙΣΤΑ ΠΑΡΑΓΕΤΑΙ, ΔΕΝ ΓΡΑΦΕΤΑΙ** — και αυτό είναι όλο το νόημα. Η προηγούμενη εκδοχή
 * *(`reconcileShelfSafely(listingId, [])`)* απαριθμούσε **ένα** ράφι επειδή, τη μέρα που
 * γράφτηκε, υπήρχε ένα. Η μέρα που εμφανίστηκε το δεύτερο **δεν κοκκίνισε τίποτα** — και δεν
 * θα κοκκίνιζε ποτέ, γιατί το τεστ της απόσυρσης ρωτούσε *«άδειασε το ράφι εικόνων;»*, και η
 * απάντηση θα έμενε **ναι**.
 *
 * ⇒ Εδώ η πηγή είναι το **`PUBLIC_SHELF_KINDS`**, φιλτραρισμένο στη ρίζα των αγγελιών. Το
 * ερώτημα *«ξέχασε κανείς ράφι;»* γίνεται **αδύνατο να απαντηθεί λάθος**.
 *
 * ⚠️ **Η ρίζα είναι το κριτήριο, και είναι το ΣΩΣΤΟ**: η βιτρίνα *(`SHOWCASE_SHELF`)* έχει
 * ταυτότητα **εταιρείας**, και ο φρουρός της θα **πετούσε** σε ταυτότητα αγγελίας. Το φίλτρο
 * δεν είναι βολή — είναι η ίδια διάκριση που κάνουν οι δύο **αντίθετοι** φρουροί.
 *
 * ⚠️ **Δεν πετά ποτέ** — κάθε κεφάλι επιστρέφει αποτυχία **ονομαστικά**, και η επανασύνθεση τη
 * διορθώνει. Μια εξαίρεση εδώ θα ακύρωνε την αποθήκευση του κατόχου για αστοχία σε bytes.
 */
export async function withdrawListingShelves(listingId: string): Promise<void> {
  const kinds = PUBLIC_SHELF_KINDS.filter((kind) => kind.root === PUBLIC_SHELF_LISTING_ROOT);

  await Promise.all(kinds.map((kind) => emptyShelfOfKind(kind, listingId)));
}

// ---------------------------------------------------------------------------
// Η ΓΡΑΦΗ
// ---------------------------------------------------------------------------

/**
 * **Η ΓΡΑΦΗ ΠΟΥ ΞΕΡΕΙ ΤΙ ΥΛΙΚΟ ΕΧΕΙ** — διαμέριση, **δύο** συμφιλιώσεις, δέσιμο, `set`,
 * αντιστάθμιση.
 *
 * 🔴 **Η Φ2 έγραφε ρητά «ΜΕΤΑ το `set`, όχι πριν», και η Φ3 το ανέτρεψε — με λόγο.** Το κλειδί
 * κάθε δημοσιευμένου αντικειμένου είναι το **sha256 των παραγόμενων bytes**, δηλαδή τα URL
 * **δεν υπάρχουν** πριν τρέξει η συμφιλίωση.
 *
 * 🏆 **ΚΑΙ Η ΣΕΙΡΑ ΕΙΝΑΙ ΑΥΣΤΗΡΑ ΚΑΛΥΤΕΡΗ, ΟΧΙ ΑΠΛΩΣ ΑΝΑΓΚΑΙΑ**: **και τα δύο** κουτιά
 * χτίζονται **ΑΠΟ ΤΗΝ ΑΝΑΦΟΡΑ** των ραφιών, άρα το έγγραφο είναι **δομικά ανίκανο** να
 * διαφημίσει εικόνα **ή μοντέλο** που δεν κάθεται στον κάδο *(άγκυρα **Α-7**)*. Ό,τι
 * απορρίφθηκε απλώς **δεν μπαίνει** — κανείς δεν χρειάζεται να το θυμηθεί.
 *
 * 🔑 **ΟΙ ΔΥΟ ΣΥΜΦΙΛΙΩΣΕΙΣ ΤΡΕΧΟΥΝ ΠΑΡΑΛΛΗΛΑ, ΚΑΙ ΕΙΝΑΙ ΑΣΦΑΛΕΣ ΔΟΜΙΚΑ**: μοιράζονται πρόθεμα,
 * αλλά ο σβήστης καθεμιάς αγγίζει **μόνο** κλειδιά της **δικής της** κατάληξης — η εγγύηση που
 * **εκτελεί** η άγκυρα Α-1ε. Δεν είναι συμφωνία μεταξύ των δύο· είναι ιδιότητα του κλειδιού.
 *
 * ⚠️ **Ο παλιός φόβος ονομάζεται και αντισταθμίζεται**: bytes δημοσιευμένα για αγγελία που δεν
 * γράφτηκε ποτέ. Αν το `set` αποτύχει, το `catch` **αδειάζει ΚΑΙ ΤΑ ΔΥΟ ράφια**
 * *({@link withdrawListingShelves})*. Και ακόμη κι αν χαθεί κι εκείνη *(κατάρρευση διεργασίας)*,
 * η **επόμενη** συμφιλίωση της ίδιας αγγελίας τα σβήνει: ο σβήστης τρέχει **πάντα**.
 */
export async function writeWithShelf(
  ref: DocumentReference,
  listingId: string,
  listing: PublicListing,
  sources: readonly PublicShelfSource<ListingMaterial>[]
): Promise<void> {
  const { raster, model } = partitionListingSources(sources);

  const [images, models] = await Promise.all([
    reconcilePublicShelf(LISTING_SHELF, listingId, raster),
    reconcilePublicModelShelf(LISTING_MODEL_SHELF, listingId, model),
  ]);

  if (images.outcome === 'failed') {
    logger.error('Το ράφι ΕΙΚΟΝΩΝ δεν συμφιλιώθηκε — η αγγελία γράφεται ΧΩΡΙΣ εικόνες', {
      propertyId: listingId,
    });
  }
  if (models.outcome === 'failed') {
    logger.error('Το ράφι ΜΟΝΤΕΛΩΝ δεν συμφιλιώθηκε — η αγγελία γράφεται ΧΩΡΙΣ μοντέλα', {
      propertyId: listingId,
    });
  }

  try {
    // 🔑 **ΕΝΑ `set`, ΔΥΟ ΓΡΑΦΕΙΣ ΣΕ ΣΥΝΘΕΣΗ.** Ο ένας δένει συλλογή+κατόψεις, ο άλλος τα
    //    μοντέλα — και το έγγραφο φεύγει **ολόκληρο**, ποτέ ως δύο μερικές ενημερώσεις.
    const withGallery = withPublishedGallery(listing, images.published.map(toProjectedImage));
    const withModels = withPublishedModels(withGallery, models.published.map(toProjectedModel));

    await ref.set({ ...withModels, schemaVersion: PUBLIC_LISTING_SCHEMA_VERSION });
  } catch (error) {
    await withdrawShelvesAfterFailure(
      listingId,
      images.published.length + models.published.length,
    );
    throw error;
  }
}

/**
 * **Ό,τι είδε το ράφι ΕΙΚΟΝΩΝ, στη γλώσσα της ΚΑΘΑΡΗΣ προβολής** — μία γραμμή μετάφρασης.
 *
 * 🔑 Υπάρχει ώστε η προβολή να μη χρειαστεί ποτέ να εισαγάγει τον τύπο της υπηρεσίας: εκείνη
 * δηλώνει ρητά ότι είναι **καθαρή**, και η υπηρεσία σέρνει `firebase-admin` **και** `sharp`.
 *
 * ⚠️ Το `sources` παίρνει **όλα** τα παράγωγα, όχι μόνο το κανονικό: αυτό ακριβώς είναι το
 * `srcset`, και είναι ο λόγος που η αναφορά τα κρατά **ομαδοποιημένα** (Α2.2).
 */
function toProjectedImage(image: PublicShelfImage<ListingMaterial>): ProjectedShelfImage {
  return {
    url: image.canonical.url,
    width: image.canonical.width,
    height: image.canonical.height,
    sources: image.variants.map((variant) => ({ url: variant.url, width: variant.width })),
    // 🔑 **Ταξιδεύει αυτούσιο, καμία κρίση εδώ** (ADR-841 §7 Α17.4): αυτή η γραμμή είναι
    //    μετάφραση τύπων, όχι σημασιολογία. Ο **ένας** τόπος που ρωτά «κάτοψη ή
    //    φωτογραφία;» είναι το `withPublishedGallery`.
    material: image.material,
  };
}

/**
 * **Ό,τι είδε το ράφι ΜΟΝΤΕΛΩΝ, στη γλώσσα της ΚΑΘΑΡΗΣ προβολής** — ο αδελφός από πάνω.
 *
 * ⚠️ **Το `key` ΔΕΝ ταξιδεύει**: είναι η διεύθυνση **μέσα στον κάδο**, χρήσιμη μόνο στον
 * σβήστη. Στο δημόσιο έγγραφο πηγαίνει το **URL**, και τίποτε άλλο που να μοιάζει με
 * εσωτερικό αναγνωριστικό.
 *
 * 🔑 **Και ΚΑΝΕΝΑ `material`** — δες `PublicShelfModelReport` για το γιατί η ασυμμετρία με τον
 * αδελφό του είναι σωστή: ένα μοντέλο έχει **ένα** κουτί, άρα δεν υπάρχει τι να δρομολογηθεί.
 */
function toProjectedModel(model: PublishedShelfModel): ProjectedShelfModel {
  return { url: model.url, at: model.at };
}

/**
 * **Η ΑΝΤΙΣΤΑΘΜΙΣΗ**: το `set` απέτυχε αφού τα bytes είχαν ήδη δημοσιευτεί.
 *
 * 🔑 **Δεν είναι «καθάρισμα», είναι η ίδια πράξη με άλλη τιμή**: κενό σύνολο ⇒ τα προθέματα
 * αδειάζουν. Κάθε γραφέας εξακολουθεί να έχει **μία** συμπεριφορά.
 *
 * ⚠️ **Δεν πετά ποτέ, και δεν καταπίνει το αρχικό σφάλμα**: ο καλών ξαναρίχνει εκείνο. Μια
 * αποτυχία εδώ θα έκρυβε την αιτία πίσω από το σύμπτωμα.
 */
async function withdrawShelvesAfterFailure(listingId: string, published: number): Promise<void> {
  if (published === 0) return;

  logger.warn('Η προβολή δεν γράφτηκε — αποσύρονται τα bytes που είχαν ήδη δημοσιευτεί', {
    propertyId: listingId,
    published,
  });
  await withdrawListingShelves(listingId);
}
