/**
 * @fileoverview **ΓΕΙΩΜΕΝΗ ΑΝΑΓΝΩΣΗ** — πότε μια τιμή που διάβασε η AI **αξίζει** σύγκριση (ADR-950 §3 · §4.3 · §8).
 * @module lib/contacts/contact-evidence-grounding
 *
 * Η λεκτική εμπιστοσύνη ενός LLM είναι συστηματικά υπερβολική (Xiong et al., 2023). Γι' αυτό η τιμή γίνεται
 * συγκρίσιμη **μόνο** αν περάσει **ντετερμινιστικό** ελεγκτή του είδους της· αλλιώς είναι «δυσανάγνωστη» και
 * **ποτέ** «διαφορά». Ένας λάθος ΑΦΜ από κακή ανάγνωση αποτυγχάνει στο ψηφίο ελέγχου με πιθανότητα ~90%.
 *
 * Κάθε γειωμένη τιμή έχει δύο μορφές:
 * - `display` — ό,τι γράφει το «Αποδοχή» στη φόρμα (στη σύμβαση αποθήκευσης της φόρμας),
 * - `key` — η κανονική μορφή σύγκρισης· είναι και το κλειδί της «Αγνόησης» (`EvidenceDismissal`).
 *
 * Ελεγκτές: **κανένας νέος**. ΑΦΜ → `lib/validation/greek-vat-number` · τηλέφωνο → `lib/contact/channel-phone`
 * (libphonenumber) · ημερομηνία → `lib/survey-record/survey-date` · κείμενο → `utils/greek-text` · Τ.Κ. →
 * `utils/address/address-parse` · ΔΟΥ → `subapps/accounting/data/greek-tax-office-match`.
 *
 * Ό,τι θέλει I/O (χάρτης, δεύτερη ανάγνωση) το κάνει ο **διακομιστής** τη στιγμή της ανάγνωσης και το αποθηκεύει ως
 * τεκμήριο (ADR-950 §8)· εδώ φτάνει ως `GroundingContext`.
 *
 * **Layering**: καθαρή — καμία I/O, κανένα ρολόι.
 */

import type { EvidenceFieldKind } from '@/config/contact-document-evidence';
import { normalisePhone } from '@/lib/contact/channel-phone';
import { present } from '@/lib/comparison/field-judgment';
import { parseSurveyDate } from '@/lib/survey-record/survey-date';
import { isValidGreekVat, normalizeVat } from '@/lib/validation/greek-vat-number';
import { resolveTaxOfficeCode } from '@/subapps/accounting/data/greek-tax-office-match';
import { extractPostalCode } from '@/utils/address/address-parse';
import { foldLatinWord, normalizeForLabelMatch, stripAccents } from '@/utils/greek-text';

/**
 * Γιατί μια ανάγνωση **δεν** συγκρίνεται.
 * - `disputed` — η δεύτερη, ανεξάρτητη ανάγνωση είπε **άλλο** (ADR-950 §8.3)·
 * - `unverified` — η διεύθυνση δεν επιβεβαιώθηκε στον χάρτη (ADR-950 §8.2).
 */
export type UngroundedReason = 'absent' | 'low-confidence' | 'failed-check' | 'disputed' | 'unverified';

export type GroundedValue =
  | { readonly ok: true; readonly printed: string; readonly display: string; readonly key: string }
  | { readonly ok: false; readonly printed: string | null; readonly reason: UngroundedReason };

/** Ό,τι ξέρει ο γειωτής **πέρα** από το κείμενο — αποδεδειγμένο αλλού (τεκμήρια διακομιστή). */
export interface GroundingContext {
  /** Τόποι που επιβεβαίωσε ο χάρτης για το ίδιο έγγραφο — αποσαφήνιση ΔΟΥ («Ιωνίας» ⇒ Θεσσαλονίκης). */
  readonly places?: readonly string[];
}

type Grounder = (printed: string, context: GroundingContext) => { readonly display: string; readonly key: string } | null;

/** «ΑΦΜ: 094 063 140» · «EL094063140» ⇒ τα 9 ψηφία, μόνο αν περνούν μορφή **και** ψηφίο ελέγχου. */
const groundVat: Grounder = (printed) => {
  const digits = normalizeVat(printed).replace(/^EL/i, '').replace(/\D/g, '');
  return isValidGreekVat(digits) ? { display: digits, key: digits } : null;
};

/** Αριθμός που **μπορεί να καλεστεί** (libphonenumber `isValid`) — κλειδί E.164. */
const groundPhone: Grounder = (printed) => {
  const phone = normalisePhone(printed);
  return phone.ok ? { display: phone.e164, key: phone.e164 } : null;
};

/** Πλήρης ημερομηνία (ημέρα + μήνας + έτος, υπαρκτή στο ημερολόγιο) ⇒ `DD/MM/YYYY`, η σύμβαση της φόρμας. */
const groundDate: Grounder = (printed) => {
  const parsed = parseSurveyDate(printed);
  if (parsed.precision !== 'day' || parsed.iso === null) return null;
  const [year, month, day] = parsed.iso.split('-');
  return { display: `${day}/${month}/${year}`, key: parsed.iso };
};

/**
 * Ελληνικός Τ.Κ. — με τον **ΕΝΑ** εξαγωγέα (`extractPostalCode`): «Τ.Κ. 563 34» · «ΤΚ 56334» · «546 24» ⇒ «56334».
 * Δεκτό **μόνο** αν δίπλα του δεν μένει άλλο ψηφίο (η ετικέτα φεύγει, ένας δεύτερος αριθμός όχι).
 * 🔴 2026-11-23 (ζωντανός έλεγχος): το σκέτο «αφαίρεσε κενά» απέρριπτε το «Τ.Κ. 56334» ⇒ διεύθυνση χωρίς Τ.Κ.
 */
const groundPostalCode: Grounder = (printed) => {
  const { postalCode, remainder } = extractPostalCode(printed);
  if (postalCode === undefined || /\d/.test(remainder)) return null;
  return { display: postalCode, key: postalCode };
};

/** Κωδικός (αρ. ταυτότητας): χωρίς κενά/παύλες, ελληνικά ομοιόμορφα ⇒ λατινικά («ΑΚ 123456» = «AK123456»). */
const groundCode: Grounder = (printed) => {
  const compact = stripAccents(printed).toUpperCase().replace(/[\s\-./]/g, '');
  if (!/[\p{L}\p{N}]/u.test(compact)) return null;
  return { display: printed.trim(), key: foldLatinWord(compact) };
};

/**
 * Αριθμός μητρώου (ΤΕΕ): **μόνο** τα ψηφία, χωρίς την ετικέτα («Μητρώου 74693» · «Α.Μ. ΤΕΕ 74 693» ⇒ «74693»).
 * Μία συστάδα ψηφίων (κενά/τελείες ανάμεσα σε ψηφία επιτρέπονται)· δύο χωριστοί αριθμοί ⇒ `null`, ποτέ επιλογή.
 * ⚠️ Χωριστό από το `groundCode`: εκεί τα γράμματα **είναι** μέρος του κωδικού («ΑΚ 123456»).
 * 🔴 2026-11-23: με το `groundCode` το κλειδί γινόταν «ΜΗΤΡΩΟΥ74693» και η «Αποδοχή» θα έγραφε και τη λέξη.
 */
const groundRegistryNumber: Grounder = (printed) => {
  const runs = printed.replace(/(\d)[\s.](?=\d)/g, '$1').match(/\d+/g) ?? [];
  return runs.length === 1 ? { display: runs[0], key: runs[0] } : null;
};

/**
 * ΔΟΥ: κωδικός του καταλόγου (ό,τι αποθηκεύει το `DoyPicker`) ή όνομα που αντιστοιχεί σε **μία** ΔΟΥ — με τη ΜΙΑ
 * αντιστοίχιση (`resolveTaxOfficeCode`), αποσαφηνισμένη από τόπους του χάρτη. Διφορούμενο ⇒ `null`. Κλειδί = ο κωδικός.
 */
const groundTaxOffice: Grounder = (printed, context) => {
  const code = resolveTaxOfficeCode(printed, context.places ?? []);
  return code === null ? null : { display: code, key: code };
};

/** Ελεύθερο κείμενο: καμία γείωση πέρα από «υπάρχει» — γι' αυτό τα κατώφλια του είναι υψηλότερα. */
const groundText: Grounder = (printed) => {
  const key = normalizeForLabelMatch(printed).replace(/\s+/g, ' ').trim();
  return key === '' ? null : { display: printed.trim().replace(/\s+/g, ' '), key };
};

const GROUNDERS: Readonly<Record<EvidenceFieldKind, Grounder>> = {
  personName: groundText,
  organisationName: groundText,
  nameToken: groundText,
  vat: groundVat,
  taxOffice: groundTaxOffice,
  text: groundText,
  code: groundCode,
  registryNumber: groundRegistryNumber,
  date: groundDate,
  postalCode: groundPostalCode,
  addressPart: groundText,
  phone: groundPhone,
};

/** Η **μία** ερώτηση: «συγκρίνεται αυτή η ανάγνωση;» — πρώτα η απουσία, μετά η εμπιστοσύνη, μετά ο ελεγκτής. */
export function groundEvidence(
  kind: EvidenceFieldKind,
  printedValue: string | null,
  confidence: number,
  minConfidence: number,
  context: GroundingContext = {},
): GroundedValue {
  const printed = present(printedValue);
  if (printed === null) return { ok: false, printed: null, reason: 'absent' };
  if (confidence < minConfidence) return { ok: false, printed, reason: 'low-confidence' };
  const grounded = GROUNDERS[kind](printed, context);
  return grounded === null ? { ok: false, printed, reason: 'failed-check' } : { ok: true, printed, ...grounded };
}

/** Η **ίδια** κανονική μορφή για την πλευρά της επαφής — ώστε «ίδιο» να σημαίνει ίδιο κλειδί. `null` ⇒ δεν κανονικοποιείται. */
export function contactValueKey(kind: EvidenceFieldKind, contactValue: string): string | null {
  return GROUNDERS[kind](contactValue, {})?.key ?? null;
}

/** Η κανονική μορφή μιας **ανάγνωσης** — για να κρίνει ο διακομιστής αν δύο αναγνώσεις λένε το ίδιο (ADR-950 §8.3). */
export function evidenceReadingKey(kind: EvidenceFieldKind, printed: string | null): string | null {
  const value = present(printed);
  return value === null ? null : GROUNDERS[kind](value, {})?.key ?? null;
}
