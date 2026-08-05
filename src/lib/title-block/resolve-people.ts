/**
 * @fileoverview Λ2 — πρόσωπο πινακίδας → υποψήφια επαφή + ρόλος έργου (ADR-745 Φ3β).
 *
 * **Καθαρή συνάρτηση. Καμία εγγραφή, κανένα I/O.** Το στιγμιότυπο επαφών δίνεται ως δεδομένο,
 * ώστε ολόκληρο το ταίριασμα να αποδεικνύεται χωρίς Firestore — που είναι ολόκληρη η αρχή του
 * Λ2 (§5.3: *«χωρίς παρενέργειες· δεν γράφει»*).
 *
 * 🔴 **Γιατί δεν καλείται η `searchContacts`.** Το `contacts-query.service.ts:224` φιλτράρει με
 * `JSON.stringify(c).toLowerCase().includes(term)`: **καμία** αφαίρεση τόνων (`ΜΑΥΡΟΜΙΧΑΛΗΣ` δεν
 * βρίσκει «Μαυρομιχάλης»), **καμία** κανονικοποίηση τηλεφώνου (`2310-788493` ≠ `2310 788493`),
 * και σαρώνει `id`/`createdBy`/`notes`/ημερομηνίες — άρα παράγει υποψηφίους από **άσχετα πεδία**.
 * Το ADR-745 §8 κανόνας 1 λέει ρητά ότι *μια λάθος ταυτοποίηση είναι χειρότερη από καμία*.
 *
 * @module lib/title-block/resolve-people
 */

import { resolveRoleCandidatesFromProfession } from '@/config/profession-bridge.config';
import { personNameMatch } from '@/utils/greek-person-name';
import type {
  BindingCandidate,
  BindingEvidence,
  BindingProposal,
} from '@/types/title-block-binding';
import { compareBindingCandidates } from '@/types/title-block-binding';
import type { TitleBlockField, TitleBlockPerson } from '@/types/title-block-reading';

/**
 * Η **προβολή** μιας επαφής που χρειάζεται το ταίριασμα — τίποτε άλλο.
 *
 * Σκόπιμα δεν είναι ο τύπος `Contact`: ο resolver δεν έχει λόγο να γνωρίζει διακρίτες ενώσεων,
 * ούτε να σέρνει το γράφημα των συμβολαίων επαφών. Η μετατροπή ζει στο ακάθαρτο στρώμα.
 */
export interface ContactSnapshotEntry {
  readonly id: string;
  readonly displayName: string;
  readonly phones: readonly string[];
  readonly emails: readonly string[];
}

/** Το κοινό πλαίσιο κάθε πρότασης — από πού διαβάστηκε και πού μπορεί να προσγειωθεί. */
export interface PeopleResolveContext {
  readonly projectId: string;
  readonly titleBlockIndex: number;
  readonly contacts: readonly ContactSnapshotEntry[];
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

/**
 * Τα τελευταία ψηφία είναι η ταυτότητα ενός τηλεφώνου.
 *
 * `2310-788493`, `2310 788493`, `+30 2310 788493` και `00302310788493` είναι **ένα** τηλέφωνο. Η
 * σύγκριση ολόκληρου του string τα κάνει τέσσερα, και ο ισχυρότερος μετά το e-mail δείκτης
 * ταυτότητας χάνεται σιωπηλά. Δέκα ψηφία = ο εθνικός αριθμός χωρίς κωδικό χώρας.
 */
const NATIONAL_DIGITS = 10;

/**
 * ⚠️ **Δεν καλείται ο `cleanPhoneNumber`, και δεν είναι παράλειψη.** Εκείνος αφαιρεί κενά, παύλες
 * και παρενθέσεις — δηλαδή **υποσύνολο** του «κράτα μόνο ψηφία» που κάνει η επόμενη γραμμή. Δεν
 * υπάρχει διπλότυπο εδώ: υπάρχει μια πράξη που τον **περιέχει**.
 *
 * Ο λόγος που μετράει: το `phone-validation.ts` **επανεξάγει** από το `vat-validation.ts`, το
 * οποίο εισάγει `@/lib/firebase` — άρα μια εισαγωγή για μία γραμμή regex θα έσερνε **ολόκληρο το
 * Firestore** μέσα στον καθαρό Λ2. Το βρήκε η άγκυρα καθαρότητας, όχι ανάγνωση. Η ίδια η σύζευξη
 * είναι πραγματικό χρέος άλλου τομέα και καταγράφηκε — δεν τη «διόρθωσα» εν παρόδω.
 */
function phoneKey(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.length > NATIONAL_DIGITS ? digits.slice(-NATIONAL_DIGITS) : digits;
}

/**
 * Τι αποδεικνύει ότι αυτή η επαφή είναι αυτό το πρόσωπο. Κενό ⇒ δεν είναι υποψήφια.
 *
 * 🔴 **Το ΟΝΟΜΑ είναι αναγκαία συνθήκη· τηλέφωνο και e-mail μόνο ΕΠΙΒΕΒΑΙΩΝΟΥΝ** — και αυτό το
 * βρήκε το πραγματικό αρχείο, όχι η θεωρία. Στο G753 τα `2310-788493`, `κιν 6949727121` και
 * `info@nikolaou.com.gr` γράφονται **κάτω από ΚΑΙ ΤΟΥΣ ΔΥΟ** μηχανικούς: είναι στοιχεία του
 * **γραφείου**, όχι προσώπου, και ο Λ1 ορθώς τα αποδίδει σε καθέναν. Με «οποιαδήποτε μαρτυρία
 * αρκεί», το e-mail (ισχυρότερη μαρτυρία) έκανε τον **Νικολάου** πρώτο υποψήφιο για τον
 * **Μαυρομιχάλη** — και το ταίριασμα φαινόταν *ισχυρότερο* από το σωστό.
 *
 * ⇒ Η ταυτότητα ενός προσώπου σε πινακίδα είναι **μόνο** το όνομά του. Τα κοινά στοιχεία
 * επικοινωνίας προσθέτουν εμπιστοσύνη σε ένα ήδη ταιριασμένο όνομα· ποτέ δεν το αντικαθιστούν.
 */
export function evidenceFor(
  person: TitleBlockPerson,
  contact: ContactSnapshotEntry,
): BindingEvidence[] {
  const nameMatch = personNameMatch(person.displayName, contact.displayName);
  if (nameMatch === null) return [];

  const evidence: BindingEvidence[] = [];

  // 🔴 **Μία μαρτυρία ανά ΤΑΥΤΟΤΗΤΑ, όχι ανά γραφή.** Ο Λ1 συσσωρεύει ό,τι βρίσκει στο κελί
  // (`title-block-people.ts` → `push(...phones)`) χωρίς απο-διπλοτύπωση, και το ίδιο νούμερο
  // γραμμένο δύο φορές — «2310-788493» στην έδρα, «2310 788493» στην υπογραφή — είναι **ένα**
  // τηλέφωνο για το `phoneKey`. Χωρίς αυτά τα σύνολα θα παρήγαγε **δύο** μαρτυρίες.
  //
  // Δεν είναι καλλωπισμός της οθόνης: το `evidence.length` είναι **κριτήριο κατάταξης**
  // (`compareBindingCandidates`). Μια επαφή που τυχαίνει να φέρει το τηλέφωνο σε δύο μορφές θα
  // **έσπαγε την ισοπαλία** εναντίον της σωστής, ο `unambiguousWinner` θα την αυτο-επέλεγε και το
  // κουμπί θα ήταν **ενεργό** — δηλαδή λάθος **πρόσωπο** στη βάση, από άλλη πόρτα από εκείνη που
  // έκλεισε ο Τομέας Δ2.
  const seen = new Set<string>();

  const contactEmails = new Set(contact.emails.map(normalizeEmail));
  for (const email of person.emails) {
    const key = normalizeEmail(email);
    if (contactEmails.has(key) && !seen.has(`email:${key}`)) {
      seen.add(`email:${key}`);
      evidence.push({ kind: 'email', value: email });
    }
  }

  const contactPhones = new Set(contact.phones.map(phoneKey).filter((p) => p.length > 0));
  for (const phone of person.phones) {
    const key = phoneKey(phone);
    if (key.length > 0 && contactPhones.has(key) && !seen.has(`phone:${key}`)) {
      seen.add(`phone:${key}`);
      evidence.push({ kind: 'phone', value: phone });
    }
  }

  if (nameMatch === 'exact') evidence.push({ kind: 'name-exact', value: contact.displayName });
  else if (nameMatch === 'abbrev') evidence.push({ kind: 'name-abbrev', value: contact.displayName });
  else evidence.push({ kind: 'name-fuzzy', value: contact.displayName });

  return evidence;
}

/**
 * Ένα πρόσωπο της πινακίδας → μία πρόταση.
 *
 * Οι υποψήφιοι είναι το **καρτεσιανό γινόμενο επαφών × ρόλων**, και αυτό είναι σκόπιμο: όταν η
 * ειδικότητα είναι διφορούμενη (η λέξη «Μηχανικός» ανήκει σε **5 από τους 7** ρόλους), το ADR
 * §6.4 ζητά να δει ο άνθρωπος **τις πραγματικές επιλογές** — όχι ένα αυθαίρετα διαλεγμένο
 * «πλησιέστερο ταίριασμα».
 */
export function resolvePersonProposal(
  person: TitleBlockPerson,
  field: TitleBlockField,
  context: PeopleResolveContext,
): BindingProposal {
  const base = {
    fieldKey: field.key,
    titleBlockIndex: context.titleBlockIndex,
    sourceHandle: field.sourceHandle,
    labelHandle: field.labelHandle,
    at: field.at,
    snapshotValue: person.displayName,
    personName: person.displayName,
  } as const;

  const roles = resolveRoleCandidatesFromProfession(person.professionText);
  const matched = context.contacts
    .map((contact) => ({ contact, evidence: evidenceFor(person, contact) }))
    .filter((m) => m.evidence.length > 0);

  // Η σειρά των δύο ελέγχων μετράει για το **μήνυμα**: «δεν βρήκα τον άνθρωπο» και «τον βρήκα
  // αλλά δεν ξέρω με τι ιδιότητα» είναι διαφορετικά προβλήματα με διαφορετική θεραπεία.
  if (matched.length === 0) return { ...base, candidates: [], blockedBy: 'no-match' };
  if (roles.length === 0) return { ...base, candidates: [], blockedBy: 'role-undecided' };

  const candidates: BindingCandidate[] = [];
  for (const { contact, evidence } of matched) {
    for (const role of roles) {
      candidates.push({
        target: { kind: 'contact', contactId: contact.id, role, projectId: context.projectId },
        label: contact.displayName,
        evidence,
      });
    }
  }

  return { ...base, candidates: [...candidates].sort(compareBindingCandidates) };
}
