/**
 * 🔴 ADR-828 Φ4β — **«ΕΙΝΑΙ ΑΥΤΗ Η ΛΩΡΙΔΑ ΣΕΙΡΑ ΟΝΟΜΑΤΩΝ;»** — μία ερώτηση, μία διαδρομή,
 * και **καμία διάκριση** ανάμεσα στους μήνες που ξέρει ο μεταγλωττιστής και στους ορόφους
 * που έγραψε ο άνθρωπος το απόγευμα.
 *
 * ## Γιατί ξεχωριστό αρχείο
 * Ζούσε ως `detectListSeries` μέσα στο {@link module:subapps/dxf-viewer/bim/table/table-fill-series-detect},
 * που ήταν ήδη **442 από τις 500** επιτρεπόμενες γραμμές. Η Φ4β του πρόσθετε υποψηφίους,
 * κανόνα προτεραιότητας και την τεκμηρίωσή τους — δηλαδή θα το έσπρωχνε πάνω από το όριο.
 * Η επιλογή ήταν **εξαγωγή ή κόψιμο τεκμηρίωσης**, και το κόψιμο δεν είναι επιλογή:
 * η ανίχνευση ονομάτων είναι μια αυτοτελής ερώτηση με δικές της παγίδες (κυκλικό βήμα,
 * ομοιομορφία λίστας, προτεραιότητα) και τις κουβαλά μαζί της.
 *
 * ## 🔑 Η ΠΡΟΤΕΡΑΙΟΤΗΤΑ ΕΙΝΑΙ Η ΣΕΙΡΑ, ΟΧΙ ΔΕΥΤΕΡΟΣ ΚΑΝΟΝΑΣ
 * Όταν το «Ιανουάριος» ανήκει **και** στους ενσωματωμένους μήνες **και** σε λίστα που
 * έγραψε ο άνθρωπος, κερδίζει **του ανθρώπου**: εκείνος τη δήλωσε ρητά, η ενσωματωμένη
 * είναι προεπιλογή. Αυτό δεν γράφεται ως κανόνας διαιτησίας — γράφεται ως **σειρά στον
 * πίνακα υποψηφίων**, όπου το {@link matchNameList} κρατά την πρώτη που ταιριάζει. Ένας
 * ξεχωριστός κανόνας θα ήταν δεύτερη αλήθεια δίπλα σε μια σειρά που ήδη το λέει.
 *
 * @module subapps/dxf-viewer/bim/table/table-fill-series-list-detect
 * @see lib/string/name-list-match.ts — το ταίριασμα, χωρίς γνώση του τι σημαίνουν οι λίστες
 * @see lib/date/calendar-name-vocabulary.ts — οι ενσωματωμένες, ως υποψήφιες σαν όλες τις άλλες
 * @see docs/centralized-systems/reference/adrs/ADR-828-table-autofill-series.md §4
 */

import { CALENDAR_NAME_CANDIDATES } from '@/lib/date/calendar-name-vocabulary';
import {
  matchNameList,
  type NameListCandidate,
  type NameListMatch,
} from '@/lib/string/name-list-match';
import { positiveMod } from '@/lib/number/positive-mod';
import { writtenWordShape, type WrittenWordShape } from '@/utils/greek-text';
import type { TableFillSeries } from './table-fill-series-types';

/**
 * Οι υποψήφιες **με τη σειρά που ρωτιούνται**: πρώτα του ανθρώπου, μετά οι ενσωματωμένες.
 *
 * ⚠️ Ο πίνακας χτίζεται σε **κάθε** κλήση και αυτό είναι σκόπιμο: οι λίστες του χρήστη
 * αλλάζουν όσο τρέχει η εφαρμογή, οπότε ένας προϋπολογισμένος πίνακας θα χρειαζόταν ακύρωση
 * — δηλαδή δεύτερη κατάσταση που μπορεί να πάει πίσω από την αλήθεια. Το κόστος είναι μία
 * συνένωση δύο μικρών πινάκων **ανά λωρίδα**, όχι ανά κελί.
 */
function candidatesFor(
  customLists: readonly NameListCandidate[],
): readonly NameListCandidate[] {
  return customLists.length === 0
    ? CALENDAR_NAME_CANDIDATES
    : [...customLists, ...CALENDAR_NAME_CANDIDATES];
}

/**
 * ⚠️ **Ένα** όνομα αρκεί για σειρά — σε αντίθεση με έναν σκέτο αριθμό, που δίνει αντιγραφή.
 *
 * Δεν είναι ασυμμετρία από αβλεψία (δες την κεφαλίδα του ανιχνευτή): το `10` δεν λέει τίποτα
 * για το τι έπεται, ενώ ένα μέλος **διατεταγμένης λίστας** έχει ορισμένο επόμενο. Ο σπόρος
 * **είναι** η απόδειξη — και μετά τη Φ4β αυτό ισχύει το ίδιο για τη λίστα του ανθρώπου,
 * γιατί τη διάταξη τη δήλωσε εκείνος.
 *
 * ⚠️ Η **λίστα** πρέπει να είναι κοινή σε όλους τους σπόρους: `Ιανουάριος, Φεβρουαρίου` δεν
 * είναι σειρά — είναι δύο διαφορετικοί τρόποι γραφής (δύο **στήλες**, δηλαδή δύο υποψήφιες
 * με άλλο `key`), και η συνέχειά τους δεν ορίζεται.
 */
export function detectListSeries(
  texts: readonly string[],
  customLists: readonly NameListCandidate[] = [],
): TableFillSeries | null {
  const candidates = candidatesFor(customLists);
  const matches: NameListMatch[] = [];
  for (const text of texts) {
    const match = matchNameList(text, candidates);
    if (match === null) return null;
    matches.push(match);
  }

  const head = matches[0];
  if (!matches.every((match) => match.key === head.key)) return null;

  // 🔑 Τα **ονόματα** μπαίνουν στη σειρά, όχι δείκτης προς αυτά: μετά από εδώ κανείς δεν
  // χρειάζεται να ξαναβρεί τη λίστα, ούτε καν να ξέρει ότι υπήρχε. Γι' αυτό η μετονομασία
  // ή η διαγραφή μιας λίστας δεν μπορεί να ορφανέψει ένα ήδη χτισμένο γέμισμα.
  const shape = seedShape(texts[0], head);
  if (matches.length === 1) {
    return { kind: 'list', entries: head.entries, shape, start: head.index, step: 1 };
  }

  const step = exactCyclicStep(
    matches.map((match) => match.index),
    head.entries.length,
  );
  if (step === null) return null;
  return { kind: 'list', entries: head.entries, shape, start: head.index, step };
}

/**
 * 🔴 **ΤΟ TITLE CASE ΔΕΝ ΑΠΟΔΕΙΚΝΥΕΤΑΙ ΣΕ ΦΡΑΣΗ** — μετρημένο εύρημα της Φ4β.
 *
 * ⚠️ Το `toGreekTitleCase` τιτλοποιεί **κάθε λέξη**, οπότε το «Α΄ όροφος» γινόταν
 * «Α΄ Όροφος»: η μηχανή ξαναέγραφε δεδομένα που ο άνθρωπος είχε πληκτρολογήσει ο ίδιος.
 * Αόρατο σε ολόκληρη τη Φ1-Φ4α επειδή **κάθε** ενσωματωμένη εγγραφή είναι μονολεκτική· η
 * πρώτη πολυλεκτική λίστα το έβγαλε αμέσως.
 *
 * 🔑 Η αιτία είναι στο **όνομα** της συνάρτησης: `writtenWord`Shape είναι ερώτηση για
 * **λέξη**. Ένας σπόρος μίας λέξης δεν αποδεικνύει τίποτα για τη δεύτερη λέξη μιας φράσης —
 * και το `'title'` είναι το **μόνο** από τα τέσσερα σχήματα που αποφασίζει για λέξεις που ο
 * σπόρος δεν περιείχε. Τα `'upper'` / `'lower'` εφαρμόζονται ομοιόμορφα σε ό,τι κι αν είναι,
 * και το `'mixed'` ήδη σημαίνει «άσε την κανονική γραφή ήσυχη».
 *
 * ⚠️ **Η ερώτηση αφορά την ΕΓΓΡΑΦΗ, όχι τον σπόρο**: το ζητούμενο δεν είναι «τι έγραψε ο
 * άνθρωπος», αλλά «μπορεί αυτό το σχήμα να φορεθεί χωρίς εφεύρεση;».
 *
 * ✅ Μηδέν οπισθοδρόμηση στα ενσωματωμένα: όλες οι εγγραφές τους είναι μονολεκτικές, άρα
 * περνούν αμετάβλητες — μαζί και ο άτονος κανόνας («Ιαν» ⇒ «Μαι», ποτέ «Μάι»), που ζει στο
 * `accented` και **δεν** αγγίζεται εδώ.
 */
function seedShape(text: string, match: NameListMatch): WrittenWordShape {
  const shape = writtenWordShape(text);
  if (shape.casing !== 'title') return shape;

  const isPhrase = match.entries.some((entry) => /\s/u.test(entry.trim()));
  return isPhrase ? { casing: 'mixed', accented: shape.accented } : shape;
}

/**
 * Το κοινό βήμα μιας ακριβούς προόδου **κυκλικά**: `Δεκέμβριος → Ιανουάριος` είναι `+1`,
 * όχι `−11`.
 *
 * ⚠️ Το `length` είναι **το μήκος της συγκεκριμένης λίστας** — 12 για μήνες, 7 για ημέρες,
 * ό,τι έγραψε ο άνθρωπος για τη δική του — και όχι σταθερά. Με καρφωμένο 12, η μετάβαση
 * `Κυριακή → Δευτέρα` (δείκτες 6 → 0) θα υπολογιζόταν ως `+6` αντί για `+1`, δηλαδή το
 * γέμισμα θα πηδούσε μέρες. Το σφάλμα δεν θα φαινόταν σε καμία σειρά μηνών, μόνο σε εκείνες
 * τις ημέρες που περνούν το σαββατοκύριακο.
 */
function exactCyclicStep(indices: readonly number[], length: number): number | null {
  if (length <= 0) return null;

  const step = signedCyclicDelta(indices[0], indices[1], length);
  const isExact = indices.every(
    (index, i) => i === 0 || signedCyclicDelta(indices[i - 1], index, length) === step,
  );
  return isExact ? step : null;
}

/**
 * Η **μικρότερη κατά απόλυτη τιμή** μετάβαση από το `from` στο `to` πάνω σε κύκλο μήκους
 * `length` — δηλαδή αυτή που θα εννοούσε ο άνθρωπος. Από Δεκέμβριο σε Ιανουάριο είναι ένα
 * βήμα μπροστά, όχι έντεκα πίσω.
 */
function signedCyclicDelta(from: number, to: number, length: number): number {
  const forward = positiveMod(to - from, length);
  return forward > length / 2 ? forward - length : forward;
}
