/**
 * @fileoverview 🏆 **ΤΟ ΔΕΥΤΕΡΟ ΚΕΦΑΛΙ ΤΟΥ ΡΑΦΙΟΥ** — συμφιλίωση **μοντέλων**, με τον ίδιο πυρήνα κάδου.
 * @related ADR-845 §6.2 (Ε-2) · §8 (Α-3…Α-7) · ADR-841 §7 Α12 (.6 · .7) · ADR-749 (μία μηχανή)
 * @module services/listings/public-shelf-model.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΟ ΣΥΜΒΟΛΑΙΟ — **ΤΑΥΤΟΣΗΜΟ** ΜΕ ΤΟΝ RASTER ΑΔΕΛΦΟ, ΓΡΑΜΜΗ ΠΡΟΣ ΓΡΑΜΜΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 *   επιθυμητό σύνολο  ⇒ το πρόθεμα γίνεται **ακριβώς** αυτό
 *   κενό σύνολο       ⇒ το πρόθεμα **αδειάζει**            (η απόσυρση ΣΥΜΒΑΙΝΕΙ)
 *   αποτυχία          ⇒ **ονομαστική**, ποτέ `throw`       (η αγγελία γράφεται ούτως ή άλλως)
 *
 * 🔴 **ΚΑΙ Ο ΚΑΔΟΣ ΕΙΝΑΙ ΚΥΡΙΟΛΕΚΤΙΚΑ Ο ΙΔΙΟΣ ΚΩΔΙΚΑΣ** *(`./public-shelf-bucket`)*. Δεν είναι
 * ευγένεια προς το ADR-749: τα δύο είδη **μοιράζονται πρόθεμα** *(`listings/<id>/`)*, άρα δύο
 * αντίγραφα του σβήστη θα ήταν δύο μηχανές που σβήνουν **στο ίδιο μέρος**. Η μέρα που θα
 * απέκλιναν δεν θα έδινε σφάλμα μεταγλώττισης — θα έδινε **δημοσιευμένα bytes που δεν σβήνονται
 * ποτέ**, δηλαδή την Α12.6 ανάποδα.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙ ΑΛΛΑΖΕΙ, ΚΑΙ ΕΙΝΑΙ **ΜΟΝΟ** Η ΠΑΡΑΓΩΓΗ ΤΟΥ ΕΠΙΘΥΜΗΤΟΥ ΣΥΝΟΛΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | | raster | **μοντέλο** |
 * |---|---|---|
 * | παράγωγα ανά πηγή | **οικογένεια** ανά πλάτος | **ΕΝΑ** *(τα LOD ζουν **μέσα** στο GLB)* |
 * | καθαριστής | `sharp` | `bakeModel` *(gltf-transform)* |
 * | γρήγορη διαδρομή | *«υπάρχουν ΟΛΑ τα πλάτη;»* | *«υπάρχει **το** αρχείο;»* |
 * | δήλωση | — | **Α11 + Α10 + λογιστική**, από τα μεταδεδομένα του πρωτοτύπου |
 *
 * ⇒ Γι' αυτό **δεν** δρομολογήθηκε μέσα στο `reconcilePublicShelf`: το `PublicShelfReport<M>`
 * κουβαλά `canonical`/`variants`/`width`/`height` — **raster από άκρη σε άκρη**. Ένα μοντέλο
 * εκεί μέσα θα χρειαζόταν `width: 0`, που είναι **ακριβώς** το *«ψέμα σχήματος»* για το οποίο
 * το ADR-845 §7.3 απέρριψε γραπτώς το `ListingImage` ως δοχείο του `PublishedModelFile`.
 *
 * 🔴 **Η ΔΙΕΥΘΥΝΣΗ ΓΕΝΝΙΕΤΑΙ ΑΠΟ ΤΗΝ ΕΞΟΔΟ ΤΟΥ ΨΗΣΤΗ, ΠΟΤΕ ΑΠΟ ΤΗΝ ΕΙΣΟΔΟ** *(Α12.7)*: το
 * κλειδί είναι το **sha256 των bytes ΠΟΥ ΠΑΡΗΓΑΓΕ Ο ΔΙΑΚΟΜΙΣΤΗΣ** ⇒ *χωρίς ψήσιμο δεν υπάρχει
 * διεύθυνση, χωρίς διεύθυνση δεν υπάρχει δημοσίευση*. Αυτή η γραμμή είναι η μισή **άγκυρα Α-7**·
 * η άλλη μισή ζει στον γραφέα της προβολής, που δέχεται **μόνο** την αναφορά αυτού του αρχείου.
 *
 * ⚠️ **SERVER-ONLY** — σέρνει τον ψήστη, δηλαδή WASM *(`meshoptimizer`, `gltf-validator`)*.
 */

import type { File } from '@google-cloud/storage';

import { GCS_PUBLIC_MEDIA_BUCKET } from '@/config/gcs-buckets';
import { getAdminBucket } from '@/lib/firebaseAdmin';
import {
  MODEL_DECLARATION_METADATA_KEY,
  decodeModelDeclaration,
} from '@/lib/listings/model-declaration-metadata';
import { createModuleLogger } from '@/lib/telemetry';
import {
  isModelShelfKind,
  shelfRecipe,
  type AnyPublicShelfKind,
  type ModelShelfKind,
  type PublicShelfKind,
} from '@/services/upload/utils/public-shelf-kinds';
import {
  buildPublicShelfKey,
  parsePublicShelfKey,
  publicShelfUrl,
  shelfExtension,
  type PublicShelfSource,
} from '@/services/upload/utils/storage-path-public-shelf';

import {
  deleteExtra,
  scanShelfPrefix,
  uploadMissing,
  type ShelfWrite,
} from './public-shelf-bucket';
import {
  META_RECIPE,
  META_SOURCE_REF,
  contentAddress,
  sourceReference,
} from './public-shelf-plan';
import {
  ModelBakeError,
  PUBLIC_SHELF_MODEL_CONTENT_TYPE,
  bakeModel,
  type ModelBakeFailure,
} from './public-shelf-model-bake';

const logger = createModuleLogger('public-shelf-model');

// ---------------------------------------------------------------------------
// Τύποι
// ---------------------------------------------------------------------------

/**
 * **Ένα δημοσιευμένο μοντέλο** — και **ΚΑΜΙΑ** `width`/`height`/`sources`.
 *
 * 🔑 Η **απουσία είναι το περιεχόμενο**, ίδια απόφαση με το `ModelShelfKind` που δεν έχει
 * `framingOf`: ένα `srcset` πάνω σε GLB θα υπονοούσε *«διάλεξε παράγωγο ανά πυκνότητα οθόνης»*,
 * ενώ τα επίπεδα λεπτομέρειας ζουν **μέσα** στο ίδιο αρχείο *(`MSFT_lod`)*.
 */
export interface PublishedShelfModel {
  readonly key: string;
  readonly url: string;
  /**
   * 🔴 **ΠΟΤΕ ΤΟ ΕΜΑΘΕ Η ΠΗΓΗ** — ο χρόνος δημιουργίας του **ιδιωτικού** αντικειμένου, ISO.
   *
   * 🔑 **ΓΙΑΤΙ ΤΑΞΙΔΕΥΕΙ ΑΠΟ ΕΔΩ ΚΑΙ ΟΧΙ ΑΠΟ ΤΟ ΥΛΙΚΟ**: το `{ kind:'model' }` είναι **γυμνό
   * επίτηδες**, χωρίς `at` — σε αντίθεση με την κάτοψη, όπου τη στιγμή τη **δηλώνει άνθρωπος**.
   * Το ADR-845 §7.3 το γράφει: *«η στιγμή θα έρθει από το `SourcedAttribute` του δημόσιου
   * σχήματος, **μαζί με τον παραγωγό της Φ4.2**»*. Αυτός είναι ο παραγωγός.
   *
   * ⛔ **ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΤΟ ΡΟΛΟΙ ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ** — τον μάντη που το σκέλος της κάτοψης
   * απορρίπτει γραπτώς. Είναι το `timeCreated` του **ίδιου** αντικειμένου που δίνει τα bytes:
   * *πότε εμφανίστηκαν αυτά τα bytes*, όχι *πότε τα πρόβαλα*. Ακριβώς το ανάλογο του
   * `uploadedAt` που τρέφει την κάτοψη.
   */
  readonly at: string;
}

/**
 * Τι έκανε η συμφιλίωση — ρητά, ώστε ο καλών να **μετρήσει**.
 *
 * 🔴 **ΔΕΝ ΕΙΝΑΙ ΓΕΝΙΚΟΣ, ΣΕ ΑΝΤΙΘΕΣΗ ΜΕ ΤΟΝ RASTER ΑΔΕΛΦΟ — ΚΑΙ Η ΑΣΥΜΜΕΤΡΙΑ ΕΧΕΙ ΛΟΓΟ.**
 * Το `PublicShelfImage<M>` κουβαλά το **υλικό** επειδή υπάρχει καταναλωτής που το **διαβάζει**:
 * ο `withPublishedGallery` ρωτά *«φωτογραφία ή κάτοψη;»* και δρομολογεί σε **δύο** κουτιά. Το
 * μοντέλο έχει **ένα** κουτί και **ένα** γυμνό υλικό *(`{ kind:'model' }`, χωρίς πεδία)* — δεν
 * υπάρχει ερώτηση να απαντηθεί.
 *
 * ⇒ Ένα `material` εδώ θα ήταν **πεδίο που γράφεται και δεν διαβάζεται ποτέ** — ακριβώς αυτό
 * που το ADR-845 §7.3 απέρριψε γραπτώς για τα πεδία του `PublishedModelFile`. Η **δέσμευση**
 * λεξιλογίου⇄είδους *(Στάδιο 2)* παραμένει, γιατί ζει στην **ΕΙΣΟΔΟ**: το
 * {@link reconcilePublicModelShelf} είναι γενικό στο `M` και **αδυνατεί να μεταγλωττιστεί** αν
 * το είδος δεν ταιριάζει με τις πηγές. Η εγγύηση είναι στην πόρτα, όχι στην έξοδο.
 */
export interface PublicShelfModelReport {
  readonly outcome: 'reconciled' | 'failed';
  readonly published: readonly PublishedShelfModel[];
  readonly removed: number;
  /** Πόσες πηγές **δεν** έγιναν δημοσιεύσιμες — άκυρο glTF, διαφωνία λογιστικής, ταβάνι… */
  readonly rejected: number;
}

/**
 * 🔴 **ΓΙΑΤΙ ΜΙΑ ΠΗΓΗ ΔΕΝ ΕΓΙΝΕ ΔΗΜΟΣΙΕΥΣΙΜΗ — ΕΝΑ ΟΝΟΜΑ ΑΝΑ ΑΙΤΙΑ.**
 *
 * ⛔ **ΤΑ ΔΥΟ ΕΠΙΠΛΕΟΝ ΟΝΟΜΑΤΑ ΔΕΝ ΜΠΗΚΑΝ ΣΤΟΝ ΨΗΣΤΗ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ.** Ο πειρασμός ήταν να
 * επεκταθεί το {@link ModelBakeFailure} — αλλά ο ψήστης δεν μπορεί **ποτέ** να τα παραγάγει:
 * όταν τον καλούμε, τα bytes **έχουν ήδη διαβαστεί** και η δήλωση **υπάρχει**. Ένα όνομα στο
 * λεξιλόγιό του που ο ίδιος δεν εκπέμπει είναι *«πεδίο που γράφεται και δεν διαβάζεται ποτέ»*,
 * ανάποδα.
 *
 * ⛔ **ΚΑΙ ΔΕΝ ΔΑΝΕΙΣΤΗΚΕ ΤΟ `'missing-state-mark'` ΓΙΑ ΤΗ ΛΕΙΠΟΥΣΑ ΔΗΛΩΣΗ**, όσο κι αν
 * μεταγλωττιζόταν: *«δεν υπάρχει δήλωση»* και *«η δήλωση δεν έχει σήμανση»* είναι **δύο
 * διαφορετικά προβλήματα με δύο διαφορετικές θεραπείες**, και το ADR-844 §1 λέει ρητά ότι ο
 * άνθρωπος πρέπει να μαθαίνει **ποια** ερώτηση απαντήθηκε «όχι».
 *
 * ⇒ Το σύνορο **αυτού** του αρχείου ρωτά **δύο δικές του** ερωτήσεις *(«διαβάζεται το
 * πρωτότυπο;»· «κουβαλά δήλωση;»)*, και τις ονομάζει **εδώ**.
 */
type ModelSourceRefusal =
  | ModelBakeFailure
  | 'missing-declaration'
  | 'undated-source'
  | 'unreadable-source';

/** Κλειδί και διεύθυνση — το ελάχιστο που χρειάζεται και ο σβήστης και η προβολή. */
interface PublicShelfObjectRef {
  readonly key: string;
  readonly url: string;
}

/**
 * **Ό,τι ξέρουμε για το ΠΡΩΤΟΤΥΠΟ** πριν ψηθεί — τα τέσσερα που ταξιδεύουν μαζί.
 *
 * ⚠️ Ομαδοποιημένα **επίτηδες**: ως έξι θέσεις ορισμάτων, δύο συμβολοσειρές δίπλα-δίπλα
 * *(`sourceRef`, `recipe`, `at`)* θα μπορούσαν να εναλλαχθούν **χωρίς να το δει ο
 * μεταγλωττιστής** — και το αποτέλεσμα θα ήταν μεταδεδομένα που λένε ψέματα σε **μόνιμη**
 * διεύθυνση.
 */
interface ModelOrigin {
  readonly subjectId: string;
  readonly sourceRef: string;
  readonly recipe: string;
  readonly at: string;
}

/** Ό,τι έμαθε η συμφιλίωση για **μία** πηγή. */
interface AddressedModel {
  readonly key: string;
  readonly url: string;
  readonly at: string;
  /** `null` ⇒ τα bytes **κάθονται ήδη** στο ράφι· δεν κατέβηκε και δεν ψήθηκε τίποτα. */
  readonly upload: ShelfWrite | null;
}

// ---------------------------------------------------------------------------
// Η μνήμη του ραφιού — τι υπάρχει ήδη, και από ποιο πρωτότυπο
// ---------------------------------------------------------------------------

/**
 * **Τα αντικείμενα του προθέματος που είναι ΔΙΚΑ ΜΑΣ** — ο ανεκτικός αναγνώστης, πρώτος.
 *
 * 🔴 Η σάρωση επιστρέφει **ΟΛΟ** το πρόθεμα, δηλαδή **και** τα `.webp` της ίδιας αγγελίας. Ένα
 * `.webp` δεν πρόκειται ποτέ να ταιριάξει σε `sourceRef` μοντέλου *(διαφορετικό ιδιωτικό
 * μονοπάτι ⇒ διαφορετικό hash)*, αλλά η ερώτηση *«είναι δικό μου;»* δεν επιτρέπεται να
 * απαντιέται **κατά τύχη**: ο φρουρός τρέχει **ρητά**, με τον ίδιο κριτή που χρησιμοποιεί ο
 * σβήστης *(άγκυρα **Α-1ε**)*.
 */
function ownKeys(kind: AnyPublicShelfKind, files: readonly File[]): readonly File[] {
  return files.filter((file) => parsePublicShelfKey(kind, file.name) !== null);
}

/**
 * **Κάθεται ΗΔΗ στο ράφι το ψημένο αυτής της πηγής;** — `null` αν όχι.
 *
 * ⚠️ Απαιτεί ταύτιση **και** στη συνταγή, για τον **ίδιο** λόγο που την απαιτεί το
 * `cachedVariants`: αλλαγή στα bits κβάντισης ή στο επίπεδο meshopt **οφείλει** να ακυρώσει τα
 * παλιά bytes, και το {@link shelfRecipe} είναι παραγόμενο ακριβώς για να μην ξεχαστεί.
 *
 * 🔑 **Η γρήγορη διαδρομή είναι το ΜΙΣΟ της απόδοσης αυτής της φάσης**: η συμφιλίωση τρέχει σε
 * **κάθε αποθήκευση** του κατόχου, και ένα ψήσιμο GLB είναι WASM + πλήρης ανακατασκευή αρχείου.
 * Χωρίς αυτήν, μια αποθήκευση **τίτλου** θα ξανάψηνε το μοντέλο.
 */
function cachedModel(
  own: readonly File[],
  sourceRef: string,
  recipe: string,
): PublicShelfObjectRef | null {
  for (const file of own) {
    const custom = file.metadata.metadata;
    if (custom?.[META_SOURCE_REF] !== sourceRef) continue;
    if (custom[META_RECIPE] !== recipe) continue;

    return { key: file.name, url: publicShelfUrl(GCS_PUBLIC_MEDIA_BUCKET, file.name) };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Παραγωγή του επιθυμητού συνόλου
// ---------------------------------------------------------------------------

/**
 * Διαβάζει ένα υποψήφιο GLB από τον **ιδιωτικό** κάδο, το **ψήνει**, και το διευθυνσιοδοτεί.
 *
 * Επιστρέφει `null` όταν η πηγή **δεν γίνεται δημοσιεύσιμη** — και ο λόγος γράφεται
 * **ονομαστικά**: ένα χαλασμένο ή αδήλωτο μοντέλο δεν εμποδίζει τη δημοσίευση των υπολοίπων,
 * αλλά μετριέται *(`rejected`)* ώστε να μη χαθεί σιωπηλά. Ίδιο συμβόλαιο με το `addressOne`.
 *
 * 🔴 **Η ΔΗΛΩΣΗ ΔΙΑΒΑΖΕΤΑΙ ΑΠΟ ΤΑ ΜΕΤΑΔΕΔΟΜΕΝΑ ΤΟΥ ΙΔΙΟΥ ΑΝΤΙΚΕΙΜΕΝΟΥ** — στην **ίδια** κλήση
 * `getMetadata()` που δίνει τη γενιά. Bytes και δήλωση **δεν μπορούν** να διαχωριστούν, και η
 * `PublicShelfSource` μένει *«μονοπάτι, ποτέ bytes»* **ανέπαφη** *(Α12.7)*.
 */
async function bakeOne<M>(
  kind: ModelShelfKind<M>,
  subjectId: string,
  source: PublicShelfSource<M>,
  own: readonly File[],
): Promise<AddressedModel | null> {
  try {
    const original = getAdminBucket().file(source.privateStoragePath);
    const [meta] = await original.getMetadata();
    const sourceRef = sourceReference(source.privateStoragePath, String(meta.generation ?? ''));
    const recipe = shelfRecipe(kind.encoding);

    // 🔴 **ΠΡΙΝ από τη γρήγορη διαδρομή**, γιατί το `at` χρειάζεται και στα δύο σκέλη: ένα
    //    μοντέλο που **δεν ξαναψήνεται** εξακολουθεί να χρειάζεται τη στιγμή του για το
    //    `SourcedAttribute`. Χωρίς αυτό, η επαναδημοσίευση θα έγραφε **άλλη** στιγμή από την
    //    πρώτη, για **ταυτόσημα** bytes.
    const at = typeof meta.timeCreated === 'string' ? meta.timeCreated : null;
    if (at === null) {
      return refuse(subjectId, source.privateStoragePath, 'undated-source', 'no timeCreated');
    }

    const hit = cachedModel(own, sourceRef, recipe);
    if (hit !== null) return { ...hit, at, upload: null };

    const declaration = decodeModelDeclaration(meta.metadata?.[MODEL_DECLARATION_METADATA_KEY]);
    if (declaration === null) {
      // ⚠️ **Πρόωρη επιστροφή, ΟΧΙ εξαίρεση**: αυτή είναι ερώτηση **αυτού** του συνόρου, και
      //    μια εξαίρεση θα την ανάγκαζε να δανειστεί όνομα από το λεξιλόγιο του ψήστη.
      return refuse(subjectId, source.privateStoragePath, 'missing-declaration', 'no readable declaration');
    }

    const [raw] = await original.download();
    const baked = await bakeModel(raw, kind.encoding, declaration);
    return toUpload(kind, { subjectId, sourceRef, recipe, at }, baked.bytes);
  } catch (error) {
    const failure: ModelSourceRefusal =
      error instanceof ModelBakeError ? error.failure : 'unreadable-source';

    return refuse(
      subjectId,
      source.privateStoragePath,
      failure,
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * **Η ΜΙΑ διατύπωση της άρνησης** — ώστε να μη γραφτεί σε κάθε κλάδο ξανά.
 *
 * 🔑 Επιστρέφει `null` *(τον τύπο που ήδη σημαίνει «δεν δημοσιεύεται»)*, ώστε ο καλών να
 * **μη μπορεί** να αρνηθεί χωρίς να ονομάσει: η καταγραφή και η επιστροφή είναι **μία** πράξη.
 *
 * ⚠️ Μήνυμα **αρχείου καταγραφής**, όχι οθόνης — ο N.11 εξαιρεί ρητά τα `logger.*`. Η ανθρώπινη
 * διατύπωση αυτών των πέντε+δύο ονομάτων ανήκει στη **Φ4.3**.
 */
function refuse(
  subjectId: string,
  privateStoragePath: string,
  failure: ModelSourceRefusal,
  detail: string,
): null {
  logger.warn('Μοντέλο ΔΕΝ δημοσιεύεται — ονομασμένη άρνηση', {
    subjectId,
    privateStoragePath,
    failure,
    detail,
  });
  return null;
}

/** **Ψημένα bytes → διεύθυνση + εγγραφή**, με τα δύο μεταδεδομένα που κρατούν τη μνήμη. */
function toUpload(
  // ⚠️ `unknown` και όχι γενικό: το `ModelShelfKind<M>` **δεν χρησιμοποιεί** το `M` σε κανένα
  //    μέλος του *(είναι φάντασμα, δεμένο στην είσοδο του δημόσιου σημείου)*. Ένα γενικό εδώ
  //    θα υποσχόταν δέσμευση που αυτή η συνάρτηση δεν κάνει.
  kind: ModelShelfKind<unknown>,
  origin: ModelOrigin,
  bytes: Buffer,
): AddressedModel {
  const key = buildPublicShelfKey(kind, {
    subjectId: origin.subjectId,
    contentHash: contentAddress(bytes),
    ext: shelfExtension(kind.encoding),
  });

  return {
    key,
    url: publicShelfUrl(GCS_PUBLIC_MEDIA_BUCKET, key),
    at: origin.at,
    // ⚠️ **ΔΥΟ μεταδεδομένα, όχι πέντε** — και τα ονόματα είναι τα **ΙΔΙΑ** με του raster
    //    *(`META_SOURCE_REF`/`META_RECIPE`)*, γιατί απαντούν την **ίδια** ερώτηση: *«ποιο
    //    πρωτότυπο, με ποια συνταγή;»*. Τα τρία που λείπουν είναι **ειδικά του pixel** — δες
    //    το `toShelfWrite`, όπου ζουν μαζί με τον μοναδικό αναγνώστη τους.
    upload: {
      key,
      bytes,
      contentType: PUBLIC_SHELF_MODEL_CONTENT_TYPE,
      metadata: { [META_SOURCE_REF]: origin.sourceRef, [META_RECIPE]: origin.recipe },
    },
  };
}

// ---------------------------------------------------------------------------
// Η μία δημόσια είσοδος
// ---------------------------------------------------------------------------

/**
 * **Κάνε το ράφι ΜΟΝΤΕΛΩΝ αυτού του υποκειμένου ΑΚΡΙΒΩΣ ίσο με το επιθυμητό σύνολο.**
 *
 * 🔴 **Ο ΦΡΟΥΡΟΣ ΕΙΝΑΙ ΚΑΤΑΦΑΤΙΚΟΣ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΣΤΙΛ** *(Φ4.1, μετρημένο)*: ένα
 * `!isRasterShelfKind(kind)` θα σήμαινε *«μοντέλο»* σήμερα και *«μοντέλο ή point-cloud ή
 * βίντεο»* την επόμενη φορά, **χωρίς να κοκκινίσει τίποτα** — άρνηση πάνω σε λεξιλόγιο που
 * μεγαλώνει είναι **δομικά** λάθος.
 *
 * ⚠️ **Δεν πετά ποτέ** — ίδιο συμβόλαιο με τον raster αδελφό: η αποτυχία του ραφιού **δεν**
 * ακυρώνει την αποθήκευση του κατόχου, επιστρέφεται **ονομαστικά**, και η επανασύνθεση τη
 * διορθώνει.
 *
 * 🔑 **Η σειρά του `published` είναι η σειρά των `sources`** — δηλαδή η σειρά που **δήλωσε** ο
 * άνθρωπος *(Α2.1)*. Καμία ταξινόμηση εδώ.
 */
export async function reconcilePublicModelShelf<M>(
  kind: PublicShelfKind<M>,
  subjectId: string,
  sources: readonly PublicShelfSource<M>[],
): Promise<PublicShelfModelReport> {
  if (!isModelShelfKind(kind)) {
    logger.error('Αυτό το κεφάλι δημοσιεύει ΜΟΝΟ μοντέλα — η γραμμή δεν είναι μοντέλου', {
      root: kind.root,
      subjectId,
      encoding: kind.encoding.kind,
    });
    return { outcome: 'failed', published: [], removed: 0, rejected: sources.length };
  }

  try {
    const scan = await scanShelfPrefix(kind, subjectId);
    const own = ownKeys(kind, scan.files);
    const addressed = await Promise.all(
      sources.map((source) => bakeOne(kind, subjectId, source, own)),
    );
    const desired = addressed.filter((model): model is AddressedModel => model !== null);

    const desiredKeys = new Set(desired.map((model) => model.key));
    const uploads = desired
      .map((model) => model.upload)
      .filter((upload): upload is ShelfWrite => upload !== null);

    await uploadMissing(scan.bucket, uploads, scan.keys);
    const removed = await deleteExtra(kind, scan.files, desiredKeys);

    return {
      outcome: 'reconciled',
      published: desired.map(({ key, url, at }) => ({ key, url, at })),
      removed,
      rejected: addressed.length - desired.length,
    };
  } catch (error) {
    logger.error('Το ράφι ΜΟΝΤΕΛΩΝ ΔΕΝ συμφιλιώθηκε — μένει ΜΠΑΓΙΑΤΙΚΟ ως την επανασύνθεση', {
      root: kind.root,
      subjectId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { outcome: 'failed', published: [], removed: 0, rejected: 0 };
  }
}
