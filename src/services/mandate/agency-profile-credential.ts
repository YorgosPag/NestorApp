/**
 * @fileoverview **ΤΟ ΔΙΑΠΙΣΤΕΥΤΗΡΙΟ ΑΠΟ ΤΗ ΔΗΛΩΣΗ** — ο κριτής, **χωρίς καμία I/O**.
 * @related ADR-841 §7 Α9 · Α9.1 · Α9.2 · Φ6-Β1 · services/mandate/agency-profile.service
 * @module services/mandate/agency-profile-credential
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΧΩΡΙΣΕ ΑΠΟ ΤΟΝ ΓΡΑΦΕΑ *(N.7.1)*
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο `agency-profile.service` απαντούσε **δύο** ερωτήσεις: *«σχηματίζεται διαπιστευτήριο
 * από αυτή τη δήλωση;»* και *«γράψ' το»*. Η πρώτη είναι **καθαρή κρίση** — ταξινομία,
 * πίνακας αρχών, υποχρεωτικότητα εκδότη. Η δεύτερη είναι **Firestore**.
 *
 * ⚠️ **Η αφορμή ήταν το όριο των 500 γραμμών, ο λόγος όχι.** Οι τρεις συναρτήσεις εδώ
 * δεν αγγίζουν έγγραφο, δεν ξέρουν `companyId`, δεν έχουν `await` — ήταν **ήδη**
 * κάτοικοι άλλου επιπέδου. Το όριο **μέτρησε** κάτι που ήταν αληθές πριν από αυτό.
 *
 * ✅ **Και έχει δώρο**: ο κριτής γίνεται ελέγξιμος **χωρίς Admin SDK** — ως τώρα η
 * υποχρεωτικότητα του εκδότη *(Α9.1: «1234» χωρίς «ΔΣΘ»)* ήταν προσβάσιμη μόνο μέσα από
 * ολόκληρη τη δημοσίευση.
 *
 * ⛔ **ΜΗΔΕΝ Firestore, ΜΗΔΕΝ `await`, ΜΗΔΕΝ logger.** Ό,τι μπαίνει εδώ πρέπει να
 * απαντιέται με **δεδομένα στο χέρι**.
 */

import type {
  ClassifiedOccupation,
  ShowcaseCredential,
} from '@/types/agency-profile';
import type { ProfessionalRegistration } from '@/types/professional-identity';
import type { AgencyProfileRejection } from '@/services/mandate/agency-profile-verdict';
import { asCredential } from '@/lib/agency/showcase-read';
import { resolveRegistryAuthority } from '@/config/isco-registry-authority';
import { isChapteredRegistry } from '@/constants/professional-registries';
import { occupationNeedsCapability } from '@/lib/professional/showcase-eligibility';

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
export function credentialFor(
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
