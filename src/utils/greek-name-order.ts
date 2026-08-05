/**
 * @fileoverview **Ποιο κομμάτι είναι το επώνυμο;** — SSoT σειράς ελληνικού ονόματος (ADR-759 Φ1).
 *
 * Διαφορετική ερώτηση από το {@link @/utils/greek-person-name}, γι' αυτό και άλλο σπίτι:
 * εκείνο ρωτά «**είναι το ίδιο πρόσωπο;**» και είναι σκόπιμα **ανεξάρτητο σειράς** — ταιριάζει
 * σύνολα συστατικών, ώστε το `ΝΙΚΟΛΑΟΥ ΕΥ. ΙΩΑΝΝΗΣ` να βρίσκει το «Ιωάννης Νικολάου». Αυτό εδώ
 * ρωτά «**ποιο από τα δύο είναι το επώνυμο;**» — ερώτηση που ο ταιριαστής **δεν χρειάζεται να
 * απαντήσει ποτέ** και γι' αυτό δεν την απαντά.
 *
 * 🔴 **Γιατί μετράει παρ' όλα αυτά.** Τη στιγμή που **γράφουμε** νέα επαφή, τα `firstName` και
 * `lastName` είναι δύο **διαφορετικά** πεδία της βάσης. Ανεστραμμένα, ο Λ2 θα συνέχιζε να δίνει
 * `name-exact` (δεν κοιτάζει σειρά) — δηλαδή **η οθόνη θα έλεγε «βρέθηκε» πάνω σε εγγραφή που
 * λέει ότι ο άνθρωπος λέγεται «Νικολάου Ιωάννης»**. Ένα λάθος που καμία πύλη δεν μπορεί να
 * πιάσει, γιατί το αποτέλεσμα *μοιάζει* σωστό.
 *
 * ⇒ Η απάντηση **δεν κρύβεται**: κάθε αποτέλεσμα φέρει {@link GreekNameOrderSignal}, ώστε ο
 * άνθρωπος να ξέρει **πόσο** να το ελέγξει. Το `convention` σημαίνει «μάντεψα από έθιμο».
 *
 * @module utils/greek-name-order
 */

import { isPatronymicInitial } from '@/utils/greek-person-name';
import { splitIntoWords } from '@/utils/greek-text';

/**
 * Τι **απέδειξε** τη σειρά — από το ισχυρότερο προς το ασθενέστερο.
 *
 * Κατά το πρότυπο του `BindingEvidenceKind`: ο άνθρωπος δεν ωφελείται από ποσοστό, ωφελείται
 * από το **γιατί**.
 */
export type GreekNameOrderSignal =
  /** Συστολή (`ΚΩΝ/ΝΟΣ`) — δείχνει **το ίδιο το κομμάτι** που είναι μικρό όνομα. */
  | 'contraction'
  /** Αρχικό πατρωνύμου ανάμεσα (`ΝΙΚΟΛΑΟΥ **ΕΥ.** ΙΩΑΝΝΗΣ`) — σημαδεύει το **σύνορο**. */
  | 'patronymic-initial'
  /** Κανένα σήμα· ισχύει το έθιμο «επώνυμο πρώτο». **Εδώ κοιτάζει ο άνθρωπος.** */
  | 'convention'
  /** Ένα μόνο συστατικό — δεν υπάρχει σειρά να αποφασιστεί. */
  | 'single-token';

export interface GreekNameParts {
  readonly firstName: string;
  readonly lastName: string;
  /**
   * Το αρχικό του πατρωνύμου, ωμό (`ΕΥ.`), όταν το όνομα το φέρει.
   *
   * Δεν είναι όνομα και δεν προσποιείται ότι είναι — αλλά **δεν πετιέται** (ADR-745 §8
   * κανόνας 3). Ο καταναλωτής αποφασίζει πού το βάζει· εδώ απλώς δεν χάνεται.
   */
  readonly patronymicInitial: string;
  readonly signal: GreekNameOrderSignal;
}

/** Συστολή: γράμματα, κάθετος, γράμματα — ίδιο σχήμα με το `greek-person-name`. */
const CONTRACTION = /^\p{L}+\/\p{L}+$/u;

const EMPTY: GreekNameParts = {
  firstName: '',
  lastName: '',
  patronymicInitial: '',
  signal: 'single-token',
};

const join = (parts: readonly string[]): string => parts.join(' ');

/**
 * Η συστολή είναι **μικρό όνομα**, όχι επώνυμο.
 *
 * `ΚΩΝ/ΝΟΣ`, `ΠΑΝ/ΤΗΣ`, `ΔΗΜ/ΟΣ`, `ΧΑΡ/ΠΟΣ` — ο ελληνικός τύπος συστολής εφαρμόζεται στα
 * **βαφτιστικά**, γιατί αυτά είναι λίγα και αναγνωρίσιμα από πρόθεμα+κατάληξη. Είναι το
 * **μοναδικό** σήμα που επιβιώνει και σε ανεστραμμένη γραφή (`ΚΩΝ/ΝΟΣ ΜΑΥΡΟΜΙΧΑΛΗΣ`), γι' αυτό
 * και ρωτιέται πρώτο: τα υπόλοιπα σήματα μιλούν για **θέση**, αυτό για **ταυτότητα κομματιού**.
 */
function byContraction(names: readonly string[]): GreekNameParts | null {
  const contracted = names.filter((n) => CONTRACTION.test(n));
  if (contracted.length !== 1) return null;
  return {
    firstName: contracted[0],
    lastName: join(names.filter((n) => !CONTRACTION.test(n))),
    patronymicInitial: '',
    signal: 'contraction',
  };
}

/**
 * Το αρχικό πατρωνύμου **χωρίζει** επώνυμο από όνομα: `ΕΠΩΝΥΜΟ Π. ΟΝΟΜΑ`.
 *
 * Απαιτούνται ονόματα **και στις δύο** πλευρές. Αρχικό στην αρχή ή στο τέλος δεν σημαδεύει
 * σύνορο — σημαδεύει μόνο τον εαυτό του — και τότε πέφτουμε στο έθιμο, δηλωμένα.
 *
 * 🔑 Έτσι το σήμα αντέχει και σε **σύνθετο επώνυμο**: `ΠΑΠΑ ΓΕΩΡΓΙΟΥ Ν. ΝΙΚΟΛΑΟΣ` δίνει
 * επώνυμο «ΠΑΠΑ ΓΕΩΡΓΙΟΥ», που καμία μέτρηση κομματιών δεν θα έβρισκε.
 */
function byPatronymicInitial(words: readonly string[]): GreekNameParts | null {
  const at = words.findIndex(isPatronymicInitial);
  if (at === -1) return null;
  const before = words.slice(0, at).filter((w) => !isPatronymicInitial(w));
  const after = words.slice(at + 1).filter((w) => !isPatronymicInitial(w));
  if (before.length === 0 || after.length === 0) return null;
  return {
    firstName: join(after),
    lastName: join(before),
    patronymicInitial: words[at],
    signal: 'patronymic-initial',
  };
}

/**
 * Το ελληνικό επαγγελματικό έθιμο: **επώνυμο πρώτο**, τα υπόλοιπα είναι το όνομα.
 *
 * Δηλώνεται ως `convention` επίτηδες. Είναι η **μόνη** διαδρομή που μαντεύει, και ο
 * καταναλωτής οφείλει να το πει στον άνθρωπο αντί να το παρουσιάσει ως εύρημα.
 */
function byConvention(names: readonly string[]): GreekNameParts {
  return {
    firstName: join(names.slice(1)),
    lastName: names[0],
    patronymicInitial: '',
    signal: 'convention',
  };
}

/**
 * Ελληνικό πλήρες όνομα → `{ firstName, lastName }`, **με το σήμα που το απέδειξε**.
 *
 * Ένα μόνο συστατικό γίνεται **επώνυμο**, όχι όνομα: σε τοπογραφικό, σφραγίδα ή υπογραφή, η
 * μονολεκτική αναφορά σε πρόσωπο είναι το επώνυμό του. Το `firstName` μένει κενό — δηλαδή
 * **ορατά ελλιπές**, που είναι το ζητούμενο· ένα μαντεμένο μικρό όνομα δεν θα ήταν.
 */
export function splitGreekPersonName(fullName: string): GreekNameParts {
  const words = splitIntoWords(fullName).map((w) => w.raw);
  const names = words.filter((w) => !isPatronymicInitial(w));
  if (names.length === 0) return EMPTY;
  if (names.length === 1) return { ...EMPTY, lastName: names[0] };

  return (
    byContraction(names) ?? byPatronymicInitial(words) ?? byConvention(names)
  );
}
