/**
 * @fileoverview Ταυτοποίηση **προσώπου** από ελληνικό όνομα — SSoT (ADR-745 Φ3β).
 *
 * Χωριστό module από το `greek-text.ts` επίτηδες: εκείνο απαντά «πώς κανονικοποιείται ελληνικό
 * **κείμενο**», αυτό απαντά «είναι το ίδιο **πρόσωπο**;». Δεύτερη ερώτηση, δεύτερο σπίτι.
 *
 * 🔑 **Γιατί δεν αρκεί καμία απόσταση Levenshtein.** Το τοπογραφικό γράφει
 * `ΜΑΥΡΟΜΙΧΑΛΗΣ ΚΩΝ/ΝΟΣ` και η βάση `Κωνσταντίνος Μαυρομιχάλης`. Τα δύο διαφέρουν σε **σειρά**
 * και το μικρό όνομα είναι **συνεσταλμένο** — απόσταση 8 χαρακτήρων. Κάθε κατώφλι που θα τα
 * ένωνε θα ένωνε και δεκάδες άσχετα ονόματα.
 *
 * Η κάθετος δεν είναι θόρυβος: είναι ο **κανονικός ελληνικός τύπος συστολής** — πρόθεμα, `/`,
 * κατάληξη (`ΚΩΝ/ΝΟΣ`, `ΠΑΝ/ΤΗΣ`, `ΔΗΜ/ΟΣ`, `ΧΑΡ/ΠΟΣ`). Το πλήρες όνομα **αρχίζει** με το πρώτο
 * και **τελειώνει** με το δεύτερο. Άρα δεν χρειάζεται κατάλογος συντομογραφιών — που θα ήταν
 * ελλιπής την ημέρα που γράφεται. Ίδιο σκεπτικό με τη Φ2 του ADR-745: **αλλάζεις τη σχέση
 * ταιριάσματος, όχι την είσοδο**.
 *
 * @module utils/greek-person-name
 */

import { fuzzyEqualGreek } from '@/lib/string/fuzzy-greek';
import { normalizeForLabelMatch, splitIntoWords } from '@/utils/greek-text';

/** Πόσο ισχυρή είναι η ταύτιση — από την ισχυρότερη προς την ασθενέστερη. */
export type PersonNameMatchKind = 'exact' | 'abbrev' | 'fuzzy';

/** Ένα σημαντικό συστατικό ονόματος. Τα αρχικά πατρωνύμου **δεν** γίνονται token. */
export interface PersonNameToken {
  readonly raw: string;
  readonly normalized: string;
  /** Παρόν όταν το συστατικό είναι συνεσταλμένο (`ΚΩΝ/ΝΟΣ`). */
  readonly contraction?: { readonly prefix: string; readonly suffix: string };
}

/** Αρχικό πατρωνύμου: ένα έως τρία γράμματα και τελεία (`Ε.`, `ΕΥ.`, `ΓΕΩ.`). */
const INITIAL = /^\p{L}{1,3}\.$/u;

/**
 * Είναι αυτή η λέξη **αρχικό πατρωνύμου** και όχι συστατικό ονόματος;
 *
 * Εξάγεται επειδή η **σειρά** του ονόματος το χρειάζεται ως σήμα, όχι μόνο η ταυτοποίηση:
 * το `ΝΙΚΟΛΑΟΥ ΕΥ. ΙΩΑΝΝΗΣ` δηλώνει «επώνυμο–πατρώνυμο–όνομα» **επειδή** το αρχικό κάθεται
 * στη μέση (δες {@link @/utils/greek-name-order}). Δεύτερο regex σε άλλο αρχείο θα ήταν
 * sibling clone (N.18) — και το χειρότερο είδος, γιατί οι δύο ορισμοί του «τι είναι αρχικό»
 * θα απέκλιναν σιωπηλά.
 */
export function isPatronymicInitial(raw: string): boolean {
  return INITIAL.test(raw);
}

/** Συστολή: γράμματα, κάθετος, γράμματα — και οι δύο πλευρές υποχρεωτικές. */
const CONTRACTION = /^(\p{L}+)\/(\p{L}+)$/u;

/**
 * Κάτω από αυτό το μήκος **δεν** επιτρέπεται προσεγγιστική ταύτιση.
 *
 * 🔴 **Μετρημένο, όχι διαισθητικό**: με όριο 5, η απόσταση 1 ενώνει το `ΖΕΡΒΑ` με το `ΣΕΡΒΑ` —
 * δύο διαφορετικούς ανθρώπους, και το `ΖΕΡΒΑ` είναι **η ιδιοκτήτρια του δείγματος**. Σε σύντομα
 * ελληνικά επώνυμα ένα γράμμα δεν είναι τυπογραφικό λάθος· είναι άλλο όνομα. Η ανοχή υπάρχει για
 * **μακριά** επώνυμα, όπου το λάθος είναι πιθανότερο από τη σύμπτωση.
 */
const MIN_FUZZY_LENGTH = 7;

/** Από αυτό το μήκος και πάνω, δύο λάθη είναι ακόμη τυπογραφικά· κάτω από αυτό, ένα. */
const TWO_ERROR_LENGTH = 10;

/** Το τελικό σίγμα δεν είναι διαφορετικό γράμμα — μόνο διαφορετική θέση. */
function foldFinalSigma(text: string): string {
  return text.replace(/ς/g, 'σ');
}

/**
 * Τα **σημαντικά** συστατικά ενός ονόματος.
 *
 * Τα αρχικά πατρωνύμου πέφτουν: το `ΝΙΚΟΛΑΟΥ ΕΥ. ΙΩΑΝΝΗΣ` και το `Ιωάννης Νικολάου` είναι το
 * ίδιο πρόσωπο, και το `ΕΥ.` δεν υπάρχει στη βάση σε κανένα πεδίο. Αν το κρατούσαμε ως token, η
 * απαίτηση «κάθε συστατικό της πινακίδας ταιριάζει» δεν θα ικανοποιούνταν **ποτέ**.
 */
export function parsePersonName(text: string): PersonNameToken[] {
  const tokens: PersonNameToken[] = [];
  for (const word of splitIntoWords(text)) {
    if (isPatronymicInitial(word.raw)) continue;
    const contracted = CONTRACTION.exec(word.raw);
    tokens.push({
      raw: word.raw,
      normalized: foldFinalSigma(word.normalized),
      ...(contracted
        ? {
            contraction: {
              prefix: foldFinalSigma(normalizeForLabelMatch(contracted[1])),
              suffix: foldFinalSigma(normalizeForLabelMatch(contracted[2])),
            },
          }
        : {}),
    });
  }
  return tokens;
}

/**
 * Το `full` είναι η ανάπτυξη της συστολής `contracted`;
 *
 * `ΚΩΝ/ΝΟΣ` → `ΚΩΝΣΤΑΝΤΙΝΟΣ` ✅ · `ΠΑΝ/ΤΗΣ` → `ΠΑΝΑΓΙΩΤΗΣ` ✅ · `ΚΩΝ/ΝΟΣ` → `ΚΩΝΝΟΣ` ❌.
 *
 * Ο τελευταίος έλεγχος (**γνήσια μακρύτερο**) δεν είναι σχολαστικισμός: χωρίς αυτόν, το πρόθεμα
 * και η κατάληξη θα μπορούσαν να **επικαλύπτονται** μέσα σε μια σύντομη λέξη και κάθε συστολή θα
 * ταίριαζε με τον εαυτό της χωρίς περιεχόμενο ανάμεσα.
 */
export function expandsGreekContraction(contracted: string, full: string): boolean {
  const parsed = CONTRACTION.exec(contracted.trim());
  if (!parsed) return false;
  const prefix = foldFinalSigma(normalizeForLabelMatch(parsed[1]));
  const suffix = foldFinalSigma(normalizeForLabelMatch(parsed[2]));
  const target = foldFinalSigma(normalizeForLabelMatch(full));
  if (prefix.length === 0 || suffix.length === 0) return false;
  if (target.length <= prefix.length + suffix.length) return false;
  return target.startsWith(prefix) && target.endsWith(suffix);
}

/** Πόσο ισχυρά ταιριάζουν δύο συστατικά· `null` όταν δεν ταιριάζουν καθόλου. */
function tokenMatch(a: PersonNameToken, b: PersonNameToken): PersonNameMatchKind | null {
  if (a.normalized === b.normalized) return 'exact';
  if (a.contraction && expandsGreekContraction(a.raw, b.raw)) return 'abbrev';
  if (b.contraction && expandsGreekContraction(b.raw, a.raw)) return 'abbrev';

  const shortest = Math.min(a.normalized.length, b.normalized.length);
  if (shortest < MIN_FUZZY_LENGTH) return null;
  const tolerance = shortest >= TWO_ERROR_LENGTH ? 2 : 1;
  return fuzzyEqualGreek(a.normalized, b.normalized, tolerance) ? 'fuzzy' : null;
}

/**
 * Κάτω από δύο συστατικά δεν υπάρχει ταυτοποίηση προσώπου.
 *
 * Ένα σκέτο επώνυμο ταιριάζει με κάθε συνονόματο — και το ADR-745 §8 κανόνας 1 λέει ρητά ότι
 * **μια λάθος ταυτοποίηση είναι χειρότερη από καμία**: γράφει στη βάση ότι επώνυμος μηχανικός
 * μελέτησε έργο που δεν άγγιξε.
 */
const MIN_TOKENS = 2;

const STRENGTH: Record<PersonNameMatchKind, number> = { exact: 3, abbrev: 2, fuzzy: 1 };
const BY_STRENGTH: readonly PersonNameMatchKind[] = ['exact', 'abbrev', 'fuzzy'];

/**
 * Είναι το ίδιο πρόσωπο; Επιστρέφει την **ασθενέστερη** ταύτιση που χρειάστηκε, ή `null`.
 *
 * **Κάθε** συστατικό της πινακίδας πρέπει να βρει **δικό του** συστατικό της επαφής. Περισσεύματα
 * στην πλευρά της επαφής επιτρέπονται (μεσαία ονόματα, πατρώνυμα γραμμένα ολόκληρα) — ένα όνομα
 * με **περισσότερα** στοιχεία εξακολουθεί να είναι το ίδιο πρόσωπο· ένα με **λιγότερα** όχι.
 *
 * Η αντιστοίχιση γίνεται σε **περάσματα κατά ισχύ** (πρώτα όλα τα ακριβή, μετά οι συστολές, μετά
 * τα προσεγγιστικά) και **όχι** άπληστα ανά συστατικό: αλλιώς ένα προσεγγιστικό ταίριασμα θα
 * μπορούσε να δεσμεύσει το συστατικό που χρειαζόταν ένα ακριβές, και το αποτέλεσμα θα εξαρτιόταν
 * από τη σειρά των λέξεων. Ίδιο σχήμα με την **αποκλειστικότητα** του ζευγαρώματος του Λ1.
 */
export function personNameMatch(
  titleBlockName: string,
  contactName: string,
): PersonNameMatchKind | null {
  const wanted = parsePersonName(titleBlockName);
  const available = parsePersonName(contactName);
  if (wanted.length < MIN_TOKENS || available.length < MIN_TOKENS) return null;

  const takenByWanted = new Map<number, PersonNameMatchKind>();
  const usedAvailable = new Set<number>();

  for (const level of BY_STRENGTH) {
    wanted.forEach((token, i) => {
      if (takenByWanted.has(i)) return;
      const hit = available.findIndex(
        (other, j) => !usedAvailable.has(j) && tokenMatch(token, other) === level,
      );
      if (hit === -1) return;
      takenByWanted.set(i, level);
      usedAvailable.add(hit);
    });
  }

  if (takenByWanted.size !== wanted.length) return null;
  return [...takenByWanted.values()].reduce((weakest, kind) =>
    STRENGTH[kind] < STRENGTH[weakest] ? kind : weakest,
  );
}
