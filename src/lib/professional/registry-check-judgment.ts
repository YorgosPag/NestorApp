/**
 * @fileoverview **Η ΚΡΙΣΗ ΤΟΥ ΕΛΕΓΧΟΥ ΣΤΟ ΜΗΤΡΩΟ** — από το ζεύγος (άδεια της επαφής ⇄ αποθηκευμένος έλεγχος), ποτέ
 * αποθηκευμένη (ADR-915 §40.7 Φ2 · πρότυπο `lib/company/registry-identity-judgment.ts`).
 * @module lib/professional/registry-check-judgment
 *
 * 🔑 **Γιατί κρίση στην ανάγνωση**: αν η επαφή αλλάξει αριθμό ή επώνυμο **μετά** τον έλεγχο, μια αποθηκευμένη σημαία
 *    «επαληθευμένο» θα έλεγε ψέματα. Εδώ ο έλεγχος μετρά **μόνο** για τον αριθμό και το επώνυμο που ισχύουν **τώρα**.
 * 🔑 **Επώνυμο, όχι ονοματεπώνυμο**: το μητρώο γράφει «ΕΠΩΝΥΜΟ ΟΝΟΜΑ» σε κεφαλαία· η επαφή μπορεί να έχει υποκοριστικό.
 *    Σύγκριση χωρίς τόνους/πεζά-κεφαλαία/κενά, σε λατινική μεταγραφή (ώστε «Παγώνης» = «ΠΑΓΩΝΗΣ» = «Pagonis»).
 * Καθαρό leaf.
 */

import type { ProfessionalLicence } from '@/config/professional-licences';
import { readContactLicences } from '@/lib/contacts/contact-licences';
import type { ShowcaseLicence } from '@/types/agency-profile';
import type {
  LicenceStanding,
  ProfessionalRegistryCheckRecord,
  RegistryCheckJudgment,
} from '@/types/professional-registry-check';
import { transliterateGreekToLatin } from '@/utils/greek-text';

/** Η μορφή σύγκρισης ενός επωνύμου — λατινικά, χωρίς τόνους, κενά, παύλες ή τελείες. */
function surnameKey(surname: string): string {
  return transliterateGreekToLatin(surname).replace(/[\s.\-'΄’]/gu, '');
}

/** Ίδιο επώνυμο; Κενό σε οποιαδήποτε πλευρά ⇒ όχι (δεν αποδεικνύεται τίποτα). */
export function sameSurname(a: string, b: string): boolean {
  const left = surnameKey(a);
  return left !== '' && left === surnameKey(b);
}

/** Ό,τι χρειάζεται η κρίση από την επαφή. */
export interface RegistryCheckSubject {
  readonly licence: ProfessionalLicence;
  /** Η άδεια όπως την κρατά **τώρα** η επαφή — `null` αν δεν την έχει. */
  readonly held: ShowcaseLicence | null;
  readonly lastName: string;
}

/**
 * Ό,τι χρειάζεται η κρίση από την **ήδη φορτωμένη** επαφή (ο καλών έχει ελέγξει ιδιοκτησία). Ζει εδώ, στο καθαρό leaf,
 * ώστε ο αναγνώστης του μητρώου λήξεων να **μην** φορτώνει τον πελάτη του buildingcert.gr (ADR-915 §40.7 Φ3).
 */
export function registryCheckSubjectOf(contact: Readonly<Record<string, unknown>>, licence: ProfessionalLicence): RegistryCheckSubject {
  const held = readContactLicences(contact.licences).find((candidate) => candidate.licence === licence) ?? null;
  return { licence, held, lastName: typeof contact.lastName === 'string' ? contact.lastName : '' };
}

/** **Η κρίση.** Κανένας έλεγχος, ή έλεγχος άλλης άδειας ⇒ `not-checked`. */
export function judgeRegistryCheck(
  subject: RegistryCheckSubject,
  record: ProfessionalRegistryCheckRecord | null,
): RegistryCheckJudgment {
  if (record === null || record.licence !== subject.licence || subject.held === null) return { state: 'not-checked' };
  if (subject.held.attestation.registration.number.trim() !== record.number) {
    return { state: 'stale-number', checkedAt: record.checkedAt };
  }
  if (!sameSurname(subject.lastName, record.surname)) return { state: 'name-mismatch', checkedAt: record.checkedAt };
  return { state: 'verified', grades: record.grades, checkedAt: record.checkedAt };
}

/**
 * ADR-915 §40.7 Φ3 — **η τάξη που μετρά**: της αρχής όταν ο έλεγχος είναι `verified` για τον **τρέχοντα** αριθμό και
 * επώνυμο· αλλιώς η δήλωση (`name-mismatch` · `stale-number` δεν δίνουν τάξεις — δεν αφορούν τον άνθρωπό μας).
 */
export function licenceStandingOf(held: ShowcaseLicence, judgment: RegistryCheckJudgment): LicenceStanding {
  if (judgment.state === 'verified') return { grades: judgment.grades, source: 'registry', checkedAt: judgment.checkedAt };
  return { grades: held.grades ?? {}, source: 'declared', checkedAt: null };
}
