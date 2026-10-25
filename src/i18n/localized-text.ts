/**
 * =============================================================================
 * ΠΟΛΥΓΛΩΣΣΙΚΟ ΚΕΙΜΕΝΟ ΔΕΔΟΜΕΝΩΝ — «τι έγραψε ο χρήστης, σε κάθε γλώσσα»
 * =============================================================================
 *
 * ⚠️ **ΔΕΝ είναι i18n του UI** (N.11). Τα κείμενα της οθόνης ζουν στα locale JSON.
 * Εδώ ζει κείμενο που **γράφει ο χρήστης** και αποθηκεύεται ως δεδομένο — π.χ. η
 * ετικέτα «Ψυκτική ισχύς» μιας ιδιότητας καταλόγου (ADR-923), που ο προμηθευτής
 * ονομάζει μόνος του και θέλει να τη δει και στα αγγλικά.
 *
 * 🔑 **Οι γλώσσες ΠΑΡΑΓΟΝΤΑΙ από το {@link HUMAN_LANGUAGES}**, ποτέ δεν ξαναγράφονται
 * ως `{ el, en }`. Μια τρίτη γλώσσα προστίθεται στο `languages.ts` και ο τύπος την
 * αποκτά αυτόματα — ενώ το `pseudo` (όργανο ελέγχου, ADR-666) **δεν** μπορεί ποτέ να
 * γίνει κλειδί αποθηκευμένου κειμένου.
 *
 * `Partial` επίτηδες: ο χρήστης γράφει πρώτα στη γλώσσα του· η μετάφραση έρχεται
 * αργότερα (ή ποτέ). Η απουσία είναι **νόμιμη κατάσταση**, όχι σφάλμα — και η
 * επίλυση πέφτει ντετερμινιστικά στην προεπιλεγμένη γλώσσα και μετά σε όποια υπάρχει.
 *
 * @module i18n/localized-text
 * @see ADR-923 §5.2 — ετικέτες ιδιοτήτων/οικογενειών/κατηγοριών
 */

import { DEFAULT_LANGUAGE, HUMAN_LANGUAGES, type HumanLanguage } from './languages';

/** Κείμενο που έγραψε ο χρήστης, ανά ανθρώπινη γλώσσα. */
export type LocalizedText = Partial<Record<HumanLanguage, string>>;

function nonBlank(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * **Η μία επίλυση** — ζητούμενη γλώσσα → προεπιλεγμένη → πρώτη διαθέσιμη (με τη σειρά
 * του {@link HUMAN_LANGUAGES}, άρα ντετερμινιστικά). Επιστρέφει `''` μόνο όταν δεν
 * υπάρχει **καμία** μη κενή τιμή.
 */
export function resolveLocalizedText(text: LocalizedText | undefined, language: HumanLanguage): string {
  if (!text) return '';
  const requested = text[language];
  if (nonBlank(requested)) return requested;
  const fallback = text[DEFAULT_LANGUAGE];
  if (nonBlank(fallback)) return fallback;
  for (const candidate of HUMAN_LANGUAGES) {
    const value = text[candidate];
    if (nonBlank(value)) return value;
  }
  return '';
}

/** Έχει το κείμενο τουλάχιστον μία μη κενή γλώσσα; */
export function hasAnyLocalizedText(text: LocalizedText | undefined): boolean {
  return resolveLocalizedText(text, DEFAULT_LANGUAGE).length > 0;
}

/**
 * Καθαρίζει κενά/λευκά και αφαιρεί κλειδιά που δεν είναι ανθρώπινες γλώσσες —
 * για ό,τι έρχεται **απ' έξω** (σώμα αιτήματος) πριν αποθηκευτεί.
 */
export function normalizeLocalizedText(input: Readonly<Record<string, unknown>>): LocalizedText {
  const out: LocalizedText = {};
  for (const language of HUMAN_LANGUAGES) {
    const raw = input[language];
    if (typeof raw === 'string' && raw.trim().length > 0) out[language] = raw.trim();
  }
  return out;
}
