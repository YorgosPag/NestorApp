/**
 * @fileoverview 🏆 **Η ΔΗΛΩΣΗ ΤΑΞΙΔΕΥΕΙ ΠΑΝΩ ΣΤΑ ΙΔΙΑ ΤΑ BYTES** — κωδικοποίηση και **αμυντική** ανάγνωση.
 * @related ADR-845 §6.2.1 (Ε-2) · §8 (Α-3 · Α-4 · Α-6) · ADR-841 §7 Α12.7 · Α10 · Α11
 * @module lib/listings/model-declaration-metadata
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΡΩΤΗΜΑ ΠΟΥ ΑΠΑΝΤΑ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ, ΚΑΙ ΓΙΑΤΙ ΔΕΝ ΕΙΧΕ ΠΡΟΦΑΝΗ ΑΠΑΝΤΗΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο ψήστης *(`public-shelf-model-bake`)* απαιτεί **τρία** πράγματα δίπλα στα bytes: σήμανση
 * κατάστασης *(Α11)*, υπογράφοντα *(Α10)*, και τη **λογιστική** των πέντε μεγεθών *(§6.2.1)*.
 * Αλλά το `PublicShelfSource` είναι, γραμμένο και δεσμευτικό, **«μονοπάτι στον ιδιωτικό κάδο,
 * ποτέ bytes και ποτέ URL»** *(Α12.7)* — ο γραφέας διαβάζει το πρωτότυπο **ο ίδιος**, ώστε ο
 * καθαρισμός να μην μπορεί να παρακαμφθεί από τον καλούντα.
 *
 * ⇒ Η δήλωση **δεν επιτρέπεται** να ταξιδέψει ως όρισμα. Πρέπει να ζει **εκεί που ζουν τα bytes**.
 *
 * 🏆 **Η ΑΠΑΝΤΗΣΗ: CUSTOM METADATA ΠΑΝΩ ΣΤΟ ΙΔΙΟ ΑΝΤΙΚΕΙΜΕΝΟ.** Τρία κέρδη, μία απόφαση:
 *
 * 1. **Bytes και δήλωση δεν διαχωρίζονται ΠΟΤΕ** — είναι **μία** εγγραφή αντικειμένου. Δεν
 *    υπάρχει κατάσταση όπου το ένα υπάρχει και το άλλο όχι, ούτε κατάσταση όπου κάποιος
 *    αντικατέστησε τα bytes και ξέχασε τη δήλωση *(θα ήταν **δύο** έγγραφα, ελεύθερα να
 *    αποκλίνουν — ακριβώς το σχήμα που η λογιστική υπάρχει για να καταγγέλλει)*.
 * 2. **Η Α12.7 μένει ΑΝΕΠΑΦΗ** — καμία υπογραφή δεν άλλαξε, κανένα byte δεν ταξίδεψε.
 * 3. **Μηδέν επιπλέον round-trip** — ο γραφέας καλεί **ήδη** `getMetadata()` για τη **γενιά**
 *    του ιδιωτικού αρχείου *(`sourceReference`)*. Η δήλωση έρχεται στην **ίδια** απάντηση.
 *
 * 🔎 **ΚΑΙ ΕΙΝΑΙ Η ΓΡΑΜΜΕΝΗ ΒΙΟΜΗΧΑΝΙΚΗ ΠΡΑΚΤΙΚΗ, ΟΧΙ ΔΙΚΗ ΜΑΣ ΕΥΡΕΣΗ** *(έρευνα Φ4.2β)*:
 * *«use object user-defined metadata for **stable technical facts** … keep rich details in a
 * **sidecar** manifest»*, με όριο **8 KB** στα custom metadata *(HTTP header limit)*. Η δήλωσή
 * μας είναι **ακριβώς** «stable technical facts» και μετρήθηκε **κάτω από 1 KB** — δες το
 * {@link MODEL_DECLARATION_MAX_BYTES}, που το **εκτελεί** αντί να το ελπίζει.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΓΙΑΤΙ ΤΟ `decode` ΕΠΙΣΤΡΕΦΕΙ `null` ΚΑΙ **ΠΟΤΕ** ΠΡΟΕΠΙΛΟΓΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `ModelPublicationDeclaration` το γράφει ρητά: *«κανένα πεδίο δεν έχει προεπιλογή — μια
 * προεπιλογή εδώ θα σήμαινε ότι **ο πρώτος που θα ξεχάσει να απαντήσει δημοσιεύει**»*. Μια
 * συμβολοσειρά που δεν αναγνωρίζεται είναι **απουσία δήλωσης**, και η απουσία δήλωσης είναι
 * **άρνηση με όνομα** στον ψήστη *(άγκυρες Α-3 / Α-4)* — ποτέ σιωπηλή αποδοχή.
 *
 * ⚠️ **ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΑΝΤΙ-ΚΑΚΟΒΟΥΛΟ ΜΕΤΡΟ, ΓΡΑΜΜΕΝΟ ΡΗΤΑ** *(§6.2.2)*: όποιος ελέγχει τον
 * πελάτη ελέγχει **και** τη δήλωση. Το αντι-κακόβουλο είναι το **ξαναγράψιμο** των bytes, που
 * ζει στον ψήστη. Εδώ ζει η **τιμιότητα του μηνύματος** — και η αμυντική ανάγνωση υπάρχει ώστε
 * σκουπίδια να δίνουν **ονομασμένη** άρνηση αντί για ανώνυμη κατάρρευση.
 *
 * ⛔ **ΚΑΘΑΡΟ MODULE** — καμία I/O, κανένα `firebase-admin`. Ο **πελάτης** που γράφει και ο
 * **διακομιστής** που διαβάζει χρησιμοποιούν το **ίδιο** αρχείο: ένα δεύτερο σχήμα σε μία από
 * τις δύο άκρες θα ήταν δύο απαντήσεις στο *«τι είναι δήλωση;»*.
 */

import type { GeometryFingerprint, Vec3M } from '@/lib/geometry/mesh3d/geometry-fingerprint';

import {
  isModelPublicationScope,
  isModelStateMark,
  type ModelGeometryLedger,
  type ModelPublicationDeclaration,
  type ModelSignatory,
} from './listing-model-declaration';

/**
 * **Το ΕΝΑ όνομα του κλειδιού**, γραμμένο μία φορά.
 *
 * ⚠️ Ο **γραφέας** *(πελάτης, Βήμα Γ)* και ο **αναγνώστης** *(διακομιστής)* το παίρνουν από
 * εδώ. Δύο κυριολεκτικά σε δύο άκρες θα ήταν το ίδιο σχήμα με τα πέντε `META_*` του raster
 * ραφιού: μια αλλαγή στη μία άκρη κάνει τα δημοσιευμένα αντικείμενα **αόρατα** στην άλλη.
 */
export const MODEL_DECLARATION_METADATA_KEY = 'nestorModelDeclaration';

/**
 * 🔴 **ΤΟ ΤΑΒΑΝΙ, ΚΑΙ ΕΙΝΑΙ ΤΟΥ ΠΑΡΟΧΟΥ — ΟΧΙ ΔΙΚΟ ΜΑΣ.**
 *
 * Τα custom metadata ταξιδεύουν ως **HTTP headers**, και το άθροισμα **όλων** τους περιορίζεται
 * στα **8 KB**. Ελέγχουμε στα **4 KiB**: η δήλωση δεν είναι το **μόνο** μεταδεδομένο του
 * αντικειμένου, και ένα ταβάνι που πιάνει ακριβώς το όριο του παρόχου θα αποτύγχανε **στον
 * πάροχο**, με μήνυμα που δεν ονομάζει τίποτα.
 *
 * 🔑 **Μετρημένο**: η δήλωση είναι `hash` + **7 αριθμοί** *(vertexCount, triangleCount, sizeM×3,
 * centroidM×3 — και το areaM2)* + **4 πλήθη** + **3 πεδία υπογράφοντα** ⇒ **κάτω από 1 KB**. Το
 * περιθώριο είναι τετραπλάσιο, και ο έλεγχος υπάρχει για να **κοκκινίσει η μέρα** που κάποιος
 * θελήσει να χώσει εδώ κάτι που ανήκει σε sidecar.
 */
export const MODEL_DECLARATION_MAX_BYTES = 4 * 1024;

/**
 * **Η δήλωση, σε συμβολοσειρά που χωρά σε header.**
 *
 * 🔑 **Το σχήμα του JSON είναι ΤΑΥΤΟΣΗΜΟ με τον τύπο** — κανένα δεύτερο λεξιλόγιο, καμία
 * συντόμευση ονομάτων. Ένα «συμπιεσμένο» σχήμα εδώ θα ήταν **δεύτερη γραμματική** για το ίδιο
 * πράγμα, και ο επόμενος θα έπρεπε να συντηρεί δύο.
 *
 * @throws {RangeError} όταν η δήλωση δεν χωρά — **ονομασμένη** αστοχία στη δική μας πλευρά,
 *   αντί για ανώνυμη απόρριψη από τον πάροχο τη στιγμή του ανεβάσματος.
 */
export function encodeModelDeclaration(declaration: ModelPublicationDeclaration): string {
  const encoded = JSON.stringify(declaration);
  // 🔴 **`TextEncoder`, ΟΧΙ `Buffer.byteLength` — ΚΑΙ ΕΙΝΑΙ ΟΡΘΟΤΗΤΑ, ΟΧΙ ΣΤΙΛ** *(Βήμα Γ)*.
  //    Το `Buffer` είναι **καθολικό του Node**: το Next **δεν** το γεμίζει με polyfill στον
  //    περιηγητή *(κανένα `buffer` στα `resolve.fallback`)*. Από το Βήμα Γ, ο **γραφέας αυτής
  //    της δήλωσης είναι ο ΠΕΛΑΤΗΣ** — δηλαδή η γραμμή αυτή θα έσκαγε με `Buffer is not
  //    defined` **μόνο στην παραγωγή**: το jsdom των tests έχει τα καθολικά του Node, άρα
  //    **καμία σουίτα δεν θα το έβλεπε ποτέ**. Το `TextEncoder` δίνει το **ίδιο** μήκος σε
  //    bytes UTF-8 και υπάρχει **και στις δύο** άκρες.
  const size = new TextEncoder().encode(encoded).length;

  if (size > MODEL_DECLARATION_MAX_BYTES) {
    // ⚠️ Λατινικό κείμενο **επίτηδες**: είναι invariant προγραμματιστή, όχι μήνυμα προς
    //    άνθρωπο. Ο σαρωτής ωμών κειμένων (N.11) διαβάζει ελληνικά μέσα σε `throw` ως
    //    κείμενο προς μετάφραση — δες το ίδιο σκεπτικό γραμμένο στη `shelfRecipe`.
    throw new RangeError(
      `Model declaration is ${size} bytes, over the ${MODEL_DECLARATION_MAX_BYTES} metadata ceiling`,
    );
  }

  return encoded;
}

/**
 * 🏆 **ΕΙΝΑΙ ΑΥΤΟ ΔΗΛΩΣΗ;** — `null` για **κάθε** άλλη απάντηση.
 *
 * ⚠️ Δέχεται `unknown` επειδή αυτό **ακριβώς** επιστρέφει ένα custom metadata: ο πάροχος δεν
 * υπόσχεται τίποτα για το περιεχόμενο, και ένας τύπος που θα υποσχόταν θα ήταν ισχυρισμός
 * αντί για έλεγχο.
 */
export function decodeModelDeclaration(raw: unknown): ModelPublicationDeclaration | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;

  // ⚠️ **Σταθερές, όχι επαναλαμβανόμενη πρόσβαση σε πεδίο**: το `parsed` δηλώθηκε `let` *(το
  //    `try` το απαιτεί)*, και η στένωση τύπου πάνω σε ιδιότητα μεταβλητού δεσμού δεν
  //    διατηρείται αξιόπιστα. Ένα `const` κάνει τον έλεγχο **και** τη χρήση να μιλούν για την
  //    ίδια τιμή — που είναι ούτως ή άλλως αυτό που εννοούμε.
  const state = parsed.state;
  const scope = parsed.scope;
  const signatory = readSignatory(parsed.signatory);
  const geometry = readLedger(parsed.geometry);

  if (signatory === null || geometry === null) return null;
  if (typeof state !== 'string' || !isModelStateMark(state)) return null;
  // 🔴 **ΚΑΜΙΑ ΠΡΟΕΠΙΛΟΓΗ ΓΙΑ ΤΟ ΕΥΡΟΣ, ΚΑΙ ΕΙΝΑΙ Ο ΙΔΙΟΣ ΚΑΝΟΝΑΣ ΜΕ ΤΑ ΑΛΛΑ ΤΡΙΑ** *(Ο-27)*.
  //    Ένα `?? 'active-floor'` εδώ θα έκανε **κάθε** παλιό αντικείμενο να ισχυρίζεται εύρος που
  //    κανείς δεν δήλωσε — δηλαδή θα **συγχώνευε** μοντέλα ολόκληρου κτιρίου με μοντέλα ενός
  //    ορόφου, σιωπηλά και μόνιμα *(η διεύθυνση είναι content-addressed)*. Η δήλωση χωρίς εύρος
  //    **δεν είναι δήλωση**: ο ψήστης αρνείται ονομαστικά με `'missing-declaration'`, και τα δύο
  //    ζωντανά μοντέλα της 2026-09-09 **οφείλουν** να ξαναδημοσιευτούν για να αποκτήσουν ένα.
  if (typeof scope !== 'string' || !isModelPublicationScope(scope)) return null;

  return { state, scope, signatory, geometry };
}

// ---------------------------------------------------------------------------
// Οι αναγνώστες — **ένας ανά σχήμα**, κανένας πάνω από 40 γραμμές (N.7.1)
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Πεπερασμένος αριθμός — ⛔ **ποτέ** `NaN`/`Infinity`: το `JSON.parse` τα φέρνει ως `null`. */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Τριάδα μέτρων — το {@link Vec3M} του {@link GeometryFingerprint}, **στοιχείο-στοιχείο**.
 *
 * ⚠️ **Η ανάθεση σε `readonly unknown[]` είναι ΔΗΛΩΣΗ, όχι ισχυρισμός** *(N.2)*: το
 * `Array.isArray` στενεύει το `unknown` σε **`any[]`**, δηλαδή θα έμπαζε σιωπηλά `any` στα τρία
 * στοιχεία. Ο σαφής τύπος τα κρατά `unknown` μέχρι να τα **ελέγξει** ο φρουρός.
 */
function readVec3(value: unknown): Vec3M | null {
  if (!Array.isArray(value) || value.length !== 3) return null;

  const [x, y, z]: readonly unknown[] = value;
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(z)) return null;

  return [x, y, z];
}

function readSignatory(value: unknown): ModelSignatory | null {
  if (!isRecord(value)) return null;
  const { name, discipline, studiedAt } = value;

  if (typeof name !== 'string') return null;
  if (typeof discipline !== 'string') return null;
  if (typeof studiedAt !== 'string') return null;

  // ⛔ **ΚΑΝΕΝΑ `trim()` ΕΔΩ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ.** Το *«τι μετράει ως υπογραφή»* ζει σε **ένα**
  //    σημείο — το `hasSignatory` (άγκυρα Α-4), που το γράφει ρητά: *«`trim()` εδώ, και ΜΟΝΟ
  //    εδώ»*. Ένας δεύτερος έλεγχος εδώ θα ήταν δεύτερη απάντηση, ελεύθερη να αποκλίνει: η
  //    ανάγνωση απαντά *«είναι δήλωση;»*, ο ψήστης απαντά *«αρκεί;»*.
  return { name, discipline, studiedAt };
}

function readLedger(value: unknown): ModelGeometryLedger | null {
  if (!isRecord(value)) return null;

  const { meshCount, triangleCount, materialCount, textureCount } = value;
  if (!isFiniteNumber(meshCount)) return null;
  if (!isFiniteNumber(triangleCount)) return null;
  if (!isFiniteNumber(materialCount)) return null;
  if (!isFiniteNumber(textureCount)) return null;

  // 🔑 **`undefined` ⇒ ΑΠΟΡΡΙΨΗ· `null` ⇒ ΝΟΜΙΜΗ ΤΙΜΗ.** Το `fingerprint: null` σημαίνει *«καμία
  //    αξιοποιήσιμη γεωμετρία»*, και ο `compareModelLedger` το θεωρεί **διαφωνία** *(fail-closed:
  //    «δεν ξέρω» δεν σημαίνει ποτέ «ίδιο»)*. Το να το πετούσαμε **εδώ** θα άλλαζε την αιτία
  //    της άρνησης από «η γεωμετρία διαφωνεί» σε «δεν υπάρχει δήλωση» — δύο διαφορετικά
  //    μηνύματα προς τον άνθρωπο, για δύο διαφορετικά προβλήματα.
  const fingerprint = value.fingerprint === null ? null : readFingerprint(value.fingerprint);
  if (fingerprint === undefined) return null;

  return { meshCount, triangleCount, materialCount, textureCount, fingerprint };
}

/** `undefined` = **δεν είναι αποτύπωμα**· `null` δεν επιστρέφεται ποτέ από εδώ. */
function readFingerprint(value: unknown): GeometryFingerprint | undefined {
  if (!isRecord(value) || typeof value.hash !== 'string') return undefined;
  if (!isRecord(value.signature)) return undefined;

  const s = value.signature;
  const sizeM = readVec3(s.sizeM);
  const centroidM = readVec3(s.centroidM);

  if (sizeM === null || centroidM === null) return undefined;
  if (!isFiniteNumber(s.vertexCount)) return undefined;
  if (!isFiniteNumber(s.triangleCount)) return undefined;
  if (!isFiniteNumber(s.areaM2)) return undefined;

  return {
    hash: value.hash,
    signature: {
      vertexCount: s.vertexCount,
      triangleCount: s.triangleCount,
      sizeM,
      centroidM,
      areaM2: s.areaM2,
    },
  };
}
