/**
 * @fileoverview **ΓΕΙΩΜΕΝΗ ΑΝΑΓΝΩΣΗ** — πότε μια τιμή που διάβασε η AI **αξίζει** σύγκριση (ADR-950 §3 · §4.3).
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
 * (libphonenumber) · ημερομηνία → `lib/survey-record/survey-date` · κείμενο → `utils/greek-text`.
 *
 * **Layering**: καθαρή — καμία I/O, κανένα ρολόι.
 */

import type { EvidenceFieldKind } from '@/config/contact-document-evidence';
import { normalisePhone } from '@/lib/contact/channel-phone';
import { present } from '@/lib/comparison/field-judgment';
import { parseSurveyDate } from '@/lib/survey-record/survey-date';
import { isValidGreekVat, normalizeVat } from '@/lib/validation/greek-vat-number';
import { GREEK_TAX_OFFICES } from '@/subapps/accounting/data/greek-tax-offices';
import { foldLatinWord, normalizeForLabelMatch, stripAccents } from '@/utils/greek-text';

/** Γιατί μια ανάγνωση **δεν** συγκρίνεται. */
export type UngroundedReason = 'absent' | 'low-confidence' | 'failed-check';

export type GroundedValue =
  | { readonly ok: true; readonly printed: string; readonly display: string; readonly key: string }
  | { readonly ok: false; readonly printed: string | null; readonly reason: UngroundedReason };

type Grounder = (printed: string) => { readonly display: string; readonly key: string } | null;

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

/** Ελληνικός Τ.Κ.: ακριβώς 5 ψηφία («546 24» = «54624»). */
const groundPostalCode: Grounder = (printed) => {
  const digits = printed.replace(/\s/g, '');
  return /^\d{5}$/.test(digits) ? { display: digits, key: digits } : null;
};

/** Κωδικός (αρ. ταυτότητας, αρ. ΤΕΕ): χωρίς κενά/παύλες, ελληνικά ομοιόμορφα ⇒ λατινικά («ΑΚ 123456» = «AK123456»). */
const groundCode: Grounder = (printed) => {
  const compact = stripAccents(printed).toUpperCase().replace(/[\s\-./]/g, '');
  if (!/[\p{L}\p{N}]/u.test(compact)) return null;
  return { display: printed.trim(), key: foldLatinWord(compact) };
};

/** «Δ.Ο.Υ. Α΄ ΑΘΗΝΩΝ» · «ΔΟΥ Α' Αθηνών» · «Α ΑΘΗΝΩΝ» ⇒ η ίδια μορφή σύγκρισης (χωρίς πρόθεμα, τόνους, αποστρόφους). */
function taxOfficeForm(text: string): string {
  return normalizeForLabelMatch(text)
    .replace(/['΄’ʹ`]/g, '')
    // ⚠️ ΟΧΙ `\b`: στη JS το όριο λέξης είναι ΜΟΝΟ λατινικό — το `δου\b` δεν θα ταίριαζε ποτέ.
    .replace(/^\s*δου(?=\s|$)/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const TAX_OFFICE_BY_FORM: ReadonlyMap<string, readonly string[]> = (() => {
  const byForm = new Map<string, string[]>();
  for (const office of GREEK_TAX_OFFICES) {
    const form = taxOfficeForm(office.name);
    byForm.set(form, [...(byForm.get(form) ?? []), office.code]);
  }
  return byForm;
})();

/**
 * ΔΟΥ: κωδικός του καταλόγου (ό,τι αποθηκεύει το `DoyPicker`) **ή** όνομα που αντιστοιχεί σε **μία** γνωστή ΔΟΥ.
 * Όνομα εκτός καταλόγου ή διφορούμενο ⇒ `null` — ποτέ μαντεψιά. Κλειδί = ο κωδικός.
 */
const groundTaxOffice: Grounder = (printed) => {
  const trimmed = printed.trim();
  if (GREEK_TAX_OFFICES.some((office) => office.code === trimmed)) return { display: trimmed, key: trimmed };
  const codes = TAX_OFFICE_BY_FORM.get(taxOfficeForm(trimmed)) ?? [];
  return codes.length === 1 ? { display: codes[0], key: codes[0] } : null;
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
): GroundedValue {
  const printed = present(printedValue);
  if (printed === null) return { ok: false, printed: null, reason: 'absent' };
  if (confidence < minConfidence) return { ok: false, printed, reason: 'low-confidence' };
  const grounded = GROUNDERS[kind](printed);
  return grounded === null ? { ok: false, printed, reason: 'failed-check' } : { ok: true, printed, ...grounded };
}

/** Η **ίδια** κανονική μορφή για την πλευρά της επαφής — ώστε «ίδιο» να σημαίνει ίδιο κλειδί. `null` ⇒ δεν κανονικοποιείται. */
export function contactValueKey(kind: EvidenceFieldKind, contactValue: string): string | null {
  return GROUNDERS[kind](contactValue)?.key ?? null;
}
