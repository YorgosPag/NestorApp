/**
 * @fileoverview **Η ΔΗΜΟΣΙΕΥΣΗ ΤΗΣ ΒΙΤΡΙΝΑΣ** — η δεύτερη πράξη, και είναι του γραφείου.
 * @related ADR-827 §9.10 (Π1 · Π2) · ADR-824 §6 (η απόδειξη) · ADR-787 Ε-5 §8 (ψευδώνυμο)
 * @module services/mandate/agency-profile.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΔΥΟ ΠΡΑΞΕΙΣ, ΚΑΙ Η ΔΕΥΤΕΡΗ ΕΙΝΑΙ ΤΟΥ ΓΡΑΦΕΙΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η **ικανότητα** `brokerage_listings` είναι απόφαση **της πλατφόρμας** — *«επιτρέπεσαι
 * να μεσιτεύεις»*. Η **δημοσίευση** είναι απόφαση **του γραφείου** — *«θέλω να με
 * βρίσκουν»*. Αυτόματη δημοσίευση με τη χορήγηση θα δημοσίευε οργανισμό **που δεν το
 * ζήτησε**, δηλαδή ακριβώς την **ακούσια ιδιότητα μέλους** που κάνει το
 * `workspace_aliases` απαγορευμένο για σάρωση (ADR-787 Ε-5 §4 #1).
 *
 * 🔑 **Η ΠΑΡΟΥΣΙΑ ΕΙΝΑΙ Η ΣΥΓΚΑΤΑΘΕΣΗ.** Δεν υπάρχει πεδίο `isPublished`: θα ήταν
 * σημαία που μπορεί να διαφωνήσει με την ύπαρξη του εγγράφου (**ADR-749**).
 * **Απόσυρση = διαγραφή.**
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΤΑ ΔΥΟ ΑΜΕΤΑΒΛΗΤΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * | Π1 | Η δημοσίευση **ρυθμιζόμενης** ειδικότητας απαιτεί `brokerage_listings === 'active'` |
 * | Π2 | `active` που **παύει** ⇒ η **ρυθμιζόμενη** βιτρίνα παύει να υπάρχει |
 *
 * 🔴 **ΤΟ Π1 ΣΤΕΝΕΨΕ ΣΤΗ Φ6-Β, ΚΑΙ ΕΙΝΑΙ ΔΙΟΡΘΩΣΗ ΟΧΙ ΧΑΛΑΡΩΣΗ.** Έλεγε *«η
 * δημοσίευση απαιτεί ικανότητα»* σε έναν κόσμο όπου η μόνη βιτρίνα ήταν
 * μεσιτική. Με τον κατάλογο **επαγγελματιών**, η ίδια πρόταση θα ζητούσε από τον
 * ελαιοχρωματιστή **άδεια μεσιτείας** — δηλαδή θα έκανε την απουσία μητρώου
 * **ποινή** (Α9.3). Η ρυθμιζόμενη πράξη είναι η **μεσιτεία**, όχι η προβολή.
 *
 * 🔴 **Και ΔΕΝ επιβάλλεται με `if` εδώ — επιβάλλεται από τον ΤΥΠΟ.** Η συνάρτηση
 * δέχεται {@link ShowcaseAuthority}: στη ρυθμιζόμενη παραλλαγή του κουβαλά
 * {@link BrokerageAuthority}, που έχει `unique symbol` **μη εξαγόμενο** — μόνο ο
 * `requireBrokerageCapability` τον κατασκευάζει, και **κουβαλά το `companyId` ΤΟΥ
 * ΚΡΙΤΗ**. Και **ποιος** διαλέγει την παραλλαγή; **Όχι ο καλών**: ο
 * `gateShowcase` την παράγει από το `iscoCode` που έγραψε η ταξινομία.
 *
 * ⚠️ **Το Π2 είναι ΠΡΑΞΗ, όχι έλεγχος ανάγνωσης.** Ένας αναγνώστης που θα ρωτούσε
 * *«είναι ακόμη active;»* σε κάθε σάρωση του καταλόγου θα ήταν **δεύτερος κριτής**
 * (ADR-749) **και** μία ανάγνωση εταιρείας ανά γραμμή. Η ανάκληση της ικανότητας
 * **καλεί** το {@link withdrawAgencyProfile}· ο κατάλογος μένει καθαρός επειδή
 * **γράφτηκε** καθαρός.
 *
 * 🔴 **ΚΑΙ ΤΟ Π2 ΕΙΝΑΙ ΠΛΕΟΝ ΠΑΡΑΛΛΑΓΗΣ-ΣΥΝΕΙΔΗΤΟ**: σβήνει **μόνο** βιτρίνα με
 * ρυθμιζόμενο credential. Αλλιώς η ανάκληση μεσιτείας θα **εξαφάνιζε τον
 * υδραυλικό** που τυχαίνει να δουλεύει στο ίδιο γραφείο.
 *
 * **Layering**: service — Admin SDK. Η **κρίση** ζει στους τύπους.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { showcaseOwnerId, type ShowcaseAuthority } from '@/lib/auth/brokerage-authority';
import type {
  ClassifiedOccupation,
  PublicShowcase,
  PublicShowcaseLookup,
  ShowcaseCredential,
} from '@/types/agency-profile';
import { asCredential, readShowcase, toStoredShowcase } from '@/lib/agency/showcase-read';
import { publishShowcaseMark } from '@/services/mandate/showcase-mark-publication';
import { resolveRegistryAuthority } from '@/config/isco-registry-authority';
import { isChapteredRegistry } from '@/constants/professional-registries';
import { occupationNeedsCapability } from '@/lib/professional/showcase-eligibility';
import type { ProfessionalRegistration } from '@/types/professional-identity';
import type { GeoPoint } from '@/types/geo/coordinates';
import type { PlaceRef } from '@/types/geo/public-place';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('agency-profile.service');

// =============================================================================
// ΤΙ ΔΗΛΩΝΕΙ ΤΟ ΓΡΑΦΕΙΟ
// =============================================================================

/**
 * **Ό,τι γράφει ο άνθρωπος**, και τίποτα παραπάνω.
 *
 * ⛔ **ΚΑΜΙΑ αυτόματη αντιγραφή από το `companies/{id}`** (§9.9 β). Το GDPR εξαιρεί τα
 * **νομικά** πρόσωπα *(αιτ. σκ. 14)*, αλλά μεσίτης με **ατομική επιχείρηση** είναι
 * **φυσικό** πρόσωπο και η έδρα του μπορεί να είναι η **κατοικία** του. Άρα κάθε πεδίο
 * που δημοσιεύεται πρέπει να έχει **γραφτεί ρητά για δημοσίευση**, όχι να έχει
 * κληρονομηθεί από εγγραφή που έγινε για άλλον λόγο.
 */
export interface ShowcaseCredentialDeclaration {
  /**
   * 🔴 **Η ΜΟΝΗ ΤΑΞΙΝΟΜΙΚΗ ΕΙΣΟΔΟΣ ΑΠΟ ΤΟ ΣΥΡΜΑ.** Ούτε ετικέτα, ούτε `iscoCode`.
   *
   * Ετικέτα από το σύρμα θα επέτρεπε «Δικηγόρος» πάνω σε URI υδραυλικού: το
   * φίλτρο θα δούλευε σωστά *(πάνω στο URI)* και η **κάρτα θα έλεγε ψέματα**.
   * Ο διακομιστής διαβάζει την ταξινομία **μία φορά ανά γραφή** και γράφει και
   * τις δύο ετικέτες — δες `services/esco/occupation-classification.reader.ts`.
   */
  readonly occupation: ClassifiedOccupation;
  /**
   * Ο αριθμός μητρώου **όπως τον πληκτρολόγησε ο άνθρωπος**. Κενό = *«δεν
   * δηλώνω»*, που είναι **νόμιμο** για κάθε επάγγελμα εκτός των ρυθμιζόμενων
   * *(Α9.2: η σιωπή δεν είναι άρνηση)*.
   */
  readonly registrationNumber: string;
  /**
   * **Ποιος εκδότης** — υποχρεωτικό μόνο όταν η αρχή του επαγγέλματος έχει
   * πολλούς *(«ΔΣΘ», «ΔΣ Πατρών»)*. Α9.1: «1234» χωρίς «ΔΣΘ» δεν επαληθεύεται.
   */
  readonly registrationChapter: string;
}

/**
 * **Ό,τι δηλώνει ο επαγγελματίας**, και τίποτα παραπάνω.
 *
 * ⛔ **ΚΑΜΙΑ αυτόματη αντιγραφή από το `companies/{id}`** (§9.9 β). Το GDPR εξαιρεί τα
 * **νομικά** πρόσωπα *(αιτ. σκ. 14)*, αλλά επαγγελματίας με **ατομική επιχείρηση** είναι
 * **φυσικό** πρόσωπο και η έδρα του μπορεί να είναι η **κατοικία** του. Άρα κάθε πεδίο
 * που δημοσιεύεται πρέπει να έχει **γραφτεί ρητά για δημοσίευση**, όχι να έχει
 * κληρονομηθεί από εγγραφή που έγινε για άλλον λόγο.
 *
 * ⛔ **ΚΑΝΕΝΑ `standing` ΕΔΩ**, και είναι ο πυρήνας: αν ο πελάτης μπορούσε να
 * δηλώσει *«αυτο-δηλωμένο»*, ο φρουρός του ΓΕΜΗ θα ήταν παρακάμψιμος με **μία
 * λέξη σε ένα JSON**. Η παραλλαγή παράγεται από το `iscoCode`, εδώ και στην
 * ανάγνωση, με την **ίδια** συνάρτηση.
 */
export interface ShowcaseDeclaration {
  readonly alias: string;
  readonly displayName: string;
  /** ≥1 — το επιβάλλει ο γραφέας, με **ονομασμένη** άρνηση. */
  readonly credentials: readonly ShowcaseCredentialDeclaration[];
  readonly place: PlaceRef | null;
  /**
   * Η **αποκανονικοποιημένη** γεωμετρία του τόπου — για το φίλτρο «κοντά μου».
   *
   * ⚠️ `null` = *«δεν δήλωσε τόπο»*, **ΠΟΤΕ** `{lat:0,lng:0}`: σημείο στον
   * Ατλαντικό που κάθε χάρτης ζωγραφίζει **με απόλυτη σιγουριά**.
   */
  readonly position: GeoPoint | null;
  /**
   * ⛔ **ΚΑΝΕΝΑ `mark` ΕΔΩ — ΤΟ ΣΗΜΑ ΕΙΝΑΙ ΔΙΚΗ ΤΟΥ ΠΡΑΞΗ** (ADR-841 §7 Α21, Φάση 2).
   *
   * ────────────────────────────────────────────────────────────────────────
   * 🔴 ΥΠΗΡΞΕ ΕΔΩ, ΚΑΙ Η ΑΦΑΙΡΕΣΗ ΤΟΥ ΕΙΝΑΙ ΔΙΟΡΘΩΣΗ ΒΛΑΒΗΣ
   * ────────────────────────────────────────────────────────────────────────
   *
   * Η Φάση 1 το έβαλε στη δήλωση, με το σκεπτικό *«η δήλωση είναι ολόκληρη η βιτρίνα,
   * άρα απόν = καθάρισέ το»*. Σωστό για κάθε **άλλο** πεδίο, και **αδύνατο** γι' αυτό:
   * η οθόνη διαβάζει πίσω το **ίδιο έγγραφο με τον κόσμο**, όπου το σήμα ζει ως
   * **δημόσιο URL** — το `privateStoragePath` που ζητά το σύρμα **δεν επιστρέφει ποτέ**.
   *
   * ⇒ Η οθόνη δεν *«ξεχνούσε»* να το ξαναστείλει· **δεν είχε από πού να το πάρει**.
   * Κάθε αλλαγή επωνυμίας θα έσβηνε το λογότυπο, και **καμία** διόρθωση στον πελάτη δεν
   * θα το έλυνε.
   *
   * 🔑 **Η θεραπεία δεν ήταν να μάθει η δήλωση να σιωπά** *(`undefined` = «μην αγγίζεις»)*:
   * αυτό θα έκανε **δύο** πεδία με **δύο** σημασιολογίες απουσίας στο ίδιο σχήμα, και η
   * διαφορά θα ήταν αόρατη σε κάθε πελάτη με σφάλμα. Το σήμα έφυγε **ολόκληρο** σε δικές
   * του πράξεις — `declareShowcaseMark` / `retractShowcaseMark`, στο
   * {@link module:services/mandate/showcase-mark-custody} — και είναι το καθολικό
   * πρότυπο *(GitHub · Slack · LinkedIn)*: **το avatar δεν έχει «Αποθήκευση»**.
   *
   * ⚠️ Ο γραφέας **διατηρεί** ό,τι βρει, μέσα σε **συναλλαγή** — δες {@link publishShowcase}.
   */
}

// 🔑 **Το λεξιλόγιο των ετυμηγοριών ζει σε ΚΑΘΑΡΟ leaf** — το μοιράζονται **δύο** γραφείς
//    (βιτρίνα + σήμα) και το διαβάζουν **πελατικά** αρχεία. Δες το «γιατί» εκεί.
// ⚠️ Το `export … from` παρακάτω **ΕΠΑΝΕΞΑΓΕΙ** — δεν δεσμεύει τα ονόματα εδώ (CHECK 3.70).
import type {
  AgencyProfileRejection, AgencyProfileWriteResult,
} from '@/services/mandate/agency-profile-verdict';

export type {
  AgencyProfileRejection,
  AgencyProfileWriteResult,
} from '@/services/mandate/agency-profile-verdict';
export { AGENCY_PROFILE_REJECTIONS } from '@/services/mandate/agency-profile-verdict';

// =============================================================================
// Η ΔΗΜΟΣΙΕΥΣΗ
// =============================================================================

/**
 * **«Θέλω να με βρίσκουν.»** — ο **μόνος** γραφέας της βιτρίνας.
 *
 * @param authority Η **παραλλαγή με την απόδειξή της** — όχι `companyId`. Δες Π1.
 *   Το κλειδί του εγγράφου βγαίνει **αποκλειστικά** από το {@link showcaseOwnerId}.
 *
 * ⚠️ **Ιδεμποτής**: δεύτερη κλήση με τα ίδια στοιχεία γράφει το ίδιο έγγραφο στο ίδιο
 * κλειδί. Το `publishedAt` **ανανεώνεται** επίτηδες — απαντά *«πότε δηλώθηκε αυτή η
 * βιτρίνα»*, όχι *«πότε μπήκε πρώτη φορά στον κατάλογο»*, και η δεύτερη ερώτηση δεν
 * έχει κανέναν να τη ρωτήσει.
 *
 * 🔴 **`set` ΧΩΡΙΣ `merge`, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ**: η δήλωση είναι **ολόκληρη η
 * βιτρίνα**. Με `merge`, ένα credential που ο άνθρωπος **αφαίρεσε** θα επιβίωνε —
 * δηλαδή δικηγόρος που έγινε διακοσμητής θα συνέχιζε να δείχνει αριθμό ΔΣΘ που
 * **δεν ζήτησε** να δείχνει.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΙ ΓΙ' ΑΥΤΟ ΑΚΡΙΒΩΣ ΤΟ **ΣΗΜΑ** ΧΡΕΙΑΖΕΤΑΙ ΣΥΝΑΛΛΑΓΗ (Α21, Φάση 2)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `mark` είναι το **μόνο** πεδίο που **δεν** το δηλώνει αυτή η κλήση: το γράφει
 * άλλη πράξη *(`declareShowcaseMark`)*, σε άλλο χρόνο, γιατί η οθόνη **δεν μπορεί** να
 * το ξαναστείλει — διαβάζει πίσω δημόσιο URL, ποτέ ιδιωτικό μονοπάτι. Άρα το `set`
 * **οφείλει να το κουβαλήσει**, αλλιώς κάθε αλλαγή επωνυμίας θα έσβηνε το λογότυπο.
 *
 * ⚠️ **Συναλλαγή και όχι «διάβασε μετά γράψε»**: το παράθυρο ανάμεσα στις δύο είναι
 * ακριβώς όσο ένα ανέβασμα εικόνας, και ο άνθρωπος που ανεβάζει σήμα ενώ πατά
 * «Δημοσίευση» δεν πρέπει να έχει νικητή που χάνει. Άγκυρα:
 * `showcase-mark-survival.test.ts`.
 */
export async function publishShowcase(
  adminDb: AdminFirestore,
  authority: ShowcaseAuthority,
  declaration: ShowcaseDeclaration,
): Promise<AgencyProfileWriteResult> {
  if (declaration.alias.trim() === '') {
    return { kind: 'rejected', reason: 'agency-profile-alias-missing' };
  }
  if (declaration.displayName.trim() === '') {
    return { kind: 'rejected', reason: 'agency-profile-name-missing' };
  }
  if (declaration.credentials.length === 0) {
    return { kind: 'rejected', reason: 'agency-profile-occupation-missing' };
  }

  const credentials: ShowcaseCredential[] = [];
  for (const declared of declaration.credentials) {
    const formed = credentialFor(declared);
    if ('reason' in formed) return { kind: 'rejected', reason: formed.reason };
    credentials.push(formed.credential);
  }

  // 🔴 ΑΠΟ ΤΗΝ ΑΠΟΔΕΙΞΗ, ποτέ από όρισμα: αδύνατο να κριθεί ο ένας οργανισμός και
  //    να γραφτεί ο άλλος (ADR-824 §6) — και στις **δύο** παραλλαγές.
  const companyId = showcaseOwnerId(authority);
  const ref = adminDb.collection(COLLECTIONS.AGENCY_PROFILES).doc(companyId);

  try {
    // ───────────────────────────────────────────────────────────────────────
    // 🔴 ΣΥΝΑΛΛΑΓΗ, ΚΑΙ Ο ΛΟΓΟΣ ΕΙΝΑΙ ΤΟ ΣΗΜΑ — ΟΧΙ Η ΒΙΤΡΙΝΑ
    // ───────────────────────────────────────────────────────────────────────
    //
    // Το `set` **χωρίς `merge`** μένει *(η δήλωση είναι ολόκληρη η βιτρίνα)*, αλλά το
    // `mark` **δεν ανήκει στη δήλωση**: το γράφει άλλη πράξη, σε άλλο χρόνο. Μια απλή
    // «διάβασε μετά γράψε» θα έχανε το σήμα που δηλώθηκε **ανάμεσα** στις δύο —
    // παράθυρο μικρό, αλλά ακριβώς όσο ένα ανέβασμα εικόνας.
    //
    // 🔑 **Καμία παρενέργεια μέσα στη συναλλαγή**: μόνο ανάγνωση και γραφή εγγράφου. Ο
    //    κάδος **δεν αγγίζεται καθόλου** εδώ, γιατί τα bytes του σήματος είναι ήδη στο
    //    ράφι και **δεν άλλαξαν** — άρα το `DeclaredShowcaseMark` που ξαναγράφεται είναι
    //    ακόμη αληθές. Ένα `reconcilePublicShelf` μέσα σε σώμα που **ξαναεκτελείται σε
    //    σύγκρουση** θα κατέβαζε και θα ξανάγραφε bytes πολλές φορές.
    const profile = await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);

      // ⚠️ Ο **αναγνώστης**, ποτέ `as`: έγγραφο που δεν περνά τον φρουρό δίνει `null`
      //    σήμα — ίδιο συμβόλαιο με ό,τι βλέπει ο κόσμος (Φ6-Β4).
      const existing = snapshot.exists ? readShowcase(snapshot.data(), companyId) : null;
      const keptMark = existing?.outcome === 'showcase' ? existing.showcase.mark : null;

      const showcase: PublicShowcase = {
        companyId,
        alias: declaration.alias.trim(),
        displayName: declaration.displayName.trim(),
        credentials,
        place: declaration.place,
        position: declaration.position,
        mark: keptMark,
        publishedAt: nowISO(),
      };

      // 🔑 **Ο δίσκος ΔΕΝ παίρνει το `standing`** — δες `toStoredShowcase`. Μια
      //    αποθηκευμένη σημαία μπορεί να διαφωνήσει με το περιεχόμενο (ADR-749).
      transaction.set(ref, toStoredShowcase(showcase));
      return showcase;
    });

    return { kind: 'published', profile };
  } catch (error) {
    logger.error('[AGENCY-PROFILE] Η δημοσίευση απέτυχε', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'failed' };
  }
}

/**
 * **Ένα credential από μια δήλωση** — ή η **ονομασμένη** άρνηση.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΑΡΧΗ ΤΟΥ ΜΗΤΡΩΟΥ ΔΕΝ ΕΡΧΕΤΑΙ ΑΠΟ ΤΟ ΣΥΡΜΑ — ΤΗΝ ΛΕΕΙ ΤΟ ΕΠΑΓΓΕΛΜΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο άνθρωπος δηλώνει **αριθμό** *(και εκδότη, αν χρειάζεται)*· **ποια αρχή**
 * τον εξέδωσε το απαντά ο `resolveRegistryAuthority` από το `iscoCode`. Αν
 * ερχόταν από τον πελάτη, ένας διακοσμητής θα μπορούσε να δηλώσει αριθμό
 * **ΓΕΜΗ** — δηλαδή ισχυρισμό μεσιτείας χωρίς τον φρουρό της, με σωστό φίλτρο
 * και ψεύτικη κάρτα.
 *
 * ⚠️ **ΚΑΙ ΓΙ' ΑΥΤΟ ΤΟ `authority-mismatch` ΤΗΣ ΟΘΟΝΗΣ ΔΕΝ ΕΙΝΑΙ ΝΕΚΡΟ.** Δεν
 * παράγεται από **αυτόν** τον δρόμο — παράγεται από **μετατόπιση του πίνακα**:
 * η Φ6-Β1 μόλις μετακίνησε τα ISCO `7126`/`7411` από `no-registry` σε
 * `regional-authority`. Ένα έγγραφο επιβιώνει της ετυμηγορίας του, και το
 * σημείωμα είναι ο μόνος τρόπος να το πει ο κατάλογος **χωρίς να κατηγορήσει**
 * τον επαγγελματία.
 */
function credentialFor(
  declared: ShowcaseCredentialDeclaration,
):
  | { readonly credential: ShowcaseCredential }
  | { readonly reason: AgencyProfileRejection } {
  const { occupation } = declared;
  const number = declared.registrationNumber.trim();
  const verdict = resolveRegistryAuthority(occupation.iscoCode);

  // ── Το επάγγελμα ΔΕΝ έχει (γνωστή) αρχή ⇒ ο αριθμός δεν έχει εκδότη ──────────
  //    ⚠️ Ο αριθμός **απορρίπτεται σιωπηλά** και είναι σωστό: η φόρμα δεν δείχνει
  //    καν πεδίο σε αυτή την ετυμηγορία (`no-registry` · `unexamined`), άρα δεν
  //    υπάρχει άνθρωπος να ειδοποιηθεί. Μια άρνηση εδώ θα ήταν άρνηση για κάτι
  //    που κανείς δεν ζήτησε.
  if (verdict.kind !== 'authority') {
    return { credential: selfDeclared(occupation) };
  }

  if (number === '') {
    // 🔒 Ρυθμιζόμενο ⇒ **δεν μπαίνει** χωρίς αριθμό: το «δεν μπαίνεις χωρίς
    //    αυτόν» του παλιού `gemiNumber: string`, τώρα με όνομα.
    if (occupationNeedsCapability(occupation.iscoCode)) {
      return { reason: 'agency-profile-registration-missing' };
    }
    // 🔑 **Η ΣΙΩΠΗ ΕΙΝΑΙ ΝΟΜΙΜΗ** (Α9.2): ο δικηγόρος που δεν δηλώνει αριθμό
    //    μπαίνει στον κατάλογο· η οθόνη το λέει με **σημείωμα**, όχι με άρνηση.
    return { credential: selfDeclared(occupation) };
  }

  // ── Αρχή με **πολλούς** εκδότες ⇒ ο εκδότης είναι υποχρεωτικός ──────────────
  if (isChapteredRegistry(verdict.authority)) {
    const chapter = declared.registrationChapter.trim();
    // 🔒 Η Α9.1: «1234» χωρίς «ΔΣΘ» δεν επαληθεύεται από κανέναν — και οι
    //    Δικηγορικοί Σύλλογοι είναι **63**.
    if (chapter === '') return { reason: 'agency-profile-chapter-missing' };
    return {
      credential: declaredCredential(occupation, {
        authorityKind: 'chapter',
        authority: verdict.authority,
        chapter,
        number,
      }),
    };
  }

  return {
    credential: declaredCredential(occupation, {
      authorityKind: 'national',
      authority: verdict.authority,
      number,
    }),
  };
}

/**
 * Ειδικότητα **με** δηλωμένο ζεύγος *(αρχή, αριθμός)*.
 *
 * ⚠️ Περνά κι αυτή από τον {@link asCredential}: το `declared` ικανοποιεί **και**
 * τις δύο παραλλαγές, άρα η επιστροφή `null` είναι μη προσιτή — αλλά ο τύπος τη
 * δηλώνει, και μια σιωπηλή `!` θα ήταν ισχυρισμός αντί για απόδειξη.
 */
function declaredCredential(
  occupation: ClassifiedOccupation,
  registration: ProfessionalRegistration,
): ShowcaseCredential {
  const credential = asCredential(occupation, { state: 'declared', registration });
  /* istanbul ignore next — μη προσιτό: το `declared` ικανοποιεί κάθε παραλλαγή. */
  if (credential === null) {
    throw new Error('ADR-841 A9 invariant: a declared (occupation, registration) pair did not form a credential.');
  }
  return credential;
}

/**
 * Ειδικότητα **χωρίς** δηλωμένο αριθμό.
 *
 * ⚠️ Περνά από τον {@link asCredential} και **δεν** κατασκευάζει το αντικείμενο
 * μόνη της: αν το επάγγελμα είναι ρυθμιζόμενο, εκείνος επιστρέφει `null` και
 * αυτή η συνάρτηση **πετά** — δηλαδή η μόνη διαδρομή που θα έγραφε ρυθμιζόμενη
 * βιτρίνα χωρίς απόδειξη κλείνει με **θόρυβο**, ποτέ σιωπηλά.
 */
function selfDeclared(occupation: ClassifiedOccupation): ShowcaseCredential {
  const credential = asCredential(occupation, { state: 'unknown' });
  /* istanbul ignore next — οι καλούντες έχουν ήδη αποκλείσει το ρυθμιζόμενο. */
  if (credential === null) {
    throw new Error(
      'ADR-841 Α9: ρυθμιζόμενη ειδικότητα έφτασε στο `selfDeclared` — ο φρουρός παρακάμφθηκε.',
    );
  }
  return credential;
}

/**
 * **Η απόσυρση — ΔΙΑΓΡΑΦΗ, όχι σημαία** (§9.10).
 *
 * 🔑 Καλείται από **δύο** σημεία, και το δεύτερο είναι το Π2: (α) το γραφείο που
 * αποσύρεται μόνο του, (β) η **ανάκληση της ικανότητας** `brokerage_listings`.
 *
 * ⚠️ **ΔΕΝ δέχεται {@link BrokerageAuthority}, και είναι σκόπιμο.** Η απόσυρση πρέπει
 * να δουλεύει **ακριβώς όταν** η ικανότητα έχει ήδη χαθεί — τότε καμία απόδειξη δεν
 * μπορεί να κατασκευαστεί. Φρουρός που κάνει τη θεραπεία αδύνατη είναι το σχήμα του
 * `provisionWorkspace` (ADR-787 §5.1): *«φρουρός που κάνει τον έλεγχο του φρουρουμένου
 * αδύνατο»*. Ο καλών εδώ είναι **πάντα** ο διακομιστής.
 *
 * ⚠️ Ιδεμποτής: διαγραφή ανύπαρκτου εγγράφου **δεν** είναι σφάλμα — και δεν πρέπει να
 * είναι, γιατί το Π2 τρέχει και για γραφεία που ποτέ δεν δημοσιεύτηκαν.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΕΣΒΗΝΕ ΜΟΝΟ ΤΟ ΕΓΓΡΑΦΟ — ΚΑΙ ΤΟ ΠΟΡΤΡΕΤΟ ΕΜΕΝΕ ΔΗΜΟΣΙΟ (Α21, Φάση 2)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το ράφι `showcases/{companyId}/` **δεν άδειαζε ποτέ**. Δηλαδή ο επαγγελματίας που
 * **ανακαλούσε τη συγκατάθεσή του** άφηνε πίσω τη **φωτογραφία του προσώπου του**,
 * δημόσια προσβάσιμη, για πάντα — ενώ το ίδιο αυτό αρχείο γράφει, δύο οθόνες πιο πάνω,
 * ότι *«η παρουσία **ΕΙΝΑΙ** η συγκατάθεση, και **απόσυρση = διαγραφή**»*.
 *
 * ⚠️ **Δύο σκανδάλες, καμία ορατή από την οθόνη**: το γραφείο που αποσύρεται μόνο του,
 * **και** το Π2 που καλεί την ίδια συνάρτηση σε ανάκληση ικανότητας.
 *
 * 🔑 **ΠΡΩΤΑ ΤΑ BYTES, ΜΕΤΑ ΤΟ ΕΓΓΡΑΦΟ.** Αν το ράφι αποτύχει, το έγγραφο **μένει** και
 * ο άνθρωπος ξαναπατά «Απόσυρση» — ορατή κατάσταση, με θεραπεία. Η αντίστροφη σειρά θα
 * άφηνε **ορφανά bytes** που καμία οθόνη δεν δείχνει και κανείς δεν ξέρει να σβήσει.
 *
 * ⚠️ Το `publishShowcaseMark(cid, null)` **υπήρχε ήδη** και έκανε ακριβώς αυτό: το
 * κενό σύνολο αδειάζει το πρόθεμα. Δεν γράφτηκε καμία διαδρομή διαγραφής — είναι η
 * **ίδια** πράξη με άλλη τιμή.
 */
export async function withdrawAgencyProfile(
  adminDb: AdminFirestore,
  companyId: string,
): Promise<AgencyProfileWriteResult> {
  try {
    await publishShowcaseMark(companyId, null);
    await adminDb.collection(COLLECTIONS.AGENCY_PROFILES).doc(companyId).delete();
    return { kind: 'withdrawn' };
  } catch (error) {
    logger.error('[AGENCY-PROFILE] Η απόσυρση απέτυχε', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { kind: 'failed' };
  }
}

// =============================================================================
// Η ΑΝΑΓΝΩΣΗ — σημειακή, με ΣΥΓΚΑΛΥΨΗ
// =============================================================================

/**
 * **Ποιο γραφείο ζει σε αυτό το `companyId`;** — η σημειακή ανάγνωση του §9.6.
 *
 * 🔴 **Η ΣΥΓΚΑΛΥΨΗ ΕΙΝΑΙ ΕΔΩ, ΚΑΙ ΕΙΝΑΙ ΔΟΜΙΚΗ**: γραφείο που **δεν** δημοσιεύτηκε
 * επιστρέφει `not-published`, το ίδιο ακριβώς με χώρο που **δεν υπήρξε ποτέ**. Η
 * συνάρτηση **δεν ρωτά** αν υπάρχει ο μισθωτής — δεν έχει τρόπο να το μάθει, και αυτό
 * είναι το ζητούμενο: *η απουσία από την προβολή είναι αδιάκριτη από την ανυπαρξία*.
 *
 * ⚠️ **Το `unavailable` ΔΕΝ ισοπεδώνεται σε `not-published`** (N.12 · Ε-5 §4 #3).
 * *Άγνωστο ≠ κενό*: μια βλάβη Firestore που διαβαζόταν ως *«το γραφείο αποσύρθηκε»*
 * θα ήταν λάθος **προς τα έξω** και **αόρατη** προς τα μέσα. Ο καλών ενώνει τις δύο
 * τιμές **στην οθόνη**· ο κώδικας τις κρατά χωριστές.
 */
export async function lookupAgencyProfile(
  adminDb: AdminFirestore,
  companyId: string,
): Promise<PublicShowcaseLookup> {
  if (companyId.trim() === '') return { outcome: 'not-published' };

  try {
    const snapshot = await adminDb
      .collection(COLLECTIONS.AGENCY_PROFILES)
      .doc(companyId)
      .get();

    if (!snapshot.exists) return { outcome: 'not-published' };
    // 🔒 Φ6-Β: το `as` έγινε ΦΡΟΥΡΟΣ — ίδιος με τον πελατικό αναγνώστη. Έγγραφο
    //    χωρίς καμία απόδειξη είναι «δεν δημοσιεύεται», ποτέ μισή κάρτα.
    const read = readShowcase(snapshot.data(), snapshot.id);
    return read.outcome === 'showcase'
      ? { outcome: 'found', showcase: read.showcase }
      : { outcome: 'not-published' };
  } catch (error) {
    logger.error('[AGENCY-PROFILE] Η αναζήτηση απέτυχε — άγνωστο, όχι κενό', {
      companyId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { outcome: 'unavailable' };
  }
}
