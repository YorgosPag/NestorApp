/**
 * @fileoverview **Η ΤΕΛΕΙΑ ΤΗΣ ΣΥΝΤΟΜΟΓΡΑΦΙΑΣ ΚΛΕΙΝΕΙ ΚΑΙ ΤΗΝ ΠΡΟΤΑΣΗ** — ο κανόνας τυπογραφίας, σε ΕΝΑ σημείο της απόδοσης
 *   κειμένου (ADR-279 · ADR-923 §5.14.1).
 * @related i18n/config.ts (ο client: postProcessor) · i18n/bundle-translate.ts (ο server: `formatBundleText`)
 * @module i18n/sentence-period
 *
 * 🔴 **Το περιστατικό (2026-11-03, ζωντανή οθόνη)**: «Τιμές και ορατότητα όπως ίσχυαν στις 03/11/2026, 09:15 μ.μ..». Το CLDR
 *    γράφει την ελληνική ώρα με `μ.μ.`/`π.μ.` (τελεία συντομογραφίας) και το μήνυμα κλείνει την πρόταση με δική του τελεία.
 *    Δεκαέξι μηνύματα του `el` τελειώνουν σε `{date}.` / `{time}.` — η κλάση, όχι το δείγμα.
 * 🔑 **Ο κανόνας** (Chicago Manual of Style · AP · ελληνική τυπογραφία): όταν η πρόταση τελειώνει σε συντομογραφία με τελεία,
 *    **μία** τελεία σημαίνει και τα δύο. Το `AM.` (κεφαλαία, χωρίς τελεία) **δεν** αγγίζεται.
 * 🔑 **Γιατί εδώ και όχι στο μήνυμα**: η μορφή της τιμής την αποφασίζει η γλώσσα (CLDR), όχι ο μεταφραστής· ο ίδιος κανόνας
 *    ισχύει για ώρες, επωνυμίες (`Α.Ε.`), `κ.λπ.`, σε κάθε μήνυμα, χωρίς να το θυμάται κανείς. Ακριβής: συγχωνεύει **μόνο**
 *    όταν τιμή παρεμβολής τελειώνει σε τελεία **και** την ακολουθεί αμέσως η τελεία του μηνύματος.
 * ⚠️ **ΜΗΝ** το «λύσεις» αλλάζοντας τη μορφή ώρας: το `el` του CLDR είναι `h12` και η επιλογή 24ωρου είναι απόφαση προϊόντος για
 *    ΟΛΗ την εφαρμογή, όχι διόρθωση μίας πρότασης.
 */

import type { PostProcessorModule } from 'i18next';

export const SENTENCE_PERIOD = 'sentencePeriod';

/** Επιλογές του `t()` που δεν είναι τιμές παρεμβολής: δεν αποδίδονται ποτέ μέσα στο κείμενο. */
const RESERVED_OPTIONS: ReadonlySet<string> = new Set([
  'lng', 'lngs', 'ns', 'defaultValue', 'context', 'replace', 'postProcess', 'keyPrefix', 'fallbackLng',
  'ordinal', 'returnObjects', 'returnDetails', 'joinArrays', 'interpolation', 'count',
]);

/** Τιμές που τελειώνουν σε τελεία συντομογραφίας (όχι μόνη τελεία). */
function periodEndedValues(values: Readonly<Record<string, unknown>>): readonly string[] {
  return Object.entries(values).flatMap(([name, value]) =>
    !RESERVED_OPTIONS.has(name) && typeof value === 'string' && value.length > 1 && value.endsWith('.') ? [value] : [],
  );
}

/** «…μ.μ..» ⇒ «…μ.μ.» — μόνο εκεί όπου η τιμή παρεμβολής και η τελεία του μηνύματος συναντιούνται. */
export function absorbSentencePeriod(text: string, values: Readonly<Record<string, unknown>> | undefined): string {
  if (!values) return text;
  return periodEndedValues(values).reduce((result, value) => result.replaceAll(`${value}.`, value), text);
}

interface SentencePeriodOptions {
  readonly [name: string]: unknown;
}

/** Ο κανόνας ως postProcessor του i18next — ενεργός σε κάθε γλώσσα. */
export const sentencePeriodPostProcessor: PostProcessorModule = {
  type: 'postProcessor',
  name: SENTENCE_PERIOD,
  process(value: string, _key: string | string[], options: SentencePeriodOptions): string {
    return typeof value === 'string' ? absorbSentencePeriod(value, options) : value;
  },
};
