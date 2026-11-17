/**
 * @fileoverview **ΣΥΜΦΩΝΕΙ ΤΟ ΟΝΟΜΑ ΤΗΣ ΕΠΑΦΗΣ ΜΕ ΤΟΝ ΛΟΓΑΡΙΑΣΜΟ;** — καθαρή σύγκριση με επίγνωση ελληνικών (ADR-915 §40.8).
 * @module lib/engagements/contact-account-name-match
 *
 * Η επαφή λέει «Αλέξανδρος Μαυρίδης», ο λογαριασμός που αποδέχτηκε λέει «ΓΕΩΡΓΙΟΣ ΠΕΑΣ» — το γραφείο πρέπει να το
 * **δει**. Αλλά «Γιώργος Πέας» ≡ «ΓΙΩΡΓΟΣ ΠΕΑΣ» ≡ «Giorgos Peas» ≡ «Πέας Γιώργος»: τόνοι, κεφαλαία, τελικό σίγμα,
 * γραφή και σειρά **δεν** είναι διαφορά. Ένα ψεύτικο «διαφέρει» μαθαίνει τον άνθρωπο να αγνοεί το σήμα.
 *
 * 🔑 **Σύγκριση πάνω σε σύνολα λέξεων**, όλα σε λατινική μεταγραφή (`transliterateGreekToLatin` — το ΕΝΑ SSoT).
 * 🔑 **Υποσύνολο = ταίριασμα**: «Γεώργιος Πέας» ⊂ «Γεώργιος Ιωάννης Πέας» (πατρώνυμο/μεσαίο όνομα δεν είναι αντίφαση).
 * ⚠️ **Λείπει πλευρά ⇒ `unknown`**, ποτέ `differs`: απουσία δεδομένου δεν είναι ισχυρισμός.
 */

import { transliterateGreekToLatin } from '@/utils/greek-text';
import type { ContactAccountNameMatch } from '@/types/contact-professional-link';

/** Το όνομα της επαφής, όπως το κράτησε το γραφείο — `null` όταν η επαφή δεν είναι φυσικό πρόσωπο. */
export interface ContactPersonName {
  readonly firstName: string | null;
  readonly lastName: string | null;
}

/** Το όνομα του λογαριασμού — δομημένο όπου υπάρχει, αλλιώς το `displayName`. */
export interface AccountPersonName {
  readonly givenName: string | null;
  readonly familyName: string | null;
  readonly displayName: string | null;
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/**
 * Το όνομα από το **ωμό** έγγραφο επαφής — μόνο φυσικό πρόσωπο (`type: 'individual'`). Εταιρεία/υπηρεσία ⇒ `null`:
 * η επωνυμία μιας εταιρείας **πάντα** θα «διέφερε» από όνομα ανθρώπου, και αυτό δεν είναι εύρημα.
 */
export function contactPersonNameOf(data: Readonly<Record<string, unknown>> | undefined): ContactPersonName | null {
  if (data === undefined || data.type !== 'individual') return null;
  return { firstName: textOrNull(data.firstName), lastName: textOrNull(data.lastName) };
}

/** Λέξεις γραμμάτων/ψηφίων, σε λατινική μεταγραφή — ο διαχωρισμός (κενό, παύλα, τελεία) δεν μετρά. */
function wordsOf(...parts: readonly (string | null)[]): ReadonlySet<string> {
  const text = parts.filter((p): p is string => typeof p === 'string').join(' ');
  return new Set(transliterateGreekToLatin(text).split(/[^\p{L}\p{N}]+/u).filter((w) => w !== ''));
}

function isSubset(small: ReadonlySet<string>, large: ReadonlySet<string>): boolean {
  for (const word of small) if (!large.has(word)) return false;
  return true;
}

/** Οι λέξεις του λογαριασμού: τα δομημένα πεδία όπου υπάρχουν, αλλιώς το εμφανιζόμενο όνομα. */
function accountWordsOf(account: AccountPersonName): ReadonlySet<string> {
  const structured = wordsOf(account.givenName, account.familyName);
  return structured.size > 0 ? structured : wordsOf(account.displayName);
}

/** `match` · `differs` · `unknown` — βλ. {@link ContactAccountNameMatch}. */
export function compareContactToAccount(
  contact: ContactPersonName | null,
  account: AccountPersonName | null,
): ContactAccountNameMatch {
  if (contact === null || account === null) return 'unknown';
  const contactWords = wordsOf(contact.firstName, contact.lastName);
  const accountWords = accountWordsOf(account);
  if (contactWords.size === 0 || accountWords.size === 0) return 'unknown';
  const [small, large] = contactWords.size <= accountWords.size ? [contactWords, accountWords] : [accountWords, contactWords];
  return isSubset(small, large) ? 'match' : 'differs';
}
