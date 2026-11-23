/**
 * 🏢 SSoT — **το λεξιλόγιο της νομικής μορφής** μιας επαφής-εταιρείας (ADR-948 §8 · πρότυπο `phone-type-vocabulary.ts`,
 * ADR-327 §8.5.4).
 *
 * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ (2026-11-22 — μετρημένο ζωντανά)**: η ίδια αποθηκευμένη τιμή είχε **τέσσερα** ασύμβατα λεξιλόγια —
 * `VOCAB_LEGAL_FORMS` (`ae`), η φόρμα εταιρείας με `toUpperCase()` (`AE`), ο τύπος `contracts.ts` και ο report-builder
 * (ελληνικά `ΑΕ`), το AI pipeline (ελληνικά). Στη βάση: **6 από 12** εταιρείες με `AE`-τύπου κεφαλαία, **0** πεζά ⇒ η
 * σύγκριση με το ΓΕΜΗ θα έλεγε πάντα «διαφέρει» και τα φίλτρα του report-builder δεν έπιαναν **καμία** επαφή.
 *
 * 🔑 **Μία σταθερή τιμή αποθήκευσης, ετικέτα μόνο μέσω μετάφρασης** — όπως το «API name» ενός picklist του Salesforce
 * απέναντι στην ετικέτα του, ή οι κωδικοί ISO 20275 (ELF). **Αυστηρή εγγραφή** (μόνο μέλη της ρίζας), **ανεκτική
 * ανάγνωση** παλαιών τιμών μέσω του {@link canonicalLegalForm} — η φόρμα δείχνει σωστά την παλιά τιμή και η επόμενη
 * αποθήκευση γράφει τον κανονικό κωδικό (αυτο-θεραπεία), ενώ η μετάπτωση καθαρίζει τα υπόλοιπα.
 *
 * Καθαρό (χωρίς ετικέτες/React) ⇒ το διαβάζουν πελάτης και server. Οι ετικέτες: `options.legalForms.*`
 * (`config/vocabulary/options/company.ts`, δεμένες εδώ). Ρίζα του CHECK 3.73 (`legal-form`).
 *
 * @module lib/contact/legal-form-vocabulary
 */

import { isVocabularyMember } from './owned-type-vocabulary';

/** Όλες οι νομικές μορφές που μπορεί να έχει αποθηκευμένη επαφή-εταιρεία (CHECK 3.73 — ρίζα `legal-form`). */
export const LEGAL_FORMS = [
  'ae', 'epe', 'ee', 'oe', 'ike', 'syndicate', 'sole_proprietorship', 'civil_partnership', 'joint_venture', 'other',
] as const;

export type LegalForm = (typeof LEGAL_FORMS)[number];

/** `true` όταν η τιμή ανήκει στη ρίζα — το σύνορο εγγραφής, αντί για τυφλό `as`. */
export function isLegalForm(value: unknown): value is LegalForm {
  return isVocabularyMember(LEGAL_FORMS, value);
}

/**
 * Τα **παλαιά** ονόματα που κυκλοφόρησαν στο δέντρο (τύπος `contracts.ts`, report-builder, AI prompt) ⇒ κωδικός.
 * Το `ΚΟΙΝΣΕΠ` δεν έχει δική του κατηγορία ⇒ `other` (ADR-948 §8.3 #3: «μορφές χωρίς δική τους κατηγορία ⇒ other»).
 * ⚠️ Κλειστός πίνακας: ό,τι λείπει ⇒ `null`, ποτέ μαντεψιά.
 */
const LEGACY_LEGAL_FORM_ALIASES: Readonly<Record<string, LegalForm>> = {
  'ΑΕ': 'ae',
  'ΕΠΕ': 'epe',
  'ΕΕ': 'ee',
  'ΟΕ': 'oe',
  'ΙΚΕ': 'ike',
  'ΚΟΙΝΣΕΠ': 'other',
};

/**
 * **Η μόνη ανεκτική ανάγνωση**: αποθηκευμένη τιμή οποιασδήποτε εποχής ⇒ κωδικός της ρίζας, ή `null` (κενό/άγνωστο).
 * `AE` ⇒ `ae` · `SOLE_PROPRIETORSHIP` ⇒ `sole_proprietorship` · `ΑΕ` ⇒ `ae` · `OTHER` ⇒ `other`.
 */
export function canonicalLegalForm(raw: unknown): LegalForm | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const lowered = trimmed.toLowerCase();
  if (isLegalForm(lowered)) return lowered;
  return LEGACY_LEGAL_FORM_ALIASES[trimmed.toUpperCase()] ?? null;
}
