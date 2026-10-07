/**
 * @fileoverview **Η ΜΝΗΜΗ ΕΝΟΣ ΡΑΦΙΟΥ ΠΟΥ ΔΗΜΟΣΙΕΥΕΙ ΕΝΑ ΑΡΧΕΙΟ ΑΝΑ ΠΗΓΗ** — «ποιο πρωτότυπο, με ποια συνταγή, από πότε;».
 * @related ADR-845 Φ4.2 · ADR-907 §10 · ADR-749 (μία μηχανή) · services/listings/public-shelf-plan
 * @module services/listings/public-shelf-origin
 *
 * 🔴 **ΕΞΗΧΘΗ ΑΠΟ ΤΟ ΚΕΦΑΛΙ ΤΩΝ ΜΟΝΤΕΛΩΝ ΤΗ ΜΕΡΑ ΠΟΥ ΗΡΘΕ ΤΟ ΚΕΦΑΛΙ ΤΩΝ ΒΙΝΤΕΟ** (N.18). Και τα δύο δημοσιεύουν **ένα**
 * αντικείμενο ανά πηγή και ρωτούν τις **ίδιες** τρεις ερωτήσεις πριν αγγίξουν bytes. Ένα δεύτερο σώμα θα ήταν ο
 * sibling clone που το `jscpd` μέτρησε ήδη μία φορά σε αυτό το ράφι (`shelfFailure`).
 *
 * ⚠️ **Το raster κεφάλι ΔΕΝ το χρησιμοποιεί, και είναι σωστό**: εκεί η μνήμη έχει κλειδί το **πλάτος** — μια πηγή
 * είναι **οικογένεια** παραγώγων (`cachedVariants` στο `public-shelf-plan`). Άλλη πληθυντικότητα, άλλη ερώτηση.
 */

import type { File } from '@google-cloud/storage';

import { fileRecordBucket } from '@/server/files/file-record-bucket';
import {
  parsePublicShelfKey,
  type PublicShelfSource,
} from '@/services/upload/utils/storage-path-public-shelf';
import type { AnyPublicShelfKind } from '@/services/upload/utils/public-shelf-kinds';

import { deleteExtra, scanShelfPrefix, uploadMissing, type AnyShelfWrite } from './public-shelf-bucket';
import { META_RECIPE, META_SOURCE_REF, sourceReference } from './public-shelf-plan';

/**
 * **Ό,τι ξέρουμε για το ΠΡΩΤΟΤΥΠΟ** πριν ψηθεί — τα τέσσερα που ταξιδεύουν μαζί.
 *
 * ⚠️ Ομαδοποιημένα **επίτηδες**: ως θέσεις ορισμάτων, τρεις συμβολοσειρές δίπλα-δίπλα θα μπορούσαν να εναλλαχθούν
 * **χωρίς να το δει ο μεταγλωττιστής** — και το αποτέλεσμα θα ήταν μεταδεδομένα που λένε ψέματα σε **μόνιμη** διεύθυνση.
 */
export interface ShelfOrigin {
  readonly subjectId: string;
  readonly sourceRef: string;
  readonly recipe: string;
  /** ISO — το `timeCreated` του **ιδιωτικού** αντικειμένου: *πότε εμφανίστηκαν αυτά τα bytes*, ποτέ *πότε τα πρόβαλα*. */
  readonly at: string;
}

/**
 * **Τα αντικείμενα του προθέματος που είναι ΔΙΚΑ ΜΑΣ** — ο ανεκτικός αναγνώστης, πρώτος.
 *
 * 🔴 Η σάρωση επιστρέφει **ΟΛΟ** το πρόθεμα, δηλαδή και τα αρχεία των **άλλων** ειδών της ίδιας αγγελίας. Η ερώτηση
 * *«είναι δικό μου;»* δεν επιτρέπεται να απαντιέται **κατά τύχη**: ο φρουρός τρέχει **ρητά**, με τον ίδιο κριτή που
 * χρησιμοποιεί ο σβήστης *(άγκυρα **Α-1ε**)*.
 */
export function ownShelfFiles(kind: AnyPublicShelfKind, files: readonly File[]): readonly File[] {
  return files.filter((file) => parsePublicShelfKey(kind, file.name) !== null);
}

/**
 * **Κάθεται ΗΔΗ στο ράφι το παράγωγο αυτής της πηγής;** — το αντικείμενο, ή `null`.
 *
 * ⚠️ Απαιτεί ταύτιση **και** στη συνταγή: αλλαγή σε ό,τι αλλάζει τα bytes **οφείλει** να ακυρώσει τα παλιά, και το
 * `shelfRecipe` είναι παραγόμενο ακριβώς για να μην ξεχαστεί.
 *
 * 🔑 **Η γρήγορη διαδρομή είναι το ΜΙΣΟ της απόδοσης**: η συμφιλίωση τρέχει σε **κάθε αποθήκευση**. Χωρίς αυτήν, μια
 * αποθήκευση **τίτλου** θα ξανάψηνε ένα GLB — ή θα ξαναδιάβαζε **100 MB** βίντεο.
 */
export function cachedShelfFile(own: readonly File[], origin: ShelfOrigin): File | null {
  for (const file of own) {
    const custom = file.metadata.metadata;
    if (custom?.[META_SOURCE_REF] !== origin.sourceRef) continue;
    if (custom[META_RECIPE] !== origin.recipe) continue;

    return file;
  }

  return null;
}

/**
 * **Ό,τι ταυτοποιεί το πρωτότυπο** — ή `null` όταν του λείπει η **στιγμή** του.
 *
 * 🔴 **ΥΠΟΛΟΓΙΖΕΤΑΙ ΠΡΙΝ ΤΗ ΓΡΗΓΟΡΗ ΔΙΑΔΡΟΜΗ**: το `at` χρειάζεται σε **αμφότερα** τα σκέλη. Ένα αρχείο που **δεν
 * ξαναψήνεται** εξακολουθεί να χρειάζεται τη στιγμή του για το `SourcedAttribute` — αλλιώς η επαναδημοσίευση θα έγραφε
 * **άλλη** στιγμή από την πρώτη, για **ταυτόσημα** bytes.
 *
 * ⚠️ **Δέχεται `unknown` για τα δύο πεδία του παρόχου, επίτηδες**: ο τύπος των μεταδεδομένων του GCS αλλάζει ανάμεσα
 * σε εκδόσεις *(`generation` είναι `string | number`)*, και ένας ισχυρισμός εδώ θα ήταν ο τρόπος που ένα `undefined`
 * γίνεται σιωπηλά η συμβολοσειρά `"undefined"` **μέσα σε content-addressed μεταδεδομένο**.
 *
 * ⛔ **Απουσία `timeCreated` ⇒ ΑΡΝΗΣΗ, ποτέ ρολόι διακομιστή** — ο μάντης που το σκέλος της κάτοψης απορρίπτει γραπτώς.
 */
export function shelfOriginOf(
  recipe: string,
  subjectId: string,
  privateStoragePath: string,
  generation: unknown,
  timeCreated: unknown,
): ShelfOrigin | null {
  if (typeof timeCreated !== 'string' || timeCreated.length === 0) return null;

  return {
    subjectId,
    sourceRef: sourceReference(privateStoragePath, String(generation ?? '')),
    recipe,
    at: timeCreated,
  };
}

/**
 * **Κοίτα το πρωτότυπο στον ΙΔΙΩΤΙΚΟ κάδο** — ένα `getMetadata()`, και ό,τι προκύπτει από αυτό: ταυτότητα, στιγμή,
 * και αν το παράγωγό του **κάθεται ήδη** στο ράφι.
 *
 * 🔑 ADR-895 Α2 — ο κάδος της πηγής αποφασίζεται από τη δηλωμένη θέση της (`storagePlacement`)· απόν ⇒ κανονικός.
 * ⚠️ `origin === null` ⇒ το πρωτότυπο δεν έχει στιγμή· ο καλών **αρνείται με όνομα** — εδώ δεν καταγράφεται τίποτα,
 * γιατί το μήνυμα («μοντέλο» ή «βίντεο») είναι του κεφαλιού.
 */
export async function readPrivateOrigin<M>(
  source: PublicShelfSource<M>,
  recipe: string,
  subjectId: string,
  own: readonly File[],
) {
  const path = source.privateStoragePath;
  const original = fileRecordBucket(source).file(path);
  const [meta] = await original.getMetadata();
  const origin = shelfOriginOf(recipe, subjectId, path, meta.generation, meta.timeCreated);

  return { original, meta, origin, hit: origin === null ? null : cachedShelfFile(own, origin) };
}

/** Ό,τι έμαθε ένα κεφάλι για **μία** πηγή — το ελάχιστο που χρειάζεται ο σκελετός. */
export interface AddressedShelfObject {
  readonly key: string;
  /** `null` ⇒ τα bytes **κάθονται ήδη** στο ράφι. */
  readonly upload: AnyShelfWrite | null;
}

/**
 * 🏆 **Ο ΣΚΕΛΕΤΟΣ ΤΗΣ ΣΥΜΦΙΛΙΩΣΗΣ «ΕΝΑ ΑΝΤΙΚΕΙΜΕΝΟ ΑΝΑ ΠΗΓΗ»** — σάρωση, διευθυνσιοδότηση, ανέβασμα, σβήσιμο.
 *
 * 🔑 **Πρώτα το ανέβασμα, μετά το σβήσιμο**: ανάποδα θα υπήρχε παράθυρο όπου το πρόθεμα **δεν έχει ούτε το παλιό ούτε
 * το νέο** — και το ράφι σερβίρει σε **ανώνυμο** επισκέπτη, που δεν έχει σε τι άλλο να πέσει.
 *
 * ⚠️ **Ο σβήστης δέχεται ΟΛΑ τα αρχεία του προθέματος** (`scan.files`): αγγίζει μόνο ό,τι αναγνωρίζει, και η
 * αναγνώριση είναι η δουλειά του *(άγκυρα Α-1ε)*. Προ-φιλτραρισμένο σύνολο θα ήταν **δεύτερος** κριτής ταυτότητας.
 *
 * ⚠️ **ΠΕΤΑ** αν ο κάδος αποτύχει — το «δεν πετά ποτέ» είναι συμβόλαιο του **κεφαλιού**, που ξέρει τι μήνυμα να γράψει.
 * Η σειρά του `desired` είναι η σειρά των `sources`.
 */
export async function reconcileOnePerSource<S, A extends AddressedShelfObject>(
  kind: AnyPublicShelfKind,
  subjectId: string,
  sources: readonly S[],
  addressOne: (source: S, own: readonly File[]) => Promise<A | null>,
): Promise<{ readonly desired: readonly A[]; readonly removed: number; readonly rejected: number }> {
  const scan = await scanShelfPrefix(kind, subjectId);
  const own = ownShelfFiles(kind, scan.files);
  const addressed = await Promise.all(sources.map((source) => addressOne(source, own)));
  const desired = addressed.filter((object): object is Awaited<A> => object !== null);
  const uploads = desired
    .map((object) => object.upload)
    .filter((upload): upload is AnyShelfWrite => upload !== null);

  await uploadMissing(scan.bucket, uploads, scan.keys);
  const removed = await deleteExtra(kind, scan.files, new Set(desired.map((object) => object.key)));

  return { desired, removed, rejected: addressed.length - desired.length };
}
