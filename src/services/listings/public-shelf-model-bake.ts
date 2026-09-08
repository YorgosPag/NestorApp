/**
 * @fileoverview 🏆 **Ο ΨΗΣΤΗΣ ΤΟΥ ΜΟΝΤΕΛΟΥ** — τα bytes που φεύγουν στον κόσμο (ADR-845 §6.2).
 * @related ADR-845 §6.2 (Ε-2) · §8 (Α-3 · Α-4 · Α-5 · Α-6) · ADR-841 §7 Α3 · Α10 · Α11 · Α12.7
 * @module services/listings/public-shelf-model-bake
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΑΔΕΛΦΟ MODULE ΤΟΥ `public-shelf-sanitise`, **ΠΟΤΕ ΚΛΑΔΟΣ ΤΟΥ** — γραμμένη εντολή
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `public-shelf-sanitise.ts` το γράφει ρητά: *«Ο ΚΑΘΑΡΙΣΤΗΣ ΜΟΝΤΕΛΟΥ ΘΑ ΕΙΝΑΙ ΑΔΕΛΦΟ
 * MODULE, ΠΟΤΕ ΚΛΑΔΟΣ ΕΔΩ»* — το `sharp` είναι **εγγενές**, και ένας ψήστης `glb` στο ίδιο
 * αρχείο θα το έσερνε μαζί του σε **κάθε** διαδρομή που τον φορτώνει, για μηδέν λόγο.
 * Δύο υλικά με **καμία** κοινή πράξη δεν μοιράζονται module επειδή απαντούν στην ίδια ερώτηση.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΤΟ ΞΑΝΑΓΡΑΨΙΜΟ ΕΙΝΑΙ **ΑΣΦΑΛΕΙΑ**, ΟΧΙ ΒΕΛΤΙΣΤΟΠΟΙΗΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ένα `.glb` που περνά **αυτούσιο** κουβαλά ό,τι έκρυψε μέσα του ο παραγωγός του. Η έρευνα
 * του §6.1 το ονομάζει: *«3D files … are essentially **containers** that can hold various
 * types of data, which makes them attractive vectors for cyber threats»*, με
 * **steganographic malware σε υφές** ως ονομασμένο διάνυσμα.
 *
 * ⇒ Το `gltf-transform` **αποδομεί και ξαναχτίζει** το αρχείο: ό,τι δεν ανήκει σε γνωστό
 * `accessor` / `bufferView` / `image` **δεν επιβιώνει**. Είναι **κατά γράμμα** το ίδιο
 * επιχείρημα με το `sharp` για τις εικόνες: *η αποκωδικοποίηση-και-επανακωδικοποίηση **ΕΙΝΑΙ**
 * ο καθαρισμός*.
 *
 * 🔑 **ΚΑΙ Η ΔΙΕΥΘΥΝΣΗ ΓΕΝΝΙΕΤΑΙ ΑΠΟ ΤΗΝ ΕΞΟΔΟ ΤΟΥ, ΟΧΙ ΑΠΟ ΤΗΝ ΕΙΣΟΔΟ** *(Α12.7,
 * επεκταμένη αυτούσια)*: το κλειδί του ραφιού είναι το **sha256 των bytes ΠΟΥ ΠΑΡΗΓΑΓΕ Ο
 * ΔΙΑΚΟΜΙΣΤΗΣ** ⇒ *χωρίς ψήσιμο δεν υπάρχει διεύθυνση, χωρίς διεύθυνση δεν υπάρχει
 * δημοσίευση*. Ένας μελλοντικός γραφέας που θα «ξεχνούσε» το ψήσιμο δεν θα δημοσίευε ωμό
 * μοντέλο — **δεν θα είχε κλειδί**.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⚠️ Η ΣΕΙΡΑ ΕΙΝΑΙ ΜΗΧΑΝΙΣΜΟΣ, ΟΧΙ ΤΑΞΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * ① κριτής glTF → ② **λογιστική** → ③ σήμανση+υπογραφή → ④ κβάντιση+meshopt → ⑤ ταβάνι.
 *
 * 🔴 **Η ΛΟΓΙΣΤΙΚΗ ΤΡΕΧΕΙ ΠΡΙΝ ΤΟ ΨΗΣΙΜΟ, ΚΑΙ ΑΝ ΤΡΕΧΕ ΜΕΤΑ ΘΑ ΑΠΕΡΡΙΠΤΕ ΤΑ ΠΑΝΤΑ**: η
 * κβάντιση θέσης στα 14 bit δίνει βήμα ~6 mm σε κτίριο 100 m — **δεκαπλάσιο** από την ανοχή
 * μήκους του κριτή *(1 mm)*. Ο κριτής ρωτά *«είναι αυτό που στάλθηκε;»*, ερώτηση για τα
 * bytes **που παρελήφθησαν**· το ψήσιμο τρέχει **αφού** η απάντηση είναι ναι.
 *
 * ⚠️ **SERVER-ONLY**: το `gltf-validator` και το `meshoptimizer` είναι WASM/Node. Καμία
 * εισαγωγή από πελάτη.
 */

import type { Document } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, prune, quantize, reorder, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

import { createModuleLogger } from '@/lib/telemetry';
import {
  compareModelLedger,
  hasSignatory,
  isModelStateMark,
  type ModelPublicationDeclaration,
} from '@/lib/listings/listing-model-declaration';
import type { ModelShelfEncoding } from '@/services/upload/utils/public-shelf-encoding';

import { MemoryIO } from './gltf-memory-io';
import { measureModelLedger } from './gltf-model-measure';

const logger = createModuleLogger('public-shelf-model-bake');

/** Ο τύπος περιεχομένου που δηλώνει ο γραφέας για ένα δημοσιευμένο μοντέλο. */
export const PUBLIC_SHELF_MODEL_CONTENT_TYPE = 'model/gltf-binary';

/**
 * 🔴 **ΤΟ ΤΑΒΑΝΙ ΤΩΝ 5 MB — ΑΡΙΘΜΟΣ ΜΕ ΠΗΓΗ, ΚΑΙ Η ΑΓΚΥΡΑ Α-5.**
 *
 * *«Στόχος: GLB **< 5 MB** ανά ακίνητο για κατανάλωση σε κινητό»* — ADR-841 §6.5, με πηγή.
 *
 * ⛔ **ΔΕΝ ζει μέσα στο {@link ModelShelfEncoding}, και είναι απόφαση**: η κωδικοποίηση
 * γίνεται `shelfRecipe`, δηλαδή **ταυτότητα των bytes**. Ένα ταβάνι μέσα εκεί θα ακύρωνε
 * **κάθε δημοσιευμένο μοντέλο** την ημέρα που κάποιος το πείραζε, για **ταυτόσημα** bytes.
 * Είναι κριτήριο **αποδοχής**, όχι κωδικοποίησης.
 *
 * ⚠️ **Το επιβάλλει ΜΟΝΟ ο διακομιστής, ΜΕΤΑ το meshopt** *(§6.2.2)*: ένα όριο στον πελάτη
 * θα ήταν **ευχή** — δεν ξέρει τι θα απομείνει μετά τη συμπίεση, και δεν είναι αυτός που
 * πληρώνει το egress.
 */
export const PUBLIC_SHELF_MODEL_MAX_BYTES = 5 * 1024 * 1024;

/** Γιατί ένα μοντέλο **δεν** μπόρεσε να γίνει δημοσιεύσιμο — **ένα όνομα ανά αιτία**. */
export type ModelBakeFailure =
  | 'invalid-gltf'
  | 'ledger-disagreement'
  | 'missing-state-mark'
  | 'missing-signatory'
  | 'too-large';

export class ModelBakeError extends Error {
  constructor(
    readonly failure: ModelBakeFailure,
    message: string,
  ) {
    super(message);
    this.name = 'ModelBakeError';
  }
}

/** Τα ψημένα bytes, όπως θα τα δει ο κόσμος. */
export interface BakedModel {
  readonly bytes: Buffer;
  readonly contentType: typeof PUBLIC_SHELF_MODEL_CONTENT_TYPE;
}

/**
 * 🏆 **Η ΣΗΜΑΝΣΗ ΨΗΝΕΤΑΙ ΣΤΟ ΑΡΧΕΙΟ** (Α11.2 · άγκυρες Α-3 και Α-4).
 *
 * 🔑 **`asset.extras` και όχι δικό μας extension**: το `extras` είναι **προβλεπόμενο από το
 * πρότυπο** και **επιβιώνει** κάθε συμμορφούμενο εργαλείο· ένα `NESTOR_provenance` extension
 * θα ήταν άγνωστο, δηλαδή το πρώτο πράγμα που θα πετούσε ο επόμενος βελτιστοποιητής.
 *
 * ⚠️ **Γράφεται ΜΕΤΑ το `prune`**, ώστε να μην μπορεί να το θεωρήσει αχρησιμοποίητο.
 */
function bakeProvenance(document: Document, declaration: ModelPublicationDeclaration): void {
  const asset = document.getRoot().getAsset();
  asset.extras = {
    ...(asset.extras ?? {}),
    nestorState: declaration.state,
    nestorSignatory: declaration.signatory.name.trim(),
    nestorSignatoryDiscipline: declaration.signatory.discipline.trim(),
    nestorStudiedAt: declaration.signatory.studiedAt,
  };
}

/**
 * **Ο ανθρώπινος λόγος της διαφωνίας** — ποτέ «κάτι πήγε στραβά» *(ADR-844 §1)*.
 *
 * ⚠️ Το μήνυμα είναι **τεχνικό αρχείο καταγραφής**, όχι κείμενο οθόνης: ο N.11 δεν το
 * αφορά *(τα `logger.*` εξαιρούνται ρητά)*. Η ανθρώπινη διατύπωση ανήκει στη **Φ4.3**.
 */
function ledgerOrThrow(
  document: Document,
  declaration: ModelPublicationDeclaration,
): void {
  const measured = measureModelLedger(document);
  const verdict = compareModelLedger(declaration.geometry, measured);
  if (verdict.agrees) return;

  const { disagreement } = verdict;
  const detail =
    disagreement.field === 'geometry'
      ? 'geometry shape does not match the declaration'
      : `${disagreement.field}: declared ${disagreement.declared}, measured ${disagreement.measured}`;

  throw new ModelBakeError(
    'ledger-disagreement',
    `Model ledger disagreement — ${detail} (ADR-845 §6.2.1, anchor Α-6)`,
  );
}

/**
 * **Οι δύο δηλώσεις που ΔΕΝ επιτρέπεται να λείπουν** — άγκυρες Α-3 και Α-4.
 *
 * 🔴 Ελέγχονται **πριν** από κάθε ακριβή πράξη: ένα μοντέλο χωρίς σήμανση κατάστασης ή
 * χωρίς υπογράφοντα **δεν πρόκειται** να δημοσιευτεί, οπότε το να ξοδέψουμε meshopt πάνω
 * του θα ήταν καθαρή σπατάλη — και, χειρότερα, θα άφηνε τον έλεγχο **μετά** το ψήσιμο,
 * όπου κάποιος θα μπορούσε κάποτε να τον προσπεράσει.
 */
function provenanceOrThrow(declaration: ModelPublicationDeclaration): void {
  if (!isModelStateMark(declaration.state)) {
    throw new ModelBakeError(
      'missing-state-mark',
      `Model has no Α11 state mark (ADR-841 §7 Α11, anchor Α-3)`,
    );
  }
  if (!hasSignatory(declaration.signatory)) {
    throw new ModelBakeError(
      'missing-signatory',
      'Model has no declared signatory (ADR-841 §7 Α10, anchor Α-4)',
    );
  }
}

/**
 * **Το ξαναγράψιμο** — ό,τι δεν ανήκει σε γνωστή δομή δεν επιβιώνει, και μετά συμπιέζεται.
 *
 * ⚠️ **Η σειρά είναι της βιβλιοθήκης, όχι δική μας εφεύρεση**: `dedup` → `prune` → `weld` →
 * `reorder` → `quantize`. Το `weld` **πρέπει** να προηγείται της κβάντισης, αλλιώς κολλάει
 * κορυφές που η κβάντιση μόλις έφερε κοντά — δηλαδή αλλοιώνει **τοπολογία** αντί για θόρυβο.
 *
 * 🔴 **ΓΙΑΤΙ ΟΙ ΥΠΟΚΕΙΜΕΝΕΣ ΣΥΝΑΡΤΗΣΕΙΣ ΚΑΙ ΟΧΙ ΤΟ ΕΤΟΙΜΟ `meshopt()`.** Το `meshopt()` είναι
 * *«a thin wrapper around reorder, quantize, and EXTMeshoptCompression»*, και η ίδια η
 * τεκμηρίωση συνιστά τις υποκείμενες *«for more options like quantization bits»*. Εμείς
 * **δηλώνουμε** συγκεκριμένα bits μέσα στη {@link shelfRecipe} — αν τα άφηνε το wrapper στις
 * προεπιλογές του, η συνταγή θα περιέγραφε **άλλα bytes** από όσα παρήχθησαν. Μια συνταγή που
 * λέει ψέματα γίνεται **μόνιμη διεύθυνση** που λέει ψέματα.
 *
 * ⚠️ **`await MeshoptEncoder.ready` ΠΡΙΝ από οτιδήποτε**: ο κωδικοποιητής είναι **WASM** και
 * φορτώνει ασύγχρονα. Χωρίς την αναμονή, η πρώτη κλήση σε ψυχρή διεργασία πετά — δηλαδή
 * αποτυχία που **εξαφανίζεται στη δεύτερη προσπάθεια** και δεν αναπαράγεται ποτέ τοπικά.
 */
async function rewrite(document: Document, encoding: ModelShelfEncoding): Promise<void> {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);

  document.createExtension(KHRMeshQuantization).setRequired(true);
  document
    .createExtension(EXTMeshoptCompression)
    .setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });

  await document.transform(
    dedup(),
    prune(),
    weld(),
    reorder({ encoder: MeshoptEncoder }),
    quantize({
      quantizePosition: encoding.quantise.position,
      quantizeNormal: encoding.quantise.normal,
      quantizeTexcoord: encoding.quantise.texcoord,
    }),
  );
}

/**
 * 🏆 **ΥΠΟΨΗΦΙΟ GLB → ΔΗΜΟΣΙΕΥΣΙΜΑ BYTES**, ή **ονομασμένη άρνηση**.
 *
 * @throws {ModelBakeError} με `failure` που ονομάζει **ποια** ερώτηση απαντήθηκε «όχι».
 */
export async function bakeModel(
  input: Buffer,
  encoding: ModelShelfEncoding,
  declaration: ModelPublicationDeclaration,
): Promise<BakedModel> {
  provenanceOrThrow(declaration);
  await validateOrThrow(input);

  // ⚠️ **Οι εξαρτήσεις δηλώνονται ΡΗΤΑ, και χωρίς αυτές η επέκταση γράφεται ΧΩΡΙΣ ΜΗΧΑΝΗ**:
  //    το `EXTMeshoptCompression` ψάχνει τον κωδικοποιητή στο μητρώο του IO, και η αστοχία
  //    είναι `Cannot read properties of undefined (reading 'encodeGltfBuffer')` — μήνυμα που
  //    δεν ονομάζει τίποτα. Ο **αποκωδικοποιητής** μπαίνει επίσης, γιατί ένα **εισερχόμενο**
  //    GLB επιτρέπεται να είναι ήδη meshopt-συμπιεσμένο· χωρίς αυτόν, τέτοιο αρχείο θα
  //    απορριπτόταν ως «μη αναγνώσιμο» ενώ είναι απολύτως έγκυρο.
  const io = new MemoryIO()
    .registerExtensions([KHRMeshQuantization, EXTMeshoptCompression])
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const document = await readOrThrow(io, input);

  ledgerOrThrow(document, declaration);

  await rewrite(document, encoding);
  bakeProvenance(document, declaration);

  const bytes = Buffer.from(await io.writeBinary(document));
  ceilingOrThrow(bytes.byteLength);

  logger.info('Μοντέλο ψημένο', { inputBytes: input.byteLength, outputBytes: bytes.byteLength });
  return { bytes, contentType: PUBLIC_SHELF_MODEL_CONTENT_TYPE };
}

/**
 * **Χωρά στο ταβάνι;** — η άγκυρα **Α-5**, ως **μία εξαγόμενη απόφαση**.
 *
 * 🔴 **ΕΞΑΓΕΤΑΙ ΕΠΙΤΗΔΕΣ, ΚΑΙ Ο ΛΟΓΟΣ ΕΙΝΑΙ ΕΙΛΙΚΡΙΝΕΙΑ ΓΙΑ ΤΟ ΤΙ ΜΠΟΡΕΙ ΝΑ ΔΟΚΙΜΑΣΤΕΙ.**
 * Ένα μοντέλο που **ξεπερνά** τα 5 MB **μετά** από weld + κβάντιση + meshopt χρειάζεται
 * εκατοντάδες χιλιάδες τρίγωνα — δηλαδή μια άγκυρα που θα έτρεχε λεπτά και θα ήταν η πρώτη
 * που κάποιος θα απενεργοποιούσε. Με εξαγόμενη την **απόφαση**, το όριο ελέγχεται
 * **εκτελώντας το** *(και στις δύο κατευθύνσεις)*, ενώ η ζωντανή διαδρομή δοκιμάζεται στη
 * θετική κατεύθυνση: *«το ψημένο μοντέλο χωράει»*.
 *
 * ⚠️ Το δηλωμένο όριο αυτής της προσέγγισης: **δεν** αποδεικνύει ότι ο {@link bakeModel} τη
 * **καλεί**. Αυτό το φυλά η θετική άγκυρα, που ψήνει αληθινά bytes και μετρά το μέγεθος.
 */
export function ceilingOrThrow(byteLength: number): void {
  if (byteLength <= PUBLIC_SHELF_MODEL_MAX_BYTES) return;

  throw new ModelBakeError(
    'too-large',
    `Baked model is ${byteLength} bytes, over the ${PUBLIC_SHELF_MODEL_MAX_BYTES} ceiling (ADR-841 §6.5, anchor Α-5)`,
  );
}

/**
 * 🏆 **ΕΙΝΑΙ ΕΓΚΥΡΟ glTF;** — ο **επίσημος κριτής της Khronos**, όχι δικός μας (§6.1).
 *
 * 🔑 **Δεν γράφουμε δικό μας validator, και το εύρημα της έρευνας ήταν ακριβώς αυτό**:
 * υπάρχει **επίσημος** *(`glTF-Validator`, Apache-2.0, το ίδιο εργαλείο που τρέχει το
 * Khronos στα δικά του δείγματα)*. Ένας δικός μας θα ήταν **δεύτερη γνώμη για το πρότυπο**,
 * και θα αποκλίνει σε κάθε έκδοση του glTF.
 *
 * ⚠️ **ΔΙΑΦΟΡΕΤΙΚΗ ΕΡΩΤΗΣΗ ΑΠΟ ΤΗ ΛΟΓΙΣΤΙΚΗ, ΚΑΜΙΑ ΕΠΙΚΑΛΥΨΗ** *(§6.2.1)*: εκείνος ρωτά
 * *«είναι έγκυρο glTF;»*, η λογιστική *«είναι **αυτό** που στάλθηκε;»*. Δύο ερωτήσεις, δύο
 * κριτές — ένα αρχείο μπορεί να είναι **τέλεια έγκυρο** και **εντελώς άλλο**.
 *
 * ⚠️ **Μόνο τα `numErrors`, ποτέ τα `numWarnings`**: οι προειδοποιήσεις του πιάνουν και
 * νόμιμες επιλογές *(αχρησιμοποίητο accessor, ασυνήθιστο όνομα)*. Πύλη δημοσίευσης που
 * μπλοκάρει σε warning είναι πύλη που κανείς δεν περνά — και η πρώτη που θα απενεργοποιηθεί.
 */
async function validateOrThrow(input: Buffer): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { validateBytes } = require('gltf-validator') as {
    validateBytes: (bytes: Uint8Array) => Promise<{ issues: { numErrors: number } }>;
  };

  // ⚠️ **Ο κριτής ΠΕΤΑ όταν δεν αναγνωρίζει καν τη μορφή** *(«Invalid data: could not detect
  //    glTF format»)*, αντί να επιστρέψει αναφορά με σφάλματα. Οι δύο διαδρομές είναι **η
  //    ίδια απάντηση** για εμάς — *«δεν είναι έγκυρο glTF»* — και οφείλουν να δίνουν το
  //    **ίδιο όνομα**. Αλλιώς σκουπίδια θα ανέβαιναν ως ανώνυμη κατάρρευση, ενώ ένα
  //    κακοσχηματισμένο glTF θα έδινε καθαρό μήνυμα: δύο μηνύματα για μία αιτία.
  let numErrors: number;
  try {
    numErrors = (await validateBytes(new Uint8Array(input))).issues.numErrors;
  } catch (error) {
    throw new ModelBakeError(
      'invalid-gltf',
      `glTF-Validator could not read the file: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (numErrors > 0) {
    throw new ModelBakeError(
      'invalid-gltf',
      `glTF-Validator reported ${numErrors} error(s) — the file is not valid glTF 2.0`,
    );
  }
}

/**
 * **Διαβάζεται καν;** — η ερώτηση **μετά** τον κριτή, και η φθηνότερη.
 *
 * ⚠️ Το `readBinary` είναι **αυστηρός αναγνώστης** *(πετά σε κατεστραμμένο GLB, σε
 * άγνωστο chunk, σε ασυνεπές μήκος)*, αλλά ρωτά *«μπορώ να το φορτώσω;»* — όχι *«είναι
 * έγκυρο;»*. Κρατιέται ως **ζώνη δίπλα στις τιράντες** *(N.7.2 #4)*: αν ο κριτής κάποτε
 * αστοχήσει ή αλλάξει συμβόλαιο, η αποτυχία παραμένει **ονομασμένη** αντί για κατάρρευση.
 */
async function readOrThrow(io: MemoryIO, input: Buffer): Promise<Document> {
  try {
    return await io.readBinary(new Uint8Array(input));
  } catch (error) {
    throw new ModelBakeError(
      'invalid-gltf',
      `Not a readable GLB: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
