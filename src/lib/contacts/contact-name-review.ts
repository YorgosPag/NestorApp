/**
 * @fileoverview **ΛΟΓΑΡΙΑΣΜΟΣ → ΟΝΟΜΑ ΕΠΑΦΗΣ, ΧΩΡΙΣ ΜΑΝΤΕΨΙΑ** (ADR-884 §9.1 Α1).
 * @related `server/spatial-tour/tour-access-contact.ts` (ο καταναλωτής) · `ContactNameReviewNotice.tsx` (η επιβεβαίωση) ·
 *   `utils/greek-name-order.ts` (⚠️ ΑΛΛΗ σύμβαση — εγγράφων, «επώνυμο πρώτο»)
 * @module lib/contacts/contact-name-review
 *
 * 🏆 **Σύμβαση μεγάλων, μετρημένη**: Google People API — `unstructuredName` + δομημένα **μόνο όταν είναι γνωστά**
 * (μονώνυμο ⇒ κενό `familyName`)· W3C *Personal names around the world* — **μη** διασπάτε ολόκληρο όνομα με υπόθεση
 * («Μαρία Παπαδοπούλου» και «Παπαδοπούλου Μαρία» είναι και τα δύο συνηθισμένα).
 *
 * 🔑 **Πάνω από τη Google**: εκείνη σιωπά· εμείς κρατάμε **σήμα** (`nameReview`) με το ακατέργαστο όνομα, και η καρτέλα
 * προτείνει τη διάσπαση με **ένα κλικ αντιστροφής** — ο άνθρωπος αποφασίζει, το σύστημα δεν μαντεύει ποτέ σιωπηλά.
 *
 * ⚠️ **ΔΕΝ είναι η πολιτική της εντολής** (`mandate-owner-identity.ts`): εκεί η ταυτότητα είναι **νομική** (και ΑΦΜ) και
 * ελλιπής ⇒ άρνηση. Εδώ η επαφή είναι CRM — ελλιπής ⇒ επαφή **με σήμα**, όχι απουσία επαφής.
 */

/** Από πού ήρθε το ενιαίο όνομα που χρειάζεται επιβεβαίωση. */
export type ContactNameReviewSource = 'account-display-name' | 'account-email';

/** Το σήμα πάνω στην καρτέλα — υπάρχει **μόνο** όσο το όνομα δεν έχει επιβεβαιωθεί από άνθρωπο. */
export interface ContactNameReview {
  readonly source: ContactNameReviewSource;
  /** Ακριβώς όπως ήρθε — ποτέ επεξεργασμένο. */
  readonly raw: string;
}

/** Τα στοιχεία του λογαριασμού που ξέρουν κάτι για το όνομα. */
export interface AccountNameFacts {
  readonly givenName: string | null;
  readonly familyName: string | null;
  readonly displayName: string | null;
  readonly email: string;
}

export interface AccountContactName {
  readonly givenName: string;
  readonly familyName: string;
  readonly nameReview: ContactNameReview | null;
}

const trimmed = (value: string | null): string => value?.trim() ?? '';

/**
 * **Η απόφαση.** Δομημένα (και τα δύο) ⇒ αυτούσια, χωρίς σήμα. Αλλιώς το ενιαίο όνομα **ακέραιο** στο «Όνομα»
 * (το εμφανιζόμενο όνομα βγαίνει σωστό) + σήμα. Μόνο «Όνομα» δομημένο χωρίς επώνυμο ⇒ και αυτό ελλιπές, με σήμα.
 */
export function accountContactName(facts: AccountNameFacts): AccountContactName {
  const given = trimmed(facts.givenName);
  const family = trimmed(facts.familyName);
  if (given !== '' && family !== '') return { givenName: given, familyName: family, nameReview: null };
  const display = trimmed(facts.displayName);
  if (display !== '') return { givenName: display, familyName: '', nameReview: { source: 'account-display-name', raw: display } };
  if (given !== '') return { givenName: given, familyName: '', nameReview: { source: 'account-display-name', raw: given } };
  const email = facts.email.trim();
  return { givenName: email, familyName: '', nameReview: { source: 'account-email', raw: email } };
}

export interface NameSplitProposal {
  readonly givenName: string;
  readonly familyName: string;
}

/**
 * **Η πρόταση** που δείχνει η καρτέλα — ποτέ δεν γράφεται χωρίς επιβεβαίωση. Πρώτη λέξη = όνομα, υπόλοιπο = επώνυμο
 * (η σειρά του `displayName` στους παρόχους)· `swapped` = η αντίστροφη, για το «Παπαδοπούλου Μαρία».
 * Μία λέξη ⇒ `null` (τίποτα να προταθεί — ο άνθρωπος συμπληρώνει). Από email ⇒ `null` (δεν είναι όνομα).
 */
export function proposeNameSplit(review: ContactNameReview, swapped = false): NameSplitProposal | null {
  if (review.source !== 'account-display-name') return null;
  const words = review.raw.split(/\s+/).filter((word) => word !== '');
  if (words.length < 2) return null;
  const first = words[0];
  const rest = words.slice(1).join(' ');
  return swapped
    ? { givenName: words[words.length - 1], familyName: words.slice(0, -1).join(' ') }
    : { givenName: first, familyName: rest };
}

/** Διαβάζει το σήμα από αποθηκευμένο έγγραφο — άγνωστο σχήμα ⇒ `null` (ποτέ ρίψη σε οθόνη). */
export function nameReviewFromDocument(value: unknown): ContactNameReview | null {
  if (typeof value !== 'object' || value === null) return null;
  const { source, raw } = value as { source?: unknown; raw?: unknown };
  if ((source !== 'account-display-name' && source !== 'account-email') || typeof raw !== 'string' || raw.trim() === '') return null;
  return { source, raw };
}
